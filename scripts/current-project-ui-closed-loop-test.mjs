import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

function findFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} is missing`);
  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} has no params`);
  let paramDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramDepth += 1;
    if (char === ")") paramDepth -= 1;
    if (paramDepth === 0) {
      paramsClose = index;
      break;
    }
  }
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} has no body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${functionName} body was not closed`);
}

async function importProjectRealChainStatus() {
  const sourcePath = "src/core/projectRealChainStatus.ts";
  const output = ts.transpileModule(readText(sourcePath), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  return import(dataUrl(sourcePath, output.outputText));
}

async function importCurrentProjectWorkbenchProjection() {
  const sourcePath = "src/core/currentProjectWorkbenchProjection.ts";
  const output = ts.transpileModule(readText(sourcePath), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  return import(dataUrl(sourcePath, output.outputText));
}

function assertProductCopy(message) {
  assert(/未选择项目|未同步/.test(message || ""), "unbound/mismatch copy should be product-facing");
  assert(!/005|fallback|endpoint|provider|ledger|prompt|queue/i.test(message || ""), "unbound/mismatch copy must not expose engineering/demo details");
}

function assertCreatorPanelContract() {
  const appSource = readText("src/App.tsx");
  const stylesSource = readText("src/styles.css");
  const app = findFunctionBody(appSource, "App");
  const panel = findFunctionBody(appSource, "ProjectRealChainPanel");
  const surface = [
    panel,
    findFunctionBody(appSource, "projectRealChainStatusLabel"),
    findFunctionBody(appSource, "projectReviewCheckStatusLabel"),
    findFunctionBody(appSource, "projectReviewCheckDetail"),
    findFunctionBody(appSource, "projectPreviewReadyLabel"),
    findFunctionBody(appSource, "projectProductionReviewLabel"),
  ].join("\n");

  for (const [label, pattern] of [
    ["runtime endpoint", /runtime\s+endpoint/i],
    ["fallback report", /fallback\s+report/i],
    ["005 sandbox", /005\s+sandbox/i],
    ["real demo id", /real_demo_e2e_005/i],
    ["demo", /\bdemo\b/i],
    ["provider submit", /provider\s+submit|provider\s+未提交/i],
    ["provider", /\bprovider\b/i],
    ["prompt", /\bprompt\b/i],
    ["queue", /\bqueue\b/i],
    ["prepare ran", /prepare\s+ran|prepareRan|prepare\s+未执行/i],
    ["live submit", /live\s+submit/i],
    ["ledger", /\bledger\b/i],
    ["needs review English", /needs\s+review/i],
  ]) {
    assert(!pattern.test(surface), `ProjectRealChainPanel exposed ${label}`);
  }

  assert(/项目状态/.test(surface), "ProjectRealChainPanel should expose creator-facing project status copy");
  assert(/本地复核/.test(surface), "ProjectRealChainPanel should expose creator-facing review copy");
  assert(/未选择项目/.test(surface), "ProjectRealChainPanel should expose unbound project copy");
  assert(/未同步/.test(surface), "ProjectRealChainPanel should expose unsynced project copy");
  assert(/项目路径/.test(surface), "ProjectRealChainPanel should expose project path selection copy");
  assert(/最近项目/.test(surface), "ProjectRealChainPanel should expose recent projects copy");
  assert(/连接项目/.test(surface), "ProjectRealChainPanel should expose connect project copy");
  assert(/Preview[\s\S]*ready/.test(surface), "ProjectRealChainPanel should expose preview ready state");
  assert(/Production[\s\S]*needs_review/.test(surface), "ProjectRealChainPanel should expose production review state");
  assert(/displayTitle[\s\S]*状态已回流/.test(surface), "ProjectRealChainPanel should show the bound title for returned status");
  assert(/selectCurrentProjectBinding\(\{\s*projectRoot/.test(app), "App must select the current project through the runtime helper");
  assert(/loadCurrentProjectChoices\(\)/.test(app), "App must load recent project choices through the runtime helper");
  assert(/selectProjectChoice/.test(app), "App must route recent project choices through the current selection helper");
  assert(/refreshCurrentProjectPanels\(binding\)/.test(app), "App must refresh current binding and project panels after selection");
  assert(/loadCurrentProjectBindingStatus\(\)/.test(app), "App must load runtime current project binding first");
  assert(/currentProjectBindingIdentity\(runtimeProjectBinding\)/.test(app), "App must derive current project identity from runtime binding");
  assert(!/currentProjectIdentity\(runtimeState\)/.test(app), "App must not derive current project identity from runtime-state.json");
  assert(/loadProjectRealChainStatus\(runtimeProjectIdentity\)/.test(app), "App must guard real-chain status by runtime binding identity");
  assert(/loadProjectImage2BatchPlan\(runtimeProjectIdentity\)/.test(app), "App must guard Image2 batch status by runtime binding identity");
  assert(/runProjectRealChainCheck\(runtimeProjectIdentity\)/.test(app), "App run-check must use runtime binding identity");
  assert(/runProjectImage2BatchCheck\(runtimeProjectIdentity\)/.test(app), "App Image2 check must use runtime binding identity");
  assert(/buildCurrentProjectWorkbenchProjection\(\{[\s\S]*binding:\s*runtimeProjectBinding[\s\S]*realChainState:\s*projectRealChainState[\s\S]*image2BatchState:\s*projectImage2BatchState/.test(app), "App must derive the main workbench from current project runtime projection");
  assert(/applyCurrentProjectWorkbenchProjectionToRuntimeState\(runtimeState,\s*currentProjectWorkbenchProjection\)/.test(app), "App must bind Story Flow to the current project workbench projection");
  assert(/assetLibraryReadOnlyDetail=\{currentProjectWorkbenchProjection\.assets\.detail\}/.test(app), "App must bind Asset Library fallback copy to the current project projection");
  assert(/projectScopeLabel=\{currentProjectWorkbenchProjection\.selectedScope\.label\}/.test(app), "App must bind Agent scope to the current project projection");
  assert(/runtimeState=\{workbenchRuntimeState\}/.test(app), "DirectorMode must receive the current project workbench runtime state");
  assert(/确认修改/.test(appSource), "Agent Panel confirmation action should use creator-facing confirmation copy");
  assert(/等待写入项目事实/.test(appSource), "Agent Panel confirmation receipt should expose pending project-fact write status");
  assert(/providerCalled\s*===\s*false/.test(appSource) || /providerCalled/.test(appSource), "App source should preserve provider-called false contract in runtime projections");
  assert(!/real-demo-005/.test(`${appSource}\n${stylesSource}`), "app/styles should not retain 005 demo class names");
}

const {
  currentProjectBindingIdentity,
  deriveCurrentProjectChoices,
  deriveCurrentProjectBindingStatus,
  deriveProjectRealChainStatus,
  deriveProjectImage2BatchPlanStatus,
  guardProjectRealChainUiStateForCurrentProject,
  guardProjectImage2BatchUiStateForCurrentProject,
  projectRuntimeRequestPath,
} = await importProjectRealChainStatus();
const {
  buildCurrentProjectWorkbenchProjection,
  currentProjectWorkbenchProjectionSource,
} = await importCurrentProjectWorkbenchProjection();

assertCreatorPanelContract();

const currentEndpoint = "/api/runtime/projects/current/real-chain/status";
const queryPath = projectRuntimeRequestPath(currentEndpoint, {
  projectId: "最后一班星图",
  projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429",
});
assert(queryPath === currentEndpoint, "current project requests must not carry project id/root query params");

function currentProjectBindingResponse(project) {
  return {
    ok: true,
    status: "bound",
    currentProject: {
      bound: true,
      bindingPath: ".vibe/current-project-binding.json",
      binding: {
        schemaVersion: "vibe_core_current_project_binding_v1",
        projectRoot: project.projectRoot,
        projectRootRelativePath: project.projectRoot,
        projectVibeRelativePath: `${project.projectRoot}/project/project.vibe`,
        projectId: project.projectId,
        displayName: project.title,
        selectedAt: "2026-05-08T00:00:00.000Z",
      },
      project: {
        projectId: project.projectId,
        projectRoot: project.projectRoot,
        projectVibePath: `${project.projectRoot}/project/project.vibe`,
        title: project.title,
      },
      projectRoot: project.projectRoot,
      projectRootRelativePath: project.projectRoot,
      projectVibeRelativePath: `${project.projectRoot}/project/project.vibe`,
    },
  };
}

const boundBinding = deriveCurrentProjectBindingStatus({
  ...currentProjectBindingResponse({
    projectId: "real-demo-e2e-004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
    title: "004 当前项目",
  }),
});
assert(boundBinding.status === "bound", "bound current project status should parse");
assert(boundBinding.projectTitle === "004 当前项目", "bound current project title should parse");
assert(currentProjectBindingIdentity(boundBinding)?.projectId === "real-demo-e2e-004", "bound identity should include project id from currentProject.project");
assert(currentProjectBindingIdentity(boundBinding)?.projectRoot?.endsWith("/004"), "bound identity should come from current binding");

const binding005 = deriveCurrentProjectBindingStatus({
  ...currentProjectBindingResponse({
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
    title: "005 当前项目",
  }),
});

const unboundBinding = deriveCurrentProjectBindingStatus({ status: "unbound" });
assert(unboundBinding.status === "unbound", "unbound current project status should parse");
assert(!currentProjectBindingIdentity(unboundBinding), "unbound current project must not produce an identity");
assertProductCopy(unboundBinding.message);

const currentChoices = deriveCurrentProjectChoices({
  ok: true,
  choices: [
    { projectRoot: "real-test-sandbox/real-demo-e2e/004-image2-start-frames", displayName: "项目 004", projectId: "real_demo_e2e_004_image2_start_frames", status: "当前" },
    { projectRoot: "/Users/lichenhao/Desktop/vibe core/absolute-leak", displayName: "不应显示" },
  ],
});
assert(currentChoices.length === 1, "recent project choices should hide absolute paths");
assert(currentChoices[0].displayName === "项目 004", "recent project choices should preserve product display names");
assert(currentChoices[0].projectRoot.includes("004-image2-start-frames"), "recent project choices should remain selectable");

const stale005Payload = {
  schemaVersion: "current_project_real_chain_status.v1",
  project: {
    projectId: "real-demo-e2e-005",
    runId: "real_demo_e2e_005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  status: "preview_ready_with_review",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  returnedImageCount: 8,
  totalPlannedImages: 8,
  needsReviewCount: 2,
  reviewShotIds: ["S07", "S08"],
  previewItems: [
    { shotId: "S07", order: 7, imageUrl: "/files/S07.png", reviewRequired: true },
    { shotId: "S08", order: 8, imageUrl: "/files/S08.png", reviewRequired: true },
  ],
  providerCalled: false,
  prepareRan: false,
};

const workbenchFacts004 = {
  schemaVersion: "vibe_core_current_project_workbench_facts_v1",
  source: "current_project_files",
  project: {
    projectId: "real-demo-e2e-004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
    projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/project.vibe",
  },
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/project.vibe",
  sourceIndex: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/source_index.json",
    sourceIndexHash: "sha256:004",
    refs: ["story_flow.json", "visual_memory.json"],
  },
  storyFlow: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/story_flow.json",
    shotCount: 2,
    sectionCount: 1,
    sections: [{ id: "scene_observatory_archive", label: "Old observatory archive", shotIds: ["S01", "S02"] }],
    shots: [
      { id: "S01", sceneId: "scene_observatory_archive", sectionId: "scene_observatory_archive", title: "Naya enters", storyFunction: "Naya enters the archive." },
      { id: "S02", sceneId: "scene_observatory_archive", sectionId: "scene_observatory_archive", title: "Naya reads", storyFunction: "Naya reads the coordinate note." },
    ],
  },
  visualMemory: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/visual_memory.json",
    assetCount: 4,
    assets: [
      { id: "char_naya", type: "character", name: "Naya Chen", status: "locked", textConstraints: ["short black bob"], usedByShotIds: ["S01", "S02"], sourceRefs: ["visual_memory.roles:0"] },
      { id: "char_ivo", type: "character", name: "Ivo Mark", status: "candidate", textConstraints: ["dark green raincoat"], usedByShotIds: [], sourceRefs: ["visual_memory.roles:1"] },
      { id: "scene_archive", type: "scene", name: "Old archive", status: "needs_review", textConstraints: ["brass star map table"], usedByShotIds: ["S01"], sourceRefs: ["visual_memory.scenes:0"] },
      { id: "style_quiet", type: "style", name: "Quiet sci-fi", status: "rejected", textConstraints: ["low texture"], usedByShotIds: [], sourceRefs: ["visual_memory.style"], rejectedReason: "old style" },
    ],
    summary: { locked: 1, candidate: 1, needsReview: 1, rejected: 1, missing: 0 },
  },
  providerCalled: false,
  prepareRan: false,
  projectVibeWritten: false,
};

const workbenchFacts005 = {
  ...workbenchFacts004,
  project: {
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
    projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/project/project.vibe",
  },
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/project/project.vibe",
  storyFlow: {
    ...workbenchFacts004.storyFlow,
    shots: [
      { id: "S07", sceneId: "scene_service_tunnel", sectionId: "scene_service_tunnel", title: "Door opens", storyFunction: "Mika and Ren stop at the cold stairwell." },
      { id: "S08", sceneId: "scene_rooftop_array", sectionId: "scene_rooftop_array", title: "Signal", storyFunction: "Mika and Ren face the first signal." },
    ],
    sections: [{ id: "scene_service_tunnel", label: "Rainy tunnel", shotIds: ["S07"] }, { id: "scene_rooftop_array", label: "Rooftop", shotIds: ["S08"] }],
  },
  visualMemory: {
    ...workbenchFacts004.visualMemory,
    assets: [
      { id: "char_mika", type: "character", name: "Mika Aoyama", status: "locked", textConstraints: ["red star hairpin"], usedByShotIds: ["S07", "S08"], sourceRefs: ["visual_memory.roles:0"] },
      { id: "char_ren", type: "character", name: "Ren Kisaragi", status: "locked", textConstraints: ["olive hooded parka"], usedByShotIds: ["S07", "S08"], sourceRefs: ["visual_memory.roles:1"] },
    ],
    assetCount: 2,
    summary: { locked: 2, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
};

const realChain = deriveProjectRealChainStatus(stale005Payload, "runtime_endpoint");
assert(realChain.uiStatus === "production_needs_review", `real-chain UI status drifted: ${realChain.uiStatus}`);
assert(realChain.returnedImageCount === 8, "real-chain should report returned images");
assert(realChain.needsReviewCount === 2, "real-chain should report review count");
assert(realChain.providerCalled === false, "real-chain status must not imply provider call");
assert(realChain.prepareRan === false, "real-chain status must not imply prepare run");

const realChainMatched = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain.uiStatus, summary: realChain },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(realChainMatched.status === "production_needs_review", "matching real-chain identity should pass through");

for (const [label, identity] of [
  ["004 current identity", { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" }],
  ["same id different root", { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" }],
  ["same root different id", { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" }],
  ["id-only weak fallback", { projectId: "real-demo-e2e-005" }],
  ["other current identity", { projectId: "actual-current-project", projectRoot: "/Users/lichenhao/Desktop/some-other-project-root" }],
  ["repo-outside suffix 005 identity", { projectId: "external-005", projectRoot: "/tmp/repo-outside/005" }],
  ["unbound identity", undefined],
]) {
  const guarded = guardProjectRealChainUiStateForCurrentProject(
    { status: realChain.uiStatus, summary: realChain },
    identity,
  );
  assert(guarded.status === "unavailable", `${label} should not receive stale 005 real-chain summary`);
  assert(!guarded.summary, `${label} must not leak stale 005 real-chain summary`);
  assertProductCopy(guarded.message);
}

const image2Payload = {
  schemaVersion: "current_project_image2_batch_prepare_plan.v1",
  projectionKind: "current_project_image2_batch_prepare_plan",
  project: {
    projectId: "real-demo-e2e-005",
    runId: "real_demo_e2e_005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  items: [
    { shotId: "S07", queueOrder: 7, blocked: false, referencePaths: [] },
    { shotId: "S08", queueOrder: 8, blocked: false, referencePaths: [] },
  ],
  summary: {
    plannedCount: 2,
    readyCount: 2,
    blockedCount: 0,
    selectedShotIds: ["S07", "S08"],
    nextAction: "复核当前项目状态。",
  },
  ledgerProjection: {
    summary: {
      queued: 2,
      blocked: 0,
      parked: 0,
      completeVerified: 0,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
    projections: [],
  },
  providerCalled: false,
  prepareRan: false,
  liveSubmitAllowed: false,
};

const image2Batch = deriveProjectImage2BatchPlanStatus(image2Payload);
assert(image2Batch.uiStatus === "ready_for_review", `image2 batch UI status drifted: ${image2Batch.uiStatus}`);
assert(image2Batch.plannedCount === 2, "image2 batch should preserve planned item count");
assert(image2Batch.providerSubmissionForbidden === true, "image2 batch must forbid provider submission");
assert(image2Batch.noFileMutation === true, "image2 batch must not mutate files");
assert(image2Batch.workerSpawnForbidden === true, "image2 batch must forbid worker spawn");
assert(image2Batch.providerCalled === false, "image2 batch must not call provider");
assert(image2Batch.prepareRan === false, "image2 batch must not run prepare");
assert(image2Batch.liveSubmitAllowed === false, "image2 batch must not allow live submit");

const image2Matched = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(image2Matched.status === "ready_for_review", "matching Image2 batch identity should pass through");

const image2Mismatch = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
assert(image2Mismatch.status === "unavailable", "stale 005 Image2 batch summary must be blocked under 004 identity");
assert(!image2Mismatch.summary, "stale 005 Image2 batch summary must not leak under 004 identity");
assertProductCopy(image2Mismatch.message);

const current004RealChainPayload = {
  ...stale005Payload,
  project: {
    projectId: "real-demo-e2e-004",
    runId: "real_demo_e2e_004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  },
  returnedImageCount: 1,
  totalPlannedImages: 1,
  reviewShotIds: ["S01"],
  previewItems: [
    { shotId: "S01", order: 1, imageUrl: "/files/004-S01.png", reviewRequired: false },
  ],
};
const current004RealChain = deriveProjectRealChainStatus(current004RealChainPayload, "runtime_endpoint");
const guarded004RealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004RealChain.uiStatus, summary: current004RealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004 = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004RealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
  selectedShotIds: ["S07"],
});
assert(workbench004.source === currentProjectWorkbenchProjectionSource, "workbench projection source should be explicit");
assert(workbench004.identity.projectId === "real-demo-e2e-004", "workbench identity should bind to selected 004");
assert(workbench004.identity.projectRoot.endsWith("/004"), "workbench root should bind to selected 004");
assert(workbench004.shots.map((shot) => shot.id).join(",") === "S01", "Story Flow should come from selected 004 preview items");
assert(workbench004.selectedScope.defaultShotId === "S01", "selected scope should fail closed to the current 004 shot when stale S07 is selected");
assert(workbench004.assets.readOnlyProjection === true, "Asset Library should be a read-only current project projection until visual memory is present");
assert(/当前项目资产待补齐|只读投影/.test(workbench004.assets.detail), "Asset Library should show current-project pending asset copy");
assert(!JSON.stringify(workbench004).includes("/005"), "004 workbench projection must not include stale 005 root");

const current004FactsRealChain = deriveProjectRealChainStatus({
  ...current004RealChainPayload,
  workbenchFacts: workbenchFacts004,
}, "runtime_endpoint");
const guarded004FactsRealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004FactsRealChain.uiStatus, summary: current004FactsRealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004Facts = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004FactsRealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
});
assert(workbench004Facts.shots.map((shot) => shot.id).join(",") === "S01,S02", "Story Flow should prefer 004 story_flow facts over preview fallback");
assert(workbench004Facts.story.fallbackUsed === false, "story_flow facts should not be marked as fallback");
assert(workbench004Facts.story.sectionCount === 1, "story_flow sections should be preserved");
assert(workbench004Facts.assets.readOnlyProjection === false, "visual_memory facts should unlock a populated Asset Library projection");
assert(workbench004Facts.assetFacts.map((asset) => asset.id).join(",") === "char_naya,char_ivo,scene_archive,style_quiet", "Asset Library should prefer 004 visual_memory facts");
assert(workbench004Facts.assets.lockedCount === 1, "locked asset count should come from visual_memory");
assert(workbench004Facts.assets.candidateCount === 1, "candidate asset count should be preserved");
assert(workbench004Facts.assets.needsReviewCount === 1, "needs_review asset count should be preserved");
assert(workbench004Facts.assets.rejectedCount === 1, "rejected asset count should be preserved");
assert(!JSON.stringify(workbench004Facts).includes("char_mika"), "004 visual_memory facts must not leak 005 assets");

const storyMissingFacts = {
  ...workbenchFacts004,
  storyFlow: { present: false, readable: false, path: "/missing/story_flow.json", shotCount: 0, sectionCount: 0, sections: [], shots: [] },
};
const storyMissingProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: storyMissingFacts },
  },
});
assert(storyMissingProjection.shots.map((shot) => shot.id).join(",") === "S01", "missing story_flow should safely fall back to current preview items");
assert(/待补齐故事流/.test(storyMissingProjection.story.detail), "missing story_flow should show safe pending copy");

const storyUnreadableFacts = {
  ...workbenchFacts004,
  storyFlow: { present: true, readable: false, path: "/bad/story_flow.json", shotCount: 0, sectionCount: 0, sections: [], shots: [] },
};
const storyUnreadableProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: storyUnreadableFacts },
  },
});
assert(storyUnreadableProjection.shots[0].id === "CURRENT_PROJECT", "unreadable story_flow should fail closed instead of using preview items");
assert(/故事流读取失败/.test(storyUnreadableProjection.story.detail), "unreadable story_flow should expose product-safe failure copy");

const visualMissingFacts = {
  ...workbenchFacts004,
  visualMemory: { present: false, readable: false, path: "/missing/visual_memory.json", assetCount: 0, assets: [], summary: { locked: 0, candidate: 0, needsReview: 0, rejected: 0, missing: 0 } },
};
const visualMissingProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: visualMissingFacts },
  },
});
assert(visualMissingProjection.assets.readOnlyProjection === true, "missing visual_memory should keep read-only fallback");
assert(/当前项目资产待补齐/.test(visualMissingProjection.assets.detail), "missing visual_memory should show safe asset fallback copy");

const staleRealChainUnder004 = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain.uiStatus, summary: realChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const staleImage2Under004 = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const stale005Under004 = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: staleRealChainUnder004,
  image2BatchState: staleImage2Under004,
  selectedShotId: "S07",
});
assert(stale005Under004.identity.projectId === "real-demo-e2e-004", "stale status must not override selected 004 identity");
assert(stale005Under004.shots[0].id === "CURRENT_PROJECT", "mismatched summaries should fall back to current project placeholder");
assert(/待补齐故事流/.test(stale005Under004.shots[0].storyFunction), "Story Flow fallback should be current-project safe copy");
assert(!JSON.stringify(stale005Under004).includes("/005"), "mismatched 005 data must not leak into the current 004 workbench");

const workbench005 = buildCurrentProjectWorkbenchProjection({
  binding: binding005,
  realChainState: realChainMatched,
  image2BatchState: image2Matched,
  selectedShotId: "S01",
});
assert(workbench005.identity.projectId === "real-demo-e2e-005", "workbench should switch back to selected 005 identity");
assert(workbench005.shots.map((shot) => shot.id).join(",") === "S07,S08", "Story Flow should switch back to 005 shots when 005 is current");
assert(workbench005.selectedScope.defaultShotId === "S07", "Agent selected scope should default to the current 005 shot, not stale 004");

const realChain005Facts = deriveProjectRealChainStatus({
  ...stale005Payload,
  workbenchFacts: workbenchFacts005,
}, "runtime_endpoint");
const realChain005FactsMatched = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain005Facts.uiStatus, summary: realChain005Facts },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
const workbench005Facts = buildCurrentProjectWorkbenchProjection({
  binding: binding005,
  realChainState: realChain005FactsMatched,
  image2BatchState: image2Matched,
});
assert(workbench005Facts.shots.map((shot) => shot.storyFunction).join(" ").includes("Mika"), "005 Story Flow should use 005 story_flow facts");
assert(workbench005Facts.assetFacts.map((asset) => asset.id).join(",") === "char_mika,char_ren", "005 Asset Library should use 005 visual_memory facts");
assert(workbench005Facts.assets.readOnlyProjection === false, "005 visual_memory should avoid empty read-only fallback");
assert(!JSON.stringify(workbench005Facts).includes("char_naya"), "005 workbench facts must not leak 004 visual memory");

const unboundWorkbench = buildCurrentProjectWorkbenchProjection({
  binding: unboundBinding,
  realChainState: { status: "unavailable", message: unboundBinding.message },
});
assert(unboundWorkbench.available === false, "unbound workbench must fail closed");
assert(unboundWorkbench.identity.displayTitle === "未选择项目", "unbound workbench should not show fallback project identity");
assert(unboundWorkbench.shots[0].id === "CURRENT_PROJECT", "unbound workbench should not show fallback story shots");
assert(!JSON.stringify(unboundWorkbench).includes("005"), "unbound workbench must not include demo 005 state");

console.log("Current project UI closed-loop test passed. Binding-first UI blocks unbound/stale summaries without provider calls.");
