import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

const generatedAt = new Date().toISOString();
const runId = `run-${generatedAt.replace(/[:.]/g, "-")}`;
const packageRoot = "real-test-sandbox/round2-image2-start-frame-anime";
const runRoot = `${packageRoot}/runs/${runId}`;
const absoluteRunRoot = path.resolve(runRoot);
const projectId = "round2_image2_start_frame_anime";
const shots = [
  {
    id: "R2S01",
    title: "Station entrance pause",
    sceneId: "scene_rain_station",
    roleIds: ["char_mika"],
    purpose: "Establish Mika's hesitation before entering the station.",
    characterPosition: "Mika stands lower-left, three-quarter view, umbrella tilted back.",
    scenePosition: "Station gate fills the midground; wet ticket machines glow on the right.",
    prompt: "16:9 quiet Japanese anime start frame. Mika, a short-haired girl in a navy school coat and red scarf, pauses outside a rainy suburban station entrance. Lower-left three-quarter pose, umbrella tilted back, soft reflections on pavement, restrained teal and warm amber lighting, clean 2D linework.",
  },
  {
    id: "R2S02",
    title: "Map under canopy",
    sceneId: "scene_rain_station",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Introduce Ren as the practical counterpart.",
    characterPosition: "Ren leans in from right; Mika holds a folded map at center.",
    scenePosition: "Canopy beams frame the top; station signage stays legible but not dominant.",
    prompt: "16:9 quiet Japanese anime start frame. Under the station canopy, Mika holds a folded paper map at center while Ren, a tall boy with ash-brown hair and a charcoal hoodie, leans in from the right. Rain beads on the canopy, muted station signage behind them, soft amber vending-machine light, clean 2D anime frame.",
  },
  {
    id: "R2S03",
    title: "Platform signal",
    sceneId: "scene_rain_station",
    roleIds: ["char_ren"],
    purpose: "Show Ren noticing the unusual signal.",
    characterPosition: "Ren stands mid-right, head turned toward a small blue signal.",
    scenePosition: "Empty platform recedes left; signal light appears in far upper-left.",
    prompt: "16:9 quiet Japanese anime start frame. Ren stands mid-right on a nearly empty rainy platform, head turned toward a small blue signal light in the far upper-left. Long perspective rails, damp concrete, minimal passengers, restrained color, clean 2D line art, cinematic but calm.",
  },
  {
    id: "R2S04",
    title: "Library door",
    sceneId: "scene_old_library",
    roleIds: ["char_mika"],
    purpose: "Transition into the second locked scene with a discovery beat.",
    characterPosition: "Mika is centered from behind, hand near the brass door handle.",
    scenePosition: "Tall library doors dominate foreground; reading room glow leaks through.",
    prompt: "16:9 quiet Japanese anime start frame. Mika is centered from behind before tall old-library doors, hand hovering near a brass handle. Warm reading-room glow leaks through the gap, dust motes in the light, navy coat and red scarf preserved, restrained palette, clean 2D anime style.",
  },
  {
    id: "R2S05",
    title: "Index drawer clue",
    sceneId: "scene_old_library",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Give both characters a shared clue without adding action noise.",
    characterPosition: "Mika kneels by an index drawer; Ren stands behind her holding a notebook.",
    scenePosition: "Card catalog occupies left foreground; shelves curve into background.",
    prompt: "16:9 quiet Japanese anime start frame. In an old library reading room, Mika kneels beside an open wooden card-catalog drawer while Ren stands behind her with a small notebook. Left foreground catalog, curved shelves in background, warm desk-lamp pools, clean restrained 2D anime.",
  },
  {
    id: "R2S06",
    title: "Window reflection",
    sceneId: "scene_old_library",
    roleIds: ["char_ren"],
    purpose: "Create a reflective solo beat for Ren.",
    characterPosition: "Ren sits lower-right at a long table, face reflected in the window.",
    scenePosition: "Rainy night window fills the left half; books and lamp anchor the table.",
    prompt: "16:9 quiet Japanese anime start frame. Ren sits lower-right at a long library table, his face faintly reflected in a rainy night window occupying the left half. A small stack of books and a green desk lamp anchor the table, quiet mood, consistent ash-brown hair and charcoal hoodie, clean 2D anime.",
  },
  {
    id: "R2S07",
    title: "Shared decision",
    sceneId: "scene_old_library",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Hold the moment before the pair commits to the next action.",
    characterPosition: "Mika and Ren stand side by side at center, looking toward an offscreen shelf.",
    scenePosition: "Aisle of tall shelves forms a symmetrical corridor.",
    prompt: "16:9 quiet Japanese anime start frame. Mika and Ren stand side by side at center in a symmetrical aisle of tall old-library shelves, both looking toward an offscreen shelf. Mika's red scarf and navy coat, Ren's charcoal hoodie, warm lamp glow, restrained clean 2D Japanese anime composition.",
  },
  {
    id: "R2S08",
    title: "Return to rain",
    sceneId: "scene_rain_station",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Close the small batch by returning to the first locked scene.",
    characterPosition: "Both characters exit frame-right; Mika glances back over her shoulder.",
    scenePosition: "Station entrance is now behind them, reflected in puddles at foreground.",
    prompt: "16:9 quiet Japanese anime start frame. Mika and Ren leave the rainy station entrance toward frame-right, Mika glancing back over her shoulder. Puddles in the foreground reflect the station lights, no extra characters in focus, consistent locked character designs, restrained teal and amber palette, clean 2D anime.",
  },
];

