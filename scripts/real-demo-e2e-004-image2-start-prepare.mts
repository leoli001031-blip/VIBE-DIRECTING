import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/004-image2-start-frames");
const projectRoot = path.join(runRoot, "project");
const shotLayoutRoot = path.join(projectRoot, "shot_layouts");
const packetsRoot = path.join(runRoot, "task_packets");
const envelopesRoot = path.join(runRoot, "subagent_envelopes");
const promptRoot = path.join(runRoot, "prompt_requests");
const outputRoot = path.join(runRoot, "outputs/shots");
const providerObservationRoot = path.join(runRoot, "provider_observations");
const workerProvenanceRoot = path.join(runRoot, "worker_provenance");
const semanticQaRoot = path.join(runRoot, "semantic_qa");
const reportsRoot = path.join(runRoot, "reports");
const runtimeTruthWatcherPath = path.join(reportsRoot, "runtime_truth_watcher_events.json");

const generatedAt = new Date().toISOString();
const projectId = "real_demo_e2e_004_image2_start_frames";
const runId = "real_demo_e2e_004_image2_start_frames_run_20260507";
const requiredGates = ["identity", "scene", "style", "story", "neighbor", "output"];

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

function sha256Text(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function toId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

fs.rmSync(runRoot, { recursive: true, force: true });
for (const dir of [
  projectRoot,
  shotLayoutRoot,
  packetsRoot,
  envelopesRoot,
  promptRoot,
  outputRoot,
  providerObservationRoot,
  workerProvenanceRoot,
  semanticQaRoot,
  reportsRoot,
]) ensureDir(dir);

const roles = [
  {
    id: "char_naya",
    displayName: "Naya Chen",
    description:
      "28-year-old East Asian observatory archivist, short black bob tucked behind one ear, calm focused expression, charcoal utility jacket, pale gray shirt, small brass pendant.",
    mustPreserve: ["short black bob tucked behind one ear", "charcoal utility jacket", "pale gray shirt", "small brass pendant"],
    mustAvoid: ["long hair", "different age", "military uniform", "heavy makeup", "fantasy armor"],
  },
  {
    id: "char_ivo",
    displayName: "Ivo Mark",
    description:
      "early-30s systems engineer, close-cropped dark hair, lean build, dark green raincoat over black work shirt, square field tablet, reserved posture.",
    mustPreserve: ["close-cropped dark hair", "dark green raincoat", "square field tablet", "reserved posture"],
    mustAvoid: ["white lab coat", "helmet", "long hair", "bright red clothing", "military gear"],
  },
];

const scenes = [
  {
    id: "scene_observatory_archive",
    displayName: "Old observatory archive",
    description:
      "A circular old observatory archive at night, brass star map table in the center, curved shelves of worn notebooks, a silent dome slit overhead, moonlight and one low amber desk lamp.",
    spatialAnchors: ["brass star map table centered", "curved shelves on rear wall", "dome slit overhead camera-right", "single amber desk lamp on table"],
    mustAvoid: ["modern laboratory", "crowded office", "daylight", "large hologram", "fantasy library"],
  },
  {
    id: "scene_service_tunnel",
    displayName: "Rainy service tunnel",
    description:
      "A narrow concrete service tunnel below the observatory, wet floor, cable trays along the screen-left wall, dim green maintenance lights, sealed metal door at the far end.",
    spatialAnchors: ["cable trays stay on screen-left", "sealed metal door stays at far end", "shallow wet floor reflections", "green lights repeat into depth"],
    mustAvoid: ["subway platform", "wide highway tunnel", "bright sci-fi corridor", "open street", "crowds"],
  },
  {
    id: "scene_rooftop_array",
    displayName: "Windy rooftop antenna array",
    description:
      "A quiet rooftop antenna array before dawn, low white antenna dishes, distant observatory dome behind them, thin blue dawn line on the horizon, damp metal grating.",
    spatialAnchors: ["low antenna dishes in foreground", "distant observatory dome in background", "thin dawn horizon line", "damp metal grating underfoot"],
    mustAvoid: ["space station exterior", "city rooftop party", "bright noon sky", "giant satellite dish filling frame", "storm lightning"],
  },
];

const style = {
  id: "style_quiet_low_texture_sci_fi",
  displayName: "Quiet low-texture cinematic sci-fi",
  positive:
    "restrained cinematic science-fiction drama, natural 35mm lens language, grounded lighting, low texture, clean image, subtle film grain, precise composition, no visual clutter.",
  negative:
    "no heavy tactile texture, no hyper-detailed grime, no glossy AI sheen, no excessive particles, no bokeh blobs, no neon cyberpunk overload, no poster-like hero lighting, no text overlay.",
};

const shots = [
  ["S01", "scene_observatory_archive", ["char_naya"], "Naya enters the archive and notices the brass star map table.", "wide 35mm, eye level, locked tripod, full circular room geography visible", "Naya left third, body facing the table"],
  ["S02", "scene_observatory_archive", ["char_naya"], "Naya reads a handwritten coordinate note beside the open notebook.", "medium 50mm from table height, camera faces Naya across brass table", "Naya on same side as S01, hands lightly on table edge"],
  ["S03", "scene_observatory_archive", ["char_naya", "char_ivo"], "Ivo appears in the camera-left doorway and silently confirms the coordinate.", "quiet over-shoulder from behind Naya toward doorway", "Naya foreground right, Ivo doorway left, table still centered"],
  ["S04", "scene_service_tunnel", ["char_naya", "char_ivo"], "Naya and Ivo enter the damp service tunnel, keeping cable trays on their left.", "wide 28mm tunnel depth, locked perspective", "Naya foreground right, Ivo mid-left, both moving toward far door"],
  ["S05", "scene_service_tunnel", ["char_naya"], "Naya stops at a puddle reflection and listens to a distant mechanism.", "low medium shot, wet floor reflection but stable perspective", "Naya mid-frame, cable trays remain screen-left"],
  ["S06", "scene_service_tunnel", ["char_naya", "char_ivo"], "Ivo unlocks the sealed metal door while Naya watches the tunnel behind them.", "medium side profile, door keypad visible", "Ivo at far door, Naya half-turns behind him"],
  ["S07", "scene_service_tunnel", ["char_naya", "char_ivo"], "The door opens to a cold stairwell, but neither character steps through yet.", "over-the-shoulder from behind both characters, door centered", "Naya lower right, Ivo lower left, door open at far plane"],
  ["S08", "scene_rooftop_array", ["char_naya", "char_ivo"], "They emerge onto the rooftop antenna array before dawn and face the first signal.", "wide 35mm, low antenna dishes foreground, horizon line stable", "Naya and Ivo small silhouettes mid-ground, observatory dome behind"],
].map(([id, sceneId, roleIds, action, camera, actorPosition], index) => ({
  id,
  index: index + 1,
  sectionId: index < 3 ? "ACT_A" : index < 7 ? "ACT_B" : "ACT_C",
  sceneId,
  roleIds,
  title: action,
  durationSeconds: index < 3 ? 5 : 6,
  generationStatus: "real_image_planned",
  action,
  camera,
  actorPosition,
  continuity: "Preserve locked identities, scene geography, low-texture style, and neighbor-shot story continuity.",
}));

const shotById = Object.fromEntries(shots.map((shot) => [shot.id, shot]));
const sceneById = Object.fromEntries(scenes.map((scene) => [scene.id, scene]));
const roleById = Object.fromEntries(roles.map((role) => [role.id, role]));

function neighborSummary(shotId) {
  const shot = shotById[shotId];
  const index = shot.index - 1;
  return {
    previous: index > 0 ? { shotId: shots[index - 1].id, sceneId: shots[index - 1].sceneId, action: shots[index - 1].action } : null,
    current: { shotId: shot.id, sceneId: shot.sceneId, action: shot.action },
    next: index < shots.length - 1 ? { shotId: shots[index + 1].id, sceneId: shots[index + 1].sceneId, action: shots[index + 1].action } : null,
  };
}

function activeRoles(shot) {
  return shot.roleIds.map((roleId) => roleById[roleId]);
}

function buildPlan(shot) {
  const safeShot = toId(shot.id);
  return {
    shotId: shot.id,
    status: "real_image_planned",
    taskRunId: `task_run_${safeShot}_image2_start_real_demo_004`,
    taskPacketId: `task_packet_${safeShot}_image2_start_real_demo_004`,
    envelopeId: `subagent_envelope_${safeShot}_image2_start_real_demo_004`,
    workerProvenanceId: `worker_provenance_${safeShot}_image2_start_real_demo_004`,
    expectedOutputPath: repoPath(path.join(outputRoot, shot.id, "start.png")),
    providerObservationPath: repoPath(path.join(providerObservationRoot, `${shot.id}_start_provider_observation.json`)),
    workerProvenancePath: repoPath(path.join(workerProvenanceRoot, `${shot.id}_start_worker_provenance.json`)),
    semanticQaPath: repoPath(path.join(semanticQaRoot, `${shot.id}_start_semantic_qa.json`)),
    packetPath: repoPath(path.join(packetsRoot, `${shot.id}_start_frame_packet.md`)),
    envelopePath: repoPath(path.join(envelopesRoot, `${shot.id}_start_frame_envelope.json`)),
    promptRequestPath: repoPath(path.join(promptRoot, `${shot.id}_start_frame_prompt.md`)),
    runtimeTruthWatcherPath: repoPath(runtimeTruthWatcherPath),
  };
}

function imagePrompt(shot) {
  const scene = sceneById[shot.sceneId];
  const rolesText = activeRoles(shot).map((role) => `${role.displayName}: ${role.description}`).join("\n");
  return [
    `Create a 16:9 cinematic start frame for ${shot.id}: ${shot.action}`,
    `Active character locks:\n${rolesText}`,
    `Scene lock: ${scene.description}`,
    `Spatial anchors: ${scene.spatialAnchors.join("; ")}.`,
    `Camera and layout: ${shot.camera}. ${shot.actorPosition}.`,
    `Neighbor continuity: ${JSON.stringify(neighborSummary(shot.id))}`,
    `Style lock: ${style.positive}`,
    `Avoid: ${[...activeRoles(shot).flatMap((role) => role.mustAvoid), ...scene.mustAvoid, style.negative].join("; ")}.`,
    "No text overlays, no watermark, no UI diagram, no storyboard border, no poster composition, no video motion blur.",
  ].join("\n");
}

function providerTemplate(plan) {
  return {
    schemaVersion: "provider_observation_real_demo_e2e_004",
    providerObservationMode: "actual_provider_call_observed",
    provider: "openai_image2_via_agent_imagegen_subagent",
    subagentId: "FILL_BY_IMAGEGEN_SUBAGENT",
    workerId: "imagegen_subagent_worker",
    threadId: "FILL_BY_IMAGEGEN_SUBAGENT_THREAD_ID",
    turnId: "FILL_BY_IMAGEGEN_SUBAGENT_TURN_ID",
    toolCallId: "FILL_BY_IMAGEGEN_SUBAGENT_TOOL_CALL_ID",
    leaseId: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_ID",
    leaseStartedAt: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_STARTED_AT",
    leaseExpiresAt: "FILL_BY_IMAGEGEN_SUBAGENT_LEASE_EXPIRES_AT",
    retryBudget: 0,
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
  };
}

function workerTemplate(plan) {
  return {
    schemaVersion: "worker_provenance_real_demo_e2e_004",
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
  };
}

function qaTemplate(plan, shot) {
  return {
    schemaVersion: "semantic_qa_real_demo_e2e_004",
    semanticReviewMode: "template_pending_image_review",
    reviewerId: "FILL_BY_SEMANTIC_QA_REVIEWER",
    reviewedAt: "FILL_BY_SEMANTIC_QA_REVIEWER_ISO_TIME",
    projectId,
    runId,
    shotId: shot.id,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    outputSha256: "FILL_BY_SEMANTIC_QA_REVIEWER_OUTPUT_SHA256",
    reviewedOutputSha256: "FILL_BY_SEMANTIC_QA_REVIEWER_OUTPUT_SHA256",
    requiredGates,
    gateResults: Object.fromEntries(requiredGates.map((gateId) => [gateId, { status: "pending", severity: null, findings: [], evidence: "FILL_BY_SEMANTIC_QA_REVIEWER" }])),
    finalAssessment: { status: "pending", p0Findings: [], p1Findings: [], p2Findings: [], summary: "FILL_BY_SEMANTIC_QA_REVIEWER" },
  };
}

const shotPlans = shots.map(buildPlan);
const sourceIndexHash = sha256Text(JSON.stringify({ roles, scenes, style, shots }));

writeJson(path.join(projectRoot, "project.vibe"), { schemaVersion: "project_vibe_real_demo_e2e_004", projectId, runId, roleIds: roles.map((role) => role.id), sceneIds: scenes.map((scene) => scene.id), styleId: style.id });
writeJson(path.join(projectRoot, "visual_memory.json"), { roles, scenes, style });
writeJson(path.join(projectRoot, "story_flow.json"), { shots: shots.map((shot) => ({ id: shot.id, sceneId: shot.sceneId, roleIds: shot.roleIds, action: shot.action })) });
writeJson(path.join(projectRoot, "source_index.json"), { schemaVersion: "source_index_real_demo_e2e_004", sourceIndexHash, refs: ["project.vibe", "visual_memory.json", "story_flow.json", "shot_layouts/*.json"] });

for (const plan of shotPlans) {
  const shot = shotById[plan.shotId];
  const scene = sceneById[shot.sceneId];
  const rolesForShot = activeRoles(shot);
  const layout = { ...shot, scene, activeRoles: rolesForShot, style, neighborShots: neighborSummary(shot.id), expectedOutputPath: plan.expectedOutputPath };
  writeJson(path.join(shotLayoutRoot, `${shot.id}.json`), layout);
  ensureDir(path.dirname(path.join(repoRoot, plan.expectedOutputPath)));

  const envelope = {
    schemaVersion: "subagent_task_envelope_real_demo_e2e_004",
    projectId,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    shotId: shot.id,
    taskPurpose: "generate_image2_start_frame",
    sourceIndexHash,
    providerPolicy: {
      allowedProvider: "image2",
      executionLayer: "agent_imagegen_subagent",
      forbidden: ["seedance", "jimeng", "fast_model", "vip_channel", "text_to_video", "video_generation"],
    },
    lockedReferences: { roles: rolesForShot, scene, style },
    neighborShots: layout.neighborShots,
    mustPreserve: [...rolesForShot.flatMap((role) => role.mustPreserve), ...scene.spatialAnchors, shot.actorPosition, style.positive],
    mustAvoid: [...rolesForShot.flatMap((role) => role.mustAvoid), ...scene.mustAvoid, style.negative],
    expectedOutputContract: {
      outputPath: plan.expectedOutputPath,
      providerObservationPath: plan.providerObservationPath,
      workerProvenancePath: plan.workerProvenancePath,
      semanticQaPath: plan.semanticQaPath,
      runtimeTruthWatcherPath: plan.runtimeTruthWatcherPath,
      format: "png_or_jpeg_image",
      aspectRatio: "16:9",
    },
    qaChecklist: requiredGates,
  };
  writeJson(path.join(repoRoot, plan.envelopePath), envelope);

  const prompt = imagePrompt(shot);
  writeText(path.join(repoRoot, plan.promptRequestPath), `${prompt}\n`);
  writeJson(path.join(repoRoot, plan.semanticQaPath), qaTemplate(plan, shot));
  const packet = `# Real Demo E2E 004 - ${shot.id} Image2 Start Frame Packet

You are the Image2/imagegen subagent for Vibe Core Real Demo E2E 004.

Do not use Seedance, Jimeng, Fast model, VIP channel, text-to-video, or any video generation. Do not reuse fixture images. Do not copy files manually from previous tests.

## Expected Output
- Image path: \`${plan.expectedOutputPath}\`
- Provider observation sidecar: \`${plan.providerObservationPath}\`
- Worker provenance sidecar: \`${plan.workerProvenancePath}\`
- Semantic QA sidecar: \`${plan.semanticQaPath}\` will be completed by an independent reviewer, not by imagegen.
- Runtime truth watcher events: \`${plan.runtimeTruthWatcherPath}\`

## Locked Context
- Characters:
${rolesForShot.map((role) => `  - ${role.displayName}: ${role.description}`).join("\n")}
- Scene: ${scene.displayName} - ${scene.description}
- Style: ${style.displayName} - ${style.positive}

## Neighbor Shots
\`\`\`json
${JSON.stringify(neighborSummary(shot.id), null, 2)}
\`\`\`

## Image Prompt
\`\`\`text
${prompt}
\`\`\`

## Provider Observation Template
\`\`\`json
${JSON.stringify(providerTemplate(plan), null, 2)}
\`\`\`

## Worker Provenance Template
\`\`\`json
${JSON.stringify(workerTemplate(plan), null, 2)}
\`\`\`
`;
  writeText(path.join(repoRoot, plan.packetPath), packet);
}

writeJson(path.join(runRoot, "ui_action.json"), { schemaVersion: "ui_action_real_demo_e2e_004", actionId: "start_8_image2_start_frame_long_chain", runId, createdAt: generatedAt });
writeJson(path.join(runRoot, "run_manifest.json"), {
  schemaVersion: "real_demo_e2e_004_image2_start_frames_manifest_v1",
  projectId,
  runId,
  generatedAt,
  status: "waiting_for_imagegen_subagents",
  declaration: "waiting_for_actual_provider_observed",
  runRoot: repoPath(runRoot),
  projectRoot: repoPath(projectRoot),
  outputRoot: repoPath(outputRoot),
  providerObservationRoot: repoPath(providerObservationRoot),
  workerProvenanceRoot: repoPath(workerProvenanceRoot),
  semanticQaRoot: repoPath(semanticQaRoot),
  runtimeTruthWatcherPath: repoPath(runtimeTruthWatcherPath),
  uiActionPath: repoPath(path.join(runRoot, "ui_action.json")),
  projectFacts: {
    projectVibePath: repoPath(path.join(projectRoot, "project.vibe")),
    sourceIndexPath: repoPath(path.join(projectRoot, "source_index.json")),
    visualMemoryPath: repoPath(path.join(projectRoot, "visual_memory.json")),
    storyFlowPath: repoPath(path.join(projectRoot, "story_flow.json")),
    shotLayoutRoot: repoPath(shotLayoutRoot),
  },
  scenario: { totalShots: shots.length, scenes: scenes.map((scene) => scene.id), roles: roles.map((role) => role.id), style: style.id, actualProvider: "image2" },
  shotPlans,
  imagegenSubagentPackets: shotPlans.map((plan) => plan.packetPath),
  verifyCommand: "npm run real-demo-e2e-004:verify",
  notes: ["004 is a real Image2 start-frame long-chain test. It prepares only; Image2 calls must be done by subagents."],
});

console.log("Real Demo E2E 004 Image2 start-frame long chain prepared.");
console.log(`Run root: ${repoPath(runRoot)}`);
console.log(`Image2 planned frames: ${shotPlans.length}`);
for (const packet of shotPlans.map((plan) => plan.packetPath)) console.log(`- ${packet}`);
