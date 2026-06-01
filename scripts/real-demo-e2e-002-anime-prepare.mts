import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/002-anime-pressure");
const projectRoot = path.join(runRoot, "project");
const packetsRoot = path.join(runRoot, "task_packets");
const envelopesRoot = path.join(runRoot, "subagent_envelopes");
const promptsRoot = path.join(runRoot, "prompt_requests");
const providerObservationRoot = path.join(runRoot, "provider_observations");
const workerProvenanceRoot = path.join(runRoot, "worker_provenance");
const semanticQaRoot = path.join(runRoot, "semantic_qa");
const outputRoot = path.join(runRoot, "outputs/shots");
const reportsRoot = path.join(runRoot, "reports");

const generatedAt = new Date().toISOString();
const projectId = "real_demo_e2e_002_anime_pressure";
const runId = "real_demo_e2e_002_anime_pressure_run_20260503";

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
  semanticQaRoot,
  outputRoot,
  reportsRoot,
]) {
  ensureDir(dir);
}

const characters = [
  {
    id: "char_mika_arai",
    type: "character",
    lockStatus: "locked_text_authority_v1",
    displayName: "Mika Arai",
    description:
      "17-year-old Japanese high school astronomy club lead, short dark navy bob, small yellow hair clip above her left temple, navy school cardigan, white shirt, slate pleated skirt, thin red ribbon, steady determined expression.",
    mustPreserve: [
      "short dark navy bob",
      "small yellow hair clip above her left temple",
      "navy school cardigan with white shirt and slate pleated skirt",
      "thin red ribbon at the collar",
      "quiet determined expression, not exaggerated comedy acting",
    ],
    mustAvoid: [
      "long hair",
      "blonde hair",
      "adult office clothing",
      "fantasy armor",
      "different school uniform colors",
      "chibi proportions",
    ],
  },
  {
    id: "char_ren_kasai",
    type: "character",
    lockStatus: "locked_text_authority_v1",
    displayName: "Ren Kasai",
    description:
      "18-year-old camera club student, lean build, messy warm brown hair, round black glasses, forest green windbreaker over school shirt, canvas camera strap across his chest, cautious analytical demeanor.",
    mustPreserve: [
      "messy warm brown hair",
      "round black glasses",
      "forest green windbreaker over school shirt",
      "canvas camera strap across the chest",
      "cautious analytical body language",
    ],
    mustAvoid: [
      "no glasses",
      "military outfit",
      "sports jersey",
      "white lab coat",
      "older adult face",
      "heroic action pose",
    ],
  },
  {
    id: "char_yuna_mori",
    type: "character",
    lockStatus: "locked_text_authority_v1",
    displayName: "Yuna Mori",
    description:
      "16-year-old first-year student, shoulder-length black hair tied in a low side ponytail with a pale blue tie, cream school sweater vest, navy skirt, compact field notebook held close, nervous but brave.",
    mustPreserve: [
      "low side ponytail with pale blue tie",
      "cream school sweater vest",
      "compact field notebook held close when present",
      "younger nervous but brave energy",
      "same school-universe proportions as Mika and Ren",
    ],
    mustAvoid: [
      "twin tails",
      "red hair",
      "formal adult suit",
      "large weapon",
      "comic panic face",
      "changing into Mika's hair clip or Ren's glasses",
    ],
  },
];

