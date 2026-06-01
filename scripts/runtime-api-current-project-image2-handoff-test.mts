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
} from "./current-project-image2-transport-contract.mts";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mts";
import { createRuntimeApiCurrentProjectImage2Handoff } from "./runtime-api-current-project-image2-handoff.mts";
import { createRuntimeApiWorkbenchProjection } from "./runtime-api-workbench-projection.mts";

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

function createFixture({ lockedReferences = false } = {}) {
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
  const lockedVisualMemory = {
    schemaVersion: "runtime_image2_handoff_test_visual_memory_v1",
    roles: [{
      id: "char_locked",
      status: "locked",
      path: `${runRootRelativePath}/assets/char_locked.png`,
      usedByShotIds: ["S01"],
    }],
    scenes: [{
      id: "scene_locked",
      status: "locked",
      path: `${runRootRelativePath}/assets/scene_locked.png`,
      usedByShotIds: ["S01"],
    }],
    props: [{
      id: "prop_locked",
      status: "locked",
      path: `${runRootRelativePath}/assets/prop_locked.png`,
      usedByShotIds: ["S01"],
    }],
    style: {
      id: "style_locked",
      status: "locked",
      path: `${runRootRelativePath}/assets/style_locked.md`,
    },
  };
  writeJson(source.projectVibePath, {
    schemaVersion: "runtime_image2_handoff_test_project_vibe_v1",
    projectId: "handoff_fixture",
    runId: "handoff_fixture_run",
  });
  writeJson(source.storyFlowPath, {
    schemaVersion: "runtime_image2_handoff_test_story_flow_v1",
    shots: [{ id: "S01", sceneId: "scene_locked", roleIds: ["char_locked"], propIds: ["prop_locked"] }],
  });
  writeJson(source.visualMemoryPath, lockedReferences
    ? lockedVisualMemory
    : {
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
      providerId: "openai-image2-api",
      providerSlot: "image.generate",
      requiredMode: "text2image",
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
  const requestInput = (action, body = {}, query = "") => {
    const suffix = query ? `&${query}` : "";
    const url = new URL(`http://127.0.0.1/api/runtime/projects/current/image2-one-shot/${action}?selectedShotId=S01${suffix}`);
    return api.oneShotRequestInput(url, body);
  };
  return {
    workingRoot,
    repoRoot,
    runRootRelativePath,
    source,
    boundary,
    api,
    requestInput,
    cleanup: () => rmSync(workingRoot, { recursive: true, force: true }),
  };
}

function assertHardLocks(response, label) {
  assert(response.providerCalled === false, `${label} must not call provider`);
  assert(response.liveSubmitAllowed === false, `${label} must keep live submit locked`);
  assert(response.workerSpawnForbidden === true, `${label} must forbid worker spawn`);
  assert(response.projectVibeWritten === false, `${label} must not mutate project.vibe`);
}

function prepareAndConfirm(fixture) {
  const prepareInput = fixture.requestInput("prepare");
  const prepare = fixture.api.currentProjectImage2OneShotResponse("prepare", prepareInput, {}, fixture.source);
  assert(prepare.status === "prepared", "prepare should return prepared with locked references");
  const confirmInput = fixture.requestInput("confirm", { receipt: prepare.receipt });
  const confirm = fixture.api.currentProjectImage2OneShotResponse("confirm", confirmInput, {}, fixture.source);
  assert(confirm.status === "handoff_prepared", "confirm should prepare handoff packet");
  return { prepare, confirm };
}

{
  const fixture = createFixture({ lockedReferences: false });
  try {
    const input = fixture.requestInput("status");
    const status = fixture.api.currentProjectImage2OneShotResponse("status", input, {}, fixture.source);
    assert(status.status === "blocked", "status should block when locked references are missing");
    assertHardLocks(status, "status");
    assert(status.receipt.policy.providerCalled === false, "receipt policy must hard-lock providerCalled");
    assert(status.receipt.policy.liveSubmitAllowed === false, "receipt policy must hard-lock live submit");
    assert(status.transportPlan.providerCalled === false, "transport plan must hard-lock providerCalled");
    assert(status.statePaths.receiptStatePath.endsWith("/state/prepare-receipt.json"), "receipt state path should stay in state folder");

    const trigger = fixture.api.currentProjectImage2OneShotPrepareTriggerResponse(input, {}, fixture.source);
    assert(trigger.status === "blocked", "prepare-trigger should block without persisted handoff");
    assertHardLocks(trigger, "prepare-trigger");
    assert(trigger.runtimeExternalNetworkCallMade === false, "prepare-trigger must not make network calls");
    assert(trigger.persistedState.triggerPlanPresent === false, "blocked prepare-trigger must not persist trigger plan");
    assert(trigger.blockers.includes("Persisted prepare receipt is required before trigger-plan."), "prepare-trigger should require persisted prepare receipt");
    assert(!existsSync(fixture.boundary.scopedRepoPath(trigger.triggerPlanPath)), "blocked prepare-trigger must not write trigger plan file");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({ lockedReferences: true });
  try {
    const input = fixture.requestInput("prepare");
    const prepare = fixture.api.currentProjectImage2OneShotResponse("prepare", input, {}, fixture.source);
    assert(prepare.status === "prepared", "prepare should return prepared with complete locked refs");
    assert(prepare.receipt.lockedReferences.props.length === 1, "prepare receipt should include locked prop references");
    assert(prepare.receipt.visualReferenceInputs.some((item) => item.type === "prop" && item.path.endsWith("/assets/prop_locked.png")), "visualReferenceInputs should carry locked prop path");
    assert(prepare.persistedState.receiptPresent === true, "prepare should report persisted receipt");
    assertHardLocks(prepare, "prepare");
    assert(prepare.receipt.policy.providerCalled === false, "prepare receipt policy must hard-lock providerCalled");
    assert(prepare.receipt.policy.liveSubmitAllowed === false, "prepare receipt policy must hard-lock live submit");
    assert(prepare.receipt.policy.projectVibeWritten === false, "prepare receipt policy must hard-lock project.vibe writes");
    const persistedReceipt = readJsonIfPresent(fixture.boundary.scopedRepoPath(prepare.statePaths.receiptStatePath));
    assert(persistedReceipt?.status === "prepared", "prepare should persist state/prepare-receipt.json");
    assert(persistedReceipt.receiptId === prepare.receipt.receiptId, "persisted prepare receipt should match response receipt");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({ lockedReferences: true });
  try {
    const { prepare, confirm } = prepareAndConfirm(fixture);
    assertHardLocks(confirm, "confirm");
    assert(confirm.handoffPacket?.status === "ready_for_manual_transport", "confirm handoff packet should be ready_for_manual_transport");
    assert(confirm.handoffPacket.providerCalled === false, "confirm handoff packet must not call provider");
    assert(confirm.handoffPacket.liveSubmitAllowed === false, "confirm handoff packet must keep live submit locked");
    const persistedReceipt = readJsonIfPresent(fixture.boundary.scopedRepoPath(confirm.statePaths.receiptStatePath));
    const persistedHandoff = readJsonIfPresent(fixture.boundary.scopedRepoPath(confirm.statePaths.handoffStatePath));
    assert(persistedReceipt?.receiptId === prepare.receipt.receiptId, "confirm should keep persisted prepare receipt");
    assert(persistedHandoff?.status === "ready_for_manual_transport", "confirm should persist state/handoff-packet.json");
    assert(persistedHandoff.packetId === confirm.handoffPacket.packetId, "persisted handoff should match response handoff");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({ lockedReferences: true });
  try {
    const { confirm } = prepareAndConfirm(fixture);
    const expectedOutputs = [{
      shotId: confirm.selectedShotId,
      expectedOutputPath: confirm.expectedOutputPath,
      providerObservationPath: confirm.providerObservationPath,
      semanticQaPath: confirm.semanticQaPath,
    }];
    const input = fixture.requestInput("prepare-trigger", {
      credentialRef: "vault:image2/openai/default",
      expectedOutputs,
      submitPermissionReceiptRequired: true,
    });
    const trigger = fixture.api.currentProjectImage2OneShotPrepareTriggerResponse(input, {}, fixture.source);
    assert(trigger.status === "trigger_plan_prepared", "prepare-trigger should prepare trigger plan after persisted receipt and handoff");
    assert(trigger.submitPermissionReceipt?.status === "pending_action_time_confirmation", "submit permission receipt should wait for action-time confirmation");
    assert(trigger.persistedState.triggerPlanPresent === true, "prepare-trigger should report persisted trigger plan");
    assert(trigger.persistedState.submitPermissionReceiptPresent === true, "prepare-trigger should report persisted submit permission receipt");
    assertHardLocks(trigger, "successful prepare-trigger");
    assert(trigger.runtimeProviderSubmitAttempted === false, "successful prepare-trigger must not submit provider request");
    assert(trigger.runtimeExternalNetworkCallMade === false, "successful prepare-trigger must not make network calls");
    assert(trigger.submitPolicy.providerSubmitAllowed === 0, "successful prepare-trigger must keep provider submit disabled");
    assert(trigger.submitPermissionReceipt.hardLocks.canSubmitProvider === false, "submit receipt must hard-lock provider submit");
    assert(trigger.submitPermissionReceipt.hardLocks.liveSubmitAllowed === false, "submit receipt must hard-lock live submit");
    assert(trigger.submitPermissionReceipt.hardLocks.projectVibeMutationAllowed === false, "submit receipt must hard-lock project.vibe mutation");
    const triggerPlan = readJsonIfPresent(fixture.boundary.scopedRepoPath(trigger.triggerPlanPath));
    const triggerPlanState = readJsonIfPresent(fixture.boundary.scopedRepoPath(trigger.statePaths.triggerPlanStatePath));
    const submitReceipt = readJsonIfPresent(fixture.boundary.scopedRepoPath(trigger.submitPermissionReceiptStatePath));
    assert(triggerPlan?.status === "trigger_plan_prepared", "prepare-trigger should write sandbox trigger-plan/image2-start-trigger-plan.json");
    assert(triggerPlanState?.status === "trigger_plan_prepared", "prepare-trigger should write state/trigger-plan.json");
    assert(submitReceipt?.status === "pending_action_time_confirmation", "prepare-trigger should write state/submit-permission-receipt.json");
    assert(submitReceipt.credential.credentialRef === "vault:image2/openai/default", "submit receipt should persist only the opaque credentialRef");
    assert(submitReceipt.credential.secretMaterialPresent === false, "submit receipt must not contain secret material");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({ lockedReferences: true });
  try {
    prepareAndConfirm(fixture);
    const input = fixture.requestInput("prepare-trigger", {
      credentialRef: "vault:image2/openai/default",
      apiKey: "sk-testsecretmaterial",
      expectedOutputs: [],
      submitPermissionReceiptRequired: true,
    });
    const trigger = fixture.api.currentProjectImage2OneShotPrepareTriggerResponse(input, {}, fixture.source);
    assert(trigger.status === "blocked", "prepare-trigger should block raw credential-like body");
    assert(trigger.blockers.includes("Raw credential material or credential-like keys are forbidden."), "raw credential body should produce secret blocker");
    assert(trigger.persistedState.triggerPlanPresent === false, "raw credential body must not persist trigger plan");
    assert(!existsSync(fixture.boundary.scopedRepoPath(trigger.triggerPlanPath)), "raw credential body must not write trigger plan file");
    assert(!existsSync(fixture.boundary.scopedRepoPath(trigger.statePaths.triggerPlanStatePath)), "raw credential body must not write state trigger plan");
  } finally {
    fixture.cleanup();
  }
}

for (const [label, expectedOutputPath] of [
  ["project.vibe expected output", "projects/handoff/project/project.vibe"],
]) {
  const fixture = createFixture({ lockedReferences: true });
  try {
    const beforeProjectVibe = readFileSync(fixture.source.projectVibePath, "utf8");
    const input = fixture.requestInput("prepare", { expectedOutputPath });
    const prepare = fixture.api.currentProjectImage2OneShotResponse("prepare", input, {}, fixture.source);
    assert(prepare.status === "blocked", `${label} should block unsafe expectedOutputPath`);
    assert(prepare.blockers.includes("Expected output path must stay inside the current project one-shot sandbox."), `${label} should report sandbox output blocker`);
    assert(prepare.projectVibeWritten === false, `${label} must not mark project.vibe written`);
    assert(readFileSync(fixture.source.projectVibePath, "utf8") === beforeProjectVibe, `${label} must not write project.vibe`);
    assert(!existsSync(fixture.boundary.scopedRepoPath(prepare.statePaths.receiptStatePath)), `${label} must not write prepare receipt`);
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({ lockedReferences: true });
  try {
    const input = fixture.requestInput("prepare", {}, "transportMode=disabled");
    const prepare = fixture.api.currentProjectImage2OneShotResponse("prepare", input, {}, fixture.source);
    assert(prepare.status === "blocked", "disabled transportMode should block prepare");
    assert(prepare.blockers.includes("Image2 transport mode is disabled for this request."), "disabled transportMode should report blocker");
    assert(prepare.transportPlan.disabled === true, "disabled transportMode should produce disabled transport plan");
    assert(!existsSync(fixture.boundary.scopedRepoPath(prepare.statePaths.receiptStatePath)), "disabled transportMode must not write prepare receipt");
  } finally {
    fixture.cleanup();
  }
}

console.log("runtime-api-current-project-image2-handoff-test: ok");
