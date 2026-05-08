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

async function importTs(sourcePath) {
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

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

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

function assertProductCopy(message) {
  assert(/未选择项目|未同步/.test(message || ""), "fail-closed message should stay product-facing");
  assert(!/005|fallback|endpoint|provider|ledger|manifest|schema|task|envelope|queue/i.test(message || ""), "fail-closed message must not expose engineering terms");
}

function assertPreviewClosedLoopAppContract() {
  const appSource = readText("src/App.tsx");
  assert(/buildCurrentProjectPreviewProjection\(\{[\s\S]*summary:\s*projectRealChainState\.summary[\s\S]*previewItems:\s*projectRealChainState\.summary\?\.previewItems/.test(appSource), "App must project current runtime summary previewItems for Preview");
  assert(/const\s+currentProjectPreviewQueue\s*=\s*runtimeProjectBinding\.status\s*===\s*"bound"[\s\S]*currentProjectPreviewProjection\.queue[\s\S]*:\s*\[\]/.test(appSource), "App must fail closed when the current project is not bound");
  assert(/currentProjectPreviewItems=\{currentProjectPreviewQueue\}/.test(appSource), "App must pass the current project queue into the Preview view");
  assert(/const\s+queue\s*=\s*currentProjectPreviewItems\s*\?\?\s*fallbackQueue/.test(appSource), "MinimalPreview must prefer current project preview items over previewExport fallback");
  assert(!/currentProjectIdentity\(runtimeState\)/.test(appSource), "App must not bind Preview to runtime-state.json identity");
  assert(!/real-demo-005/.test(appSource), "App must not retain hard-coded 005 UI hooks");
}

const {
  currentProjectBindingIdentity,
  defaultRuntimeApiBaseUrl,
  loadCurrentProjectBindingStatus,
  loadProjectRealChainStatus,
  projectCurrentBindingEndpoint,
  projectRealChainStatusEndpoint,
} = await importTs("src/core/projectRealChainStatus.ts");
const {
  buildCurrentProjectPreviewProjection,
  currentProjectPreviewProjectionSource,
} = await importTs("src/core/currentProjectPreviewProjection.ts");

assertPreviewClosedLoopAppContract();

const currentProject = {
  projectId: "runtime-current-project-010",
  projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/current-010",
  title: "当前项目 010",
};
const staleProject = {
  projectId: "real-demo-e2e-005",
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  title: "旧 005",
};

const currentRuntimeStatusPayload = {
  schemaVersion: "current_project_real_chain_status.v1",
  projectionSource: "runtime_truth_layer+preview_plan",
  sourceLabel: "current_project_runtime",
  project: {
    projectId: currentProject.projectId,
    projectRoot: currentProject.projectRoot,
    projectVibePath: `${currentProject.projectRoot}/project/project.vibe`,
  },
  status: "preview_ready_with_review",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  returnedImageCount: 2,
  totalPlannedImages: 3,
  needsReviewCount: 1,
  reviewShotIds: ["S02"],
  previewItems: [
    {
      id: "current_project_S01",
      shotId: "S01",
      order: 1,
      imageUrl: "/api/runtime/files?path=current-010%2Foutputs%2FS01.png",
      mediaPath: "current-010/outputs/S01.png",
      outputExists: true,
      status: "returned",
      runtimeTruthStatus: "returned",
      productionQaStatus: "pass",
      reviewRequired: false,
      reviewOverlay: false,
    },
    {
      id: "current_project_S02",
      shotId: "S02",
      order: 2,
      imageUrl: "/api/runtime/files?path=current-010%2Foutputs%2FS02.png",
      mediaPath: "current-010/outputs/S02.png",
      outputExists: true,
      status: "returned_with_review_overlay",
      runtimeTruthStatus: "returned",
      previewQaStatus: "needs_review",
      productionQaStatus: "needs_review",
      reviewRequired: true,
      reviewOverlay: true,
    },
    {
      id: "current_project_S03",
      shotId: "S03",
      order: 3,
      expectedOutputPath: "current-010/outputs/S03.png",
      outputExists: false,
      status: "missing",
      runtimeTruthStatus: "missing",
      blockers: ["output_missing"],
      reviewRequired: false,
      reviewOverlay: false,
    },
  ],
  providerCalled: false,
  prepareRan: false,
  liveSubmitAllowed: false,
};

const staleRuntimeStatusPayload = {
  ...currentRuntimeStatusPayload,
  project: {
    projectId: staleProject.projectId,
    projectRoot: staleProject.projectRoot,
  },
  previewItems: [
    {
      id: "stale_005_S07",
      shotId: "S07",
      order: 7,
      imageUrl: "/api/runtime/files?path=005%2FS07.png",
      mediaPath: "005/S07.png",
      outputExists: true,
      status: "returned_with_review_overlay",
      reviewRequired: true,
      reviewOverlay: true,
    },
  ],
};

let requests = [];
let responseByUrl = new Map();
globalThis.fetch = async (url, init) => {
  const urlText = String(url);
  requests.push({ url: urlText, method: init?.method || "GET" });
  assert(!/image2|seedance|jimeng|sora|provider/i.test(urlText), `provider or worker-like URL must not be requested: ${urlText}`);
  const payload = responseByUrl.get(urlText);
  return payload ? okJson(payload) : { ok: false, status: 404, json: async () => ({ status: "missing" }) };
};

responseByUrl = new Map([[projectCurrentBindingEndpoint, { status: "unbound" }]]);
requests = [];
const unboundBinding = await loadCurrentProjectBindingStatus();
const unboundIdentity = currentProjectBindingIdentity(unboundBinding);
const unboundState = await loadProjectRealChainStatus(unboundIdentity);
const unboundProjection = buildCurrentProjectPreviewProjection({
  summary: unboundState.summary,
  previewItems: unboundState.summary?.previewItems,
});
assert(unboundBinding.status === "unbound", "unbound current project selection should parse");
assert(unboundState.status === "unavailable", "unbound runtime status must fail closed");
assert(unboundProjection.available === false, "unbound Preview projection must be unavailable");
assert(unboundProjection.queue.length === 0, "unbound Preview projection must not fall back to legacy previewExport");
assert(requests.length === 1 && requests[0].url === projectCurrentBindingEndpoint, "unbound closed loop must not request runtime report endpoints");
assertProductCopy(unboundState.message);

responseByUrl = new Map([
  [projectCurrentBindingEndpoint, currentProjectBindingResponse(currentProject)],
  [projectRealChainStatusEndpoint, staleRuntimeStatusPayload],
]);
requests = [];
const boundBinding = await loadCurrentProjectBindingStatus();
const boundIdentity = currentProjectBindingIdentity(boundBinding);
const mismatchedState = await loadProjectRealChainStatus(boundIdentity);
const mismatchedProjection = buildCurrentProjectPreviewProjection({
  summary: mismatchedState.summary,
  previewItems: mismatchedState.summary?.previewItems,
});
assert(boundIdentity?.projectId === currentProject.projectId, "current project binding id should drive runtime requests");
assert(boundIdentity?.projectRoot === currentProject.projectRoot, "current project binding root should drive runtime requests");
assert(mismatchedState.status === "unavailable", "mismatched runtime status must fail closed");
assert(!mismatchedState.summary, "mismatched runtime status must not leak stale 005 summary");
assert(mismatchedProjection.queue.length === 0, "mismatched Preview projection must not show stale 005 or fallback previewExport items");
assert(!JSON.stringify(mismatchedProjection).includes(staleProject.projectId), "mismatched Preview projection must not include stale 005 identity");
assert(requests.map((request) => request.url).join(",") === `${projectCurrentBindingEndpoint},${projectRealChainStatusEndpoint}`, "bound status should use current runtime endpoints only");
assert(requests.every((request) => !request.url.includes("?")), "current runtime endpoints must not carry arbitrary project query params");
assertProductCopy(mismatchedState.message);

responseByUrl = new Map([
  [projectCurrentBindingEndpoint, currentProjectBindingResponse(currentProject)],
  [projectRealChainStatusEndpoint, currentRuntimeStatusPayload],
]);
requests = [];
const currentBinding = await loadCurrentProjectBindingStatus();
const currentIdentity = currentProjectBindingIdentity(currentBinding);
const currentState = await loadProjectRealChainStatus(currentIdentity);
const currentProjection = buildCurrentProjectPreviewProjection({
  summary: currentState.summary,
  previewItems: currentState.summary?.previewItems,
});
assert(currentState.status === "production_needs_review", `matching runtime status should pass through, got ${currentState.status}`);
assert(currentState.summary?.projectionSource === "runtime_truth_layer+preview_plan", "runtime summary should preserve runtime truth + preview plan source");
assert(currentState.summary?.providerCalled === false, "runtime summary must report no provider call");
assert(currentState.summary?.prepareRan === false, "runtime summary must report no prepare run");
assert(currentProjection.available === true, "matching Preview projection should be available");
assert(currentProjection.source === currentProjectPreviewProjectionSource, "Preview projection should identify current runtime truth source");
assert(currentProjection.projectId === currentProject.projectId, "Preview projection should keep current project id");
assert(currentProjection.projectRoot === currentProject.projectRoot, "Preview projection should keep current project root");
assert(currentProjection.providerCalled === false, "Preview projection must hard-lock provider calls");
assert(currentProjection.liveSubmitAllowed === false, "Preview projection must hard-lock live submit");
assert(currentProjection.workerSpawnForbidden === true, "Preview projection must hard-lock worker spawn");
assert(currentProjection.queue.map((item) => item.shotId).join(",") === "S01,S02,S03", "Preview must show current project items in order");
assert(!JSON.stringify(currentProjection).includes(staleProject.projectId), "Preview projection must not include stale 005 project id");
assert(!JSON.stringify(currentProjection).includes("previewExport"), "Preview projection must not expose legacy previewExport fallback");

const returned = currentProjection.queue.find((item) => item.shotId === "S01");
const review = currentProjection.queue.find((item) => item.shotId === "S02");
const missing = currentProjection.queue.find((item) => item.shotId === "S03");
assert(returned?.kind === "image_hold" && returned.returned === true && returned.reviewRequired === false && returned.blocked === false, "returned preview item should render as an image hold");
assert(review?.kind === "image_hold" && review.returned === true && review.reviewRequired === true && review.previewQaStatus === "needs_review", "review preview item should preserve returned/review state");
assert(missing?.kind === "missing_placeholder" && missing.returned === false && missing.blocked === true && missing.runtimeTruthStatus === "missing", "missing preview item should render as a placeholder");
assert(currentProjection.returnedCount === 2, "Preview projection should count returned items");
assert(currentProjection.reviewCount === 1, "Preview projection should count review items");
assert(currentProjection.missingCount === 1, "Preview projection should count missing items");
assert(requests.every((request) => request.method === "GET"), "closed-loop status/preview test must only use read requests");

globalThis.window = {
  location: { hostname: "127.0.0.1", port: "5176" },
  __VIBE_RUNTIME_API_BASE_URL__: "",
};
responseByUrl = new Map([
  [`${defaultRuntimeApiBaseUrl}${projectCurrentBindingEndpoint}`, currentProjectBindingResponse(currentProject)],
  [`${defaultRuntimeApiBaseUrl}${projectRealChainStatusEndpoint}`, currentRuntimeStatusPayload],
]);
requests = [];
const devPortBinding = await loadCurrentProjectBindingStatus();
const devPortState = await loadProjectRealChainStatus(currentProjectBindingIdentity(devPortBinding));
assert(devPortState.status === "production_needs_review", "local dev port should reach the runtime API directly");
assert(requests.length === 2, "local dev port should only request current binding and status endpoints");
assert(
  requests.every((request) => request.url.startsWith(defaultRuntimeApiBaseUrl)),
  "local dev port must not try the Vite origin before runtime API",
);
assert(
  requests.every((request) => !request.url.startsWith("http://127.0.0.1:5176/api/runtime")),
  "local dev port must not request runtime endpoints from the Vite dev server",
);
delete globalThis.window;

console.log("Current project Preview UI/runtime closed-loop test passed. Binding, runtime status, and Preview projection stay current-project scoped without provider calls.");
