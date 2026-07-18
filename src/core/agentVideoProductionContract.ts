import {
  buildDefaultProviderRegistry,
  selectCapabilityForRequirement,
} from "./providerCapabilities";
import type {
  ProviderCapability,
  ProviderCapabilityRequirement,
  ProviderExecutionState,
  ProviderRegistry,
  ProviderSlot,
  RequiredMode,
} from "./types";

export const AGENT_VIDEO_PROVIDER_REGISTRY_SCHEMA_VERSION = "agent_video_provider_registry/0.1.0";
export const AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION = "agent_video_generation_job_ledger/0.5.0";
export const AGENT_VIDEO_PIPELINE_PLAN_SCHEMA_VERSION = "agent_video_pipeline_plan/0.1.0";

export type AgentVideoProviderCapabilityKind =
  | "text-to-video"
  | "image-to-video"
  | "first-last-frame-to-video"
  | "subject-reference-video"
  | "reference-image-generation"
  | "export";

export type AgentVideoAssetType =
  | "text"
  | "image"
  | "reference_image"
  | "start_frame"
  | "end_frame"
  | "subject_reference"
  | "video"
  | "project";

export interface AgentVideoProviderCapability {
  capabilityId: string;
  providerId: string;
  providerName: string;
  modelId: string;
  capability: AgentVideoProviderCapabilityKind;
  state: ProviderExecutionState;
  dryRunOnly: boolean;
  liveSubmitAllowed: boolean;
  requiresReferences: boolean;
  requiresLocalProject: boolean;
  asyncMode: "sync" | "async";
  maxDurationSeconds?: number;
  supportedResolutions: string[];
  inputAssetTypes: AgentVideoAssetType[];
  outputAssetTypes: AgentVideoAssetType[];
  legacyRequirement?: Pick<ProviderCapabilityRequirement, "slot" | "requiredMode" | "inputKinds" | "outputKind">;
  notes: string[];
}

export interface AgentVideoProviderCapabilityRegistry {
  schemaVersion: typeof AGENT_VIDEO_PROVIDER_REGISTRY_SCHEMA_VERSION;
  registryVersion: string;
  generatedAt?: string;
  capabilities: AgentVideoProviderCapability[];
  notes: string[];
}

export interface AgentVideoProviderCapabilityResolution {
  status: "supported" | "blocked";
  capability?: AgentVideoProviderCapability;
  legacyCapability?: ProviderCapability;
  blockers: string[];
  warnings: string[];
}

export type AgentVideoGenerationJobKind = "reference_generation" | "video_submit" | "export";
export type AgentVideoGenerationJobStatus = "staged" | "confirmed" | "running" | "succeeded" | "failed" | "cancelled";
export type AgentVideoExecutionMode = "dry_run" | "live";
export type AgentVideoGenerationJobOperation = "execute" | "query";

export interface AgentVideoGenerationJobStatusEvent {
  status: AgentVideoGenerationJobStatus;
  at: string;
  error?: string;
}

export interface AgentVideoGenerationReviewResult {
  status: "needs_review";
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  jobId: string;
  actionId: string;
  shotId: string;
  sourceReceiptId: string;
  outputPath: string;
  outputHash: string;
  receivedAt: string;
}

export type AgentVideoPipelineStepId =
  | "new_video_draft"
  | "confirm_story"
  | "choose_save_location"
  | "prepare_references"
  | "submit_video"
  | "export";

