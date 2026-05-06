import type { AppendableTaskRunLedgerEvent } from "./taskRunLedger";

export const artifactTransactionGateSchemaVersion = "0.1.0";

export type ArtifactTransactionGateStatus =
  | "image_exists_but_provider_observation_missing"
  | "provider_observed_but_qa_pending"
  | "semantic_qa_pending"
  | "sidecar_mismatch"
  | "needs_review"
  | "complete_verified"
  | "blocked";

export type ArtifactUsageScope = "preview" | "export" | "promotion";

export interface ArtifactOutputFact {
  path: string;
  hash: string;
  hashAlgorithm?: "sha256" | "sha1" | "md5" | "unknown";
  byteLength?: number;
}

export interface ArtifactProviderObservationFact {
  outputPath?: string;
  outputHash?: string;
  sidecarPath?: string;
  sidecarHash?: string;
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
  providerId?: string;
  observationId?: string;
}

export type ArtifactSemanticQaStatus = "pending" | "pass" | "needs_review" | "failed";

export interface ArtifactSemanticQaFact {
  outputPath?: string;
  reviewedOutputHash?: string;
  sidecarPath?: string;
  sidecarHash?: string;
  stableFindingIds: string[];
  status: ArtifactSemanticQaStatus;
  p0FindingCount?: number;
  p1FindingCount?: number;
  p2FindingCount?: number;
}

export interface ArtifactTransactionGatePolicy {
  blockOnP2Findings?: boolean;
}

export interface ArtifactTransactionGateInput {
  taskRunId: string;
  envelopeId?: string;
  expectedOutputPath: string;
  output?: ArtifactOutputFact;
  providerObservation?: ArtifactProviderObservationFact;
  semanticQa?: ArtifactSemanticQaFact;
  sandboxAllowedPrefixes: string[];
  policy?: ArtifactTransactionGatePolicy;
}

export interface ArtifactTrendFeedback {
  severity: "P2";
  stableFindingIds: string[];
  count: number;
  messageForPromptCompiler: string;
}

export interface ArtifactTransactionGateResult {
  schemaVersion: string;
  taskRunId: string;
  envelopeId?: string;
  expectedOutputPath: string;
  status: ArtifactTransactionGateStatus;
  completeVerified: boolean;
  canUseForPreview: boolean;
  canUseForExport: boolean;
  canUseForPromotion: boolean;
  output?: ArtifactOutputFact;
  providerObservation?: ArtifactProviderObservationFact;
  semanticQa?: ArtifactSemanticQaFact;
  sandboxAllowedPrefixes: string[];
  blockers: string[];
  warnings: string[];
  trendFeedback: ArtifactTrendFeedback[];
}

export interface ArtifactAvailabilitySummary {
  scope: ArtifactUsageScope;
  available: boolean;
  gateStatus: ArtifactTransactionGateStatus;
  artifactPath?: string;
  artifactHash?: string;
  messageForUser: string;
  blockers: string[];
  trendFeedback: ArtifactTrendFeedback[];
}

const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeOptionalPath(value: string | undefined): string | undefined {
  return value ? normalizePath(value) : undefined;
}

function normalizeOutput(output: ArtifactOutputFact | undefined): ArtifactOutputFact | undefined {
  return output
    ? {
        ...clone(output),
        path: normalizePath(output.path),
      }
    : undefined;
}

function normalizeProvider(
  observation: ArtifactProviderObservationFact | undefined,
): ArtifactProviderObservationFact | undefined {
  return observation
    ? {
        ...clone(observation),
        outputPath: normalizeOptionalPath(observation.outputPath),
        sidecarPath: normalizeOptionalPath(observation.sidecarPath),
      }
    : undefined;
}

function normalizeQa(qa: ArtifactSemanticQaFact | undefined): ArtifactSemanticQaFact | undefined {
  return qa
    ? {
        ...clone(qa),
        outputPath: normalizeOptionalPath(qa.outputPath),
        sidecarPath: normalizeOptionalPath(qa.sidecarPath),
        stableFindingIds: uniqueInOrder(qa.stableFindingIds || []),
      }
    : undefined;
}

function portablePathBlockers(label: string, path: string | undefined): string[] {
  if (!path) return [];
  if (absolutePathPattern.test(path)) return [`${label} must be project-root-relative, not absolute.`];
  if (parentTraversalPattern.test(path)) return [`${label} must not contain parent traversal.`];
  return [];
}

