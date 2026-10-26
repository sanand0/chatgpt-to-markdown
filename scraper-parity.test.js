import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import chatgptToMarkdown from "./chatgpt-to-markdown.js";
import claudeToMarkdown from "./claude-to-markdown.js";

const chatNode = (id, role, content, extras = {}) => ({
  id,
  parent: extras.parent ?? null,
  message: {
    id,
    author: { role },
    content: typeof content === "string" ? { content_type: "text", parts: [content] } : content,
    ...(extras.create_time && { create_time: extras.create_time }),
    ...(extras.metadata && { metadata: extras.metadata }),
  },
});
const chat = (mapping, overrides = {}) => ({
  title: 'A "quoted" title',
  conversation_id: "conv-1",
  create_time: 1704067200,
  update_time: 1704153600,
  mapping,
  ...overrides,
});
const claude = (messages, overrides = {}) => ({
  uuid: "claude-1",
  name: 'Claude "test"',
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  chat_messages: messages,
  ...overrides,
});

let dir;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "parity-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
async function cg(value, options = {}) {
  await chatgptToMarkdown([value], dir, options);
  return fs.readFile(path.join(dir, "A quoted title.md"), "utf8");
}
async function cl(value) {
  await claudeToMarkdown([value], dir);
  return fs.readFile(path.join(dir, "Claude test.md"), "utf8");
}