const scenes = [
  {
    id: "scene_rooftop_observatory",
    type: "scene",
    lockStatus: "locked_text_authority_v1",
    displayName: "Rooftop school observatory at blue hour",
    description:
      "A compact high school rooftop observatory at blue hour, small white telescope dome on the rear-left roof corner, chain-link safety fence around the perimeter, concrete utility floor with painted compass mark, distant city lights below, a low maintenance shed on screen-right.",
    spatialAnchors: [
      "white telescope dome stays rear-left in wide shots",
      "chain-link fence wraps the roof edge",
      "painted compass mark sits near the center foreground",
      "maintenance shed stays screen-right",
      "city lights sit below the fence line, not above the roof",
    ],
    mustAvoid: [
      "giant futuristic observatory",
      "open grass field",
      "daytime sunlight",
      "interior classroom",
      "fantasy castle roof",
      "text labels on buildings",
    ],
  },
  {
    id: "scene_abandoned_arcade",
    type: "scene",
    lockStatus: "locked_text_authority_v1",
    displayName: "Rainy abandoned shopping arcade",
    description:
      "A covered old shopping arcade after rain, closed metal shutters on both sides, one warm vending machine glow on screen-left, shallow puddles on worn tile floor, faded star festival banners hanging overhead, a narrow exit toward deep blue night at the far end.",
    spatialAnchors: [
      "vending machine glow remains screen-left",
      "closed shutters line both sides",
      "faded star festival banners hang overhead",
      "wet tile floor creates shallow reflections only",
      "far exit is a narrow blue rectangle in depth",
    ],
    mustAvoid: [
      "busy open mall",
      "bright daylight market",
      "cyberpunk neon overload",
      "subway station",
      "wide car street",
      "readable shop signs or brand text",
    ],
  },
  {
    id: "scene_underground_platform",
    type: "scene",
    lockStatus: "locked_text_authority_v1",
    displayName: "Underground maintenance platform",
    description:
      "A hidden underground maintenance platform below the old arcade, narrow service rail track at floor center, green safety lights along the left wall, yellow-black warning stripe on the platform edge, exposed pipes overhead, heavy sealed hatch at the far end.",
    spatialAnchors: [
      "service rail track runs through the floor center",
      "green safety lights stay on screen-left wall",
      "yellow-black warning stripe marks the platform edge",
      "exposed pipes cross overhead",
      "sealed hatch stays at the far end until the final reveal",
    ],
    mustAvoid: [
      "public subway platform with passengers",
      "spaceship cockpit",
      "open cave",
      "sunlit street",
      "giant rocket reveal too early",
      "screens full of UI text",
    ],
  },
];

const style = {
  id: "style_clean_anime_film_low_texture",
  type: "style",
  lockStatus: "locked_text_authority_v1",
  displayName: "Clean anime film frame, low texture",
  positive:
    "clean anime film frame, modern 1990s-inspired theatrical anime mood, precise linework, soft cel shading, restrained painted backgrounds, low texture, gentle film grain, cinematic lens language, clean readable silhouettes, controlled color palette, no glossy AI surface.",
  negative:
    "no hyperrealistic skin, no 3D render, no heavy tactile texture, no manga panel borders, no text overlays, no UI diagram, no watermark, no poster collage, no excessive particles, no bokeh blob decoration, no over-detailed gritty surfaces.",
};

const plannedShotIds = new Set(["S01", "S03", "S06", "S08", "S11", "S14"]);

