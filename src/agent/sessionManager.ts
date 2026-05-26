import type { ModelMessage, TextPart, ToolCallPart, ToolResultPart } from "ai";
import type { LLMCallResult, LLMToolCall } from "./llmProvider";
import type { ToolResult } from "./toolRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionConfig {
  maxTurnsBeforeCompaction: number;
  systemPrompt: string;
}

export interface SessionState {
  sessionId: string;
  messages: ModelMessage[];
  turnCount: number;
  totalTokensUsed: number;
  lastCompactionAt: number;
}

type SessionToolResultOutput =
  | { type: "text"; value: string }
  | { type: "error-text"; value: string };

const MAX_TOOL_OUTPUT_LENGTH = 50 * 1024; // 50 KB

function sanitizeToolOutput(raw: string, toolName: string): string {
  const prefix = `[ToolResult: ${toolName}]\n`;
  const full = prefix + raw;
  if (full.length <= MAX_TOOL_OUTPUT_LENGTH) {
    return full;
  }
  // Truncate, leaving room for the notice.
  const truncated = full.slice(0, MAX_TOOL_OUTPUT_LENGTH - 30);
  return truncated + "\n... [truncated to 50KB]";
}

function toToolResultOutput(value: unknown, toolName: string): SessionToolResultOutput {
  if (value instanceof Error) {
    return { type: "error-text", value: value.message };
  }
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return { type: "text", value: sanitizeToolOutput(raw ?? String(value), toolName) };
}

type AssistantToolContentPart = TextPart | ToolCallPart;

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export class SessionManager {
  private state: SessionState;
  private config: SessionConfig;

  constructor(sessionId: string, config: SessionConfig) {
    this.config = config;
    this.state = {
      sessionId,
      messages: [
        { role: "system", content: config.systemPrompt },
      ],
      turnCount: 0,
      totalTokensUsed: 0,
      lastCompactionAt: 0,
    };
  }

  getMessages(): ModelMessage[] {
    return [...this.state.messages];
  }

  appendUserMessage(content: string): void {
    this.state.messages.push({ role: "user", content } as ModelMessage);
  }

  appendAssistantMessage(llmResult: LLMCallResult): void {
    if (llmResult.toolCalls.length === 0) {
      this.state.messages.push({
        role: "assistant",
        content: llmResult.text ?? "",
      } as ModelMessage);
      return;
    }

    const content: AssistantToolContentPart[] = [];
    if (llmResult.text) {
      content.push({ type: "text", text: llmResult.text });
    }
    content.push(
      ...llmResult.toolCalls.map((tc: LLMToolCall): ToolCallPart => ({
        type: "tool-call",
        toolCallId: tc.id,
        toolName: tc.name,
        input: tc.args,
      })),
    );
    this.state.messages.push({
      role: "assistant",
      content,
    } as ModelMessage);
  }

  appendToolResults(toolResults: ToolResult[]): void {
    if (toolResults.length === 0) return;

    const content: ToolResultPart[] = toolResults.map((tr: ToolResult) => ({
      type: "tool-result" as const,
      toolCallId: tr.callId,
      toolName: tr.toolName,
      output: tr.error
        ? { type: "error-text", value: tr.error }
        : toToolResultOutput(tr.output, tr.toolName),
    }));
    this.state.messages.push({
      role: "tool",
      content,
    } as ModelMessage);
  }

  completeTurn(llmResult: LLMCallResult): void {
    this.state.turnCount++;
    if (llmResult.usage) {
      this.state.totalTokensUsed +=
        llmResult.usage.inputTokens + llmResult.usage.outputTokens;
    }

    if (
      this.state.turnCount - this.state.lastCompactionAt >=
      this.config.maxTurnsBeforeCompaction
    ) {
      this.compact();
    }
  }

  appendTurn(
    userMessage: string,
    llmResult: LLMCallResult,
    toolResults?: ToolResult[],
  ): void {
    this.appendUserMessage(userMessage);
    this.appendAssistantMessage(llmResult);
    this.appendToolResults(toolResults ?? []);
    this.completeTurn(llmResult);
  }

  /** Compact old messages, keeping system prompt + recent turns. */
  compact(): void {
    const systemMessage = this.state.messages[0];
    const keepCount = Math.max(2, Math.floor(this.config.maxTurnsBeforeCompaction / 2));
    const recent = this.state.messages.slice(-keepCount * 3);

    this.state.messages = [systemMessage, ...recent];
    this.state.lastCompactionAt = this.state.turnCount;
  }

  /** Reset the session entirely. */
  reset(): void {
    this.state.messages = [
      { role: "system", content: this.config.systemPrompt },
    ];
    this.state.turnCount = 0;
    this.state.totalTokensUsed = 0;
    this.state.lastCompactionAt = 0;
  }

  /** Get current token estimate. */
  estimateTokens(): number {
    return this.state.messages.reduce((sum, m) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);
  }

  getState(): Readonly<SessionState> {
    return this.state;
  }

  /**
   * Serialize the full session (config + state) to a plain object so the
   * caller can persist it (e.g. to disk / Redis) and survive process crashes.
   */
  toJSON(): { config: SessionConfig; state: SessionState } {
    return {
      config: { ...this.config },
      state: { ...this.state, messages: [...this.state.messages] },
    };
  }

  /**
   * Reconstruct a SessionManager from a previously-serialised payload.
   *
   * The constructor is bypassed so that all historical messages, turn
   * counts and token statistics are restored exactly as they were.
   */
  static fromJSON(json: { config: SessionConfig; state: SessionState }): SessionManager {
    const manager = Object.create(SessionManager.prototype) as SessionManager;
    manager.config = { ...json.config };
    manager.state = {
      ...json.state,
      messages: [...json.state.messages],
    };
    return manager;
  }
}
