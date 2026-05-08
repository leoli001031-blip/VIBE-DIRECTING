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

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

const {
  currentProjectBindingIdentity,
  deriveCurrentProjectChoices,
  loadCurrentProjectBindingStatus,
  loadCurrentProjectChoices,
  loadProjectImage2BatchPlan,
  loadProjectRealChainStatus,
  projectCurrentChoicesEndpoint,
  projectCurrentBindingEndpoint,
  projectCurrentSelectEndpoint,
  projectImage2BatchPlanEndpoint,
  projectRealChainStatusEndpoint,
  runProjectImage2BatchCheck,
  runProjectRealChainCheck,
  selectCurrentProjectBinding,
} = await importProjectRealChainStatus();

const project004 = {
  projectId: "real-demo-e2e-004",
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  title: "004 当前项目",
};
const project005 = {
  projectId: "real-demo-e2e-005",
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  title: "005 旧项目",
};

function currentProjectBindingResponse(project, overrides = {}) {
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
    ...overrides,
  };
}

const stale005RealChainPayload = {
  project: project005,
  status: "preview_ready_with_review",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  returnedImageCount: 1,
  totalPlannedImages: 1,
  previewItems: [{ shotId: "S01", imageUrl: "/files/S01.png", reviewRequired: true }],
  providerCalled: false,
  prepareRan: false,
};

const current004RealChainPayload = {
  project: project004,
  status: "preview_ready_with_review",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  returnedImageCount: 1,
  totalPlannedImages: 1,
  previewItems: [{ shotId: "S01", imageUrl: "/files/S01.png", reviewRequired: true }],
  providerCalled: false,
  prepareRan: false,
};

const current004Image2Payload = {
  projectionKind: "current_project_image2_batch_prepare_plan",
  project: project004,
  items: [{ shotId: "S01", blocked: false, blockers: [] }],
  summary: { plannedCount: 1, readyCount: 1, blockedCount: 0, selectedShotIds: ["S01"] },
  providerCalled: false,
  prepareRan: false,
  liveSubmitAllowed: false,
  ledgerProjection: {
    summary: {
      providerSubmissionForbidden: true,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
      liveSubmitAllowed: false,
    },
    projections: [],
  },
};

