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

console.log("director-rule-qa-test: ok");
