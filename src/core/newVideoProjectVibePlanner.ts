import { buildScriptPlannerState, type ScriptPlannerResult } from "./scriptPlanner";
import { stableKnowledgeHash } from "./knowledgeManifest";
import type { DirectorSessionState } from "./directorSession";
import type { StoryDiscussionDelta } from "./storyDiscussionWorkspace";
import type { MusicRhythmAnalysis } from "./musicRhythmAnalysis";
import {
  applyProjectVibeTransaction,
  hashProjectVibeFacts,
  refreshProjectVibeSourceIndex,
  type ProjectVibePatchResult,
} from "../project/projectVibe";
import type {
  ProjectVibeDocument,
  ProjectVibeAssetKind,
  ProjectVibePatchOperation,
  ProjectVibeScriptPlanningReceipt,
  ProjectVibeShot,
  ProjectVibeStoryFlow,
  ProjectVibeStorySection,
  ProjectVibeTransaction,
  ProjectVibeTransactionReceipt,
} from "../project/types";

export type NewVideoReferenceBindingKind = "character" | "scene" | "prop" | "style" | "reference";

export interface NewVideoReferenceBindingLike {
  kind?: NewVideoReferenceBindingKind | string;
  role?: string;
  character?: string;
  scene?: string;
  prop?: string;
  style?: string;
  shotIds?: string[];
  scope?: string;
}

export interface NewVideoProjectVibeReferenceLike {
  type?: string;
  file?: { name?: string };
  label?: string;
  binding?: NewVideoReferenceBindingLike;
  role?: string;
  character?: string;
  scene?: string;
  prop?: string;
  style?: string;
  shotIds?: string[];
  scope?: string;
}

export interface NewVideoProjectVibeDraftLike {
  script?: string;
  style?: string;
  references?: NewVideoProjectVibeReferenceLike[];
  audio?: { name?: string; type?: string; size?: number };
  audioRole?: "voice_reference" | "music_reference";
  musicAnalysis?: MusicRhythmAnalysis;
}

export interface NewVideoProjectVibeStoryboardDraftShotLike {
  id?: string;
  shotNo?: string;
  duration?: string | number;
  shotSize?: string;
  camera?: string;
  visualDescription?: string;
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  actionReactionQa?: string;
  executionMode?: string;
  referenceStrategy?: string;
  visibleCutBudget?: string;
  visibleClips?: string | number;
  storyboardPanels?: string | number;
  actionBeats?: string[];
  subtitle?: string;
  sound?: string;
  title?: string;
  characters?: string;
  scene?: string;
  props?: string;
  audioUsage?: string;
  rhythmProfile?: string;
  rhythmReason?: string;
  sourceFactId?: string;
}

export interface NewVideoProjectVibePlanResult {
  project: ProjectVibeDocument;
  planner: ScriptPlannerResult;
  patch: ProjectVibePatchResult;
  selectedShotId?: string;
}

export interface NewVideoProjectVibeSourceTurnRef {
  id: string;
  role: string;
  scope: string;
  createdAt: string;
  sourceRefs: string[];
}

export interface NewVideoProjectVibeStagedTransactionSource {
  projectId: string;
  beforeFactHash: string;
  draftHash: string;
  plannerInputHash: string;
  patchOperationHash: string;
  directorSessionId?: string;
  sourceTurnId?: string;
  discussionDeltaIds: string[];
  sourceRefs: string[];
}

export interface NewVideoProjectVibeStagedTransactionSummary {
  title: string;
  sectionCount: number;
  shotCount: number;
  referenceAssetCount: number;
  audioReferenceCount: number;
  musicReferenceCount: number;
  patchOperationCount: number;
  selectedShotId?: string;
  stagedFactCount: number;
  discussionDeltaCount: number;
  blockerCount: number;
}

export interface NewVideoProjectVibeStagedTransactionPreview {
  kind: "new_video_project_vibe_staged_transaction_preview";
  schemaVersion: "0.1.0";
  transactionId: string;
  generatedAt: string;
  projectVibeWriteAllowed: false;
  projectFactsMutated: false;
  transaction: ProjectVibeTransaction;
  patchOperations: ProjectVibePatchOperation[];
  planner: ScriptPlannerResult;
  stagedFactIds: string[];
  source: NewVideoProjectVibeStagedTransactionSource;
  sourceTurn?: NewVideoProjectVibeSourceTurnRef;
  summary: NewVideoProjectVibeStagedTransactionSummary;
  blocked: boolean;
  blockedReasons: string[];
  selectedShotId?: string;
}

export interface NewVideoProjectVibeStagedTransactionCommitResult {
  status: ProjectVibeTransactionReceipt["status"];
  project: ProjectVibeDocument;
  planner: ScriptPlannerResult;
  patch: ProjectVibePatchResult;
  selectedShotId?: string;
  blockedReasons: string[];
}

export interface BuildNewVideoProjectVibeStagedTransactionInput {
  project: ProjectVibeDocument;
  draft: NewVideoProjectVibeDraftLike;
  directorSession?: Pick<DirectorSessionState, "sessionId" | "projectId" | "turns" | "stagedFacts">;
  discussionDeltas?: StoryDiscussionDelta[];
  storyboardDraft?: NewVideoProjectVibeStoryboardDraftShotLike[];
  generatedAt?: string;
}

export interface CommitNewVideoProjectVibeStagedTransactionInput {
  project: ProjectVibeDocument;
  stagedTransaction: NewVideoProjectVibeStagedTransactionPreview;
}

