import type { VibeAgentTimelineEntry } from "../../agent-core/types";
import type { DirectorAgentActionEnvelope } from "../../core/directorAgentAction";
import type { DirectorAgentToolHandoff } from "../../core/directorAgentToolHandoff";
import {
  restoreAgentVideoExecutionReceipt,
  runAgentVideoExecution,
  type AgentVideoExecutionAction,
  type AgentVideoExecutionAdapterResult,
  type AgentVideoExecutionContext,
  type AgentVideoExecutionOperation,
  type AgentVideoLiveCapability,
  type RunAgentVideoExecutionInput,
} from "../../core/agentVideoExecutionAdapter";
import {
  createAgentVideoGenerationJobLedger,
  type AgentVideoGenerationJobLedger,
  type AgentVideoPipelinePlan,
} from "../../core/agentVideoProductionContract";
import type { AgentControlledToolInvocationTarget } from "./agentPanelProjection";
import {
  buildMinimalAgentProductAdapter,
  type MinimalAgentProductAdapterInput,
} from "./agentProductCapabilities";

export interface AgentVideoExecutionProjectIdentity {
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
}

export interface AgentVideoExecutionControllerDependencies {
  getProjectIdentity: () => AgentVideoExecutionProjectIdentity;
  setProjectIdentity: (identity: AgentVideoExecutionProjectIdentity) => void;
  getLedger: () => AgentVideoGenerationJobLedger;
  setLedger: (ledger: AgentVideoGenerationJobLedger) => void;
  canPersistLedger?: () => boolean;
  persistLedger?: (ledger: AgentVideoGenerationJobLedger) => void | Promise<void>;
  publishTimeline?: (
    entries: VibeAgentTimelineEntry[],
    identity: AgentVideoExecutionProjectIdentity,
  ) => void | Promise<void>;
  setStatus?: (status: string) => void;
}

export type AgentVideoExecutionControllerRunInput = Omit<
  RunAgentVideoExecutionInput,
  | "ledger"
  | "sourceConfirmationId"
  | "retryOfActionId"
  | "liveExecutionAllowed"
  | "liveCapability"
  | "execute"
  | "onLedgerSnapshot"
  | "onTimelineEntries"
> & {
  confirmationReceiptId: string;
  projectFactHash?: string;
  retry?: boolean;
  perform?: (context: AgentVideoExecutionContext) => unknown | Promise<unknown>;
};

export type AgentVideoExecutionControllerFooterInput = Omit<
  AgentVideoExecutionControllerRunInput,
  "executionMode" | "retry"
> & {
  timeoutMs: number;
  perform: (context: AgentVideoExecutionContext) => unknown | Promise<unknown>;
};

export interface AgentVideoExecutionController {
  runExecution: (input: AgentVideoExecutionControllerRunInput) => Promise<AgentVideoExecutionAdapterResult>;
  runFooterExecution: (input: AgentVideoExecutionControllerFooterInput) => Promise<AgentVideoExecutionAdapterResult>;
}

type ProductActionRunner = (
  target: AgentControlledToolInvocationTarget | undefined,
  signal: AbortSignal,
) => unknown | Promise<unknown>;

export interface AgentVideoConfirmedProductActionInput {
  controller: AgentVideoExecutionController;
  plan: AgentVideoPipelinePlan;
  action?: DirectorAgentActionEnvelope;
  userIntent: string;
  preparedHandoff?: DirectorAgentToolHandoff;
  projectFactHash?: string;
  retry?: boolean;
  productAdapter: Omit<
    MinimalAgentProductAdapterInput,
    "createReferences" | "submitVideo" | "queryVideo" | "runExport"
  >;
  references: { live: boolean; perform?: ProductActionRunner };
  video: { live: boolean; perform?: ProductActionRunner };
  videoQuery: { live: boolean; perform?: ProductActionRunner };
  exportProject: { live: boolean; perform?: ProductActionRunner };
}

