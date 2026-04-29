import type { ManifestMatchReport } from "./manifestMatcher";
import type {
  AssetReadinessReport,
  AudioPlan,
  AudioPlanningState,
  CheckpointResumeHarnessState,
  FilesystemWatcherHarnessState,
  GateStatus,
  GenerationHarnessState,
  GenerationHealthReport,
  QaHarnessDimensionId,
  QaHarnessDimensionResult,
  QaHarnessHardLocks,
  QaHarnessItem,
  QaHarnessOverallSequence,
  QaHarnessSourceCoverageEntry,
  QaHarnessSourceLayer,
  QaHarnessState,
  QaPromotionReport,
  PromptConflictReport,
  Severity,
  ShotPromptPlan,
  ShotRecord,
  VideoPlanningState,
} from "./types";

export interface BuildQaHarnessInput {
  generatedAt: string;
  generationHealthReports: GenerationHealthReport[];
  qaPromotionReports: QaPromotionReport[];
  manifestMatches: ManifestMatchReport[];
  assetReadinessReports: AssetReadinessReport[];
  promptPlans: ShotPromptPlan[];
  promptConflictReports: PromptConflictReport[];
  generationHarness: GenerationHarnessState;
  filesystemWatcherHarness: FilesystemWatcherHarnessState;
  checkpointResumeHarness: CheckpointResumeHarnessState;
  videoPlanning: VideoPlanningState;
  audioPlanning: AudioPlanningState;
  storyFlowShots: ShotRecord[];
}

export const qaHarnessDimensionOrder: QaHarnessDimensionId[] = [
  "whole_film",
  "identity",
  "scene",
  "pair",
  "story",
  "prop",
  "style",
  "motion",
  "audio",
];

export const qaHarnessSourceLayers: QaHarnessSourceLayer[] = [
  "generationHealthReports",
  "qaPromotionReports",
  "manifestMatches",
  "assetReadinessReports",
  "promptPlans",
  "promptConflictReports",
  "generationHarness",
  "filesystemWatcherHarness",
  "checkpointResumeHarness",
  "videoPlanning",
  "audioPlanning",
  "storyFlow.shots",
];