function clean(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function buildPlannerIdea(draft: NewVideoProjectVibeDraftLike): string {
  const script = clean(draft.script);
  const style = clean(draft.style);
  return [
    script,
    style ? `风格：${style}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Resets a project to a clean state for a new story.
 *
 * WARNING: Destructive. This clears all existing storyFlow sections, shotOrder,
 * all shots, and dissociates assets/visualMemory from their previous shots.
 * There is no archive or backup mechanism — previous story data is permanently
 * discarded. Callers should ensure any data the user wants to keep is saved
 * before invoking this function.
 */
function projectReadyForNewStory(project: ProjectVibeDocument): ProjectVibeDocument {
  const readyProject = {
    ...project,
    storyFlow: {
      ...project.storyFlow,
      sections: [],
      shotOrder: [],
    },
    visualMemory: {
      ...project.visualMemory,
      entries: project.visualMemory.entries.map((entry) => ({
        ...entry,
        usedByShotIds: [],
      })),
    },
    shots: [],
    assets: project.assets.map((asset) => ({
      ...asset,
      usedByShotIds: [],
    })),
  };
  return refreshProjectVibeSourceIndex(readyProject, project.manifest.updatedAt);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().reduce<Record<string, unknown>>((next, key) => {
    const item = record[key];
    if (item !== undefined) next[key] = canonicalize(item);
    return next;
  }, {});
}

function stableHashValue(value: unknown): string {
  return stableKnowledgeHash(JSON.stringify(canonicalize(value)));
}

function draftHash(draft: NewVideoProjectVibeDraftLike): string {
  return stableHashValue({
    script: clean(draft.script),
    style: clean(draft.style),
    referenceCount: draft.references?.length || 0,
    references: (draft.references || []).map((reference) => draftReferenceHashShape(reference)).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    audioAttached: Boolean(draft.audio),
    audioRole: draft.audioRole || (draft.audio ? "voice_reference" : ""),
    musicAnalysisId: draft.musicAnalysis?.analysisId || "",
  });
}

function draftAudioReferenceIds(draft: NewVideoProjectVibeDraftLike): string[] {
  if (!draft.audio) return [];
  return draft.audioRole === "music_reference"
    ? ["music_reference:new_video_music_reference_1", draft.musicAnalysis?.analysisId ? `music_analysis:${draft.musicAnalysis.analysisId}` : ""].filter(Boolean)
    : ["audio_reference:new_video_audio_reference_1"];
}

function draftReferenceAssetKind(type?: string): ProjectVibeAssetKind | undefined {
  const normalized = clean(type).toLowerCase();
  if (normalized === "character" || normalized === "scene" || normalized === "style" || normalized === "prop") return normalized;
  if (normalized === "image" || normalized === "reference") return "reference";
  return undefined;
}

function referenceKindLabel(kind: ProjectVibeAssetKind): string {
  if (kind === "character") return "主角参考";
  if (kind === "scene") return "场景参考";
  if (kind === "style") return "风格参考";
  if (kind === "prop") return "道具参考";
  return "参考图";
}

interface NormalizedReferenceBinding {
  kind: ProjectVibeAssetKind;
  targetLabel: string;
  shotIds: string[];
  scope: string;
  hasExplicitBinding: boolean;
}

function referenceBindingInput(reference: NewVideoProjectVibeReferenceLike): NewVideoReferenceBindingLike {
  return {
    ...(reference.binding || {}),
    ...(reference.role ? { role: reference.role } : {}),
    ...(reference.character ? { character: reference.character } : {}),
    ...(reference.scene ? { scene: reference.scene } : {}),
    ...(reference.prop ? { prop: reference.prop } : {}),
    ...(reference.style ? { style: reference.style } : {}),
    ...(reference.shotIds ? { shotIds: reference.shotIds } : {}),
    ...(reference.scope ? { scope: reference.scope } : {}),
  };
}

function bindingKindFromValue(value?: string): ProjectVibeAssetKind | undefined {
  const normalized = clean(value).toLowerCase();
  if (normalized === "character" || normalized === "role" || normalized === "person" || normalized === "人物" || normalized === "角色") return "character";
  if (normalized === "scene" || normalized === "location" || normalized === "场景" || normalized === "地点") return "scene";
  if (normalized === "prop" || normalized === "object" || normalized === "道具") return "prop";
  if (normalized === "style" || normalized === "look" || normalized === "风格") return "style";
  if (normalized === "reference" || normalized === "image" || normalized === "参考图") return "reference";
  return undefined;
}

function bindingTargetLabel(binding: NewVideoReferenceBindingLike): string {
  return clean(binding.role)
    || clean(binding.character)
    || clean(binding.scene)
    || clean(binding.prop)
    || clean(binding.style);
}

function bindingKindFromFields(binding: NewVideoReferenceBindingLike): ProjectVibeAssetKind | undefined {
  return clean(binding.role) || clean(binding.character)
    ? "character"
    : clean(binding.scene)
      ? "scene"
      : clean(binding.prop)
        ? "prop"
        : clean(binding.style)
          ? "style"
          : undefined;
}

function normalizedReferenceBinding(reference: NewVideoProjectVibeReferenceLike): NormalizedReferenceBinding | undefined {
  const binding = referenceBindingInput(reference);
  const kind = bindingKindFromValue(binding.kind)
    || bindingKindFromFields(binding)
    || draftReferenceAssetKind(reference.type);
  if (!kind) return undefined;
  const shotIds = Array.isArray(binding.shotIds)
    ? unique(binding.shotIds.map(clean))
    : [];
  const scope = clean(binding.scope);
  return {
    kind,
    targetLabel: bindingTargetLabel(binding),
    shotIds,
    scope,
    hasExplicitBinding: Boolean(
      bindingKindFromValue(binding.kind)
      || bindingKindFromFields(binding)
      || shotIds.length
      || scope,
    ),
  };
}

function draftReferenceHashShape(reference: NewVideoProjectVibeReferenceLike): Record<string, unknown> {
  const binding = normalizedReferenceBinding(reference);
  return {
    type: clean(reference.type),
    bindingKind: binding?.kind || "",
    targetLabel: binding?.targetLabel || "",
    shotIds: binding?.shotIds || [],
    scope: binding?.scope || "",
    explicit: binding?.hasExplicitBinding || false,
  };
}

function plannerInputHash(input: {
  project: ProjectVibeDocument;
  draft: NewVideoProjectVibeDraftLike;
  storyboardDraft?: NewVideoProjectVibeStoryboardDraftShotLike[];
  discussionDeltas?: StoryDiscussionDelta[];
  generatedAt: string;
}): string {
  return stableHashValue({
    projectId: input.project.manifest.projectId,
    beforeFactHash: hashProjectVibeFacts(input.project),
    idea: buildPlannerIdea(input.draft),
    storyboardDraft: storyboardDraftUsableRows(input.storyboardDraft).map((row, index) => ({
      index,
      id: clean(row.id),
      shotNo: clean(row.shotNo),
      duration: clean(row.duration),
      title: clean(row.title),
      shotSize: clean(row.shotSize),
      camera: clean(row.camera),
      visualDescription: clean(row.visualDescription),
      primaryAction: clean(row.primaryAction),
      actionTrigger: clean(row.actionTrigger),
      microReaction: clean(row.microReaction),
      executionMode: clean(row.executionMode),
      visibleCutBudget: clean(row.visibleCutBudget),
      rhythmProfile: clean(row.rhythmProfile),
    })),
    discussionDeltas: (input.discussionDeltas || []).map((delta) => ({
      id: delta.id,
      kind: delta.kind,
      status: delta.status,
      summary: clean(delta.summary),
    })),
    generatedAt: input.generatedAt,
    audioRole: input.draft.audioRole || "",
    musicAnalysisId: input.draft.musicAnalysis?.analysisId || "",
  });
}

function fallbackStagedFactIds(input: {
  draft: NewVideoProjectVibeDraftLike;
  planner: ScriptPlannerResult;
  draftHash: string;
}): string[] {
  const prefix = `new_video_staged_fact_${input.draftHash.replace(/^vck_/, "").slice(0, 10)}`;
  return [
    clean(input.draft.script) ? `${prefix}_script_brief` : "",
    clean(input.draft.style) ? `${prefix}_visual_style` : "",
    ...input.planner.shots.map((shot) => `${prefix}_${shot.id}`),
  ].filter(Boolean);
}

function sourceTurnFromSession(
  directorSession?: BuildNewVideoProjectVibeStagedTransactionInput["directorSession"],
): NewVideoProjectVibeSourceTurnRef | undefined {
  const turn = directorSession?.turns.find((item) => item.role === "user") || directorSession?.turns[0];
  if (!turn) return undefined;
  return {
    id: turn.id,
    role: turn.role,
    scope: turn.scope,
    createdAt: turn.createdAt,
    sourceRefs: turn.sourceRefs,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function shortNote(value: string, maxLength = 72): string {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function deltaSourceRef(delta: StoryDiscussionDelta): string {
  return `discussion_delta:${delta.id}`;
}

function deltaText(delta: StoryDiscussionDelta): string {
  return clean(`${delta.label} ${delta.summary}`);
}

function appendSentence(value: string, sentence: string): string {
  const next = shortNote(sentence, 96);
  if (!next || value.includes(next)) return value;
  return `${value}${/[。.!?！？]$/u.test(value.trim()) ? "" : "。"}${next}`;
}

function claimPlannerId(base: string, usedIds: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function safeSourceRefToken(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function discussionDeltaHash(deltas: StoryDiscussionDelta[]): string {
  return stableHashValue(deltas.map((delta) => ({
    id: delta.id,
    kind: delta.kind,
    summary: clean(delta.summary),
    confirmedAt: delta.confirmedAt,
  }))).slice(4, 10);
}

function storyboardDraftHash(rows: NewVideoProjectVibeStoryboardDraftShotLike[]): string {
  return stableHashValue(rows.map((row, index) => ({
    index,
    id: clean(row.id),
    shotNo: clean(row.shotNo),
    duration: clean(row.duration),
    title: clean(row.title),
    shotSize: clean(row.shotSize),
    camera: clean(row.camera),
    visualDescription: clean(row.visualDescription),
    primaryAction: clean(row.primaryAction),
    actionTrigger: clean(row.actionTrigger),
    microReaction: clean(row.microReaction),
    actionReactionQa: clean(row.actionReactionQa),
    executionMode: clean(row.executionMode),
    visibleCutBudget: clean(row.visibleCutBudget),
    subtitle: clean(row.subtitle),
    sound: clean(row.sound),
    characters: clean(row.characters),
    scene: clean(row.scene),
    props: clean(row.props),
    audioUsage: clean(row.audioUsage),
    rhythmProfile: clean(row.rhythmProfile),
    rhythmReason: clean(row.rhythmReason),
    sourceFactId: clean(row.sourceFactId),
  }))).slice(4, 10);
}

function storyboardDraftUsableRows(
  rows?: NewVideoProjectVibeStoryboardDraftShotLike[],
): NewVideoProjectVibeStoryboardDraftShotLike[] {
  return (rows || []).filter((row) => clean([
    row.title,
    row.visualDescription,
    row.primaryAction,
    row.camera,
    row.shotNo,
  ].join(" ")));
}

function storyboardDraftPlanningText(row: NewVideoProjectVibeStoryboardDraftShotLike): string {
  return clean([
    row.title,
    row.shotNo,
    row.shotSize,
    row.camera,
    row.visualDescription,
    row.primaryAction,
    row.actionTrigger,
    row.microReaction,
    row.characters,
    row.scene,
    row.props,
  ].join(" "));
}

function storyboardDraftQaBlockers(rows: NewVideoProjectVibeStoryboardDraftShotLike[]): ScriptPlannerResult["qaBlockers"] {
  if (!rows.length) return [];

  const meaningfulRows = rows.filter((row) => storyboardDraftPlanningText(row).length >= 12);
  const actionRows = rows.filter((row) => clean([
    row.primaryAction,
    row.actionTrigger,
    row.visualDescription,
    row.camera,
  ].join(" ")).length >= 8);
  const anchorRows = rows.filter((row) => clean([
    row.characters,
    row.scene,
    row.props,
    row.visualDescription,
    row.title,
  ].join(" ")).length >= 8);

  const blockers: ScriptPlannerResult["qaBlockers"] = [];
  if (!meaningfulRows.length) {
    blockers.push({
      id: "script_qa_idea",
      field: "idea" as const,
      severity: "blocker" as const,
      message: "分镜草案还没有可写入 Project.vibe 的镜头内容。",
    });
  }
  if (!anchorRows.length) {
    blockers.push({
      id: "script_qa_protagonist",
      field: "protagonist" as const,
      severity: "blocker" as const,
      message: "分镜草案还缺少可拍摄的角色、场景或主体锚点。",
    });
  }
  if (!actionRows.length) {
    blockers.push({
      id: "script_qa_visual_action",
      field: "visual_action" as const,
      severity: "blocker" as const,
      message: "分镜草案还缺少可拍摄的动作或镜头变化。",
    });
  }
  return blockers;
}

function storyboardDurationSeconds(row: NewVideoProjectVibeStoryboardDraftShotLike): number {
  const parsed = Number.parseFloat(clean(row.duration));
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.max(1, Math.min(60, Math.round(parsed * 10) / 10));
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = Number.parseInt(clean(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.max(0, Math.min(12, parsed));
}

function storyboardActionBeats(row: NewVideoProjectVibeStoryboardDraftShotLike): string[] {
  return unique([
    ...(Array.isArray(row.actionBeats) ? row.actionBeats.map((item) => clean(item)) : []),
    clean(row.primaryAction),
    clean(row.actionTrigger),
    clean(row.microReaction),
  ].filter(Boolean)).slice(0, 12);
}

function storyboardReferenceStrategy(row: NewVideoProjectVibeStoryboardDraftShotLike): ProjectVibeShot["referenceStrategy"] | undefined {
  const strategy = clean(row.referenceStrategy);
  if (strategy === "storyboard_narrative" || strategy === "storyboard_rapid_cut" || strategy === "omni_reference") return strategy;
  return undefined;
}

function storyboardVisibleClips(row: NewVideoProjectVibeStoryboardDraftShotLike, actionBeats: string[]): number {
  const explicit = positiveInteger(row.visibleClips);
  if (explicit && explicit > 0) return explicit;
  if (storyboardReferenceStrategy(row) !== "storyboard_rapid_cut") return 1;
  const exactCut = clean(row.visibleCutBudget).match(/(\d+)\s*个?可见切点/u);
  if (exactCut) return Math.max(1, Math.min(12, Number(exactCut[1]) + 1));
  const rangeCut = clean(row.visibleCutBudget).match(/(\d+)\s*[-~到至]\s*(\d+)\s*个?可见切点/u);
  if (rangeCut) return Math.max(1, Math.min(12, Number(rangeCut[2]) + 1));
  return Math.max(2, Math.min(12, actionBeats.length || 2));
}

function storyboardPanelCount(
  row: NewVideoProjectVibeStoryboardDraftShotLike,
  visibleClips: number,
  actionBeats: string[],
): number {
  const explicit = positiveInteger(row.storyboardPanels);
  if (explicit !== undefined) return explicit;
  const strategy = storyboardReferenceStrategy(row);
  if (strategy === "omni_reference") return 0;
  if (strategy === "storyboard_narrative") return 1;
  if (strategy === "storyboard_rapid_cut") return Math.max(2, Math.min(12, visibleClips, actionBeats.length || 2));
  return 0;
}

function splitStoryboardList(value: unknown): string[] {
  return unique(clean(value)
    .split(/[、,，/|]/u)
    .map((item) => clean(item))
    .filter((item) => item && item !== "无" && item !== "待确认"));
}

function storyboardShotTitle(row: NewVideoProjectVibeStoryboardDraftShotLike, index: number): string {
  return shortNote(clean(row.title) || clean(row.visualDescription) || `镜头 ${index + 1}`, 36);
}

function storyboardShotIntent(row: NewVideoProjectVibeStoryboardDraftShotLike, index: number): string {
  return [
    clean(row.shotNo) ? `镜号：${clean(row.shotNo)}` : `镜头 ${index + 1}`,
    clean(row.duration) ? `时长：${clean(row.duration)} 秒` : "",
    clean(row.shotSize) ? `景别：${clean(row.shotSize)}` : "",
    clean(row.camera) ? `镜头：${clean(row.camera)}` : "",
    clean(row.visualDescription) ? `画面：${clean(row.visualDescription)}` : "",
    clean(row.primaryAction) ? `主动作：${clean(row.primaryAction)}` : "",
    clean(row.actionTrigger) ? `触发：${clean(row.actionTrigger)}` : "",
    clean(row.microReaction) ? `微反应：${clean(row.microReaction)}` : "",
    clean(row.actionReactionQa) ? `行动反应：${clean(row.actionReactionQa)}` : "",
    clean(row.visibleCutBudget) ? `切点：${clean(row.visibleCutBudget)}` : "",
    clean(row.subtitle) && clean(row.subtitle) !== "-" ? `字幕：${clean(row.subtitle)}` : "",
    clean(row.sound) ? `声音：${clean(row.sound)}` : "",
    clean(row.characters) ? `角色：${clean(row.characters)}` : "",
    clean(row.scene) ? `场景：${clean(row.scene)}` : "",
    clean(row.props) ? `道具：${clean(row.props)}` : "",
  ].filter(Boolean).join("。");
}

function applyStoryboardDraftToPlanner(input: {
  planner: ScriptPlannerResult;
  storyboardDraft?: NewVideoProjectVibeStoryboardDraftShotLike[];
  generatedAt: string;
}): ScriptPlannerResult {
  const rows = storyboardDraftUsableRows(input.storyboardDraft);
  if (!rows.length) return input.planner;

  const tableHash = storyboardDraftHash(rows);
  const usedSectionIds = new Set(input.planner.sections.map((section) => section.id));
  const usedShotIds = new Set(input.planner.shots.map((shot) => shot.id));
  const qaBlockers = storyboardDraftQaBlockers(rows);
  const blocked = qaBlockers.some((blocker) => blocker.severity === "blocker");
  const sections: ProjectVibeStorySection[] = [];
  const shots: ScriptPlannerResult["shots"] = [];

  rows.forEach((row, index) => {
    const rowToken = safeSourceRefToken(clean(row.shotNo) || clean(row.title) || clean(row.id) || `row_${index + 1}`)
      || `${tableHash}_${index + 1}`;
    const sectionId = claimPlannerId(`sec_storyboard_${rowToken}`, usedSectionIds);
    const shotId = claimPlannerId(`shot_storyboard_${rowToken}`, usedShotIds);
    const title = storyboardShotTitle(row, index);
    const characters = splitStoryboardList(row.characters);
    const scenes = splitStoryboardList(row.scene);
    const props = splitStoryboardList(row.props);
    const visualAnchor = shortNote([
      clean(row.shotSize),
      clean(row.scene),
      clean(row.rhythmProfile),
      clean(row.executionMode),
    ].filter(Boolean).join(" / ") || "storyboard_table", 80);
    const sourceRefs = unique([
      `storyboard_table:${tableHash}`,
      `storyboard_row:${rowToken}`,
      clean(row.sourceFactId) ? `director_session_fact:${clean(row.sourceFactId)}` : "",
      `script_planner:${input.planner.plannerId}`,
    ]);
    const actionBeats = storyboardActionBeats(row);
    const visibleClips = storyboardVisibleClips(row, actionBeats);
    const storyboardPanels = storyboardPanelCount(row, visibleClips, actionBeats);
    const referenceStrategy = storyboardReferenceStrategy(row);

    sections.push({
      id: sectionId,
      title,
      summary: shortNote(storyboardShotIntent(row, index), 180),
      sequenceIndex: index,
      shotIds: [shotId],
    });

    shots.push({
      id: shotId,
      sectionId,
      title,
      intent: storyboardShotIntent(row, index) || title,
      camera: clean(row.camera) || undefined,
      videoControlMode: "reference_driven",
      executionMode: clean(row.executionMode) || undefined,
      rhythmProfile: clean(row.rhythmProfile) || undefined,
      splitPolicy: clean(row.visibleCutBudget) || undefined,
      visibleClips,
      storyboardPanels,
      actionBeats,
      primaryAction: clean(row.primaryAction) || undefined,
      actionTrigger: clean(row.actionTrigger) || undefined,
      microReaction: clean(row.microReaction) || undefined,
      seedanceDirection: shortNote(clean(row.actionReactionQa) || clean(row.rhythmReason), 180) || undefined,
      subtitle: clean(row.subtitle) && clean(row.subtitle) !== "-" ? clean(row.subtitle) : undefined,
      sound: clean(row.sound) || undefined,
      audioUsage: clean(row.audioUsage) || undefined,
      dialogueLines: clean(row.subtitle) && clean(row.subtitle) !== "-" ? [clean(row.subtitle)] : [],
      referenceStrategy,
      directorFeedbackDirectives: unique([
        clean(row.rhythmReason) ? `节奏判断：${clean(row.rhythmReason)}` : "",
        clean(row.audioUsage) ? `音频用途：${clean(row.audioUsage)}` : "",
      ]),
      characterGuidance: characters,
      sceneGuidance: scenes,
      propGuidance: props,
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: storyboardDurationSeconds(row),
      status: blocked ? "blocked" : "planned",
      sourceRefs,
      plannerNotes: {
        visibleAction: shortNote(clean(row.primaryAction) || clean(row.visualDescription) || title, 120),
        emotionalIntent: shortNote(clean(row.microReaction) || clean(row.rhythmReason) || clean(row.actionReactionQa), 120),
        visualAnchor,
      },
    });
  });

  return rebuildPlannerPatchOperations({
    ...input.planner,
    plannerId: `${input.planner.plannerId}_storyboard_${tableHash}`,
    generatedAt: input.generatedAt,
    missingInfo: qaBlockers.length ? input.planner.missingInfo : input.planner.missingInfo.filter((item) => item.severity !== "ask_user"),
    qaBlockers,
    sections: reindexSections(sections),
    shots,
  });
}

function storyFlowFromPlanner(planner: ScriptPlannerResult): ProjectVibeStoryFlow {
  const existing = planner.projectVibePatchOperations.find((operation) => operation.op === "set_story_flow");
  return {
    id: existing?.op === "set_story_flow" ? existing.storyFlow.id : "story_flow_current",
    updatedAt: planner.generatedAt,
    sourceOfTruth: "project_vibe",
    sections: planner.sections,
    shotOrder: planner.shots.map((shot) => shot.id),
  };
}

function rebuildPlannerPatchOperations(planner: ScriptPlannerResult): ScriptPlannerResult {
  const storyFlow = storyFlowFromPlanner(planner);
  // plannerNotes (visibleAction, emotionalIntent, visualAnchor) is planner-internal
  // metadata and not part of the ProjectVibeShot type. It is intentionally stripped
  // here so the patch operations conform to the ProjectVibeShot schema. Downstream
  // consumers that need plannerNotes should access it from the ScriptPlannerResult
  // directly rather than from project vibe patch operations.
  const patchShots: ProjectVibeShot[] = planner.shots.map(({ plannerNotes, ...shot }) => shot);
  return {
    ...planner,
    projectVibePatchOperations: [
      { op: "set_story_flow", storyFlow },
      ...patchShots.map((shot) => ({ op: "upsert_shot" as const, shot })),
    ],
  };
}

function targetShotIndex(text: string, count: number): number {
  if (count <= 0) return -1;
  if (/第\s*(?:一|1)|第?1\s*(?:个|镜)|first|开头|开始/i.test(text)) return 0;
  if (/第\s*(?:二|2)|第?2\s*(?:个|镜)|second/i.test(text)) return Math.min(1, count - 1);
  if (/第\s*(?:三|3)|第?3\s*(?:个|镜)|third/i.test(text)) return Math.min(2, count - 1);
  if (/最后|结尾|末尾|last|final/i.test(text)) return count - 1;
  return Math.min(Math.floor(count / 2), count - 1);
}

function reindexSections(sections: ProjectVibeStorySection[]): ProjectVibeStorySection[] {
  return sections.map((section, index) => ({
    ...section,
    sequenceIndex: index,
  }));
}

function enrichShotForDelta(
  shot: ScriptPlannerResult["shots"][number],
  delta: StoryDiscussionDelta,
  note: string,
): ScriptPlannerResult["shots"][number] {
  const ref = deltaSourceRef(delta);
  return {
    ...shot,
    intent: appendSentence(shot.intent, `确认修改：${note}`),
    sourceRefs: unique([...shot.sourceRefs, ref]),
    plannerNotes: {
      ...shot.plannerNotes,
      emotionalIntent: appendSentence(shot.plannerNotes.emotionalIntent, note),
    },
  };
}

function enrichSectionForDelta(
  section: ProjectVibeStorySection,
  _delta: StoryDiscussionDelta,
  note: string,
): ProjectVibeStorySection {
  return {
    ...section,
    summary: appendSentence(section.summary, `确认修改：${shortNote(note)}`),
    shotIds: [...section.shotIds],
  };
}

function applyGlobalPlanningDelta(
  planner: ScriptPlannerResult,
  delta: StoryDiscussionDelta,
  note: string,
): ScriptPlannerResult {
  if (!planner.shots.length) return planner;
  const firstShotId = planner.shots[0]?.id;
  return {
    ...planner,
    shots: planner.shots.map((shot, index) => (
      index === 0
        ? enrichShotForDelta(shot, delta, note)
        : { ...shot, sourceRefs: unique([...shot.sourceRefs, deltaSourceRef(delta)]) }
    )),
    sections: planner.sections.map((section) => (
      section.shotIds.includes(firstShotId)
        ? enrichSectionForDelta(section, delta, note)
        : { ...section, shotIds: [...section.shotIds] }
    )),
  };
}

function applyTimingDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  const text = deltaText(delta);
  const index = targetShotIndex(text, planner.shots.length);
  if (index < 0) return planner;
  const shot = planner.shots[index];
  const slower = /慢|拉长|停留|多一点|longer|slower|hold/i.test(text);
  const faster = /快|压缩|短一点|faster|shorter|compress/i.test(text);
  const deltaSeconds = faster ? -2 : slower ? 2 : 1;
  const durationSeconds = Math.max(3, Math.min(12, shot.durationSeconds + deltaSeconds));
  const note = faster
    ? "按已确认反馈压缩这个镜头的节奏。"
    : "按已确认反馈让这个镜头多停留一点。";
  const nextShot = enrichShotForDelta({ ...shot, durationSeconds }, delta, note);
  const affectedSectionId = nextShot.sectionId;
  return {
    ...planner,
    shots: planner.shots.map((item, itemIndex) => (itemIndex === index ? nextShot : item)),
    sections: planner.sections.map((section) => (
      section.id === affectedSectionId ? enrichSectionForDelta(section, delta, note) : { ...section, shotIds: [...section.shotIds] }
    )),
  };
}

function addedShotTitle(text: string): string {
  if (/清晨.*空镜|空镜.*清晨/u.test(text)) return "清晨空镜";
  if (/空镜|establishing/i.test(text)) return "补充空镜";
  if (/特写|close[- ]?up/i.test(text)) return "补充特写";
  return "补充镜头";
}

function applyAddRemoveDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  const text = deltaText(delta);
  const ref = deltaSourceRef(delta);
  const removeOnly = /删|删除|去掉|remove|delete/i.test(text) && !/加|新增|补一个|add|insert/i.test(text);

  if (removeOnly && planner.shots.length > 1) {
    const index = targetShotIndex(text, planner.shots.length);
    const removed = planner.shots[index];
    const nextShots = planner.shots.filter((_, itemIndex) => itemIndex !== index);
    const nextSections = reindexSections(planner.sections
      .map((section) => ({
        ...section,
        summary: section.id === removed.sectionId
          ? appendSentence(section.summary, "确认修改：这个镜头已从草案中移除。")
          : section.summary,
        shotIds: section.shotIds.filter((shotId) => shotId !== removed.id),
      }))
      .filter((section) => section.shotIds.length > 0));
    return {
      ...planner,
      sections: nextSections,
      shots: nextShots.map((shot, itemIndex) => (
        itemIndex === Math.max(0, index - 1)
          ? { ...shot, sourceRefs: unique([...shot.sourceRefs, ref]) }
          : shot
      )),
    };
  }

  const usedSectionIds = new Set(planner.sections.map((section) => section.id));
  const usedShotIds = new Set(planner.shots.map((shot) => shot.id));
  const suffix = stableHashValue(`${planner.plannerId}:${delta.id}`).slice(4, 10);
  const sectionId = claimPlannerId(`sec_${suffix}_extra`, usedSectionIds);
  const shotId = claimPlannerId(`shot_${suffix}_extra`, usedShotIds);
  const title = addedShotTitle(text);
  const status = planner.qaBlockers.some((blocker) => blocker.severity === "blocker") ? "blocked" : "planned";
  const section: ProjectVibeStorySection = {
    id: sectionId,
    title,
    summary: `按已确认讨论修改补充一个${title}，用于衔接故事节奏。`,
    sequenceIndex: planner.sections.length,
    shotIds: [shotId],
  };
  const shot: ScriptPlannerResult["shots"][number] = {
    id: shotId,
    sectionId,
    title,
    intent: `补充一个${title}，让确认后的分镜草案包含用户要求的新增画面。`,
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: 5,
    status,
    sourceRefs: [ref, `script_planner:${planner.plannerId}#discussion_delta/${delta.id}`],
    plannerNotes: {
      visibleAction: title.includes("空镜") ? "拍摄一个不依赖角色表演的环境过渡画面。" : "补充一个可拍摄的过渡动作或细节。",
      emotionalIntent: "承接用户确认的分镜增删反馈，让节奏更完整。",
      visualAnchor: title.includes("清晨") ? "morning" : "transition",
    },
  };
  return {
    ...planner,
    sections: [...planner.sections, section],
    shots: [...planner.shots, shot],
  };
}

function applyOrderDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  const text = deltaText(delta);
  if (planner.shots.length < 2) return planner;
  const fromIndex = targetShotIndex(text, planner.shots.length);
  const toIndex = /提前|前移|before|earlier/i.test(text)
    ? Math.max(0, fromIndex - 1)
    : /后移|往后|after|later/i.test(text)
      ? Math.min(planner.shots.length - 1, fromIndex + 1)
      : fromIndex;
  if (fromIndex === toIndex) return applyGlobalPlanningDelta(planner, delta, "已记录分镜顺序调整，等待后续更明确的位置指令。");
  const nextShots = [...planner.shots];
  const [shot] = nextShots.splice(fromIndex, 1);
  nextShots.splice(toIndex, 0, enrichShotForDelta(shot, delta, "按已确认反馈调整镜头顺序。"));
  const sectionOrder = new Map(nextShots.map((item, index) => [item.sectionId, index]));
  const nextSections = reindexSections([...planner.sections].sort((left, right) => (
    (sectionOrder.get(left.id) ?? left.sequenceIndex) - (sectionOrder.get(right.id) ?? right.sequenceIndex)
  )));
  return {
    ...planner,
    shots: nextShots,
    sections: nextSections,
  };
}

function applyStyleRevisionDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  const revision = delta.revisionSummary;
  const profile = revision?.requestedRhythmProfile;
  const avoid = revision?.avoidStyle?.length ? ` 避免${revision.avoidStyle.join("、")}。` : "";
  const reference = revision?.referencePreference ? ` 参考偏好：${shortNote(revision.referencePreference, 64)}。` : "";
  const note = profile === "action_fast_cut"
    ? `按已确认反馈改成日漫动作快切，动作点更清楚。${reference}${avoid}`
    : profile === "anime_emotion"
      ? `按已确认反馈改成日漫情绪特写，用眼神、表情和手部承接。${reference}${avoid}`
      : `按已确认反馈调整导演风格。${reference}${avoid}`;
  return applyGlobalPlanningDelta(planner, delta, note);
}

function applyReferencePreferenceDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  const note = delta.revisionSummary?.referencePreference
    ? `确认参考偏好：${shortNote(delta.revisionSummary.referencePreference, 72)}。`
    : "确认参考偏好进入分镜节奏判断。";
  return applyGlobalPlanningDelta(planner, delta, note);
}

function microShotTitle(kind: "wide" | "face" | "hand", baseTitle: string): string {
  if (kind === "wide") return `${baseTitle} - 远景关系`;
  if (kind === "face") return `${baseTitle} - 表情特写`;
  return `${baseTitle} - 手部动作特写`;
}

