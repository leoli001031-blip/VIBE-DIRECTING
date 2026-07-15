import type { VibeAgentTimelineEntry } from "../agent-core/types";
import {
  restoreExportDeliveryReceipt,
  type ExportDeliveryReceipt,
} from "./exportDeliveryGate";
import {
  AGENT_VIDEO_PROVIDER_REGISTRY_SCHEMA_VERSION,
  planAgentVideoProductionAction,
  recordAgentVideoGenerationJobExecution,
  transitionAgentVideoGenerationJob,
  type AgentVideoExecutionMode,
  type AgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
  type AgentVideoGenerationJobOperation,
  type AgentVideoGenerationJobStatus,
  type AgentVideoPipelineAction,
  type AgentVideoPipelinePlan,
  type AgentVideoProviderCapabilityKind,
  type AgentVideoProviderCapabilityRegistry,
} from "./agentVideoProductionContract";

export const AGENT_VIDEO_EXECUTION_RECEIPT_SCHEMA_VERSION = "agent_video_execution_receipt/0.1.0";

export type AgentVideoExecutionAction = Extract<AgentVideoPipelineAction, "prepare_references" | "submit_video" | "export">;
export type AgentVideoExecutionOperation = AgentVideoGenerationJobOperation;
export type AgentVideoExecutionReceiptStatus =
  | "validated"
  | "running"
  | "succeeded"
  | "blocked"
  | "failed"
  | "cancelled"
  | "timed_out";
export type AgentVideoExecutionAdapterStatus = "completed" | "running" | "blocked" | "failed" | "cancelled" | "timed_out";

export interface AgentVideoLiveCapability {
  providerId: string;
  providerName: string;
  modelId: string;
  capability?: AgentVideoProviderCapabilityKind;
  asyncMode?: "sync" | "async";
}

export interface AgentVideoExecutionReceipt {
  schemaVersion: typeof AGENT_VIDEO_EXECUTION_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  confirmationReceiptId: string;
  actionId: string;
  retryOfActionId?: string;
  jobId?: string;
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
  action: AgentVideoExecutionAction;
  operation: AgentVideoExecutionOperation;
  executionMode: AgentVideoExecutionMode;
  status: AgentVideoExecutionReceiptStatus;
  providerId?: string;
  modelId?: string;
  providerCalled: boolean;
  liveSubmitAllowed: boolean;
  externalTaskId?: string;
  outputAssets: string[];
  deliveryReceipt?: ExportDeliveryReceipt;
  timeoutMs?: number;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  errors: string[];
}

export type AgentVideoExecutionReceiptRestoreStatus =
  | "restored"
  | "project_mismatch"
  | "root_mismatch"
  | "fact_hash_mismatch"
  | "invalid";

export interface AgentVideoExecutionReceiptRestoreResult {
  ok: boolean;
  status: AgentVideoExecutionReceiptRestoreStatus;
  receipt?: AgentVideoExecutionReceipt;
  errors: string[];
}

const executionReceiptActions = new Set<AgentVideoExecutionAction>(["prepare_references", "submit_video", "export"]);
const executionReceiptOperations = new Set<AgentVideoExecutionOperation>(["execute", "query"]);
const executionReceiptStatuses = new Set<AgentVideoExecutionReceiptStatus>([
  "validated",
  "running",
  "succeeded",
  "blocked",
  "failed",
  "cancelled",
  "timed_out",
]);

