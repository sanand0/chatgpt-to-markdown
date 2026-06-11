#!/usr/bin/env node
import { createReadStream, promises as fs } from "fs";
import { createRequire } from "module";
import path from "path";
import { formatDate, processConversation } from "./chatgpt-to-markdown.js";

const require = createRequire(import.meta.url);
const StreamArray = require("stream-json/streamers/StreamArray");

async function archiveInputs(inputPath) {
  const stat = await fs.stat(inputPath);
  if (!stat.isDirectory()) return { files: [inputPath], sourceDir: path.dirname(inputPath) };

  try {
    const manifest = JSON.parse(await fs.readFile(path.join(inputPath, "export_manifest.json"), "utf8"));
    const files = manifest.logical_files?.["conversations.json"]?.files;
    if (files?.length) return { files: files.map((file) => path.join(inputPath, file)), sourceDir: inputPath };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const files = (await fs.readdir(inputPath))
    .filter((file) => /^conversations(?:-\d+)?\.json$/.test(file))
    .sort()
    .map((file) => path.join(inputPath, file));
  if (!files.length) throw new Error(`No conversations JSON files found in '${inputPath}'`);
  return { files, sourceDir: inputPath };
}

async function readAssetFiles(sourceDir) {
  try {
    const names = JSON.parse(await fs.readFile(path.join(sourceDir, "conversation_asset_file_names.json"), "utf8"));
    return Object.fromEntries(Object.keys(names).map((file) => [file.replace(/\.dat$/, ""), file]));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function processFile(filePath, sourceDir, options) {
  const arr = StreamArray.withParser();
  createReadStream(filePath).pipe(arr.input);
  for await (const { value } of arr) {
    await processConversation(value, sourceDir, options);
    options.progress.processed += 1;
    if (options.progress.processed % 100 === 0) process.stdout.write(".");
  }
}

async function run() {
  const inputPath = process.argv[2] || "conversations.json";
  try {
    const { files, sourceDir } = await archiveInputs(inputPath);
    const options = {
      assetFiles: await readAssetFiles(sourceDir),
      counts: {},
      dateFormat: formatDate,
      progress: { processed: 0 },
    };
    for (const file of files) await processFile(file, sourceDir, options);
    console.log(`\nConverted ${options.progress.processed} conversations from ${files.length} file(s).`);
  } catch (error) {
    console.error(error.stack);
    console.error("\nUsage: chatgpt-to-markdown [archive-directory|conversations.json]");
    process.exitCode = 1;
  }
}

run();
