import assert from "node:assert/strict";

import {
  bindProjectAgentTimelineEntriesToIdentity,
  createProjectVibe,
  migrateProjectAgentTimelineEntriesToProjectRoot,
  openProjectAgentTimeline,
  projectAgentTimelinePath,
  projectVibeFileName,
  saveProjectAgentTimeline,
} from "../src/project/index.ts";
import {
  appendVibeAgentTimelineEntries,
  createVibeAgentTimelineDocument,
} from "../src/agent-core/index.ts";
import type { VibeAgentTimelineEntry } from "../src/agent-core/index.ts";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: MemoryStorage; location: { hostname: string; port: string } } }).window = {
  localStorage: storage,
  location: { hostname: "example.test", port: "" },
};

const generatedAt = "2026-06-18T08:00:00.000Z";
const project = createProjectVibe({
  projectId: "agent-timeline-demo",
  title: "Agent Timeline Demo",
  createdAt: generatedAt,
  updatedAt: generatedAt,
});
const target = {
  storageKey: "project-agent-timeline-test",
  projectPath: projectVibeFileName,
};

const missing = await openProjectAgentTimeline(target, {
  project,
  generatedAt,
});
assert.equal(missing.ok, false);
assert.equal(missing.status, "missing");
assert.equal(missing.path, projectAgentTimelinePath);
assert.equal(missing.timeline.projectId, "agent-timeline-demo");
assert.equal(missing.timeline.entries.length, 0);

const timeline = appendVibeAgentTimelineEntries(
  createVibeAgentTimelineDocument({
    projectId: project.manifest.projectId,
    projectTitle: project.manifest.title,
    generatedAt,
  }),
  [
    {
      id: "agent_user_continue",
      type: "user_message",
      createdAt: generatedAt,
      title: "你",
      body: "继续",
      status: "done",
    },
    {
      id: "agent_tool_inspect",
      type: "tool_call",
      createdAt: generatedAt,
      title: "读取项目",
      body: "读取 Project.vibe、镜头、素材和队列摘要。",
      toolName: "inspect_project",
      status: "done",
    },
    {
      id: "agent_tool_result_confirmed_write",
      type: "tool_result",
      createdAt: generatedAt,
      title: "执行结果",
      body: "修改已写入项目",
      toolName: "run_confirmed_action",
      actionKind: "revise_story_or_shot",
      status: "done",
    },
    {
      id: "agent_action_result_write",
      type: "action_result",
      createdAt: generatedAt,
      title: "执行结果",
      body: "修改已写入项目",
      toolName: "write_project",
      actionKind: "revise_story_or_shot",
      status: "done",
    },
  ] satisfies VibeAgentTimelineEntry[],
  generatedAt,
);

const saved = await saveProjectAgentTimeline(target, timeline);
assert.equal(saved.ok, true);
assert.equal(saved.status, "written");
assert.equal(saved.path, projectAgentTimelinePath);
assert.equal(storage.getItem(`${target.storageKey}:${projectAgentTimelinePath}`)?.includes("agent_tool_inspect"), true);

const restored = await openProjectAgentTimeline(target, {
  project,
  generatedAt,
});
assert.equal(restored.ok, true);
assert.equal(restored.status, "restored");
assert.equal(restored.timeline.entries.length, 4);
assert.equal(restored.timeline.entries.some((entry) => entry.toolName === "inspect_project"), true);
assert.equal(restored.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "run_confirmed_action"), true);
assert.equal(restored.timeline.entries.some((entry) => entry.type === "action_result" && entry.toolName === "write_project"), true);

const selectionContextEntry: VibeAgentTimelineEntry = {
  id: "selection_context_P10ES01_P10ES01",
  type: "state_change",
  createdAt: "2026-06-18T08:01:00.000Z",
  title: "我知道你在说哪里了",
  body: "现在你说“这个”，我会理解为镜头 P10ES01。",
  lifecycle: "succeeded",
  status: "done",
  facts: [{ label: "这个指向", value: "镜头 P10ES01" }],
  details: {
    deicticCue: "镜头 P10ES01",
    projectId: project.manifest.projectId,
    projectFactHash: "current-project-facts",
  },
};
const timelineWithSelection = appendVibeAgentTimelineEntries(timeline, [selectionContextEntry], selectionContextEntry.createdAt);
const repeatedSelection = appendVibeAgentTimelineEntries(timelineWithSelection, [{
  ...selectionContextEntry,
  createdAt: "2026-06-18T08:02:00.000Z",
}], "2026-06-18T08:02:00.000Z");
assert.equal(repeatedSelection, timelineWithSelection, "an identical selection-context replay must preserve the timeline document");
assert.equal(repeatedSelection.updatedAt, selectionContextEntry.createdAt);
assert.equal(
  repeatedSelection.entries.find((entry) => entry.id === selectionContextEntry.id)?.createdAt,
  selectionContextEntry.createdAt,
);

