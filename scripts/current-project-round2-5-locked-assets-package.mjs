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
const packageRoot = "real-test-sandbox/round2-5-locked-assets-anime";
const runRoot = `${packageRoot}/runs/${runId}`;
const absoluteRunRoot = path.resolve(runRoot);
const projectId = "round2_5_locked_assets_anime";
const round2RunRoot = "real-test-sandbox/round2-image2-start-frame-anime/runs/run-2026-05-08T18-30-40-029Z";
const round2ReportPath = `${round2RunRoot}/reports/round2_real_image2_start_frame_batch_report.json`;
const endFrameContract = {
  contractOnly: true,
  promptOnlyCanPass: false,
  realGenerationAllowed: false,
  requiresApprovedStartFrame: true,
};

const lockedAssets = [
  {
    id: "char_mika",
    kind: "character",
    displayName: "Mika",
    prompt: "16:9 compatible character reference sheet, quiet clean 2D Japanese anime. Mika is a teenage girl with a short black bob haircut, navy school coat, red scarf, dark skirt, small practical shoulder bag, quiet alert expression. Restrained palette, low texture, no photorealism, no 3D.",
    textConstraints: ["short black bob haircut", "navy school coat", "red scarf", "quiet alert expression"],
  },
  {
    id: "char_ren",
    kind: "character",
    displayName: "Ren",
    prompt: "16:9 compatible character reference sheet, quiet clean 2D Japanese anime. Ren is a tall teenage boy with ash-brown slightly messy hair, charcoal hoodie under a muted coat, slim build, calm practical expression. Restrained palette, low texture, no photorealism, no 3D.",
    textConstraints: ["tall teenage boy", "ash-brown hair", "charcoal hoodie", "calm practical expression"],
  },
  {
    id: "scene_rain_station",
    kind: "scene",
    displayName: "Rain Station",
    prompt: "16:9 locked environment reference, quiet clean 2D Japanese anime. Rainy suburban station entrance at night, wet pavement, teal rain shadows, warm amber ticket machines and signage, canopy beams, platform rails visible in related angles. Low texture, restrained color, no photorealism, no video.",
    spatialAnchors: ["rainy suburban station entrance", "wet pavement", "platform rails", "teal and amber light"],
  },
  {
    id: "scene_old_library",
    kind: "scene",
    displayName: "Old Library",
    prompt: "16:9 locked environment reference, quiet clean 2D Japanese anime. Old library reading room at night, tall wooden shelves, card catalog, long reading tables, green desk lamps, brass door hardware, warm pools of light, restrained color, no photorealism, no video.",
    spatialAnchors: ["wooden shelves", "card catalog", "long reading tables", "warm desk lamps"],
  },
];

