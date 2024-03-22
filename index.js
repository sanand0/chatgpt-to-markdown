import { promises as fs } from "fs";
import path from "path";

/**
 * Sanitizes a file name by replacing invalid characters with spaces.
 * @param {string} title - The title to sanitize.
 * @returns {string} - The sanitized title.
 */
function sanitizeFileName(title) {
  return title
    .replace(/[<>:"\/\\|?*\n]/g, " ")
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
    .map((v) => `    ${v}\n`)
    .join("");
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
  if (!Array.isArray(json)) {
    throw new TypeError("The first argument must be an array.");
  }
  if (typeof sourceDir !== "string") {
    throw new TypeError("The second argument must be a string.");
  }

  for (const conversation of json) {
    const sanitizedTitle = sanitizeFileName(conversation.title);
    const fileName = `${sanitizedTitle}.md`;
    const filePath = path.join(sourceDir, fileName);
    const title = `# ${wrapHtmlTagsInBackticks(conversation.title)}\n`;
    const metadata = [
      `- Created: ${dateFormat(new Date(conversation.create_time * 1000))}\n`,
      `- Updated: ${dateFormat(new Date(conversation.update_time * 1000))}\n`,
    ].join("");
    const messages = Object.values(conversation.mapping)
      .map((node) => {
        let content = node.message?.content;
        if (!content) return "";
        // Format the body based on the content type
        let body =
          content.content_type == "text"
            ? content.parts.join("\n")
            : content.content_type == "code"
              ? "```" + content.language.replace("unknown", "") + "\n" + content.text + "\n```"
              : content.content_type == "execution_output"
                ? "```\n" + content.text + "\n```"
                : content.content_type == "multimodal_text"
                  ? content.parts
                      .map((part) =>
                        part.content_type === "image_asset_pointer"
                          ? `Image (${part.width}x${part.height}): ${part?.metadata?.dalle?.prompt}\n\n`
                          : `${part.content_type}\n\n`,
                      )
                      .join("")
                  : content.content_type == "tether_browsing_display"
                    ? "```\n" + content.result + "\n```"
                    : content.content_type == "tether_quote"
                      ? "```\n" + `${content.title} (${content.url})\n\n${content.text}` + "\n```"
                      : content.content_type == "system_error"
                        ? `${content.name}\n\n${content.text}\n\n`
                        : content;
        // Ignore empty content
        if (!body.trim()) return "";
        // Indent user / tool messages. The sometimes contain code and whitespaces are relevant
        const author = node.message.author;
        if (author.role == "user") body = indent(body);
        if (author.role == "tool" && !body.startsWith("```") && !body.endsWith("```")) body = indent(body);
        return `## ${author.role}${author.name ? ` (${author.name})` : ""}\n\n${body}\n\n`;
      })
      .join("");
    const markdownContent = `${title}\n${metadata}\n${messages}`;
    await fs.writeFile(filePath, markdownContent, "utf8");
    await fs.utimes(filePath, conversation.update_time, conversation.create_time);
  }
}

// Export the convertToMarkdown function as the default export
export default chatgptToMarkdown;
