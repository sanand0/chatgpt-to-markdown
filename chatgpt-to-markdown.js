import { promises as fs } from "node:fs";
import path from "node:path";
import { codeFence, details, frontmatter, isoDate } from "./scraper-format.js";

function sanitizeFileName(title) {
  return String(title ?? "").replace(/[<>:"/\\|?*\n]/g, " ").replace(/[^\w\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("utm_source");
    return parsed.toString();
  } catch {
    return url;
  }
}

function renderCitations(text, references = []) {
  const cited = references.filter(({ items }) => items?.some(({ url }) => url));
  let position = 0;
  return String(text ?? "").replace(/cite([^]+)/g, () => {
    const sources = cited[position++]?.items ?? [];
    return [
      ...new Set(
        sources.filter(({ url }) => url).map(({ attribution, title, url }) =>
          `[${attribution || title || "source"}](${cleanUrl(url)})`
        ),
      ),
    ].join(", ");
  });
}

function assetMarkdown(part, attachments, assetFiles) {
  const id = part.asset_pointer?.replace(/^.*:\/\//, "");
  const attachment = attachments.find(({ id: other }) => id === other);
  const name = attachment?.name ?? id ?? "Image";
  const filename = assetFiles?.[id];
  const dimensions = part.width && part.height ? ` (${part.width}x${part.height})` : "";
  const prompt = part?.metadata?.dalle?.prompt;
  return `${filename ? `[${name}](${encodeURI(filename)})` : "Image"}${dimensions}${prompt ? `: ${prompt}` : ""}`;
}

function bodyMarkdown(message, assetFiles) {
  const content = message.content;
  if (!content || content.content_type === "user_editable_context") return "";
  const attachments = message.metadata?.attachments ?? [];
  const rendered = new Set();
  const cite = (text) => renderCitations(text, message.metadata?.content_references);
  let body = "";
  switch (content.content_type) {
    case "text":
      body = (content.parts ?? []).filter((p) => typeof p === "string").map(cite).join("\n");
      break;
    case "code":
      body = codeFence(content.text, content.language === "unknown" ? "" : content.language);
      break;
    case "execution_output":
      body = codeFence(content.text);
      break;
    case "multimodal_text":
      body = (content.parts ?? []).map((part) => {
        if (typeof part === "string") return cite(part);
        if (part?.content_type === "image_asset_pointer") {
          rendered.add(part.asset_pointer?.replace(/^.*:\/\//, ""));
          return assetMarkdown(part, attachments, assetFiles);
        }
        if (part?.content_type === "text") return cite(part.text);
        return part?.content_type || "";
      }).filter(Boolean).join("\n\n");
      break;
    case "tether_browsing_display":
      body = codeFence([content.summary, content.result].filter(Boolean).join("\n"));
      break;
    case "tether_quote":
      body = `> ${[`${content.title} (${content.url})`, content.text].join("\n\n").replace(/\n/g, "\n> ")}`;
      break;
    case "system_error":
      body = [content.name, content.text].filter(Boolean).join("\n\n");
      break;
    case "thoughts":
      body = (content.thoughts ?? []).filter((thought) => thought.content?.trim()).map((thought) =>
        details(thought.summary || "Thinking", `> ${thought.content.trim().replace(/\n/g, "\n> ")}`)
      ).join("\n\n");
      break;
    case "reasoning_recap":
      body = content.content ? `*${content.content}*` : "";
      break;
    case "sonic_webpage":
      body = codeFence(`${content.title} (${content.url})\n\n${content.text}`);
      break;
    default:
      body = codeFence(JSON.stringify(content, null, 2), "json");
  }
  const extra = attachments.filter(({ id }) => !rendered.has(id) && assetFiles?.[id]).map(({ id, name, mime_type }) =>
    `* Attachment: [${name ?? id}](${encodeURI(assetFiles[id])})${mime_type ? ` (${mime_type})` : ""}`
  );
  if (extra.length) body = [body, extra.join("\n")].filter(Boolean).join("\n\n");
  return body.trim();
}

function currentBranch(conversation) {
  const mapping = conversation.mapping ?? {};
  if (!conversation.current_node || !mapping[conversation.current_node]) {
    return Object.values(mapping).sort((a, b) => (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0));
  }
  const result = [];
  const seen = new Set();
  let id = conversation.current_node;
  while (id && mapping[id] && !seen.has(id)) {
    seen.add(id);
    result.unshift(mapping[id]);
    id = mapping[id].parent;
  }
  return result;
}

function conversationTurns(conversation, assetFiles) {
  const turns = [];
  const appendToAssistant = (body) => {
    if (!body) return;
    const last = turns[turns.length - 1];
    if (last?.role === "assistant") last.body += `\n\n${body}`;
    else turns.push({ role: "assistant", body });
  };
  for (const node of currentBranch(conversation)) {
    const message = node?.message;
    const role = message?.author?.role;
    if (!["user", "assistant", "tool"].includes(role)) continue;
    const body = bodyMarkdown(message, assetFiles);
    if (!body) continue;
    const type = message.content?.content_type;
    if (role === "tool") {
      appendToAssistant(details(`Called tool: ${message.author?.name ?? "Tool"}`, body));
      continue;
    }
    if (role === "assistant" && ["thoughts", "reasoning_recap"].includes(type)) {
      appendToAssistant(body);
      continue;
    }
    turns.push({ role, body, timestamp: isoDate(message.create_time) });
  }
  return turns;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
export const formatDate = (date) => dateFormatter.format(date);

/** Convert ChatGPT conversations into the same Markdown transcript as chatgptscraper.js. */
async function chatgptToMarkdown(json, sourceDir, { assetFiles, dateFormat } = {}) {
  if (!Array.isArray(json)) throw new TypeError("The first argument must be an array.");
  if (typeof sourceDir !== "string") throw new TypeError("The second argument must be a string.");
  json.sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0));
  const counts = {};
  for (const conversation of json) {
    await processConversation(conversation, sourceDir, { assetFiles, dateFormat, counts });
  }
}

/** Write a single conversation; shared counts keep duplicate filenames unique across shards. */
export async function processConversation(conversation, sourceDir, { assetFiles, dateFormat, counts = {} } = {}) {
  const title = conversation.title || conversation.conversation_id || "Untitled conversation";
  const name = sanitizeFileName(title) || conversation.conversation_id || "Untitled conversation";
  const count = counts[name] ?? 0;
  counts[name] = count + 1;
  const filename = `${name}${count ? ` (${count})` : ""}.md`;
  const url = conversation.conversation_id ? `https://chatgpt.com/c/${conversation.conversation_id}` : "";
  const timestamp = conversation.update_time ?? conversation.create_time;
  const iso = isoDate(timestamp);
  const date = dateFormat && iso ? dateFormat(new Date(iso)) : iso;
  const turns = conversationTurns(conversation, assetFiles).map(({ role, body, timestamp }) =>
    `# ${role === "user" ? "User" : "ChatGPT"}\n\n${timestamp ? `_${timestamp}_\n\n` : ""}${body}`
  );
  const markdown = frontmatter(title, date, url) + (turns.length ? `${turns.join("\n\n")}\n` : "");
  const file = path.join(sourceDir, filename);
  await fs.writeFile(file, markdown, "utf8");
  if (timestamp && conversation.create_time) await fs.utimes(file, timestamp, conversation.create_time);
}

export default chatgptToMarkdown;
