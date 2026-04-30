import {
  buildReflowImpactReport,
  buildStoryChangeTransaction,
  storyChangeSchemaVersion,
  type DirectorIntentContext,
  type ReflowImpactContext,
} from "./storyChange";
import type { ProjectRuntimeState } from "./projectState";
import type {
  ArtifactInvalidation,
  AssetRecord,
  DirectorIntentResult,
  ReflowImpactReport,
  ShotRecord,
  StoryChangeImpactScope,
  StoryChangeTransaction,
} from "./types";

export type DirectorEditScopeKind = "project" | "section" | "shot" | "multi-shot" | "asset" | "voice" | "export";

export type DirectorEditStatus = "ready_for_structured_review" | "pending_confirmation" | "blocked_prompt_bypass";

export type DirectorEditAffectedArtifactType =
  | "productionBible"
  | "storyFlow"
  | "shotSpec"
  | "shotLayout"
  | "shotPromptPlan"
  | "startFrame"
  | "endFrame"
  | "video"
  | "audio"
  | "preview"
  | "visualMemory"
  | "spatialMemory"
  | "voiceMemory"
  | "asset"
  | "qaReport"
  | "exportPackage";

export interface DirectorEditSelection {
  scopeKind: DirectorEditScopeKind;
  targetIds?: string[];
  sectionId?: string;
  shotId?: string;
  shotIds?: string[];
  assetId?: string;
  voiceId?: string;
  exportId?: string;
}

export interface DirectorEditAffectedArtifact {
  artifactId: string;
  artifactType: DirectorEditAffectedArtifactType;
  targetId?: string;
  staleReason: string;
  requiresRegeneration: boolean;
  source: "reflow";
}

export interface DirectorEditPlan {
  schemaVersion: string;
  id: string;
  userIntent: string;
  normalizedIntent: string;
  selection: DirectorEditSelection;
  intentResult: DirectorIntentResult;
  transaction: StoryChangeTransaction;
  reflowImpactReport: ReflowImpactReport;
  affectedArtifacts: DirectorEditAffectedArtifact[];
  confirmationRequired: boolean;
  confirmationReasons: string[];
  status: DirectorEditStatus;
  blockedReasons: string[];
  mustPreserve: string[];
  mustAvoid: string[];
  forbiddenActions: string[];
  noFreeTextTask: true;
  providerPromptPatchForbidden: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  createdAt: string;
}

export interface BuildDirectorEditPlanInput {
  userIntent: string;
  selection?: Partial<DirectorEditSelection>;
  runtimeState?: ProjectRuntimeState;
  context?: DirectorIntentContext;
  targetIds?: string[];
  mustPreserve?: string[];
  mustAvoid?: string[];
  id?: string;
  createdAt?: string;
}

const promptBypassPattern =
  /(直接|临时|马上|手动|绕过|跳过|bypass|patch|rewrite|edit)[^，。；;,.]*(provider\s*)?prompt|prompt[^，。；;,.]*(bypass|patch|rewrite|directly|直接|绕过|跳过)|不要\s*(transaction|envelope|结构化)|without\s+(transaction|envelope)/i;

function stableId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort();
}

function shotsFromRuntime(runtimeState?: ProjectRuntimeState): ShotRecord[] {
  return runtimeState?.storyFlow?.shots || [];
}

function assetsFromRuntime(runtimeState?: ProjectRuntimeState): AssetRecord[] {
  return runtimeState?.visualMemory?.assets || [];
}

function canonicalShotId(value: string): string {
  return value
    .toLowerCase()
    .replace(/^shot[_-]?/, "")
    .replace(/_/g, "-")
    .replace(/(^|-)0+(\d+)/g, "$1$2");
}

function resolveShotId(candidate: string, shots: ShotRecord[]): string {
  const canonical = canonicalShotId(candidate);
  return shots.find((shot) => canonicalShotId(shot.id) === canonical)?.id || candidate;
}