export const qaHarnessHardLocks: QaHarnessHardLocks = {
  dryRunOnly: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noFileMutation: true,
  noAutoPromotion: true,
  semanticRepairForbidden: true,
  workerSelfReportCannotPassQa: true,
  overallFirst: true,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function hasManifestMatch(status: string | undefined): boolean {
  return Boolean(status && ["actual_output_present", "complete", "matched"].includes(status));
}

function severityFor(status: GateStatus, blockers: string[], warnings: string[]): Severity {
  if (status === "FAIL" || blockers.length) return "blocker";
  if (status === "PARTIAL" || status === "UNKNOWN" || warnings.length) return "warning";
  return "info";
}

function makeDimension(input: {
  dimensionId: QaHarnessDimensionId;
  status: GateStatus;
  blockers?: string[];
  warnings?: string[];
  sourceRefs?: string[];
  notes?: string[];
}): QaHarnessDimensionResult {
  const blockers = uniqueSorted(input.blockers || []);
  const warnings = uniqueSorted(input.warnings || []);
  return {
    dimensionId: input.dimensionId,
    status: blockers.length ? "FAIL" : input.status,
    severity: severityFor(blockers.length ? "FAIL" : input.status, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: uniqueSorted(input.sourceRefs || []),
    notes: uniqueSorted(input.notes || []),
  };
}

function statusWithWarnings(base: GateStatus, blockers: string[], warnings: string[]): GateStatus {
  if (blockers.length || base === "FAIL") return "FAIL";
  if (base === "PASS" && warnings.length) return "PARTIAL";
  return base;
}

function aggregateStatus(statuses: GateStatus[]): GateStatus {
  if (!statuses.length) return "UNKNOWN";
  if (statuses.some((status) => status === "FAIL")) return "FAIL";
  const nonNa = statuses.filter((status) => status !== "N/A");
  if (!nonNa.length) return "N/A";
  if (nonNa.every((status) => status === "PASS")) return "PASS";
  if (nonNa.every((status) => status === "UNKNOWN")) return "UNKNOWN";
  return "PARTIAL";
}

function coverageFromRefs(refsByLayer: Partial<Record<QaHarnessSourceLayer, string[]>>): QaHarnessSourceCoverageEntry[] {
  return qaHarnessSourceLayers.map((layer) => {
    const sourceRefs = uniqueSorted(refsByLayer[layer] || []);
    return {
      layer,
      referenced: sourceRefs.length > 0,
      referenceCount: sourceRefs.length,
      sourceRefs,
      notes: sourceRefs.length ? [`Referenced ${sourceRefs.length} ${layer} fact(s).`] : [`No ${layer} fact was linked.`],
    };
  });
}

function mergeCoverage(entries: QaHarnessSourceCoverageEntry[]): QaHarnessSourceCoverageEntry[] {
  const refsByLayer: Partial<Record<QaHarnessSourceLayer, string[]>> = {};
  for (const entry of entries) {
    refsByLayer[entry.layer] = [...(refsByLayer[entry.layer] || []), ...entry.sourceRefs];
  }
  return coverageFromRefs(refsByLayer);
}

function manifestRefs(reports: ManifestMatchReport[]): string[] {
  return reports.map((report) => `manifest_match:${report.taskId}:${report.status}`);
}

function reportIdsForShot<T extends { shotId: string }>(items: T[], shotId: string): T[] {
  return items.filter((item) => item.shotId === shotId);
}

function promptConflictsForShot(conflictReports: PromptConflictReport[], promptPlans: ShotPromptPlan[]): PromptConflictReport[] {
  const promptPlanIds = new Set(promptPlans.map((plan) => plan.promptPlanId));
  return conflictReports.filter((report) => (report.shotId && promptPlans.some((plan) => plan.shotId === report.shotId)) || promptPlanIds.has(report.promptPlanId));
}

function linkedManifestReports(
  reports: ManifestMatchReport[],
  healthReports: GenerationHealthReport[],
  promotionReports: QaPromotionReport[],
): ManifestMatchReport[] {
  const taskIds = new Set([
    ...healthReports.flatMap((report) => [report.taskPlanId, report.jobId]),
    ...promotionReports.flatMap((report) => [report.taskPlanId, report.jobId]),
  ]);
  return reports.filter((report) => taskIds.has(report.taskId));
}

function readinessWarnings(readiness?: AssetReadinessReport): string[] {
  if (!readiness) return ["No asset readiness report is linked to this shot."];
  if (readiness.status === "draft_only" || readiness.formalBlocked) {
    return ["Asset readiness keeps this shot draft-only for formal promotion.", ...readiness.warnings];
  }
  return readiness.warnings;
}

function evaluateReferenceDimension(input: {
  dimensionId: "identity" | "scene" | "prop";
  shot: ShotRecord;
  readiness?: AssetReadinessReport;
}): QaHarnessDimensionResult {
  const base = input.shot.gates[input.dimensionId];
  const blockers = [
    ...(base === "FAIL" ? [`Story Flow ${input.dimensionId} gate is FAIL.`] : []),
    ...(input.readiness && input.readiness.status === "blocked" && base !== "N/A"
      ? input.readiness.blockers.length
        ? input.readiness.blockers
        : ["Asset readiness is blocked for this shot."]
      : []),
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? [`Story Flow ${input.dimensionId} gate is UNKNOWN.`] : []),
    ...(base === "PARTIAL" ? [`Story Flow ${input.dimensionId} gate is PARTIAL.`] : []),
    ...(base === "N/A" ? [] : readinessWarnings(input.readiness)),
  ];
  const sourceRefs = [
    `storyFlow.shots:${input.shot.id}`,
    input.readiness?.reportId || "",
    ...(input.readiness?.safeReferenceIds || []),
    ...(input.readiness?.missingReferenceIds || []),
  ];

  return makeDimension({
    dimensionId: input.dimensionId,
    status: base === "N/A" ? "N/A" : statusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs,
    notes: [`Uses Story Flow ${input.dimensionId} gate and shot-level asset readiness facts.`],
  });
}

function evaluatePairDimension(input: {
  shot: ShotRecord;
  videoGate?: VideoPlanningState["readinessGates"][number];
}): QaHarnessDimensionResult {
  const base = input.shot.gates.pair;
  const pairBlockedChecks = input.videoGate?.checks.filter(
    (check) => check.status === "blocked" && /pair|frame|derivation/i.test(`${check.id} ${check.label}`),
  ) || [];
  const blockers = [
    ...(base === "FAIL" ? ["Story Flow pair gate is FAIL."] : []),
    ...pairBlockedChecks.map((check) => check.detail),
    ...(!input.shot.startFrame ? ["Shot is missing a start frame reference."] : []),
    ...(!input.shot.endFrame ? ["Shot is missing an end frame reference."] : []),
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? ["Story Flow pair gate is UNKNOWN."] : []),
    ...(base === "PARTIAL" ? ["Story Flow pair gate is PARTIAL."] : []),
    ...(input.videoGate ? [] : ["No video readiness gate is linked to this shot."]),
  ];

  return makeDimension({
    dimensionId: "pair",
    status: statusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [`storyFlow.shots:${input.shot.id}`, input.videoGate?.gateId || ""],
    notes: ["Pair QA combines Story Flow pair gate, start/end frame presence, and video readiness derivation facts."],
  });
}