export function restoreAgentVideoExecutionReceipt(
  value: unknown,
  identity?: { projectId: string; projectRoot?: string; projectFactHash: string },
): AgentVideoExecutionReceiptRestoreResult {
  const candidate = record(value);
  if (!candidate) return { ok: false, status: "invalid", errors: ["Execution receipt must be an object."] };
  const errors: string[] = [];
  if (candidate.schemaVersion !== AGENT_VIDEO_EXECUTION_RECEIPT_SCHEMA_VERSION) errors.push("Unsupported execution receipt schema.");
  for (const key of ["receiptId", "confirmationReceiptId", "actionId", "projectId", "projectRoot", "projectFactHash", "createdAt", "updatedAt"] as const) {
    if (!text(candidate[key])) errors.push(`Execution receipt is missing ${key}.`);
  }
  if (!executionReceiptActions.has(candidate.action as AgentVideoExecutionAction)) errors.push("Execution receipt action is invalid.");
  if (!executionReceiptOperations.has(candidate.operation as AgentVideoExecutionOperation)) errors.push("Execution receipt operation is invalid.");
  if (candidate.executionMode !== "dry_run" && candidate.executionMode !== "live") errors.push("Execution receipt mode is invalid.");
  if (!executionReceiptStatuses.has(candidate.status as AgentVideoExecutionReceiptStatus)) errors.push("Execution receipt status is invalid.");
  if (typeof candidate.providerCalled !== "boolean") errors.push("Execution receipt providerCalled must be a boolean.");
  if (typeof candidate.liveSubmitAllowed !== "boolean") errors.push("Execution receipt liveSubmitAllowed must be a boolean.");
  if (!Array.isArray(candidate.outputAssets) || candidate.outputAssets.some((item) => typeof item !== "string")) {
    errors.push("Execution receipt outputAssets must be a string array.");
  }
  if (!Array.isArray(candidate.errors) || candidate.errors.some((item) => typeof item !== "string")) {
    errors.push("Execution receipt errors must be a string array.");
  }
  if (!Number.isInteger(candidate.attempt) || Number(candidate.attempt) < 1) errors.push("Execution receipt attempt must be a positive integer.");
  if (!validReceiptDate(candidate.createdAt) || !validReceiptDate(candidate.updatedAt)) errors.push("Execution receipt timestamps are invalid.");
  if (
    validReceiptDate(candidate.createdAt)
    && validReceiptDate(candidate.updatedAt)
    && Date.parse(text(candidate.updatedAt)!) < Date.parse(text(candidate.createdAt)!)
  ) errors.push("Execution receipt updatedAt cannot precede createdAt.");
  if (
    candidate.executionMode === "dry_run"
    && (candidate.providerCalled === true || candidate.liveSubmitAllowed === true || (Array.isArray(candidate.outputAssets) && candidate.outputAssets.length > 0))
  ) {
    errors.push("Dry-run execution receipts cannot claim provider calls, live submission, or output assets.");
  }
  const deliveryReceiptRestore = candidate.deliveryReceipt === undefined
    ? undefined
    : restoreExportDeliveryReceipt(candidate.deliveryReceipt);
  if (deliveryReceiptRestore && (!deliveryReceiptRestore.ok || !deliveryReceiptRestore.receipt)) {
    errors.push(`Execution receipt deliveryReceipt is invalid: ${deliveryReceiptRestore.errors.join(" ")}`);
  }
  if (candidate.action === "export" && candidate.executionMode === "live" && candidate.status === "succeeded") {
    const deliveryReceipt = deliveryReceiptRestore?.receipt;
    if (!deliveryReceipt) {
      errors.push("Succeeded live export execution requires a valid deliveryReceipt.");
    } else {
      if (deliveryReceipt.projectId !== candidate.projectId) errors.push("Delivery receipt projectId does not match execution receipt.");
      if (normalizeReceiptProjectRoot(deliveryReceipt.projectRoot) !== normalizeReceiptProjectRoot(text(candidate.projectRoot))) errors.push("Delivery receipt projectRoot does not match execution receipt.");
      if (deliveryReceipt.projectFactHash !== candidate.projectFactHash) errors.push("Delivery receipt projectFactHash does not match execution receipt.");
      if (deliveryReceipt.actionId !== candidate.actionId) errors.push("Delivery receipt actionId does not match execution receipt.");
      if (deliveryReceipt.confirmationId !== candidate.confirmationReceiptId) errors.push("Delivery receipt confirmationId does not match execution receipt.");
      if (deliveryReceipt.executionMode !== "live" || deliveryReceipt.status !== "succeeded") errors.push("Succeeded live export requires a succeeded live delivery receipt.");
    }
  }
  if (errors.length) return { ok: false, status: "invalid", errors };
  const executionReceipt = candidate as unknown as AgentVideoExecutionReceipt;
  if (identity) {
    if (executionReceipt.projectId !== identity.projectId) {
      return { ok: false, status: "project_mismatch", receipt: executionReceipt, errors: ["Execution receipt belongs to another project."] };
    }
    if (normalizeReceiptProjectRoot(executionReceipt.projectRoot) !== normalizeReceiptProjectRoot(identity.projectRoot)) {
      return { ok: false, status: "root_mismatch", receipt: executionReceipt, errors: ["Execution receipt belongs to another project root."] };
    }
    if (executionReceipt.projectFactHash !== identity.projectFactHash) {
      return { ok: false, status: "fact_hash_mismatch", receipt: executionReceipt, errors: ["Execution receipt belongs to older project facts."] };
    }
  }
  return { ok: true, status: "restored", receipt: executionReceipt, errors: [] };
}

function normalizeReceiptProjectRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

function validReceiptDate(value: unknown) {
  const parsed = Date.parse(text(value) || "");
  return Number.isFinite(parsed);
}

export interface AgentVideoExecutionContext {
  action: AgentVideoExecutionAction;
  operation: AgentVideoExecutionOperation;
  job: AgentVideoGenerationJob;
  receipt: AgentVideoExecutionReceipt;
  signal: AbortSignal;
}

