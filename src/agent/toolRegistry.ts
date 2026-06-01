import { z } from "zod";
import type { ToolSet } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Context made available to every tool execution. */
export interface ToolContext {
  /** The full task envelope driving the current agent run. */
  taskEnvelope: Record<string, unknown>;
  /** Root path of the sandbox / working directory. */
  sandboxRoot: string;
  /** Unique identifier for the agent session. */
  sessionId: string;
}

/** Result of a single tool invocation. */
export interface ToolResult {
  /** The callId from the LLM tool call that triggered this execution. */
  callId: string;
  /** Name of the executed tool. */
  toolName: string;
  /** The parsed input the tool received. */
  input: unknown;
  /** The tool's return value (undefined if it errored). */
  output?: unknown;
  /** Error message if the tool threw or rejected. */
  error?: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
}

/**
 * A registered tool definition.
 *
 * @typeParam TInput  - The shape of the tool's parsed input.
 * @typeParam TOutput - The shape of the tool's output.
 */
export interface ToolDefinition<
  TInput = Record<string, unknown>,
  TOutput = unknown,
> {
  /** Unique tool name (used as the key in the LLM tool set). */
  name: string;
  /** Human-readable description sent to the LLM. */
  description: string;
  /** Zod schema used to validate the LLM-generated input. */
  schema: z.ZodType<TInput>;
  /** The actual implementation. Receives validated input and context. */
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
  /** If true, the agent loop will pause for human approval before running. */
  requiresApproval?: boolean;
}

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private definitions = new Map<string, ToolDefinition>();

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /** Register a single tool definition. Overwrites if name already exists. */
  register(def: ToolDefinition): void {
    if (!def.name || typeof def.name !== "string") {
      throw new Error("ToolDefinition must have a non-empty string 'name'.");
    }
    if (typeof def.execute !== "function") {
      throw new Error(
        `ToolDefinition "${def.name}" must have an 'execute' function.`,
      );
    }
    if (!def.schema) {
      throw new Error(`ToolDefinition "${def.name}" must have a 'schema'.`);
    }
    this.definitions.set(def.name, def);
  }

  /** Register multiple tool definitions at once. */
  registerAll(defs: ToolDefinition[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  listToolNames(): string[] {
    return Array.from(this.definitions.keys()).sort((left, right) => left.localeCompare(right));
  }

  // -----------------------------------------------------------------------
  // LLM tool set
  // -----------------------------------------------------------------------

  /**
   * Build a `ToolSet` object consumable by the Vercel AI SDK.
   *
   * Each tool includes `description`, `inputSchema`, `requiresApproval`, and
   * an `execute` stub that always throws (the agent loop dispatches tools
   * manually via `dispatch` instead of letting the SDK auto-execute them).
   */
  getToolSet(): ToolSet {
    const toolSet: ToolSet = {};
    for (const [name, def] of this.definitions) {
      toolSet[name] = {
        description: def.description,
        inputSchema: def.schema,
        requiresApproval: def.requiresApproval,
        execute: async () => {
          // The agent loop dispatches tools manually via dispatch().
          // If the SDK ever calls execute (e.g. during repair / retry), we
          // surface a clear error rather than silently no-opping.
          throw new Error(
            `Tool "${name}" must be dispatched by the agent loop, not the AI SDK.`,
          );
        },
      } as ToolSet[string];
    }
    return toolSet;
  }

  // -----------------------------------------------------------------------
  // Dispatch
  // -----------------------------------------------------------------------

  /**
   * Execute one or more tool calls in parallel.
   *
   * Each call is matched to a registered definition. Errors are caught
   * per-call so a single failing tool never crashes the batch.
   *
   * @param calls   - Tool calls emitted by the LLM.
   * @param context - Shared context injected into every tool execution.
   * @returns One `ToolResult` per input call.
   */
  async dispatch(
    calls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
    context: ToolContext,
  ): Promise<ToolResult[]> {
    const tasks = calls.map(async (call): Promise<ToolResult> => {
      const startedAt = Date.now();
      try {
        const def = this.definitions.get(call.name);
        if (!def) {
          return {
            callId: call.id,
            toolName: call.name,
            input: call.args,
            error: `Unknown tool "${call.name}". Available: ${Array.from(this.definitions.keys()).join(", ")}`,
            durationMs: Date.now() - startedAt,
          };
        }

        // Validate input against the tool's zod schema.
        const parsed = def.schema.safeParse(call.args);
        if (!parsed.success) {
          return {
            callId: call.id,
            toolName: call.name,
            input: call.args,
            error: `Invalid input for tool "${call.name}": ${parsed.error.message}`,
            durationMs: Date.now() - startedAt,
          };
        }

        const output = await def.execute(parsed.data, context);
        return {
          callId: call.id,
          toolName: call.name,
          input: call.args,
          output,
          durationMs: Date.now() - startedAt,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          callId: call.id,
          toolName: call.name,
          input: call.args,
          error: message,
          durationMs: Date.now() - startedAt,
        };
      }
    });

    return Promise.all(tasks);
  }
}
