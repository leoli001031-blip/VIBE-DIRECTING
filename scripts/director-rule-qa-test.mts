import { runDirectorRuleQa } from "../src/core/directorRuleQa.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function codes(report) {
  return new Set(report.findings.map((finding) => finding.code));
}

const validReport = runDirectorRuleQa({
  targetDurationSeconds: 12,
  shots: [
    {
      id: "S01",
      title: "旧书店翻书",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["清晨旧书店"],
      characterGuidance: ["戴耳机的高中女生"],
      propGuidance: ["旧书"],
      sceneAssetIds: ["scene_bookstore"],
      characterAssetIds: ["character_girl"],
      propAssetIds: ["prop_book"],
    },
    {
      id: "S02",
      title: "车票发光",
      durationSeconds: 4,
      referenceStrategy: "omni_reference",
      visibleClips: 1,
      sceneGuidance: ["清晨旧书店"],
      characterGuidance: ["无"],
      propGuidance: ["发光车票", "旧书"],
      sceneAssetIds: ["scene_bookstore"],
      propAssetIds: ["prop_ticket", "prop_book"],
    },
    {
      id: "S03",
      title: "雨夜快切启动",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      visibleClips: 3,
      storyboardPanels: 4,
      actionBeats: ["霓虹闪", "白车启动", "黑车跟上", "水花划过路面"],
      sceneGuidance: ["雨夜山路弯道"],
      characterGuidance: ["无"],
      propGuidance: ["白色双门车", "黑色双门车"],
      sceneAssetIds: ["scene_road"],
      propAssetIds: ["prop_white_car", "prop_black_car"],
    },
  ],
  assets: [
    { id: "scene_bookstore", kind: "scene", label: "清晨旧书店", usedByShotIds: ["S01", "S02"] },
    { id: "scene_road", kind: "scene", label: "雨夜山路弯道", usedByShotIds: ["S03"] },
    { id: "character_girl", kind: "character", label: "戴耳机的高中女生", usedByShotIds: ["S01"] },
    { id: "prop_book", kind: "prop", label: "旧书", usedByShotIds: ["S01", "S02"] },
    { id: "prop_ticket", kind: "prop", label: "发光车票", usedByShotIds: ["S02"] },
    { id: "prop_white_car", kind: "prop", label: "白色双门车", usedByShotIds: ["S03"] },
    { id: "prop_black_car", kind: "prop", label: "黑色双门车", usedByShotIds: ["S03"] },
  ],
  seedancePrompts: [
    {
      compilerMode: "storyboard_rapid_cut",
      visibleClips: 3,
      storyboardPanels: 4,
      durationSeconds: 4,
      prompt: [
        "故事板快切 video request.",
        "Use Image 1 as internal storyboard reference for shot order, framing progression, timing, camera rhythm, and motion planning.",
        "Create exactly 3 visible clip(s) in the final video. Use the 4 storyboard panel(s) only as internal staging, timing and action-beat guidance.",
        "If storyboardPanels is greater than visibleClips, the extra storyboard panels are actionBeats only; do not turn them into extra final cuts.",
        "Total duration: 4s.",
        "Do not render storyboard artifacts: arrows, numbers, panel boxes, borders, notes, labels, time marks, sketch overlays, white margins, logos, watermarks, UI.",
        "No music, no BGM, no subtitles.",
      ].join("\n"),
    },
  ],
});

assert(validReport.status === "pass", `valid report should pass: ${JSON.stringify(validReport, null, 2)}`);

const invalidAssetReport = runDirectorRuleQa({
  shots: [
    {
      id: "A01",
      title: "车辆启动",
      durationSeconds: 4,
      referenceStrategy: "omni_reference",
      sceneGuidance: ["雨夜山路弯道"],
      propGuidance: ["车灯", "轮胎", "白色双门车"],
    },
  ],
  assets: [
    { id: "prop_headlight", kind: "prop", label: "车灯" },
    { id: "prop_finger", kind: "prop", label: "指尖" },
    { id: "scene_fog", kind: "scene", label: "雾气" },
    { id: "prop_white_car", kind: "prop", label: "白色双门车" },
  ],
});
const invalidAssetCodes = codes(invalidAssetReport);
assert(invalidAssetReport.status === "blocked", "non-standalone selected references should block before provider submit");
assert(invalidAssetCodes.has("asset_granularity_mismatch"), "should catch component/body/weather reference granularity");
assert(invalidAssetReport.findings.length >= 3, "should flag multiple generalized granularity classes");