const endFrameContract = {
  contractOnly: true,
  promptOnlyCanPass: false,
  realGenerationAllowed: false,
  requiresApprovedStartFrame: true,
};

mkdirSync(runRoot, { recursive: true });
writeJson(`${runRoot}/project/project.vibe`, {
  schemaVersion: "round2_image2_start_frame_anime_project_vibe_v1",
  projectId,
  runId,
  title: "Round 2 Anime Image2 Start Frame Small Batch",
  roleIds: ["char_mika", "char_ren"],
  sceneIds: ["scene_rain_station", "scene_old_library"],
  styleId: "style_locked_quiet_anime",
  constraints: {
    startFrameOnly: true,
    imageCount: shots.length,
    allowedStyle: "locked_anime_only",
    videoAllowed: false,
    endFrameRealGenerationAllowed: false,
    seedanceAllowed: false,
    jimengAllowed: false,
    fastAllowed: false,
    vipAllowed: false,
    mockEvidenceCanPromoteRealResult: false,
  },
});
writeJson(`${runRoot}/project/story_flow.json`, {
  schemaVersion: "round2_image2_start_frame_anime_story_flow_v1",
  sections: [
    { id: "act_rain_station", label: "Rain Station", shotIds: ["R2S01", "R2S02", "R2S03", "R2S08"] },
    { id: "act_old_library", label: "Old Library", shotIds: ["R2S04", "R2S05", "R2S06", "R2S07"] },
  ],
  shots: shots.map((shot, index) => ({
    id: shot.id,
    title: shot.title,
    sectionId: shot.sceneId === "scene_rain_station" ? "act_rain_station" : "act_old_library",
    sceneId: shot.sceneId,
    roleIds: shot.roleIds,
    order: index + 1,
    shotPurpose: shot.purpose,
    characterPosition: shot.characterPosition,
    scenePosition: shot.scenePosition,
    generationScope: {
      startFrameOnly: true,
      startFrameRealGenerationAllowed: true,
      endFrame: endFrameContract,
    },
  })),
});
writeJson(`${runRoot}/project/visual_memory.json`, {
  schemaVersion: "round2_image2_start_frame_anime_visual_memory_v1",
  roles: [
    {
      id: "char_mika",
      name: "Mika",
      displayName: "Mika",
      status: "locked",
      path: `${runRoot}/assets/locked/char_mika_reference.md`,
      usedByShotIds: shots.filter((shot) => shot.roleIds.includes("char_mika")).map((shot) => shot.id),
      textConstraints: ["short black bob haircut", "navy school coat", "red scarf", "quiet alert expression"],
    },
    {
      id: "char_ren",
      name: "Ren",
      displayName: "Ren",
      status: "locked",
      path: `${runRoot}/assets/locked/char_ren_reference.md`,
      usedByShotIds: shots.filter((shot) => shot.roleIds.includes("char_ren")).map((shot) => shot.id),
      textConstraints: ["tall teenage boy", "ash-brown hair", "charcoal hoodie", "calm practical expression"],
    },
  ],
  scenes: [
    {
      id: "scene_rain_station",
      name: "Rain Station",
      displayName: "Rain Station",
      status: "locked",
      path: `${runRoot}/assets/locked/scene_rain_station_reference.md`,
      usedByShotIds: shots.filter((shot) => shot.sceneId === "scene_rain_station").map((shot) => shot.id),
      spatialAnchors: ["rainy suburban station entrance", "wet pavement", "platform rails", "teal and amber light"],
    },
    {
      id: "scene_old_library",
      name: "Old Library",
      displayName: "Old Library",
      status: "locked",
      path: `${runRoot}/assets/locked/scene_old_library_reference.md`,
      usedByShotIds: shots.filter((shot) => shot.sceneId === "scene_old_library").map((shot) => shot.id),
      spatialAnchors: ["wooden shelves", "card catalog", "long reading tables", "warm desk lamps"],
    },
  ],
  style: {
    id: "style_locked_quiet_anime",
    name: "Locked Quiet Anime",
    displayName: "Locked Quiet Anime",
    status: "locked",
    path: `${runRoot}/assets/locked/style_locked_quiet_anime_reference.md`,
    positive: "clean 2D Japanese anime, restrained palette, cinematic 16:9, soft lighting, stable character design",
    negative: "no photorealism, no 3D render, no western comic style, no video, no end frame generation",
  },
});
writeJson(`${runRoot}/project/source_index.json`, {
  schemaVersion: "round2_image2_start_frame_anime_source_index_v1",
  refs: [
    `${runRoot}/project/project.vibe`,
    `${runRoot}/project/story_flow.json`,
    `${runRoot}/project/visual_memory.json`,
    `${runRoot}/run_manifest.json`,
  ],
});
writeText(`${runRoot}/assets/locked/char_mika_reference.md`, "Locked character contract for Mika. Text-only reference in this fail-closed package; no generated asset is claimed.\n");
writeText(`${runRoot}/assets/locked/char_ren_reference.md`, "Locked character contract for Ren. Text-only reference in this fail-closed package; no generated asset is claimed.\n");
writeText(`${runRoot}/assets/locked/scene_rain_station_reference.md`, "Locked scene contract for rainy suburban station. Text-only reference in this fail-closed package.\n");
writeText(`${runRoot}/assets/locked/scene_old_library_reference.md`, "Locked scene contract for old library reading room. Text-only reference in this fail-closed package.\n");
writeText(`${runRoot}/assets/locked/style_locked_quiet_anime_reference.md`, "Locked style contract: quiet clean Japanese anime, 16:9 still start frames only.\n");