const changedSelection = appendVibeAgentTimelineEntries(timelineWithSelection, [{
  ...selectionContextEntry,
  createdAt: "2026-06-18T08:03:00.000Z",
  body: "现在你说“这个”，我会理解为已更新的镜头 P10ES01。",
}], "2026-06-18T08:03:00.000Z");
assert.notEqual(changedSelection, timelineWithSelection, "a changed selection context must still update the timeline");
assert.equal(changedSelection.updatedAt, "2026-06-18T08:03:00.000Z");
assert.equal(
  changedSelection.entries.find((entry) => entry.id === selectionContextEntry.id)?.body,
  "现在你说“这个”，我会理解为已更新的镜头 P10ES01。",
);

const otherProject = createProjectVibe({
  projectId: "other-project",
  title: "Other Project",
  createdAt: generatedAt,
  updatedAt: generatedAt,
});
const mismatch = await openProjectAgentTimeline(target, {
  project: otherProject,
  generatedAt,
});
assert.equal(mismatch.ok, false);
assert.equal(mismatch.status, "project_mismatch");
assert.equal(mismatch.timeline.projectId, "other-project");
assert.equal(mismatch.timeline.entries.length, 0);

storage.setItem(`${target.storageKey}:${projectAgentTimelinePath}`, "{not-json");
const invalid = await openProjectAgentTimeline(target, {
  project,
  generatedAt,
});
assert.equal(invalid.ok, false);
assert.equal(invalid.status, "invalid");
assert.equal(invalid.timeline.projectId, "agent-timeline-demo");
assert.equal(invalid.timeline.entries.length, 0);

const runtimeRelativeRoot = ".vibe-runtime/browser-projects/agent-timeline-demo";
const runtimeAbsoluteRoot = `/Users/lichenhao/Desktop/new vibe directing/${runtimeRelativeRoot}`;
const rootScopedTarget = {
  storageKey: "project-agent-timeline-root-test",
  projectPath: projectVibeFileName,
  projectRoot: runtimeRelativeRoot,
};
const rootTimeline = appendVibeAgentTimelineEntries(
  createVibeAgentTimelineDocument({
    projectId: project.manifest.projectId,
    projectTitle: project.manifest.title,
    projectRoot: runtimeRelativeRoot,
    generatedAt,
  }),
  [
    {
      id: "agent_action_report_relative_root",
      type: "action_result",
      createdAt: generatedAt,
      title: "完成结果：项目已更新",
      body: "修改已写入项目",
      toolName: "write_project",
      actionKind: "revise_story_or_shot",
      status: "done",
    },
  ] satisfies VibeAgentTimelineEntry[],
  generatedAt,
);
const rootSaved = await saveProjectAgentTimeline(rootScopedTarget, rootTimeline);
assert.equal(rootSaved.ok, true);
const rootRestored = await openProjectAgentTimeline({
  ...rootScopedTarget,
  projectRoot: runtimeAbsoluteRoot,
}, {
  project,
  projectRoot: runtimeAbsoluteRoot,
  generatedAt,
});
assert.equal(rootRestored.ok, true);
assert.equal(rootRestored.status, "restored");
assert.equal(rootRestored.timeline.entries.some((entry) => entry.id === "agent_action_report_relative_root"), true);

