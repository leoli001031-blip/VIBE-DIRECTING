import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames");
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
const projectId = "real_demo_e2e_005_anime_image2_start_frames";
const runId = "real_demo_e2e_005_anime_image2_start_frames_run_20260507";
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
    id: "char_mika",
    displayName: "Mika Aoyama",
    description:
      "original 2D Japanese anime heroine, 17-year-old signal-club student, shoulder-length indigo-black hair with straight bangs, a small red star hairpin above her left temple, amber eyes, navy cropped field jacket over a white sailor-collar shirt, cream scarf, slim silhouette, quiet determined expression.",
    mustPreserve: [
      "shoulder-length indigo-black hair with straight bangs",
      "small red star hairpin above her left temple",
      "amber eyes",
      "navy cropped field jacket over a white sailor-collar shirt",
      "cream scarf",
      "quiet determined expression",
    ],
    mustAvoid: [
      "photorealistic human",
      "live-action face",
      "3D render",
      "different hair length",
      "missing red star hairpin",
      "different eye color",
      "adult age",
      "heavy makeup",
    ],
  },
  {
    id: "char_ren",
    displayName: "Ren Kisaragi",
    description:
      "original 2D Japanese anime supporting boy, 18-year-old radio-club technician, short ash-brown hair, narrow gray eyes, olive hooded parka, black fingerless gloves, compact radio tablet, reserved posture.",
    mustPreserve: [
      "short ash-brown hair",
      "narrow gray eyes",
      "olive hooded parka",
      "black fingerless gloves",
      "compact radio tablet",
      "reserved posture",
    ],
    mustAvoid: ["photorealistic human", "3D render", "long hair", "school blazer", "bright red clothing", "military gear"],
  },
];

const scenes = [
  {
    id: "scene_observatory_archive",
    displayName: "Abandoned school observatory archive",
    description:
      "A circular abandoned school observatory archive at night in a 2D anime film, brass star map table in the center, curved shelves of worn astronomy notebooks, silent dome slit overhead, moonlight and one low amber desk lamp.",
    spatialAnchors: ["brass star map table centered", "curved shelves on rear wall", "dome slit overhead camera-right", "single amber desk lamp on table"],
    mustAvoid: ["photorealistic laboratory", "crowded office", "daylight", "large hologram", "fantasy library"],
  },
  {
    id: "scene_service_tunnel",
    displayName: "Rainy school service tunnel",
    description:
      "A narrow concrete service tunnel below the school observatory in a 2D anime film, wet floor, cable trays along the screen-left wall, dim green maintenance lights, sealed metal door at the far end.",
    spatialAnchors: ["cable trays stay on screen-left", "sealed metal door stays at far end", "shallow wet floor reflections", "green lights repeat into depth"],
    mustAvoid: ["photorealistic subway platform", "wide highway tunnel", "bright sci-fi corridor", "open street", "crowds"],
  },
  {
    id: "scene_rooftop_array",
    displayName: "Windy anime rooftop antenna array",
    description:
      "A quiet school rooftop antenna array before dawn in a 2D anime film, low white antenna dishes, distant observatory dome behind them, thin blue dawn line on the horizon, damp metal grating.",
    spatialAnchors: ["low antenna dishes in foreground", "distant observatory dome in background", "thin dawn horizon line", "damp metal grating underfoot"],
    mustAvoid: ["space station exterior", "city rooftop party", "bright noon sky", "giant satellite dish filling frame", "storm lightning", "photorealistic cityscape"],
  },
];

const style = {
  id: "style_quiet_2d_anime_sci_fi",
  displayName: "Quiet 2D Japanese anime sci-fi film",
  positive:
    "original 2D Japanese anime film frame, clean cel shading, crisp but gentle line art, low texture, soft painted backgrounds, restrained cinematic science-fiction mood, stable 16:9 composition, subtle atmospheric lighting, no visual clutter.",
  negative:
    "no photorealistic human, no live action, no 3D render, no hyper-detailed skin texture, no glossy AI sheen, no heavy tactile texture, no excessive particles, no bokeh blobs, no neon cyberpunk overload, no text overlay, no manga panel border.",
};