function expandShotRange(userIntent: string, shots: ShotRecord[]): string[] {
  const match = userIntent.match(
    /(?:镜头|分镜|shot)?\s*([a-zA-Z]*)(\d+)[-_](\d+)\s*(?:到|至|through|to|[-~–—])\s*(?:镜头|分镜|shot)?\s*([a-zA-Z]*)(\d+)[-_](\d+)/i,
  );
  if (!match) return [];

  const [, leftPrefix, leftSection, leftIndex, rightPrefix, rightSection, rightIndex] = match;
  if (leftPrefix !== rightPrefix || leftSection !== rightSection) return [];

  const start = Number(leftIndex);
  const end = Number(rightIndex);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const width = Math.max(leftIndex.length, rightIndex.length);
  const ids: string[] = [];
  for (let index = min; index <= max; index += 1) {
    ids.push(resolveShotId(`${leftPrefix}${leftSection}-${String(index).padStart(width, "0")}`, shots));
  }
  return ids;
}

function inferScopeKind(userIntent: string, targetIds: string[], selection?: Partial<DirectorEditSelection>): DirectorEditScopeKind {
  if (selection?.scopeKind) return selection.scopeKind;
  if (targetIds.length > 1) return "multi-shot";
  if (/全片|整个项目|project|whole film|global/i.test(userIntent)) return "project";
  if (/段落|章节|section|act/i.test(userIntent)) return "section";
  if (/音色|音源|配音|声音|voice|tts|narrator|speaker|timbre/i.test(userIntent)) return "voice";
  if (/导出|格式|分辨率|码率|export|render/i.test(userIntent)) return "export";
  if (/资产|角色|人物|场景|地点|空间|locked asset|asset|character|scene|location/i.test(userIntent)) return "asset";
  return "shot";
}

function targetIdsForSelection(userIntent: string, selection: Partial<DirectorEditSelection> | undefined, shots: ShotRecord[]): string[] {
  const rangeShotIds = expandShotRange(userIntent, shots);
  return unique([
    ...(selection?.targetIds || []),
    ...(selection?.shotIds || []),
    ...(rangeShotIds || []),
    selection?.shotId || "",
    selection?.sectionId || "",
    selection?.assetId || "",
    selection?.voiceId || "",
    selection?.exportId || "",
  ]);
}

function normalizeSelection(input: BuildDirectorEditPlanInput, shots: ShotRecord[]): DirectorEditSelection {
  const targetIds = unique([...(input.targetIds || []), ...targetIdsForSelection(input.userIntent, input.selection, shots)]);
  const scopeKind = inferScopeKind(input.userIntent, targetIds, input.selection);
  return {
    scopeKind,
    targetIds,
    sectionId: input.selection?.sectionId,
    shotId: input.selection?.shotId || (scopeKind === "shot" ? targetIds[0] : undefined),
    shotIds: scopeKind === "multi-shot" ? targetIds : input.selection?.shotIds,
    assetId: input.selection?.assetId || (scopeKind === "asset" ? targetIds[0] : undefined),
    voiceId: input.selection?.voiceId || (scopeKind === "voice" ? targetIds[0] : undefined),
    exportId: input.selection?.exportId || (scopeKind === "export" ? targetIds[0] : undefined),
  };
}

function scopeHintForSelection(selection: DirectorEditSelection): StoryChangeImpactScope {
  if (selection.scopeKind === "multi-shot") return "shot";
  if (selection.scopeKind === "project") return "project";
  if (selection.scopeKind === "section") return "section";
  if (selection.scopeKind === "asset") return "asset";
  if (selection.scopeKind === "voice") return "voice";
  if (selection.scopeKind === "export") return "export";
  return "shot";
}

function lockedAssetIds(assets: AssetRecord[]): string[] {
  return unique(
    assets.flatMap((asset) =>
      asset.lockedStatus === "locked" ? [asset.id, asset.path, asset.name] : [],
    ),
  );
}

function contextForPlan(input: BuildDirectorEditPlanInput, selection: DirectorEditSelection, assets: AssetRecord[]): DirectorIntentContext {
  return {
    ...input.context,
    targetIds: unique([...(input.context?.targetIds || []), ...(selection.targetIds || [])]),
    selectedShotId: selection.shotId || input.context?.selectedShotId,
    selectedShotIds: selection.scopeKind === "multi-shot" ? selection.shotIds : input.context?.selectedShotIds,
    selectedSectionId: selection.sectionId || input.context?.selectedSectionId,
    selectedAssetId: selection.assetId || input.context?.selectedAssetId,
    selectedVoiceId: selection.voiceId || input.context?.selectedVoiceId,
    selectedExportId: selection.exportId || input.context?.selectedExportId,
    scopeHint: scopeHintForSelection(selection),
    knownCharacterIds: unique([...(input.context?.knownCharacterIds || []), ...assets.filter((asset) => asset.type === "character").map((asset) => asset.id)]),
    knownSceneIds: unique([...(input.context?.knownSceneIds || []), ...assets.filter((asset) => asset.type === "scene").map((asset) => asset.id)]),
    knownAssetIds: unique([...(input.context?.knownAssetIds || []), ...assets.flatMap((asset) => [asset.id, asset.path])]),
    lockedAssetIds: unique([...(input.context?.lockedAssetIds || []), ...lockedAssetIds(assets)]),
  };
}

