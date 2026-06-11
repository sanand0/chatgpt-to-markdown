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
  const citedReferences = references.filter(({ items }) => items?.some(({ url }) => url));
  let referenceIndex = 0;
  return text.replace(/cite([^]+)/g, () => {
    const links = (citedReferences[referenceIndex++]?.items ?? [])
      .filter(({ url }) => url)
      .map((source) => `[${source.attribution ?? source.title ?? "source"}](${cleanUrl(source.url)})`);
    return links.length ? [...new Set(links)].join(", ") : "";
  });
}

function assetMarkdown(part, attachments, assetFiles) {
  const assetId = part.asset_pointer?.replace(/^.*:\/\//, "");
  const attachment = attachments.find(({ id }) => id === assetId);
  const label = attachment?.name ?? assetId ?? "Image";
  const archiveFile = assetFiles?.[assetId];
  const dimensions = part.width && part.height ? ` (${part.width}x${part.height})` : "";
  const prompt = part?.metadata?.dalle?.prompt;
  if (archiveFile) return `[${label}](${encodeURI(archiveFile)})${dimensions}${prompt ? `: ${prompt}` : ""}`;
  return `Image${dimensions}${prompt ? `: ${prompt}` : ""}`;
}

function attachmentsMarkdown(attachments, renderedAssetIds, assetFiles) {
  const links = attachments
    .filter(({ id }) => !renderedAssetIds.has(id) && assetFiles?.[id])
    .map(({ id, name, mime_type }) =>
      `- [${name ?? id}](${encodeURI(assetFiles[id])})${mime_type ? ` (${mime_type})` : ""}`
    );
  return links.length ? `**Attachments**\n\n${links.join("\n")}` : "";
}

function nodeToMarkdown(node, { assetFiles, showHeader = true } = {}) {
  try {
    const message = node.message;
    const content = message?.content;
    if (!content) return "";
    const attachments = message.metadata?.attachments ?? [];
    const renderedAssetIds = new Set();
    let body;
    switch (content.content_type) {
      case "text":
        body = renderCitations(content.parts.join("\n"), message.metadata?.content_references);
        break;
      case "code":
        body = "```" + content.language.replace("unknown", "") + "\n" + content.text + "\n```";
        break;
      case "execution_output":
        body = "```\n" + content.text + "\n```";
        break;
      case "multimodal_text":
        body = content.parts
          .map((part) => {
            if (typeof part == "string") return `${renderCitations(part, message.metadata?.content_references)}\n\n`;
            if (part.content_type === "image_asset_pointer") {
              renderedAssetIds.add(part.asset_pointer?.replace(/^.*:\/\//, ""));
              return `${assetMarkdown(part, attachments, assetFiles)}\n\n`;
            }
            return `${part.content_type}\n\n`;
          })
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
        body = content.thoughts
          .map((thought) =>
            `<details>\n<summary>${thought.summary || "Reasoning"}</summary>\n\n${thought.content}\n\n</details>`
          )
          .join("\n\n");
        break;
      case "reasoning_recap":
        body = `*${content.content}*`;
        break;
      case "sonic_webpage":
        body = "```\n" + `${content.title} (${content.url})\n\n${content.text}` + "\n```";
        break;
      default:
        body = `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;
    }
    const attachmentBody = attachmentsMarkdown(attachments, renderedAssetIds, assetFiles);
    if (attachmentBody) body = `${body}\n\n${attachmentBody}`;
    if (!body.trim()) return "";
    const author = message.author;
    if (author.role == "user") body = blockquote(body);
    if (author.role == "tool" && !body.startsWith("```") && !body.endsWith("```")) body = indent(body);
    const role = author.role.charAt(0).toUpperCase() + author.role.slice(1);
    const header = showHeader ? `## ${role}${author.name ? ` (${author.name})` : ""}\n\n` : "";
    return `${header}${body}\n\n`;
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
async function chatgptToMarkdown(json, sourceDir, { dateFormat = formatDate, assetFiles } = {}) {
  if (!Array.isArray(json)) throw new TypeError("The first argument must be an array.");
  if (typeof sourceDir !== "string") throw new TypeError("The second argument must be a string.");

  // Keep behavior stable for tests: sort then process sequentially
  json.sort((a, b) => a.create_time - b.create_time);

  const counts = {};
  for (const conversation of json) {
    await processConversation(conversation, sourceDir, { assetFiles, dateFormat, counts });
  }
}

function currentBranch(conversation) {
  if (!conversation.current_node || !conversation.mapping?.[conversation.current_node]) {
    return Object.values(conversation.mapping ?? {});
  }
  const nodes = [];
  const visited = new Set();
  let node = conversation.mapping[conversation.current_node];
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    nodes.unshift(node);
    node = conversation.mapping[node.parent];
  }
  return nodes;
}

/**
 * Writes one conversation to Markdown in `sourceDir`.
 * Maintains stable filenames using `counts` across calls.
 */
export async function processConversation(
  conversation,
  sourceDir,
  { dateFormat = formatDate, counts = {}, assetFiles } = {},
) {
  const conversationTitle = conversation.title || conversation.conversation_id || "Untitled conversation";
  const sanitizedTitle = sanitizeFileName(conversationTitle) || conversation.conversation_id;
  const count = counts[sanitizedTitle] || 0;
  counts[sanitizedTitle] = count + 1;
  const fileName = `${sanitizedTitle}${count ? ` (${count})` : ""}.md`;
  const filePath = path.join(sourceDir, fileName);
  const title = `# ${wrapHtmlTagsInBackticks(conversationTitle)}\n`;
  const lines = [
    `- Created: ${dateFormat(new Date(conversation.create_time * 1000))}\n`,
    `- Updated: ${dateFormat(new Date(conversation.update_time * 1000))}\n`,
    `- Link: https://chatgpt.com/c/${conversation.conversation_id}\n`,
  ];
  if (conversation.gizmo_id) lines.push(`- Project: https://chatgpt.com/g/${conversation.gizmo_id}/project\n`);
  if (conversation.default_model_slug) lines.push(`- Model: ${conversation.default_model_slug}\n`);
  const flags = [
    ["Starred", conversation.is_starred],
    ["Archived", conversation.is_archived],
    ["Study mode", conversation.is_study_mode],
    ["Do not remember", conversation.is_do_not_remember],
  ]
    .filter(([, enabled]) => enabled)
    .map(([label]) => label);
  if (flags.length) lines.push(`- Flags: ${flags.join(", ")}\n`);
  const metadata = lines.join("");
  let previousAuthor;
  const messages = currentBranch(conversation)
    .map((node) => {
      const author = `${node.message?.author?.role}:${node.message?.author?.name ?? ""}`;
      const markdown = nodeToMarkdown(node, { assetFiles, showHeader: author !== previousAuthor });
      if (markdown) previousAuthor = author;
      return markdown;
    })
    .join("");
  const markdownContent = `${title}\n${metadata}\n${messages}`;
  await fs.writeFile(filePath, markdownContent, "utf8");
  await fs.utimes(filePath, conversation.update_time, conversation.create_time);
}

// Export the convertToMarkdown function as the default export
export default chatgptToMarkdown;