const pollutionReport = runDirectorRuleQa({
  shots: [
    {
      id: "P01",
      title: "污染字段",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      sceneGuidance: ["同上"],
      characterGuidance: ["待确认"],
      propGuidance: ["无"],
    },
    {
      id: "P02",
      title: "无角色合法",
      durationSeconds: 4,
      referenceStrategy: "omni_reference",
      sceneGuidance: ["无"],
      characterGuidance: ["无"],
      propGuidance: ["无"],
    },
  ],
});
const pollutionCodes = codes(pollutionReport);
assert(pollutionReport.status === "blocked", "field pollution should block formal facts");
assert(pollutionCodes.has("context_placeholder_in_fact"), "should catch 同上 in formal fields");
assert(pollutionCodes.has("pending_placeholder_in_fact"), "should catch 待确认 in formal fields");
assert(pollutionCodes.has("none_placeholder_not_allowed"), "should allow 无 for characters/props but block it for scene");

const contractReport = runDirectorRuleQa({
  targetDurationSeconds: 20,
  shots: [
    {
      id: "C01",
      title: "全能却有故事板",
      durationSeconds: 4,
      referenceStrategy: "omni_reference",
      visibleClips: 1,
      storyboardPanels: 2,
      sceneGuidance: ["咖啡馆"],
    },
    {
      id: "C02",
      title: "快切面板不够",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      visibleClips: 5,
      storyboardPanels: 3,
      actionBeats: ["启动", "过弯", "水花"],
      sceneGuidance: ["雨夜山路"],
    },
  ],
});
const contractCodes = codes(contractReport);
assert(contractReport.status === "blocked", "contract conflicts should block");
assert(contractCodes.has("omni_has_storyboard_panels"), "omni should not carry storyboardPanels");
assert(contractCodes.has("rapid_panels_less_than_visible_clips"), "rapid panels must cover visible clips");
assert(contractCodes.has("duration_total_mismatch"), "target duration mismatch should be warned");

const clipBudgetConflictReport = runDirectorRuleQa({
  shots: [
    {
      id: "BC01",
      title: "快切词义冲突",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      visibleClips: 1,
      storyboardPanels: 4,
      actionBeats: ["霓虹闪", "脚步停", "车灯亮", "水花过"],
      splitPolicy: "3-4 个可见切点",
      sceneGuidance: ["雨夜山路"],
    },
  ],
});
assert(clipBudgetConflictReport.status === "blocked", "visible cut-point wording must not contradict final visible clips");
assert(codes(clipBudgetConflictReport).has("visible_clip_budget_conflict"), "should catch cut-point wording that expands beyond visibleClips");

const clipBudgetCompatibleReport = runDirectorRuleQa({
  shots: [
    {
      id: "BC02",
      title: "快切合同清楚",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      visibleClips: 3,
      storyboardPanels: 4,
      actionBeats: ["霓虹闪", "脚步停", "车灯亮", "水花过"],
      splitPolicy: "2-3 个最终可见剪辑",
      sceneGuidance: ["雨夜山路"],
    },
  ],
});
assert(clipBudgetCompatibleReport.status === "pass", `final visible clip wording should pass: ${JSON.stringify(clipBudgetCompatibleReport, null, 2)}`);

const fractionalDurationReport = runDirectorRuleQa({
  shots: [
    {
      id: "D01",
      title: "不可提交的小数秒",
      durationSeconds: 5.7,
      referenceStrategy: "omni_reference",
      visibleClips: 1,
      sceneGuidance: ["雨夜街角"],
    },
    {
      id: "D02",
      title: "太短的视频段",
      durationSeconds: 3,
      referenceStrategy: "omni_reference",
      visibleClips: 1,
      sceneGuidance: ["雨夜街角"],
    },
  ],
});
assert(fractionalDurationReport.status === "blocked", "fractional or too-short video durations should block provider submission");
assert(codes(fractionalDurationReport).has("fractional_video_duration"), "should catch fractional duration seconds");
assert(codes(fractionalDurationReport).has("short_single_video_unit"), "should catch sub-4s video units");

