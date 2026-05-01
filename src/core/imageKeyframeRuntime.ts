import type {
  AssetReadinessReport,
  AssetRecord,
  GenerationJob,
  ImageTaskPlan,
  KeyframePairDerivation,
  ProjectSourceIndex,
  ProviderSlot,
  RequiredMode,
  ShotPromptPlan,
} from "./types";

export const imageKeyframeRuntimeSchemaVersion = "0.1.0";
export const imageKeyframeRuntimePhase = "phase17_image2_asset_keyframe_runtime";

export interface ImageKeyframeRuntimeLocks {
  dryRunOnly: true;
  noProviderSubmit: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noCredentialRead: true;
  noFileMutation: true;
  noShell: true;
  noFast: true;
  noVip: true;
  noTextToVideo: true;
  noImage2Fallback: true;
  noIndependentEndFrame: true;
}

export type ImageKeyframeRuntimeStatus = "ready_for_dry_run" | "blocked" | "draft_only";
export type ImageKeyframePlanStatus = "ready_for_dry_run" | "blocked" | "draft";
export type ImageKeyframeGateStatus = "pass" | "blocked" | "warning";
export type ImageKeyframeReferenceStatus = "locked" | "candidate" | "rejected" | "missing" | "failed" | "planned";
export type ImageKeyframeFrameRole = "start_frame" | "end_frame" | "reference_asset";
export type Image2RuntimeOperation = "text2image" | "image2image" | "reference_asset";
export type ImageKeyframeVisualConsistencyGateId =
  | "identity_gate"
  | "scene_gate"
  | "pair_gate"
  | "story_gate"
  | "prop_gate"
  | "style_gate"
  | "motion_gate";

export interface ImageKeyframeReferencePlan {
  referenceId: string;
  assetId?: string;
  assetType: "character" | "scene" | "prop" | "style" | "sound" | "unknown";
  name: string;
  path?: string;
  status: ImageKeyframeReferenceStatus;
  sourceStatus?: AssetRecord["status"];
  lockedStatus?: AssetRecord["lockedStatus"];
  authority: "positive_locked" | "draft_candidate" | "negative_rejected" | "missing_or_failed";
  usedByPromptPlanIds: string[];
  allowedForDraftImage2Reference: boolean;
  canUseAsFutureReference: boolean;
  blocksFormalPromotion: boolean;
  blockers: string[];
  warnings: string[];
}

export interface ImageKeyframeAssetReferencePlanning {
  policy: {
    assetLibraryPurpose: "asset_consistency_memory";
    assetLibraryIsGallery: false;
    lockedAssetsAreConsistencyMemory: true;
    candidateDraftOnly: true;
    rejectedBlocksPositiveReference: true;
    noFileMutation: true;
    noProviderSubmit: true;
    noCredentialRead: true;
  };
  references: ImageKeyframeReferencePlan[];
  summary: {
    total: number;
    locked: number;
    candidate: number;
    rejected: number;
    missing: number;
    failed: number;
    planned: number;
    draftOnly: number;
    formalBlocked: number;
  };
  blockers: string[];
  warnings: string[];
}

export interface Image2RuntimeReference {
  referenceId: string;
  source: "prompt_plan";
  status: ImageKeyframeReferenceStatus;
  canUseAsFutureReference: boolean;
}

export interface Image2RuntimeAdapterPreview {
  requestId: string;
  adapterId: "image2-dry-run";
  operation: Image2RuntimeOperation;
  payload: {
    sourceIntent: string[];
    mustPreserve: string[];
    mustAvoid: string[];
    references: Image2RuntimeReference[];
    outputPath: string;
    sourceStartFrameId?: string;
  };
  submitPolicy: {
    dryRunOnly: true;
    noProviderSubmit: true;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
    liveSubmitForbidden: true;
    noCredentialRead: true;
  };
  forbiddenFallbacks: string[];
}

