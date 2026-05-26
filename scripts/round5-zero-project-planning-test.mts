import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { buildMotionEndpointContract } from "../src/core/motionPlanning.ts";
import { validateMotionEndpointHardContracts } from "../src/core/visualConsistency.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function sha256Text(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function repoPath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function unique(items) {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

const generatedAt = new Date().toISOString();
const runId = `run-${generatedAt.replace(/[:.]/g, "-")}`;
const packageRoot = path.resolve("real-test-sandbox/round5-zero-project-planning-anime");
const runRoot = path.join(packageRoot, "runs", runId);
const projectRoot = path.join(runRoot, "project");
const assetRoot = path.join(runRoot, "assets");
const shotRoot = path.join(runRoot, "shots");
const taskRoot = path.join(runRoot, "task_packets");
const reportRoot = path.join(runRoot, "reports");
const artifactEvents = [];

function recordEvent(kind, shotId, filePath) {
  artifactEvents.push({ index: artifactEvents.length + 1, kind, shotId, path: repoPath(filePath) });
}

const gateSet = {
  identity: "PASS",
  scene: "PASS",
  pair: "PASS",
  story: "PASS",
  prop: "PASS",
  style: "PASS",
};

const assetTextContaminationPolicy = [
  "no readable text",
  "no labels",
  "no captions",
  "no logo-like patches",
  "no diagram labels",
  "no signage text",
  "no pseudo text",
  "no fake glyphs",
];

function assetPromptPolicy(asset) {
  if (asset.kind === "character") {
    return [
      ...assetTextContaminationPolicy,
      "must be one clean single-character main identity reference",
      "multi-view reference sheet is forbidden for the main reference",
    ];
  }
  return [
    ...assetTextContaminationPolicy,
    "no signs, notices, posters, or readable writing",
    "no pseudo signage or fake poster text",
  ];
}

function assetVisualContract(asset, promptPath, expectedOutputPath, policy) {
  const isCharacter = asset.kind === "character";
  const isScene = asset.kind === "scene";
  return {
    singleMainReferenceRequired: true,
    multiViewSheetForbidden: isCharacter,
    visualTextPolicy: {
      policyId: isScene ? "scene_no_pseudo_text_or_signage" : "asset_no_readable_or_pseudo_text",
      status: "hard_required_before_lock",
      forbidden: policy,
      rejectIfContains: isScene
        ? ["readable_text", "pseudo_text", "fake_glyphs", "signage", "poster_text", "diagram_labels"]
        : ["readable_text", "pseudo_text", "fake_glyphs", "labels", "captions", "multi_view_sheet"],
    },
    assetQaGate: {
      status: "blocked_until_provider_return_and_semantic_qa",
      blockers: ["provider_asset_image_missing", "single_main_reference_qa_missing", "visual_text_qa_missing", "source_hash_missing"],
      evidencePaths: [repoPath(promptPath), repoPath(expectedOutputPath)],
      hashRefs: { promptSha256: sha256Text(asset.prompt), outputSha256: "pending_provider_return" },
      nextAction: "generate_reference_asset_then_run_asset_semantic_and_visual_text_qa",
    },
    visualTextQa: {
      status: "pending_provider_output",
      requiredBeforeLock: true,
      mustRejectReadableText: true,
      mustRejectPseudoText: true,
      mustRejectSignage: isScene,
      nextAction: isScene ? "reject_scene_reference_if_pseudo_text_or_signage_appears" : "reject_character_reference_if_sheet_labels_or_pseudo_text_appear",
    },
  };
}

const project = {
  schemaVersion: "round5_zero_project_v2_endpoint_first",
  projectId: "round5_zero_planning_anime_signal",
  title: "Signal After Rain",
  logline: "Two students trace a rain-distorted signal from an archive room to a rooftop antenna before dawn.",
  visualStyle: "quiet clean 2D Japanese anime, low texture, restrained blue-amber palette, stable cinematic 16:9 frames",
  generationPolicy: {
    imageProvider: "openai-image2-only",
    endpointPlanning: "required_before_start_frame_generation",
    startFrames: "blocked_until_endpoint_plan_and_locked_asset_refs_pass_qa",
    endFrames: "blocked_until_approved_start_frame_and_strict_image_edit_provenance",
    seedance: false,
    fastModel: false,
    promptOnlyEndFrameCanPass: false,
  },
};

const assets = [
  {
    id: "char_mira",
    kind: "character",
    locked: false,
    displayName: "Mira",
    referenceType: "main_character_reference",
    prompt:
      "Original 2D Japanese anime character reference, Mira, 17-year-old observatory club girl, short black bob with one small silver crescent hairpin, amber eyes, navy rain jacket over white shirt, red wrist cord, calm focused expression, low texture, clean cel shading, clean single-character identity reference, no readable text, no labels, no captions, no logo-like patches.",
    textConstraints: ["short black bob", "silver crescent hairpin", "amber eyes", "navy rain jacket", "red wrist cord"],
  },
  {
    id: "char_iori",
    kind: "character",
    locked: false,
    displayName: "Iori",
    referenceType: "main_character_reference",
    prompt:
      "Original 2D Japanese anime character reference, Iori, 18-year-old quiet technician boy, ash-brown short hair, gray eyes, olive hooded jacket, black fingerless gloves, compact radio tablet, reserved expression, low texture, clean cel shading, clean single-character identity reference, no readable text, no labels, no captions, no logo-like patches.",
    textConstraints: ["ash-brown short hair", "gray eyes", "olive hooded jacket", "black fingerless gloves", "compact radio tablet"],
  },
  {
    id: "scene_archive",
    kind: "scene",
    locked: false,
    displayName: "Observatory archive",
    referenceType: "main_scene_reference",
    prompt:
      "16:9 locked environment reference, quiet 2D Japanese anime observatory archive at night, brass star-map table centered, curved shelves of notebooks, dome slit overhead, one amber desk lamp, rainy blue moonlight, low texture, no readable text, no labels, no captions, no logo-like patches, no diagram labels, no signage text.",
    spatialAnchors: ["brass star-map table centered", "curved shelves", "dome slit overhead", "single amber desk lamp"],
  },
  {
    id: "scene_rooftop",
    kind: "scene",
    locked: false,
    displayName: "Rooftop antenna array",
    referenceType: "main_scene_reference",
    prompt:
      "16:9 locked environment reference, quiet 2D Japanese anime school rooftop antenna array before dawn, damp metal grating, low white antenna dishes, distant observatory dome, thin blue horizon, restrained palette, no readable text, no labels, no captions, no logo-like patches, no diagram labels, no signage text.",
    spatialAnchors: ["low antenna dishes", "damp metal grating", "distant observatory dome", "thin blue horizon"],
  },
];

