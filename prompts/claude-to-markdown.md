chatgpt-to-markdown.js and chatgpt-to-markdown-cli.js convert ChatGPT's exported conversations.json into Markdown.

The file claude/conversations.json has Claude's exported conversations in JSON format. Create a script claude-to-markdown.js that converts Claude's conversations into Markdown format similar to chatgpt-to-markdown.js.

Run it from the claude/ folder and test. It should generate .md files for each conversation.

Ensure that all parts of the conversations are captured. To do this, you should first (before coding) inspect the structure of claude/conversations.json (fields, field types, infer schema, search online as required) to make sure that all relevant information is captured, like chatgpt-to-markdown.js does for ChatGPT conversations.

Create a claude-to-markdown.test.js that automates the testing. Incorporate edge cases and all relevant, realistic scenarios minimally.

Run and test.

Update package.json and README.md.

---

The assistant makes tool calls (Tool use: ...) and gets tool results (Tool result: ...). These are often in JSON. Look at their structure. Provide hooks to format them neatly as Markdown, readably.

Prioritize in this order (of frequency of use):

- artifacts
- web_search
- bash_tool
- create_file
- str_replace
- web_fetch
- view
- repl
- any others
