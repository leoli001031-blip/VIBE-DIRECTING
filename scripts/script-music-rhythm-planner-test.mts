import { buildMusicRhythmAnalysis } from "../src/core/musicRhythmAnalysis.ts";
import { buildScriptMusicRhythmPlan } from "../src/core/scriptMusicRhythmPlanner.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const musicAnalysis = buildMusicRhythmAnalysis({
  label: "anime-opening.wav",
  durationSeconds: 24,
  sampleRate: 8000,
  windowSeconds: 1,
  samples: [
    ...Array.from({ length: 8000 * 4 }, () => 0.08),
    ...Array.from({ length: 8000 * 6 }, () => 0.35),
    ...Array.from({ length: 8000 * 8 }, () => 0.92),
    ...Array.from({ length: 8000 * 6 }, () => 0.24),
  ],
});

const shotTexts = [
  "雨后的天台上，女主低头看见旧磁带，风吹起校服领结。",
  "她听见身后脚步声，迅速回头，镜头切到眼神特写。",
  "两个人在楼梯口递出磁带，手指停顿半拍。",
  "远处警报响起，两人冲下楼梯，画面进入快切动作。",
];

const plan = buildScriptMusicRhythmPlan({
  scriptText: shotTexts.join(" "),
  shotTexts,
  userPreference: "旧版日漫、EVA 初代动画质感、音乐卡点但不要广告感",
  musicAnalysis,
});

assert(plan.generatedFrom === "script_and_music", "plan should use script and music together");
assert(plan.totalDurationSeconds === 24, "total duration should follow music duration");
assert(plan.summary.videoProviderBgmAllowed === false, "video provider must still forbid BGM");
assert(plan.summary.finalExportMusicPlanned === true, "music should be planned for final export");
assert(plan.summary.musicReferenceRole === "music_reference", "music should be typed as a music_reference");
assert(plan.summary.musicReferenceUsedFor.join("|") === "rhythm_planning|final_export_mix", "music reference should only guide rhythm and final export mix");
assert(plan.summary.musicReferenceForbiddenFor.includes("video_prompt"), "music reference must be forbidden from video prompt use");
assert(plan.summary.musicReferenceForbiddenFor.includes("video_provider_payload"), "music reference must be forbidden from video provider payloads");
assert(plan.segments.length === shotTexts.length, "each shot should get a rhythm segment");
assert(plan.segments.every((segment) => segment.durationSeconds >= 3 && segment.durationSeconds <= 15), "segments should stay within Seedance-safe duration");
assert(plan.segments.some((segment) => segment.referenceStrategy === "storyboard_rapid_cut"), "action/peak section should choose rapid storyboard mode");
assert(plan.segments.some((segment) => segment.referenceStrategy === "storyboard_narrative" || segment.referenceStrategy === "omni_reference"), "non-action sections should not all become rapid cut");
assert(plan.segments.every((segment) => /不进入视频模型提示词|视频模型/.test(segment.reason)), "segments should explain no-BGM provider policy");

const scriptOnly = buildScriptMusicRhythmPlan({
  scriptText: "她在清晨站台等车。她看见远处的光。她终于露出很轻的笑。",
});
assert(scriptOnly.generatedFrom === "script_only", "planner should fall back without music");
assert(scriptOnly.warnings.includes("music_analysis_missing_script_only_rhythm"), "script-only fallback should warn");

console.log(JSON.stringify({
  ok: true,
  musicPlan: {
    totalDurationSeconds: plan.totalDurationSeconds,
    strategies: plan.summary.preferredReferenceStrategies,
  },
  scriptOnlySegments: scriptOnly.segments.length,
}, null, 2));
