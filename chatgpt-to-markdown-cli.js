#!/usr/bin/env node
import path from "path";
import { promises as fs } from "fs";
import chatgptToMarkdown from "./chatgpt-to-markdown.js";

async function run() {
  const filePath = process.argv[2] || "conversations.json";
  let json;
  try {
    const data = await fs.readFile(filePath, "utf8");
    json = JSON.parse(data);
  } catch {
    console.error(`Error: File '${filePath}' must be a JSON file`);
    console.error("Usage: node chatgpt-to-markdown-cli.js [conversations.json]");
    process.exit(1);
  }

  const sourceDir = path.dirname(filePath);
  await chatgptToMarkdown(json, sourceDir);
}

run();
