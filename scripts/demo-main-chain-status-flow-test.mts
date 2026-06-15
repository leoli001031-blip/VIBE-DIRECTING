import assert from "node:assert/strict";

import { buildProjectStatusViewModel } from "../src/ui/app/projectStatusViewModel.ts";

type Summary = {
  locked: number;
  needsReview: number;
  missing: number;
};

function runtimeState(input: {
  root?: string;
  shotCount?: number;
  summary?: Summary;
}) {
  const shotCount = input.shotCount ?? 0;
  const summary = input.summary ?? { locked: 0, needsReview: 0, missing: 0 };
  return {
    project: {
      title: "Demo Main Chain",
      root: input.root || "/tmp/vibe-demo-main-chain",
      sourceTask: "",
      importedAt: "2026-06-15T00:00:00.000Z",
      state: "ready",
      metrics: {},
    },
    storyFlow: {
      sections: shotCount
        ? [{ id: "act_1", label: "开场", shotCount, blockedCount: 0, readyCount: shotCount, shotIds: Array.from({ length: shotCount }, (_, index) => `S${index + 1}`) }]
        : [],
      shots: Array.from({ length: shotCount }, (_, index) => ({
        id: `S${index + 1}`,
        actId: "act_1",
        sectionId: "act_1",
        title: `镜头 ${index + 1}`,
        storyFunction: "Demo shot",
        status: "draft",
        gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "N/A", story: "PASS", prop: "N/A", style: "UNKNOWN" },
        issues: [],
      })),
    },
    visualMemory: {
      summary: { ...summary, total: summary.locked + summary.needsReview + summary.missing, existing: summary.locked + summary.needsReview, byType: [] },
      assets: [],
    },
    taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
    manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
    imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
    previewEvents: [],
  } as any;
}

function view(input: Partial<Parameters<typeof buildProjectStatusViewModel>[0]> = {}) {
  return buildProjectStatusViewModel({
    runtimeState: runtimeState({ shotCount: 0 }),
    folderReady: false,
    projectReady: false,
    directorView: "story",
    ...input,
  } as any);
}

function factValue(status: ReturnType<typeof buildProjectStatusViewModel>, label: string) {
  return status.facts.find((fact) => fact.label === label)?.value || "";
}

let status = view();
assert.equal(status.stage, "准备开始", "fresh entry should explain that the project has not started");
assert.match(status.nextAction, /底部输入想法|打开项目/, "fresh entry should point to the bottom composer or project entry");

status = view({
  newVideoStatus: {
    status: "planning",
    title: "AI 正在拆镜头",
    detail: "正在整理故事、节奏和镜头，不会生成参考或视频。",
    nextAction: "等草案出来后复核",
  },
});
assert.equal(status.stage, "正在拆镜头", "planning draft should have a clear active state");
assert.equal(status.nextAction, "等草案出来后复核", "planning draft should tell the user to wait for review");

