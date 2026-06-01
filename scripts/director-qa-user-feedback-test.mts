import assert from "node:assert/strict";
import { buildDirectorQaUserFeedback, strongerDirectorQaUserFeedback } from "../src/core/directorQaUserFeedback";

const storyboardConflict = buildDirectorQaUserFeedback({
  status: "rule_qa_blocked",
  ruleQaReport: {
    schemaVersion: "director_rule_qa_v1",
    status: "blocked",
    blockerCount: 1,
    warningCount: 0,
    infoCount: 0,
    findings: [{
      code: "storyboard_group_scene_conflict",
      severity: "blocker",
      category: "storyboard_grouping",
      path: "storyboardGroups.group-1.scene",
      message: "同一个故事板组里出现了多个场景基准，视频模型会把空间和天气混在一起。",
      evidence: "guidance:书店: S01 | guidance:车站: S02",
      suggestedFix: "不同场景拆成不同故事板/视频任务；如果其实是同一场景，就统一 sceneGuidance 和 sceneAssetIds。",
    }],
  },
});

assert(storyboardConflict, "storyboard conflict should produce creator-facing feedback");
assert.equal(storyboardConflict.status, "blocked");
assert.match(storyboardConflict.summary, /故事板|场景/);
assert.match(storyboardConflict.primaryAction, /拆成不同视频段|统一场景参考/);
assert(!/rule_qa|schema|provider|sceneGuidance|sceneAssetIds/i.test(storyboardConflict.summary), "summary should not expose machine terms");

const mixedReference = buildDirectorQaUserFeedback({
  textQaReport: {
    schemaVersion: "director_text_qa_v1",
    status: "needs_revision",
    providerCalled: true,
    runtimeExternalNetworkCallMade: true,
    summary: "参考策略需要调整",
    blockerCount: 0,
    warningCount: 1,
    infoCount: 0,
    findings: [{
      code: "reference_role_conflict",
      severity: "warning",
      category: "reference_strategy",
      path: "shots.S01.referenceStrategy",
      message: "角色参考、场景参考和道具参考被写成同一张 moodboard。",
      suggestedFix: "把角色、场景、道具分开使用。",
      rewriteHint: "重新分配参考图角色，避免把多个用途混成一张情绪板。",
    }],
    rewriteHints: ["重新分配参考图角色"],
  },
});

assert(mixedReference, "text QA warning should produce creator-facing feedback");
assert.equal(mixedReference.status, "needs_fix");
assert.match(mixedReference.summary, /参考图/);
assert(!/QA|provider|schema|moodboard/i.test(mixedReference.summary), "summary should stay creator-facing");

const ruleWins = strongerDirectorQaUserFeedback(mixedReference, storyboardConflict);
assert.equal(ruleWins?.status, "blocked", "stronger feedback should keep the blocking item");

const clear = buildDirectorQaUserFeedback({
  ruleQaReport: {
    schemaVersion: "director_rule_qa_v1",
    status: "pass",
    blockerCount: 0,
    warningCount: 0,
    infoCount: 0,
    findings: [],
  },
});
assert.equal(clear, undefined, "clean reports should not add UI noise");

console.log("director-qa-user-feedback-test: QA findings are projected into creator-facing fixes.");
