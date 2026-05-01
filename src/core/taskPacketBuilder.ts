import type { ProjectRuntimeState } from "./projectState";
import type {
  AssetRecord,
  ContextLevel,
  KeyframePairDerivation,
  NeighborShotContext,
  PreflightBlocker,
  ProviderExecutionState,
  ProviderSlot,
  ReferenceAuthority,
  RequiredMode,
  ShotLayoutContext,
  ShotRecord,
  StoryChangeTransaction,
  SubagentOutputContract,
  SubagentTaskEnvelope,
  SubagentTaskPurpose,
  TaskEnvelope,
} from "./types";

export type TaskPacketKind =
  | "image"
  | "asset"
  | "start_frame"
  | "end_frame"
  | "image_edit"
  | "identity_qa"
  | "scene_qa"
  | "pair_qa"
  | "story_audit"
  | "video_execution"
  | "audio"
  | "export";

export type TaskPacketStatus = "ready" | "blocked_missing_context";

export interface TaskPacketHardFields {
  purpose: SubagentTaskPurpose;
  contextCapsule: string[];
  storyFunction: string;
  previousShot: NeighborShotContext;
  nextShot: NeighborShotContext;
  beforeAfterShots: string[];
  boundAssets: ReferenceAuthority[];
  referenceAuthority: string[];
  expectedOutputs: string[];
  mustPreserve: string[];
  allowedDelta: string[];
  mustAvoid: string[];
  hardNegatives: string[];
  qaChecklist: string[];
  expectedOutputContract: SubagentOutputContract;
  allowedReadScope: string[];
  forbiddenActions: string[];
  outputSchema: "subagent_result_v1";
}

