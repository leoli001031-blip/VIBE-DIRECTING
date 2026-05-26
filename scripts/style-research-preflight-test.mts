import {
  buildStyleResearchPreflight,
  formatStyleResearchPreflightForPrompt,
} from "../src/core/styleResearchPreflight.ts";
import { buildScriptStoryboardPromptPack } from "../src/core/scriptStoryboardPromptPack.ts";
import {
  estimateKnowledgeTokens,
  stableKnowledgeHash,
} from "../src/core/knowledgeManifest.ts";
import { buildProjectLocalKnowledgePackFromWebSearch } from "../src/core/projectLocalKnowledge.ts";
import type { AgentWebSearchResult } from "../src/core/agentWebSearchClient.ts";
import type { KnowledgePack, KnowledgeSnippet } from "../src/core/knowledgeTypes.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function snippet(input: {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}): KnowledgeSnippet {
  return {
    ...input,
    summary: input.content.replace(/\s+/g, " ").slice(0, 220),
    tokenEstimate: estimateKnowledgeTokens(input.content),
    hash: stableKnowledgeHash(`${input.title}\n${input.content}`),
    sourceHeading: input.title,
  };
}

function knowledgePack(input: {
  id: string;
  category: KnowledgePack["category"];
  type?: KnowledgePack["type"];
  title: string;
  summary: string;
  tags: string[];
  snippets: KnowledgeSnippet[];
}): KnowledgePack {
  const createdAt = "2026-05-22T09:00:00.000Z";
  const hash = stableKnowledgeHash(JSON.stringify({
    id: input.id,
    snippets: input.snippets.map((item) => item.hash),
  }));
  return {
    id: input.id,
    version: "1.0.0",
    hash,
    path: `resources/knowledge/${input.id}.md`,
    type: input.type || "system_builtin",
    category: input.category,
    title: input.title,
    summary: input.summary,
    tags: input.tags,
    applicableTaskPurposes: ["script", "asset", "keyframe", "video", "qa"],
    applicableProviderSlots: ["image.generate", "image.reference_asset", "video.i2v"],
    dependencies: [],
    conflicts: [],
    maxInjectionTokens: 900,
    trustLevel: "trusted",
    verificationStatus: "not_required",
    enabled: true,
    defaultEnabled: true,
    createdAt,
    updatedAt: createdAt,
    snippets: input.snippets,
  };
}

function mockWebResult(): AgentWebSearchResult {
  return {
    kind: "agent_web_search_result",
    status: "succeeded",
    provider: "tavily_search",
    query: "Japanese TV anime storyboard hand insert reaction shot grammar",
    purpose: "style_research",
    resultCount: 2,
    citations: [
      {
        rank: 1,
        title: "Anime storyboard reaction grammar",
        url: "https://example.test/anime-storyboard-reaction",
        domain: "example.test",
        snippet: "Set up screen direction, cut to hand insert, hold the reaction, then return to relationship space.",
        source: "tavily_search",
        hash: "web_001",
      },
      {
        rank: 2,
        title: "Quiet romance shot coverage",
        url: "https://example.test/quiet-romance-coverage",
        domain: "example.test",
        snippet: "Use pauses, eyeline pressure, object handoff, and listener reaction instead of flat two-shots.",
        source: "tavily_search",
        hash: "web_002",
      },
    ],
    evidenceRef: "web-search#evidence/style/anime-reaction.json",
    evidencePath: "evidence/style/anime-reaction.json",
    retrievedAt: "2026-05-22T09:02:00.000Z",
    networkCalled: true,
    reviewRequired: true,
    promotionAllowed: false,
    warnings: [],
  };
}

