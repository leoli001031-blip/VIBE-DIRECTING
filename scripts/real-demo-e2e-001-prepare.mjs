import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/001");
const projectRoot = path.join(runRoot, "project");
const packetsRoot = path.join(runRoot, "task_packets");
const envelopesRoot = path.join(runRoot, "subagent_envelopes");
const promptsRoot = path.join(runRoot, "prompt_requests");
const providerObservationRoot = path.join(runRoot, "provider_observations");
const workerProvenanceRoot = path.join(runRoot, "worker_provenance");
const outputRoot = path.join(runRoot, "outputs/shots");
const reportsRoot = path.join(runRoot, "reports");

const generatedAt = new Date().toISOString();
const projectId = "real_demo_e2e_001";
const runId = "real_demo_e2e_001_run_20260503";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function repoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

for (const dir of [
  projectRoot,
  path.join(projectRoot, "shot_layouts"),
  packetsRoot,
  envelopesRoot,
  promptsRoot,
  providerObservationRoot,
  workerProvenanceRoot,
  outputRoot,
  reportsRoot,
]) {
  ensureDir(dir);
}

const character = {
  id: "char_naya_chen",
  type: "character",
  lockStatus: "locked_text_authority_v1",
  displayName: "Naya Chen",
  description:
    "28-year-old observatory archivist, East Asian woman, short black bob tucked behind one ear, calm focused expression, charcoal utility jacket, pale gray shirt, small brass pendant.",
  mustPreserve: [
    "short black bob tucked behind one ear",
    "charcoal utility jacket over a pale gray shirt",
    "small brass pendant at the collarbone",
    "quiet, observant, physically restrained performance",
  ],
  mustAvoid: [
    "different age group",
    "long hair or dyed hair",
    "military uniform",
    "heavy makeup",
    "heroic fantasy armor",
  ],
};

const scenes = [
  {
    id: "scene_archive_observatory",
    type: "scene",
    lockStatus: "locked_text_authority_v1",
    displayName: "Old archive observatory",
    description:
      "A circular old observatory archive at night, brass star map table in the center, tall shelves of worn notebooks, a silent dome slit above, moonlight and one low amber desk lamp.",
    spatialAnchors: [
      "brass star map table is centered",
      "entry door is behind camera-left in wide views",
      "shelves curve along the back wall",
      "dome slit is overhead and slightly camera-right",
    ],
    mustAvoid: [
      "modern laboratory",
      "crowded office",
      "daylight",
      "large futuristic hologram",
      "overly ornate fantasy library",
    ],
  },
  {
    id: "scene_service_tunnel",
    type: "scene",
    lockStatus: "locked_text_authority_v1",
    displayName: "Rainy service tunnel",
    description:
      "A narrow concrete service tunnel below the observatory, wet floor, cable trays along the left wall, dim green maintenance lights, a sealed metal door at the far end.",
    spatialAnchors: [
      "cable trays stay on screen-left wall",
      "sealed metal door stays at far end of tunnel",
      "floor reflection is shallow and controlled",
      "maintenance lights repeat toward depth",
    ],
    mustAvoid: [
      "subway platform",
      "wide highway tunnel",
      "bright sci-fi corridor",
      "open outdoor street",
      "crowds",
    ],
  },
];

const style = {
  id: "style_quiet_low_texture_sci_fi",
  type: "style",
  lockStatus: "locked_text_authority_v1",
  displayName: "Quiet low-texture cinematic sci-fi",
  positive:
    "restrained cinematic science-fiction drama, natural 35mm lens language, grounded lighting, low texture, clean image, subtle film grain, precise composition, no visual clutter.",
  negative:
    "no heavy tactile texture, no hyper-detailed grime, no glossy AI sheen, no excessive particles, no bokeh blobs, no neon cyberpunk overload, no poster-like hero lighting.",
};