export interface AgentVideoGenerationJob {
  jobId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  actionId: string;
  operation: AgentVideoGenerationJobOperation;
  executionMode: AgentVideoExecutionMode;
  providerCalled: boolean;
  kind: AgentVideoGenerationJobKind;
  providerId: string;
  modelId: string;
  capability: AgentVideoProviderCapabilityKind;
  pipelineStep: AgentVideoPipelineStepId;
  status: AgentVideoGenerationJobStatus;
  sourceConfirmationId: string;
  sourceTimelineId?: string;
  prompt: string;
  inputAssets: string[];
  outputAssets: string[];
  reviewResult?: AgentVideoGenerationReviewResult;
  externalTaskId?: string;
  error?: string;
  blockers: string[];
  statusHistory: AgentVideoGenerationJobStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentVideoGenerationJobLedger {
  schemaVersion: typeof AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION;
  ledgerId: string;
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
  createdAt: string;
  updatedAt: string;
  jobs: AgentVideoGenerationJob[];
}

export interface AgentVideoPipelineStep {
  stepId: AgentVideoPipelineStepId;
  label: string;
  status: "blocked" | "current" | "pending" | "complete";
  blockers: string[];
}

export interface AgentVideoPipelinePlan {
  schemaVersion: typeof AGENT_VIDEO_PIPELINE_PLAN_SCHEMA_VERSION;
  planId: string;
  createdAt: string;
  currentStep: AgentVideoPipelineStepId;
  currentOperation?: AgentVideoGenerationJobOperation;
  steps: AgentVideoPipelineStep[];
  blockers: string[];
}

export interface BuildAgentVideoPipelinePlanInput {
  planId?: string;
  generatedAt?: string;
  storyDraftPresent: boolean;
  storyConfirmed: boolean;
  localProjectReady: boolean;
  referenceMissingCount: number;
  videoSubmitted: boolean;
  videoNeedsQuery?: boolean;
}

export type AgentVideoPipelineAction =
  | "choose_save_location"
  | "prepare_references"
  | "submit_video"
  | "export";

export interface PlanAgentVideoProductionActionInput {
  plan: AgentVideoPipelinePlan;
  ledger: AgentVideoGenerationJobLedger;
  action: AgentVideoPipelineAction;
  operation?: AgentVideoGenerationJobOperation;
  actionId: string;
  executionMode?: AgentVideoExecutionMode;
  generatedAt?: string;
  prompt?: string;
  sourceConfirmationId?: string;
  sourceTimelineId?: string;
  inputAssets?: string[];
  outputAssets?: string[];
  registry?: AgentVideoProviderCapabilityRegistry;
}

export interface AgentVideoPipelineActionDecision {
  status: "state_only" | "staged_job" | "blocked";
  ledger: AgentVideoGenerationJobLedger;
  job?: AgentVideoGenerationJob;
  nextStep?: AgentVideoPipelineStepId;
  blockers: string[];
}

export interface AgentVideoPipelineConfirmation {
  confirmationId: string;
  stepId: AgentVideoPipelineStepId;
  status: "waiting" | "resolved" | "cancelled";
  createdAt: string;
}

export interface AgentVideoPipelineCurrentTaskInput {
  plan: AgentVideoPipelinePlan;
  confirmations?: AgentVideoPipelineConfirmation[];
  ledger?: AgentVideoGenerationJobLedger;
}

export type AgentVideoPipelineCurrentTask =
  | { source: "confirmation"; stepId: AgentVideoPipelineStepId; confirmationId: string }
  | { source: "job"; stepId: AgentVideoPipelineStepId; jobId: string }
  | { source: "plan"; stepId: AgentVideoPipelineStepId };

const defaultTimestamp = "1970-01-01T00:00:00.000Z";
const terminalJobStatuses = new Set<AgentVideoGenerationJobStatus>(["succeeded", "failed", "cancelled"]);

function compactId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

function uniqueInOrder(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function highLevelCapability(input: Omit<AgentVideoProviderCapability, "capabilityId" | "dryRunOnly" | "liveSubmitAllowed">): AgentVideoProviderCapability {
  return {
    ...input,
    capabilityId: `${input.providerId}:${input.modelId}:${input.capability}`,
    dryRunOnly: true,
    liveSubmitAllowed: false,
  };
}

export function buildDefaultAgentVideoProviderCapabilityRegistry(generatedAt?: string): AgentVideoProviderCapabilityRegistry {
  return {
    schemaVersion: AGENT_VIDEO_PROVIDER_REGISTRY_SCHEMA_VERSION,
    registryVersion: "agent-video-provider-registry/0.1.0",
    generatedAt,
    capabilities: [
      highLevelCapability({
        providerId: "vibe-director-dry-run-video",
        providerName: "Vibe Director Dry-run Video",
        modelId: "dry-run-i2v",
        capability: "image-to-video",
        state: "active",
        requiresReferences: true,
        requiresLocalProject: true,
        asyncMode: "async",
        maxDurationSeconds: 12,
        supportedResolutions: ["720p", "1080p"],
        inputAssetTypes: ["text", "reference_image", "start_frame"],
        outputAssetTypes: ["video"],
        legacyRequirement: {
          slot: "video.i2v",
          requiredMode: "frames2video",
          inputKinds: ["text", "start_frame"],
          outputKind: "video",
        },
        notes: ["Dry-run capability for Agent-first video-submit contracts; it never submits a provider."],
      }),
      highLevelCapability({
        providerId: "vibe-director-dry-run-video",
        providerName: "Vibe Director Dry-run Video",
        modelId: "dry-run-first-last-frame",
        capability: "first-last-frame-to-video",
        state: "active",
        requiresReferences: true,
        requiresLocalProject: true,
        asyncMode: "async",
        maxDurationSeconds: 12,
        supportedResolutions: ["720p", "1080p"],
        inputAssetTypes: ["text", "start_frame", "end_frame"],
        outputAssetTypes: ["video"],
        legacyRequirement: {
          slot: "video.i2v",
          requiredMode: "frames2video",
          inputKinds: ["text", "start_frame", "end_frame"],
          outputKind: "video",
        },
        notes: ["Dry-run first/last-frame contract for future Wan/LTX/MiniMax style adapters."],
      }),
      highLevelCapability({
        providerId: "vibe-director-dry-run-video",
        providerName: "Vibe Director Dry-run Video",
        modelId: "dry-run-t2v",
        capability: "text-to-video",
        state: "planned",
        requiresReferences: false,
        requiresLocalProject: true,
        asyncMode: "async",
        maxDurationSeconds: 8,
        supportedResolutions: ["720p"],
        inputAssetTypes: ["text"],
        outputAssetTypes: ["video"],
        legacyRequirement: {
          slot: "video.t2v.experimental",
          requiredMode: "text2video",
          inputKinds: ["text"],
          outputKind: "video",
        },
        notes: ["Text-to-video is present as a planned capability, not an active fallback."],
      }),
      highLevelCapability({
        providerId: "vibe-director-dry-run-video",
        providerName: "Vibe Director Dry-run Video",
        modelId: "dry-run-subject-reference",
        capability: "subject-reference-video",
        state: "planned",
        requiresReferences: true,
        requiresLocalProject: true,
        asyncMode: "async",
        maxDurationSeconds: 8,
        supportedResolutions: ["720p"],
        inputAssetTypes: ["text", "subject_reference", "reference_image"],
        outputAssetTypes: ["video"],
        legacyRequirement: {
          slot: "video.i2v",
          requiredMode: "frames2video",
          inputKinds: ["text", "reference_image"],
          outputKind: "video",
        },
        notes: ["Subject-reference video is registered for future adapter selection, but is not active yet."],
      }),
      highLevelCapability({
        providerId: "openai-image2-api",
        providerName: "OpenAI Image2 API",
        modelId: "image-reference-asset",
        capability: "reference-image-generation",
        state: "active",
        requiresReferences: false,
        requiresLocalProject: true,
        asyncMode: "async",
        supportedResolutions: ["1024x1024", "1536x1024", "1024x1536"],
        inputAssetTypes: ["text", "reference_image"],
        outputAssetTypes: ["image", "reference_image"],
        legacyRequirement: {
          slot: "image.reference_asset",
          requiredMode: "text2image",
          inputKinds: ["text"],
          outputKind: "image",
        },
        notes: ["Reference image generation stays behind Agent confirmation and provider execution gates."],
      }),
      highLevelCapability({
        providerId: "local-exporter",
        providerName: "Local Project Exporter",
        modelId: "project-export-v1",
        capability: "export",
        state: "active",
        requiresReferences: false,
        requiresLocalProject: true,
        asyncMode: "sync",
        supportedResolutions: [],
        inputAssetTypes: ["project", "image", "video", "text"],
        outputAssetTypes: ["project"],
        legacyRequirement: {
          slot: "local.workflow",
          requiredMode: "not_applicable",
          inputKinds: ["text"],
          outputKind: "metadata",
        },
        notes: ["Local export writes only after the export confirmation boundary."],
      }),
    ],
    notes: [
      "This registry is an Agent-first production contract over the older provider slot registry.",
      "All entries are dry-run/local contract declarations; no external provider route is opened here.",
      "Planned capabilities are visible for product planning but block execution unless a caller explicitly allows planned states.",
    ],
  };
}

function legacyRequirementFor(capability: AgentVideoProviderCapability): ProviderCapabilityRequirement | undefined {
  if (!capability.legacyRequirement) return undefined;
  return {
    ...capability.legacyRequirement,
    notes: [`Agent video capability ${capability.capability}.`],
  };
}

export function resolveAgentVideoProviderCapability(input: {
  capability: AgentVideoProviderCapabilityKind;
  registry?: AgentVideoProviderCapabilityRegistry;
  providerId?: string;
  modelId?: string;
  executionMode?: AgentVideoExecutionMode;
  allowedStates?: ProviderExecutionState[];
  legacyRegistry?: ProviderRegistry;
}): AgentVideoProviderCapabilityResolution {
  const registry = input.registry || buildDefaultAgentVideoProviderCapabilityRegistry();
  const allowedStates = input.allowedStates || ["active"];
  const candidates = registry.capabilities.filter((item) =>
    item.capability === input.capability
    && (!input.providerId || item.providerId === input.providerId)
    && (!input.modelId || item.modelId === input.modelId)
  );
  const selected = candidates.find((item) => allowedStates.includes(item.state)) || candidates[0];
  if (!selected) {
    return {
      status: "blocked",
      blockers: [`No provider capability supports ${input.capability}.`],
      warnings: [],
    };
  }
  const stateBlockers = allowedStates.includes(selected.state) ? [] : [`${selected.capability} is ${selected.state}, not active.`];
  const executionMode = input.executionMode || "dry_run";
  const lockBlockers = executionMode === "live"
    ? selected.liveSubmitAllowed && !selected.dryRunOnly
      ? []
      : ["Live execution requires an explicit live provider capability."]
    : selected.dryRunOnly && !selected.liveSubmitAllowed
      ? []
      : ["Dry-run execution requires a dry-run-only provider capability."];
  const legacyRequirement = legacyRequirementFor(selected);
  const legacySelection = legacyRequirement
    ? selectCapabilityForRequirement(legacyRequirement, input.legacyRegistry || buildDefaultProviderRegistry())
    : undefined;
  return {
    status: stateBlockers.length || lockBlockers.length || (legacySelection?.blockers.length || 0) > 0 ? "blocked" : "supported",
    capability: selected,
    legacyCapability: legacySelection?.capability,
    blockers: [...stateBlockers, ...lockBlockers, ...(legacySelection?.blockers || [])],
    warnings: [...(legacySelection?.warnings || [])],
  };
}

export function createAgentVideoGenerationJobLedger(input: {
  ledgerId?: string;
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
  createdAt?: string;
}): AgentVideoGenerationJobLedger {
  const createdAt = input.createdAt || defaultTimestamp;
  return {
    schemaVersion: AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION,
    ledgerId: input.ledgerId || `agent_video_generation_job_ledger_${compactId(createdAt)}`,
    projectId: input.projectId.trim(),
    projectRoot: normalizeProjectRoot(input.projectRoot),
    projectFactHash: input.projectFactHash.trim(),
    createdAt,
    updatedAt: createdAt,
    jobs: [],
  };
}

function appendJob(ledger: AgentVideoGenerationJobLedger, job: AgentVideoGenerationJob): AgentVideoGenerationJobLedger {
  return {
    ...ledger,
    updatedAt: job.updatedAt,
    jobs: [...ledger.jobs, job],
  };
}

function normalizeProjectRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

function normalizedReviewOutputPath(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/private\/tmp(?=\/|$)/, "/tmp")
    : "";
}

function reviewOutputPathInsideProject(projectRoot: string, outputPath: string) {
  const root = normalizeProjectRoot(projectRoot);
  const output = normalizedReviewOutputPath(outputPath);
  if (!root || !output || /(?:^|\/)\.\.(?:\/|$)/.test(output)) return false;
  if (/^(?:\/|[A-Za-z]:\/)/.test(output)) return output.startsWith(`${root}/`);
  return !output.startsWith("~/") && !output.startsWith("//");
}

function reviewResultIdentity(result: AgentVideoGenerationReviewResult) {
  return [
    result.projectId,
    normalizeProjectRoot(result.projectRoot),
    result.projectFactHash,
    result.jobId,
    result.actionId,
    result.shotId,
    result.sourceReceiptId,
    normalizedReviewOutputPath(result.outputPath),
    result.outputHash.toLowerCase(),
    result.status,
  ].join("::");
}

export function validateAgentVideoGenerationReviewResult(
  job: AgentVideoGenerationJob,
  result: AgentVideoGenerationReviewResult | undefined = job.reviewResult,
) {
  if (!result) return ["Video review result is missing."];
  const blockers = [
    result.status === "needs_review" ? "" : "Video review result must remain needs_review.",
    result.projectId === job.projectId ? "" : "Video review result projectId does not match its job.",
    normalizeProjectRoot(result.projectRoot) === normalizeProjectRoot(job.projectRoot) ? "" : "Video review result projectRoot does not match its job.",
    result.projectFactHash === job.projectFactHash ? "" : "Video review result projectFactHash does not match its job.",
    result.jobId === job.jobId ? "" : "Video review result jobId does not match its job.",
    result.actionId === job.actionId ? "" : "Video review result actionId does not match its job.",
    typeof result.shotId === "string" && result.shotId.trim() ? "" : "Video review result shotId is required.",
    typeof result.sourceReceiptId === "string" && result.sourceReceiptId.trim() ? "" : "Video review result sourceReceiptId is required.",
    reviewOutputPathInsideProject(job.projectRoot, result.outputPath) ? "" : "Video review result outputPath must stay inside the project root.",
    typeof result.outputHash === "string" && /^sha256:[a-f0-9]{64}$/i.test(result.outputHash.trim()) ? "" : "Video review result outputHash must be a SHA-256 value.",
    typeof result.receivedAt === "string" && Number.isFinite(Date.parse(result.receivedAt)) ? "" : "Video review result receivedAt is invalid.",
    typeof result.receivedAt === "string" && Number.isFinite(Date.parse(result.receivedAt)) && Date.parse(result.receivedAt) >= Date.parse(job.updatedAt)
      ? ""
      : "Video review result receivedAt cannot precede its job state.",
  ].filter(Boolean);
  return blockers;
}

export function agentVideoGenerationReviewResultMatchesJob(
  job: AgentVideoGenerationJob | undefined,
  result: AgentVideoGenerationReviewResult | undefined = job?.reviewResult,
) {
  return Boolean(
    job
      && job.kind === "video_submit"
      && job.status === "succeeded"
      && result
      && validateAgentVideoGenerationReviewResult(job, result).length === 0
      && job.outputAssets.some((path) => normalizedReviewOutputPath(path) === normalizedReviewOutputPath(result.outputPath)),
  );
}

export function selectLatestAgentVideoGenerationReviewJob(
  ledger: AgentVideoGenerationJobLedger | undefined,
  identity?: { projectId: string; projectRoot?: string; projectFactHash: string },
) {
  return [...(ledger?.jobs || [])]
    .filter((job) => (
      agentVideoGenerationReviewResultMatchesJob(job)
      && (!identity || (
        job.projectId === identity.projectId
        && normalizeProjectRoot(job.projectRoot) === normalizeProjectRoot(identity.projectRoot)
        && job.projectFactHash === identity.projectFactHash
      ))
    ))
    .sort((left, right) => Date.parse(right.reviewResult!.receivedAt) - Date.parse(left.reviewResult!.receivedAt))[0];
}

export function recordAgentVideoGenerationJobReviewResult(input: {
  ledger: AgentVideoGenerationJobLedger;
  jobId: string;
  result: AgentVideoGenerationReviewResult;
}): { ok: boolean; ledger: AgentVideoGenerationJobLedger; job?: AgentVideoGenerationJob; blockers: string[] } {
  const job = input.ledger.jobs.find((item) => item.jobId === input.jobId);
  if (!job) return { ok: false, ledger: input.ledger, blockers: [`Job not found: ${input.jobId}`] };
  const blockers = [
    jobMatchesLedgerBinding(job, input.ledger) ? "" : "Video review result job does not match its ledger binding.",
    job.kind === "video_submit" ? "" : "Only a video job can record a video review result.",
    job.status === "running" || job.status === "succeeded" ? "" : "A video review result requires a running or succeeded job.",
    ...validateAgentVideoGenerationReviewResult(job, input.result),
  ].filter(Boolean);
  if (blockers.length) return { ok: false, ledger: input.ledger, job, blockers };
  if (job.reviewResult) {
    if (reviewResultIdentity(job.reviewResult) === reviewResultIdentity(input.result)) {
      return { ok: true, ledger: input.ledger, job, blockers: [] };
    }
    return { ok: false, ledger: input.ledger, job, blockers: ["Video job already has a different review result."] };
  }
  const nextJob: AgentVideoGenerationJob = {
    ...job,
    status: "succeeded",
    outputAssets: uniqueInOrder([...job.outputAssets, input.result.outputPath]),
    reviewResult: input.result,
    statusHistory: job.status === "running"
      ? [...job.statusHistory, { status: "succeeded", at: input.result.receivedAt }]
      : job.statusHistory,
    updatedAt: input.result.receivedAt,
  };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt: input.result.receivedAt,
      jobs: input.ledger.jobs.map((item) => item.jobId === job.jobId ? nextJob : item),
    },
    job: nextJob,
    blockers: [],
  };
}

