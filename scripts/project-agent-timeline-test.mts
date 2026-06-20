import assert from "node:assert/strict";

import {
  createProjectVibe,
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
      title: "工具返回",
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
      title: "结果卡片：项目已更新",
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

console.log("project-agent-timeline-test: ok");
