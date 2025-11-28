import { promises as fs } from "fs";
import os from "os";
import path from "path";

async function analyzeAllConversations(filename) {
  const data = JSON.parse(await fs.readFile(filename, "utf8"));

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
    allThinkingBlocks: [],
  };

  for (let i = 0; i < data.length; i++) {
    const conversation = data[i];
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
        const duration = metadata.finished_duration_sec || 0;
        if (duration && duration > 0) {
          totalThinkingTime += duration;
          thinkingBlocks++;

          thinkingDetails.push({
            nodeId: nodeId,
            durationSec: duration,
            createTime: message.create_time,
            precedingUserMessage: "Test message",
            conversationId: conversation.conversation_id || "unknown",
            conversationTitle: conversation.title || "Untitled",
          });
        }
      }
    }

    if (totalThinkingTime > 0) {
      results.conversationsWithThinking++;
      results.totalThinkingTime += totalThinkingTime;
      results.totalThinkingBlocks += thinkingBlocks;
      results.allThinkingBlocks.push(...thinkingDetails);

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
        conversationId: conversation.conversation_id || "unknown",
        title: conversation.title || "Untitled",
        thinkingTimeSec: totalThinkingTime,
        thinkingBlocks: thinkingBlocks,
        thinkingDetails: thinkingDetails,
      });
    }
  }

  return results;
}

describe("thinktime", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thinktime-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should analyze conversations with thinking time", async () => {
    const conversations = [
      {
        conversation_id: "test1",
        title: "Test Conversation",
        mapping: {
          node1: {
            message: {
              metadata: {
                reasoning_status: "reasoning_ended",
                finished_duration_sec: 5.5,
              },
              create_time: 1630454400,
            },
          },
        },
      },
    ];

    const testFile = path.join(tempDir, "test.json");
    await fs.writeFile(testFile, JSON.stringify(conversations));

    const results = await analyzeAllConversations(testFile);

    expect(results.totalConversations).toBe(1);
    expect(results.conversationsWithThinking).toBe(1);
    expect(results.totalThinkingTime).toBe(5.5);
    expect(results.totalThinkingBlocks).toBe(1);
    expect(results.thinkingDistribution["5-15 seconds"]).toBe(1);
  });

  it("should ignore conversations without thinking", async () => {
    const conversations = [
      {
        conversation_id: "test1",
        title: "Test Conversation",
        mapping: {
          node1: {
            message: {
              author: { role: "user" },
              content: { content_type: "text", parts: ["Hello"] },
            },
          },
        },
      },
    ];

    const testFile = path.join(tempDir, "test.json");
    await fs.writeFile(testFile, JSON.stringify(conversations));

    const results = await analyzeAllConversations(testFile);

    expect(results.totalConversations).toBe(1);
    expect(results.conversationsWithThinking).toBe(0);
    expect(results.totalThinkingTime).toBe(0);
    expect(results.totalThinkingBlocks).toBe(0);
  });

  it("should categorize thinking time correctly", async () => {
    const conversations = [
      {
        conversation_id: "test1",
        mapping: {
          node1: {
            message: {
              metadata: { reasoning_status: "reasoning_ended", finished_duration_sec: 3 },
            },
          },
        },
      },
      {
        conversation_id: "test2",
        mapping: {
          node1: {
            message: {
              metadata: { reasoning_status: "reasoning_ended", finished_duration_sec: 10 },
            },
          },
        },
      },
      {
        conversation_id: "test3",
        mapping: {
          node1: {
            message: {
              metadata: { reasoning_status: "reasoning_ended", finished_duration_sec: 70 },
            },
          },
        },
      },
    ];

    const testFile = path.join(tempDir, "test.json");
    await fs.writeFile(testFile, JSON.stringify(conversations));

    const results = await analyzeAllConversations(testFile);

    expect(results.thinkingDistribution["0-5 seconds"]).toBe(1);
    expect(results.thinkingDistribution["5-15 seconds"]).toBe(1);
    expect(results.thinkingDistribution["60+ seconds"]).toBe(1);
  });

  it("should handle multiple thinking blocks in one conversation", async () => {
    const conversations = [
      {
        conversation_id: "test1",
        mapping: {
          node1: {
            message: {
              metadata: { reasoning_status: "reasoning_ended", finished_duration_sec: 5 },
            },
          },
          node2: {
            message: {
              metadata: { reasoning_status: "reasoning_ended", finished_duration_sec: 3 },
            },
          },
        },
      },
    ];

    const testFile = path.join(tempDir, "test.json");
    await fs.writeFile(testFile, JSON.stringify(conversations));

    const results = await analyzeAllConversations(testFile);

    expect(results.conversationsWithThinking).toBe(1);
    expect(results.totalThinkingTime).toBe(8);
    expect(results.totalThinkingBlocks).toBe(2);
    expect(results.allThinkingBlocks).toHaveLength(2);
  });

  it("should ignore reasoning blocks with zero duration", async () => {
    const conversations = [
      {
        conversation_id: "test1",
        mapping: {
          node1: {
            message: {
              metadata: { reasoning_status: "reasoning_ended", finished_duration_sec: 0 },
            },
          },
        },
      },
    ];

    const testFile = path.join(tempDir, "test.json");
    await fs.writeFile(testFile, JSON.stringify(conversations));

    const results = await analyzeAllConversations(testFile);

    expect(results.conversationsWithThinking).toBe(0);
    expect(results.totalThinkingTime).toBe(0);
  });
});
