import type { LanguageModel, ModelMessage, ToolSet } from "ai";
import { z } from "zod";
import { AgentLoop, ToolRegistry } from "../src/agent/index.ts";
import type { LLMCallResult, LLMProvider } from "../src/agent/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cloneMessages(messages: ModelMessage[]): ModelMessage[] {
  return JSON.parse(JSON.stringify(messages)) as ModelMessage[];
}

function contentText(message: ModelMessage): string {
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content);
}

const userPrompt = "请为 A1_01 生成动作计划，并留下可追踪工具回执。";
const capturedCalls: ModelMessage[][] = [];

const mockProvider: LLMProvider = {
  async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
    capturedCalls.push(cloneMessages(messages));

    if (capturedCalls.length === 1) {
      assert(messages.length === 2, "first LLM call should receive system + user");
      assert(messages[0].role === "system", "first message should be system");
      assert(messages[1].role === "user", "second message should be user");
      assert(contentText(messages[1]) === userPrompt, "first LLM call should include user prompt");
      assert(tools?.record_plan, "registered tool should be exposed to the provider");

      return {
        text: null,
        toolCalls: [
          {
            id: "tool-call-1",
            name: "record_plan",
            args: { shotId: "A1_01", prompt: "动作计划" },
          },
        ],
        finishReason: "tool-calls",
        usage: { inputTokens: 12, outputTokens: 6 },
      };
    }

    assert(capturedCalls.length === 2, "smoke test should finish on the second LLM call");
    assert(messages.length === 4, "second LLM call should receive system, user, assistant tool call, tool result");
    assert(messages.map((message) => message.role).join(",") === "system,user,assistant,tool", "message roles should follow AI SDK tool-call ordering");

    const assistantMessage = messages[2];
    assert(Array.isArray(assistantMessage.content), "assistant tool-call message should use content parts");
    assert(assistantMessage.content[0]?.type === "tool-call", "assistant message should contain a tool-call part");
    assert(assistantMessage.content[0]?.toolCallId === "tool-call-1", "assistant tool call id should be preserved");

    const toolMessage = messages[3];
    assert(Array.isArray(toolMessage.content), "tool message should use content parts");
    assert(toolMessage.content[0]?.type === "tool-result", "tool message should contain a tool-result part");
    assert(toolMessage.content[0]?.toolCallId === "tool-call-1", "tool result should reference the original tool call id");
    assert(toolMessage.content[0]?.output.type === "text", "tool result should be serialized for the provider");
    assert(toolMessage.content[0]?.output.value.includes("trace-record-1"), "tool result should include traceable output");

    return {
      text: "已生成动作计划，并记录工具回执 trace-record-1。",
      toolCalls: [],
      finishReason: "stop",
      usage: { inputTokens: 18, outputTokens: 9 },
    };
  },
};

const registry = new ToolRegistry();
registry.register({
  name: "record_plan",
  description: "Record an agent-loop planning trace.",
  schema: z.object({
    shotId: z.string(),
    prompt: z.string(),
  }),
  execute: async (input, context) => ({
    receiptId: "trace-record-1",
    shotId: input.shotId,
    prompt: input.prompt,
    sessionId: context.sessionId,
  }),
});

const loop = new AgentLoop(
  {
    provider: {
      model: {} as LanguageModel,
      systemPrompt: "你是 Agent Loop smoke-test provider。",
    },
    providerClient: mockProvider,
    session: { maxTurnsBeforeCompaction: 10 },
    maxTurns: 4,
  },
  registry,
  {
    taskEnvelope: { id: "agent-loop-smoke" },
    sandboxRoot: "/tmp/agent-loop-smoke",
    sessionId: "agent-loop-smoke-session",
  },
);

const result = await loop.run(userPrompt);
assert(result.completed, "agent loop should complete after final assistant response");
assert(result.finalResponse.includes("trace-record-1"), "final response should mention the tool trace receipt");
assert(result.totalToolCalls === 1, "agent loop should execute exactly one tool call");
assert(result.toolTrace.length === 1, "agent loop should expose one tool trace entry");
assert(result.toolTrace[0]?.approved === true, "tool trace should mark executed tool as approved");
assert(result.toolTrace[0]?.callId === "tool-call-1", "tool trace should preserve call id");
assert(result.toolTrace[0]?.toolName === "record_plan", "tool trace should preserve tool name");
assert((result.toolTrace[0]?.output as { receiptId?: string }).receiptId === "trace-record-1", "tool trace should preserve structured output");

const finalMessages = loop.getMessages();
assert(finalMessages.map((message) => message.role).join(",") === "system,user,assistant,tool,assistant", "session should retain the complete closed-loop transcript");

console.log("agent-loop smoke test passed");
