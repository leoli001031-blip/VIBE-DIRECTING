import type { DirectorRhythmProfile } from "./directorRhythmPlanner";
import {
  isVehicleObjectReference,
  referenceAssetCandidates,
} from "./referenceAssetStrategy";

export const DIRECTOR_AI_STORYBOARD_PLAN_VERSION = "director_ai_storyboard_plan_v1";
const MAX_AI_STORYBOARD_SHOTS = 96;

export type DirectorAiStoryboardExecutionMode =
  | "single_continuous_shot"
  | "relationship_wide"
  | "action_insert"
  | "reaction_closeup"
  | "planned_cut_sequence";

export type DirectorAiStoryboardReferenceStrategy =
  | "storyboard_narrative"
  | "storyboard_rapid_cut"
  | "omni_reference";

export interface DirectorAiStoryboardSeedRow {
  id: string;
  title: string;
  text: string;
  durationSeconds?: number;
  timeRange?: string;
  characters?: string;
  scene?: string;
  props?: string;
}

export interface DirectorAiStoryboardPlanInput {
  scriptText: string;
  styleText?: string;
  userPreference?: string;
  targetDurationSeconds?: number;
  structuralRows: DirectorAiStoryboardSeedRow[];
}

export interface DirectorAiStoryboardShot {
  shotNo: string;
  title: string;
  durationSeconds: number;
  shotSize: string;
  camera: string;
  visualDescription: string;
  primaryAction: string;
  actionTrigger: string;
  microReaction: string;
  executionMode: DirectorAiStoryboardExecutionMode;
  referenceStrategy: DirectorAiStoryboardReferenceStrategy;
  visibleCutBudget: string;
  visibleClips: number;
  storyboardPanels: number;
  actionBeats: string[];
  subtitle: string;
  sound: string;
  characters: string;
  scene: string;
  props: string;
  audioUsage: string;
  rhythmProfile: DirectorRhythmProfile;
  rhythmReason: string;
  sourceRowIds: string[];
}

export interface DirectorAiStoryboardPlan {
  schemaVersion: typeof DIRECTOR_AI_STORYBOARD_PLAN_VERSION;
  planningSource: "ai_director_validated";
  narrativeGoal: string;
  totalDurationSeconds: number;
  shots: DirectorAiStoryboardShot[];
  warnings: string[];
}

const executionModes = new Set<DirectorAiStoryboardExecutionMode>([
  "single_continuous_shot",
  "relationship_wide",
  "action_insert",
  "reaction_closeup",
  "planned_cut_sequence",
]);

const referenceStrategies = new Set<DirectorAiStoryboardReferenceStrategy>([
  "storyboard_narrative",
  "storyboard_rapid_cut",
  "omni_reference",
]);

const rhythmProfiles = new Set<DirectorRhythmProfile>([
  "quiet_dialogue",
  "anime_emotion",
  "action_fast_cut",
  "comedy_reaction",
  "suspense_pressure",
  "commercial_short",
  "emotion_montage",
  "lyrical_observation",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanMultiline(value: unknown, maxLength = 24000): string {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, maxLength)
    : "";
}

function isPlanningMetadataLine(line: string): boolean {
  const trimmed = clean(line);
  if (!trimmed) return true;
  return (/^(?:标题|片名|故事名|项目名|作品名|Title)\s*[:：]/iu.test(trimmed) && trimmed.length <= 120)
    || /^(?:请)?先不要(?:提交)?视频测试/u.test(trimmed)
    || /^请先不要.*(?:真实)?生图/u.test(trimmed)
    || /^只做(?:前端|AI|规划|拆分|节奏|参考策略)/u.test(trimmed);
}

function stripPlanningMetadata(value: unknown, maxLength = 24000): string {
  return cleanMultiline(value, maxLength)
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter((line) => !isPlanningMetadataLine(line))
    .join("\n")
    .trim();
}

function compactSeedText(value: unknown, maxLength = 320): string {
  return cleanMultiline(value, maxLength)
    .split(/\n+/u)
    .map((line) => clean(line))
    .filter(Boolean)
    .join(" / ")
    .slice(0, maxLength);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed * 10) / 10));
}

function oneOf<T extends string>(value: unknown, options: Set<T>, fallback: T): T {
  const normalized = clean(value);
  return options.has(normalized as T) ? normalized as T : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean).slice(0, 12) : [];
}

