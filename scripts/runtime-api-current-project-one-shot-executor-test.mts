import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiCurrentProjectOneShotExecutor } from "./runtime-api-current-project-one-shot-executor.mts";
import { createRuntimeApiCurrentProjectReturnWriters } from "./runtime-api-current-project-return-writers.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeRelativePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function oneShotPathInsideRoot(candidatePath, rootPath) {
  if (typeof candidatePath !== "string" || !candidatePath.trim()) return false;
  if (typeof rootPath !== "string" || !rootPath.trim()) return false;
  const normalizedPath = normalizeRelativePath(candidatePath.trim());
  const normalizedRoot = normalizeRelativePath(rootPath.trim());
  if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) return false;
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-one-shot-executor.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

for (const movedFunction of [
  "function oneShotExecutorChecks",
  "function oneShotExecutorContract",
  "function currentProjectImage2OneShotExecutorResponse",
]) {
  assert(!serverSource.includes(movedFunction), `local runtime server should import moved executor code: ${movedFunction}`);
}

for (const forbidden of [
  "execute-return",
  "strict-edit",
  "actual_provider_return_ingest",
  "providerCalled: true",
  "actualImage2Triggered: true",
  "liveSubmitAllowed: true",
]) {
  assert(!moduleSource.includes(forbidden), `one-shot executor module must not contain ${forbidden}`);
}

