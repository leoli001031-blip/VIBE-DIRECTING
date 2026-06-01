import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/003-long-chain-software");
const projectRoot = path.join(runRoot, "project");
const shotLayoutRoot = path.join(projectRoot, "shot_layouts");
const packetsRoot = path.join(runRoot, "task_packets");
const envelopesRoot = path.join(runRoot, "subagent_envelopes");
const outputRoot = path.join(runRoot, "outputs/shots");
const providerObservationRoot = path.join(runRoot, "provider_observations");
const workerProvenanceRoot = path.join(runRoot, "worker_provenance");
const semanticQaRoot = path.join(runRoot, "semantic_qa");
const reportsRoot = path.join(runRoot, "reports");
const watcherEventsPath = path.join(reportsRoot, "runtime_truth_watcher_events.json");

const generatedAt = new Date().toISOString();
const projectId = "real_demo_e2e_003_long_chain_software";
const runId = "real_demo_e2e_003_long_chain_software_run_20260507";
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

function sha256File(filePath) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function toId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function crc32(buffer) {
  let c = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    c ^= buffer[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writeSoftwareLayerPng(filePath, seed, width = 320, height = 180) {
  const hash = crypto.createHash("sha256").update(seed).digest();
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = (hash[0] + x * 2 + y) % 256;
      raw[offset + 1] = (hash[8] + x + y * 2) % 256;
      raw[offset + 2] = (hash[16] + x + y + hash[24]) % 256;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}

fs.rmSync(runRoot, { recursive: true, force: true });
for (const dir of [
  projectRoot,
  shotLayoutRoot,
  packetsRoot,
  envelopesRoot,
  outputRoot,
  providerObservationRoot,
  workerProvenanceRoot,
  semanticQaRoot,
  reportsRoot,
]) {
  ensureDir(dir);
}

const roles = [
  {
    id: "char_naya",
    displayName: "Naya Chen",
    description: "observatory archivist, short black bob, charcoal utility jacket, pale gray shirt, brass pendant",
    mustPreserve: ["short black bob", "charcoal utility jacket", "small brass pendant"],
  },
  {
    id: "char_ivo",
    displayName: "Ivo Mark",
    description: "systems engineer, close-cropped hair, dark green raincoat, square field tablet",
    mustPreserve: ["dark green raincoat", "square field tablet", "reserved posture"],
  },
];

const scenes = [
  {
    id: "scene_observatory_archive",
    displayName: "Old observatory archive",
    anchors: ["brass star map table centered", "curved shelves on rear wall", "moonlit dome slit overhead"],
  },
  {
    id: "scene_service_tunnel",
    displayName: "Rainy service tunnel",
    anchors: ["cable trays on screen-left", "wet concrete floor", "sealed metal door at far end"],
  },
  {
    id: "scene_rooftop_array",
    displayName: "Windy rooftop antenna array",
    anchors: ["low antenna dishes", "distant observatory dome", "thin dawn line on horizon"],
  },
];

const style = {
  id: "style_quiet_low_texture_sci_fi",
  displayName: "Quiet low-texture cinematic sci-fi",
  positive: "restrained cinematic sci-fi, stable 16:9 frame, low texture, clean lighting, precise composition",
  negative: "no heavy tactile texture, no glossy AI sheen, no UI mockup, no poster text",
};

const shots = [
  ["S01", "scene_observatory_archive", ["char_naya"], "Naya enters the archive and notices the star map table."],
  ["S02", "scene_observatory_archive", ["char_naya"], "Naya reads a coordinate note beside the open notebook."],
  ["S03", "scene_observatory_archive", ["char_naya", "char_ivo"], "Ivo appears in the doorway and silently confirms the coordinate."],
  ["S04", "scene_service_tunnel", ["char_naya", "char_ivo"], "They enter the tunnel and keep the cable trays on their left."],
  ["S05", "scene_service_tunnel", ["char_naya"], "Naya stops at a puddle reflection and hears a distant mechanism."],
  ["S06", "scene_service_tunnel", ["char_naya", "char_ivo"], "Ivo unlocks the sealed door without opening it yet."],
  ["S07", "scene_service_tunnel", ["char_naya", "char_ivo"], "The door opens to a stairwell with cold air rising."],
  ["S08", "scene_rooftop_array", ["char_naya", "char_ivo"], "They emerge onto the rooftop antenna array before dawn."],
  ["S09", "scene_rooftop_array", ["char_naya"], "Naya aligns a dish toward the thin horizon line."],
  ["S10", "scene_rooftop_array", ["char_naya", "char_ivo"], "The two watch the array receive the first signal."],
].map(([id, sceneId, roleIds, action], index) => ({
  id,
  index: index + 1,
  sceneId,
  roleIds,
  action,
  durationSeconds: index < 3 ? 5 : 6,
  camera: index % 3 === 0 ? "wide locked frame" : index % 3 === 1 ? "medium eye-level frame" : "quiet over-shoulder frame",
  status: "returned",
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

function buildPlan(shot) {
  const safeShot = toId(shot.id);
  return {
    shotId: shot.id,
    status: "returned",
    taskRunId: `task_run_${safeShot}_software_long_chain_003`,
    taskPacketId: `task_packet_${safeShot}_software_long_chain_003`,
    envelopeId: `subagent_envelope_${safeShot}_software_long_chain_003`,
    workerProvenanceId: `worker_provenance_${safeShot}_software_long_chain_003`,
    expectedOutputPath: repoPath(path.join(outputRoot, shot.id, "start.png")),
    providerObservationPath: repoPath(path.join(providerObservationRoot, `${shot.id}_provider_observation.json`)),
    workerProvenancePath: repoPath(path.join(workerProvenanceRoot, `${shot.id}_worker_provenance.json`)),
    semanticQaPath: repoPath(path.join(semanticQaRoot, `${shot.id}_semantic_qa.json`)),
    packetPath: repoPath(path.join(packetsRoot, `${shot.id}_packet.md`)),
    envelopePath: repoPath(path.join(envelopesRoot, `${shot.id}_envelope.json`)),
    runtimeTruthWatcherPath: repoPath(watcherEventsPath),
  };
}

const shotPlans = shots.map(buildPlan);

const projectFacts = {
  projectId,
  runId,
  scenarioId: "real_demo_e2e_003_long_chain_software",
  mode: "software_layer_long_chain_only",
  providerPolicy: {
    actualProvidersCalled: false,
    forbidden: ["image2", "seedance", "jimeng", "fast_model", "vip_channel", "text_to_video", "video_generation"],
  },
  roles,
  scenes,
  style,
  shots,
};

writeJson(path.join(projectRoot, "project.vibe"), {
  schemaVersion: "project_vibe_software_long_chain_003",
  projectId,
  runId,
  lockedRoles: roles.map((role) => role.id),
  lockedScenes: scenes.map((scene) => scene.id),
  styleId: style.id,
});
writeJson(path.join(projectRoot, "visual_memory.json"), { roles, scenes, style });
writeJson(path.join(projectRoot, "story_flow.json"), { shots: shots.map((shot) => ({ id: shot.id, sceneId: shot.sceneId, action: shot.action })) });
writeJson(path.join(projectRoot, "source_index.json"), {
  schemaVersion: "source_index_software_long_chain_003",
  sourceIndexHash: sha256Text(JSON.stringify(projectFacts)),
  refs: ["project.vibe", "visual_memory.json", "story_flow.json", "shot_layouts/*.json"],
});

const watcherEvents = [];

for (const plan of shotPlans) {
  const shot = shotById[plan.shotId];
  const scene = sceneById[shot.sceneId];
  const activeRoles = shot.roleIds.map((roleId) => roleById[roleId]);
  const layout = {
    ...shot,
    scene,
    activeRoles,
    style,
    neighborShots: neighborSummary(shot.id),
    expectedOutputPath: plan.expectedOutputPath,
  };
  writeJson(path.join(shotLayoutRoot, `${shot.id}.json`), layout);

  const envelope = {
    schemaVersion: "subagent_envelope_software_long_chain_003",
    projectId,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    shotId: shot.id,
    executionMode: "software_layer_fixture_no_provider",
    lockedReferences: { roles: activeRoles, scene, style },
    neighborShots: layout.neighborShots,
    expectedOutputContract: {
      outputPath: plan.expectedOutputPath,
      providerObservationPath: plan.providerObservationPath,
      workerProvenancePath: plan.workerProvenancePath,
      semanticQaPath: plan.semanticQaPath,
      runtimeTruthWatcherPath: plan.runtimeTruthWatcherPath,
    },
    qaChecklist: requiredGates,
  };
  writeJson(path.join(repoRoot, plan.envelopePath), envelope);

  writeText(path.join(repoRoot, plan.packetPath), [
    `# Real Demo E2E 003 Long Chain Software - ${shot.id}`,
    "",
    "Software-layer fixture only. Do not call Image2, Seedance, Jimeng, Fast, VIP, text-to-video, or video providers.",
    `Shot action: ${shot.action}`,
    `Scene: ${scene.displayName}`,
    `Roles: ${activeRoles.map((role) => role.displayName).join(", ")}`,
    `Expected output: ${plan.expectedOutputPath}`,
    `Semantic gates: ${requiredGates.join(", ")}`,
    "",
  ].join("\n"));

  const outputAbsolutePath = path.join(repoRoot, plan.expectedOutputPath);
  writeSoftwareLayerPng(outputAbsolutePath, `${runId}:${shot.id}:${shot.action}`);
  const outputSha256 = sha256File(outputAbsolutePath);
  const observedAt = new Date(Date.parse(generatedAt) + shot.index * 1000).toISOString();

  writeJson(path.join(repoRoot, plan.providerObservationPath), {
    schemaVersion: "provider_observation_software_long_chain_003",
    providerObservationMode: "mock_readiness_evidence",
    provider: "software_layer_fixture_no_provider_call",
    providerCallObserved: false,
    actualProviderCalled: false,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    outputSha256,
    generatedAt: observedAt,
    providerSelfReportCompletesTask: false,
    manualFileCopyDetected: false,
    fixtureReuseDetected: false,
  });

  writeJson(path.join(repoRoot, plan.workerProvenancePath), {
    schemaVersion: "worker_provenance_software_long_chain_003",
    sidecarKind: "worker_provenance",
    provenanceMode: "software_layer_subagent_worker_fixture",
    runId,
    workerId: "software_long_chain_worker",
    subagentId: "software_layer_harness",
    threadId: "software_layer_thread_003",
    turnId: `software_layer_turn_${shot.id}`,
    toolCallId: `software_layer_fixture_write_${shot.id}`,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    leaseStartedAt: observedAt,
    leaseExpiresAt: new Date(Date.parse(observedAt) + 30 * 60 * 1000).toISOString(),
    retryBudget: 0,
  });

  writeJson(path.join(repoRoot, plan.semanticQaPath), {
    schemaVersion: "semantic_qa_software_long_chain_003",
    semanticReviewMode: "software_layer_semantic_gate_fixture",
    reviewerId: "software_layer_long_chain_qa",
    reviewedAt: observedAt,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    outputSha256,
    reviewedOutputSha256: outputSha256,
    gateResults: Object.fromEntries(requiredGates.map((gateId) => [gateId, {
      status: "pass",
      severity: null,
      findings: [],
      evidence: `${gateId} software-layer gate passed for ${shot.id}`,
    }])),
    finalAssessment: {
      status: "pass",
      p0Findings: [],
      p1Findings: [],
      p2Findings: [],
      summary: "Software-layer long-chain fixture passed all structural semantic gates.",
    },
  });

  for (const [eventIndex, eventType] of ["file_observed", "file_stable", "hash_recorded", "provider_observation_paired", "semantic_qa_paired"].entries()) {
    watcherEvents.push({
      eventId: `watcher_003_${shot.id}_${eventType}`,
      sequence: watcherEvents.length + 1,
      eventType,
      sourceKind: "software_layer_fs_event",
      occurredAt: new Date(Date.parse(observedAt) + eventIndex * 100).toISOString(),
      runId,
      shotId: shot.id,
      taskRunId: plan.taskRunId,
      taskPacketId: plan.taskPacketId,
      envelopeId: plan.envelopeId,
      artifactPath: plan.expectedOutputPath,
      outputPath: plan.expectedOutputPath,
      outputSha256,
      sidecarPath: eventType === "provider_observation_paired"
        ? plan.providerObservationPath
        : eventType === "semantic_qa_paired"
          ? plan.semanticQaPath
          : undefined,
    });
  }
}

writeJson(watcherEventsPath, {
  schemaVersion: "runtime_truth_watcher_events_software_long_chain_003",
  generatedAt,
  runId,
  sourceKind: "software_layer_fs_event",
  eventSource: "software_layer_prepare_fixture",
  events: watcherEvents,
  notes: ["Software-layer watcher events only; these are not app_server_fs_changed and cannot prove real provider generation."],
});

writeJson(path.join(runRoot, "ui_action.json"), {
  schemaVersion: "ui_action_software_long_chain_003",
  actionId: "start_software_long_chain_test",
  runId,
  createdAt: generatedAt,
});

writeJson(path.join(runRoot, "run_manifest.json"), {
  schemaVersion: "real_demo_e2e_003_long_chain_software_manifest_v1",
  projectId,
  runId,
  generatedAt,
  status: "software_layer_outputs_ready",
  declaration: "readiness_harness_only",
  runRoot: repoPath(runRoot),
  projectRoot: repoPath(projectRoot),
  outputRoot: repoPath(outputRoot),
  providerObservationRoot: repoPath(providerObservationRoot),
  workerProvenanceRoot: repoPath(workerProvenanceRoot),
  semanticQaRoot: repoPath(semanticQaRoot),
  runtimeTruthWatcherPath: repoPath(watcherEventsPath),
  uiActionPath: repoPath(path.join(runRoot, "ui_action.json")),
  projectFacts: {
    projectVibePath: repoPath(path.join(projectRoot, "project.vibe")),
    sourceIndexPath: repoPath(path.join(projectRoot, "source_index.json")),
    visualMemoryPath: repoPath(path.join(projectRoot, "visual_memory.json")),
    storyFlowPath: repoPath(path.join(projectRoot, "story_flow.json")),
    shotLayoutRoot: repoPath(shotLayoutRoot),
  },
  scenario: {
    totalShots: shots.length,
    scenes: scenes.map((scene) => scene.id),
    roles: roles.map((role) => role.id),
    style: style.id,
    actualProvidersCalled: false,
  },
  shotPlans,
  verifyCommand: "npm run real-demo-e2e-003:verify",
  notes: [
    "Software-layer long-chain pressure test. It writes deterministic PNG fixtures and sidecars.",
    "No Image2, Seedance, Jimeng, Fast, VIP, text-to-video, or video provider is called.",
    "This run can validate orchestration shape only; it must not be presented as real generation completion.",
  ],
});

console.log("Real Demo E2E 003 Long Chain Software prepared.");
console.log(`Run root: ${repoPath(runRoot)}`);
console.log(`Shot count: ${shots.length}`);
console.log(`Watcher events: ${watcherEvents.length}`);