const shots = [
  {
    id: "S01",
    sectionId: "ACT_A",
    sceneId: "scene_rooftop_observatory",
    title: "Mika opens the rooftop observatory gate",
    durationSeconds: 5,
    generationStatus: "real_image_planned",
    characters: ["char_mika_arai"],
    action:
      "Mika steps through the rooftop gate and pauses on the painted compass mark, seeing that the small telescope dome is unlocked.",
    camera: "wide 28mm anime establishing frame, eye level, roof geography clear",
    actorPosition: "Mika stands lower-center on the compass mark; dome rear-left, maintenance shed screen-right",
    continuity: "Establishes the rooftop layout and Mika identity before the other students arrive.",
  },
  {
    id: "S02",
    sectionId: "ACT_A",
    sceneId: "scene_rooftop_observatory",
    title: "Ren climbs onto the roof with his camera",
    durationSeconds: 5,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai"],
    action: "Ren enters from the stairwell side carrying his camera while Mika points toward the dome latch.",
    camera: "medium-wide 35mm, lateral composition from near the fence",
    actorPosition: "Mika stays near center; Ren enters from screen-right near the maintenance shed",
    continuity: "Ren joins without changing the dome, fence, or compass mark positions.",
  },
  {
    id: "S03",
    sectionId: "ACT_A",
    sceneId: "scene_rooftop_observatory",
    title: "The compass mark glows under cloud shadow",
    durationSeconds: 5,
    generationStatus: "real_image_planned",
    characters: ["char_mika_arai", "char_ren_kasai"],
    action:
      "Mika kneels near the compass mark while Ren photographs it; a faint blue line points from the mark toward the dome.",
    camera: "low medium 35mm, foreground compass mark, characters kept readable",
    actorPosition: "Mika kneels lower-left; Ren stands upper-right with camera strap visible",
    continuity: "Must preserve S01 rooftop geography and the exact school-uniform identities.",
  },
  {
    id: "S04",
    sectionId: "ACT_A",
    sceneId: "scene_rooftop_observatory",
    title: "Yuna appears behind the fence shadow",
    durationSeconds: 4,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "Yuna arrives holding her field notebook, hesitating in the doorway while Mika and Ren look back.",
    camera: "medium 50mm, doorway and fence shadow frame Yuna",
    actorPosition: "Yuna near screen-right doorway; Mika and Ren turn from center-left",
    continuity: "Yuna is introduced as a third student, not a stranger in different style.",
  },
  {
    id: "S05",
    sectionId: "ACT_A",
    sceneId: "scene_rooftop_observatory",
    title: "They find the arcade clue",
    durationSeconds: 4,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "Yuna opens the notebook to a sketch of an old shopping arcade matching the compass direction.",
    camera: "close insert with hands and partial faces, no readable long text",
    actorPosition: "Mika hand near the compass edge; Ren camera strap crossing frame; Yuna notebook centered",
    continuity: "Moves story toward the arcade while staying on rooftop.",
  },
  {
    id: "S06",
    sectionId: "ACT_B",
    sceneId: "scene_abandoned_arcade",
    title: "The three students enter the rainy arcade",
    durationSeconds: 6,
    generationStatus: "real_image_planned",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action:
      "Mika leads Ren and Yuna into the covered arcade, the screen-left vending machine glow reflecting faintly on wet tiles.",
    camera: "wide 28mm, deep perspective toward the blue far exit",
    actorPosition: "Mika foreground center, Ren just behind screen-right, Yuna behind screen-left holding notebook",
    continuity: "Scene shift from rooftop to arcade; all character identities and outfits must stay locked.",
  },
  {
    id: "S07",
    sectionId: "ACT_B",
    sceneId: "scene_abandoned_arcade",
    title: "Ren checks the shutter reflections",
    durationSeconds: 5,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai"],
    action: "Ren crouches near a puddle to compare the shutter reflection with the rooftop compass angle.",
    camera: "low 35mm, puddle reflection controlled, vending machine still screen-left",
    actorPosition: "Ren foreground right with glasses and camera strap; Mika waits mid-left",
    continuity: "Do not turn reflections into abstract UI or a different location.",
  },
  {
    id: "S08",
    sectionId: "ACT_B",
    sceneId: "scene_abandoned_arcade",
    title: "Mika notices the star festival banner",
    durationSeconds: 5,
    generationStatus: "real_image_planned",
    characters: ["char_mika_arai", "char_yuna_mori"],
    action:
      "Mika reaches up toward a faded star festival banner while Yuna compares it to her notebook near the vending machine glow.",
    camera: "medium 50mm, banner overhead, vending machine screen-left background",
    actorPosition: "Mika center reaching up; Yuna lower-left with notebook; far exit still visible",
    continuity: "Preserve arcade geography from S06 and distinguish Mika from Yuna clearly.",
  },
  {
    id: "S09",
    sectionId: "ACT_B",
    sceneId: "scene_abandoned_arcade",
    title: "The hidden floor hatch appears",
    durationSeconds: 5,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "The group pulls aside a loose tile near the vending machine, revealing a dark maintenance hatch below.",
    camera: "high medium 35mm looking down at floor layout",
    actorPosition: "Mika left hand on tile, Ren right side with camera strap, Yuna behind holding notebook",
    continuity: "This is still the arcade floor, not the underground platform yet.",
  },
  {
    id: "S10",
    sectionId: "ACT_B",
    sceneId: "scene_abandoned_arcade",
    title: "They descend below the arcade",
    durationSeconds: 4,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "Mika lowers herself through the hatch first while Ren steadies the edge and Yuna watches the arcade exit.",
    camera: "medium overhead, hatch geometry clear",
    actorPosition: "Mika partly below frame; Ren screen-right; Yuna upper-left near vending machine glow",
    continuity: "Transition shot into the underground platform.",
  },
  {
    id: "S11",
    sectionId: "ACT_C",
    sceneId: "scene_underground_platform",
    title: "Mika lands on the hidden maintenance platform",
    durationSeconds: 6,
    generationStatus: "real_image_planned",
    characters: ["char_mika_arai"],
    action:
      "Mika steps onto the narrow underground platform, lit by green safety lights, with the service rail track running toward a sealed hatch.",
    camera: "wide 28mm, platform edge and rail track visible, hatch far end",
    actorPosition: "Mika lower-right near warning stripe; green lights screen-left; rail track center",
    continuity: "Establishes the underground scene; no public passengers or giant rocket reveal.",
  },
  {
    id: "S12",
    sectionId: "ACT_C",
    sceneId: "scene_underground_platform",
    title: "Ren and Yuna follow into the green light",
    durationSeconds: 5,
    generationStatus: "queued",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "Ren and Yuna climb down behind Mika, their silhouettes crossing the warning stripe.",
    camera: "medium-wide 35mm from platform edge",
    actorPosition: "Mika mid-depth facing hatch; Ren screen-left; Yuna screen-right holding notebook",
    continuity: "All three characters must keep their rooftop/arcade identities.",
  },
  {
    id: "S13",
    sectionId: "ACT_C",
    sceneId: "scene_underground_platform",
    title: "Yuna matches the notebook to the rail track",
    durationSeconds: 5,
    generationStatus: "parked",
    characters: ["char_yuna_mori", "char_ren_kasai"],
    action: "Yuna kneels beside the service rail track and realizes the notebook map is actually a platform diagram.",
    camera: "low medium 50mm, rail track foreground center",
    actorPosition: "Yuna lower-center with notebook; Ren behind her, glasses catching green side light",
    continuity: "Do not show readable UI text; keep the track centered.",
  },
  {
    id: "S14",
    sectionId: "ACT_C",
    sceneId: "scene_underground_platform",
    title: "The sealed hatch recognizes the compass mark",
    durationSeconds: 6,
    generationStatus: "real_image_planned",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action:
      "Mika places the rooftop compass token against the sealed hatch; Ren and Yuna wait behind her as the green lights soften.",
    camera: "over-the-shoulder from behind Mika, hatch at far end dominates but stays grounded",
    actorPosition: "Mika foreground center-back; Ren left background; Yuna right background; hatch centered",
    continuity: "Payoff of rooftop compass clue; hatch should not reveal the final space yet.",
  },
  {
    id: "S15",
    sectionId: "ACT_C",
    sceneId: "scene_underground_platform",
    title: "A thin line of blue light opens",
    durationSeconds: 4,
    generationStatus: "parked",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "The hatch opens only a hand's width, sending a thin blue line across the warning stripe.",
    camera: "static medium-wide, no full reveal",
    actorPosition: "Three students hold still in silhouette, Mika closest to hatch",
    continuity: "A restrained suspense beat, not a spectacle reveal.",
  },
  {
    id: "S16",
    sectionId: "ACT_C",
    sceneId: "scene_underground_platform",
    title: "They choose to enter",
    durationSeconds: 5,
    generationStatus: "parked",
    characters: ["char_mika_arai", "char_ren_kasai", "char_yuna_mori"],
    action: "Mika looks back once at Ren and Yuna, then all three step toward the blue line together.",
    camera: "rear wide 35mm, silhouettes against hatch light",
    actorPosition: "Mika center, Ren left, Yuna right; rail track center leads toward hatch",
    continuity: "End of pressure-test sequence, still no video generation.",
  },
];

