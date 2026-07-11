import {
  directorIntentCanStartNewVideoPlanningWithoutProject,
  directorIntentStartsFreshVideoDraft,
} from "../src/core/directorFreshDraftIntent";
import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
} from "../src/core/directorAgentAction";
import {
  buildProjectObservation,
  requestedStoryboardShotCountFromIntent,
  routeProjectAgentIntent,
} from "../src/core/projectAgentWorkspace";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const freshIdeas = [
  "做一个 12 秒 90 年代日漫感小短片：午夜天桥下，一台旧自动售货机吐出一张发光车票，戴耳机的女高中生追着蓝光跑向最后一班电车。先只整理故事、镜头和节奏，不生成参考，不提交视频。",
  "做一个 12 秒 90 年代日漫感短片：雨夜旧巴士站，一个戴耳机的女高中生发现长椅下有一只黑猫叼着发光车票。请先整理故事、镜头和节奏，普通 Seedance 会很慢，先不要自动提交视频。",
  "新建一个 15 秒赛博朋克广告项目，先拆故事和镜头，不要生图。",
  "从零开始一个新视频：地铁末班车里，保洁员捡到一张会变化日期的旧车票。",
  "来一支群像 OP，五个角色在雨夜电车站依次亮相，只规划。",
  "重新做一个汽车山路追逐短片，先整理。",
];
const emptyProjectStorySeeds = [
  "夜班电梯里，一个保安收到来自明天的楼层提示。",
];

const currentObjectFeedback = [
  "这个镜头重做一下，动作更快一点，别新开项目。",
  "这一段做一个慢推，情绪再压一点。",
  "把当前选中的镜头改成特写，不要动整个项目。",
  "shot 1-2 做一个更明确的手部动作。",
];
const existingProjectReferenceCommand = "可以，允许生成参考，先补齐这个项目的角色、场景、道具和需要的故事板参考；不要提交视频。";
const materialBindingCommand = "只整理一下当前素材绑定建议，不生成参考，不提交视频。";
const explainOnlyCommand = "只告诉我接下来要做什么，不要执行、不写项目、不提交视频。";
const emptyProjectStatusQuestion = "现在项目状态怎么样？";

for (const idea of freshIdeas) {
  assert(directorIntentStartsFreshVideoDraft(idea), `fresh video idea should open a new draft: ${idea}`);
  assert(directorIntentCanStartNewVideoPlanningWithoutProject(idea), `fresh video idea should be allowed to plan before project setup: ${idea}`);
}
for (const idea of emptyProjectStorySeeds) {
  assert(directorIntentCanStartNewVideoPlanningWithoutProject(idea), `story seed should start planning in an empty project: ${idea}`);
}

for (const feedback of currentObjectFeedback) {
  assert(!directorIntentStartsFreshVideoDraft(feedback), `selected-object feedback must not open a new draft: ${feedback}`);
}
assert(!directorIntentStartsFreshVideoDraft(existingProjectReferenceCommand), "existing-project reference command must not open a new draft");
assert(!directorIntentCanStartNewVideoPlanningWithoutProject(existingProjectReferenceCommand), "existing-project reference command must not route to new-video planning without a project");
assert(!directorIntentStartsFreshVideoDraft(materialBindingCommand), "material binding review must not open a new draft");
assert(!directorIntentCanStartNewVideoPlanningWithoutProject(materialBindingCommand), "material binding review must not route to new-video planning without a project");
assert(!directorIntentStartsFreshVideoDraft(explainOnlyCommand), "explain-only next-step request must not open a new draft");
assert(!directorIntentCanStartNewVideoPlanningWithoutProject(explainOnlyCommand), "explain-only next-step request must not route to new-video planning without a project");
assert(!directorIntentCanStartNewVideoPlanningWithoutProject(emptyProjectStatusQuestion), "empty-project status questions must not route to new-video planning");

const currentProjectRuntimeState = {
  project: { title: "已有项目" },
  storyFlow: {
    sections: [{ id: "section_1", title: "开场", shotIds: ["shot_1"] }],
    shots: [
      { id: "shot_1", title: "开场", description: "已有镜头", status: "ready" },
    ],
  },
  visualMemory: { assets: [], summary: { locked: 0, needsReview: 0, missing: 1 } },
  previewExport: { draftPreview: { events: [] } },
} as never;

