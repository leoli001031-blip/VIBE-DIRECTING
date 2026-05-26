import { PROVIDER_CREDENTIALS_FORBIDDEN } from "./statusConstants";
import { unique } from "./collectionUtils";
import type { ProjectRuntimeState } from "./projectState";
import { attachKnowledgeBudgetToRouteResult, buildKnowledgeContextBudget } from "./knowledgeContextBudget";
import {
  buildFallbackKnowledgeRouteResult,
  ensureMinimumDefaultKnowledgePacks,
  hasNonEmptyKnowledgeTrace,
} from "./knowledgeDefaults";
import { buildInputHash, buildNonOverridableGateHashes, buildPolicyBinding, buildSubagentInputHash, envelopeSchemaVersion } from "./envelopeValidator";
import { selectAvailableKnowledgePacks } from "./knowledgeLibrary";
import { stableKnowledgeHash } from "./knowledgeManifest";
import { routeKnowledge } from "./knowledgeRouter";
import type { ContextBudgetResult, KnowledgePack, KnowledgePackManifest, KnowledgeRouteResult, KnowledgeTaskPurpose } from "./knowledgeTypes";
import { buildDefaultProviderRegistry, buildProviderRequirement, selectCapabilityForRequirement } from "./providerCapabilities";
import type {
  AssetRecord,
  ContextLevel,
  KeyframePairDerivation,
  MotionEndpointContract,
  NeighborShotContext,
  PreflightBlocker,
  ProviderCapabilityRequirement,
  ProviderPolicy,
  ProviderRegistry,
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

export type TaskPacketStatus = "ready" | "blocked_missing_context" | "blocked_packet_validation";

export type TaskPacketCoverageStatus = "covered_ready" | "covered_blocked" | "missing";

export interface TaskPacketKnowledgeTrace {
  status: "present" | "missing";
  knowledgeRouteResultId?: string;
  contextBudgetId?: string;
  knowledgeInputHash?: string;
  knowledgeManifestHash?: string;
  packIds: string[];
  snippetIds: string[];
  snippetCount: number;
  qaPackBindingIds: string[];
  warnings: string[];
}

export interface TaskPacketValidationReceipt {
  receiptKind: "phase38_task_packet_validation";
  status: "pass" | "blocked";
  envelopeId?: string;
  taskEnvelopeId?: string;
  checkedAt: string;
  requiredFields: {
    validatedEnvelope: boolean;
    expectedOutputs: boolean;
    sourceFactTrace: boolean;
    injectedKnowledgeTrace: boolean;
    qaChecklist: boolean;
    resultSchema: boolean;
    allowedReadScope: boolean;
    forbiddenActions: boolean;
    noFreeTextWorker: boolean;
    phase37VisualConsistencyTrace: boolean;
  };
  blockers: string[];
}

export interface TaskPacketHardFields {
  purpose: SubagentTaskPurpose;
  providerRequirements: ProviderCapabilityRequirement;
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
  sourceFactTrace: string[];
  injectedKnowledgeTrace: TaskPacketKnowledgeTrace;
  validationReceipt: TaskPacketValidationReceipt;
  missingContext: string[];
  blockedReasons: string[];
  noFreeTextTask: true;
  canSubmitProvider: false;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface TaskPacketCoverageItem {
  taskKind: TaskPacketKind;
  status: TaskPacketCoverageStatus;
  packetId?: string;
  envelopeId?: string;
  validatedEnvelope: boolean;
  expectedOutputs: boolean;
  sourceFactTrace: boolean;
  injectedKnowledgeTrace: boolean;
  qaChecklist: boolean;
  resultSchema: boolean;
  allowedReadScope: boolean;
  forbiddenActions: boolean;
  phase37VisualConsistencyTrace: boolean;
  noFreeTextTask: boolean;
  blockedReasons: string[];
}

export interface TaskPacketPlannerReceipt {
  receiptKind: "phase38_full_task_subagent_packet_planner";
  phase: "phase_38_full_task_subagent_packet_planner";
  receiptId: string;
  generatedAt: string;
  status: "pass" | "blocked";
  allProductionTaskKindsCovered: boolean;
  productionTaskKinds: TaskPacketKind[];
  readyKinds: TaskPacketKind[];
  blockedKinds: TaskPacketKind[];
  coverage: TaskPacketCoverageItem[];
  requiredReadyPacketFields: Array<keyof TaskPacketValidationReceipt["requiredFields"]>;
  validatedEnvelopeRequired: true;
  formalTaskRejectsMissingPacket: true;
  expectedOutputsIncluded: boolean;
  sourceFactTraceRecorded: boolean;
  knowledgePacksRecorded: boolean;
  phase37VisualConsistencyTraceRequired: true;
  noFreeTextWorker: true;
  naturalLanguageMustEnterTransactionOrPacketBuilder: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  blockedReasons: string[];
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
    validatedEnvelopeReady: number;
    noFreeTextTask: true;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
  };
  plannerReceipt: TaskPacketPlannerReceipt;
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
  providerRegistry?: ProviderRegistry;
  providerPolicy?: ProviderPolicy;
  knowledgeManifest?: KnowledgePackManifest;
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
    "changedFiles",
    "tests",
    "artifactPaths",
    "residualRisks",
    "touched",
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

function boundaryShot(shot: ShotRecord, position: "previous" | "next", adjacentShot?: ShotRecord): NeighborShotContext {
  const boundaryKind = position === "previous" ? "start" : "end";
  const actId = shot.actId || "project";
  const transition = adjacentShot?.actId && adjacentShot.actId !== shot.actId ? `cross_act:${adjacentShot.actId}->${shot.actId}` : "";
  return {
    shotId: `boundary_${boundaryKind}_${safeId(actId || shot.id)}`,
    position,
    storyFunction: `${boundaryKind}_of_${actId}_act_anchor`,
    summary: `${boundaryKind} boundary sentinel for ${actId}`,
    continuityNotes: unique([
      `boundary_sentinel:${boundaryKind}`,
      `act_anchor:${actId}`,
      shot.sectionId ? `section:${shot.sectionId}` : "",
      transition,
    ]),
  };
}

function neighborShot(shot: ShotRecord | undefined, position: "previous" | "next", runtimeState: ProjectRuntimeState): NeighborShotContext | undefined {
  if (!shot) return undefined;
  const allShots = shots(runtimeState);
  const index = allShots.findIndex((candidate) => candidate.id === shot.id);
  const neighbor = position === "previous" ? allShots[index - 1] : allShots[index + 1];
  if (!neighbor) return boundaryShot(shot, position);
  if (shot.actId && neighbor.actId && shot.actId !== neighbor.actId) return boundaryShot(shot, position, neighbor);
  return {
    shotId: neighbor.id,
    position,
    storyFunction: neighbor.storyFunction,
    summary: neighbor.title || neighbor.storyFunction,
    approvedFramePath: neighbor.videoPath || neighbor.endFrame || neighbor.startFrame,
    continuityNotes: unique([`gates:${Object.values(neighbor.gates).join("/")}`, ...neighbor.issues]),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => stringList(item));
  const text = stringValue(value);
  return text ? [text] : [];
}

const unsafeContextRefPattern = /(?:bearer\s+[a-z0-9._~+/-]+|sk-[a-z0-9_-]{12,}|tvly-[a-z0-9_-]{8,}|api[_-]?key|secret|password|token|(?:^|[#:=\s])(?:[A-Za-z]:[\\/]|\/Users\/|\/private\/|\/tmp\/|~[\\/]|\/\/))/i;

function safeContextValue(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (unsafeContextRefPattern.test(trimmed)) return `redacted_ref:${stableKnowledgeHash(trimmed)}`;
  return trimmed.slice(0, 240);
}

function safeContextList(value: unknown, limit = 8): string[] {
  return unique(stringList(value).map(safeContextValue).filter(Boolean)).slice(0, limit);
}

function dynamicRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function assetIdMatches(asset: AssetRecord, id: string | undefined): boolean {
  return Boolean(id && (asset.id === id || asset.path === id));
}

function assetIsUsable(asset: AssetRecord): boolean {
  return asset.status !== "missing";
}

function assetIsLocked(asset: AssetRecord): boolean {
  return asset.lockedStatus === "locked" && asset.safeForFutureReference && asset.status !== "missing";
}

function shotScopeTokens(shot: ShotRecord | undefined): string[] {
  if (!shot) return [];
  const record = dynamicRecord(shot);
  return unique([
    shot.id,
    shot.actId,
    shot.sectionId || "",
    ...stringList(record.sceneId),
    ...stringList(record.sceneIds),
    ...stringList(record.styleId),
    ...stringList(record.styleIds),
    ...stringList(record.assetId),
    ...stringList(record.assetIds),
    ...stringList(record.referenceId),
    ...stringList(record.referenceIds),
    ...stringList(record.lockedReferenceIds),
    ...stringList(record.characterIds),
    ...stringList(record.propIds),
  ]);
}

function assetScopeTokens(asset: AssetRecord): string[] {
  const record = dynamicRecord(asset);
  return unique([
    asset.id,
    asset.path,
    asset.name,
    ...stringList(record.sceneId),
    ...stringList(record.sceneIds),
    ...stringList(record.styleId),
    ...stringList(record.styleIds),
    ...stringList(record.actId),
    ...stringList(record.sectionId),
    ...stringList(record.usedByShotIds),
    ...stringList(record.sourceRefs),
  ]);
}

function assetInShotScope(asset: AssetRecord, shot: ShotRecord | undefined): boolean {
  const shotTokens = new Set(shotScopeTokens(shot));
  if (!shotTokens.size) return false;
  return assetScopeTokens(asset).some((token) => shotTokens.has(token));
}

function uniqueAssetsById(values: AssetRecord[]): AssetRecord[] {
  const seen = new Set<string>();
  return values.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

function referenceFromAsset(asset: AssetRecord): ReferenceAuthority {
  const locked = asset.lockedStatus === "locked" && asset.safeForFutureReference && asset.status !== "missing";
  const record = dynamicRecord(asset);
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
    textConstraints: safeContextList(record.textConstraints, 6),
    sourceRefs: safeContextList(record.sourceRefs, 10),
    contaminationReason: locked ? undefined : "Asset is not locked for future reference.",
  };
}

function boundAssetsFor(input: BuildTaskPacketsInput, kind: TaskPacketKind, shot: ShotRecord | undefined): ReferenceAuthority[] {
  const allAssets = assets(input.runtimeState);
  const selectedAssetRefs = allAssets.filter((asset) => assetIdMatches(asset, input.selectedAssetId) && assetIsUsable(asset));
  const shotScopedAssets = allAssets.filter((asset) => assetIsLocked(asset) && assetInShotScope(asset, shot));
  const lockedSceneAssets = allAssets.filter((asset) => assetIsLocked(asset) && asset.type === "scene");
  const implicitSceneScopeAssets = shot && lockedSceneAssets.length === 1 ? lockedSceneAssets : [];
  const styleScopeAssets = allAssets.filter((asset) => assetIsLocked(asset) && asset.type === "style");
  const scoped = uniqueAssetsById(
    kind === "asset" ? selectedAssetRefs : [...selectedAssetRefs, ...shotScopedAssets, ...implicitSceneScopeAssets, ...styleScopeAssets],
  );
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
  if (kind === "audio") return "audio";
  return "audit";
}

function knowledgeTaskPurposeFor(kind: TaskPacketKind): KnowledgeTaskPurpose {
  if (kind === "image" || kind === "start_frame" || kind === "end_frame" || kind === "image_edit") return "keyframe";
  if (kind === "asset") return "asset";
  if (kind === "video_execution") return "video";
  if (kind === "audio") return "audio";
  if (kind === "story_audit") return "story_audit";
  if (kind === "pair_qa") return "continuity_audit";
  if (kind === "identity_qa" || kind === "scene_qa") return "visual_audit";
  return "audit";
}

function providerRequirementFor(kind: TaskPacketKind): ProviderCapabilityRequirement {
  if (kind === "image") {
    return buildProviderRequirement({
      slot: "image.generate",
      requiredMode: "text2image",
      inputKinds: ["text"],
      outputKind: "image",
      notes: ["Keyframe generation requires a registry-selected text-to-image capability."],
    });
  }
  if (kind === "asset") {
    return buildProviderRequirement({
      slot: "image.reference_asset",
      requiredMode: "text2image",
      inputKinds: ["text", "reference_image"],
      outputKind: "image",
      supports: { referenceImage: true },
      maxReferenceImages: 1,
      notes: ["Reference asset generation requires image output and reference-image support."],
    });
  }
  if (kind === "start_frame" || kind === "end_frame" || kind === "image_edit") {
    return buildProviderRequirement({
      slot: "image.edit",
      requiredMode: "image2image",
      inputKinds: ["text", "image", "reference_image"],
      outputKind: "image",
      supports: { imageEdit: true, referenceImage: true },
      maxReferenceImages: 1,
      forbiddenFallbacks: ["image2image_to_text2image"],
      notes: ["Edit and start/end-frame packets require image-to-image capability and forbid text-to-image fallback."],
    });
  }
  if (kind === "video_execution") {
    return buildProviderRequirement({
      slot: "video.i2v",
      requiredMode: "frames2video",
      inputKinds: ["text", "start_frame", "end_frame"],
      outputKind: "video",
      supports: { referenceImage: true, startEndFrame: true },
      executionStates: ["parked", "planned", "unavailable"],
      forbiddenFallbacks: ["frames2video_to_text2video"],
      notes: ["Video execution packets require a parked frame-to-video capability selected by registry/policy."],
    });
  }
  if (kind === "audio") {
    return buildProviderRequirement({
      slot: "audio.tts",
      requiredMode: "tts",
      inputKinds: ["text"],
      outputKind: "audio",
      executionStates: ["planned", "unavailable"],
      notes: ["Audio packets require a planned TTS capability selected by registry/policy."],
    });
  }
  return buildProviderRequirement({
    slot: "local.workflow",
    requiredMode: "not_applicable",
    inputKinds: ["text"],
    outputKind: "metadata",
    executionStates: ["planned", "available", "active"],
    notes: ["Audit/export packets require local workflow capability rather than a media provider."],
  });
}

function qaChecklistFor(kind: TaskPacketKind): string[] {
  const common = ["identity_gate", "scene_gate", "story_gate", "style_gate"];
  const motionContractGates = ["motion_endpoint_contract_gate", "body_mechanics_gate", "editable_protected_region_gate"];
  if (kind === "pair_qa" || kind === "video_execution") return unique([...common, "pair_gate", "motion_gate", ...motionContractGates]);
  if (kind === "identity_qa") return unique(["identity_gate", "reference_authority_gate", "negative_identity_gate", "style_gate"]);
  if (kind === "scene_qa") return unique([...common, "spatial_layout_gate", "locked_scene_gate"]);
  if (kind === "start_frame") return unique([...common, "start_frame_role_gate", "reference_authority_gate"]);
  if (kind === "end_frame") return unique([...common, "end_frame_derivation_gate", "pair_gate", "reference_authority_gate", ...motionContractGates]);
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

function motionContractTraceRequiredFor(kind: TaskPacketKind): boolean {
  return kind === "start_frame" || kind === "end_frame" || kind === "pair_qa" || kind === "video_execution";
}

function motionContractFromReadinessGate(runtimeState: ProjectRuntimeState, shot: ShotRecord): MotionEndpointContract | undefined {
  const gate = runtimeState.videoPlanning?.readinessGates?.find((candidate) => candidate.shotId === shot.id);
  return dynamicRecord(gate).motionEndpointContract as MotionEndpointContract | undefined;
}

function motionEndpointFactsFromTaskPlan(runtimeState: ProjectRuntimeState, shot: ShotRecord): Record<string, unknown> | undefined {
  const taskPlan = runtimeState.videoPlanning?.taskPlans?.find((candidate) => candidate.shotId === shot.id);
  const facts = dynamicRecord(taskPlan).motionEndpointFacts;
  return Object.keys(dynamicRecord(facts)).length ? dynamicRecord(facts) : undefined;
}

function motionContractTraceValue(value: unknown, fallback: string): string {
  return stringValue(value) || fallback;
}

function motionContractBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function motionContractRegionIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(
      value.flatMap((item) => {
        if (typeof item === "string") return [item];
        return stringList(dynamicRecord(item).id);
      }),
    );
  }
  return stringList(value);
}

function motionContractFactsFor(input: {
  kind: TaskPacketKind;
  runtimeState: ProjectRuntimeState;
  shot: ShotRecord;
  keyframePair?: KeyframePairDerivation;
}): string[] {
  if (!motionContractTraceRequiredFor(input.kind)) return [];

  const contract = motionContractFromReadinessGate(input.runtimeState, input.shot);
  const taskPlanFacts = contract ? undefined : motionEndpointFactsFromTaskPlan(input.runtimeState, input.shot);
  const keyframePair = contract?.keyframePairDerivation || input.keyframePair || videoKeyframePair(input.runtimeState, input.shot);
  const source = contract ? "readiness_gate_contract" : taskPlanFacts ? "task_plan_facts" : "keyframe_pair_derived_minimal";
  const status = contract
    ? contract.status
    : taskPlanFacts
      ? motionContractTraceValue(taskPlanFacts.contractStatus ?? taskPlanFacts.motionContractStatus, "missing")
      : "derived_minimal";
  const motionType = contract ? contract.motionType : taskPlanFacts ? motionContractTraceValue(taskPlanFacts.motionType, "unknown") : "unknown";
  const endRequired = contract
    ? contract.whetherEndFrameRequired
    : taskPlanFacts
      ? motionContractBoolean(taskPlanFacts.whetherEndFrameRequired ?? taskPlanFacts.endRequired, Boolean(keyframePair))
      : Boolean(keyframePair);
  const bodyMechanicsRequired = contract
    ? contract.bodyMechanics.required
    : taskPlanFacts
      ? motionContractBoolean(taskPlanFacts.bodyMechanicsRequired, false)
      : false;
  const editableRegionIds = contract ? contract.editableRegions.map((region) => region.id) : motionContractRegionIds(taskPlanFacts?.editableRegionIds);
  const protectedRegionIds = contract ? contract.protectedRegions.map((region) => region.id) : motionContractRegionIds(taskPlanFacts?.protectedRegionIds);
  const bboxOnlyForbidden = contract
    ? contract.gateInputs.bboxOnlyMotionForbidden
    : taskPlanFacts
      ? motionContractBoolean(taskPlanFacts.bboxOnlyMotionForbidden, false)
      : false;

  return unique([
    `motion_contract:shot:${input.shot.id}:status:${status}:type:${motionType}`,
    `motion_contract:source:${source}`,
    `motion_contract:end_required:${endRequired}`,
    `motion_contract:body_mechanics_required:${bodyMechanicsRequired}`,
    `motion_contract:editable_regions:${editableRegionIds.length ? editableRegionIds.join(",") : source}`,
    `motion_contract:protected_regions:${protectedRegionIds.length ? protectedRegionIds.join(",") : source}`,
    `motion_contract:bbox_only_forbidden:${bboxOnlyForbidden}`,
    keyframePair
      ? `motion_contract:keyframe_pair:${keyframePair.shotId}:${keyframePair.startFrameId}:${keyframePair.endFrameId}:${keyframePair.endDerivationSource}:${keyframePair.validForI2vPair}`
      : `motion_contract:keyframe_pair:${input.shot.id}:${input.shot.startFrame || "missing_start_frame"}:${input.shot.endFrame || "missing_end_frame"}:${source}:false`,
  ]);
}

function commonForbiddenActions(kind: TaskPacketKind): string[] {
  return unique([
    "no_free_text_task",
    "no_free_text_worker",
    "validated_envelope_required",
    "provider_submit_forbidden",
    "live_submit_forbidden",
    PROVIDER_CREDENTIALS_FORBIDDEN,
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
    ...boundAssets.flatMap((asset) => (asset.textConstraints || []).map((constraint) => `constraint:${asset.id}:${constraint}`)),
    ...boundAssets.flatMap((asset) => (asset.sourceRefs || []).map((ref) => `source_ref:${asset.id}:${ref}`)),
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

function phase37VisualConsistencySourceFacts(input: {
  runtimeState: ProjectRuntimeState;
  shot: ShotRecord;
  boundAssets: ReferenceAuthority[];
  keyframePair?: KeyframePairDerivation;
}): string[] {
  const gates = input.shot.gates || {};
  const sceneAssetIds = input.boundAssets.filter((asset) => asset.referenceRole === "scene_layout_authority").map((asset) => asset.id);
  const identityAssetIds = input.boundAssets.filter((asset) => asset.referenceRole === "identity_authority").map((asset) => asset.id);
  const layoutRefs = unique([
    ...stringList(dynamicRecord(input.shot).shotLayoutId),
    ...stringList(dynamicRecord(input.shot).shotLayoutIds),
    input.shot.id,
  ]);
  const spatialRefs = unique([
    ...sceneAssetIds,
    ...stringList(dynamicRecord(input.runtimeState).spatialMemoryId),
    sourceIndexHash(input.runtimeState),
  ]);
  const pairRefs = unique([
    input.keyframePair?.shotId || "",
    input.keyframePair?.startFrameId || input.shot.startFrame || "",
    input.keyframePair?.endFrameId || input.shot.endFrame || "",
  ]);

  return unique([
    `phase37_contract_receipt:visual_consistency_contract:required`,
    `phase37_gate:identity:${gates.identity || "UNKNOWN"}:${identityAssetIds.join(",") || "locked_identity_reference_required"}`,
    `phase37_gate:scene:${gates.scene || "UNKNOWN"}:${sceneAssetIds.join(",") || "locked_scene_reference_required"}`,
    `phase37_gate:shot_layout:${layoutRefs.join(",")}`,
    `phase37_gate:spatial_memory:${spatialRefs.join(",")}`,
    `phase37_gate:keyframe_pair:${pairRefs.join(",") || "keyframe_pair_gate_reference_required"}`,
    `phase37_gate:master_inheritance_qa:${sceneAssetIds.join(",") || input.shot.id}:worker_provider_self_report_cannot_override`,
  ]);
}

function sourceFactTraceFor(input: {
  kind: TaskPacketKind;
  runtimeState: ProjectRuntimeState;
  shot: ShotRecord;
  previous: NeighborShotContext;
  next: NeighborShotContext;
  boundAssets: ReferenceAuthority[];
  forbidden: ReferenceAuthority[];
  expectedOutputs: string[];
  keyframePair?: KeyframePairDerivation;
}): string[] {
  return unique([
    `task_kind:${input.kind}`,
    `source_index:${sourceIndexHash(input.runtimeState)}`,
    `shot:${input.shot.id}`,
    `story_function:${input.shot.storyFunction}`,
    `previous_shot:${input.previous.shotId}`,
    `next_shot:${input.next.shotId}`,
    ...input.boundAssets.map((asset) => `locked_reference:${asset.id}:${asset.referenceRole}:${asset.lockedStatus}`),
    ...input.forbidden.map((asset) => `forbidden_reference:${asset.id}:${asset.referenceRole}:${asset.lockedStatus}`),
    ...input.expectedOutputs.map((output) => `expected_output:${output}`),
    ...phase37VisualConsistencySourceFacts(input),
    ...motionContractFactsFor(input),
  ]);
}

function hasPhase37VisualConsistencyTrace(sourceFactTrace: string[]): boolean {
  const required = [
    "phase37_gate:identity:",
    "phase37_gate:scene:",
    "phase37_gate:shot_layout:",
    "phase37_gate:spatial_memory:",
    "phase37_gate:keyframe_pair:",
    "phase37_gate:master_inheritance_qa:",
  ];
  return required.every((prefix) => sourceFactTrace.some((item) => item.startsWith(prefix)));
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

function registryFor(input: Pick<BuildTaskPacketsInput, "runtimeState" | "providerRegistry">): ProviderRegistry {
  return input.providerRegistry || input.runtimeState.imagePipeline?.providerRegistry || buildDefaultProviderRegistry(input.runtimeState.generatedAt);
}

function policyFor(input: Pick<BuildTaskPacketsInput, "runtimeState" | "providerPolicy">): ProviderPolicy | undefined {
  return input.providerPolicy || input.runtimeState.project?.providerPolicy;
}

function knowledgeManifestHashFor(input: Pick<BuildTaskPacketsInput, "runtimeState" | "knowledgeManifest">): string {
  return (
    input.knowledgeManifest?.manifestHash ||
    input.runtimeState.sourceIndex?.knowledgeManifestHash ||
    stableKnowledgeHash("minimum_default_knowledge_fallback")
  );
}

function availableKnowledgePacksFor(input: Pick<BuildTaskPacketsInput, "runtimeState" | "knowledgeManifest">): KnowledgePack[] {
  const manifestPacks = input.knowledgeManifest
    ? selectAvailableKnowledgePacks(input.knowledgeManifest, input.runtimeState.sourceIndex)
    : [];
  return ensureMinimumDefaultKnowledgePacks(manifestPacks);
}

function knowledgeIntentFor(input: {
  kind: TaskPacketKind;
  shot: ShotRecord;
  hardFields: TaskPacketHardFields;
}): string {
  return unique([
    `task_kind:${input.kind}`,
    `story_function:${input.hardFields.storyFunction}`,
    input.shot.title || "",
    ...input.hardFields.contextCapsule,
    ...input.hardFields.qaChecklist.map((item) => `qa:${item}`),
    ...input.hardFields.mustPreserve.map((item) => `preserve:${item}`),
    ...input.hardFields.mustAvoid.map((item) => `avoid:${item}`),
    input.kind === "audio" ? "audio tts voice narration dialogue ambience bgm no_bgm provider slot audio.tts audio.music" : "",
    input.kind === "video_execution" ? "video prompt default no_bgm audio plan separated from video prompt" : "",
  ]).join(" | ");
}

function knowledgeTraceWarnings(routeResult: KnowledgeRouteResult, contextBudget: ContextBudgetResult): string[] {
  return unique([
    ...routeResult.warnings,
    ...contextBudget.warnings,
    hasNonEmptyKnowledgeTrace({
      injectedKnowledgePacks: contextBudget.injectedKnowledgePacks,
      injectedKnowledgeSnippetIds: contextBudget.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
      injectedKnowledgeSnippets: contextBudget.injectedSnippets,
    })
      ? ""
      : "knowledge_trace_blocker:empty_injection_trace",
  ]);
}

function maxKnowledgeRouteMatchesFor(taskPurpose: KnowledgeTaskPurpose): number {
  if (taskPurpose === "audio") return 4;
  if (taskPurpose === "video" || taskPurpose === "i2v" || taskPurpose === "video_generation") return 6;
  if (taskPurpose === "script" || taskPurpose === "story_audit") return 5;
  if (taskPurpose === "qa" || taskPurpose === "audit" || taskPurpose === "continuity_audit" || taskPurpose === "visual_audit") return 5;
  return 6;
}

function requiredKnowledgeCategoriesFor(taskPurpose: KnowledgeTaskPurpose): string[] {
  if (taskPurpose === "audio") return ["audio", "provider", "qa"];
  if (taskPurpose === "video" || taskPurpose === "i2v" || taskPurpose === "video_generation") return ["camera", "prompt", "provider", "qa", "audio"];
  if (taskPurpose === "script" || taskPurpose === "story_audit") return ["script", "storyflow", "qa"];
  if (taskPurpose === "qa" || taskPurpose === "audit" || taskPurpose === "continuity_audit" || taskPurpose === "visual_audit") return ["qa"];
  return ["prompt", "provider", "qa"];
}

function boundKnowledgeRouteMatches(routeResult: KnowledgeRouteResult, maxMatches: number, taskPurpose: KnowledgeTaskPurpose): KnowledgeRouteResult {
  const requiredCategories = requiredKnowledgeCategoriesFor(taskPurpose);
  const hasRequiredCategories = requiredCategories.every((category) => routeResult.matches.some((match) => match.category === category));
  if (routeResult.matches.length <= maxMatches && hasRequiredCategories) return routeResult;
  const selected = routeResult.matches.slice(0, maxMatches);

  for (const category of requiredCategories) {
    if (selected.some((match) => match.category === category)) continue;
    const requiredMatch = routeResult.matches.find((match) => match.category === category);
    if (!requiredMatch || selected.some((match) => match.packId === requiredMatch.packId)) continue;

    if (selected.length < maxMatches) {
      selected.push(requiredMatch);
      continue;
    }

    const replaceIndex = Math.max(
      0,
      [...selected]
        .reverse()
        .findIndex((match) => !requiredCategories.includes(match.category)),
    );
    const actualIndex = selected.length - 1 - replaceIndex;
    selected[actualIndex] = requiredMatch;
  }

  const selectedByPackId = new Map(selected.map((match) => [match.packId, match]));
  const boundedMatches = Array.from(selectedByPackId.values()).slice(0, maxMatches);

  return {
    ...routeResult,
    matches: boundedMatches,
    notInjected: unique([
      ...(routeResult.notInjected || []).map((item) => `${item.packId}:${item.reason}`),
      ...routeResult.matches
        .filter((match) => !boundedMatches.some((selectedMatch) => selectedMatch.packId === match.packId))
        .map((match) => `${match.packId}:bounded_route_limit`),
    ]).map((item) => {
      const [packId, ...reason] = item.split(":");
      return { packId, reason: reason.join(":") || "bounded_route_limit" };
    }),
    warnings: unique([...routeResult.warnings, `knowledge_route_bounded:${maxMatches}/${routeResult.matches.length}`]),
  };
}

function resolveKnowledgeInjection(input: {
  packetId: string;
  kind: TaskPacketKind;
  shot: ShotRecord;
  hardFields: TaskPacketHardFields;
  runtimeState: ProjectRuntimeState;
  knowledgeManifest?: KnowledgePackManifest;
}): {
  routeResult: KnowledgeRouteResult;
  contextBudget: ContextBudgetResult;
  routeWarnings: string[];
  manifestHash: string;
} {
  const availablePacks = availableKnowledgePacksFor(input);
  const taskPurpose = knowledgeTaskPurposeFor(input.kind);
  const providerSlot = input.hardFields.providerRequirements.slot;
  const contextLevel = contextLevelFor(input.kind);
  const userIntent = knowledgeIntentFor(input);
  const maxInjectionTokens = contextLevel === "L2" ? 1500 : 1000;
  const unboundedRouteResult = routeKnowledge({
    taskId: `task_${input.packetId}`,
    userIntent,
    taskPurpose,
    providerSlot,
    contextLevel,
    availablePacks,
    consumers: ["prompt_compiler", "subagent_context", "qa_gate", "diagnostics"],
    maxInjectionTokens,
  });
  const baseRouteResult = boundKnowledgeRouteMatches(unboundedRouteResult, maxKnowledgeRouteMatchesFor(taskPurpose), taskPurpose);
  const baseBudget = buildKnowledgeContextBudget({
    routeResult: baseRouteResult,
    availablePacks,
    maxInjectionTokens,
  });
  let routeResult = attachKnowledgeBudgetToRouteResult(baseRouteResult, baseBudget);
  let contextBudget = baseBudget;
  const routeWarnings = input.knowledgeManifest ? [] : ["knowledge_manifest_missing:using_minimum_default_fallback"];

  if (!hasNonEmptyKnowledgeTrace({
    injectedKnowledgePacks: routeResult.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: routeResult.injectedKnowledgeSnippetIds,
    injectedKnowledgeSnippets: contextBudget.injectedSnippets,
  })) {
    const fallbackRoute = buildFallbackKnowledgeRouteResult({
      taskId: `task_${input.packetId}`,
      userIntent,
      taskPurpose,
      providerSlot,
      contextLevel,
      availablePacks,
      reason: routeResult.warnings.includes("no_knowledge_pack_matched") ? "no_route_match" : "empty_context_budget",
      createdAt: input.runtimeState.generatedAt,
    });
    const fallbackBudget = buildKnowledgeContextBudget({
      routeResult: fallbackRoute,
      availablePacks,
      maxInjectionTokens,
    });
    routeResult = attachKnowledgeBudgetToRouteResult(fallbackRoute, fallbackBudget);
    contextBudget = fallbackBudget;
    routeWarnings.push(...baseRouteResult.warnings, ...baseBudget.warnings, "knowledge_route_used_minimum_default_fallback");
  }

  routeWarnings.push(...knowledgeTraceWarnings(routeResult, contextBudget));

  return {
    routeResult,
    contextBudget,
    routeWarnings: unique(routeWarnings),
    manifestHash: knowledgeManifestHashFor(input),
  };
}

function makeTaskEnvelope(input: {
  packetId: string;
  kind: TaskPacketKind;
  shot: ShotRecord;
  hardFields: TaskPacketHardFields;
  sourceFactTrace: string[];
  runtimeState: ProjectRuntimeState;
  selectedAssetId?: string;
  keyframePair?: KeyframePairDerivation;
  missing: string[];
  providerRegistry?: ProviderRegistry;
  providerPolicy?: ProviderPolicy;
  knowledgeManifest?: KnowledgePackManifest;
}): TaskEnvelope {
  const providerSelection = selectCapabilityForRequirement(input.hardFields.providerRequirements, registryFor(input), policyFor(input));
  const expectedOutputs = input.hardFields.expectedOutputs;
  const taskId = `task_${input.packetId}`;
  const knowledge = resolveKnowledgeInjection({
    packetId: input.packetId,
    kind: input.kind,
    shot: input.shot,
    hardFields: input.hardFields,
    runtimeState: input.runtimeState,
    knowledgeManifest: input.knowledgeManifest,
  });
  const knowledgeTracePresent = hasNonEmptyKnowledgeTrace({
    injectedKnowledgePacks: knowledge.contextBudget.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: knowledge.contextBudget.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
    injectedKnowledgeSnippets: knowledge.contextBudget.injectedSnippets,
  });
  const blockingReasons = unique([
    ...input.missing,
    ...providerSelection.blockers,
    knowledgeTracePresent ? "" : "knowledge_trace_blocker:empty_injection_trace",
  ]);
  const envelope: TaskEnvelope & {
    sourceFactTrace: string[];
    resultSchema: "subagent_result_v1";
    allowedReadScope: string[];
    forbiddenActions: string[];
  } = {
    schemaVersion: envelopeSchemaVersion,
    id: taskId,
    purpose: taskPurposeFor(input.kind),
    providerSlot: input.hardFields.providerRequirements.slot,
    providerId: providerSelection.providerId,
    executionState: providerSelection.executionState,
    requiredMode: input.hardFields.providerRequirements.requiredMode,
    providerRequirements: input.hardFields.providerRequirements,
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
      status: blockingReasons.length ? "blocked" : "pass",
      blockers: preflightBlockers(blockingReasons),
      warnings: [],
      checkedAt: input.runtimeState.generatedAt,
    },
    keyframePairDerivation: input.kind === "video_execution" || input.kind === "pair_qa" ? input.keyframePair : undefined,
    knowledgeRouteResultId: knowledge.routeResult.routeId,
    contextBudgetId: knowledge.contextBudget.budgetId,
    injectedKnowledgePacks: knowledge.contextBudget.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: knowledge.contextBudget.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
    injectedKnowledgeSnippets: knowledge.contextBudget.injectedSnippets,
    knowledgeInputHash: knowledge.routeResult.inputHash,
    knowledgeManifestHash: knowledge.manifestHash,
    routeWarnings: knowledge.routeWarnings,
    sourceFactTrace: input.sourceFactTrace,
    resultSchema: input.hardFields.outputSchema,
    allowedReadScope: input.hardFields.allowedReadScope,
    forbiddenActions: input.hardFields.forbiddenActions,
    outputPath: expectedOutputs[0],
    blockingReasons,
  };
  const policyBinding = buildPolicyBinding(envelope);

  return {
    ...envelope,
    policyBinding,
    nonOverridableGateHashes: buildNonOverridableGateHashes({ ...envelope, policyBinding }),
    inputHash: buildInputHash({ ...envelope, policyBinding }),
  };
}

function makeSubagentEnvelope(input: {
  packetId: string;
  kind: TaskPacketKind;
  shot: ShotRecord;
  hardFields: TaskPacketHardFields;
  sourceFactTrace: string[];
  injectedKnowledgeTrace: TaskPacketKnowledgeTrace;
  taskEnvelope: TaskEnvelope;
  runtimeState: ProjectRuntimeState;
  providerRegistry?: ProviderRegistry;
  providerPolicy?: ProviderPolicy;
}): SubagentTaskEnvelope {
  const providerSelection = selectCapabilityForRequirement(input.hardFields.providerRequirements, registryFor(input), policyFor(input));
  const envelope: SubagentTaskEnvelope & {
    sourceFactTrace: string[];
    injectedKnowledgeTrace: TaskPacketKnowledgeTrace;
    resultSchema: "subagent_result_v1";
    forbiddenActions: string[];
  } = {
    schemaVersion: envelopeSchemaVersion,
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
      `mode=${input.taskEnvelope.requiredMode}`,
      `capability=${providerSelection.capabilityId || "unresolved"}`,
      `providerSelection=${providerSelection.selectionSource}`,
      `providerExecutionState=${input.taskEnvelope.executionState}`,
      `requiredInputs=${input.hardFields.providerRequirements.inputKinds.join(",")}`,
      `requiredOutput=${input.hardFields.providerRequirements.outputKind}`,
      `expectedOutputs=${input.taskEnvelope.expectedOutputs.join(",")}`,
      ...input.hardFields.contextCapsule.map((item) => `context:${item}`),
      "noFreeTextTask=true",
      "noFreeTextWorker=true",
      "providerSubmissionForbidden=true",
      "liveSubmitAllowed=false",
    ]),
    taskEnvelope: input.taskEnvelope,
    knowledgeRouteResultId: input.taskEnvelope.knowledgeRouteResultId,
    contextBudgetId: input.taskEnvelope.contextBudgetId,
    injectedKnowledgePacks: input.taskEnvelope.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: input.taskEnvelope.injectedKnowledgeSnippetIds,
    injectedKnowledgeSnippets: input.taskEnvelope.injectedKnowledgeSnippets,
    knowledgeInputHash: input.taskEnvelope.knowledgeInputHash,
    knowledgeManifestHash: input.taskEnvelope.knowledgeManifestHash,
    routeWarnings: input.taskEnvelope.routeWarnings,
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories:
      input.kind === "video_execution"
        ? ["storyflow", "camera", "provider", "qa"]
        : input.kind === "audio"
          ? ["storyflow", "audio", "qa"]
          : input.kind === "scene_qa"
            ? ["storyflow", "composition", "camera", "qa"]
            : ["storyflow", "style", "qa"],
    qaPackBindings: Object.fromEntries(
      input.taskEnvelope.injectedKnowledgePacks
        .filter((pack) => pack.consumer === "qa_gate")
        .map((pack) => [pack.packId, { version: pack.version, hash: pack.hash }]),
    ),
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
    sourceFactTrace: input.sourceFactTrace,
    injectedKnowledgeTrace: input.injectedKnowledgeTrace,
    resultSchema: input.hardFields.outputSchema,
    forbiddenActions: input.hardFields.forbiddenActions,
  };
  return {
    ...envelope,
    policyBinding: input.taskEnvelope.policyBinding ?? buildPolicyBinding(input.taskEnvelope),
    nonOverridableGateHashes: input.taskEnvelope.nonOverridableGateHashes ?? buildNonOverridableGateHashes(input.taskEnvelope),
    inputHash: buildSubagentInputHash({
      ...envelope,
      policyBinding: input.taskEnvelope.policyBinding ?? buildPolicyBinding(input.taskEnvelope),
    }),
  };
}

function knowledgeTraceFor(envelope: SubagentTaskEnvelope | undefined): TaskPacketKnowledgeTrace {
  const taskEnvelope = envelope?.taskEnvelope;
  const packIds = unique(taskEnvelope?.injectedKnowledgePacks.map((pack) => pack.packId) || []);
  const snippetIds = unique(taskEnvelope?.injectedKnowledgeSnippetIds || []);
  const snippetCount = taskEnvelope?.injectedKnowledgeSnippets.length || 0;
  const qaPackBindingIds = unique(Object.keys(envelope?.qaPackBindings || {}));
  const status =
    taskEnvelope &&
    hasNonEmptyKnowledgeTrace({
      injectedKnowledgePacks: taskEnvelope.injectedKnowledgePacks,
      injectedKnowledgeSnippetIds: taskEnvelope.injectedKnowledgeSnippetIds,
      injectedKnowledgeSnippets: taskEnvelope.injectedKnowledgeSnippets,
    })
      ? "present"
      : "missing";

  return {
    status,
    knowledgeRouteResultId: taskEnvelope?.knowledgeRouteResultId,
    contextBudgetId: taskEnvelope?.contextBudgetId,
    knowledgeInputHash: taskEnvelope?.knowledgeInputHash,
    knowledgeManifestHash: taskEnvelope?.knowledgeManifestHash,
    packIds,
    snippetIds,
    snippetCount,
    qaPackBindingIds,
    warnings: envelope?.routeWarnings || [],
  };
}

function missingKnowledgeTrace(): TaskPacketKnowledgeTrace {
  return {
    status: "missing",
    packIds: [],
    snippetIds: [],
    snippetCount: 0,
    qaPackBindingIds: [],
    warnings: ["validated_envelope_missing"],
  };
}

function validationReceiptFor(input: {
  packetId: string;
  checkedAt: string;
  envelope?: SubagentTaskEnvelope;
  hardFields?: TaskPacketHardFields;
  sourceFactTrace: string[];
  injectedKnowledgeTrace: TaskPacketKnowledgeTrace;
  missingContext: string[];
}): TaskPacketValidationReceipt {
  const envelope = input.envelope;
  const taskEnvelope = envelope?.taskEnvelope;
  const requiredFields: TaskPacketValidationReceipt["requiredFields"] = {
    validatedEnvelope: Boolean(envelope && taskEnvelope && taskEnvelope.preflight.status === "pass" && taskEnvelope.blockingReasons.length === 0),
    expectedOutputs: Boolean(input.hardFields?.expectedOutputs.length && taskEnvelope?.expectedOutputs.length),
    sourceFactTrace: input.sourceFactTrace.length > 0,
    injectedKnowledgeTrace: input.injectedKnowledgeTrace.status === "present",
    qaChecklist: Boolean(input.hardFields?.qaChecklist.length && envelope?.qaChecklist.length && taskEnvelope?.qaChecklist.length),
    resultSchema: input.hardFields?.outputSchema === "subagent_result_v1" && input.hardFields.expectedOutputContract.format === "subagent_result_v1",
    allowedReadScope: Boolean(input.hardFields?.allowedReadScope.length && envelope?.allowedReadScopes.length),
    forbiddenActions: Boolean(input.hardFields?.forbiddenActions.length && envelope?.disallowedReadScopes.includes("provider_credentials")),
    noFreeTextWorker: Boolean(
      input.hardFields?.forbiddenActions.includes("no_free_text_worker") &&
        envelope?.providerPolicySummary.includes("noFreeTextWorker=true"),
    ),
    phase37VisualConsistencyTrace: hasPhase37VisualConsistencyTrace(input.sourceFactTrace),
  };
  const blockers = unique([
    ...input.missingContext.map((field) => `blocked_missing_context:${field}`),
    requiredFields.validatedEnvelope ? "" : "validated_envelope_missing_or_blocked",
    requiredFields.expectedOutputs ? "" : "expected_outputs_missing",
    requiredFields.sourceFactTrace ? "" : "source_fact_trace_missing",
    requiredFields.injectedKnowledgeTrace ? "" : "injected_knowledge_trace_missing",
    requiredFields.qaChecklist ? "" : "qa_checklist_missing",
    requiredFields.resultSchema ? "" : "result_schema_missing",
    requiredFields.allowedReadScope ? "" : "allowed_read_scope_missing",
    requiredFields.forbiddenActions ? "" : "forbidden_actions_missing",
    requiredFields.noFreeTextWorker ? "" : "free_text_worker_not_blocked",
    requiredFields.phase37VisualConsistencyTrace ? "" : "phase37_visual_consistency_trace_missing",
    ...(taskEnvelope?.blockingReasons.map((reason) => `task_envelope_blocking_reason:${reason}`) || []),
  ]);

  return {
    receiptKind: "phase38_task_packet_validation",
    status: blockers.length ? "blocked" : "pass",
    envelopeId: envelope?.id,
    taskEnvelopeId: taskEnvelope?.id,
    checkedAt: input.checkedAt,
    requiredFields,
    blockers,
  };
}

const requiredReadyPacketFields: Array<keyof TaskPacketValidationReceipt["requiredFields"]> = [
  "validatedEnvelope",
  "expectedOutputs",
  "sourceFactTrace",
  "injectedKnowledgeTrace",
  "qaChecklist",
  "resultSchema",
  "allowedReadScope",
  "forbiddenActions",
  "noFreeTextWorker",
  "phase37VisualConsistencyTrace",
];

function coverageItemFor(kind: TaskPacketKind, packet: BuiltTaskPacket | undefined): TaskPacketCoverageItem {
  if (!packet) {
    return {
      taskKind: kind,
      status: "missing",
      validatedEnvelope: false,
      expectedOutputs: false,
      sourceFactTrace: false,
      injectedKnowledgeTrace: false,
      qaChecklist: false,
      resultSchema: false,
      allowedReadScope: false,
      forbiddenActions: false,
      phase37VisualConsistencyTrace: false,
      noFreeTextTask: false,
      blockedReasons: ["formal_task_packet_missing"],
    };
  }
  return {
    taskKind: kind,
    status: packet.status === "ready" ? "covered_ready" : "covered_blocked",
    packetId: packet.packetId,
    envelopeId: packet.envelopeId,
    validatedEnvelope: packet.validationReceipt.requiredFields.validatedEnvelope,
    expectedOutputs: packet.validationReceipt.requiredFields.expectedOutputs,
    sourceFactTrace: packet.validationReceipt.requiredFields.sourceFactTrace,
    injectedKnowledgeTrace: packet.validationReceipt.requiredFields.injectedKnowledgeTrace,
    qaChecklist: packet.validationReceipt.requiredFields.qaChecklist,
    resultSchema: packet.validationReceipt.requiredFields.resultSchema,
    allowedReadScope: packet.validationReceipt.requiredFields.allowedReadScope,
    forbiddenActions: packet.validationReceipt.requiredFields.forbiddenActions,
    phase37VisualConsistencyTrace: packet.validationReceipt.requiredFields.phase37VisualConsistencyTrace,
    noFreeTextTask: packet.noFreeTextTask,
    blockedReasons: packet.blockedReasons,
  };
}

function buildPlannerReceipt(input: {
  generatedAt: string;
  packets: BuiltTaskPacket[];
  requestedTaskKinds: TaskPacketKind[];
}): TaskPacketPlannerReceipt {
  const coverage = taskPacketKinds.map((kind) => coverageItemFor(kind, input.packets.find((packet) => packet.taskKind === kind)));
  const requestedCoverage = coverage.filter((item) => input.requestedTaskKinds.includes(item.taskKind));
  const allProductionTaskKindsCovered = taskPacketKinds.every((kind) => coverage.some((item) => item.taskKind === kind && item.status !== "missing"));
  const expectedOutputsIncluded = requestedCoverage.every((item) => item.expectedOutputs);
  const sourceFactTraceRecorded = requestedCoverage.every((item) => item.sourceFactTrace);
  const knowledgePacksRecorded = requestedCoverage.every((item) => item.injectedKnowledgeTrace);
  const blockedReasons = unique([
    allProductionTaskKindsCovered ? "" : "formal_task_kind_coverage_missing",
    expectedOutputsIncluded ? "" : "expected_outputs_missing",
    sourceFactTraceRecorded ? "" : "source_fact_trace_missing",
    knowledgePacksRecorded ? "" : "injected_knowledge_trace_missing",
    ...requestedCoverage.flatMap((item) => item.blockedReasons),
  ]);

  return {
    receiptKind: "phase38_full_task_subagent_packet_planner",
    phase: "phase_38_full_task_subagent_packet_planner",
    receiptId: `phase38_packet_planner_${safeId(input.generatedAt)}`,
    generatedAt: input.generatedAt,
    status: blockedReasons.length ? "blocked" : "pass",
    allProductionTaskKindsCovered,
    productionTaskKinds: taskPacketKinds,
    readyKinds: input.packets.filter((packet) => packet.status === "ready").map((packet) => packet.taskKind),
    blockedKinds: input.packets.filter((packet) => packet.status !== "ready").map((packet) => packet.taskKind),
    coverage,
    requiredReadyPacketFields,
    validatedEnvelopeRequired: true,
    formalTaskRejectsMissingPacket: true,
    expectedOutputsIncluded,
    sourceFactTraceRecorded,
    knowledgePacksRecorded,
    phase37VisualConsistencyTraceRequired: true,
    noFreeTextWorker: true,
    naturalLanguageMustEnterTransactionOrPacketBuilder: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    blockedReasons,
  };
}

function buildPacket(input: BuildTaskPacketsInput, kind: TaskPacketKind): BuiltTaskPacket {
  const checkedAt = input.generatedAt || input.runtimeState.generatedAt;
  const shot = selectedShot(input.runtimeState, input.selectedShotId);
  const previous = neighborShot(shot, "previous", input.runtimeState);
  const next = neighborShot(shot, "next", input.runtimeState);
  const boundAssets = boundAssetsFor(input, kind, shot);
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
    const validationReceipt = validationReceiptFor({
      packetId,
      checkedAt,
      sourceFactTrace: [],
      injectedKnowledgeTrace: missingKnowledgeTrace(),
      missingContext: missing,
    });
    return {
      packetId,
      taskKind: kind,
      status: "blocked_missing_context",
      sourceFactTrace: [],
      injectedKnowledgeTrace: missingKnowledgeTrace(),
      validationReceipt,
      missingContext: missing,
      blockedReasons: missing.map((field) => `blocked_missing_context:${field}`),
      noFreeTextTask: true,
      canSubmitProvider: false,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    };
  }

  const expectedOutputs = expectedOutputsFor(kind, shot, input.selectedAssetId, input.runtimeState);
  const sourceFactTrace = sourceFactTraceFor({
    kind,
    runtimeState: input.runtimeState,
    shot,
    previous,
    next,
    boundAssets,
    forbidden,
    expectedOutputs,
    keyframePair,
  });
  const hardFields: TaskPacketHardFields = {
    purpose: purposeFor(kind),
    providerRequirements: providerRequirementFor(kind),
    contextCapsule: contextCapsuleFor(input, kind, shot, expectedOutputs),
    storyFunction: shot.storyFunction,
    previousShot: previous,
    nextShot: next,
    beforeAfterShots: beforeAfterShotsFor(previous, next),
    boundAssets,
    referenceAuthority: referenceAuthorityFor(boundAssets, forbidden),
    expectedOutputs,
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
    sourceFactTrace,
    runtimeState: input.runtimeState,
    selectedAssetId: input.selectedAssetId,
    keyframePair,
    missing,
    providerRegistry: input.providerRegistry,
    providerPolicy: input.providerPolicy,
    knowledgeManifest: input.knowledgeManifest,
  });
  const envelope = makeSubagentEnvelope({
    packetId,
    kind,
    shot,
    hardFields,
    sourceFactTrace,
    injectedKnowledgeTrace: missingKnowledgeTrace(),
    taskEnvelope,
    runtimeState: input.runtimeState,
    providerRegistry: input.providerRegistry,
    providerPolicy: input.providerPolicy,
  });
  const injectedKnowledgeTrace = knowledgeTraceFor(envelope);
  const envelopeWithTrace = {
    ...envelope,
    injectedKnowledgeTrace,
  } as SubagentTaskEnvelope;
  const validationReceipt = validationReceiptFor({
    packetId,
    checkedAt,
    envelope: envelopeWithTrace,
    hardFields,
    sourceFactTrace,
    injectedKnowledgeTrace,
    missingContext: [],
  });
  const ready = validationReceipt.status === "pass";

  return {
    packetId,
    taskKind: kind,
    status: ready ? "ready" : "blocked_packet_validation",
    envelopeId: envelopeWithTrace.id,
    envelope: envelopeWithTrace,
    hardFields,
    sourceFactTrace,
    injectedKnowledgeTrace,
    validationReceipt,
    missingContext: [],
    blockedReasons: validationReceipt.blockers,
    noFreeTextTask: true,
    canSubmitProvider: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

export function buildTaskPackets(input: BuildTaskPacketsInput): TaskPacketBuilderState {
  const requestedTaskKinds = input.requestedTaskKinds || taskPacketKinds;
  const packets = requestedTaskKinds.map((kind) => buildPacket(input, kind));
  const generatedAt = input.generatedAt || new Date().toISOString();
  const plannerReceipt = buildPlannerReceipt({ generatedAt, packets, requestedTaskKinds });

  return {
    schemaVersion: taskPacketBuilderSchemaVersion,
    generatedAt,
    selectedShotId: input.selectedShotId,
    selectedAssetId: input.selectedAssetId,
    packets,
    summary: {
      total: packets.length,
      ready: packets.filter((packet) => packet.status === "ready").length,
      blockedMissingContext: packets.filter((packet) => packet.status === "blocked_missing_context").length,
      envelopeReady: packets.filter((packet) => packet.envelope && packet.validationReceipt.requiredFields.validatedEnvelope).length,
      validatedEnvelopeReady: packets.filter((packet) => packet.status === "ready" && packet.validationReceipt.requiredFields.validatedEnvelope).length,
      noFreeTextTask: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    plannerReceipt,
    noFreeTextTask: true,
    validatedEnvelopeRequired: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase38 builds dry-run SubagentTaskEnvelope packets for every production task kind.",
      "Every ready packet carries context capsule, reference authority, before/after shots, expected outputs, hard negatives, QA checklist, and subagent_result_v1 contract.",
      "Phase38 planner receipt records coverage for image, asset, start/end frame, image edit, identity/scene/pair QA, story audit, video execution, audio, and export.",
      "No packet submits a provider, starts a worker, reads credentials, writes prompt files, or accepts free-text task bypass.",
    ],
  };
}
