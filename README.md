# ChatGPT to Markdown

[![npm version](https://badge.fury.io/js/chatgpt-to-markdown.svg)](https://badge.fury.io/js/chatgpt-to-markdown)
[![license](https://img.shields.io/npm/l/smartart.svg)](https://github.com/sanand0/smartart/blob/main/LICENSE)

Convert ChatGPT conversation JSON files to Markdown format with ease.

## Usage

Go to [chat.openai.com](https://chat.openai.com/) > Settings > Data controls > Export data and export your data.

Unzip the file you're mailed and run:

```bash
npx chatgpt-to-markdown path/to/your/conversations.json
```

**NO NEED TO INSTALL** - `npx` will automatically install the package if it's not already installed.

This will generate one Markdown file for each chat same directory as the conversations JSON file. The file name will be the chat title, with invalid filename characters replaced by spaces.
Duplicate titles get ` (1)`, ` (2)` suffixes to keep names unique.

For example, the Markdown output for a chat with the title `Medium-Style Table CSS` might look like this:

````markdown
# Medium-Style Table CSS

- Created: 26/9/2023, 10:10:54 am
- Updated: 26/9/2023, 10:11:19 am

## user

    Generate CSS for a Medium-style table

## assistant

Creating a Medium-style table requires a clean and minimalist design. Here's a simple CSS snippet to help you create a table that resembles the style seen on Medium. This code assumes that you have a basic HTML table structure in place.

```css
/* Resetting some table styles */
table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 20px;
}
...
```
````

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
  dateFormat: (d) => d.toLocaleString(),
};
chatgptToMarkdown(json, sourceDir);
```

### Options

- `dateFormat`: A function that takes a `Date` object and returns a string. Defaults to a string format like "1 Jan 2023 11:30 PM".

## Development

```bash
git clone https://github.com/sanand0/chatgpt-to-markdown.git
cd chatgpt-to-markdown

npm install
npm run lint && npm run build && npm test

npm publish
git commit . -m"$COMMIT_MSG"; git tag $VERSION; git push --follow-tags
```

## Release notes

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
