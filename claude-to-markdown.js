import { promises as fs } from "node:fs";
import path from "node:path";
import { codeFence, details, frontmatter, isoDate } from "./scraper-format.js";

function sanitizeFileName(title) {
  return String(title ?? "").replace(/[<>:"/\\|?*\n]/g, " ").replace(/[^\w\s]/gi, " ").replace(/\s+/g, " ").trim();
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

function safeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toolDetails(use, result) {
  const name = use.name || "Tool";
  const request = use.input === undefined
    ? use.message ?? ""
    : typeof use.input === "string"
    ? use.input
    : JSON.stringify(use.input, null, 2);
  let body = `Request\n\n${codeFence(request)}`;
  if (result) {
    const contents = (result.content ?? []).map((entry) => {
      const data = safeJson(entry?.text ?? entry);
      return typeof data === "string" ? data : JSON.stringify(data, null, 2);
    }).filter(Boolean);
    const response = contents.join("\n\n") || result.message || "";
    if (response) body += `\n\nResponse\n\n${codeFence(response)}`;
  }
  return details(`Called tool: ${name}`, body);
}

function thinkingBlock(part) {
  const summary = part.summaries?.find(({ summary }) => summary)?.summary || "Thinking";
  const content = (part.thinking || "").trim();
  return details(summary, content ? `> ${content.replace(/\n/g, "\n> ")}` : "");
}

function renderContent(parts) {
  const chunks = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part) continue;
    if (part.type === "tool_use") {
      // Claude exports commonly include the corresponding result immediately after a use.
      const next = parts[index + 1];
      const matches = next?.type === "tool_result"
        && (!part.id || !next.tool_use_id || next.tool_use_id === part.id);
      chunks.push(toolDetails(part, matches ? next : undefined));
      if (matches) index++;
      continue;
    }
    if (part.type === "tool_result") {
      chunks.push(
        details(
          `Called tool: ${part.name || "Tool"}`,
          `Response\n\n${codeFence((part.content || []).map((p) => p.text ?? JSON.stringify(p)).join("\n"))}`,
        ),
      );
      continue;
    }
    if (part.type === "thinking") chunks.push(thinkingBlock(part));
    else if (part.type === "text") chunks.push(part.text || "");
    else if (part.type === "voice_note") {
      chunks.push(`Voice note${part.title ? `: ${part.title}` : ""}\n\n${part.text || ""}`);
    } else if (part.type === "token_budget") chunks.push("[token budget]");
    else chunks.push(codeFence(JSON.stringify(part, null, 2), "json"));
  }
  return chunks.map((part) => part.trim()).filter(Boolean).join("\n\n");
}

function messageMarkdown(message) {
  if (!message) return "";
  const role = message.sender === "human" ? "User" : message.sender === "assistant" ? "Claude" : null;
  if (!role) return "";
  const body = [];
  const contents = Array.isArray(message.content) && message.content.length
    ? renderContent(message.content)
    : (message.text || "");
  if (contents) body.push(contents);
  for (const attachment of message.attachments ?? []) {
    const meta = [
      attachment.file_name,
      attachment.file_type ? `(${attachment.file_type})` : "",
      attachment.file_size ? `${attachment.file_size} bytes` : "",
    ].filter(Boolean).join(" ");
    if (meta) body.push(`* Attachment: ${meta}`);
    if (attachment.extracted_content) body.push(attachment.extracted_content);
  }
  if (message.files?.length) body.push(`Files: ${message.files.map((f) => f.file_name || f).join(", ")}`);
  const text = body.join("\n\n").trim();
  return text ? `## ${role}\n\n${text}\n\n---\n\n` : "";
}

async function claudeToMarkdown(json, sourceDir, { dateFormat } = {}) {
  if (!Array.isArray(json)) throw new TypeError("The first argument must be an array.");
  if (typeof sourceDir !== "string") throw new TypeError("The second argument must be a string.");
  json.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const counts = {};
  for (const conversation of json) await processConversation(conversation, sourceDir, { counts, dateFormat });
}

export async function processConversation(conversation, sourceDir, { counts = {}, dateFormat } = {}) {
  const title = conversation.name || conversation.uuid || "Claude Conversation";
  const name = sanitizeFileName(title) || conversation.uuid || "Claude Conversation";
  const count = counts[name] ?? 0;
  counts[name] = count + 1;
  const filename = `${name}${count ? ` (${count})` : ""}.md`;
  const date = isoDate(conversation.updated_at ?? conversation.created_at);
  const formatted = dateFormat && date ? dateFormat(new Date(date)) : date;
  const source = conversation.uuid ? `https://claude.ai/chat/${conversation.uuid}` : "";
  const messages = (conversation.chat_messages ?? []).slice().sort((a, b) =>
    new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0)
  );
  const markdown = frontmatter(title, formatted, source) + messages.map(messageMarkdown).join("");
  const file = path.join(sourceDir, filename);
  await fs.writeFile(file, markdown, "utf8");
  if (conversation.updated_at && conversation.created_at) {
    await fs.utimes(file, new Date(conversation.updated_at), new Date(conversation.created_at));
  }
}

export default claudeToMarkdown;
