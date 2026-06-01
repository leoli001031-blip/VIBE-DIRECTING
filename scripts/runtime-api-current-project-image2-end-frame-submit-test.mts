import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

function writePng(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"));
}

function repoPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
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

async function stopServer(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
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

function createFixture(fixtureRoot) {
  const shotId = "B001";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_end_frame_project_vibe_v1",
    projectId: "current_project_image2_end_frame",
    runId: "image2-end-frame",
    title: "Image2 End Frame",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_end_frame_story_flow_v1",
    sections: [{ id: "act_end", label: "End", shotIds: [shotId] }],
    shots: [{
      id: shotId,
      title: "Lantern opens",
      sectionId: "act_end",
      sceneId: "scene_rooftop",
      roleIds: ["char_mika"],
      propIds: ["prop_lantern"],
      startFrame: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
      storyFunction: "Mika opens the lantern and the roof fills with warm light.",
      order: 1,
    }],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_image2_end_frame_visual_memory_v1",
    roles: [{ id: "char_mika", displayName: "Mika", status: "locked", path: `${fixtureRoot}/assets/char_mika.png`, usedByShotIds: [shotId] }],
    scenes: [{ id: "scene_rooftop", displayName: "Rooftop", status: "locked", path: `${fixtureRoot}/assets/scene_rooftop.png`, usedByShotIds: [shotId] }],
    props: [{ id: "prop_lantern", displayName: "Lantern", status: "locked", path: `${fixtureRoot}/assets/prop_lantern.png`, usedByShotIds: [shotId] }],
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_image2_end_frame_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`, `${fixtureRoot}/run_manifest.json`],
  });
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_image2_end_frame_manifest_v1",
    projectId: "current_project_image2_end_frame",
    runId: "image2-end-frame",
    shotPlans: [{
      shotId,
      order: 1,
      providerId: "lanyi-image2",
      providerSlot: "image.generate",
      expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
    }],
  });
  writePng(`${fixtureRoot}/outputs/shots/${shotId}/start.png`);
  writePng(`${fixtureRoot}/assets/char_mika.png`);
  writePng(`${fixtureRoot}/assets/scene_rooftop.png`);
  writePng(`${fixtureRoot}/assets/prop_lantern.png`);
  return shotId;
}

const fixtureRoot = `real-test-sandbox/current-project-image2-end-frame-submit/${Date.now()}`;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-image2-end-frame-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const shotId = createFixture(fixtureRoot);
const projectVibePath = repoPath(`${fixtureRoot}/project/project.vibe`);
const projectVibeMtime = statSync(projectVibePath).mtimeMs;
let child;

try {
  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_IMAGE2_API_KEY: "fake-end-frame-key",
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  });
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId: "current_project_image2_end_frame", displayName: "Image2 End Frame" }),
  });
  assert(select.response.status === 200, "fixture should bind");

  const blocked = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-end-frame/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "lanyi-image2",
      mockProviderResult: true,
    }),
  });
  assert(blocked.response.status === 409, "end frame submit must require explicit confirmation");
  assert(blocked.payload.providerCalled === false, "blocked end frame submit must not call provider");

  const generated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-end-frame/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "lanyi-image2",
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_end_frame_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-end-frame",
        confirmed: true,
      },
    }),
  });
  assert(generated.response.status === 200, `confirmed end frame should pass: ${generated.payload.message}`);
  assert(generated.payload.status === "needs_review", "end frame submit should return needs_review");
  assert(generated.payload.providerOperation === "image.edit", "end frame submit must use image.edit");
  assert(generated.payload.storyFlowWritten === true, "end frame submit should update story flow");
  assert(generated.payload.projectVibeWritten === false, "end frame submit must not mutate project.vibe");
  assert(generated.payload.runtimeExternalNetworkCallMade === false, "mock end frame submit must not make network calls");
  assert(generated.payload.imageUrl, "end frame submit should expose runtime image URL");
  assert(existsSync(repoPath(generated.payload.outputPath)), "end frame output should exist");
  assert(existsSync(repoPath(generated.payload.providerObservationPath)), "provider observation should exist");
  assert(existsSync(repoPath(generated.payload.semanticQaPath)), "semantic QA should exist");
  assert(existsSync(repoPath(generated.payload.pairQaPath)), "pair QA should exist");

  const storyFlow = readJson(repoPath(`${fixtureRoot}/project/story_flow.json`));
  assert(storyFlow.shots[0].endFrame === generated.payload.outputPath, "story flow should point to returned end frame");
  assert(storyFlow.shots[0].endFrameStatus === "needs_review", "story flow end frame should remain pending review");
  assert(statSync(projectVibePath).mtimeMs === projectVibeMtime, "project.vibe must not be mutated by end frame submit");
  assert(JSON.stringify(generated.payload).includes("fake-end-frame-key") === false, "payload must not include raw key material");

  rmSync(repoPath(`${fixtureRoot}/project/story_flow.json`), { force: true });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_end_frame_story_flow_v1",
    sections: [{ id: "act_end", label: "End", shotIds: [shotId] }],
    shots: [{
      id: shotId,
      title: "Lantern opens again",
      sectionId: "act_end",
      sceneId: "scene_rooftop",
      roleIds: ["char_mika"],
      propIds: ["prop_lantern"],
      storyFunction: "Mika opens the lantern again.",
      order: 1,
    }],
  });
  rmSync(`${fixtureRoot}/outputs/shots/${shotId}/start.png`, { force: true });
  writePng(`${fixtureRoot}/real-trigger-one-shot/${shotId}/image2-start.png`);
  const fallbackStart = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-end-frame/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "lanyi-image2",
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_end_frame_fallback_start",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-end-frame",
        confirmed: true,
      },
    }),
  });
  assert(fallbackStart.response.status === 200, "end frame submit should find P6 one-shot start frame fallback");
  assert(fallbackStart.payload.sourceStartFramePath === `${fixtureRoot}/real-trigger-one-shot/${shotId}/image2-start.png`, "fallback start frame path mismatch");

  console.log(`runtime-api-current-project-image2-end-frame-submit-test: ok ${fixtureRoot}`);
} finally {
  await stopServer(child);
  rmSync(tempRoot, { recursive: true, force: true });
}
