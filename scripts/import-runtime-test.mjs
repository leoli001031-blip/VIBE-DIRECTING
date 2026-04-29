import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const DEFAULT_ROOT =
  "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429";
const root = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
const publicDir = path.resolve("public");
const mediaDir = path.join(publicDir, "media");
const outPath = path.join(publicDir, "runtime-audit.json");

const policy = {
  strictImageProvider: "image2_only",
  rules: [
    {
      slot: "image.generate",
      activeProvider: "openai-image2-codex-cli",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.edit",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["image2image"],
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.reference_asset",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image", "image2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "video.i2v",
      activeProvider: "seedance2-provider",
      executionState: "parked",
      allowedProviders: ["seedance2-provider", "dreamina-seedance2"],
      forbiddenProviders: [],
      allowedModes: ["frames2video"],
      forbiddenFallbacks: ["frames2video_to_text2video"],
      concurrency: 1,
    },
  ],
};

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readYaml(file, fallback = {}) {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function exists(file) {
  return Boolean(file && fs.existsSync(file));
}

function dimensionsFromGenerated(entry) {
  if (!entry || !entry.dimensions) return undefined;
  return `${entry.dimensions.width}x${entry.dimensions.height}`;
}

function parseJsonl(file) {
  if (!exists(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: "parse_error", raw: line };
      }
    });
}

function parseQaTable(file) {
  if (!exists(file)) return new Map();
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const table = lines.filter((line) => line.trim().startsWith("|"));
  if (table.length < 3) return new Map();
  const headers = table[0].split("|").map((cell) => cell.trim()).filter(Boolean);
  const result = new Map();
  for (const line of table.slice(2)) {
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < headers.length) continue;
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    const key = (row.Asset || row.Shot || "").replace(/`/g, "");
    if (key) result.set(key, row);
  }
  return result;
}

function gateValue(value, fallback = "UNKNOWN") {
  const clean = String(value || "").replace(/`/g, "").toUpperCase();
  return ["PASS", "PARTIAL", "FAIL", "N/A"].includes(clean) ? clean : fallback;
}

function gateSet(row = {}) {
  return {
    identity: gateValue(row.identity, "UNKNOWN"),
    scene: gateValue(row.scene, "UNKNOWN"),
    pair: gateValue(row.pair, "N/A"),
    story: gateValue(row.story, "UNKNOWN"),
    prop: gateValue(row.prop, "UNKNOWN"),
    style: gateValue(row.style, "UNKNOWN"),
  };
}

function flattenManifestAssets(manifest) {
  const assets = manifest?.generation_manifest?.assets || {};
  return [
    ...(assets.characters || []).map((item) => ({ ...item, type: "character" })),
    ...(assets.scenes || []).map((item) => ({ ...item, type: "scene" })),
    ...(assets.props || []).map((item) => ({ ...item, type: "prop" })),
  ];
}

function generatedEntryFor(generated, id) {
  return generated?.assets?.[id] || generated?.keyframes?.[id] || generated?.videos?.[id];
}

function providerIdForJob(jobId, events) {
  const event = events.find((item) => item.event === "cmd_start" && Array.isArray(item.cmd) && item.cmd[0] === "dreamina" && item.cmd.join(" ").includes(jobId));
  return event ? "dreamina" : "unknown";
}

function requiredModeForAsset(asset) {
  if (asset.type === "scene" && asset.asset_type === "scene_view") return "image2image";
  if (asset.type === "scene" && asset.asset_type === "master_reference") return "text2image";
  if (asset.type === "character" || asset.type === "prop") return "text2image";
  return "not_applicable";
}

function slotForAsset(asset) {
  if (asset.type === "character" || asset.type === "prop") return "image.reference_asset";
  if (asset.type === "scene" && asset.asset_type === "scene_view") return "image.edit";
  return "image.reference_asset";
}

function actIdForShot(shot) {
  if (shot.act_id) return String(shot.act_id);
  if (shot.actId) return String(shot.actId);
  const match = /^([A-Za-z]+\d+)/.exec(String(shot.shot_id || ""));
  return match?.[1] || "unknown";
}

function sectionIdForShot(shot) {
  return shot.section_id || shot.sectionId || shot.sequence_id || shot.scene_id || actIdForShot(shot);
}

function assetJobId(asset) {
  if (asset.type === "character") return `asset_character_${asset.character_id}`;
  if (asset.type === "prop") return `asset_prop_${asset.prop_id || asset.asset_id?.replace(/_master$/, "")}`;
  if (asset.type === "scene") {
    if (asset.asset_type === "master_reference") return `asset_scene_${asset.scene_id}_master`;
    return `asset_scene_${asset.scene_id}_${asset.asset_id}`;
  }
  return asset.asset_id;
}