for (const shot of shots) {
  writeText(`${runRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`, [
    `# ${shot.id} ${shot.title}`,
    "",
    `Purpose: ${shot.purpose}`,
    `Character position: ${shot.characterPosition}`,
    `Scene position: ${shot.scenePosition}`,
    "",
    "Start frame prompt:",
    shot.prompt,
    "",
    "End frame contract:",
    JSON.stringify(endFrameContract, null, 2),
    "",
  ].join("\n"));
  writeJson(`${runRoot}/expected_sidecars/${shot.id}_provider_observation.fail_closed.json`, {
    schemaVersion: "round2_image2_start_frame_anime_provider_observation_fail_closed_v1",
    shotId: shot.id,
    providerObservationMode: "not_observed",
    provider: "openai-image2-api",
    providerCalled: false,
    actualImage2Triggered: false,
    outputPath: `${runRoot}/real-trigger-one-shot/${shot.id}/image2-start.png`,
    outputSha256: null,
    status: "blocked_no_actual_provider_call",
    note: "This is a fail-closed placeholder only. It is not eligible for return executor promotion.",
  });
  writeJson(`${runRoot}/expected_sidecars/${shot.id}_semantic_qa.fail_closed.json`, {
    schemaVersion: "round2_image2_start_frame_anime_semantic_qa_fail_closed_v1",
    shotId: shot.id,
    semanticReviewMode: "not_observed",
    reviewedOutputSha256: null,
    status: "blocked_no_actual_image",
    visualAudit: {
      characterConsistency: "not_reviewed_no_image",
      sceneConsistency: "not_reviewed_no_image",
      styleConsistency: "not_reviewed_no_image",
      nextRoundEligible: false,
    },
  });
}