const shots = [
  {
    id: "S01",
    sectionId: "ACT_A",
    sceneId: "scene_archive_observatory",
    title: "Naya enters the archive observatory",
    durationSeconds: 6,
    generationStatus: "real_image_planned",
    action:
      "Naya steps through the camera-left entry and pauses near the circular star map table, noticing one notebook left open.",
    camera: "wide 35mm, eye level, locked tripod, full circular room geography visible",
    actorPosition: "Naya stands left third, body facing the table, face turned slightly toward the open notebook",
    continuity: "Establishes the observatory geography and the star map table as the central anchor.",
  },
  {
    id: "S02",
    sectionId: "ACT_A",
    sceneId: "scene_archive_observatory",
    title: "Naya reads the old coordinate note",
    durationSeconds: 6,
    generationStatus: "real_image_planned",
    action:
      "Naya leans over the brass star map table and reads a small handwritten coordinate note beside the open notebook.",
    camera: "medium shot from table height, 50mm, camera faces Naya across the brass table",
    actorPosition: "Naya remains on the same side of the room as S01, hands lightly touching the table edge",
    continuity: "Must preserve the table, shelves, lamp direction, and Naya outfit from S01.",
  },
  {
    id: "S03",
    sectionId: "ACT_A",
    sceneId: "scene_archive_observatory",
    title: "The dome slit catches a thin star line",
    durationSeconds: 5,
    generationStatus: "queued",
    action: "A thin line of starlight crosses the star map table and points toward a marked coordinate.",
    camera: "close insert on brass table and notebook, no face required",
    actorPosition: "Naya hand edge may enter frame from lower right",
    continuity: "Same observatory table and lamp direction.",
  },
  {
    id: "S04",
    sectionId: "ACT_A",
    sceneId: "scene_archive_observatory",
    title: "Naya decides to go below",
    durationSeconds: 5,
    generationStatus: "queued",
    action: "Naya closes the notebook carefully and looks toward the hidden service door.",
    camera: "medium profile, calm lateral composition",
    actorPosition: "Naya at table right edge, service door implied in background",
    continuity: "End of observatory section, no tunnel yet.",
  },
  {
    id: "S05",
    sectionId: "ACT_B",
    sceneId: "scene_service_tunnel",
    title: "Naya enters the service tunnel",
    durationSeconds: 6,
    generationStatus: "queued",
    action: "Naya steps into the damp service tunnel, keeping her shoulder close to the cable-tray wall.",
    camera: "wide 28mm, tunnel depth visible, low maintenance lights receding",
    actorPosition: "Naya foreground right, moving toward the far metal door",
    continuity: "Scene shift to service tunnel; outfit and pendant remain identical.",
  },
  {
    id: "S06",
    sectionId: "ACT_B",
    sceneId: "scene_service_tunnel",
    title: "Reflection confirms she is alone",
    durationSeconds: 5,
    generationStatus: "queued",
    action: "Naya stops when her reflection trembles in a shallow puddle, then listens.",
    camera: "low medium shot, wet floor reflection but stable perspective",
    actorPosition: "Naya mid-frame, cable trays remain screen-left",
    continuity: "Do not turn tunnel into a subway or city street.",
  },
  {
    id: "S07",
    sectionId: "ACT_B",
    sceneId: "scene_service_tunnel",
    title: "The sealed door waits",
    durationSeconds: 5,
    generationStatus: "parked",
    action: "Naya reaches the sealed metal door at the tunnel end and studies the old keypad.",
    camera: "over-the-shoulder from behind Naya, door fills far plane",
    actorPosition: "Naya lower left foreground, door centered",
    continuity: "Cable trays remain left, green lights remain dim and regular.",
  },
  {
    id: "S08",
    sectionId: "ACT_B",
    sceneId: "scene_service_tunnel",
    title: "The door unlocks without opening",
    durationSeconds: 5,
    generationStatus: "parked",
    action: "A small indicator on the door turns from red to white while Naya does not move.",
    camera: "quiet close medium, almost still",
    actorPosition: "Naya shoulder and side profile in foreground, door indicator visible",
    continuity: "Suspenseful pause, no reveal beyond the door yet.",
  },
];

const plannedShotIds = new Set(["S01", "S02"]);
const shotById = Object.fromEntries(shots.map((shot) => [shot.id, shot]));
const sceneById = Object.fromEntries(scenes.map((scene) => [scene.id, scene]));

const uiAction = {
  schemaVersion: "director_ui_action_recipe_v1",
  actionId: "ui_action_generate_start_frames_S01_S02",
  projectId,
  runId,
  generatedAt,
  origin: "director_clean_mode_action_recipe",
  userIntent: "Generate the first two start frames for the selected shots, using locked role, scene, and style facts.",
  selection: {
    shotIds: ["S01", "S02"],
    keyframe: "start",
  },
  constraints: {
    provider: "image2_only_via_imagegen_subagent",
    forbid: ["seedance", "jimeng", "fast_model", "vip_channel", "text_to_video"],
    maxRealImagePlans: 2,
  },
};