function createFixture({ receiptPatch = {}, handoffPatch = {} } = {}) {
  const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-one-shot-executor-"));
  const repoRoot = path.join(workingRoot, "repo");
  const runRoot = "runs/current";
  const sandboxRoot = `${runRoot}/sandbox`;
  const shotRoot = `${sandboxRoot}/shots/S01`;
  const stateRoot = `${shotRoot}/state`;
  const receiptStatePath = `${stateRoot}/prepare-receipt.json`;
  const handoffStatePath = `${stateRoot}/handoff-packet.json`;
  const expectedOutputPath = `${shotRoot}/outputs/start.png`;
  const providerObservationPath = `${shotRoot}/provider/provider-observation.json`;
  const semanticQaPath = `${shotRoot}/qa/semantic-qa.json`;
  const manifestPath = `${shotRoot}/manifest.json`;
  const qaReportPath = `${shotRoot}/qa/qa-report.json`;
  const receipt = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_receipt_v1",
    status: "prepared",
    receiptId: "receipt_S01",
    selectedShotId: "S01",
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    oneShotOnly: true,
    imageCount: 1,
    sandbox: {
      root: sandboxRoot,
      shotRoot,
      stateRoot,
      receiptStatePath,
      handoffStatePath,
      manifestPath,
      qaReportPath,
    },
    policy: {
      providerCalled: false,
      providerSubmitAllowed: 0,
      automaticSubmitAllowed: false,
      liveSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      workerSpawnForbidden: true,
      projectVibeWritten: false,
    },
    ...receiptPatch,
  };
  receipt.sandbox = { ...receipt.sandbox, ...(receiptPatch.sandbox || {}) };
  const handoff = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_handoff_packet_v1",
    status: "ready_for_manual_transport",
    receiptId: receipt.receiptId,
    packetId: `handoff_${receipt.receiptId}`,
    selectedShotId: receipt.selectedShotId,
    expectedOutputPath: receipt.expectedOutputPath,
    providerObservationPath: receipt.providerObservationPath,
    semanticQaPath: receipt.semanticQaPath,
    requiresExternalAction: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
    projectVibeWritten: false,
    transportPlan: {
      mode: "agent_app_server",
      target: "agent_app_server",
      endpoint: "/api/agent/app-server/image2/one-shot",
      externalCallPreparedOnly: true,
      actualExecutionAllowed: false,
      providerCalled: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
    appServerContract: {
      mode: "agent_app_server_handoff_only",
      manualTransportRequired: true,
      automaticSubmitAllowed: false,
      actualExecutionAllowed: false,
    },
    ...handoffPatch,
  };
  mkdirSync(path.join(repoRoot, shotRoot), { recursive: true });
  const scopedRepoPath = (relativePath) => path.join(repoRoot, normalizeRelativePath(relativePath));
  const writers = createRuntimeApiCurrentProjectReturnWriters({
    repoRootRealPath: realpathSync(repoRoot),
    scopedRepoPath,
    normalizeRelativePath,
    oneShotPathInsideRoot,
    isPathInsideRealRoot,
    existsSync,
    mkdirSync,
    writeFileSync,
    renameSync,
    realpathSync,
  });
  const source = {
    sourceLabel: "one-shot executor fixture",
    projectRootMode: "test_fixture",
    runRootRelativePath: runRoot,
  };
  const api = createRuntimeApiCurrentProjectOneShotExecutor({
    currentProjectSource: () => source,
    currentProjectImage2OneShotResponse: () => ({
      statePaths: { stateRoot, receiptStatePath, handoffStatePath },
      receipt: { sandbox: receipt.sandbox },
      expectedOutputPath: receipt.expectedOutputPath,
      providerObservationPath: receipt.providerObservationPath,
      semanticQaPath: receipt.semanticQaPath,
      currentProject: { projectRoot: runRoot },
      requestContext: {},
      projectRoot: runRoot,
      projectId: "fixture_project",
      project: { projectId: "fixture_project", runId: "fixture_run" },
      transportPlan: handoff.transportPlan,
    }),
    oneShotRequestInput: (url, body = {}) => ({
      selectedShotId: url.searchParams.get("selectedShotId") || body.selectedShotId,
      selectedShotIds: [url.searchParams.get("selectedShotId") || body.selectedShotId].filter(Boolean),
      imageCount: 1,
      expectedOutputPath: body.expectedOutputPath,
    }),
    oneShotStateJson: (relativePath) => {
      if (relativePath === receiptStatePath) return receipt;
      if (relativePath === handoffStatePath) return handoff;
      return undefined;
    },
    oneShotPathInsideRoot,
    inspectForRawCredentialMaterial: () => false,
    oneShotExecutorPathInsideSandbox: writers.oneShotExecutorPathInsideSandbox,
    writeOneShotExecutorBytes: writers.writeOneShotExecutorBytes,
    writeOneShotExecutorJson: writers.writeOneShotExecutorJson,
    normalizeRelativePath,
    runtimePathExists: (relativePath) => existsSync(scopedRepoPath(relativePath)),
    runtimePolicy: (extra = {}) => ({
      providerCalled: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      externalNetworkCallMade: false,
      ...extra,
    }),
    runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
    sha256File,
    currentProjectImage2OneShotExecuteMockEndpoint: "/api/runtime/projects/current/image2-one-shot/execute-mock",
  });
  const input = (body = {}, query = "") => {
    const suffix = query ? `&${query}` : "";
    const url = new URL(`http://127.0.0.1/api/runtime/projects/current/image2-one-shot/execute-mock?selectedShotId=S01${suffix}`);
    return api.oneShotExecutorRequestInput(url, body);
  };
  return {
    api,
    input,
    receipt,
    handoff,
    scopedRepoPath,
    expectedOutputPath: receipt.expectedOutputPath,
    providerObservationPath: handoff.providerObservationPath,
    semanticQaPath: handoff.semanticQaPath,
    manifestPath: receipt.sandbox.manifestPath,
    qaReportPath: receipt.sandbox.qaReportPath,
    cleanup: () => rmSync(workingRoot, { recursive: true, force: true }),
  };
}

