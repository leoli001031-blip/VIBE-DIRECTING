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

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
  assert(payload.providerCalled === false, `${label}.providerCalled must stay false`);
  assert(payload.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must stay false`);
  assert(payload.projectVibeWritten === false, `${label}.projectVibeWritten must stay false`);
  assert(payload.workerSpawnForbidden === true, `${label}.workerSpawnForbidden must stay true`);
  if (payload.transportPlan) {
    assert(payload.transportPlan.providerCalled === false, `${label}.transportPlan.providerCalled must stay false`);
    assert(payload.transportPlan.liveSubmitAllowed === false, `${label}.transportPlan.liveSubmitAllowed must stay false`);
    assert(payload.transportPlan.projectVibeWritten === false, `${label}.transportPlan.projectVibeWritten must stay false`);
    assert(payload.transportPlan.workerSpawnForbidden === true, `${label}.transportPlan.workerSpawnForbidden must stay true`);
    assert(payload.transportPlan.actualExecutionAllowed === false, `${label}.transportPlan.actualExecutionAllowed must stay false`);
  }
  if (payload.receipt?.policy) {
    assert(payload.receipt.policy.providerCalled === false, `${label}.receipt.policy.providerCalled must stay false`);
    assert(payload.receipt.policy.liveSubmitAllowed === false, `${label}.receipt.policy.liveSubmitAllowed must stay false`);
    assert(payload.receipt.policy.projectVibeWritten === false, `${label}.receipt.policy.projectVibeWritten must stay false`);
    assert(payload.receipt.policy.workerSpawnForbidden === true, `${label}.receipt.policy.workerSpawnForbidden must stay true`);
  }
  if (payload.handoffPacket) {
    assert(payload.handoffPacket.providerCalled === false, `${label}.handoffPacket.providerCalled must stay false`);
    assert(payload.handoffPacket.liveSubmitAllowed === false, `${label}.handoffPacket.liveSubmitAllowed must stay false`);
    assert(payload.handoffPacket.projectVibeWritten === false, `${label}.handoffPacket.projectVibeWritten must stay false`);
    assert(payload.handoffPacket.workerSpawnForbidden === true, `${label}.handoffPacket.workerSpawnForbidden must stay true`);
    assert(payload.handoffPacket.transportPlan?.actualExecutionAllowed === false, `${label}.handoffPacket.transportPlan.actualExecutionAllowed must stay false`);
  }
  if (payload.command) {
    assert(payload.command.providerCalled === false, `${label}.command.providerCalled must stay false`);
    assert(payload.command.liveSubmitAllowed === false, `${label}.command.liveSubmitAllowed must stay false`);
    assert(payload.command.projectVibeWritten === false, `${label}.command.projectVibeWritten must stay false`);
    assert(payload.command.workerSpawnForbidden === true, `${label}.command.workerSpawnForbidden must stay true`);
  }
  if (payload.ledgerProjection?.summary) {
    assert(payload.ledgerProjection.summary.providerCalled === false, `${label}.ledgerProjection.summary.providerCalled must stay false`);
    assert(payload.ledgerProjection.summary.liveSubmitAllowed === false, `${label}.ledgerProjection.summary.liveSubmitAllowed must stay false`);
    assert(payload.ledgerProjection.summary.workerSpawnForbidden === true, `${label}.ledgerProjection.summary.workerSpawnForbidden must stay true`);
  }
}

function assertStateSandbox(repoRoot, payload, fixtureRoot, shotId, label) {
  const expectedStateRoot = `${fixtureRoot}/real-trigger-one-shot/${shotId}/state`;
  assert(payload.statePaths?.stateRoot === expectedStateRoot, `${label} state root should stay in shot sandbox`);
  assert(payload.statePaths?.receiptStatePath === `${expectedStateRoot}/prepare-receipt.json`, `${label} receipt state path drifted`);
  assert(payload.statePaths?.handoffStatePath === `${expectedStateRoot}/handoff-packet.json`, `${label} handoff state path drifted`);
  assert(payload.expectedOutputPath === `${fixtureRoot}/real-trigger-one-shot/${shotId}/image2-start.png`, `${label} expected output path drifted`);
  assert(payload.providerObservationPath.startsWith(`${fixtureRoot}/real-trigger-one-shot/${shotId}/provider_observations/`), `${label} provider sidecar path escaped sandbox`);
  assert(payload.semanticQaPath.startsWith(`${fixtureRoot}/real-trigger-one-shot/${shotId}/semantic_qa/`), `${label} semantic QA path escaped sandbox`);
  const receiptPath = path.resolve(repoRoot, payload.statePaths.receiptStatePath);
  const handoffPath = path.resolve(repoRoot, payload.statePaths.handoffStatePath);
  if (payload.persistedState?.receiptPresent) {
    assert(existsSync(receiptPath), `${label} receipt file should exist`);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    assert(receipt.selectedShotId === shotId, `${label} receipt should be scoped to ${shotId}`);
    assert(receipt.sandbox?.receiptStatePath === payload.statePaths.receiptStatePath, `${label} receipt should record its state path`);
  }
  if (payload.persistedState?.handoffPresent) {
    assert(existsSync(handoffPath), `${label} handoff file should exist`);
    const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
    assert(handoff.selectedShotId === shotId, `${label} handoff should be scoped to ${shotId}`);
    assert(handoff.receiptStatePath === payload.statePaths.receiptStatePath, `${label} handoff should bind to the receipt state path`);
    assert(handoff.handoffStatePath === payload.statePaths.handoffStatePath, `${label} handoff should record its state path`);
    assert(handoff.transportPlan?.actualExecutionAllowed === false, `${label} handoff transport must stay non-executable`);
  }
}

function buildFixture(repoRoot, fixtureRoot, shotCount) {
  const rootPath = path.join(repoRoot, fixtureRoot);
  rmSync(rootPath, { recursive: true, force: true });
  mkdirSync(path.join(rootPath, "project"), { recursive: true });

  const shots = Array.from({ length: shotCount }, (_, index) => {
    const number = index + 1;
    const id = `S${String(number).padStart(2, "0")}`;
    const sceneId = `scene_${String(((number - 1) % 6) + 1).padStart(2, "0")}`;
    const roleId = `char_${String(((number - 1) % 4) + 1).padStart(2, "0")}`;
    return {
      id,
      title: `Pressure shot ${number}`,
      actId: number <= 12 ? "act_1" : "act_2",
      sectionId: sceneId,
      sceneId,
      roleIds: [roleId],
      action: `Software pressure fixture shot ${number} keeps ${roleId} in ${sceneId}.`,
    };
  });
  const sectionMap = new Map();
  for (const shot of shots) {
    if (!sectionMap.has(shot.sceneId)) {
      sectionMap.set(shot.sceneId, {
        id: shot.sceneId,
        label: `Scene ${shot.sceneId.slice(-2)}`,
        shotIds: [],
      });
    }
    sectionMap.get(shot.sceneId).shotIds.push(shot.id);
  }

  const roles = Array.from({ length: 4 }, (_, index) => {
    const id = `char_${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      displayName: `Locked Character ${index + 1}`,
      status: "locked",
      path: `${fixtureRoot}/assets/locked/${id}.png`,
      textConstraints: [`locked identity ${index + 1}`],
      usedByShotIds: shots.filter((shot) => shot.roleIds.includes(id)).map((shot) => shot.id),
    };
  });
  const scenes = Array.from({ length: 6 }, (_, index) => {
    const id = `scene_${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      displayName: `Locked Scene ${index + 1}`,
      status: "locked",
      path: `${fixtureRoot}/assets/locked/${id}.png`,
      textConstraints: [`locked scene geometry ${index + 1}`],
      usedByShotIds: shots.filter((shot) => shot.sceneId === id).map((shot) => shot.id),
    };
  });
  const shotPlans = shots.map((shot, index) => ({
    shotId: shot.id,
    taskRunId: `software_pressure_${shot.id.toLowerCase()}_image2`,
    packetId: `software_pressure_packet_${shot.id.toLowerCase()}`,
    envelopeId: `software_pressure_envelope_${shot.id.toLowerCase()}`,
    expectedOutputPath: `${fixtureRoot}/outputs/shots/${shot.id}/start.png`,
    providerObservationPath: `${fixtureRoot}/provider_observations/${shot.id}_start_provider_observation.json`,
    semanticQaPath: `${fixtureRoot}/semantic_qa/${shot.id}_start_semantic_qa.json`,
    promptPath: `${fixtureRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`,
    referencePaths: [
      `${fixtureRoot}/project/story_flow.json`,
      `${fixtureRoot}/project/visual_memory.json`,
    ],
    order: index + 1,
  }));

  writeJson(path.join(rootPath, "project", "project.vibe"), {
    schemaVersion: "project_vibe_software_pressure_test_v1",
    projectId: "software_pressure_current_project",
    runId: "software_pressure_current_project_run",
    title: "Software Pressure Current Project",
    roleIds: roles.map((role) => role.id),
    sceneIds: scenes.map((scene) => scene.id),
    styleId: "style_locked_pressure",
  });
  writeJson(path.join(rootPath, "project", "story_flow.json"), {
    schemaVersion: "story_flow_software_pressure_test_v1",
    sections: Array.from(sectionMap.values()),
    shots,
  });
  writeJson(path.join(rootPath, "project", "visual_memory.json"), {
    schemaVersion: "visual_memory_software_pressure_test_v1",
    roles,
    scenes,
    style: {
      id: "style_locked_pressure",
      displayName: "Locked Pressure Style",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/style_locked_pressure.png`,
      textConstraints: ["locked clean production style"],
    },
  });
  writeJson(path.join(rootPath, "project", "source_index.json"), {
    schemaVersion: "source_index_software_pressure_test_v1",
    sourceIndexHash: "sha256-software-pressure-source-index",
    refs: ["project.vibe", "story_flow.json", "visual_memory.json", "run_manifest.json"],
  });
  writeJson(path.join(rootPath, "run_manifest.json"), {
    schemaVersion: "run_manifest_software_pressure_test_v1",
    projectId: "software_pressure_current_project",
    runId: "software_pressure_current_project_run",
    status: "software_pressure_ready",
    shotPlans,
  });

  return { rootPath, shots };
}

