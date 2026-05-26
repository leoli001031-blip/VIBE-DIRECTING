import type { IntakeReferenceAsset, IntakeReferenceAssetType, IntakeStagedPlanProjection, ProjectIntakeDraft } from "./projectIntakeDraft";

export const directorSessionSchemaVersion = "0.1.0";

export type DirectorStageId =
  | "script_intake"
  | "script_breakdown"
  | "reference_binding"
  | "asset_planning"
  | "frame_review"
  | "video_preview";

export type DirectorStageStatus = "active" | "ready" | "waiting" | "blocked";
export type DirectorConversationRole = "user" | "agent" | "system";
export type DirectorConversationScope = "project" | "script" | "asset" | "shot" | "preview";
export type DirectorStagedFactKind =
  | "script_brief"
  | "visual_style"
  | "character_candidate"
  | "scene_candidate"
  | "prop_candidate"
  | "style_reference"
  | "image_reference"
  | "audio_need"
  | "reference_binding"
  | "shot_draft";

export interface DirectorSessionStage {
  id: DirectorStageId;
  label: string;
  status: DirectorStageStatus;
  summary: string;
}

export interface DirectorConversationTurn {
  id: string;
  role: DirectorConversationRole;
  scope: DirectorConversationScope;
  createdAt: string;
  text: string;
  attachmentRefs: string[];
  sourceRefs: string[];
  rawTextMayBecomeProjectFact: false;
}

export interface DirectorStagedFact {
  id: string;
  kind: DirectorStagedFactKind;
  label: string;
  status: "staged" | "blocked";
  summary: string;
  sourceTurnId: string;
  sourceAssetIds: string[];
  needsUserConfirmation: true;
  canWriteProjectFactNow: false;
}

export interface DirectorSessionState {
  schemaVersion: typeof directorSessionSchemaVersion;
  sessionId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  currentStage: DirectorStageId;
  stages: DirectorSessionStage[];
  turns: DirectorConversationTurn[];
  stagedFacts: DirectorStagedFact[];
  nextQuestions: string[];
  workspace: {
    scriptReady: boolean;
    visualReferenceCount: number;
    audioReferenceCount: number;
    stageLabel: string;
    nextActionLabel: string;
  };
  hardLocks: {
    rawTextIsConversationOnly: true;
    stagedFactsRequireUserConfirmation: true;
    projectFactWriteAllowed: false;
    providerSubmitAllowed: false;
    remoteGenerationAllowed: false;
    formalTaskCreationAllowed: false;
  };
}

export interface DirectorSessionValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface BuildDirectorSessionFromIntakeInput {
  draft: ProjectIntakeDraft;
  projection: IntakeStagedPlanProjection;
  projectId?: string;
  createdAt?: string;
  sessionId?: string;
}

function nowTimestamp(): string {
  return new Date().toISOString();
}

const hardLocks: DirectorSessionState["hardLocks"] = {
  rawTextIsConversationOnly: true,
  stagedFactsRequireUserConfirmation: true,
  projectFactWriteAllowed: false,
  providerSubmitAllowed: false,
  remoteGenerationAllowed: false,
  formalTaskCreationAllowed: false,
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export interface TimecodedStoryboardBeat {
  index: number;
  startLabel: string;
  endLabel: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  title: string;
  body: string;
  text: string;
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 54) || "director_session";
}

function visualReferenceCount(assets: IntakeReferenceAsset[]): number {
  return assets.filter((asset) => asset.type !== "audio").length;
}

function countByType(assets: IntakeReferenceAsset[], type: IntakeReferenceAssetType): number {
  return assets.filter((asset) => asset.type === type).length;
}

function stagedKindForAsset(type: IntakeReferenceAssetType): DirectorStagedFactKind {
  if (type === "audio") return "audio_need";
  if (type === "character") return "character_candidate";
  if (type === "scene") return "scene_candidate";
  if (type === "prop") return "prop_candidate";
  if (type === "style") return "style_reference";
  return "image_reference";
}

function bindingTarget(asset: IntakeReferenceAsset): string {
  const binding = asset.binding;
  return clean(binding?.role)
    || clean(binding?.character)
    || clean(binding?.scene)
    || clean(binding?.prop)
    || clean(binding?.style);
}

function bindingKindLabel(asset: IntakeReferenceAsset): string {
  const binding = asset.binding;
  const kind = clean(binding?.kind) || (
    clean(binding?.role) || clean(binding?.character)
      ? "character"
      : clean(binding?.scene)
        ? "scene"
        : clean(binding?.prop)
          ? "prop"
          : clean(binding?.style)
            ? "style"
            : asset.type
  );
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "style") return "风格";
  return asset.type === "audio" ? "音频" : "参考图";
}

