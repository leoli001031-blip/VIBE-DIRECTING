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

function assertSoftwareLocks(payload, label) {
  assert(payload.providerCalled === false, `${label}.providerCalled must stay false`);
  if ("actualImage2Triggered" in payload) assert(payload.actualImage2Triggered === false, `${label}.actualImage2Triggered must stay false`);
  assert(payload.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must stay false`);
  assert(payload.projectVibeWritten === false, `${label}.projectVibeWritten must stay false`);
  assert(payload.workerSpawnForbidden === true, `${label}.workerSpawnForbidden must stay true`);
  if (payload.submitPolicy) {
    assert(payload.submitPolicy.providerCallAllowed === false, `${label}.submitPolicy.providerCallAllowed must stay false`);
    if ("providerSubmitAllowed" in payload.submitPolicy) assert(payload.submitPolicy.providerSubmitAllowed === 0, `${label}.submitPolicy.providerSubmitAllowed must be zero`);
    assert(payload.submitPolicy.liveSubmitAllowed === false, `${label}.submitPolicy.liveSubmitAllowed must stay false`);
  }
  if (payload.transportPlan) {
    assert(payload.transportPlan.providerCalled === false, `${label}.transportPlan.providerCalled must stay false`);
    assert(payload.transportPlan.actualExecutionAllowed === false, `${label}.transportPlan.actualExecutionAllowed must stay false`);
    assert(payload.transportPlan.liveSubmitAllowed === false, `${label}.transportPlan.liveSubmitAllowed must stay false`);
    assert(payload.transportPlan.projectVibeWritten === false, `${label}.transportPlan.projectVibeWritten must stay false`);
    assert(payload.transportPlan.workerSpawnForbidden === true, `${label}.transportPlan.workerSpawnForbidden must stay true`);
  }
  if (payload.receipt?.policy) {
    assert(payload.receipt.policy.providerCalled === false, `${label}.receipt.policy.providerCalled must stay false`);
    assert(payload.receipt.policy.liveSubmitAllowed === false, `${label}.receipt.policy.liveSubmitAllowed must stay false`);
    assert(payload.receipt.policy.projectVibeWritten === false, `${label}.receipt.policy.projectVibeWritten must stay false`);
  }
  if (payload.handoffPacket) {
    assert(payload.handoffPacket.providerCalled === false, `${label}.handoffPacket.providerCalled must stay false`);
    assert(payload.handoffPacket.liveSubmitAllowed === false, `${label}.handoffPacket.liveSubmitAllowed must stay false`);
    assert(payload.handoffPacket.projectVibeWritten === false, `${label}.handoffPacket.projectVibeWritten must stay false`);
    assert(payload.handoffPacket.transportPlan?.actualExecutionAllowed === false, `${label}.handoffPacket transport must stay non-executable`);
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

function assertStateSandbox(payload, fixtureRoot, shotId, label) {
  const stateRoot = `${fixtureRoot}/real-trigger-one-shot/${shotId}/state`;
  assert(payload.statePaths?.stateRoot === stateRoot, `${label} state root must stay inside one-shot sandbox`);
  assert(payload.statePaths?.receiptStatePath === `${stateRoot}/prepare-receipt.json`, `${label} receipt path drifted`);
  assert(payload.statePaths?.handoffStatePath === `${stateRoot}/handoff-packet.json`, `${label} handoff path drifted`);
  assert(payload.expectedOutputPath === `${fixtureRoot}/real-trigger-one-shot/${shotId}/image2-start.png`, `${label} expected output path drifted`);
  assert(payload.providerObservationPath.startsWith(`${fixtureRoot}/real-trigger-one-shot/${shotId}/provider_observations/`), `${label} provider observation path escaped sandbox`);
  assert(payload.semanticQaPath.startsWith(`${fixtureRoot}/real-trigger-one-shot/${shotId}/semantic_qa/`), `${label} semantic QA path escaped sandbox`);
}

function shotIdFor(index) {
  return `A${String(index).padStart(2, "0")}`;
}

function buildRound1Fixture(fixtureRoot) {
  rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(`${fixtureRoot}/project`, { recursive: true });

  const actIds = ["act_01_signal", "act_02_crossing", "act_03_reveal", "act_04_afterglow"];
  const scenes = [
    {
      id: "scene_neon_station",
      displayName: "Neon Station",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/scene_neon_station.png`,
      spatialAnchors: ["platform edge at screen right", "cyan ticket gates in background", "rain-gloss floor reflections"],
    },
    {
      id: "scene_archive_room",
      displayName: "Archive Room",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/scene_archive_room.png`,
      spatialAnchors: ["circular archive table centered", "warm paper lanterns overhead", "stacked reels at back wall"],
    },
    {
      id: "scene_rooftop_garden",
      displayName: "Rooftop Garden",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/scene_rooftop_garden.png`,
      spatialAnchors: ["greenhouse frame left", "city skyline low horizon", "wind chimes near railing"],
    },
  ];
  const roles = [
    {
      id: "char_mika",
      displayName: "Mika",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/char_mika.png`,
      textConstraints: ["short black bob", "blue messenger jacket", "quiet determined expression"],
    },
    {
      id: "char_ren",
      displayName: "Ren",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/char_ren.png`,
      textConstraints: ["silver hair tied low", "round glasses", "olive field coat"],
    },
    {
      id: "char_io",
      displayName: "Io",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/char_io.png`,
      textConstraints: ["small side ponytail", "red scarf", "oversized camera bag"],
    },
  ];
  const style = {
    id: "style_soft_anime_memory",
    displayName: "Soft Anime Memory",
    status: "locked",
    path: `${fixtureRoot}/assets/locked/style_soft_anime_memory.png`,
    positive: "clean 2D anime film frame, controlled line art, restrained color, stable 16:9 composition",
    negative: "no photorealism, no 3D render, no live action, no heavy texture",
  };

  const shots = Array.from({ length: 60 }, (_, index) => {
    const number = index + 1;
    const shotId = shotIdFor(number);
    const actId = actIds[Math.floor(index / 15)];
    const scene = scenes[index % scenes.length];
    const primaryRole = roles[index % roles.length];
    const secondaryRole = roles[(index + 1) % roles.length];
    const startFramePath = `${fixtureRoot}/planned_frames/${shotId}/start_frame_plan.json`;
    const endFramePath = `${fixtureRoot}/planned_frames/${shotId}/end_frame_plan.json`;
    return {
      id: shotId,
      title: `Anime memory shot ${shotId}`,
      actId,
      sectionId: scene.id,
      sceneId: scene.id,
      roleIds: [primaryRole.id, secondaryRole.id],
      cameraPurpose: number % 5 === 0 ? "turning-point reaction" : number % 3 === 0 ? "scene geography reinforcement" : "character continuity beat",
      action: `${primaryRole.displayName} and ${secondaryRole.displayName} hold continuity in ${scene.displayName}; shot ${shotId} advances the anime memory sequence.`,
      assetReferences: {
        characters: [primaryRole.path, secondaryRole.path],
        scene: scene.path,
        style: style.path,
      },
      framePlan: {
        start: {
          role: "start_frame",
          planPath: startFramePath,
          expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
          promptPath: `${fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`,
        },
        end: {
          role: "end_frame",
          planPath: endFramePath,
          expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/end.png`,
          promptPath: `${fixtureRoot}/prompt_requests/${shotId}_end_frame_prompt.md`,
          promptOnlyCanPass: false,
          requiresApprovedStartFrame: true,
          realGenerationAllowed: false,
        },
      },
      generationScope: {
        startFrameOnly: true,
        endFrame: {
          contractOnly: true,
          promptOnlyCanPass: false,
          realGenerationAllowed: false,
          requiredFutureMode: "image.edit/image2image_from_approved_start_frame",
        },
      },
    };
  });

  const sections = actIds.map((actId) => ({
    id: actId,
    label: actId.replace(/_/g, " "),
    shotIds: shots.filter((shot) => shot.actId === actId).map((shot) => shot.id),
  }));

  const shotPlans = shots.map((shot, index) => ({
    shotId: shot.id,
    order: index + 1,
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    frameRole: "start_frame",
    startFrameOnly: true,
    shotPurpose: shot.cameraPurpose,
    expectedOutputPath: shot.framePlan.start.expectedOutputPath,
    providerObservationPath: `${fixtureRoot}/provider_observations/${shot.id}_start_provider_observation.json`,
    semanticQaPath: `${fixtureRoot}/semantic_qa/${shot.id}_start_semantic_qa.json`,
    promptPath: shot.framePlan.start.promptPath,
    referencePaths: [
      `${fixtureRoot}/project/project.vibe`,
      `${fixtureRoot}/project/story_flow.json`,
      `${fixtureRoot}/project/visual_memory.json`,
      ...shot.assetReferences.characters,
      shot.assetReferences.scene,
      shot.assetReferences.style,
      shot.framePlan.start.planPath,
      shot.framePlan.end.planPath,
    ],
    assetReferenceIds: [...shot.roleIds, shot.sceneId, style.id],
    startFramePlan: shot.framePlan.start,
    endFramePlan: shot.framePlan.end,
    endFrameContract: {
      status: "contract_only_not_generated",
      promptOnlyCanPass: false,
      expectedOutputPath: shot.framePlan.end.expectedOutputPath,
      promptPath: shot.framePlan.end.promptPath,
      realGenerationAllowed: false,
    },
    status: "queued_without_provider",
  }));

  for (const shot of shots) {
    writeJson(shot.framePlan.start.planPath, {
      schemaVersion: "round1_start_frame_plan_v1",
      shotId: shot.id,
      purpose: shot.cameraPurpose,
      lockedReferences: shot.assetReferences,
      expectedOutputPath: shot.framePlan.start.expectedOutputPath,
    });
    writeJson(shot.framePlan.end.planPath, {
      schemaVersion: "round1_end_frame_plan_v1",
      shotId: shot.id,
      purpose: `${shot.cameraPurpose} end pose continuity`,
      promptOnlyCanPass: false,
      requiresApprovedStartFrame: true,
      expectedOutputPath: shot.framePlan.end.expectedOutputPath,
    });
    mkdirSync(path.dirname(shot.framePlan.end.promptPath), { recursive: true });
    writeFileSync(shot.framePlan.end.promptPath, `Prompt-only end-frame placeholder for ${shot.id}. This must not complete the task.\n`, "utf8");
  }

  const rolesWithUsage = roles.map((role) => ({
    ...role,
    usedByShotIds: shots.filter((shot) => shot.roleIds.includes(role.id)).map((shot) => shot.id),
  }));
  const scenesWithUsage = scenes.map((scene) => ({
    ...scene,
    usedByShotIds: shots.filter((shot) => shot.sceneId === scene.id).map((shot) => shot.id),
  }));

  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_round1_software_scale_project_vibe_v1",
    projectId: "current_project_round1_software_scale",
    runId: "current_project_round1_software_scale_run",
    title: "Round 1 Anime Software Scale",
    roleIds: roles.map((role) => role.id),
    sceneIds: scenes.map((scene) => scene.id),
    styleId: style.id,
    constraints: {
      softwareOnly: true,
      startFrameOnly: true,
      endFramePromptOnlyCanPass: false,
      actualImage2Triggered: false,
      providerCalled: false,
      seedanceAllowed: false,
      jimengAllowed: false,
      videoAllowed: false,
      fastAllowed: false,
      vipAllowed: false,
    },
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_round1_software_scale_story_flow_v1",
    acts: actIds.map((id) => ({ id, shotIds: shots.filter((shot) => shot.actId === id).map((shot) => shot.id) })),
    sections,
    shots,
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_round1_software_scale_visual_memory_v1",
    roles: rolesWithUsage,
    scenes: scenesWithUsage,
    style: { ...style, usedByShotIds: shots.map((shot) => shot.id) },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_round1_software_scale_source_index_v1",
    refs: [
      `${fixtureRoot}/project/project.vibe`,
      `${fixtureRoot}/project/story_flow.json`,
      `${fixtureRoot}/project/visual_memory.json`,
      `${fixtureRoot}/run_manifest.json`,
    ],
  });
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_round1_software_scale_manifest_v1",
    projectId: "current_project_round1_software_scale",
    runId: "current_project_round1_software_scale_run",
    status: "software_round1_ready",
    providerCalled: false,
    actualImage2Triggered: false,
    shotPlans,
  });
  writeJson(`${fixtureRoot}/reports/preview_plan.json`, {
    schemaVersion: "current_project_round1_software_scale_preview_plan_v1",
    status: "preview_ready_with_review",
    previewStatus: "preview_ready_with_review",
    productionStatus: "needs_review",
    reviewOverlayShots: shots.filter((_, index) => index % 10 === 0).map((shot) => shot.id),
    productionNeedsReviewShots: shots.filter((_, index) => index % 10 === 0).map((shot) => shot.id),
    clips: shots.map((shot, index) => ({
      shotId: shot.id,
      order: index + 1,
      mediaPath: shotPlans[index].expectedOutputPath,
      status: index % 10 === 0 ? "returned_with_review_overlay" : index % 4 === 0 ? "returned" : "missing",
      previewQaStatus: index % 10 === 0 ? "needs_review" : undefined,
      productionQaStatus: index % 10 === 0 ? "needs_review" : undefined,
    })),
  });
  writeJson(`${fixtureRoot}/reports/image2_start_long_chain_report.json`, {
    schemaVersion: "current_project_round1_software_scale_report_v1",
    status: "preview_ready_with_review",
    previewStatus: "preview_ready_with_review",
    productionStatus: "needs_review",
    totalPlannedImages: shots.length,
    returnedImageCount: 0,
    providerCalled: false,
    actualImage2Triggered: false,
    observations: shotPlans.map((plan) => ({
      shotId: plan.shotId,
      order: plan.order,
      expectedOutputPath: plan.expectedOutputPath,
      providerObservationPresent: false,
      providerObservationActual: false,
      semanticQaPresent: false,
      semanticQaActual: false,
      runtimeTruthStatus: "queued",
      previewStatus: "missing",
    })),
  });

  return { shots, shotPlans, roles: rolesWithUsage, scenes: scenesWithUsage, style };
}