function microShotNotes(kind: "wide" | "face" | "hand"): ScriptPlannerResult["shots"][number]["plannerNotes"] {
  if (kind === "wide") {
    return {
      visibleAction: "先用远一点的关系镜头重新建立人物与空间距离。",
      emotionalIntent: "让后续特写有空间依据，避免动作显得平。",
      visualAnchor: "anime_wide_relationship",
    };
  }
  if (kind === "face") {
    return {
      visibleAction: "切到表情近景，承接动作前后的眼神和呼吸停顿。",
      emotionalIntent: "用日漫式表情特写放大人物反应。",
      visualAnchor: "anime_face_closeup",
    };
  }
  return {
    visibleAction: "切到手部动作特写，让关键动作点清楚可拍。",
    emotionalIntent: "用手部细节把情绪和动作连接起来。",
    visualAnchor: "anime_hand_insert",
  };
}

function applySplitPreferenceDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  const revision = delta.revisionSummary;
  const text = deltaText(delta);
  if (revision?.requestedSplitPolicy !== "more_micro_shots") {
    return applyGlobalPlanningDelta(planner, delta, "按已确认反馈减少碎切，优先保留完整表演。");
  }
  if (!planner.shots.length) return planner;
  const ref = deltaSourceRef(delta);
  const targetIndex = targetShotIndex(text, planner.shots.length);
  const targetShot = planner.shots[Math.max(0, targetIndex)];
  const usedSectionIds = new Set(planner.sections.map((section) => section.id));
  const usedShotIds = new Set(planner.shots.map((shot) => shot.id));
  const suffix = stableHashValue(`${planner.plannerId}:${delta.id}:micro_shots`).slice(4, 10);
  const microKinds: Array<"wide" | "face" | "hand"> = ["wide", "face", "hand"];
  const newSections: ProjectVibeStorySection[] = [];
  const newShots: ScriptPlannerResult["shots"] = [];

  microKinds.forEach((kind, index) => {
    const sectionId = claimPlannerId(`sec_${suffix}_${index + 1}_${kind}`, usedSectionIds);
    const shotId = claimPlannerId(`shot_${suffix}_${index + 1}_${kind}`, usedShotIds);
    const title = microShotTitle(kind, targetShot.title);
    newSections.push({
      id: sectionId,
      title,
      summary: `按已确认反馈把「${targetShot.title}」拆成日漫节奏中的${kind === "wide" ? "远景关系" : kind === "face" ? "表情特写" : "手部动作特写"}。`,
      sequenceIndex: targetIndex + index + 1,
      shotIds: [shotId],
    });
    newShots.push({
      ...targetShot,
      id: shotId,
      sectionId,
      title,
      intent: `确认修改：${revision.confirmationCopy}`,
      durationSeconds: kind === "wide" ? 4 : 3,
      sourceRefs: unique([
        ...targetShot.sourceRefs,
        ref,
        `script_planner:${planner.plannerId}#discussion_delta/${delta.id}/micro_${kind}`,
      ]),
      plannerNotes: microShotNotes(kind),
    });
  });

  const nextSections = [
    ...planner.sections.slice(0, targetIndex + 1),
    ...newSections,
    ...planner.sections.slice(targetIndex + 1),
  ].map((section, index) => ({ ...section, sequenceIndex: index }));
  const nextShots = [
    ...planner.shots.slice(0, targetIndex + 1),
    ...newShots,
    ...planner.shots.slice(targetIndex + 1),
  ];
  return {
    ...planner,
    sections: nextSections,
    shots: nextShots,
  };
}

