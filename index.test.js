// index.test.js

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { default as chatgptToMarkdown, formatDate } from "./index";

describe("chatgptToMarkdown", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chatgptToMarkdown-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should write a markdown file for each conversation", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "user", name: "John" },
              content: { content_type: "text", parts: ["Hello"] },
            },
          },
        },
      },
    ];

    await chatgptToMarkdown(json, tempDir);

    const filePath = path.join(tempDir, "Test Conversation.md");
    const fileContent = await fs.readFile(filePath, "utf8");

    expect(fileContent).toBe(`# Test Conversation

- Created: ${formatDate(1630454400 * 1000)}
- Updated: ${formatDate(1630458000 * 1000)}

## user (John)

    Hello


`);
  });

  it("should handle titles with HTML tags", async () => {
    const json = [
      {
        title: "<h1>Test Conversation</h1>",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {},
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "h1 Test Conversation h1.md"), "utf8");
    expect(fileContent).toContain("# `<h1>`Test Conversation`</h1>`\n");
  });

  it("should sanitize titles with invalid filename characters", async () => {
    const json = [
      {
        title: ":/In\\<>*valid|?",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {},
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    // Check that the file exists with the sanitized title
    await expect(fs.access(path.join(tempDir, "In valid.md"))).resolves.not.toThrow();
  });

  it("should handle custom date format functions", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {},
      },
    ];
    const customDateFormat = (date) => date.toISOString();
    await chatgptToMarkdown(json, tempDir, { dateFormat: customDateFormat });
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("- Created: 2021-09-01T00:00:00.000Z\n");
  });

  it("should ignore messages with no content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              /* no content property */
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).not.toContain("## user (John)");
  });

  it("should ignore messages with empty content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: { message: { content: { content_type: "text", parts: [] } } },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).not.toContain("## user (John)");
  });

  it("should handle tether_browsing_display content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "tool", name: "browser" },
              content: { content_type: "tether_browsing_display", result: "L0: x" },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("```\nL0: x\n```");
  });

  it("should handle tether_quote content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "tool", name: "browser" },
              content: { content_type: "tether_quote", url: "x.com", domain: "x.com", title: "T", text: "X" },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("```\nT (x.com)\n\nX\n```");
  });

  it("should handle multimodal_text content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "tool", name: "dalle.text2im" },
              content: {
                content_type: "multimodal_text",
                parts: [
                  {
                    content_type: "image_asset_pointer",
                    width: 1024,
                    height: 1024,
                    metadata: { dalle: { prompt: "Photo" } },
                  },
                  { content_type: "image_asset_pointer", width: 1024, height: 1024 },
                  { content_type: "some_other_type" },
                ],
              },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("Image (1024x1024): Photo\n");
    expect(fileContent).toContain("some_other_type\n");
  });

  it("should indent messages with tool role that contain ``` fenced code blocks", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "tool" },
              content: { content_type: "code", language: "javascript", text: 'console.log("Hello, world!");' },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain('```javascript\nconsole.log("Hello, world!");\n```\n');
  });
});