function buildMissingRefsFixture(repoRoot, fixtureRoot) {
  const rootPath = path.join(repoRoot, fixtureRoot);
  rmSync(rootPath, { recursive: true, force: true });
  mkdirSync(path.join(rootPath, "project"), { recursive: true });
  writeJson(path.join(rootPath, "project", "project.vibe"), {
    schemaVersion: "project_vibe_software_pressure_missing_refs_test_v1",
    projectId: "software_pressure_missing_refs",
    runId: "software_pressure_missing_refs_run",
  });
  writeJson(path.join(rootPath, "project", "story_flow.json"), {
    shots: [
      {
        id: "S01",
        sceneId: "scene_missing",
        roleIds: ["char_missing"],
        action: "This shot should fail closed because refs are not locked.",
      },
    ],
  });
  writeJson(path.join(rootPath, "project", "visual_memory.json"), {
    roles: [{ id: "char_candidate", displayName: "Candidate", status: "candidate" }],
    scenes: [],
    style: { id: "style_rejected", displayName: "Rejected", status: "rejected" },
  });
  writeJson(path.join(rootPath, "run_manifest.json"), {
    projectId: "software_pressure_missing_refs",
    runId: "software_pressure_missing_refs_run",
    status: "blocked",
    shotPlans: [{ shotId: "S01" }],
  });
}

