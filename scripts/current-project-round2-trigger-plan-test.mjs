import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

function writeText(filePath, text) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`)), 15000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
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
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assertNoProvider(payload, label) {
  assert(payload.providerCalled === false, `${label} must not set providerCalled`);
  assert(payload.actualImage2Triggered === false, `${label} must not set actualImage2Triggered`);
  assert(payload.providerCallAllowed === false || payload.providerCallAllowed === undefined, `${label} must not allow provider calls`);
  assert(payload.actualExecutionAllowed === false || payload.actualExecutionAllowed === undefined, `${label} must not allow actual execution`);
  assert(payload.liveSubmitAllowed === false, `${label} must keep live submit blocked`);
  assert(payload.projectVibeWritten === false, `${label} must not mutate project.vibe`);
  assert(payload.workerSpawnForbidden === true, `${label} must keep worker spawn forbidden`);
  if (payload.submitPolicy) {
    assert(payload.submitPolicy.providerCallAllowed === false, `${label} submitPolicy.providerCallAllowed must stay false`);
    assert(payload.submitPolicy.providerSubmitAllowed === 0, `${label} submitPolicy.providerSubmitAllowed must stay zero`);
    assert(payload.submitPolicy.liveSubmitAllowed === false, `${label} submitPolicy.liveSubmitAllowed must stay false`);
  }
  if (payload.transportPlan) {
    assert(payload.transportPlan.providerCallAllowed === false, `${label} transportPlan.providerCallAllowed must stay false`);
    assert(payload.transportPlan.actualExecutionAllowed === false, `${label} transportPlan.actualExecutionAllowed must stay false`);
    assert(payload.transportPlan.actionTimeConfirmationRequired === true, `${label} must require action-time confirmation`);
  }
}

const generatedAt = new Date().toISOString();
const runId = `run-${generatedAt.replace(/[:.]/g, "-")}`;
const fixtureRoot = `real-test-sandbox/current-project-round2-trigger-plan/runs/${runId}`;
const projectId = "current_project_round2_trigger_plan";
const shots = Array.from({ length: 6 }, (_, index) => {
  const shotId = `R2T${String(index + 1).padStart(2, "0")}`;
  const sceneId = index % 2 === 0 ? "scene_rain_station" : "scene_old_library";
  return {
    id: shotId,
    title: `Round 2 trigger plan shot ${shotId}`,
    sceneId,
    roleIds: index % 3 === 0 ? ["char_mika"] : ["char_mika", "char_ren"],
    prompt: `16:9 quiet Japanese anime start frame for ${shotId}. Keep Mika's navy coat and red scarf, Ren's charcoal hoodie when present, ${sceneId.replace(/_/g, " ")} locked layout, restrained teal and amber light, clean 2D linework.`,
  };
});

rmSync(fixtureRoot, { recursive: true, force: true });
writeJson(`${fixtureRoot}/project/project.vibe`, {
  schemaVersion: "current_project_round2_trigger_plan_project_vibe_v1",
  projectId,
  runId,
  title: "Round 2 Trigger Plan Fixture",
  constraints: {
    startFrameOnly: true,
    imageCount: shots.length,
    seedanceAllowed: false,
    jimengAllowed: false,
    fastAllowed: false,
    vipAllowed: false,
    videoAllowed: false,
    mockEvidenceCanPromoteRealResult: false,
  },
});
writeJson(`${fixtureRoot}/project/story_flow.json`, {
  schemaVersion: "current_project_round2_trigger_plan_story_flow_v1",
  sections: [{ id: "act_round2", label: "Round 2", shotIds: shots.map((shot) => shot.id) }],
  shots: shots.map((shot, index) => ({
    id: shot.id,
    title: shot.title,
    sectionId: "act_round2",
    sceneId: shot.sceneId,
    roleIds: shot.roleIds,
    order: index + 1,
    generationScope: {
      startFrameOnly: true,
      endFrame: { contractOnly: true, promptOnlyCanPass: false, realGenerationAllowed: false },
    },
  })),
});
writeJson(`${fixtureRoot}/project/visual_memory.json`, {
  schemaVersion: "current_project_round2_trigger_plan_visual_memory_v1",
  roles: [
    { id: "char_mika", displayName: "Mika", status: "locked", path: `${fixtureRoot}/assets/locked/char_mika.md`, usedByShotIds: shots.map((shot) => shot.id), textConstraints: ["short black bob", "navy school coat", "red scarf"] },
    { id: "char_ren", displayName: "Ren", status: "locked", path: `${fixtureRoot}/assets/locked/char_ren.md`, usedByShotIds: shots.filter((shot) => shot.roleIds.includes("char_ren")).map((shot) => shot.id), textConstraints: ["ash-brown hair", "charcoal hoodie"] },
  ],
  scenes: [
    { id: "scene_rain_station", displayName: "Rain Station", status: "locked", path: `${fixtureRoot}/assets/locked/scene_rain_station.md`, usedByShotIds: shots.filter((shot) => shot.sceneId === "scene_rain_station").map((shot) => shot.id), spatialAnchors: ["station entrance", "wet pavement", "amber ticket machines"] },
    { id: "scene_old_library", displayName: "Old Library", status: "locked", path: `${fixtureRoot}/assets/locked/scene_old_library.md`, usedByShotIds: shots.filter((shot) => shot.sceneId === "scene_old_library").map((shot) => shot.id), spatialAnchors: ["wood shelves", "card catalog", "warm desk lamps"] },
  ],
  style: { id: "style_quiet_anime", displayName: "Quiet Anime", status: "locked", path: `${fixtureRoot}/assets/locked/style_quiet_anime.md`, positive: "clean 2D anime, quiet restrained color", negative: "no photorealism, no 3D, no video" },
});
writeJson(`${fixtureRoot}/project/source_index.json`, {
  schemaVersion: "current_project_round2_trigger_plan_source_index_v1",
  refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`, `${fixtureRoot}/run_manifest.json`],
});
writeText(`${fixtureRoot}/assets/locked/char_mika.md`, "Locked Mika text reference.\n");
writeText(`${fixtureRoot}/assets/locked/char_ren.md`, "Locked Ren text reference.\n");
writeText(`${fixtureRoot}/assets/locked/scene_rain_station.md`, "Locked rain station text reference.\n");
writeText(`${fixtureRoot}/assets/locked/scene_old_library.md`, "Locked old library text reference.\n");
writeText(`${fixtureRoot}/assets/locked/style_quiet_anime.md`, "Locked quiet anime style reference.\n");
for (const shot of shots) {
  writeText(`${fixtureRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`, `# ${shot.id}\n\n${shot.prompt}\n`);
}
writeJson(`${fixtureRoot}/run_manifest.json`, {
  schemaVersion: "current_project_round2_trigger_plan_manifest_v1",
  projectId,
  runId,
  providerPolicy: {
    allowedProvider: "openai-image2-api",
    forbiddenProviders: ["seedance", "jimeng", "fast", "vip", "video"],
    providerCalled: false,
    actualImage2Triggered: false,
  },
  shotPlans: shots.map((shot, index) => ({
    shotId: shot.id,
    order: index + 1,
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    frameRole: "start_frame",
    expectedOutputPath: `${fixtureRoot}/outputs/shots/${shot.id}/start.png`,
    promptPath: `${fixtureRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`,
    providerObservationPath: `${fixtureRoot}/real-trigger-one-shot/${shot.id}/provider_observations/image2-start-provider-observation.json`,
    semanticQaPath: `${fixtureRoot}/real-trigger-one-shot/${shot.id}/semantic_qa/image2-start-semantic-qa.json`,
    status: "prepared_for_trigger_plan_not_generated",
  })),
});