const shots = [
  {
    id: "R2S01",
    title: "Station entrance pause",
    sceneId: "scene_rain_station",
    roleIds: ["char_mika"],
    purpose: "Establish Mika's hesitation before entering the station.",
    characterPosition: "Mika stands lower-left, three-quarter view, umbrella tilted back.",
    scenePosition: "Station gate fills the midground; wet ticket machines glow on the right.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Mika and Rain Station reference assets. Mika pauses outside the rainy suburban station entrance, lower-left three-quarter pose, umbrella tilted back. Preserve her short black bob, navy school coat, red scarf, and quiet alert expression. Preserve wet pavement, teal rain shadows, warm amber ticket-machine light, low texture, restrained palette.",
  },
  {
    id: "R2S02",
    title: "Map under canopy",
    sceneId: "scene_rain_station",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Introduce Ren as the practical counterpart.",
    characterPosition: "Ren leans in from right; Mika holds a folded map at center.",
    scenePosition: "Canopy beams frame the top; station signage stays legible but not dominant.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Mika, Ren, and Rain Station reference assets. Under the station canopy, Mika holds a folded paper map at center while Ren leans in from the right. Preserve Mika's red scarf and navy coat, Ren's ash-brown hair and charcoal hoodie, canopy beams, rain beads, muted signage, warm vending-machine light.",
  },
  {
    id: "R2S03",
    title: "Platform signal",
    sceneId: "scene_rain_station",
    roleIds: ["char_ren"],
    purpose: "Show Ren noticing the unusual signal.",
    characterPosition: "Ren stands mid-right, head turned toward a small blue signal.",
    scenePosition: "Empty platform recedes left; signal light appears in far upper-left.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Ren and Rain Station reference assets. Ren stands mid-right on a nearly empty rainy platform, head turned toward a small blue signal light in the far upper-left. Preserve his ash-brown hair, charcoal hoodie, calm practical expression, damp concrete, long rails, teal and amber station palette.",
  },
  {
    id: "R2S04",
    title: "Library door",
    sceneId: "scene_old_library",
    roleIds: ["char_mika"],
    purpose: "Transition into the second locked scene with a discovery beat.",
    characterPosition: "Mika is centered from behind, hand near the brass door handle.",
    scenePosition: "Tall library doors dominate foreground; reading room glow leaks through.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Mika and Old Library reference assets. Mika is centered from behind before tall old-library doors, hand hovering near a brass handle. Preserve navy coat and red scarf silhouette, warm reading-room glow through the gap, wooden shelves suggested beyond, dust motes, low texture.",
  },
  {
    id: "R2S05",
    title: "Index drawer clue",
    sceneId: "scene_old_library",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Give both characters a shared clue without adding action noise.",
    characterPosition: "Mika kneels by an index drawer; Ren stands behind her holding a notebook.",
    scenePosition: "Card catalog occupies left foreground; shelves curve into background.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Mika, Ren, and Old Library reference assets. Mika kneels beside an open wooden card-catalog drawer while Ren stands behind her with a small notebook. Preserve character designs, left foreground catalog, curved shelves in background, warm desk-lamp pools, restrained color.",
  },
  {
    id: "R2S06",
    title: "Window reflection",
    sceneId: "scene_old_library",
    roleIds: ["char_ren"],
    purpose: "Create a reflective solo beat for Ren.",
    characterPosition: "Ren sits lower-right at a long table, face reflected in the window.",
    scenePosition: "Rainy night window fills the left half; books and lamp anchor the table.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Ren and Old Library reference assets. Ren sits lower-right at a long library table, his face faintly reflected in a rainy night window occupying the left half. Preserve ash-brown hair, charcoal hoodie, calm expression, green desk lamp, book stack, warm wood and rain contrast.",
  },
  {
    id: "R2S07",
    title: "Shared decision",
    sceneId: "scene_old_library",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Hold the moment before the pair commits to the next action.",
    characterPosition: "Mika and Ren stand side by side at center, looking toward an offscreen shelf.",
    scenePosition: "Aisle of tall shelves forms a symmetrical corridor.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Mika, Ren, and Old Library reference assets. Mika and Ren stand side by side at center in a symmetrical aisle of tall shelves, both looking toward an offscreen shelf. Preserve Mika's red scarf and navy coat, Ren's charcoal hoodie and ash-brown hair, warm lamp glow.",
  },
  {
    id: "R2S08",
    title: "Return to rain",
    sceneId: "scene_rain_station",
    roleIds: ["char_mika", "char_ren"],
    purpose: "Close the small batch by returning to the first locked scene.",
    characterPosition: "Both characters exit frame-right; Mika glances back over her shoulder.",
    scenePosition: "Station entrance is now behind them, reflected in puddles at foreground.",
    prompt: "16:9 quiet clean 2D Japanese anime start frame, using locked Mika, Ren, and Rain Station reference assets. Mika and Ren leave the rainy station entrance toward frame-right, Mika glancing back over her shoulder. Preserve locked character designs, puddle reflections, station entrance behind them, teal rain and warm amber light, no extra focus characters.",
  },
];

function assetPromptPath(asset) {
  return `${runRoot}/asset_prompt_requests/${asset.id}_locked_asset_prompt.md`;
}

function assetExpectedOutputPath(asset) {
  return `${runRoot}/assets/locked/${asset.id}_reference.png`;
}

