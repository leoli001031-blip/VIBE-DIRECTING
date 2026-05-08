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

console.log("Current project UI closed-loop test passed. Binding-first UI blocks unbound/stale summaries without provider calls.");