function splitReferenceList(value: unknown): string[] {
  return clean(value)
    .split(/[，、,;/；|]/u)
    .map((item) => clean(item))
    .filter((item) => item && !/^(无|没有|待确认|none|n\/a)$/i.test(item))
    .slice(0, 16);
}

function joinReferenceList(values: string[], fallback: string): string {
  return values.length ? values.join("、") : fallback;
}

function cleanSceneSubject(value: unknown): string {
  const text = clean(value);
  if (/^(同上|同前|同场景|同一地点|同一场景|上一镜|上一镜头|前一镜|前一镜头|same|same as above|same scene)$/iu.test(text)) {
    return "待确认";
  }
  return text;
}

function inferenceText(record: Record<string, unknown>) {
  return [
    record.title,
    record.visualDescription,
    record.frameDescription,
    record.primaryAction,
    record.actionTrigger,
    record.microReaction,
    record.camera,
    record.scene,
    record.props,
  ]
    .map((value) => clean(value))
    .filter(Boolean)
    .join(" ");
}

function inferredFunctionalCharacters(record: Record<string, unknown>) {
  const text = inferenceText(record);
  if (/车手|驾驶者|司机|driver|racer/i.test(text)) {
    const hasWhiteCar = /白车|白色.*车|white\s*(?:car|coupe)/i.test(text);
    const hasBlackCar = /黑车|黑色.*车|black\s*(?:car|coupe)/i.test(text);
    if (hasWhiteCar && hasBlackCar) return "白车车手、黑车车手";
    if (/两名|两个|双人|对手|互相|并排|一前一后/.test(text)) return "两名车手";
    return "车手";
  }
  return undefined;
}

function normalizedReferenceFields(record: Record<string, unknown>): {
  characters: string;
  scene: string;
  props: string;
} {
  const rawCharacters = splitReferenceList(record.characters);
  const vehicleObjectsFromCharacters = rawCharacters.filter(isVehicleObjectReference);
  const characters = referenceAssetCandidates(rawCharacters, "character");
  const props = referenceAssetCandidates([
    ...splitReferenceList(record.props),
    ...vehicleObjectsFromCharacters,
  ], "prop");
  return {
    characters: joinReferenceList(characters, inferredFunctionalCharacters(record) || "无"),
    scene: cleanSceneSubject(record.scene) || "待确认",
    props: joinReferenceList(props, "无"),
  };
}

