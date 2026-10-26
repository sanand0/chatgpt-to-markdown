# ChatGPT to Markdown

Convert ChatGPT and Claude chat export JSON files to Markdown format with ease.

[![npm version](https://badge.fury.io/js/chatgpt-to-markdown.svg)](https://badge.fury.io/js/chatgpt-to-markdown)
[![license](https://img.shields.io/npm/l/smartart.svg)](https://github.com/sanand0/smartart/blob/main/LICENSE)

## ChatGPT exports

Go to [chat.openai.com](https://chat.openai.com/) > Settings > Data controls > Export data and export your data.

Unzip the file you're mailed and run:

```bash
npx chatgpt-to-markdown path/to/your/chatgpt-archive
```

**NO NEED TO INSTALL** - `npx` will automatically install the package if it's not already installed.

The command accepts either the exported archive directory or a specific `conversations.json` / `conversations-001.json`
file. Directory input reads the archive manifest and converts every conversation shard.

This generates one Markdown file for each chat in the archive directory. The file name is the chat title, with invalid filename characters replaced by spaces.
Duplicate titles get `(1)`, `(2)` suffixes to keep names unique.

The output format matches [`chatgptscraper.js`](https://github.com/sanand0/tools/tree/main/aiscrapers):
YAML frontmatter (`title`, `date`, `source`), `# User` / `# ChatGPT` headings,
plain Markdown message bodies (no blockquotes for user messages), and optional `_ISO timestamp_` per turn.
The transcript follows the active conversation branch. Exported image/file assets become archive links
when available, citation markers become source links, and available reasoning/tool activity becomes
collapsible `<details>` blocks within assistant turns. Internal system messages are omitted.

The export's **last updated** timestamp is used for `date`; the bookmarklet instead records the time
it was copied. Export timestamps use UTC (`Z`) rather than the browser's local timezone offset.
Metadata that is not visible in the bookmarklet, such as model flags, is not added to the transcript.
The actual content may differ when UI-only links or artifact previews are absent from the export.

For example:

````markdown
---
title: "Medium-Style Table CSS"
date: 2026-06-11T12:00:00.000Z
source: "https://chatgpt.com/c/example"
---

# User

Generate CSS for a Medium-style table.

# ChatGPT

Here's a minimalist table style:

```css
table {
  border-collapse: collapse;
  width: 100%;
}
```
````

### Claude exports

Go to [claude.ai](https://claude.ai/) > Settings > Privacy > Export data and export your data. Unzip the file you're mailed and run:

```bash
npx -p chatgpt-to-markdown claude-to-markdown path/to/your/conversations.json
```

This writes a Markdown file per conversation using the format of `claudescraper.js`: YAML frontmatter,
`## User` / `## Claude` sections, and `---` after every turn. Reasoning and paired tool requests/results
appear in collapsible details. Exported attachments, files, and voice notes are retained where available.
Export-only conversation summaries and account IDs are excluded to match the bookmarklet.

### Thinking Time Analysis

Analyze thinking time statistics from your ChatGPT conversations:

```bash
npx -p chatgpt-to-markdown thinktime path/to/your/conversations.json
```

This will analyze all conversations and show statistics about thinking/reasoning time, including:

- Total conversations with thinking
- Total thinking time and blocks
- Distribution of thinking times
- Top conversations by thinking time
- Top individual thinking blocks

Optional flag:

- `--save-details`: Save detailed results to `thinking_analysis_results_node.json`

## Installation

```bash
npm install chatgpt-to-markdown
```

## API

You can also use `chatgpt-to-markdown` programmatically in your JavaScript or TypeScript projects.

```javascript
import chatgptToMarkdown from "chatgpt-to-markdown";

const json = [
  // ... your ChatGPT conversation data
];

const sourceDir = "./output";
const options = {
  // Optional: override the default ISO 8601 UTC frontmatter date
  dateFormat: (d) => d.toISOString(),
  // Optional map from ChatGPT asset IDs to archive-relative file paths
  assetFiles: { "file-abc": "file-abc.dat" },
};
chatgptToMarkdown(json, sourceDir, options);
```

### Options

- `dateFormat`: Optional function converting the export's updated `Date` into a frontmatter date string. Defaults to ISO 8601 UTC (e.g., `2026-06-11T12:00:00.000Z`).
- `assetFiles`: An optional object mapping ChatGPT asset IDs to archive-relative file paths.

## Development

```bash
git clone https://github.com/sanand0/chatgpt-to-markdown.git
cd chatgpt-to-markdown

npm install
npm run lint
npm test
# Optional, uses local private exports; reads them without modifying them
node scripts/real-export-smoke.mjs ~/Documents/chatgpt ~/Documents/claude/conversations.json

npm publish
git commit . -m"$COMMIT_MSG"; git tag $VERSION; git push --follow-tags
```

## Release notes

- 1.14.0 (26 Oct 2026): Align both archive exporters with the ChatGPT/Claude bookmarklets' YAML
  frontmatter, speaker headings, message separators, and collapsible reasoning/tool blocks;
  test against varied synthetic cases and real export shards. This intentionally changes the default Markdown layout.
- [1.13.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.13.0): 11 Jun 2026. Read sharded ChatGPT archive directories; follow active branches; link attachments and citations; improve Markdown formatting
- [1.12.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.12.0): 22 Jan 2026. Claude Markdown metadata shows created, updated, and link - same as ChatGPT
- [1.11.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.11.0): 28 Nov 2025. Add Claude converter + CLI, richer tool formatting (artifacts, web_search, bash_tool, create_file, str_replace, web_fetch, view, repl)
- [1.10.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.10.0): 8 Oct 2025. Streams conversations.json to handle large files
- [1.9.1](https://npmjs.com/package/chatgpt-to-markdown/v/1.9.1): 2 Aug 2025. Sort conversations by create_time to ensure chronological ordering of filenames
- [1.9.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.9.0): 31 Jul 2025. Append numeric suffixes for duplicate chat titles
- [1.8.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.8.0): 30 Jul 2025. Standardized package.json & README.md
- [1.7.1](https://npmjs.com/package/chatgpt-to-markdown/v/1.7.1): 29 Jun 2025. Add thinktime analysis tool as npx executable. Analyze thinking/reasoning time statistics from ChatGPT conversations
- [1.6.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.6.0): 18 Jun 2025. Handle `thoughts`, `reasoning_recap`, `sonic_webpage`. Include projects
- [1.5.5](https://npmjs.com/package/chatgpt-to-markdown/v/1.5.5): 2 Nov 2024. Add conversation link. Use conversation ID as fallback title if title is empty
- [1.5.4](https://npmjs.com/package/chatgpt-to-markdown/v/1.5.4): 2 Nov 2024. Skip `user_editable_context` to avoid polluting Markdown with custom instructions
- [1.5.3](https://npmjs.com/package/chatgpt-to-markdown/v/1.5.3): 5 Aug 2024. Show text from multimodal prompts
- [1.5.2](https://npmjs.com/package/chatgpt-to-markdown/v/1.5.2): 5 Aug 2024. Show tether_browsing_display summary
- [1.5.1](https://npmjs.com/package/chatgpt-to-markdown/v/1.5.1): 22 Mar 2024. Handle unicode filenames
- [1.5.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.5.0): 28 Nov 2023. Handle `tether_browsing_display`, `tether_quote` and `system_error`
- [1.4.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.4.0): 29 Oct 2023. Handle multi-modal text from Dall-E
- [1.3.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.3.0): 29 Sept 2023. Set create and update dates from chat
- [1.2.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.2.0): 28 Sept 2023. Added test cases
- [1.1.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.1.0): 26 Sept 2023. Add date format option
- [1.0.0](https://npmjs.com/package/chatgpt-to-markdown/v/1.0.0): 26 Sept 2023. Initial release

## License

[MIT](LICENSE)