const identityGatePolicies = {
  full: {
    previewRule: "Full identity gate requires visible face, eye color, hair shape or hairpin, and primary clothing anchors.",
    productionRule: "If face, eyes, or required character-specific anchors are not readable, mark identity needs_review or blocked by severity.",
    faceAndEyesRequired: true,
  },
  partial: {
    previewRule:
      "Partial identity gate does not require eyes or a full face when the planned camera hides them; verify visible hair shape, hairpin or color blocks, clothing silhouette, props, and relative position.",
    productionRule: "Keep production needs_review when face or eye anchors are hidden, even if visible continuity anchors pass.",
    faceAndEyesRequired: false,
  },
  continuity_only: {
    previewRule:
      "Continuity-only identity gate is for long shots or silhouettes; do not require face, eyes, or fine hairpin detail, and verify scene role continuity, readable silhouettes, color blocks, props when visible, and relative position.",
    productionRule: "Keep production needs_review when character identity cannot be fully confirmed from the planned distance.",
    faceAndEyesRequired: false,
  },
  not_applicable: {
    previewRule: "No character identity gate is required for this shot.",
    productionRule: "Production identity review is not applicable.",
    faceAndEyesRequired: false,
  },
};

const identityContracts = {
  S01: {
    characterVisibility: "three_quarter",
    identityVerificationMode: "partial",
    faceRequired: false,
    requiredVisibleAnchors: ["Mika shoulder-length indigo-black hair shape", "red star hairpin", "navy field jacket over sailor-collar shirt", "cream scarf", "Mika left-third position near brass table"],
  },
  S02: {
    characterVisibility: "front_view",
    identityVerificationMode: "full",
    faceRequired: true,
    requiredVisibleAnchors: ["Mika face", "amber eyes", "straight bangs", "red star hairpin", "cream scarf", "quiet determined expression"],
  },
  S03: {
    characterVisibility: "three_quarter",
    identityVerificationMode: "partial",
    faceRequired: false,
    requiredVisibleAnchors: ["Mika foreground hair shape", "red star hairpin", "Mika navy and cream costume silhouette", "Ren short ash-brown hair", "Ren olive parka", "Ren camera-left doorway position"],
  },
  S04: {
    characterVisibility: "three_quarter",
    identityVerificationMode: "partial",
    faceRequired: false,
    requiredVisibleAnchors: ["Mika navy and cream silhouette", "Mika foreground-right position", "Ren olive parka silhouette", "Ren mid-left position", "paired movement toward far door"],
  },
  S05: {
    characterVisibility: "three_quarter",
    identityVerificationMode: "full",
    faceRequired: true,
    requiredVisibleAnchors: ["Mika face", "amber eyes", "red star hairpin", "cream scarf", "quiet listening expression", "cable trays screen-left"],
  },
  S06: {
    characterVisibility: "profile",
    identityVerificationMode: "partial",
    faceRequired: false,
    requiredVisibleAnchors: ["Ren side-profile hair shape", "Ren olive parka", "Ren radio tablet at keypad", "Mika half-turned navy and cream silhouette", "sealed metal door position"],
  },
  S07: {
    characterVisibility: "back_view",
    identityVerificationMode: "partial",
    faceRequired: false,
    requiredVisibleAnchors: ["Mika shoulder-length indigo-black hair silhouette", "Mika red star hairpin if visible from rear angle", "Mika navy and cream clothing silhouette", "Ren short ash-brown hair silhouette", "Ren olive parka silhouette", "Mika lower-right and Ren lower-left relative position"],
  },
  S08: {
    characterVisibility: "long_shot",
    identityVerificationMode: "continuity_only",
    faceRequired: false,
    requiredVisibleAnchors: ["two-character silhouette continuity from S07", "Mika smaller slim navy and cream silhouette", "Ren olive parka silhouette", "Ren tablet or compact prop when readable", "characters together facing the signal", "observatory dome and rooftop array geography"],
  },
};

function identityContractFor(shotId) {
  const contract = identityContracts[shotId];
  return {
    ...contract,
    identityGatePolicy: identityGatePolicies[contract.identityVerificationMode],
  };
}