function jobMatchesLedgerBinding(job: AgentVideoGenerationJob, ledger: AgentVideoGenerationJobLedger) {
  return job.projectId === ledger.projectId
    && normalizeProjectRoot(job.projectRoot) === normalizeProjectRoot(ledger.projectRoot)
    && job.projectFactHash === ledger.projectFactHash;
}

function jobKindForAction(action: AgentVideoPipelineAction): AgentVideoGenerationJobKind | undefined {
  if (action === "prepare_references") return "reference_generation";
  if (action === "submit_video") return "video_submit";
  if (action === "export") return "export";
  return undefined;
}

function capabilityForJobKind(kind: AgentVideoGenerationJobKind): AgentVideoProviderCapabilityKind {
  if (kind === "reference_generation") return "reference-image-generation";
  if (kind === "video_submit") return "image-to-video";
  return "export";
}

function stepLabel(stepId: AgentVideoPipelineStepId) {
  if (stepId === "new_video_draft") return "New video draft";
  if (stepId === "confirm_story") return "Confirm story";
  if (stepId === "choose_save_location") return "Choose save location";
  if (stepId === "prepare_references") return "Prepare references";
  if (stepId === "submit_video") return "Submit video";
  return "Export";
}

function currentStepFor(input: BuildAgentVideoPipelinePlanInput): AgentVideoPipelineStepId {
  if (!input.storyDraftPresent) return "new_video_draft";
  if (!input.storyConfirmed) return "confirm_story";
  if (!input.localProjectReady) return "choose_save_location";
  if (input.referenceMissingCount > 0) return "prepare_references";
  if (input.videoNeedsQuery) return "submit_video";
  if (!input.videoSubmitted) return "submit_video";
  return "export";
}