const executionModeReport = runDirectorRuleQa({
  shots: [{
    id: "EM01",
    title: "无效执行模式",
    durationSeconds: 5,
    referenceStrategy: "omni_reference",
    executionMode: "action_closeup",
    visibleClips: 1,
    sceneGuidance: ["雨后屋顶"],
  }],
});
assert(executionModeReport.status === "blocked", "unknown executionMode should block before paid confirmation");
assert(codes(executionModeReport).has("invalid_execution_mode"), "should catch non-canonical executionMode values");

for (const executionMode of [
  "single_continuous_shot",
  "relationship_wide",
  "action_insert",
  "reaction_closeup",
  "planned_cut_sequence",
]) {
  const report = runDirectorRuleQa({
    shots: [{
      id: `VALID_${executionMode}`,
      title: "合法执行模式",
      durationSeconds: 5,
      referenceStrategy: "omni_reference",
      executionMode,
      visibleClips: 1,
      sceneGuidance: ["雨后屋顶"],
    }],
  });
  assert(!codes(report).has("invalid_execution_mode"), `${executionMode} should remain a valid executionMode`);
}

const promptLeakReport = runDirectorRuleQa({
  shots: [
    {
      id: "L01",
      title: "提示词泄漏",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      visibleClips: 2,
      storyboardPanels: 4,
      actionBeats: ["左移", "右移", "冲刺", "停顿"],
      sceneGuidance: ["山路"],
    },
  ],
  seedancePrompts: [
    {
      compilerMode: "storyboard_rapid_cut",
      visibleClips: 2,
      storyboardPanels: 4,
      durationSeconds: 4,
      prompt: [
        "Create exactly 3 visible clip(s) in the final video.",
        "Total duration: 6s.",
        "Render the panel borders and arrows as part of the video.",
        "Use music rhythm as BGM.",
      ].join("\n"),
    },
  ],
});
const promptLeakCodes = codes(promptLeakReport);
assert(promptLeakReport.status === "blocked", "prompt leakage should block");
assert(promptLeakCodes.has("prompt_visible_clip_count_mismatch"), "should catch visible clip mismatch");
assert(promptLeakCodes.has("prompt_duration_mismatch"), "should catch duration mismatch");
assert(promptLeakCodes.has("positive_storyboard_artifact_instruction"), "should catch positive artifact rendering");
assert(promptLeakCodes.has("positive_music_instruction"), "should catch positive BGM instructions");
assert(promptLeakCodes.has("missing_no_bgm_guard"), "should warn when no-BGM guard is missing");

const mixedNoBgmPromptLeakReport = runDirectorRuleQa({
  shots: [
    {
      id: "M01",
      title: "音乐边界",
      durationSeconds: 4,
      referenceStrategy: "omni_reference",
      visibleClips: 1,
      sceneGuidance: ["清晨旧书店"],
    },
  ],
  seedancePrompts: [
    {
      compilerMode: "omni_reference",
      visibleClips: 1,
      durationSeconds: 4,
      prompt: [
        "Create exactly 1 visible clip(s).",
        "Total duration: 4s.",
        "No music, no BGM, no subtitles.",
        "Use music rhythm as BGM during the shot.",
      ].join("\n"),
    },
  ],
});
assert(
  codes(mixedNoBgmPromptLeakReport).has("positive_music_instruction"),
  "positive BGM instructions must still be caught when a separate no-BGM guard exists",
);

const referenceReport = runDirectorRuleQa({
  shots: [
    {
      id: "R01",
      title: "引用错配",
      durationSeconds: 4,
      referenceStrategy: "omni_reference",
      sceneGuidance: ["旧书店"],
      sceneAssetIds: ["character_girl"],
      characterAssetIds: ["missing_character"],
      propAssetIds: ["prop_book"],
    },
  ],
  assets: [
    { id: "character_girl", kind: "character", label: "女高中生", usedByShotIds: ["R01"] },
    { id: "prop_book", kind: "prop", label: "旧书", usedByShotIds: ["R02"] },
  ],
});
const referenceCodes = codes(referenceReport);
assert(referenceReport.status === "warning", "reference integrity issues should warn before user repair");
assert(referenceCodes.has("missing_asset_reference"), "should catch missing asset ids");
assert(referenceCodes.has("asset_kind_mismatch"), "should catch scene/character/prop kind mismatch");
assert(referenceCodes.has("asset_used_by_missing_shot"), "should catch stale usedByShotIds");

