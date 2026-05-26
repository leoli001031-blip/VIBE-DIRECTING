import type { AgentWebSearchResult } from "./agentWebSearchClient";
import { stableKnowledgeHash } from "./knowledgeManifest";
import { routeKnowledge } from "./knowledgeRouter";
import type {
  KnowledgeInjectedSnippet,
  KnowledgePack,
  KnowledgeRouteResult,
} from "./knowledgeTypes";

export const STYLE_RESEARCH_PREFLIGHT_VERSION = "style_research_preflight_v1";

export interface StyleResearchPreflightInput {
  projectId?: string;
  projectTitle?: string;
  userIntent: string;
  scriptText?: string;
  styleIntent?: string;
  availablePacks: KnowledgePack[];
  webSearchResults?: AgentWebSearchResult[];
  maxInjectionTokens?: number;
  createdAt?: string;
}

export interface StyleResearchCard {
  title: string;
  summary: string;
  styleIntent: string;
  directorGrammar: string[];
  animeCoverageHints: string[];
  actionRules: string[];
  referenceRules: string[];
  promptCompilerNotes: string[];
  homageBoundary: string[];
  sourceRefs: string[];
}

export type StyleResearchContentCardKind =
  | "style_method"
  | "storyboard_pacing"
  | "reference_authority";

export interface StyleResearchContentCard {
  id: string;
  kind: StyleResearchContentCardKind;
  title: string;
  status: "usable" | "needs_research" | "needs_confirmation";
  summary: string;
  bullets: string[];
  sourceRefs: string[];
  reusableAsAsset: boolean;
}

export interface StyleResearchKnowledgeLayer {
  ready: boolean;
  packIds: string[];
  snippetIds: string[];
}

export interface StyleResearchKnowledgeLayers {
  localBuiltIn: StyleResearchKnowledgeLayer;
  projectInternalized: StyleResearchKnowledgeLayer;
  pendingExternal: {
    resultCount: number;
    requiresConfirmation: boolean;
    evidenceRefs: string[];
  };
}

export interface StyleResearchReusePolicy {
  localKnowledgeAutoRouted: true;
  externalResearchRequiresConfirmation: true;
  confirmedExternalResearchBecomesProjectStyleAsset: true;
  rawWebSnippetsNeverBecomeProjectFacts: true;
}