export interface RunAgentVideoExecutionInput {
  plan: AgentVideoPipelinePlan;
  ledger: AgentVideoGenerationJobLedger;
  action: AgentVideoExecutionAction;
  operation?: AgentVideoExecutionOperation;
  actionId: string;
  retryOfActionId?: string;
  sourceConfirmationId: string;
  sourceTimelineId?: string;
  executionMode: AgentVideoExecutionMode;
  liveExecutionAllowed?: boolean;
  liveCapability?: AgentVideoLiveCapability;
  registry?: AgentVideoProviderCapabilityRegistry;
  generatedAt?: string;
  prompt?: string;
  inputAssets?: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  execute?: (context: AgentVideoExecutionContext) => unknown | Promise<unknown>;
  onLedgerSnapshot?: (ledger: AgentVideoGenerationJobLedger) => void | Promise<void>;
  onTimelineEntries?: (entries: VibeAgentTimelineEntry[]) => void | Promise<void>;
}

export interface AgentVideoExecutionAdapterResult {
  status: AgentVideoExecutionAdapterStatus;
  dryRunOnly: boolean;
  liveSubmitAllowed: boolean;
  providerCalled: boolean;
  ledger: AgentVideoGenerationJobLedger;
  ledgerSnapshots: AgentVideoGenerationJobLedger[];
  job?: AgentVideoGenerationJob;
  receipt: AgentVideoExecutionReceipt;
  blockers: string[];
  statusTrace: AgentVideoGenerationJobStatus[];
  timelineEntries: VibeAgentTimelineEntry[];
  rawResult?: unknown;
}

const terminalJobStatuses = new Set<AgentVideoGenerationJobStatus>(["succeeded", "failed", "cancelled"]);

function compactId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

function timestamp(input?: string, offsetMs = 0) {
  const parsed = Date.parse(input || "");
  return new Date((Number.isFinite(parsed) ? parsed : Date.now()) + offsetMs).toISOString();
}

function actionCapability(action: AgentVideoExecutionAction): AgentVideoProviderCapabilityKind {
  if (action === "prepare_references") return "reference-image-generation";
  if (action === "submit_video") return "image-to-video";
  return "export";
}

function actionLabel(action: AgentVideoExecutionAction, operation: AgentVideoExecutionOperation) {
  if (operation === "query") return "查询视频结果";
  if (action === "prepare_references") return "补参考";
  if (action === "submit_video") return "发送视频";
  return "导出交付包";
}

function toolName(action: AgentVideoExecutionAction, operation: AgentVideoExecutionOperation): VibeAgentTimelineEntry["toolName"] {
  if (operation === "query") return "query_video";
  if (action === "prepare_references") return "generate_references";
  if (action === "submit_video") return "submit_video";
  return "export_project";
}

function actionKind(action: AgentVideoExecutionAction, operation: AgentVideoExecutionOperation): VibeAgentTimelineEntry["actionKind"] {
  if (operation === "query") return "query_video_result";
  if (action === "prepare_references") return "prepare_reference_generation";
  if (action === "submit_video") return "prepare_video_submit";
  return "prepare_export";
}

function liveRegistry(input: RunAgentVideoExecutionInput): AgentVideoProviderCapabilityRegistry | undefined {
  if (input.executionMode === "dry_run") return input.registry;
  const capability = input.liveCapability;
  if (!capability) return undefined;
  const capabilityKind = capability.capability || actionCapability(input.action);
  return {
    schemaVersion: AGENT_VIDEO_PROVIDER_REGISTRY_SCHEMA_VERSION,
    registryVersion: "agent-video-live-execution/0.1.0",
    generatedAt: input.generatedAt,
    capabilities: [{
      capabilityId: `${capability.providerId}:${capability.modelId}:${capabilityKind}:live`,
      providerId: capability.providerId,
      providerName: capability.providerName,
      modelId: capability.modelId,
      capability: capabilityKind,
      state: "active",
      dryRunOnly: false,
      liveSubmitAllowed: true,
      requiresReferences: input.action === "submit_video",
      requiresLocalProject: true,
      asyncMode: capability.asyncMode || "async",
      supportedResolutions: [],
      inputAssetTypes: input.action === "export" ? ["project"] : ["text", "reference_image"],
      outputAssetTypes: input.action === "prepare_references" ? ["reference_image"] : input.action === "submit_video" ? ["video"] : ["project"],
      notes: ["Live capability supplied by the confirmed UI execution boundary."],
    }],
    notes: ["This registry is valid only for one explicitly confirmed live execution."],
  };
}

function receipt(input: RunAgentVideoExecutionInput, status: AgentVideoExecutionReceiptStatus, generatedAt: string, job?: AgentVideoGenerationJob, errors: string[] = []): AgentVideoExecutionReceipt {
  return {
    schemaVersion: AGENT_VIDEO_EXECUTION_RECEIPT_SCHEMA_VERSION,
    receiptId: `agent_video_execution_receipt_${compactId(input.sourceConfirmationId || input.actionId)}`,
    confirmationReceiptId: input.sourceConfirmationId,
    actionId: input.actionId,
    retryOfActionId: input.retryOfActionId,
    jobId: job?.jobId,
    projectId: input.ledger.projectId,
    projectRoot: input.ledger.projectRoot,
    projectFactHash: input.ledger.projectFactHash,
    action: input.action,
    operation: input.operation || "execute",
    executionMode: input.executionMode,
    status,
    providerId: job?.providerId,
    modelId: job?.modelId,
    providerCalled: job?.providerCalled || false,
    liveSubmitAllowed: input.executionMode === "live" && input.liveExecutionAllowed === true,
    externalTaskId: job?.externalTaskId,
    outputAssets: [...(job?.outputAssets || [])],
    timeoutMs: input.timeoutMs,
    attempt: input.retryOfActionId ? 2 : 1,
    createdAt: generatedAt,
    updatedAt: job?.updatedAt || generatedAt,
    errors,
  };
}

