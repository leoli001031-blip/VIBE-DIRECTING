import type {
  AssetReadinessReport,
  GenerationCandidateOutputStatus,
  GenerationHarnessForbiddenAction,
  GenerationHarnessJob,
  GenerationHarnessPostprocessPolicy,
  GenerationHarnessStage,
  GenerationHarnessStageStatus,
  GenerationHarnessState,
  GenerationHealthReport,
  Image2AdapterRequest,
  ImageTaskPlan,
  PromptConflictReport,
  QaPromotionReport,
  ShotPromptPlan,
  WatcherEvent,
} from "./types";

export interface BuildGenerationHarnessInput {
  generatedAt: string;
  imageTaskPlans: ImageTaskPlan[];
  promptPlans: ShotPromptPlan[];
  promptConflictReports: PromptConflictReport[];
  assetReadinessReports: AssetReadinessReport[];
  image2AdapterRequests: Image2AdapterRequest[];
  watcherEvents: WatcherEvent[];
  generationHealthReports: GenerationHealthReport[];
  qaPromotionReports: QaPromotionReport[];
}

export const generationHarnessForbiddenActions: GenerationHarnessForbiddenAction[] = [
  "live_submit",
  "provider_unlock",
  "prompt_bypass",
  "candidate_auto_promote",
  "semantic_postprocess_repair",
  "text_to_video_fallback",
];