const projectVibe = {
  schemaVersion: "project_vibe_real_demo_e2e_001",
  projectId,
  runId,
  title: "Real Demo E2E 001 - The Silent Coordinate",
  createdAt: generatedAt,
  productBoundary:
    "Image2-first software-chain scaffold. This run prepares task packets and waits for an imagegen subagent; it does not call video providers.",
  sections: [
    { id: "ACT_A", label: "Archive Observatory", shotIds: ["S01", "S02", "S03", "S04"] },
    { id: "ACT_B", label: "Service Tunnel", shotIds: ["S05", "S06", "S07", "S08"] },
  ],
  lockedFacts: {
    role: character.id,
    scenes: scenes.map((scene) => scene.id),
    style: style.id,
  },
};

const visualMemory = {
  schemaVersion: "visual_memory_real_demo_e2e_001",
  projectId,
  runId,
  authorityMode: "locked_text_reference_first",
  roles: [character],
  scenes,
  styles: [style],
  note:
    "V0 real-chain scaffold uses locked text authorities. Future runs can replace these with image references without changing task packet shape.",
};

const storyFlow = {
  schemaVersion: "story_flow_real_demo_e2e_001",
  projectId,
  runId,
  sections: projectVibe.sections,
  shots: shots.map((shot, index) => ({
    ...shot,
    order: index + 1,
    previousShotId: shots[index - 1]?.id || null,
    nextShotId: shots[index + 1]?.id || null,
  })),
};

writeJson(path.join(runRoot, "ui_action.json"), uiAction);
writeJson(path.join(projectRoot, "project.vibe"), projectVibe);
writeJson(path.join(projectRoot, "visual_memory.json"), visualMemory);
writeJson(path.join(projectRoot, "story_flow.json"), storyFlow);

for (const shot of shots) {
  const scene = sceneById[shot.sceneId];
  writeJson(path.join(projectRoot, "shot_layouts", `${shot.id}.json`), {
    schemaVersion: "shot_layout_real_demo_e2e_001",
    projectId,
    runId,
    shotId: shot.id,
    sceneId: shot.sceneId,
    generationStatus: shot.generationStatus,
    layout: {
      camera: shot.camera,
      actorPosition: shot.actorPosition,
      sceneSpatialAnchors: scene.spatialAnchors,
      continuity: shot.continuity,
    },
    mustPreserve: [
      ...character.mustPreserve,
      ...scene.spatialAnchors,
      style.positive,
    ],
    mustAvoid: [
      ...character.mustAvoid,
      ...scene.mustAvoid,
      style.negative,
    ],
  });
}

const sourceRefs = [
  path.join(runRoot, "ui_action.json"),
  path.join(projectRoot, "project.vibe"),
  path.join(projectRoot, "visual_memory.json"),
  path.join(projectRoot, "story_flow.json"),
  ...shots.map((shot) => path.join(projectRoot, "shot_layouts", `${shot.id}.json`)),
];

const sourceIndex = {
  schemaVersion: "source_index_real_demo_e2e_001",
  projectId,
  runId,
  generatedAt,
  sources: sourceRefs.map((filePath) => ({
    path: repoPath(filePath),
    role: filePath.endsWith("ui_action.json")
      ? "ui_action"
      : filePath.endsWith("project.vibe")
        ? "project_vibe"
        : filePath.endsWith("visual_memory.json")
          ? "visual_memory"
          : filePath.endsWith("story_flow.json")
            ? "story_flow"
            : "shot_layout",
    sha256: sha256File(filePath),
  })),
};

writeJson(path.join(projectRoot, "source_index.json"), sourceIndex);
const sourceIndexHash = sha256File(path.join(projectRoot, "source_index.json"));