function assetProviderObservationPath(asset) {
  return `${runRoot}/assets/locked/provider_observations/${asset.id}_provider_observation.json`;
}

function assetSemanticQaPath(asset) {
  return `${runRoot}/assets/locked/semantic_qa/${asset.id}_semantic_qa.json`;
}

function shotPromptPath(shot) {
  return `${runRoot}/prompt_requests/${shot.id}_locked_assets_start_frame_prompt.md`;
}

function shotExpectedOutputPath(shot) {
  return `${runRoot}/real-trigger-one-shot/${shot.id}/image2-start.png`;
}

function shotProviderObservationPath(shot) {
  return `${runRoot}/real-trigger-one-shot/${shot.id}/provider_observations/image2-start-provider-observation.json`;
}

function shotSemanticQaPath(shot) {
  return `${runRoot}/real-trigger-one-shot/${shot.id}/semantic_qa/image2-start-semantic-qa.json`;
}

function shotTriggerPlanPath(shot) {
  return `${runRoot}/real-trigger-one-shot/${shot.id}/trigger-plan/image2-start-trigger-plan.json`;
}

mkdirSync(runRoot, { recursive: true });

for (const asset of lockedAssets) {
  writeText(assetPromptPath(asset), [
    `# Locked Asset ${asset.displayName}`,
    "",
    asset.prompt,
    "",
    "Provider policy: OpenAI Image2 only. No Seedance, Jimeng, Fast, VIP, video, or fallback provider. This prompt is pending real provider execution.",
    "",
  ].join("\n"));
  writeText(`${runRoot}/assets/locked/${asset.id}_reference.md`, [
    `# ${asset.displayName}`,
    "",
    `Kind: ${asset.kind}`,
    "Status: pending_real_provider_asset_generation",
    `Expected image path: ${assetExpectedOutputPath(asset)}`,
    `Prompt path: ${assetPromptPath(asset)}`,
    "",
    asset.prompt,
    "",
  ].join("\n"));
}

writeJson(`${runRoot}/project/project.vibe`, {
  schemaVersion: "round2_5_locked_assets_anime_project_vibe_v1",
  projectId,
  runId,
  title: "Round 2.5 Locked Assets Anime Start Frame Batch",
  roleIds: ["char_mika", "char_ren"],
  sceneIds: ["scene_rain_station", "scene_old_library"],
  styleId: "style_locked_quiet_clean_2d_japanese_anime",
  constraints: {
    startFrameOnly: true,
    lockedAssetsRequiredBeforeShotGeneration: true,
    imageCount: shots.length,
    lockedAssetCount: lockedAssets.length,
    allowedStyle: "quiet_clean_2d_japanese_anime",
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
  schemaVersion: "round2_5_locked_assets_anime_story_flow_v1",
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
    lockedAssetIds: [...shot.roleIds, shot.sceneId, "style_locked_quiet_clean_2d_japanese_anime"],
    generationScope: {
      startFrameOnly: true,
      startFrameRealGenerationAllowed: true,
      endFrame: endFrameContract,
    },
  })),
});

writeJson(`${runRoot}/project/visual_memory.json`, {
  schemaVersion: "round2_5_locked_assets_anime_visual_memory_v1",
  roles: lockedAssets.filter((asset) => asset.kind === "character").map((asset) => ({
    id: asset.id,
    displayName: asset.displayName,
    status: "pending_real_provider_asset_generation",
    path: assetExpectedOutputPath(asset),
    promptPath: assetPromptPath(asset),
    usedByShotIds: shots.filter((shot) => shot.roleIds.includes(asset.id)).map((shot) => shot.id),
    textConstraints: asset.textConstraints,
  })),
  scenes: lockedAssets.filter((asset) => asset.kind === "scene").map((asset) => ({
    id: asset.id,
    displayName: asset.displayName,
    status: "pending_real_provider_asset_generation",
    path: assetExpectedOutputPath(asset),
    promptPath: assetPromptPath(asset),
    usedByShotIds: shots.filter((shot) => shot.sceneId === asset.id).map((shot) => shot.id),
    spatialAnchors: asset.spatialAnchors,
  })),
  style: {
    id: "style_locked_quiet_clean_2d_japanese_anime",
    displayName: "Quiet Clean 2D Japanese Anime",
    status: "locked_text_contract_pending_reference_asset",
    path: `${runRoot}/assets/locked/style_locked_quiet_clean_2d_japanese_anime_reference.md`,
    positive: "quiet clean 2D Japanese anime, low texture, restrained palette, stable 16:9 composition, soft lighting",
    negative: "no photorealism, no 3D render, no western comic style, no high texture, no video, no end frame generation",
  },
});