function makeIssue(id, severity, type, title, detail, recommendation, target) {
  return { id, severity, type, title, detail, recommendation, target };
}

function statusForAsset(pathValue, generatedEntry) {
  if (exists(pathValue)) return generatedEntry?.status === "generated" ? "generated" : "exists";
  return "missing";
}

function collectJobs(manifestAssets, shots, generated, events) {
  const jobs = [];
  for (const asset of manifestAssets) {
    const id = assetJobId(asset);
    const entry = generatedEntryFor(generated, id);
    const requiredMode = requiredModeForAsset(asset);
    jobs.push({
      id,
      slot: slotForAsset(asset),
      requiredMode,
      providerId: providerIdForJob(id, events),
      status: entry?.status === "generated" || entry?.status === "exists" ? "success" : "planned",
      outputPath: asset.path,
      promptPath: entry?.prompt_path,
      references: entry?.references || [],
      submitId: entry?.submit_id,
      issues: [],
    });
  }

  for (const shot of shots) {
    for (const kind of ["start", "end"]) {
      const id = `keyframe_${shot.shot_id}_${kind}`;
      const entry = generatedEntryFor(generated, id);
      jobs.push({
        id,
        slot: kind === "start" ? "image.generate" : "image.edit",
        requiredMode: kind === "start" ? "text2image" : "image2image",
        providerId: providerIdForJob(id, events),
        status: entry?.status === "generated" || entry?.status === "exists" ? "success" : "planned",
        outputPath: path.join(root, "02_keyframes", kind, `${shot.shot_id}_${kind}.png`),
        promptPath: entry?.prompt_path,
        references: entry?.references || [],
        submitId: entry?.submit_id,
        issues: [],
      });
    }

    const id = `video_${shot.shot_id}_seedance`;
    const videoPath = path.join(root, "03_videos/clips", `${shot.shot_id}.mp4`);
    jobs.push({
      id,
      slot: "video.i2v",
      requiredMode: "frames2video",
      providerId: "dreamina-seedance2",
      status: exists(videoPath) ? "success" : "parked",
      outputPath: videoPath,
      promptPath: path.join(root, "prompts/video", `${id}.txt`),
      references: [
        path.join(root, "02_keyframes/start", `${shot.shot_id}_start_seedance_720p.png`),
        path.join(root, "02_keyframes/end", `${shot.shot_id}_end_seedance_720p.png`),
      ],
      submitId: events.find((event) => JSON.stringify(event).includes(id) && event.response?.submit_id)?.response?.submit_id,
      issues: exists(videoPath) ? [] : ["provider_parked_no_submit"],
    });
  }
  return jobs;
}

function validateJobs(jobs, events) {
  const issues = [];
  const fallbackEvents = events.filter((event) => String(event.event || "").includes("fallback") || JSON.stringify(event).includes("fallback_text"));

  for (const job of jobs) {
    const rule = policy.rules.find((item) => item.slot === job.slot);
    if (!rule) continue;
    if (["parked", "planned", "unavailable"].includes(rule.executionState)) {
      if (["submitted", "querying", "success"].includes(job.status)) {
        issues.push(
          makeIssue(
            `parked-live-${job.id}`,
            "blocker",
            "provider_policy",
            "Parked provider produced a live task",
            `${job.id} is ${job.status}, but ${job.slot} is ${rule.executionState}.`,
            "Do not submit or advance this provider path until Settings explicitly enables the adapter.",
            job.id,
          ),
        );
        job.issues.push("parked_provider_live_task");
      }
      continue;
    }
    if (rule.forbiddenProviders.includes(job.providerId)) {
      issues.push(
        makeIssue(
          `provider-${job.id}`,
          "blocker",
          "provider_policy",
          "Image provider drift",
          `${job.id} used ${job.providerId}, but ${job.slot} is locked to ${rule.activeProvider}.`,
          "Block formal use and rerun through the Image 2 adapter or mark this as an external experiment.",
          job.id,
        ),
      );
      job.issues.push("provider_policy_violation");
    }
    if (!rule.allowedModes.includes(job.requiredMode)) {
      issues.push(
        makeIssue(
          `mode-${job.id}`,
          "blocker",
          "state_gate",
          "Required mode is not allowed",
          `${job.id} requires ${job.requiredMode}; ${job.slot} allows ${rule.allowedModes.join(", ")}.`,
          "Recompile this task through ProviderTaskValidator.",
          job.id,
        ),
      );
      job.issues.push("mode_policy_violation");
    }
  }

  if (fallbackEvents.length) {
    issues.push(
      makeIssue(
        "forbidden-fallback",
        "blocker",
        "fallback",
        "Forbidden text fallback was attempted",
        `${fallbackEvents.length} event(s) show image-to-image failure falling toward text-to-image candidate generation.`,
        "Reject that reference chain. Required image-to-image jobs can only retry image-to-image or stop blocked.",
      ),
    );
  }

  return issues;
}