function neighborSummary(shotId) {
  const index = shots.findIndex((shot) => shot.id === shotId);
  return {
    previous: shots[index - 1] ? {
      shotId: shots[index - 1].id,
      title: shots[index - 1].title,
      sceneId: shots[index - 1].sceneId,
      action: shots[index - 1].action,
    } : null,
    current: {
      shotId,
      title: shotById[shotId].title,
      sceneId: shotById[shotId].sceneId,
      action: shotById[shotId].action,
    },
    next: shots[index + 1] ? {
      shotId: shots[index + 1].id,
      title: shots[index + 1].title,
      sceneId: shots[index + 1].sceneId,
      action: shots[index + 1].action,
    } : null,
  };
}

function buildImagePrompt(shot) {
  const scene = sceneById[shot.sceneId];
  return [
    `Create a 16:9 cinematic start frame for ${shot.id}: ${shot.title}.`,
    `Action: ${shot.action}`,
    `Character lock: ${character.description}`,
    `Scene lock: ${scene.description}`,
    `Spatial lock: ${scene.spatialAnchors.join("; ")}.`,
    `Camera and layout: ${shot.camera}. ${shot.actorPosition}.`,
    `Continuity: ${shot.continuity}`,
    `Style lock: ${style.positive}`,
    `Avoid: ${[...character.mustAvoid, ...scene.mustAvoid, style.negative].join("; ")}.`,
    "No text overlays, no watermark, no UI diagram, no poster composition, no video motion blur.",
  ].join("\n");
}

function observationTemplate(plan) {
  return {
    schemaVersion: "provider_observation_real_demo_e2e_001",
    providerObservationMode: "actual_provider_call_observed",
    provider: "openai_image2_via_codex_imagegen_subagent",
    subagentId: "FILL_BY_IMAGEGEN_SUBAGENT",
    workerId: "imagegen_subagent_worker",
    threadId: "FILL_BY_IMAGEGEN_SUBAGENT_THREAD_ID",
    turnId: "FILL_BY_IMAGEGEN_SUBAGENT_TURN_ID",
    toolCallId: "FILL_BY_IMAGEGEN_SUBAGENT_TOOL_CALL_ID",
    leaseId: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_ID",
    leaseStartedAt: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_STARTED_AT",
    leaseExpiresAt: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_EXPIRES_AT",
    retryBudget: 0,
    resumable: true,
    interrupted: false,
    resumed: false,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    outputSha256: "FILL_BY_IMAGEGEN_SUBAGENT_OUTPUT_SHA256",
    generatedAt: "FILL_BY_IMAGEGEN_SUBAGENT_ISO_TIME",
    providerSelfReportCompletesTask: false,
    manualFileCopyDetected: false,
    fixtureReuseDetected: false,
    notes: [
      "This sidecar must be written only by the imagegen subagent after it creates the image at outputPath.",
      "Provider self-report alone is not enough; verify also requires output exists, watcher, manifest match, QA, and preview plan.",
    ],
  };
}

function workerProvenanceTemplate(plan) {
  return {
    schemaVersion: "worker_provenance_real_demo_e2e_001",
    sidecarKind: "worker_provenance",
    provenanceMode: "actual_subagent_worker_lease_observed",
    runId,
    leaseId: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_ID",
    workerId: "imagegen_subagent_worker",
    subagentId: "FILL_BY_IMAGEGEN_SUBAGENT",
    threadId: "FILL_BY_IMAGEGEN_SUBAGENT_THREAD_ID",
    turnId: "FILL_BY_IMAGEGEN_SUBAGENT_TURN_ID",
    toolCallId: "FILL_BY_IMAGEGEN_SUBAGENT_TOOL_CALL_ID",
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    leaseStartedAt: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_STARTED_AT",
    leaseExpiresAt: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_EXPIRES_AT",
    retryBudget: 0,
    resumable: true,
    interrupted: false,
    resumed: false,
    notes: [
      "This worker provenance sidecar must be written independently from the provider observation sidecar.",
      "Runtime Truth cross-checks workerId, subagentId, threadId, turnId, and toolCallId against the provider observation.",
    ],
  };
}