function assertRound1FixtureShape(fixtureRoot, fixture) {
  assert(fixture.shots.length >= 50, "Round 1 fixture must contain at least 50 shots");
  assert(new Set(fixture.shots.map((shot) => shot.actId)).size === 4, "Round 1 fixture must contain 4 acts");
  assert(new Set(fixture.shots.map((shot) => shot.sceneId)).size === 3, "Round 1 fixture must contain 3 primary scenes");
  assert(fixture.roles.length === 3, "Round 1 fixture must contain 3 primary characters");
  for (const role of fixture.roles) {
    assert(role.status === "locked", `${role.id} must be locked`);
    assert(role.usedByShotIds.length > 0, `${role.id} must be used`);
  }
  for (const scene of fixture.scenes) {
    assert(scene.status === "locked", `${scene.id} must be locked`);
    assert(scene.usedByShotIds.length > 0, `${scene.id} must be used`);
  }
  assert(fixture.style.status === "locked", "style reference must be locked");
  for (const shot of fixture.shots) {
    assert(shot.assetReferences.characters.length >= 2, `${shot.id} must reference character assets`);
    assert(shot.assetReferences.scene, `${shot.id} must reference scene asset`);
    assert(shot.assetReferences.style, `${shot.id} must reference style asset`);
    assert(shot.cameraPurpose, `${shot.id} must include camera purpose`);
    assert(shot.framePlan.start.expectedOutputPath.startsWith(`${fixtureRoot}/outputs/shots/${shot.id}/`), `${shot.id} start output must stay in sandbox`);
    assert(shot.framePlan.end.expectedOutputPath.startsWith(`${fixtureRoot}/outputs/shots/${shot.id}/`), `${shot.id} end output must stay in sandbox`);
    assert(shot.framePlan.end.promptOnlyCanPass === false, `${shot.id} end frame prompt-only must not pass`);
    assert(existsSync(shot.framePlan.start.planPath), `${shot.id} start frame plan must exist`);
    assert(existsSync(shot.framePlan.end.planPath), `${shot.id} end frame plan must exist`);
  }
}

