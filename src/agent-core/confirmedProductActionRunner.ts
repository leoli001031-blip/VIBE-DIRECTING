import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import type {
  DirectorAgentToolHandoff,
  DirectorAgentToolHandler,
} from "../core/directorAgentToolHandoff";
import { isDirectorAgentReferenceGenerationHandler } from "../core/directorAgentToolHandoff";
import { buildDirectorAgentToolTrace, type DirectorAgentToolTrace } from "../core/directorAgentToolTrace";
import { executeRegisteredVibeAgentAction } from "./actionExecutor";
import {
  exportToolOutcome,
  referenceGenerationToolOutcome,
  type VibeAgentConfirmedToolRunOutcome,
  videoSubmitToolOutcome,
} from "./confirmedActionOutcome";
import { buildVibeAgentProductExecutionHandlers } from "./productExecutionAdapter";
import type { VibeAgentPermissionMode } from "./types";

export type VibeAgentReferenceAssetType = "character" | "scene" | "prop" | "storyboard";

export interface VibeAgentProductToolInvocationTarget<TVideoPermissionContract = unknown> {
  scope?: "project" | "selected_shots";
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  assetTypes?: VibeAgentReferenceAssetType[];
  skipConfirm?: boolean;
  confirmationReceiptId?: string;
  confirmedAt?: string;
  signal?: AbortSignal;
  videoPermissionContract?: TVideoPermissionContract;
  agentToolTrace?: DirectorAgentToolTrace;
}

export interface VibeAgentConfirmedProductActionRunnerInput<
  TVideoPermissionContract = unknown,
  TWebSearchSettings = unknown,
  TWebSearchResult = unknown,
> {
  action: DirectorAgentActionEnvelope;
  userIntent: string;
  preparedHandoff?: DirectorAgentToolHandoff;
  buildHandoff: (action: DirectorAgentActionEnvelope) => DirectorAgentToolHandoff | undefined;
  bindingIssue: (action: DirectorAgentActionEnvelope, handoff: DirectorAgentToolHandoff) => string | undefined;
  blockedStatusLabel: (handoff: DirectorAgentToolHandoff) => string;
  resultLabel: (handoff: DirectorAgentToolHandoff) => string;
  referenceAssetTypesForAction: (
    action: DirectorAgentActionEnvelope | undefined,
    userIntent: string,
  ) => VibeAgentReferenceAssetType[] | undefined;
  recoveryHint?: string;
  videoPermissionContract?: TVideoPermissionContract;
  webSearchSettings?: TWebSearchSettings;
  setStatus: (status: string) => void;
  setHandoff: (handoff: DirectorAgentToolHandoff) => void;
  setResearchStatus?: (status: "running" | "ready" | "blocked") => void;
  setReferenceStatus?: (status: "idle") => void;
  setResearchResult?: (result: TWebSearchResult | undefined) => void;
  buildResearchQuery?: (userIntent: string) => string;
  runWebSearch?: (input: {
    query: string;
    purpose: "style_research";
    settings?: TWebSearchSettings;
    agentToolTrace: DirectorAgentToolTrace;
  }) => Promise<TWebSearchResult> | TWebSearchResult;
	createReferences?: (target?: VibeAgentProductToolInvocationTarget<TVideoPermissionContract>) => Promise<unknown> | unknown;
	submitVideo?: (target?: VibeAgentProductToolInvocationTarget<TVideoPermissionContract>) => Promise<unknown> | unknown;
	queryVideo?: (target?: VibeAgentProductToolInvocationTarget<TVideoPermissionContract>) => Promise<unknown> | unknown;
	runExport?: (target?: Pick<VibeAgentProductToolInvocationTarget<TVideoPermissionContract>, "agentToolTrace">) => Promise<unknown> | unknown;
}

export type VibeAgentRegisteredConfirmedProductActionInput<
  TVideoPermissionContract = unknown,
  TWebSearchSettings = unknown,
  TWebSearchResult = unknown,
> = Omit<
  VibeAgentConfirmedProductActionRunnerInput<TVideoPermissionContract, TWebSearchSettings, TWebSearchResult>,
  "action"
> & {
  action?: DirectorAgentActionEnvelope;
  permissionMode: VibeAgentPermissionMode;
  userConfirmed?: boolean;
};

