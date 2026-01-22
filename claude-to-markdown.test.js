import { promises as fs } from "fs";
import os from "os";
import path from "path";
import claudeToMarkdown, { formatDate } from "./claude-to-markdown.js";

describe("claudeToMarkdown", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "claudeToMarkdown-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writes summary, metadata, attachments, and files", async () => {
    const json = [
      {
        uuid: "conv-1",
        name: "Alpha Chat",
        summary: "Short summary",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
        account: { uuid: "acct-1" },
        chat_messages: [
          {
            sender: "human",
            text: "Hi there",
            attachments: [{
              file_name: "doc.txt",
              file_type: "text/plain",
              file_size: 10,
              extracted_content: "file body",
            }],
            files: [{ file_name: "image.png" }],
          },
          { sender: "assistant", content: [{ type: "text", text: "Hello!" }] },
        ],
      },
    ];

    await claudeToMarkdown(json, tempDir);
    const content = await fs.readFile(path.join(tempDir, "Alpha Chat.md"), "utf8");

    expect(content).toContain("# Alpha Chat");
    expect(content).toContain("- Created: " + formatDate(new Date("2025-01-01T00:00:00Z")));
    expect(content).toContain("- Updated: " + formatDate(new Date("2025-01-02T00:00:00Z")));
    expect(content).toContain("- Link: https://claude.ai/chat/conv-1");
    expect(content).toContain("- Account: acct-1");
    expect(content).toContain("## Summary");
    expect(content).toContain("Short summary");
    expect(content).toContain("doc.txt (text/plain) 10 bytes");
    expect(content).toContain("file body");
    expect(content).toContain("Files: image.png");
  });

  it("renders tools, thinking, voice notes, token budget, and tool results", async () => {
    const json = [
      {
        uuid: "conv-2",
        name: "Tooling",
        created_at: "2025-02-01T00:00:00Z",
        updated_at: "2025-02-01T01:00:00Z",
        chat_messages: [
          {
            sender: "assistant",
            content: [
              { type: "thinking", thinking: "deep thought" },
              {
                type: "tool_use",
                name: "search",
                message: "doing it",
                input: { q: "hi" },
                display_content: { type: "code_block", language: "bash", code: "echo hi" },
              },
            ],
          },
          {
            sender: "assistant",
            content: [{
              type: "tool_result",
              name: "search",
              is_error: false,
              content: [{ type: "text", text: "done" }],
            }],
          },
          { sender: "assistant", content: [{ type: "token_budget" }] },
          { sender: "assistant", content: [{ type: "voice_note", title: "Note", text: "Audio text" }] },
        ],
      },
    ];

    await claudeToMarkdown(json, tempDir);
    const content = await fs.readFile(path.join(tempDir, "Tooling.md"), "utf8");

    expect(content).toContain("```thinking");
    expect(content).toContain("deep thought");
    expect(content).toContain("**web_search**");
    expect(content).toContain("query: hi");
    expect(content).toContain("**web_search result**");
    expect(content).toContain("done");
    expect(content).toContain("[token budget]");
    expect(content).toContain("Voice note: Note");
    expect(content).toContain("Audio text");
  });

  it("handles duplicate and unsanitary titles with stable filenames", async () => {
    const json = [
      {
        uuid: "u1",
        name: "Dup",
        created_at: "2025-03-01T00:00:00Z",
        updated_at: "2025-03-01T00:00:00Z",
        chat_messages: [],
      },
      {
        uuid: "u2",
        name: "Dup",
        created_at: "2025-03-02T00:00:00Z",
        updated_at: "2025-03-02T00:00:00Z",
        chat_messages: [],
      },
      {
        uuid: "u3",
        name: "???",
        created_at: "2025-03-03T00:00:00Z",
        updated_at: "2025-03-03T00:00:00Z",
        chat_messages: [],
      },
    ];

    await claudeToMarkdown(json, tempDir);
    await expect(fs.access(path.join(tempDir, "Dup.md"))).resolves.not.toThrow();
    await expect(fs.access(path.join(tempDir, "Dup (1).md"))).resolves.not.toThrow();
    await expect(fs.access(path.join(tempDir, "u3.md"))).resolves.not.toThrow();
  });
});
