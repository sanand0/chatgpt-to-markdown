#!/usr/bin/env node
import { createReadStream } from "fs";
import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);
const StreamArray = require("stream-json/streamers/StreamArray");
import { formatDate, processConversation } from "./claude-to-markdown.js";

async function run() {
  const filePath = process.argv[2] || "conversations.json";
  const sourceDir = path.dirname(filePath);
  const counts = {};
  let processed = 0;

  try {
    const arr = StreamArray.withParser();
    await new Promise((resolve, reject) => {
      arr.on("data", ({ value }) => {
        arr.pause();
        processConversation(value, sourceDir, { counts, dateFormat: formatDate })
          .then(() => {
            processed += 1;
            if (processed % 100 === 0) process.stdout.write(".");
            arr.resume();
          })
          .catch(reject);
      });
      arr.on("end", () => resolve());
      arr.on("error", reject);
      createReadStream(filePath).on("error", reject).pipe(arr.input);
    });
  } catch (e) {
    console.error(e.stack);
    console.error("\nUsage: node claude-to-markdown-cli.js [conversations.json]");
    process.exit(1);
  }
}

run();
