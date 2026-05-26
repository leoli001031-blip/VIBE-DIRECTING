import {
  buildDirectorSessionFromIntake,
} from "../src/core/directorSession.ts";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";
import {
  buildStoryDiscussionWorkspace,
  confirmStoryDiscussionDeltas,
  stageStoryDiscussionTurn,
  validateStoryDiscussionWorkspace,
} from "../src/core/storyDiscussionWorkspace.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const createdAt = "2026-05-18T09:00:00.000Z";
const draft = buildProjectIntakeDraft({
  createdAt,
  scriptText: "一位摄影师在雨夜回到旧楼下，她想找到父亲留下的相机，但暴雨让楼道停电。后来她听见旧录音里的声音，最后决定拍下清晨的第一束光。",
  styleNote: "低饱和、潮湿、克制。",
  referenceAssets: [
    { id: "char_lead", type: "character", label: "主角正面参考", note: "2 MB" },
    { id: "scene_old_building", type: "scene", label: "旧楼楼道", note: "1.5 MB" },
    { id: "voice_father", type: "audio", label: "父亲音色参考", note: "18 秒" },
  ],
});
const projection = buildIntakeStagedPlanProjection(draft);
const session = buildDirectorSessionFromIntake({
  draft,
  projection,
  projectId: "story_discussion_project",
  createdAt,
});
const workspace = buildStoryDiscussionWorkspace({ session, createdAt });
const validation = validateStoryDiscussionWorkspace(workspace);

assert(validation.ok, `discussion workspace should validate: ${validation.errors.join("; ")}`);
assert(workspace.status === "ready_for_discussion", "complete draft should be ready for discussion");
assert(workspace.hardLocks.userFeedbackIsConversationOnly === true, "feedback must stay conversation-only");
assert(workspace.hardLocks.projectFactWriteAllowed === false, "discussion must not write project facts");
assert(workspace.hardLocks.remoteGenerationAllowed === false, "discussion must not trigger generation");
assert(workspace.hardLocks.formalTaskCreationAllowed === false, "discussion must not create formal tasks");
assert(workspace.turns.every((turn) => turn.rawTextMayBecomeProjectFact === false), "turns must never become project facts directly");
assert(workspace.stagedDeltas.length === 0, "fresh discussion workspace should not invent feedback deltas");

const characterLane = workspace.lanes.find((lane) => lane.id === "characters");
const sceneLane = workspace.lanes.find((lane) => lane.id === "scenes");
const audioLane = workspace.lanes.find((lane) => lane.id === "audio");
const storyboardLane = workspace.lanes.find((lane) => lane.id === "storyboard");

assert(characterLane && characterLane.count >= 1, "characters lane should include role candidates");
assert(sceneLane && sceneLane.count >= 1, "scenes lane should include scene or prop candidates");
assert(audioLane && audioLane.count >= 1, "audio lane should include audio needs");
assert(storyboardLane && storyboardLane.count >= 1, "storyboard lane should include shot drafts");
assert(audioLane.status === "ready", "audio lane should be ready when an audio reference exists");

const characterFeedback = stageStoryDiscussionTurn({
  workspace,
  text: "主角需要先做多视角，第二张图更像她的侧脸。",
  createdAt: "2026-05-18T09:01:00.000Z",
});
assert(characterFeedback.turns.length === workspace.turns.length + 2, "feedback should append a user turn and a director turn");
assert(characterFeedback.turns.at(-2)?.focus === "character", "character feedback should focus the character lane");
assert(characterFeedback.nextActionLabel === "确认 1 条修改", "character feedback should stage a confirmable delta");
assert(characterFeedback.turns.at(-1)?.text.includes("多视角"), "director reply should acknowledge character reference direction");
assert(
  characterFeedback.stagedDeltas.some((delta) => (
    delta.kind === "character_multiview_request"
    && delta.needsUserConfirmation
    && delta.canWriteProjectFactNow === false
  )),
  "character feedback should stage a multiview delta that cannot write project facts yet",
);

const audioFeedback = stageStoryDiscussionTurn({
  workspace: characterFeedback,
  text: "音频后面要接音色克隆，父亲的旁白先作为声音参考。",
  createdAt: "2026-05-18T09:02:00.000Z",
});
assert(audioFeedback.turns.at(-2)?.focus === "audio", "audio feedback should focus the audio lane");
assert(audioFeedback.nextActionLabel === "确认 1 条修改", "audio feedback should stage a confirmable delta");
assert(audioFeedback.stagedDeltas.some((delta) => delta.kind === "audio_clone_source"), "audio feedback should stage audio clone source delta");
assert(validateStoryDiscussionWorkspace(audioFeedback).ok, "workspace should stay valid after feedback");

