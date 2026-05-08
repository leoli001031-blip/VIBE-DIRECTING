import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assert,
  loadCore,
} from "./demo-runtime-fixture.mjs";

function currentLoadCoreDirs() {
  return fs
    .readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vibe-small-project-"))
    .map((entry) => path.join(os.tmpdir(), entry.name));
}

async function loadCurrentProjectPreviewProjectionCore() {
  const before = new Set(currentLoadCoreDirs());
  await loadCore();
  const created = currentLoadCoreDirs()
    .filter((dir) => !before.has(dir))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  const coreDir = created[0] || currentLoadCoreDirs().sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
  assert(coreDir, "loadCore did not create a transpiled core directory");
  return import(pathToFileURL(path.join(coreDir, "currentProjectPreviewProjection.mjs")).href);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(relativePath, "utf8"));
}

function runtimeFileUrl(relativePath) {
  return `/api/runtime/files?path=${encodeURIComponent(relativePath)}`;
}

function byShotId(items) {
  return new Map(items.map((item) => [item.shotId, item]));
}

function fixture(root, projectId) {
  const runtimeTruth = readJson(`${root}/reports/runtime_truth_layer.json`);
  const previewPlan = readJson(`${root}/reports/preview_plan.json`);
  const truthByShot = byShotId(runtimeTruth.items || []);
  const previewItems = (previewPlan.clips || []).map((clip) => {
    const truth = truthByShot.get(clip.shotId) || {};
    const outputExists = fs.existsSync(clip.mediaPath);
    return {
      id: `current_project_${clip.shotId}`,
      shotId: clip.shotId,
      order: clip.order,
      imageUrl: outputExists ? runtimeFileUrl(clip.mediaPath) : undefined,
      mediaPath: clip.mediaPath,
      outputExists,
      status: clip.status,
      runtimeTruthStatus: truth.status,
      previewQaStatus: clip.previewQaStatus,
      productionQaStatus: clip.productionQaStatus,
      reviewRequired: clip.status === "returned_with_review_overlay",
      reviewOverlay: clip.status === "returned_with_review_overlay",
      blockers: truth.blockers || [],
    };
  });
  return {
    root,
    projectId,
    runtimeTruth,
    previewPlan,
    summary: {
      status: runtimeTruth.status,
      projectId,
      projectRoot: root,
      generatedAt: previewPlan.generatedAt,
      previewStatus: previewPlan.previewStatus || previewPlan.status,
      productionStatus: previewPlan.productionStatus,
      reviewShotIds: previewPlan.reviewOverlayShots || [],
      previewItems,
    },
    previewItems,
  };
}

const {
  buildCurrentProjectPreviewProjection,
  currentProjectPreviewProjectionSource,
} = await loadCurrentProjectPreviewProjectionCore();

const sourceText = fs.readFileSync("src/core/currentProjectPreviewProjection.ts", "utf8");
assert(!sourceText.includes("previewExport"), "current project preview projection must not depend on runtimeState.previewExport");
assert(!sourceText.includes("image2_start_long_chain_report"), "current project preview projection must not depend on legacy image2 report fallback");

const project004Root = "real-test-sandbox/real-demo-e2e/004-image2-start-frames";
const project005Root = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames";
const project004 = fixture(project004Root, "real_demo_e2e_004_image2_start_frames");
const project005 = fixture(project005Root, "real_demo_e2e_005_anime_image2_start_frames");

const projection005 = buildCurrentProjectPreviewProjection({
  summary: project005.summary,
  previewItems: project005.previewItems,
  previewPlan: project005.previewPlan,
});
assert(projection005.available === true, "005 projection should be available");
assert(projection005.source === currentProjectPreviewProjectionSource, "projection source must identify current project runtime truth");
assert(projection005.providerCalled === false, "projection must hard-lock provider calls");
assert(projection005.liveSubmitAllowed === false, "projection must hard-lock live submit");
assert(projection005.workerSpawnForbidden === true, "projection must hard-lock worker spawn");
assert(projection005.projectId === project005.projectId, "005 project id should be preserved");
assert(projection005.projectRoot === project005.root, "005 project root should be preserved");
assert(projection005.items.map((item) => item.shotId).join(",") === "S01,S02,S03,S04,S05,S06,S07,S08", "005 order must be S01-S08");
assert(projection005.items.every((item) => item.durationSeconds === 5), "005 durations should come from preview_plan clips");
assert(projection005.totalDurationSeconds === 40, "005 queue duration should sum clip durations");
assert(projection005.items.find((item) => item.shotId === "S07")?.reviewRequired === true, "005 S07 review state must be preserved");
assert(projection005.items.find((item) => item.shotId === "S08")?.reviewRequired === true, "005 S08 review state must be preserved");
assert(projection005.reviewCount === 2, "005 review count should preserve S07/S08 only");
assert(projection005.blockedCount === 0, "005 should not inherit 004 blockers");
assert(projection005.returnedCount === 8, "005 should count all returned runtime file URLs");
assert(projection005.items.every((item) => item.kind === "image_hold" && item.mediaPath?.startsWith("/api/runtime/files?path=")), "005 queue items should consume current runtime file URLs");

const defaultDurationProjection = buildCurrentProjectPreviewProjection({
  summary: project005.summary,
  previewItems: project005.previewItems,
  previewPlan: { ...project005.previewPlan, clips: project005.previewPlan.clips.map(({ durationSeconds, ...clip }) => clip) },
});
assert(defaultDurationProjection.items.every((item) => item.durationSeconds === 5), "missing clip duration should default to 5s");

const projection004 = buildCurrentProjectPreviewProjection({
  summary: project004.summary,
  previewItems: project004.previewItems,
  previewPlan: project004.previewPlan,
});
assert(projection004.available === true, "004 projection should be available");
assert(projection004.projectId === project004.projectId, "004 project id should be preserved");
assert(projection004.projectRoot === project004.root, "004 project root should be preserved");
assert(projection004.items.map((item) => item.shotId).join(",") === "S01,S02,S03,S04,S05,S06,S07,S08", "004 order must stay local to 004");
assert(projection004.blockedCount === 8, "004 blocked state should stay local to 004");
assert(projection004.reviewCount === 0, "004 must not inherit 005 S07/S08 review state");
assert(projection004.returnedCount === 4, "004 returned state should reflect only existing 004 outputs");
assert(projection004.missingCount === 4, "004 missing state should reflect missing 004 outputs");
assert(projection004.items.every((item) => item.kind === "missing_placeholder"), "004 blocked items should become placeholders for Preview Player");
assert(!JSON.stringify(projection004).includes(project005.projectId), "004 projection must not leak 005 project id");
assert(!JSON.stringify(projection004).includes(project005Root), "004 projection must not leak 005 project root");
assert(projection004.items.find((item) => item.shotId === "S07")?.reviewRequired === false, "004 S07 must not inherit 005 review");
assert(projection004.items.find((item) => item.shotId === "S08")?.reviewRequired === false, "004 S08 must not inherit 005 review");

const unbound = buildCurrentProjectPreviewProjection({
  summary: { status: "unbound", projectId: "should_not_queue", previewItems: [] },
  previewItems: [],
  previewPlan: { clips: [] },
});
assert(unbound.available === false, "unbound summary should be unavailable");
assert(unbound.queue.length === 0, "unbound summary should output an empty queue");
assert(unbound.totalDurationSeconds === 0, "unbound summary should not create duration");

console.log("Current project preview projection tests passed. Runtime truth + preview plan now produce a Preview Player queue without provider calls.");