{
  const fixture = createFixture();
  try {
    const response = fixture.api.currentProjectImage2OneShotExecutorResponse(fixture.input({ executorMode: "dry_run_executor" }));
    assert(response.status === "dry_run_executor_ready", "dry-run contract should be ready without blockers");
    assert(response.providerCalled === false, "dry-run must not call provider");
    assert(response.executorContract.providerCallContract.providerCallsAttempted === 0, "dry-run must attempt zero provider calls");
    assert(response.executorContract.providerCallContract.providerCalled === false, "dry-run contract must keep providerCalled=false");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture();
  try {
    const response = fixture.api.currentProjectImage2OneShotExecutorResponse(fixture.input({ executorMode: "mock_executor" }));
    assert(response.status === "mock_output_returned_needs_review", "mock executor should return output for review");
    assert(response.providerObservation.providerObservationMode === "mock_readiness_evidence", "mock provider observation should be readiness evidence");
    assert(response.actualImage2Triggered === false, "mock executor must not mark actual Image2 as triggered");
    assert(response.providerCalled === false, "mock executor must not mark provider called");
    assert(response.externalNetworkCallMade === false, "mock executor must not mark external network calls");
    assert(response.projectVibeWritten === false, "mock executor must not mutate project.vibe");
    assert(response.liveSubmitAllowed === false, "mock executor must not allow live submit");
    assert(response.executorEvidence.formalPromotionAllowed === false, "mock executor must not allow formal promotion");
    for (const relativePath of [
      fixture.expectedOutputPath,
      fixture.providerObservationPath,
      fixture.semanticQaPath,
      fixture.manifestPath,
      fixture.qaReportPath,
    ]) {
      assert(existsSync(fixture.scopedRepoPath(relativePath)), `${relativePath} should be written by mock executor`);
    }
    assert(readJson(fixture.scopedRepoPath(fixture.providerObservationPath)).providerObservationMode === "mock_readiness_evidence", "provider observation sidecar should persist mock mode");
    assert(readJson(fixture.scopedRepoPath(fixture.manifestPath)).manifestMatched === true, "manifest sidecar should persist match");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture();
  try {
    const response = fixture.api.currentProjectImage2OneShotExecutorResponse(fixture.input({
      executorMode: "real_provider_call",
      realProviderGate: {
        explicitUserConfirmed: true,
        allowRealProviderCall: true,
        confirmationScope: "single_image2_one_shot",
        maxProviderCalls: 1,
        mainThreadFinalConfirmation: true,
      },
    }));
    assert(response.status === "blocked", "real provider call mode should fail closed");
    assert(response.executorContract.providerCallContract.realProviderGateSatisfied === true, "gate should be recognized as satisfied");
    assert(response.executorContract.checks.some((item) => item.checkId === "real_provider_runtime_blocked" && item.status === "blocked"), "real_provider_runtime_blocked should block runtime execution");
    assert(response.providerCalled === false, "blocked real provider mode must not call provider");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture();
  try {
    const response = fixture.api.currentProjectImage2OneShotExecutorResponse(fixture.input({
      executorMode: "dry_run_executor",
      liveSubmitAllowed: true,
      providerCalled: true,
      externalNetworkIoAllowed: true,
      workerSpawnAllowed: true,
      projectVibeWritten: true,
    }));
    assert(response.status === "blocked", "unsafe request drift should be blocked");
    assert(response.executorContract.checks.some((item) => item.checkId === "request_does_not_escalate_locks" && item.status === "blocked"), "unsafe drift check should block");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({
    receiptPatch: { expectedOutputPath: "runs/current/sandbox/shots/S01/../escape/start.png" },
    handoffPatch: { expectedOutputPath: "runs/current/sandbox/shots/S01/../escape/start.png" },
  });
  try {
    const response = fixture.api.currentProjectImage2OneShotExecutorResponse(fixture.input({ executorMode: "dry_run_executor" }));
    assert(response.status === "blocked", "escaped expectedOutputPath should be blocked");
    assert(response.executorContract.checks.some((item) => item.checkId === "expected_output_inside_sandbox" && item.status === "blocked"), "expected output sandbox check should block");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture({
    receiptPatch: {
      sandbox: { manifestPath: "runs/current/sandbox/shots/S01/../escape/manifest.json" },
    },
  });
  try {
    const response = fixture.api.currentProjectImage2OneShotExecutorResponse(fixture.input({ executorMode: "dry_run_executor" }));
    assert(response.status === "blocked", "escaped sidecar path should be blocked");
    assert(response.executorContract.checks.some((item) => item.checkId === "manifest_inside_sandbox" && item.status === "blocked"), "sidecar sandbox check should block");
  } finally {
    fixture.cleanup();
  }
}

console.log("runtime-api-current-project-one-shot-executor-test: ok");
