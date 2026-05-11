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
  const directorModeSource = readText("src/ui/director/DirectorMode.tsx");
  const agentPanelSource = readText("src/ui/director/MinimalAgentPanel.tsx");
  const agentPanelProjectionSource = readText("src/ui/director/agentPanelProjection.ts");
  const projectRealChainPanelSource = readText("src/ui/project/ProjectRealChainPanel.tsx");
  const agentPanelContractSource = `${agentPanelSource}\n${agentPanelProjectionSource}`;
  const stylesSource = `${readText("src/styles.css")}\n${readText("src/ui/project/ProjectRealChainPanel.css")}`;
  const app = findFunctionBody(appSource, "App");
  const panel = findFunctionBody(projectRealChainPanelSource, "ProjectRealChainPanel");
  const surface = [
    panel,
    findFunctionBody(projectRealChainPanelSource, "projectRealChainStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectReviewCheckStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectReviewCheckDetail"),
    findFunctionBody(projectRealChainPanelSource, "projectPreviewReadyLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectProductionReviewLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotEvidence"),
  ].join("\n");

  for (const [label, pattern] of [
    ["runtime endpoint", /runtime\s+endpoint/i],
    ["fallback report", /fallback\s+report/i],
    ["005 sandbox", /005\s+sandbox/i],
    ["real demo id", /real_demo_e2e_005/i],
    ["demo", /\bdemo\b/i],
    ["provider submit", /provider\s+submit|provider\s+未提交/i],
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
  assert(/已观察输出[\s\S]*returnedCount[\s\S]*plannedCount/.test(surface), "ProjectRealChainPanel should show observed output count");
  assert(/张需复核/.test(surface), "ProjectRealChainPanel should show needs-review image count");
  assert(/Preview[\s\S]*ready/.test(surface), "ProjectRealChainPanel should expose preview ready state");
  assert(/Production[\s\S]*needs_review/.test(surface), "ProjectRealChainPanel should expose production review state");
  assert(/<button disabled=\{disabled\} onClick=\{onRun\}>[\s\S]*同步状态/.test(panel), "sync status button must route to project status run-check");
  assert(/<button disabled=\{reviewDisabled\} onClick=\{onRunImage2Batch\}>[\s\S]*复核检查/.test(panel), "review check button must route to Image2 batch run-check");
  assert(/单镜头小样/.test(surface), "ProjectRealChainPanel should expose one-shot sample copy");
  assert(/准备小样包/.test(surface), "ProjectRealChainPanel should expose sample prepare copy");
  assert(/确认 handoff/.test(surface), "ProjectRealChainPanel should expose sample confirm copy");
  assert(/等待文件/.test(surface), "ProjectRealChainPanel should expose waiting-file copy");
  assert(/授权票据/.test(surface), "ProjectRealChainPanel should expose permission receipt copy");
  assert(/授权引用/.test(surface), "ProjectRealChainPanel should expose authorization reference copy");
  assert(/仅记录意图/.test(surface), "ProjectRealChainPanel should state intent-only permission receipt copy");
  assert(/不读取密钥、不发起调用/.test(surface), "ProjectRealChainPanel should state no secret read/no call copy");
  assert(/请求票据/.test(surface), "ProjectRealChainPanel should expose request ticket evidence without provider copy");
  assert(/已 hash-bound 回流，QA needs_review，正式晋级阻断/.test(surface), "ProjectRealChainPanel should expose hash-bound needs-review evidence");
  assert(/仅生成 handoff\/sidecar 路径，不发起外部调用/.test(surface), "ProjectRealChainPanel should expose handoff-only evidence");
  assert(/等待外部输出 \+ 请求票据 \+ semantic QA/.test(surface), "ProjectRealChainPanel should expose waiting-for-external evidence");
  assert(/onPrepareImage2OneShot/.test(panel), "one-shot sample button must route to prepare handler");
  assert(/onPrepareImage2OneShotPermissionReceipt/.test(panel), "permission receipt button must route to explicit helper");
  assert(/permissionBaseReady[\s\S]*Boolean\(image2OneShotState\.receipt \|\| image2OneShotState\.summary\?\.receipt\)[\s\S]*&& sampleWaiting[\s\S]*&& !sampleRunning[\s\S]*&& !sampleReview/.test(panel), "permission receipt button must enable only after handoff is confirmed");
  assert(!/permissionBaseReady[\s\S]{0,180}sampleReady\s*\|\|\s*sampleWaiting/.test(panel), "prepared state must not enable permission receipt button before handoff");
  assert(/onConfirmImage2OneShot/.test(panel), "one-shot confirm button must route to confirm handler");
  assert(/onCheckImage2OneShotReturn/.test(panel), "one-shot sample button must route to execute-return handler");
  assert(/import\s+"\.\/ProjectRealChainPanel\.css"/.test(projectRealChainPanelSource), "ProjectRealChainPanel must import its extracted CSS");
  assert(/aria-label="当前项目状态"/.test(panel), "current project panel should use creator-facing status aria copy");
  assert(/aria-label="当前项目预览图"/.test(panel), "current project thumbnails should use creator-facing preview aria copy");
  assert(/className="project-real-chain-messages"[\s\S]*className="project-real-chain-message"/.test(panel), "ProjectRealChainPanel should group messages before placing them in the grid");
  assert(/\.project-real-chain-messages\s*\{[\s\S]*grid-area:\s*message[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*wrap/.test(stylesSource), "project real-chain messages should share one wrapping grid item");
  assert(!/\.project-real-chain-message\s*\{[\s\S]{0,160}grid-area:\s*message/.test(stylesSource), "individual project real-chain messages must not claim the grid area");
  assert(/displayTitle[\s\S]*runtime 状态已同步/.test(surface), "ProjectRealChainPanel should show the bound title for synced runtime status");
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
  assert(/assetLibraryNode=\{\s*<MinimalAssetLibrary[\s\S]*readOnlyDetail=\{currentProjectWorkbenchProjection\.assets\.detail\}/.test(app), "App must bind Asset Library fallback copy to the current project projection");
  assert(/projectScopeLabel=\{currentProjectWorkbenchProjection\.selectedScope\.label\}/.test(app), "App must bind Agent scope to the current project projection");
  assert(/runtimeState=\{workbenchRuntimeState\}/.test(app), "DirectorMode must receive the current project workbench runtime state");
  assert(/onRunProjectRealChain=\{runProjectRealChain\}/.test(appSource), "DirectorMode must pass runtime status run-check handler to the project panel");
  assert(/onRunProjectImage2Batch=\{runProjectImage2Batch\}/.test(appSource), "DirectorMode must pass Image2 batch run-check handler to the project panel");
  assert(/import\s+\{\s*DirectorMode\s*\}\s+from\s+"\.\/ui\/director\/DirectorMode"/.test(appSource), "App must mount the extracted DirectorMode");
  assert(/import\s+\{\s*MinimalAgentPanel\s*\}\s+from\s+"\.\/MinimalAgentPanel"/.test(directorModeSource), "DirectorMode must mount the extracted MinimalAgentPanel");
  assert(/确认修改/.test(agentPanelContractSource), "Agent Panel confirmation action should use creator-facing confirmation copy");
  assert(/等待写入项目事实/.test(agentPanelContractSource), "Agent Panel confirmation receipt should expose pending project-fact write status");
  assert(/已准备写入/.test(agentPanelContractSource), "Agent Panel staged commit receipt should expose creator-facing ready-to-write copy");
  assert(/commitProjectPendingTransactionForRuntime/.test(agentPanelContractSource), "Agent Panel confirmation should use staged project facts commit API");
  assert(/providerCalled\s*===\s*false/.test(agentPanelContractSource) || /providerCalled/.test(agentPanelContractSource), "Agent Panel source should preserve provider-called false contract in runtime projections");
  assert(!/real-demo-005/.test(`${appSource}\n${stylesSource}`), "app/styles should not retain 005 demo class names");
}

const {
  currentProjectBindingIdentity,
  deriveCurrentProjectChoices,
  deriveCurrentProjectBindingStatus,
  deriveProjectRealChainStatus,
  deriveProjectImage2BatchPlanStatus,
  deriveProjectImage2OneShotStatus,
  guardProjectRealChainUiStateForCurrentProject,
  guardProjectImage2BatchUiStateForCurrentProject,
  guardProjectImage2OneShotUiStateForCurrentProject,
  loadCurrentProjectBindingStatus,
  loadCurrentProjectChoices,
  loadProjectImage2OneShotStatus,
  loadProjectImage2BatchPlan,
  loadProjectRealChainStatus,
  prepareProjectImage2OneShot,
  prepareProjectImage2OneShotPermissionReceipt,
  prepareProjectImage2OneShotTrigger,
  confirmProjectImage2OneShot,
  executeReturnedProjectImage2OneShot,
  projectCurrentBindingEndpoint,
  projectCurrentChoicesEndpoint,
  projectCurrentSelectEndpoint,
  projectImage2BatchPlanEndpoint,
  projectImage2BatchRunCheckEndpoint,
  projectImage2OneShotStatusEndpoint,
  projectImage2OneShotPrepareEndpoint,
  projectImage2OneShotConfirmEndpoint,
  projectImage2OneShotPrepareTriggerEndpoint,
  projectImage2OneShotExecuteReturnEndpoint,
  projectRuntimeRequestPath,
  projectRealChainRunCheckEndpoint,
  projectRealChainStatusEndpoint,
  projectRound5StrictEditReturnEndpoint,
  runProjectImage2BatchCheck,
  runProjectRealChainCheck,
  selectCurrentProjectBinding,
} = await importProjectRealChainStatus();
const {
  buildCurrentProjectWorkbenchProjection,
  currentProjectWorkbenchProjectionSource,
} = await importCurrentProjectWorkbenchProjection();

assertCreatorPanelContract();

const currentEndpoint = "/api/runtime/projects/current/real-chain/status";
const round5StrictEditReturnEndpoint = "/api/runtime/projects/current/round5/strict-edit/return";
assert(
  projectRound5StrictEditReturnEndpoint === round5StrictEditReturnEndpoint,
  "formal runtime client must expose the Round 5 strict-edit return endpoint",
);
const queryPath = projectRuntimeRequestPath(currentEndpoint, {
  projectId: "最后一班星图",
  projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429",
});
assert(queryPath === currentEndpoint, "current project requests must not carry project id/root query params");
assert(
  projectRuntimeRequestPath(projectRound5StrictEditReturnEndpoint, {
    projectId: "round5_zero_planning_anime_signal",
    projectRoot: "real-test-sandbox/round5-zero-project-planning-anime/runs/run-2026-05-09T11-09-28-642Z",
  }) === round5StrictEditReturnEndpoint,
  "Round 5 strict-edit return requests must use the current-project endpoint without 005 sample query params",
);

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

const oneShotReadyPayload = {
  status: "ready_to_prepare",
  uiStatus: "ready_to_prepare",
  userLabel: "准备小样包",
  project: {
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  selectedShotId: "S07",
  expectedOutputPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/image2-start.png",
  providerObservationPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/provider_observations/image2-start-provider-observation.json",
  semanticQaPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/semantic_qa/image2-start-semantic-qa.json",
  receipt: undefined,
  watcherProjection: { outputExists: false },
  providerCalled: false,
  liveSubmitAllowed: false,
  projectVibeWritten: false,
  workerSpawnForbidden: true,
  blockers: [],
};

const oneShotPreparePayload = {
  ...oneShotReadyPayload,
  status: "prepared",
  uiStatus: "prepared",
  userLabel: "确认 handoff",
  statePaths: {
    receiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/prepare-receipt.json",
    handoffStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/handoff-packet.json",
  },
  persistedState: {
    receiptPresent: true,
    handoffPresent: false,
  },
  receipt: {
    receiptId: "image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "prepared",
    selectedShotId: "S07",
    selectedShotIds: ["S07"],
    imageCount: 1,
    expectedOutputPath: oneShotReadyPayload.expectedOutputPath,
    providerObservationPath: oneShotReadyPayload.providerObservationPath,
    semanticQaPath: oneShotReadyPayload.semanticQaPath,
  },
};

const oneShotConfirmPayload = {
  ...oneShotPreparePayload,
  status: "handoff_prepared",
  uiStatus: "handoff_prepared",
  userLabel: "等待文件",
  persistedState: {
    receiptPresent: true,
    handoffPresent: true,
  },
  handoffPacket: {
    packetId: "handoff_image2_one_shot_prepare_real-demo-e2e-005_S07",
    receiptId: "image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "ready_for_manual_transport",
    requiresExternalAction: true,
    transportPlan: {
      mode: "manual",
      actualExecutionAllowed: false,
      providerCalled: false,
      liveSubmitAllowed: false,
    },
  },
};

const oneShotTriggerPayload = {
  ...oneShotConfirmPayload,
  status: "trigger_plan_prepared",
  uiStatus: "trigger_plan_prepared",
  userLabel: "等待回流",
  returnSource: "dry_run_projection_only",
  persistedState: {
    receiptPresent: true,
    handoffPresent: true,
    triggerPlanPresent: true,
  },
};

const oneShotPermissionTriggerPayload = {
  ...oneShotTriggerPayload,
  submitPermissionReceiptRequested: true,
  submitPermissionReceiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/submit-permission-receipt.json",
  persistedState: {
    ...oneShotTriggerPayload.persistedState,
    submitPermissionReceiptPresent: true,
    submitPermissionReceiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/submit-permission-receipt.json",
  },
  submitPermissionReceipt: {
    receiptId: "submit_permission_image2_one_shot_prepare_real-demo-e2e-005_S07",
    handoffId: "handoff_image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "pending_action_time_confirmation",
    blockers: [],
    credential: {
      credentialRef: "secret-store://providers/openai-image2/default",
      authorizedReferenceOnly: true,
      secretMaterialPresent: false,
      credentialMaterialStored: false,
      credentialMaterialRead: false,
    },
    submitIntent: {
      maxProviderCallsPerReceipt: 1,
      providerSubmitAllowed: 0,
      providerSubmitRequestState: "pending_action_time_confirmation",
    },
    actionTimeConfirmation: {
      required: true,
      userConfirmedAtActionTime: false,
    },
    maxProviderCallsPerReceipt: 1,
  },
};

const oneShotReturnedPayload = {
  ...oneShotConfirmPayload,
  status: "real_provider_returned_needs_review",
  uiStatus: "needs_review",
  userLabel: "需要复核",
  providerRequestId: "provider-request-s07",
  outputSha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  hashBoundActual: true,
  providerObservationMode: "actual_provider_call_observed",
  semanticQaStatus: "needs_review",
  returnSource: "actual_provider_return_ingest",
  formalPromotionBlocked: true,
  formalPromotionBlockedReason: "Formal promotion remains blocked until human QA approval after hash-bound provider return.",
  formalPromotionBlockedReasons: ["Formal promotion remains blocked until human QA approval after hash-bound provider return."],
  providerReturnIngested: true,
  externalProviderCallObserved: true,
  actualImage2Triggered: true,
  providerCalled: true,
  watcherProjection: {
    outputExists: true,
    providerRequestId: "provider-request-s07",
    outputSha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    hashBoundActual: true,
    providerObservationMode: "actual_provider_call_observed",
    semanticQaStatus: "needs_review",
    returnSource: "actual_provider_return_ingest",
  },
  previewProjection: {
    status: "needs_review",
    reviewRequired: true,
    imageUrl: "/api/runtime/files?path=runtime-tests/005/real-trigger-one-shot/S07/image2-start.png",
    providerCalled: true,
  },
};

const persistedOneShotPrepareSummary = deriveProjectImage2OneShotStatus(oneShotPreparePayload);
assert(persistedOneShotPrepareSummary.uiStatus === "prepared", "persisted one-shot receipt status should display prepared");
assert(persistedOneShotPrepareSummary.userLabel === "确认 handoff", "persisted one-shot receipt should keep confirm copy");
assert(persistedOneShotPrepareSummary.receipt?.selectedShotId === "S07", "persisted one-shot receipt should remain available to helpers");

const persistedOneShotHandoffSummary = deriveProjectImage2OneShotStatus(oneShotConfirmPayload);
assert(persistedOneShotHandoffSummary.uiStatus === "handoff_prepared", "persisted one-shot handoff status should display handoff prepared");
assert(persistedOneShotHandoffSummary.userLabel === "等待文件", "persisted one-shot handoff should keep waiting-file copy");

const persistedOneShotPermissionSummary = deriveProjectImage2OneShotStatus(oneShotPermissionTriggerPayload);
assert(persistedOneShotPermissionSummary.submitPermissionReceiptRequested === true, "persisted one-shot permission receipt should keep requested flag");
assert(persistedOneShotPermissionSummary.submitPermissionReceiptPresent === true, "persisted one-shot permission receipt should keep present flag");
assert(persistedOneShotPermissionSummary.submitPermissionReceipt?.status === "pending_action_time_confirmation", "persisted one-shot permission receipt should keep status");
assert(persistedOneShotPermissionSummary.submitPermissionReceiptStatePath?.endsWith("submit-permission-receipt.json"), "persisted one-shot permission receipt should keep state path");
assert(persistedOneShotPermissionSummary.credentialRef === "secret-store://providers/openai-image2/default", "persisted one-shot permission receipt should keep credentialRef");
assert(persistedOneShotPermissionSummary.maxProviderCallsPerReceipt === 1, "persisted one-shot permission receipt should keep max call cap");

const persistedOneShotReturnedSummary = deriveProjectImage2OneShotStatus(oneShotReturnedPayload);
assert(persistedOneShotReturnedSummary.uiStatus === "needs_review", "persisted one-shot return should display needs_review");
assert(persistedOneShotReturnedSummary.providerRequestId === "provider-request-s07", "persisted one-shot return should keep providerRequestId");
assert(persistedOneShotReturnedSummary.outputSha256 === oneShotReturnedPayload.outputSha256, "persisted one-shot return should keep output hash");
assert(persistedOneShotReturnedSummary.hashBoundActual === true, "persisted one-shot return should keep hash-bound fact");
assert(persistedOneShotReturnedSummary.providerObservationMode === "actual_provider_call_observed", "persisted one-shot return should keep observation mode");
assert(persistedOneShotReturnedSummary.semanticQaStatus === "needs_review", "persisted one-shot return should keep semantic QA status");
assert(persistedOneShotReturnedSummary.returnSource === "actual_provider_return_ingest", "persisted one-shot return should keep return source");
assert(persistedOneShotReturnedSummary.formalPromotionBlockedReason, "persisted one-shot return should keep promotion blocker reason");

const persistedOneShotHandoffGuard = guardProjectImage2OneShotUiStateForCurrentProject(
  { status: persistedOneShotHandoffSummary.uiStatus, summary: persistedOneShotHandoffSummary, receipt: persistedOneShotHandoffSummary.receipt },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(persistedOneShotHandoffGuard.status === "handoff_prepared", "persisted one-shot handoff should pass current-project guard");

const runtimeFetchCalls = [];
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
const project005RuntimeIdentity = {
  projectId: "real-demo-e2e-005",
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
};
const runtimeEndpointPayloads = new Map([
  [`GET ${projectCurrentBindingEndpoint}`, currentProjectBindingResponse({
    projectId: project005RuntimeIdentity.projectId,
    projectRoot: project005RuntimeIdentity.projectRoot,
    title: "005 当前项目",
  })],
  [`GET ${projectCurrentChoicesEndpoint}`, {
    ok: true,
    choices: [
      {
        projectRoot: "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames",
        displayName: "005 当前项目",
        projectId: project005RuntimeIdentity.projectId,
        status: "当前",
      },
    ],
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
  }],
  [`POST ${projectCurrentSelectEndpoint}`, currentProjectBindingResponse({
    projectId: project005RuntimeIdentity.projectId,
    projectRoot: project005RuntimeIdentity.projectRoot,
    title: "005 当前项目",
  })],
  [`GET ${projectRealChainStatusEndpoint}`, {
    ...stale005Payload,
    workbenchFacts: workbenchFacts005,
    projectVibeWritten: false,
  }],
  [`POST ${projectRealChainRunCheckEndpoint}`, {
    ...stale005Payload,
    workbenchFacts: workbenchFacts005,
    projectVibeWritten: false,
    command: {
      mode: "read_only_projection_check",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }],
  [`GET ${projectImage2BatchPlanEndpoint}`, {
    ...image2Payload,
    projectVibeWritten: false,
  }],
  [`POST ${projectImage2BatchRunCheckEndpoint}`, {
    ...image2Payload,
    projectVibeWritten: false,
    command: {
      mode: "read_only_image2_batch_plan_check",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }],
  [`GET ${projectImage2OneShotStatusEndpoint}`, oneShotReadyPayload],
  [`POST ${projectImage2OneShotPrepareEndpoint}`, oneShotPreparePayload],
  [`POST ${projectImage2OneShotConfirmEndpoint}`, oneShotConfirmPayload],
  [`POST ${projectImage2OneShotExecuteReturnEndpoint}`, oneShotReturnedPayload],
]);

try {
  globalThis.window = {
    __VIBE_RUNTIME_API_BASE_URL__: "http://runtime.test",
    location: { hostname: "127.0.0.1", port: "5173" },
  };
  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = new URL(String(url), "http://runtime.test");
    const method = init.method || "GET";
    runtimeFetchCalls.push({ method, path: requestUrl.pathname, search: requestUrl.search, body: init.body });
    const payload = method === "POST" && requestUrl.pathname === projectImage2OneShotPrepareTriggerEndpoint
      ? (JSON.parse(String(init.body || "{}")).submitPermissionReceiptRequired === true ? oneShotPermissionTriggerPayload : oneShotTriggerPayload)
      : runtimeEndpointPayloads.get(`${method} ${requestUrl.pathname}`);
    assert(payload, `unexpected runtime request ${method} ${requestUrl.pathname}`);
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };

  const loadedBinding = await loadCurrentProjectBindingStatus();
  assert(loadedBinding.status === "bound", "frontend should load current project binding from runtime");
  const loadedChoices = await loadCurrentProjectChoices();
  assert(loadedChoices[0]?.displayName === "005 当前项目", "frontend should load recent project choices");
  const selectedBinding = await selectCurrentProjectBinding({
    projectRoot: project005RuntimeIdentity.projectRoot,
    projectId: project005RuntimeIdentity.projectId,
    displayName: "005 当前项目",
  });
  assert(selectedBinding.status === "bound", "frontend should connect project through runtime select");

  const loadedStatus = await loadProjectRealChainStatus(project005RuntimeIdentity);
  assert(loadedStatus.status === "production_needs_review", "sync status should load preview/production state");
  assert(loadedStatus.summary?.returnedImageCount === 8, "sync status should show returned image count");
  assert(loadedStatus.summary?.needsReviewCount === 2, "sync status should show needs-review count");
  assert(loadedStatus.summary?.providerCalled === false, "sync status must preserve providerCalled=false");
  assert(loadedStatus.summary?.prepareRan === false, "sync status must preserve prepareRan=false");
  assert(loadedStatus.summary?.workbenchFacts?.projectVibeWritten === false, "sync status must preserve projectVibeWritten=false");

  const checkedStatus = await runProjectRealChainCheck(project005RuntimeIdentity);
  assert(checkedStatus.status === "production_needs_review", "sync status button should call real-chain run-check");
  assert(checkedStatus.summary?.providerCalled === false, "real-chain run-check must not call provider");
  assert(checkedStatus.summary?.prepareRan === false, "real-chain run-check must not run prepare");
  assert(checkedStatus.summary?.workbenchFacts?.projectVibeWritten === false, "real-chain run-check must not write project.vibe");

  const loadedPlan = await loadProjectImage2BatchPlan(project005RuntimeIdentity);
  assert(loadedPlan.status === "ready_for_review", "review panel should load Image2 batch plan");
  assert(loadedPlan.summary?.providerCalled === false, "Image2 batch plan must preserve providerCalled=false");
  assert(loadedPlan.summary?.prepareRan === false, "Image2 batch plan must preserve prepareRan=false");
  assert(loadedPlan.summary?.liveSubmitAllowed === false, "Image2 batch plan must preserve liveSubmitAllowed=false");
  assert(loadedPlan.summary?.workerSpawnForbidden === true, "Image2 batch plan must preserve workerSpawnForbidden=true");

  const checkedPlan = await runProjectImage2BatchCheck(project005RuntimeIdentity);
  assert(checkedPlan.status === "ready_for_review", "review check button should call Image2 batch run-check");
  assert(checkedPlan.summary?.providerCalled === false, "Image2 batch run-check must not call provider");
  assert(checkedPlan.summary?.prepareRan === false, "Image2 batch run-check must not run prepare");
  assert(checkedPlan.summary?.liveSubmitAllowed === false, "Image2 batch run-check must preserve liveSubmitAllowed=false");
  assert(checkedPlan.summary?.workerSpawnForbidden === true, "Image2 batch run-check must preserve workerSpawnForbidden=true");

  const oneShotStatus = await loadProjectImage2OneShotStatus(project005RuntimeIdentity, "S07");
  assert(oneShotStatus.status === "ready_to_prepare", "one-shot status should expose sample entry");
  assert(oneShotStatus.summary?.userLabel === "准备小样包", "one-shot status should use creator-facing prepare copy");
  assert(oneShotStatus.summary?.providerCalled === false, "one-shot status must not call provider");
  assert(oneShotStatus.summary?.projectVibeWritten === false, "one-shot status must not write project.vibe");
  assert(oneShotStatus.summary?.workerSpawnForbidden === true, "one-shot status must forbid worker spawn");

  const preparedOneShot = await prepareProjectImage2OneShot(project005RuntimeIdentity, "S07");
  assert(preparedOneShot.status === "prepared", "one-shot prepare should create a pending confirmation receipt");
  assert(preparedOneShot.receipt?.selectedShotId === "S07", "one-shot prepare should preserve selected shot");
  assert(preparedOneShot.summary?.userLabel === "确认 handoff", "one-shot prepare should use creator-facing confirm copy");
  assert(preparedOneShot.summary?.providerCalled === false, "one-shot prepare must not call provider");
  assert(preparedOneShot.summary?.liveSubmitAllowed === false, "one-shot prepare must not allow live submit");
  assert(preparedOneShot.summary?.projectVibeWritten === false, "one-shot prepare must not write project.vibe");
  assert(preparedOneShot.summary?.workerSpawnForbidden === true, "one-shot prepare must forbid worker spawn");

  const confirmedOneShot = await confirmProjectImage2OneShot(project005RuntimeIdentity, preparedOneShot.receipt);
  assert(confirmedOneShot.status === "handoff_prepared", "one-shot confirm should prepare external handoff only");
  assert(confirmedOneShot.summary?.userLabel === "等待文件", "one-shot confirm should use waiting-file copy");
  assert(confirmedOneShot.summary?.providerCalled === false, "one-shot confirm must not call provider");
  assert(confirmedOneShot.summary?.liveSubmitAllowed === false, "one-shot confirm must not allow live submit");
  assert(confirmedOneShot.summary?.projectVibeWritten === false, "one-shot confirm must not write project.vibe");
  assert(confirmedOneShot.summary?.workerSpawnForbidden === true, "one-shot confirm must forbid worker spawn");

  const triggerPreparedOneShot = await prepareProjectImage2OneShotTrigger(project005RuntimeIdentity, confirmedOneShot.receipt);
  assert(triggerPreparedOneShot.status === "trigger_plan_prepared", "one-shot trigger helper should prepare app-server handoff");
  assert(triggerPreparedOneShot.summary?.userLabel === "等待回流", "one-shot trigger helper should use waiting return copy");
  assert(triggerPreparedOneShot.summary?.providerCalled === false, "one-shot trigger helper must not call provider");
  const defaultTriggerCall = runtimeFetchCalls
    .filter((item) => item.method === "POST" && item.path === projectImage2OneShotPrepareTriggerEndpoint)
    .at(-1);
  const defaultTriggerBody = JSON.parse(String(defaultTriggerCall?.body || "{}"));
  assert(!Object.prototype.hasOwnProperty.call(defaultTriggerBody, "submitPermissionReceiptRequired"), "default trigger helper must not request permission receipt");
  assert(!Object.prototype.hasOwnProperty.call(defaultTriggerBody, "credentialRef"), "default trigger helper must not send credentialRef");

  const permissionPreparedOneShot = await prepareProjectImage2OneShotPermissionReceipt(
    project005RuntimeIdentity,
    confirmedOneShot.receipt,
    "secret-store://providers/openai-image2/default",
  );
  assert(permissionPreparedOneShot.status === "trigger_plan_prepared", "permission receipt helper should prepare trigger plan");
  assert(permissionPreparedOneShot.summary?.submitPermissionReceiptPresent === true, "permission receipt helper should surface persisted receipt");
  assert(permissionPreparedOneShot.summary?.submitPermissionReceipt?.status === "pending_action_time_confirmation", "permission receipt helper should surface pending action confirmation");
  const permissionTriggerCall = runtimeFetchCalls
    .filter((item) => item.method === "POST" && item.path === projectImage2OneShotPrepareTriggerEndpoint)
    .at(-1);
  const permissionTriggerBody = JSON.parse(String(permissionTriggerCall?.body || "{}"));
  assert(permissionTriggerBody.submitPermissionReceiptRequired === true, "permission helper body should request permission receipt");
  assert(permissionTriggerBody.credentialRef === "secret-store://providers/openai-image2/default", "permission helper body should carry opaque credentialRef");
  assert(permissionTriggerBody.maxProviderCallsPerReceipt === 1, "permission helper body should pin maxProviderCallsPerReceipt");
  assert(permissionTriggerBody.actionTimeConfirmation?.required === true, "permission helper body should require action-time confirmation");
  assert(permissionTriggerBody.actionTimeConfirmation?.userConfirmedAtActionTime === false, "permission helper body should not mark action-time confirmation done");
  assert(Array.isArray(permissionTriggerBody.expectedOutputs) && permissionTriggerBody.expectedOutputs.length === 1, "permission helper body should include one expected output");
  assert(permissionTriggerBody.expectedOutputs[0].shotId === "S07", "permission helper expected output should keep shotId");
  assert(permissionTriggerBody.expectedOutputs[0].expectedOutputPath === confirmedOneShot.receipt.expectedOutputPath, "permission helper expected output should keep output path");
  assert(permissionTriggerBody.expectedOutputs[0].providerObservationPath === confirmedOneShot.receipt.providerObservationPath, "permission helper expected output should keep observation path");
  assert(permissionTriggerBody.expectedOutputs[0].semanticQaPath === confirmedOneShot.receipt.semanticQaPath, "permission helper expected output should keep QA path");

  const returnedOneShot = await executeReturnedProjectImage2OneShot(project005RuntimeIdentity, triggerPreparedOneShot.receipt);
  assert(returnedOneShot.status === "needs_review", "one-shot execute-return helper should surface needs_review");
  assert(returnedOneShot.summary?.providerRequestId === "provider-request-s07", "one-shot execute-return should preserve providerRequestId");
  assert(returnedOneShot.summary?.outputSha256 === oneShotReturnedPayload.outputSha256, "one-shot execute-return should preserve output hash");
  assert(returnedOneShot.summary?.hashBoundActual === true, "one-shot execute-return should preserve hash-bound fact");
  assert(returnedOneShot.summary?.semanticQaStatus === "needs_review", "one-shot execute-return should preserve semantic QA status");
  assert(returnedOneShot.summary?.returnSource === "actual_provider_return_ingest", "one-shot execute-return should preserve return source");

  for (const [method, endpoint] of [
    ["GET", projectCurrentBindingEndpoint],
    ["GET", projectCurrentChoicesEndpoint],
    ["POST", projectCurrentSelectEndpoint],
    ["GET", projectRealChainStatusEndpoint],
    ["POST", projectRealChainRunCheckEndpoint],
    ["GET", projectImage2BatchPlanEndpoint],
    ["POST", projectImage2BatchRunCheckEndpoint],
    ["GET", projectImage2OneShotStatusEndpoint],
    ["POST", projectImage2OneShotPrepareEndpoint],
    ["POST", projectImage2OneShotConfirmEndpoint],
    ["POST", projectImage2OneShotPrepareTriggerEndpoint],
    ["POST", projectImage2OneShotExecuteReturnEndpoint],
  ]) {
    const call = runtimeFetchCalls.find((item) => item.method === method && item.path === endpoint);
    assert(call, `frontend should call ${method} ${endpoint}`);
    assert(!call.search.includes("projectRoot=") && !call.search.includes("projectId="), `${method} ${endpoint} should not carry project query params`);
  }
  const selectCall = runtimeFetchCalls.find((item) => item.method === "POST" && item.path === projectCurrentSelectEndpoint);
  assert(selectCall?.body && JSON.parse(String(selectCall.body)).projectRoot === project005RuntimeIdentity.projectRoot, "connect project should send selected projectRoot");
} finally {
  globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
}

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