export function buildAgentVideoPipelinePlan(input: BuildAgentVideoPipelinePlanInput): AgentVideoPipelinePlan {
  const currentStep = currentStepFor(input);
  const orderedSteps: AgentVideoPipelineStepId[] = [
    "new_video_draft",
    "confirm_story",
    "choose_save_location",
    "prepare_references",
    "submit_video",
    "export",
  ];
  const currentIndex = orderedSteps.indexOf(currentStep);
  const blockersByStep: Partial<Record<AgentVideoPipelineStepId, string[]>> = {
    confirm_story: input.storyDraftPresent ? [] : ["A new video draft is required before story confirmation."],
    choose_save_location: input.storyConfirmed ? [] : ["Story confirmation is required before choosing a save location."],
    prepare_references: [
      ...(input.storyConfirmed ? [] : ["Story confirmation is required before reference generation."]),
      ...(input.localProjectReady ? [] : ["A local project save location is required before reference generation."]),
    ],
    submit_video: [
      ...(input.storyConfirmed ? [] : ["Story confirmation is required before video submit."]),
      ...(input.localProjectReady ? [] : ["A local project save location is required before video submit."]),
      ...(input.referenceMissingCount > 0 ? ["Missing references must be prepared before video submit."] : []),
    ],
    export: [
      ...(input.storyConfirmed ? [] : ["Story confirmation is required before export."]),
      ...(input.localProjectReady ? [] : ["A local project save location is required before export."]),
    ],
  };
  const steps = orderedSteps.map((stepId, index): AgentVideoPipelineStep => {
    const blockers = blockersByStep[stepId] || [];
    return {
      stepId,
      label: stepLabel(stepId),
      status: blockers.length ? "blocked" : index < currentIndex ? "complete" : index === currentIndex ? "current" : "pending",
      blockers,
    };
  });
  return {
    schemaVersion: AGENT_VIDEO_PIPELINE_PLAN_SCHEMA_VERSION,
    planId: input.planId || "agent_video_pipeline_plan",
    createdAt: input.generatedAt || defaultTimestamp,
    currentStep,
    currentOperation: input.videoNeedsQuery && currentStep === "submit_video" ? "query" : "execute",
    steps,
    blockers: steps.flatMap((step) => step.status === "current" ? step.blockers : []),
  };
}

