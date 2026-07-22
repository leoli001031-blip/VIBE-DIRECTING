import assert from "node:assert/strict";

import { buildVibeAgentIntakeTimelineEntries } from "../src/agent-core/intakeTimeline";
import type { VibeAgentTimelineEntry } from "../src/agent-core/types";
import { recoverPendingNewVideoIntake } from "../src/core/newVideoIntakeRecovery";

function intake(
  createdAt: string,
  phase: "planning_started" | "planning_ready" | "planning_blocked" | "draft_confirmed",
  draftScript = "清晨菜市场，老人提着空菜篮。",
  draftStoryboardRows?: unknown[],
) {
  return buildVibeAgentIntakeTimelineEntries({
    createdAt,
    phase,
    userMessage: phase === "draft_confirmed" ? "确认草案" : draftScript,
    draftScript: phase === "draft_confirmed" ? undefined : draftScript,
    draftStyle: "克制写实",
    projectTargetMode: "new_project",
    shotCount: 2,
    draftStoryboardRows,
  });
}

const revisedStoryboardRow = {
  id: "shot_2",
  shotNo: "1-2",
  duration: "4 秒",
  shotSize: "中近景",
  camera: "平视近侧面，缓慢推进",
  visualDescription: "老人用空菜篮挡住阳光，透明鱼逐渐淡去。",
  primaryAction: "老人挡住阳光后停半拍",
  actionTrigger: "阳光照进水洼",
  microReaction: "老人安静看向水面",
  actionReactionQa: "动作和反应保持同一空间轴线",
  executionMode: "single_continuous_shot",
  referenceStrategy: "omni_reference",
  visibleCutBudget: "单镜头",
  visibleClips: 1,
  storyboardPanels: 1,
  actionBeats: ["举起菜篮", "挡住阳光", "透明鱼淡去"],
  subtitle: "-",
  sound: "清晨市场环境声",
  title: "透明鱼淡去",
  characters: "老人",
  scene: "清晨菜市场",
  props: "空菜篮、透明鱼",
  audioUsage: "保留现场声",
  rhythmProfile: "lyrical_observation",
  rhythmReason: "用停顿保留余味",
};

const firstReadyAt = "2026-07-23T01:00:00.000Z";
const selection: VibeAgentTimelineEntry = {
  id: "draft_selection_context_shot_2",
  type: "state_change",
  createdAt: "2026-07-23T01:01:00.000Z",
  title: "我知道你在说哪段草案了",
  body: "当前选中第二镜。",
  status: "done",
  details: {
    selectedShotId: "shot_2",
    selectedShotNo: "1-2",
  },
};

const ready = recoverPendingNewVideoIntake([...intake(firstReadyAt, "planning_ready"), selection]);
assert.equal(ready.status, "restorable");
if (ready.status === "restorable") {
  assert.equal(ready.phase, "planning_ready");
  assert.equal(ready.projectTargetMode, "new_project");
  assert.equal(ready.selectedShotNo, "1-2");
}

const revisedScript = "清晨菜市场，老人用空菜篮挡住太阳，透明鱼逐渐淡去。";
const interruptedRevision = recoverPendingNewVideoIntake([
  ...intake(firstReadyAt, "planning_ready"),
  selection,
  ...intake("2026-07-23T01:02:00.000Z", "planning_started", revisedScript, [revisedStoryboardRow]),
]);
assert.equal(interruptedRevision.status, "restorable");
if (interruptedRevision.status === "restorable") {
  assert.equal(interruptedRevision.phase, "planning_started");
  assert.equal(interruptedRevision.draftScript, revisedScript);
  assert.equal(interruptedRevision.selectedShotNo, "1-2", "the structured selected shot should survive a draft revision");
  assert.equal(interruptedRevision.storyboardRows?.[0]?.primaryAction, "老人挡住阳光后停半拍", "the structured modified draft should survive restart without being rebuilt from summary text");
}

const corruptStructuredDraft = recoverPendingNewVideoIntake(
  intake("2026-07-23T01:02:30.000Z", "planning_ready", revisedScript, [{ ...revisedStoryboardRow, visibleClips: 0 }]),
);
assert.deepEqual(corruptStructuredDraft, { status: "invalid", reason: "draft_storyboard_row_contract_invalid" });

const confirmed = recoverPendingNewVideoIntake([
  ...intake(firstReadyAt, "planning_ready"),
  ...intake("2026-07-23T01:03:00.000Z", "draft_confirmed"),
]);
assert.deepEqual(confirmed, { status: "none", reason: "draft_already_confirmed" });

const missingScript = recoverPendingNewVideoIntake(buildVibeAgentIntakeTimelineEntries({
  createdAt: "2026-07-23T01:04:00.000Z",
  phase: "planning_ready",
  userMessage: "继续",
  shotCount: 2,
}));
assert.deepEqual(missingScript, { status: "invalid", reason: "draft_script_missing" });

const duplicatedTimeline = recoverPendingNewVideoIntake([
  ...intake(firstReadyAt, "planning_ready"),
  ...intake(firstReadyAt, "planning_ready"),
]);
assert.equal(duplicatedTimeline.status, "restorable", "identical duplicated timeline entries should recover idempotently");

const readySupersedesStartedAtSameTimestamp = recoverPendingNewVideoIntake([
  ...intake(firstReadyAt, "planning_started"),
  ...intake(firstReadyAt, "planning_ready"),
]);
assert.equal(readySupersedesStartedAtSameTimestamp.status, "restorable");
if (readySupersedesStartedAtSameTimestamp.status === "restorable") {
  assert.equal(readySupersedesStartedAtSameTimestamp.phase, "planning_ready");
}

console.log("PASS new-video intake recovery contract");
