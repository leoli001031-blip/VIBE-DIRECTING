import type { DirectorSessionState, DirectorStagedFact } from "./directorSession";

export const storyDiscussionWorkspaceSchemaVersion = "0.1.0";

export type StoryDiscussionLaneId = "characters" | "scenes" | "audio" | "storyboard";
export type StoryDiscussionLaneStatus = "ready" | "needs_reference" | "needs_decision" | "waiting";
export type StoryDiscussionTurnFocus = "character" | "scene" | "audio" | "storyboard" | "general";
export type StoryDiscussionDeltaKind =
  | "character_multiview_request"
  | "character_reference_binding"
  | "scene_reference_binding"
  | "audio_clone_source"
  | "audio_usage_note"
  | "storyboard_timing_adjustment"
  | "storyboard_style_revision"
  | "storyboard_split_preference"
  | "storyboard_reference_preference"
  | "storyboard_order_change"
  | "storyboard_add_remove"
  | "general_note";

export type StoryDiscussionRevisionAxis = "rhythm" | "style" | "split" | "reference_preference";

export interface StoryDiscussionRevisionSummary {
  axes: StoryDiscussionRevisionAxis[];
  requestedRhythmProfile?: "anime_emotion" | "action_fast_cut" | "quiet_dialogue" | "commercial_short" | "lyrical_observation";
  requestedSplitPolicy?: "more_micro_shots" | "fewer_holds" | "hold_less";
  referencePreference?: string;
  avoidStyle?: string[];
  reason: string;
  affectedShotHint: string;
  confirmationCopy: string;
  projectFactWriteBlocked: true;
}

export interface StoryDiscussionItem {
  id: string;
  label: string;
  summary: string;
  status: StoryDiscussionLaneStatus;
  sourceFactIds: string[];
  sourceAssetIds: string[];
}

export interface StoryDiscussionLane {
  id: StoryDiscussionLaneId;
  label: string;
  status: StoryDiscussionLaneStatus;
  count: number;
  items: StoryDiscussionItem[];
  nextQuestion: string;
}

export interface StoryDiscussionTurn {
  id: string;
  role: "user" | "director";
  focus: StoryDiscussionTurnFocus;
  createdAt: string;
  text: string;
  sourceRefs: string[];
  rawTextMayBecomeProjectFact: false;
}

export interface StoryDiscussionDelta {
  id: string;
  kind: StoryDiscussionDeltaKind;
  laneId: StoryDiscussionLaneId;
  label: string;
  summary: string;
  status: "staged" | "confirmed";
  createdAt: string;
  confirmedAt?: string;
  sourceTurnId: string;
  sourceRefs: string[];
  sourceFactIds: string[];
  targetItemIds: string[];
  revisionSummary?: StoryDiscussionRevisionSummary;
  needsUserConfirmation: true;
  canWriteProjectFactNow: false;
}

export interface StoryDiscussionWorkspace {
  schemaVersion: typeof storyDiscussionWorkspaceSchemaVersion;
  workspaceId: string;
  sessionId: string;
  projectId: string;
  draftTitle: string;
  status: "ready_for_discussion" | "needs_script";
  lanes: StoryDiscussionLane[];
  turns: StoryDiscussionTurn[];
  stagedDeltas: StoryDiscussionDelta[];
  nextActionLabel: string;
  hardLocks: {
    userFeedbackIsConversationOnly: true;
    stagedFactsRequireConfirmation: true;
    projectFactWriteAllowed: false;
    remoteGenerationAllowed: false;
    formalTaskCreationAllowed: false;
  };
}

export interface StoryDiscussionWorkspaceValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface BuildStoryDiscussionWorkspaceInput {
  session: DirectorSessionState;
  createdAt?: string;
}

export interface StageStoryDiscussionTurnInput {
  workspace: StoryDiscussionWorkspace;
  text: string;
  createdAt?: string;
}

export interface ConfirmStoryDiscussionDeltasInput {
  workspace: StoryDiscussionWorkspace;
  createdAt?: string;
}

const deterministicTimestamp = "1970-01-01T00:00:00.000Z"; // Fallback for missing createdAt; real timestamps are always preferred via input.createdAt ||

const hardLocks: StoryDiscussionWorkspace["hardLocks"] = {
  userFeedbackIsConversationOnly: true,
  stagedFactsRequireConfirmation: true,
  projectFactWriteAllowed: false,
  remoteGenerationAllowed: false,
  formalTaskCreationAllowed: false,
};

