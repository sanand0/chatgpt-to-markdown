import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
let dir;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-md-cli-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

it("streams real-schema Claude JSON to bookmarklet-style Markdown", async () => {
  const value = [{
    uuid: "claude-cli-1",
    name: "CLI parity",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    chat_messages: [
      { sender: "human", content: [{ type: "text", text: "Question" }] },
      { sender: "assistant", content: [{ type: "text", text: "Answer" }] },
    ],
  }];
  const file = path.join(dir, "conversations.json");
  await fs.writeFile(file, JSON.stringify(value));
  await run(process.execPath, ["claude-to-markdown-cli.js", file], { cwd: import.meta.dirname });
  const content = await fs.readFile(path.join(dir, "CLI parity.md"), "utf8");
  expect(content).toBe(
    '---\ntitle: "CLI parity"\ndate: 2026-01-02T00:00:00.000Z\nsource: "https://claude.ai/chat/claude-cli-1"\n---\n\n## User\n\nQuestion\n\n---\n\n## Claude\n\nAnswer\n\n---\n\n',
  );
});
