import type { KnowledgePack } from "./knowledgeTypes";
import { stableKnowledgeHash } from "./knowledgeManifest";
import { ensureMinimumDefaultKnowledgePacks } from "./knowledgeDefaults";
import { routeKnowledge } from "./knowledgeRouter";
import type {
  ProjectVibeDocument,
  ProjectVibePatchOperation,
  ProjectVibeShot,
  ProjectVibeStoryFlow,
  ProjectVibeStorySection,
} from "../project/types";

export const scriptPlannerSchemaVersion = "0.1.0";

export interface ScriptPlannerInput {
  idea: string;
  project?: Pick<ProjectVibeDocument, "manifest" | "storyFlow" | "shots">;
  availableKnowledgePacks?: KnowledgePack[];
  generatedAt?: string;
  maxSections?: number;
}

export type ScriptPlannerInputType =
  | "raw_idea"
  | "theme"
  | "synopsis"
  | "script_text"
  | "dialogue_fragment"
  | "reference_film"
  | "mixed_notes";

export type ScriptPlannerStructureType =
  | "moment"
  | "emotional_short"
  | "suspense_discovery"
  | "relationship_conflict"
  | "memory_dream";

export interface ScriptBrief {
  inputType: ScriptPlannerInputType;
  title: string;
  logline: string;
  protagonist: string;
  situation: string;
  desire: string;
  obstacle: string;
  turn: string;
  finalState: string;
  structureType: ScriptPlannerStructureType;
  toneKeywords: string[];
  visualAnchors: string[];
}

export interface ScriptPlannerMissingInfo {
  field: "idea" | "protagonist" | "desire" | "obstacle" | "turn" | "ending_state" | "visual_action";
  severity: "ask_user" | "can_infer";
  question: string;
}

export interface ScriptPlannerQaBlocker {
  id: string;
  field: ScriptPlannerMissingInfo["field"];
  severity: "blocker" | "warning";
  message: string;
}

export interface ScriptPlannerShot extends ProjectVibeShot {
  plannerNotes: {
    visibleAction: string;
    emotionalIntent: string;
    visualAnchor: string;
  };
}

export interface ScriptPlannerResult {
  schemaVersion: typeof scriptPlannerSchemaVersion;
  plannerId: string;
  generatedAt: string;
  projectId: string;
  script_brief: ScriptBrief;
  sections: ProjectVibeStorySection[];
  shots: ScriptPlannerShot[];
  missingInfo: ScriptPlannerMissingInfo[];
  qaBlockers: ScriptPlannerQaBlocker[];
  sourceKnowledgePackIds: string[];
  projectVibePatchOperations: ProjectVibePatchOperation[];
}

interface SectionTemplate {
  key: string;
  title: string;
  purpose: string;
  actionKind: "state" | "pressure" | "encounter" | "turn" | "ending";
}

const deterministicTimestamp = "1970-01-01T00:00:00.000Z"; // Fallback for missing createdAt; real timestamps are always preferred via input.createdAt ||

