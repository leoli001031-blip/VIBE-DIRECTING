import {
  DIRECTOR_RHYTHM_PROFILE_LABELS,
  planDirectorRhythm,
  type DirectorRhythmProfile,
} from "../src/core/directorRhythmPlanner.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const cases: Array<{
  name: string;
  expected: DirectorRhythmProfile;
  shotText: string;
  userPreference?: string;
}> = [
  {
    name: "quiet dialogue",
    expected: "quiet_dialogue",
    shotText: "两个人在雨后天台低声对话，中间有沉默和视线停顿。",
  },
  {
    name: "anime emotion",
    expected: "anime_emotion",
    shotText: "日漫情绪特写，手指停住，眼神从磁带抬到对方脸上。",
  },
  {
    name: "action fast cut",
    expected: "action_fast_cut",
    shotText: "主角冲出门然后奔跑、转身、追车、跳过栏杆，快切动作。",
  },
  {
    name: "comedy reaction",
    expected: "comedy_reaction",
    shotText: "他以为自己很帅，结果全场沉默，尴尬反应成为笑点。",
  },
  {
    name: "suspense pressure",
    expected: "suspense_pressure",
    shotText: "黑暗走廊里脚步逼近，阴影压过门缝，悬疑压迫感越来越强。",
  },
  {
    name: "commercial short",
    expected: "commercial_short",
    shotText: "产品被放到画面中心，品牌卖点需要短促展示，像广告片。",
  },
  {
    name: "emotion montage",
    expected: "emotion_montage",
    shotText: "回忆片段闪回，时间流逝，几个短画面组成情绪蒙太奇。",
  },
  {
    name: "lyrical observation",
    expected: "lyrical_observation",
    shotText: "雨停后的街道、风和光慢慢落在人物肩上，抒情观察。",
  },
];

for (const item of cases) {
  const plan = planDirectorRhythm({
    scriptText: item.shotText,
    shotText: item.shotText,
    userPreference: item.userPreference,
    durationSeconds: item.expected === "action_fast_cut" ? 5 : 8,
  });
  assert(plan.rhythmProfile === item.expected, `${item.name} should be ${item.expected}, got ${plan.rhythmProfile}`);
  assert(plan.rhythmReason.length >= 12, `${item.name} should include a human-readable reason`);
  assert(DIRECTOR_RHYTHM_PROFILE_LABELS[plan.rhythmProfile], `${item.name} should have a user-facing label`);
}

const dense = planDirectorRhythm({
  shotText: "她推开门，然后跑过走廊，随后转身拿起钥匙，同时回头看，再冲下楼。",
  durationSeconds: 5,
});
assert(dense.actionDensity === "high", "dense action should be high density");
assert(dense.splitPolicy === "split_for_action", "dense action should ask for action splitting");

console.log(JSON.stringify({
  ok: true,
  coveredProfiles: cases.map((item) => item.expected),
  denseAction: {
    rhythmProfile: dense.rhythmProfile,
    actionDensity: dense.actionDensity,
    splitPolicy: dense.splitPolicy,
  },
}, null, 2));