const tmpAliasTarget = {
  storageKey: "project-agent-timeline-tmp-alias-test",
  projectPath: projectVibeFileName,
  projectRoot: "/tmp/agent-timeline-local-project",
};
const tmpAliasTimeline = appendVibeAgentTimelineEntries(
  createVibeAgentTimelineDocument({
    projectId: project.manifest.projectId,
    projectTitle: project.manifest.title,
    projectRoot: "/private/tmp/agent-timeline-local-project",
    generatedAt,
  }),
  [{
    id: "agent_action_report_private_tmp_root",
    type: "action_result",
    createdAt: generatedAt,
    title: "完成结果：导出已完成",
    body: "本地交付包已写入。",
    toolName: "export_project",
    actionKind: "prepare_export",
    status: "done",
  }] satisfies VibeAgentTimelineEntry[],
  generatedAt,
);
storage.setItem(
  `${tmpAliasTarget.storageKey}:${projectAgentTimelinePath}`,
  JSON.stringify(tmpAliasTimeline),
);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("runtime unavailable in timeline unit test");
};
const tmpAliasRestored = await openProjectAgentTimeline(tmpAliasTarget, {
  project,
  projectRoot: tmpAliasTarget.projectRoot,
  generatedAt,
});
globalThis.fetch = originalFetch;
assert.equal(tmpAliasRestored.ok, true);
assert.equal(tmpAliasRestored.status, "restored");
assert.equal(tmpAliasRestored.timeline.entries.some((entry) => entry.id === "agent_action_report_private_tmp_root"), true);

const boundTurnEntries = bindProjectAgentTimelineEntriesToIdentity([
  {
    id: "current_turn_confirmation",
    type: "confirmation_request",
    createdAt: "2026-06-18T08:00:00.500Z",
    title: "确认生成参考",
    body: "等你确认后再执行。",
    status: "waiting",
    details: { expectedReceipt: "image_reference_receipt" },
  },
] satisfies VibeAgentTimelineEntry[], {
  projectId: project.manifest.projectId,
  projectRoot: "/private/tmp/agent-timeline-local-project",
  projectFactHash: "current-project-facts",
});
assert.equal(boundTurnEntries[0]?.details?.projectId, project.manifest.projectId);
assert.equal(boundTurnEntries[0]?.details?.projectRoot, "/tmp/agent-timeline-local-project");
assert.equal(boundTurnEntries[0]?.details?.projectFactHash, "current-project-facts");
assert.equal(boundTurnEntries[0]?.details?.expectedReceipt, "image_reference_receipt");

const migratedEntries = migrateProjectAgentTimelineEntriesToProjectRoot([
  ...timeline.entries,
  {
    id: "stale_fact_confirmation",
    type: "confirmation_request",
    createdAt: "2026-06-18T08:00:01.000Z",
    title: "旧确认",
    body: "旧项目事实的确认不应迁移。",
    status: "waiting",
    details: {
      projectId: project.manifest.projectId,
      projectFactHash: "older-project-facts",
    },
  },
  {
    id: "other_project_confirmation",
    type: "confirmation_request",
    createdAt: "2026-06-18T08:00:02.000Z",
    title: "其他项目确认",
    body: "其他项目的确认不应迁移。",
    status: "waiting",
    details: {
      projectId: "another-project",
      projectFactHash: "current-project-facts",
    },
  },
  {
    id: "unbound_waiting_confirmation",
    type: "confirmation_request",
    createdAt: "2026-06-18T08:00:03.000Z",
    title: "无身份确认",
    body: "缺少项目事实身份的确认不应迁移。",
    status: "waiting",
  },
] satisfies VibeAgentTimelineEntry[], {
  projectId: project.manifest.projectId,
  sourceProjectRoot: undefined,
  targetProjectRoot: "/tmp/agent-timeline-local-project",
  projectFactHash: "current-project-facts",
});
assert.equal(migratedEntries.some((entry) => entry.id === "agent_user_continue"), true);
assert.equal(migratedEntries.some((entry) => entry.id === "stale_fact_confirmation"), false);
assert.equal(migratedEntries.some((entry) => entry.id === "other_project_confirmation"), false);
assert.equal(migratedEntries.some((entry) => entry.id === "unbound_waiting_confirmation"), false);
assert.equal(migratedEntries.every((entry) => entry.details?.projectId === project.manifest.projectId), true);
assert.equal(migratedEntries.every((entry) => entry.details?.projectRoot === "/tmp/agent-timeline-local-project"), true);
assert.equal(migratedEntries.every((entry) => entry.details?.projectFactHash === "current-project-facts"), true);

console.log("project-agent-timeline-test: ok");