writeText(`${runRoot}/assets/locked/style_locked_quiet_clean_2d_japanese_anime_reference.md`, "Locked style contract: quiet clean 2D Japanese anime, low texture, restrained color, 16:9 start frames only.\n");

writeJson(`${runRoot}/project/source_index.json`, {
  schemaVersion: "round2_5_locked_assets_anime_source_index_v1",
  refs: [
    `${runRoot}/project/project.vibe`,
    `${runRoot}/project/story_flow.json`,
    `${runRoot}/project/visual_memory.json`,
    `${runRoot}/run_manifest.json`,
  ],
});

for (const shot of shots) {
  writeText(shotPromptPath(shot), [
    `# ${shot.id} ${shot.title}`,
    "",
    `Purpose: ${shot.purpose}`,
    `Character position: ${shot.characterPosition}`,
    `Scene position: ${shot.scenePosition}`,
    `Locked asset inputs: ${[...shot.roleIds, shot.sceneId, "style_locked_quiet_clean_2d_japanese_anime"].join(", ")}`,
    "",
    "Start frame prompt:",
    shot.prompt,
    "",
    "End frame contract:",
    JSON.stringify(endFrameContract, null, 2),
    "",
  ].join("\n"));
}

const assetPlans = lockedAssets.map((asset, index) => ({
  assetId: asset.id,
  order: index + 1,
  kind: asset.kind,
  providerId: "openai-image2-api",
  providerSlot: "image.reference_asset",
  requiredMode: "text2image",
  frameRole: "locked_reference_asset",
  promptPath: assetPromptPath(asset),
  expectedOutputPath: assetExpectedOutputPath(asset),
  providerObservationPath: assetProviderObservationPath(asset),
  semanticQaPath: assetSemanticQaPath(asset),
  status: "pending_real_provider_generation",
}));

const shotPlans = shots.map((shot, index) => ({
  shotId: shot.id,
  order: index + 1,
  providerId: "openai-image2-api",
  providerSlot: "image.generate",
  requiredMode: "text2image_with_locked_references",
  frameRole: "start_frame",
  lockedStyleId: "style_locked_quiet_clean_2d_japanese_anime",
  lockedAssetIds: [...shot.roleIds, shot.sceneId],
  referenceImageInputs: [...shot.roleIds, shot.sceneId].map((assetId) => ({
    assetId,
    path: assetExpectedOutputPath(lockedAssets.find((asset) => asset.id === assetId)),
    required: true,
    mustUseAsVisualInput: true,
    status: "pending_real_provider_generation",
  })),
  roleIds: shot.roleIds,
  sceneId: shot.sceneId,
  shotPurpose: shot.purpose,
  characterPosition: shot.characterPosition,
  scenePosition: shot.scenePosition,
  promptPath: shotPromptPath(shot),
  expectedOutputPath: shotExpectedOutputPath(shot),
  providerObservationPath: shotProviderObservationPath(shot),
  semanticQaPath: shotSemanticQaPath(shot),
  triggerPlanPath: shotTriggerPlanPath(shot),
  endFrameContract,
  status: "pending_locked_assets_then_real_provider_generation",
}));

