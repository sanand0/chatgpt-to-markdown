import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

describe("chatgpt-to-markdown CLI", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chatgpt-to-markdown-cli-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("converts all conversation shards in an archive directory", async () => {
    const conversation = (title, id) => ({
      title,
      conversation_id: id,
      create_time: 1,
      update_time: 1,
      mapping: {},
    });
    await fs.writeFile(
      path.join(tempDir, "export_manifest.json"),
      JSON.stringify({
        logical_files: { "conversations.json": { files: ["conversations-000.json", "conversations-001.json"] } },
      }),
    );
    await fs.writeFile(path.join(tempDir, "conversations-000.json"), JSON.stringify([conversation("One", "1")]));
    await fs.writeFile(path.join(tempDir, "conversations-001.json"), JSON.stringify([conversation("Two", "2")]));

    const { stdout } = await execFileAsync(process.execPath, ["chatgpt-to-markdown-cli.js", tempDir], {
      cwd: import.meta.dirname,
    });

    expect(stdout).toContain("Converted 2 conversations from 2 file(s).");
    await expect(fs.access(path.join(tempDir, "One.md"))).resolves.not.toThrow();
    const markdown = await fs.readFile(path.join(tempDir, "One.md"), "utf8");
    expect(markdown).toContain("date: 1970-01-01T00:00:01.000Z");
    expect(markdown).toContain('source: "https://chatgpt.com/c/1"');
    await expect(fs.access(path.join(tempDir, "Two.md"))).resolves.not.toThrow();
  });

  it("waits for every streamed conversation to be written", async () => {
    const conversations = Array.from({ length: 120 }, (_, index) => ({
      title: `Conversation ${index}`,
      conversation_id: String(index),
      create_time: index + 1,
      update_time: index + 1,
      mapping: {},
    }));
    const filePath = path.join(tempDir, "conversations.json");
    await fs.writeFile(filePath, JSON.stringify(conversations));

    const { stdout } = await execFileAsync(process.execPath, ["chatgpt-to-markdown-cli.js", filePath], {
      cwd: import.meta.dirname,
    });

    expect(stdout).toContain("Converted 120 conversations from 1 file(s).");
    await expect(fs.access(path.join(tempDir, "Conversation 119.md"))).resolves.not.toThrow();
  });
});
