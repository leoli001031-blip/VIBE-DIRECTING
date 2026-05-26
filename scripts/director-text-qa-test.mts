import {
  buildDirectorTextQaPrompt,
  normalizeDirectorTextQaReport,
  recoverDirectorTextQaReportFromText,
  skippedDirectorTextQaReport,
} from "../src/core/directorTextQa.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prompt = buildDirectorTextQaPrompt({
  compilerMode: "storyboard_rapid_cut",
  compilerModeLabel: "故事板快切",
  compilerReasons: ["动作密度较高，需要故事板控制节奏。"],
  durationSeconds: 4,
  visibleClips: 3,
  storyboardPanels: 4,
  shots: [{
    id: "S01",
    title: "霓虹启动",
    durationSeconds: 4,
    referenceStrategy: "storyboard_rapid_cut",
    visibleClips: 3,
    storyboardPanels: 4,
    actionBeats: ["霓虹闪", "白车启动", "黑车跟上", "水花划过"],
    sceneGuidance: ["雨夜山路便利店"],
    propGuidance: ["白色双门车", "黑色双门车"],
  }],
  assets: [
    { id: "scene_road", kind: "scene", label: "雨夜山路便利店", usedByShotIds: ["S01"] },
    { id: "car_white", kind: "prop", label: "白色双门车", usedByShotIds: ["S01"] },
  ],
  seedancePrompt: [
    "Create exactly 3 visible clip(s) in the final video.",
    "Use the 4 storyboard panel(s) only as internal staging.",
    "No music, no BGM, no subtitles.",
  ].join("\n"),
  storyboardPrompt: "Storyboard panel count: exactly 4.",
});

assert(prompt.includes("visibleClips 是最终可见剪辑数"), "prompt should explain visibleClips");
assert(prompt.includes("storyboardPanels 是故事板面板数"), "prompt should explain storyboardPanels");
assert(prompt.includes("actionBeats 是动作节点"), "prompt should explain actionBeats");
assert(prompt.includes("车灯、轮胎、手、眼神、雾气"), "prompt should carry generalized asset granularity rule");
assert(prompt.includes("\"compiler\""), "prompt should include compact JSON QA input");

const passReport = recoverDirectorTextQaReportFromText(JSON.stringify({
  schemaVersion: "director_text_qa_model_output_v1",
  status: "pass",
  summary: "文本规划可提交。",
  findings: [],
  rewriteHints: [],
}), {
  providerCalled: true,
  runtimeExternalNetworkCallMade: true,
  providerId: "deepseek-v4-pro",
  model: "deepseek-v4-pro",
  transport: "chat_completions_stream",
});
assert(passReport.schemaVersion === "director_text_qa_v1", "report schema mismatch");
assert(passReport.status === "pass", "pass report should pass");
assert(passReport.providerCalled === true, "provider metadata missing");

const blockedReport = recoverDirectorTextQaReportFromText(`\`\`\`json
{
  "status": "needs_revision",
  "summary": "快切合同和参考策略存在问题。",
  "findings": [
    {
      "code": "scene_storyboard_scope_conflict",
      "severity": "blocker",
      "category": "reference_strategy",
      "path": "shots.S01.storyboardGroupId",
      "message": "一个故事板覆盖了明显不同的场景。",
      "evidence": "旧书店、车站、山路放在同一故事板。",
      "suggestedFix": "按场景拆成不同视频任务或不同故事板。",
      "rewriteHint": "同一故事板只承载同一视频任务内的场面调度。"
    },
    {
      "code": "style_too_realistic",
      "severity": "warning",
      "category": "style_alignment",
      "path": "seedancePrompt",
      "message": "风格约束没有排除真人写实。",
      "suggestedFix": "补上无真人写实、无3D CG。"
    }
  ],
  "rewriteHints": ["先拆场景，再重写 Seedance prompt。"]
}
\`\`\``, {
  providerCalled: true,
  runtimeExternalNetworkCallMade: true,
  providerId: "lanyi-image2",
  model: "claude-opus-4-6",
  transport: "chat_completions_stream",
});

assert(blockedReport.status === "blocked", "blocker finding should upgrade report to blocked");
assert(blockedReport.blockerCount === 1, "blocker count mismatch");
assert(blockedReport.warningCount === 1, "warning count mismatch");
assert(blockedReport.rewriteHints.some((item) => item.includes("同一故事板")), "finding rewrite hint should be preserved");

const normalized = normalizeDirectorTextQaReport({
  status: "pass",
  summary: "存在 warning，应降级到 needs_revision。",
  findings: [{ severity: "warning", category: "user_intent", path: "style", message: "用户偏好没有写入 prompt。" }],
}, {
  providerCalled: false,
  runtimeExternalNetworkCallMade: false,
});
assert(normalized.status === "needs_revision", "warning findings should make report needs_revision");

const skipped = skippedDirectorTextQaReport("没有可用模型。");
assert(skipped.status === "skipped", "skipped report mismatch");
assert(skipped.providerCalled === false, "skipped should not claim provider call");

console.log("director-text-qa-test: ok");