async function selectProject(baseUrl, projectRoot, projectId, displayName) {
  return fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot, projectId, displayName }),
  });
}

async function postOneShot(baseUrl, action, body) {
  return fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const repoRoot = process.cwd();
const fixtureRoot = "real-test-sandbox/software-layer/current-project-software-pressure";
const missingRefsRoot = "real-test-sandbox/software-layer/current-project-software-pressure-missing-refs";
const shotCount = 24;
const { shots } = buildFixture(repoRoot, fixtureRoot, shotCount);
buildMissingRefsFixture(repoRoot, missingRefsRoot);

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-current-project-pressure-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const projectVibePath = path.join(repoRoot, fixtureRoot, "project", "project.vibe");
const projectVibeBefore = statSync(projectVibePath).mtimeMs;
const child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

try {
  const { baseUrl } = await waitForServer(child);

  const selectPressure = await selectProject(
    baseUrl,
    fixtureRoot,
    "software_pressure_current_project",
    "Software pressure current project",
  );
  assert(selectPressure.response.status === 200, "current project fixture should bind");
  assert(selectPressure.payload.status === "bound", "current project binding status mismatch");
  assertRuntimeLocks(selectPressure.payload, "select pressure project");
  assert(JSON.parse(readFileSync(bindingPath, "utf8")).projectRoot === fixtureRoot, "binding should point at pressure fixture");

  const binding = await fetchJson(`${baseUrl}/api/runtime/projects/current`);
  assert(binding.response.status === 200, "GET current binding should return 200");
  assert(binding.payload.currentProject?.project?.projectId === "software_pressure_current_project", "GET current binding should expose selected project");
  assertRuntimeLocks(binding.payload, "GET current binding");

  const realChain = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(realChain.response.status === 200, "GET real-chain status should return 200");
  assert(realChain.payload.workbenchFacts?.storyFlow?.shotCount === shotCount, "story_flow should expose 20+ shots");
  assert(realChain.payload.workbenchFacts?.visualMemory?.summary?.locked >= 11, "visual_memory should expose locked character/scene/style refs");
  assert(realChain.payload.observations.length === shotCount, "runtime observation projection should include all pressure shots");
  assertRuntimeLocks(realChain.payload, "GET real-chain status");

  const batchPlan = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`);
  assert(batchPlan.response.status === 200, "GET image2 batch plan should return 200");
  assert(batchPlan.payload.observations.length === 10, "batch plan should preserve its UI planning limit");
  assert(batchPlan.payload.summary?.plannedCount === 10, "batch plan planned count should reflect current UI limit");
  assert(batchPlan.payload.items.every((item) => item.shotId), "batch plan items should carry shot ids");
  assertRuntimeLocks(batchPlan.payload, "GET image2 batch plan");

  const batchCheck = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: "ignored/override", projectId: "ignored_override" }),
  });
  assert(batchCheck.response.status === 200, "POST image2 batch run-check should return 200");
  assert(batchCheck.payload.command?.providerCalled === false, "batch run-check must not call provider");
  assert(batchCheck.payload.command?.verifyScriptRan === false, "batch run-check must not spawn verify script");
  assertRuntimeLocks(batchCheck.payload, "POST image2 batch run-check");

  const multiShot = await postOneShot(baseUrl, "prepare", {
    selectedShotId: "S01",
    selectedShotIds: ["S01", "S02"],
    imageCount: 1,
  });
  assert(multiShot.response.status === 409, "multi-shot one-shot prepare should fail closed");
  assert(multiShot.payload.status === "blocked", "multi-shot one-shot should be blocked");
  assert(multiShot.payload.blockers.some((blocker) => /exactly one selected shot/i.test(blocker)), "multi-shot blocker missing");
  assertRuntimeLocks(multiShot.payload, "multi-shot blocked prepare");

  const traversalPath = await postOneShot(baseUrl, "prepare", {
    selectedShotId: "S01",
    selectedShotIds: ["S01"],
    imageCount: 1,
    expectedOutputPath: "../outside.png",
  });
  assert(traversalPath.response.status === 409, "parent traversal output path should fail closed");
  assertRuntimeLocks(traversalPath.payload, "parent traversal blocked prepare");

  const outsideSandboxPath = await postOneShot(baseUrl, "prepare", {
    selectedShotId: "S01",
    selectedShotIds: ["S01"],
    imageCount: 1,
    expectedOutputPath: `${fixtureRoot}/outputs/not-one-shot.png`,
  });
  assert(outsideSandboxPath.response.status === 409, "output outside one-shot sandbox should fail closed");
  assertRuntimeLocks(outsideSandboxPath.payload, "outside sandbox blocked prepare");

  for (const shot of shots) {
    const label = `one-shot ${shot.id}`;
    const ready = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shot.id)}`);
    assert(ready.response.status === 200, `${label} status should return 200 before prepare`);
    assert(ready.payload.status === "ready_to_prepare", `${label} should start ready_to_prepare`);
    assert(ready.payload.receipt?.lockedReferences?.characters?.length >= 1, `${label} should include locked character refs`);
    assert(ready.payload.receipt?.lockedReferences?.scenes?.length >= 1, `${label} should include locked scene refs`);
    assert(ready.payload.receipt?.lockedReferences?.styles?.length >= 1, `${label} should include locked style refs`);
    assertRuntimeLocks(ready.payload, `${label} ready status`);
    assertStateSandbox(repoRoot, ready.payload, fixtureRoot, shot.id, `${label} ready status`);

    const prepared = await postOneShot(baseUrl, "prepare", {
      selectedShotId: shot.id,
      selectedShotIds: [shot.id],
      imageCount: 1,
      transportMode: shot.id === "S03" ? "codex_app_server" : "manual",
    });
    assert(prepared.response.status === 200, `${label} prepare should return 200`);
    assert(prepared.payload.status === "prepared", `${label} prepare should persist prepared`);
    assert(prepared.payload.persistedState?.receiptPresent === true, `${label} prepare should persist receipt`);
    assert(prepared.payload.persistedState?.handoffPresent === false, `${label} prepare should not persist handoff yet`);
    assertRuntimeLocks(prepared.payload, `${label} prepared`);
    assertStateSandbox(repoRoot, prepared.payload, fixtureRoot, shot.id, `${label} prepared`);

    const statusAfterPrepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shot.id)}`);
    assert(statusAfterPrepare.response.status === 200, `${label} status after prepare should return 200`);
    assert(statusAfterPrepare.payload.status === "prepared", `${label} status should survive refresh as prepared`);
    assert(statusAfterPrepare.payload.receipt?.receiptId === prepared.payload.receipt.receiptId, `${label} persisted receipt id should survive refresh`);
    assertRuntimeLocks(statusAfterPrepare.payload, `${label} prepared refresh`);
    assertStateSandbox(repoRoot, statusAfterPrepare.payload, fixtureRoot, shot.id, `${label} prepared refresh`);

    const confirmed = await postOneShot(baseUrl, "confirm", {
      selectedShotId: shot.id,
      selectedShotIds: [shot.id],
      imageCount: 1,
      expectedOutputPath: prepared.payload.receipt.expectedOutputPath,
      receipt: prepared.payload.receipt,
    });
    assert(confirmed.response.status === 200, `${label} confirm should return 200`);
    assert(confirmed.payload.status === "handoff_prepared", `${label} confirm should persist handoff_prepared`);
    assert(confirmed.payload.persistedState?.receiptPresent === true, `${label} confirm should keep receipt present`);
    assert(confirmed.payload.persistedState?.handoffPresent === true, `${label} confirm should persist handoff`);
    assert(confirmed.payload.watcherProjection?.watcherStarted === false, `${label} confirm must not start watcher`);
    assert(confirmed.payload.watcherProjection?.daemonStarted === false, `${label} confirm must not start daemon`);
    assertRuntimeLocks(confirmed.payload, `${label} confirmed`);
    assertStateSandbox(repoRoot, confirmed.payload, fixtureRoot, shot.id, `${label} confirmed`);

    const statusAfterConfirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shot.id)}`);
    assert(statusAfterConfirm.response.status === 200, `${label} status after confirm should return 200`);
    assert(statusAfterConfirm.payload.status === "handoff_prepared", `${label} status should survive refresh as handoff_prepared`);
    assert(statusAfterConfirm.payload.handoffPacket?.receiptId === confirmed.payload.handoffPacket.receiptId, `${label} persisted handoff id should survive refresh`);
    assertRuntimeLocks(statusAfterConfirm.payload, `${label} confirmed refresh`);
    assertStateSandbox(repoRoot, statusAfterConfirm.payload, fixtureRoot, shot.id, `${label} confirmed refresh`);
  }

  assert(statSync(projectVibePath).mtimeMs === projectVibeBefore, "project.vibe mtime must not change during pressure test");

  const selectMissingRefs = await selectProject(baseUrl, missingRefsRoot, "software_pressure_missing_refs", "Missing refs pressure fixture");
  assert(selectMissingRefs.response.status === 200, "missing refs fixture should bind");
  assertRuntimeLocks(selectMissingRefs.payload, "select missing refs project");
  const missingRefsPrepare = await postOneShot(baseUrl, "prepare", {
    selectedShotId: "S01",
    selectedShotIds: ["S01"],
    imageCount: 1,
  });
  assert(missingRefsPrepare.response.status === 409, "missing locked refs should fail closed");
  assert(missingRefsPrepare.payload.status === "blocked", "missing locked refs status should be blocked");
  assert(missingRefsPrepare.payload.blockers.some((blocker) => /locked character/i.test(blocker)), "missing locked character blocker missing");
  assert(missingRefsPrepare.payload.blockers.some((blocker) => /locked scene/i.test(blocker)), "missing locked scene blocker missing");
  assert(missingRefsPrepare.payload.blockers.some((blocker) => /locked style/i.test(blocker)), "missing locked style blocker missing");
  assertRuntimeLocks(missingRefsPrepare.payload, "missing refs blocked prepare");

  console.log(`Current project software pressure test passed. ${shotCount} shots exercised without provider, worker, daemon, or project.vibe writes.`);
} finally {
  child.kill("SIGTERM");
  rmSync(path.join(repoRoot, fixtureRoot), { recursive: true, force: true });
  rmSync(path.join(repoRoot, missingRefsRoot), { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
}
