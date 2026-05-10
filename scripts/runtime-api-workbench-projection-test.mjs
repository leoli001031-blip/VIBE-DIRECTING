import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mjs";
import { createRuntimeApiWorkbenchProjection } from "./runtime-api-workbench-projection.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-workbench-projection.mjs"), "utf8");
for (const forbidden of [
  "writeFileSync",
  "renameSync",
  "spawn(",
  "strict-edit/return",
  "currentProjectImage2OneShotReturnIngestResponse",
]) {
  assert(!moduleSource.includes(forbidden), `workbench projection module must not contain ${forbidden}`);
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-workbench-projection-"));
const repoRoot = path.join(workingRoot, "repo");
const runRootRelativePath = "projects/current";
const runRootPath = path.join(repoRoot, runRootRelativePath);
const projectDir = path.join(runRootPath, "project");
const runtimeStateStoryFlowPath = path.join(runRootPath, "runtime-state/story_flow.json");
const canonicalStoryFlowPath = path.join(projectDir, "story_flow.canonical.json");
const source = {
  runRootPath,
  runRootRelativePath,
  projectVibePath: path.join(projectDir, "project.vibe"),
  projectVibeRelativePath: `${runRootRelativePath}/project/project.vibe`,
  sourceIndexPath: path.join(projectDir, "source_index.json"),
  storyFlowPath: path.join(projectDir, "story_flow.json"),
  visualMemoryPath: path.join(projectDir, "visual_memory.json"),
  runManifestPath: path.join(runRootPath, "runtime/run_manifest.json"),
  runtimeTruthLayerPath: path.join(runRootPath, "runtime/runtime_truth_layer.json"),
  previewPlanPath: path.join(runRootPath, "runtime/preview_plan.json"),
  reportPath: path.join(runRootPath, "reports/image2_start_long_chain_report.json"),
  sourceIndexRelativePath: `${runRootRelativePath}/project/source_index.json`,
  runtimeTruthLayerRelativePath: `${runRootRelativePath}/runtime/runtime_truth_layer.json`,
  previewPlanRelativePath: `${runRootRelativePath}/runtime/preview_plan.json`,
  reportRelativePath: `${runRootRelativePath}/reports/image2_start_long_chain_report.json`,
};

try {
  mkdirSync(runRootPath, { recursive: true });
  writeJson(source.projectVibePath, {
    schemaVersion: "project_vibe_test_v1",
    projectId: "projection_fixture",
    runId: "projection_fixture_run",
    displayName: "Projection Fixture",
    factFiles: [
      { role: "story_flow", path: "story_flow.canonical.json", sourceOfTruth: "project_file" },
    ],
    runtimeState: {
      storyFlowPath: "runtime-state/story_flow.json",
      sourceOfTruth: "runtime_state",
    },
  });
  writeJson(canonicalStoryFlowPath, {
    sections: [
      {
        id: "act_1",
        title: "Act 1",
        shots: [
          { id: "S01", title: "Opening", sceneId: "scene_a", roleIds: ["hero"], startFramePath: "outputs/shots/S01/start.png" },
          { id: "S02", title: "Followup", sceneId: "scene_a", roleIds: ["hero"], issues: ["missing start"] },
        ],
      },
    ],
  });
  writeJson(source.storyFlowPath, { shots: [{ id: "FALLBACK" }] });
  writeJson(runtimeStateStoryFlowPath, { shots: [{ id: "RUNTIME_STATE" }] });
  writeJson(source.sourceIndexPath, {
    sourceIndexHash: "source-index-hash",
    refs: ["project/story_flow.canonical.json", "project/visual_memory.json"],
  });
  writeJson(source.visualMemoryPath, {
    roles: [
      { id: "hero", displayName: "Hero", status: "locked", mainReferencePath: "assets/hero.png", mustPreserve: ["red scarf"] },
    ],
    scenes: [
      { id: "scene_a", displayName: "Station", status: "candidate", mainReferencePath: "tmp/scene_candidate.png" },
    ],
    style: { id: "style_a", displayName: "Soft noir", status: "needs_review" },
  });
  writeJson(source.runManifestPath, {
    status: "planned",
    shotPlans: [
      { shotId: "S01", expectedOutputPath: `${runRootRelativePath}/outputs/shots/S01/start.png` },
      { shotId: "S02", expectedOutputPath: `${runRootRelativePath}/outputs/shots/S02/start.png` },
    ],
  });
  writeJson(source.previewPlanPath, {
    previewStatus: "preview_ready",
    productionStatus: "needs_review",
    reviewOverlayShots: ["S01"],
    clips: [
      { shotId: "S01", order: 1, mediaPath: `${runRootRelativePath}/outputs/shots/S01/start.png`, status: "returned_with_review_overlay" },
      { shotId: "S02", order: 2, mediaPath: `${runRootRelativePath}/outputs/shots/S02/start.png`, status: "missing" },
    ],
  });
  writeJson(path.join(runRootPath, "provider_observations/S01_start_provider_observation.json"), {
    providerObservationMode: "actual_provider_call_observed",
    provider: "image2",
    outputPath: `${runRootRelativePath}/outputs/shots/S01/start.png`,
    outputSha256: "sha-s01",
  });
  writeJson(path.join(runRootPath, "semantic_qa/S01_start_semantic_qa.json"), {
    semanticReviewMode: "actual_image_semantic_review",
    finalAssessment: { status: "pass" },
  });
  mkdirSync(path.join(runRootPath, "outputs/shots/S01"), { recursive: true });
  writeFileSync(path.join(runRootPath, "outputs/shots/S01/start.png"), "png-bytes");

  const boundary = createRuntimeApiBoundary({
    repoRoot,
    repoRootRealPath: realpathSync(repoRoot),
  });
  const projectionApi = createRuntimeApiWorkbenchProjection({
    repoRoot,
    round5FullRealChainReportFileName: "round5_full_real_chain_report.json",
    existsSync,
    realpathSync,
    pathWithinRoot: boundary.pathWithinRoot,
    isPathInsideRealRoot,
    repoRelativePath: boundary.repoRelativePath,
    normalizeRelativePath: boundary.normalizeRelativePath,
    runtimeRelativeFromValue: boundary.runtimeRelativeFromValue,
    runtimePathExists: (relativePath) => existsSync(boundary.scopedRepoPath(relativePath)),
    runtimeFileUrl: (relativePath, scope) => `/api/runtime/files${scope ? `?scope=${scope}&` : "?"}path=${encodeURIComponent(relativePath)}`,
    scopedRepoPath: boundary.scopedRepoPath,
    readJsonIfPresent,
    projectIdentityFromSource: (projectSource) => ({
      projectId: "projection_fixture",
      projectRoot: projectSource.runRootRelativePath,
      displayName: "Projection Fixture",
    }),
  });

  const projectFacts = projectionApi.readProjectFacts(source);
  assert(projectFacts.storyFlowSource.factSourceRole === "project_vibe_declared_story_flow", "storyFlow source metadata should come from project.vibe factFiles");
  assert(projectFacts.storyFlowSource.declaredRefPath === "story_flow.canonical.json", "storyFlow declared ref path should be normalized");
  assert(projectFacts.storyFlowSource.runtimeStateUsed === false, "runtime-state must not be used as storyFlow source");
  assert(!projectFacts.storyFlowSource.path.includes("runtime-state"), "runtime-state path must not become storyFlow source");

  const projection = projectionApi.projectProjectionFromSource(source);
  assert(projection.ok === true, "projection should be available from preview plan");
  assert(projection.previewStatus === "preview_ready", "projection should prefer preview plan status");
  assert(projection.observations.length === 2, "projection should expose two preview observations");
  assert(projection.observations[0].shotId === "S01", "projection should preserve preview order");
  assert(projection.observations[0].imageUrl.includes(encodeURIComponent(`${runRootRelativePath}/outputs/shots/S01/start.png`)), "projection observation should include runtime file URL");
  assert(projection.observations[0].providerObservationActual === true, "projection should recognize actual image2 provider observation");
  assert(projection.observations[1].previewStatus === "missing", "projection should retain missing preview status");

  const workbenchFacts = projectionApi.currentProjectWorkbenchFacts(source, projectFacts);
  assert(workbenchFacts.storyFlow.shotCount === 2, "workbench storyFlow should normalize canonical shots");
  assert(workbenchFacts.storyFlow.sectionCount === 1, "workbench storyFlow should normalize sections");
  assert(workbenchFacts.visualMemory.assetCount === 3, "workbench visualMemory should normalize assets");
  assert(workbenchFacts.visualMemory.summary.locked === 1, "workbench visualMemory should count locked assets");
  assert(workbenchFacts.visualMemory.summary.candidate === 1, "workbench visualMemory should count candidate assets");
  assert(workbenchFacts.visualMemory.summary.needsReview === 1, "workbench visualMemory should count needs_review assets");
  assert(workbenchFacts.providerCalled === false && workbenchFacts.projectVibeWritten === false, "workbench facts must stay read-only");
} finally {
  rmSync(workingRoot, { recursive: true, force: true });
}

console.log("runtime-api-workbench-projection-test: ok");
