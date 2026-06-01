/**
 * agentRuntime — Bridge between the new Agent Loop and the existing contract layer.
 *
 * This replaces the agent-specific agent runner logic. It takes a TaskEnvelope
 * produced by the contract layer, converts it into an agent run, and maps
 * the results back into the contract layer's expected format.
 */

import type { SubagentRunnerSlot } from "./types";
import type { AgentLoopConfig, AgentRunResult } from "../agent/agentLoop";
import type { ToolContext } from "../agent/toolRegistry";
import type { LLMProviderConfig } from "../agent/llmProvider";
import { AgentLoop } from "../agent";
import { ToolRegistry } from "../agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentActivityState =
  | "not_started"
  | "ready_to_start"
  | "running_planned"
  | "waiting_output"
  | "reconnect_planned"
  | "stalled"
  | "manual_review_required"
  | "verified";

export interface AgentSlotBinding {
  slot: SubagentRunnerSlot;
  state: AgentActivityState;
  slotId?: string;
  agentRun?: AgentRunResult;
  lastResult?: AgentRunResult;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface AgentRuntimeConfig {
  /** LLM provider configuration for agent runs. */
  providerConfig: LLMProviderConfig;
  /** Session configuration for agent runs. */
  session: AgentLoopConfig["session"];
  /** Tool context injected into every tool execution. */
  toolContext: Omit<ToolContext, "taskEnvelope">;
  /** Maximum turns per agent run. */
  maxTurns?: number;
  /** Tool registry for agent execution. */
  toolRegistry: ToolRegistry;
  /** Sandbox root directory for agent runs. */
  sandboxRoot?: string;
}

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private config: AgentRuntimeConfig;
  private slots = new Map<string, AgentSlotBinding>();

  constructor(config: AgentRuntimeConfig) {
    this.config = config;
  }

  /** Bind a runner slot for agent execution. */
  bindSlot(slot: SubagentRunnerSlot): AgentSlotBinding {
    const binding: AgentSlotBinding = {
      slot,
      state: "ready_to_start",
      slotId: slot.runnerSlotId,
    };
    this.slots.set(slot.runnerSlotId, binding);
    return binding;
  }

  /** Get the state of a bound slot. */
  getSlotState(slotId: string): AgentSlotBinding | undefined {
    return this.slots.get(slotId);
  }

  /** Get all bound slots with their states. */
  getAllSlots(): AgentSlotBinding[] {
    return Array.from(this.slots.values());
  }

  /** Run an agent for a bound slot. */
  async runSlot(slotId: string, userPrompt: string): Promise<AgentRunResult> {
    const binding = this.slots.get(slotId);
    if (!binding) throw new Error(`Slot ${slotId} not bound`);

    binding.state = "running_planned";
    const toolContext: ToolContext = {
      // Double-cast through unknown is required because SubagentRunnerSlot has no
      // overlap with Record<string, unknown>, so a direct cast is rejected by TS.
      taskEnvelope: (binding.slot as unknown as Record<string, unknown>).taskEnvelope as Record<string, unknown>,
      sandboxRoot: this.config.sandboxRoot || "./sandbox",
      sessionId: binding.slotId || slotId,
    };

    const agentLoop = new AgentLoop(
      {
        provider: this.config.providerConfig,
        session: { maxTurnsBeforeCompaction: 10 },
        maxTurns: this.config.maxTurns || 10,
      },
      this.config.toolRegistry,
      toolContext,
    );

    try {
      const result = await agentLoop.run(userPrompt);
      binding.lastResult = result;
      binding.completedAt = new Date().toISOString();
      binding.state = result.completed ? "verified" : "stalled";
      return result;
    } catch (err) {
      binding.state = "stalled";
      binding.error = String(err);
      throw err;
    }
  }
}