function pathInsideAllowedPrefixes(path: string, allowedPrefixes: string[]): boolean {
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function qaReviewStatusForLedger(status: ArtifactSemanticQaStatus): "pending" | "pass" | "needs_review" | "failed" {
  return status;
}

function p0Count(qa: ArtifactSemanticQaFact | undefined): number {
  return qa?.p0FindingCount || 0;
}

function p1Count(qa: ArtifactSemanticQaFact | undefined): number {
  return qa?.p1FindingCount || 0;
}

function p2Count(qa: ArtifactSemanticQaFact | undefined): number {
  return qa?.p2FindingCount || 0;
}

function userBlockerFor(result: ArtifactTransactionGateResult, scope: ArtifactUsageScope): string {
  const labelByScope: Record<ArtifactUsageScope, string> = {
    preview: "Preview",
    export: "Export",
    promotion: "Promotion",
  };
  return `${labelByScope[scope]} is waiting for a complete_verified artifact: ${result.blockers[0] || result.status}.`;
}

export function evaluateArtifactTransactionGate(input: ArtifactTransactionGateInput): ArtifactTransactionGateResult {
  const expectedOutputPath = normalizePath(input.expectedOutputPath);
  const sandboxAllowedPrefixes = uniqueInOrder(input.sandboxAllowedPrefixes.map(normalizePath));
  const output = normalizeOutput(input.output);
  const providerObservation = normalizeProvider(input.providerObservation);
  const semanticQa = normalizeQa(input.semanticQa);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const trendFeedback: ArtifactTrendFeedback[] = [];

  blockers.push(...portablePathBlockers("expectedOutputPath", expectedOutputPath));
  for (const prefix of sandboxAllowedPrefixes) blockers.push(...portablePathBlockers("sandboxAllowedPrefix", prefix));
  if (!sandboxAllowedPrefixes.length) blockers.push("At least one sandbox allowed prefix is required.");
  if (!pathInsideAllowedPrefixes(expectedOutputPath, sandboxAllowedPrefixes)) {
    blockers.push("Expected output path must be inside the sandbox allowed prefixes.");
  }

  if (!output?.path || !output.hash) {
    blockers.push("Output path and hash are required before complete_verified.");
  } else {
    blockers.push(...portablePathBlockers("output.path", output.path));
    if (output.path !== expectedOutputPath) blockers.push("Output path must match expectedOutputPath.");
    if (!pathInsideAllowedPrefixes(output.path, sandboxAllowedPrefixes)) {
      blockers.push("Output path must be inside the sandbox allowed prefixes.");
    }
  }

  if (providerObservation) {
    blockers.push(...portablePathBlockers("providerObservation.outputPath", providerObservation.outputPath));
    blockers.push(...portablePathBlockers("providerObservation.sidecarPath", providerObservation.sidecarPath));
    if (providerObservation.outputPath && providerObservation.outputPath !== expectedOutputPath) {
      blockers.push("Provider observation outputPath must match expectedOutputPath.");
    }
    if (providerObservation.outputPath && !pathInsideAllowedPrefixes(providerObservation.outputPath, sandboxAllowedPrefixes)) {
      blockers.push("Provider observation outputPath must be inside the sandbox allowed prefixes.");
    }
    if (providerObservation.sidecarPath && !pathInsideAllowedPrefixes(providerObservation.sidecarPath, sandboxAllowedPrefixes)) {
      blockers.push("Provider observation sidecarPath must be inside the sandbox allowed prefixes.");
    }
  }

  if (semanticQa) {
    blockers.push(...portablePathBlockers("semanticQa.outputPath", semanticQa.outputPath));
    blockers.push(...portablePathBlockers("semanticQa.sidecarPath", semanticQa.sidecarPath));
    if (semanticQa.outputPath && semanticQa.outputPath !== expectedOutputPath) {
      blockers.push("Semantic QA outputPath must match expectedOutputPath.");
    }
    if (semanticQa.outputPath && !pathInsideAllowedPrefixes(semanticQa.outputPath, sandboxAllowedPrefixes)) {
      blockers.push("Semantic QA outputPath must be inside the sandbox allowed prefixes.");
    }
    if (semanticQa.sidecarPath && !pathInsideAllowedPrefixes(semanticQa.sidecarPath, sandboxAllowedPrefixes)) {
      blockers.push("Semantic QA sidecarPath must be inside the sandbox allowed prefixes.");
    }
  }

  let status: ArtifactTransactionGateStatus = "blocked";
  const outputAvailable = Boolean(output?.path && output.hash && output.path === expectedOutputPath);
  const providerPresent = Boolean(providerObservation);
  const providerComplete = Boolean(providerObservation?.outputHash && providerObservation?.sidecarHash);
  const providerHashMatches = Boolean(output?.hash && providerObservation?.outputHash === output.hash);
  const qaBound = Boolean(semanticQa?.reviewedOutputHash && output?.hash && semanticQa.reviewedOutputHash === output.hash);
  const qaSidecarPresent = Boolean(semanticQa?.sidecarHash);

  if (!outputAvailable) {
    status = "blocked";
  } else if (!providerPresent || !providerComplete) {
    status = "image_exists_but_provider_observation_missing";
    if (!providerObservation) blockers.push("Provider observation sidecar is required before complete_verified.");
    if (providerObservation && !providerObservation.outputHash) blockers.push("Provider observation outputHash is required before complete_verified.");
    if (providerObservation && !providerObservation.sidecarHash) blockers.push("Provider observation sidecarHash is required before complete_verified.");
  } else if (!providerHashMatches || providerObservation?.outputPath !== expectedOutputPath) {
    status = "sidecar_mismatch";
    blockers.push("Provider observation must bind the current output hash and expected output path.");
  } else if (!semanticQa) {
    status = "provider_observed_but_qa_pending";
    blockers.push("Semantic QA sidecar is required before complete_verified.");
  } else {
    const qa = semanticQa;
    if (!qa.reviewedOutputHash || !qaSidecarPresent || qa.status === "pending") {
      status = "semantic_qa_pending";
      if (!qa.reviewedOutputHash) blockers.push("Semantic QA must bind reviewedOutputHash before complete_verified.");
      if (!qaSidecarPresent) blockers.push("Semantic QA sidecarHash is required before complete_verified.");
      if (qa.status === "pending") blockers.push("Semantic QA status must pass before complete_verified.");
    } else if (!qaBound || qa.outputPath !== expectedOutputPath) {
      status = "sidecar_mismatch";
      blockers.push("Semantic QA must bind the current output hash and expected output path.");
    } else if (qa.status === "failed" || p0Count(qa) > 0) {
      status = "blocked";
      blockers.push("P0 semantic QA findings or failed QA status block artifact completion.");
    } else if (qa.status === "needs_review" || p1Count(qa) > 0) {
      status = "needs_review";
      blockers.push("P1 semantic QA findings require review before formal use.");
    } else if ((input.policy?.blockOnP2Findings || false) && p2Count(qa) > 0) {
      status = "needs_review";
      blockers.push("P2 semantic QA findings require review by policy.");
    } else {
      status = "complete_verified";
    }
  }

  if (p2Count(semanticQa) > 0) {
    trendFeedback.push({
      severity: "P2",
      stableFindingIds: uniqueInOrder(semanticQa?.stableFindingIds || []),
      count: p2Count(semanticQa),
      messageForPromptCompiler: "Record repeated P2 semantic QA findings as style/prompt trend feedback.",
    });
    if (!input.policy?.blockOnP2Findings) {
      warnings.push("P2 findings are recorded as trend feedback and do not block complete_verified by default.");
    }
  }

  const uniqueBlockers = uniqueInOrder(blockers);
  const completeVerified = status === "complete_verified" && uniqueBlockers.length === 0;
  const finalStatus: ArtifactTransactionGateStatus = completeVerified ? "complete_verified" : status === "complete_verified" ? "blocked" : status;

  return {
    schemaVersion: artifactTransactionGateSchemaVersion,
    taskRunId: input.taskRunId,
    envelopeId: input.envelopeId,
    expectedOutputPath,
    status: finalStatus,
    completeVerified,
    canUseForPreview: completeVerified,
    canUseForExport: completeVerified,
    canUseForPromotion: completeVerified,
    output,
    providerObservation,
    semanticQa,
    sandboxAllowedPrefixes,
    blockers: uniqueBlockers,
    warnings: uniqueInOrder(warnings),
    trendFeedback,
  };
}

export function buildArtifactAvailabilitySummary(
  result: ArtifactTransactionGateResult,
  scope: ArtifactUsageScope,
): ArtifactAvailabilitySummary {
  if (result.completeVerified && result.output) {
    return {
      scope,
      available: true,
      gateStatus: result.status,
      artifactPath: result.output.path,
      artifactHash: result.output.hash,
      messageForUser: "Artifact is complete_verified and available.",
      blockers: [],
      trendFeedback: [...result.trendFeedback],
    };
  }

  return {
    scope,
    available: false,
    gateStatus: result.status,
    messageForUser: userBlockerFor(result, scope),
    blockers: [...result.blockers],
    trendFeedback: [...result.trendFeedback],
  };
}

export function buildArtifactAvailabilitySummaries(result: ArtifactTransactionGateResult): ArtifactAvailabilitySummary[] {
  return (["preview", "export", "promotion"] as ArtifactUsageScope[]).map((scope) =>
    buildArtifactAvailabilitySummary(result, scope),
  );
}

export function toTaskRunLedgerEvents(
  result: ArtifactTransactionGateResult,
  at = "1970-01-01T00:00:00.000Z",
): AppendableTaskRunLedgerEvent[] {
  const events: AppendableTaskRunLedgerEvent[] = [];
  const common = {
    at,
    taskRunId: result.taskRunId,
    envelopeId: result.envelopeId,
  };

  if (result.output) {
    events.push({
      ...common,
      eventType: "output_detected_no_sidecar",
      output: {
        path: result.output.path,
        hash: result.output.hash,
        hashAlgorithm: result.output.hashAlgorithm,
        byteLength: result.output.byteLength,
      },
      notes: ["Artifact transaction gate observed output hash."],
    });
  }

  if (result.providerObservation?.outputHash) {
    events.push({
      ...common,
      eventType: "provider_observed",
      providerObservation: {
        providerId: result.providerObservation.providerId,
        observationId: result.providerObservation.observationId,
        outputPath: result.providerObservation.outputPath || result.expectedOutputPath,
        outputHash: result.providerObservation.outputHash,
        sidecarPath: result.providerObservation.sidecarPath,
        sidecarHash: result.providerObservation.sidecarHash,
        appServerThreadId: result.providerObservation.threadId,
        appServerTurnId: result.providerObservation.turnId,
        appServerToolCallId: result.providerObservation.toolCallId,
      },
      notes: ["Provider observation fact compiled from artifact transaction gate."],
    });
  }

  if (result.providerObservation?.outputHash && !result.semanticQa) {
    events.push({
      ...common,
      eventType: "qa_pending",
      reason: "Semantic QA sidecar is missing.",
      notes: ["Provider observed; semantic QA is pending."],
    });
  }

  if (result.semanticQa) {
    const qaReview = {
      outputPath: result.semanticQa.outputPath || result.expectedOutputPath,
      reviewedOutputHash: result.semanticQa.reviewedOutputHash || "",
      sidecarPath: result.semanticQa.sidecarPath,
      sidecarHash: result.semanticQa.sidecarHash,
      status: qaReviewStatusForLedger(result.semanticQa.status),
      findingIds: [...result.semanticQa.stableFindingIds],
      p0FindingCount: p0Count(result.semanticQa),
      p1FindingCount: p1Count(result.semanticQa),
      p2FindingCount: p2Count(result.semanticQa),
    };

    if (result.status === "needs_review") {
      events.push({
        ...common,
        eventType: "needs_review",
        qaReview,
        reason: result.blockers[0] || "Semantic QA requires review.",
        notes: ["Semantic QA requires review before formal use."],
      });
    } else if (result.status === "blocked" && (result.semanticQa.status === "failed" || p0Count(result.semanticQa) > 0)) {
      events.push({
        ...common,
        eventType: "failed",
        qaReview,
        reason: result.blockers[0] || "Semantic QA blocked artifact completion.",
        notes: ["P0 or failed semantic QA blocks artifact completion."],
      });
    } else if (result.semanticQa.status === "pass") {
      events.push({
        ...common,
        eventType: "qa_passed",
        qaReview,
        notes: ["Semantic QA passed for the reviewed output hash."],
      });
    } else {
      events.push({
        ...common,
        eventType: "qa_pending",
        qaReview,
        reason: result.blockers[0] || "Semantic QA is pending.",
        notes: ["Semantic QA is pending or not hash-bound yet."],
      });
    }
  }

  if (result.completeVerified) {
    events.push({
      ...common,
      eventType: "complete_verified",
      notes: ["Artifact transaction gate satisfied output, provider observation, semantic QA, and sandbox checks."],
    });
  }

  return events;
}
