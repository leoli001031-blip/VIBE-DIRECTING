export const realDemoE2eSchemaVersion = "0.1.0";

export type RealDemoE2eStatus = "ready_for_real_chain_pressure_test" | "needs_review" | "blocked";
export type RealDemoE2eStageStatus = "pass" | "blocked";
export type RealDemoE2eProviderObservationMode =
  | "actual_provider_call_observed"
  | "mock_readiness_evidence"
  | "not_observed";
export type RealDemoE2eShotPressureStatus = "real_image_planned" | "queued" | "parked" | "returned";

export interface RealDemoE2eProjectFactsEvidence {
  projectVibePresent: boolean;
  sourceIndexPresent: boolean;
  visualMemoryPresent: boolean;
  shotLayoutPresent: boolean;
}

export interface RealDemoE2eWorkerProvenance {
  workerId?: string;
  subagentId?: string;
  taskRunId?: string;
  taskPacketId?: string;
  envelopeId?: string;
  outputPath?: string;
}

export interface RealDemoE2eChainEvidence {
  generatedByUiAction: boolean;
  validatedEnvelope: boolean;
  workerProvenance?: RealDemoE2eWorkerProvenance;
  providerCallObserved: boolean;
  providerObservationMode: RealDemoE2eProviderObservationMode;
  outputCameFromScopedSandbox: boolean;
  watcherEventObserved: boolean;
  manifestMatched: boolean;
  qaReportObserved: boolean;
  previewUpdatedFromOutput: boolean;
  providerSelfReportCompletesTask: boolean;
}

export interface RealDemoE2eIntegrityEvidence {
  manualFileCopyDetected: boolean;
  fixtureReuseDetected: boolean;
  simulatedStateDetected: boolean;
}

export interface RealDemoE2eShotPressurePlan {
  shotId: string;
  status: RealDemoE2eShotPressureStatus;
  taskPacketId?: string;
  envelopeId?: string;
  workerProvenanceId?: string;
  expectedOutputPath?: string;
}

export interface RealDemoE2eInput {
  generatedAt: string;
  projectId: string;
  runId: string;
  scenarioId: string;
  declaration: "readiness_harness_only" | "actual_provider_observed";
  projectFacts: RealDemoE2eProjectFactsEvidence;
  chain: RealDemoE2eChainEvidence;
  integrity: RealDemoE2eIntegrityEvidence;
  pressure?: {
    totalShots: number;
    realImagePlanCount: number;
    queuedOrParkedCount: number;
    shotPlans: RealDemoE2eShotPressurePlan[];
    constraints?: {
      minTotalShots: number;
      maxTotalShots: number;
      minRealImagePlans: number;
      maxRealImagePlans: number;
      pressureRangeLabel: string;
      realImagePlanRangeLabel: string;
    };
  };
  quality?: {
    semanticQaStatus: "pass" | "needs_review" | "blocked";
    semanticQaRequired?: boolean;
    p0FindingCount?: number;
    p1FindingCount?: number;
    p2FindingCount?: number;
    gates?: string[];
  };
  notes?: string[];
}

export interface RealDemoE2eStageReport {
  stageId:
    | "ui_action"
    | "task_packet"
    | "worker_provenance"
    | "provider_observation"
    | "scoped_sandbox_output"
    | "watcher_event"
    | "manifest_match"
    | "qa_report"
    | "preview_update";
  label: string;
  status: RealDemoE2eStageStatus;
  required: true;
  evidence: boolean;
  blocker?: string;
}