function evaluateStoryDimension(input: {
  shot: ShotRecord;
  promptPlans: ShotPromptPlan[];
  conflictReports: PromptConflictReport[];
}): QaHarnessDimensionResult {
  const base = input.shot.gates.story;
  const conflictBlockers = input.conflictReports.flatMap((report) =>
    report.conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail),
  );
  const conflictWarnings = input.conflictReports.flatMap((report) =>
    report.conflicts.filter((conflict) => conflict.severity !== "blocker").map((conflict) => conflict.detail),
  );
  const blockers = [
    ...(base === "FAIL" ? ["Story Flow story gate is FAIL."] : []),
    ...conflictBlockers,
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? ["Story Flow story gate is UNKNOWN."] : []),
    ...(base === "PARTIAL" ? ["Story Flow story gate is PARTIAL."] : []),
    ...(input.shot.storyFunction ? [] : ["Shot storyFunction is missing."]),
    ...(input.promptPlans.length ? [] : ["No prompt plan is linked to this shot."]),
    ...conflictWarnings,
  ];

  return makeDimension({
    dimensionId: "story",
    status: statusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [
      `storyFlow.shots:${input.shot.id}`,
      ...input.promptPlans.map((plan) => plan.promptPlanId),
      ...input.conflictReports.map((report) => report.reportId),
    ],
    notes: ["Story QA stays diagnostic: prompt conflicts can block, but 8.7 does not rewrite story semantics."],
  });
}

function evaluateStyleDimension(input: {
  shot: ShotRecord;
  promptPlans: ShotPromptPlan[];
  conflictReports: PromptConflictReport[];
  readiness?: AssetReadinessReport;
}): QaHarnessDimensionResult {
  const base = input.shot.gates.style;
  const hasStyleDirectives = input.promptPlans.some((plan) => plan.styleDirectives.length > 0);
  const conflictBlockers = input.conflictReports.flatMap((report) =>
    report.conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail),
  );
  const conflictWarnings = input.conflictReports.flatMap((report) =>
    report.conflicts.filter((conflict) => conflict.severity !== "blocker").map((conflict) => conflict.detail),
  );
  const blockers = [
    ...(base === "FAIL" ? ["Story Flow style gate is FAIL."] : []),
    ...conflictBlockers,
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? ["Story Flow style gate is UNKNOWN."] : []),
    ...(base === "PARTIAL" ? ["Story Flow style gate is PARTIAL."] : []),
    ...(input.promptPlans.length ? [] : ["No prompt plan is linked to this shot."]),
    ...(hasStyleDirectives ? [] : ["No style directives are present in linked prompt plans."]),
    ...(input.readiness?.formalBlocked ? ["Asset readiness blocks formal style reference promotion."] : []),
    ...conflictWarnings,
  ];

  return makeDimension({
    dimensionId: "style",
    status: statusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [
      `storyFlow.shots:${input.shot.id}`,
      input.readiness?.reportId || "",
      ...input.promptPlans.flatMap((plan) => [plan.promptPlanId, ...plan.styleDirectives]),
      ...input.conflictReports.map((report) => report.reportId),
    ],
    notes: ["Style QA uses Story Flow style gate plus prompt style directives and conflict reports."],
  });
}

