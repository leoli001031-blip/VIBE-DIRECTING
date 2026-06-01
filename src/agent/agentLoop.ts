import type { LLMCallResult, LLMToolCall, LLMProviderConfig, LLMProvider } from "./llmProvider";
import { createLLMProvider } from "./llmProvider";
import { ToolRegistry, type ToolResult, type ToolContext } from "./toolRegistry";
import { SessionManager, type SessionConfig, type SessionState } from "./sessionManager";
import type { ModelMessage, ToolSet } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentLoopConfig {
  /** LLM provider configuration. */
  provider: LLMProviderConfig;
  /** Optional injectable provider for tests / local agent-loop harnesses. */
  providerClient?: LLMProvider;
  /** Session configuration. */
  session: Omit<SessionConfig, "systemPrompt">;
  /** Maximum number of tool-calling turns before forcing a final response. */
  maxTurns: number;
  /** If true, the agent pauses before executing each tool for user approval. */
  requireToolApproval?: boolean;
  /** Callback invoked on each loop iteration (for logging / UI updates). */
  onIteration?: (iteration: AgentIteration) => void;
}

export interface AgentIteration {
  iteration: number;
  messagesSent: number;
  llmResult: LLMCallResult;
  toolResults?: ToolResult[];
  durationMs: number;
}

export interface AgentToolTrace {
  iteration: number;
  callId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  approved: boolean;
}

export interface AgentRunResult {
  /** The final text response from the LLM. */
  finalResponse: string;
  /** All iterations executed during the run. */
  iterations: AgentIteration[];
  /** Total number of tool calls executed. */
  totalToolCalls: number;
  /** Ordered trace of requested tool calls and their results. */
  toolTrace: AgentToolTrace[];
  /** Total wall-clock duration in milliseconds. */
  totalDurationMs: number;
  /** Whether the run completed or was truncated by the turn limit. */
  completed: boolean;
}

// ---------------------------------------------------------------------------
// AgentLoop
// ---------------------------------------------------------------------------

export class AgentLoop {
  private provider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private toolSet: ToolSet;
  private session: SessionManager;
  private config: AgentLoopConfig;
  private toolContext: ToolContext;

