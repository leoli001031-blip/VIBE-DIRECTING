import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fullDraft = buildProjectIntakeDraft({
  createdAt: "2026-05-18T00:00:00.000Z",
  scriptText: "一个女孩在雨夜收到一段旧录音，她决定回到小时候住过的楼下。",
  styleNote: "克制、潮湿、手持摄影感。",
  referenceAssets: [
    { id: "img_rain_alley", type: "image", label: "雨夜巷口", uri: "file://references/rain.png" },
    { id: "audio_voice", type: "audio", label: "旁白成品音频", uri: "file://audio/final.wav" },
    { id: "style_handheld", type: "style", label: "手持摄影参考" },
    { id: "char_lead", type: "character", label: "主角参考图" },
    { id: "scene_old_building", type: "scene", label: "旧楼场景" },
  ],
});
const fullProjection = buildIntakeStagedPlanProjection(fullDraft);

assert(fullDraft.status === "awaiting_confirmation", "intake draft must remain awaiting confirmation");
assert(fullProjection.status === "draft_pending_confirmation", "projection must be a pending draft");
assert(fullProjection.missingChecklist.length === 0, "complete draft should not ask for missing intake fields");
assert(fullProjection.summary.assetCounts.audio === 1, "audio asset should be counted");
assert(fullProjection.summary.assetCounts.character === 1, "character asset should be counted");
assert(fullProjection.stagedPlan.every((step) => step.status === "ready"), "complete draft staged plan should be ready for review");
assert(
  fullProjection.guardrails.formalTaskCreation === "blocked_until_user_confirmation",
  "formal task creation must be blocked until confirmation",
);
assert(
  fullProjection.guardrails.providerSubmission === "not_allowed_from_intake_draft",
  "provider submission must be impossible from intake draft projection",
);

const timecodedDraft = buildProjectIntakeDraft({
  scriptText: `[Intro]
Five...
Four...

0:00 - 0:04
山脚便利店，SU7 Ultra 点灯
深夜便利店停车场。

0:04 - 0:08
女车手睁眼
车内特写。`,
});
const timecodedProjection = buildIntakeStagedPlanProjection(timecodedDraft);
assert(
  timecodedDraft.scriptText.includes("\n0:00 - 0:04\n"),
  "intake draft must preserve script line breaks for timecoded project scripts",
);
assert(
  timecodedProjection.summary.title === "山脚便利店，SU7 Ultra 点灯",
  `timecoded script title should prefer the first real shot title, got ${timecodedProjection.summary.title}`,
);

const sparseDraft = buildProjectIntakeDraft({
  scriptText: "   ",
  referenceAssets: [{ id: "", type: "image", label: "   " }],
});
const sparseProjection = buildIntakeStagedPlanProjection(sparseDraft);

assert(sparseDraft.scriptText === "", "script text should be normalized");
assert(sparseDraft.referenceAssets[0]?.id.startsWith("image_"), "missing asset id should be normalized");
assert(
  sparseProjection.missingChecklist.some((item) => item.field === "script_text" && item.severity === "required"),
  "missing script must be a required checklist item",
);
assert(
  sparseProjection.stagedPlan.some((step) => step.id === "prepare_project_draft" && step.status === "needs_input"),
  "project draft preparation must not be ready without script text",
);

const serialized = JSON.stringify([fullDraft, fullProjection, sparseDraft, sparseProjection]);
const forbiddenPatterns = [
  /\bGenerationJob\b/,
  /\btoolCalls\b/,
  /\bproviderId\b/,
  /\bsubmit[-_\s]?live\b/i,
  /\blive[-_\s]?submit\b/i,
  /\btrigger[-_\s]?plan\b/i,
  /\bapi[-_\s]?key\b/i,
];
for (const pattern of forbiddenPatterns) {
  assert(!pattern.test(serialized), `intake draft must not expose formal task/provider semantics: ${pattern}`);
}

console.log(
  `Project intake draft tests passed: draftId=${fullDraft.draftId}, assets=${fullDraft.referenceAssets.length}, sparseMissing=${sparseProjection.missingChecklist.length}.`,
);
