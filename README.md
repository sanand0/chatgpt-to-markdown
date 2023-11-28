# ChatGPT to Markdown

Convert ChatGPT conversation JSON files to Markdown format with ease.

[![npm version](https://badge.fury.io/js/chatgpt-to-markdown.svg)](https://badge.fury.io/js/chatgpt-to-markdown)

## Usage

Go to [chat.openai.com](https://chat.openai.com/) > Settings > Data controls > Export data and export your data.

Unzip the file you're mailed and run:

```bash
npx chatgpt-to-markdown path/to/your/conversations.json
```

**NO NEED TO INSTALL** - `npx` will automatically install the package if it's not already installed.

This will generate one Markdown file for each chat same directory as the conversations JSON file. The file name will be the chat title, with invalid filename characters replaced by spaces.

## Example

Here's an example of the Markdown output for a chat with the title `Medium-Style Table CSS`:

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

## Options

- `dateFormat`: A function that takes a `Date` object and returns a string. Defaults to a string format like "1 Jan 2023 11:30 PM".

## Contributing

- Create a new branch for your feature or bugfix.
- Make your changes.

# Contributing

- Fork the repository on GitHub and clone the fork to your machine.
- Run `npm install` to install dependencies
- Edit [`index.js`](index.js) or [`cli.js`](cli.js), documenting your changes
- Push your changes back to your fork on GitHub and submit a pull request to the main repository.

# Release

```shell
npm version minor
npm publish
git push --follow-tags
```

## Release notes

- 1.5.0: 28 Nov 2023. Handle `tether_browsing_display`, `tether_quote` and `system_error`
- 1.4.0: 29 Oct 2023. Handle multi-modal text from Dall-E
- 1.3.0: 29 Sep 2023. Set create and update dates from chat
- 1.2.0: 28 Sep 2023. Added test cases
- 1.1.0: 26 Sep 2023. Add date format option
- 1.0.0: 26 Sep 2023. Initial release

## License

MIT

## Support

If you encounter any problems or have suggestions, please [open an issue](https://github.com/sanand0/chatgpt-to-markdown/issues) or submit a pull request.