export interface RealDemoE2eReport {
  schemaVersion: string;
  generatedAt: string;
  phase: "real_demo_e2e_readiness_harness";
  projectId: string;
  runId: string;
  scenarioId: string;
  status: RealDemoE2eStatus;
  declaration: RealDemoE2eInput["declaration"];
  userFacingSummary: string;
  chain: {
    generatedByUiAction: boolean;
    validatedEnvelope: boolean;
    workerSubagentProvenancePresent: boolean;
    providerCallObserved: boolean;
    providerObservationMode: RealDemoE2eProviderObservationMode;
    outputCameFromScopedSandbox: boolean;
    watcherEventObserved: boolean;
    manifestMatched: boolean;
    qaReportObserved: boolean;
    previewUpdatedFromOutput: boolean;
    providerSelfReportCompletesTask: boolean;
    providerSelfReportIgnoredForCompletion: true;
    stages: RealDemoE2eStageReport[];
  };
  projectFacts: RealDemoE2eProjectFactsEvidence & {
    allRequiredFactsPresent: boolean;
  };
  integrity: RealDemoE2eIntegrityEvidence & {
    noManualFileCopy: boolean;
    noFixtureReuse: boolean;
    noSimulatedState: boolean;
  };
  pressure?: {
    totalShots: number;
    realImagePlanCount: number;
    queuedOrParkedCount: number;
    allowedRealImagePlanRange: string;
    pressureRange: string;
    shotPlans: RealDemoE2eShotPressurePlan[];
    allShotPlansHaveProvenance: boolean;
    status: "ready" | "blocked";
    blockers: string[];
  };
  quality?: {
    semanticQaStatus: "pass" | "needs_review" | "blocked";
    semanticQaRequired: boolean;
    p0FindingCount: number;
    p1FindingCount: number;
    p2FindingCount: number;
    gates: string[];
  };
  completionClaim: {
    readinessHarnessPassed: boolean;
    realProviderGenerationCompleted: boolean;
    realGenerationCompletedClaimAllowed: boolean;
    note: string;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function hasWorkerProvenance(provenance: RealDemoE2eWorkerProvenance | undefined): boolean {
  if (!provenance) return false;
  return Boolean(
    (provenance.workerId || provenance.subagentId) &&
      provenance.taskRunId &&
      provenance.taskPacketId &&
      provenance.envelopeId &&
      provenance.outputPath,
  );
}

function stage(
  stageId: RealDemoE2eStageReport["stageId"],
  label: string,
  evidence: boolean,
  blocker: string,
): RealDemoE2eStageReport {
  return {
    stageId,
    label,
    status: evidence ? "pass" : "blocked",
    required: true,
    evidence,
    ...(evidence ? {} : { blocker }),
  };
}

function pressureReport(input: RealDemoE2eInput): RealDemoE2eReport["pressure"] {
  if (!input.pressure) return undefined;
  const pressure = input.pressure;
  const constraints = pressure.constraints || {
    minTotalShots: 6,
    maxTotalShots: 10,
    minRealImagePlans: 1,
    maxRealImagePlans: 3,
    pressureRangeLabel: "6-10_shots",
    realImagePlanRangeLabel: "1-3",
  };
  const shotCountInRange =
    pressure.totalShots >= constraints.minTotalShots && pressure.totalShots <= constraints.maxTotalShots;
  const realImagePlanCountInRange =
    pressure.realImagePlanCount >= constraints.minRealImagePlans &&
    pressure.realImagePlanCount <= constraints.maxRealImagePlans;
  const shotPlanCountMatches = pressure.shotPlans.length === pressure.totalShots;
  const queuedOrParkedCountMatches =
    pressure.shotPlans.filter((shot) => shot.status === "queued" || shot.status === "parked").length === pressure.queuedOrParkedCount;
  const realImagePlanCountMatches =
    pressure.shotPlans.filter((shot) => shot.status === "real_image_planned").length === pressure.realImagePlanCount;
  const allShotPlansHaveProvenance = pressure.shotPlans.every((shot) =>
    Boolean(shot.shotId && shot.taskPacketId && shot.envelopeId && shot.workerProvenanceId && shot.expectedOutputPath),
  );

  const blockers = unique([
    shotCountInRange ? "" : `Pressure readiness must cover ${constraints.pressureRangeLabel}.`,
    realImagePlanCountInRange
      ? ""
      : `Pressure readiness may plan only ${constraints.realImagePlanRangeLabel} real Image2 outputs.`,
    shotPlanCountMatches ? "" : "Pressure shotPlans must match totalShots.",
    queuedOrParkedCountMatches ? "" : "Queued/parked shot count must match the shot plan.",
    realImagePlanCountMatches ? "" : "Real image plan count must match the shot plan.",
    allShotPlansHaveProvenance ? "" : "Every pressure shot plan must carry task packet, envelope, worker provenance, and expected output path.",
  ]);

  return {
    totalShots: pressure.totalShots,
    realImagePlanCount: pressure.realImagePlanCount,
    queuedOrParkedCount: pressure.queuedOrParkedCount,
    allowedRealImagePlanRange: constraints.realImagePlanRangeLabel,
    pressureRange: constraints.pressureRangeLabel,
    shotPlans: pressure.shotPlans,
    allShotPlansHaveProvenance,
    status: blockers.length ? "blocked" : "ready",
    blockers,
  };
}

export function buildRealDemoE2eReport(input: RealDemoE2eInput): RealDemoE2eReport {
  const workerSubagentProvenancePresent = hasWorkerProvenance(input.chain.workerProvenance);
  const stages = [
    stage("ui_action", "UI operation", input.chain.generatedByUiAction, "The run must start from a UI action, not a script-only state patch."),
    stage("task_packet", "Validated task packet/envelope", input.chain.validatedEnvelope, "A validated task packet and subagent envelope are required."),
    stage("worker_provenance", "Worker/subagent provenance", workerSubagentProvenancePresent, "Worker or subagent provenance must include task run, packet, envelope, and output path."),
    stage("provider_observation", "Image2 provider observation", input.chain.providerCallObserved, "A provider call observation is required for readiness evidence."),
    stage("scoped_sandbox_output", "Scoped sandbox output", input.chain.outputCameFromScopedSandbox, "The output must come from the scoped sandbox."),
    stage("watcher_event", "Watcher event", input.chain.watcherEventObserved, "A watcher event must observe the expected output."),
    stage("manifest_match", "Manifest match", input.chain.manifestMatched, "The returned output must match manifest expectations."),
    stage("qa_report", "QA report", input.chain.qaReportObserved, "A QA report must be observed before readiness is claimed."),
    stage("preview_update", "Preview update", input.chain.previewUpdatedFromOutput, "Preview must update from the returned output."),
  ];

  const allRequiredFactsPresent =
    input.projectFacts.projectVibePresent &&
    input.projectFacts.sourceIndexPresent &&
    input.projectFacts.visualMemoryPresent &&
    input.projectFacts.shotLayoutPresent;
  const pressure = pressureReport(input);
  const quality = input.quality
    ? {
        semanticQaStatus: input.quality.semanticQaStatus,
        semanticQaRequired: input.quality.semanticQaRequired ?? true,
        p0FindingCount: input.quality.p0FindingCount || 0,
        p1FindingCount: input.quality.p1FindingCount || 0,
        p2FindingCount: input.quality.p2FindingCount || 0,
        gates: input.quality.gates || [],
      }
    : undefined;

  const blockers = unique([
    ...stages.map((item) => (item.status === "blocked" ? item.blocker : "")),
    allRequiredFactsPresent ? "" : "project.vibe, source index, visual memory, and shot layout are all required before a real-chain readiness run.",
    input.chain.providerSelfReportCompletesTask ? "Provider self-report must never complete a task." : "",
    input.integrity.manualFileCopyDetected ? "Manual file copy detected; this cannot count as a real software-chain result." : "",
    input.integrity.fixtureReuseDetected ? "Fixture reuse detected; this cannot count as a real software-chain result." : "",
    input.integrity.simulatedStateDetected ? "Simulated state detected; this cannot count as a real software-chain result." : "",
    pressure && pressure.status === "blocked" ? "Pressure readiness constraints failed." : "",
    quality && quality.semanticQaStatus === "blocked" ? "Semantic QA gates blocked the real output review." : "",
  ]);
  const qualityNeedsReview = quality?.semanticQaStatus === "needs_review";

  const readinessHarnessPassed = blockers.length === 0 && !qualityNeedsReview;
  const realProviderGenerationCompleted =
    readinessHarnessPassed &&
    input.declaration === "actual_provider_observed" &&
    input.chain.providerObservationMode === "actual_provider_call_observed";
  const status: RealDemoE2eStatus = blockers.length
    ? "blocked"
    : qualityNeedsReview
      ? "needs_review"
      : "ready_for_real_chain_pressure_test";
  const warning = input.chain.providerObservationMode !== "actual_provider_call_observed"
    ? "Readiness evidence is complete, but no actual provider observation is present; do not claim real generation completion."
    : "";
  const qualityWarning = qualityNeedsReview
    ? "Semantic QA has P1 findings; review is required before claiming a clean pass."
    : "";

  return {
    schemaVersion: realDemoE2eSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "real_demo_e2e_readiness_harness",
    projectId: input.projectId,
    runId: input.runId,
    scenarioId: input.scenarioId,
    status,
    declaration: input.declaration,
    userFacingSummary: readinessHarnessPassed
      ? "真实链路压力测试 readiness 通过；这只证明证据链完整，不等于已完成真实生成。"
      : qualityNeedsReview
        ? "真实链路压力测试已拿到证据链，但语义 QA 有 P1 问题；需要复核后才能宣称 clean pass。"
        : "真实链路压力测试 readiness 阻断；不能宣称真实链路完成。",
    chain: {
      generatedByUiAction: input.chain.generatedByUiAction,
      validatedEnvelope: input.chain.validatedEnvelope,
      workerSubagentProvenancePresent,
      providerCallObserved: input.chain.providerCallObserved,
      providerObservationMode: input.chain.providerObservationMode,
      outputCameFromScopedSandbox: input.chain.outputCameFromScopedSandbox,
      watcherEventObserved: input.chain.watcherEventObserved,
      manifestMatched: input.chain.manifestMatched,
      qaReportObserved: input.chain.qaReportObserved,
      previewUpdatedFromOutput: input.chain.previewUpdatedFromOutput,
      providerSelfReportCompletesTask: input.chain.providerSelfReportCompletesTask,
      providerSelfReportIgnoredForCompletion: true,
      stages,
    },
    projectFacts: {
      ...input.projectFacts,
      allRequiredFactsPresent,
    },
    integrity: {
      ...input.integrity,
      noManualFileCopy: !input.integrity.manualFileCopyDetected,
      noFixtureReuse: !input.integrity.fixtureReuseDetected,
      noSimulatedState: !input.integrity.simulatedStateDetected,
    },
    ...(pressure ? { pressure } : {}),
    ...(quality ? { quality } : {}),
    completionClaim: {
      readinessHarnessPassed,
      realProviderGenerationCompleted,
      realGenerationCompletedClaimAllowed: realProviderGenerationCompleted,
      note: realProviderGenerationCompleted
        ? "Actual provider observation and all return-path gates are present."
        : "This report is readiness/harness evidence only unless actual_provider_call_observed is present.",
    },
    blockers,
    warnings: unique([warning, qualityWarning]),
    notes: unique([
      "Provider self-report is retained as evidence but cannot complete a task.",
      "Watcher, manifest, QA, and preview update are required return-path gates.",
      ...(input.notes || []),
    ]),
  };
}