function boundaryBlockers(plan: AgentVideoPipelinePlan, action: AgentVideoPipelineAction): string[] {
  if (action === "choose_save_location") {
    return plan.currentStep === "choose_save_location" ? [] : [`Save location can only be chosen at ${plan.currentStep}.`];
  }
  if (action === "prepare_references") {
    if (plan.currentStep === "confirm_story") return ["Story confirmation is required before reference generation."];
    if (plan.currentStep === "choose_save_location") return ["A local project save location is required before reference generation."];
    return [];
  }
  if (action === "submit_video") {
    if (plan.currentStep === "confirm_story") return ["Story confirmation is required before video submit."];
    if (plan.currentStep === "choose_save_location") return ["A local project save location is required before video submit."];
    if (plan.currentStep === "prepare_references") return ["Missing references must be prepared before video submit."];
    return [];
  }
  if (action === "export") {
    if (plan.currentStep === "confirm_story") return ["Story confirmation is required before export."];
    if (plan.currentStep === "choose_save_location") return ["A local project save location is required before export."];
    return [];
  }
  return [];
}

function nextStepForBlockedAction(plan: AgentVideoPipelinePlan, action: AgentVideoPipelineAction): AgentVideoPipelineStepId | undefined {
  if (action === "submit_video" && plan.currentStep === "prepare_references") return "prepare_references";
  if ((action === "prepare_references" || action === "submit_video" || action === "export") && plan.currentStep === "choose_save_location") return "choose_save_location";
  if ((action === "prepare_references" || action === "submit_video" || action === "export") && plan.currentStep === "confirm_story") return "confirm_story";
  return undefined;
}

