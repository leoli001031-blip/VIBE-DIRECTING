import type {
  AssetReadinessReport,
  GenerationJob,
  ImageTaskEnvelopeSummary,
  ImageTaskPlan,
  ProjectSourceIndex,
  ShotPromptPlan,
  TaskEnvelope,
} from "./types";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function taskEnvelopeSummary(envelope: TaskEnvelope | undefined, promptPlan: ShotPromptPlan): ImageTaskEnvelopeSummary | undefined {
  if (!envelope) return undefined;

  return {
    envelopeId: envelope.id,
    providerSlot: envelope.providerSlot,
    providerId: envelope.providerId,
    requiredMode: envelope.requiredMode,
    sourceIndexHash: envelope.sourceIndexHash,
    promptPlanId: envelope.promptPlanId || promptPlan.promptPlanId,
    promptPlanHash: envelope.promptPlanHash || promptPlan.promptPlanHash,
    sourceShotSpecHash: envelope.sourceShotSpecHash || promptPlan.sourceShotSpecHash,
    expectedOutputs: envelope.expectedOutputs,
    preflightStatus: envelope.preflight.status,
    blockingReasons: envelope.blockingReasons,
  };
}

function expectedOutputPath(job: GenerationJob, envelope?: TaskEnvelope): string {
  return job.outputPath || envelope?.expectedOutputs[0] || "missing-output-path";
}

function isImageSlot(job: GenerationJob): boolean {
  return job.slot === "image.generate" || job.slot === "image.edit" || job.slot === "image.reference_asset";
}

function isVideoSlot(job: GenerationJob): boolean {
  return job.slot.startsWith("video.");
}

export interface BuildImageTaskPlanInput {
  job: GenerationJob;
  promptPlan: ShotPromptPlan;
  readinessReport?: AssetReadinessReport;
  sourceIndex: ProjectSourceIndex;
  taskEnvelope?: TaskEnvelope;
}

export function buildImageTaskPlan(input: BuildImageTaskPlanInput): ImageTaskPlan {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const outputPath = expectedOutputPath(input.job, input.taskEnvelope);

  if (!isImageSlot(input.job)) {
    blockers.push(
      isVideoSlot(input.job)
        ? "Video generation is parked for Phase 4 dry-run and must not create an Image2 adapter request."
        : `${input.job.slot} is not an Image2 image slot.`,
    );
  }

  if (input.promptPlan.status === "blocked") blockers.push(...input.promptPlan.blockers);
  if (input.promptPlan.status === "draft") warnings.push("Prompt plan is draft and cannot move beyond dry-run planning.");
  if (outputPath === "missing-output-path") blockers.push("Task has no expected output path.");
  if (!input.sourceIndex.sourceIndexHash) blockers.push("Source index hash is missing.");

  if (input.readinessReport) {
    blockers.push(...input.readinessReport.blockers);
    warnings.push(...input.readinessReport.warnings);
    if (input.readinessReport.formalBlocked) {
      warnings.push("Asset readiness blocks formal promotion; adapter request remains dry-run only.");
    }
  } else {
    warnings.push("No shot-level asset readiness report was available for this task plan.");
  }

  const status: ImageTaskPlan["status"] = blockers.length
    ? "blocked"
    : input.promptPlan.status === "ready_for_envelope" && isImageSlot(input.job)
      ? "ready_for_dry_run"
      : "draft";

  return {
    taskPlanId: `image_task_plan_${input.job.id}`,
    jobId: input.job.id,
    shotId: input.promptPlan.shotId || input.readinessReport?.shotId || "unscoped",
    promptPlanId: input.promptPlan.promptPlanId,
    providerSlot: input.promptPlan.providerSlot,
    requiredMode: input.promptPlan.requiredMode,
    providerId: input.promptPlan.providerId,
    mode: input.promptPlan.requiredMode,
    status,
    expectedOutputPath: outputPath,
    inputReferenceIds: uniqueSorted(input.promptPlan.referenceIds),
    sourcePromptPlanHash: input.promptPlan.promptPlanHash,
    sourceShotSpecHash: input.promptPlan.sourceShotSpecHash,
    taskEnvelopeSummary: taskEnvelopeSummary(input.taskEnvelope, input.promptPlan),
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted([...warnings, ...input.promptPlan.adapterWarnings]),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}