function timelineEntry(input: {
  executionInput: RunAgentVideoExecutionInput;
  receipt: AgentVideoExecutionReceipt;
  createdAt: string;
  phase: "started" | "result";
}): VibeAgentTimelineEntry {
  const executionReceipt = input.receipt;
  const label = actionLabel(executionReceipt.action, executionReceipt.operation);
  const dryRun = executionReceipt.executionMode === "dry_run";
  const blocked = ["blocked", "failed", "cancelled", "timed_out"].includes(executionReceipt.status);
  const running = executionReceipt.status === "running";
  const title = input.phase === "started"
    ? `${dryRun ? "本地验证" : "执行"}：${label}`
    : executionReceipt.status === "validated"
      ? `本地验证完成：${label}`
      : running
        ? `${label}正在处理`
        : blocked
          ? `${label}未完成`
          : `${label}已完成`;
  const body = input.phase === "started"
    ? dryRun
      ? `确认边界已通过，正在验证「${label}」的执行合同；不会调用真实 provider，也不会生成真实产物。`
      : `确认边界已通过，正在执行「${label}」。任务状态会写入当前项目。`
    : executionReceipt.status === "validated"
      ? `「${label}」的执行合同验证通过；没有调用真实 provider，也没有生成参考、视频或导出文件。`
      : executionReceipt.status === "running"
        ? `「${label}」已进入执行中状态；只有真实结果返回后才会记录产物。`
        : executionReceipt.status === "succeeded"
          ? `「${label}」已完成${executionReceipt.outputAssets.length ? "，真实返回路径已记录。" : "；执行结果未声明产物路径。"}`
          : executionReceipt.status === "cancelled"
            ? `「${label}」已取消；没有把取消状态写成成功结果。`
            : executionReceipt.status === "timed_out"
              ? `等待「${label}」超时；任务保持可恢复，不会假定已经成功。`
              : `「${label}」未完成：${executionReceipt.errors[0] || "执行被阻断"}。`;
  return {
    id: `agent_video_execution_${input.phase}_${compactId(input.createdAt)}_${compactId(executionReceipt.jobId || executionReceipt.receiptId)}`,
    type: input.phase === "started" ? "tool_call" : running ? "state_change" : "tool_result",
    createdAt: input.createdAt,
    title,
    body,
    lifecycle: input.phase === "started" || running ? "running" : blocked ? executionReceipt.status === "cancelled" ? "cancelled" : "failed" : "succeeded",
    status: input.phase === "started" || running ? "waiting" : blocked ? "blocked" : "done",
    toolName: toolName(executionReceipt.action, executionReceipt.operation),
    actionKind: actionKind(executionReceipt.action, executionReceipt.operation),
    actionId: executionReceipt.actionId,
    confirmationToken: executionReceipt.confirmationReceiptId,
    facts: [
      { label: "任务", value: executionReceipt.jobId || "未创建" },
      { label: "方式", value: dryRun ? "本地合同验证" : "真实执行" },
      { label: "Provider", value: executionReceipt.providerCalled ? "已调用" : "未调用" },
      ...(input.phase === "result" ? [{ label: "真实产物", value: `${executionReceipt.outputAssets.length} 项` }] : []),
    ],
    details: {
      dryRun,
      executionReceipt,
      jobId: executionReceipt.jobId,
      sourceConfirmationId: executionReceipt.confirmationReceiptId,
      sourceFactHash: executionReceipt.projectFactHash,
      outputAssets: executionReceipt.outputAssets,
      next: executionReceipt.status === "validated"
        ? "可继续验证下一条执行边界；真实项目状态没有被伪造。"
        : executionReceipt.status === "running"
          ? "等待或查询真实任务结果。"
          : blocked
            ? "处理阻断后由用户明确重试。"
            : "按真实项目状态继续下一步。",
    },
  };
}

function statusTrace(job?: AgentVideoGenerationJob) {
  return job?.statusHistory?.map((item) => item.status) || [];
}

function blockedResult(input: RunAgentVideoExecutionInput, status: "blocked" | "cancelled", blockers: string[], generatedAt: string): AgentVideoExecutionAdapterResult {
  const executionReceipt = receipt(input, status, generatedAt, undefined, blockers);
  const resultEntry = timelineEntry({ executionInput: input, receipt: executionReceipt, createdAt: generatedAt, phase: "result" });
  return {
    status,
    dryRunOnly: input.executionMode === "dry_run",
    liveSubmitAllowed: false,
    providerCalled: false,
    ledger: input.ledger,
    ledgerSnapshots: [],
    receipt: executionReceipt,
    blockers,
    statusTrace: [],
    timelineEntries: [resultEntry],
  };
}

