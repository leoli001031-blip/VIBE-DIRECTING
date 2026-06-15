import { readFileSync } from "node:fs";

import {
  appendProjectAgentActionLogItem,
  buildProjectAgentActionLogDocument,
  openProjectAgentActionLog,
  parseProjectVibeText,
  projectAgentActionLogPath,
  projectVibeFileName,
  rememberProjectAgentActionLogItem,
  type ProjectAgentActionLogItem,
  type ProjectVibeDocument,
} from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function installWindowShim(windowShim: unknown) {
  (globalThis as { window?: unknown }).window = windowShim;
}

function createLocalStorageShim() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    },
  };
}

const appSource = readFileSync("src/App.tsx", "utf8");
const minimalAgentPanelSource = readFileSync("src/ui/director/MinimalAgentPanel.tsx", "utf8");
const fixtureText = readFileSync("test-fixtures/projects/agent-loop-minimal/project.vibe", "utf8");
const opened = parseProjectVibeText(fixtureText);
assert(opened.ok && opened.project, `fixture should open: ${opened.errors.join("; ")}`);
const project = opened.project as ProjectVibeDocument;
const projectRoot = "/tmp/director-agent-action-log";
const generatedAt = "2026-06-01T01:00:00.000Z";

const item: ProjectAgentActionLogItem = {
  id: "agent_action_001",
  title: "补齐参考",
  scope: "镜头 1-2",
  result: "参考已开始生成",
  nextStep: "去参考区看进度",
  resultView: { view: "assets", label: "去参考" },
  followUpIntent: "继续刚才的动作：补齐参考\n我想调整：",
  tone: "waiting",
  createdAt: generatedAt,
};

assert(/openProjectAgentActionLog/.test(appSource), "App should restore the Agent action log sidecar with the project");
assert(/appendProjectAgentActionLogItem/.test(appSource), "App should persist confirmed Agent action log items");
assert(/restoredAgentActionLog=\{restoredAgentActionLog\}/.test(appSource), "App should pass restored Agent action log items to the composer");
assert(/onRememberAgentActionLogItem=\{rememberConfirmedProjectAgentAction\}/.test(appSource), "App should let the composer persist confirmed Agent actions");
assert(/restoredAgentActionLog\?: ProjectAgentActionLogItem\[\]/.test(minimalAgentPanelSource), "Agent composer should accept restored project action log items");
assert(/onRememberAgentActionLogItem\?: \(item: ProjectAgentActionLogItem\)/.test(minimalAgentPanelSource), "Agent composer should expose a persistence callback for confirmed actions");
assert(/restoredAgentLogKeyRef/.test(minimalAgentPanelSource), "Agent composer should guard restored log replay by a stable key");
assert(/onRememberAgentActionLogItem\?\.\(item\)/.test(minimalAgentPanelSource), "Agent composer should call the persistence callback when remembering a confirmed action");

const doc = buildProjectAgentActionLogDocument({
  project,
  projectRoot,
  generatedAt,
  items: [item],
});
assert(doc.projectId === project.manifest.projectId, "action log should bind to project id");
assert(doc.projectRoot === projectRoot, "action log should bind to project root");
assert(doc.items[0]?.resultView?.view === "assets", "action log should preserve result navigation");

const newerItem: ProjectAgentActionLogItem = {
  ...item,
  result: "参考已生成，去参考区复核",
  nextStep: "去参考区复核",
  tone: "done",
  createdAt: "2026-06-01T01:05:00.000Z",
};
const remembered = rememberProjectAgentActionLogItem([item], newerItem);
assert(remembered.length === 1, "action log should dedupe by action id");
assert(remembered[0]?.result.includes("已生成"), "newer action log item should replace the older duplicate");

const browserStorage = createLocalStorageShim();
installWindowShim({ localStorage: browserStorage.storage });

try {
  const target = { storageKey: "test:agent-action-log" };
  const firstWrite = await appendProjectAgentActionLogItem(target, {
    project,
    projectRoot,
    generatedAt,
    item,
  });
  assert(firstWrite.ok && firstWrite.status === "written", "first Agent action log item should write to sidecar storage");
  assert(
    browserStorage.values.has(`test:agent-action-log:${projectAgentActionLogPath}`),
    "action log should use the agent action sidecar path",
  );

  const secondWrite = await appendProjectAgentActionLogItem(target, {
    project,
    projectRoot,
    generatedAt: newerItem.createdAt,
    item: newerItem,
  });
  assert(secondWrite.ok && secondWrite.items.length === 1, "duplicate action should update the existing log item");
  assert(secondWrite.items[0]?.tone === "done", "duplicate action should keep the newest tone");

  const restored = await openProjectAgentActionLog(target, {
    project,
    projectRoot,
  });
  assert(restored.ok && restored.status === "restored", "matching project should restore the action log");
  assert(restored.items[0]?.id === item.id, "restored log should keep the action id");
  assert(restored.items[0]?.resultView?.label === "去参考", "restored log should keep result view copy");

  const mismatch = await openProjectAgentActionLog(target, {
    project,
    projectRoot: "/tmp/another-project",
  });
  assert(!mismatch.ok && mismatch.status === "project_mismatch", "another project root should not restore this action log");
} finally {
  delete (globalThis as { window?: unknown }).window;
}

console.log("project-agent-action-log-test passed");
