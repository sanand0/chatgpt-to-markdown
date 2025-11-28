#!/usr/bin/env node
import { createReadStream } from "fs";
import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);
const StreamArray = require("stream-json/streamers/StreamArray");
import { formatDate, processConversation } from "./chatgpt-to-markdown.js";

async function run() {
  const filePath = process.argv[2] || "conversations.json";
  const sourceDir = path.dirname(filePath);
  const counts = {};

  let processed = 0;
  try {
    const arr = StreamArray.withParser();

    await new Promise((resolve, reject) => {
      arr.on("data", async ({ value }) => {
        arr.pause();
        try {
          await processConversation(value, sourceDir, { counts, dateFormat: formatDate });
          processed += 1;
          if (processed % 100 === 0) process.stdout.write(".");
          processed += 1;
          arr.resume();
        } catch (err) {
          reject(err);
        }
      });
      arr.on("end", () => resolve());
      arr.on("error", reject);
      createReadStream(filePath).on("error", reject).pipe(arr.input);
    });
  } catch (e) {
    console.error(e.stack);
    console.error("\nUsage: node chatgpt-to-markdown-cli.js [conversations.json]");
    process.exit(1);
  }
}

run();