function buildPlan(shot) {
  const safeShot = toId(shot.id);
  const outputPath = repoPath(path.join(outputRoot, shot.id, "start.png"));
  const providerObservationPath = repoPath(path.join(providerObservationRoot, `${shot.id}_start_provider_observation.json`));
  const workerProvenancePath = repoPath(path.join(workerProvenanceRoot, `${shot.id}_start_worker_provenance.json`));
  const taskPacketId = `task_packet_${safeShot}_start_frame_real_demo_001`;
  const envelopeId = `subagent_envelope_${safeShot}_start_frame_real_demo_001`;
  const taskRunId = `task_run_${safeShot}_start_frame_real_demo_001`;
  const workerProvenanceId = `worker_provenance_${safeShot}_start_frame_real_demo_001`;
  return {
    shotId: shot.id,
    status: shot.generationStatus,
    taskRunId,
    taskPacketId,
    envelopeId,
    workerProvenanceId,
    workerProvenancePath,
    expectedOutputPath: outputPath,
    providerObservationPath,
    packetPath: repoPath(path.join(packetsRoot, `${shot.id}_start_frame_packet.md`)),
    envelopePath: repoPath(path.join(envelopesRoot, `${shot.id}_start_frame_envelope.json`)),
    promptRequestPath: repoPath(path.join(promptsRoot, `${shot.id}_start_frame_prompt.md`)),
  };
}

const shotPlans = shots.map(buildPlan);
const realImagePlans = shotPlans.filter((plan) => plannedShotIds.has(plan.shotId));

for (const plan of realImagePlans) {
  const shot = shotById[plan.shotId];
  const scene = sceneById[shot.sceneId];
  const packetPath = path.join(repoRoot, plan.packetPath);
  const envelopePath = path.join(repoRoot, plan.envelopePath);
  const promptRequestPath = path.join(repoRoot, plan.promptRequestPath);
  const expectedAbsPath = path.join(repoRoot, plan.expectedOutputPath);
  ensureDir(path.dirname(expectedAbsPath));

  const envelope = {
    schemaVersion: "subagent_task_envelope_real_demo_e2e_001",
    projectId,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    shotId: shot.id,
    taskPurpose: "generate_start_frame",
    sourceIndexHash,
    sourceRefs: [
      "project/source_index.json",
      "project/project.vibe",
      "project/visual_memory.json",
      "project/story_flow.json",
      `project/shot_layouts/${shot.id}.json`,
    ],
    providerPolicy: {
      allowedProvider: "image2",
      executionLayer: "codex_imagegen_subagent",
      forbidden: ["seedance", "jimeng", "fast_model", "vip_channel", "text_to_video"],
    },
    lockedReferences: {
      role: character,
      scene,
      style,
    },
    neighborShots: neighborSummary(shot.id),
    mustPreserve: [
      ...character.mustPreserve,
      ...scene.spatialAnchors,
      shot.actorPosition,
      shot.continuity,
      style.positive,
    ],
    mustAvoid: [
      ...character.mustAvoid,
      ...scene.mustAvoid,
      style.negative,
      "do not change the character identity between S01 and S02",
      "do not invent another location",
      "do not create UI mockups or storyboard panels",
    ],
    expectedOutputContract: {
      outputPath: plan.expectedOutputPath,
      providerObservationPath: plan.providerObservationPath,
      workerProvenancePath: plan.workerProvenancePath,
      format: "png_or_jpeg_image",
      aspectRatio: "16:9",
      requiredFields: [
        "actual image at expected output path",
        "provider observation sidecar",
        "worker provenance sidecar independent from provider observation",
        "taskRunId",
        "taskPacketId",
        "envelopeId",
        "subagentId",
        "workerId",
        "threadId",
        "turnId",
        "toolCallId",
      ],
    },
    qaChecklist: [
      "identity_gate: Naya remains the same character",
      "scene_gate: scene geometry matches the locked scene",
      "style_gate: low texture, restrained cinematic sci-fi",
      "story_gate: shot action matches story function",
      "neighbor_gate: S01 and S02 can sit next to each other without continuity break",
      "output_gate: image exists at expected output path and is not a fixture copy",
    ],
  };

  writeJson(envelopePath, envelope);

  const prompt = buildImagePrompt(shot);
  const observation = observationTemplate(plan);
  const workerProvenance = workerProvenanceTemplate(plan);
  const packet = `# Real Demo E2E 001 - ${shot.id} Start Frame Packet

You are the Image2/imagegen subagent for Vibe Core Real Demo E2E 001.

Do not use Seedance, Jimeng, Fast model, VIP channel, or text-to-video. Do not create video. Do not reuse fixture images. Do not copy files manually from previous tests.

## Required Inputs
- Project root: \`${repoPath(runRoot)}\`
- Source index: \`${repoPath(path.join(projectRoot, "source_index.json"))}\`
- Visual memory: \`${repoPath(path.join(projectRoot, "visual_memory.json"))}\`
- Story flow: \`${repoPath(path.join(projectRoot, "story_flow.json"))}\`
- Shot layout: \`${repoPath(path.join(projectRoot, "shot_layouts", `${shot.id}.json`))}\`
- Subagent envelope: \`${plan.envelopePath}\`
- Prompt request: \`${plan.promptRequestPath}\`

## Expected Output
- Image path: \`${plan.expectedOutputPath}\`
- Provider observation sidecar: \`${plan.providerObservationPath}\`
- Worker provenance sidecar: \`${plan.workerProvenancePath}\`

## Locked Context
- Role: ${character.displayName} - ${character.description}
- Scene: ${scene.displayName} - ${scene.description}
- Style: ${style.displayName} - ${style.positive}

## Neighbor Shots
\`\`\`json
${JSON.stringify(neighborSummary(shot.id), null, 2)}
\`\`\`

## Must Preserve
${envelope.mustPreserve.map((item) => `- ${item}`).join("\n")}

## Must Avoid
${envelope.mustAvoid.map((item) => `- ${item}`).join("\n")}

## Image Prompt
\`\`\`text
${prompt}
\`\`\`

## Required Sidecar Template
After generating the image, write this JSON to \`${plan.providerObservationPath}\` and replace the FILL fields with real values.

\`\`\`json
${JSON.stringify(observation, null, 2)}
\`\`\`

## Required Worker Provenance Template
Also write this independent worker provenance JSON to \`${plan.workerProvenancePath}\`.

\`\`\`json
${JSON.stringify(workerProvenance, null, 2)}
\`\`\`

The task is not complete unless the image, provider observation sidecar, and independent worker provenance sidecar exist. The sidecars are evidence only; Vibe Core verify will still require watcher events, manifest match, QA report, and preview plan.
`;

  writeText(packetPath, packet);
  writeText(promptRequestPath, `${prompt}\n`);
}