const laneLabels: Record<StoryDiscussionLaneId, string> = {
  characters: "角色",
  scenes: "场景",
  audio: "音频",
  storyboard: "分镜",
};

const emptyQuestions: Record<StoryDiscussionLaneId, string> = {
  characters: "主角是谁？有没有参考图？",
  scenes: "主要发生在哪些地方？",
  audio: "有没有旁白、对白或音色参考？",
  storyboard: "先把脚本拆成几个镜头。",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56) || "discussion";
}

function laneIdForFact(fact: DirectorStagedFact): StoryDiscussionLaneId | undefined {
  if (fact.kind === "character_candidate") return "characters";
  if (fact.kind === "scene_candidate" || fact.kind === "prop_candidate") return "scenes";
  if (fact.kind === "audio_need") return "audio";
  if (fact.kind === "shot_draft" || fact.kind === "script_brief" || fact.kind === "visual_style") return "storyboard";
  if (fact.kind === "reference_binding" || fact.kind === "style_reference" || fact.kind === "image_reference") return undefined;
  return undefined;
}

function statusForFact(laneId: StoryDiscussionLaneId, fact: DirectorStagedFact): StoryDiscussionLaneStatus {
  if (fact.status === "blocked") return "needs_decision";
  if (laneId === "characters" || laneId === "scenes") return fact.sourceAssetIds.length ? "ready" : "needs_reference";
  if (laneId === "audio") return fact.sourceAssetIds.length ? "ready" : "needs_reference";
  return "ready";
}

function strongestStatus(statuses: StoryDiscussionLaneStatus[]): StoryDiscussionLaneStatus {
  if (!statuses.length) return "waiting";
  if (statuses.includes("needs_decision")) return "needs_decision";
  if (statuses.includes("needs_reference")) return "needs_reference";
  if (statuses.includes("ready")) return "ready";
  return "waiting";
}

function statusQuestion(laneId: StoryDiscussionLaneId, status: StoryDiscussionLaneStatus, count: number): string {
  if (!count) return emptyQuestions[laneId];
  if (status === "needs_reference") {
    if (laneId === "audio") return "先确认音频用途，后面可以接 TTS 或音色克隆。";
    if (laneId === "characters") return "角色候选已识别，下一步绑定主角参考图。";
    return "场景候选已识别，下一步绑定场景参考。";
  }
  if (status === "needs_decision") return "这里还需要你确认方向。";
  if (laneId === "storyboard") return "分镜草案已准备，可以继续说要删、加或调整节奏。";
  return "这部分已经可以进入草案确认。";
}

function buildLane(laneId: StoryDiscussionLaneId, facts: DirectorStagedFact[]): StoryDiscussionLane {
  const items = facts
    .map<StoryDiscussionItem>((fact) => ({
      id: `${laneId}_${fact.id}`,
      label: fact.label,
      summary: fact.summary,
      status: statusForFact(laneId, fact),
      sourceFactIds: [fact.id],
      sourceAssetIds: fact.sourceAssetIds,
    }))
    .slice(0, 6);
  const itemStatuses = items.map((item) => item.status);
  const status = laneId === "audio" && itemStatuses.includes("ready")
    ? "ready"
    : strongestStatus(itemStatuses);
  return {
    id: laneId,
    label: laneLabels[laneId],
    status,
    count: items.length,
    items,
    nextQuestion: statusQuestion(laneId, status, items.length),
  };
}

function inferFocus(text: string): StoryDiscussionTurnFocus {
  const normalized = clean(text);
  if (/角色|人物|主角|多视角|reference|character/i.test(normalized)) return "character";
  if (/场景|地点|空间|环境|scene|location/i.test(normalized)) return "scene";
  if (/音频|旁白|对白|配音|音色|克隆|tts|audio|voice/i.test(normalized)) return "audio";
  if (/镜头|分镜|节奏|删|加|顺序|shot|storyboard|cut/i.test(normalized)) return "storyboard";
  return "general";
}

function focusLabel(focus: StoryDiscussionTurnFocus): string {
  if (focus === "character") return "角色";
  if (focus === "scene") return "场景";
  if (focus === "audio") return "音频";
  if (focus === "storyboard") return "分镜";
  return "草案";
}