function evaluateMotionDimension(input: {
  shot: ShotRecord;
  videoTaskPlan?: VideoPlanningState["taskPlans"][number];
  videoGate?: VideoPlanningState["readinessGates"][number];
}): QaHarnessDimensionResult {
  if (!input.videoTaskPlan) {
    return makeDimension({
      dimensionId: "motion",
      status: "UNKNOWN",
      warnings: ["No video task plan is linked to this shot."],
      sourceRefs: [`storyFlow.shots:${input.shot.id}`],
      notes: ["Motion QA needs video planning facts; no provider submit or semantic inspection is run by 8.7."],
    });
  }

  const blockers = input.videoTaskPlan.status === "blocked" ? input.videoTaskPlan.blockers : [];
  const warnings = [
    ...input.videoTaskPlan.warnings,
    ...(input.videoTaskPlan.status === "parked" ? ["Video provider remains parked; motion output is not explicitly QA-passed."] : []),
    ...(input.videoTaskPlan.status === "ready" ? ["Video task is only a plan; no motion output QA pass is recorded by 8.7."] : []),
  ];
  const status: GateStatus = blockers.length ? "FAIL" : input.videoTaskPlan.status === "parked" || input.videoTaskPlan.status === "ready" ? "PARTIAL" : "UNKNOWN";

  return makeDimension({
    dimensionId: "motion",
    status,
    blockers,
    warnings,
    sourceRefs: [input.videoTaskPlan.taskPlanId, input.videoGate?.gateId || ""],
    notes: ["Motion QA is derived from video planning/readiness only; Seedance/Jimeng submit remains forbidden."],
  });
}

function evaluateAudioDimension(input: { shot: ShotRecord; audioPlan?: AudioPlan }): QaHarnessDimensionResult {
  const audioPlanId = `audio_plan_${safeId(input.shot.id)}`;
  if (!input.audioPlan) {
    return makeDimension({
      dimensionId: "audio",
      status: "UNKNOWN",
      warnings: ["No audio plan is linked to this shot."],
      sourceRefs: [`storyFlow.shots:${input.shot.id}`],
      notes: ["Audio QA needs audio planning facts; no audio provider is called by 8.7."],
    });
  }

  const base = input.audioPlan.outputPath ? input.audioPlan.audioQaStatus : "UNKNOWN";
  const blockers = base === "FAIL" ? ["Audio plan QA status is FAIL."] : [];
  const warnings = [
    ...(input.audioPlan.outputPath ? [] : ["Audio plan has no outputPath; audio QA cannot pass from planning facts only."]),
    ...(base === "PARTIAL" ? ["Audio plan QA status is PARTIAL."] : []),
    ...(base === "UNKNOWN" ? ["Audio plan QA status is UNKNOWN."] : []),
  ];

  return makeDimension({
    dimensionId: "audio",
    status: statusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [audioPlanId, input.audioPlan.outputPath || ""],
    notes: ["Audio QA uses audioPlanning shot plan facts only; TTS/music providers remain forbidden."],
  });
}