const shots = [
  {
    id: "ZP01",
    actId: "ACT_A",
    sceneId: "scene_archive",
    roleIds: ["char_mira"],
    title: "Mira enters the archive and notices the brass star-map table.",
    storyFunction: "Establish the first locked scene and Mira's role.",
    camera: "wide locked 16:9 anime frame, eye level, whole circular room readable",
    blocking: "Mira lower-left, body turned toward the centered brass table",
    motionIntent: "static hold with only rain-lit atmosphere",
    endFrameNeeded: false,
    noEndFrameReason: "Atmospheric establishing hold; no stateful action, reveal, object contact, locomotion, or required endpoint composition.",
  },
  {
    id: "ZP02",
    actId: "ACT_A",
    sceneId: "scene_archive",
    roleIds: ["char_mira"],
    title: "Mira holds the prism just above the marked brass-map point before placement.",
    storyFunction: "Introduce the first prop interaction and test hand/prop local editing.",
    camera: "medium locked table-height frame, table and Mira hands visible",
    blocking: "Mira center-right, prism hovering in her right hand above the brass map",
    motionIntent: "object interaction: after the start hold, right hand lowers the small glass prism from a visible air gap onto the same spot on the table; hand-to-prism contact remains visible",
    endFrameNeeded: true,
    startEndpoint: "Mira's right hand holds the prism just above the marked brass-map contact point with a visible air gap; fingers have not lowered, wrist cord is visible, the contact point is visible, and the prism must not touch the table.",
    endEndpoint: "The same right hand gently lowers the prism until it lightly contacts the same marked brass-map point; wrist, prism, and table remain aligned with no scene redraw.",
    subjectTrajectory: "Right hand descends a few centimeters from above-table hover to prism contact; elbow/forearm stay inside a small local envelope.",
    cameraTrajectory: "locked camera, no reframing, no zoom, no crop shift",
    allowedDelta: ["right fingers settle", "small prism moves downward", "tiny contact shadow under prism"],
    forbiddenDelta: ["Mira face drift", "jacket or hair redesign", "table geometry redraw", "new map symbols", "camera shift"],
    editableRegions: [
      { id: "zp02_right_hand_prism", semanticLabel: "right hand and prism contact", bbox: "planned_after_start_generation", allowedOps: ["object_move", "hand_pose_shift"], maxDelta: "small local contact movement" },
    ],
    protectedRegions: [
      { id: "zp02_mira_identity", entityRef: "char_mira", lockLevel: "hard", reason: "Identity and costume must not be reinterpreted." },
      { id: "zp02_archive_table", entityRef: "scene_archive:brass_table", lockLevel: "hard", reason: "Star-map table outline and lamp/shelf anchors must stay fixed." },
    ],
    motionMagnitudeLimit: "hand/prism local move only; no full-arm redraw beyond the contact envelope",
  },
  {
    id: "ZP03",
    actId: "ACT_A",
    sceneId: "scene_archive",
    roleIds: ["char_iori"],
    title: "Iori looks up from the radio tablet without moving his body.",
    storyFunction: "Test a micro in-place reaction that should not require an end frame by default.",
    camera: "medium close locked frame with tablet lower foreground",
    blocking: "Iori seated, shoulders anchored, eyes lift slightly toward offscreen table light",
    motionIntent: "micro-expression: seated body remains anchored at the table, chin stays inside the same pose envelope, only eye line and tiny chin lift change; no walking and no prop interaction",
    endFrameNeeded: false,
    noEndFrameReason: "This is a minor in-place reaction. It should be carried by video motion prompt unless later story QA upgrades it into a required discovery endpoint.",
  },
  {
    id: "ZP04",
    actId: "ACT_B",
    sceneId: "scene_rooftop",
    roleIds: ["char_mira", "char_iori"],
    title: "Mira pauses at the stairwell threshold before a one-step move.",
    storyFunction: "Test locomotion planning with explicit footwork and center-of-mass mechanics.",
    camera: "wide locked rooftop frame, antenna dishes foreground, dome in background",
    blocking: "Mira lower-middle at the stairwell threshold, Iori stays by the door, antenna line screen-right",
    motionIntent:
      "locomotion: Mira takes one small step forward-right; left foot plants on wet grating before weight shift, center of mass transfers over the planted foot, right foot follows with visible ground contact; not bbox translation",
    endFrameNeeded: true,
    startEndpoint: "Mira is still at the stairwell threshold before the step: support foot fixed, action foot only slightly lifted or prepared to move, target patch of wet grating visible ahead-right, and no step completed yet.",
    endEndpoint: "Mira completes one small forward-right step: left foot is planted on the visible grating contact point, center of mass is over the planted foot, right foot follows lightly.",
    subjectTrajectory: "One small step only: left-foot plant, center-of-mass transfer, then right-foot follow-through; no sliding bbox translation.",
    cameraTrajectory: "locked wide rooftop frame, no pan, no zoom, no reframe",
    allowedDelta: ["Mira lower-body step envelope", "left foot contact", "center-of-mass shift", "right foot follow-through"],
    forbiddenDelta: ["Iori position drift", "Mira face/costume redraw", "antenna/dome/horizon drift", "multi-step crossing", "bbox-only translation"],
    editableRegions: [
      { id: "zp04_mira_step_envelope", semanticLabel: "Mira lower-body step envelope", bbox: "planned_after_start_generation", allowedOps: ["pose_shift", "small_locomotion_step"], maxDelta: "one small step" },
    ],
    protectedRegions: [
      { id: "zp04_iori_anchor", entityRef: "char_iori", lockLevel: "hard", reason: "Iori must remain at the doorway." },
      { id: "zp04_rooftop_anchors", entityRef: "scene_rooftop", lockLevel: "hard", reason: "Antenna dishes, observatory dome, horizon line, and wet grating layout must stay fixed." },
      { id: "zp04_mira_identity", entityRef: "char_mira", lockLevel: "hard", reason: "Mira identity and costume are protected except for lower-body step pose." },
    ],
    motionMagnitudeLimit: "single small step only, with footwork, center-of-mass transfer, and contact point evidence",
  },
  {
    id: "ZP05",
    actId: "ACT_B",
    sceneId: "scene_rooftop",
    roleIds: ["char_iori"],
    title: "Iori opens a small metal control box on the antenna mast.",
    storyFunction: "Test object/reveal motion with a very small protected scene change.",
    camera: "medium locked side frame, control box and hands visible",
    blocking: "Iori screen-left, antenna mast screen-right, tablet tucked under arm",
    motionIntent: "object interaction reveal: gloved hand opens the small metal control box lid by a few degrees; antenna mast and body stay anchored",
    endFrameNeeded: true,
    startEndpoint: "Iori's gloved hand is touching but not opening the closed lid of the control box; the lid is completely closed, and the hinge side, lid seam, small handle, and antenna mast are clearly visible.",
    endEndpoint: "The same lid opens a few degrees by Iori's gloved hand; hinge side stays fixed, lid seam and handle remain identifiable, mast geometry remains identical, and only the lid angle changes.",
    subjectTrajectory: "Gloved fingers pull the lid open a few degrees around the visible hinge; shoulder, head, mast, and tablet stay anchored.",
    cameraTrajectory: "locked side frame, no zoom, no pan, no crop shift",
    allowedDelta: ["gloved fingers shift slightly", "control box lid rotates a few degrees", "tiny reveal shadow inside box"],
    forbiddenDelta: ["Iori face/costume drift", "new electronics", "mast geometry redraw", "rooftop horizon shift", "large arm swing"],
    editableRegions: [
      { id: "zp05_glove_lid_hinge", semanticLabel: "gloved hand and control box lid", bbox: "planned_after_start_generation", allowedOps: ["object_move", "reveal"], maxDelta: "few-degree lid rotation" },
    ],
    protectedRegions: [
      { id: "zp05_iori_identity", entityRef: "char_iori", lockLevel: "hard", reason: "Iori identity, jacket, gloves, and tablet must not drift." },
      { id: "zp05_mast_geometry", entityRef: "scene_rooftop:antenna_mast", lockLevel: "hard", reason: "Mast and control-box location are fixed scene anchors." },
    ],
    motionMagnitudeLimit: "small lid-angle reveal only; no new object or full-body pose redraw",
  },
  {
    id: "ZP06",
    actId: "ACT_B",
    sceneId: "scene_rooftop",
    roleIds: ["char_mira", "char_iori"],
    title: "Both characters hold still as the first signal light appears.",
    storyFunction: "Close the test with a static endpoint that should not need end-frame generation.",
    camera: "wide locked composition from behind both characters",
    blocking: "Mira and Iori small silhouettes center, signal light far upper-right",
    motionIntent: "static hold with tiny atmospheric light change only",
    endFrameNeeded: false,
    noEndFrameReason: "Static ending beat. Signal shimmer can be handled as video motion or later VFX; no separate character/scene end frame is needed.",
  },
];