const runManifest = {
  schemaVersion: "real_demo_e2e_001_run_manifest_v1",
  projectId,
  runId,
  generatedAt,
  status: "waiting_for_imagegen_subagent",
  declaration: "waiting_for_actual_provider_observed",
  runRoot: repoPath(runRoot),
  projectRoot: repoPath(projectRoot),
  outputRoot: repoPath(outputRoot),
  providerObservationRoot: repoPath(providerObservationRoot),
  sourceIndexHash,
  uiActionPath: repoPath(path.join(runRoot, "ui_action.json")),
  projectFacts: {
    projectVibePath: repoPath(path.join(projectRoot, "project.vibe")),
    sourceIndexPath: repoPath(path.join(projectRoot, "source_index.json")),
    visualMemoryPath: repoPath(path.join(projectRoot, "visual_memory.json")),
    storyFlowPath: repoPath(path.join(projectRoot, "story_flow.json")),
    shotLayoutRoot: repoPath(path.join(projectRoot, "shot_layouts")),
  },
  scenario: {
    totalShots: shots.length,
    realImagePlanCount: realImagePlans.length,
    queuedOrParkedCount: shotPlans.filter((plan) => plan.status === "queued" || plan.status === "parked").length,
    scenes: scenes.map((scene) => scene.id),
    role: character.id,
    style: style.id,
  },
  shotPlans,
  nextImagegenSubagentPacket: realImagePlans[0]?.packetPath || null,
  imagegenSubagentPackets: realImagePlans.map((plan) => plan.packetPath),
  verifyCommand: "npm run real-demo-e2e-001:verify",
  notes: [
    "Prepare does not call Image2 and does not create or fake images.",
    "Verify must remain blocked until the imagegen subagent writes every planned image and provider observation sidecar.",
  ],
};

writeJson(path.join(runRoot, "run_manifest.json"), runManifest);

console.log("Real Demo E2E 001 prepared.");
console.log(`Run root: ${repoPath(runRoot)}`);
console.log(`Run manifest: ${repoPath(path.join(runRoot, "run_manifest.json"))}`);
console.log("Imagegen subagent packets:");
for (const packet of runManifest.imagegenSubagentPackets) console.log(`- ${packet}`);