export interface Image2FramePlan {
  planId: string;
  frameRole: ImageKeyframeFrameRole;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  promptPlanId: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  image2Operation: Image2RuntimeOperation;
  outputPath: string;
  inputReferenceIds: string[];
  referenceStatuses: Image2RuntimeReference[];
  status: ImageKeyframePlanStatus;
  adapterRequestPreview: Image2RuntimeAdapterPreview;
  blockers: string[];
  warnings: string[];
  dryRunOnly: true;
  noProviderSubmit: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface Image2EndFramePlan extends Image2FramePlan {
  frameRole: "end_frame";
  image2Operation: "image2image";
  endDerivation: {
    derivesFrom: "start_frame" | "blocked_independent_end_frame" | "unknown";
    sourceStartFrameId?: string;
    sourceStartFramePlanId?: string;
    keyframePairGateId?: string;
    independentEndFrameForbidden: true;
    noIndependentEndFrame: true;
    allowedDelta: string[];
    mustPreserve: string[];
    mustNotAdd: string[];
  };
}

export interface ImageKeyframePairGate {
  gateId: string;
  shotId: string;
  status: ImageKeyframeGateStatus;
  startFramePlanId?: string;
  endFramePlanId?: string;
  startFrameId?: string;
  endFrameId?: string;
  endDerivationSource: KeyframePairDerivation["endDerivationSource"] | "missing";
  validForI2vPair: boolean;
  validForPromotionHandoff: boolean;
  noIndependentEndFrame: true;
  blockers: string[];
  warnings: string[];
}

export interface ImageKeyframePromotionHandoffItem {
  handoffId: string;
  shotId: string;
  status: "ready_for_manual_review" | "blocked";
  targetProviderId: "seedance2-provider";
  providerSlot: "video.i2v";
  requiredMode: "frames2video";
  startFrameId?: string;
  endFrameId?: string;
  sourceKeyframePairGateId: string;
  canSubmitProvider: false;
  noProviderSubmit: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  fastModeAllowed: false;
  vipChannelAllowed: false;
  textToVideoAllowed: false;
  blockers: string[];
  warnings: string[];
}

export interface ImageKeyframePromotionHandoffPlan {
  planId: string;
  targetProviderId: "seedance2-provider";
  providerSlot: "video.i2v";
  requiredMode: "frames2video";
  providerState: "parked_dry_run_only";
  status: "ready_for_manual_review" | "blocked";
  items: ImageKeyframePromotionHandoffItem[];
  canSubmitProvider: false;
  noProviderSubmit: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFast: true;
  noVip: true;
  noTextToVideo: true;
  notes: string[];
}

export interface ImageKeyframeVisualConsistencyGate {
  gateId: ImageKeyframeVisualConsistencyGateId;
  status: ImageKeyframeGateStatus;
  detail: string;
  sourceRefs: string[];
  blockers: string[];
  warnings: string[];
}

export interface ImageKeyframeRuntimeGate {
  gateId:
    | "noProviderSubmit"
    | "noCredentialRead"
    | "noFileMutation"
    | "noShell"
    | "noFast"
    | "noVip"
    | "noTextToVideo"
    | "noImage2Fallback"
    | "noIndependentEndFrame";
  status: "pass" | "blocked";
  locked: true;
  detail: string;
  violations: string[];
}

export interface ImageKeyframeRuntimePlan {
  schemaVersion: string;
  generatedAt: string;
  phase: typeof imageKeyframeRuntimePhase;
  status: ImageKeyframeRuntimeStatus;
  summary: {
    startFramePlans: number;
    endFramePlans: number;
    keyframePairGates: number;
    readyKeyframePairs: number;
    blockedKeyframePairs: number;
    promotionHandoffItems: number;
    lockedReferences: number;
    candidateReferences: number;
    rejectedReferences: number;
    providerSubmitAllowed: false;
    liveSubmitAllowed: false;
  };
  assetReferencePlanning: ImageKeyframeAssetReferencePlanning;
  image2StartFramePlans: Image2FramePlan[];
  image2EndFramePlans: Image2EndFramePlan[];
  keyframePairGates: ImageKeyframePairGate[];
  visualConsistencyGates: ImageKeyframeVisualConsistencyGate[];
  promotionHandoffPlan: ImageKeyframePromotionHandoffPlan;
  runtimeLocks: ImageKeyframeRuntimeLocks;
  runtimeLockGates: ImageKeyframeRuntimeGate[];
  blockers: string[];
  warnings: string[];
  dryRunOnly: true;
  noProviderSubmit: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface BuildImageKeyframeRuntimePlanInput {
  generatedAt?: string;
  sourceIndex?: Partial<ProjectSourceIndex>;
  assets?: AssetRecord[];
  assetReadinessReports?: AssetReadinessReport[];
  jobs?: GenerationJob[];
  promptPlans?: ShotPromptPlan[];
  imageTaskPlans?: ImageTaskPlan[];
  keyframePairs?: KeyframePairDerivation[];
}

interface RuntimeTaskSeed {
  taskPlanId: string;
  jobId: string;
  shotId: string;
  promptPlanId: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  promptKind: ImageKeyframeFrameRole | "unknown";
  outputPath: string;
  inputReferenceIds: string[];
  sourceIntent: string[];
  mustPreserve: string[];
  mustAvoid: string[];
  derivesFromStartFrame?: boolean;
  promptStatus?: ShotPromptPlan["status"];
  jobStatus?: GenerationJob["status"];
  blockers: string[];
  warnings: string[];
}

const runtimeLocks: ImageKeyframeRuntimeLocks = {
  dryRunOnly: true,
  noProviderSubmit: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noFileMutation: true,
  noShell: true,
  noFast: true,
  noVip: true,
  noTextToVideo: true,
  noImage2Fallback: true,
  noIndependentEndFrame: true,
};

const imageSlots = new Set<ProviderSlot>(["image.generate", "image.edit", "image.reference_asset"]);
const activeImage2ProviderPattern = /image2/i;
const fastPattern = /\bfast\b/i;
const vipPattern = /\bvip\b/i;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function requiredModeForSlot(slot: ProviderSlot, mode: RequiredMode): RequiredMode {
  if (slot === "image.edit") return "image2image";
  if (slot === "image.generate") return "text2image";
  return mode;
}

function isTextToVideo(slot: ProviderSlot, mode: RequiredMode): boolean {
  return slot === "video.t2v.experimental" || mode === "text2video";
}

function isProviderSubmitted(job?: GenerationJob): boolean {
  return Boolean(
    job &&
      (job.submitId ||
        job.providerTaskId ||
        job.status === "submitted" ||
        job.status === "querying" ||
        job.status === "success"),
  );
}

function jobPolicyText(job?: GenerationJob): string {
  if (!job) return "";
  return [job.providerId, job.slot, job.requiredMode, ...job.issues].join(" ");
}

function assetKeys(asset: AssetRecord): string[] {
  return uniqueSorted([asset.id, asset.path]);
}

function sourceList(sourceIndex: Partial<ProjectSourceIndex> | undefined, key: keyof ProjectSourceIndex): string[] {
  const value = sourceIndex?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sourceIncludes(
  sourceIndex: Partial<ProjectSourceIndex> | undefined,
  key: "lockedReferenceIds" | "candidateReferenceIds" | "rejectedReferenceIds" | "failedReferenceIds",
  referenceId: string,
  asset?: AssetRecord,
): boolean {
  const refs = sourceList(sourceIndex, key);
  const ids = asset ? assetKeys(asset) : [referenceId];
  return ids.some((id) => refs.includes(id)) || refs.includes(referenceId);
}

function findAssetByReference(assets: AssetRecord[], referenceId: string): AssetRecord | undefined {
  return assets.find((asset) => asset.id === referenceId || asset.path === referenceId);
}

function classifyReference(
  referenceId: string,
  asset: AssetRecord | undefined,
  sourceIndex: Partial<ProjectSourceIndex> | undefined,
): ImageKeyframeReferenceStatus {
  if (sourceIncludes(sourceIndex, "failedReferenceIds", referenceId, asset)) return "failed";
  if (sourceIncludes(sourceIndex, "rejectedReferenceIds", referenceId, asset)) return "rejected";
  if (asset?.issues.some((issue) => /rejected/i.test(issue))) return "rejected";
  if (asset?.status === "missing") return "missing";
  if (asset?.lockedStatus === "not_generated") return "planned";
  if (sourceIncludes(sourceIndex, "candidateReferenceIds", referenceId, asset)) return "candidate";
  if (asset?.lockedStatus === "candidate" || asset?.lockedStatus === "needs_review") return "candidate";
  if (sourceIncludes(sourceIndex, "lockedReferenceIds", referenceId, asset)) return "locked";
  if (asset?.lockedStatus === "locked" && asset.safeForFutureReference) return "locked";
  if (!asset) return "missing";
  return "planned";
}

function referenceAuthority(status: ImageKeyframeReferenceStatus): ImageKeyframeReferencePlan["authority"] {
  if (status === "locked") return "positive_locked";
  if (status === "candidate" || status === "planned") return "draft_candidate";
  if (status === "rejected") return "negative_rejected";
  return "missing_or_failed";
}

function assetType(asset?: AssetRecord): ImageKeyframeReferencePlan["assetType"] {
  if (!asset) return "unknown";
  if (asset.type === "character" || asset.type === "scene" || asset.type === "prop" || asset.type === "style") return asset.type;
  return "unknown";
}

function referenceBlockers(status: ImageKeyframeReferenceStatus, referenceId: string): string[] {
  if (status === "rejected") return [`Reference ${referenceId} is rejected and cannot be used as a positive Image2 reference.`];
  if (status === "missing") return [`Reference ${referenceId} is missing.`];
  if (status === "failed") return [`Reference ${referenceId} points to a failed asset candidate.`];
  return [];
}

function referenceWarnings(status: ImageKeyframeReferenceStatus, referenceId: string): string[] {
  if (status === "candidate") return [`Reference ${referenceId} is candidate-only; it can support draft planning but cannot promote to future authority.`];
  if (status === "planned") return [`Reference ${referenceId} is planned but not locked; formal promotion remains blocked.`];
  return [];
}

function buildAssetReferencePlanning(input: BuildImageKeyframeRuntimePlanInput): ImageKeyframeAssetReferencePlanning {
  const assets = input.assets || [];
  const promptPlans = input.promptPlans || [];
  const sourceIndex = input.sourceIndex;
  const referenceIds = uniqueSorted([
    ...assets.map((asset) => asset.id),
    ...promptPlans.flatMap((plan) => plan.referenceIds),
    ...(input.assetReadinessReports || []).flatMap((report) => [
      ...report.safeReferenceIds,
      ...report.unsafeReferenceIds,
      ...report.lockedReferenceIds,
      ...report.candidateReferenceIds,
      ...report.rejectedReferenceIds,
      ...report.missingReferenceIds,
      ...report.failedReferenceIds,
    ]),
    ...sourceList(sourceIndex, "lockedReferenceIds"),
    ...sourceList(sourceIndex, "candidateReferenceIds"),
    ...sourceList(sourceIndex, "rejectedReferenceIds"),
    ...sourceList(sourceIndex, "failedReferenceIds"),
  ]);

  const references = referenceIds.map((referenceId): ImageKeyframeReferencePlan => {
    const asset = findAssetByReference(assets, referenceId);
    const status = classifyReference(referenceId, asset, sourceIndex);
    const usedByPromptPlanIds = promptPlans
      .filter((plan) => plan.referenceIds.some((id) => id === referenceId || assetKeys(asset || { id: referenceId, path: referenceId } as AssetRecord).includes(id)))
      .map((plan) => plan.promptPlanId);
    const blockers = referenceBlockers(status, referenceId);
    const warnings = referenceWarnings(status, referenceId);

    return {
      referenceId,
      assetId: asset?.id,
      assetType: assetType(asset),
      name: asset?.name || referenceId,
      path: asset?.path,
      status,
      sourceStatus: asset?.status,
      lockedStatus: asset?.lockedStatus,
      authority: referenceAuthority(status),
      usedByPromptPlanIds,
      allowedForDraftImage2Reference: status === "locked" || status === "candidate" || status === "planned",
      canUseAsFutureReference: status === "locked",
      blocksFormalPromotion: status !== "locked",
      blockers,
      warnings,
    };
  });

  const referencedBlockers = references
    .filter((reference) => reference.usedByPromptPlanIds.length > 0)
    .flatMap((reference) => reference.blockers);
  const warnings = references
    .filter((reference) => reference.usedByPromptPlanIds.length > 0)
    .flatMap((reference) => reference.warnings);

  return {
    policy: {
      assetLibraryPurpose: "asset_consistency_memory",
      assetLibraryIsGallery: false,
      lockedAssetsAreConsistencyMemory: true,
      candidateDraftOnly: true,
      rejectedBlocksPositiveReference: true,
      noFileMutation: true,
      noProviderSubmit: true,
      noCredentialRead: true,
    },
    references,
    summary: {
      total: references.length,
      locked: references.filter((reference) => reference.status === "locked").length,
      candidate: references.filter((reference) => reference.status === "candidate").length,
      rejected: references.filter((reference) => reference.status === "rejected").length,
      missing: references.filter((reference) => reference.status === "missing").length,
      failed: references.filter((reference) => reference.status === "failed").length,
      planned: references.filter((reference) => reference.status === "planned").length,
      draftOnly: references.filter((reference) => reference.status === "candidate" || reference.status === "planned").length,
      formalBlocked: references.filter((reference) => reference.blocksFormalPromotion).length,
    },
    blockers: uniqueSorted(referencedBlockers),
    warnings: uniqueSorted(warnings),
  };
}

function promptKind(plan?: ShotPromptPlan, taskPlan?: ImageTaskPlan): RuntimeTaskSeed["promptKind"] {
  if (plan?.promptKind === "start_frame" || plan?.promptKind === "end_frame" || plan?.promptKind === "reference_asset") {
    return plan.promptKind;
  }
  if (taskPlan?.providerSlot === "image.generate") return "start_frame";
  if (taskPlan?.providerSlot === "image.edit") return "end_frame";
  if (taskPlan?.providerSlot === "image.reference_asset") return "reference_asset";
  return "unknown";
}

function outputPathFor(job: GenerationJob | undefined, taskPlan: ImageTaskPlan | undefined, kind: RuntimeTaskSeed["promptKind"], shotId: string): string {
  if (taskPlan?.expectedOutputPath) return taskPlan.expectedOutputPath;
  if (job?.outputPath) return job.outputPath;
  if (kind === "start_frame") return `outputs/keyframes/${shotId}_start.png`;
  if (kind === "end_frame") return `outputs/keyframes/${shotId}_end.png`;
  if (kind === "reference_asset") return `outputs/references/${shotId}_reference.png`;
  return "missing-output-path";
}

function seedFromPromptPlan(
  plan: ShotPromptPlan,
  job: GenerationJob | undefined,
  taskPlan: ImageTaskPlan | undefined,
): RuntimeTaskSeed {
  const kind = promptKind(plan, taskPlan);
  const shotId = plan.shotId || taskPlan?.shotId || "unscoped";
  return {
    taskPlanId: taskPlan?.taskPlanId || `image_keyframe_task_${plan.promptPlanId}`,
    jobId: plan.jobId,
    shotId,
    promptPlanId: plan.promptPlanId,
    providerId: plan.providerId,
    providerSlot: plan.providerSlot,
    requiredMode: plan.requiredMode,
    promptKind: kind,
    outputPath: outputPathFor(job, taskPlan, kind, shotId),
    inputReferenceIds: uniqueSorted(plan.referenceIds),
    sourceIntent: plan.sourceIntent,
    mustPreserve: plan.mustPreserve,
    mustAvoid: plan.mustAvoid,
    derivesFromStartFrame: plan.derivesFromStartFrame,
    promptStatus: plan.status,
    jobStatus: job?.status,
    blockers: uniqueSorted([...(plan.status === "blocked" ? plan.blockers : []), ...(taskPlan?.blockers || [])]),
    warnings: uniqueSorted([...(plan.adapterWarnings || []), ...(taskPlan?.warnings || [])]),
  };
}

function seedFromTaskPlan(taskPlan: ImageTaskPlan, job: GenerationJob | undefined): RuntimeTaskSeed {
  const kind = promptKind(undefined, taskPlan);
  return {
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    promptPlanId: taskPlan.promptPlanId,
    providerId: taskPlan.providerId,
    providerSlot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    promptKind: kind,
    outputPath: outputPathFor(job, taskPlan, kind, taskPlan.shotId),
    inputReferenceIds: uniqueSorted(taskPlan.inputReferenceIds),
    sourceIntent: [],
    mustPreserve: [],
    mustAvoid: [],
    jobStatus: job?.status,
    blockers: uniqueSorted(taskPlan.blockers),
    warnings: uniqueSorted(taskPlan.warnings),
  };
}

function buildRuntimeTaskSeeds(input: BuildImageKeyframeRuntimePlanInput): RuntimeTaskSeed[] {
  const jobs = input.jobs || [];
  const taskPlans = input.imageTaskPlans || [];
  const taskPlanByPromptId = new Map(taskPlans.map((taskPlan) => [taskPlan.promptPlanId, taskPlan]));
  const promptIds = new Set((input.promptPlans || []).map((plan) => plan.promptPlanId));
  const promptSeeds = (input.promptPlans || []).map((plan) =>
    seedFromPromptPlan(
      plan,
      jobs.find((job) => job.id === plan.jobId),
      taskPlanByPromptId.get(plan.promptPlanId),
    ),
  );
  const taskOnlySeeds = taskPlans
    .filter((taskPlan) => !promptIds.has(taskPlan.promptPlanId))
    .map((taskPlan) => seedFromTaskPlan(taskPlan, jobs.find((job) => job.id === taskPlan.jobId)));

  return [...promptSeeds, ...taskOnlySeeds];
}

function referencesForPlan(referenceIds: string[], assetPlanning: ImageKeyframeAssetReferencePlanning): Image2RuntimeReference[] {
  return referenceIds.map((referenceId) => {
    const reference = assetPlanning.references.find(
      (candidate) => candidate.referenceId === referenceId || candidate.assetId === referenceId || candidate.path === referenceId,
    );
    return {
      referenceId,
      source: "prompt_plan",
      status: reference?.status || "missing",
      canUseAsFutureReference: Boolean(reference?.canUseAsFutureReference),
    };
  });
}

function referenceBlockersForPlan(references: Image2RuntimeReference[]): string[] {
  return references.flatMap((reference) => {
    if (reference.status === "rejected") return [`Reference ${reference.referenceId} is rejected and cannot be used in this Image2 plan.`];
    if (reference.status === "missing") return [`Reference ${reference.referenceId} is missing for this Image2 plan.`];
    if (reference.status === "failed") return [`Reference ${reference.referenceId} is failed for this Image2 plan.`];
    return [];
  });
}

function referenceWarningsForPlan(references: Image2RuntimeReference[]): string[] {
  return references.flatMap((reference) => {
    if (reference.status === "candidate") return [`Reference ${reference.referenceId} is candidate-only; output stays draft-only.`];
    if (reference.status === "planned") return [`Reference ${reference.referenceId} is planned and not locked.`];
    return [];
  });
}

function commonPlanBlockers(seed: RuntimeTaskSeed, job?: GenerationJob): string[] {
  const blockers = [...seed.blockers];
  const policyText = jobPolicyText(job);

  if (!imageSlots.has(seed.providerSlot)) blockers.push(`${seed.providerSlot} is not an Image2 image slot.`);
  if (!activeImage2ProviderPattern.test(seed.providerId)) blockers.push(`${seed.providerId} is not an Image2 provider.`);
  if (isTextToVideo(seed.providerSlot, seed.requiredMode)) blockers.push("Text-to-video is forbidden for Phase 17 Image2 keyframe runtime.");
  if (isProviderSubmitted(job)) blockers.push("Provider submission state is present; Phase 17 runtime plan must remain dry-run only.");
  if (fastPattern.test(policyText)) blockers.push("Fast model route is forbidden.");
  if (vipPattern.test(policyText)) blockers.push("VIP channel route is forbidden.");
  if (seed.promptStatus === "draft") blockers.push("Prompt plan is still draft.");
  if (seed.outputPath === "missing-output-path") blockers.push("Expected output path is missing.");

  return blockers;
}

function operationForStart(seed: RuntimeTaskSeed): Image2RuntimeOperation {
  if (seed.providerSlot === "image.edit" || seed.requiredMode === "image2image") return "image2image";
  return "text2image";
}

function forbiddenFallbacks(operation: Image2RuntimeOperation, frameRole: ImageKeyframeFrameRole): string[] {
  const fallbacks = ["provider_or_mode_fallback", "image2_provider_fallback", "text_to_video_fallback"];
  if (operation === "image2image") fallbacks.push("image2image_to_text2image");
  if (frameRole === "end_frame") fallbacks.push("end_frame_to_independent_text2image", "independent_end_frame_generation");
  if (frameRole === "reference_asset" && operation === "image2image") fallbacks.push("reference_edit_to_text2image");
  return uniqueSorted(fallbacks);
}

function makeAdapterPreview(input: {
  planId: string;
  operation: Image2RuntimeOperation;
  seed: RuntimeTaskSeed;
  references: Image2RuntimeReference[];
  sourceStartFrameId?: string;
}): Image2RuntimeAdapterPreview {
  return {
    requestId: `image2_runtime_preview_${input.planId}`,
    adapterId: "image2-dry-run",
    operation: input.operation,
    payload: {
      sourceIntent: input.seed.sourceIntent,
      mustPreserve: input.seed.mustPreserve,
      mustAvoid: input.seed.mustAvoid,
      references: input.references,
      outputPath: input.seed.outputPath,
      ...(input.sourceStartFrameId ? { sourceStartFrameId: input.sourceStartFrameId } : {}),
    },
    submitPolicy: {
      dryRunOnly: true,
      noProviderSubmit: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      liveSubmitForbidden: true,
      noCredentialRead: true,
    },
    forbiddenFallbacks: forbiddenFallbacks(input.operation, input.seed.promptKind === "unknown" ? "start_frame" : input.seed.promptKind),
  };
}

function planStatus(blockers: string[], seed: RuntimeTaskSeed): ImageKeyframePlanStatus {
  if (blockers.length) return "blocked";
  if (seed.promptStatus && seed.promptStatus !== "ready_for_envelope") return "draft";
  return "ready_for_dry_run";
}

function buildStartPlan(
  seed: RuntimeTaskSeed,
  job: GenerationJob | undefined,
  assetPlanning: ImageKeyframeAssetReferencePlanning,
): Image2FramePlan {
  const references = referencesForPlan(seed.inputReferenceIds, assetPlanning);
  const operation = operationForStart(seed);
  const blockers = uniqueSorted([
    ...commonPlanBlockers(seed, job),
    ...referenceBlockersForPlan(references),
    ...(seed.providerSlot === "image.reference_asset" ? ["Start frame must use Image2 generate or Image2 edit, not reference-asset slot."] : []),
    ...(seed.providerSlot === "image.generate" && seed.requiredMode !== "text2image"
      ? ["Image2 start-frame generation must use text2image."]
      : []),
    ...(seed.providerSlot === "image.edit" && seed.requiredMode !== "image2image"
      ? ["Image2 start-frame edit must use image2image and cannot fall back to text2image."]
      : []),
  ]);
  const warnings = uniqueSorted([...seed.warnings, ...referenceWarningsForPlan(references)]);
  const planId = `image2_start_${seed.shotId}_${seed.jobId}`;

  return {
    planId,
    frameRole: "start_frame",
    taskPlanId: seed.taskPlanId,
    jobId: seed.jobId,
    shotId: seed.shotId,
    promptPlanId: seed.promptPlanId,
    providerId: seed.providerId,
    providerSlot: seed.providerSlot,
    requiredMode: seed.requiredMode,
    image2Operation: operation,
    outputPath: seed.outputPath,
    inputReferenceIds: seed.inputReferenceIds,
    referenceStatuses: references,
    status: planStatus(blockers, seed),
    adapterRequestPreview: makeAdapterPreview({ planId, operation, seed, references }),
    blockers,
    warnings,
    dryRunOnly: true,
    noProviderSubmit: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

function pairForShot(keyframePairs: KeyframePairDerivation[], shotId: string): KeyframePairDerivation | undefined {
  return keyframePairs.find((pair) => pair.shotId === shotId);
}

function sourceStartFrameFor(
  seed: RuntimeTaskSeed,
  startPlans: Image2FramePlan[],
  keyframePairs: KeyframePairDerivation[],
): { sourceStartFrameId?: string; sourceStartFramePlanId?: string; pair?: KeyframePairDerivation } {
  const pair = pairForShot(keyframePairs, seed.shotId);
  const startPlan = startPlans.find((plan) => plan.shotId === seed.shotId);
  return {
    sourceStartFrameId: pair?.startFrameId || startPlan?.outputPath,
    sourceStartFramePlanId: startPlan?.planId,
    pair,
  };
}

function buildEndPlan(
  seed: RuntimeTaskSeed,
  job: GenerationJob | undefined,
  assetPlanning: ImageKeyframeAssetReferencePlanning,
  startPlans: Image2FramePlan[],
  keyframePairs: KeyframePairDerivation[],
): Image2EndFramePlan {
  const references = referencesForPlan(seed.inputReferenceIds, assetPlanning);
  const { sourceStartFrameId, sourceStartFramePlanId, pair } = sourceStartFrameFor(seed, startPlans, keyframePairs);
  const independentEndFrame =
    seed.derivesFromStartFrame === false ||
    pair?.endDerivationSource === "independent_exception" ||
    pair?.endDerivationSource === "unknown" ||
    seed.providerSlot === "image.generate" ||
    seed.requiredMode === "text2image";
  const blockers = uniqueSorted([
    ...commonPlanBlockers(seed, job),
    ...referenceBlockersForPlan(references),
    ...(seed.providerSlot !== "image.edit" ? ["End frame must be an Image2 edit-from-start plan on image.edit."] : []),
    ...(seed.requiredMode !== "image2image" ? ["End frame must use image2image; independent text-to-image is forbidden."] : []),
    ...(seed.derivesFromStartFrame !== true ? ["End-frame prompt plan must explicitly derive from the start frame."] : []),
    ...(sourceStartFrameId ? [] : ["End-frame edit is missing its source start frame."]),
    ...(pair && pair.endDerivationSource !== "start_frame" ? ["Keyframe pair does not derive the end frame from the start frame."] : []),
    ...(pair && pair.validForI2vPair !== true ? ["Keyframe pair is not valid for I2V handoff."] : []),
  ]);
  const warnings = uniqueSorted([...seed.warnings, ...referenceWarningsForPlan(references)]);
  const planId = `image2_end_${seed.shotId}_${seed.jobId}`;

  return {
    planId,
    frameRole: "end_frame",
    taskPlanId: seed.taskPlanId,
    jobId: seed.jobId,
    shotId: seed.shotId,
    promptPlanId: seed.promptPlanId,
    providerId: seed.providerId,
    providerSlot: seed.providerSlot,
    requiredMode: seed.requiredMode,
    image2Operation: "image2image",
    outputPath: seed.outputPath,
    inputReferenceIds: seed.inputReferenceIds,
    referenceStatuses: references,
    status: planStatus(blockers, seed),
    adapterRequestPreview: makeAdapterPreview({
      planId,
      operation: "image2image",
      seed,
      references,
      sourceStartFrameId,
    }),
    endDerivation: {
      derivesFrom: independentEndFrame ? "blocked_independent_end_frame" : sourceStartFrameId ? "start_frame" : "unknown",
      ...(sourceStartFrameId ? { sourceStartFrameId } : {}),
      ...(sourceStartFramePlanId ? { sourceStartFramePlanId } : {}),
      keyframePairGateId: `keyframe_pair_gate_${seed.shotId}`,
      independentEndFrameForbidden: true,
      noIndependentEndFrame: true,
      allowedDelta: pair?.allowedDelta || [],
      mustPreserve: pair?.mustPreserve || seed.mustPreserve,
      mustNotAdd: pair?.mustNotAdd || seed.mustAvoid,
    },
    blockers,
    warnings,
    dryRunOnly: true,
    noProviderSubmit: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

function buildKeyframePairGates(
  startPlans: Image2FramePlan[],
  endPlans: Image2EndFramePlan[],
  keyframePairs: KeyframePairDerivation[],
): ImageKeyframePairGate[] {
  const shotIds = uniqueSorted([
    ...startPlans.map((plan) => plan.shotId),
    ...endPlans.map((plan) => plan.shotId),
    ...keyframePairs.map((pair) => pair.shotId),
  ]);

  return shotIds.map((shotId) => {
    const pair = pairForShot(keyframePairs, shotId);
    const startPlan = startPlans.find((plan) => plan.shotId === shotId);
    const endPlan = endPlans.find((plan) => plan.shotId === shotId);
    const blockers = uniqueSorted([
      ...(startPlan ? [] : ["Image2 start frame plan is missing."]),
      ...(endPlan ? [] : ["Image2 end-frame edit-from-start plan is missing."]),
      ...(pair ? [] : ["Keyframe pair derivation proof is missing."]),
      ...(pair && !pair.startFrameId ? ["Keyframe pair is missing startFrameId."] : []),
      ...(pair && !pair.endFrameId ? ["Keyframe pair is missing endFrameId."] : []),
      ...(pair && pair.endDerivationSource !== "start_frame" ? ["End frame is independent or unknown; start-frame derivation is required."] : []),
      ...(pair && pair.validForI2vPair !== true ? ["Keyframe pair is not valid for I2V handoff."] : []),
      ...(pair && pair.endDerivationSource === "start_frame" && pair.mustPreserve.length === 0
        ? ["Start-frame derivation must declare preserved visual facts."]
        : []),
      ...(startPlan?.status === "blocked" ? startPlan.blockers : []),
      ...(endPlan?.status === "blocked" ? endPlan.blockers : []),
    ]);
    const warnings = uniqueSorted([...(startPlan?.warnings || []), ...(endPlan?.warnings || [])]);
    const validForPromotionHandoff = blockers.length === 0 && Boolean(pair) && startPlan?.status === "ready_for_dry_run" && endPlan?.status === "ready_for_dry_run";

    return {
      gateId: `keyframe_pair_gate_${shotId}`,
      shotId,
      status: blockers.length ? "blocked" : warnings.length ? "warning" : "pass",
      ...(startPlan ? { startFramePlanId: startPlan.planId } : {}),
      ...(endPlan ? { endFramePlanId: endPlan.planId } : {}),
      ...(pair?.startFrameId ? { startFrameId: pair.startFrameId } : startPlan?.outputPath ? { startFrameId: startPlan.outputPath } : {}),
      ...(pair?.endFrameId ? { endFrameId: pair.endFrameId } : endPlan?.outputPath ? { endFrameId: endPlan.outputPath } : {}),
      endDerivationSource: pair?.endDerivationSource || "missing",
      validForI2vPair: Boolean(pair?.validForI2vPair),
      validForPromotionHandoff,
      noIndependentEndFrame: true,
      blockers,
      warnings,
    };
  });
}

function buildPromotionHandoffPlan(
  generatedAt: string,
  gates: ImageKeyframePairGate[],
): ImageKeyframePromotionHandoffPlan {
  const items = gates.map((gate): ImageKeyframePromotionHandoffItem => ({
    handoffId: `seedance2_i2v_handoff_${gate.shotId}`,
    shotId: gate.shotId,
    status: gate.validForPromotionHandoff ? "ready_for_manual_review" : "blocked",
    targetProviderId: "seedance2-provider",
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    ...(gate.startFrameId ? { startFrameId: gate.startFrameId } : {}),
    ...(gate.endFrameId ? { endFrameId: gate.endFrameId } : {}),
    sourceKeyframePairGateId: gate.gateId,
    canSubmitProvider: false,
    noProviderSubmit: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    fastModeAllowed: false,
    vipChannelAllowed: false,
    textToVideoAllowed: false,
    blockers: gate.validForPromotionHandoff ? [] : uniqueSorted(gate.blockers.length ? gate.blockers : ["Keyframe pair gate is not ready for handoff."]),
    warnings: gate.warnings,
  }));

  return {
    planId: `seedance2_handoff_${generatedAt.replace(/[^0-9]/g, "").slice(0, 14) || "dry_run"}`,
    targetProviderId: "seedance2-provider",
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    providerState: "parked_dry_run_only",
    status: items.every((item) => item.status === "ready_for_manual_review") && items.length > 0 ? "ready_for_manual_review" : "blocked",
    items,
    canSubmitProvider: false,
    noProviderSubmit: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFast: true,
    noVip: true,
    noTextToVideo: true,
    notes: [
      "Seedance 2.0 handoff is plan-only in Phase 17.",
      "Only derived start/end keyframe pairs can become future I2V handoff candidates.",
      "Fast, VIP, text-to-video, credential reads, and provider submit routes stay locked off.",
    ],
  };
}

function visualGate(input: Omit<ImageKeyframeVisualConsistencyGate, "status" | "blockers" | "warnings" | "sourceRefs"> & {
  blockers?: string[];
  warnings?: string[];
  sourceRefs?: string[];
}): ImageKeyframeVisualConsistencyGate {
  const blockers = uniqueSorted(input.blockers || []);
  const warnings = uniqueSorted(input.warnings || []);
  return {
    gateId: input.gateId,
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "pass",
    detail: input.detail,
    sourceRefs: uniqueSorted(input.sourceRefs || []),
    blockers,
    warnings,
  };
}

function referencedPlans(reference: ImageKeyframeReferencePlan): boolean {
  return reference.usedByPromptPlanIds.length > 0;
}

function referencedType(
  assetPlanning: ImageKeyframeAssetReferencePlanning,
  assetType: ImageKeyframeReferencePlan["assetType"],
): ImageKeyframeReferencePlan[] {
  return assetPlanning.references.filter((reference) => reference.assetType === assetType && referencedPlans(reference));
}

function referencePlanBlockers(reference: ImageKeyframeReferencePlan): string[] {
  if (reference.status === "rejected") return [`Reference ${reference.referenceId} is rejected.`];
  if (reference.status === "missing") return [`Reference ${reference.referenceId} is missing.`];
  if (reference.status === "failed") return [`Reference ${reference.referenceId} is failed.`];
  return [];
}

function referencePlanWarnings(reference: ImageKeyframeReferencePlan): string[] {
  if (reference.status === "candidate") return [`Reference ${reference.referenceId} is candidate-only and cannot promote to future authority.`];
  if (reference.status === "planned") return [`Reference ${reference.referenceId} is planned but not locked.`];
  return [];
}

function buildVisualConsistencyGates(input: {
  assetPlanning: ImageKeyframeAssetReferencePlanning;
  promptPlans: ShotPromptPlan[];
  pairGates: ImageKeyframePairGate[];
  endPlans: Image2EndFramePlan[];
  runtimeLockGates: ImageKeyframeRuntimeGate[];
}): ImageKeyframeVisualConsistencyGate[] {
  const characterRefs = referencedType(input.assetPlanning, "character");
  const sceneRefs = referencedType(input.assetPlanning, "scene");
  const propRefs = referencedType(input.assetPlanning, "prop");
  const styleRefs = referencedType(input.assetPlanning, "style");
  const promptSourceRefs = input.promptPlans.map((plan) => plan.promptPlanId);
  const noIndependentEndFrameGate = input.runtimeLockGates.find((gateItem) => gateItem.gateId === "noIndependentEndFrame");
  const noImage2FallbackGate = input.runtimeLockGates.find((gateItem) => gateItem.gateId === "noImage2Fallback");

  return [
    visualGate({
      gateId: "identity_gate",
      detail: "Referenced character identity must come from locked Visual Memory authority.",
      blockers: [
        ...(characterRefs.length ? [] : ["No character identity reference is bound to the keyframe plans."]),
        ...characterRefs.flatMap(referencePlanBlockers),
      ],
      warnings: characterRefs.flatMap(referencePlanWarnings),
      sourceRefs: characterRefs.map((reference) => reference.referenceId),
    }),
    visualGate({
      gateId: "scene_gate",
      detail: "Referenced scene space must come from locked scene/Scene Asset Pack authority.",
      blockers: [
        ...(sceneRefs.length ? [] : ["No scene reference is bound to the keyframe plans."]),
        ...sceneRefs.flatMap(referencePlanBlockers),
      ],
      warnings: sceneRefs.flatMap(referencePlanWarnings),
      sourceRefs: sceneRefs.map((reference) => reference.referenceId),
    }),
    visualGate({
      gateId: "pair_gate",
      detail: "Start/end frame pairs must derive end frames from start frames before video handoff.",
      blockers: input.pairGates.flatMap((gateItem) => gateItem.blockers),
      warnings: input.pairGates.flatMap((gateItem) => gateItem.warnings),
      sourceRefs: input.pairGates.map((gateItem) => gateItem.gateId),
    }),
    visualGate({
      gateId: "story_gate",
      detail: "Prompt plans must be compiled from current story facts before keyframe execution.",
      blockers: input.promptPlans.flatMap((plan) => (plan.status === "blocked" ? plan.blockers.length ? plan.blockers : [`${plan.promptPlanId} is blocked.`] : [])),
      warnings: input.promptPlans.flatMap((plan) => (plan.status === "draft" ? [`${plan.promptPlanId} is still draft.`] : [])),
      sourceRefs: promptSourceRefs,
    }),
    visualGate({
      gateId: "prop_gate",
      detail: "Referenced props must not be rejected, missing, failed, or unapproved for formal promotion.",
      blockers: propRefs.flatMap(referencePlanBlockers),
      warnings: propRefs.flatMap(referencePlanWarnings),
      sourceRefs: propRefs.map((reference) => reference.referenceId),
    }),
    visualGate({
      gateId: "style_gate",
      detail: "Referenced style memory must stay locked or remain draft-only.",
      blockers: styleRefs.flatMap(referencePlanBlockers),
      warnings: styleRefs.flatMap(referencePlanWarnings),
      sourceRefs: styleRefs.map((reference) => reference.referenceId),
    }),
    visualGate({
      gateId: "motion_gate",
      detail: "Runtime cannot replace edit-from-start motion continuity with fallback or independent end frames.",
      blockers: [
        ...(noIndependentEndFrameGate?.violations || []),
        ...(noImage2FallbackGate?.violations || []),
        ...input.endPlans
          .filter((plan) => plan.endDerivation.derivesFrom !== "start_frame")
          .map((plan) => `${plan.planId} is not derived from a start frame.`),
      ],
      sourceRefs: input.endPlans.map((plan) => plan.planId),
    }),
  ];
}

function gate(
  gateId: ImageKeyframeRuntimeGate["gateId"],
  detail: string,
  violations: string[],
): ImageKeyframeRuntimeGate {
  return {
    gateId,
    status: violations.length ? "blocked" : "pass",
    locked: true,
    detail,
    violations: uniqueSorted(violations),
  };
}

function buildRuntimeLockGates(input: {
  jobs: GenerationJob[];
  startPlans: Image2FramePlan[];
  endPlans: Image2EndFramePlan[];
  keyframePairs: KeyframePairDerivation[];
}): ImageKeyframeRuntimeGate[] {
  const providerSubmitViolations = input.jobs
    .filter(isProviderSubmitted)
    .map((job) => `${job.id} carries provider submission state.`);
  const fastViolations = input.jobs
    .filter((job) => fastPattern.test(jobPolicyText(job)))
    .map((job) => `${job.id} references a fast route.`);
  const vipViolations = input.jobs
    .filter((job) => vipPattern.test(jobPolicyText(job)))
    .map((job) => `${job.id} references a VIP route.`);
  const textToVideoViolations = input.jobs
    .filter((job) => isTextToVideo(job.slot, job.requiredMode))
    .map((job) => `${job.id} uses text-to-video.`);
  const image2FallbackViolations = [...input.startPlans, ...input.endPlans]
    .filter((plan) => plan.blockers.some((blocker) => /fallback|not an Image2 provider|must use image2image|must use text2image/i.test(blocker)))
    .map((plan) => `${plan.planId} violates Image2 slot/mode fallback policy.`);
  const independentEndFrameViolations = [
    ...input.endPlans
      .filter((plan) => plan.endDerivation.derivesFrom !== "start_frame")
      .map((plan) => `${plan.planId} does not derive from the start frame.`),
    ...input.keyframePairs
      .filter((pair) => pair.endDerivationSource !== "start_frame")
      .map((pair) => `${pair.shotId} keyframe pair source is ${pair.endDerivationSource}.`),
  ];

  return [
    gate("noProviderSubmit", "No provider submit state or route may appear in Phase 17 runtime planning.", providerSubmitViolations),
    gate("noCredentialRead", "Credentials remain unread; runtime output is a dry-run plan only.", []),
    gate("noFileMutation", "The planner cannot mutate user media or generated asset files.", []),
    gate("noShell", "The runtime plan cannot execute shell commands.", []),
    gate("noFast", "Fast model routes are forbidden.", fastViolations),
    gate("noVip", "VIP channels are forbidden.", vipViolations),
    gate("noTextToVideo", "Text-to-video is not an allowed Phase 17 path.", textToVideoViolations),
    gate("noImage2Fallback", "Image2 slot/mode fallback is forbidden.", image2FallbackViolations),
    gate("noIndependentEndFrame", "End frames must derive from start frames by default.", independentEndFrameViolations),
  ];
}

export function buildImageKeyframeRuntimePlan(input: BuildImageKeyframeRuntimePlanInput): ImageKeyframeRuntimePlan {
  const generatedAt = input.generatedAt || "1970-01-01T00:00:00.000Z";
  const jobs = input.jobs || [];
  const assetReferencePlanning = buildAssetReferencePlanning(input);
  const seeds = buildRuntimeTaskSeeds(input);
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const startSeeds = seeds.filter((seed) => seed.promptKind === "start_frame");
  const endSeeds = seeds.filter((seed) => seed.promptKind === "end_frame");
  const image2StartFramePlans = startSeeds.map((seed) => buildStartPlan(seed, jobById.get(seed.jobId), assetReferencePlanning));
  const image2EndFramePlans = endSeeds.map((seed) =>
    buildEndPlan(seed, jobById.get(seed.jobId), assetReferencePlanning, image2StartFramePlans, input.keyframePairs || []),
  );
  const keyframePairGates = buildKeyframePairGates(image2StartFramePlans, image2EndFramePlans, input.keyframePairs || []);
  const promotionHandoffPlan = buildPromotionHandoffPlan(generatedAt, keyframePairGates);
  const runtimeLockGates = buildRuntimeLockGates({
    jobs,
    startPlans: image2StartFramePlans,
    endPlans: image2EndFramePlans,
    keyframePairs: input.keyframePairs || [],
  });
  const visualConsistencyGates = buildVisualConsistencyGates({
    assetPlanning: assetReferencePlanning,
    promptPlans: input.promptPlans || [],
    pairGates: keyframePairGates,
    endPlans: image2EndFramePlans,
    runtimeLockGates,
  });
  const blockers = uniqueSorted([
    ...assetReferencePlanning.blockers,
    ...image2StartFramePlans.flatMap((plan) => plan.blockers),
    ...image2EndFramePlans.flatMap((plan) => plan.blockers),
    ...keyframePairGates.flatMap((gateItem) => gateItem.blockers),
    ...visualConsistencyGates.flatMap((gateItem) => gateItem.blockers),
    ...promotionHandoffPlan.items.flatMap((item) => item.blockers),
    ...runtimeLockGates.flatMap((gateItem) => gateItem.violations),
    ...(image2StartFramePlans.length ? [] : ["No Image2 start frame plans were produced."]),
    ...(image2EndFramePlans.length ? [] : ["No Image2 end-frame edit-from-start plans were produced."]),
  ]);
  const warnings = uniqueSorted([
    ...assetReferencePlanning.warnings,
    ...image2StartFramePlans.flatMap((plan) => plan.warnings),
    ...image2EndFramePlans.flatMap((plan) => plan.warnings),
    ...keyframePairGates.flatMap((gateItem) => gateItem.warnings),
    ...visualConsistencyGates.flatMap((gateItem) => gateItem.warnings),
  ]);

  return {
    schemaVersion: imageKeyframeRuntimeSchemaVersion,
    generatedAt,
    phase: imageKeyframeRuntimePhase,
    status: blockers.length ? "blocked" : warnings.length ? "draft_only" : "ready_for_dry_run",
    summary: {
      startFramePlans: image2StartFramePlans.length,
      endFramePlans: image2EndFramePlans.length,
      keyframePairGates: keyframePairGates.length,
      readyKeyframePairs: keyframePairGates.filter((gateItem) => gateItem.validForPromotionHandoff).length,
      blockedKeyframePairs: keyframePairGates.filter((gateItem) => gateItem.status === "blocked").length,
      promotionHandoffItems: promotionHandoffPlan.items.length,
      lockedReferences: assetReferencePlanning.summary.locked,
      candidateReferences: assetReferencePlanning.summary.candidate,
      rejectedReferences: assetReferencePlanning.summary.rejected,
      providerSubmitAllowed: false,
      liveSubmitAllowed: false,
    },
    assetReferencePlanning,
    image2StartFramePlans,
    image2EndFramePlans,
    keyframePairGates,
    visualConsistencyGates,
    promotionHandoffPlan,
    runtimeLocks,
    runtimeLockGates,
    blockers,
    warnings,
    dryRunOnly: true,
    noProviderSubmit: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}