function applyDiscussionDelta(planner: ScriptPlannerResult, delta: StoryDiscussionDelta): ScriptPlannerResult {
  if (delta.kind === "storyboard_timing_adjustment") return applyTimingDelta(planner, delta);
  if (delta.kind === "storyboard_style_revision") return applyStyleRevisionDelta(planner, delta);
  if (delta.kind === "storyboard_split_preference") return applySplitPreferenceDelta(planner, delta);
  if (delta.kind === "storyboard_reference_preference") return applyReferencePreferenceDelta(planner, delta);
  if (delta.kind === "storyboard_add_remove") return applyAddRemoveDelta(planner, delta);
  if (delta.kind === "storyboard_order_change") return applyOrderDelta(planner, delta);
  if (delta.kind === "character_multiview_request") {
    return applyGlobalPlanningDelta(planner, delta, "主角需要先准备多视角参考，再进入关键帧生成。");
  }
  if (delta.kind === "character_reference_binding") {
    return applyGlobalPlanningDelta(planner, delta, "角色参考绑定已进入分镜准备约束。");
  }
  if (delta.kind === "scene_reference_binding") {
    return applyGlobalPlanningDelta(planner, delta, "场景参考绑定已进入分镜准备约束。");
  }
  if (delta.kind === "audio_clone_source") {
    return applyGlobalPlanningDelta(planner, delta, "音色克隆来源已作为后续配音准备约束。");
  }
  if (delta.kind === "audio_usage_note") {
    return applyGlobalPlanningDelta(planner, delta, "音频用途已作为后续配音和分镜节奏约束。");
  }
  return applyGlobalPlanningDelta(planner, delta, "已确认的讨论反馈进入故事流准备。");
}

