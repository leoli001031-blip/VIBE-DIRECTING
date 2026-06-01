import type { ProjectRuntimeState } from "./projectState";
import type { RealProviderOneShotTestState } from "./realProviderOneShotTest";
import type {
  RealProviderTransportPlan,
  RealProviderTransportReceipt,
  RealProviderTransportResult,
} from "./realProviderTransport";
import type { GenerationHealthReport, ProjectPreviewExportState, QaPromotionReport, WatcherEvent } from "./types";
import type { ManifestMatchReport } from "./manifestMatcher";

export const providerHandoffStatusSchemaVersion = "0.1.0";

export type ProviderHandoffStatusKind =
  | "waiting_confirmation"
  | "ready_to_call"
  | "waiting_file"
  | "needs_review"
  | "blocked";

export type ProviderHandoffStageId =
  | "action_confirmation"
  | "external_action"
  | "file_return"
  | "qa_review";

export type ProviderHandoffStageState = "pending" | "active" | "ready" | "complete" | "blocked";

export interface ProviderHandoffStage {
  id: ProviderHandoffStageId;
  label: string;
  detail: string;
  state: ProviderHandoffStageState;
}

export interface ProviderHandoffMachineFacts {
  oneShotTestStatus?: string;
  transportPlanStatus?: string;
  transportReceiptStatus?: string;
  transportResultStatus?: string;
  previewExportStatus?: string;
  watcherExpectedOutputDetected: boolean;
  manifestMatched: boolean;
  qaPassed: boolean;
  providerSelfReportedComplete: boolean;
  hardPolicy: {
    automaticProviderSubmitAllowed: false;
    credentialMaterialPresent: false;
    providerSelfReportCanComplete: false;
    completionRequiresWatcherManifestQa: true;
    maxAutoRetries: 0;
    singleActionOnly: true;
  };
}

export interface ProviderHandoffStatusState {
  schemaVersion: string;
  generatedAt: string;
  phase: "round_6_provider_handoff_status";
  status: ProviderHandoffStatusKind;
  label: string;
  detail: string;
  stages: ProviderHandoffStage[];
  machineFacts: ProviderHandoffMachineFacts;
  blockers: string[];
  warnings: string[];
  notes: string[];
}

export interface ProviderHandoffTransportState {
  plan?: RealProviderTransportPlan;
  receipt?: RealProviderTransportReceipt;
  result?: RealProviderTransportResult;
}

export interface ProviderHandoffStatusInput {
  generatedAt: string;
  realProviderOneShotTest?: RealProviderOneShotTestState;
  realProviderTransport?: ProviderHandoffTransportState;
  previewExport?: ProjectPreviewExportState;
  imagePipeline?: {
    watcherEvents?: WatcherEvent[];
    generationHealthReports?: GenerationHealthReport[];
    qaPromotionReports?: QaPromotionReport[];
  };
  manifestMatches?: {
    reports?: ManifestMatchReport[];
  };
}

type RuntimeLike = ProjectRuntimeState & {
  realProviderTransport?: ProviderHandoffTransportState;
};

const manifestReadyStatuses = new Set(["actual_output_present", "complete", "matched"]);

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function normalizeInput(input: ProviderHandoffStatusInput | RuntimeLike): ProviderHandoffStatusInput {
  return {
    generatedAt: input.generatedAt,
    realProviderOneShotTest: input.realProviderOneShotTest,
    realProviderTransport: input.realProviderTransport,
    previewExport: input.previewExport,
    imagePipeline: input.imagePipeline,
    manifestMatches: input.manifestMatches,
  };
}

function watcherDetected(input: ProviderHandoffStatusInput, result?: RealProviderTransportResult): boolean {
  if (result) return result.gateEvidence.watcherExpectedOutputDetected;
  return Boolean(
    input.imagePipeline?.watcherEvents?.some(
      (event) => event.eventType === "expected_output_detected" && event.status === "detected",
    ),
  );
}

function manifestMatched(input: ProviderHandoffStatusInput, result?: RealProviderTransportResult): boolean {
  if (result) return result.gateEvidence.manifestMatched;
  if (input.manifestMatches?.reports?.some((report) => manifestReadyStatuses.has(report.status))) return true;
  return Boolean(
    input.imagePipeline?.generationHealthReports?.some(
      (report) => report.outputExists && manifestReadyStatuses.has(report.manifestStatus),
    ),
  );
}