function responseForFocus(focus: StoryDiscussionTurnFocus): string {
  if (focus === "character") return "我先把这条反馈挂到角色整理里，下一步会检查主角参考和多视角需求。";
  if (focus === "scene") return "我先把这条反馈挂到场景整理里，下一步会看哪些场景需要参考图或 master。";
  if (focus === "audio") return "我先把这条反馈挂到音频整理里，后面可以接旁白、TTS 或音色参考。";
  if (focus === "storyboard") return "我先把这条反馈挂到分镜整理里，下一步可以调整镜头顺序和节奏。";
  return "我先把这条反馈放进草案讨论里，等你确认后再进入故事流。";
}

function laneForFocus(focus: StoryDiscussionTurnFocus): StoryDiscussionLaneId {
  if (focus === "character") return "characters";
  if (focus === "scene") return "scenes";
  if (focus === "audio") return "audio";
  if (focus === "storyboard") return "storyboard";
  return "storyboard";
}

function nextActionForLanes(lanes: StoryDiscussionLane[]): string {
  const waiting = lanes.find((lane) => lane.status === "waiting");
  if (waiting) return `先补${waiting.label}`;
  const needsReference = lanes.find((lane) => lane.status === "needs_reference");
  if (needsReference) return `绑定${needsReference.label}`;
  const needsDecision = lanes.find((lane) => lane.status === "needs_decision");
  if (needsDecision) return `确认${needsDecision.label}`;
  return "确认草案";
}

function targetItemsForLane(workspace: StoryDiscussionWorkspace, laneId: StoryDiscussionLaneId): StoryDiscussionItem[] {
  return workspace.lanes.find((lane) => lane.id === laneId)?.items || [];
}

function makeDelta(input: {
  workspace: StoryDiscussionWorkspace;
  turn: StoryDiscussionTurn;
  kind: StoryDiscussionDeltaKind;
  laneId: StoryDiscussionLaneId;
  label: string;
  summary: string;
  targetItems?: StoryDiscussionItem[];
  revisionSummary?: StoryDiscussionRevisionSummary;
}): StoryDiscussionDelta {
  const targetItems = input.targetItems || targetItemsForLane(input.workspace, input.laneId);
  return {
    id: `${input.turn.id}_delta_${input.kind}_${safeId(input.label)}`,
    kind: input.kind,
    laneId: input.laneId,
    label: input.label,
    summary: input.summary,
    status: "staged",
    createdAt: input.turn.createdAt,
    sourceTurnId: input.turn.id,
    sourceRefs: [input.turn.id],
    sourceFactIds: Array.from(new Set(targetItems.flatMap((item) => item.sourceFactIds))).slice(0, 8),
    targetItemIds: targetItems.map((item) => item.id).slice(0, 8),
    revisionSummary: input.revisionSummary,
    needsUserConfirmation: true,
    canWriteProjectFactNow: false,
  };
}

function affectedShotHint(text: string): string {
  if (/第\s*(?:一|1)|开头|开始|first/i.test(text)) return "开头镜头";
  if (/第\s*(?:二|2)|second/i.test(text)) return "第二个镜头";
  if (/第\s*(?:三|3)|third/i.test(text)) return "第三个镜头";
  if (/最后|结尾|末尾|last|final/i.test(text)) return "结尾镜头";
  if (/这段|动作|节奏|镜头|分镜|shot|storyboard|cut/i.test(text)) return "当前分镜段落";
  return "相关分镜";
}