export function planAgentVideoProductionAction(input: PlanAgentVideoProductionActionInput): AgentVideoPipelineActionDecision {
  if (input.action === "choose_save_location") {
    const blockers = boundaryBlockers(input.plan, input.action);
    return {
      status: blockers.length ? "blocked" : "state_only",
      ledger: input.ledger,
      nextStep: blockers.length ? nextStepForBlockedAction(input.plan, input.action) : undefined,
      blockers,
    };
  }
  const jobKind = jobKindForAction(input.action);
  if (!jobKind) {
    return { status: "blocked", ledger: input.ledger, blockers: ["Action does not create a generation job."] };
  }
  const operation = input.operation || "execute";
  if (operation === "query" && input.action !== "submit_video") {
    return { status: "blocked", ledger: input.ledger, blockers: ["Only a video job can use the query operation."] };
  }
  const blockers = boundaryBlockers(input.plan, input.action);
  if (blockers.length) {
    return {
      status: "blocked",
      ledger: input.ledger,
      nextStep: nextStepForBlockedAction(input.plan, input.action),
      blockers,
    };
  }
  const identityBlockers = [
    input.ledger.projectId.trim() ? "" : "A generation ledger requires a project id.",
    normalizeProjectRoot(input.ledger.projectRoot) ? "" : "A generation ledger requires a project root.",
    input.ledger.projectFactHash.trim() ? "" : "A generation ledger requires a project fact hash.",
  ].filter(Boolean);
  if (identityBlockers.length) {
    return { status: "blocked", ledger: input.ledger, blockers: identityBlockers };
  }
  const projectRoot = normalizeProjectRoot(input.ledger.projectRoot)!;
  const actionId = input.actionId.trim();
  if (!actionId) {
    return { status: "blocked", ledger: input.ledger, blockers: ["A generation job requires an Agent action id."] };
  }
  const sourceConfirmationId = input.sourceConfirmationId?.trim();
  if (!sourceConfirmationId) {
    return { status: "blocked", ledger: input.ledger, blockers: ["A generation job requires a source confirmation receipt."] };
  }
  const existingActionJob = [...input.ledger.jobs]
    .reverse()
    .find((job) => job.actionId === actionId && jobMatchesLedgerBinding(job, input.ledger));
  if (existingActionJob) {
    if (existingActionJob.kind !== jobKind) {
      return {
        status: "blocked",
        ledger: input.ledger,
        job: existingActionJob,
        blockers: [`Agent action is already bound to ${existingActionJob.kind}.`],
      };
    }
    if (existingActionJob.operation !== operation) {
      return {
        status: "blocked",
        ledger: input.ledger,
        job: existingActionJob,
        blockers: [`Agent action is already bound to the ${existingActionJob.operation} operation.`],
      };
    }
    if (existingActionJob.sourceConfirmationId !== sourceConfirmationId) {
      return {
        status: "blocked",
        ledger: input.ledger,
        job: existingActionJob,
        blockers: ["Agent action is already bound to another confirmation receipt."],
      };
    }
    if (operation === "query" && !existingActionJob.externalTaskId) {
      return {
        status: "blocked",
        ledger: input.ledger,
        job: existingActionJob,
        blockers: ["A video query job requires the external task id from its submitted video."],
      };
    }
    if (terminalJobStatuses.has(existingActionJob.status)) {
      return {
        status: "blocked",
        ledger: input.ledger,
        job: existingActionJob,
        blockers: [`Agent action already has a terminal job: ${existingActionJob.jobId}.`],
      };
    }
    return {
      status: "staged_job",
      ledger: input.ledger,
      job: existingActionJob,
      blockers: [],
    };
  }
  const querySourceJob = operation === "query"
    ? [...input.ledger.jobs]
        .reverse()
        .find((job) => (
          job.kind === "video_submit"
          && job.status === "running"
          && Boolean(job.externalTaskId)
          && jobMatchesLedgerBinding(job, input.ledger)
        ))
    : undefined;
  if (operation === "query" && !querySourceJob?.externalTaskId) {
    return {
      status: "blocked",
      ledger: input.ledger,
      blockers: ["A video query requires a recoverable submitted task id from the current project facts."],
    };
  }
  const capabilityResolution = resolveAgentVideoProviderCapability({
    capability: capabilityForJobKind(jobKind),
    registry: input.registry,
    executionMode: input.executionMode,
  });
  if (capabilityResolution.status === "blocked" || !capabilityResolution.capability) {
    return {
      status: "blocked",
      ledger: input.ledger,
      blockers: capabilityResolution.blockers,
    };
  }
  const generatedAt = input.generatedAt || defaultTimestamp;
  const capability = capabilityResolution.capability;
  const job: AgentVideoGenerationJob = {
    jobId: `agent_video_job_${compactId(input.plan.planId)}_${compactId(input.action)}_${String(input.ledger.jobs.length + 1).padStart(3, "0")}`,
    projectId: input.ledger.projectId,
    projectRoot,
    projectFactHash: input.ledger.projectFactHash,
    actionId,
    operation,
    executionMode: input.executionMode || "dry_run",
    providerCalled: false,
    kind: jobKind,
    providerId: capability.providerId,
    modelId: capability.modelId,
    capability: capability.capability,
    pipelineStep: input.action === "prepare_references" ? "prepare_references" : input.action === "submit_video" ? "submit_video" : "export",
    status: "staged",
    sourceConfirmationId,
    sourceTimelineId: input.sourceTimelineId,
    prompt: input.prompt || "",
    inputAssets: uniqueInOrder(input.inputAssets || []),
    outputAssets: uniqueInOrder(input.outputAssets || []),
    externalTaskId: querySourceJob?.externalTaskId,
    blockers: [],
    statusHistory: [{ status: "staged", at: generatedAt }],
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
  return {
    status: "staged_job",
    ledger: appendJob(input.ledger, job),
    job,
    blockers: [],
  };
}

export function transitionAgentVideoGenerationJob(input: {
  ledger: AgentVideoGenerationJobLedger;
  jobId: string;
  status: AgentVideoGenerationJobStatus;
  generatedAt?: string;
  externalTaskId?: string;
  providerCalled?: boolean;
  outputAssets?: string[];
  error?: string;
}): { ok: boolean; ledger: AgentVideoGenerationJobLedger; job?: AgentVideoGenerationJob; blockers: string[] } {
  const job = input.ledger.jobs.find((item) => item.jobId === input.jobId);
  if (!job) return { ok: false, ledger: input.ledger, blockers: [`Job not found: ${input.jobId}`] };
  const blockers: string[] = [];
  if (input.status === "running" && job.status !== "confirmed") blockers.push("A job must be confirmed before it can run.");
  if (input.status === "succeeded" && job.status !== "running") blockers.push("A job must be running before it can succeed.");
  if (input.status === "confirmed" && job.status !== "staged") blockers.push("Only staged jobs can be confirmed.");
  if (blockers.length) return { ok: false, ledger: input.ledger, job, blockers };
  const updatedAt = input.generatedAt || defaultTimestamp;
  const nextJob: AgentVideoGenerationJob = {
    ...job,
    status: input.status,
    externalTaskId: input.externalTaskId || job.externalTaskId,
    providerCalled: input.providerCalled ?? job.providerCalled,
    outputAssets: input.outputAssets ? uniqueInOrder(input.outputAssets) : job.outputAssets,
    error: input.error || job.error,
    statusHistory: [
      ...(job.statusHistory?.length ? job.statusHistory : [{ status: job.status, at: job.updatedAt, error: job.error }]),
      { status: input.status, at: updatedAt, error: input.error },
    ],
    updatedAt,
  };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt,
      jobs: input.ledger.jobs.map((item) => item.jobId === input.jobId ? nextJob : item),
    },
    job: nextJob,
    blockers: [],
  };
}

