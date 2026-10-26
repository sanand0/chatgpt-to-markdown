#!/usr/bin/env node
/** Sample real ChatGPT archive shards and Claude exports without modifying the source archives.
 * Usage: node scripts/real-export-smoke.mjs /path/to/chatgpt/archive /path/to/claude/conversations.json
 */
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { processConversation as convertChat } from "../chatgpt-to-markdown.js";
import { processConversation as convertClaude } from "../claude-to-markdown.js";

const require = createRequire(import.meta.url);
const StreamArray = require("stream-json/streamers/StreamArray");
const [chatArchive, claudeFile] = process.argv.slice(2);
if (!chatArchive || !claudeFile) {
  console.error("Usage: node scripts/real-export-smoke.mjs CHATGPT_ARCHIVE_DIR CLAUDE_CONVERSATIONS_JSON");
  process.exit(2);
}

async function sample(file, limit, callback) {
  const parser = StreamArray.withParser();
  const stream = fs.createReadStream(file);
  stream.pipe(parser.input);
  let index = 0;
  try {
    for await (const { value } of parser) {
      await callback(value);
      if (++index >= limit) break;
    }
  } finally {
    stream.destroy();
    parser.destroy();
  }
  return index;
}

const counts = {
  chatgpt: 0,
  claude: 0,
  markdown: 0,
  withTurns: 0,
  withTools: 0,
  withReasoning: 0,
  withCitations: 0,
  withFiles: 0,
  withTables: 0,
  withCode: 0,
  errors: [],
};
const dest = await fsp.mkdtemp(path.join(os.tmpdir(), "archive-md-smoke-"));
const chatOut = path.join(dest, "chatgpt");
const claudeOut = path.join(dest, "claude");
await Promise.all([fsp.mkdir(chatOut), fsp.mkdir(claudeOut)]);
const chatCounts = {}, claudeCounts = {};

async function check(file, type) {
  const md = await fsp.readFile(file, "utf8");
  if (!md.startsWith('---\ntitle: "') || !md.includes('\nsource: "') || !md.includes("\n---\n\n")) {
    throw new Error(`Invalid frontmatter: ${file}`);
  }
  if (/^date: Invalid Date$|^source: "undefined"$/m.test(md) || md.includes("cite")) {
    throw new Error(`Unrendered metadata or citations: ${file}`);
  }
  if (type === "chatgpt" && /^(?:## (?:User|Assistant)|# (?:Assistant|Tool))$/m.test(md)) {
    throw new Error(`Wrong ChatGPT roles: ${file}`);
  }
  if (type === "claude" && /^## (?:human|assistant)$/m.test(md)) throw new Error(`Wrong Claude roles: ${file}`);
  if (/^#{1,2} (?:User|ChatGPT|Claude)$/m.test(md)) counts.withTurns++;
  if (md.includes("<summary>Called tool:")) counts.withTools++;
  if (md.includes("<summary>") && !md.includes("Called tool:")) counts.withReasoning++;
  if (/\]\(https?:\/\//.test(md)) counts.withCitations++;
  if (md.includes("Attachment:") || md.includes("Files:")) counts.withFiles++;
  if (/\| ---/.test(md)) counts.withTables++;
  if (/```[a-z]*\n/.test(md)) counts.withCode++;
  counts.markdown++;
}

try {
  const shardFiles = (await fsp.readdir(chatArchive)).filter((name) => /^conversations(?:-\d+)?\.json$/.test(name))
    .sort();
  if (!shardFiles.length) throw new Error("No ChatGPT archive shards found");
  for (const file of shardFiles) {
    const count = await sample(path.join(chatArchive, file), 4, async (conversation) => {
      await convertChat(conversation, chatOut, { counts: chatCounts });
      // Find the output by mtime isn't reliable: filenames are deterministic but title normalization is lossy.
      counts.chatgpt++;
    });
    process.stderr.write(`ChatGPT ${file}: ${count} conversations\n`);
  }
  for (const filename of await fsp.readdir(chatOut)) await check(path.join(chatOut, filename), "chatgpt");
  counts.claude = await sample(claudeFile, 60, async (conversation) => {
    await convertClaude(conversation, claudeOut, { counts: claudeCounts });
  });
  for (const filename of await fsp.readdir(claudeOut)) await check(path.join(claudeOut, filename), "claude");
  if (counts.markdown !== counts.chatgpt + counts.claude) {
    throw new Error(`Expected ${counts.chatgpt + counts.claude} Markdown files but found ${counts.markdown}`);
  }
  console.log(JSON.stringify({ sampledShards: shardFiles.length, ...counts }, null, 2));
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await fsp.rm(dest, { recursive: true, force: true });
}