function directorRevisionForTurn(text: string): StoryDiscussionRevisionSummary | undefined {
  const axes: StoryDiscussionRevisionAxis[] = [];
  const avoidStyle: string[] = [];
  let requestedRhythmProfile: StoryDiscussionRevisionSummary["requestedRhythmProfile"];
  let requestedSplitPolicy: StoryDiscussionRevisionSummary["requestedSplitPolicy"];
  let referencePreference = "";

  if (/日漫|动漫|anime|表情特写|手部.*特写|眼神|情绪/i.test(text)) {
    axes.push("rhythm", "style");
    requestedRhythmProfile = /快切|动作|太平|多拆|远景.*特写|特写.*手/i.test(text) ? "action_fast_cut" : "anime_emotion";
    referencePreference = "日漫里远景建立、表情特写、手部动作特写承接的节奏";
  }
  if (/快切|动作太平|太平|更有动作|节奏快|fast cut|flat/i.test(text)) {
    axes.push("rhythm");
    requestedRhythmProfile = requestedRhythmProfile || "action_fast_cut";
  }
  if (/不要.*广告|别.*广告|不.*广告|广告感|commercial/i.test(text)) {
    axes.push("style");
    avoidStyle.push("广告感");
    if (requestedRhythmProfile === "commercial_short") requestedRhythmProfile = "lyrical_observation";
  }
  if (/多拆|拆.*多|镜头多|多几个镜头|远景.*表情.*手|wide.*close.*hand/i.test(text)) {
    axes.push("split");
    requestedSplitPolicy = "more_micro_shots";
  }
  if (/少拆|拆.*少|少几个镜头|别切太碎|不要切太碎|hold|fewer/i.test(text)) {
    axes.push("split");
    requestedSplitPolicy = "fewer_holds";
  }
  if (/喜欢|像.*电影|电影节奏|film rhythm|reference film/i.test(text)) {
    axes.push("reference_preference");
    referencePreference = referencePreference || text;
  }

  const uniqueAxes = Array.from(new Set(axes));
  if (!uniqueAxes.length) return undefined;
  const rhythmCopy = requestedRhythmProfile === "action_fast_cut"
    ? "节奏改成日漫动作快切"
    : requestedRhythmProfile === "anime_emotion"
      ? "节奏改成日漫情绪特写"
      : requestedRhythmProfile === "quiet_dialogue"
        ? "节奏保持安静对白"
        : "节奏改成更克制的电影段落";
  const splitCopy = requestedSplitPolicy === "more_micro_shots"
    ? "镜头拆得更细，优先远景建立、表情特写、手部动作特写"
    : requestedSplitPolicy === "fewer_holds"
      ? "镜头拆得更少，优先保留完整表演"
      : "镜头拆分按当前节奏判断";
  const avoidCopy = avoidStyle.length ? `，避免${avoidStyle.join("、")}` : "";

  return {
    axes: uniqueAxes,
    requestedRhythmProfile,
    requestedSplitPolicy,
    referencePreference: referencePreference || undefined,
    avoidStyle,
    reason: `用户觉得这段节奏或风格需要导演调整：${text}`,
    affectedShotHint: affectedShotHint(text),
    confirmationCopy: `${rhythmCopy}；${splitCopy}${avoidCopy}。确认前只作为待修改，不写入 Project.vibe facts。`,
    projectFactWriteBlocked: true,
  };
}