function qaPassed(input: ProviderHandoffStatusInput, result?: RealProviderTransportResult): boolean {
  if (result) return result.gateEvidence.qaPassed;
  if (
    input.imagePipeline?.generationHealthReports?.some(
      (report) => report.qaStatus === "pass" && report.healthStatus === "formal_ready",
    )
  ) {
    return true;
  }
  return Boolean(input.imagePipeline?.qaPromotionReports?.some((report) => report.requiredGates.qaPass && report.canPromoteToFormal));
}

function policyBlockers(input: ProviderHandoffStatusInput, facts: ProviderHandoffMachineFacts): string[] {
  const test = input.realProviderOneShotTest;
  const plan = input.realProviderTransport?.plan;
  const receipt = input.realProviderTransport?.receipt;
  return uniqueSorted([
    test && test.hardLocks.actualExecutionAllowed !== false ? "One-shot test hard lock must forbid actual execution." : "",
    test && test.hardLocks.credentialAccessAllowed !== false ? "One-shot test hard lock must forbid credential access." : "",
    test && test.hardLocks.noShellExecution !== true ? "One-shot test hard lock must forbid shell execution." : "",
    test && test.hardLocks.maxAutoRetries !== 0 ? "One-shot test hard lock must keep maxAutoRetries=0." : "",
    test && test.hardLocks.singleActionOnly !== true ? "One-shot test hard lock must require a single action." : "",
    test && test.summary.actualExecutionAllowed !== false ? "One-shot test summary must forbid actual execution." : "",
    test && test.summary.providerSubmitAllowed !== 0 ? "One-shot test summary must keep providerSubmitAllowed=0 before action confirmation." : "",
    test && test.summary.maxAutoRetries !== 0 ? "One-shot test summary must keep maxAutoRetries=0." : "",
    plan && plan.transportPolicy.automaticProviderSubmitAllowed !== false ? "Transport policy must forbid automatic provider submit." : "",
    plan && plan.transportPolicy.credentialMaterialAccessAllowed !== false ? "Transport policy must forbid credential material access." : "",
    plan && plan.transportPolicy.providerSelfReportCanComplete !== false ? "Transport policy must reject provider self-report completion." : "",
    plan && plan.attempt.maxAutoRetries !== 0 ? "Transport attempt must keep maxAutoRetries=0." : "",
    plan && plan.attempt.maxProviderSubmits !== 1 ? "Transport attempt must allow one submit at most." : "",
    receipt && receipt.attempt.maxAutoRetries !== 0 ? "Receipt attempt must keep maxAutoRetries=0." : "",
  ]);
}

function statusFrom(input: ProviderHandoffStatusInput, facts: ProviderHandoffMachineFacts, blockers: string[]): ProviderHandoffStatusKind {
  const testStatus = input.realProviderOneShotTest?.status;
  const planStatus = input.realProviderTransport?.plan?.status;
  const receiptStatus = input.realProviderTransport?.receipt?.status;
  const resultStatus = input.realProviderTransport?.result?.status;
  const hasReceipt = Boolean(input.realProviderTransport?.receipt);
  const completeEvidence = facts.watcherExpectedOutputDetected && facts.manifestMatched && facts.qaPassed;

  if (
    blockers.length > 0 ||
    testStatus === "blocked" ||
    planStatus === "blocked" ||
    receiptStatus === "blocked" ||
    resultStatus === "blocked" ||
    resultStatus === "provider_call_failed"
  ) {
    return "blocked";
  }

  if (resultStatus === "needs_review" || (hasReceipt && completeEvidence)) return "needs_review";
  if (hasReceipt || resultStatus === "waiting_for_file" || resultStatus === "output_missing") return "waiting_file";
  if (planStatus === "mock_submit_ready" || planStatus === "ready_for_manual_transport") return "ready_to_call";
  if (planStatus === "requires_external_action") return "waiting_confirmation";
  if (testStatus === "ready_for_action_time_confirmation") return "waiting_confirmation";
  return "blocked";
}

function labelFor(status: ProviderHandoffStatusKind): string {
  if (status === "waiting_confirmation") return "等待确认";
  if (status === "ready_to_call") return "准备调用";
  if (status === "waiting_file") return "等待文件";
  if (status === "needs_review") return "需要复核";
  return "受阻";
}