export function normalizeAgentVideoExecutionProjectRoot(projectRoot?: string) {
  return projectRoot?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

export function agentVideoExecutionLedgerMatchesProject(
  ledger: AgentVideoGenerationJobLedger | undefined,
  identity: AgentVideoExecutionProjectIdentity,
) {
  return Boolean(
    ledger
      && ledger.projectId === identity.projectId
      && normalizeAgentVideoExecutionProjectRoot(ledger.projectRoot) === normalizeAgentVideoExecutionProjectRoot(identity.projectRoot)
      && ledger.projectFactHash === identity.projectFactHash,
  );
}

export function configuredAgentVideoLiveCapability(action: AgentVideoExecutionAction): AgentVideoLiveCapability {
  if (action === "prepare_references") {
    return {
      providerId: "apikey-fun-gpt55-responses-image",
      providerName: "Image2",
      modelId: "responses-image-reference",
      capability: "reference-image-generation",
    };
  }
  if (action === "submit_video") {
    return {
      providerId: "jimeng-seedance-cli",
      providerName: "Seedance",
      modelId: "seedance2.0",
      capability: "image-to-video",
    };
  }
  return {
    providerId: "local-exporter",
    providerName: "Local Project Exporter",
    modelId: "project-export-v1",
    capability: "export",
    asyncMode: "sync",
  };
}

function dryRunOutcomeLabel(action: AgentVideoExecutionAction) {
  if (action === "prepare_references") return "参考执行合同已验证；未生成真实参考。";
  if (action === "submit_video") return "视频执行合同已验证；未提交或生成真实视频。";
  return "导出执行合同已验证；未写入导出文件。";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function agentVideoExecutionToolResult(result: AgentVideoExecutionAdapterResult) {
  const rawResult = record(result.rawResult);
  if (result.receipt.status === "validated") {
    return {
      ok: true,
      status: "validated",
      uiStatus: "validated",
      message: dryRunOutcomeLabel(result.receipt.action),
      dryRunOnly: true,
      providerCalled: false,
      outputAssets: [],
      executionReceipt: result.receipt,
      jobId: result.job?.jobId,
      statusTrace: result.statusTrace,
    };
  }
  const status = typeof rawResult.status === "string" && rawResult.status.trim()
    ? rawResult.status.trim()
    : result.receipt.status;
  const message = typeof rawResult.message === "string" && rawResult.message.trim()
    ? rawResult.message.trim()
    : result.blockers[0];
  return {
    ...rawResult,
    status,
    message,
    dryRunOnly: false,
    providerCalled: result.providerCalled,
    outputAssets: result.receipt.outputAssets,
    executionReceipt: result.receipt,
    jobId: result.job?.jobId,
    statusTrace: result.statusTrace,
  };
}

export function agentVideoExecutionReceiptFromTimelineEntry(
  entry: VibeAgentTimelineEntry,
  identity?: AgentVideoExecutionProjectIdentity,
) {
  const restored = restoreAgentVideoExecutionReceipt(entry.details?.executionReceipt, identity);
  return restored.ok ? restored.receipt : undefined;
}

export function agentTimelineHasValidatedExecution(
  entries: VibeAgentTimelineEntry[],
  action: AgentVideoExecutionAction,
  identity: AgentVideoExecutionProjectIdentity,
) {
  return entries.some((entry) => {
    const receipt = agentVideoExecutionReceiptFromTimelineEntry(entry, identity);
    return receipt?.executionMode === "dry_run"
      && receipt.status === "validated"
      && receipt.action === action
      && receipt.outputAssets.length === 0
      && receipt.providerCalled === false;
  });
}

export function agentTimelineHasSucceededLiveExecution(
  entries: VibeAgentTimelineEntry[],
  action: AgentVideoExecutionAction,
  identity: AgentVideoExecutionProjectIdentity,
) {
  const expectedToolName = action === "prepare_references"
    ? "generate_references"
    : action === "submit_video"
      ? "submit_video"
      : "export_project";
  return entries.some((entry) => {
    const receipt = agentVideoExecutionReceiptFromTimelineEntry(entry, identity);
    if (receipt) {
      return receipt.executionMode === "live"
        && receipt.status === "succeeded"
        && receipt.action === action;
    }
    const details = record(entry.details);
    const projectId = typeof details.projectId === "string" ? details.projectId.trim() : "";
    const projectRoot = typeof details.projectRoot === "string" ? details.projectRoot.trim() : undefined;
    const sourceFactHash = typeof details.sourceFactHash === "string" ? details.sourceFactHash.trim() : "";
    return entry.toolName === expectedToolName
      && entry.status === "done"
      && entry.lifecycle === "succeeded"
      && details.directProductPhase === "completed"
      && projectId === identity.projectId
      && normalizeAgentVideoExecutionProjectRoot(projectRoot) === normalizeAgentVideoExecutionProjectRoot(identity.projectRoot)
      && sourceFactHash === identity.projectFactHash;
  });
}

export function agentTimelineLiveExecutionCoversProjectedState(
  entries: VibeAgentTimelineEntry[],
  action: AgentVideoExecutionAction,
  phase: "started" | "running" | "completed" | "failed" | "blocked",
  identity: AgentVideoExecutionProjectIdentity,
) {
  const receipt = [...entries]
    .reverse()
    .map((entry) => agentVideoExecutionReceiptFromTimelineEntry(entry, identity))
    .find((item) => item?.executionMode === "live" && item.action === action);
  if (!receipt) return false;
  if (phase === "started" || phase === "running") {
    return receipt.status === "running" || receipt.status === "timed_out" || receipt.status === "succeeded";
  }
  if (phase === "completed") return receipt.status === "succeeded";
  return receipt.status === "blocked" || receipt.status === "failed" || receipt.status === "cancelled" || receipt.status === "timed_out";
}

export function createAgentVideoExecutionController(
  dependencies: AgentVideoExecutionControllerDependencies,
): AgentVideoExecutionController {
  const inFlight = new Map<string, Promise<AgentVideoExecutionAdapterResult>>();

  function runExecution(input: AgentVideoExecutionControllerRunInput) {
    const generatedAt = input.generatedAt || new Date().toISOString();
    const baseActionId = input.actionId.trim() || `agent_video_${input.action}`;
    const currentIdentity = dependencies.getProjectIdentity();
    const executionIdentity = {
      ...currentIdentity,
      projectFactHash: input.projectFactHash?.trim() || currentIdentity.projectFactHash,
    };
    dependencies.setProjectIdentity(executionIdentity);
    const inFlightKey = [
      executionIdentity.projectId,
      executionIdentity.projectRoot || "",
      executionIdentity.projectFactHash,
      input.operation || "execute",
      baseActionId,
    ].join("::");
    const existing = inFlight.get(inFlightKey);
    if (existing) return existing;

    const execution = (async () => {
      let executionLedger = dependencies.getLedger();
      if (!agentVideoExecutionLedgerMatchesProject(executionLedger, executionIdentity)) {
        executionLedger = createAgentVideoGenerationJobLedger({
          ledgerId: executionLedger.ledgerId || "minimal_agent_video_dry_run",
          ...executionIdentity,
          createdAt: generatedAt,
        });
        dependencies.setLedger(executionLedger);
      }
      const previousJob = [...executionLedger.jobs]
        .reverse()
        .find((job) => job.actionId === baseActionId);
      const retryOfActionId = input.retry && previousJob && ["failed", "cancelled"].includes(previousJob.status)
        ? baseActionId
        : undefined;
      const actionId = retryOfActionId
        ? `${baseActionId}_retry_${generatedAt.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()}`
        : baseActionId;
      const {
        confirmationReceiptId,
        projectFactHash: _projectFactHash,
        retry: _retry,
        perform,
        ...executionInput
      } = input;
      const result = await runAgentVideoExecution({
        ...executionInput,
        generatedAt,
        ledger: executionLedger,
        actionId,
        retryOfActionId,
        sourceConfirmationId: confirmationReceiptId,
        liveExecutionAllowed: input.executionMode === "live",
        liveCapability: input.executionMode === "live"
          ? configuredAgentVideoLiveCapability(input.action)
          : undefined,
        execute: input.executionMode === "live" && perform
          ? (context) => perform(context)
          : undefined,
        onLedgerSnapshot: async (snapshot) => {
          const durablePersistenceAvailable = dependencies.canPersistLedger
            ? dependencies.canPersistLedger()
            : Boolean(dependencies.persistLedger);
          if (input.executionMode === "live" && !durablePersistenceAvailable) {
            throw new Error("Live execution requires project-backed generation job persistence.");
          }
          await dependencies.persistLedger?.(snapshot);
          dependencies.setLedger(snapshot);
        },
        onTimelineEntries: (entries) => dependencies.publishTimeline?.(entries, executionIdentity),
      });
      dependencies.setLedger(result.ledger);
      return result;
    })();
    inFlight.set(inFlightKey, execution);
    const clear = () => {
      if (inFlight.get(inFlightKey) === execution) inFlight.delete(inFlightKey);
    };
    void execution.then(clear, clear);
    return execution;
  }

  async function runFooterExecution(input: AgentVideoExecutionControllerFooterInput) {
    const previousJob = [...dependencies.getLedger().jobs]
      .reverse()
      .find((job) => job.actionId === input.actionId);
    const result = await runExecution({
      ...input,
      executionMode: "live",
      retry: Boolean(previousJob && ["failed", "cancelled"].includes(previousJob.status)),
    });
    const toolResult = agentVideoExecutionToolResult(result);
    const message = typeof toolResult.message === "string" && toolResult.message.trim()
      ? toolResult.message.trim()
      : result.status === "completed"
        ? "动作已完成。"
        : result.blockers[0] || "动作状态已记录。";
    dependencies.setStatus?.(message);
    return result;
  }

  return { runExecution, runFooterExecution };
}

export async function runAgentVideoConfirmedProductAction(
  input: AgentVideoConfirmedProductActionInput,
) {
  const actionId = input.action?.actionId
    || input.preparedHandoff?.actionId
    || "agent_video_execution_action";
  const confirmationReceiptId = input.preparedHandoff?.handoffId
    || input.action?.actionId
    || "agent_video_execution_confirmation";
  const runExecution = async (execution: {
    action: AgentVideoExecutionAction;
    operation?: AgentVideoExecutionOperation;
    live: boolean;
    timeoutMs: number;
    target?: AgentControlledToolInvocationTarget;
    runner?: ProductActionRunner;
  }) => agentVideoExecutionToolResult(await input.controller.runExecution({
    plan: input.plan,
    action: execution.action,
    operation: execution.operation,
    actionId,
    confirmationReceiptId: execution.target?.confirmationReceiptId || confirmationReceiptId,
    sourceTimelineId: input.preparedHandoff?.handoffId,
    executionMode: execution.live ? "live" : "dry_run",
    projectFactHash: input.projectFactHash,
    retry: input.retry,
    prompt: input.userIntent,
    timeoutMs: execution.timeoutMs,
    perform: execution.live && execution.runner
      ? (context) => execution.runner?.(execution.target, context.signal)
      : undefined,
  }));
  const productAdapter = buildMinimalAgentProductAdapter({
    ...input.productAdapter,
    createReferences: (target) => runExecution({
      action: "prepare_references",
      live: input.references.live,
      timeoutMs: 10 * 60 * 1000,
      target,
      runner: input.references.perform,
    }),
    submitVideo: (target) => runExecution({
      action: "submit_video",
      live: input.video.live,
      timeoutMs: 5 * 60 * 1000,
      target,
      runner: input.video.perform,
    }),
    queryVideo: (target) => runExecution({
      action: "submit_video",
      operation: "query",
      live: input.videoQuery.live,
      timeoutMs: 5 * 60 * 1000,
      target,
      runner: input.videoQuery.perform,
    }),
    runExport: (target) => runExecution({
      action: "export",
      live: input.exportProject.live,
      timeoutMs: 2 * 60 * 1000,
      target,
      runner: input.exportProject.perform,
    }),
  });
  return productAdapter.runConfirmedAction({
    action: input.action,
    userIntent: input.userIntent,
    preparedHandoff: input.preparedHandoff,
  });
}

export type { AgentVideoExecutionAction, AgentVideoExecutionContext, AgentVideoExecutionOperation };
