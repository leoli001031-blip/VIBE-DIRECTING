import type { LanguageModel } from "ai";

import { validateTaskEnvelope } from "../core/envelopeValidator";
import type { TaskEnvelope } from "../core/types";
import { AgentLoop, type AgentRunResult, type AgentToolTrace } from "./agentLoop";
import { createAgentFileTool, type AgentFileToolConfig } from "./fileTool";
import type { Image2ToolConfig } from "./image2Tool";
import {
  createLanyiImage2AgentTool,
  lanyiImage2AgentToolName,
  type LanyiImage2AgentToolConfig,
  type LanyiImage2SubmitPlanCandidate,
} from "./lanyiImage2AgentTool";
import type { LLMProvider, LLMProviderConfig } from "./llmProvider";
import { ToolRegistry, type ToolDefinition } from "./toolRegistry";
import {
  agentWebSearchToolName,
  createAgentWebSearchTool,
  type AgentWebSearchToolConfig,
  type AgentWebSearchToolResult,
} from "./webSearchTool";

export const ownedAgentLoopSchemaVersion = "0.1.0";

export type OwnedAgentProviderMode = "mock_provider" | "real_provider";
export type OwnedAgentProviderPath = "mock_provider_path" | "real_provider_path";
export type OwnedAgentRunStatus = "succeeded" | "blocked" | "failed";

export interface OwnedAgentLoopConfig {
  providerMode: OwnedAgentProviderMode;
  provider: LLMProviderConfig;
  providerClient?: LLMProvider;
  maxTurns?: number;
  session?: {
    maxTurnsBeforeCompaction?: number;
  };
  fileTool?: AgentFileToolConfig | false;
  image2Tool?: Image2ToolConfig;
  lanyiImage2Tool?: LanyiImage2AgentToolConfig | false;
  webSearchTool?: AgentWebSearchToolConfig | false;
  extraTools?: ToolDefinition[];
}

export interface RunOwnedAgentTaskEnvelopeInput {
  validatedTaskEnvelope: OwnedAgentValidatedTaskEnvelope;
  sandboxRoot: string;
  sessionId: string;
  createdAt?: string;
  config: OwnedAgentLoopConfig;
}

export interface OwnedAgentValidatedTaskEnvelope {
  kind: "owned_agent_validated_task_envelope";
  taskEnvelope: TaskEnvelope;
  validation: {
    valid: true;
    issues: [];
  };
}

export interface OwnedAgentSessionCheckpoint {
  sessionId: string;
  turnCount: number;
  messageCount: number;
  totalTokensUsed: number;
  lastCompactionAt: number;
}

export interface OwnedAgentReceiptCandidate {
  id: string;
  kind: "owned_agent_receipt_candidate";
  schemaVersion: typeof ownedAgentLoopSchemaVersion;
  taskEnvelopeId: string;
  sessionId: string;
  providerMode: OwnedAgentProviderMode;
  providerPath: OwnedAgentProviderPath;
  createdAt: string;
  status: "candidate";
  toolCallCount: number;
  evidenceRefs: string[];
  structuredResultHash: string;
  canPromote: boolean;
  reviewRequired: boolean;
}

export interface OwnedAgentStructuredResult {
  schemaVersion: typeof ownedAgentLoopSchemaVersion;
  status: OwnedAgentRunStatus;
  providerMode: OwnedAgentProviderMode;
  providerPath: OwnedAgentProviderPath;
  taskEnvelopeId: string;
  sessionId: string;
  validation: {
    valid: boolean;
    issues: string[];
  };
  finalResponse: string;
  toolTrace: AgentToolTrace[];
  evidenceRefs: string[];
  outputPaths: string[];
  image2SubmitPlans: LanyiImage2SubmitPlanCandidate[];
  webSearches: AgentWebSearchToolResult[];
  checkpoint: OwnedAgentSessionCheckpoint;
  receiptCandidate?: OwnedAgentReceiptCandidate;
  promotionAllowed: boolean;
  blockedReasons: string[];
  providerCalled: boolean;
}

export function providerPathFromMode(providerMode: OwnedAgentProviderMode): OwnedAgentProviderPath {
  return providerMode === "real_provider" ? "real_provider_path" : "mock_provider_path";
}

