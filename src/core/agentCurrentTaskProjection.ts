import {
  selectLatestAgentVideoGenerationReviewJob,
  type AgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
  type AgentVideoPipelinePlan,
  type AgentVideoPipelineStepId,
} from "./agentVideoProductionContract";
import type {
  ProjectAgentConfirmationKind,
  ProjectIntentKind,
  ProjectObservationProjection,
} from "./projectAgentWorkspace";

export type AgentCurrentTaskStep =
  | "draft_story"
  | "confirm_story"
  | "choose_save_location"
  | "prepare_references"
  | "submit_video"
  | "export"
  | "idle";

export type AgentCurrentTaskSource =
  | "new_video_draft"
  | "intent_route"
  | "timeline_confirmation"
  | "staged_plan"
  | "pipeline_job"
  | "pipeline_plan"
  | "project_observation"
  | "project_status";

export type AgentCurrentTaskEffect = "none" | "state_only" | "generation_job" | "local_export";
export type AgentCurrentTaskConfirmationKind = "pipeline_action" | "project_edit";

export interface AgentCurrentTaskFact {
  label: string;
  value: string;
}

export interface AgentCurrentTaskProjectStatusLike {
  stage?: string;
  doing?: string;
  waitingFor?: string;
  nextAction?: string;
  facts?: AgentCurrentTaskFact[];
}

export interface AgentCurrentTaskNewVideoDraft {
  status: "empty" | "planning" | "ready" | "blocked" | "confirmed";
  title?: string;
  detail?: string;
  confirmationId?: string;
  actionId?: string;
  draftShotCount?: number;
  facts?: AgentCurrentTaskFact[];
}

export interface AgentCurrentTaskIntentRouteLike {
  kind: ProjectIntentKind;
  label?: string;
  confirmation: ProjectAgentConfirmationKind;
  plan?: string[];
}

export interface AgentCurrentTaskConfirmation {
  confirmationId: string;
  step: AgentCurrentTaskStep;
  kind?: AgentCurrentTaskConfirmationKind;
  projectId?: string;
  projectRoot?: string;
  projectFactHash?: string;
  status: "waiting" | "resolved" | "cancelled";
  createdAt?: string;
  actionId?: string;
  label?: string;
  blockers?: string[];
  facts?: AgentCurrentTaskFact[];
}

export interface AgentCurrentTaskStagedPlanRestore {
  status:
    | "restored"
    | "active"
    | "cleared"
    | "expired"
    | "project_mismatch"
    | "root_mismatch"
    | "fact_hash_mismatch"
    | "invalid"
    | "missing";
  step?: AgentCurrentTaskStep;
  kind?: AgentCurrentTaskConfirmationKind;
  projectId?: string;
  projectRoot?: string;
  projectFactHash?: string;
  confirmationId?: string;
  actionId?: string;
  label?: string;
  createdAt?: string;
  clearedAt?: string;
  blockers?: string[];
  facts?: AgentCurrentTaskFact[];
}

export interface AgentCurrentTaskCompletedStep {
  step: AgentCurrentTaskStep;
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
  executionMode?: "dry_run" | "live";
  actionId?: string;
  completedAt?: string;
}

export interface AgentCurrentTaskProjectionInput {
  newVideoDraft?: AgentCurrentTaskNewVideoDraft;
  projectStatus?: AgentCurrentTaskProjectStatusLike;
  projectObservation?: ProjectObservationProjection;
  intentRoute?: AgentCurrentTaskIntentRouteLike;
  timelineConfirmations?: AgentCurrentTaskConfirmation[];
  restoredStagedPlan?: AgentCurrentTaskStagedPlanRestore;
  pipelinePlan?: AgentVideoPipelinePlan;
  jobLedger?: AgentVideoGenerationJobLedger;
  currentProjectId?: string;
  currentProjectRoot?: string;
  currentProjectFactHash?: string;
  completedSteps?: AgentCurrentTaskCompletedStep[];
  referenceReviewCount?: number;
  videoReviewCount?: number;
  facts?: AgentCurrentTaskFact[];
}

