import {
  activeAgentDirectorClarificationFromTimeline,
  agentDirectorClarificationReplyIntent,
  buildAgentDirectorClarificationResolutionTimelineEntry,
  buildAgentDirectorClarificationTimelineEntries,
  buildAgentDirectorClarificationTurn,
} from "../src/ui/director/agentDirectorClarification.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const clarification = buildAgentDirectorClarificationTurn({
  userIntent: "P6S01 需要修改：纸飞机亮得太早了。",
  selectedShotId: "P6S01",
  targetLabel: "P6S01",
  createdAt: "2026-07-17T01:00:00.000Z",
});
assert(clarification, "an ambiguous timing complaint should request clarification");
assert(clarification.options.length === 2, "a clarification should expose two bounded choices");
assert(clarification.options[0]?.label === "情绪转折", "the early-timing clarification should offer a delayed emotional turn");
assert(clarification.options[1]?.label === "提前预兆", "the early-timing clarification should offer a softer foreshadowing choice");
assert(clarification.boundary.includes("不会写项目"), "clarification must state its no-write boundary");

assert(!buildAgentDirectorClarificationTurn({
  userIntent: "把发光延后到递交动作完成后。",
  selectedShotId: "P6S01",
}), "an explicit timing direction should proceed directly to a proposal");
assert(!buildAgentDirectorClarificationTurn({
  userIntent: "纸飞机亮得太早了。",
}), "clarification must not invent a target without a selected shot");
assert(!buildAgentDirectorClarificationTurn({
  userIntent: "纸飞机亮得太早了。",
  selectedShotId: "P6S01",
  hasAttachments: true,
}), "attachment-backed feedback should stay on the existing intake path");

const explicitClarification = buildAgentDirectorClarificationTurn({
  userIntent: "还是太直白了，想更含蓄一点。先问我你真正需要知道的，不要直接改。",
  selectedShotId: "draft-shot-1",
  targetLabel: "当前草案",
  createdAt: "2026-07-22T12:00:00.000Z",
});
assert(explicitClarification, "an explicit ask to clarify before editing must enter a clarification turn");
assert(explicitClarification.question.includes("保留现有故事事实"), "explicit clarification should ask which facts are protected");
assert(explicitClarification.options[0]?.id === "preserve_story_facts", "explicit clarification should offer a fact-preserving direction");
assert(explicitClarification.options[1]?.id === "allow_story_restructure", "explicit clarification should offer a bounded restructure direction");
assert(
  agentDirectorClarificationReplyIntent(explicitClarification, "保留保洁员和发光纸鹤，但不要解释纸鹤为什么发光。")
    === "保留保洁员和发光纸鹤，但不要解释纸鹤为什么发光。",
  "a freeform reply to an explicit clarification request must not carry the old meta instruction into the proposal intent",
);

const naturalDeferredClarification = buildAgentDirectorClarificationTurn({
  userIntent: "我还没想清楚“像记忆”应该靠光线还是动作。你先问我一个关键问题，再动草案。",
  selectedShotId: "pending-new-video-draft",
  targetLabel: "当前草案",
  createdAt: "2026-07-22T12:10:00.000Z",
});
assert(naturalDeferredClarification, "a natural ask to question first and edit afterward must enter clarification");
assert(naturalDeferredClarification.selectedShotId === "pending-new-video-draft", "pending draft clarification must keep its draft target");
assert(naturalDeferredClarification.boundary.includes("不会写项目"), "natural deferred clarification must preserve the conversation-only boundary");

const entries = buildAgentDirectorClarificationTimelineEntries(clarification, "2026-07-17T01:00:00.000Z");
const restored = activeAgentDirectorClarificationFromTimeline(entries);
assert(restored?.id === clarification.id, "an unresolved clarification should restore from the Agent timeline");
assert(
  agentDirectorClarificationReplyIntent(restored!, "情绪转折").includes("主要动作"),
  "a structured quick reply should resolve to a concrete proposal intent",
);

const resolved = activeAgentDirectorClarificationFromTimeline([
  ...entries,
  {
    id: "proposal-user",
    type: "user_message",
    createdAt: "2026-07-17T01:00:01.000Z",
    title: "你",
    body: "延后到动作完成后",
    status: "done",
  },
  {
    id: "proposal-confirmation",
    type: "confirmation_request",
    createdAt: "2026-07-17T01:00:02.000Z",
    title: "确认镜头修改",
    body: "确认后写入项目",
    actionId: "action-p6s01-change",
    status: "waiting",
  },
]);
assert(!resolved, "a later proposal should resolve the previous clarification on restore");

const resolutionMarker = buildAgentDirectorClarificationResolutionTimelineEntry({
  turn: clarification,
  option: clarification.options[0]!,
  createdAt: "2026-07-17T01:00:03.000Z",
});
const resolvedWithOlderProposalTimeline = activeAgentDirectorClarificationFromTimeline([
  {
    id: "proposal-confirmation-with-older-clock",
    type: "confirmation_request",
    createdAt: "2026-07-17T00:59:59.000Z",
    title: "确认镜头修改",
    body: "确认后写入项目",
    actionId: "action-p6s01-change-older-clock",
    status: "waiting",
  },
  ...entries,
  resolutionMarker,
]);
assert(!resolvedWithOlderProposalTimeline, "a structured choice marker must resolve clarification even when a staged proposal carries an older clock");

console.log("agent director clarification: ok");