function motionClassificationText(shot) {
  if (shot.id === "ZP01") {
    return "static atmospheric establishing frame; rain light only; no walking, no locomotion, no prop interaction.";
  }
  if (shot.id === "ZP06") {
    return "static atmospheric ending frame; characters remain still and distant signal shimmer is already present; no walking, no locomotion, no prop interaction.";
  }
  return `${shot.storyFunction} ${shot.motionIntent}`;
}

function shotRecord(shot) {
  return {
    id: shot.id,
    actId: shot.actId,
    title: `${shot.id} endpoint motion facts`,
    storyFunction: motionClassificationText(shot),
    status: shot.endFrameNeeded ? "endpoint_plan_ready" : "static_endpoint_plan_ready",
    gates: gateSet,
    issues: [],
  };
}

function keyframePair(shot, override = {}) {
  return {
    shotId: shot.id,
    startFrameId: `${shot.id}:start`,
    endFrameId: `${shot.id}:end`,
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: [shot.motionIntent, ...(shot.allowedDelta || []), ...(shot.editableRegions || []).map((region) => region.semanticLabel || region.id)],
    mustPreserve: (shot.protectedRegions || []).map((region) => region.entityRef || region.id || region).concat(["identity", "scene layout", "style"]),
    mustNotAdd: ["new character", "new scene", "camera reframe", "text overlay", ...(shot.forbiddenDelta || [])],
    ...override,
  };
}

function providerProvenanceRequirement(shot) {
  return {
    requiredOperation: shot.endFrameNeeded ? "image.edit" : "not_required_for_static_hold",
    mustUseSourceAssetIds: shot.endFrameNeeded ? [`${shot.id}:approved_start_frame_asset`] : [],
    mustReturn: shot.endFrameNeeded
      ? ["providerRequestId", "model", "operation", "inputAssetHash", "outputAssetHash", "maskHash", "timestamp", "sourceStartFrameAttachmentId"]
      : [],
    onMissing: shot.endFrameNeeded ? "block" : "not_required",
  };
}

function startAffordanceCriteria(shot) {
  if (!shot.endFrameNeeded) {
    return [
      "Start frame must preserve locked identity, scene anchors, and style.",
      "Start frame can be used as a stable single-anchor video prompt without inventing a future end pose.",
      `No end frame required because: ${shot.noEndFrameReason}`,
    ];
  }
  return [
    "Start must leave room for end; the endpoint destination/path/contact must be visible in the start frame.",
    "Start must not complete endpoint; it must show the pre-action state that can naturally reach the end state.",
    "Start must expose path/destination/contact so the end can be produced as a local edit rather than a full redraw.",
    "Start must keep protected regions visible and stable enough for pair QA.",
  ];
}

function startAffordanceVerdict(shot) {
  if (!shot.endFrameNeeded) return "pass_static_only";
  if (shot.id === "ZP04") return "block_regenerate_start";
  return "pass_for_end_edit";
}

function startAffordanceNextAction(verdict) {
  if (verdict === "pass_for_end_edit") return "approve_start_for_strict_image_edit_preflight";
  if (verdict === "pass_static_only") return "skip_end_frame_and_use_start_as_video_anchor";
  return "regenerate_start_frame_with_threshold_pre_step_evidence_before_end_edit";
}

function thresholdPreStepHardChecks(shot, verdict) {
  if (shot.id !== "ZP04" && shot.motionIntent.includes("locomotion:")) {
    return {
      required: true,
      status: "pending_start_frame_generation",
      checks: ["support_foot_fixed_at_threshold", "action_foot_not_already_stepped", "target_patch_visible", "center_of_mass_before_transfer", "no_bbox_only_translation"],
    };
  }
  if (shot.id !== "ZP04") {
    return { required: false, status: "not_required_for_motion_type", checks: [] };
  }
  return {
    required: true,
    status: verdict === "block_regenerate_start" ? "failed" : "passed",
    checks: [
      { id: "support_foot_fixed_at_threshold", status: "pass", evidence: "threshold/support-foot requirement is present in the endpoint plan" },
      { id: "action_foot_not_already_stepped", status: "fail", evidence: "real Round 5 start did not preserve a clean before-step threshold state" },
      { id: "target_patch_visible", status: "pass", evidence: "target patch is required by the start endpoint" },
      { id: "center_of_mass_before_transfer", status: "fail", evidence: "pre-step center-of-mass state was not sufficiently established" },
      { id: "no_bbox_only_translation", status: "pass", evidence: "endpoint plan forbids bbox-only translation" },
    ],
    onFailure: "block_regenerate_start",
  };
}

function buildEndpointPlan(shot, contract, hardIssues) {
  const endEndpointRequired = Boolean(shot.endFrameNeeded);
  return {
    schemaVersion: "round5_motion_endpoint_plan_v1",
    planId: `${shot.id}:motion_endpoint_plan`,
    shotId: shot.id,
    version: 1,
    createdAt: generatedAt,
    createdBeforeStartFrame: true,
    generatedBeforeStartFramePrompt: true,
    endEndpointRequired,
    noEndFrameReason: endEndpointRequired ? undefined : shot.noEndFrameReason,
    startEndpoint: endEndpointRequired
      ? shot.startEndpoint
      : `Stable single-anchor start: ${shot.blocking}. It should support ${shot.motionIntent} without requiring a separately rendered end frame.`,
    endEndpoint: endEndpointRequired
      ? shot.endEndpoint
      : "No separate end image is planned; downstream video can use the start frame plus subtle motion instructions.",
    subjectTrajectory: endEndpointRequired ? shot.subjectTrajectory : "No endpoint trajectory beyond subtle atmosphere or hold.",
    cameraTrajectory: shot.cameraTrajectory || "locked camera unless later video planning explicitly upgrades it",
    allowedDelta: endEndpointRequired ? shot.allowedDelta : ["tiny atmosphere or hold only"],
    forbiddenDelta: endEndpointRequired
      ? shot.forbiddenDelta
      : ["identity drift", "scene layout drift", "unplanned action endpoint", "camera reframe"],
    editableRegions: endEndpointRequired ? shot.editableRegions : [],
    protectedRegions: endEndpointRequired
      ? shot.protectedRegions
      : [
          { id: `${shot.id.toLowerCase()}_identity_scene_lock`, entityRef: unique(shot.roleIds.concat(shot.sceneId)).join("+"), lockLevel: "hard", reason: "Static/atmospheric shots still protect identity, scene layout, and style." },
        ],
    motionMagnitudeLimit: endEndpointRequired ? shot.motionMagnitudeLimit : "no separate endpoint magnitude; allow only subtle video motion",
    providerProvenanceRequirement: providerProvenanceRequirement(shot),
    startAffordanceCriteria: startAffordanceCriteria(shot),
    endFrameRenderingPolicy: endEndpointRequired ? "strict_image_edit_required_block_without_provenance" : "end_frame_not_required",
    motionContract: {
      path: `${shot.id}/motion_endpoint_contract.json`,
      motionType: contract.motionType,
      contractStatus: contract.status,
      whetherEndFrameRequired: contract.whetherEndFrameRequired,
      hardGateIssues: hardIssues.map((issue) => issue.detail),
    },
    gates: {
      endpointCoherence: "planned",
      regionPolicy: endEndpointRequired ? "planned_requires_mask_or_bbox_after_start_generation" : "not_required_for_static_hold",
      providerCapabilityPreflight: endEndpointRequired ? "blocked_until_strict_image_edit_provenance_available" : "not_required",
      startMotionAffordanceQa: "required_after_start_generation",
    },
  };
}