function applyConfirmedDiscussionDeltas(
  planner: ScriptPlannerResult,
  deltas: StoryDiscussionDelta[],
): ScriptPlannerResult {
  if (!deltas.length) return planner;
  const deltaHash = discussionDeltaHash(deltas);
  const nextPlanner = deltas.reduce(applyDiscussionDelta, {
    ...planner,
    plannerId: `${planner.plannerId}_delta_${deltaHash}`,
    sections: planner.sections.map((section) => ({ ...section, shotIds: [...section.shotIds] })),
    shots: planner.shots.map((shot) => ({
      ...shot,
      sceneAssetIds: [...shot.sceneAssetIds],
      characterAssetIds: [...shot.characterAssetIds],
      propAssetIds: [...shot.propAssetIds],
      sourceRefs: [...shot.sourceRefs],
      plannerNotes: { ...shot.plannerNotes },
    })),
    projectVibePatchOperations: [...planner.projectVibePatchOperations],
  });
  return rebuildPlannerPatchOperations(nextPlanner);
}

interface DraftReferenceBinding {
  planner: ScriptPlannerResult;
  referenceAssets: ProjectVibeDocument["assets"];
  visualMemoryOperation?: ProjectVibePatchOperation;
}

function referenceTextConstraints(input: {
  kind: ProjectVibeAssetKind;
  label: string;
  draft: NewVideoProjectVibeDraftLike;
  targetLabel?: string;
  scopeLabel?: string;
}): string[] {
  const constraints = [
    `${input.label}来自用户新视频入口，只能作为候选参考，不能替代已审核资产。`,
    clean(input.targetLabel) ? `${referenceKindLabel(input.kind)}目标：${shortNote(clean(input.targetLabel), 48)}` : "",
    clean(input.scopeLabel) ? `绑定范围：${clean(input.scopeLabel)}` : "",
    input.kind === "style" && clean(input.draft.style) ? `风格方向：${shortNote(clean(input.draft.style), 48)}` : "",
    input.kind === "character" ? "用于主角身份和多视角准备。" : "",
    input.kind === "scene" ? "用于场景气氛和空间准备。" : "",
  ];
  return unique(constraints);
}

function shotTextForBinding(shot: ScriptPlannerResult["shots"][number]): string {
  return clean([
    shot.id,
    shot.title,
    shot.intent,
    shot.plannerNotes.visibleAction,
    shot.plannerNotes.emotionalIntent,
    shot.plannerNotes.visualAnchor,
  ].join(" "));
}

function shotIdsFromOrdinal(value: string, planner: ScriptPlannerResult): string[] {
  const normalized = clean(value).toLowerCase();
  if (!normalized || !planner.shots.length) return [];
  const numeric = normalized.match(/^(?:shot[_ -]?)?(\d+)$/i)?.[1]
    || normalized.match(/^镜头\s*(\d+)$/u)?.[1];
  if (numeric) {
    const index = Number(numeric) - 1;
    return planner.shots[index]?.id ? [planner.shots[index].id] : [];
  }
  if (/^(first|first_shot|开头|开始|第一个镜头)$/i.test(normalized)) return planner.shots[0]?.id ? [planner.shots[0].id] : [];
  if (/^(last|last_shot|final|最后|最后一个镜头)$/i.test(normalized)) return planner.shots.at(-1)?.id ? [planner.shots.at(-1)!.id] : [];
  return [];
}

function resolveReferenceShotIdToken(value: string, planner: ScriptPlannerResult): string[] {
  const token = clean(value);
  if (!token) return [];
  const exactShot = planner.shots.find((shot) => shot.id === token);
  if (exactShot) return [exactShot.id];
  const exactSection = planner.sections.find((section) => section.id === token);
  if (exactSection) return exactSection.shotIds.filter((shotId) => planner.shots.some((shot) => shot.id === shotId));
  const scopedMatch = token.match(/^(shot|section):(.+)$/i);
  if (scopedMatch) return resolveReferenceShotIdToken(scopedMatch[2], planner);
  return shotIdsFromOrdinal(token, planner);
}

function bindingScopeLabel(binding: NormalizedReferenceBinding): string {
  if (binding.shotIds.length) return `shotIds:${binding.shotIds.join(",")}`;
  const scope = clean(binding.scope);
  if (!scope) return binding.hasExplicitBinding ? "binding_default" : "legacy_fallback";
  if (/^(project|global|all|all_shots)$/i.test(scope)) return "project";
  if (/^(first|first_shot)$/i.test(scope)) return "first_shot";
  if (/^(last|last_shot|final)$/i.test(scope)) return "last_shot";
  if (/^(none|asset_only)$/i.test(scope)) return "asset_only";
  return scope;
}

function fallbackReferenceShotIds(binding: NormalizedReferenceBinding, planner: ScriptPlannerResult): string[] {
  const shotIds = planner.shots.map((shot) => shot.id);
  if (!shotIds.length) return [];
  if (binding.kind === "character" || binding.kind === "style") return shotIds;
  if (binding.kind === "scene" && binding.targetLabel) {
    const target = clean(binding.targetLabel).toLowerCase();
    const matches = planner.shots
      .filter((shot) => shotTextForBinding(shot).toLowerCase().includes(target))
      .map((shot) => shot.id);
    if (matches.length) return unique(matches);
  }
  return [shotIds[0]];
}

function resolveReferenceShotIds(binding: NormalizedReferenceBinding, planner: ScriptPlannerResult): string[] {
  const explicitShotIds = unique(binding.shotIds.flatMap((shotId) => resolveReferenceShotIdToken(shotId, planner)));
  if (explicitShotIds.length) return explicitShotIds;

  const shotIds = planner.shots.map((shot) => shot.id);
  const scope = clean(binding.scope);
  if (/^(none|asset_only)$/i.test(scope)) return [];
  if (/^(project|global|all|all_shots)$/i.test(scope)) return shotIds;
  if (/^(first|first_shot)$/i.test(scope)) return shotIds[0] ? [shotIds[0]] : [];
  if (/^(last|last_shot|final)$/i.test(scope)) return shotIds.at(-1) ? [shotIds.at(-1)!] : [];
  if (/^(selected|selected_shots)$/i.test(scope)) return [];
  const scopedShotIds = resolveReferenceShotIdToken(scope, planner);
  if (scopedShotIds.length) return scopedShotIds;

  return fallbackReferenceShotIds(binding, planner);
}

function buildReferenceAssets(input: {
  draft: NewVideoProjectVibeDraftLike;
  draftHash: string;
  planner: ScriptPlannerResult;
}): ProjectVibeDocument["assets"] {
  return (input.draft.references || [])
    .map((reference, index): ProjectVibeDocument["assets"][number] | undefined => {
      const binding = normalizedReferenceBinding(reference);
      if (!binding) return undefined;
      const kind = binding.kind;
      const scopeLabel = bindingScopeLabel(binding);
      const label = binding.targetLabel
        ? `${referenceKindLabel(kind)}：${shortNote(binding.targetLabel, 32)}`
        : `${referenceKindLabel(kind)} ${index + 1}`;
      const assetId = `asset_${input.draftHash.replace(/^vck_/, "").slice(0, 10)}_${kind}_${index + 1}`;
      const usedByShotIds = resolveReferenceShotIds(binding, input.planner);
      return {
        id: assetId,
        kind,
        label,
        status: "candidate" as const,
        textConstraints: referenceTextConstraints({
          kind,
          label,
          draft: input.draft,
          targetLabel: binding.targetLabel,
          scopeLabel,
        }),
        usedByShotIds,
        sourceRefs: unique([
          `draft:${input.draftHash}`,
          `new_video_reference:${kind}:${index + 1}`,
          `new_video_reference_scope:${safeSourceRefToken(scopeLabel) || "legacy_fallback"}`,
          binding.targetLabel ? `new_video_reference_target:${kind}:${safeSourceRefToken(binding.targetLabel) || index + 1}` : "",
          `script_planner:${input.planner.plannerId}`,
        ]),
      };
    })
    .filter((asset): asset is ProjectVibeDocument["assets"][number] => Boolean(asset));
}