  constructor(
    config: AgentLoopConfig,
    toolRegistry: ToolRegistry,
    toolContext: ToolContext,
  ) {
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.toolSet = toolRegistry.getToolSet();
    this.toolContext = toolContext;

    this.provider = config.providerClient ?? createLLMProvider(config.provider);
    this.session = new SessionManager(toolContext.sessionId, {
      ...config.session,
      systemPrompt: config.provider.systemPrompt,
    });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run the agent loop with an initial user prompt.
   *
   * The loop continues until: the LLM responds without tool calls, the
   * turn limit is reached, or a tool errors with `halt` flag.
   */
  async run(userPrompt: string): Promise<AgentRunResult> {
    const startedAt = Date.now();
    const iterations: AgentIteration[] = [];
    const toolTrace: AgentToolTrace[] = [];
    let totalToolCalls = 0;
    let completed = false;
    let finalResponse = "";

    this.session.appendUserMessage(userPrompt);

    for (let i = 0; i < this.config.maxTurns; i++) {
      const iterStart = Date.now();
      const messagesForCall = this.session.getMessages();

      // 1. Call the LLM.
      const llmResult = await this.provider.call(
        messagesForCall,
        this.toolSet,
      );
      this.session.appendAssistantMessage(llmResult);

      // 2. If no tool calls, this is the final response.
      if (llmResult.toolCalls.length === 0) {
        finalResponse = llmResult.text ?? "";
        this.session.completeTurn(llmResult);
        const iter: AgentIteration = {
          iteration: i + 1,
          messagesSent: messagesForCall.length,
          llmResult,
          durationMs: Date.now() - iterStart,
        };
        iterations.push(iter);
        this.config.onIteration?.(iter);
        completed = true;
        break;
      }

      // 3. Check for tool approval if required.
      const calls = this.config.requireToolApproval
        ? await this.requestApproval(llmResult.toolCalls)
        : llmResult.toolCalls;
      const approvedCallIds = new Set(calls.map((call) => call.id));
      const deniedResults = llmResult.toolCalls
        .filter((call) => !approvedCallIds.has(call.id))
        .map((call): ToolResult => ({
          callId: call.id,
          toolName: call.name,
          input: call.args,
          error: "Tool call rejected by approval policy.",
          durationMs: 0,
        }));

      if (calls.length === 0) {
        this.session.appendToolResults(deniedResults);
        this.session.completeTurn(llmResult);
        toolTrace.push(...this.toToolTrace(i + 1, deniedResults, approvedCallIds));
        const iter: AgentIteration = {
          iteration: i + 1,
          messagesSent: messagesForCall.length,
          llmResult,
          toolResults: deniedResults,
          durationMs: Date.now() - iterStart,
        };
        iterations.push(iter);
        this.config.onIteration?.(iter);
        continue;
      }

      // 4. Dispatch tool calls.
      const executedResults = await this.toolRegistry.dispatch(calls, this.toolContext);
      const resultById = new Map(
        [...executedResults, ...deniedResults].map((result) => [result.callId, result]),
      );
      const toolResults = llmResult.toolCalls.flatMap((call) => {
        const result = resultById.get(call.id);
        return result ? [result] : [];
      });
      totalToolCalls += calls.length;

      // 5. Append the turn to the session.
      this.session.appendToolResults(toolResults);
      this.session.completeTurn(llmResult);
      toolTrace.push(...this.toToolTrace(i + 1, toolResults, approvedCallIds));

      const iter: AgentIteration = {
        iteration: i + 1,
        messagesSent: messagesForCall.length,
        llmResult,
        toolResults,
        durationMs: Date.now() - iterStart,
      };
      iterations.push(iter);
      this.config.onIteration?.(iter);

      // 6. Check for halt errors.
      const haltError = toolResults.find(
        (r) => r.error && r.error.startsWith("HALT:"),
      );
      if (haltError) {
        finalResponse = haltError.error!;
        break;
      }
    }

    if (!completed && !finalResponse) {
      finalResponse =
        "Agent reached the maximum number of turns without completing the task.";
    }

    return {
      finalResponse,
      iterations,
      totalToolCalls,
      toolTrace,
      totalDurationMs: Date.now() - startedAt,
      completed,
    };
  }

  // -----------------------------------------------------------------------
  // Approval
  // -----------------------------------------------------------------------

  /**
   * Request user approval for tool calls.
   *
   * Override this in a subclass or wire it to a UI callback. The default
   * implementation logs the calls and rejects them all (deny by default).
   */
  protected async requestApproval(
    toolCalls: LLMToolCall[],
  ): Promise<LLMToolCall[]> {
    console.error(
      `[AgentLoop] Tool approval required but no approval handler overridden. Rejecting ${toolCalls.length} tool call(s):`,
      toolCalls.map((tc) => tc.name).join(", "),
    );
    return [];
  }

  getMessages(): ModelMessage[] {
    return this.session.getMessages();
  }

  getSessionState(): Readonly<SessionState> {
    return this.session.getState();
  }

  /**
   * Serialize the session to a plain object for persistence.
   * Use {@link restoreSessionJSON} to reconstruct after a crash.
   */
  toSessionJSON(): { config: SessionConfig; state: SessionState } {
    return this.session.toJSON();
  }

  /**
   * Replace the current session with one reconstructed from a previous
   * {@link toSessionJSON} call. All historical messages, turn counts and
   * token statistics are restored.
   */
  restoreSessionJSON(json: { config: SessionConfig; state: SessionState }): void {
    this.session = SessionManager.fromJSON(json);
  }

  private toToolTrace(
    iteration: number,
    results: ToolResult[],
    approvedCallIds: ReadonlySet<string>,
  ): AgentToolTrace[] {
    return results.map((result) => ({
      iteration,
      callId: result.callId,
      toolName: result.toolName,
      input: result.input,
      output: result.output,
      error: result.error,
      durationMs: result.durationMs,
      approved: approvedCallIds.has(result.callId),
    }));
  }
}