export function vibeAgentPermissionModeForConfirmedAction(action: DirectorAgentActionEnvelope): VibeAgentPermissionMode {
	  if (action.kind === "prepare_reference_generation") return "reference_allowed";
	  if (action.kind === "prepare_video_submit") return "video_allowed";
	  if (action.kind === "query_video_result") return "project_write_allowed";
	  if (action.kind === "prepare_export") return "export_allowed";
  if (action.kind === "inspect_project_status") return "plan_only";
  return "project_write_allowed";
}

export function vibeAgentConfirmedActionBlockedLabel(reason: string) {
  const normalized = reason.trim();
  if (!normalized) return "动作暂时不能执行，项目已保留。";
  return `${normalized}${/[。！？.!?]$/.test(normalized) ? "" : "。"}项目已保留。`;
}

export async function runRegisteredConfirmedVibeAgentProductAction<
  TVideoPermissionContract = unknown,
  TWebSearchSettings = unknown,
  TWebSearchResult = unknown,
>(
  input: VibeAgentRegisteredConfirmedProductActionInput<TVideoPermissionContract, TWebSearchSettings, TWebSearchResult>,
): Promise<VibeAgentConfirmedToolRunOutcome> {
  if (!input.action) {
    input.setStatus("预览已生成");
    return { status: "skipped", label: "预览已生成", projectRecordPreserved: true };
  }
  const action = input.action;
  const runThroughProductRunner = () => runConfirmedVibeAgentProductAction({
    ...input,
    action,
  });
  const execution = await executeRegisteredVibeAgentAction<VibeAgentConfirmedToolRunOutcome>({
    action,
    permissionMode: input.permissionMode,
    userConfirmed: input.userConfirmed,
    handlers: buildVibeAgentProductExecutionHandlers({
      writeProject: runThroughProductRunner,
      compileVideoRequest: runThroughProductRunner,
      researchStyle: runThroughProductRunner,
      generateReferences: runThroughProductRunner,
      submitVideo: runThroughProductRunner,
      exportProject: runThroughProductRunner,
      queryVideo: runThroughProductRunner,
    }),
  });
  if (execution.status === "completed") return execution.value;
  const label = execution.status === "blocked"
    ? vibeAgentConfirmedActionBlockedLabel(execution.reason)
    : "动作执行失败，项目已保留，可以稍后重试。";
  input.setStatus(label);
  return { status: execution.status, label, projectRecordPreserved: true };
}

export async function runConfirmedVibeAgentProductAction<
  TVideoPermissionContract = unknown,
  TWebSearchSettings = unknown,
  TWebSearchResult = unknown,