const structureTemplates: Record<ScriptPlannerStructureType, SectionTemplate[]> = {
  moment: [
    { key: "setup_image", title: "建立画面", purpose: "建立主角、地点和当前状态。", actionKind: "state" },
    { key: "interruption_or_turn", title: "微小打断", purpose: "让一个具体事件打破原状态。", actionKind: "turn" },
    { key: "final_image", title: "结尾余味", purpose: "用最后一个可见画面留下变化后的状态。", actionKind: "ending" },
  ],
  emotional_short: [
    { key: "current_state", title: "当前状态", purpose: "建立主角的处境和情绪基线。", actionKind: "state" },
    { key: "pressure", title: "压力加深", purpose: "把阻碍变成可见动作或环境压力。", actionKind: "pressure" },
    { key: "encounter", title: "微小事件", purpose: "引入能改变局面的事件或关系反馈。", actionKind: "encounter" },
    { key: "turn", title: "状态松动", purpose: "让主角的选择或反应发生小转折。", actionKind: "turn" },
    { key: "aftertaste", title: "余波结尾", purpose: "停在变化后的最后状态，不用总结台词。", actionKind: "ending" },
  ],
  suspense_discovery: [
    { key: "ordinary_state", title: "普通状态", purpose: "先建立正常世界和主角动作。", actionKind: "state" },
    { key: "anomaly", title: "异常出现", purpose: "让异常以可见方式进入画面。", actionKind: "pressure" },
    { key: "approach", title: "靠近异常", purpose: "主角主动接近风险或线索。", actionKind: "encounter" },
    { key: "partial_reveal", title: "局部揭示", purpose: "只揭示一部分信息，让局面改变。", actionKind: "turn" },
    { key: "consequence", title: "后果", purpose: "用情绪或行动后果收束。", actionKind: "ending" },
  ],
  relationship_conflict: [
    { key: "shared_space", title: "同处一室", purpose: "建立两人共享的空间和表面动作。", actionKind: "state" },
    { key: "surface_action", title: "表面动作", purpose: "用普通动作承载关系压力。", actionKind: "pressure" },
    { key: "subtext_pressure", title: "潜台词加压", purpose: "让没说出口的信息改变互动。", actionKind: "encounter" },
    { key: "rupture_or_withdrawal", title: "破裂或退让", purpose: "让关系发生可见转折。", actionKind: "turn" },
    { key: "residue", title: "关系余波", purpose: "留下关系变化后的物件、沉默或距离。", actionKind: "ending" },
  ],
  memory_dream: [
    { key: "present_trigger", title: "现实触发物", purpose: "用一个现实物件或声音触发记忆。", actionKind: "state" },
    { key: "memory_fragment", title: "记忆片段", purpose: "呈现一段不完整但具体的记忆。", actionKind: "encounter" },
    { key: "distortion", title: "记忆偏差", purpose: "让记忆中的细节出现变化或风险。", actionKind: "pressure" },
    { key: "return", title: "回到现实", purpose: "把主角带回当前处境。", actionKind: "turn" },
    { key: "final_image", title: "最后画面", purpose: "用现实中的动作承接记忆带来的变化。", actionKind: "ending" },
  ],
};

const visualAnchorDictionary: Array<[RegExp, string]> = [
  [/雨|rain/i, "rain"],
  [/夜|night/i, "night"],
  [/便利店|convenience/i, "convenience_store"],
  [/地铁|subway|metro/i, "subway"],
  [/房间|room/i, "room"],
  [/厨房|kitchen/i, "kitchen"],
  [/手机|phone/i, "phone"],
  [/屏幕|screen/i, "screen"],
  [/门|door/i, "door"],
  [/伞|umbrella/i, "umbrella"],
  [/钥匙|key/i, "key"],
  [/照片|photo/i, "photo"],
  [/车站|station/i, "station"],
];

const toneDictionary: Array<[RegExp, string]> = [
  [/孤独|lonely|alone/i, "孤独"],
  [/治愈|善意|warm|kind/i, "温和"],
  [/悬疑|异常|mystery|suspense|anomaly/i, "悬疑"],
  [/科幻|未来|robot|cyber|sci-fi/i, "科幻"],
  [/梦|记忆|回忆|dream|memory/i, "记忆感"],
  [/压抑|沉默|silence|quiet/i, "克制"],
  [/雨|night|夜/i, "冷湿"],
];

function normalizeIdea(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function orderedUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "item";
}