const manifestPath = path.join(root, "00_task/generation_manifest.json");
const shotSpecPath = path.join(root, "00_task/shot_spec.yaml");
const generatedPath = path.join(root, "manifests/generated_outputs.json");
const eventsPath = path.join(root, "manifests/generation_events.jsonl");
const assetQaPath = path.join(root, "04_reports/asset_qa.md");
const keyframeQaPath = path.join(root, "04_reports/keyframe_pair_qa.md");
const videoQaPath = path.join(root, "04_reports/video_qa.md");

const manifest = readJson(manifestPath);
const shotSpec = readYaml(shotSpecPath);
const generated = readJson(generatedPath, { assets: {}, keyframes: {}, videos: {} });
const events = parseJsonl(eventsPath);
const assetQa = parseQaTable(assetQaPath);
const pairQa = parseQaTable(keyframeQaPath);
const manifestAssets = flattenManifestAssets(manifest);
const shotsSpec = shotSpec?.shots || [];
const jobs = collectJobs(manifestAssets, shotsSpec, generated, events);

const issues = validateJobs(jobs, events);

const expected = manifest?.generation_manifest?.expected_outputs || {};
const assetRecords = manifestAssets.map((asset) => {
  const id = assetJobId(asset);
  const entry = generatedEntryFor(generated, id);
  const qa = assetQa.get(id);
  const status = statusForAsset(asset.path, entry);
  const localIssues = [];
  if (status === "missing") localIssues.push("missing_file");
  if (qa && String(qa.Notes || "").includes("if visual audit")) localIssues.push("protocol_pass_needs_visual_audit");
  return {
    id,
    type: asset.type || "unknown",
    name: asset.asset_id || id,
    path: asset.path,
    status,
    lockedStatus: qa ? "needs_review" : asset.locked_status || "not_generated",
    providerId: providerIdForJob(id, events),
    requiredMode: requiredModeForAsset(asset),
    safeForFutureReference: false,
    dimensions: dimensionsFromGenerated(entry),
    issues: localIssues,
  };
});

const shotRecords = shotsSpec.map((shot) => {
  const startPath = path.join(root, "02_keyframes/start", `${shot.shot_id}_start.png`);
  const endPath = path.join(root, "02_keyframes/end", `${shot.shot_id}_end.png`);
  const videoPath = path.join(root, "03_videos/clips", `${shot.shot_id}.mp4`);
  const qa = pairQa.get(shot.shot_id);
  const localIssues = [];
  if (!exists(startPath)) localIssues.push("missing_start_frame");
  if (!exists(endPath)) localIssues.push("missing_end_frame");
  if (!exists(videoPath)) localIssues.push("missing_video");
  if (qa && String(qa.Notes || "").includes("auto QA only")) localIssues.push("auto_qa_not_human_approved");
  const gates = gateSet(qa);
  const hasFail = Object.values(gates).includes("FAIL");
  const status = !exists(videoPath)
    ? "video_missing"
    : hasFail
      ? "blocked"
      : "ready";
  return {
    id: shot.shot_id,
    actId: actIdForShot(shot),
    sectionId: sectionIdForShot(shot),
    title: `${shot.scene_id || "Scene"} / ${shot.view_id || "View"}`,
    storyFunction: shot.story_function || "Missing story function",
    startFrame: startPath,
    endFrame: endPath,
    videoPath: exists(videoPath) ? videoPath : undefined,
    status,
    gates,
    issues: localIssues,
  };
});

const existingAssets = assetRecords.filter((asset) => asset.status !== "missing").length;
const existingKeyframes = shotRecords.filter((shot) => exists(shot.startFrame) && exists(shot.endFrame)).length * 2;
const existingVideos = shotRecords.filter((shot) => shot.videoPath && exists(shot.videoPath)).length;
const dreaminaImageEvents = events.filter((event) => Array.isArray(event.cmd) && event.cmd[0] === "dreamina" && ["text2image", "image2image"].includes(event.cmd[1])).length;
const fallbackEvents = events.filter((event) => String(event.event || "").includes("fallback") || JSON.stringify(event).includes("fallback_text"));

if (!exists(videoQaPath)) {
  issues.push(
    makeIssue(
      "missing-video-qa",
      "warning",
      "missing_output",
      "Video QA report is not available yet",
      "The Seedance/Jimeng video adapter is parked, so no live video QA is expected in this build.",
      "Keep preview/export locked, but do not submit real Jimeng tasks during this phase.",
      videoQaPath,
    ),
  );
}