export const generationHarnessPostprocessPolicy: GenerationHarnessPostprocessPolicy = {
  allowedLocalOperations: ["format_convert", "manifest_match", "metadata_probe", "resize", "thumbnail_preview"],
  semanticRepairAllowed: false,
  openCvSemanticRepairAllowed: false,
  localPostprocessCanChangeMeaning: false,
  localPostprocessCanPromoteFormal: false,
  notes: [
    "Local postprocess is limited to mechanical size, format, preview, metadata, and manifest checks.",
    "Semantic repair must be expressed as a new prompt/QA cycle, not OpenCV or local image manipulation.",
  ],
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function formalPathForCandidate(candidatePath: string): string {
  const normalized = candidatePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts.pop() || "formal-output";
  const directory = parts.join("/");
  return `${directory ? `${directory}/` : ""}formal/${fileName}`;
}

function stageStatus(blockers: string[], warnings: string[], waiting = false): GenerationHarnessStageStatus {
  if (blockers.length) return "blocked";
  if (waiting) return "waiting";
  if (warnings.length) return "warning";
  return "pass";
}

function makeStage(input: {
  stageId: GenerationHarnessStage["stageId"];
  label: string;
  sourceRefs?: string[];
  blockers?: string[];
  warnings?: string[];
  waiting?: boolean;
}): GenerationHarnessStage {
  const blockers = uniqueSorted(input.blockers || []);
  const warnings = uniqueSorted(input.warnings || []);
  return {
    stageId: input.stageId,
    label: input.label,
    status: stageStatus(blockers, warnings, input.waiting),
    sourceRefs: uniqueSorted(input.sourceRefs || []),
    blockers,
    warnings,
  };
}

function isImageSlot(taskPlan: ImageTaskPlan): boolean {
  return (
    taskPlan.providerSlot === "image.generate" ||
    taskPlan.providerSlot === "image.edit" ||
    taskPlan.providerSlot === "image.reference_asset"
  );
}

function requestPreview(taskPlan: ImageTaskPlan, request?: Image2AdapterRequest): GenerationHarnessJob["providerRequestPreview"] {
  return {
    requestId: request?.requestId,
    adapterId: request?.adapterId,
    operation: request?.operation,
    outputPath: request?.payload.outputPath || taskPlan.expectedOutputPath,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    liveSubmitForbidden: true,
    forbiddenFallbacks: uniqueSorted([
      ...(request?.forbiddenFallbacks || []),
      "provider_or_mode_fallback",
      "text_to_video_fallback",
    ]),
  };
}

function candidateStatus(
  taskPlan: ImageTaskPlan,
  health?: GenerationHealthReport,
  promotion?: QaPromotionReport,
): GenerationCandidateOutputStatus {
  if (promotion?.canPromoteToFormal) return "formal_ready";
  if (taskPlan.status === "blocked" || health?.healthStatus === "blocked" || health?.healthStatus === "failed") return "blocked";
  if (!health?.outputExists) return "missing";
  if (promotion?.promotionStatus === "qa_pending" || health.qaStatus === "pending" || health.qaStatus === "missing") return "qa_pending";
  return "candidate";
}

function nextAction(status: GenerationCandidateOutputStatus, health?: GenerationHealthReport, promotion?: QaPromotionReport): string {
  if (status === "formal_ready") return "Explicit QA, health, and promotion gates pass; formal promotion can be requested manually.";
  if (status === "qa_pending") return "Wait for explicit QA pass before formal promotion.";
  if (status === "missing") return "Wait for expected candidate output and manifest match.";
  if (status === "blocked") return "Resolve harness blockers before any provider request or promotion.";
  return promotion?.blockers[0] || health?.nextAction || "Candidate exists; run QA gate next.";
}

function buildStages(input: {
  taskPlan: ImageTaskPlan;
  promptPlan?: ShotPromptPlan;
  conflictReport?: PromptConflictReport;
  readinessReport?: AssetReadinessReport;
  adapterRequest?: Image2AdapterRequest;
  healthReport?: GenerationHealthReport;
  promotionReport?: QaPromotionReport;
  watcherEvents: WatcherEvent[];
}): GenerationHarnessStage[] {
  const {
    taskPlan,
    promptPlan,
    conflictReport,
    readinessReport,
    adapterRequest,
    healthReport,
    promotionReport,
    watcherEvents,
  } = input;
  const readinessBlockers = readinessReport?.blockers || [];
  const readinessWarnings = readinessReport?.warnings || [];
  const conflictBlockers = conflictReport?.conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail) || [];
  const conflictWarnings = conflictReport?.conflicts.filter((conflict) => conflict.severity !== "blocker").map((conflict) => conflict.detail) || [];
  const hasWatcherCandidate = watcherEvents.some((event) =>
    ["temp_output_detected", "expected_output_detected", "provider_ready_derivative_detected"].includes(event.eventType),
  );

  return [
    makeStage({
      stageId: "shot_spec",
      label: "Shot Spec",
      sourceRefs: [taskPlan.sourceShotSpecHash, promptPlan?.sourceShotSpecHash || ""],
      blockers: promptPlan ? [] : ["Shot prompt plan is missing, so the source shot spec cannot be audited."],
    }),
    makeStage({
      stageId: "visual_memory",
      label: "Visual Memory",
      sourceRefs: readinessReport ? [readinessReport.reportId, ...readinessReport.safeReferenceIds] : [],
      blockers: readinessReport ? readinessBlockers : ["Asset readiness report is missing."],
      warnings: readinessReport ? readinessWarnings : [],
    }),
    makeStage({
      stageId: "spatial_memory",
      label: "Spatial Memory",
      sourceRefs: readinessReport ? [readinessReport.reportId, ...readinessReport.lockedReferenceIds] : [],
      blockers: readinessReport?.status === "blocked" ? readinessBlockers : [],
      warnings: readinessReport ? readinessWarnings : ["No shot-level spatial readiness evidence was available."],
    }),
    makeStage({
      stageId: "shot_layout",
      label: "Shot Layout",
      sourceRefs: [taskPlan.taskEnvelopeSummary?.envelopeId || "", taskPlan.sourceShotSpecHash],
      blockers: taskPlan.taskEnvelopeSummary ? [] : ["Task envelope summary is missing."],
      warnings: taskPlan.taskEnvelopeSummary?.preflightStatus === "warning" ? ["Task envelope preflight has warnings."] : [],
    }),
    makeStage({
      stageId: "style_capsule",
      label: "Style Capsule",
      sourceRefs: promptPlan?.styleDirectives || [],
      blockers: promptPlan ? [] : ["Prompt plan is missing style capsule directives."],
      warnings: promptPlan && promptPlan.styleDirectives.length === 0 ? ["No style capsule directives were routed into the prompt plan."] : [],
    }),
    makeStage({
      stageId: "shot_prompt_plan",
      label: "Shot Prompt Plan",
      sourceRefs: [taskPlan.promptPlanId, promptPlan?.promptPlanHash || "", conflictReport?.reportId || ""],
      blockers: uniqueSorted([...(promptPlan?.blockers || []), ...conflictBlockers]),
      warnings: conflictWarnings,
    }),
    makeStage({
      stageId: "provider_capability_check",
      label: "Provider Capability Check",
      sourceRefs: [taskPlan.providerId, taskPlan.providerSlot, taskPlan.requiredMode],
      blockers: [
        ...taskPlan.blockers,
        ...(isImageSlot(taskPlan) ? [] : ["Only Image2 image slots can reach the Phase 8.4 harness request preview."]),
      ],
      warnings: taskPlan.warnings,
    }),
    makeStage({
      stageId: "provider_request_preview",
      label: "Provider Request Preview",
      sourceRefs: [adapterRequest?.requestId || ""],
      blockers: adapterRequest
        ? []
        : taskPlan.status === "ready_for_dry_run" || taskPlan.status === "ready_for_manual_submit"
          ? ["Ready task plan is missing an Image2 dry-run adapter request preview."]
          : [],
      warnings: adapterRequest ? [] : ["No provider request preview is emitted while upstream gates are draft or blocked."],
      waiting: !adapterRequest && taskPlan.status !== "blocked",
    }),
    makeStage({
      stageId: "candidate_output",
      label: "Candidate Output",
      sourceRefs: [
        taskPlan.expectedOutputPath,
        healthReport?.reportId || "",
        ...watcherEvents.map((event) => event.id),
      ],
      blockers: healthReport?.healthStatus === "blocked" || healthReport?.healthStatus === "failed" ? healthReport.blockers : [],
      warnings: [
        ...(healthReport?.warnings || []),
        ...(hasWatcherCandidate ? [] : ["No watcher event has confirmed a candidate output yet."]),
      ],
      waiting: !healthReport?.outputExists,
    }),
    makeStage({
      stageId: "qa_gate",
      label: "QA Gate",
      sourceRefs: [promotionReport?.reportId || "", healthReport?.reportId || ""],
      blockers: promotionReport?.canPromoteToFormal ? [] : promotionReport?.blockers || ["QA promotion report is missing."],
      warnings: promotionReport?.warnings || [],
      waiting: healthReport?.qaStatus === "pending" || healthReport?.qaStatus === "missing",
    }),
  ];
}