writeJson(`${runRoot}/run_manifest.json`, {
  schemaVersion: "round2_image2_start_frame_anime_manifest_v1",
  projectId,
  runId,
  generatedAt,
  providerPolicy: {
    allowedProvider: "openai-image2-api",
    actualProviderRequiredForPromotion: true,
    providerCalled: false,
    actualImage2Triggered: false,
    forbiddenProviders: ["seedance", "jimeng", "fast", "vip", "video"],
  },
  constraints: {
    startFrameOnly: true,
    shotCount: shots.length,
    minAllowedShots: 6,
    maxAllowedShots: 10,
    endFrameContractOnly: true,
  },
  shotPlans: shots.map((shot, index) => ({
    shotId: shot.id,
    order: index + 1,
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    frameRole: "start_frame",
    lockedStyleId: "style_locked_quiet_anime",
    roleIds: shot.roleIds,
    sceneId: shot.sceneId,
    shotPurpose: shot.purpose,
    characterPosition: shot.characterPosition,
    scenePosition: shot.scenePosition,
    promptPath: `${runRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`,
    expectedOutputPath: `${runRoot}/real-trigger-one-shot/${shot.id}/image2-start.png`,
    providerObservationPath: `${runRoot}/real-trigger-one-shot/${shot.id}/provider_observations/image2-start-provider-observation.json`,
    semanticQaPath: `${runRoot}/real-trigger-one-shot/${shot.id}/semantic_qa/image2-start-semantic-qa.json`,
    endFrameContract,
    status: "prepared_for_real_provider_but_not_generated",
  })),
});

const projectVibePath = `${runRoot}/project/project.vibe`;
const projectVibeHashBefore = sha256File(projectVibePath);
const projectVibeMtimeBefore = statSync(projectVibePath).mtimeMs;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-round2-anime-start-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

