#!/usr/bin/env node
/**
 * Thinking Time Analysis for ChatGPT Conversations (Node.js version)
 *
 * This program analyzes a conversations.json file to calculate thinking time for each conversation.
 *
 * APPROACH:
 * 1. The JSON contains conversations with a "mapping" field containing message nodes
 * 2. Thinking is identified by metadata field "reasoning_status" with values:
 *    - "is_reasoning": indicates the model is currently thinking/reasoning
 *    - "reasoning_ended": indicates thinking has completed
 * 3. Time measurement uses "finished_duration_sec" field in metadata, which represents
 *    actual generation time (not wall time including user wait time)
 * 4. Each conversation is analyzed to find thinking blocks and sum their durations
 *
 * KEY FINDINGS FROM DATA ANALYSIS:
 * - reasoning_status="is_reasoning" marks start of thinking
 * - reasoning_status="reasoning_ended" marks end with "finished_duration_sec"
 * - finished_duration_sec contains the actual model generation time in seconds
 * - Not all conversations have thinking - many are regular chat without reasoning
 */

import { promises as fs } from "fs";

function findPrecedingUserMessage(mapping, targetNodeId) {
  /**
   * Find the user message that precedes a thinking block.
   */
  const targetNode = mapping[targetNodeId] || {};
  const parentId = targetNode.parent;

  // Traverse up the conversation tree to find the last user message
  const visited = new Set();
  let currentId = parentId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const currentNode = mapping[currentId] || {};
    const message = currentNode.message || {};

    if (message) {
      const author = message.author || {};
      if (author.role === "user") {
        // Found user message, extract content
        const content = message.content || {};
        const parts = content.parts || [];
        if (parts.length > 0 && typeof parts[0] === "string") {
          const text = parts[0].replace(/\s+/g, " ").trim();
          return text.length > 200 ? text.substring(0, 200) + "..." : text;
        }
      }
    }

    // Move to parent
    currentId = currentNode.parent;
  }

  return "No preceding user message found";
}

function analyzeConversationThinking(conversation) {
  /**
   * Analyze a single conversation for thinking time.
   *
   * Returns:
   * - totalThinkingTime: Total seconds spent thinking
   * - thinkingBlocks: Number of separate thinking sessions
   * - thinkingDetails: Array of thinking block details with preceding user messages
   */
  const mapping = conversation.mapping || {};
  let totalThinkingTime = 0.0;
  let thinkingBlocks = 0;
  const thinkingDetails = [];

  for (const [nodeId, node] of Object.entries(mapping)) {
    const message = node.message || {};
    if (!message) continue;

    const metadata = message.metadata || {};
    const reasoningStatus = metadata.reasoning_status;

    if (reasoningStatus === "reasoning_ended") {
      // This node marks the end of a thinking block
      const duration = metadata.finished_duration_sec || 0;
      if (duration && duration > 0) {
        totalThinkingTime += duration;
        thinkingBlocks++;

        // Find the user message that preceded this thinking block
        const precedingMessage = findPrecedingUserMessage(mapping, nodeId);

        thinkingDetails.push({
          nodeId: nodeId,
          durationSec: duration,
          createTime: message.create_time,
          precedingUserMessage: precedingMessage,
          conversationId: conversation.conversation_id || "unknown",
          conversationTitle: conversation.title || "Untitled",
        });
      }
    }
  }

  return { totalThinkingTime, thinkingBlocks, thinkingDetails };
}

async function analyzeAllConversations(filename) {
  /**
   * Analyze all conversations in the JSON file.
   *
   * Returns object with analysis results.
   */
  console.log(`Loading ${filename}...`);
  const data = JSON.parse(await fs.readFile(filename, "utf8"));

  console.log(`Found ${data.length} conversations`);

  const results = {
    totalConversations: data.length,
    conversationsWithThinking: 0,
    totalThinkingTime: 0.0,
    totalThinkingBlocks: 0,
    conversationDetails: [],
    thinkingDistribution: {
      "0-5 seconds": 0,
      "5-15 seconds": 0,
      "15-30 seconds": 0,
      "30-60 seconds": 0,
      "60+ seconds": 0,
    },
    allThinkingBlocks: [], // New: collect all individual thinking blocks
  };

  for (let i = 0; i < data.length; i++) {
    if (i % 500 === 0) {
      console.log(`Processing conversation ${i}...`);
    }

    const conversation = data[i];
    const convId = conversation.conversation_id || `unknown_${i}`;
    const title = conversation.title || "Untitled";

    const { totalThinkingTime, thinkingBlocks, thinkingDetails } = analyzeConversationThinking(conversation);

    if (totalThinkingTime > 0) {
      results.conversationsWithThinking++;
      results.totalThinkingTime += totalThinkingTime;
      results.totalThinkingBlocks += thinkingBlocks;

      // Add all individual thinking blocks to global list
      results.allThinkingBlocks.push(...thinkingDetails);

      // Categorize thinking time for distribution analysis
      if (totalThinkingTime < 5) {
        results.thinkingDistribution["0-5 seconds"]++;
      } else if (totalThinkingTime < 15) {
        results.thinkingDistribution["5-15 seconds"]++;
      } else if (totalThinkingTime < 30) {
        results.thinkingDistribution["15-30 seconds"]++;
      } else if (totalThinkingTime < 60) {
        results.thinkingDistribution["30-60 seconds"]++;
      } else {
        results.thinkingDistribution["60+ seconds"]++;
      }

      results.conversationDetails.push({
        conversationId: convId,
        title: title,
        thinkingTimeSec: totalThinkingTime,
        thinkingBlocks: thinkingBlocks,
        thinkingDetails: thinkingDetails,
      });
    }
  }

  return results;
}

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
      console.error("Usage: node thinking_time.js [conversations.json] [--save-details]");
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