export function recordAgentVideoGenerationJobExecution(input: {
  ledger: AgentVideoGenerationJobLedger;
  jobId: string;
  generatedAt?: string;
  providerCalled?: boolean;
  externalTaskId?: string;
  outputAssets?: string[];
  error?: string;
}): { ok: boolean; ledger: AgentVideoGenerationJobLedger; job?: AgentVideoGenerationJob; blockers: string[] } {
  const job = input.ledger.jobs.find((item) => item.jobId === input.jobId);
  if (!job) return { ok: false, ledger: input.ledger, blockers: [`Job not found: ${input.jobId}`] };
  const updatedAt = input.generatedAt || job.updatedAt;
  const nextJob: AgentVideoGenerationJob = {
    ...job,
    providerCalled: input.providerCalled ?? job.providerCalled,
    externalTaskId: input.externalTaskId || job.externalTaskId,
    outputAssets: input.outputAssets ? uniqueInOrder(input.outputAssets) : job.outputAssets,
    error: input.error || job.error,
    updatedAt,
  };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt,
      jobs: input.ledger.jobs.map((item) => item.jobId === input.jobId ? nextJob : item),
    },
    job: nextJob,
    blockers: [],
  };
}

export function selectCurrentAgentVideoPipelineTask(input: AgentVideoPipelineCurrentTaskInput): AgentVideoPipelineCurrentTask {
  const currentStep = input.plan.currentStep;
  const waitingConfirmation = [...(input.confirmations || [])]
    .filter((confirmation) => confirmation.stepId === currentStep && confirmation.status === "waiting")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  if (waitingConfirmation) {
    return {
      source: "confirmation",
      stepId: currentStep,
      confirmationId: waitingConfirmation.confirmationId,
    };
  }
  const currentJob = [...(input.ledger?.jobs || [])]
    .filter((job) =>
      job.pipelineStep === currentStep
      && !terminalJobStatuses.has(job.status)
      && Boolean(input.ledger && jobMatchesLedgerBinding(job, input.ledger))
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
  if (currentJob) {
    return {
      source: "job",
      stepId: currentStep,
      jobId: currentJob.jobId,
    };
  }
  return { source: "plan", stepId: currentStep };
}