function detailFor(status: ProviderHandoffStatusKind, facts: ProviderHandoffMachineFacts): string {
  if (status === "waiting_confirmation") return "动作确认或外部执行完成后，才进入下一步。";
  if (status === "ready_to_call") return "已准备好一次动作；不会自动提交。";
  if (status === "waiting_file") {
    return facts.providerSelfReportedComplete
      ? "外部回报不会直接完成任务，还要等文件和清单确认。"
      : "已记录动作，正在等待生成结果。";
  }
  if (status === "needs_review") return "文件和清单已准备好，等待复核。";
  return "硬性约束未满足，不能继续。";
}

function stagesFor(status: ProviderHandoffStatusKind): ProviderHandoffStage[] {
  const actionState: ProviderHandoffStageState = status === "blocked" ? "blocked" : status === "waiting_confirmation" ? "active" : "complete";
  const externalState: ProviderHandoffStageState =
    status === "blocked" ? "blocked" : status === "ready_to_call" ? "active" : status === "waiting_confirmation" ? "pending" : "complete";
  const fileState: ProviderHandoffStageState =
    status === "blocked" ? "blocked" : status === "waiting_file" ? "active" : status === "needs_review" ? "complete" : "pending";
  const reviewState: ProviderHandoffStageState =
    status === "blocked" ? "blocked" : status === "needs_review" ? "active" : "pending";

  return [
    {
      id: "action_confirmation",
      label: "动作确认",
      detail: actionState === "complete" ? "已通过一次性确认边界" : actionState === "active" ? "等待这次动作确认" : "先解除阻断",
      state: actionState,
    },
    {
      id: "external_action",
      label: "外部动作",
      detail: externalState === "complete" ? "动作记录已存在" : externalState === "active" ? "已准备，等待你继续" : "确认后才会出现",
      state: externalState,
    },
    {
      id: "file_return",
      label: "结果文件",
      detail: fileState === "complete" ? "文件和清单已准备好" : fileState === "active" ? "等待文件写入输出位置" : "尚未开始等待",
      state: fileState,
    },
    {
      id: "qa_review",
      label: "复核",
      detail: reviewState === "active" ? "等待你确认" : reviewState === "blocked" ? "阻断后不可复核" : "等结果回来再复核",
      state: reviewState,
    },
  ];
}

export function buildProviderHandoffStatus(inputLike: ProviderHandoffStatusInput | RuntimeLike): ProviderHandoffStatusState {
  const input = normalizeInput(inputLike);
  const result = input.realProviderTransport?.result;
  const receipt = input.realProviderTransport?.receipt;
  const facts: ProviderHandoffMachineFacts = {
    oneShotTestStatus: input.realProviderOneShotTest?.status,
    transportPlanStatus: input.realProviderTransport?.plan?.status,
    transportReceiptStatus: receipt?.status,
    transportResultStatus: result?.status,
    previewExportStatus: input.previewExport?.exportPackagePlan.status,
    watcherExpectedOutputDetected: watcherDetected(input, result),
    manifestMatched: manifestMatched(input, result),
    qaPassed: qaPassed(input, result),
    providerSelfReportedComplete: Boolean(receipt?.providerSelfReportedComplete),
    hardPolicy: {
      automaticProviderSubmitAllowed: false,
      credentialMaterialPresent: false,
      providerSelfReportCanComplete: false,
      completionRequiresWatcherManifestQa: true,
      maxAutoRetries: 0,
      singleActionOnly: true,
    },
  };
  const blockers = uniqueSorted([
    ...(input.realProviderOneShotTest?.blockers || []),
    ...(input.realProviderTransport?.plan?.blockers || []),
    ...(receipt?.blockers || []),
    ...(result?.blockers || []),
    ...policyBlockers(input, facts),
  ]);
  const warnings = uniqueSorted([
    ...(input.realProviderOneShotTest?.warnings || []),
    ...(input.realProviderTransport?.plan?.warnings || []),
    ...(receipt?.warnings || []),
    ...(result?.warnings || []),
    facts.providerSelfReportedComplete && !(facts.watcherExpectedOutputDetected && facts.manifestMatched && facts.qaPassed)
      ? "Provider self-report is not enough; watcher, manifest, and QA evidence are required."
      : "",
  ]);
  const status = statusFrom(input, facts, blockers);

  return {
    schemaVersion: providerHandoffStatusSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "round_6_provider_handoff_status",
    status,
    label: labelFor(status),
    detail: detailFor(status, facts),
    stages: stagesFor(status),
    machineFacts: facts,
    blockers,
    warnings,
    notes: [
      "Automatic provider submission remains forbidden in this status layer.",
      "Credential material is absent; only higher-level references may be represented elsewhere.",
      "Completion requires watcher, manifest, and QA evidence, then human review.",
    ],
  };
}