const storyboardFeedback = stageStoryDiscussionTurn({
  workspace: audioFeedback,
  text: "第三个镜头节奏慢一点，最后再加一个清晨空镜。",
  createdAt: "2026-05-18T09:03:00.000Z",
});
assert(storyboardFeedback.turns.at(-2)?.focus === "storyboard", "storyboard feedback should focus the storyboard lane");
assert(storyboardFeedback.nextActionLabel === "确认 2 条修改", "storyboard feedback should stage timing and add/remove deltas");
assert(storyboardFeedback.stagedDeltas.some((delta) => delta.kind === "storyboard_timing_adjustment"), "storyboard timing delta missing");
assert(storyboardFeedback.stagedDeltas.some((delta) => delta.kind === "storyboard_add_remove"), "storyboard add/remove delta missing");
assert(
  storyboardFeedback.stagedDeltas.every((delta) => delta.needsUserConfirmation && delta.canWriteProjectFactNow === false),
  "all feedback deltas should require user confirmation",
);
const animeRevisionFeedback = stageStoryDiscussionTurn({
  workspace: storyboardFeedback,
  text: "动作太平，想要日漫里远景-表情特写-手部动作特写的节奏，不要广告感，镜头多拆一点。",
  createdAt: "2026-05-18T09:03:30.000Z",
});
assert(animeRevisionFeedback.turns.at(-2)?.focus === "storyboard", "anime rhythm feedback should stay in storyboard lane");
assert(
  animeRevisionFeedback.stagedDeltas.some((delta) => (
    delta.kind === "storyboard_style_revision"
    && delta.revisionSummary?.requestedRhythmProfile === "action_fast_cut"
    && delta.revisionSummary?.avoidStyle.includes("广告感")
  )),
  "anime rhythm feedback should stage a style/rhythm revision summary",
);
assert(
  animeRevisionFeedback.stagedDeltas.some((delta) => (
    delta.kind === "storyboard_split_preference"
    && delta.revisionSummary?.requestedSplitPolicy === "more_micro_shots"
    && delta.summary.includes("确认前只作为待修改")
  )),
  "anime rhythm feedback should stage a split preference without writing project facts",
);
assert(
  animeRevisionFeedback.stagedDeltas
    .filter((delta) => delta.sourceTurnId === animeRevisionFeedback.turns.at(-2)?.id)
    .every((delta) => delta.revisionSummary?.projectFactWriteBlocked === true && delta.canWriteProjectFactNow === false),
  "director revision summaries must keep Project.vibe writes blocked",
);
const confirmedFeedback = confirmStoryDiscussionDeltas({
  workspace: animeRevisionFeedback,
  createdAt: "2026-05-18T09:04:00.000Z",
});
assert(confirmedFeedback.nextActionLabel === "确认草案", "confirmed deltas should return the user to draft confirmation");
assert(
  confirmedFeedback.stagedDeltas.every((delta) => delta.status === "confirmed" && delta.confirmedAt === "2026-05-18T09:04:00.000Z"),
  "confirmed deltas should be marked before entering Project.vibe staged transaction",
);
assert(confirmedFeedback.turns.at(-1)?.text.includes("已确认"), "confirmation should append a creator-facing acknowledgement");

const sparseDraft = buildProjectIntakeDraft({ createdAt, scriptText: "" });
const sparseSession = buildDirectorSessionFromIntake({
  draft: sparseDraft,
  projection: buildIntakeStagedPlanProjection(sparseDraft),
  createdAt,
});
const sparseWorkspace = buildStoryDiscussionWorkspace({ session: sparseSession, createdAt });
assert(sparseWorkspace.status === "needs_script", "empty draft should ask for script before discussion");
assert(validateStoryDiscussionWorkspace(sparseWorkspace).warnings.includes("No storyboard lane items yet."), "empty draft should warn when no storyboard exists");

const serialized = JSON.stringify([workspace, characterFeedback, audioFeedback, storyboardFeedback, confirmedFeedback, sparseWorkspace]);
for (const pattern of [
  /\bTaskEnvelope\b/,
  /\bGenerationJob\b/,
  /\bproviderId\b/,
  /\bapi[-_\s]?key\b/i,
  /\btoolCalls\b/,
  /\bsubmit[-_\s]?live\b/i,
]) {
  assert(!pattern.test(serialized), `discussion workspace must not expose execution semantics: ${pattern}`);
}

console.log(
  `story-discussion-workspace-test: lanes=${workspace.lanes.length}, turns=${confirmedFeedback.turns.length}, deltas=${confirmedFeedback.stagedDeltas.length}.`,
);