const shots = [
  ["S01", "scene_observatory_archive", ["char_mika"], "Mika enters the abandoned observatory archive and notices the brass star map table.", "wide anime film frame, eye level, locked tripod feeling, full circular room geography visible", "Mika left third, body facing the table, red star hairpin clearly visible"],
  ["S02", "scene_observatory_archive", ["char_mika"], "Mika leans over a handwritten coordinate note beside the open notebook.", "medium anime film frame from table height, camera faces Mika across brass table", "Mika on same side as S01, hands lightly on table edge, cream scarf visible"],
  ["S03", "scene_observatory_archive", ["char_mika", "char_ren"], "Ren appears in the camera-left doorway and silently confirms the coordinate.", "quiet over-shoulder anime frame from behind Mika toward doorway", "Mika foreground right with red hairpin, Ren doorway left, table still centered"],
  ["S04", "scene_service_tunnel", ["char_mika", "char_ren"], "Mika and Ren enter the damp service tunnel, keeping cable trays on their left.", "wide anime film frame, tunnel depth, locked perspective", "Mika foreground right, Ren mid-left, both moving toward far door"],
  ["S05", "scene_service_tunnel", ["char_mika"], "Mika stops at a puddle reflection and listens to a distant mechanism.", "low medium anime frame, wet floor reflection but stable perspective", "Mika mid-frame, red star hairpin and cream scarf still readable, cable trays remain screen-left"],
  ["S06", "scene_service_tunnel", ["char_mika", "char_ren"], "Ren unlocks the sealed metal door while Mika watches the tunnel behind them.", "medium side-profile anime frame, door keypad visible", "Ren at far door with radio tablet, Mika half-turns behind him"],
  ["S07", "scene_service_tunnel", ["char_mika", "char_ren"], "The door opens to a cold stairwell, but neither character steps through yet.", "over-the-shoulder anime frame from behind both characters, door centered", "Mika lower right, Ren lower left, door open at far plane"],
  ["S08", "scene_rooftop_array", ["char_mika", "char_ren"], "Mika and Ren emerge onto the rooftop antenna array before dawn and face the first signal.", "wide anime film frame, low antenna dishes foreground, horizon line stable", "Mika and Ren small silhouettes mid-ground, observatory dome behind"],
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
  continuity: "Preserve locked 2D anime character designs, scene geography, clean cel-shaded style, and neighbor-shot story continuity.",
  ...identityContractFor(id),
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
    taskRunId: `task_run_${safeShot}_image2_start_real_demo_005`,
    taskPacketId: `task_packet_${safeShot}_image2_start_real_demo_005`,
    envelopeId: `subagent_envelope_${safeShot}_image2_start_real_demo_005`,
    workerProvenanceId: `worker_provenance_${safeShot}_image2_start_real_demo_005`,
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
  const identityContract = {
    characterVisibility: shot.characterVisibility,
    identityVerificationMode: shot.identityVerificationMode,
    faceRequired: shot.faceRequired,
    requiredVisibleAnchors: shot.requiredVisibleAnchors,
    identityGatePolicy: shot.identityGatePolicy,
  };
  return [
    `Create a 16:9 original 2D Japanese anime cinematic start frame for ${shot.id}: ${shot.action}`,
    "This must look like a clean hand-drawn anime film frame, not live action, not photorealistic, not 3D.",
    "Primary consistency test: Mika Aoyama must remain the same anime character design across every shot where she appears.",
    `Identity visibility contract: ${JSON.stringify(identityContract)}`,
    "For preview QA, obey the identity visibility contract before deciding whether hidden face or eye anchors should block the frame.",
    `Active character locks:\n${rolesText}`,
    `Hard identity anchors: ${activeRoles(shot).flatMap((role) => role.mustPreserve).join("; ")}.`,
    `Scene lock: ${scene.description}`,
    `Spatial anchors: ${scene.spatialAnchors.join("; ")}.`,
    `Camera and layout: ${shot.camera}. ${shot.actorPosition}.`,
    `Neighbor continuity: ${JSON.stringify(neighborSummary(shot.id))}`,
    `Style lock: ${style.positive}`,
    `Avoid: ${[...activeRoles(shot).flatMap((role) => role.mustAvoid), ...scene.mustAvoid, style.negative].join("; ")}.`,
    "No text overlays, no watermark, no UI diagram, no storyboard border, no manga panel border, no poster composition, no video motion blur.",
  ].join("\n");
}