function claimId(base: string, usedIds: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function firstSentence(idea: string): string {
  return idea.split(/[。.!?！？\n]/u).map((part) => part.trim()).find(Boolean) || idea;
}

function compactTitle(idea: string): string {
  const sentence = firstSentence(idea);
  const cjk = sentence.match(/[\p{Script=Han}]{2,18}/u)?.[0];
  if (cjk) return cjk.length > 12 ? cjk.slice(0, 12) : cjk;

  const words = sentence.match(/[A-Za-z0-9'-]+/g) || [];
  if (words.length) return words.slice(0, 6).join(" ");
  return "未命名短片";
}

function inferInputType(idea: string): ScriptPlannerInputType {
  if (!idea) return "raw_idea";
  if (/参考|像.*电影|reference film|in the style of/i.test(idea)) return "reference_film";
  if (/主题|theme|情绪|mood/i.test(idea) && idea.length < 120) return "theme";
  if (/^[^：:\n]{1,12}[：:]/u.test(idea) || /["“”][^"“”]+["“”]/u.test(idea)) return "dialogue_fragment";
  if (idea.split(/\n+/u).length >= 3 || idea.length > 260) return "script_text";
  if (/[，,].*[，,].*[，,]/u.test(idea) || idea.length > 120) return "synopsis";
  return "raw_idea";
}

function inferProtagonist(idea: string): string {
  const chinese = idea.match(/(?:一个|一位|这位|那个)?([\p{Script=Han}A-Za-z0-9]{0,10}(?:女孩|男孩|女人|男人|老人|孩子|母亲|父亲|女儿|儿子|摄影师|画家|学生|店员|老板|机器人|旅人|导演|护士|医生|程序员|少女|少年|骑手|外卖员|放映员))/u);
  if (chinese?.[1]) return chinese[1];

  const english = idea.match(/\b(?:a|an|the)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,2})\b/i);
  if (english?.[1]) return english[1].trim();

  return "主角";
}

function inferLocation(idea: string): string {
  const known = [
    ["便利店", /便利店|convenience store/i],
    ["老电影院", /电影院|影院|放映室|cinema|theater/i],
    ["雨夜街边", /雨夜|rainy night/i],
    ["地铁站", /地铁|subway|metro/i],
    ["房间", /房间|room/i],
    ["厨房", /厨房|kitchen/i],
    ["车站", /车站|station/i],
    ["门口", /门口|doorway/i],
  ] as const;
  const match = known.find(([, pattern]) => pattern.test(idea));
  if (match) return match[0];

  const chinese = idea.match(/在(.{2,14}?)(?:里|中|上|下|旁|门口|，|,|。|$)/u);
  if (chinese?.[1]) return chinese[1].trim();

  return "一个具体地点";
}

function inferDesire(idea: string, protagonist: string): string {
  const chinese = idea.match(/(?:想|希望|试图|寻找|要)(.{2,28}?)(?:，|,|。|但|却|$)/u);
  if (chinese?.[1]) return `${protagonist}想${chinese[1].trim()}`;

  const english = idea.match(/\b(?:wants?|needs?|tries to|searches for|looks for)\s+([^,.!?]{3,60})/i);
  if (english?.[1]) return `${protagonist} wants ${english[1].trim()}`;

  return "想从当前困境里找到下一步";
}

function inferObstacle(idea: string): string {
  const chinese = idea.match(/(?:但是|但|却|阻碍|困难|无法|不能|害怕|失去|失业|被困|锁住|卡住|停业|必须|否则|烧毁|下雨|雨太大)(.{0,30}?)(?:，|,|。|$)/u);
  if (chinese) return chinese[0].replace(/[，,。]$/u, "").trim();

  const english = idea.match(/\b(?:but|however|blocked by|cannot|can't|afraid|lost|trapped|rain)\b([^,.!?]{0,60})/i);
  if (english) return english[0].trim();

  return "当前压力还没有被明确说出";
}

function inferTurn(idea: string): string {
  const chinese = idea.match(/(?:突然|直到|后来|转折|发现|遇到|收到|看见|听见|老板|陌生人|善意)(.{0,36}?)(?:，|,|。|$)/u);
  if (chinese) return chinese[0].replace(/[，,。]$/u, "").trim();

  const english = idea.match(/\b(?:until|then|suddenly|discovers?|meets?|finds?|receives?)\b([^,.!?]{0,70})/i);
  if (english) return english[0].trim();

  return "一个微小事件让状态发生变化";
}

function inferFinalState(idea: string, protagonist: string): string {
  const chinese = idea.match(/(?:最后|结尾|最终|愿意|决定|继续|留下)(.{0,36}?)(?:，|,|。|$)/u);
  if (chinese) return chinese[0].replace(/[，,。]$/u, "").trim();

  const english = idea.match(/\b(?:finally|in the end|ends? with|decides? to|keeps going)\b([^,.!?]{0,70})/i);
  if (english) return english[0].trim();

  return `${protagonist}带着一点变化离开原来的状态`;
}

function inferToneKeywords(idea: string): string[] {
  const tones = toneDictionary.filter(([pattern]) => pattern.test(idea)).map(([, label]) => label);
  return orderedUnique(tones.length ? tones : ["克制", "短片感"]);
}

function inferVisualAnchors(idea: string, location: string): string[] {
  const anchors = visualAnchorDictionary.filter(([pattern]) => pattern.test(idea)).map(([, label]) => label);
  return orderedUnique([...anchors, safeId(location)]).slice(0, 6);
}

function inferStructureType(idea: string): ScriptPlannerStructureType {
  if (/(?:15|20|30)\s*(?:秒|s|sec|seconds)|极短|瞬间/i.test(idea)) return "moment";
  if (/悬疑|异常|谜|门外|屏幕|失踪|suspense|mystery|anomaly|strange/i.test(idea)) return "suspense_discovery";
  if (/母女|父子|情侣|分手|重逢|朋友|同事|关系|mother|father|couple|breakup|friend|relationship/i.test(idea)) return "relationship_conflict";
  if (/梦|梦境|记忆|回忆|童年|memory|dream|flashback/i.test(idea)) return "memory_dream";
  return "emotional_short";
}

function hasExplicitProtagonist(idea: string): boolean {
  return inferProtagonist(idea) !== "主角";
}

function hasExplicitDesire(idea: string): boolean {
  return /想|希望|试图|寻找|要|wants?|needs?|tries to|searches for|looks for/i.test(idea);
}

function hasExplicitObstacle(idea: string): boolean {
  return /但是|但|却|阻碍|困难|无法|不能|害怕|失去|失业|被困|锁住|卡住|停业|必须|否则|烧毁|下雨|rain|but|however|blocked|cannot|can't|afraid|lost|trapped/i.test(idea);
}

function hasExplicitTurn(idea: string): boolean {
  return /突然|直到|后来|转折|发现|遇到|收到|看见|听见|递给|老板|陌生人|善意|until|then|suddenly|discovers?|meets?|finds?|receives?/i.test(idea);
}

function hasExplicitEnding(idea: string): boolean {
  return /最后|结尾|最终|愿意|决定|继续|留下|finally|in the end|ends? with|decides?|keeps going/i.test(idea);
}

function hasVisualAction(idea: string): boolean {
  return /走|看|拿|放|开|关|跑|坐|递|翻|按|握|离开|进入|finds?|walks?|takes?|puts?|opens?|closes?|runs?|sits?|hands?|looks?/i.test(idea);
}

function buildMissingInfo(idea: string): ScriptPlannerMissingInfo[] {
  const missing: ScriptPlannerMissingInfo[] = [];
  if (!idea) {
    missing.push({ field: "idea", severity: "ask_user", question: "这个项目要讲什么一句话故事？" });
    return missing;
  }
  if (!hasExplicitProtagonist(idea)) {
    missing.push({ field: "protagonist", severity: "ask_user", question: "主角是谁？用一个可拍的人物或主体描述即可。" });
  }
  if (!hasExplicitDesire(idea)) {
    missing.push({ field: "desire", severity: "can_infer", question: "主角在这支短片里想达成什么？" });
  }
  if (!hasExplicitObstacle(idea)) {
    missing.push({ field: "obstacle", severity: "ask_user", question: "阻碍主角的外部、人际或内部压力是什么？" });
  }
  if (!hasExplicitTurn(idea)) {
    missing.push({ field: "turn", severity: "ask_user", question: "什么事件让局面发生变化？" });
  }
  if (!hasExplicitEnding(idea)) {
    missing.push({ field: "ending_state", severity: "can_infer", question: "结尾时主角的状态和开头相比有什么变化？" });
  }
  if (!hasVisualAction(idea)) {
    missing.push({ field: "visual_action", severity: "can_infer", question: "有没有一个能被镜头拍到的动作、物件或空间变化？" });
  }
  return missing;
}

function buildQaBlockers(missingInfo: ScriptPlannerMissingInfo[]): ScriptPlannerQaBlocker[] {
  return missingInfo
    .filter((item) => item.severity === "ask_user")
    .map((item) => ({
      id: `script_qa_${item.field}`,
      field: item.field,
      severity: item.field === "protagonist" || item.field === "obstacle" || item.field === "turn" ? "blocker" : "warning",
      message: item.question,
    }));
}

function buildBrief(idea: string): ScriptBrief {
  const protagonist = inferProtagonist(idea);
  const location = inferLocation(idea);
  const desire = inferDesire(idea, protagonist);
  const obstacle = inferObstacle(idea);
  const turn = inferTurn(idea);
  const finalState = inferFinalState(idea, protagonist);
  const title = compactTitle(idea);
  const situation = `${protagonist}在${location}面对当前处境。`;

  return {
    inputType: inferInputType(idea),
    title,
    logline: idea ? firstSentence(idea) : "一个尚未补全的短片想法。",
    protagonist,
    situation,
    desire,
    obstacle,
    turn,
    finalState,
    structureType: inferStructureType(idea),
    toneKeywords: inferToneKeywords(idea),
    visualAnchors: inferVisualAnchors(idea, location),
  };
}

function actionForTemplate(template: SectionTemplate, brief: ScriptBrief): string {
  if (template.actionKind === "state") return `${brief.protagonist}处在「${brief.situation}」中，画面先让观众看懂人物和地点。`;
  if (template.actionKind === "pressure") return `把「${brief.obstacle}」变成一个可见压力，让${brief.protagonist}必须反应。`;
  if (template.actionKind === "encounter") return `让${brief.protagonist}遇到能改变局面的具体事件，避免只用解释性台词。`;
  if (template.actionKind === "turn") return `${brief.turn}，主角状态发生一个小但可见的变化。`;
  return `停在「${brief.finalState}」这个最终状态，用画面收束。`;
}

function emotionalIntentForTemplate(template: SectionTemplate, brief: ScriptBrief): string {
  const tone = brief.toneKeywords.join("、");
  if (template.actionKind === "state") return `建立${tone}的情绪基线。`;
  if (template.actionKind === "pressure") return `让压力比上一段更具体。`;
  if (template.actionKind === "encounter") return `给变化一个外部触发点。`;
  if (template.actionKind === "turn") return `让情绪从僵住转向松动。`;
  return `保留余味，不把主题说破。`;
}

function sourceKnowledgeIds(idea: string, availableKnowledgePacks?: KnowledgePack[]): string[] {
  const packs = ensureMinimumDefaultKnowledgePacks(availableKnowledgePacks || []);
  const route = routeKnowledge({
    taskId: "script_planner_main_path",
    userIntent: idea || "new script project",
    taskPurpose: "script",
    contextLevel: "L1",
    availablePacks: packs,
    consumers: ["agent_context", "qa_gate"],
    maxInjectionTokens: 1800,
  });
  const preferredCategories = new Set(["script", "storyflow", "story_function", "qa"]);
  const ids = route.matches
    .filter((match) => preferredCategories.has(match.category))
    .map((match) => match.packId);

  return orderedUnique(ids).slice(0, 8);
}

function buildPlannerSourceRef(plannerId: string): string {
  return `script_planner:${plannerId}`;
}

export function buildScriptPlannerState(input: ScriptPlannerInput): ScriptPlannerResult {
  const idea = normalizeIdea(input.idea || "");
  const generatedAt = input.generatedAt || deterministicTimestamp;
  const projectId = input.project?.manifest.projectId || `project_${stableKnowledgeHash(idea || "empty_project").slice(4, 12)}`;
  const plannerId = `script_plan_${stableKnowledgeHash(
    JSON.stringify({
      idea,
      projectId,
      generatedAt,
      existingShots: input.project?.shots.map((shot) => shot.id).sort() || [],
    }),
  ).slice(4, 12)}`;
  const sourceRef = buildPlannerSourceRef(plannerId);
  const scriptBrief = buildBrief(idea);
  const missingInfo = buildMissingInfo(idea);
  const qaBlockers = buildQaBlockers(missingInfo);
  const templates = structureTemplates[scriptBrief.structureType].slice(0, input.maxSections || undefined);
  const idPrefix = stableKnowledgeHash(`${projectId}:${idea || "empty"}`).slice(4, 10);
  const usedSectionIds = new Set(input.project?.storyFlow.sections.map((section) => section.id) || []);
  const usedShotIds = new Set(input.project?.shots.map((shot) => shot.id) || []);
  const sections: ProjectVibeStorySection[] = [];
  const shots: ScriptPlannerShot[] = [];

  templates.forEach((template, index) => {
    const sectionId = claimId(`sec_${idPrefix}_${String(index + 1).padStart(2, "0")}_${safeId(template.key)}`, usedSectionIds);
    const shotId = claimId(`shot_${idPrefix}_${String(index + 1).padStart(2, "0")}`, usedShotIds);
    const visibleAction = actionForTemplate(template, scriptBrief);
    const emotionalIntent = emotionalIntentForTemplate(template, scriptBrief);
    const visualAnchor = scriptBrief.visualAnchors[index % scriptBrief.visualAnchors.length] || "concrete_action";
    const status = qaBlockers.some((blocker) => blocker.severity === "blocker") ? "blocked" : "planned";

    sections.push({
      id: sectionId,
      title: template.title,
      summary: `${template.purpose} ${visibleAction}`,
      sequenceIndex: index,
      shotIds: [shotId],
    });

    shots.push({
      id: shotId,
      sectionId,
      title: template.title,
      intent: template.purpose,
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: scriptBrief.structureType === "moment" ? 5 : 6,
      status,
      sourceRefs: [`${sourceRef}#sections/${template.key}`],
      plannerNotes: {
        visibleAction,
        emotionalIntent,
        visualAnchor,
      },
    });
  });

  const storyFlow: ProjectVibeStoryFlow = {
    id: input.project?.storyFlow.id || "story_flow_current",
    updatedAt: generatedAt,
    sourceOfTruth: "project_vibe",
    sections,
    shotOrder: shots.map((shot) => shot.id),
  };
  const patchShots: ProjectVibeShot[] = shots.map(({ plannerNotes, ...shot }) => shot);
  const projectVibePatchOperations: ProjectVibePatchOperation[] = [
    { op: "set_story_flow", storyFlow },
    ...patchShots.map((shot) => ({ op: "upsert_shot" as const, shot })),
  ];

  return {
    schemaVersion: scriptPlannerSchemaVersion,
    plannerId,
    generatedAt,
    projectId,
    script_brief: scriptBrief,
    sections,
    shots,
    missingInfo,
    qaBlockers,
    sourceKnowledgePackIds: sourceKnowledgeIds(idea, input.availableKnowledgePacks),
    projectVibePatchOperations,
  };
}