export interface AgentCurrentTaskProjection {
  source: AgentCurrentTaskSource;
  step: AgentCurrentTaskStep;
  label: string;
  requiresConfirmation: boolean;
  effect: AgentCurrentTaskEffect;
  confirmationKind?: AgentCurrentTaskConfirmationKind;
  confirmationId?: string;
  actionId?: string;
  jobId?: string;
  completion?: Pick<AgentCurrentTaskCompletedStep, "step" | "executionMode" | "actionId" | "completedAt">;
  blockers: string[];
  facts: AgentCurrentTaskFact[];
}

const terminalJobStatuses = new Set<AgentVideoGenerationJob["status"]>(["succeeded", "failed", "cancelled"]);

function clean(value: string | undefined) {
  return value?.trim() || "";
}

function compactFacts(values: Array<AgentCurrentTaskFact | undefined>): AgentCurrentTaskFact[] {
  const seen = new Set<string>();
  const facts: AgentCurrentTaskFact[] = [];
  for (const fact of values) {
    const label = clean(fact?.label);
    const value = clean(fact?.value);
    if (!label || !value) continue;
    const key = `${label}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ label, value });
  }
  return facts;
}

function timeValue(value: string | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function pipelineStepToCurrentTaskStep(step: AgentVideoPipelineStepId): AgentCurrentTaskStep {
  if (step === "new_video_draft") return "draft_story";
  if (step === "confirm_story") return "confirm_story";
  if (step === "choose_save_location") return "choose_save_location";
  if (step === "prepare_references") return "prepare_references";
  if (step === "submit_video") return "submit_video";
  return "export";
}

function labelForStep(step: AgentCurrentTaskStep) {
  if (step === "draft_story") return "整理新视频草案";
  if (step === "confirm_story") return "确认这版故事";
  if (step === "choose_save_location") return "选择保存位置";
  if (step === "prepare_references") return "补参考";
  if (step === "submit_video") return "发送视频";
  if (step === "export") return "导出交付包";
  return "继续描述想法";
}

function confirmationRequiredForStep(step: AgentCurrentTaskStep) {
  return step !== "draft_story" && step !== "idle";
}

function effectForStep(step: AgentCurrentTaskStep): AgentCurrentTaskEffect {
  if (step === "choose_save_location") return "state_only";
  if (step === "prepare_references" || step === "submit_video") return "generation_job";
  if (step === "export") return "local_export";
  return "none";
}

function currentPipelineBlockers(plan: AgentVideoPipelinePlan | undefined, step: AgentCurrentTaskStep) {
  const pipelineStep = plan?.steps.find((item) => pipelineStepToCurrentTaskStep(item.stepId) === step);
  return pipelineStep?.blockers || [];
}

function observationStep(observation: ProjectObservationProjection | undefined): AgentCurrentTaskStep | undefined {
  const confirmation = observation?.currentTask.confirmation.kind;
  if (!confirmation || confirmation === "none") {
    if (observation?.story.status === "empty") return "draft_story";
    return undefined;
  }
  if (confirmation === "project") return "choose_save_location";
  if (confirmation === "reference_generation" || confirmation === "asset_review") return "prepare_references";
  if (confirmation === "video_submit") return "submit_video";
  if (confirmation === "export") return "export";
  return undefined;
}

function intentRouteStep(
  route: AgentCurrentTaskIntentRouteLike | undefined,
  plan: AgentVideoPipelinePlan | undefined,
): AgentCurrentTaskStep | undefined {
  if (!route) return undefined;
  const currentStep = plan ? pipelineStepToCurrentTaskStep(plan.currentStep) : undefined;
  if (route.confirmation === "project") return "choose_save_location";
  if (route.confirmation === "reference_generation" || route.confirmation === "asset_review") {
    if (currentStep === "confirm_story" || currentStep === "choose_save_location") return currentStep;
    return "prepare_references";
  }
  if (route.confirmation === "video_submit") {
    if (currentStep === "confirm_story" || currentStep === "choose_save_location" || currentStep === "prepare_references") {
      return currentStep;
    }
    return "submit_video";
  }
  if (route.confirmation === "export") {
    if (currentStep === "confirm_story" || currentStep === "choose_save_location") return currentStep;
    return "export";
  }
  if (route.kind === "video" && currentStep === "prepare_references") return "prepare_references";
  return undefined;
}

function projectBindingMatches(
  value: { projectId?: string; projectRoot?: string; projectFactHash?: string },
  input: Pick<AgentCurrentTaskProjectionInput, "currentProjectId" | "currentProjectRoot" | "currentProjectFactHash">,
) {
  if (!input.currentProjectId && !input.currentProjectFactHash) return true;
  return Boolean(
    input.currentProjectId
      && input.currentProjectFactHash
      && value.projectId === input.currentProjectId
      && normalizeProjectRoot(value.projectRoot) === normalizeProjectRoot(input.currentProjectRoot)
      && value.projectFactHash === input.currentProjectFactHash,
  );
}

function stagedPlanIsActive(
  plan: AgentCurrentTaskStagedPlanRestore | undefined,
  input: AgentCurrentTaskProjectionInput,
) {
  return Boolean(
    plan
      && (plan.status === "restored" || plan.status === "active")
      && plan.step
      && projectBindingMatches(plan, input),
  );
}

function confirmationSuppressedByClearedPlan(
  confirmation: AgentCurrentTaskConfirmation,
  stagedPlan: AgentCurrentTaskStagedPlanRestore | undefined,
) {
  if (stagedPlan?.status !== "cleared") return false;
  const clearedAt = timeValue(stagedPlan.clearedAt);
  if (!clearedAt) return true;
  const createdAt = timeValue(confirmation.createdAt);
  return !createdAt || createdAt <= clearedAt;
}

function latestWaitingConfirmation(
  confirmations: AgentCurrentTaskConfirmation[] | undefined,
  step: AgentCurrentTaskStep,
  input: AgentCurrentTaskProjectionInput,
) {
  return [...(confirmations || [])]
    .filter((confirmation) =>
      confirmation.step === step
      && confirmation.status === "waiting"
      && projectBindingMatches(confirmation, input)
      && !confirmationSuppressedByClearedPlan(confirmation, input.restoredStagedPlan)
      && !confirmationConsumedByJob(confirmation, input.jobLedger, input)
    )
    .sort((left, right) => timeValue(right.createdAt) - timeValue(left.createdAt))[0];
}

function latestWaitingProjectEditConfirmation(
  confirmations: AgentCurrentTaskConfirmation[] | undefined,
  input: AgentCurrentTaskProjectionInput,
) {
  return [...(confirmations || [])]
    .filter((confirmation) =>
      confirmation.kind === "project_edit"
      && confirmation.status === "waiting"
      && projectBindingMatches(confirmation, input)
      && !confirmationSuppressedByClearedPlan(confirmation, input.restoredStagedPlan)
    )
    .sort((left, right) => timeValue(right.createdAt) - timeValue(left.createdAt))[0];
}

function normalizeProjectRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

function confirmationConsumedByJob(
  confirmation: AgentCurrentTaskConfirmation,
  ledger: AgentVideoGenerationJobLedger | undefined,
  input: Pick<AgentCurrentTaskProjectionInput, "currentProjectId" | "currentProjectRoot" | "currentProjectFactHash">,
) {
  return recoveryActionConsumedByJob({
    actionId: confirmation.actionId,
    confirmationId: confirmation.confirmationId,
  }, ledger, input);
}

function recoveryActionConsumedByJob(
  recovery: { actionId?: string; confirmationId?: string },
  ledger: AgentVideoGenerationJobLedger | undefined,
  input: Pick<AgentCurrentTaskProjectionInput, "currentProjectId" | "currentProjectRoot" | "currentProjectFactHash">,
) {
  return (ledger?.jobs || []).some((job) => (
    job.status !== "staged"
    && job.projectId === input.currentProjectId
    && normalizeProjectRoot(job.projectRoot) === normalizeProjectRoot(input.currentProjectRoot)
    && job.projectFactHash === input.currentProjectFactHash
    && (
      Boolean(recovery.confirmationId && job.sourceConfirmationId === recovery.confirmationId)
      || Boolean(recovery.actionId && job.actionId === recovery.actionId)
    )
  ));
}

function latestCurrentJob(
  ledger: AgentVideoGenerationJobLedger | undefined,
  step: AgentCurrentTaskStep,
  input: Pick<AgentCurrentTaskProjectionInput, "currentProjectId" | "currentProjectRoot" | "currentProjectFactHash">,
) {
  if (!input.currentProjectId || !input.currentProjectFactHash) return undefined;
  return [...(ledger?.jobs || [])]
    .filter((job) =>
      pipelineStepToCurrentTaskStep(job.pipelineStep) === step
      && !terminalJobStatuses.has(job.status)
      && job.projectId === input.currentProjectId
      && normalizeProjectRoot(job.projectRoot) === normalizeProjectRoot(input.currentProjectRoot)
      && job.projectFactHash === input.currentProjectFactHash
    )
    .sort((left, right) => timeValue(right.updatedAt) - timeValue(left.updatedAt))[0];
}

function latestCurrentJobAcrossPipeline(
  ledger: AgentVideoGenerationJobLedger | undefined,
  input: Pick<AgentCurrentTaskProjectionInput, "currentProjectId" | "currentProjectRoot" | "currentProjectFactHash">,
) {
  if (!input.currentProjectId || !input.currentProjectFactHash) return undefined;
  return [...(ledger?.jobs || [])]
    .filter((job) =>
      !terminalJobStatuses.has(job.status)
      && job.projectId === input.currentProjectId
      && normalizeProjectRoot(job.projectRoot) === normalizeProjectRoot(input.currentProjectRoot)
      && job.projectFactHash === input.currentProjectFactHash
    )
    .sort((left, right) => timeValue(right.updatedAt) - timeValue(left.updatedAt))[0];
}

function currentStepCompletion(input: AgentCurrentTaskProjectionInput, step: AgentCurrentTaskStep) {
  return [...(input.completedSteps || [])].reverse().find((completion) => (
    completion.step === step
    && projectBindingMatches(completion, input)
  ));
}

function factsForInput(input: AgentCurrentTaskProjectionInput, extraFacts: AgentCurrentTaskFact[] = []) {
  return compactFacts([
    ...(input.facts || []),
    ...(input.newVideoDraft?.facts || []),
    ...(input.projectStatus?.facts || []),
    ...(input.projectObservation ? [
      { label: "故事", value: input.projectObservation.story.label },
      { label: "参考", value: input.projectObservation.references.label },
      { label: "视频", value: input.projectObservation.video.label },
    ] : []),
    ...extraFacts,
  ]);
}

function buildProjection(input: {
  source: AgentCurrentTaskSource;
  step: AgentCurrentTaskStep;
  label?: string;
  requiresConfirmation?: boolean;
  confirmationKind?: AgentCurrentTaskConfirmationKind;
  confirmationId?: string;
  actionId?: string;
  jobId?: string;
  completion?: AgentCurrentTaskProjection["completion"];
  blockers?: string[];
  effect?: AgentCurrentTaskEffect;
  facts: AgentCurrentTaskFact[];
}): AgentCurrentTaskProjection {
  const requiresConfirmation = input.requiresConfirmation ?? confirmationRequiredForStep(input.step);
  return {
    source: input.source,
    step: input.step,
    label: input.label || labelForStep(input.step),
    requiresConfirmation,
    effect: input.effect ?? effectForStep(input.step),
    confirmationKind: input.confirmationKind || (
      requiresConfirmation ? "pipeline_action" : undefined
    ),
    confirmationId: input.confirmationId,
    actionId: input.actionId,
    jobId: input.jobId,
    completion: input.completion,
    blockers: input.blockers || [],
    facts: input.facts,
  };
}

export function buildAgentCurrentTaskProjection(input: AgentCurrentTaskProjectionInput): AgentCurrentTaskProjection {
  if (input.newVideoDraft?.status === "planning") {
    return buildProjection({
      source: "new_video_draft",
      step: "draft_story",
      label: labelForStep("draft_story"),
      requiresConfirmation: false,
      blockers: [],
      facts: factsForInput(input),
    });
  }

  if (input.newVideoDraft?.status === "ready") {
    return buildProjection({
      source: "new_video_draft",
      step: "confirm_story",
      label: input.newVideoDraft.title || labelForStep("confirm_story"),
      confirmationId: input.newVideoDraft.confirmationId,
      actionId: input.newVideoDraft.actionId,
      blockers: [],
      facts: factsForInput(input, input.newVideoDraft.draftShotCount ? [
        { label: "镜头", value: `草案 ${input.newVideoDraft.draftShotCount} 个` },
      ] : []),
    });
  }

  const projectEditConfirmation = latestWaitingProjectEditConfirmation(
    input.timelineConfirmations,
    input,
  );
  if (projectEditConfirmation) {
    return buildProjection({
      source: "timeline_confirmation",
      step: projectEditConfirmation.step,
      label: projectEditConfirmation.label,
      confirmationKind: projectEditConfirmation.kind,
      confirmationId: projectEditConfirmation.confirmationId,
      actionId: projectEditConfirmation.actionId,
      blockers: projectEditConfirmation.blockers || [],
      facts: factsForInput(input, projectEditConfirmation.facts || []),
    });
  }

  if (
    stagedPlanIsActive(input.restoredStagedPlan, input)
    && input.restoredStagedPlan?.kind === "project_edit"
  ) {
    return buildProjection({
      source: "staged_plan",
      step: input.restoredStagedPlan.step!,
      label: input.restoredStagedPlan.label,
      confirmationKind: input.restoredStagedPlan.kind,
      confirmationId: input.restoredStagedPlan.confirmationId,
      actionId: input.restoredStagedPlan.actionId,
      blockers: input.restoredStagedPlan.blockers || [],
      facts: factsForInput(input, input.restoredStagedPlan.facts || []),
    });
  }

  const priorityJob = latestCurrentJobAcrossPipeline(input.jobLedger, input);
  if (priorityJob) {
    const jobStep = pipelineStepToCurrentTaskStep(priorityJob.pipelineStep);
    const matchingConfirmation = priorityJob.status === "staged"
      ? latestWaitingConfirmation(input.timelineConfirmations, jobStep, input)
      : undefined;
    const confirmationMatchesJob = Boolean(
      matchingConfirmation
        && matchingConfirmation.confirmationId === priorityJob.sourceConfirmationId
        && matchingConfirmation.actionId === priorityJob.actionId,
    );
    const queryRecovery = priorityJob.status === "running"
      && priorityJob.kind === "video_submit"
      && input.pipelinePlan?.currentOperation === "query";
    if (priorityJob.status !== "staged" || confirmationMatchesJob) {
      return buildProjection({
        source: confirmationMatchesJob ? "timeline_confirmation" : "pipeline_job",
        step: jobStep,
        label: matchingConfirmation?.label || (queryRecovery ? "查询视频结果" : labelForStep(jobStep)),
        requiresConfirmation: priorityJob.status === "staged" || queryRecovery,
        confirmationKind: priorityJob.status === "staged" || queryRecovery ? matchingConfirmation?.kind || "pipeline_action" : undefined,
        confirmationId: priorityJob.status === "staged" ? priorityJob.sourceConfirmationId : undefined,
        actionId: queryRecovery ? undefined : priorityJob.actionId,
        jobId: priorityJob.jobId,
        blockers: priorityJob.blockers,
        facts: factsForInput(input, [
          { label: "任务", value: priorityJob.jobId },
          { label: "状态", value: priorityJob.status },
        ]),
      });
    }
  }

  const referenceReviewCount = Math.max(0, Math.floor(input.referenceReviewCount || 0));
  if (referenceReviewCount > 0) {
    return buildProjection({
      source: "project_observation",
      step: "prepare_references",
      label: "复核参考",
      requiresConfirmation: false,
      effect: "none",
      blockers: [],
      facts: factsForInput(input, [{ label: "待复核", value: `${referenceReviewCount} 项` }]),
    });
  }

  const videoReviewCount = Math.max(0, Math.floor(input.videoReviewCount || 0));
  if (videoReviewCount > 0) {
    const reviewJob = selectLatestAgentVideoGenerationReviewJob(input.jobLedger, input.currentProjectId && input.currentProjectFactHash
      ? {
        projectId: input.currentProjectId,
        projectRoot: input.currentProjectRoot,
        projectFactHash: input.currentProjectFactHash,
      }
      : undefined);
    return buildProjection({
      source: "project_observation",
      step: "submit_video",
      label: "复核视频",
      requiresConfirmation: false,
      effect: "none",
      actionId: reviewJob?.actionId,
      jobId: reviewJob?.jobId,
      blockers: [],
      facts: factsForInput(input, [
        { label: "待复核", value: `${videoReviewCount} 项` },
        reviewJob ? { label: "任务", value: reviewJob.jobId } : undefined,
      ].filter((fact): fact is AgentCurrentTaskFact => Boolean(fact))),
    });
  }

  const planStep = input.pipelinePlan ? pipelineStepToCurrentTaskStep(input.pipelinePlan.currentStep) : undefined;
  const routeStep = intentRouteStep(input.intentRoute, input.pipelinePlan);
  const observedStep = observationStep(input.projectObservation);
  const step = routeStep || planStep || observedStep || "idle";

  const stagedPlan = input.restoredStagedPlan;
  const stagedPlanMatchesStep = stagedPlanIsActive(stagedPlan, input)
    && stagedPlan?.step === step
    && !recoveryActionConsumedByJob({
      actionId: stagedPlan.actionId,
      confirmationId: stagedPlan.confirmationId,
    }, input.jobLedger, input);
  const confirmation = latestWaitingConfirmation(input.timelineConfirmations, step, input);
  const timelineConfirmationIsCurrent = Boolean(
    confirmation
      && (
        !stagedPlanMatchesStep
        || timeValue(confirmation.createdAt) >= timeValue(stagedPlan?.createdAt)
      )
  );

  if (timelineConfirmationIsCurrent && confirmation) {
    return buildProjection({
      source: "timeline_confirmation",
      step,
      label: confirmation.label,
      confirmationKind: confirmation.kind,
      confirmationId: confirmation.confirmationId,
      actionId: confirmation.actionId,
      blockers: confirmation.blockers || [],
      facts: factsForInput(input, confirmation.facts || []),
    });
  }

  if (stagedPlanMatchesStep && stagedPlan) {
    return buildProjection({
      source: "staged_plan",
      step,
      label: stagedPlan.label,
      confirmationKind: stagedPlan.kind,
      confirmationId: stagedPlan.confirmationId,
      actionId: stagedPlan.actionId,
      blockers: stagedPlan.blockers || [],
      facts: factsForInput(input, stagedPlan.facts || []),
    });
  }

  const job = latestCurrentJob(input.jobLedger, step, input);
  if (job) {
    const staged = job.status === "staged";
    const queryRecovery = job.status === "running"
      && job.kind === "video_submit"
      && input.pipelinePlan?.currentOperation === "query";
    return buildProjection({
      source: "pipeline_job",
      step,
      label: queryRecovery ? "查询视频结果" : labelForStep(step),
      requiresConfirmation: staged || queryRecovery,
      confirmationKind: staged || queryRecovery ? "pipeline_action" : undefined,
      confirmationId: staged ? job.sourceConfirmationId : undefined,
      actionId: queryRecovery ? undefined : job.actionId,
      jobId: job.jobId,
      blockers: staged && !job.sourceConfirmationId
        ? [...job.blockers, "Staged generation job is missing its confirmation receipt."]
        : job.blockers,
      facts: factsForInput(input, [
        { label: "任务", value: job.status },
        { label: "Provider", value: job.providerId },
      ]),
    });
  }

  const exportCompletion = (!routeStep || input.intentRoute?.kind === "status")
    ? currentStepCompletion(input, "export")
    : undefined;
  if (exportCompletion) {
    return buildProjection({
      source: "pipeline_plan",
      step: "idle",
      label: exportCompletion.executionMode === "dry_run" ? "执行边界验证完成" : "继续描述想法",
      completion: {
        step: exportCompletion.step,
        executionMode: exportCompletion.executionMode,
        actionId: exportCompletion.actionId,
        completedAt: exportCompletion.completedAt,
      },
      blockers: [],
      facts: factsForInput(input),
    });
  }

  const source: AgentCurrentTaskSource = routeStep
    ? "intent_route"
    : planStep
      ? "pipeline_plan"
      : observedStep
        ? "project_observation"
        : "project_status";

  return buildProjection({
    source,
    step,
    blockers: currentPipelineBlockers(input.pipelinePlan, step),
    facts: factsForInput(input),
  });
}