describe("ChatGPT bookmarklet parity", () => {
  it("produces exact frontmatter, role headings, chronological turns and timestamps", async () => {
    const result = await cg(
      chat({
        u: chatNode("u", "user", "Hi", { create_time: 1704067200 }),
        a: chatNode("a", "assistant", "Hello", { parent: "u", create_time: 1704067260 }),
      }, { current_node: "a" }),
    );
    expect(result).toBe(
      '---\ntitle: "A \\"quoted\\" title"\ndate: 2024-01-02T00:00:00.000Z\nsource: "https://chatgpt.com/c/conv-1"\n---\n\n# User\n\n_2024-01-01T00:00:00.000Z_\n\nHi\n\n# ChatGPT\n\n_2024-01-01T00:01:00.000Z_\n\nHello\n',
    );
  });
  it("keeps multiple assistant replies separate, removes hidden branches and excludes system/context messages", async () => {
    const result = await cg(chat({
      sys: chatNode("sys", "system", "SYSTEM SECRET"),
      ctx: chatNode("ctx", "user", { content_type: "user_editable_context", user_profile: "PROFILE SECRET" }, {
        parent: "sys",
      }),
      u: chatNode("u", "user", "Question", { parent: "ctx" }),
      old: chatNode("old", "assistant", "Old answer", { parent: "u" }),
      a: chatNode("a", "assistant", "One", { parent: "u" }),
      b: chatNode("b", "assistant", "Two", { parent: "a" }),
    }, { current_node: "b" }));
    expect(result).toContain("# User\n\nQuestion\n\n# ChatGPT\n\nOne\n\n# ChatGPT\n\nTwo");
    for (const text of ["SYSTEM SECRET", "PROFILE SECRET", "Old answer", "# Assistant", "> Question"]) {
      expect(result).not.toContain(text);
    }
  });
  it("preserves Markdown tables, inline code, strong text and nested code fences", async () => {
    const result = await cg(
      chat({
        a: chatNode(
          "a",
          "assistant",
          '**Strong** and `inline`\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n````python\nprint("```")\n````',
        ),
      }),
    );
    expect(result).toContain("**Strong** and `inline`");
    expect(result).toContain("| A | B |");
    expect(result).toContain('````python\nprint("```")\n````');
  });
  it("renders archive assets and linked citations without raw markers", async () => {
    const result = await cg(
      chat({
        u: chatNode("u", "user", {
          content_type: "multimodal_text",
          parts: ["See this", {
            content_type: "image_asset_pointer",
            asset_pointer: "sediment://file-a",
            width: 640,
            height: 480,
          }],
        }, { metadata: { attachments: [{ id: "file-a", name: "pic.png" }, { id: "file-b", name: "readme.txt" }] } }),
        a: chatNode("a", "assistant", "Source citeturn0search1", {
          parent: "u",
          metadata: {
            content_references: [{
              items: [{ attribution: "Example", url: "https://example.com/?utm_source=chatgpt.com" }],
            }],
          },
        }),
      }, { current_node: "a" }),
      { assetFiles: { "file-a": "file-a.dat", "file-b": "file-b.dat" } },
    );
    expect(result).toContain("[pic.png](file-a.dat)");
    expect(result).toContain("[readme.txt](file-b.dat)");
    expect(result).toContain("[Example](https://example.com/)");
    expect(result).not.toContain("cite");
  });
  it("collapses reasoning and tool messages into assistant content, not standalone tool turns", async () => {
    const result = await cg(chat({
      a: chatNode("a", "assistant", {
        content_type: "thoughts",
        thoughts: [{ summary: "Planning", content: "Consider examples" }],
      }),
      t: chatNode("t", "tool", { content_type: "execution_output", text: "tool output" }, { parent: "a" }),
      b: chatNode("b", "assistant", "Final answer", { parent: "t" }),
    }, { current_node: "b" }));
    expect(result).toContain("<summary>Planning</summary>");
    expect(result).toContain("tool output");
    expect(result).toContain("Final answer");
    expect(result).not.toMatch(/^# Tool/m);
  });
  it("handles absent times and missing conversation ID without invalid dates or broken links", async () => {
    const result = await cg(
      chat({ a: chatNode("a", "assistant", "Answer") }, { conversation_id: undefined, update_time: null }),
    );
    expect(result).not.toContain("Invalid Date");
    expect(result).not.toContain("undefined");
  });
});

describe("Claude bookmarklet parity", () => {
  it("matches frontmatter, named roles and separators exactly", async () => {
    const result = await cl(
      claude([{ sender: "human", content: [{ type: "text", text: "Hi" }] }, {
        sender: "assistant",
        content: [{ type: "text", text: "Hello" }],
      }]),
    );
    expect(result).toBe(
      '---\ntitle: "Claude \\"test\\""\ndate: 2024-01-02T00:00:00.000Z\nsource: "https://claude.ai/chat/claude-1"\n---\n\n## User\n\nHi\n\n---\n\n## Claude\n\nHello\n\n---\n\n',
    );
  });
  it("collapses thinking and tool calls with request/response using bookmarklet HTML details", async () => {
    const result = await cl(claude([{
      sender: "assistant",
      content: [
        { type: "thinking", thinking: "Think privately", summaries: [{ summary: "Reasoning" }] },
        { type: "tool_use", name: "bash_tool", input: { command: "echo hello" } },
        { type: "tool_result", name: "bash_tool", content: [{ type: "text", text: "hello" }] },
        { type: "text", text: "Done." },
      ],
    }]));
    expect(result).toContain("<details>\n<summary>Reasoning</summary>");
    expect(result).toContain("> Think privately");
    expect(result).toContain("<summary>Called tool: bash_tool</summary>");
    expect(result).toContain("Request\n\n```");
    expect(result).toContain("Response\n\n```");
    expect(result).toContain("Done.");
    expect(result).not.toContain("```thinking");
  });
  it("retains attachments, files, voice notes and escaped Markdown code fences", async () => {
    const result = await cl(
      claude([{
        sender: "human",
        content: [{ type: "voice_note", title: "Dictation", text: "Spoken" }],
        attachments: [{ file_name: "a.txt", extracted_content: "Text" }],
        files: [{ file_name: "image.png" }],
      }]),
    );
    expect(result).toContain("Voice note: Dictation");
    expect(result).toContain("a.txt");
    expect(result).toContain("Text");
    expect(result).toContain("image.png");
  });
  it("sorts messages chronologically but does not add summary/metadata sections absent from scraper", async () => {
    const result = await cl(
      claude([{ sender: "assistant", created_at: "2024-01-01T00:02:00Z", text: "Second" }, {
        sender: "human",
        created_at: "2024-01-01T00:01:00Z",
        text: "First",
      }], { summary: "Hidden summary", account: { uuid: "hidden-account" } }),
    );
    expect(result.indexOf("First")).toBeLessThan(result.indexOf("Second"));
    expect(result).not.toContain("Hidden summary");
    expect(result).not.toContain("hidden-account");
  });
});
