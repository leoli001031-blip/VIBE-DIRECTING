import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          const payload = JSON.parse(line);
          clearTimeout(timeout);
          resolve(payload);
          return;
        } catch {
          // Wait for a complete JSON line.
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

function spawnRuntimeServer(env) {
  return spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assertRuntimeLocks(payload, label) {
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must stay blocked`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.workerSpawnForbidden === true, `${label} worker spawn must stay blocked`);
  if (payload.submitPolicy) {
    assert(payload.submitPolicy.providerCallAllowed === false, `${label} submit policy must forbid provider call`);
    if (payload.submitPolicy.providerSubmitAllowed !== undefined) {
      assert(payload.submitPolicy.providerSubmitAllowed === 0, `${label} submit policy must allow zero submits`);
    }
    if (payload.submitPolicy.manualTransportRequired !== undefined) {
      assert(payload.submitPolicy.manualTransportRequired === true, `${label} must require manual transport`);
    }
    assert(payload.submitPolicy.dryRunOnly === true, `${label} must stay dry-run only`);
  }
  if (payload.transportPlan) {
    assert(payload.transportPlan.actualExecutionAllowed === false, `${label} transport must not execute`);
    assert(payload.transportPlan.providerCalled === false, `${label} transport must not call provider`);
    assert(payload.transportPlan.liveSubmitAllowed === false, `${label} transport live submit must stay blocked`);
    assert(payload.transportPlan.projectVibeWritten === false, `${label} transport must not write project.vibe`);
    assert(payload.transportPlan.workerSpawnForbidden === true, `${label} transport worker spawn must stay blocked`);
  }
}

function buildFixture(fixtureRoot) {
  const shots = [
    {
      id: "T01",
      title: "Archive doorway",
      actId: "act_1",
      sectionId: "scene_archive",
      sceneId: "scene_archive",
      roleIds: ["char_mika"],
      action: "Mika pauses at the archive doorway, checking a blue signal on her wrist device.",
      generationScope: {
        startFrameOnly: true,
        endFrame: {
          contractOnly: true,
          realGenerationAllowed: false,
          requiredFutureMode: "image.edit/image2image_from_approved_start_frame",
        },
      },
    },
    {
      id: "T02",
      title: "Terminal reveal",
      actId: "act_1",
      sectionId: "scene_terminal",
      sceneId: "scene_terminal",
      roleIds: ["char_ren"],
      action: "Ren stands beside the old terminal wall as the room lights wake up.",
      generationScope: {
        startFrameOnly: true,
        endFrame: {
          contractOnly: true,
          realGenerationAllowed: false,
          requiredFutureMode: "image.edit/image2image_from_approved_start_frame",
        },
      },
    },
  ];
  rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(`${fixtureRoot}/project`, { recursive: true });

  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_real_image2_readiness_project_vibe_v1",
    projectId: "current_project_real_image2_readiness",
    runId: "current_project_real_image2_readiness_run",
    title: "Real Image2 Readiness",
    constraints: {
      maxRealImage2Outputs: 2,
      startFrameOnly: true,
      endFrameContractOnly: true,
      endFrameRealGenerationAllowed: false,
      seedanceAllowed: false,
      jimengAllowed: false,
      videoAllowed: false,
      fastAllowed: false,
      vipAllowed: false,
    },
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_real_image2_readiness_story_flow_v1",
    sections: [
      { id: "scene_archive", label: "Archive", shotIds: ["T01"] },
      { id: "scene_terminal", label: "Terminal", shotIds: ["T02"] },
    ],
    shots,
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_real_image2_readiness_visual_memory_v1",
    roles: [
      {
        id: "char_mika",
        displayName: "Mika",
        status: "locked",
        path: `${fixtureRoot}/assets/locked/char_mika.png`,
        usedByShotIds: ["T01"],
        textConstraints: ["same short black hair", "quiet 2D anime heroine", "blue wrist device"],
      },
      {
        id: "char_ren",
        displayName: "Ren",
        status: "locked",
        path: `${fixtureRoot}/assets/locked/char_ren.png`,
        usedByShotIds: ["T02"],
        textConstraints: ["same silver hair", "quiet 2D anime technician", "round glasses"],
      },
    ],
    scenes: [
      {
        id: "scene_archive",
        displayName: "Underground archive doorway",
        status: "locked",
        path: `${fixtureRoot}/assets/locked/scene_archive.png`,
        usedByShotIds: ["T01"],
        spatialAnchors: ["doorway left", "rows of archive shelves behind", "camera axis locked"],
      },
      {
        id: "scene_terminal",
        displayName: "Old terminal wall",
        status: "locked",
        path: `${fixtureRoot}/assets/locked/scene_terminal.png`,
        usedByShotIds: ["T02"],
        spatialAnchors: ["terminal wall at back", "desk foreground right", "camera axis locked"],
      },
    ],
    style: {
      id: "style_quiet_anime",
      displayName: "Quiet anime",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/style_quiet_anime.png`,
      positive: "clean 2D anime film frame, restrained color, low texture, stable 16:9 composition",
      negative: "no photorealism, no 3D render, no heavy texture, no live action",
      textConstraints: [
        "16:9 start frame only",
        "use locked character and scene refs",
        "do not generate end frames in this readiness run",
      ],
    },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_real_image2_readiness_source_index_v1",
    refs: [
      `${fixtureRoot}/project/project.vibe`,
      `${fixtureRoot}/project/story_flow.json`,
      `${fixtureRoot}/project/visual_memory.json`,
    ],
  });
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_real_image2_readiness_manifest_v1",
    projectId: "current_project_real_image2_readiness",
    runId: "current_project_real_image2_readiness_run",
    shotPlans: shots.map((shot, index) => ({
      shotId: shot.id,
      order: index + 1,
      providerId: "openai-image2-api",
      providerSlot: "image.generate",
      requiredMode: "text2image",
      frameRole: "start_frame",
      startFrameOnly: true,
      expectedOutputPath: `${fixtureRoot}/outputs/shots/${shot.id}/start.png`,
      providerObservationPath: `${fixtureRoot}/provider_observations/${shot.id}_start_provider_observation.json`,
      semanticQaPath: `${fixtureRoot}/semantic_qa/${shot.id}_start_semantic_qa.json`,
      promptPath: `${fixtureRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`,
      endFrameContract: {
        status: "contract_only_not_generated",
        providerSlot: "image.edit",
        requiredMode: "image2image",
        sourceStartFramePath: `${fixtureRoot}/outputs/shots/${shot.id}/start.png`,
        realGenerationAllowed: false,
        forbiddenFallbacks: ["image2image_to_text2image", "independent_end_frame_generation"],
      },
      status: "queued_for_real_image2_readiness",
    })),
  });
  return shots.map((shot) => shot.id);
}