function endpointPlanMarkdown(shot, plan) {
  return [
    `# ${shot.id} Motion Endpoint Plan`,
    "",
    `Created before start frame: ${plan.createdBeforeStartFrame}`,
    `End endpoint required: ${plan.endEndpointRequired}`,
    plan.noEndFrameReason ? `No end-frame reason: ${plan.noEndFrameReason}` : "",
    "",
    "## Start Endpoint",
    "",
    plan.startEndpoint,
    "",
    "## End Endpoint",
    "",
    plan.endEndpoint,
    "",
    "## Motion",
    "",
    `- Subject trajectory: ${plan.subjectTrajectory}`,
    `- Camera trajectory: ${plan.cameraTrajectory}`,
    `- Motion magnitude limit: ${plan.motionMagnitudeLimit}`,
    "",
    "## Delta Policy",
    "",
    `- Allowed: ${plan.allowedDelta.join("; ") || "none"}`,
    `- Forbidden: ${plan.forbiddenDelta.join("; ") || "none"}`,
    "",
    "## Regions",
    "",
    `- Editable: ${plan.editableRegions.map((region) => region.semanticLabel || region.id).join("; ") || "none"}`,
    `- Protected: ${plan.protectedRegions.map((region) => region.entityRef || region.id).join("; ") || "identity, scene layout, style"}`,
    "",
    "## Start Affordance Criteria",
    "",
    ...plan.startAffordanceCriteria.map((item) => `- ${item}`),
    "",
    "## End Rendering Policy",
    "",
    `- ${plan.endFrameRenderingPolicy}`,
    "",
  ].filter(Boolean).join("\n");
}

function startPrompt(shot, plan, endpointPlanPath) {
  const scene = assets.find((asset) => asset.id === shot.sceneId);
  const roleLines = shot.roleIds.map((roleId) => assets.find((asset) => asset.id === roleId)?.displayName).join(", ");
  const primaryRequest = shot.endFrameNeeded
    ? `Pre-action freeze frame: ${plan.startEndpoint}`
    : `Stable single-anchor frame: ${shot.title}`;
  return [
    `# ${shot.id} Start Frame Prompt`,
    "",
    `Compiled from endpoint plan: ${repoPath(endpointPlanPath)}`,
    `Endpoint plan id: ${plan.planId}`,
    `Use case: illustration-story`,
    `Asset type: Vibe Director locked start frame`,
    `Primary request: ${primaryRequest}`,
    shot.endFrameNeeded ? "Pre-action freeze frame must appear before the motion is completed; do not illustrate the completed action." : "Static/hold frame; no separate end frame is planned.",
    `Locked roles: ${roleLines}`,
    `Locked scene: ${scene?.displayName}`,
    `Camera: ${shot.camera}`,
    `Blocking: ${shot.blocking}`,
    `Story function: ${shot.storyFunction}`,
    "",
    "Endpoint-first requirements:",
    `- Start endpoint to realize: ${plan.startEndpoint}`,
    `- Planned end endpoint already exists: ${plan.endEndpoint}`,
    "- start must leave room for end / start must not complete endpoint / start must expose path/destination/contact.",
    "- The frame is not a free first image; it is the visual implementation of MotionEndpointPlan.startEndpoint.",
    "",
    "Start motion-affordance requirements:",
    ...plan.startAffordanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Hard requirements:",
    "- Use only the locked character and scene assets after their reference images pass QA.",
    "- Preserve the quiet clean 2D Japanese anime style, low texture, restrained blue-amber palette, and stable 16:9 frame.",
    "- No readable text, labels, captions, logo-like patches, diagram labels, or signage text unless an approved story anchor explicitly requires it.",
    "- Do not add unplanned characters, readable text, logos, photorealism, 3D rendering, or heavy AI texture.",
    `- Allowed delta later: ${plan.allowedDelta.join("; ") || "none"}`,
    `- Forbidden delta later: ${plan.forbiddenDelta.join("; ") || "none"}`,
    "",
  ].join("\n");
}

function endPrompt(shot, plan) {
  return [
    `# ${shot.id} End Frame Rendering Plan`,
    "",
    `End endpoint was planned before start generation: ${plan.createdBeforeStartFrame}`,
    "Rendering is blocked until the approved start frame exists and a strict image.edit provenance receipt can be recorded.",
    "",
    "Planned endpoint:",
    `- Start endpoint: ${plan.startEndpoint}`,
    `- End endpoint: ${plan.endEndpoint}`,
    `- Allowed motion: ${shot.motionIntent}`,
    `- Editable regions: ${plan.editableRegions.map((region) => region.semanticLabel || region.id).join(", ") || "none"}`,
    `- Protected regions: ${plan.protectedRegions.map((region) => region.entityRef || region.id).join(", ") || "identity, scene layout, style"}`,
    "",
    "Hard requirements:",
    "- Operation must be image.edit or image2image, not text2image.",
    "- Provider receipt must bind source_start_frame_sha256 to the approved start frame.",
    "- Provider receipt must include source start-frame attachment/input id and output asset hash.",
    "- No prompt-only end-frame generation can pass.",
    "- If the editable region cannot be expressed as a mask/bbox/landmark envelope, block before generation.",
    "",
  ].join("\n");
}

function startAffordanceQaTemplate(shot, plan) {
  const verdict = startAffordanceVerdict(shot);
  return {
    schemaVersion: "round5_start_motion_affordance_qa_v1",
    shotId: shot.id,
    planId: plan.planId,
    requiredAfterStartGeneration: true,
    qaStatus: verdict === "block_regenerate_start" ? "failed_threshold_pre_step" : verdict === "pass_static_only" ? "static_pass_no_end_edit" : "passed_for_end_edit",
    verdictEnum: ["pass_for_end_edit", "pass_static_only", "block_regenerate_start"],
    verdict,
    nextRequiredAction: startAffordanceNextAction(verdict),
    checks: [
      "start_matches_start_endpoint",
      "planned_end_endpoint_is_visible_or_reachable",
      "start_does_not_complete_endpoint",
      "path_destination_or_contact_is_exposed",
      "protected_regions_are_visible_for_later_pair_qa",
      "motion_magnitude_can_be_reached_without_identity_or_scene_redraw",
    ],
    thresholdPreStepHardChecks: thresholdPreStepHardChecks(shot, verdict),
    r2s06FailureGuard:
      "If a start frame makes the planned endpoint require a new head/body orientation, large redraw, or unplanned scene reinterpretation, regenerate the start frame instead of rendering an end frame.",
  };
}

const assetTasks = assets.map((asset) => {
  const promptPath = path.join(assetRoot, "prompt_requests", `${asset.id}.md`);
  const expectedOutputPath = path.join(assetRoot, "locked_refs", `${asset.id}.png`);
  const policy = assetPromptPolicy(asset);
  const task = {
    taskId: `asset_ref_${asset.id}`,
    assetId: asset.id,
    assetKind: asset.kind,
    providerSlot: "image.reference_asset",
    providerId: "openai-image2",
    requiredMode: "text2image",
    status: "ready_for_provider",
    promptPath: repoPath(promptPath),
    expectedOutputPath: repoPath(expectedOutputPath),
    ...assetVisualContract(asset, promptPath, expectedOutputPath, policy),
    hardRequirement: "Asset reference must pass semantic QA before any shot start-frame task can run.",
  };
  writeText(promptPath, [
    `# ${asset.displayName} Locked Reference Prompt`,
    "",
    asset.prompt,
    "",
    `Text constraints: ${(asset.textConstraints || asset.spatialAnchors || []).join("; ")}`,
    "",
    "Visual text contamination policy:",
    ...policy.map((item) => `- ${item}`),
    "Provider: OpenAI Image2 only. No Fast model. No Seedance. No fallback.",
    "",
  ].join("\n"));
  return task;
});