function visualMemoryWithReferenceAssets(input: {
  project: ProjectVibeDocument;
  referenceAssets: ProjectVibeDocument["assets"];
  generatedAt: string;
}): ProjectVibeDocument["visualMemory"] {
  const existingByAssetId = new Set(input.referenceAssets.map((asset) => asset.id));
  return {
    ...input.project.visualMemory,
    updatedAt: input.generatedAt,
    entries: [
      ...input.project.visualMemory.entries.filter((entry) => !existingByAssetId.has(entry.assetId)),
      ...input.referenceAssets.map((asset) => ({
        id: `vm_${asset.id}`,
        assetId: asset.id,
        kind: asset.kind,
        label: asset.label,
        status: asset.status,
        textConstraints: asset.textConstraints,
        usedByShotIds: asset.usedByShotIds,
        canUseAsFutureReference: false,
        sourceRefs: unique([
          ...asset.sourceRefs,
          `project.vibe#assets/${asset.id}`,
        ]),
      })),
    ],
  };
}

function bindReferenceAssetsToPlannerShots(
  planner: ScriptPlannerResult,
  referenceAssets: ProjectVibeDocument["assets"],
): ScriptPlannerResult {
  if (!referenceAssets.length) return planner;
  return rebuildPlannerPatchOperations({
    ...planner,
    shots: planner.shots.map((shot) => {
      const scopedAssets = referenceAssets.filter((asset) => asset.usedByShotIds.includes(shot.id));
      const characterAssetIds = scopedAssets.filter((asset) => asset.kind === "character").map((asset) => asset.id);
      const sceneAssetIds = scopedAssets.filter((asset) => asset.kind === "scene").map((asset) => asset.id);
      const propAssetIds = scopedAssets.filter((asset) => asset.kind === "prop").map((asset) => asset.id);
      const referenceSourceRefs = scopedAssets.map((asset) => `project.vibe#assets/${asset.id}`);
      return {
        ...shot,
        characterAssetIds: unique([...shot.characterAssetIds, ...characterAssetIds]),
        sceneAssetIds: unique([...shot.sceneAssetIds, ...sceneAssetIds]),
        propAssetIds: unique([...shot.propAssetIds, ...propAssetIds]),
        sourceRefs: unique([...shot.sourceRefs, ...referenceSourceRefs]),
        plannerNotes: {
          ...shot.plannerNotes,
          visualAnchor: scopedAssets.some((asset) => asset.kind === "style")
            ? `${shot.plannerNotes.visualAnchor}+style_ref`
            : shot.plannerNotes.visualAnchor,
        },
      };
    }),
  });
}

function applyDraftReferenceBindings(input: {
  planner: ScriptPlannerResult;
  draft: NewVideoProjectVibeDraftLike;
  draftHash: string;
  project: ProjectVibeDocument;
  generatedAt: string;
}): DraftReferenceBinding {
  const initialAssets = buildReferenceAssets({
    draft: input.draft,
    draftHash: input.draftHash,
    planner: input.planner,
  });
  if (!initialAssets.length) {
    return {
      planner: input.planner,
      referenceAssets: [],
    };
  }
  const referenceHash = stableHashValue(initialAssets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    label: asset.label,
  }))).slice(4, 10);
  const plannerWithRefId = {
    ...input.planner,
    plannerId: `${input.planner.plannerId}_refs_${referenceHash}`,
  };
  const referenceAssets = initialAssets.map((asset) => ({
    ...asset,
    sourceRefs: unique([
      ...asset.sourceRefs.filter((ref) => !ref.startsWith("script_planner:")),
      `script_planner:${plannerWithRefId.plannerId}`,
    ]),
  }));
  const planner = bindReferenceAssetsToPlannerShots(plannerWithRefId, referenceAssets);
  return {
    planner,
    referenceAssets,
    visualMemoryOperation: {
      op: "set_visual_memory",
      visualMemory: visualMemoryWithReferenceAssets({
        project: input.project,
        referenceAssets,
        generatedAt: input.generatedAt,
      }),
    },
  };
}

function buildSourceRefs(input: {
  draftHash: string;
  planner: ScriptPlannerResult;
  directorSession?: BuildNewVideoProjectVibeStagedTransactionInput["directorSession"];
  sourceTurn?: NewVideoProjectVibeSourceTurnRef;
  stagedFactIds: string[];
  discussionDeltaIds?: string[];
  audioReferenceIds?: string[];
}): string[] {
  return unique([
    "project.vibe#manifest",
    "project.vibe#storyFlow",
    `draft:${input.draftHash}`,
    `script_planner:${input.planner.plannerId}`,
    input.directorSession?.sessionId ? `director_session:${input.directorSession.sessionId}` : "",
    input.sourceTurn?.id ? `director_turn:${input.sourceTurn.id}` : "",
    ...input.stagedFactIds.map((id) => `staged_fact:${id}`),
    ...input.planner.shots.flatMap((shot) => shot.sourceRefs.filter((ref) => ref.startsWith("storyboard_table:"))),
    ...(input.discussionDeltaIds || []).map((id) => `discussion_delta:${id}`),
    ...(input.audioReferenceIds || []),
    ...(input.sourceTurn?.sourceRefs || []),
  ]);
}

function confirmedDiscussionDeltas(deltas?: StoryDiscussionDelta[]): StoryDiscussionDelta[] {
  return (deltas || []).filter((delta) => delta.status === "confirmed");
}

function unconfirmedDiscussionDeltaCount(deltas?: StoryDiscussionDelta[]): number {
  return (deltas || []).filter((delta) => delta.status !== "confirmed").length;
}

function buildScriptPlanningReceipt(input: {
  planner: ScriptPlannerResult;
  sourceFactHash: string;
  createdAt: string;
  evidenceRefs: string[];
}): ProjectVibeScriptPlanningReceipt {
  return {
    id: `script_plan_${input.planner.plannerId}`,
    kind: "script_planning",
    createdAt: input.createdAt,
    plannerId: input.planner.plannerId,
    sourceFactHash: input.sourceFactHash,
    sectionIds: input.planner.sections.map((section) => section.id),
    shotIds: input.planner.shots.map((shot) => shot.id),
    blockerCount: input.planner.qaBlockers.filter((blocker) => blocker.severity === "blocker").length,
    evidenceRefs: unique(input.evidenceRefs),
    providerSelfReportUsed: false,
    runtimeFixtureUsed: false,
  };
}

function buildBlockedReasons(input: {
  draft: NewVideoProjectVibeDraftLike;
  planner: ScriptPlannerResult;
  directorSession?: BuildNewVideoProjectVibeStagedTransactionInput["directorSession"];
  discussionDeltas?: StoryDiscussionDelta[];
  project: ProjectVibeDocument;
}): string[] {
  const scriptMissing = !clean(input.draft.script);
  const sessionProjectId = input.directorSession?.projectId;
  const sessionMismatch = sessionProjectId
    && sessionProjectId !== "local_project"
    && sessionProjectId !== input.project.manifest.projectId;
  const unconfirmedDeltas = unconfirmedDiscussionDeltaCount(input.discussionDeltas);
  return unique([
    scriptMissing ? "script_missing" : "",
    sessionMismatch ? "director_session_project_mismatch" : "",
    unconfirmedDeltas ? "discussion_delta_unconfirmed" : "",
    ...input.planner.qaBlockers
      .filter((blocker) => blocker.severity === "blocker")
      .map((blocker) => blocker.id),
  ]);
}

function rejectedPatchResult(input: {
  project: ProjectVibeDocument;
  transaction: ProjectVibeTransaction;
  errors: string[];
  warnings?: string[];
}): ProjectVibePatchResult {
  return {
    project: input.project,
    receipt: {
      transactionId: input.transaction.id,
      status: "rejected",
      actor: input.transaction.actor,
      reason: input.transaction.reason,
      createdAt: input.transaction.createdAt,
      operationCount: input.transaction.operations.length,
      beforeFactHash: hashProjectVibeFacts(input.project),
      projectFactsAuthority: "project_vibe",
      runtimeFixtureUsed: false,
      touched: {
        storyFlow: false,
        visualMemory: false,
        shotIds: [],
        assetIds: [],
        runIds: [],
        receiptIds: [],
      },
      errors: input.errors,
      warnings: input.warnings || [],
    },
  };
}

