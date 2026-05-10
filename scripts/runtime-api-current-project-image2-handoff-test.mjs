import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2ForbiddenProviders,
  currentProjectImage2TransportModes,
  normalizeCurrentProjectImage2TransportMode,
} from "./current-project-image2-transport-contract.mjs";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mjs";
import { createRuntimeApiCurrentProjectImage2Handoff } from "./runtime-api-current-project-image2-handoff.mjs";
import { createRuntimeApiWorkbenchProjection } from "./runtime-api-workbench-projection.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-image2-handoff.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

for (const forbidden of [
  "currentProjectImage2OneShotReturnIngestResponse",
  "execute-return",
  "actualProviderReturned",
  "strict-edit/return",
]) {
  assert(!moduleSource.includes(forbidden), `handoff module must not contain ${forbidden}`);
}

for (const movedFunction of [
  "function currentProjectImage2OneShotResponse",
  "function currentProjectImage2OneShotPrepareTriggerResponse",
  "function buildProviderSubmitPermissionReceiptState",
]) {
  assert(!serverSource.includes(movedFunction), `local runtime server should import moved handoff code: ${movedFunction}`);
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-image2-handoff-"));
const repoRoot = path.join(workingRoot, "repo");
const runRootRelativePath = "projects/handoff";
const runRootPath = path.join(repoRoot, runRootRelativePath);
const source = {
  runRootPath,
  runRootRelativePath,
  projectVibePath: path.join(runRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${runRootRelativePath}/project/project.vibe`,
  sourceIndexPath: path.join(runRootPath, "project/source_index.json"),
  sourceIndexRelativePath: `${runRootRelativePath}/project/source_index.json`,
  storyFlowPath: path.join(runRootPath, "project/story_flow.json"),
  storyFlowRelativePath: `${runRootRelativePath}/project/story_flow.json`,
  visualMemoryPath: path.join(runRootPath, "project/visual_memory.json"),
  visualMemoryRelativePath: `${runRootRelativePath}/project/visual_memory.json`,
  runManifestPath: path.join(runRootPath, "run_manifest.json"),
  runManifestRelativePath: `${runRootRelativePath}/run_manifest.json`,
  runtimeTruthLayerPath: path.join(runRootPath, "reports/runtime_truth_layer.json"),
  runtimeTruthLayerRelativePath: `${runRootRelativePath}/reports/runtime_truth_layer.json`,
  previewPlanPath: path.join(runRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${runRootRelativePath}/reports/preview_plan.json`,
  reportPath: path.join(runRootPath, "reports/image2_start_long_chain_report.json"),
  reportRelativePath: `${runRootRelativePath}/reports/image2_start_long_chain_report.json`,
  projectRootMode: "test_fixture",
  sourceLabel: "runtime image2 handoff fixture",
};

try {
  writeJson(source.projectVibePath, {
    schemaVersion: "runtime_image2_handoff_test_project_vibe_v1",
    projectId: "handoff_fixture",
    runId: "handoff_fixture_run",
  });
  writeJson(source.storyFlowPath, {
    schemaVersion: "runtime_image2_handoff_test_story_flow_v1",
    shots: [{ id: "S01", sceneId: "scene_missing_lock", roleIds: ["char_missing_lock"] }],
  });
  writeJson(source.visualMemoryPath, {
    schemaVersion: "runtime_image2_handoff_test_visual_memory_v1",
    roles: [],
    scenes: [],
    style: { id: "style_draft", status: "candidate", path: `${runRootRelativePath}/assets/style.md` },
  });
  writeJson(source.sourceIndexPath, { refs: [source.projectVibeRelativePath, source.storyFlowRelativePath, source.visualMemoryRelativePath] });
  writeText(path.join(runRootPath, "prompt_requests/S01_start_frame_prompt.md"), "# S01\n\nPrepare-only handoff fixture.\n");
  writeJson(source.runManifestPath, {
    schemaVersion: "runtime_image2_handoff_test_manifest_v1",
    status: "planned",
    shotPlans: [{
      shotId: "S01",
      promptPath: `${runRootRelativePath}/prompt_requests/S01_start_frame_prompt.md`,
      expectedOutputPath: `${runRootRelativePath}/outputs/S01.png`,
    }],
  });

  const boundary = createRuntimeApiBoundary({
    repoRoot,
    repoRootRealPath: realpathSync(repoRoot),
  });
  const projectionApi = createRuntimeApiWorkbenchProjection({
    repoRoot,
    round5FullRealChainReportFileName: "round5_full_real_chain_report.json",
    existsSync,
    realpathSync,
    pathWithinRoot: boundary.pathWithinRoot,
    isPathInsideRealRoot,
    repoRelativePath: boundary.repoRelativePath,
    normalizeRelativePath: boundary.normalizeRelativePath,
    runtimeRelativeFromValue: boundary.runtimeRelativeFromValue,
    runtimePathExists: (relativePath) => existsSync(boundary.scopedRepoPath(relativePath)),
    runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
    scopedRepoPath: boundary.scopedRepoPath,
    readJsonIfPresent,
    projectIdentityFromSource: () => ({
      projectId: "handoff_fixture",
      runId: "handoff_fixture_run",
      projectRoot: runRootRelativePath,
      projectVibePath: source.projectVibeRelativePath,
    }),
  });
  const api = createRuntimeApiCurrentProjectImage2Handoff({
    repoRoot,
    repoRootRealPath: realpathSync(repoRoot),
    currentProjectSource: () => source,
    projectProjectionFromSource: projectionApi.projectProjectionFromSource,
    currentProjectWorkbenchFacts: projectionApi.currentProjectWorkbenchFacts,
    runtimePolicy: (extra = {}) => ({
      providerCalled: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      dryRunOnly: true,
      ...extra,
    }),
    runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
    scopedRepoPath: boundary.scopedRepoPath,
    readRuntimeJson: (relativePath) => readJsonIfPresent(boundary.scopedRepoPath(relativePath)),
    runtimePathExists: (relativePath) => existsSync(boundary.scopedRepoPath(relativePath)),
    runtimeRelativeFromValue: boundary.runtimeRelativeFromValue,
    normalizeRelativePath: boundary.normalizeRelativePath,
    buildCurrentProjectImage2TransportPlan,
    currentProjectImage2TransportModes,
    currentProjectImage2ForbiddenProviders,
    normalizeCurrentProjectImage2TransportMode,
    currentProjectImage2OneShotStatusEndpoint: "/api/runtime/projects/current/image2-one-shot/status",
    currentProjectImage2OneShotPrepareEndpoint: "/api/runtime/projects/current/image2-one-shot/prepare",
    currentProjectImage2OneShotConfirmEndpoint: "/api/runtime/projects/current/image2-one-shot/confirm",
    currentProjectImage2OneShotPrepareTriggerEndpoint: "/api/runtime/projects/current/image2-one-shot/prepare-trigger",
    semanticQaSummary: projectionApi.semanticQaSummary,
    actualProviderObservationMatches: () => false,
    actualSemanticQaMatches: () => false,
    sha256File,
    existsSync,
    mkdirSync,
    writeFileSync,
    renameSync,
    realpathSync,
    readFileSync,
  });
  const url = new URL("http://127.0.0.1/api/runtime/projects/current/image2-one-shot/status?selectedShotId=S01");
  const input = api.oneShotRequestInput(url, {});
  const status = api.currentProjectImage2OneShotResponse("status", input, {}, source);
  assert(status.status === "blocked", "status should block when locked references are missing");
  assert(status.providerCalled === false, "status must not call provider");
  assert(status.liveSubmitAllowed === false, "status must keep live submit locked");
  assert(status.workerSpawnForbidden === true, "status must forbid worker spawn");
  assert(status.projectVibeWritten === false, "status must not mutate project.vibe");
  assert(status.receipt.policy.providerCalled === false, "receipt policy must hard-lock providerCalled");
  assert(status.receipt.policy.liveSubmitAllowed === false, "receipt policy must hard-lock live submit");
  assert(status.transportPlan.providerCalled === false, "transport plan must hard-lock providerCalled");
  assert(status.statePaths.receiptStatePath.endsWith("/state/prepare-receipt.json"), "receipt state path should stay in state folder");

  const trigger = api.currentProjectImage2OneShotPrepareTriggerResponse(input, {}, source);
  assert(trigger.status === "blocked", "prepare-trigger should block without persisted handoff");
  assert(trigger.providerCalled === false, "prepare-trigger must not call provider");
  assert(trigger.runtimeExternalNetworkCallMade === false, "prepare-trigger must not make network calls");
  assert(trigger.projectVibeWritten === false, "prepare-trigger must not mutate project.vibe");
  assert(trigger.persistedState.triggerPlanPresent === false, "blocked prepare-trigger must not persist trigger plan");
  assert(trigger.blockers.includes("Persisted prepare receipt is required before trigger-plan."), "prepare-trigger should require persisted prepare receipt");
  assert(!existsSync(boundary.scopedRepoPath(trigger.triggerPlanPath)), "blocked prepare-trigger must not write trigger plan file");
} finally {
  rmSync(workingRoot, { recursive: true, force: true });
}

console.log("runtime-api-current-project-image2-handoff-test: ok");