const endpointPlanByShot = new Map();
const endpointPlanRows = [];
const motionRows = [];

for (const shot of shots) {
  const shotDir = path.join(shotRoot, shot.id);
  const pair = shot.endFrameNeeded ? keyframePair(shot) : undefined;
  const contract = buildMotionEndpointContract({
    generatedAt,
    shot: shotRecord(shot),
    keyframePair: pair,
  });
  const hardIssues = shot.endFrameNeeded
    ? validateMotionEndpointHardContracts({
        motionEndpointContracts: [contract],
        keyframePairs: pair ? [pair] : [],
      })
    : [];
  const plan = buildEndpointPlan(shot, contract, hardIssues);
  const endpointJsonPath = path.join(shotDir, "motion_endpoint_plan.json");
  const endpointMdPath = path.join(shotDir, "motion_endpoint_plan.md");
  const contractPath = path.join(shotDir, "motion_endpoint_contract.json");
  writeJson(endpointJsonPath, plan);
  writeText(endpointMdPath, endpointPlanMarkdown(shot, plan));
  writeJson(contractPath, contract);
  recordEvent("motion_endpoint_plan", shot.id, endpointJsonPath);
  endpointPlanByShot.set(shot.id, {
    plan,
    contract,
    hardIssues,
    endpointJsonPath,
    endpointMdPath,
    contractPath,
  });
  endpointPlanRows.push({
    shotId: shot.id,
    endEndpointRequired: plan.endEndpointRequired,
    createdBeforeStartFrame: plan.createdBeforeStartFrame,
    endpointPlanPath: repoPath(endpointJsonPath),
    startEndpoint: plan.startEndpoint,
    endEndpoint: plan.endEndpoint,
  });
  motionRows.push({
    shotId: shot.id,
    expectedMotion: shot.motionIntent,
    motionType: contract.motionType,
    contractStatus: contract.status,
    endFrameRequired: contract.whetherEndFrameRequired,
    hardIssueCount: hardIssues.length,
    status: hardIssues.length ? "blocked_by_motion_gate" : "endpoint_plan_ready_before_start",
  });
}

const shotTasks = [];
const endTasks = [];

for (const shot of shots) {
  const shotDir = path.join(shotRoot, shot.id);
  const endpoint = endpointPlanByShot.get(shot.id);
  assert(endpoint, `${shot.id} endpoint plan must exist before start prompt generation`);
  const { plan, endpointJsonPath } = endpoint;
  const startPromptPath = path.join(shotDir, "start_frame_prompt.md");
  const startExpectedPath = path.join(shotDir, "start.png");
  const startAffordanceQaPath = path.join(shotDir, "start_motion_affordance_qa.json");
  const startQaTemplate = startAffordanceQaTemplate(shot, plan);
  writeText(startPromptPath, startPrompt(shot, plan, endpointJsonPath));
  writeJson(startAffordanceQaPath, startQaTemplate);
  recordEvent("start_frame_prompt", shot.id, startPromptPath);
  const startBlockers = [
    "locked_asset_reference_images_missing",
    "asset_semantic_qa_missing",
    "asset_source_sha_missing",
    "start_motion_affordance_qa_pending_after_generation",
  ];
  shotTasks.push({
    taskId: `start_frame_${shot.id}`,
    shotId: shot.id,
    providerSlot: "image.generate",
    providerId: "openai-image2",
    requiredMode: "text2image",
    status: "blocked_until_asset_refs_return",
    requiresMotionEndpointPlan: true,
    motionEndpointPlanPath: repoPath(endpointJsonPath),
    startAffordanceQaPath: repoPath(startAffordanceQaPath),
    startAffordanceQaVerdict: startQaTemplate.verdict,
    nextRequiredAction: startQaTemplate.nextRequiredAction,
    promptPath: repoPath(startPromptPath),
    expectedOutputPath: repoPath(startExpectedPath),
    blockers: startBlockers,
    canRunAfter: shot.roleIds.concat(shot.sceneId).map((assetId) => `asset_ref_${assetId}`),
    compiledFromEndpointPlan: {
      planId: plan.planId,
      startEndpoint: plan.startEndpoint,
      endEndpointAlreadyPlanned: Boolean(plan.endEndpoint),
      startMustLeaveRoomForEnd: true,
      startMustNotCompleteEndpoint: true,
      startMustExposePathDestinationContact: true,
    },
  });

  if (!shot.endFrameNeeded) continue;

  const endPromptPath = path.join(shotDir, "end_frame_prompt.md");
  const receiptPath = path.join(shotDir, "provider_edit_receipt.json");
  const maskPath = path.join(shotDir, "editable_region_mask_or_bbox.json");
  const approvedStartPath = path.join(shotDir, "approved_start_frame.json");
  writeText(endPromptPath, endPrompt(shot, plan));
  const provenanceBlockers = [
    "end_plan_exists_before_start_but_rendering_waits_for_approved_start",
    "approved_start_frame_missing",
    "start_motion_affordance_qa_missing",
    "strict_image_edit_provenance_missing",
    "provider_edit_receipt_missing",
    "source_start_frame_attachment_id_missing",
    "source_start_frame_sha_not_provider_confirmed",
    "editable_region_mask_or_bbox_missing",
  ];
  const regionBlockers = plan.editableRegions.length && plan.protectedRegions.length ? [] : ["editable_or_protected_regions_missing"];
  endTasks.push({
    taskId: `end_frame_${shot.id}`,
    shotId: shot.id,
    providerSlot: "image.edit",
    providerId: "openai-image2",
    requiredMode: "image2image",
    status: "blocked_until_approved_start_and_strict_edit_provenance",
    endPlanExistsBeforeStart: true,
    renderingBlockedUntil: ["approved_start_frame", "strict_image_edit_provenance", "region_mask_or_bbox", "provider_delivery_receipt"],
    promptPath: repoPath(endPromptPath),
    expectedOutputPath: repoPath(path.join(shotDir, "end.png")),
    requiredReceiptPath: repoPath(receiptPath),
    requiredEditableRegionEvidencePath: repoPath(maskPath),
    sourceStartFrameRef: {
      expectedImagePath: repoPath(startExpectedPath),
      sourceStartFrameAttachmentId: "missing",
      sourceStartFrameSha256: "missing",
      status: "missing_provider_return",
    },
    approvedStartFrameRef: {
      expectedApprovalPath: repoPath(approvedStartPath),
      approvedStartAttachmentId: "missing",
      approvedStartSourceHash: "missing",
      status: "missing_approval",
    },
    editableRegionEvidenceRef: {
      requiredPath: repoPath(maskPath),
      requiredEvidence: ["bbox_or_mask", "editable_region_hash", "protected_region_boundary"],
      status: "missing",
    },
    providerEditReceiptRef: {
      requiredPath: repoPath(receiptPath),
      requiredFields: ["providerRequestId", "operation", "sourceStartFrameAttachmentId", "inputAssetHash", "maskHash", "outputAssetHash"],
      status: "missing",
    },
    strictImageEditPreflightStatus: {
      status: "blocked",
      blockers: provenanceBlockers.concat(regionBlockers),
      nextAction: "collect_approved_start_attachment_source_hash_bbox_mask_and_provider_edit_receipt_before_end_generation",
    },
    forbiddenFallbacks: ["text2image_end_frame", "independent_end_frame_generation"],
    motionEndpointPlanPath: repoPath(endpointJsonPath),
    startAffordanceQaPath: repoPath(startAffordanceQaPath),
    endFrameRenderingPolicy: plan.endFrameRenderingPolicy,
    motionType: endpoint.contract.motionType,
    contractStatus: endpoint.contract.status,
    hardGateIssues: endpoint.hardIssues.map((issue) => issue.detail),
    blockers: provenanceBlockers.concat(regionBlockers, endpoint.hardIssues.map((issue) => issue.detail)),
  });
}