const projectVibePath = `${fixtureRoot}/project/project.vibe`;
const projectVibeHashBefore = sha256File(projectVibePath);
const projectVibeMtimeBefore = statSync(projectVibePath).mtimeMs;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-round2-trigger-plan-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

try {
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId, displayName: "Round 2 Trigger Plan Fixture" }),
  });
  assert(select.response.status === 200, "Round 2 trigger fixture should bind");

  for (const shot of shots) {
    const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedShotId: shot.id, selectedShotIds: [shot.id], imageCount: 1, transportMode: "codex_app_server" }),
    });
    assert(prepare.response.status === 200 && prepare.payload.status === "prepared", `${shot.id} prepare should pass`);
    assertNoProvider(prepare.payload, `${shot.id} prepare`);

    const confirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shot.id,
        selectedShotIds: [shot.id],
        imageCount: 1,
        expectedOutputPath: prepare.payload.expectedOutputPath,
        receipt: prepare.payload.receipt,
      }),
    });
    assert(confirm.response.status === 200 && confirm.payload.status === "handoff_prepared", `${shot.id} confirm should prepare handoff`);
    assertNoProvider(confirm.payload, `${shot.id} confirm`);

    const trigger = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare-trigger`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shot.id,
        selectedShotIds: [shot.id],
        imageCount: 1,
        expectedOutputPath: prepare.payload.expectedOutputPath,
        receiptId: prepare.payload.receipt.receiptId,
        transportMode: "codex_app_server",
      }),
    });
    assert(trigger.response.status === 200 && trigger.payload.status === "trigger_plan_prepared", `${shot.id} trigger-plan should prepare`);
    assert(trigger.payload.selectedShotId === shot.id, `${shot.id} trigger-plan selectedShotId drifted`);
    assert(trigger.payload.receiptId === prepare.payload.receipt.receiptId, `${shot.id} trigger-plan receiptId drifted`);
    assert(trigger.payload.handoffId === `handoff_${prepare.payload.receipt.receiptId}`, `${shot.id} trigger-plan handoffId drifted`);
    assert(trigger.payload.promptPath.endsWith(`${shot.id}_start_frame_prompt.md`), `${shot.id} prompt path missing`);
    assert(trigger.payload.promptText.includes(shot.id), `${shot.id} prompt text missing`);
    assert(trigger.payload.expectedOutputPath === prepare.payload.expectedOutputPath, `${shot.id} expected output drifted`);
    assert(trigger.payload.providerObservationPath === prepare.payload.providerObservationPath, `${shot.id} provider observation drifted`);
    assert(trigger.payload.semanticQaPath === prepare.payload.semanticQaPath, `${shot.id} semantic QA drifted`);
    assert(trigger.payload.forbiddenProviders?.join(",") === "seedance,jimeng,fast,vip,video", `${shot.id} forbidden providers drifted`);
    assert(trigger.payload.actionTimeConfirmationRequired === true, `${shot.id} must require action-time confirmation`);
    assert(trigger.payload.appServerPayloadPreview?.payload?.providerCallAllowed === false, `${shot.id} app-server preview must be non-executable`);
    assert(existsSync(trigger.payload.triggerPlanPath), `${shot.id} trigger manifest should be written`);
    assertNoProvider(trigger.payload, `${shot.id} trigger`);

    const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shot.id)}`);
    assert(status.response.status === 200 && status.payload.status === "trigger_plan_prepared", `${shot.id} status should show trigger-plan prepared`);
    assertNoProvider(status.payload, `${shot.id} status`);

    const dryReturn = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: shot.id,
        selectedShotIds: [shot.id],
        imageCount: 1,
        receiptId: prepare.payload.receipt.receiptId,
      }),
    });
    assert(dryReturn.response.status === 409, `${shot.id} execute-return must stay 409 without a real image`);
    assertNoProvider(dryReturn.payload, `${shot.id} dry return`);
  }

  assert(sha256File(projectVibePath) === projectVibeHashBefore, "project.vibe hash must not change");
  assert(statSync(projectVibePath).mtimeMs === projectVibeMtimeBefore, "project.vibe mtime must not change");
  console.log(`Current project Round 2 trigger-plan test passed: ${fixtureRoot}`);
} finally {
  child.kill("SIGTERM");
  rmSync(tempRoot, { recursive: true, force: true });
}
