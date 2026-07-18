import { readFileSync } from "node:fs";

import { runDirectorProductAgentLoop } from "../src/agent/index.ts";
import {
  buildProjectAgentStagedPlanDraft,
  buildProjectRuntimeStateFromProjectVibe,
  clearProjectAgentStagedPlanDraft,
  hashProjectVibeFacts,
  migrateProjectAgentStagedPlanDraftToProjectRoot,
  openProjectAgentStagedPlanDraft,
  parseProjectVibeText,
  projectAgentStagedPlanDraftForProjection,
  projectVibeFileName,
  restoreProjectAgentStagedPlanDraft,
  saveProjectAgentStagedPlanDraft,
  type ProjectVibeDocument,
} from "../src/project/index.ts";
import {
  projectAgentStagedPlanDraftPath,
} from "../src/project/projectAgentStagedPlanDraft";

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

const generatedAt = "2026-05-31T05:00:00.000Z";
const projectRoot = "/tmp/director-agent-staged-plan";
const appSource = readFileSync("src/App.tsx", "utf8");
const stagedPlanSource = readFileSync("src/project/projectAgentStagedPlanDraft.ts", "utf8");
const fixtureText = readFileSync("test-fixtures/projects/agent-loop-minimal/project.vibe", "utf8");
const opened = parseProjectVibeText(fixtureText);
assert(opened.ok && opened.project, `fixture should open: ${opened.errors.join("; ")}`);
const project = opened.project as ProjectVibeDocument;
const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
});

const stagedLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "把第二个镜头改成故事板快切，但先不要提交视频",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});