export function validateOwnedAgentTaskEnvelope(taskEnvelope: TaskEnvelope): OwnedAgentValidatedTaskEnvelope {
  const validation = validateTaskEnvelope(taskEnvelope);
  if (!validation.valid) {
    throw new Error(`owned_agent_task_envelope_invalid:${validation.issues.join(",") || "unknown"}`);
  }
  return {
    kind: "owned_agent_validated_task_envelope",
    taskEnvelope,
    validation: {
      valid: true,
      issues: [],
    },
  };
}

export function createOwnedAgentToolRegistry(config: Pick<OwnedAgentLoopConfig, "providerMode" | "fileTool" | "image2Tool" | "lanyiImage2Tool" | "webSearchTool" | "extraTools">): ToolRegistry {
  const registry = new ToolRegistry();
  if (config.fileTool !== false) {
    registry.register(createAgentFileTool(config.fileTool || {}) as unknown as ToolDefinition);
  }
  if (config.webSearchTool) {
    registry.register(createAgentWebSearchTool(config.webSearchTool) as unknown as ToolDefinition);
  }
  if (config.lanyiImage2Tool !== false) {
    registry.register(createLanyiImage2AgentTool({
      providerMode: config.providerMode === "real_provider" ? "real_lanyi_image2_provider" : "mock_lanyi_image2_provider",
      ...(config.lanyiImage2Tool || {}),
    }) as unknown as ToolDefinition);
  }
  // R-MVP-1A: fail closed until owned-loop P6 permission and action-time gates are validated.
  const extraTools = (config.extraTools || []).filter((tool) => tool.name !== "image2_generate" && tool.name !== lanyiImage2AgentToolName);
  registry.registerAll(extraTools);
  return registry;
}

export function createMockOwnedAgentConfig(providerClient: LLMProvider): OwnedAgentLoopConfig {
  return {
    providerMode: "mock_provider",
    providerClient,
    provider: {
      model: {} as LanguageModel,
      systemPrompt: "You are the mock_provider path for the owned Vibe Director agent loop.",
    },
    session: { maxTurnsBeforeCompaction: 10 },
    maxTurns: 4,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashValue(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `owned_agent_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "task";
}

function compactTime(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14) || `${Date.now()}`;
}

function promptFromTaskEnvelope(envelope: TaskEnvelope): string {
  return [
    "Run this validated TaskEnvelope. Do not accept or invent free-text task instructions.",
    "For Lanyi/Image2 work, call lanyi_image2_agent_tool with a validated_task_envelope_ref or structured_lanyi_image2_task only.",
    "Do not call legacy image2_generate. Lanyi/Image2 tool output is a candidate that still requires receipt/review before promotion.",
    "If web_search is available and local knowledge is insufficient, use it only for cited research; web findings still require user confirmation before becoming Project.vibe facts.",
    `TaskEnvelope id: ${envelope.id}`,
    `Purpose: ${envelope.purpose}`,
    `Provider slot: ${envelope.providerSlot}`,
    `Required mode: ${envelope.requiredMode}`,
    `Source index hash: ${envelope.sourceIndexHash}`,
    `Expected outputs: ${envelope.expectedOutputs.join(", ")}`,
    `QA checklist: ${envelope.qaChecklist.join(", ")}`,
  ].join("\n");
}

function evidenceRefsFromTrace(trace: AgentToolTrace[]): string[] {
  return Array.from(new Set(trace.flatMap((item) => {
    const output = item.output as Record<string, unknown> | undefined;
    const evidenceCandidate = output?.evidenceCandidate as Record<string, unknown> | undefined;
    const receiptCandidate = output?.receiptCandidate as Record<string, unknown> | undefined;
    return [
      typeof output?.evidenceRef === "string" ? output.evidenceRef : "",
      typeof evidenceCandidate?.evidenceRef === "string" ? evidenceCandidate.evidenceRef : "",
      typeof receiptCandidate?.evidenceRef === "string" ? receiptCandidate.evidenceRef : "",
      typeof output?.path === "string" ? `agent_file#${output.path}` : "",
      typeof output?.imagePath === "string" ? `agent_output#${output.imagePath}` : "",
    ].filter(Boolean);
  })));
}

