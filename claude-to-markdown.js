import { promises as fs } from "fs";
import path from "path";

/**
 * Replace characters that are illegal in filenames.
 */
function sanitizeFileName(title) {
  return title
    .replace(/[<>:"/\\|?*\n]/g, " ")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapHtmlTagsInBackticks(text) {
  return text.replace(/<[^>]+>/g, (match) => `\`${match}\``);
}

function indent(str) {
  return str
    .split("\n")
    .map((v) => (v.trim() ? `    ${v}\n` : ""))
    .join("");
}

function fence(code, lang = "") {
  return "```" + lang + "\n" + code + "\n```";
}

const safeJson = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

const formatJson = (val) => fence(typeof val === "string" ? val : JSON.stringify(val, null, 2), "json");

function normalizeToolName(name) {
  if (!name) return "";
  const lower = String(name).toLowerCase();
  if (lower === "search") return "web_search";
  return lower;
}

function formatToolUse(name, tool) {
  name = normalizeToolName(name);
  const { input, message } = tool;
  switch (name) {
    case "artifacts": {
      const { command, id, type, title, path: p, content } = input || {};
      const bits = [
        `**artifacts** (${command ?? "run"})`,
        id ? `- id: ${id}` : "",
        title ? `- title: ${title}` : "",
        type ? `- type: ${type}` : "",
        p ? `- path: ${p}` : "",
      ].filter(Boolean);
      if (content) bits.push(`Content:\n${fence(content, type?.includes("markdown") ? "markdown" : "")}`);
      return bits.join("\n");
    }
    case "web_search": {
      const q = input?.query || input?.q;
      const recency = input?.recency_days || input?.recency;
      const topK = input?.top_k;
      return [
        `**web_search**`,
        q ? `- query: ${q}` : "",
        recency ? `- recency_days: ${recency}` : "",
        topK ? `- top_k: ${topK}` : "",
        message || "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "bash_tool":
      return [`**bash_tool**`, message || "", input?.command ? fence(input.command, "bash") : ""].filter(Boolean).join(
        "\n\n",
      );
    case "create_file": {
      const { path: p, file_text } = input || {};
      return [`**create_file**`, p ? `- path: ${p}` : "", file_text ? fence(file_text, "markdown") : ""].filter(Boolean)
        .join("\n\n");
    }
    case "str_replace": {
      const { path: p, old_str, new_str } = input || {};
      return [
        "**str_replace**",
        p ? `- path: ${p}` : "",
        old_str ? `Old:\n${fence(old_str)}` : "",
        new_str ? `New:\n${fence(new_str)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "web_fetch":
      return [`**web_fetch**`, input?.url ? `- url: ${input.url}` : "", message || ""].filter(Boolean).join("\n");
    case "view": {
      const { path: p, description } = input || {};
      return [`**view**`, p ? `- path: ${p}` : "", description ? `- ${description}` : "", message || ""].filter(Boolean)
        .join("\n");
    }
    case "repl":
      return [`**repl**`, input?.code ? fence(input.code, "javascript") : ""].filter(Boolean).join("\n\n");
    default:
      return message || fence(JSON.stringify(tool, null, 2), "json");
  }
}

function formatToolResult(name, result) {
  name = normalizeToolName(name);
  const isErr = result.is_error;
  const header = `**${name} result${isErr ? " (error)" : ""}**`;

  const prettyContent = () => {
    const arr = Array.isArray(result.content) ? result.content : [];
    const texts = arr
      .map((c) => {
        if (c?.text) {
          const parsed = safeJson(c.text);
          return typeof parsed === "string" ? parsed : formatJson(parsed);
        }
        if (c?.type === "text" && c?.text) return c.text;
        return c && typeof c === "object" ? formatJson(c) : "";
      })
      .filter(Boolean);
    return texts.join("\n\n");
  };

  switch (name) {
    case "artifacts":
      return [header, result.message || "", prettyContent()].filter(Boolean).join("\n\n");
    case "web_search":
      return [header, prettyContent() || formatJson(result)].filter(Boolean).join("\n\n");
    case "bash_tool":
      return [header, result.message || "", prettyContent()].filter(Boolean).join("\n\n");
    case "create_file":
      return [header, result.message || "", prettyContent()].filter(Boolean).join("\n\n");
    case "str_replace":
      return [header, result.message || "", prettyContent()].filter(Boolean).join("\n\n");
    case "web_fetch":
      return [header, result.message || "", prettyContent()].filter(Boolean).join("\n\n");
    case "view":
      return [header, prettyContent()].filter(Boolean).join("\n\n");
    case "repl":
      return [header, prettyContent()].filter(Boolean).join("\n\n");
    default:
      return [header, result.message || "", prettyContent() || formatJson(result)].filter(Boolean).join("\n\n");
  }
}

function renderContent(content) {
  if (!content) return "";

  switch (content.type) {
    case "text":
      return content.text ?? "";
    case "thinking":
      return fence(content.thinking ?? "", "thinking");
    case "voice_note":
      return `Voice note${content.title ? `: ${content.title}` : ""}\n\n${content.text ?? ""}`;
    case "token_budget":
      return "[token budget]";
    case "tool_use":
      return formatToolUse(content.name, content);
    case "tool_result":
      return formatToolResult(content.name, content);
    default:
      return fence(JSON.stringify(content, null, 2), "json");
  }
}

function attachmentsToMarkdown(attachments = []) {
  return attachments
    .map((att) => {
      const metaParts = [];
      if (att.file_name) metaParts.push(att.file_name);
      if (att.file_type) metaParts.push(`(${att.file_type})`);
      if (att.file_size) metaParts.push(`${att.file_size} bytes`);
      const meta = metaParts.join(" ");
      const content = att.extracted_content ? `\n\n${att.extracted_content}` : "";
      return `${meta}${content}`;
    })
    .filter(Boolean);
}

function filesToMarkdown(files = []) {
  if (!files.length) return "";
  const names = files.map((f) => f.file_name || f).join(", ");
  return `Files: ${names}`;
}

function messageToMarkdown(message) {
  if (!message) return "";
  const parts = [];
  if (Array.isArray(message.content) && message.content.length) {
    parts.push(...message.content.map((c) => renderContent(c)).filter(Boolean));
  } else if (message.text) {
    parts.push(message.text);
  }
  parts.push(...attachmentsToMarkdown(message.attachments));
  const filesLine = filesToMarkdown(message.files);
  if (filesLine) parts.push(filesLine);

  const body = parts.join("\n\n").trim();
  if (!body) return "";

  const header = `## ${message.sender ?? "unknown"}\n\n`;
  const finalBody = message.sender === "human" ? indent(body) : body;
  return `${header}${finalBody}\n\n`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
export const formatDate = (date) => dateFormat.format(date);

async function claudeToMarkdown(json, sourceDir, { dateFormat } = { dateFormat: formatDate }) {
  if (!Array.isArray(json)) throw new TypeError("The first argument must be an array.");
  if (typeof sourceDir !== "string") throw new TypeError("The second argument must be a string.");

  json.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const counts = {};
  for (const conversation of json) {
    await processConversation(conversation, sourceDir, { dateFormat, counts });
  }
}

export async function processConversation(conversation, sourceDir, { dateFormat = formatDate, counts = {} } = {}) {
  const sanitizedTitle = sanitizeFileName(conversation.name ?? "") || conversation.uuid;
  const count = counts[sanitizedTitle] || 0;
  counts[sanitizedTitle] = count + 1;
  const fileName = `${sanitizedTitle}${count ? ` (${count})` : ""}.md`;
  const filePath = path.join(sourceDir, fileName);

  const title = `# ${wrapHtmlTagsInBackticks(conversation.name ?? conversation.uuid)}\n`;
  const lines = [
    `- Created: ${dateFormat(new Date(conversation.created_at))}\n`,
    `- Updated: ${dateFormat(new Date(conversation.updated_at))}\n`,
    `- Conversation ID: ${conversation.uuid}\n`,
  ];
  if (conversation.account?.uuid) lines.push(`- Account: ${conversation.account.uuid}\n`);
  const metadata = lines.join("");

  const summary = conversation.summary ? `\n## Summary\n\n${conversation.summary}\n\n` : "";
  const messages = (conversation.chat_messages ?? [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(messageToMarkdown)
    .join("");
  const markdownContent = `${title}\n${metadata}${summary}${messages}`;
  await fs.writeFile(filePath, markdownContent, "utf8");
  await fs.utimes(filePath, new Date(conversation.updated_at), new Date(conversation.created_at));
}

export default claudeToMarkdown;