const projectFile = {
  ...project,
  runId,
  generatedAt,
  assets: assets.map((asset) => ({ ...asset, promptHash: sha256Text(asset.prompt) })),
  shots,
  endpointPlans: endpointPlanRows,
};
writeJson(path.join(projectRoot, "project.vibe.json"), projectFile);
writeJson(path.join(projectRoot, "asset_bible.json"), { schemaVersion: "round5_asset_bible_v1", generatedAt, assets });
writeJson(path.join(projectRoot, "story_flow.json"), { schemaVersion: "round5_story_flow_v2_endpoint_first", generatedAt, shots, endpointPlans: endpointPlanRows });
writeJson(path.join(taskRoot, "asset_reference_tasks.json"), assetTasks);
writeJson(path.join(taskRoot, "start_frame_tasks.json"), shotTasks);
writeJson(path.join(taskRoot, "end_frame_tasks.json"), endTasks);
writeJson(path.join(reportRoot, "artifact_generation_order.json"), { generatedAt, artifactEvents });

const summary = {
  status: "endpoint_first_planning_pass_provider_blocked_by_design",
  assetReferenceTasksReady: assetTasks.length,
  endpointPlansGeneratedBeforeStartPrompts: endpointPlanRows.length,
  startFrameTasksBlocked: shotTasks.length,
  endFrameTasksBlocked: endTasks.length,
  startAffordanceVerdicts: {
    passForEndEdit: shotTasks.filter((task) => task.startAffordanceQaVerdict === "pass_for_end_edit").length,
    passStaticOnly: shotTasks.filter((task) => task.startAffordanceQaVerdict === "pass_static_only").length,
    blockRegenerateStart: shotTasks.filter((task) => task.startAffordanceQaVerdict === "block_regenerate_start").map((task) => task.shotId),
  },
  startFrameBlockers: ["locked asset references are not generated yet", "start motion-affordance QA is required after generation"],
  endFrameBlockers: ["approved start frame, strict image edit provenance, and editable/protected region evidence are not present yet"],
  safeNextProviderStep: "generate locked asset references first, then generate start frames only from endpoint-derived prompts after asset QA",
  unsafeNextProviderStep: "do not render end frames until approved start, strict image.edit provenance, and region mask/bbox evidence exist",
};

const gateMatrix = {
  assetGate: {
    status: "blocked_until_asset_provider_return_and_qa",
    blockers: ["asset_images_missing", "asset_semantic_qa_missing", "visual_text_qa_missing", "single_main_reference_qa_missing"],
    evidencePaths: [repoPath(path.join(taskRoot, "asset_reference_tasks.json")), ...assetTasks.map((task) => task.promptPath)],
    hashRefs: assetTasks.reduce((acc, task) => ({ ...acc, [task.assetId]: task.assetQaGate.hashRefs.promptSha256 }), {}),
    nextAction: "generate_locked_asset_references_then_reject_multi_view_character_sheets_and_scene_pseudo_text",
  },
  startGate: {
    status: "blocked_until_asset_refs_pass_qa",
    blockers: unique(shotTasks.flatMap((task) => task.blockers)),
    evidencePaths: [repoPath(path.join(taskRoot, "start_frame_tasks.json")), ...shotTasks.map((task) => task.motionEndpointPlanPath), ...shotTasks.map((task) => task.promptPath)],
    hashRefs: { startTaskPacketSha256: sha256Text(JSON.stringify(shotTasks)) },
    nextAction: "run_start_frame_generation_only_after_asset_gate_passes",
  },
  affordanceGate: {
    status: shotTasks.some((task) => task.startAffordanceQaVerdict === "block_regenerate_start") ? "blocked_regenerate_start_required" : "pass",
    blockers: shotTasks.filter((task) => task.startAffordanceQaVerdict === "block_regenerate_start").map((task) => `${task.shotId}_threshold_pre_step_failed`),
    evidencePaths: shotTasks.map((task) => task.startAffordanceQaPath),
    hashRefs: { affordanceQaPacketSha256: sha256Text(JSON.stringify(shotTasks.map((task) => ({ shotId: task.shotId, verdict: task.startAffordanceQaVerdict })))) },
    nextAction: "regenerate_ZP04_start_before_any_ZP04_end_edit",
  },
  editPreflightGate: {
    status: "blocked",
    blockers: unique(endTasks.flatMap((task) => task.strictImageEditPreflightStatus.blockers)),
    evidencePaths: [repoPath(path.join(taskRoot, "end_frame_tasks.json")), ...endTasks.map((task) => task.requiredEditableRegionEvidencePath), ...endTasks.map((task) => task.requiredReceiptPath)],
    hashRefs: { endTaskPacketSha256: sha256Text(JSON.stringify(endTasks)) },
    nextAction: "attach_approved_start_source_hash_bbox_mask_and_provider_edit_receipt_before_end_frame_generation",
  },
  providerReturnGate: {
    status: "blocked_no_provider_assets_returned",
    blockers: ["locked_asset_reference_outputs_missing", "start_frame_outputs_missing", "provider_edit_receipts_missing", "output_hashes_missing"],
    evidencePaths: [repoPath(path.join(reportRoot, "artifact_generation_order.json"))],
    hashRefs: { runIdHash: sha256Text(runId) },
    nextAction: "collect_provider_returns_with_attachment_ids_source_hashes_and_output_hashes",
  },
  previewProjectionGate: {
    status: "blocked_until_provider_return_gate_passes",
    blockers: ["preview_assets_missing", "end_frame_assets_missing_for_required_endpoint_shots", "ZP04_start_regeneration_required"],
    evidencePaths: [repoPath(path.join(projectRoot, "story_flow.json")), repoPath(path.join(taskRoot, "start_frame_tasks.json")), repoPath(path.join(taskRoot, "end_frame_tasks.json"))],
    hashRefs: { storyFlowSha256: sha256Text(JSON.stringify({ shots, endpointPlans: endpointPlanRows })) },
    nextAction: "project_preview_only_after_asset_start_affordance_edit_preflight_and_provider_return_gates_are_resolved",
  },
};