function outputPathsFromTrace(trace: AgentToolTrace[]): string[] {
  return Array.from(new Set(trace.flatMap((item) => {
    const output = item.output as Record<string, unknown> | undefined;
    const evidenceCandidate = output?.evidenceCandidate as Record<string, unknown> | undefined;
    const receiptCandidate = output?.receiptCandidate as Record<string, unknown> | undefined;
    return [
      typeof output?.path === "string" ? output.path : "",
      typeof output?.imagePath === "string" ? output.imagePath : "",
      typeof output?.expectedOutputPath === "string" ? output.expectedOutputPath : "",
      typeof evidenceCandidate?.expectedOutputPath === "string" ? evidenceCandidate.expectedOutputPath : "",
      typeof receiptCandidate?.expectedOutputPath === "string" ? receiptCandidate.expectedOutputPath : "",
    ].filter(Boolean);
  })));
}

function image2SubmitPlansFromTrace(trace: AgentToolTrace[]): LanyiImage2SubmitPlanCandidate[] {
  return trace.flatMap((item) => {
    const output = item.output as Record<string, unknown> | undefined;
    const candidate = output?.submitPlanCandidate as LanyiImage2SubmitPlanCandidate | undefined;
    if (!candidate || candidate.kind !== "lanyi_image2_submit_plan_candidate") return [];
    return [candidate];
  });
}

function webSearchesFromTrace(trace: AgentToolTrace[]): AgentWebSearchToolResult[] {
  return trace.flatMap((item) => {
    const output = item.output as AgentWebSearchToolResult | undefined;
    if (!output || output.kind !== "agent_web_search_result") return [];
    return [output];
  });
}

function checkpointFromRun(loop: AgentLoop, sessionId: string): OwnedAgentSessionCheckpoint {
  const state = loop.getSessionState();
  return {
    sessionId,
    turnCount: state.turnCount,
    messageCount: state.messages.length,
    totalTokensUsed: state.totalTokensUsed,
    lastCompactionAt: state.lastCompactionAt,
  };
}

function emptyCheckpoint(sessionId: string): OwnedAgentSessionCheckpoint {
  return {
    sessionId,
    turnCount: 0,
    messageCount: 0,
    totalTokensUsed: 0,
    lastCompactionAt: 0,
  };
}

function structuredResultHashInput(result: Pick<
  OwnedAgentStructuredResult,
  "status" | "providerMode" | "providerPath" | "taskEnvelopeId" | "sessionId" | "finalResponse" | "toolTrace" | "evidenceRefs" | "outputPaths" | "image2SubmitPlans" | "webSearches" | "providerCalled"
>) {
  return {
    status: result.status,
    providerMode: result.providerMode,
    providerPath: result.providerPath,
    taskEnvelopeId: result.taskEnvelopeId,
    sessionId: result.sessionId,
    finalResponse: result.finalResponse,
    toolTrace: result.toolTrace,
    evidenceRefs: result.evidenceRefs,
    outputPaths: result.outputPaths,
    image2SubmitPlans: result.image2SubmitPlans,
    webSearches: result.webSearches,
    providerCalled: result.providerCalled,
  };
}

function receiptCandidateFor(
  input: RunOwnedAgentTaskEnvelopeInput,
  agentRun: AgentRunResult,
  evidenceRefs: string[],
  outputPaths: string[],
  image2SubmitPlans: LanyiImage2SubmitPlanCandidate[],
  webSearches: AgentWebSearchToolResult[],
): OwnedAgentReceiptCandidate | undefined {
  const taskEnvelope = input.validatedTaskEnvelope.taskEnvelope;
  if (!agentRun.completed) return undefined;
  if (agentRun.toolTrace.some((item) => item.error)) return undefined;
  if (!evidenceRefs.length) return undefined;
  const providerPath = providerPathFromMode(input.config.providerMode);
  const providerCalled = providerCalledFromTrace(agentRun.toolTrace);
  const reviewRequired = agentRun.toolTrace.some((item) => item.toolName === lanyiImage2AgentToolName || item.toolName === agentWebSearchToolName);
  return {
    id: `owned_agent_receipt_${safeId(taskEnvelope.id)}_${compactTime(input.createdAt || new Date().toISOString())}`,
    kind: "owned_agent_receipt_candidate",
    schemaVersion: ownedAgentLoopSchemaVersion,
    taskEnvelopeId: taskEnvelope.id,
    sessionId: input.sessionId,
    providerMode: input.config.providerMode,
    providerPath,
    createdAt: input.createdAt || new Date().toISOString(),
    status: "candidate",
    toolCallCount: agentRun.totalToolCalls,
    evidenceRefs,
    structuredResultHash: hashValue(structuredResultHashInput({
      status: "succeeded",
      providerMode: input.config.providerMode,
      providerPath,
      taskEnvelopeId: taskEnvelope.id,
      sessionId: input.sessionId,
      finalResponse: agentRun.finalResponse,
      toolTrace: agentRun.toolTrace,
      evidenceRefs,
      outputPaths,
      image2SubmitPlans,
      webSearches,
      providerCalled,
    })),
    canPromote: !reviewRequired,
    reviewRequired,
  };
}