writeJson(`${runRoot}/run_manifest.json`, {
  schemaVersion: "round2_5_locked_assets_anime_manifest_v1",
  projectId,
  runId,
  generatedAt,
  round2Baseline: {
    runRoot: round2RunRoot,
    reportPath: round2ReportPath,
    contactSheetPath: `${round2RunRoot}/reports/round2_contact_sheet.png`,
  },
  providerPolicy: {
    allowedProvider: "openai-image2-api",
    actualProviderRequiredForPromotion: true,
    providerCalled: false,
    actualImage2Triggered: false,
    forbiddenProviders: ["seedance", "jimeng", "fast", "vip", "video"],
  },
  constraints: {
    startFrameOnly: true,
    lockedAssetCount: lockedAssets.length,
    shotCount: shots.length,
    endFrameContractOnly: true,
    lockedAssetsMustExistBeforeShotExecution: true,
  },
  assetPlans,
  shotPlans,
});

const projectVibePath = `${runRoot}/project/project.vibe`;
const projectVibeHashBefore = sha256File(projectVibePath);
const projectVibeMtimeBefore = statSync(projectVibePath).mtimeMs;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-round2-5-locked-assets-"));
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
    body: JSON.stringify({ projectRoot: runRoot, projectId, displayName: "Round 2.5 Locked Assets Anime" }),
  });
  assert(select.response.status === 200, "Round 2.5 project should bind as current project");

  for (const shot of shots) {
    const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedShotId: shot.id, selectedShotIds: [shot.id], imageCount: 1, transportMode: "codex_app_server" }),
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
    assert(trigger.response.status === 200 && trigger.payload.status === "trigger_plan_prepared", `${shot.id} trigger plan should prepare`);
    assert(existsSync(trigger.payload.triggerPlanPath), `${shot.id} trigger plan should be written`);

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
    assert(dryReturn.response.status === 409, `${shot.id} dry execute-return must fail closed without real provider evidence`);
    assert(dryReturn.payload.providerCalled === false, `${shot.id} dry return must not set providerCalled`);
    assert(dryReturn.payload.actualImage2Triggered === false, `${shot.id} dry return must not set actualImage2Triggered`);

    apiResults.push({
      shotId: shot.id,
      status: "prepared_trigger_plan_dry_return_409_pending_provider",
      prepareStatus: prepare.payload.status,
      confirmStatus: confirm.payload.status,
      triggerStatus: trigger.payload.status,
      dryReturnHttpStatus: dryReturn.response.status,
      dryReturnStatus: dryReturn.payload.status,
      dryReturnBlockers: dryReturn.payload.blockers,
      promptPath: shotPromptPath(shot),
      expectedOutputPath: prepare.payload.expectedOutputPath,
      providerObservationPath: prepare.payload.providerObservationPath,
      semanticQaPath: prepare.payload.semanticQaPath,
      triggerPlanPath: trigger.payload.triggerPlanPath,
      receiptStatePath: prepare.payload.statePaths?.receiptStatePath,
      handoffStatePath: prepare.payload.statePaths?.handoffStatePath,
      providerCalled: dryReturn.payload.providerCalled,
      actualImage2Triggered: dryReturn.payload.actualImage2Triggered,
      projectVibeWritten: dryReturn.payload.projectVibeWritten,
    });
  }

  const projectVibeHashAfter = sha256File(projectVibePath);
  const projectVibeMtimeAfter = statSync(projectVibePath).mtimeMs;
  assert(projectVibeHashAfter === projectVibeHashBefore, "project.vibe hash must remain unchanged after runtime calls");
  assert(projectVibeMtimeAfter === projectVibeMtimeBefore, "project.vibe mtime must remain unchanged after runtime calls");

  const round2Report = existsSync(round2ReportPath) ? JSON.parse(readFileSync(round2ReportPath, "utf8")) : undefined;
  const pendingProviderItems = [
    ...assetPlans.map((asset) => ({ type: "locked_asset", ...asset })),
    ...apiResults.map((shot) => ({ type: "shot_start_frame", ...shot })),
  ];

  const pendingProviderReport = {
    schemaVersion: "round2_5_locked_assets_pending_provider_report_v1",
    generatedAt: new Date().toISOString(),
    runRoot,
    absoluteRunRoot,
    realImage2Generated: false,
    lockedAssetsGenerated: false,
    startFramesGenerated: false,
    reasonRealGenerationNotExecuted: "This worker environment has no callable real Image2/imagegen provider interface that can write provider outputs directly to expectedOutputPath. The package is prepared fail-closed and dry execute-return remains 409.",
    requiredProviderWork: pendingProviderItems,
  };
  writeJson(`${runRoot}/reports/round2_5_locked_assets_pending_provider_report.json`, pendingProviderReport);

  const statusReport = {
    schemaVersion: "round2_5_locked_assets_status_report_v1",
    generatedAt: new Date().toISOString(),
    runRoot,
    absoluteRunRoot,
    projectId,
    realImage2Generated: false,
    actualProviderCallObserved: false,
    lockedAssetCount: lockedAssets.length,
    shotCount: shots.length,
    softwareRuntime: {
      currentProjectBindingExercised: true,
      triggerPlansPrepared: apiResults.every((item) => item.triggerStatus === "trigger_plan_prepared"),
      executeReturnExercised: true,
      failClosedWithoutActualEvidence: apiResults.every((item) => item.dryReturnHttpStatus === 409 && item.providerCalled === false && item.actualImage2Triggered === false),
    },
    policyChecks: {
      animeOnly: true,
      videoGenerated: false,
      endFrameRealGenerated: false,
      endFramePromptOnlyPass: false,
      seedanceUsed: false,
      jimengUsed: false,
      fastUsed: false,
      vipUsed: false,
      mockPromotedToReal: false,
      projectVibeHashBefore,
      projectVibeHashAfter,
      projectVibeWritten: projectVibeHashAfter !== projectVibeHashBefore,
    },
    round2Comparison: {
      baselineReportPath: round2ReportPath,
      baselineContactSheetPath: `${round2RunRoot}/reports/round2_contact_sheet.png`,
      round2ReturnedCount: round2Report?.returnedCount ?? null,
      round2NeedsReviewCount: round2Report?.needsReviewCount ?? null,
      styleConsistency: "not_comparable_until_locked_assets_and_shots_are_real_generated",
      mikaRenCharacterConsistency: "not_comparable_until_real_images_exist",
      rainStationOldLibrarySpatialConsistency: "not_comparable_until_real_images_exist",
      round3StartEndContractRecommendation: "do_not_enter_round3_from_this_pending package alone; first run the 4 locked assets and 8 locked-reference start frames through real Image2 and review consistency against Round 2.",
    },
    lockedAssets: assetPlans.map((asset) => ({
      ...asset,
      outputExists: existsSync(asset.expectedOutputPath),
      reviewStatus: "pending_real_provider_generation",
    })),
    shots: apiResults.map((item) => ({
      ...item,
      outputExists: existsSync(item.expectedOutputPath),
      reviewStatus: "blocked_no_actual_image",
      recommendation: "After the four locked reference assets exist, generate this start frame with those references, write hash-bound provider observation and actual semantic QA, then execute-return.",
    })),
    reports: {
      pendingProviderReportPath: `${runRoot}/reports/round2_5_locked_assets_pending_provider_report.json`,
      statusReportPath: `${runRoot}/reports/round2_5_locked_assets_status_report.json`,
    },
  };
  writeJson(`${runRoot}/reports/round2_5_locked_assets_status_report.json`, statusReport);
  writeJson(`${packageRoot}/latest-run.json`, {
    generatedAt: statusReport.generatedAt,
    runRoot,
    absoluteRunRoot,
    reportPath: `${runRoot}/reports/round2_5_locked_assets_status_report.json`,
    pendingProviderReportPath: `${runRoot}/reports/round2_5_locked_assets_pending_provider_report.json`,
    realImage2Generated: false,
  });
  console.log(`Round 2.5 locked-assets package prepared fail-closed: ${runRoot}`);
} finally {
  child.kill("SIGTERM");
}
