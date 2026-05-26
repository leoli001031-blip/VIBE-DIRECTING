import { generateText, stepCountIs, type LanguageModel, type ModelMessage, type ToolSet } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMProviderConfig {
  /** The language model to use (from the Vercel AI SDK provider package). */
  model: LanguageModel;
  /** System prompt injected into every call. */
  systemPrompt: string;
  /** Sampling temperature (provider-dependent). */
  temperature?: number;
  /** Maximum output tokens. */
  maxTokens?: number;
}

export interface LLMToolCall {
  /** Unique ID of the tool call. */
  id: string;
  /** Tool name as understood by the LLM. */
  name: string;
  /** Parsed arguments object. */
  args: Record<string, unknown>;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMCallResult {
  /** Generated text when the model responds directly (no tool calls). */
  text: string | null;
  /** Tool calls the model requested (if any). */
  toolCalls: LLMToolCall[];
  /** Reason why the generation stopped. */
  finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other";
  /** Token usage for this call (undefined if the provider didn't report it). */
  usage?: LLMUsage;
}

export interface LLMProvider {
  call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Creates an LLM provider callable that wraps the Vercel AI SDK's
 * `generateText`. The returned `call` function accepts messages and an
 * optional tool set, and returns a normalized `LLMCallResult`.
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  const { model, systemPrompt, temperature, maxTokens } = config;

  /**
   * Call the LLM with a list of messages and (optionally) tools.
   *
   * The system prompt from the config is automatically prepended as the first
   * message unless the caller already includes a system message.
   */
  async function call(
    messages: ModelMessage[],
    tools?: ToolSet,
  ): Promise<LLMCallResult> {
    // Prepend system prompt unless the caller already includes one.
    const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
    const fullMessages: ModelMessage[] = hasSystemMessage
      ? messages
      : [{ role: "system", content: systemPrompt }, ...messages];

    const result = await generateText({
      model,
      messages: fullMessages,
      tools,
      temperature,
      maxOutputTokens: maxTokens,
      // Stop after one step so tool dispatch is controlled by our agent loop.
      stopWhen: stepCountIs(1),
      maxRetries: 1,
    });

    // Normalize tool calls from the result
    const toolCalls: LLMToolCall[] = (result.toolCalls ?? []).map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      args: (tc.input as Record<string, unknown>) ?? {},
    }));

    // Normalize usage
    const usage: LLMUsage | undefined =
      result.totalUsage
        ? {
            inputTokens: result.totalUsage.inputTokens ?? 0,
            outputTokens: result.totalUsage.outputTokens ?? 0,
          }
        : undefined;

    return {
      text: result.text || null,
      toolCalls,
      finishReason: result.finishReason,
      usage,
    };
  }

  return { call };
}