async function postOneShot(baseUrl, action, body) {
  return fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fixtureRoot = "real-test-sandbox/software-layer/current-project-round1-software-scale";
const fixture = buildRound1Fixture(fixtureRoot);
assertRound1FixtureShape(fixtureRoot, fixture);

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-round1-software-scale-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
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
      projectId: "current_project_round1_software_scale",
      displayName: "Round 1 Anime Software Scale",
    }),
  });
  assert(select.response.status === 200, "Round 1 fixture should bind as current project");
  assert(select.payload.status === "bound", "current project binding status mismatch");
  assert(select.payload.currentProject?.project?.projectId === "current_project_round1_software_scale", "current project binding should use Round 1 project id");
  assert(!JSON.stringify(select.payload).includes("real-demo-e2e-005"), "current project binding must not hard-code 005");
  assertSoftwareLocks(select.payload, "select Round 1 project");

  const binding = await fetchJson(`${baseUrl}/api/runtime/projects/current`);
  assert(binding.response.status === 200, "GET current project should return 200");
  assert(binding.payload.currentProject?.project?.projectRoot === fixtureRoot, "GET current project should project selected project root");
  assert(!JSON.stringify(binding.payload).includes("real-demo-e2e-005"), "GET current project must not project hard-coded 005");
  assertSoftwareLocks(binding.payload, "GET current project");

  const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(status.response.status === 200, "real-chain status should return 200");
  assert(status.payload.project?.projectId === "current_project_round1_software_scale", "status should project Round 1 project id");
  assert(status.payload.workbenchFacts?.storyFlow?.shotCount === fixture.shots.length, "story_flow projection should include all Round 1 shots");
  assert(status.payload.observations.length === fixture.shots.length, "report projection should include all Round 1 observations");
  assert(status.payload.previewItems.length === fixture.shots.length, "preview projection should include all Round 1 shots");
  assert(status.payload.previewStatus === "preview_ready_with_review", "preview should expose ready-with-review status");
  assert(status.payload.productionStatus === "needs_review", "report should expose needs_review production status");
  assert(status.payload.providerCalled === false, "status must not promote providerCalled from fixture/readiness evidence");
  assert(status.payload.actualImage2Triggered === false, "status must not promote actualImage2Triggered from fixture/readiness evidence");
  assert(status.payload.previewItems.some((item) => item.status === "returned_with_review_overlay" || item.previewStatus === "returned_with_review_overlay"), "preview should expose returned-with-review overlay state");
  assert(status.payload.previewItems.some((item) => item.status === "missing" || item.previewStatus === "missing"), "preview should expose missing/queued state");
  assert(!JSON.stringify(status.payload).includes("real-demo-e2e-005"), "real-chain status must not hard-code 005");
  assertSoftwareLocks(status.payload, "real-chain status");

  const batchPlan = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`);
  assert(batchPlan.response.status === 200, "image2 batch plan should return 200");
  assert(batchPlan.payload.project?.projectId === "current_project_round1_software_scale", "batch plan should use the current Round 1 project");
  assert(batchPlan.payload.observations.length === 10, "batch plan should preserve its UI planning limit");
  assert(batchPlan.payload.summary?.plannedCount === 10, "batch plan planned count should reflect the UI planning limit");
  assert(batchPlan.payload.items.every((item) => item.referencePaths.some((referencePath) => referencePath.endsWith("/project/visual_memory.json"))), "batch plan items must carry visual memory references");
  assert(batchPlan.payload.items.every((item) => item.referencePaths.some((referencePath) => referencePath.endsWith("/project/story_flow.json"))), "batch plan items must carry story flow references");
  assert(batchPlan.payload.ledgerProjection?.summary?.completeVerified === 0, "batch ledger must not complete prompt-only or missing outputs");
  assertSoftwareLocks(batchPlan.payload, "image2 batch plan");

  const batchCheck = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: "ignored/override", projectId: "ignored_override" }),
  });
  assert(batchCheck.response.status === 200, "image2 batch run-check should return 200");
  assert(batchCheck.payload.command?.verifyScriptRan === false, "batch run-check must not spawn verify script");
  assert(batchCheck.payload.command?.providerCalled === false, "batch run-check must not call provider");
  assertSoftwareLocks(batchCheck.payload, "image2 batch run-check");

  const traversalPath = await postOneShot(baseUrl, "prepare", {
    selectedShotId: "A01",
    selectedShotIds: ["A01"],
    imageCount: 1,
    expectedOutputPath: "../outside.png",
  });
  assert(traversalPath.response.status === 409, "parent traversal output path should fail closed");
  assertSoftwareLocks(traversalPath.payload, "traversal blocked prepare");

  const outsideSandboxPath = await postOneShot(baseUrl, "prepare", {
    selectedShotId: "A01",
    selectedShotIds: ["A01"],
    imageCount: 1,
    expectedOutputPath: `${fixtureRoot}/outputs/not-one-shot.png`,
  });
  assert(outsideSandboxPath.response.status === 409, "output outside one-shot sandbox should fail closed");
  assertSoftwareLocks(outsideSandboxPath.payload, "outside sandbox blocked prepare");

  const sampleShotIds = fixture.shots.map((shot) => shot.id);
  for (const shotId of sampleShotIds) {
    const label = `Round 1 ${shotId}`;
    const ready = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(ready.response.status === 200, `${label} status should return 200`);
    assert(ready.payload.status === "ready_to_prepare", `${label} should start ready_to_prepare`);
    assert(ready.payload.receipt?.lockedReferences?.characters?.length >= 2, `${label} should include locked character refs`);
    assert(ready.payload.receipt?.lockedReferences?.scenes?.length >= 1, `${label} should include locked scene refs`);
    assert(ready.payload.receipt?.lockedReferences?.styles?.length >= 1, `${label} should include locked style refs`);
    assertSoftwareLocks(ready.payload, `${label} ready`);
    assertStateSandbox(ready.payload, fixtureRoot, shotId, `${label} ready`);

    const prepared = await postOneShot(baseUrl, "prepare", {
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      transportMode: shotId.endsWith("1") ? "codex_app_server" : "manual",
    });
    assert(prepared.response.status === 200, `${label} prepare should return 200`);
    assert(prepared.payload.status === "prepared", `${label} prepare should persist receipt`);
    assert(prepared.payload.persistedState?.receiptPresent === true, `${label} receipt should persist`);
    assert(prepared.payload.persistedState?.handoffPresent === false, `${label} handoff should not be present before confirm`);
    assertSoftwareLocks(prepared.payload, `${label} prepared`);
    assertStateSandbox(prepared.payload, fixtureRoot, shotId, `${label} prepared`);

    const preparedStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(preparedStatus.response.status === 200, `${label} prepared status should return 200`);
    assert(preparedStatus.payload.status === "prepared", `${label} prepared status should survive reload`);
    assert(preparedStatus.payload.receipt?.receiptId === prepared.payload.receipt.receiptId, `${label} receipt id should survive reload`);
    assertSoftwareLocks(preparedStatus.payload, `${label} prepared status`);
    assertStateSandbox(preparedStatus.payload, fixtureRoot, shotId, `${label} prepared status`);

    const confirmed = await postOneShot(baseUrl, "confirm", {
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      expectedOutputPath: prepared.payload.expectedOutputPath,
      receipt: prepared.payload.receipt,
    });
    assert(confirmed.response.status === 200, `${label} confirm should return 200`);
    assert(confirmed.payload.status === "handoff_prepared", `${label} confirm should persist handoff`);
    assert(confirmed.payload.persistedState?.receiptPresent === true, `${label} confirm should keep receipt present`);
    assert(confirmed.payload.persistedState?.handoffPresent === true, `${label} confirm should persist handoff`);
    assert(confirmed.payload.watcherProjection?.watcherStarted === false, `${label} confirm must not start watcher`);
    assert(confirmed.payload.watcherProjection?.daemonStarted === false, `${label} confirm must not start daemon`);
    assertSoftwareLocks(confirmed.payload, `${label} confirmed`);
    assertStateSandbox(confirmed.payload, fixtureRoot, shotId, `${label} confirmed`);

    const confirmedStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shotId)}`);
    assert(confirmedStatus.response.status === 200, `${label} confirmed status should return 200`);
    assert(confirmedStatus.payload.status === "handoff_prepared", `${label} handoff status should survive reload`);
    assert(confirmedStatus.payload.handoffPacket?.receiptId === confirmed.payload.handoffPacket.receiptId, `${label} handoff receipt id should survive reload`);
    assertSoftwareLocks(confirmedStatus.payload, `${label} confirmed status`);
    assertStateSandbox(confirmedStatus.payload, fixtureRoot, shotId, `${label} confirmed status`);
  }

  const dryReturn = await postOneShot(baseUrl, "execute-return", {
    selectedShotId: "A01",
    selectedShotIds: ["A01"],
    imageCount: 1,
  });
  assert(dryReturn.response.status === 409, "missing actual return evidence must fail closed");
  assert(dryReturn.payload.status === "dry_run_executor_ready", "dry return should stay dry-run executor ready");
  assert(dryReturn.payload.providerCalled === false, "dry return must not promote providerCalled");
  assert(dryReturn.payload.actualImage2Triggered === false, "dry return must not promote actualImage2Triggered");
  assert(dryReturn.payload.executorEvidence?.hashBoundActual === false, "dry return must require hash-bound actual evidence");
  assert(dryReturn.payload.outputReturnContract?.previewProjection?.status !== "real_provider_returned_needs_review", "dry return must not project real provider return");
  assertSoftwareLocks(dryReturn.payload, "dry execute-return");

  const promptOnlyEndFramePlan = readJson(fixture.shots[0].framePlan.end.planPath);
  assert(promptOnlyEndFramePlan.promptOnlyCanPass === false, "end-frame plan must explicitly reject prompt-only completion");
  assert(!existsSync(fixture.shots[0].framePlan.end.expectedOutputPath), "end-frame prompt-only fixture must not create output");

  assert(statSync(projectVibePath).mtimeMs === projectVibeBefore, "Round 1 software test must not mutate project.vibe");
  for (const shotId of sampleShotIds) {
    const stateDir = `${fixtureRoot}/real-trigger-one-shot/${shotId}/state`;
    const receipt = readJson(`${stateDir}/prepare-receipt.json`);
    const handoff = readJson(`${stateDir}/handoff-packet.json`);
    assert(receipt.policy?.providerCalled === false, `${shotId} persisted receipt providerCalled must be false`);
    assert(receipt.policy?.liveSubmitAllowed === false, `${shotId} persisted receipt liveSubmitAllowed must be false`);
    assert(handoff.providerCalled === false, `${shotId} persisted handoff providerCalled must be false`);
    assert(handoff.liveSubmitAllowed === false, `${shotId} persisted handoff liveSubmitAllowed must be false`);
    assert(handoff.transportPlan?.actualExecutionAllowed === false, `${shotId} persisted handoff transport must stay non-executable`);
  }

  console.log(`Current project Round 1 software scale test passed: ${fixture.shots.length} anime shots, 4 acts, 3 scenes, 3 characters, no provider calls.`);
} finally {
  child.kill("SIGTERM");
  rmSync(fixtureRoot, { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
}
