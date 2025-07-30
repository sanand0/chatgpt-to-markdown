#!/usr/bin/env node
import { promises as fs } from "fs";
import { analyzeAllConversations } from "./thinktime.js";

function printResults(results) {
  /**
   * Print analysis results in a readable format.
   */
  console.log("\n" + "=".repeat(60));
  console.log("THINKING TIME ANALYSIS RESULTS");
  console.log("=".repeat(60));

  const totalConvs = results.totalConversations;
  const thinkingConvs = results.conversationsWithThinking;

  console.log(`Total conversations: ${totalConvs.toLocaleString()}`);
  console.log(
    `Conversations with thinking: ${thinkingConvs.toLocaleString()} (${((thinkingConvs / totalConvs) * 100).toFixed(1)}%)`,
  );
  console.log(`Conversations without thinking: ${(totalConvs - thinkingConvs).toLocaleString()}`);

  if (thinkingConvs > 0) {
    console.log(`\nTHINKING TIME STATISTICS:`);
    console.log(
      `Total thinking time: ${results.totalThinkingTime.toFixed(1)} seconds (${(results.totalThinkingTime / 60).toFixed(1)} minutes)`,
    );
    console.log(`Total thinking blocks: ${results.totalThinkingBlocks.toLocaleString()}`);
    console.log(
      `Average thinking time per conversation: ${(results.totalThinkingTime / thinkingConvs).toFixed(1)} seconds`,
    );
    console.log(
      `Average thinking blocks per conversation: ${(results.totalThinkingBlocks / thinkingConvs).toFixed(1)}`,
    );

    console.log(`\nTHINKING TIME DISTRIBUTION:`);
    for (const [category, count] of Object.entries(results.thinkingDistribution)) {
      const percentage = ((count / thinkingConvs) * 100).toFixed(1);
      console.log(`  ${category}: ${count.toLocaleString()} conversations (${percentage}%)`);
    }

    console.log(`\nTOP 10 CONVERSATIONS BY THINKING TIME:`);
    const sortedConvs = results.conversationDetails.sort((a, b) => b.thinkingTimeSec - a.thinkingTimeSec).slice(0, 10);

    sortedConvs.forEach((conv, i) => {
      const title = conv.title.length > 50 ? conv.title.substring(0, 50) + "..." : conv.title;
      console.log(
        `  ${(i + 1).toString().padStart(2)}. ${conv.thinkingTimeSec.toFixed(1).padStart(6)}s (${conv.thinkingBlocks} blocks) - ${title}`,
      );
    });

    console.log(`\nTOP 10 INDIVIDUAL THINKING BLOCKS:`);
    const sortedBlocks = results.allThinkingBlocks.sort((a, b) => b.durationSec - a.durationSec).slice(0, 10);

    sortedBlocks.forEach((block, i) => {
      const title =
        block.conversationTitle.length > 30
          ? block.conversationTitle.substring(0, 30) + "..."
          : block.conversationTitle;
      const userMsg =
        block.precedingUserMessage.length > 80
          ? block.precedingUserMessage.substring(0, 80) + "..."
          : block.precedingUserMessage;
      console.log(`  ${(i + 1).toString().padStart(2)}. ${block.durationSec.toFixed(1).padStart(6)}s - ${title}`);
      console.log(`      User: ${userMsg}`);
      console.log();
    });
  }
}

async function main() {
  const filename = process.argv[2] || "conversations.json";

  try {
    const startTime = process.hrtime.bigint();
    const results = await analyzeAllConversations(filename);
    const endTime = process.hrtime.bigint();

    printResults(results);

    // Print execution time
    const executionTimeMs = Number(endTime - startTime) / 1000000;
    console.log(`\nExecution time: ${(executionTimeMs / 1000).toFixed(2)} seconds`);

    // Optionally save detailed results to JSON
    if (process.argv[3] === "--save-details") {
      const outputFile = "thinking_analysis_results_node.json";
      await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
      console.log(`\nDetailed results saved to ${outputFile}`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`Error: File '${filename}' not found`);
      console.error("Usage: node thinktime-cli.js [conversations.json] [--save-details]");
      process.exit(1);
    } else if (error instanceof SyntaxError) {
      console.error(`Error: Invalid JSON in file '${filename}': ${error.message}`);
      process.exit(1);
    } else {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }
}

main();