function extractRequestedShotCount(text: string): number | undefined {
  const normalized = text.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  const match = normalized.match(/(?:要|做|生成|输出|共|总共|大概|约)?\s*(\d{1,3})\s*(?:个|条|段)?\s*(?:镜头|分镜|shot|shots)/i);
  if (!match) return undefined;
  const count = Number(match[1]);
  if (!Number.isFinite(count)) return undefined;
  return Math.max(1, Math.min(MAX_AI_STORYBOARD_SHOTS, Math.round(count)));
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("director_ai_storyboard_json_missing");
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch (error) {
    throw new Error(`director_ai_storyboard_json_parse: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function defaultVisibleCutBudget(input: {
  executionMode: DirectorAiStoryboardExecutionMode;
  referenceStrategy: DirectorAiStoryboardReferenceStrategy;
  durationSeconds: number;
}) {
  if (input.referenceStrategy === "storyboard_rapid_cut" || input.executionMode === "planned_cut_sequence") {
    if (input.durationSeconds <= 6) return "0-1 个可见切点";
    if (input.durationSeconds <= 10) return "1-2 个可见切点";
    return "2-3 个可见切点";
  }
  if (input.executionMode === "action_insert" || input.executionMode === "reaction_closeup") return "最多 1 个反应切点";
  return "不主动切镜";
}

function numberField(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function explicitCountFromText(text: string, durationSeconds: number): number | undefined {
  const normalized = clean(text);
  const range = normalized.match(/(\d+)\s*[-~～到至]\s*(\d+)\s*个?/u);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      const min = Math.max(0, Math.min(low, high));
      const max = Math.max(low, high);
      return durationSeconds > 4.5 ? max : min;
    }
  }
  const exact = normalized.match(/(\d+)\s*个?/u);
  if (!exact) return undefined;
  const value = Number(exact[1]);
  return Number.isFinite(value) ? Math.max(0, value) : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizedActionBeats(record: Record<string, unknown>): string[] {
  const explicit = stringList(record.actionBeats);
  if (explicit.length) return explicit.slice(0, 12);
  return [
    clean(record.primaryAction),
    clean(record.actionTrigger),
    clean(record.microReaction),
  ].filter(Boolean).slice(0, 6);
}

function visibleClipsForShot(input: {
  record: Record<string, unknown>;
  executionMode: DirectorAiStoryboardExecutionMode;
  referenceStrategy: DirectorAiStoryboardReferenceStrategy;
  durationSeconds: number;
  visibleCutBudget: string;
}): number {
  const explicit = numberField(input.record.visibleClips);
  if (explicit) return clampInteger(explicit, 1, 12);
  if (input.referenceStrategy !== "storyboard_rapid_cut" && input.executionMode !== "planned_cut_sequence") return 1;
  const cutCount = explicitCountFromText(input.visibleCutBudget, input.durationSeconds);
  if (cutCount !== undefined) return clampInteger(cutCount + 1, 1, 12);
  if (input.durationSeconds <= 4.5) return 1;
  if (input.durationSeconds <= 8) return 2;
  return 3;
}

function storyboardPanelsForShot(input: {
  record: Record<string, unknown>;
  referenceStrategy: DirectorAiStoryboardReferenceStrategy;
  visibleClips: number;
  actionBeats: string[];
  durationSeconds: number;
}): number {
  if (input.referenceStrategy === "omni_reference") return 0;
  const explicit = numberField(input.record.storyboardPanels);
  if (explicit) return clampInteger(explicit, 1, 12);
  if (input.referenceStrategy === "storyboard_narrative") return 1;
  const actionBeatCount = input.actionBeats.length;
  const durationHint = input.durationSeconds <= 4.5 ? 3 : input.durationSeconds <= 8 ? 5 : 8;
  return clampInteger(Math.max(input.visibleClips, actionBeatCount, durationHint), 2, 12);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeDurationsToTotal(
  shots: DirectorAiStoryboardShot[],
  requestedTotalSeconds: number | undefined,
): { shots: DirectorAiStoryboardShot[]; totalDurationSeconds: number; warning?: string } {
  const currentTotal = roundOne(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0));
  const requestedTotal = Number.isFinite(Number(requestedTotalSeconds)) && Number(requestedTotalSeconds) > 0
    ? roundOne(Number(requestedTotalSeconds))
    : currentTotal;
  if (!currentTotal || !requestedTotal || Math.abs(currentTotal - requestedTotal) <= 0.5) {
    return { shots, totalDurationSeconds: currentTotal || requestedTotal };
  }
  const scale = requestedTotal / currentTotal;
  const scaled = shots.map((shot) => ({
    ...shot,
    durationSeconds: roundOne(Math.max(1, Math.min(15, shot.durationSeconds * scale))),
  }));
  const scaledTotalBeforeLast = roundOne(scaled.slice(0, -1).reduce((sum, shot) => sum + shot.durationSeconds, 0));
  const last = scaled[scaled.length - 1];
  if (last) {
    last.durationSeconds = roundOne(Math.max(1, Math.min(15, requestedTotal - scaledTotalBeforeLast)));
  }
  const normalizedTotal = roundOne(scaled.reduce((sum, shot) => sum + shot.durationSeconds, 0));
  return {
    shots: scaled,
    totalDurationSeconds: normalizedTotal,
    warning: `已将镜头时长从 ${currentTotal}s 归一化到 ${normalizedTotal}s。`,
  };
}

function hasPendingCharacter(value: string): boolean {
  return !value || /^(待确认|无|同上|同前|同场景|同一地点|同一场景|上一镜|上一镜头|前一镜|前一镜头|none|n\/a)$/i.test(clean(value));
}

function inheritPendingSubjects(shots: DirectorAiStoryboardShot[]): DirectorAiStoryboardShot[] {
  let previousCharacters = "";
  let previousScene = "";
  return shots.map((shot) => {
    const inheritedCharacters = hasPendingCharacter(shot.characters) && previousCharacters
      ? previousCharacters
      : shot.characters;
    const inheritedScene = hasPendingCharacter(shot.scene) && previousScene ? previousScene : shot.scene;
    if (!hasPendingCharacter(inheritedCharacters)) previousCharacters = inheritedCharacters;
    if (!hasPendingCharacter(inheritedScene)) previousScene = inheritedScene;
    return {
      ...shot,
      characters: inheritedCharacters,
      scene: inheritedScene,
    };
  });
}

function normalizeShot(raw: unknown, index: number): DirectorAiStoryboardShot | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const title = clean(record.title) || clean(record.shotTitle) || `镜头 ${index + 1}`;
  const durationSeconds = clampNumber(record.durationSeconds ?? record.duration, 5, 3, 15);
  const executionMode = oneOf(record.executionMode, executionModes, "single_continuous_shot");
  const referenceStrategy = oneOf(record.referenceStrategy, referenceStrategies, executionMode === "planned_cut_sequence" ? "storyboard_rapid_cut" : "omni_reference");
  const rhythmProfile = oneOf(record.rhythmProfile, rhythmProfiles, referenceStrategy === "storyboard_rapid_cut" ? "action_fast_cut" : "anime_emotion");
  const visibleCutBudget = clean(record.visibleCutBudget) || defaultVisibleCutBudget({ executionMode, referenceStrategy, durationSeconds });
  const referenceFields = normalizedReferenceFields(record);
  const actionBeats = normalizedActionBeats(record);
  const visibleClips = visibleClipsForShot({ record, executionMode, referenceStrategy, durationSeconds, visibleCutBudget });
  const storyboardPanels = storyboardPanelsForShot({ record, referenceStrategy, visibleClips, actionBeats, durationSeconds });
  return {
    shotNo: clean(record.shotNo) || `1-${index + 1}`,
    title,
    durationSeconds,
    shotSize: clean(record.shotSize) || "中景",
    camera: clean(record.camera) || "按画面动作选择清楚机位，保留轻微呼吸感运镜。",
    visualDescription: clean(record.visualDescription) || clean(record.frameDescription) || title,
    primaryAction: clean(record.primaryAction) || title,
    actionTrigger: clean(record.actionTrigger) || "由上一镜头或当前场景状态触发",
    microReaction: clean(record.microReaction) || "保留轻微呼吸、眨眼或视线变化",
    executionMode,
    referenceStrategy,
    visibleCutBudget,
    visibleClips,
    storyboardPanels,
    actionBeats,
    subtitle: clean(record.subtitle) || clean(record.dialogue) || "-",
    sound: clean(record.sound) || "环境底噪",
    characters: referenceFields.characters,
    scene: referenceFields.scene,
    props: referenceFields.props,
    audioUsage: clean(record.audioUsage) || "现场声或留空",
    rhythmProfile,
    rhythmReason: clean(record.rhythmReason) || "由 AI 导演根据脚本节奏和动作密度判断。",
    sourceRowIds: stringList(record.sourceRowIds),
  };
}

export function normalizeDirectorAiStoryboardPlan(raw: unknown): DirectorAiStoryboardPlan {
  const parsed = typeof raw === "string" ? extractJsonObject(raw) : raw;
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  const shots = (Array.isArray(record.shots) ? record.shots : [])
    .map((shot, index) => normalizeShot(shot, index))
    .filter((shot): shot is DirectorAiStoryboardShot => Boolean(shot))
    .slice(0, MAX_AI_STORYBOARD_SHOTS);
  if (!shots.length) throw new Error("director_ai_storyboard_shots_missing");
  const requestedTotal = clampNumber(
    record.totalDurationSeconds,
    shots.reduce((sum, shot) => sum + shot.durationSeconds, 0),
    1,
    900,
  );
  const inheritedShots = inheritPendingSubjects(shots);
  const durationNormalized = normalizeDurationsToTotal(inheritedShots, requestedTotal);
  return {
    schemaVersion: DIRECTOR_AI_STORYBOARD_PLAN_VERSION,
    planningSource: "ai_director_validated",
    narrativeGoal: clean(record.narrativeGoal) || "把脚本整理成可复核、可执行的导演分镜草案。",
    totalDurationSeconds: durationNormalized.totalDurationSeconds,
    shots: durationNormalized.shots,
    warnings: [
      ...stringList(record.warnings),
      durationNormalized.warning,
    ].filter(Boolean) as string[],
  };
}

export function buildDirectorAiStoryboardPrompt(input: DirectorAiStoryboardPlanInput): string {
  const scriptText = stripPlanningMetadata(input.scriptText);
  const styleText = cleanMultiline(input.styleText, 2000);
  const preference = cleanMultiline(input.userPreference, 2000);
  const totalDuration = input.targetDurationSeconds || input.structuralRows.reduce((sum, row) => sum + (row.durationSeconds || 0), 0);
  const requestedShotCount = extractRequestedShotCount([scriptText, styleText, preference].filter(Boolean).join("\n"));
  const structuralRows = input.structuralRows
    .map((row, index) => ({
      rowId: row.id || `row_${index + 1}`,
      title: isPlanningMetadataLine(row.title) ? "" : row.title,
      durationSeconds: row.durationSeconds,
      timeRange: row.timeRange,
      text: compactSeedText(stripPlanningMetadata(row.text)),
      characters: row.characters,
      scene: row.scene,
      props: row.props,
    }))
    .filter((row) => row.title || row.text || row.characters || row.scene || row.props);
	  const suggestedShotCount = (() => {
	    const duration = Number(totalDuration || 0);
	    if (requestedShotCount) return requestedShotCount;
	    if (duration > 0 && duration <= 12) return 3;
	    if (duration > 0 && duration <= 30) return 4;
	    if (duration > 0 && duration <= 60) return 6;
	    if (duration > 0 && duration <= 105) return 9;
	    if (duration > 0) return Math.max(12, Math.min(MAX_AI_STORYBOARD_SHOTS, Math.round(duration / 5)));
	    return Math.max(4, Math.min(10, Math.round((structuralRows.length || 8) * 0.75)));
	  })();
  const longProjectGuidance = Number(totalDuration || 0) > 120
    ? `- 这是长项目规划：允许输出 ${suggestedShotCount} 个左右的视频段。不要把 3-4 分钟硬压成十几个段落；但每个 shot 仍是一个可提交的视频段/故事板段，不是 0.5 秒剪辑点。`
    : `- 这次建议输出约 ${suggestedShotCount} 个 shots；短项目除非故事结构必须，不要超过 18 个。`;

  return [
    "你是 Vibe Director 的 AI 导演分镜规划器。你负责真正拆镜头，不是机械分段器。请只输出严格 JSON，不要 Markdown。",
    "",
    "核心任务：",
    "- 本地程序已经粗略识别了脚本、时间码、歌词、素材和结构行；这些只是结构提示，不是最终分镜。",
    "- 你必须根据故事逻辑、动作密度、音乐/节奏诉求、用户风格偏好，决定每段应该保留、合并、拆细还是改成快切。",
    "- 不要把歌词、倒计时、素材说明机械变成镜头；只有当它们对应明确画面动作、字幕或节奏点时才进入分镜。",
    "- 标题、片名、项目名、测试要求、是否提交视频、是否真实生图都是元数据或操作指令，不是画面内容；除非用户明确要求成片标题卡，不要生成片名淡入、字幕渐现、文字标题、Logo 或任何文字叠加镜头。",
    "- 这里的 shots 是软件后续要生成的“视频段/故事板段”，不是剪辑软件里的每一个 0.5 秒小切点。",
    "- 每个普通段只保留一个主要动作；强动作/日漫情绪可以拆成关系远景、眼神特写、手部/道具、对方反应。",
    "- 但快切、赛车、追逐、倒计时、蒙太奇段不要把每个小切点都拆成单独 shot；请合并成一个 storyboard_rapid_cut 段，把内部节拍写进 visualDescription/camera/primaryAction。",
    "- 必须区分 visibleClips、storyboardPanels、actionBeats：visibleClips 是最终视频里可见剪辑段数量；storyboardPanels 是 Image2 故事板图里画几个面板；actionBeats 是同一可见剪辑内部的动作步骤。",
    "- 如果 storyboardPanels 多于 visibleClips，必须在 actionBeats/visualDescription 中说明多出来的面板只是动作规划参考，不能让 Seedance 生成额外可见剪辑。",
    "- 不要再只写“3 个切点”这种含糊说法；快切段必须显式写 visibleClips 和 storyboardPanels。",
    "- 只有当一个动作节点需要独立角色/场景/参考图、或前后情绪目标完全不同，才拆成新的 shot。",
    "- 4-5 秒通常适合一个主动作；8-12 秒可以承载 2-3 个动作节点；15 秒可以是一个故事板快切段或复杂段落。快切场景由你判断，但 UI 行数要克制。",
    "- 用户不该手动选择模式；你要为每个镜头选择 referenceStrategy。",
    "- characters 只写真正的角色身份：人、动物、拟人角色、明确会表演的机器人/生物。不要把车、手机、书、票、道具写进 characters。",
    "- 如果镜头里确实没有可见角色，characters 写 无；不要写待确认。",
    "- 如果故事里有未命名但持续表演的人物，请使用功能性称呼，例如白车车手、黑车车手、便利店店员、女高中生；不要写待确认。",
    "- 如果主角是拟人化物体、吉祥物、会做表情/动作/表演的非人对象，例如咖啡果、咖啡豆、玩偶、机器人、会说话的车，它必须写进 characters，不许写待确认。",
    "- 整辆车、整本书、整张票、磁带盒、手机等独立物体写进 props；车灯、轮胎、仪表、车窗反光、书页、按钮、手、眼神、雾、湿路、天光、山脊等部件/状态不要作为独立 props，只写进 visualDescription、scene 或动作描述。",
    "- scene 写地点、天气、时间和空间关系；不要写同上/同前，必须写完整可读的地点短句；不要把同一地点的霓虹、积水、雾气、光线拆成单独素材。",
    requestedShotCount
      ? `- 用户已经明确要求 ${requestedShotCount} 个镜头；shots 数组必须输出 ${requestedShotCount} 个对象。不要因为本地结构行更多就扩写成更多镜头。`
      : "",
    longProjectGuidance,
    "- 所有字段必须短句化：title 不超过 18 字；camera 不超过 60 字；visualDescription 不超过 160 字；primaryAction 不超过 50 字；rhythmReason 不超过 50 字。",
    "- 字符串值里不要使用英文双引号；台词可直接写中文句子，不要包引号，避免 JSON 损坏。",
    "- 输出紧凑 JSON；不要解释、不要 Markdown fence、不要长段落。",
    "",
    "referenceStrategy 只能是：",
    "- storyboard_narrative：故事板叙事，用于情绪承接、人物关系、构图和镜头顺序。",
    "- storyboard_rapid_cut：故事板快切，用于动作链、赛车、训练、追逐、快速切镜、复杂节奏段。",
    "- omni_reference：场景图+人物+提示词的全能参考，用于单一动作、短特写、简单连续镜头。",
    "",
    "executionMode 只能是：single_continuous_shot, relationship_wide, action_insert, reaction_closeup, planned_cut_sequence。",
    "rhythmProfile 只能是：quiet_dialogue, anime_emotion, action_fast_cut, comedy_reaction, suspense_pressure, commercial_short, emotion_montage, lyrical_observation。",
    "",
    "输出 JSON schema：",
    "{",
    '  "narrativeGoal": "一句话",',
    '  "totalDurationSeconds": 90,',
    '  "warnings": ["短句风险"],',
    '  "shots": [',
    "    {",
    '      "shotNo": "1-1",',
    '      "title": "短标题",',
    '      "durationSeconds": 4,',
    '      "shotSize": "全景/中景/近景/特写/混合快切",',
    '      "camera": "短句机位运镜",',
    '      "visualDescription": "短句画面，写清位置、动作、场景、道具；快切段只列3到5个内部节拍",',
    '      "primaryAction": "唯一主动作或快切段目标",',
    '      "actionTrigger": "触发原因短句",',
    '      "microReaction": "小反应短句",',
      '      "executionMode": "planned_cut_sequence",',
    '      "referenceStrategy": "storyboard_rapid_cut",',
    '      "visibleCutBudget": "1-2 个可见切点",',
      '      "visibleClips": 3,',
      '      "storyboardPanels": 5,',
      '      "actionBeats": ["动作节点一", "动作节点二", "动作节点三"],',
      '      "subtitle": "台词；无台词写 -",',
      '      "sound": "同期声或环境声；不要写 BGM",',
      '      "characters": "本镜角色",',
      '      "scene": "本镜场景",',
      '      "props": "本镜关键道具；无写 无",',
      '      "audioUsage": "对白/环境声/现场声或留空",',
      '      "rhythmProfile": "action_fast_cut",',
      '      "rhythmReason": "短句原因",',
      '      "sourceRowIds": ["来自哪些本地结构行"]',
    "    }",
    "  ]",
    "}",
    "",
    totalDuration ? `目标/识别总时长：约 ${Math.round(totalDuration)} 秒。` : "目标时长未知，请按脚本自然节奏规划。",
    styleText ? `用户风格诉求：\n${styleText}` : "",
    preference ? `用户补充偏好：\n${preference}` : "",
    "",
    "本地结构行 JSON：",
    JSON.stringify(structuralRows, null, 2),
    "",
    "完整脚本：",
    scriptText,
  ].filter(Boolean).join("\n");
}
