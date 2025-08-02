import { promises as fs } from "fs";
import path from "path";

/**
 * Sanitizes a file name by replacing invalid characters with spaces.
 * @param {string} title - The title to sanitize.
 * @returns {string} - The sanitized title.
 */
function sanitizeFileName(title) {
  return title
    .replace(/[<>:"/\\|?*\n]/g, " ")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wraps HTML tags in backticks.
 * @param {string} text - The text to process.
 * @returns {string} - The text with HTML tags wrapped in backticks.
 */
function wrapHtmlTagsInBackticks(text) {
  return text.replace(/<[^>]+>/g, (match) => `\`${match}\``);
}

/**
 * Indents a string by 4 spaces.
 * @param {string} str - The string to indent.
 * @returns {string} - The indented string.
 * @example
 * indent("foo\nbar\nbaz");
 * //=> "    foo\n    bar\n    baz"
 */
function indent(str) {
  return str
    .split("\n")
    .map((v) => (v.trim() ? `    ${v}\n` : ""))
    .join("");
}

function blockquote(str) {
  return str
    .split("\n")
    .map((v) => (v ? `> ${v}` : ">"))
    .join("\n");
}

function nodeToMarkdown(node) {
  try {
    const content = node.message?.content;
    if (!content) return "";
    let body;
    switch (content.content_type) {
      case "text":
        body = content.parts.join("\n");
        break;
      case "code":
        body = "```" + content.language.replace("unknown", "") + "\n" + content.text + "\n```";
        break;
      case "execution_output":
        body = "```\n" + content.text + "\n```";
        break;
      case "multimodal_text":
        body = content.parts
          .map((part) =>
            typeof part == "string"
              ? `${part}\n\n`
              : part.content_type === "image_asset_pointer"
                ? `Image (${part.width}x${part.height}): ${part?.metadata?.dalle?.prompt ?? ""}\n\n`
                : `${part.content_type}\n\n`,
          )
          .join("");
        break;
      case "tether_browsing_display":
        body = "```\n" + (content.summary ? `${content.summary}\n` : "") + content.result + "\n```";
        break;
      case "tether_quote":
        body = blockquote(`${content.title} (${content.url})\n\n${content.text}`);
        break;
      case "system_error":
        body = `${content.name}\n\n${content.text}\n\n`;
        break;
      case "user_editable_context":
        body = "";
        break;
      case "thoughts":
        body = content.thoughts.map((t) => `##### ${t.summary}\n\n${t.content}\n`).join("\n");
        break;
      case "reasoning_recap":
        body = blockquote(content.content);
        break;
      case "sonic_webpage":
        body = "```\n" + `${content.title} (${content.url})\n\n${content.text}` + "\n```";
        break;
      default:
        body = String(content);
    }
    if (!body.trim()) return "";
    const author = node.message.author;
    if (author.role == "user") body = indent(body);
    if (author.role == "tool" && !body.startsWith("```") && !body.endsWith("```")) body = indent(body);
    return `## ${author.role}${author.name ? ` (${author.name})` : ""}\n\n${body}\n\n`;
  } catch (err) {
    err.message += `\nNode: ${JSON.stringify(node)}`;
    throw err;
  }
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

/**
 * Converts a JSON object to markdown and saves it to a file.
 * @param {Object[]} json - The JSON object to convert.
 * @param {string} sourceDir - The directory to save the markdown files in.
 * @param {Object} [options] - The options object.
 * @param {Function} [options.dateFormat] - The function to format dates with.
 * @returns {Promise<void>} - A promise that resolves when the file is saved.
 * @example
 * const json = [ ... ];
 * await convertToMarkdown(json, "./output");
 * //=> Creates a markdown file for each conversation in the output directory
 */
async function chatgptToMarkdown(json, sourceDir, { dateFormat } = { dateFormat: formatDate }) {
  if (!Array.isArray(json)) throw new TypeError("The first argument must be an array.");
  if (typeof sourceDir !== "string") throw new TypeError("The second argument must be a string.");

  const counts = {};
  for (const conversation of json) {
    const sanitizedTitle = sanitizeFileName(conversation.title) || conversation.conversation_id;
    const count = counts[sanitizedTitle] || 0;
    counts[sanitizedTitle] = count + 1;
    const fileName = `${sanitizedTitle}${count ? ` (${count})` : ""}.md`;
    const filePath = path.join(sourceDir, fileName);
    const title = `# ${wrapHtmlTagsInBackticks(conversation.title)}\n`;
    const lines = [
      `- Created: ${dateFormat(new Date(conversation.create_time * 1000))}\n`,
      `- Updated: ${dateFormat(new Date(conversation.update_time * 1000))}\n`,
      `- Link: https://chatgpt.com/c/${conversation.conversation_id}\n`,
    ];
    if (conversation.gizmo_id) lines.push(`- Project: https://chatgpt.com/g/${conversation.gizmo_id}/project\n`);
    const metadata = lines.join("");
    const messages = Object.values(conversation.mapping).map(nodeToMarkdown).join("");
    const markdownContent = `${title}\n${metadata}\n${messages}`;
    await fs.writeFile(filePath, markdownContent, "utf8");
    await fs.utimes(filePath, conversation.update_time, conversation.create_time);
  }
}

// Export the convertToMarkdown function as the default export
export default chatgptToMarkdown;