const observation = buildProjectObservation({
  localProjectReady: false,
  projectTitle: "已有项目",
  sectionCount: 1,
  shotCount: 1,
  selectedShotCount: 1,
  referenceMissingCount: 1,
  referenceReviewCount: 0,
  referenceReadyCount: 0,
  videoStatus: "idle",
  videoStatusLabel: "未生成",
  videoDetail: "",
  videoWaitingCount: 0,
  videoCompletedCount: 0,
  videoReviewCount: 0,
  videoCanResume: false,
  image2Running: false,
});

const currentProjectSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: currentProjectRuntimeState,
  currentView: "story",
  selectedShotId: "shot_1",
  selectedShotIds: ["shot_1"],
});

const routedFresh = routeProjectAgentIntent({
  text: freshIdeas[0],
  hasSelection: true,
  observation,
});
assert(routedFresh.kind === "story", "fresh video idea should route to story planning even when a shot is selected");
assert(routedFresh.label === "整理新故事", "fresh video idea should be labeled as a new-story draft");

const routedFeedback = routeProjectAgentIntent({
  text: currentObjectFeedback[0],
  hasSelection: true,
  observation,
});
assert(routedFeedback.kind === "revision", "current selected-shot feedback should stay in revision route");

const shotCountRestructureText = "改成 3 个镜头";
assert(requestedStoryboardShotCountFromIntent(shotCountRestructureText) === 3, "shot-count restructure intent should parse the requested count");
const routedShotCountRestructure = routeProjectAgentIntent({
  text: shotCountRestructureText,
  hasSelection: true,
  observation,
});
assert(routedShotCountRestructure.kind === "revision", "shot-count restructure should stay in the current story instead of opening a fresh project");
assert(routedShotCountRestructure.label === "重排为 3 个镜头", "shot-count restructure must show a story-level rewrite label instead of generic selected-shot feedback");

const shotCountRestructureAction = buildDirectorAgentActionEnvelope({
  userIntent: shotCountRestructureText,
  snapshot: currentProjectSnapshot,
});
assert(shotCountRestructureAction.kind === "revise_story_or_shot", "shot-count restructure should remain a project-write revision action");
assert(shotCountRestructureAction.target.kind === "project", "shot-count restructure must target the whole story even when a shot is selected");
assert(shotCountRestructureAction.summary.includes("3 个镜头"), "shot-count restructure summary should name the requested count");
assert(shotCountRestructureAction.userFacingMessage.includes("不会生成参考"), "shot-count restructure must preserve the no-generation boundary");
assert(
  shotCountRestructureAction.proposedChanges.some((change) => change.field === "storyShotCount" && change.to === "3 个镜头"),
  "shot-count restructure should stage the requested story shot count as an explicit project-level change",
);

const savedStoryShotCountNoGenerationText = "改成 3 个镜头：第一镜保留快递员递出发光旧怀表，第二镜女孩戴着耳机抬头看广告牌，第三镜城市广告牌变成海浪。不要生成参考图，不提交视频。";
const routedSavedStoryShotCountNoGeneration = routeProjectAgentIntent({
  text: savedStoryShotCountNoGenerationText,
  hasSelection: true,
  observation,
});
assert(routedSavedStoryShotCountNoGeneration.kind === "revision", "saved-story shot-count restructuring with no-reference/no-video boundaries must stay in the current story route");
assert(routedSavedStoryShotCountNoGeneration.label === "重排为 3 个镜头", "saved-story shot-count restructuring must preview the target shot count instead of a new-story draft");

const routedReferenceCommand = routeProjectAgentIntent({
  text: existingProjectReferenceCommand,
  hasSelection: true,
  observation,
});
assert(routedReferenceCommand.kind === "reference", "existing-project reference command should route to reference generation");
assert(routedReferenceCommand.confirmation === "reference_generation", "existing-project reference command should keep reference confirmation");

const routedExplainOnlyCommand = routeProjectAgentIntent({
  text: explainOnlyCommand,
  hasSelection: true,
  observation,
});
assert(routedExplainOnlyCommand.kind === "status", "explain-only next-step request should route to status instead of fresh draft or revision");
assert(routedExplainOnlyCommand.confirmation === "none", "explain-only next-step request should not ask for project write confirmation");

console.log("director-fresh-draft-intent-test: ok");