>(
  input: VibeAgentConfirmedProductActionRunnerInput<TVideoPermissionContract, TWebSearchSettings, TWebSearchResult>,
): Promise<VibeAgentConfirmedToolRunOutcome> {
  const handoff = input.preparedHandoff || input.buildHandoff(input.action);
  if (!handoff) {
    input.setStatus("预览已生成");
    return { status: "skipped", label: "预览已生成", projectRecordPreserved: true };
  }
  const bindingIssue = input.bindingIssue(input.action, handoff);
  if (bindingIssue) {
    const label = `${bindingIssue}项目已保留。`;
    input.setStatus(label);
    return { status: "blocked", label, projectRecordPreserved: true };
  }
  input.setHandoff(handoff);
  input.setStatus(handoff.userFacingMessage);

  if (handoff.status === "handled_by_project_write") {
    return { status: "completed", label: "修改已写入项目", projectRecordPreserved: true };
  }

  if (handoff.status !== "ready") {
    const label = input.blockedStatusLabel(handoff);
    input.setStatus(label);
    return { status: "blocked", label, projectRecordPreserved: true };
  }

  const invocation = handoff.invocation;
  if (!invocation) {
    const label = "动作缺少确认后的执行信息，项目已保留。";
    input.setStatus(label);
    return { status: "blocked", label, projectRecordPreserved: true };
  }
  const toolTraceResult = buildDirectorAgentToolTrace(input.action, handoff);
  if (!toolTraceResult.ok || !toolTraceResult.trace) {
    const label = "动作缺少可追踪任务，项目已保留。";
    input.setStatus(label);
    return { status: "blocked", label, projectRecordPreserved: true };
  }
  const toolUserIntent = invocation.userIntent || input.userIntent;
  const toolRecoveryIntent = uniqueStrings([
    toolUserIntent,
    input.userIntent,
    input.action.sourceContext.userIntent,
    input.recoveryHint,
  ]).join("\n");
  const agentToolTrace = toolTraceResult.trace;
  const invocationScope = invocation.targetSummary.kind === "project" ? "project" : "selected_shots";
  const invocationShotIds = invocation.targetSummary.kind === "project"
    ? undefined
    : invocation.targetSummary.kind === "shot" || invocation.targetSummary.kind === "multi_shot"
      ? invocation.targetSummary.ids
      : invocation.selectedShotIds;

  try {
    if (handoff.handler === "web_search") {
      return await runConfirmedWebSearch(input, toolUserIntent, agentToolTrace);
    }

    if (isDirectorAgentReferenceGenerationHandler(handoff.handler)) {
      if (!input.createReferences) return missingHandlerOutcome(handoff.handler, input.setStatus);
      const result = await input.createReferences({
        scope: invocationScope,
        selectedShotIds: invocationShotIds,
        selectedAssetId: invocation.selectedAssetId,
        sectionId: invocation.sectionId,
        assetTypes: input.referenceAssetTypesForAction(input.action, toolRecoveryIntent),
        skipConfirm: true,
        confirmationReceiptId: handoff.handoffId,
        confirmedAt: invocation.confirmation.confirmedAt,
        agentToolTrace,
      });
      const outcome = referenceGenerationToolOutcome(result);
      input.setStatus(outcome.label);
      return outcome;
    }

    if (handoff.handler === "seedance_video_submit") {
      const runVideoAction = input.action.kind === "query_video_result"
        ? input.queryVideo || input.submitVideo
        : input.submitVideo;
      if (!runVideoAction) return missingHandlerOutcome(handoff.handler, input.setStatus);
      const result = await runVideoAction({
        scope: invocationScope,
        selectedShotIds: invocationShotIds,
        selectedAssetId: invocation.selectedAssetId,
        sectionId: invocation.sectionId,
        skipConfirm: true,
        confirmationReceiptId: handoff.handoffId,
        confirmedAt: invocation.confirmation.confirmedAt,
        videoPermissionContract: input.videoPermissionContract,
        agentToolTrace,
      });
      const outcome = videoSubmitToolOutcome(result);
      input.setStatus(outcome.label);
      return outcome;
    }

	    if (handoff.handler === "project_export") {
      if (!input.runExport) return missingHandlerOutcome(handoff.handler, input.setStatus);
      const result = await input.runExport({ agentToolTrace });
      const outcome = exportToolOutcome(result);
      input.setStatus(outcome.label);
      return outcome;
    }
    return { status: "completed", label: input.resultLabel(handoff), projectRecordPreserved: true };
  } catch {
    if (handoff.handler === "web_search") input.setResearchStatus?.("blocked");
    const label = "动作执行失败，项目已保留，可以稍后重试。";
    input.setStatus(label);
    return { status: "failed", label, projectRecordPreserved: true };
  }
}

async function runConfirmedWebSearch<
  TVideoPermissionContract,
  TWebSearchSettings,
  TWebSearchResult,
>(
  input: VibeAgentConfirmedProductActionRunnerInput<TVideoPermissionContract, TWebSearchSettings, TWebSearchResult>,
  toolUserIntent: string,
  agentToolTrace: DirectorAgentToolTrace,
): Promise<VibeAgentConfirmedToolRunOutcome> {
  if (!input.buildResearchQuery || !input.runWebSearch) return missingHandlerOutcome("web_search", input.setStatus);
  const query = input.buildResearchQuery(toolUserIntent);
  if (!query) {
    input.setStatus("请先说清楚要查什么。");
    return { status: "blocked", label: "请先说清楚要查什么。", projectRecordPreserved: true };
  }
  input.setResearchStatus?.("running");
  input.setResearchResult?.(undefined);
  input.setReferenceStatus?.("idle");
  const result = await input.runWebSearch({
    query,
    purpose: "style_research",
    settings: input.webSearchSettings,
    agentToolTrace,
  });
  input.setResearchResult?.(result);
  input.setResearchStatus?.("ready");
  input.setStatus("资料已整理，等你确认后再用。");
  return { status: "completed", label: "资料已整理，等你确认", projectRecordPreserved: true };
}

function missingHandlerOutcome(
  handler: DirectorAgentToolHandler,
  setStatus: (status: string) => void,
): VibeAgentConfirmedToolRunOutcome {
  const label = `${handler} 没有可用执行器，项目已保留。`;
  setStatus(label);
  return { status: "blocked", label, projectRecordPreserved: true };
}

function uniqueStrings(values: Array<string | undefined | null | false>) {
  return Array.from(new Set(values.map((value) => value || "").map((value) => value.trim()).filter(Boolean)));
}