export interface BuiltTaskPacket {
  packetId: string;
  taskKind: TaskPacketKind;
  status: TaskPacketStatus;
  envelopeId?: string;
  envelope?: SubagentTaskEnvelope;
  hardFields?: TaskPacketHardFields;
  missingContext: string[];
  blockedReasons: string[];
  noFreeTextTask: true;
  canSubmitProvider: false;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface TaskPacketBuilderState {
  schemaVersion: string;
  generatedAt: string;
  selectedShotId?: string;
  selectedAssetId?: string;
  packets: BuiltTaskPacket[];
  summary: {
    total: number;
    ready: number;
    blockedMissingContext: number;
    envelopeReady: number;
    noFreeTextTask: true;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
  };
  noFreeTextTask: true;
  validatedEnvelopeRequired: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface BuildTaskPacketsInput {
  runtimeState: ProjectRuntimeState;
  selectedShotId?: string;
  selectedAssetId?: string;
  storyChangeTransaction?: StoryChangeTransaction;
  requestedTaskKinds?: TaskPacketKind[];
  generatedAt?: string;
}

export const taskPacketBuilderSchemaVersion = "0.1.0";

export const taskPacketKinds: TaskPacketKind[] = [
  "image",
  "asset",
  "start_frame",
  "end_frame",
  "image_edit",
  "identity_qa",
  "scene_qa",
  "pair_qa",
  "story_audit",
  "video_execution",
  "audio",
  "export",
];

const expectedOutputContract: SubagentOutputContract = {
  format: "subagent_result_v1",
  requiredFields: [
    "taskId",
    "status",
    "inspectedFiles",
    "gates",
    "overallVisualVerdict",
    "styleQa",
    "motionQa",
    "continuityQa",
    "referenceUseDecision",
    "issues",
    "requiredFixes",
    "approvedFor",
    "rejectedFor",
    "summaryForMainAgent",
  ],
  severityLevels: ["P0", "P1", "P2"],
  gateFields: ["identity", "scene", "pair", "story", "prop", "style"],
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort();
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function shots(runtimeState: ProjectRuntimeState): ShotRecord[] {
  return runtimeState.storyFlow?.shots || [];
}

function assets(runtimeState: ProjectRuntimeState): AssetRecord[] {
  return runtimeState.visualMemory?.assets || [];
}

function selectedShot(runtimeState: ProjectRuntimeState, selectedShotId?: string): ShotRecord | undefined {
  const allShots = shots(runtimeState);
  return allShots.find((shot) => shot.id === selectedShotId) || allShots[0];
}

function neighborShot(shot: ShotRecord | undefined, position: "previous" | "next", runtimeState: ProjectRuntimeState): NeighborShotContext | undefined {
  if (!shot) return undefined;
  const allShots = shots(runtimeState);
  const index = allShots.findIndex((candidate) => candidate.id === shot.id);
  const neighbor = position === "previous" ? allShots[index - 1] : allShots[index + 1];
  if (!neighbor) return undefined;
  return {
    shotId: neighbor.id,
    position,
    storyFunction: neighbor.storyFunction,
    summary: neighbor.title || neighbor.storyFunction,
    approvedFramePath: neighbor.videoPath || neighbor.endFrame || neighbor.startFrame,
    continuityNotes: unique([`gates:${Object.values(neighbor.gates).join("/")}`, ...neighbor.issues]),
  };
}

function referenceFromAsset(asset: AssetRecord): ReferenceAuthority {
  const locked = asset.lockedStatus === "locked" && asset.safeForFutureReference && asset.status !== "missing";
  return {
    id: asset.id,
    path: asset.path,
    referenceRole:
      asset.type === "scene"
        ? "scene_layout_authority"
        : asset.type === "style"
          ? "style_authority"
          : asset.type === "prop"
            ? "prop_authority"
            : "identity_authority",
    authorityScope: locked ? ["prompt_reference", "future_reference"] : ["draft_preview"],
    polarity: "positive",
    lockedStatus: asset.lockedStatus,
    allowedUse: locked ? ["prompt_reference", "future_reference", "draft_preview"] : ["draft_preview"],
    canPromoteToFormal: locked,
    canUseAsFutureReference: locked,
    contaminationReason: locked ? undefined : "Asset is not locked for future reference.",
  };
}

function boundAssetsFor(input: BuildTaskPacketsInput, kind: TaskPacketKind): ReferenceAuthority[] {
  const allAssets = assets(input.runtimeState);
  const selectedAssetRefs = allAssets.filter((asset) => asset.id === input.selectedAssetId || asset.path === input.selectedAssetId);
  const lockedAssets = allAssets.filter((asset) => asset.lockedStatus === "locked" && asset.safeForFutureReference && asset.status !== "missing");
  const selectedOrLocked = selectedAssetRefs.length ? selectedAssetRefs : lockedAssets;
  const scoped = kind === "asset" && selectedAssetRefs.length ? selectedAssetRefs : selectedOrLocked;
  return scoped.map(referenceFromAsset);
}

function forbiddenReferences(runtimeState: ProjectRuntimeState): ReferenceAuthority[] {
  return assets(runtimeState)
    .filter((asset) => asset.status === "missing" || asset.lockedStatus === "needs_review" || asset.lockedStatus === "candidate")
    .map((asset) => ({
      ...referenceFromAsset(asset),
      referenceRole: asset.status === "missing" ? "rejected_case" : "temp_candidate",
      polarity: asset.status === "missing" ? "negative" : "positive",
      canPromoteToFormal: false,
      canUseAsFutureReference: false,
      contaminationReason: asset.status === "missing" ? "Asset is missing." : "Candidate assets cannot be future references.",
    }));
}

function purposeFor(kind: TaskPacketKind): SubagentTaskPurpose {
  if (kind === "image" || kind === "asset" || kind === "start_frame" || kind === "end_frame" || kind === "image_edit") return "visual_generation";
  if (kind === "video_execution") return "video_generation";
  if (kind === "pair_qa" || kind === "audio") return "continuity_audit";
  if (kind === "identity_qa" || kind === "scene_qa") return "visual_audit";
  if (kind === "story_audit") return "story_audit";
  return "regeneration_plan";
}

function taskPurposeFor(kind: TaskPacketKind): TaskEnvelope["purpose"] {
  if (kind === "image" || kind === "start_frame" || kind === "end_frame" || kind === "image_edit") return "keyframe";
  if (kind === "asset") return "asset";
  if (kind === "video_execution") return "video";
  return "audit";
}

function providerFor(kind: TaskPacketKind): { providerSlot: ProviderSlot; providerId: string; executionState: ProviderExecutionState; requiredMode: RequiredMode } {
  if (kind === "image") {
    return { providerSlot: "image.generate", providerId: "openai-image2-api", executionState: "active", requiredMode: "text2image" };
  }
  if (kind === "asset") {
    return { providerSlot: "image.reference_asset", providerId: "openai-image2-api", executionState: "active", requiredMode: "text2image" };
  }
  if (kind === "start_frame" || kind === "end_frame" || kind === "image_edit") {
    return { providerSlot: "image.edit", providerId: "openai-image2-api", executionState: "active", requiredMode: "image2image" };
  }
  if (kind === "video_execution") {
    return { providerSlot: "video.i2v", providerId: "seedance2-provider", executionState: "parked", requiredMode: "frames2video" };
  }
  if (kind === "audio") {
    return { providerSlot: "audio.tts", providerId: "audio-planned-provider", executionState: "planned", requiredMode: "tts" };
  }
  return { providerSlot: "local.workflow", providerId: "subagent-worker", executionState: "planned", requiredMode: "not_applicable" };
}

function qaChecklistFor(kind: TaskPacketKind): string[] {
  const common = ["identity_gate", "scene_gate", "story_gate", "style_gate"];
  if (kind === "pair_qa" || kind === "video_execution") return unique([...common, "pair_gate", "motion_gate"]);
  if (kind === "identity_qa") return unique(["identity_gate", "reference_authority_gate", "negative_identity_gate", "style_gate"]);
  if (kind === "scene_qa") return unique([...common, "spatial_layout_gate", "locked_scene_gate"]);
  if (kind === "start_frame") return unique([...common, "start_frame_role_gate", "reference_authority_gate"]);
  if (kind === "end_frame") return unique([...common, "end_frame_derivation_gate", "pair_gate", "reference_authority_gate"]);
  if (kind === "image_edit") return unique([...common, "edit_scope_gate", "reference_authority_gate"]);
  if (kind === "audio") return unique(["voice_source_gate", "dialogue_gate", "narration_gate", "sync_gate"]);
  if (kind === "export") return unique(["manifest_gate", "preview_gate", "asset_package_gate", "no_provider_submit_gate"]);
  if (kind === "story_audit") return unique(["story_flow_gate", "reflow_gate", "confirmation_gate", "continuity_gate"]);
  return unique([...common, "prop_gate", "reference_authority_gate"]);
}

function expectedOutputsFor(kind: TaskPacketKind, shot: ShotRecord | undefined, selectedAssetId: string | undefined, runtimeState: ProjectRuntimeState): string[] {
  const shotId = shot?.id || "project";
  if (kind === "image") return [`outputs/keyframes/${shotId}.png`];
  if (kind === "asset") return [`outputs/assets/${safeId(selectedAssetId || "selected_asset")}.png`];
  if (kind === "start_frame") return [shot?.startFrame || `outputs/keyframes/${shotId}_start.png`];
  if (kind === "end_frame") return [shot?.endFrame || `outputs/keyframes/${shotId}_end.png`];
  if (kind === "image_edit") return [`outputs/keyframes/${shotId}_edit.png`];
  if (kind === "video_execution") {
    const plan = runtimeState.videoPlanning?.taskPlans?.find((taskPlan) => taskPlan.shotId === shot?.id);
    return plan?.manifestFacts.expectedOutputs.length ? plan.manifestFacts.expectedOutputs : [`outputs/videos/${shotId}.mp4`];
  }
  if (kind === "audio") return [`outputs/audio/${shotId}.wav`];
  if (kind === "export") return ["exports/project_package.zip"];
  return [`reports/subagent/${kind}_${shotId}.json`];
}

function videoKeyframePair(runtimeState: ProjectRuntimeState, shot: ShotRecord | undefined): KeyframePairDerivation | undefined {
  if (!shot) return undefined;
  const gate = runtimeState.videoPlanning?.readinessGates?.find((candidate) => candidate.shotId === shot.id);
  if (gate?.keyframePairDerivation) return gate.keyframePairDerivation;
  if (!shot.startFrame || !shot.endFrame) return undefined;
  return {
    shotId: shot.id,
    startFrameId: shot.startFrame,
    endFrameId: shot.endFrame,
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: ["motion", "micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
  };
}

function commonForbiddenActions(kind: TaskPacketKind): string[] {
  return unique([
    "no_free_text_task",
    "validated_envelope_required",
    "provider_submit_forbidden",
    "live_submit_forbidden",
    "provider_credentials_forbidden",
    "prompt_bypass_forbidden",
    "file_mutation_forbidden",
    kind === "video_execution" ? "no_fast_model" : "",
    kind === "video_execution" ? "no_vip_channel" : "",
    kind === "video_execution" ? "no_text_to_video_main_path" : "",
    kind === "video_execution" ? "no_bgm_in_video_prompt" : "",
    kind === "start_frame" ? "no_start_frame_role_swap" : "",
    kind === "end_frame" ? "no_end_frame_without_start_frame_derivation" : "",
    kind === "image_edit" ? "no_unscoped_image_edit" : "",
    kind === "identity_qa" ? "no_identity_guessing" : "",
  ]);
}

function allowedReadScopeFor(kind: TaskPacketKind): string[] {
  return unique([
    "task_envelope",
    "source_index",
    "story_flow",
    "locked_references",
    "visual_memory",
    "injected_knowledge_snippets",
    kind === "start_frame" || kind === "end_frame" || kind === "image_edit" ? "image_keyframe_runtime" : "",
    kind === "scene_qa" ? "spatial_memory" : "",
    kind === "pair_qa" || kind === "video_execution" ? "video_planning" : "",
    kind === "audio" ? "audio_planning" : "",
    kind === "export" ? "preview_export" : "",
  ]);
}

function allowedDeltaFor(kind: TaskPacketKind, keyframePair?: KeyframePairDerivation): string[] {
  return unique([
    "structured_delta_only",
    ...(keyframePair?.allowedDelta || []),
    kind === "start_frame" ? "first_frame_composition_only" : "",
    kind === "end_frame" ? "motion_endpoint_only" : "",
    kind === "image_edit" ? "declared_edit_scope_only" : "",
    kind === "audio" ? "timing_and_delivery_only" : "",
    kind === "export" ? "packaging_only" : "",
  ]);
}

function mustPreserveFor(input: BuildTaskPacketsInput, kind: TaskPacketKind, keyframePair?: KeyframePairDerivation): string[] {
  return unique([
    "source_index_hash",
    "story_function",
    "neighbor_shot_continuity",
    "locked_reference_authority",
    ...(input.storyChangeTransaction?.mustPreserve || []),
    ...(keyframePair?.mustPreserve || []),
    kind === "start_frame" ? "start_frame_story_role" : "",
    kind === "end_frame" ? "start_to_end_frame_derivation" : "",
    kind === "image_edit" ? "declared_edit_scope" : "",
    kind === "identity_qa" ? "identity_lock" : "",
    kind === "scene_qa" ? "scene_layout_lock" : "",
    kind === "pair_qa" ? "start_end_pair_continuity" : "",
    kind === "audio" ? "voice_source_authorization" : "",
    kind === "export" ? "manifest_and_preview_facts" : "",
  ]);
}

function mustAvoidFor(input: BuildTaskPacketsInput, kind: TaskPacketKind, keyframePair?: KeyframePairDerivation): string[] {
  return unique([
    "provider_submit",
    "direct_prompt_patch",
    "free_text_task",
    "envelope_bypass",
    ...(input.storyChangeTransaction?.mustNotAdd || []),
    ...(keyframePair?.mustNotAdd || []),
    ...commonForbiddenActions(kind),
    kind === "identity_qa" ? "identity_merge_or_guess" : "",
    kind === "scene_qa" ? "unapproved_layout_change" : "",
    kind === "image_edit" ? "semantic_repair_outside_scope" : "",
    kind === "export" ? "worker_self_report_completion" : "",
  ]);
}

function contextCapsuleFor(input: BuildTaskPacketsInput, kind: TaskPacketKind, shot: ShotRecord, expectedOutputs: string[]): string[] {
  return unique([
    `task_kind:${kind}`,
    `shot:${shot.id}`,
    `section:${shot.sectionId || "unknown"}`,
    `story_function:${shot.storyFunction}`,
    `source_index_hash:${sourceIndexHash(input.runtimeState)}`,
    `expected_output:${expectedOutputs.join(",")}`,
  ]);
}

function referenceAuthorityFor(boundAssets: ReferenceAuthority[], forbidden: ReferenceAuthority[]): string[] {
  return unique([
    ...boundAssets.map((asset) => `locked:${asset.id}:${asset.referenceRole}:${asset.lockedStatus}`),
    ...forbidden.map((asset) => `forbidden:${asset.id}:${asset.referenceRole}:${asset.lockedStatus}`),
  ]);
}

function beforeAfterShotsFor(previous: NeighborShotContext, next: NeighborShotContext): string[] {
  return unique([
    `before:${previous.shotId}:${previous.storyFunction}`,
    `after:${next.shotId}:${next.storyFunction}`,
  ]);
}

function sourceIndexHash(runtimeState: ProjectRuntimeState): string {
  return runtimeState.sourceIndex?.sourceIndexHash || runtimeState.sourceIndexSummary?.sourceIndexHash || "";
}

function missingContext(input: {
  kind: TaskPacketKind;
  runtimeState: ProjectRuntimeState;
  shot?: ShotRecord;
  previous?: NeighborShotContext;
  next?: NeighborShotContext;
  boundAssets: ReferenceAuthority[];
  storyChangeTransaction?: StoryChangeTransaction;
  selectedAssetId?: string;
  keyframePair?: KeyframePairDerivation;
}): string[] {
  return unique([
    sourceIndexHash(input.runtimeState) ? "" : "source_index_hash",
    input.shot ? "" : "selected_shot",
    input.shot?.storyFunction ? "" : "story_function",
    input.previous ? "" : "previous_shot",
    input.next ? "" : "next_shot",
    input.boundAssets.length ? "" : "bound_assets",
    input.kind === "asset" && !input.selectedAssetId ? "selected_asset" : "",
    input.kind === "story_audit" && !input.storyChangeTransaction ? "story_change_transaction" : "",
    input.kind === "video_execution" && !input.keyframePair ? "keyframe_pair_derivation" : "",
  ]);
}

function preflightBlockers(missing: string[]): PreflightBlocker[] {
  return missing.map((field) => ({
    code: `missing_${field}`,
    messageForUser: `Missing required task packet context: ${field}.`,
    technicalDetail: `TaskPacketBuilder cannot create a ready SubagentTaskEnvelope without ${field}.`,
    target: field,
  }));
}

function shotLayoutFor(shot: ShotRecord, hardFields: TaskPacketHardFields): ShotLayoutContext {
  return {
    shotId: shot.id,
    sectionId: shot.sectionId,
    worldPositions: {},
    anchors: hardFields.boundAssets.map((asset) => asset.id),
    mustPreserve: hardFields.mustPreserve,
    allowedDelta: hardFields.allowedDelta,
    mustNotAdd: hardFields.mustAvoid,
  };
}

function contextLevelFor(kind: TaskPacketKind): ContextLevel {
  if (kind === "video_execution" || kind === "story_audit" || kind === "pair_qa" || kind === "export") return "L2";
  return "L1";
}

function makeTaskEnvelope(input: {
  packetId: string;
  kind: TaskPacketKind;
  shot: ShotRecord;
  hardFields: TaskPacketHardFields;
  runtimeState: ProjectRuntimeState;
  selectedAssetId?: string;
  keyframePair?: KeyframePairDerivation;
  missing: string[];
}): TaskEnvelope {
  const provider = providerFor(input.kind);
  const expectedOutputs = input.hardFields.expectedOutputs;
  const taskId = `task_${input.packetId}`;
  return {
    id: taskId,
    purpose: taskPurposeFor(input.kind),
    providerSlot: provider.providerSlot,
    providerId: provider.providerId,
    executionState: provider.executionState,
    requiredMode: provider.requiredMode,
    storyFunction: input.hardFields.storyFunction,
    sourceIndexHash: sourceIndexHash(input.runtimeState),
    dependencies: unique([input.shot.id, ...(input.hardFields.boundAssets.map((asset) => asset.id))]),
    contextLevel: contextLevelFor(input.kind),
    expectedOutputs,
    hardRules: unique([...input.hardFields.forbiddenActions, ...input.hardFields.hardNegatives]),
    references: input.hardFields.boundAssets,
    qaChecklist: input.hardFields.qaChecklist,
    preflight: {
      taskId,
      preflightScope: "formal_execution",
      status: input.missing.length ? "blocked" : "pass",
      blockers: preflightBlockers(input.missing),
      warnings: [],
      checkedAt: input.runtimeState.generatedAt,
    },
    keyframePairDerivation: input.kind === "video_execution" || input.kind === "pair_qa" ? input.keyframePair : undefined,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    outputPath: expectedOutputs[0],
    blockingReasons: input.missing,
  };
}

function makeSubagentEnvelope(input: {
  packetId: string;
  kind: TaskPacketKind;
  shot: ShotRecord;
  hardFields: TaskPacketHardFields;
  taskEnvelope: TaskEnvelope;
  runtimeState: ProjectRuntimeState;
}): SubagentTaskEnvelope {
  return {
    id: input.packetId,
    parentTaskId: input.taskEnvelope.id,
    purpose: input.hardFields.purpose,
    contextLevel: input.taskEnvelope.contextLevel as ContextLevel,
    sourceIndexHash: input.taskEnvelope.sourceIndexHash,
    sectionId: input.shot.sectionId,
    shotId: input.shot.id,
    userIntent: input.hardFields.contextCapsule.join(" | "),
    storyFunction: input.hardFields.storyFunction,
    neighborShots: [input.hardFields.previousShot, input.hardFields.nextShot],
    lockedReferences: input.hardFields.boundAssets,
    forbiddenReferences: forbiddenReferences(input.runtimeState),
    shotLayout: shotLayoutFor(input.shot, input.hardFields),
    providerPolicySummary: unique([
      `taskKind=${input.kind}`,
      `slot=${input.taskEnvelope.providerSlot}`,
      `provider=${input.taskEnvelope.providerId}`,
      `state=${input.taskEnvelope.executionState}`,
      `mode=${input.taskEnvelope.requiredMode}`,
      `expectedOutputs=${input.taskEnvelope.expectedOutputs.join(",")}`,
      ...input.hardFields.contextCapsule.map((item) => `context:${item}`),
      "noFreeTextTask=true",
      "providerSubmissionForbidden=true",
      "liveSubmitAllowed=false",
    ]),
    taskEnvelope: input.taskEnvelope,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories:
      input.kind === "video_execution"
        ? ["storyflow", "camera", "provider", "qa"]
        : input.kind === "audio"
          ? ["storyflow", "audio", "qa"]
          : input.kind === "scene_qa"
            ? ["storyflow", "composition", "camera", "qa"]
            : ["storyflow", "style", "qa"],
    qaPackBindings: {},
    allowedReadScopes: input.hardFields.allowedReadScope,
    disallowedReadScopes: unique([
      "provider_credentials",
      "api_keys",
      "live_provider_task_ids",
      "unrouted_knowledge_library",
      "rejected_references",
      "failed_artifacts",
      "outside_project_runtime_state",
    ]),
    sourceIndexRequired: true,
    mustInspectNeighborShotIds: [input.hardFields.previousShot.shotId, input.hardFields.nextShot.shotId],
    authorityPriority: ["source_index", "provider_policy", "preflight", "identity", "scene", "pair", "story", "prop", "style"],
    resultMustReferencePackHashes: true,
    qaChecklist: input.hardFields.qaChecklist,
    mustPreserve: input.hardFields.mustPreserve,
    allowedDelta: input.hardFields.allowedDelta,
    mustNotAdd: input.hardFields.mustAvoid,
    expectedOutputContract: input.hardFields.expectedOutputContract,
  };
}

function buildPacket(input: BuildTaskPacketsInput, kind: TaskPacketKind): BuiltTaskPacket {
  const shot = selectedShot(input.runtimeState, input.selectedShotId);
  const previous = neighborShot(shot, "previous", input.runtimeState);
  const next = neighborShot(shot, "next", input.runtimeState);
  const boundAssets = boundAssetsFor(input, kind);
  const forbidden = forbiddenReferences(input.runtimeState);
  const keyframePair = kind === "video_execution" || kind === "pair_qa" ? videoKeyframePair(input.runtimeState, shot) : undefined;
  const missing = missingContext({
    kind,
    runtimeState: input.runtimeState,
    shot,
    previous,
    next,
    boundAssets,
    storyChangeTransaction: input.storyChangeTransaction,
    selectedAssetId: input.selectedAssetId,
    keyframePair,
  });
  const packetId = `subagent_packet_${kind}_${safeId(shot?.id || input.selectedAssetId || "project")}`;

  if (missing.length || !shot || !previous || !next) {
    return {
      packetId,
      taskKind: kind,
      status: "blocked_missing_context",
      missingContext: missing,
      blockedReasons: missing.map((field) => `blocked_missing_context:${field}`),
      noFreeTextTask: true,
      canSubmitProvider: false,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    };
  }

  const hardFields: TaskPacketHardFields = {
    purpose: purposeFor(kind),
    contextCapsule: contextCapsuleFor(input, kind, shot, expectedOutputsFor(kind, shot, input.selectedAssetId, input.runtimeState)),
    storyFunction: shot.storyFunction,
    previousShot: previous,
    nextShot: next,
    beforeAfterShots: beforeAfterShotsFor(previous, next),
    boundAssets,
    referenceAuthority: referenceAuthorityFor(boundAssets, forbidden),
    expectedOutputs: expectedOutputsFor(kind, shot, input.selectedAssetId, input.runtimeState),
    mustPreserve: mustPreserveFor(input, kind, keyframePair),
    allowedDelta: allowedDeltaFor(kind, keyframePair),
    mustAvoid: mustAvoidFor(input, kind, keyframePair),
    hardNegatives: mustAvoidFor(input, kind, keyframePair),
    qaChecklist: qaChecklistFor(kind),
    expectedOutputContract,
    allowedReadScope: allowedReadScopeFor(kind),
    forbiddenActions: commonForbiddenActions(kind),
    outputSchema: "subagent_result_v1",
  };
  const taskEnvelope = makeTaskEnvelope({
    packetId,
    kind,
    shot,
    hardFields,
    runtimeState: input.runtimeState,
    selectedAssetId: input.selectedAssetId,
    keyframePair,
    missing,
  });
  const envelope = makeSubagentEnvelope({
    packetId,
    kind,
    shot,
    hardFields,
    taskEnvelope,
    runtimeState: input.runtimeState,
  });

  return {
    packetId,
    taskKind: kind,
    status: "ready",
    envelopeId: envelope.id,
    envelope,
    hardFields,
    missingContext: [],
    blockedReasons: [],
    noFreeTextTask: true,
    canSubmitProvider: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

export function buildTaskPackets(input: BuildTaskPacketsInput): TaskPacketBuilderState {
  const requestedTaskKinds = input.requestedTaskKinds || taskPacketKinds;
  const packets = requestedTaskKinds.map((kind) => buildPacket(input, kind));

  return {
    schemaVersion: taskPacketBuilderSchemaVersion,
    generatedAt: input.generatedAt || new Date().toISOString(),
    selectedShotId: input.selectedShotId,
    selectedAssetId: input.selectedAssetId,
    packets,
    summary: {
      total: packets.length,
      ready: packets.filter((packet) => packet.status === "ready").length,
      blockedMissingContext: packets.filter((packet) => packet.status === "blocked_missing_context").length,
      envelopeReady: packets.filter((packet) => packet.envelope).length,
      noFreeTextTask: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    noFreeTextTask: true,
    validatedEnvelopeRequired: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase38 builds dry-run SubagentTaskEnvelope packets for every production task kind.",
      "Every ready packet carries context capsule, reference authority, before/after shots, expected outputs, hard negatives, QA checklist, and subagent_result_v1 contract.",
      "No packet submits a provider, starts a worker, reads credentials, writes prompt files, or accepts free-text task bypass.",
    ],
  };
}