function bindingScopeLabel(asset: IntakeReferenceAsset): string {
  const shotIds = asset.binding?.shotIds || [];
  if (shotIds.length) return `镜头 ${shotIds.join("、")}`;
  const scope = clean(asset.binding?.scope);
  if (!scope) return "范围待确认";
  if (/^(project|global|all|all_shots)$/i.test(scope)) return "整片";
  if (/^(first|first_shot)$/i.test(scope)) return "第一个镜头";
  if (/^(last|last_shot|final)$/i.test(scope)) return "最后一个镜头";
  if (/^(none|asset_only)$/i.test(scope)) return "仅候选资产";
  return scope;
}

function bindingFactLabel(asset: IntakeReferenceAsset): string {
  const target = bindingTarget(asset);
  if (!asset.binding || (!target && !(asset.binding.shotIds || []).length && !clean(asset.binding.scope))) {
    return `${asset.label} 的用途`;
  }
  const kind = bindingKindLabel(asset);
  const scope = bindingScopeLabel(asset);
  return target ? `${asset.label} -> ${kind}：${target} · ${scope}` : `${asset.label} -> ${kind} · ${scope}`;
}

function bindingFactSummary(asset: IntakeReferenceAsset): string {
  if (!asset.binding) return "参考图先作为候选绑定，确认角色、场景或风格用途后才能进入项目事实。";
  const target = bindingTarget(asset);
  const kind = bindingKindLabel(asset);
  const scope = bindingScopeLabel(asset);
  return target
    ? `参考图已标注为${kind}「${target}」，范围：${scope}；确认后再写入 Project.vibe。`
    : `参考图已标注为${kind}，范围：${scope}；确认后再写入 Project.vibe。`;
}

function compactPreview(value: string, maxLength = 120): string {
  const normalized = clean(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function inferProtagonist(scriptText: string): string | undefined {
  const match = scriptText.match(/(?:一个|一位|这位|那个)?([\p{Script=Han}A-Za-z0-9]{0,10}(?:女孩|男孩|女人|男人|老人|孩子|母亲|父亲|女儿|儿子|摄影师|画家|学生|店员|导演|护士|医生|程序员|少女|少年|骑手|车手|外卖员|放映员))/u);
  return clean(match?.[1]) || undefined;
}

function inferScenes(scriptText: string): string[] {
  const candidates: Array<[RegExp, string]> = [
    [/雨夜|街灯|街角|巷口|路边/u, "雨夜街边"],
    [/楼下|旧楼|公寓|楼道/u, "旧楼楼下"],
    [/暗房|冲洗|相片/u, "暗房"],
    [/车站|地铁|站台/u, "车站"],
    [/电影院|影院|放映室|银幕/u, "老电影院"],
    [/山路|弯道|发卡弯|护栏/u, "山路"],
    [/停车场|山顶/u, "停车场"],
    [/车内|驾驶舱|方向盘|仪表/u, "车内"],
    [/房间|卧室|客厅/u, "室内房间"],
    [/便利店/u, "便利店"],
  ];
  return Array.from(new Set(candidates.filter(([pattern]) => pattern.test(scriptText)).map(([, label]) => label))).slice(0, 3);
}

function inferProps(scriptText: string): string[] {
  const candidates: Array<[RegExp, string]> = [
    [/相机/u, "旧相机"],
    [/放映机/u, "老放映机"],
    [/胶片/u, "胶片"],
    [/热可可/u, "热可可"],
    [/录音|磁带|音频/u, "录音材料"],
    [/SU7|Xiaomi|小米/u, "Xiaomi SU7 Ultra"],
    [/Porsche|GT3|保时捷|911/i, "Porsche 911 GT3"],
    [/照片|相片/u, "照片"],
    [/钥匙/u, "钥匙"],
    [/手机/u, "手机"],
    [/伞/u, "雨伞"],
    [/信|纸条/u, "信件"],
  ];
  return Array.from(new Set(candidates.filter(([pattern]) => pattern.test(scriptText)).map(([, label]) => label))).slice(0, 4);
}

function parseTimestampSeconds(value: string): number | undefined {
  const cleaned = value.replace(/[,.]\d+$/u, "");
  const parts = cleaned.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return undefined;
}

function normalizeScriptLine(line: string): string {
  return clean(line.replace(/^[•*-]\s*/u, ""));
}

function isTimecodeLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d+)?)\s*(?:-|–|—|~|至|到|-->)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d+)?)\s*$/u);
}