function commitGuardReasons(input: {
  project: ProjectVibeDocument;
  stagedTransaction: NewVideoProjectVibeStagedTransactionPreview;
}): string[] {
  const staged = input.stagedTransaction;
  const currentFactHash = hashProjectVibeFacts(input.project);
  const operationHash = stableHashValue(staged.transaction.operations);
  const unsupportedOps = staged.transaction.operations.some((operation) => (
    operation.op !== "set_story_flow"
    && operation.op !== "upsert_shot"
    && operation.op !== "upsert_asset"
    && operation.op !== "set_visual_memory"
    && operation.op !== "append_script_planning_receipt"
  ));
  const serializedOperations = JSON.stringify(staged.transaction.operations);
  const executionSemanticsLeaked = /\b(TaskEnvelope|SubagentTaskEnvelope|GenerationJob|providerId|apiKey|toolCalls|submitLive)\b/i.test(serializedOperations);

  return unique([
    staged.projectVibeWriteAllowed !== false ? "staged_preview_write_gate_mismatch" : "",
    staged.projectFactsMutated !== false ? "staged_preview_must_not_mutate_project" : "",
    staged.blocked ? "staged_preview_blocked" : "",
    ...staged.blockedReasons,
    input.project.manifest.projectId !== staged.source.projectId ? "source_project_id_mismatch" : "",
    currentFactHash !== staged.source.beforeFactHash ? "source_project_fact_hash_mismatch" : "",
    staged.source.patchOperationHash !== operationHash ? "staged_patch_operations_hash_mismatch" : "",
    staged.transaction.id !== staged.transactionId ? "staged_transaction_id_mismatch" : "",
    staged.patchOperations !== staged.transaction.operations && stableHashValue(staged.patchOperations) !== operationHash
      ? "staged_patch_operations_mismatch"
      : "",
    staged.transaction.operations.length === 0 ? "no_project_vibe_patch_operations" : "",
    unsupportedOps ? "unsupported_project_vibe_operation_for_new_video" : "",
    executionSemanticsLeaked ? "execution_semantics_forbidden_in_project_vibe_patch" : "",
  ]);
}

export function buildNewVideoProjectVibeStagedTransaction(
  input: BuildNewVideoProjectVibeStagedTransactionInput,
): NewVideoProjectVibeStagedTransactionPreview {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const baseProject = projectReadyForNewStory(input.project);
  const nextDiscussionDeltas = confirmedDiscussionDeltas(input.discussionDeltas);
  const basePlanner = buildScriptPlannerState({
    idea: buildPlannerIdea(input.draft),
    project: baseProject,
    generatedAt,
  });
  const beforeFactHash = hashProjectVibeFacts(input.project);
  const nextDraftHash = draftHash(input.draft);
  const storyboardRows = storyboardDraftUsableRows(input.storyboardDraft);
  const storyboardPlanner = applyStoryboardDraftToPlanner({
    planner: basePlanner,
    storyboardDraft: storyboardRows,
    generatedAt,
  });
  const deltaPlanner = applyConfirmedDiscussionDeltas(storyboardPlanner, nextDiscussionDeltas);
  const referenceBinding = applyDraftReferenceBindings({
    planner: deltaPlanner,
    draft: input.draft,
    draftHash: nextDraftHash,
    project: baseProject,
    generatedAt,
  });
  const planner = referenceBinding.planner;
  const referenceAssets = referenceBinding.referenceAssets;
  const nextPlannerInputHash = plannerInputHash({
    project: input.project,
    draft: input.draft,
    storyboardDraft: storyboardRows,
    discussionDeltas: input.discussionDeltas,
    generatedAt,
  });
  const stagedFactIds = input.directorSession?.stagedFacts.map((fact) => fact.id)
    || fallbackStagedFactIds({ draft: input.draft, planner, draftHash: nextDraftHash });
  const discussionDeltaIds = nextDiscussionDeltas.map((delta) => delta.id);
  const audioReferenceIds = draftAudioReferenceIds(input.draft);
  const sourceTurn = sourceTurnFromSession(input.directorSession);
  const sourceRefs = buildSourceRefs({
    draftHash: nextDraftHash,
    planner,
    directorSession: input.directorSession,
    sourceTurn,
    stagedFactIds,
    discussionDeltaIds,
    audioReferenceIds,
  });
  const referenceSourceRefs = referenceAssets.map((asset) => `project.vibe#assets/${asset.id}`);
  const transactionSourceRefs = unique([...sourceRefs, ...referenceSourceRefs]);
  const planningReceiptOperation: ProjectVibePatchOperation[] = (storyboardRows.length || nextDiscussionDeltas.length || referenceAssets.length || audioReferenceIds.length)
    ? [{
        op: "append_script_planning_receipt",
        receipt: buildScriptPlanningReceipt({
          planner,
          sourceFactHash: beforeFactHash,
          createdAt: generatedAt,
          evidenceRefs: transactionSourceRefs,
        }),
      }]
    : [];
  const referenceAssetOperations: ProjectVibePatchOperation[] = [
    ...referenceAssets.map((asset) => ({ op: "upsert_asset" as const, asset })),
    ...(referenceBinding.visualMemoryOperation ? [referenceBinding.visualMemoryOperation] : []),
  ];
  const operations = [
    ...planner.projectVibePatchOperations,
    ...referenceAssetOperations,
    ...planningReceiptOperation,
  ];
  const transactionId = `txn_new_video_staged_${planner.plannerId}`;
  const transaction: ProjectVibeTransaction = {
    id: transactionId,
    actor: "user",
    reason: "Commit confirmed new video draft into Project.vibe Story Flow.",
    createdAt: generatedAt,
    operations,
  };
  const blockedReasons = buildBlockedReasons({
    draft: input.draft,
    planner,
    directorSession: input.directorSession,
    discussionDeltas: input.discussionDeltas,
    project: input.project,
  });

  return {
    kind: "new_video_project_vibe_staged_transaction_preview",
    schemaVersion: "0.1.0",
    transactionId,
    generatedAt,
    projectVibeWriteAllowed: false,
    projectFactsMutated: false,
    transaction,
    patchOperations: operations,
    planner,
    stagedFactIds,
    source: {
      projectId: input.project.manifest.projectId,
      beforeFactHash,
      draftHash: nextDraftHash,
      plannerInputHash: nextPlannerInputHash,
      patchOperationHash: stableHashValue(operations),
      directorSessionId: input.directorSession?.sessionId,
      sourceTurnId: sourceTurn?.id,
      discussionDeltaIds,
      sourceRefs: transactionSourceRefs,
    },
    sourceTurn,
    summary: {
      title: planner.script_brief.title,
      sectionCount: planner.sections.length,
      shotCount: planner.shots.length,
      referenceAssetCount: referenceAssets.length,
      audioReferenceCount: audioReferenceIds.length,
      musicReferenceCount: input.draft.audioRole === "music_reference" && input.draft.audio ? 1 : 0,
      patchOperationCount: operations.length,
      selectedShotId: planner.shots[0]?.id,
      stagedFactCount: stagedFactIds.length,
      discussionDeltaCount: discussionDeltaIds.length,
      blockerCount: blockedReasons.length,
    },
    blocked: blockedReasons.length > 0,
    blockedReasons,
    selectedShotId: planner.shots[0]?.id,
  };
}

export function commitNewVideoProjectVibeStagedTransaction(
  input: CommitNewVideoProjectVibeStagedTransactionInput,
): NewVideoProjectVibeStagedTransactionCommitResult {
  const staged = input.stagedTransaction;
  const guardReasons = commitGuardReasons(input);
  if (guardReasons.length) {
    const patch = rejectedPatchResult({
      project: input.project,
      transaction: staged.transaction,
      errors: guardReasons,
    });
    return {
      status: "rejected",
      project: input.project,
      planner: staged.planner,
      patch,
      selectedShotId: staged.selectedShotId,
      blockedReasons: guardReasons,
    };
  }

  const patch = applyProjectVibeTransaction(projectReadyForNewStory(input.project), staged.transaction);
  return {
    status: patch.receipt.status,
    project: patch.project,
    planner: staged.planner,
    patch,
    selectedShotId: staged.selectedShotId,
    blockedReasons: patch.receipt.status === "applied" ? [] : patch.receipt.errors,
  };
}

export function planNewVideoDraftIntoProjectVibe(input: {
  project: ProjectVibeDocument;
  draft: NewVideoProjectVibeDraftLike;
  generatedAt?: string;
}): NewVideoProjectVibePlanResult {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const stagedTransaction = buildNewVideoProjectVibeStagedTransaction({
    project: input.project,
    draft: input.draft,
    generatedAt,
  });
  const committed = commitNewVideoProjectVibeStagedTransaction({
    project: input.project,
    stagedTransaction,
  });

  return {
    project: committed.project,
    planner: committed.planner,
    patch: committed.patch,
    selectedShotId: committed.selectedShotId,
  };
}