if (existingVideos < (expected.videos || shotRecords.length)) {
  issues.push(
    makeIssue(
      "videos-missing",
      "warning",
      "queue",
      "Video queue is parked",
      `${existingVideos}/${expected.videos || shotRecords.length} video clips exist. No Jimeng/Seedance jobs are submitted in this phase.`,
      "Keep the queue visible for later adapter integration; current implementation should only prepare task envelopes.",
      path.join(root, "03_videos/clips"),
    ),
  );
}

if (assetRecords.some((asset) => asset.issues.includes("protocol_pass_needs_visual_audit"))) {
  issues.push(
    makeIssue(
      "protocol-qa-only",
      "warning",
      "qa_gap",
      "Protocol QA is not visual approval",
      "Asset QA notes say future reference safety depends on later visual audit.",
      "Keep assets as needs_review until subagent or human visual audit approves them.",
    ),
  );
}

const metrics = {
  expectedAssets: (expected.character_assets || 0) + (expected.scene_master_assets || 0) + (expected.scene_view_assets || 0) + (expected.prop_assets_minimum || 0),
  existingAssets,
  expectedKeyframes: expected.keyframes || shotRecords.length * 2,
  existingKeyframes,
  expectedVideos: expected.videos || shotRecords.length,
  existingVideos,
  providerEvents: events.length,
  dreaminaImageEvents,
  forbiddenFallbackEvents: fallbackEvents.length,
};

const workflow = [
  {
    id: "production_bible",
    label: "Production Bible",
    status: exists(path.join(root, "00_task/production_bible.md")) ? "done" : "blocked",
    detail: exists(path.join(root, "00_task/production_bible.md")) ? "Production facts imported." : "Missing production bible.",
  },
  {
    id: "visual_memory",
    label: "Visual Memory",
    status: existingAssets >= metrics.expectedAssets ? "done" : "active",
    detail: `${existingAssets}/${metrics.expectedAssets} assets found.`,
  },
  {
    id: "keyframe_pairs",
    label: "Keyframe Pairs",
    status: existingKeyframes >= metrics.expectedKeyframes ? "done" : "active",
    detail: `${existingKeyframes}/${metrics.expectedKeyframes} keyframes found.`,
  },
  {
    id: "provider_policy",
    label: "Provider Policy",
    status: issues.some((issue) => issue.severity === "blocker" && ["provider_policy", "fallback"].includes(issue.type)) ? "blocked" : "done",
    detail: `${issues.filter((issue) => issue.type === "provider_policy" || issue.type === "fallback").length} policy issue(s).`,
  },
  {
    id: "videos",
    label: "Video Provider",
    status: existingVideos >= metrics.expectedVideos ? "done" : "pending",
    detail: existingVideos >= metrics.expectedVideos ? `${existingVideos}/${metrics.expectedVideos} video clips found.` : "Seedance/Jimeng adapter parked; no live submit.",
  },
  {
    id: "preview",
    label: "Preview Timeline",
    status: existingVideos >= metrics.expectedVideos && !issues.some((issue) => issue.severity === "blocker") ? "done" : "pending",
    detail: "Preview remains locked until videos and video QA pass.",
  },
];

const blocked = workflow.find((stage) => stage.status === "blocked");
const state = blocked ? `blocked_at_${blocked.id}` : "ready";

const audit = {
  importedAt: new Date().toISOString(),
  projectTitle: manifest?.generation_manifest?.project_title || shotSpec?.project_title || "Untitled",
  projectRoot: root,
  sourceTask: manifest?.generation_manifest?.source_documents?.task || "",
  state,
  fileSnapshot: [
    ...assetRecords.filter((asset) => asset.status !== "missing").map((asset) => asset.path),
    ...shotRecords.flatMap((shot) => [shot.startFrame, shot.endFrame, shot.videoPath].filter(Boolean)),
  ],
  schemaSummary: {
    auditSchemaVersion: "0.3.0",
    coreStateVersion: "runtime-view-derived-from-audit",
    notes: [
      "TaskRun, manifest match, preflight, knowledge route, and preview events are derived by src/core/runtimeView.ts.",
      "Parked provider tasks are never submitted by this importer.",
    ],
  },
  metrics,
  providerPolicy: policy,
  workflow,
  assets: assetRecords,
  shots: shotRecords,
  jobs,
  issues,
  contactSheets: {
    assets: "/media/asset_contact_sheet.png",
    keyframes: "/media/keyframe_pair_contact_sheet.png",
  },
};

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });
for (const [name, source] of [
  ["asset_contact_sheet.png", path.join(root, "04_reports/contact_sheets/asset_contact_sheet.png")],
  ["keyframe_pair_contact_sheet.png", path.join(root, "04_reports/contact_sheets/keyframe_pair_contact_sheet.png")],
]) {
  if (exists(source)) fs.copyFileSync(source, path.join(mediaDir, name));
}
fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
console.log(`Imported runtime audit: ${outPath}`);
console.log(`State: ${state}`);
console.log(`Issues: ${issues.length}`);