const apiResults = [];
try {
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: runRoot, projectId, displayName: "Round 2 Anime Image2 Start Frames" }),
  });
  assert(select.response.status === 200, "Round 2 project should bind as current project");

  for (const shot of shots) {
    const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedShotId: shot.id, selectedShotIds: [shot.id], imageCount: 1, transportMode: "agent_app_server" }),
    });
    assert(prepare.response.status === 200 && prepare.payload.status === "prepared", `${shot.id} prepare should create receipt`);
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
    assert(confirm.response.status === 200 && confirm.payload.status === "handoff_prepared", `${shot.id} confirm should create handoff`);
    const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${encodeURIComponent(shot.id)}`);
    assert(status.response.status === 200 && status.payload.status === "handoff_prepared", `${shot.id} status should wait for file`);
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
    assert(dryReturn.response.status === 409, `${shot.id} execute-return must fail closed without actual provider evidence`);
    assert(dryReturn.payload.providerCalled === false, `${shot.id} dry return must not set providerCalled`);
    assert(dryReturn.payload.actualImage2Triggered === false, `${shot.id} dry return must not set actualImage2Triggered`);
    apiResults.push({
      shotId: shot.id,
      prepareStatus: prepare.payload.status,
      confirmStatus: confirm.payload.status,
      statusAfterConfirm: status.payload.status,
      dryReturnHttpStatus: dryReturn.response.status,
      dryReturnStatus: dryReturn.payload.status,
      dryReturnBlockers: dryReturn.payload.blockers,
      expectedOutputPath: prepare.payload.expectedOutputPath,
      providerObservationPath: prepare.payload.providerObservationPath,
      semanticQaPath: prepare.payload.semanticQaPath,
      receiptStatePath: prepare.payload.statePaths?.receiptStatePath,
      handoffStatePath: prepare.payload.statePaths?.handoffStatePath,
      providerCalled: dryReturn.payload.providerCalled,
      actualImage2Triggered: dryReturn.payload.actualImage2Triggered,
      projectVibeWritten: dryReturn.payload.projectVibeWritten,
    });
  }

  const realChain = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  const projectVibeHashAfter = sha256File(projectVibePath);
  const projectVibeMtimeAfter = statSync(projectVibePath).mtimeMs;
  assert(projectVibeHashAfter === projectVibeHashBefore, "project.vibe hash must remain unchanged after runtime calls");
  assert(projectVibeMtimeAfter === projectVibeMtimeBefore, "project.vibe mtime must remain unchanged after runtime calls");

  const summary = {
    schemaVersion: "round2_image2_start_frame_anime_report_v1",
    generatedAt: new Date().toISOString(),
    runRoot,
    absoluteRunRoot,
    realImage2Generated: false,
    actualProviderCallObserved: false,
    reasonRealGenerationNotExecuted: "No callable Image2/imagegen provider or credential was available in this worker environment; package and runtime handoff were prepared only.",
    softwareRuntime: {
      currentProjectBindingExercised: true,
      oneShotPrepareConfirmStatusExercised: true,
      executeReturnExercised: true,
      failClosedWithoutActualEvidence: apiResults.every((item) => item.dryReturnHttpStatus === 409 && item.providerCalled === false && item.actualImage2Triggered === false),
    },
    policyChecks: {
      shotCount: shots.length,
      animeOnly: true,
      videoGenerated: false,
      endFrameRealGenerated: false,
      endFramePromptOnlyPass: false,
      seedanceUsed: false,
      jimengUsed: false,
      fastUsed: false,
      vipUsed: false,
      projectVibeHashBefore,
      projectVibeHashAfter,
      projectVibeWritten: projectVibeHashAfter !== projectVibeHashBefore,
    },
    shots: apiResults.map((item) => ({
      ...item,
      usable: false,
      reviewStatus: "blocked_no_actual_image",
      recommendation: "Generate this start frame with actual Image2, then write hash-bound provider observation and actual semantic QA before execute-return promotion.",
    })),
    realChainProjection: {
      httpStatus: realChain.response.status,
      providerCalled: realChain.payload.providerCalled,
      actualImage2Triggered: realChain.payload.actualImage2Triggered,
      productionStatus: realChain.payload.productionStatus,
      needsReviewShotIds: realChain.payload.needsReviewShotIds,
    },
  };
  writeJson(`${runRoot}/reports/round2_anime_start_frame_report.json`, summary);
  writeJson(`${packageRoot}/latest-run.json`, {
    generatedAt: summary.generatedAt,
    runRoot,
    absoluteRunRoot,
    reportPath: `${runRoot}/reports/round2_anime_start_frame_report.json`,
    realImage2Generated: false,
  });
  console.log(`Round 2 anime start-frame package prepared fail-closed: ${runRoot}`);
} finally {
  child.kill("SIGTERM");
}