status = view({
  newVideoStatus: {
    status: "ready",
    title: "草案待确认",
    detail: "AI 已拆出 3 个镜头，确认前不会写入项目。",
    nextAction: "确认进故事流，或直接说修改意见",
    draftShotCount: 3,
    draftReferenceCount: 2,
  },
});
assert.equal(status.stage, "草案待确认", "ready draft should ask for confirmation instead of jumping to generation");
assert.equal(factValue(status, "镜头"), "草案 3 个", "ready draft should expose draft shot count");
assert.equal(factValue(status, "参考"), "已放入 2 个", "ready draft should expose draft reference count");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 0, needsReview: 1, missing: 3 } }),
  projectReady: true,
  referenceGenerationAction: { status: "ready", message: "准备生成参考。" },
  agentCommand: { kind: "generate_references", label: "生成参考" },
});
assert.equal(status.stage, "需要本地项目", "confirmed story should not generate references before a local project folder is bound");
assert.equal(status.nextAction, "点左上角项目，选择本地文件夹", "unbound confirmed story should point to project selection");
assert.equal(factValue(status, "AI 导演"), "先保存项目", "blocked generation should be translated into save-project guidance");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 0, needsReview: 0, missing: 3 } }),
  folderReady: true,
  projectReady: true,
  referenceGenerationAction: { status: "ready", message: "准备生成角色、场景、道具或故事板参考。" },
  agentCommand: { kind: "generate_references", label: "生成参考" },
});
assert.equal(status.stage, "参考待生成", "local project with missing references should route to reference generation");
assert.equal(status.nextAction, "生成参考", "missing references should expose one clear generation action");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 1, needsReview: 0, missing: 2 } }),
  folderReady: true,
  projectReady: true,
  referenceGenerationAction: { status: "running", message: "参考正在生成。" },
  referenceBatch: { plannedCount: 3, readyCount: 1, missingCount: 2, retryCount: 0 },
});
assert.equal(status.stage, "参考生成中", "running reference generation should be visible at the top");
assert.match(status.doing, /1\/3 张可看/, "running reference generation should show ready/planned progress");
assert.match(status.doing, /2 张缺少/, "running reference generation should show missing progress");
assert.match(factValue(status, "参考"), /生成中.*1\/3 张可看/, "reference facts should carry progress");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 0, needsReview: 3, missing: 0 } }),
  folderReady: true,
  projectReady: true,
});
assert.equal(status.stage, "参考待看", "returned references should route to review before video");
assert.equal(status.nextAction, "去参考页确认可用素材", "returned references should tell the user where to review");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 3, needsReview: 0, missing: 0 } }),
  folderReady: true,
  projectReady: true,
  videoStage: {
    status: "in_progress",
    generation: {
      statusLabel: "排队中",
      queueSummary: "第 1/3 段「蓝光车票」排队中 · 2 段待发送",
      taskFacts: [
        { label: "当前段", value: "蓝光车票" },
        { label: "提交号", value: "seedance-001" },
        { label: "下一步", value: "等待回流，稍后查询结果" },
      ],
    },
  },
});
assert.equal(status.stage, "视频生成中", "submitted video should become the top project state");
assert.match(status.doing, /第 1\/3 段/, "submitted video should show serial progress");
assert.equal(factValue(status, "提交号"), "seedance-001", "submitted video should expose submit id evidence");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 3, needsReview: 0, missing: 0 } }),
  folderReady: true,
  projectReady: true,
  videoStage: { status: "recoverable", canResume: true },
});
assert.equal(status.stage, "视频待查询", "recoverable video task should ask for result query");
assert.equal(status.nextAction, "继续查询结果", "recoverable video task should expose the query action");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 3, needsReview: 0, missing: 0 } }),
  folderReady: true,
  projectReady: true,
  videoStage: {
    status: "needs_review",
    reviewCount: 1,
    generation: {
      detail: "视频结果已出。",
      taskFacts: [
        { label: "当前段", value: "第一段" },
        { label: "输出", value: "video/first.mp4" },
        { label: "下一步", value: "去预览复核，确认后导出" },
      ],
    },
  },
});
assert.equal(status.stage, "视频待确认", "returned video should route to preview review");
assert.equal(status.nextAction, "去预览页确认", "returned video should expose preview review action");
assert.equal(factValue(status, "输出"), "video/first.mp4", "returned video should expose output evidence");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 3, needsReview: 0, missing: 0 } }),
  folderReady: true,
  projectReady: true,
  videoStage: { status: "completed", generation: { queueSummary: "3/3 段已完成" } },
});
assert.equal(status.stage, "视频结果已出", "completed videos should route to delivery");
assert.equal(status.nextAction, "去交付页查看", "completed videos should point to delivery page");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 3, needsReview: 0, missing: 0 } }),
  folderReady: true,
  projectReady: true,
  directorView: "export",
  exportWorker: { readiness: "ready", blockers: [] } as any,
});
assert.equal(status.stage, "可以导出", "ready export worker should expose a delivery-ready state");
assert.equal(status.nextAction, "去交付页导出", "ready export worker should expose the export action");

status = view({
  runtimeState: runtimeState({ shotCount: 3, summary: { locked: 3, needsReview: 0, missing: 0 } }),
  folderReady: true,
  projectReady: true,
  directorView: "export",
  exportAction: { status: "ready", label: "导出包已生成", detail: "已写入当前项目的 exports 文件夹。" },
});
assert.equal(status.stage, "导出已完成", "finished export should be visible as the top state");
assert.equal(status.nextAction, "去交付页查看导出包", "finished export should point to exported package review");

console.log("demo-main-chain-status-flow-test: ok");