function providerCalledFromTrace(trace: AgentToolTrace[]): boolean {
  return trace.some((item) => {
    if (item.error) return false;
    if (item.toolName === "image2_generate") return true;
    const output = item.output as Record<string, unknown> | undefined;
    return output?.providerCalled === true;
  });
}

export function canPromoteOwnedAgentResult(result: OwnedAgentStructuredResult): boolean {
  const receipt = result.receiptCandidate;
  if (result.status !== "succeeded" || !receipt || receipt.canPromote !== true) return false;
  if (receipt.kind !== "owned_agent_receipt_candidate" || receipt.status !== "candidate") return false;
  if (receipt.schemaVersion !== result.schemaVersion) return false;
  if (receipt.taskEnvelopeId !== result.taskEnvelopeId || receipt.sessionId !== result.sessionId) return false;
  if (receipt.providerMode !== result.providerMode || receipt.providerPath !== result.providerPath) return false;
  if (!receipt.evidenceRefs.length || receipt.evidenceRefs.some((ref) => !result.evidenceRefs.includes(ref))) return false;
  return receipt.structuredResultHash === hashValue(structuredResultHashInput(result));
}

export async function runOwnedAgentTaskEnvelope(input: RunOwnedAgentTaskEnvelopeInput): Promise<OwnedAgentStructuredResult> {
  const taskEnvelope = input.validatedTaskEnvelope.taskEnvelope;
  const validation = input.validatedTaskEnvelope.validation;
  const providerPath = providerPathFromMode(input.config.providerMode);

  const registry = createOwnedAgentToolRegistry(input.config);
  const loop = new AgentLoop(
    {
      provider: input.config.provider,
      providerClient: input.config.providerClient,
      session: { maxTurnsBeforeCompaction: input.config.session?.maxTurnsBeforeCompaction || 10 },
      maxTurns: input.config.maxTurns || 6,
    },
    registry,
    {
      taskEnvelope: taskEnvelope as unknown as Record<string, unknown>,
      sandboxRoot: input.sandboxRoot,
      sessionId: input.sessionId,
    },
  );
  const agentRun = await loop.run(promptFromTaskEnvelope(taskEnvelope));
  const evidenceRefs = evidenceRefsFromTrace(agentRun.toolTrace);
  const outputPaths = outputPathsFromTrace(agentRun.toolTrace);
  const image2SubmitPlans = image2SubmitPlansFromTrace(agentRun.toolTrace);
  const webSearches = webSearchesFromTrace(agentRun.toolTrace);
  const receiptCandidate = receiptCandidateFor(input, agentRun, evidenceRefs, outputPaths, image2SubmitPlans, webSearches);
  const toolErrors = agentRun.toolTrace.filter((item) => item.error).map((item) => `${item.toolName}:${item.error}`);
  const status: OwnedAgentRunStatus = receiptCandidate ? "succeeded" : "failed";
  const result: OwnedAgentStructuredResult = {
    schemaVersion: ownedAgentLoopSchemaVersion,
    status,
    providerMode: input.config.providerMode,
    providerPath,
    taskEnvelopeId: taskEnvelope.id,
    sessionId: input.sessionId,
    validation,
    finalResponse: agentRun.finalResponse,
    toolTrace: agentRun.toolTrace,
    evidenceRefs,
    outputPaths,
    image2SubmitPlans,
    webSearches,
    checkpoint: checkpointFromRun(loop, input.sessionId),
    receiptCandidate,
    promotionAllowed: Boolean(receiptCandidate),
    blockedReasons: receiptCandidate ? toolErrors : [...toolErrors, "receipt_candidate_missing"],
    providerCalled: providerCalledFromTrace(agentRun.toolTrace),
  };
  return {
    ...result,
    promotionAllowed: canPromoteOwnedAgentResult(result),
  };
}