function ledgerPersistenceFailureResult(input: {
  executionInput: RunAgentVideoExecutionInput;
  ledger: AgentVideoGenerationJobLedger;
  snapshots: AgentVideoGenerationJobLedger[];
  timelineEntries: VibeAgentTimelineEntry[];
  generatedAt: string;
  jobId?: string;
  error: unknown;
  providerMayHaveRun: boolean;
  providerCalled?: boolean;
  rawResult?: unknown;
}): AgentVideoExecutionAdapterResult {
  const message = input.error instanceof Error ? input.error.message : String(input.error || "Unknown persistence error.");
  const blocker = input.providerMayHaveRun
    ? `Execution returned, but the generation job ledger could not persist the result: ${message}`
    : `Execution was blocked because the generation job ledger could not be persisted: ${message}`;
  const job = input.jobId ? input.ledger.jobs.find((item) => item.jobId === input.jobId) : undefined;
  const status = input.providerMayHaveRun ? "failed" : "blocked";
  const executionReceipt = receipt(input.executionInput, status, input.generatedAt, job, [blocker]);
  executionReceipt.providerCalled = input.providerCalled === true || job?.providerCalled === true;
  executionReceipt.outputAssets = [];
  const resultEntry = timelineEntry({
    executionInput: input.executionInput,
    receipt: executionReceipt,
    createdAt: timestamp(),
    phase: "result",
  });
  return {
    status,
    dryRunOnly: input.executionInput.executionMode === "dry_run",
    liveSubmitAllowed: input.providerMayHaveRun && input.executionInput.executionMode === "live",
    providerCalled: executionReceipt.providerCalled,
    ledger: input.ledger,
    ledgerSnapshots: input.snapshots,
    job,
    receipt: executionReceipt,
    blockers: [blocker],
    statusTrace: statusTrace(job),
    timelineEntries: [...input.timelineEntries, resultEntry],
    rawResult: input.rawResult,
  };
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function liveResultStatus(value: unknown): Exclude<AgentVideoExecutionReceiptStatus, "validated"> {
  const result = record(value);
  const statusText = [result?.status, result?.uiStatus, result?.message].map((item) => String(item || "").toLowerCase()).join(" ");
  if (/cancelled|canceled|已取消/.test(statusText)) return "cancelled";
  if (/timed_out|timeout|timed out|超时/.test(statusText)) return "timed_out";
  if (result?.ok === false || /blocked|missing|failed|error|失败|阻断/.test(statusText) || array(result?.blockers).length) return "blocked";
  if (/submitted|queued|running|generating|polling|in_progress|处理中|排队/.test(statusText)) return "running";
  if (/needs_review|verified|ready|completed|success|succeeded|已生成|已完成/.test(statusText)) return "succeeded";
  if (extractOutputAssets(value).length) return "succeeded";
  return "running";
}

function outputPath(value: unknown) {
  const path = text(value);
  if (!path) return undefined;
  return /\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|mp4|mov|m4v|webm|json|md|txt)(?:[?#].*)?$/i.test(path) ? path : undefined;
}

function extractOutputAssets(value: unknown) {
  const result = record(value);
  if (!result) return [];
  const assets = array(result.assets).map(record).filter(Boolean);
  const relayQueue = record(result.relayQueue);
  const relayItems = array(relayQueue?.items).map(record).filter(Boolean);
  return Array.from(new Set([
    outputPath(result.outputPath),
    outputPath(result.outputVideoPath),
    outputPath(result.manifestPath),
    ...array(result.outputAssets).map(text),
    ...assets.flatMap((asset) => [outputPath(asset?.path), outputPath(asset?.imageUrl)]),
    ...relayItems.flatMap((item) => [outputPath(item?.outputVideoPath), ...array(item?.localMediaPaths).map(outputPath)]),
  ].filter((item): item is string => Boolean(item))));
}

function externalTaskId(value: unknown) {
  const result = record(value);
  const relayQueue = record(result?.relayQueue);
  const firstRelayItem = array(relayQueue?.items).map(record).find(Boolean);
  return text(result?.externalTaskId)
    || text(result?.submitId)
    || text(result?.taskId)
    || text(firstRelayItem?.externalTaskId)
    || text(firstRelayItem?.submitId);
}

function resultError(value: unknown, fallback: string) {
  const result = record(value);
  return text(result?.message) || array(result?.blockers).map(text).find(Boolean) || fallback;
}

function providerCalledForResult(action: AgentVideoExecutionAction, value: unknown) {
  const result = record(value);
  if (typeof result?.providerCalled === "boolean") return result.providerCalled;
  if (action === "export") return false;
  return false;
}

function executionError(message: string, kind: "timeout" | "cancelled" | "failed") {
  return Object.assign(new Error(message), { executionErrorKind: kind });
}

async function executeWithBoundary(input: RunAgentVideoExecutionInput, context: AgentVideoExecutionContext) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) controller.abort(input.signal.reason);
  else input.signal?.addEventListener("abort", abortFromParent, { once: true });
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const execution = Promise.resolve(input.execute?.({ ...context, signal: controller.signal }));
    const cancellation = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(executionError("Execution cancelled.", timedOut ? "timeout" : "cancelled")), { once: true });
    });
    const timeout = input.timeoutMs && input.timeoutMs > 0
      ? new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(executionError("Execution timed out.", "timeout"));
          }, input.timeoutMs);
        })
      : undefined;
    try {
      return await Promise.race([execution, cancellation, ...(timeout ? [timeout] : [])]);
    } catch (error) {
      if (timedOut) throw executionError("Execution timed out.", "timeout");
      if (controller.signal.aborted) throw executionError("Execution cancelled.", "cancelled");
      throw error;
    }
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    input.signal?.removeEventListener("abort", abortFromParent);
  }
}