function formalPromotionGate(input: {
  promotion: QaPromotionReport;
  health?: GenerationHealthReport;
  manifest?: ManifestMatchReport;
  readiness?: AssetReadinessReport;
}): { eligible: boolean; reasons: string[] } {
  const manifestStatus = input.health?.manifestStatus || input.manifest?.status;
  const checks = [
    {
      pass: input.promotion.canPromoteToFormal === true,
      reason: `${input.promotion.reportId} does not have canPromoteToFormal=true.`,
    },
    {
      pass: input.health?.healthStatus === "formal_ready",
      reason: `${input.health?.reportId || input.promotion.taskPlanId} generation health is not formal_ready.`,
    },
    {
      pass: hasManifestMatch(manifestStatus),
      reason: `Manifest status is ${manifestStatus || "missing"}.`,
    },
    {
      pass: input.health?.stalePrompt === false && input.promotion.requiredGates.promptFresh === true,
      reason: "Prompt freshness gate is not satisfied.",
    },
    {
      pass:
        input.health?.assetReadinessStatus === "ready" &&
        input.promotion.requiredGates.assetReadiness === true &&
        input.readiness?.status === "ready" &&
        input.readiness.formalBlocked === false,
      reason: "Asset readiness gate is not satisfied.",
    },
    {
      pass: input.health?.qaStatus === "pass" && input.promotion.requiredGates.qaPass === true,
      reason: "Explicit QA pass is not satisfied.",
    },
    {
      pass: input.promotion.requiredGates.expectedOutput === true,
      reason: "Expected output gate is not satisfied.",
    },
    {
      pass: input.promotion.requiredGates.manifestMatch === true,
      reason: "QA promotion manifestMatch gate is not satisfied.",
    },
  ];
  const reasons = checks.filter((check) => !check.pass).map((check) => check.reason);
  return { eligible: reasons.length === 0, reasons };
}

function requiresHumanReview(dimensions: QaHarnessDimensionResult[], blockingReasons: string[]): boolean {
  return dimensions.some((dimension) => ["UNKNOWN", "FAIL", "PARTIAL"].includes(dimension.status) || dimension.blockers.length > 0) || blockingReasons.length > 0;
}