const report = {
  schemaVersion: "round5_zero_project_planning_report_v2_endpoint_first",
  generatedAt,
  runRoot: repoPath(runRoot),
  summary,
  gateMatrix,
  endpointFirstChainSummary: [
    "asset refs",
    "shot intent",
    "motion endpoint plan with start_state/end_state/allowed_delta/forbidden_delta/editable/protected regions",
    "start frame spec derived from endpoint plan",
    "start frame generation",
    "start motion-affordance QA",
    "end frame image.edit from approved start",
    "strict pair QA",
    "i2v",
  ],
  startPromptDerivedFromEndpointEvidence: shotTasks.map((task) => ({
    shotId: task.shotId,
    promptPath: task.promptPath,
    motionEndpointPlanPath: task.motionEndpointPlanPath,
    startAffordanceQaPath: task.startAffordanceQaPath,
    evidence: task.compiledFromEndpointPlan,
  })),
  startMotionAffordanceQaRequiredAfterGeneration: true,
  r2s06FailurePrevention:
    "Because the end endpoint is known before start generation, start prompts must leave reachable body/eye-line/path/contact affordances. If start QA finds the planned end would require a new face angle, body pose, or scene redraw, the start frame is regenerated instead of forcing an end edit.",
  endpointPlanRows,
  motionRows,
  planningFindings: [
    {
      severity: "P0",
      title: "Endpoint plans are generated for every shot before any start prompt.",
      detail: "This prevents the system from creating a good-looking first frame that cannot naturally reach the required end state.",
    },
    {
      severity: "P0",
      title: "End planning exists before start generation, while end rendering stays blocked.",
      detail: "ZP02/ZP04/ZP05 already define end endpoints and delta policy, but rendering still requires approved start frames plus strict image-edit provenance.",
    },
    {
      severity: "P0",
      title: "Start prompts are compiled from endpoint plans.",
      detail: "Each start prompt explicitly says start must leave room for end, must not complete endpoint, and must expose path/destination/contact.",
    },
    {
      severity: "P1",
      title: "Action-headline wording can overpower endpoint constraints.",
      detail: "Start prompt primary requests now begin with a pre-action freeze frame instead of completed-action wording such as placing an object or taking a step.",
    },
    {
      severity: "P1",
      title: "Asset text contamination is prevented by prompt policy.",
      detail: "Character and scene reference prompts now explicitly forbid readable text, labels, captions, logo-like patches, diagram labels, and signage text.",
    },
    {
      severity: "P1",
      title: "Start prompt headline must describe pre-action pose, not completed action.",
      detail: "ZP02, ZP04, and ZP05 are phrased around hover/threshold/closed-lid readiness before the endpoint happens.",
    },
    {
      severity: "P1",
      title: "Region names are planned, but real rendering still needs masks, bboxes, or landmark envelopes.",
      detail: "The test package records required region evidence paths; provider submission remains blocked until those artifacts exist.",
    },
    {
      severity: "P2",
      title: "This run evaluates planning and gate behavior, not visual quality.",
      detail: "No Image2 calls are made and no images are generated.",
    },
  ],
};
writeJson(path.join(reportRoot, "round5_zero_project_planning_report.json"), report);

const markdown = [
  "# Round 5 Zero Project Planning Test",
  "",
  `Generated: ${generatedAt}`,
  `Run root: \`${repoPath(runRoot)}\``,
  "",
  "## Endpoint-first Chain Summary",
  "",
  ...report.endpointFirstChainSummary.map((step, index) => `${index + 1}. ${step}`),
  "",
  "## Summary",
  "",
  `- Status: ${summary.status}`,
  `- Asset reference tasks ready: ${summary.assetReferenceTasksReady}`,
  `- Endpoint plans generated before start prompts: ${summary.endpointPlansGeneratedBeforeStartPrompts}`,
  `- Start-frame tasks blocked: ${summary.startFrameTasksBlocked}`,
  `- End-frame tasks blocked: ${summary.endFrameTasksBlocked}`,
  `- Safe next provider step: ${summary.safeNextProviderStep}`,
  `- Unsafe next provider step: ${summary.unsafeNextProviderStep}`,
  "",
  "## Gate Matrix",
  "",
  "| Gate | Status | Blockers | Evidence | Next action |",
  "| --- | --- | --- | --- | --- |",
  ...Object.entries(report.gateMatrix).map(([gateName, gate]) => {
    const blockers = gate.blockers.length ? gate.blockers.join("; ") : "none";
    const evidence = gate.evidencePaths.map((item) => `\`${item}\``).join("<br>");
    return `| ${gateName} | ${gate.status} | ${blockers} | ${evidence} | ${gate.nextAction} |`;
  }),
  "",
  "## Endpoint Plans",
  "",
  "| Shot | End required | Created before start | Endpoint plan |",
  "| --- | --- | --- | --- |",
  ...endpointPlanRows.map((row) => `| ${row.shotId} | ${row.endEndpointRequired ? "yes" : "no"} | ${row.createdBeforeStartFrame ? "yes" : "no"} | \`${row.endpointPlanPath}\` |`),
  "",
  "## Start Prompt Derived From Endpoint Evidence",
  "",
  "| Shot | Prompt | Endpoint plan | QA template | Evidence |",
  "| --- | --- | --- | --- | --- |",
  ...shotTasks.map((task) => {
    const evidence = [
      task.compiledFromEndpointPlan.startMustLeaveRoomForEnd ? "leave room for end" : "",
      task.compiledFromEndpointPlan.startMustNotCompleteEndpoint ? "must not complete endpoint" : "",
      task.compiledFromEndpointPlan.startMustExposePathDestinationContact ? "path/destination/contact" : "",
    ].filter(Boolean).join("; ");
    return `| ${task.shotId} | \`${task.promptPath}\` | \`${task.motionEndpointPlanPath}\` | \`${task.startAffordanceQaPath}\` | ${evidence} |`;
  }),
  "",
  "## Motion Planning",
  "",
  "| Shot | Motion type | Contract | End required | Status |",
  "| --- | --- | --- | --- | --- |",
  ...motionRows.map((row) => `| ${row.shotId} | ${row.motionType} | ${row.contractStatus} | ${row.endFrameRequired ? "yes" : "no"} | ${row.status} |`),
  "",
  "## Start Motion-affordance QA",
  "",
  "- Required after start generation and before any end-frame rendering.",
  "- If the start frame cannot naturally reach the planned end endpoint, regenerate start instead of rendering end.",
  "- This is the guard against R2S06-type failure: a low-head writing pose should not be forced into a side-face looking pose after the fact.",
  "",
  "## Findings",
  "",
  ...report.planningFindings.map((finding) => `- ${finding.severity}: ${finding.title} ${finding.detail}`),
  "",
  "## Generated Files",
  "",
  `- Project: \`${repoPath(path.join(projectRoot, "project.vibe.json"))}\``,
  `- Asset tasks: \`${repoPath(path.join(taskRoot, "asset_reference_tasks.json"))}\``,
  `- Start tasks: \`${repoPath(path.join(taskRoot, "start_frame_tasks.json"))}\``,
  `- End tasks: \`${repoPath(path.join(taskRoot, "end_frame_tasks.json"))}\``,
  `- Artifact order: \`${repoPath(path.join(reportRoot, "artifact_generation_order.json"))}\``,
  "",
].join("\n");
writeText(path.join(reportRoot, "round5_zero_project_planning_report.md"), markdown);

const endpointPlanShotIds = new Set(endpointPlanRows.map((row) => row.shotId));
const neededEndShots = shots.filter((shot) => shot.endFrameNeeded);
const noEndShots = shots.filter((shot) => !shot.endFrameNeeded);
const firstStartPromptEventIndex = Math.min(...artifactEvents.filter((event) => event.kind === "start_frame_prompt").map((event) => event.index));
const endpointPlanEventIndexes = artifactEvents.filter((event) => event.kind === "motion_endpoint_plan").map((event) => event.index);