function remainingReadinessBlockers() {
  return [
    {
      code: "external_real_image2_provider_still_blocked",
      detail: "The mock executor consumes persisted handoff packets and proves sandbox/report/preview return, but it does not perform an external Image2 call.",
      required: "A separately enabled real executor transport with action-time confirmation, one provider attempt, credential reference, and provider observation evidence.",
    },
    {
      code: "credential_grant_not_consumable_by_real_executor",
      detail: "The local runtime still does not consume a user-authorized provider credential reference for external Image2 calls.",
      required: "A user-authorized credential reference handled outside project files and bound to a single provider attempt.",
    },
    {
      code: "real_watcher_daemon_not_enabled",
      detail: "The mock executor writes expected files synchronously; no long-running watcher daemon is started.",
      required: "A real watcher/ingest loop for external provider completion, manifest matching, and semantic QA receipt.",
    },
  ];
}

const generatedAt = new Date().toISOString();
const runId = `run-${generatedAt.replace(/[:.]/g, "-")}`;
const readinessRoot = "real-test-sandbox/current-project-real-image2-readiness";
const fixtureRoot = `${readinessRoot}/runs/${runId}`;
const reportPath = `${fixtureRoot}/reports/readiness-report.json`;
const latestReportPath = `${readinessRoot}/reports/latest-readiness-report.json`;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-real-image2-readiness-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const shotIds = buildFixture(fixtureRoot);
const projectVibePath = `${fixtureRoot}/project/project.vibe`;
const projectVibeBefore = statSync(projectVibePath).mtimeMs;

const child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