function buildItem(input: BuildQaHarnessInput, shot: ShotRecord): QaHarnessItem {
  const healthReports = reportIdsForShot(input.generationHealthReports, shot.id);
  const promotionReports = reportIdsForShot(input.qaPromotionReports, shot.id);
  const scopedManifestReports = linkedManifestReports(input.manifestMatches, healthReports, promotionReports);
  const readiness = input.assetReadinessReports.find((report) => report.shotId === shot.id);
  const promptPlans = input.promptPlans.filter((plan) => plan.shotId === shot.id);
  const conflictReports = promptConflictsForShot(input.promptConflictReports, promptPlans);
  const generationJobs = input.generationHarness.jobs.filter((job) => job.shotId === shot.id);
  const watcherStreams = input.filesystemWatcherHarness.streams.filter((stream) => stream.shotId === shot.id);
  const resumeItems = input.checkpointResumeHarness.items.filter((item) => item.shotId === shot.id);
  const videoTaskPlan = input.videoPlanning.taskPlans.find((plan) => plan.shotId === shot.id);
  const videoGate = input.videoPlanning.readinessGates.find((gate) => gate.shotId === shot.id);
  const audioPlan = input.audioPlanning.shotPlans.find((plan) => plan.shotId === shot.id);
  const healthByTaskPlan = new Map(healthReports.map((report) => [report.taskPlanId, report]));
  const manifestByTaskId = new Map(scopedManifestReports.map((report) => [report.taskId, report]));
  const formalGateResults = promotionReports.map((promotion) =>
    formalPromotionGate({
      promotion,
      health: healthByTaskPlan.get(promotion.taskPlanId),
      manifest: manifestByTaskId.get(promotion.taskPlanId) || manifestByTaskId.get(promotion.jobId),
      readiness,
    }),
  );
  const formalPromotionEligible = formalGateResults.length > 0 && formalGateResults.every((result) => result.eligible);
  const formalPromotionBlockedReasons = formalGateResults.length
    ? uniqueSorted(formalGateResults.flatMap((result) => result.reasons))
    : ["No QA promotion report is linked to this shot."];
  const dimensions = [
    makeDimension({
      dimensionId: "whole_film",
      status: "N/A",
      sourceRefs: [`storyFlow.shots:${shot.id}`],
      notes: ["Whole-film QA is emitted in qaHarness.overall before shot/item details."],
    }),
    evaluateReferenceDimension({ dimensionId: "identity", shot, readiness }),
    evaluateReferenceDimension({ dimensionId: "scene", shot, readiness }),
    evaluatePairDimension({ shot, videoGate }),
    evaluateStoryDimension({ shot, promptPlans, conflictReports }),
    evaluateReferenceDimension({ dimensionId: "prop", shot, readiness }),
    evaluateStyleDimension({ shot, promptPlans, conflictReports, readiness }),
    evaluateMotionDimension({ shot, videoTaskPlan, videoGate }),
    evaluateAudioDimension({ shot, audioPlan }),
  ];
  const refsByLayer: Partial<Record<QaHarnessSourceLayer, string[]>> = {
    generationHealthReports: healthReports.map((report) => report.reportId),
    qaPromotionReports: promotionReports.map((report) => report.reportId),
    manifestMatches: manifestRefs(scopedManifestReports),
    assetReadinessReports: readiness ? [readiness.reportId] : [],
    promptPlans: promptPlans.map((plan) => plan.promptPlanId),
    promptConflictReports: conflictReports.map((report) => report.reportId),
    generationHarness: generationJobs.map((job) => job.harnessJobId),
    filesystemWatcherHarness: watcherStreams.map((stream) => stream.streamId),
    checkpointResumeHarness: resumeItems.map((item) => item.resumeItemId),
    videoPlanning: uniqueSorted([videoTaskPlan?.taskPlanId || "", videoGate?.gateId || ""]),
    audioPlanning: audioPlan ? [`audio_plan_${safeId(shot.id)}`] : [],
    "storyFlow.shots": [shot.id],
  };
  const primaryGenerationJob = generationJobs[0];
  const primaryResumeItem = resumeItems[0];

  return {
    qaItemId: `qa_harness_item_${safeId(shot.id)}`,
    shotId: shot.id,
    taskPlanId: primaryGenerationJob?.taskPlanId || healthReports[0]?.taskPlanId || promotionReports[0]?.taskPlanId,
    jobId: primaryGenerationJob?.jobId || healthReports[0]?.jobId || promotionReports[0]?.jobId,
    harnessJobId: primaryGenerationJob?.harnessJobId,
    checkpointResumeItemId: primaryResumeItem?.resumeItemId,
    videoTaskPlanId: videoTaskPlan?.taskPlanId,
    audioPlanId: audioPlan ? `audio_plan_${safeId(shot.id)}` : undefined,
    dimensions,
    formalPromotionEligible,
    formalPromotionBlockedReasons: formalPromotionEligible ? [] : formalPromotionBlockedReasons,
    requiresHumanReview: requiresHumanReview(dimensions, formalPromotionEligible ? [] : formalPromotionBlockedReasons),
    sourceCoverage: coverageFromRefs(refsByLayer),
    notes: [
      "Phase 8.7 QA Harness emits diagnostics only; it cannot promote formal files or perform semantic repair.",
      formalPromotionEligible
        ? "Formal promotion gates are eligible, but 8.7 still does not promote files."
        : "Formal promotion remains blocked until promotion, health, manifest, prompt freshness, asset readiness, and explicit QA pass all agree.",
    ],
  };
}