const characterById = Object.fromEntries(characters.map((character) => [character.id, character]));
const sceneById = Object.fromEntries(scenes.map((scene) => [scene.id, scene]));
const shotById = Object.fromEntries(shots.map((shot) => [shot.id, shot]));

const uiAction = {
  schemaVersion: "director_ui_action_recipe_v1",
  actionId: "ui_action_generate_anime_pressure_start_frames_S01_S03_S06_S08_S11_S14",
  projectId,
  runId,
  generatedAt,
  origin: "director_clean_mode_action_recipe",
  userIntent:
    "Run a larger anime-style real-chain pressure test: 16 shots across 3 complex scenes, with 6 Image2 start frames generated by imagegen subagents.",
  selection: {
    shotIds: Array.from(plannedShotIds),
    keyframe: "start",
  },
  constraints: {
    provider: "image2_only_via_imagegen_subagent",
    forbid: ["seedance", "jimeng", "fast_model", "vip_channel", "text_to_video", "video_generation"],
    plannedRealImageCount: plannedShotIds.size,
    totalShotCount: shots.length,
  },
};

const projectVibe = {
  schemaVersion: "project_vibe_real_demo_e2e_002_anime_pressure",
  projectId,
  runId,
  title: "Real Demo E2E 002 - Anime Pressure: Blue Hour Compass",
  createdAt: generatedAt,
  productBoundary:
    "Image2-first anime pressure test. This run prepares software-chain task packets for subagents and waits for real images; it does not call video providers.",
  sections: [
    { id: "ACT_A", label: "Rooftop Observatory", shotIds: ["S01", "S02", "S03", "S04", "S05"] },
    { id: "ACT_B", label: "Rainy Arcade", shotIds: ["S06", "S07", "S08", "S09", "S10"] },
    { id: "ACT_C", label: "Underground Platform", shotIds: ["S11", "S12", "S13", "S14", "S15", "S16"] },
  ],
  lockedFacts: {
    roles: characters.map((character) => character.id),
    scenes: scenes.map((scene) => scene.id),
    style: style.id,
  },
};

