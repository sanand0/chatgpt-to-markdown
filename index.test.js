// index.test.js

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import chatgptToMarkdown from "./chatgpt-to-markdown";

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
        conversation_id: "abc123",
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

    expect(fileContent).toBe(`---
title: "Test Conversation"
date: 2021-09-01T01:00:00.000Z
source: "https://chatgpt.com/c/abc123"
---

# User

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
    expect(fileContent).toContain('title: "<h1>Test Conversation</h1>"');
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
    expect(fileContent).toContain("date: 2021-09-01T01:00:00.000Z\n");
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
    expect(fileContent).toContain("> T (x.com)\n> \n> X");
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

  it("should skip user_editable_context content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "user" },
              content: {
                content_type: "user_editable_context",
                user_profile: "test profile",
                user_instructions: "test instructions",
              },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).not.toContain("test profile");
    expect(fileContent).not.toContain("test instructions");
  });

  it("should exclude internal system_error messages like the bookmarklet", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "system" },
              content: {
                content_type: "system_error",
                name: "Error Name",
                text: "Error details",
              },
            },
          },
        },
      },
    ];

    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).not.toContain("Error Name");
  });

  it("should handle execution_output content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "assistant" },
              content: {
                content_type: "execution_output",
                text: "Program output",
              },
            },
          },
        },
      },
    ];

    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("```\nProgram output\n```");
  });

  it("should handle code content with unknown language", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "assistant" },
              content: {
                content_type: "code",
                language: "unknown",
                text: "some code",
              },
            },
          },
        },
      },
    ];

    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("```\nsome code\n```");
  });

  it("should handle tether_browsing_display with summary", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "tool" },
              content: {
                content_type: "tether_browsing_display",
                summary: "Page Summary",
                result: "Search Result",
              },
            },
          },
        },
      },
    ];

    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("```\nPage Summary\nSearch Result\n```");
  });

  it("should throw TypeError for invalid arguments", async () => {
    await expect(chatgptToMarkdown("not an array", tempDir)).rejects.toThrow(TypeError);
    await expect(chatgptToMarkdown([], 123)).rejects.toThrow(TypeError);
  });

  it("should use conversation_id as filename when sanitized title is empty", async () => {
    const json = [
      {
        title: "?????", // Will be sanitized to empty string
        conversation_id: "abc123",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {},
      },
    ];

    await chatgptToMarkdown(json, tempDir);
    await expect(fs.access(path.join(tempDir, "abc123.md"))).resolves.not.toThrow();
  });

  it("should append numeric suffix for duplicate titles", async () => {
    const json = [
      // Note the create_time values are not in order
      { title: "Dup", conversation_id: "2", create_time: 1630454402, update_time: 1, mapping: {} },
      { title: "Dup", conversation_id: "3", create_time: 1630454403, update_time: 1, mapping: {} },
      { title: "Dup", conversation_id: "1", create_time: 1630454401, update_time: 1, mapping: {} },
    ];
    await chatgptToMarkdown(json, tempDir);
    await expect(fs.access(path.join(tempDir, "Dup.md"))).resolves.not.toThrow();
    await expect(fs.access(path.join(tempDir, "Dup (1).md"))).resolves.not.toThrow();
    await expect(fs.access(path.join(tempDir, "Dup (2).md"))).resolves.not.toThrow();

    const firstFileContent = await fs.readFile(path.join(tempDir, "Dup.md"), "utf8");
    expect(firstFileContent).toContain("https://chatgpt.com/c/1");

    const secondFileContent = await fs.readFile(path.join(tempDir, "Dup (1).md"), "utf8");
    expect(secondFileContent).toContain("https://chatgpt.com/c/2");

    const thirdFileContent = await fs.readFile(path.join(tempDir, "Dup (2).md"), "utf8");
    expect(thirdFileContent).toContain("https://chatgpt.com/c/3");
  });

  it("should ignore existing files when naming", async () => {
    await fs.writeFile(path.join(tempDir, "Dup.md"), "old");
    const json = [{ title: "Dup", conversation_id: "1", create_time: 1, update_time: 1, mapping: {} }];
    await chatgptToMarkdown(json, tempDir);
    await expect(fs.access(path.join(tempDir, "Dup (1).md"))).rejects.toThrow();
  });

  it("should handle thoughts content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "assistant" },
              content: { content_type: "thoughts", thoughts: [{ summary: "Sum", content: "Detail" }] },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("<summary>Sum</summary>");
    expect(fileContent).toContain("Detail");
  });

  it("should handle reasoning_recap content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: { author: { role: "assistant" }, content: { content_type: "reasoning_recap", content: "recap" } },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("*recap*");
  });

  it("should handle sonic_webpage content", async () => {
    const json = [
      {
        title: "Test Conversation",
        create_time: 1630454400,
        update_time: 1630458000,
        mapping: {
          0: {
            message: {
              author: { role: "tool", name: "web.search" },
              content: { content_type: "sonic_webpage", url: "https://a.com", title: "Title", text: "Body" },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).toContain("Title (https://a.com)");
    expect(fileContent).toContain("Body");
  });

  it("should not include metadata invisible to the bookmarklet", async () => {
    const json = [
      {
        title: "Test Conversation",
        conversation_id: "abc",
        create_time: 1630454400,
        update_time: 1630458000,
        gizmo_id: "g123",
        mapping: {},
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Test Conversation.md"), "utf8");
    expect(fileContent).not.toContain("- Project:");
  });

  it("should render only the current conversation branch", async () => {
    const json = [
      {
        title: "Branched",
        conversation_id: "abc",
        create_time: 1,
        update_time: 1,
        current_node: "current",
        mapping: {
          root: {
            id: "root",
            parent: null,
            message: { author: { role: "user" }, content: { content_type: "text", parts: ["Question"] } },
          },
          old: {
            id: "old",
            parent: "root",
            message: { author: { role: "assistant" }, content: { content_type: "text", parts: ["Old answer"] } },
          },
          current: {
            id: "current",
            parent: "root",
            message: { author: { role: "assistant" }, content: { content_type: "text", parts: ["Current answer"] } },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Branched.md"), "utf8");
    expect(fileContent).toContain("Current answer");
    expect(fileContent).not.toContain("Old answer");
  });

  it("should retain separate assistant replies like the bookmarklet", async () => {
    const json = [
      {
        title: "Grouped",
        conversation_id: "abc",
        create_time: 1,
        update_time: 1,
        mapping: {
          one: { message: { author: { role: "assistant" }, content: { content_type: "text", parts: ["One"] } } },
          two: { message: { author: { role: "assistant" }, content: { content_type: "text", parts: ["Two"] } } },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Grouped.md"), "utf8");
    expect(fileContent.match(/^# ChatGPT$/gm)).toHaveLength(2);
  });

  it("should render citations and attachments but omit bookmarklet-invisible model and flags", async () => {
    const json = [
      {
        title: "Rich export",
        conversation_id: "abc",
        create_time: 1,
        update_time: 1,
        default_model_slug: "gpt-test",
        is_starred: true,
        is_study_mode: true,
        mapping: {
          node: {
            message: {
              author: { role: "assistant" },
              content: { content_type: "text", parts: ["Claim citeturn0search1"] },
              metadata: {
                attachments: [{ id: "file-1", name: "report.pdf", mime_type: "application/pdf" }],
                content_references: [
                  {
                    items: [
                      {
                        attribution: "Example",
                        url: "https://example.com/a?utm_source=chatgpt.com",
                        refs: [{ turn_index: 0, ref_type: "search", ref_index: 1 }],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir, { assetFiles: { "file-1": "file-1.dat" } });
    const fileContent = await fs.readFile(path.join(tempDir, "Rich export.md"), "utf8");
    expect(fileContent).not.toContain("- Model: gpt-test");
    expect(fileContent).not.toContain("- Flags:");
    expect(fileContent).toContain("[Example](https://example.com/a)");
    expect(fileContent).toContain("[report.pdf](file-1.dat) (application/pdf)");
  });

  it("should remove unresolved ChatGPT citation markers", async () => {
    const json = [
      {
        title: "Citation",
        conversation_id: "abc",
        create_time: 1,
        update_time: 1,
        mapping: {
          node: {
            message: {
              author: { role: "assistant" },
              content: { content_type: "text", parts: ["Claim. citeturn0search1"] },
            },
          },
        },
      },
    ];
    await chatgptToMarkdown(json, tempDir);
    const fileContent = await fs.readFile(path.join(tempDir, "Citation.md"), "utf8");
    expect(fileContent).toContain("Claim.");
    expect(fileContent).not.toContain("cite");
  });
});