export function extractTimecodedStoryboardBeats(scriptText: string): TimecodedStoryboardBeat[] {
  const normalized = scriptText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  const chunks: Array<{
    startLabel: string;
    endLabel: string;
    startSeconds: number;
    endSeconds: number;
    lines: string[];
  }> = [];
  let current: (typeof chunks)[number] | undefined;

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    const match = isTimecodeLine(line);
    if (match) {
      if (current) chunks.push(current);
      const startSeconds = parseTimestampSeconds(match[1]!) ?? 0;
      const endSeconds = parseTimestampSeconds(match[2]!) ?? startSeconds;
      current = {
        startLabel: match[1]!,
        endLabel: match[2]!,
        startSeconds,
        endSeconds,
        lines: [],
      };
      continue;
    }
    if (current && line) current.lines.push(normalizeScriptLine(line));
  }
  if (current) chunks.push(current);

  return chunks
    .map((chunk, index): TimecodedStoryboardBeat | undefined => {
      const lines = chunk.lines.map(normalizeScriptLine).filter(Boolean);
      if (!lines.length) return undefined;
      const title = lines[0]!;
      const bodyLines = lines.slice(1);
      const body = bodyLines.join("\n");
      const durationSeconds = Math.max(0, Math.round((chunk.endSeconds - chunk.startSeconds) * 100) / 100);
      return {
        index,
        startLabel: chunk.startLabel,
        endLabel: chunk.endLabel,
        startSeconds: chunk.startSeconds,
        endSeconds: chunk.endSeconds,
        durationSeconds,
        title,
        body,
        text: [
          `${chunk.startLabel} - ${chunk.endLabel}`,
          title,
          body,
        ].filter(Boolean).join("\n"),
      };
    })
    .filter((beat): beat is TimecodedStoryboardBeat => Boolean(beat && beat.durationSeconds > 0));
}