const visualMemory = {
  schemaVersion: "visual_memory_real_demo_e2e_002_anime_pressure",
  projectId,
  runId,
  authorityMode: "locked_text_reference_first",
  roles: characters,
  scenes,
  styles: [style],
  note:
    "This pressure round intentionally uses text authorities only. Image assets can replace these references later without changing packet shape.",
};

const storyFlow = {
  schemaVersion: "story_flow_real_demo_e2e_002_anime_pressure",
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

function charactersForShot(shot) {
  return shot.characters.map((id) => characterById[id]);
}

for (const shot of shots) {
  const scene = sceneById[shot.sceneId];
  const activeCharacters = charactersForShot(shot);
  writeJson(path.join(projectRoot, "shot_layouts", `${shot.id}.json`), {
    schemaVersion: "shot_layout_real_demo_e2e_002_anime_pressure",
    projectId,
    runId,
    shotId: shot.id,
    sceneId: shot.sceneId,
    generationStatus: shot.generationStatus,
    activeCharacters: activeCharacters.map((character) => character.id),
    layout: {
      camera: shot.camera,
      actorPosition: shot.actorPosition,
      sceneSpatialAnchors: scene.spatialAnchors,
      continuity: shot.continuity,
    },
    mustPreserve: [
      ...activeCharacters.flatMap((character) => character.mustPreserve),
      ...scene.spatialAnchors,
      style.positive,
      shot.actorPosition,
      shot.continuity,
    ],
    mustAvoid: [
      ...activeCharacters.flatMap((character) => character.mustAvoid),
      ...scene.mustAvoid,
      style.negative,
      "do not merge character identities",
      "do not create storyboard panels or manga page layout",
      "do not invent a fourth main character",
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
  schemaVersion: "source_index_real_demo_e2e_002_anime_pressure",
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
  const compact = (shot) => shot
    ? {
        shotId: shot.id,
        title: shot.title,
        sceneId: shot.sceneId,
        characters: shot.characters,
        action: shot.action,
        actorPosition: shot.actorPosition,
      }
    : null;
  return {
    previous: compact(shots[index - 1]),
    current: compact(shotById[shotId]),
    next: compact(shots[index + 1]),
  };
}

function buildImagePrompt(shot) {
  const scene = sceneById[shot.sceneId];
  const activeCharacters = charactersForShot(shot);
  return [
    `Create a 16:9 clean anime film start frame for ${shot.id}: ${shot.title}.`,
    `Action: ${shot.action}`,
    `Active character locks: ${activeCharacters.map((character) => `${character.displayName}: ${character.description}`).join(" | ")}`,
    `Scene lock: ${scene.displayName}: ${scene.description}`,
    `Spatial lock: ${scene.spatialAnchors.join("; ")}.`,
    `Camera and layout: ${shot.camera}. ${shot.actorPosition}.`,
    `Continuity: ${shot.continuity}`,
    `Anime style lock: ${style.positive}`,
    `Avoid: ${[...activeCharacters.flatMap((character) => character.mustAvoid), ...scene.mustAvoid, style.negative].join("; ")}.`,
    "No text overlays, no readable signage, no watermark, no manga panel layout, no video motion blur, no 3D render, no hyperrealistic texture.",
  ].join("\n");
}

function observationTemplate(plan) {
  return {
    schemaVersion: "provider_observation_real_demo_e2e_002_anime_pressure",
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
      "This sidecar must be written only by the imagegen subagent after it creates the anime image at outputPath.",
      "The image path plus this sidecar are evidence only; verify still requires watcher, manifest, QA, and preview gates.",
    ],
  };
}

function workerProvenanceTemplate(plan) {
  return {
    schemaVersion: "worker_provenance_real_demo_e2e_002_anime_pressure",
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

function semanticQaTemplate(plan, shot, scene, activeCharacters) {
  const emptyGate = (gateId, prompt) => ({
    gateId,
    prompt,
    status: "pending",
    severity: null,
    findings: [],
    evidence: "FILL_BY_SEMANTIC_QA_REVIEWER",
  });

  return {
    schemaVersion: "semantic_qa_real_demo_e2e_002_anime_pressure",
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
    providerObservationPath: plan.providerObservationPath,
    severityPolicy: {
      P0: "blocking: identity swap, wrong scene, wrong style family, wrong story beat, neighbor continuity break, or output integrity failure",
      P1: "needs_review: material drift that may be fixable without rerunning the whole chain",
      P2: "record_only: minor note that does not block or require review by itself",
    },
    requiredGates: ["identity", "scene", "style", "story", "neighbor", "output"],
    lockedExpectations: {
      activeCharacters: activeCharacters.map((character) => ({
        id: character.id,
        displayName: character.displayName,
        mustPreserve: character.mustPreserve,
        mustAvoid: character.mustAvoid,
      })),
      scene: {
        id: scene.id,
        displayName: scene.displayName,
        spatialAnchors: scene.spatialAnchors,
        mustAvoid: scene.mustAvoid,
      },
      style: {
        id: style.id,
        positive: style.positive,
        negative: style.negative,
      },
      storyAction: shot.action,
      neighborShots: neighborSummary(shot.id),
      expectedOutputPath: plan.expectedOutputPath,
    },
    gateResults: {
      identity: emptyGate("identity", "Do active roles match locked identity details without merging or extra main characters?"),
      scene: emptyGate("scene", "Does the image preserve the scene geography and spatial anchors?"),
      style: emptyGate("style", "Is this a clean anime film frame with low texture and no hyperreal/3D look?"),
      story: emptyGate("story", "Does the image depict the planned shot action and story function?"),
      neighbor: emptyGate("neighbor", "Can the image sit between previous/current/next shot continuity?"),
      output: emptyGate("output", "Is the reviewed image the expected non-fixture output at outputPath?"),
    },
    finalAssessment: {
      status: "pending",
      p0Findings: [],
      p1Findings: [],
      p2Findings: [],
      summary: "FILL_BY_SEMANTIC_QA_REVIEWER",
    },
  };
}

function buildPlan(shot) {
  const safeShot = toId(shot.id);
  const outputPath = repoPath(path.join(outputRoot, shot.id, "start.png"));
  const providerObservationPath = repoPath(path.join(providerObservationRoot, `${shot.id}_start_provider_observation.json`));
  const workerProvenancePath = repoPath(path.join(workerProvenanceRoot, `${shot.id}_start_worker_provenance.json`));
  const semanticQaPath = repoPath(path.join(semanticQaRoot, `${shot.id}_start_semantic_qa.json`));
  const taskPacketId = `task_packet_${safeShot}_anime_start_frame_real_demo_002`;
  const envelopeId = `subagent_envelope_${safeShot}_anime_start_frame_real_demo_002`;
  const taskRunId = `task_run_${safeShot}_anime_start_frame_real_demo_002`;
  const workerProvenanceId = `worker_provenance_${safeShot}_anime_start_frame_real_demo_002`;
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
    semanticQaPath,
    packetPath: repoPath(path.join(packetsRoot, `${shot.id}_anime_start_frame_packet.md`)),
    envelopePath: repoPath(path.join(envelopesRoot, `${shot.id}_anime_start_frame_envelope.json`)),
    promptRequestPath: repoPath(path.join(promptsRoot, `${shot.id}_anime_start_frame_prompt.md`)),
  };
}

const shotPlans = shots.map(buildPlan);
const realImagePlans = shotPlans.filter((plan) => plannedShotIds.has(plan.shotId));

for (const plan of realImagePlans) {
  const shot = shotById[plan.shotId];
  const scene = sceneById[shot.sceneId];
  const activeCharacters = charactersForShot(shot);
  const packetPath = path.join(repoRoot, plan.packetPath);
  const envelopePath = path.join(repoRoot, plan.envelopePath);
  const promptRequestPath = path.join(repoRoot, plan.promptRequestPath);
  const semanticQaPath = path.join(repoRoot, plan.semanticQaPath);
  ensureDir(path.dirname(path.join(repoRoot, plan.expectedOutputPath)));

  const envelope = {
    schemaVersion: "subagent_task_envelope_real_demo_e2e_002_anime_pressure",
    projectId,
    runId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    shotId: shot.id,
    taskPurpose: "generate_anime_start_frame",
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
      executionLayer: "agent_imagegen_subagent",
      forbidden: ["seedance", "jimeng", "fast_model", "vip_channel", "text_to_video", "video_generation"],
    },
    lockedReferences: {
      characters: activeCharacters,
      scene,
      style,
    },
    neighborShots: neighborSummary(shot.id),
    mustPreserve: [
      ...activeCharacters.flatMap((character) => character.mustPreserve),
      ...scene.spatialAnchors,
      shot.actorPosition,
      shot.continuity,
      style.positive,
    ],
    mustAvoid: [
      ...activeCharacters.flatMap((character) => character.mustAvoid),
      ...scene.mustAvoid,
      style.negative,
      "do not merge Mika, Ren, and Yuna into the same face or outfit",
      "do not change the active character count for the shot",
      "do not invent UI mockups, captions, manga panels, or storyboard borders",
      "do not call video providers",
    ],
    expectedOutputContract: {
      outputPath: plan.expectedOutputPath,
      providerObservationPath: plan.providerObservationPath,
      workerProvenancePath: plan.workerProvenancePath,
      semanticQaPath: plan.semanticQaPath,
      format: "png_or_jpeg_image",
      aspectRatio: "16:9",
      requiredFields: [
        "actual image at expected output path",
        "provider observation sidecar",
        "worker provenance sidecar independent from provider observation",
        "semantic QA sidecar",
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
      "identity_gate: active characters match locked identities and do not merge",
      "scene_gate: scene geometry matches the locked spatial anchors",
      "style_gate: clean anime film frame, low texture, no hyperreal or 3D look",
      "story_gate: shot action matches story function",
      "neighbor_gate: current shot can sit between previous and next shots",
      "output_gate: image exists at expected output path and is not a fixture copy",
    ],
  };

  writeJson(envelopePath, envelope);

  const prompt = buildImagePrompt(shot);
  const observation = observationTemplate(plan);
  const workerProvenance = workerProvenanceTemplate(plan);
  const semanticQa = semanticQaTemplate(plan, shot, scene, activeCharacters);
  writeJson(semanticQaPath, semanticQa);
  const packet = `# Real Demo E2E 002 Anime Pressure - ${shot.id} Start Frame Packet

You are the Image2/imagegen subagent for Vibe Core Real Demo E2E 002 Anime Pressure.

Do not use Seedance, Jimeng, Fast model, VIP channel, text-to-video, or any video generation. Do not reuse fixture images. Do not copy files manually from previous tests.

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
- Semantic QA sidecar: \`${plan.semanticQaPath}\`

## Locked Context
- Characters:
${activeCharacters.map((character) => `  - ${character.displayName}: ${character.description}`).join("\n")}
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

## Required Semantic QA Template
After the image exists, a reviewer or image-review subagent must update \`${plan.semanticQaPath}\` by setting \`semanticReviewMode\` to \`actual_image_semantic_review\`, replacing all FILL fields, and completing every gate: \`identity\`, \`scene\`, \`style\`, \`story\`, \`neighbor\`, and \`output\`.

Severity rules:
- P0 blocks the run.
- P1 marks the run \`needs_review\` and cannot be reported as a clean pass.
- P2 is recorded only.

The task is not complete unless the image, provider sidecar, and completed semantic QA sidecar exist. These sidecars are evidence only; Vibe Core verify will still require watcher events, manifest match, QA report, and preview plan.
`;

  writeText(packetPath, packet);
  writeText(promptRequestPath, `${prompt}\n`);
}

const runManifest = {
  schemaVersion: "real_demo_e2e_002_anime_pressure_run_manifest_v1",
  projectId,
  runId,
  generatedAt,
  status: "waiting_for_imagegen_subagents",
  declaration: "waiting_for_actual_provider_observed",
  runRoot: repoPath(runRoot),
  projectRoot: repoPath(projectRoot),
  outputRoot: repoPath(outputRoot),
  providerObservationRoot: repoPath(providerObservationRoot),
  semanticQaRoot: repoPath(semanticQaRoot),
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
    roles: characters.map((character) => character.id),
    style: style.id,
    pressureConstraints: {
      minTotalShots: 12,
      maxTotalShots: 20,
      minRealImagePlans: 4,
      maxRealImagePlans: 6,
      pressureRangeLabel: "12-20_shots",
      realImagePlanRangeLabel: "4-6",
    },
  },
  shotPlans,
  nextImagegenSubagentPacket: realImagePlans[0]?.packetPath || null,
  imagegenSubagentPackets: realImagePlans.map((plan) => plan.packetPath),
  verifyCommand: "npm run real-demo-e2e-002:verify",
  notes: [
    "Prepare does not call Image2 and does not create or fake images.",
    "Verify must remain blocked until imagegen subagents write every planned image and provider observation sidecar.",
    "No Seedance, Jimeng, Fast model, VIP channel, text-to-video, or video provider is allowed in this pressure round.",
  ],
};

writeJson(path.join(runRoot, "run_manifest.json"), runManifest);

console.log("Real Demo E2E 002 Anime Pressure prepared.");
console.log(`Run root: ${repoPath(runRoot)}`);
console.log(`Run manifest: ${repoPath(path.join(runRoot, "run_manifest.json"))}`);
console.log("Imagegen subagent packets:");
for (const packet of runManifest.imagegenSubagentPackets) console.log(`- ${packet}`);