let requests = [];
let responseByUrl = new Map();
globalThis.fetch = async (url, init) => {
  const urlText = String(url);
  requests.push({ url: urlText, method: init?.method || "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const payload = responseByUrl.get(urlText);
  if (!payload) {
    return { ok: false, status: 404, json: async () => ({ status: "missing" }) };
  }
  return okJson(payload);
};

responseByUrl = new Map([[projectCurrentBindingEndpoint, { status: "unbound" }]]);
requests = [];
const unbound = await loadCurrentProjectBindingStatus();
assert(unbound.status === "unbound", "unbound current binding should fail closed");
assert(!currentProjectBindingIdentity(unbound), "unbound current binding must not produce identity");
const noIdentityState = await loadProjectRealChainStatus(undefined);
assert(noIdentityState.status === "unavailable", "real-chain status without binding identity must fail closed");
assert(requests.length === 1 && requests[0].url === projectCurrentBindingEndpoint, "unbound status should not request project status endpoints");
assert(!/005|fallback|endpoint|provider|ledger|prompt|queue/i.test(noIdentityState.message || ""), "unbound message must not leak engineering/demo details");

const projectChoicesPayload = {
  ok: true,
  status: "ready",
  choices: [
    { projectRoot: "real-test-sandbox/real-demo-e2e/004-image2-start-frames", displayName: "项目 004", projectId: "real_demo_e2e_004_image2_start_frames", status: "可打开" },
    { projectRoot: "/Users/lichenhao/Desktop/vibe core/absolute-leak", displayName: "bad absolute" },
    { projectRoot: "real-test-sandbox/real-demo-e2e/004-image2-start-frames", displayName: "duplicate" },
    { displayName: "missing root" },
  ],
};
const choices = deriveCurrentProjectChoices(projectChoicesPayload);
assert(choices.length === 1, "choices parser should keep only relative roots and de-duplicate exact repeats");
assert(choices[0].displayName === "项目 004", "choices parser should keep product display name");
assert(choices[0].projectRoot.includes("004-image2-start-frames"), "choices parser should keep selectable project root");
assert(choices[0].projectId === "real_demo_e2e_004_image2_start_frames", "choices parser should keep optional project id");
assert(choices[0].status === "可打开", "choices parser should keep product status");

responseByUrl = new Map([[projectCurrentChoicesEndpoint, projectChoicesPayload]]);
requests = [];
const loadedChoices = await loadCurrentProjectChoices();
assert(loadedChoices.length === 1, "choices helper should load safe project choices");
assert(requests.length === 1 && requests[0].url === projectCurrentChoicesEndpoint, "choices helper should call the recent projects endpoint");

responseByUrl = new Map();
requests = [];
const closedChoices = await loadCurrentProjectChoices();
assert(Array.isArray(closedChoices) && closedChoices.length === 0, "choices helper must fail closed to an empty list");

responseByUrl = new Map([[projectCurrentSelectEndpoint, currentProjectBindingResponse(project004)]]);
requests = [];
const selected004 = await selectCurrentProjectBinding({
  projectRoot: project004.projectRoot,
  projectId: project004.projectId,
  displayName: project004.title,
});
assert(selected004.status === "bound", "select helper should return a bound current project");
assert(selected004.projectRoot === project004.projectRoot, "select helper should parse selected project root");
assert(requests.length === 1 && requests[0].url === projectCurrentSelectEndpoint, "select helper should call the select endpoint");
assert(requests[0].method === "POST", "select helper should POST project selection");
assert(requests[0].body.projectRoot === project004.projectRoot, "select helper should submit projectRoot");
assert(requests[0].body.projectId === project004.projectId, "select helper should submit optional projectId");

requests = [];
let emptyPathRejected = false;
try {
  await selectCurrentProjectBinding({ projectRoot: "   " });
} catch (error) {
  emptyPathRejected = /请输入项目路径/.test(error instanceof Error ? error.message : "");
}
assert(emptyPathRejected, "select helper should reject an empty project path with product copy");
assert(requests.length === 0, "empty project path must fail closed before network calls");

responseByUrl = new Map([
  [projectCurrentBindingEndpoint, currentProjectBindingResponse(project004)],
  [projectRealChainStatusEndpoint, stale005RealChainPayload],
]);
requests = [];
const binding004 = await loadCurrentProjectBindingStatus();
const identity004 = currentProjectBindingIdentity(binding004);
assert(identity004?.projectId === project004.projectId, "004 binding identity should include project id from real currentProject response");
assert(identity004?.projectRoot === project004.projectRoot, "004 binding should become the current project identity");
const staleStatus = await loadProjectRealChainStatus(identity004);
assert(staleStatus.status === "unavailable", "stale 005 status must be blocked under 004 binding");
assert(!staleStatus.summary, "stale 005 status must not leak a summary under 004 binding");
assert(requests[1].url === projectRealChainStatusEndpoint, "real-chain status must use current endpoint without query");
assert(!requests[1].url.includes("?"), "real-chain status request must not carry projectRoot query");

responseByUrl = new Map([
  [projectCurrentBindingEndpoint, currentProjectBindingResponse(project004)],
  [projectRealChainStatusEndpoint, current004RealChainPayload],
  [projectImage2BatchPlanEndpoint, current004Image2Payload],
]);
requests = [];
const freshStatus = await loadProjectRealChainStatus(identity004);
assert(freshStatus.status === "production_needs_review", "matching 004 status should pass under 004 binding");
const image2Status = await loadProjectImage2BatchPlan(identity004);
assert(image2Status.status === "ready_for_review", "matching 004 Image2 plan should pass under 004 binding");
assert(requests.every((request) => !request.url.includes("?")), "current project load requests must not carry query params");

responseByUrl = new Map([
  ["/api/runtime/projects/current/real-chain/run-check", current004RealChainPayload],
  ["/api/runtime/projects/current/image2-batch/run-check", current004Image2Payload],
]);
requests = [];
const runStatus = await runProjectRealChainCheck(identity004);
const runImage2 = await runProjectImage2BatchCheck(identity004);
assert(runStatus.status === "production_needs_review", "run check should pass matching 004 status");
assert(runImage2.status === "ready_for_review", "Image2 run check should pass matching 004 status");
assert(requests.map((request) => request.method).join(",") === "POST,POST", "run checks must use POST");
assert(requests.every((request) => !request.url.includes("?projectRoot") && !request.url.includes("?projectId")), "run checks must not pass arbitrary project identity query params");

globalThis.window = {
  location: { hostname: "127.0.0.1", port: "5173" },
};
responseByUrl = new Map([[`http://127.0.0.1:8790${projectCurrentSelectEndpoint}`, currentProjectBindingResponse(project004)]]);
requests = [];
const devPortSelected = await selectCurrentProjectBinding({ projectRoot: project004.projectRoot });
assert(devPortSelected.status === "bound", "dev-port select helper should parse bound selection");
assert(requests[0].url === `http://127.0.0.1:8790${projectCurrentSelectEndpoint}`, "dev UI select helper must route local runtime calls to port 8790");
delete globalThis.window;

console.log("Current project selection binding test passed. Adapter switches by runtime binding and blocks stale 005 summaries.");