function affectedTypeFromInvalidation(item: ArtifactInvalidation): DirectorEditAffectedArtifactType {
  if (item.artifactId.startsWith("shotPromptPlan_") || item.artifactType === "promptPlan") return "shotPromptPlan";
  if (item.artifactId.startsWith("startFrame_")) return "startFrame";
  if (item.artifactId.startsWith("endFrame_")) return "endFrame";
  if (item.artifactType === "keyframe") return "startFrame";
  if (item.artifactType === "taskRun") return "qaReport";
  return item.artifactType as DirectorEditAffectedArtifactType;
}

function affectedArtifactsFromReflow(report: ReflowImpactReport): DirectorEditAffectedArtifact[] {
  const seen = new Set<string>();
  return report.invalidations
    .map((item) => ({
      artifactId: item.artifactId,
      artifactType: affectedTypeFromInvalidation(item),
      targetId: item.targetId,
      staleReason: item.staleReason,
      requiresRegeneration: item.requiresRegeneration,
      source: "reflow" as const,
    }))
    .filter((item) => {
      const key = `${item.artifactType}:${item.artifactId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function isPromptBypassIntent(userIntent: string): boolean {
  return promptBypassPattern.test(userIntent);
}

export function buildDirectorEditPlan(input: BuildDirectorEditPlanInput): DirectorEditPlan {
  const createdAt = input.createdAt || new Date().toISOString();
  const shots = shotsFromRuntime(input.runtimeState);
  const assets = assetsFromRuntime(input.runtimeState);
  const selection = normalizeSelection(input, shots);
  const context = contextForPlan(input, selection, assets);
  const transaction = buildStoryChangeTransaction({
    userIntent: input.userIntent,
    context,
    targetIds: selection.targetIds,
    mustPreserve: input.mustPreserve,
    mustNotAdd: input.mustAvoid,
    id: input.id ? `${input.id}_transaction` : undefined,
    createdAt,
  });
  const reflowContext: ReflowImpactContext | ProjectRuntimeState | undefined = input.runtimeState || { shots, generatedAt: createdAt };
  const reflowImpactReport = buildReflowImpactReport(transaction, reflowContext);
  const promptBypassForbidden = isPromptBypassIntent(input.userIntent);
  const confirmationReasons = unique(transaction.confirmationReasons);
  const status: DirectorEditStatus = promptBypassForbidden
    ? "blocked_prompt_bypass"
    : transaction.requiresUserConfirmation
      ? "pending_confirmation"
      : "ready_for_structured_review";

  return {
    schemaVersion: storyChangeSchemaVersion,
    id: input.id || stableId("director_edit", `${input.userIntent}:${selection.scopeKind}:${selection.targetIds?.join(",")}:${createdAt.slice(0, 10)}`),
    userIntent: input.userIntent,
    normalizedIntent: transaction.intentResult?.normalizedIntent || input.userIntent.trim().replace(/\s+/g, " "),
    selection,
    intentResult: transaction.intentResult as DirectorIntentResult,
    transaction,
    reflowImpactReport,
    affectedArtifacts: affectedArtifactsFromReflow(reflowImpactReport),
    confirmationRequired: transaction.requiresUserConfirmation,
    confirmationReasons,
    status,
    blockedReasons: unique([
      ...(promptBypassForbidden ? ["prompt_bypass_forbidden", "selected_edit_must_emit_transaction_before_any_prompt_change"] : []),
    ]),
    mustPreserve: transaction.mustPreserve,
    mustAvoid: transaction.mustNotAdd,
    forbiddenActions: unique([
      ...reflowImpactReport.forbiddenActions,
      "provider_prompt_patch",
      "free_text_task",
      "envelope_bypass",
      "live_submit",
    ]),
    noFreeTextTask: true,
    providerPromptPatchForbidden: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    createdAt,
  };
}