async function persistSnapshot(input: RunAgentVideoExecutionInput, ledger: AgentVideoGenerationJobLedger, snapshots: AgentVideoGenerationJobLedger[]) {
  await input.onLedgerSnapshot?.(ledger);
  snapshots.push(ledger);
}

async function rememberTimeline(input: RunAgentVideoExecutionInput, entries: VibeAgentTimelineEntry[], allEntries: VibeAgentTimelineEntry[]) {
  allEntries.push(...entries);
  await input.onTimelineEntries?.(entries);
}

export async function runAgentVideoExecution(input: RunAgentVideoExecutionInput): Promise<AgentVideoExecutionAdapterResult> {
  const generatedAt = timestamp(input.generatedAt);
  const confirmationId = input.sourceConfirmationId.trim();
  const actionId = input.actionId.trim();
  if (!confirmationId) return blockedResult(input, "blocked", ["An execution requires an explicit confirmation receipt."], generatedAt);
  if (!actionId) return blockedResult(input, "blocked", ["An execution requires an Agent action id."], generatedAt);
  if (input.signal?.aborted) return blockedResult(input, "cancelled", ["Execution was cancelled before it started."], generatedAt);
  if (input.executionMode === "live") {
    if (input.liveExecutionAllowed !== true) return blockedResult(input, "blocked", ["Live execution was not explicitly allowed."], generatedAt);
    if (!input.liveCapability) return blockedResult(input, "blocked", ["Live execution requires an explicit provider capability."], generatedAt);
    if (!input.execute) return blockedResult(input, "blocked", ["Live execution has no executor."], generatedAt);
    if (!input.onLedgerSnapshot) return blockedResult(input, "blocked", ["Live execution requires durable generation job persistence."], generatedAt);
  }

  const staged = planAgentVideoProductionAction({
    plan: input.plan,
    ledger: input.ledger,
    action: input.action,
    operation: input.operation || "execute",
    actionId,
    executionMode: input.executionMode,
    generatedAt,
    sourceConfirmationId: confirmationId,
    sourceTimelineId: input.sourceTimelineId,
    prompt: input.prompt,
    inputAssets: input.inputAssets,
    outputAssets: [],
    registry: liveRegistry(input),
  });
  if (staged.status !== "staged_job" || !staged.job) {
    const blocked = blockedResult(input, "blocked", staged.blockers, generatedAt);
    return { ...blocked, ledger: staged.ledger };
  }

  const snapshots: AgentVideoGenerationJobLedger[] = [];
  const timelineEntries: VibeAgentTimelineEntry[] = [];
  let durableLedger = input.ledger;
  let ledger = staged.ledger;
  let job = staged.job;
  async function persistCurrentSnapshot(providerMayHaveRun = false, providerCalled = false, rawResult?: unknown) {
    try {
      await persistSnapshot(input, ledger, snapshots);
      durableLedger = ledger;
      return undefined;
    } catch (error) {
      return ledgerPersistenceFailureResult({
        executionInput: input,
        ledger: durableLedger,
        snapshots,
        timelineEntries,
        generatedAt,
        jobId: job.jobId,
        error,
        providerMayHaveRun,
        providerCalled,
        rawResult,
      });
    }
  }
  if (job.executionMode !== input.executionMode) {
    return blockedResult(input, "blocked", ["Existing job execution mode does not match this request."], generatedAt);
  }
  if (job.operation !== (input.operation || "execute")) {
    return blockedResult(input, "blocked", ["Existing job operation does not match this request."], generatedAt);
  }
  if (terminalJobStatuses.has(job.status)) {
    return blockedResult(input, "blocked", [`Agent action already has a terminal job: ${job.jobId}.`], generatedAt);
  }
  let persistenceFailure = await persistCurrentSnapshot();
  if (persistenceFailure) return persistenceFailure;

  if (job.status === "running" && job.operation !== "query") {
    const runningReceipt = receipt(input, "running", generatedAt, job);
    return {
      status: "running",
      dryRunOnly: input.executionMode === "dry_run",
      liveSubmitAllowed: input.executionMode === "live",
      providerCalled: job.providerCalled,
      ledger,
      ledgerSnapshots: snapshots,
      job,
      receipt: runningReceipt,
      blockers: [],
      statusTrace: statusTrace(job),
      timelineEntries,
    };
  }

  if (job.status === "staged") {
    const confirmed = transitionAgentVideoGenerationJob({
      ledger,
      jobId: job.jobId,
      status: "confirmed",
      generatedAt: timestamp(generatedAt, 1),
    });
    if (!confirmed.ok || !confirmed.job) return blockedResult(input, "blocked", confirmed.blockers, generatedAt);
    ledger = confirmed.ledger;
    job = confirmed.job;
    persistenceFailure = await persistCurrentSnapshot();
    if (persistenceFailure) return persistenceFailure;
  }

  if (job.status === "confirmed") {
    const running = transitionAgentVideoGenerationJob({
      ledger,
      jobId: job.jobId,
      status: "running",
      generatedAt: timestamp(generatedAt, 2),
    });
    if (!running.ok || !running.job) return blockedResult(input, "blocked", running.blockers, generatedAt);
    ledger = running.ledger;
    job = running.job;
    persistenceFailure = await persistCurrentSnapshot();
    if (persistenceFailure) return persistenceFailure;
  }

  const runningReceipt = receipt(input, "running", generatedAt, job);
  await rememberTimeline(input, [timelineEntry({ executionInput: input, receipt: runningReceipt, createdAt: generatedAt, phase: "started" })], timelineEntries);

  if (input.executionMode === "dry_run") {
    const succeeded = transitionAgentVideoGenerationJob({
      ledger,
      jobId: job.jobId,
      status: "succeeded",
      generatedAt: timestamp(generatedAt, 3),
      providerCalled: false,
      outputAssets: [],
    });
    if (!succeeded.ok || !succeeded.job) return blockedResult(input, "blocked", succeeded.blockers, generatedAt);
    ledger = succeeded.ledger;
    job = succeeded.job;
    persistenceFailure = await persistCurrentSnapshot();
    if (persistenceFailure) return persistenceFailure;
    const validatedReceipt = receipt(input, "validated", generatedAt, job);
    await rememberTimeline(input, [timelineEntry({ executionInput: input, receipt: validatedReceipt, createdAt: job.updatedAt, phase: "result" })], timelineEntries);
    return {
      status: "completed",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerCalled: false,
      ledger,
      ledgerSnapshots: snapshots,
      job,
      receipt: validatedReceipt,
      blockers: [],
      statusTrace: statusTrace(job),
      timelineEntries,
    };
  }

  let rawResult: unknown;
  try {
    rawResult = await executeWithBoundary(input, {
      action: input.action,
      operation: input.operation || "execute",
      job,
      receipt: runningReceipt,
      signal: new AbortController().signal,
    });
  } catch (error) {
    const executionErrorKind = record(error)?.executionErrorKind;
    const providerCalled = record(error)?.providerCalled === true;
    const message = error instanceof Error ? error.message : "Execution failed.";
    if (executionErrorKind === "timeout") {
      const recorded = recordAgentVideoGenerationJobExecution({
        ledger,
        jobId: job.jobId,
        generatedAt: timestamp(),
        providerCalled,
        error: message,
      });
      if (recorded.ok && recorded.job) {
        ledger = recorded.ledger;
        job = recorded.job;
        persistenceFailure = await persistCurrentSnapshot(true, providerCalled);
        if (persistenceFailure) return persistenceFailure;
      }
      const timedOutReceipt = receipt(input, "timed_out", generatedAt, job, [message]);
      await rememberTimeline(input, [timelineEntry({ executionInput: input, receipt: timedOutReceipt, createdAt: timedOutReceipt.updatedAt, phase: "result" })], timelineEntries);
      return {
        status: "timed_out",
        dryRunOnly: false,
        liveSubmitAllowed: true,
        providerCalled,
        ledger,
        ledgerSnapshots: snapshots,
        job,
        receipt: timedOutReceipt,
        blockers: [message],
        statusTrace: statusTrace(job),
        timelineEntries,
      };
    }
    const cancelled = executionErrorKind === "cancelled" || input.signal?.aborted;
    const transitioned = transitionAgentVideoGenerationJob({
      ledger,
      jobId: job.jobId,
      status: cancelled ? "cancelled" : "failed",
      generatedAt: timestamp(),
      providerCalled,
      error: message,
    });
    if (transitioned.ok && transitioned.job) {
      ledger = transitioned.ledger;
      job = transitioned.job;
      persistenceFailure = await persistCurrentSnapshot(true, providerCalled);
      if (persistenceFailure) return persistenceFailure;
    }
    const failureStatus = cancelled ? "cancelled" : "failed";
    const failureReceipt = receipt(input, failureStatus, generatedAt, job, [message]);
    await rememberTimeline(input, [timelineEntry({ executionInput: input, receipt: failureReceipt, createdAt: failureReceipt.updatedAt, phase: "result" })], timelineEntries);
    return {
      status: failureStatus,
      dryRunOnly: false,
      liveSubmitAllowed: true,
      providerCalled,
      ledger,
      ledgerSnapshots: snapshots,
      job,
      receipt: failureReceipt,
      blockers: [message],
      statusTrace: statusTrace(job),
      timelineEntries,
      rawResult,
    };
  }

  let resultStatus = liveResultStatus(rawResult);
  const providerCalled = providerCalledForResult(input.action, rawResult);
  let outputAssets = extractOutputAssets(rawResult);
  const taskId = externalTaskId(rawResult);
  let error = ["blocked", "failed"].includes(resultStatus) ? resultError(rawResult, "Execution was blocked.") : undefined;
  let deliveryReceipt: ExportDeliveryReceipt | undefined;
  if (input.action === "export" && resultStatus === "succeeded") {
    const restored = restoreExportDeliveryReceipt(record(rawResult)?.deliveryReceipt);
    deliveryReceipt = restored.receipt;
    const receiptOutputAssets = deliveryReceipt?.outputs.map((output) => output.path).sort() || [];
    const declaredOutputAssets = [...outputAssets].sort();
    const deliveryErrors = [
      restored.ok && deliveryReceipt ? "" : `invalid receipt: ${restored.errors.join(" ")}`,
      deliveryReceipt?.projectId === input.ledger.projectId ? "" : "projectId mismatch",
      normalizeReceiptProjectRoot(deliveryReceipt?.projectRoot) === normalizeReceiptProjectRoot(input.ledger.projectRoot) ? "" : "projectRoot mismatch",
      deliveryReceipt?.projectFactHash === input.ledger.projectFactHash ? "" : "projectFactHash mismatch",
      deliveryReceipt?.actionId === input.actionId ? "" : "actionId mismatch",
      deliveryReceipt?.confirmationId === input.sourceConfirmationId ? "" : "confirmationId mismatch",
      deliveryReceipt?.executionMode === "live" && deliveryReceipt.status === "succeeded" ? "" : "execution mode or status mismatch",
      JSON.stringify(receiptOutputAssets) === JSON.stringify(declaredOutputAssets) ? "" : "output list mismatch",
    ].filter(Boolean);
    if (deliveryErrors.length) {
      resultStatus = "failed";
      error = `[delivery_receipt_invalid] Export execution did not return a current complete delivery receipt: ${deliveryErrors.join("; ")}`;
      outputAssets = [];
      deliveryReceipt = undefined;
    }
  }

  if (resultStatus === "running" || resultStatus === "timed_out") {
    const recorded = recordAgentVideoGenerationJobExecution({
      ledger,
      jobId: job.jobId,
      generatedAt: timestamp(),
      providerCalled,
      externalTaskId: taskId,
      outputAssets,
      error,
    });
    if (recorded.ok && recorded.job) {
      ledger = recorded.ledger;
      job = recorded.job;
      persistenceFailure = await persistCurrentSnapshot(true, providerCalled, rawResult);
      if (persistenceFailure) return persistenceFailure;
    }
  } else {
    const transitioned = transitionAgentVideoGenerationJob({
      ledger,
      jobId: job.jobId,
      status: resultStatus === "succeeded" ? "succeeded" : resultStatus === "cancelled" ? "cancelled" : "failed",
      generatedAt: timestamp(),
      providerCalled,
      externalTaskId: taskId,
      outputAssets,
      error,
    });
    if (transitioned.ok && transitioned.job) {
      ledger = transitioned.ledger;
      job = transitioned.job;
      persistenceFailure = await persistCurrentSnapshot(true, providerCalled, rawResult);
      if (persistenceFailure) return persistenceFailure;
    }
  }

  const finalReceipt = receipt(input, resultStatus, generatedAt, job, error ? [error] : []);
  if (deliveryReceipt) finalReceipt.deliveryReceipt = deliveryReceipt;
  await rememberTimeline(input, [timelineEntry({ executionInput: input, receipt: finalReceipt, createdAt: finalReceipt.updatedAt, phase: "result" })], timelineEntries);
  const adapterStatus: AgentVideoExecutionAdapterStatus = resultStatus === "succeeded"
    ? "completed"
    : resultStatus === "running"
      ? "running"
      : resultStatus;
  return {
    status: adapterStatus,
    dryRunOnly: false,
    liveSubmitAllowed: true,
    providerCalled,
    ledger,
    ledgerSnapshots: snapshots,
    job,
    receipt: finalReceipt,
    blockers: error ? [error] : [],
    statusTrace: statusTrace(job),
    timelineEntries,
    rawResult,
  };
}