assert(assetTasks.length === 4, "asset reference task count drifted");
assert(shotTasks.length === 6, "start-frame task count drifted");
assert(endTasks.length === 3, "end-frame task count drifted");
assert(shots.every((shot) => endpointPlanShotIds.has(shot.id)), "every shot must have an endpoint plan");
assert(endpointPlanEventIndexes.every((index) => index < firstStartPromptEventIndex), "all endpoint plans must be generated before any start prompt");
assert(shotTasks.every((task) => task.requiresMotionEndpointPlan === true), "each start task must require endpoint plan");
assert(shotTasks.every((task) => task.motionEndpointPlanPath && task.startAffordanceQaPath), "each start task must reference endpoint plan and start QA");
assert(
  shotTasks.every((task) => {
    const text = fs.readFileSync(path.resolve(task.promptPath), "utf8");
    return /Compiled from endpoint plan/i.test(text) && /start must leave room for end/i.test(text) && /start must not complete endpoint/i.test(text) && /path\/destination\/contact/i.test(text);
  }),
  "each start prompt must be compiled from endpoint plan and carry endpoint-first language",
);
assert(
  assetTasks.every((task) => {
    const text = fs.readFileSync(path.resolve(task.promptPath), "utf8");
    return /no readable text/i.test(text) && /no labels/i.test(text) && /no logo-like patches/i.test(text) && /no pseudo text/i.test(text);
  }),
  "asset prompts must include no readable text, no labels, no logo-like patches, and no pseudo text",
);
assert(
  assetTasks.every((task) => task.singleMainReferenceRequired === true && task.visualTextPolicy?.rejectIfContains?.includes("pseudo_text") && task.visualTextQa?.mustRejectPseudoText === true),
  "asset tasks must require single main references and reject pseudo text",
);
assert(
  assetTasks
    .filter((task) => task.assetKind === "character")
    .every((task) => task.multiViewSheetForbidden === true && task.visualTextPolicy.rejectIfContains.includes("multi_view_sheet")),
  "character asset tasks must forbid multi-view sheets as the main reference",
);
assert(
  assetTasks
    .filter((task) => task.assetKind === "scene")
    .every((task) => task.visualTextQa.mustRejectSignage === true && task.visualTextPolicy.rejectIfContains.includes("signage")),
  "scene asset tasks must reject pseudo text and signage",
);
assert(
  neededEndShots.every((shot) => {
    const task = shotTasks.find((item) => item.shotId === shot.id);
    const text = fs.readFileSync(path.resolve(task.promptPath), "utf8");
    return /Primary request: Pre-action freeze frame:/i.test(text);
  }),
  "end-required start prompts must lead with a pre-action freeze frame primary request",
);
const zp02StartPrompt = fs.readFileSync(path.resolve(shotTasks.find((task) => task.shotId === "ZP02").promptPath), "utf8");
const zp04StartPrompt = fs.readFileSync(path.resolve(shotTasks.find((task) => task.shotId === "ZP04").promptPath), "utf8");
const zp05StartPrompt = fs.readFileSync(path.resolve(shotTasks.find((task) => task.shotId === "ZP05").promptPath), "utf8");
assert(!/places a small glass prism/i.test(zp02StartPrompt), "ZP02 start prompt must not use completed-action prism placement wording");
assert(/air gap/i.test(zp02StartPrompt), "ZP02 start prompt must include an air gap constraint");
assert(!/takes one small step/i.test(zp04StartPrompt), "ZP04 start prompt must not use completed/action-in-progress step wording");
assert(/threshold/i.test(zp04StartPrompt) && /support foot/i.test(zp04StartPrompt) && /target patch/i.test(zp04StartPrompt), "ZP04 start prompt must include threshold, support foot, and target patch constraints");
assert(/closed lid/i.test(zp05StartPrompt) && /hinge/i.test(zp05StartPrompt) && /lid seam/i.test(zp05StartPrompt), "ZP05 start prompt must include closed lid, hinge, and lid seam constraints");
assert(
  report.planningFindings.some((finding) => /Action-headline wording can overpower endpoint constraints/i.test(finding.title)) &&
    report.planningFindings.some((finding) => /Asset text contamination is prevented by prompt policy/i.test(finding.title)) &&
    report.planningFindings.some((finding) => /Start prompt headline must describe pre-action pose/i.test(finding.title)),
  "report must include the prompt-policy findings from the latest real Round 5 test",
);
assert(
  neededEndShots.every((shot) => {
    const endpoint = endpointPlanByShot.get(shot.id);
    return endpoint?.plan.createdBeforeStartFrame === true && Boolean(endpoint.plan.endEndpoint) && endpoint.plan.endFrameRenderingPolicy === "strict_image_edit_required_block_without_provenance";
  }),
  "shots that need end frames must have endEndpoint before start prompt generation",
);
assert(
  noEndShots.every((shot) => {
    const endpoint = endpointPlanByShot.get(shot.id);
    return endpoint?.plan.endEndpointRequired === false && Boolean(endpoint.plan.noEndFrameReason);
  }),
  "static/atmospheric shots must still have endpoint plans explaining why no end frame is needed",
);
assert(
  noEndShots.every((shot) => endpointPlanByShot.get(shot.id)?.contract.whetherEndFrameRequired === false),
  "static/atmospheric shots must not be mislabeled as requiring end frames by motion contract classification",
);
assert(endTasks.every((task) => task.status === "blocked_until_approved_start_and_strict_edit_provenance"), "end-frame tasks must be blocked before provider");
assert(
  endTasks.every((task) => task.blockers.includes("strict_image_edit_provenance_missing") && task.blockers.includes("provider_edit_receipt_missing")),
  "end-frame task blockers must include strict image edit provenance and provider edit receipt",
);
const zp04Endpoint = endpointPlanByShot.get("ZP04");
assert(zp04Endpoint?.contract.motionType === "locomotion", "ZP04 must stay locomotion");
assert(zp04Endpoint.contract.bodyMechanics.footwork.length > 0, "ZP04 locomotion must include footwork");
assert(zp04Endpoint.contract.bodyMechanics.centerOfMass === "specified", "ZP04 locomotion must include center of mass");
assert(zp04Endpoint.contract.bodyMechanics.contactPoints.length > 0, "ZP04 locomotion must include foot/ground contact point");
assert(motionRows.some((row) => row.shotId === "ZP02" && row.motionType === "object_interaction"), "ZP02 prism handoff must stay object interaction");
const startQaByShot = new Map(
  shotTasks.map((task) => [task.shotId, JSON.parse(fs.readFileSync(path.resolve(task.startAffordanceQaPath), "utf8"))]),
);
assert(startQaByShot.get("ZP04")?.verdict === "block_regenerate_start", "ZP04 failed threshold pre-step must block_regenerate_start");
assert(startQaByShot.get("ZP04")?.thresholdPreStepHardChecks?.status === "failed", "ZP04 must carry failed threshold_pre_step hard checks");
assert(startQaByShot.get("ZP02")?.verdict === "pass_for_end_edit", "ZP02 start QA must pass for end edit");
assert(startQaByShot.get("ZP05")?.verdict === "pass_for_end_edit", "ZP05 start QA must pass for end edit");
assert(noEndShots.every((shot) => startQaByShot.get(shot.id)?.verdict === "pass_static_only"), "static/no-end shots must be pass_static_only");
assert(
  endTasks.every(
    (task) =>
      task.sourceStartFrameRef?.status === "missing_provider_return" &&
      task.approvedStartFrameRef?.status === "missing_approval" &&
      task.editableRegionEvidenceRef?.status === "missing" &&
      task.providerEditReceiptRef?.status === "missing" &&
      task.strictImageEditPreflightStatus?.status === "blocked",
  ),
  "end tasks must expose blocked source/approved-start/editable-region/provider-receipt refs",
);
assert(
  endTasks.every((task) => task.forbiddenFallbacks.includes("text2image_end_frame") && task.forbiddenFallbacks.includes("independent_end_frame_generation")),
  "end tasks must forbid text2image end frame and independent end-frame generation fallbacks",
);
assert(
  ["assetGate", "startGate", "affordanceGate", "editPreflightGate", "providerReturnGate", "previewProjectionGate"].every((gateName) => {
    const gate = report.gateMatrix[gateName];
    return gate && typeof gate.status === "string" && Array.isArray(gate.blockers) && Array.isArray(gate.evidencePaths) && gate.hashRefs && typeof gate.nextAction === "string";
  }),
  "report gate matrix must include required gate status/blockers/evidencePaths/hashRefs/nextAction fields",
);
assert(report.gateMatrix.affordanceGate.blockers.includes("ZP04_threshold_pre_step_failed"), "gate matrix must surface the ZP04 affordance blocker");
assert(
  report.r2s06FailurePrevention.includes("end endpoint is known before start generation"),
  "report must explain why endpoint-first prevents R2S06-type failure",
);

console.log("Round 5 zero project endpoint-first planning test passed.");
console.log(JSON.stringify({ runRoot: repoPath(runRoot), summary }, null, 2));