export function buildGenerationHarnessState(input: BuildGenerationHarnessInput): GenerationHarnessState {
  const promptById = new Map(input.promptPlans.map((plan) => [plan.promptPlanId, plan]));
  const conflictByPlanId = new Map(input.promptConflictReports.map((report) => [report.promptPlanId, report]));
  const readinessByShot = new Map(input.assetReadinessReports.map((report) => [report.shotId, report]));
  const requestByTaskPlan = new Map(input.image2AdapterRequests.map((request) => [request.taskPlanId, request]));
  const healthByTaskPlan = new Map(input.generationHealthReports.map((report) => [report.taskPlanId, report]));
  const promotionByTaskPlan = new Map(input.qaPromotionReports.map((report) => [report.taskPlanId, report]));

  const jobs = input.imageTaskPlans.map((taskPlan): GenerationHarnessJob => {
    const promptPlan = promptById.get(taskPlan.promptPlanId);
    const healthReport = healthByTaskPlan.get(taskPlan.taskPlanId);
    const promotionReport = promotionByTaskPlan.get(taskPlan.taskPlanId);
    const scopedWatcherEvents = input.watcherEvents.filter(
      (event) => event.taskId === taskPlan.taskPlanId || event.jobId === taskPlan.jobId,
    );
    const stages = buildStages({
      taskPlan,
      promptPlan,
      conflictReport: conflictByPlanId.get(taskPlan.promptPlanId),
      readinessReport: readinessByShot.get(taskPlan.shotId),
      adapterRequest: requestByTaskPlan.get(taskPlan.taskPlanId),
      healthReport,
      promotionReport,
      watcherEvents: scopedWatcherEvents,
    });
    const status = candidateStatus(taskPlan, healthReport, promotionReport);
    const stageBlockers = stages.flatMap((stage) => stage.blockers);
    const stageWarnings = stages.flatMap((stage) => stage.warnings);

    return {
      harnessJobId: `generation_harness_${taskPlan.taskPlanId}`,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      taskPlanId: taskPlan.taskPlanId,
      promptPlanId: taskPlan.promptPlanId,
      providerId: taskPlan.providerId,
      providerSlot: taskPlan.providerSlot,
      requiredMode: taskPlan.requiredMode,
      dryRunOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      forbiddenActions: generationHarnessForbiddenActions,
      stages,
      providerRequestPreview: requestPreview(taskPlan, requestByTaskPlan.get(taskPlan.taskPlanId)),
      candidateOutput: {
        status,
        candidatePath: promotionReport?.candidatePath || taskPlan.expectedOutputPath,
        formalPath: promotionReport?.formalPath || formalPathForCandidate(taskPlan.expectedOutputPath),
        expectedOutputPath: taskPlan.expectedOutputPath,
        outputExists: Boolean(healthReport?.outputExists),
        manifestStatus: healthReport?.manifestStatus || "missing_expected_output",
        qaStatus: healthReport?.qaStatus || "unknown",
        promotionStatus: promotionReport?.promotionStatus,
        canPromoteToFormal: Boolean(promotionReport?.canPromoteToFormal),
        formalPromotionRequiresExplicitQa: true,
        autoPromoteToFormal: false,
      },
      postprocessPolicy: generationHarnessPostprocessPolicy,
      blockers: uniqueSorted(stageBlockers),
      warnings: uniqueSorted(stageWarnings),
      nextAction: nextAction(status, healthReport, promotionReport),
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    jobs,
    summary: {
      total: jobs.length,
      blocked: jobs.filter((job) => job.candidateOutput.status === "blocked").length,
      waiting: jobs.filter((job) => job.candidateOutput.status === "missing").length,
      qaPending: jobs.filter((job) => job.candidateOutput.status === "qa_pending").length,
      formalReady: jobs.filter((job) => job.candidateOutput.status === "formal_ready").length,
      canPromoteToFormal: jobs.filter((job) => job.candidateOutput.canPromoteToFormal).length,
      liveSubmitAllowed: false,
    },
    forbiddenActions: generationHarnessForbiddenActions,
    postprocessPolicy: generationHarnessPostprocessPolicy,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 8.4 Generation Harness is a hard dry-run audit chain.",
      "Provider request previews are diagnostics only and cannot submit Image2, Seedance, Jimeng, or text-to-video jobs.",
      "Candidate output never auto-promotes to formal; QA and promotion gates must pass explicitly.",
    ],
  };
}