function buildOverall(items: QaHarnessItem[]): QaHarnessOverallSequence {
  const dimensions = qaHarnessDimensionOrder.map((dimensionId) => {
    const scopedStatuses =
      dimensionId === "whole_film"
        ? items.flatMap((item) => item.dimensions.filter((dimension) => dimension.dimensionId !== "whole_film").map((dimension) => dimension.status))
        : items.flatMap((item) => item.dimensions.filter((dimension) => dimension.dimensionId === dimensionId).map((dimension) => dimension.status));
    const blockers = items.flatMap((item) =>
      item.dimensions
        .filter((dimension) => dimensionId === "whole_film" || dimension.dimensionId === dimensionId)
        .flatMap((dimension) => dimension.blockers),
    );
    const warnings = items.flatMap((item) =>
      item.dimensions
        .filter((dimension) => dimensionId === "whole_film" || dimension.dimensionId === dimensionId)
        .flatMap((dimension) => dimension.warnings),
    );
    const sourceRefs = items.flatMap((item) =>
      item.dimensions
        .filter((dimension) => dimensionId === "whole_film" || dimension.dimensionId === dimensionId)
        .flatMap((dimension) => dimension.sourceRefs),
    );
    const status = aggregateStatus(scopedStatuses);
    return makeDimension({
      dimensionId,
      status,
      blockers,
      warnings:
        status === "PARTIAL" && !warnings.length
          ? [`${dimensionId} has mixed PASS/N/A/UNKNOWN/PARTIAL shot-level facts.`]
          : warnings,
      sourceRefs,
      notes: [
        dimensionId === "whole_film"
          ? "Whole-film verdict is aggregated before shot/item detail."
          : `Aggregated ${dimensionId} verdict from shot-level QA item facts.`,
      ],
    });
  });
  const status = aggregateStatus(dimensions.map((dimension) => dimension.status));
  const blockers = uniqueSorted(dimensions.flatMap((dimension) => dimension.blockers));
  const warnings = uniqueSorted(dimensions.flatMap((dimension) => dimension.warnings));

  return {
    sequenceId: "qa_harness_overall_sequence",
    overallFirst: true,
    dimensions,
    status,
    severity: severityFor(status, blockers, warnings),
    requiresHumanReview: requiresHumanReview(dimensions, blockers),
    blockers,
    warnings,
    sourceCoverage: mergeCoverage(items.flatMap((item) => item.sourceCoverage)),
    notes: [
      "Overall/sequence QA is emitted before shot details by contract.",
      "Overall verdict is an evidence summary, not a provider execution or semantic repair step.",
    ],
  };
}

export function buildQaHarnessState(input: BuildQaHarnessInput): QaHarnessState {
  const items = input.storyFlowShots.map((shot) => buildItem(input, shot)).sort((left, right) => left.qaItemId.localeCompare(right.qaItemId));
  const overall = buildOverall(items);
  const failedItems = items.filter((item) => item.dimensions.some((dimension) => dimension.status === "FAIL")).length;
  const partialItems = items.filter((item) => item.dimensions.some((dimension) => dimension.status === "PARTIAL")).length;
  const unknownItems = items.filter((item) => item.dimensions.some((dimension) => dimension.status === "UNKNOWN")).length;

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    dimensionOrder: qaHarnessDimensionOrder,
    overall,
    items,
    summary: {
      totalItems: items.length,
      requiresHumanReview: items.filter((item) => item.requiresHumanReview).length,
      formalPromotionEligible: items.filter((item) => item.formalPromotionEligible).length,
      formalPromotionBlocked: items.filter((item) => !item.formalPromotionEligible).length,
      failedItems,
      partialItems,
      unknownItems,
      overallStatus: overall.status,
      overallFirst: true,
      dryRunOnly: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
    },
    sourceCoverage: mergeCoverage([...items.flatMap((item) => item.sourceCoverage), ...overall.sourceCoverage]),
    hardLocks: qaHarnessHardLocks,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    noAutoPromotion: true,
    planOnly: true,
    diagnosticsOnly: true,
    notes: [
      "Phase 8.7 QA Harness combines existing plan/fact/diagnostic layers only.",
      "It cannot submit providers, mutate files, promote formal outputs, or run semantic repair.",
      "No worker or provider self-report can pass QA; explicit QA and promotion gates remain required.",
    ],
  };
}