const storyboardGroupSceneConflict = runDirectorRuleQa({
  shots: [
    {
      id: "G01",
      title: "书店翻书",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      storyboardGroupId: "board_a",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["清晨旧书店"],
      sceneAssetIds: ["scene_bookstore"],
    },
    {
      id: "G02",
      title: "雾中电车",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      storyboardGroupId: "board_a",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["雾中车站月台"],
      sceneAssetIds: ["scene_station"],
    },
  ],
});
const storyboardGroupSceneConflictCodes = codes(storyboardGroupSceneConflict);
assert(storyboardGroupSceneConflict.status === "blocked", "one storyboard group must not cover different scenes");
assert(storyboardGroupSceneConflictCodes.has("storyboard_group_scene_conflict"), "should catch mixed scene baselines inside one storyboard group");

const duplicatedSceneAssetGroup = runDirectorRuleQa({
  shots: [
    {
      id: "DG01",
      title: "便利店外景",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      storyboardGroupId: "board_b",
      visibleClips: 2,
      storyboardPanels: 3,
      actionBeats: ["霓虹闪", "白车启动", "水花"],
      sceneGuidance: ["雨夜山脚便利店"],
      sceneAssetIds: ["scene_store_a"],
    },
    {
      id: "DG02",
      title: "便利店起步",
      durationSeconds: 4,
      referenceStrategy: "storyboard_rapid_cut",
      storyboardGroupId: "board_b",
      visibleClips: 2,
      storyboardPanels: 3,
      actionBeats: ["黑车亮灯", "跟上", "甩尾"],
      sceneGuidance: ["雨夜山脚便利店"],
      sceneAssetIds: ["scene_store_b"],
    },
  ],
});
const duplicatedSceneAssetGroupCodes = codes(duplicatedSceneAssetGroup);
assert(duplicatedSceneAssetGroup.status === "warning", "duplicated scene assets in one same-scene storyboard group should warn");
assert(duplicatedSceneAssetGroupCodes.has("duplicated_scene_asset_for_same_storyboard_group"), "should catch redundant scene baselines for the same storyboard group");

const ungroupedStoryboardReference = runDirectorRuleQa({
  shots: [
    {
      id: "UG01",
      title: "书店翻书",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["清晨旧书店"],
      sceneAssetIds: ["scene_bookstore"],
    },
    {
      id: "UG02",
      title: "雾中电车",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["雾中车站月台"],
      sceneAssetIds: ["scene_station"],
    },
  ],
  assets: [
    {
      id: "storyboard_ref_ungrouped",
      kind: "reference",
      label: "故事板参考 1",
      usedByShotIds: ["UG01", "UG02"],
      sourceRefs: ["storyboard_reference:demo"],
    },
  ],
});
const ungroupedStoryboardReferenceCodes = codes(ungroupedStoryboardReference);
assert(ungroupedStoryboardReference.status === "blocked", "multi-shot storyboard refs must declare an explicit group");
assert(
  ungroupedStoryboardReferenceCodes.has("storyboard_reference_multi_shot_without_group"),
  "should catch storyboard reference reused across shots without storyboardGroupId",
);

const groupedStoryboardReference = runDirectorRuleQa({
  shots: [
    {
      id: "GR01",
      title: "书店翻书",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      storyboardGroupId: "bookstore_board",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["清晨旧书店"],
      sceneAssetIds: ["scene_bookstore"],
    },
    {
      id: "GR02",
      title: "书页发光",
      durationSeconds: 4,
      referenceStrategy: "storyboard_narrative",
      storyboardGroupId: "bookstore_board",
      visibleClips: 1,
      storyboardPanels: 1,
      sceneGuidance: ["清晨旧书店"],
      sceneAssetIds: ["scene_bookstore"],
    },
  ],
  assets: [
    {
      id: "storyboard_ref_grouped",
      kind: "reference",
      label: "故事板参考 bookstore_board",
      usedByShotIds: ["GR01", "GR02"],
      sourceRefs: ["storyboard_reference:bookstore_board"],
    },
  ],
});
assert(
  !codes(groupedStoryboardReference).has("storyboard_reference_multi_shot_without_group"),
  "explicit same storyboardGroupId should allow a storyboard reference to cover one planned segment",
);

console.log("director-rule-qa-test: ok");