function deltasForTurn(workspace: StoryDiscussionWorkspace, turn: StoryDiscussionTurn): StoryDiscussionDelta[] {
  const text = turn.text;
  const deltas: StoryDiscussionDelta[] = [];
  const directorRevision = directorRevisionForTurn(text);
  const characterItems = targetItemsForLane(workspace, "characters");
  const sceneItems = targetItemsForLane(workspace, "scenes");
  const audioItems = targetItemsForLane(workspace, "audio");
  const storyboardItems = targetItemsForLane(workspace, "storyboard");

  if (/多视角|正面|侧脸|侧面|背面|三视图|reference sheet|turnaround/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "character_multiview_request",
      laneId: "characters",
      label: "主角多视角",
      summary: `用户反馈：「${text}」。把这条反馈作为角色多视角准备需求，后续确认后再进入角色资产计划。`,
      targetItems: characterItems,
    }));
  }
  if (/角色|人物|主角|参考图|绑定/i.test(text) && !deltas.some((delta) => delta.laneId === "characters")) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "character_reference_binding",
      laneId: "characters",
      label: "角色参考绑定",
      summary: `用户反馈：「${text}」。把反馈挂到角色参考绑定，等待用户确认具体参考图用途。`,
      targetItems: characterItems,
    }));
  }
  if (/场景|地点|空间|环境|参考图|master|旧楼|街|房间/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "scene_reference_binding",
      laneId: "scenes",
      label: "场景参考绑定",
      summary: `用户反馈：「${text}」。把反馈挂到场景整理，等待确认哪些场景需要参考图或场景 master。`,
      targetItems: sceneItems,
    }));
  }
  if (/克隆|音色|声音参考|voice clone|voice cloning/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "audio_clone_source",
      laneId: "audio",
      label: "音色克隆来源",
      summary: `用户反馈：「${text}」。把反馈作为音色参考用途，后续确认后再进入音频资产准备。`,
      targetItems: audioItems,
    }));
  } else if (/音频|旁白|对白|配音|声音|tts|audio|voice/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "audio_usage_note",
      laneId: "audio",
      label: "音频用途",
      summary: `用户反馈：「${text}」。把反馈作为音频用途说明，后续确认后再绑定到分镜或角色。`,
      targetItems: audioItems,
    }));
  }
  if (/节奏|慢|快|停留|压缩|拉长|时长|duration|pace/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "storyboard_timing_adjustment",
      laneId: "storyboard",
      label: "分镜节奏调整",
      summary: directorRevision
        ? `用户反馈：「${text}」。${directorRevision.confirmationCopy}`
        : `用户反馈：「${text}」。把反馈作为分镜节奏调整建议，确认后再修改镜头草案。`,
      targetItems: storyboardItems,
      revisionSummary: directorRevision,
    }));
  }
  if (directorRevision?.axes.includes("style")) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "storyboard_style_revision",
      laneId: "storyboard",
      label: directorRevision.requestedRhythmProfile === "action_fast_cut" ? "日漫动作快切" : "导演风格调整",
      summary: `用户反馈：「${text}」。${directorRevision.confirmationCopy}`,
      targetItems: storyboardItems,
      revisionSummary: directorRevision,
    }));
  }
  if (directorRevision?.axes.includes("split")) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "storyboard_split_preference",
      laneId: "storyboard",
      label: directorRevision.requestedSplitPolicy === "more_micro_shots" ? "镜头多拆一点" : "镜头少拆一点",
      summary: `用户反馈：「${text}」。${directorRevision.confirmationCopy}`,
      targetItems: storyboardItems,
      revisionSummary: directorRevision,
    }));
  }
  if (directorRevision?.axes.includes("reference_preference")) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "storyboard_reference_preference",
      laneId: "storyboard",
      label: "参考节奏偏好",
      summary: `用户反馈：「${text}」。把参考偏好暂存为导演修改，确认后再参与分镜判断。`,
      targetItems: storyboardItems,
      revisionSummary: directorRevision,
    }));
  }
  if (/顺序|提前|后移|放到|移到|order/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "storyboard_order_change",
      laneId: "storyboard",
      label: "分镜顺序调整",
      summary: `用户反馈：「${text}」。把反馈作为分镜顺序调整建议，确认后再修改镜头草案。`,
      targetItems: storyboardItems,
    }));
  }
  if (/删|删除|加|新增|补一个|remove|add/i.test(text)) {
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "storyboard_add_remove",
      laneId: "storyboard",
      label: "分镜增删",
      summary: `用户反馈：「${text}」。把反馈作为分镜增删建议，确认后再修改镜头草案。`,
      targetItems: storyboardItems,
    }));
  }
  if (!deltas.length) {
    const laneId = laneForFocus(turn.focus);
    deltas.push(makeDelta({
      workspace,
      turn,
      kind: "general_note",
      laneId,
      label: `${focusLabel(turn.focus)}反馈`,
      summary: `用户反馈：「${text}」。把这条反馈暂存为待确认修改，后续由用户确认后再进入项目事实。`,
      targetItems: targetItemsForLane(workspace, laneId),
    }));
  }

  return deltas;
}

export function buildStoryDiscussionWorkspace(input: BuildStoryDiscussionWorkspaceInput): StoryDiscussionWorkspace {
  const createdAt = input.createdAt || input.session.updatedAt || deterministicTimestamp;
  const factsByLane = input.session.stagedFacts.reduce<Record<StoryDiscussionLaneId, DirectorStagedFact[]>>((groups, fact) => {
    const laneId = laneIdForFact(fact);
    if (laneId) groups[laneId].push(fact);
    return groups;
  }, { characters: [], scenes: [], audio: [], storyboard: [] });
  const lanes: StoryDiscussionLane[] = [
    buildLane("characters", factsByLane.characters),
    buildLane("scenes", factsByLane.scenes),
    buildLane("audio", factsByLane.audio),
    buildLane("storyboard", factsByLane.storyboard),
  ];
  const scriptTitle = input.session.stagedFacts.find((fact) => fact.kind === "script_brief")?.label
    || input.session.turns.find((turn) => turn.scope === "script")?.text
    || "新视频草案";

  return {
    schemaVersion: storyDiscussionWorkspaceSchemaVersion,
    workspaceId: `discussion_${safeId(input.session.sessionId)}`,
    sessionId: input.session.sessionId,
    projectId: input.session.projectId,
    draftTitle: clean(scriptTitle),
    status: input.session.workspace.scriptReady ? "ready_for_discussion" : "needs_script",
    lanes,
    turns: [
      {
        id: `${input.session.sessionId}_discussion_open`,
        role: "director",
        focus: "general",
        createdAt,
        text: input.session.workspace.scriptReady
          ? "我已经把脚本、素材和分镜草案整理出来了。你可以直接说想调整角色、场景、音频或分镜。"
          : "先放入脚本，我再帮你拆分镜和绑定素材。",
        sourceRefs: [`director_session:${input.session.sessionId}`],
        rawTextMayBecomeProjectFact: false,
      },
    ],
    stagedDeltas: [],
    nextActionLabel: nextActionForLanes(lanes),
    hardLocks,
  };
}

