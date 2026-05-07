import type {
  ProviderObservationReceiptV2Facts,
  SemanticQaGateKey,
  SemanticQaGateStatus,
  SemanticQaReceiptV2Facts,
  SemanticQaSeverityCounts,
} from "./runtimeTruthLayer";

export const runtimeTruthReceiptsSchemaVersion = "0.1.0";

export interface RuntimeTruthReceiptBinding {
  runId: string;
  taskRunId: string;
  taskPacketId: string;
  envelopeId: string;
  outputPath: string;
  outputSha256: string;
}

export interface BuildProviderObservationReceiptV2Input {
  generatedAt: string;
  sidecarPath: string;
  binding: RuntimeTruthReceiptBinding;
  providerId: string;
  providerObservationMode?: "actual_provider_call_observed" | "mock_readiness_evidence" | "not_observed";
  workerId: string;
  subagentId: string;
  threadId: string;
  turnId: string;
  toolCallId: string;
  providerSelfReportedComplete?: boolean;
  manualFileCopyDetected?: boolean;
  fixtureReuseDetected?: boolean;
  notes?: string[];
}

export interface ProviderObservationReceiptV2Payload extends ProviderObservationReceiptV2Facts {
  schemaVersion: typeof runtimeTruthReceiptsSchemaVersion;
  receiptKind: "provider_observation_receipt_v2";
  sidecarPath: string;
  exists: true;
  sidecarModifiedAt: string;
  providerObservationMode: "actual_provider_call_observed" | "mock_readiness_evidence" | "not_observed";
  providerId: string;
  workerId?: string;
  subagentId?: string;
  threadId: string;
  turnId: string;
  toolCallId: string;
  providerSelfReportedComplete: boolean;
  providerSelfReportCompletesTask: false;
  manualFileCopyDetected: boolean;
  fixtureReuseDetected: boolean;
  notes: string[];
}

export interface BuildSemanticQaReceiptV2Input {
  reviewedAt: string;
  sidecarPath: string;
  binding: RuntimeTruthReceiptBinding;
  reviewerId: string;
  gates: Record<SemanticQaGateKey, SemanticQaGateStatus>;
  severityCounts?: Partial<SemanticQaSeverityCounts>;
  findings?: Array<{
    gateId: SemanticQaGateKey;
    severity: "P0" | "P1" | "P2";
    message: string;
  }>;
  notes?: string[];
}

export interface SemanticQaReceiptV2Payload extends SemanticQaReceiptV2Facts {
  schemaVersion: typeof runtimeTruthReceiptsSchemaVersion;
  receiptKind: "semantic_qa_receipt_v2";
  sidecarPath: string;
  exists: true;
  sidecarModifiedAt: string;
  reviewedAt: string;
  reviewedOutputSha256: string;
  reviewerId: string;
  gates: Record<SemanticQaGateKey, SemanticQaGateStatus>;
  severityCounts: SemanticQaSeverityCounts;
  findings: Array<{
    gateId: SemanticQaGateKey;
    severity: "P0" | "P1" | "P2";
    message: string;
  }>;
  previewGate: "pass" | "warning" | "blocked";
  notes: string[];
}

const requiredQaGateKeys: SemanticQaGateKey[] = ["identity", "scene", "style", "story", "neighbor", "output"];

function normalizeSeverityCounts(counts: Partial<SemanticQaSeverityCounts> | undefined): SemanticQaSeverityCounts {
  return {
    p0: Number(counts?.p0 ?? 0),
    p1: Number(counts?.p1 ?? 0),
    p2: Number(counts?.p2 ?? 0),
  };
}

function semanticPreviewGate(gates: Record<SemanticQaGateKey, SemanticQaGateStatus>, severityCounts: SemanticQaSeverityCounts): "pass" | "warning" | "blocked" {
  if (severityCounts.p0 > 0 || severityCounts.p1 > 0) return "blocked";
  if (requiredQaGateKeys.some((key) => gates[key] === "fail" || gates[key] === "blocked" || gates[key] === "missing")) return "blocked";
  if (severityCounts.p2 > 0 || requiredQaGateKeys.some((key) => gates[key] === "warn")) return "warning";
  return "pass";
}

export function buildProviderObservationReceiptV2(input: BuildProviderObservationReceiptV2Input): ProviderObservationReceiptV2Payload {
  return {
    schemaVersion: runtimeTruthReceiptsSchemaVersion,
    receiptKind: "provider_observation_receipt_v2",
    sidecarPath: input.sidecarPath,
    exists: true,
    sidecarModifiedAt: input.generatedAt,
    generatedAt: input.generatedAt,
    sidecarGeneratedAt: input.generatedAt,
    runId: input.binding.runId,
    taskRunId: input.binding.taskRunId,
    taskPacketId: input.binding.taskPacketId,
    envelopeId: input.binding.envelopeId,
    outputPath: input.binding.outputPath,
    outputSha256: input.binding.outputSha256,
    providerId: input.providerId,
    providerObservationMode: input.providerObservationMode || "actual_provider_call_observed",
    workerId: input.workerId,
    subagentId: input.subagentId,
    threadId: input.threadId,
    turnId: input.turnId,
    toolCallId: input.toolCallId,
    providerSelfReportedComplete: input.providerSelfReportedComplete === true,
    providerSelfReportCompletesTask: false,
    manualFileCopyDetected: input.manualFileCopyDetected === true,
    fixtureReuseDetected: input.fixtureReuseDetected === true,
    notes: [
      ...(input.notes || []),
      "Provider observation receipt v2 binds the provider sidecar to runId, taskRunId, taskPacketId, envelopeId, outputPath, outputSha256, threadId, turnId, and toolCallId.",
      "providerSelfReportedComplete is evidence only and can never complete RuntimeTruthLayer by itself.",
    ],
  };
}

export function buildSemanticQaReceiptV2(input: BuildSemanticQaReceiptV2Input): SemanticQaReceiptV2Payload {
  const severityCounts = normalizeSeverityCounts(input.severityCounts);
  const previewGate = semanticPreviewGate(input.gates, severityCounts);
  return {
    schemaVersion: runtimeTruthReceiptsSchemaVersion,
    receiptKind: "semantic_qa_receipt_v2",
    sidecarPath: input.sidecarPath,
    exists: true,
    sidecarModifiedAt: input.reviewedAt,
    reviewedAt: input.reviewedAt,
    runId: input.binding.runId,
    taskRunId: input.binding.taskRunId,
    taskPacketId: input.binding.taskPacketId,
    envelopeId: input.binding.envelopeId,
    outputPath: input.binding.outputPath,
    outputSha256: input.binding.outputSha256,
    reviewedOutputSha256: input.binding.outputSha256,
    reviewerId: input.reviewerId,
    gates: input.gates,
    severityCounts,
    findings: input.findings || [],
    previewGate,
    notes: [
      ...(input.notes || []),
      "Semantic QA receipt v2 binds the review to reviewedOutputSha256. P0/P1 block preview_ready; P2 is a warning/note.",
    ],
  };
}