assert(stagedLoop.status === "awaiting_confirmation", "Agent loop should stage a confirmable plan");
assert(stagedLoop.projectVibeWritten === false, "staged plan must not write Project.vibe");
assert(/function agentStagedPlanRestoreLabel/.test(appSource), "App should expose a creator-facing label for staged Agent plan restore state");
assert(/function projectDraftRecordLabel/.test(appSource), "App should derive project storage copy from local project vs browser draft state");
assert(/projectDraftRestoredLabel\(prototypeProjectDraftTarget,\s*result\.mode/.test(appSource), "Project restore status must use storage-aware browser-draft/local-project copy");
assert(/agentStagedPlanRestoreLabel\(stagedPlanOpen,\s*draftRecordLabel\)/.test(appSource), "Agent restored-plan copy must inherit the storage-aware project label");
assert(/fact_hash_mismatch[\s\S]*项目已经变化，上次待确认计划已失效/.test(appSource), "Project.vibe changes should explain why an Agent staged plan was not restored");
assert(/project_mismatch[\s\S]*项目已切换，上次待确认计划未恢复/.test(appSource), "project mismatches should explain why an Agent staged plan was not restored");
assert(/projectRecordLabel:\s*agentStagedPlanRestoreNotice\(stagedPlanOpen\)/.test(appSource), "non-restored Agent staged plans should surface a compact notice in the Agent result");
assert(/projectTaskLabel:\s*stagedPlanOpen\.ok \? "继续确认上次动作"/.test(appSource), "restored Agent staged plans should tell the creator they can continue confirmation");
assert(/if \(runtimeWriteOk\) \{[\s\S]*return \{[\s\S]*status: "written"[\s\S]*const writeResult = await writeProjectVibeSidecarText/.test(stagedPlanSource), "an atomic runtime staged-plan write must return before the fallback writer");

const stagedAssetLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这个角色参考要保留短发，但表情更警觉一点",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_char_mira",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedAssetLoop.status === "awaiting_confirmation", "selected asset Agent loop should stage a confirmable plan");
assert(stagedAssetLoop.action.target.kind === "asset", "selected asset Agent plan should target the selected asset");
assert(stagedAssetLoop.action.proposedChanges.some((change) => change.field === "assetRoleBinding" && change.to === "角色参考"), "selected asset Agent plan should preserve natural-language asset role binding");

const draft = buildProjectAgentStagedPlanDraft({
  project,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
  userIntent: "把第二个镜头改成故事板快切，但先不要提交视频",
  scopeLabel: "镜头 shot_002",
  selectedShotId: "shot_002",
  action: stagedLoop.action,
  toolHandoff: stagedLoop.toolHandoff,
  qaFeedback: stagedLoop.qaFeedback,
  loopStatus: stagedLoop.status,
  blockedReasons: stagedLoop.blockedReasons,
});

assert(draft.projectId === project.manifest.projectId, "draft should bind to the source project id");
assert(draft.projectRoot === projectRoot, "draft should bind to the source project root");
assert(draft.sourceFactHash === hashProjectVibeFacts(project), "draft should bind to the source Project.vibe hash");
assert(draft.action?.sourceContext.projectRoot === projectRoot, "draft action should keep its project root context");
assert(draft.toolHandoff?.actionId === draft.action?.actionId, "draft handoff should stay bound to the staged action");

const assetDraft = buildProjectAgentStagedPlanDraft({
  project,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
  userIntent: stagedAssetLoop.action.sourceContext.userIntent,
  scopeLabel: "参考素材 asset_char_mira",
  selectedAssetId: "asset_char_mira",
  action: stagedAssetLoop.action,
  toolHandoff: stagedAssetLoop.toolHandoff,
  qaFeedback: stagedAssetLoop.qaFeedback,
  loopStatus: stagedAssetLoop.status,
  blockedReasons: stagedAssetLoop.blockedReasons,
});
assert(assetDraft.selectedAssetId === "asset_char_mira", "draft should preserve selected asset scope");
assert(assetDraft.action?.target.ids[0] === "asset_char_mira", "draft action should keep the selected asset target");

const browserStorage = createLocalStorageShim();
installWindowShim({ localStorage: browserStorage.storage });

try {
  const target = { storageKey: "test:agent-staged-plan-draft" };
  const saveResult = await saveProjectAgentStagedPlanDraft(target, draft);
  assert(saveResult.ok && saveResult.status === "written", "draft should save to sidecar storage");
  assert(
    browserStorage.values.has(`test:agent-staged-plan-draft:${projectAgentStagedPlanDraftPath}`),
    "draft should write the agent sidecar path",
  );

  const restored = await openProjectAgentStagedPlanDraft(target, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(restored.ok && restored.status === "restored" && restored.draft, "matching project should restore the staged plan");
  assert(restored.draft.action?.actionId === stagedLoop.action.actionId, "restored draft should keep the staged action");

  await saveProjectAgentStagedPlanDraft(target, assetDraft);
  const restoredAssetDraft = await openProjectAgentStagedPlanDraft(target, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(restoredAssetDraft.ok && restoredAssetDraft.draft?.selectedAssetId === "asset_char_mira", "restored draft should keep selected asset scope");
  assert(restoredAssetDraft.draft?.action?.target.kind === "asset", "restored draft should keep asset target kind");

  await saveProjectAgentStagedPlanDraft(target, draft);
  const changedProject = {
    ...project,
    manifest: {
      ...project.manifest,
      title: `${project.manifest.title} changed`,
    },
  };
  const changedProjectRestore = await openProjectAgentStagedPlanDraft(target, {
    project: changedProject,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(changedProjectRestore.status === "fact_hash_mismatch", "changed Project.vibe facts should invalidate the staged plan");

  const wrongRootRestore = await openProjectAgentStagedPlanDraft(target, {
    project,
    projectRoot: "/tmp/another-project",
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(wrongRootRestore.status === "root_mismatch", "another project root should invalidate the staged plan");

  const expiredRestore = await openProjectAgentStagedPlanDraft(target, {
    project,
    projectRoot,
    now: "2026-06-02T06:00:00.000Z",
  });
  assert(expiredRestore.status === "expired", "expired drafts should not restore");

  const directRestore = restoreProjectAgentStagedPlanDraft(draft, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(directRestore.ok && directRestore.status === "restored", "pure restore helper should accept a matching draft");

  const browserDraft = {
    ...draft,
    projectRoot: undefined,
    action: {
      ...draft.action!,
      sourceContext: {
        ...draft.action!.sourceContext,
        projectRoot: ".vibe-runtime/browser-projects/staged-plan-draft",
      },
    },
  };
  const migratedBrowserDraft = migrateProjectAgentStagedPlanDraftToProjectRoot(browserDraft, {
    project,
    sourceProjectRoot: undefined,
    targetProjectRoot: projectRoot,
    projectPath: projectVibeFileName,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(migratedBrowserDraft.ok && migratedBrowserDraft.draft?.projectRoot === projectRoot, "a matching browser staged plan should explicitly rebind to the chosen local root");
  assert(migratedBrowserDraft.draft?.action?.sourceContext.projectRoot === projectRoot, "staged-plan migration must rebind the nested Agent action root");

  const unboundLocalDraft = restoreProjectAgentStagedPlanDraft(browserDraft, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(unboundLocalDraft.status === "root_mismatch", "an unbound browser draft must not restore directly into a local project without explicit migration");

  const privateTmpRestore = restoreProjectAgentStagedPlanDraft({
    ...draft,
    projectRoot: `/private${projectRoot}`,
    action: {
      ...draft.action!,
      sourceContext: {
        ...draft.action!.sourceContext,
        projectRoot: `/private${projectRoot}`,
      },
    },
  }, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(privateTmpRestore.ok && privateTmpRestore.status === "restored", "macOS /private/tmp staged roots should restore against /tmp project bindings");

  const missingShotArrayRestore = restoreProjectAgentStagedPlanDraft({
    ...draft,
    selectedShotIds: undefined,
  }, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(missingShotArrayRestore.status === "invalid", "corrupt drafts without selectedShotIds must not restore into the UI");

  const mismatchedHandoffRestore = restoreProjectAgentStagedPlanDraft({
    ...draft,
    toolHandoff: {
      ...draft.toolHandoff!,
      actionId: "another_agent_action",
    },
  }, {
    project,
    projectRoot,
    now: "2026-05-31T06:00:00.000Z",
  });
  assert(mismatchedHandoffRestore.status === "invalid", "drafts with mismatched action and handoff ids must not restore");

  await clearProjectAgentStagedPlanDraft(target, {
    project,
    projectRoot,
    projectPath: projectVibeFileName,
    generatedAt: "2026-05-31T07:00:00.000Z",
  });
  const clearedRestore = await openProjectAgentStagedPlanDraft(target, {
    project,
    projectRoot,
    now: "2026-05-31T07:00:01.000Z",
  });
  assert(clearedRestore.status === "cleared", "cleared marker should prevent stale plan recovery");
  assert(
    projectAgentStagedPlanDraftForProjection(clearedRestore)?.status === "cleared",
    "a current-fact cleared marker should remain available to suppress older UI confirmations",
  );
  const staleClearedRestore = await openProjectAgentStagedPlanDraft(target, {
    project: changedProject,
    projectRoot,
    now: "2026-05-31T07:00:01.000Z",
  });
  assert(staleClearedRestore.status === "fact_hash_mismatch", "a cleared marker from older project facts must not suppress current confirmations");
  assert(!projectAgentStagedPlanDraftForProjection(staleClearedRestore), "a stale cleared marker must not enter the current-task projection");
  assert(
    !projectAgentStagedPlanDraftForProjection({ ...directRestore, ok: false, status: "cleared", draft }),
    "a synthetic clear result for an active superseded draft must not revive that draft in the UI",
  );
} finally {
  delete (globalThis as { window?: unknown }).window;
}

console.log("project-agent-staged-plan-draft-test passed");