const localPacks = [
  knowledgePack({
    id: "prompt/anime-storyboard-coverage",
    category: "prompt",
    title: "日漫分镜覆盖提示词",
    summary: "把日漫式关系镜头拆成空间、动作插入、眼神和反应，而不是平铺对视。",
    tags: ["日漫", "anime", "分镜", "动作", "手部", "眼神", "提示词"],
    snippets: [
      snippet({
        id: "anime-coverage",
        title: "日漫关系动作覆盖",
        content: "递东西、对视和迟疑不要写成一个平铺镜头。先用远一点的关系景别锁空间，再切手部或道具插入，随后给眼神特写和对方反应。",
        keywords: ["日漫", "anime", "分镜", "递", "手部", "眼神", "反应"],
      }),
      snippet({
        id: "start-frame-before-action",
        title: "起始帧是动作前一拍",
        content: "给视频模型的起始帧应停在动作发生前一拍，让动作原因和后续微反应都能被模型接住。",
        keywords: ["起始帧", "动作前一拍", "微反应", "video"],
      }),
    ],
  }),
  knowledgePack({
    id: "composition/multi-character-blocking",
    category: "composition",
    title: "多人分镜站位",
    summary: "多人场景先锁轴线、左右站位、行动方和反应方。",
    tags: ["多人", "站位", "180度轴线", "对视", "blocking"],
    snippets: [
      snippet({
        id: "actor-reactor",
        title: "行动方和反应方",
        content: "两人以上不能平均表演。先写谁行动，谁反应，谁在画面左侧，谁在画面右侧，再决定正反打、过肩或插入特写。",
        keywords: ["多人", "行动", "反应", "对视", "递"],
      }),
    ],
  }),
];

const localPreflight = buildStyleResearchPreflight({
  userIntent: "我想要青春日漫的感觉，递东西时不要平铺，要远景、手部特写、眼神反应，动作别僵硬。",
  styleIntent: "quiet Japanese TV anime, restrained teen romance",
  scriptText: "雨后天台，短发少女把旧磁带递给少年，两个人都没有立刻说破。",
  availablePacks: localPacks,
  createdAt: "2026-05-22T09:05:00.000Z",
});

assert(localPreflight.status === "ready", "local preflight should be ready without web search");
assert(localPreflight.knowledgeLayers.localBuiltIn.ready, "local built-in knowledge layer should be ready");
assert(!localPreflight.knowledgeLayers.projectInternalized.ready, "project internalized layer should be empty before saving web research");
assert(localPreflight.knowledgeLayers.pendingExternal.resultCount === 0, "local-only preflight should have no pending web results");
assert(localPreflight.card.animeCoverageHints.some((line) => line.includes("起始帧")), "anime preflight should guide start frame timing");
assert(localPreflight.contentCards.some((card) => card.kind === "storyboard_pacing" && card.title === "分镜节奏卡"), "preflight should expose storyboard pacing as a content card");
assert(localPreflight.contentCards.every((card) => card.reusableAsAsset), "ready local content cards should be reusable assets");
assert(formatStyleResearchPreflightForPrompt(localPreflight).join("\n").includes("Local knowledge layer"), "prompt format should expose local layer");
assert(formatStyleResearchPreflightForPrompt(localPreflight).join("\n").includes("Content cards"), "prompt format should include content cards");

const missingPreflight = buildStyleResearchPreflight({
  userIntent: "我想做一个陌生小众导演风格的短片，需要先查资料。",
  styleIntent: "unknown niche style",
  availablePacks: [],
  createdAt: "2026-05-22T09:06:00.000Z",
});
assert(missingPreflight.status === "needs_external_research", "missing knowledge should request external research");
assert(missingPreflight.suggestedWebQueries.length > 0, "external research preflight should suggest web queries");

const webOnlyPreflight = buildStyleResearchPreflight({
  userIntent: "查一下日漫递东西的镜头覆盖方式，之后保存成参考。",
  styleIntent: "Japanese TV anime handoff coverage",
  availablePacks: [],
  webSearchResults: [mockWebResult()],
  createdAt: "2026-05-22T09:07:00.000Z",
});
assert(webOnlyPreflight.status === "needs_user_confirmation", "raw web research should require confirmation");
assert(webOnlyPreflight.knowledgeLayers.pendingExternal.requiresConfirmation, "pending external layer should require confirmation");
assert(webOnlyPreflight.reusePolicy.rawWebSnippetsNeverBecomeProjectFacts, "raw web snippets must never become project facts directly");
assert(webOnlyPreflight.contentCards.every((card) => card.status === "needs_confirmation" && !card.reusableAsAsset), "raw web content cards must wait for confirmation before reuse");

