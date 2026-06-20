import {
  directorIntentCanStartNewVideoPlanningWithoutProject,
  directorIntentStartsFreshVideoDraft,
} from "../src/core/directorFreshDraftIntent";
import { buildProjectObservation, routeProjectAgentIntent } from "../src/core/projectAgentWorkspace";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const freshIdeas = [
  "做一个 12 秒 90 年代日漫感小短片：午夜天桥下，一台旧自动售货机吐出一张发光车票，戴耳机的女高中生追着蓝光跑向最后一班电车。先只整理故事、镜头和节奏，不生成参考，不提交视频。",
  "新建一个 15 秒赛博朋克广告项目，先拆故事和镜头，不要生图。",
  "来一支群像 OP，五个角色在雨夜电车站依次亮相，只规划。",
  "重新做一个汽车山路追逐短片，先整理。",
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

for (const idea of freshIdeas) {
  assert(directorIntentStartsFreshVideoDraft(idea), `fresh video idea should open a new draft: ${idea}`);
  assert(directorIntentCanStartNewVideoPlanningWithoutProject(idea), `fresh video idea should be allowed to plan before project setup: ${idea}`);
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

const observation = buildProjectObservation({
  runtimeState: {
    project: { title: "已有项目" },
    storyFlow: {
      shots: [
        { id: "shot_1", title: "开场", description: "已有镜头", status: "ready" },
      ],
    },
    visualMemory: { assets: [], summary: { locked: 0, needsReview: 0, missing: 1 } },
    previewExport: { draftPreview: { events: [] } },
  } as never,
  selectedShotId: "shot_1",
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
