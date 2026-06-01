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
          // Wait for a complete line.
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

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function shotIdFor(index) {
  return `P${String(index).padStart(2, "0")}`;
}

function assertHardLocks(payload, label) {
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must stay blocked`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.workerSpawnForbidden === true, `${label} worker spawn must stay blocked`);
  if (payload.transportPlan) {
    assert(payload.transportPlan.actualExecutionAllowed === false, `${label} transport execution must stay locked`);
    assert(payload.transportPlan.providerCalled === false, `${label} transport must not call provider`);
    assert(payload.transportPlan.liveSubmitAllowed === false, `${label} transport live submit must stay blocked`);
  }
}

function assertInsideStateSandbox(statePath, fixtureRoot, shotId, label) {
  const normalized = statePath.replace(/\\/g, "/");
  const expectedPrefix = `${fixtureRoot}/real-trigger-one-shot/${shotId}/state/`;
  assert(normalized.startsWith(expectedPrefix), `${label} state path escaped shot sandbox: ${statePath}`);
  assert(!normalized.includes("../"), `${label} state path must not contain traversal`);
}

function makeFixture(fixtureRoot) {
  const shotCount = 24;
  const shotIds = Array.from({ length: shotCount }, (_, index) => shotIdFor(index + 1));
  const sceneIds = ["scene_archive", "scene_tunnel", "scene_rooftop"];
  const roleIds = ["char_mika", "char_ren", "char_io"];
  const shots = shotIds.map((shotId, index) => {
    const sceneId = sceneIds[index % sceneIds.length];
    return {
      id: shotId,
      sceneId,
      sectionId: sceneId,
      roleIds: [roleIds[index % roleIds.length], roleIds[(index + 1) % roleIds.length]],
      action: `Software pressure shot ${shotId}: locked characters move through ${sceneId} without real provider calls.`,
    };
  });
  shots.push({
    id: "P99",
    sceneId: "scene_missing",
    sectionId: "scene_missing",
    roleIds: ["char_missing"],
    action: "Negative fixture shot with missing locked references.",
  });

  const runManifest = {
    schemaVersion: "current_project_one_shot_pressure_manifest_v1",
    projectId: "current_project_one_shot_pressure",
    runId: "current_project_one_shot_pressure_run",
    status: "software_pressure_ready",
    shotPlans: shotIds.map((shotId, index) => ({
      shotId,
      order: index + 1,
      expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
      providerObservationPath: `${fixtureRoot}/provider_observations/${shotId}_start_provider_observation.json`,
      semanticQaPath: `${fixtureRoot}/semantic_qa/${shotId}_start_semantic_qa.json`,
      status: "queued_without_provider",
    })),
  };

  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_one_shot_pressure_project_vibe_v1",
    projectId: "current_project_one_shot_pressure",
    runId: "current_project_one_shot_pressure_run",
    title: "One-shot Pressure 24",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_one_shot_pressure_story_flow_v1",
    sections: sceneIds.map((sceneId) => ({
      id: sceneId,
      label: sceneId,
      shotIds: shots.filter((shot) => shot.sectionId === sceneId).map((shot) => shot.id),
    })),
    shots,
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_one_shot_pressure_visual_memory_v1",
    roles: [
      {
        id: "char_mika",
        displayName: "Mika",
        status: "locked",
        usedByShotIds: shotIds,
        description: "Locked 2D anime heroine reference.",
      },
      {
        id: "char_ren",
        displayName: "Ren",
        status: "locked",
        usedByShotIds: shotIds,
        description: "Locked 2D anime technician reference.",
      },
      {
        id: "char_io",
        displayName: "Io",
        status: "locked",
        usedByShotIds: shotIds,
        description: "Locked 2D anime younger sibling reference.",
      },
    ],
    scenes: sceneIds.map((sceneId) => ({
      id: sceneId,
      displayName: sceneId,
      status: "locked",
      spatialAnchors: [`${sceneId} master layout stays stable`, "camera axis remains consistent"],
    })),
    style: {
      id: "style_quiet_anime",
      displayName: "Quiet anime pressure style",
      status: "locked",
      positive: "clean 2D anime film frame, low texture, stable 16:9 composition",
      negative: "no photorealism, no 3D render, no heavy texture",
    },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_one_shot_pressure_source_index_v1",
    refs: [
      `${fixtureRoot}/project/project.vibe`,
      `${fixtureRoot}/project/story_flow.json`,
      `${fixtureRoot}/project/visual_memory.json`,
    ],
  });
  writeJson(`${fixtureRoot}/run_manifest.json`, runManifest);
  return { shotIds };
}

const fixtureRoot = "real-test-sandbox/current-project-one-shot-pressure-24";
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-one-shot-pressure-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const projectVibePath = `${fixtureRoot}/project/project.vibe`;

rmSync(fixtureRoot, { recursive: true, force: true });
const { shotIds } = makeFixture(fixtureRoot);

const child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

try {
  const { baseUrl } = await waitForServer(child);
  const projectVibeBefore = statSync(projectVibePath).mtimeMs;
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectRoot: fixtureRoot,
      projectId: "current_project_one_shot_pressure",
      displayName: "One-shot Pressure 24",
    }),
  });
  assert(select.response.status === 200, "pressure fixture should bind as current project");
  assertHardLocks(select.payload, "select pressure project");

  const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(status.response.status === 200, "pressure current project status should load");
  assert(status.payload.workbenchFacts?.storyFlow?.shotCount === 25, "pressure fixture should expose 24 positive shots plus one negative shot");
  assert(status.payload.workbenchFacts?.visualMemory?.assetCount >= 7, "pressure fixture should expose locked refs");
  assertHardLocks(status.payload, "pressure current project status");

  for (const [index, shotId] of shotIds.entries()) {
    const transportMode = index % 3 === 0 ? "manual" : index % 3 === 1 ? "agent_app_server" : "agent_cli";
    const initial = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(initial.response.status === 200, `${shotId} initial status should return 200`);
    assert(initial.payload.status === "ready_to_prepare", `${shotId} should start ready_to_prepare`);
    assertHardLocks(initial.payload, `${shotId} initial status`);

    const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedShotId: shotId, selectedShotIds: [shotId], imageCount: 1, transportMode }),
    });
    assert(prepare.response.status === 200, `${shotId} prepare should return 200`);
    assert(prepare.payload.status === "prepared", `${shotId} prepare should persist prepared state`);
    assert(prepare.payload.transportPlan?.mode === transportMode, `${shotId} transport mode should be preserved`);
    assert(prepare.payload.persistedState?.receiptPresent === true, `${shotId} receipt should persist`);
    assertInsideStateSandbox(prepare.payload.statePaths.receiptStatePath, fixtureRoot, shotId, `${shotId} receipt`);
    assert(existsSync(prepare.payload.statePaths.receiptStatePath), `${shotId} receipt file should exist`);
    assertHardLocks(prepare.payload, `${shotId} prepare`);

    const preparedStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(preparedStatus.response.status === 200, `${shotId} prepared status should return 200`);
    assert(preparedStatus.payload.status === "prepared", `${shotId} status should reload persisted prepared state`);
    assert(preparedStatus.payload.receipt?.receiptId === prepare.payload.receipt.receiptId, `${shotId} persisted receipt id mismatch`);
    assertHardLocks(preparedStatus.payload, `${shotId} prepared status`);

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
    assert(confirm.payload.status === "handoff_prepared", `${shotId} confirm should persist handoff state`);
    assert(confirm.payload.persistedState?.handoffPresent === true, `${shotId} handoff should persist`);
    assertInsideStateSandbox(confirm.payload.statePaths.handoffStatePath, fixtureRoot, shotId, `${shotId} handoff`);
    assert(existsSync(confirm.payload.statePaths.handoffStatePath), `${shotId} handoff file should exist`);
    assertHardLocks(confirm.payload, `${shotId} confirm`);

    const handoffStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(handoffStatus.response.status === 200, `${shotId} handoff status should return 200`);
    assert(handoffStatus.payload.status === "handoff_prepared", `${shotId} status should reload persisted handoff state`);
    assert(handoffStatus.payload.handoffPacket?.receiptId === confirm.payload.handoffPacket.receiptId, `${shotId} persisted handoff receipt mismatch`);
    assertHardLocks(handoffStatus.payload, `${shotId} handoff status`);
  }

  const multiShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "P01", selectedShotIds: ["P01", "P02"], imageCount: 1 }),
  });
  assert(multiShot.response.status === 409, "multi-shot one-shot prepare should fail closed");
  assertHardLocks(multiShot.payload, "multi-shot blocker");

  const unsafePath = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "P01", selectedShotIds: ["P01"], imageCount: 1, expectedOutputPath: "../outside.png" }),
  });
  assert(unsafePath.response.status === 409, "unsafe output path should fail closed");
  assertHardLocks(unsafePath.payload, "unsafe path blocker");

  const missingRefs = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "P99", selectedShotIds: ["P99"], imageCount: 1 }),
  });
  assert(missingRefs.response.status === 409, "missing locked references should fail closed");
  assert(missingRefs.payload.blockers.some((blocker) => /locked character/i.test(blocker)), "missing character blocker should be present");
  assert(missingRefs.payload.blockers.some((blocker) => /locked scene/i.test(blocker)), "missing scene blocker should be present");
  assertHardLocks(missingRefs.payload, "missing refs blocker");

  const invalidTransport = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "P01", selectedShotIds: ["P01"], imageCount: 1, transportMode: "fast_provider_escape" }),
  });
  assert(invalidTransport.response.status === 200, "invalid transport should downgrade rather than execute");
  assert(invalidTransport.payload.transportPlan?.mode === "manual", "invalid transport should downgrade to manual");
  assert(invalidTransport.payload.transportPlan?.transportModeAllowed === false, "invalid transport should be recorded as not allowlisted");
  assertHardLocks(invalidTransport.payload, "invalid transport downgrade");

  assert(statSync(projectVibePath).mtimeMs === projectVibeBefore, "pressure run must not mutate project.vibe");
  for (const shotId of shotIds) {
    const stateDir = `${fixtureRoot}/real-trigger-one-shot/${shotId}/state`;
    const receipt = readJson(`${stateDir}/prepare-receipt.json`);
    const handoff = readJson(`${stateDir}/handoff-packet.json`);
    assert(receipt.policy?.providerCalled === false, `${shotId} persisted receipt providerCalled must be false`);
    assert(receipt.policy?.liveSubmitAllowed === false, `${shotId} persisted receipt liveSubmitAllowed must be false`);
    assert(handoff.providerCalled === false, `${shotId} persisted handoff providerCalled must be false`);
    assert(handoff.liveSubmitAllowed === false, `${shotId} persisted handoff liveSubmitAllowed must be false`);
  }

  console.log(`Current project one-shot pressure test passed: ${shotIds.length} shots, persisted receipt/handoff, no provider calls.`);
} finally {
  child.kill("SIGTERM");
  rmSync(fixtureRoot, { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
}