try {
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectRoot: fixtureRoot,
      projectId: "current_project_real_image2_readiness",
      displayName: "Real Image2 Readiness",
    }),
  });
  assert(select.response.status === 200, "readiness fixture should bind as current project");
  assertRuntimeLocks(select.payload, "select readiness fixture");

  const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(status.response.status === 200, "readiness current project status should load");
  assert(status.payload.workbenchFacts?.storyFlow?.shotCount === 2, "fixture should expose two shots");
  assert(status.payload.workbenchFacts?.visualMemory?.summary?.locked === 5, "fixture should expose locked roles, scenes, and style");
  assertRuntimeLocks(status.payload, "current project status");

  const batchRunCheck = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: "ignored/override", projectId: "ignored_override" }),
  });
  assert(batchRunCheck.response.status === 200, "readiness image2 batch run-check should return 200");
  assert(batchRunCheck.payload.items?.length === 2, "readiness batch run-check should cover the two-shot fixture");
  assert(batchRunCheck.payload.summary?.plannedCount === 2, "readiness batch run-check planned count mismatch");
  assert(batchRunCheck.payload.ledgerProjection?.summary?.queued === 2, "readiness batch run-check should leave both shots queued");
  assert(batchRunCheck.payload.submitPolicy?.providerCallAllowed === false, "readiness batch run-check must forbid provider calls");
  assert(batchRunCheck.payload.command?.providerCalled === false, "readiness batch run-check must not call provider");
  assert(batchRunCheck.payload.command?.verifyScriptRan === false, "readiness batch run-check must not spawn verify script");
  assert(batchRunCheck.payload.command?.workerSpawnForbidden === true, "readiness batch run-check must forbid worker spawn");
  assertRuntimeLocks(batchRunCheck.payload, "image2 batch run-check");

  const shotResults = [];
  const missingHandoff = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-mock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: "T01",
      selectedShotIds: ["T01"],
      imageCount: 1,
      executorMode: "mock_executor",
    }),
  });
  assert(missingHandoff.response.status === 409, "mock executor must fail closed before handoff exists");
  assert(missingHandoff.payload.status === "blocked", "missing handoff mock executor status should be blocked");
  assert(missingHandoff.payload.providerCalled === false, "missing handoff must not call provider");

  for (const shotId of shotIds) {
    const initial = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(initial.response.status === 200, `${shotId} initial status should return 200`);
    assert(initial.payload.status === "ready_to_prepare", `${shotId} should start ready_to_prepare`);
    assertRuntimeLocks(initial.payload, `${shotId} initial status`);

    const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shotId,
        selectedShotIds: [shotId],
        imageCount: 1,
        transportMode: "codex_app_server",
      }),
    });
    assert(prepare.response.status === 200, `${shotId} prepare should return 200`);
    assert(prepare.payload.status === "prepared", `${shotId} prepare should persist receipt`);
    assert(prepare.payload.transportPlan?.mode === "codex_app_server", `${shotId} should prepare app-server handoff mode`);
    assert(prepare.payload.transportPlan?.target === "codex_app_server", `${shotId} app-server target missing`);
    assert(prepare.payload.transportPlan?.endpoint === "/api/codex/app-server/image2/one-shot", `${shotId} app-server endpoint drifted`);
    assert(prepare.payload.transportPlan?.externalCallPreparedOnly === true, `${shotId} app-server transport must remain prepared-only`);
    assert(prepare.payload.persistedState?.receiptPresent === true, `${shotId} receipt should persist`);
    assert(existsSync(prepare.payload.statePaths.receiptStatePath), `${shotId} persisted receipt file missing`);
    assertRuntimeLocks(prepare.payload, `${shotId} prepare`);

    const confirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shotId,
        selectedShotIds: [shotId],
        imageCount: 1,
        expectedOutputPath: prepare.payload.expectedOutputPath,
        receipt: prepare.payload.receipt,
      }),
    });
    assert(confirm.response.status === 200, `${shotId} confirm should return 200`);
    assert(confirm.payload.status === "handoff_prepared", `${shotId} should become handoff_prepared`);
    assert(confirm.payload.transportPlan?.mode === "codex_app_server", `${shotId} confirm should preserve app-server transport mode`);
    assert(confirm.payload.handoffPacket?.transportPlan?.mode === "codex_app_server", `${shotId} handoff packet should preserve app-server transport mode`);
    assert(confirm.payload.handoffPacket?.status === "ready_for_manual_transport", `${shotId} handoff should be ready for manual transport`);
    assert(confirm.payload.handoffPacket?.requiresExternalAction === true, `${shotId} handoff must require external action`);
    assert(confirm.payload.handoffPacket?.appServerContract?.manualTransportRequired === true, `${shotId} app-server contract must require manual transport`);
    assert(confirm.payload.handoffPacket?.appServerContract?.automaticSubmitAllowed === false, `${shotId} app-server contract must forbid automatic submit`);
    assert(confirm.payload.handoffPacket?.appServerContract?.actualExecutionAllowed === false, `${shotId} app-server contract must forbid execution`);
    assert(confirm.payload.previewProjection?.status === "waiting_file", `${shotId} preview should wait for provider file`);
    assert(confirm.payload.watcherProjection?.watcherStarted === false, `${shotId} watcher must not start a daemon`);
    assert(confirm.payload.watcherProjection?.reportProjectionOnly === true, `${shotId} watcher must stay projection-only`);
    assert(confirm.payload.persistedState?.handoffPresent === true, `${shotId} handoff should persist`);
    assert(existsSync(confirm.payload.statePaths.handoffStatePath), `${shotId} persisted handoff file missing`);
    assertRuntimeLocks(confirm.payload, `${shotId} confirm`);

    const unsafeExecutor = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-mock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shotId,
        selectedShotIds: [shotId],
        imageCount: 1,
        expectedOutputPath: "../outside.png",
        executorMode: "mock_executor",
      }),
    });
    assert(unsafeExecutor.response.status === 409, `${shotId} unsafe mock executor output path should fail closed`);
    assert(unsafeExecutor.payload.providerCalled === false, `${shotId} unsafe mock executor must not call provider`);

    const liveDriftExecutor = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-mock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shotId,
        selectedShotIds: [shotId],
        imageCount: 1,
        executorMode: "mock_executor",
        liveSubmitAllowed: true,
      }),
    });
    assert(liveDriftExecutor.response.status === 409, `${shotId} live-submit drift should fail closed`);
    assert(liveDriftExecutor.payload.liveSubmitAllowed === false, `${shotId} live-submit drift must keep live submit false`);
    assert(liveDriftExecutor.payload.providerCalled === false, `${shotId} live-submit drift must not call provider`);
    assert(liveDriftExecutor.payload.blockers.length > 0, `${shotId} live-submit drift should include blockers`);

    const execute = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-mock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shotId,
        selectedShotIds: [shotId],
        imageCount: 1,
        executorMode: "mock_executor",
      }),
    });
    assert(execute.response.status === 200, `${shotId} mock executor should return 200`);
    assert(execute.payload.status === "mock_output_returned_needs_review", `${shotId} mock executor status drifted`);
    assert(execute.payload.actualImage2Triggered === false, `${shotId} mock executor must not trigger Image2`);
    assert(execute.payload.providerCalled === false, `${shotId} mock executor must not call provider`);
    assert(execute.payload.executorEvidence?.consumedPersistedHandoff === true, `${shotId} mock executor should consume handoff`);
    assert(execute.payload.watcherProjection?.outputExists === true, `${shotId} mock executor output should exist`);
    assert(execute.payload.watcherProjection?.providerObservationPresent === true, `${shotId} mock executor provider observation should exist`);
    assert(execute.payload.watcherProjection?.semanticQaPresent === true, `${shotId} mock executor semantic QA should exist`);
    assert(execute.payload.previewProjection?.status === "needs_review", `${shotId} mock executor preview should need review`);
    assert(existsSync(execute.payload.expectedOutputPath), `${shotId} mock output file missing`);
    assert(existsSync(execute.payload.providerObservationPath), `${shotId} mock provider observation missing`);
    assert(existsSync(execute.payload.semanticQaPath), `${shotId} mock semantic QA missing`);

    const reloaded = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(reloaded.response.status === 200, `${shotId} persisted status should return 200`);
    assert(reloaded.payload.status === "needs_review", `${shotId} persisted status should return mock needs_review`);
    assert(reloaded.payload.transportPlan?.mode === "codex_app_server", `${shotId} persisted status should preserve app-server transport mode`);
    assert(reloaded.payload.handoffPacket?.transportPlan?.mode === "codex_app_server", `${shotId} persisted handoff should preserve app-server transport mode`);
    assert(reloaded.payload.previewProjection?.status === "needs_review", `${shotId} persisted preview should show needs_review`);
    assertRuntimeLocks(reloaded.payload, `${shotId} persisted status`);

    const receipt = readJson(prepare.payload.statePaths.receiptStatePath);
    const handoff = readJson(confirm.payload.statePaths.handoffStatePath);
    assert(receipt.policy.providerSubmitAllowed === 0, `${shotId} persisted receipt must allow zero provider submits`);
    assert(handoff.transportPlan.actualExecutionAllowed === false, `${shotId} persisted handoff transport must not execute`);
    shotResults.push({
      shotId,
      status: reloaded.payload.status,
      userLabel: reloaded.payload.userLabel,
      expectedOutputPath: reloaded.payload.expectedOutputPath,
      receiptStatePath: reloaded.payload.statePaths.receiptStatePath,
      handoffStatePath: reloaded.payload.statePaths.handoffStatePath,
      transportMode: reloaded.payload.handoffPacket.transportPlan.mode,
      transportTarget: reloaded.payload.handoffPacket.transportPlan.target,
      automaticSubmitAllowed: reloaded.payload.handoffPacket.appServerContract.automaticSubmitAllowed,
      actualExecutionAllowed: reloaded.payload.handoffPacket.appServerContract.actualExecutionAllowed,
      previewStatus: reloaded.payload.previewProjection.status,
      executorStatus: execute.payload.status,
      outputExists: existsSync(reloaded.payload.expectedOutputPath),
      providerObservationExists: existsSync(reloaded.payload.providerObservationPath),
      semanticQaExists: existsSync(reloaded.payload.semanticQaPath),
      manifestPath: execute.payload.manifestPath,
      manifestExists: existsSync(execute.payload.manifestPath),
      watcherProjection: {
        watcherStarted: reloaded.payload.watcherProjection.watcherStarted,
        daemonStarted: reloaded.payload.watcherProjection.daemonStarted,
        reportProjectionOnly: reloaded.payload.watcherProjection.reportProjectionOnly,
        outputExists: reloaded.payload.watcherProjection.outputExists,
        providerObservationPresent: reloaded.payload.watcherProjection.providerObservationPresent,
        semanticQaPresent: reloaded.payload.watcherProjection.semanticQaPresent,
      },
    });
  }
  assert(statSync(projectVibePath).mtimeMs === projectVibeBefore, "readiness test must not mutate project.vibe");
  assert(shotResults.every((item) => item.outputExists === true), "mock executor should create sandboxed output files");
  assert(shotResults.every((item) => item.providerObservationExists === true), "mock executor should create sandboxed provider observation sidecars");
  assert(shotResults.every((item) => item.semanticQaExists === true), "mock executor should create sandboxed semantic QA sidecars");

  const report = {
    schemaVersion: "current_project_real_image2_readiness_report_v1",
    generatedAt: new Date().toISOString(),
    runId,
    fixtureRoot,
    reportPath,
    latestReportPath,
    status: "mock_executor_output_returned_needs_review",
    result: "mock_executor_consumed_handoff_and_returned_sandbox_outputs",
    canProceedToRealImage2SmallBatch: false,
    safeToCallProviderNow: false,
    actualImage2Triggered: false,
    providerCalled: false,
    liveSubmitAllowed: false,
    appServerTransportReady: true,
    mockExecutorReady: true,
    automaticSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    restrictions: {
      maxImages: 2,
      startFrameOnly: true,
      endFrameContractOnly: true,
      endFrameRealGenerationAllowed: false,
      seedanceAllowed: false,
      jimengAllowed: false,
      videoAllowed: false,
      fastAllowed: false,
      vipAllowed: false,
    },
    coverage: {
      currentProjectBinding: select.payload.status === "bound",
      currentProjectRuntimeProjection: status.payload.ok === true,
      oneShotPrepareConfirmPersistence: shotResults.every((shot) => shot.status === "needs_review"),
      preTriggerGate: shotResults.every((shot) => shot.actualExecutionAllowed === false),
      image2BatchRunCheck: batchRunCheck.payload.ledgerProjection?.summary?.queued === 2,
      mockExecutorOutputReturn: shotResults.every((shot) => shot.executorStatus === "mock_output_returned_needs_review"),
      outputWatcherReportPreviewReturn: "mock_executor_sandbox_output_needs_review",
    },
    readinessBlockers: remainingReadinessBlockers(),
    missingAdapterOrExecutor: "external real Image2 provider call adapter remains intentionally blocked; mock executor adapter is present",
    shots: shotResults,
    outputs: {
      realImage2OutputPaths: [],
      mockOutputPaths: shotResults.map((shot) => shot.expectedOutputPath),
      readinessReportPath: reportPath,
      latestReadinessReportPath: latestReportPath,
      receiptStatePaths: shotResults.map((shot) => shot.receiptStatePath),
      handoffStatePaths: shotResults.map((shot) => shot.handoffStatePath),
      manifestPaths: shotResults.map((shot) => shot.manifestPath),
    },
    batchRunCheck: {
      status: batchRunCheck.payload.status,
      plannedCount: batchRunCheck.payload.summary?.plannedCount,
      queuedCount: batchRunCheck.payload.ledgerProjection?.summary?.queued,
      providerCalled: batchRunCheck.payload.providerCalled,
      command: batchRunCheck.payload.command,
    },
    nextGate: "Connect an explicit real Image2 provider executor behind action-time confirmation and keep the mock executor as the preflight contract.",
  };
  writeJson(reportPath, report);
  writeJson(latestReportPath, report);
  console.log(`Current project real Image2 readiness test passed: ${shotResults.length} app-server handoffs consumed by mock executor, no real provider calls. Report: ${reportPath}`);
} finally {
  child.kill("SIGTERM");
  rmSync(tempRoot, { recursive: true, force: true });
}