function providerTemplate(plan) {
  return {
    schemaVersion: "provider_observation_real_demo_e2e_005",
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
    schemaVersion: "worker_provenance_real_demo_e2e_005",
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
  const identityContract = {
    characterVisibility: shot.characterVisibility,
    identityVerificationMode: shot.identityVerificationMode,
    faceRequired: shot.faceRequired,
    requiredVisibleAnchors: shot.requiredVisibleAnchors,
    identityGatePolicy: shot.identityGatePolicy,
  };
  return {
    schemaVersion: "semantic_qa_real_demo_e2e_005",
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
    identityVisibilityContract: identityContract,
    previewReadinessGuidance:
      "For partial, back_view, long_shot, silhouette, or continuity_only shots, hidden eyes or facial expression alone should be identity needs_review for production, not a preview blocker, when required visible anchors and every non-identity gate pass.",
    productionReadinessGuidance:
      "Production remains needs_review whenever identity anchors required for a clean final pass are hidden or unconfirmable, even if the frame is preview-ready.",
    gateResults: Object.fromEntries(requiredGates.map((gateId) => [gateId, { status: "pending", severity: null, findings: [], evidence: "FILL_BY_SEMANTIC_QA_REVIEWER" }])),
    finalAssessment: { status: "pending", p0Findings: [], p1Findings: [], p2Findings: [], summary: "FILL_BY_SEMANTIC_QA_REVIEWER" },
  };
}

const shotPlans = shots.map(buildPlan);
const sourceIndexHash = sha256Text(JSON.stringify({ roles, scenes, style, shots }));

writeJson(path.join(projectRoot, "project.vibe"), { schemaVersion: "project_vibe_real_demo_e2e_005", projectId, runId, roleIds: roles.map((role) => role.id), sceneIds: scenes.map((scene) => scene.id), styleId: style.id });
writeJson(path.join(projectRoot, "visual_memory.json"), { roles, scenes, style });
writeJson(path.join(projectRoot, "story_flow.json"), { shots: shots.map((shot) => ({ id: shot.id, sceneId: shot.sceneId, roleIds: shot.roleIds, action: shot.action })) });
writeJson(path.join(projectRoot, "source_index.json"), { schemaVersion: "source_index_real_demo_e2e_005", sourceIndexHash, refs: ["project.vibe", "visual_memory.json", "story_flow.json", "shot_layouts/*.json"] });

for (const plan of shotPlans) {
  const shot = shotById[plan.shotId];
  const scene = sceneById[shot.sceneId];
  const rolesForShot = activeRoles(shot);
  const layout = { ...shot, scene, activeRoles: rolesForShot, style, neighborShots: neighborSummary(shot.id), expectedOutputPath: plan.expectedOutputPath };
  writeJson(path.join(shotLayoutRoot, `${shot.id}.json`), layout);
  ensureDir(path.dirname(path.join(repoRoot, plan.expectedOutputPath)));

  const envelope = {
    schemaVersion: "subagent_task_envelope_real_demo_e2e_005",
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
      executionLayer: "codex_imagegen_subagent",
      forbidden: ["seedance", "jimeng", "fast_model", "vip_channel", "text_to_video", "video_generation"],
    },
    lockedReferences: { roles: rolesForShot, scene, style },
    identityVisibilityContract: {
      characterVisibility: shot.characterVisibility,
      identityVerificationMode: shot.identityVerificationMode,
      faceRequired: shot.faceRequired,
      requiredVisibleAnchors: shot.requiredVisibleAnchors,
      identityGatePolicy: shot.identityGatePolicy,
    },
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
    qaGuidance:
      "Apply the identity visibility contract: planned back/long/profile shots can be preview-ready with identity review overlay when hidden face/eye anchors are the only review finding.",
  };
  writeJson(path.join(repoRoot, plan.envelopePath), envelope);

  const prompt = imagePrompt(shot);
  writeText(path.join(repoRoot, plan.promptRequestPath), `${prompt}\n`);
  writeJson(path.join(repoRoot, plan.semanticQaPath), qaTemplate(plan, shot));
  const packet = `# Real Demo E2E 005 - ${shot.id} Image2 Start Frame Packet

You are the Image2/imagegen subagent for Vibe Core Real Demo E2E 005.

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

## Identity Visibility Contract
\`\`\`json
${JSON.stringify(envelope.identityVisibilityContract, null, 2)}
\`\`\`

## QA Guidance
- Preview readiness: if this is partial/back_view/long_shot/continuity_only and the only review issue is hidden face or eye identity anchors, mark preview as ready with review overlay rather than blocked.
- Production readiness: keep identity needs_review until full required anchors are confirmable.
- Block only for missing output/provider/worker/hash/runtime-truth evidence, P0, or a blocked gate.

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

writeJson(path.join(runRoot, "ui_action.json"), { schemaVersion: "ui_action_real_demo_e2e_005", actionId: "start_8_image2_start_frame_long_chain", runId, createdAt: generatedAt });
writeJson(path.join(runRoot, "run_manifest.json"), {
  schemaVersion: "real_demo_e2e_005_anime_image2_start_frames_manifest_v1",
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
  verifyCommand: "npm run real-demo-e2e-005:verify",
  notes: ["005 is a real Image2 start-frame long-chain test. It prepares only; Image2 calls must be done by subagents."],
});

console.log("Real Demo E2E 005 Image2 start-frame long chain prepared.");
console.log(`Run root: ${repoPath(runRoot)}`);
console.log(`Image2 planned frames: ${shotPlans.length}`);
for (const packet of shotPlans.map((plan) => plan.packetPath)) console.log(`- ${packet}`);