export interface StyleResearchPreflight {
  schemaVersion: typeof STYLE_RESEARCH_PREFLIGHT_VERSION;
  preflightId: string;
  status: "ready" | "needs_external_research" | "needs_user_confirmation";
  projectId?: string;
  query: string;
  createdAt: string;
  localKnowledgeRoute: KnowledgeRouteResult;
  injectedKnowledgeSnippets: KnowledgeInjectedSnippet[];
  knowledgeLayers: StyleResearchKnowledgeLayers;
  reusePolicy: StyleResearchReusePolicy;
  pendingWebSearchResults: Array<{
    query: string;
    evidenceRef: string;
    citationCount: number;
    networkCalled: boolean;
  }>;
  suggestedWebQueries: string[];
  card: StyleResearchCard;
  contentCards: StyleResearchContentCard[];
  warnings: string[];
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compact(value: string, maxLength = 220): string {
  const normalized = cleanText(value);
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function buildResearchQuery(input: Pick<StyleResearchPreflightInput, "userIntent" | "styleIntent" | "scriptText">): string {
  const source = [
    input.styleIntent,
    input.userIntent,
    input.scriptText ? compact(input.scriptText, 160) : "",
    "镜头语法 分镜 动作拆分 参考方法",
  ].filter(Boolean).join(" ");
  return compact(source, 240);
}

function splitInjectedSnippetId(value: string): { packId: string; snippetId: string } | undefined {
  const index = value.lastIndexOf(":");
  if (index <= 0 || index >= value.length - 1) return undefined;
  return {
    packId: value.slice(0, index),
    snippetId: value.slice(index + 1),
  };
}

function injectedSnippetsFor(route: KnowledgeRouteResult, packs: KnowledgePack[]): KnowledgeInjectedSnippet[] {
  const packIndex = new Map(packs.map((pack) => [pack.id, pack]));
  const ids = route.injectedKnowledgeSnippetIds || [];
  return ids.flatMap((id) => {
    const parsed = splitInjectedSnippetId(id);
    if (!parsed) return [];
    const pack = packIndex.get(parsed.packId);
    const snippet = pack?.snippets.find((item) => item.id === parsed.snippetId);
    if (!pack || !snippet) return [];
    return [{
      packId: pack.id,
      snippetId: snippet.id,
      title: snippet.title,
      content: snippet.summary || snippet.content,
      tokenEstimate: Math.max(1, Math.floor(snippet.tokenEstimate || cleanText(snippet.summary || snippet.content).length / 4)),
      hash: snippet.hash,
    }];
  });
}

function hasCue(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function sourceRefs(input: {
  snippets: KnowledgeInjectedSnippet[];
  webSearchResults: AgentWebSearchResult[];
}): string[] {
  return unique([
    ...input.snippets.map((snippet) => `knowledge#${snippet.packId}:${snippet.snippetId}`),
    ...input.webSearchResults.map((result) => result.evidenceRef || result.evidencePath).filter(Boolean),
  ]);
}

function emptyLayer(): StyleResearchKnowledgeLayer {
  return {
    ready: false,
    packIds: [],
    snippetIds: [],
  };
}

function layerFromSnippets(snippets: KnowledgeInjectedSnippet[]): StyleResearchKnowledgeLayer {
  const packIds = unique(snippets.map((snippet) => snippet.packId));
  const snippetIds = unique(snippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`));
  return {
    ready: snippets.length > 0,
    packIds,
    snippetIds,
  };
}

function buildKnowledgeLayers(input: {
  packs: KnowledgePack[];
  snippets: KnowledgeInjectedSnippet[];
  pendingResults: StyleResearchPreflight["pendingWebSearchResults"];
}): StyleResearchKnowledgeLayers {
  const packIndex = new Map(input.packs.map((pack) => [pack.id, pack]));
  const localSnippets = input.snippets.filter((snippet) => {
    const pack = packIndex.get(snippet.packId);
    return pack?.type === "system_builtin" || pack?.type === "user_custom";
  });
  const projectSnippets = input.snippets.filter((snippet) => {
    const pack = packIndex.get(snippet.packId);
    return pack?.type === "project_local" || (pack?.type === "external_imported" && pack.trustLevel !== "unverified");
  });
  return {
    localBuiltIn: localSnippets.length ? layerFromSnippets(localSnippets) : emptyLayer(),
    projectInternalized: projectSnippets.length ? layerFromSnippets(projectSnippets) : emptyLayer(),
    pendingExternal: {
      resultCount: input.pendingResults.length,
      requiresConfirmation: input.pendingResults.length > 0,
      evidenceRefs: unique(input.pendingResults.map((result) => result.evidenceRef).filter(Boolean)),
    },
  };
}

function styleResearchReusePolicy(): StyleResearchReusePolicy {
  return {
    localKnowledgeAutoRouted: true,
    externalResearchRequiresConfirmation: true,
    confirmedExternalResearchBecomesProjectStyleAsset: true,
    rawWebSnippetsNeverBecomeProjectFacts: true,
  };
}

function pendingWebSearchResults(results: AgentWebSearchResult[] = []): StyleResearchPreflight["pendingWebSearchResults"] {
  return results.map((result) => ({
    query: result.query,
    evidenceRef: result.evidenceRef || result.evidencePath,
    citationCount: result.citations.length,
    networkCalled: result.networkCalled,
  }));
}

function buildSuggestedQueries(query: string, text: string): string[] {
  const base = cleanText(query);
  const queries = [
    `${base} 分镜 镜头语言 动作拆分`,
  ];
  if (hasCue(text, [/日漫|动漫|anime|新海诚|eva|evangelion|宫崎|押井|今敏/i])) {
    queries.push(`${base} Japanese anime storyboard shot grammar reaction close-up hand insert`);
  }
  if (hasCue(text, [/昆汀|quentin|tarantino|对白|dialogue/i])) {
    queries.push(`${base} dialogue tension scene structure film analysis`);
  }
  if (hasCue(text, [/快切|动作|追|打|action|fast cut/i])) {
    queries.push(`${base} action fast cut storyboard timing reference`);
  }
  return unique(queries).slice(0, 3);
}

function summarizeKnowledge(snippets: KnowledgeInjectedSnippet[]): string {
  if (!snippets.length) return "还没有命中的本地/项目知识。先建立一张导演研究卡，再进入分镜。";
  return snippets
    .slice(0, 4)
    .map((snippet) => `${snippet.title}: ${compact(snippet.content, 160)}`)
    .join(" / ");
}

function buildStyleResearchCard(input: {
  query: string;
  text: string;
  styleIntent: string;
  snippets: KnowledgeInjectedSnippet[];
  webSearchResults: AgentWebSearchResult[];
}): StyleResearchCard {
  const animeLike = hasCue(input.text, [/日漫|动漫|anime|青春|校园|表情|眼神|手部|特写|静帧|eva|evangelion/i]);
  const fastCut = hasCue(input.text, [/快切|动作|追|打|冲|爆|fight|chase|action|fast cut/i]);
  const dialogue = hasCue(input.text, [/对白|台词|沉默|对话|dialogue|conversation/i]);
  const multiCharacter = hasCue(input.text, [/两人|多人|递|接|对视|关系|一方|另一方|反应|multi/i]);
  const snippetSummary = summarizeKnowledge(input.snippets);
  const sourceReferenceList = sourceRefs({
    snippets: input.snippets,
    webSearchResults: input.webSearchResults,
  });

  return {
    title: "导演研究卡",
    summary: [
      `研究目标：${input.query}`,
      `命中资料：${snippetSummary}`,
      input.webSearchResults.length ? `待确认外部来源：${input.webSearchResults.length} 组。` : "",
    ].filter(Boolean).join("\n"),
    styleIntent: input.styleIntent || "根据用户意图和命中知识决定风格，不凭空套模板。",
    directorGrammar: unique([
      animeLike ? "日漫覆盖：先建立关系/空间，再切眼神、手部或道具插入，最后给反应停顿。" : "",
      fastCut ? "快切覆盖：把动作拆成 setup / movement / contact-prep / reaction，不把整条动作链塞进一个镜头。" : "",
      dialogue ? "对白覆盖：对白不是画面说明，镜头应捕捉停顿、视线、身体重心和听者反应。" : "",
      multiCharacter ? "多人覆盖：先锁 180 度轴线、左右站位和谁行动谁反应，再决定正反打、过肩或插入特写。" : "",
      "分镜图必须服务视频生成：一张图只承担构图、站位、动作方向和节奏提示，不当最终成片风格图。",
    ]),
    animeCoverageHints: unique([
      animeLike ? "情绪交接优先用：关系远景 -> 手部/道具插入 -> 眼神特写 -> 对方反应。" : "",
      animeLike ? "起始帧应该是动作前一拍：手还没碰到、话还没说完、眼神还没完全对上。" : "",
      animeLike ? "不要把人物画成广告式站姿；让肩膀、手指、呼吸、视线先动。" : "",
    ]),
    actionRules: unique([
      "每个视频提交只保留一个主动作；复杂动作先拆成多个微镜头。",
      "动作必须有触发原因和后续微反应。",
      "多人场景必须明确 actor / reactor，不能让所有角色同时平均表演。",
      fastCut ? "强动作可以短切，但每个切点都要有清楚的画面任务。" : "",
    ]),
    referenceRules: unique([
      "角色参考只管身份、发型、服装轮廓和体型，不管场景构图。",
      "场景参考只管地点、天气、时间、光线氛围和空间锚点。",
      "分镜参考只管镜头顺序、构图、站位、动作方向和粗节奏。",
      "如果分镜临时人物与角色参考冲突，角色参考优先。",
    ]),
    promptCompilerNotes: unique([
      "分镜生成前必须先读这张研究卡；不得直接用 free text 生成正式任务。",
      "Image2 分镜 prompt 要写镜头语法和动作前一拍，不要写成成片彩色关键帧。",
      "Seedance prompt 要短，主要写动作、时间、角色反应和 no BGM；不要堆风格词。",
      input.webSearchResults.length ? "外部来源还只是研究证据；写入 Project.vibe 前必须用户确认并生成项目本地知识包。" : "",
    ]),
    homageBoundary: unique([
      "只借鉴方法，不复刻现成角色、台词、剧情、专有名词、镜头表或分镜顺序。",
      "把“像某作品/导演”翻译成原创镜头方法：节奏、留白、景别组合、视线压力和动作因果。",
    ]),
    sourceRefs: sourceReferenceList,
  };
}

function buildContentCardId(preflightSeed: string, kind: StyleResearchContentCardKind): string {
  return `content_card_${kind}_${stableKnowledgeHash(`${preflightSeed}:${kind}`).slice(4, 10)}`;
}

function cardStatus(input: {
  reusableKnowledgeReady: boolean;
  pendingWeb: boolean;
}): StyleResearchContentCard["status"] {
  if (input.pendingWeb) return "needs_confirmation";
  return input.reusableKnowledgeReady ? "usable" : "needs_research";
}

function buildStyleResearchContentCards(input: {
  preflightSeed: string;
  status: StyleResearchPreflight["status"];
  reusableKnowledgeReady: boolean;
  pendingWeb: boolean;
  card: StyleResearchCard;
}): StyleResearchContentCard[] {
  const status = cardStatus({
    reusableKnowledgeReady: input.reusableKnowledgeReady,
    pendingWeb: input.pendingWeb,
  });
  const sourceRefs = input.card.sourceRefs;
  return [
    {
      id: buildContentCardId(input.preflightSeed, "style_method"),
      kind: "style_method",
      title: "风格方法卡",
      status,
      summary: input.card.styleIntent || "把用户想要的感觉翻译成可执行镜头方法。",
      bullets: unique([
        ...input.card.directorGrammar.slice(0, 3),
        ...input.card.homageBoundary.slice(0, 1),
      ]).slice(0, 5),
      sourceRefs,
      reusableAsAsset: input.status === "ready",
    },
    {
      id: buildContentCardId(input.preflightSeed, "storyboard_pacing"),
      kind: "storyboard_pacing",
      title: "分镜节奏卡",
      status,
      summary: "决定一段内容应该慢铺、快切、关系远景、动作插入还是反应特写。",
      bullets: unique([
        ...input.card.animeCoverageHints,
        ...input.card.actionRules,
        "让 AI 根据脚本段落判断镜头节奏；用户偏好的电影、动画或短视频节奏只作为倾向，不写死模板。",
      ]).slice(0, 6),
      sourceRefs,
      reusableAsAsset: input.status === "ready",
    },
    {
      id: buildContentCardId(input.preflightSeed, "reference_authority"),
      kind: "reference_authority",
      title: "参考权重卡",
      status,
      summary: "明确角色、场景、道具、分镜图分别控制什么，避免多参考互相污染。",
      bullets: input.card.referenceRules.slice(0, 6),
      sourceRefs,
      reusableAsAsset: input.status === "ready",
    },
  ];
}

export function buildStyleResearchPreflight(input: StyleResearchPreflightInput): StyleResearchPreflight {
  const createdAt = input.createdAt || new Date().toISOString();
  const query = buildResearchQuery(input);
  const combinedText = [
    input.userIntent,
    input.styleIntent,
    input.scriptText,
  ].filter(Boolean).join("\n");
  const localKnowledgeRoute = routeKnowledge({
    taskId: input.projectId ? `style_research_preflight_${input.projectId}` : "style_research_preflight",
    userIntent: `${query}\n${combinedText}`,
    taskPurpose: "script",
    contextLevel: "L1",
    availablePacks: input.availablePacks,
    consumers: ["agent_context", "prompt_compiler", "qa_gate"],
    maxInjectionTokens: input.maxInjectionTokens || 1800,
  });
  const injectedKnowledgeSnippets = injectedSnippetsFor(localKnowledgeRoute, input.availablePacks);
  const pendingResults = pendingWebSearchResults(input.webSearchResults || []);
  const knowledgeLayers = buildKnowledgeLayers({
    packs: input.availablePacks,
    snippets: injectedKnowledgeSnippets,
    pendingResults,
  });
  const suggestedWebQueries = buildSuggestedQueries(query, combinedText);
  const hasReusableKnowledge = knowledgeLayers.localBuiltIn.ready || knowledgeLayers.projectInternalized.ready;
  const hasPendingWeb = knowledgeLayers.pendingExternal.requiresConfirmation;
  const status = hasPendingWeb
      ? "needs_user_confirmation"
      : hasReusableKnowledge
        ? "ready"
        : "needs_external_research";
  const warnings = unique([
    ...localKnowledgeRoute.warnings,
    !hasReusableKnowledge ? "style_research_reusable_knowledge_missing" : "",
    hasPendingWeb ? "web_search_result_requires_user_confirmation_before_internalizing" : "",
  ]);
  const card = buildStyleResearchCard({
    query,
    text: combinedText,
    styleIntent: cleanText(input.styleIntent || input.userIntent),
    snippets: injectedKnowledgeSnippets,
    webSearchResults: input.webSearchResults || [],
  });
  const preflightId = `style_preflight_${stableKnowledgeHash(JSON.stringify({
    projectId: input.projectId,
    query,
    packIds: injectedKnowledgeSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}:${snippet.hash}`),
    pendingResults,
  })).slice(4, 12)}`;
  const contentCards = buildStyleResearchContentCards({
    preflightSeed: preflightId,
    status,
    reusableKnowledgeReady: hasReusableKnowledge,
    pendingWeb: hasPendingWeb,
    card,
  });

  return {
    schemaVersion: STYLE_RESEARCH_PREFLIGHT_VERSION,
    preflightId,
    status,
    projectId: input.projectId,
    query,
    createdAt,
    localKnowledgeRoute,
    injectedKnowledgeSnippets,
    knowledgeLayers,
    reusePolicy: styleResearchReusePolicy(),
    pendingWebSearchResults: pendingResults,
    suggestedWebQueries,
    card,
    contentCards,
    warnings,
  };
}

export function formatStyleResearchPreflightForPrompt(preflight: StyleResearchPreflight): string[] {
  return [
    `Style research preflight: ${preflight.card.title} (${preflight.status}).`,
    `Knowledge layers: local=${preflight.knowledgeLayers.localBuiltIn.ready ? preflight.knowledgeLayers.localBuiltIn.packIds.join(", ") : "none"}; internalized=${preflight.knowledgeLayers.projectInternalized.ready ? preflight.knowledgeLayers.projectInternalized.packIds.join(", ") : "none"}; pending_external=${preflight.knowledgeLayers.pendingExternal.resultCount}.`,
    preflight.knowledgeLayers.localBuiltIn.ready
      ? "Local knowledge layer: use the routed built-in/user handbook directly before storyboard writing."
      : "Local knowledge layer: no matching local handbook pack was routed.",
    preflight.knowledgeLayers.projectInternalized.ready
      ? "Internalized project research layer: user-confirmed style research can be reused as a project style asset."
      : "Internalized project research layer: none yet.",
    preflight.knowledgeLayers.pendingExternal.requiresConfirmation
      ? "Pending external research layer: raw web results are evidence only; ask for confirmation before saving or using them as Project.vibe facts."
      : "Pending external research layer: none.",
    `Research goal: ${preflight.query}`,
    `Research summary: ${preflight.card.summary}`,
    preflight.contentCards.length
      ? `Content cards: ${preflight.contentCards.map((card) => `${card.title}=${card.bullets.join(" / ")}`).join(" || ")}`
      : "",
    preflight.card.styleIntent ? `Style intent: ${preflight.card.styleIntent}` : "",
    preflight.card.directorGrammar.length ? `Director grammar: ${preflight.card.directorGrammar.join(" / ")}` : "",
    preflight.card.animeCoverageHints.length ? `Anime coverage hints: ${preflight.card.animeCoverageHints.join(" / ")}` : "",
    preflight.card.actionRules.length ? `Action rules: ${preflight.card.actionRules.join(" / ")}` : "",
    preflight.card.referenceRules.length ? `Reference rules: ${preflight.card.referenceRules.join(" / ")}` : "",
    preflight.card.promptCompilerNotes.length ? `Prompt compiler notes: ${preflight.card.promptCompilerNotes.join(" / ")}` : "",
    preflight.card.homageBoundary.length ? `Homage boundary: ${preflight.card.homageBoundary.join(" / ")}` : "",
    preflight.pendingWebSearchResults.length
      ? `Pending web research requires confirmation before Project.vibe facts: ${preflight.pendingWebSearchResults.map((result) => result.evidenceRef).join(", ")}`
      : "",
    preflight.suggestedWebQueries.length
      ? `Optional future web queries: ${preflight.suggestedWebQueries.join(" | ")}`
      : "",
  ].filter(Boolean);
}