export function stageStoryDiscussionTurn(input: StageStoryDiscussionTurnInput): StoryDiscussionWorkspace {
  const text = clean(input.text);
  if (!text) return input.workspace;
  const createdAt = input.createdAt || deterministicTimestamp;
  const focus = inferFocus(text);
  const userTurn: StoryDiscussionTurn = {
    id: `${input.workspace.workspaceId}_turn_${input.workspace.turns.length + 1}_${safeId(text)}`,
    role: "user",
    focus,
    createdAt,
    text,
    sourceRefs: [`discussion:${input.workspace.workspaceId}`],
    rawTextMayBecomeProjectFact: false,
  };
  const directorTurn: StoryDiscussionTurn = {
    id: `${userTurn.id}_director`,
    role: "director",
    focus,
    createdAt,
    text: responseForFocus(focus),
    sourceRefs: [userTurn.id],
    rawTextMayBecomeProjectFact: false,
  };
  const nextDeltas = deltasForTurn(input.workspace, userTurn);

  return {
    ...input.workspace,
    turns: [...input.workspace.turns, userTurn, directorTurn],
    stagedDeltas: [...input.workspace.stagedDeltas, ...nextDeltas],
    nextActionLabel: nextDeltas.length ? `确认 ${nextDeltas.length} 条修改` : `继续整理${focusLabel(focus)}`,
  };
}

export function confirmStoryDiscussionDeltas(input: ConfirmStoryDiscussionDeltasInput): StoryDiscussionWorkspace {
  const createdAt = input.createdAt || deterministicTimestamp;
  const pendingCount = input.workspace.stagedDeltas.filter((delta) => delta.status === "staged").length;
  if (!pendingCount) return input.workspace;
  return {
    ...input.workspace,
    stagedDeltas: input.workspace.stagedDeltas.map((delta) => (
      delta.status === "staged"
        ? { ...delta, status: "confirmed" as const, confirmedAt: createdAt }
        : delta
    )),
    turns: [
      ...input.workspace.turns,
      {
        id: `${input.workspace.workspaceId}_turn_confirm_${input.workspace.turns.length + 1}`,
        role: "director",
        focus: "general",
        createdAt,
        text: `已确认 ${pendingCount} 条修改，确认草案时会一起进入故事流准备。`,
        sourceRefs: input.workspace.stagedDeltas
          .filter((delta) => delta.status === "staged")
          .map((delta) => delta.id),
        rawTextMayBecomeProjectFact: false,
      },
    ],
    nextActionLabel: "确认草案",
  };
}

export function validateStoryDiscussionWorkspace(workspace: StoryDiscussionWorkspace): StoryDiscussionWorkspaceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (workspace.schemaVersion !== storyDiscussionWorkspaceSchemaVersion) errors.push("Story discussion workspace schema version drifted.");
  if (!workspace.workspaceId.trim()) errors.push("Workspace id is required.");
  if (!workspace.sessionId.trim()) errors.push("Session id is required.");
  if (workspace.hardLocks.projectFactWriteAllowed) errors.push("Discussion workspace cannot write project facts.");
  if (workspace.hardLocks.formalTaskCreationAllowed) errors.push("Discussion workspace cannot create formal tasks.");
  if (workspace.hardLocks.remoteGenerationAllowed) errors.push("Discussion workspace cannot start remote generation.");
  if (workspace.turns.some((turn) => turn.rawTextMayBecomeProjectFact !== false)) {
    errors.push("Discussion turns must remain conversation-only.");
  }
  if (workspace.stagedDeltas.some((delta) => !delta.needsUserConfirmation || delta.canWriteProjectFactNow)) {
    errors.push("Discussion deltas must require confirmation before project writes.");
  }
  if (!workspace.lanes.some((lane) => lane.id === "storyboard" && lane.count > 0)) warnings.push("No storyboard lane items yet.");
  return { ok: errors.length === 0, errors, warnings };
}
