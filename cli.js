#!/usr/bin/env node
import path from "path";
import { promises as fs } from "fs";
import chatgptToMarkdown from "./index.js";

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Please provide a file path as a command line argument.");
    process.exit(1);
  }

  const data = await fs.readFile(filePath, "utf8");
  const json = JSON.parse(data);
  const sourceDir = path.dirname(filePath);
  await chatgptToMarkdown(json, sourceDir);
}

run();