const projectPack = buildProjectLocalKnowledgePackFromWebSearch({
  result: mockWebResult(),
  userIntent: "日漫递东西镜头覆盖方式",
  projectId: "project-style-preflight",
  projectTitle: "Style Preflight",
  createdAt: "2026-05-22T09:08:00.000Z",
});
const projectPreflight = buildStyleResearchPreflight({
  projectId: "project-style-preflight",
  userIntent: "继续使用之前保存的日漫递东西镜头覆盖方式。",
  styleIntent: "Japanese TV anime handoff coverage",
  availablePacks: [...localPacks, projectPack],
  createdAt: "2026-05-22T09:09:00.000Z",
});
assert(projectPreflight.status === "ready", "confirmed project-local research should be reusable");
assert(projectPreflight.knowledgeLayers.projectInternalized.ready, "project internalized layer should be ready after saving research");
assert(formatStyleResearchPreflightForPrompt(projectPreflight).join("\n").includes("Internalized project research"), "prompt format should expose internalized research layer");

const scene: StoryboardReferenceAsset = {
  id: "scene_rooftop",
  role: "scene_baseline",
  path: "assets/scenes/rooftop.png",
  label: "雨后天台",
};
const hina: StoryboardReferenceAsset = {
  id: "char_hina",
  role: "character_identity",
  path: "assets/characters/hina.png",
  label: "短发少女日奈",
};
const ren: StoryboardReferenceAsset = {
  id: "char_ren",
  role: "character_identity",
  path: "assets/characters/ren.png",
  label: "少年莲",
};
const cassette: StoryboardReferenceAsset = {
  id: "prop_cassette",
  role: "prop_reference",
  path: "assets/props/cassette.png",
  label: "蓝色磁带盒",
};

const promptPack = buildScriptStoryboardPromptPack({
  title: "雨后旧磁带",
  logline: "短发少女把旧磁带递给少年。",
  completeScript: "雨后天台，日奈把旧磁带递给莲，两个人隔着一小段距离沉默。",
  style: "quiet Japanese TV anime",
  styleResearchPreflight: projectPreflight,
  storyboardOutputDir: "outputs/storyboards",
  videoOutputDir: "outputs/video",
  referenceBundle: {
    scenes: [scene],
    characters: [hina, ren],
    props: [cassette],
  },
  shots: [
    {
      shotId: "S01",
      title: "递出磁带前的一拍",
      durationSeconds: 4,
      executionMode: "relationship_wide",
      sceneId: scene.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "宽中景",
      camera: "远一点的双人关系镜头，日奈在左，莲在右，镜头轻微推进。",
      frameDescription: "日奈把磁带从胸口慢慢递出，但莲的手还没有接近。",
      actionBeats: ["日奈手臂开始伸出", "莲停住", "两人之间留出空间"],
      primaryAction: "日奈把磁带慢慢递向莲",
      actionTrigger: "她决定不再把磁带藏起来",
      microReaction: "莲停住半拍",
      actorAction: "日奈手臂开始伸出",
      reactorResponse: "莲停住半拍，没有马上接",
      dialogue: "-",
      sound: "雨水滴落。",
    },
  ],
});

const imagePrompt = promptPack.shots[0]?.image2StoryboardPlan?.prompt || "";
const seedancePrompt = promptPack.shots[0]?.seedanceVideoPlan?.prompt || "";
assert(promptPack.styleResearchPreflight?.preflightId === projectPreflight.preflightId, "prompt pack should retain style preflight");
assert(promptPack.rules.styleResearchRole.includes("local knowledge"), "prompt pack should document style research role");
assert(imagePrompt.includes("Style research preflight"), "Image2 storyboard prompt should receive style research preflight");
assert(imagePrompt.includes("日漫覆盖") || imagePrompt.includes("Anime coverage"), "Image2 storyboard prompt should include anime coverage guidance");
assert(seedancePrompt.includes("Style research preflight"), "Seedance prompt should receive style research preflight");
assert(seedancePrompt.includes("Homage boundary"), "Seedance prompt should carry homage boundary");

console.log(`style-research-preflight-test: ok local=${localPreflight.preflightId} project=${projectPreflight.preflightId}`);