export function splitScriptIntoStoryboardBeats(scriptText: string): string[] {
  const normalized = scriptText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const timecodedBeats = extractTimecodedStoryboardBeats(normalized);
  if (timecodedBeats.length) return timecodedBeats.map((beat) => beat.text);
  const withoutMarkdown = normalized
    .split(/\n/u)
    .map((line) => line.replace(/^#{1,6}\s+/u, "").replace(/^[-*+]\s+/u, "").trim())
    .filter(Boolean)
    .join("\n");
  const withHardBreaks = withoutMarkdown
    .replace(/[。.!?！？；;]+/gu, "\n")
    .replace(/([，,\n]\s*)(?=(?:然后|随后|接着|再切|切近景|切特写|镜头转向|突然|最后)(?:[^，,。.!?！？；;\n]{2,}|[，,。.!?！？；;\n]))/gu, "\n");
  const segments = withHardBreaks
    .split(/\n+/u)
    .map((part) => clean(part.replace(/^[，,\s]+|[，,\s]+$/gu, "")))
    .filter(Boolean);
  if (segments.length > 1) return segments.slice(0, 10);
  return withoutMarkdown.split(/\n+/u).map(clean).filter(Boolean).slice(0, 10);
}

function inferShotDrafts(scriptText: string): string[] {
  const beats = splitScriptIntoStoryboardBeats(scriptText);
  if (!beats.length) return [];
  return beats.map((beat, index) => `镜头 ${index + 1}：${compactPreview(beat, 52)}`);
}

function factId(draftId: string, kind: DirectorStagedFactKind, seed: string, index?: number): string {
  return `${draftId}_${kind}_${safeId(seed)}${index == null ? "" : `_${index + 1}`}`;
}

function makeStagedFact(input: {
  id: string;
  kind: DirectorStagedFactKind;
  label: string;
  summary: string;
  sourceTurnId: string;
  sourceAssetIds?: string[];
  status?: "staged" | "blocked";
}): DirectorStagedFact {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    status: input.status || "staged",
    summary: input.summary,
    sourceTurnId: input.sourceTurnId,
    sourceAssetIds: input.sourceAssetIds || [],
    needsUserConfirmation: true,
    canWriteProjectFactNow: false,
  };
}

function stageStatus(stage: DirectorStageId, currentStage: DirectorStageId, blocked = false): DirectorStageStatus {
  if (blocked) return "blocked";
  if (stage === currentStage) return "active";
  const order: DirectorStageId[] = [
    "script_intake",
    "script_breakdown",
    "reference_binding",
    "asset_planning",
    "frame_review",
    "video_preview",
  ];
  return order.indexOf(stage) < order.indexOf(currentStage) ? "ready" : "waiting";
}

function currentStageFor(input: BuildDirectorSessionFromIntakeInput): DirectorStageId {
  if (!input.draft.scriptText.trim()) return "script_intake";
  if (!input.draft.referenceAssets.length) return "script_breakdown";
  return "reference_binding";
}

function buildStages(input: BuildDirectorSessionFromIntakeInput, currentStage: DirectorStageId): DirectorSessionStage[] {
  const requiredMissing = input.projection.missingChecklist.some((item) => item.severity === "required");
  return [
    {
      id: "script_intake",
      label: "整理脚本",
      status: stageStatus("script_intake", currentStage, requiredMissing),
      summary: input.draft.scriptText ? "脚本已放入工作区。" : "先放入脚本。",
    },
    {
      id: "script_breakdown",
      label: "拆出分镜",
      status: stageStatus("script_breakdown", currentStage),
      summary: input.draft.scriptText ? "可以整理段落和镜头草案。" : "等待脚本。",
    },
    {
      id: "reference_binding",
      label: "绑定参考",
      status: stageStatus("reference_binding", currentStage),
      summary: input.draft.referenceAssets.length
        ? `已放入 ${input.draft.referenceAssets.length} 个素材。`
        : "参考图和音频可以稍后补。",
    },
    {
      id: "asset_planning",
      label: "准备资产",
      status: stageStatus("asset_planning", currentStage),
      summary: "角色、场景和音源先进入候选。",
    },
    {
      id: "frame_review",
      label: "复核画面",
      status: stageStatus("frame_review", currentStage),
      summary: "生成图会先等待复核。",
    },
    {
      id: "video_preview",
      label: "预览成片",
      status: stageStatus("video_preview", currentStage),
      summary: "先做预览和导出。",
    },
  ];
}

function stagedFactsFor(input: BuildDirectorSessionFromIntakeInput, sourceTurnId: string): DirectorStagedFact[] {
  const facts: DirectorStagedFact[] = [];
  const scriptText = input.draft.scriptText.trim();

  if (scriptText) {
    facts.push(makeStagedFact({
      id: `${input.draft.draftId}_script_brief`,
      kind: "script_brief",
      label: input.projection.summary.title,
      summary: input.projection.summary.scriptPreview,
      sourceTurnId,
    }));

    const protagonist = inferProtagonist(scriptText);
    if (protagonist) {
      facts.push(makeStagedFact({
        id: factId(input.draft.draftId, "character_candidate", protagonist),
        kind: "character_candidate",
        label: protagonist,
        summary: "从脚本中识别出的角色候选，确认后再写入项目资产。",
        sourceTurnId,
      }));
    }

    inferScenes(scriptText).forEach((scene, index) => {
      facts.push(makeStagedFact({
        id: factId(input.draft.draftId, "scene_candidate", scene, index),
        kind: "scene_candidate",
        label: scene,
        summary: "从脚本中识别出的场景候选，确认后再绑定参考图或场景 master。",
        sourceTurnId,
      }));
    });

    inferProps(scriptText).forEach((prop, index) => {
      facts.push(makeStagedFact({
        id: factId(input.draft.draftId, "prop_candidate", prop, index),
        kind: "prop_candidate",
        label: prop,
        summary: "从脚本中识别出的道具候选，确认后再决定是否进入资产库。",
        sourceTurnId,
      }));
    });

    inferShotDrafts(scriptText).forEach((shot, index) => {
      facts.push(makeStagedFact({
        id: factId(input.draft.draftId, "shot_draft", shot, index),
        kind: "shot_draft",
        label: `镜头草案 ${index + 1}`,
        summary: shot,
        sourceTurnId,
      }));
    });
  }

  if (/录音|声音|旁白|对白|配音|音色|audio|voice/i.test(scriptText)) {
    facts.push(makeStagedFact({
      id: factId(input.draft.draftId, "audio_need", "script_audio_need"),
      kind: "audio_need",
      label: "音频需求",
      summary: "脚本里出现声音或配音线索，需要后续确认音源、授权和用途。",
      sourceTurnId,
    }));
  }

  if (input.draft.styleNote.trim()) {
    facts.push(makeStagedFact({
      id: `${input.draft.draftId}_visual_style`,
      kind: "visual_style",
      label: "风格方向",
      summary: input.draft.styleNote,
      sourceTurnId,
    }));
  }

  for (const [index, asset] of input.draft.referenceAssets.entries()) {
    const target = bindingTarget(asset);
    const assetLabel = target ? `${asset.label} -> ${bindingKindLabel(asset)}：${target}` : asset.label;
    facts.push(makeStagedFact({
      id: `${input.draft.draftId}_${safeId(asset.id)}`,
      kind: stagedKindForAsset(asset.type),
      label: assetLabel,
      summary: asset.note || "已放入工作区，等待确认用途。",
      sourceTurnId,
      sourceAssetIds: [asset.id],
    }));
    if (asset.type !== "audio") {
      facts.push(makeStagedFact({
        id: factId(input.draft.draftId, "reference_binding", asset.id, index),
        kind: "reference_binding",
        label: bindingFactLabel(asset),
        summary: bindingFactSummary(asset),
        sourceTurnId,
        sourceAssetIds: [asset.id],
      }));
    }
  }

  return facts;
}

function nextQuestionsFor(input: BuildDirectorSessionFromIntakeInput): string[] {
  const questions = input.projection.missingChecklist
    .filter((item) => item.severity === "recommended")
    .map((item) => item.label);
  return questions.slice(0, 3);
}

export function buildDirectorSessionFromIntake(input: BuildDirectorSessionFromIntakeInput): DirectorSessionState {
  const createdAt = input.createdAt || input.draft.createdAt || nowTimestamp();
  const projectId = clean(input.projectId) || "local_project";
  const sourceTurnId = `${input.draft.draftId}_turn_user_intake`;
  const currentStage = currentStageFor(input);
  const turns: DirectorConversationTurn[] = [
    {
      id: sourceTurnId,
      role: "user",
      scope: "script",
      createdAt,
      text: input.draft.scriptText || "新视频草案",
      attachmentRefs: input.draft.referenceAssets.map((asset) => asset.id),
      sourceRefs: [`intake:${input.draft.draftId}`],
      rawTextMayBecomeProjectFact: false,
    },
    {
      id: `${input.draft.draftId}_turn_agent_summary`,
      role: "agent",
      scope: "project",
      createdAt,
      text: input.projection.summary.title,
      attachmentRefs: [],
      sourceRefs: [`projection:${input.projection.draftId}`],
      rawTextMayBecomeProjectFact: false,
    },
  ];

  return {
    schemaVersion: directorSessionSchemaVersion,
    sessionId: input.sessionId || `session_${safeId(`${projectId}_${input.draft.draftId}`)}`,
    projectId,
    createdAt,
    updatedAt: createdAt,
    currentStage,
    stages: buildStages(input, currentStage),
    turns,
    stagedFacts: stagedFactsFor(input, sourceTurnId),
    nextQuestions: nextQuestionsFor(input),
    workspace: {
      scriptReady: Boolean(input.draft.scriptText.trim()),
      visualReferenceCount: visualReferenceCount(input.draft.referenceAssets),
      audioReferenceCount: countByType(input.draft.referenceAssets, "audio"),
      stageLabel: buildStages(input, currentStage).find((stage) => stage.id === currentStage)?.label || "整理脚本",
      nextActionLabel: input.projection.missingChecklist.some((item) => item.severity === "required") ? "补充脚本" : "确认草案",
    },
    hardLocks,
  };
}

export function validateDirectorSessionState(session: DirectorSessionState): DirectorSessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (session.schemaVersion !== directorSessionSchemaVersion) errors.push("Director session schema version drifted.");
  if (!session.sessionId.trim()) errors.push("Director session id is required.");
  if (!session.stages.some((stage) => stage.id === session.currentStage)) errors.push("Current stage must exist in stages.");
  if (!session.hardLocks.rawTextIsConversationOnly) errors.push("Raw text must stay conversation-only.");
  if (session.hardLocks.projectFactWriteAllowed) errors.push("Director session cannot write project facts directly.");
  if (session.hardLocks.formalTaskCreationAllowed) errors.push("Director session cannot create formal tasks directly.");
  if (session.hardLocks.providerSubmitAllowed) errors.push("Director session cannot submit providers directly.");
  if (session.hardLocks.remoteGenerationAllowed) errors.push("Director session cannot start remote generation directly.");
  if (session.turns.some((turn) => turn.rawTextMayBecomeProjectFact !== false)) {
    errors.push("Conversation turns must not become project facts directly.");
  }
  if (session.stagedFacts.some((fact) => !fact.needsUserConfirmation || fact.canWriteProjectFactNow)) {
    errors.push("Staged facts must require confirmation before project writes.");
  }
  if (!session.stagedFacts.length) warnings.push("Session has no staged facts yet.");
  const shotDraftCount = session.stagedFacts.filter((fact) => fact.kind === "shot_draft").length;
  if (shotDraftCount >= 10) warnings.push("Script segments reached the hard limit of 10; additional segments beyond the limit were silently dropped.");
  return { ok: errors.length === 0, errors, warnings };
}
