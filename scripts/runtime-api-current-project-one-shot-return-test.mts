import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiCurrentProjectOneShotReturn } from "./runtime-api-current-project-one-shot-return.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-one-shot-return.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

for (const movedFunction of [
  "function currentProjectOneShotReturnProjection",
  "function currentProjectImage2OneShotReturnIngestResponse",
]) {
  assert(!serverSource.includes(movedFunction), `local runtime server should import moved one-shot return code: ${movedFunction}`);
}

for (const forbidden of [
  "currentProjectImage2OneShotExecutorResponse",
  "strict-edit",
  "provider submit",
  "provider-submit",
  "live provider submit",
  "liveSubmitAllowed: true",
]) {
  assert(!moduleSource.includes(forbidden), `one-shot return module must not contain ${forbidden}`);
}

const runtimeFiles = new Map([
  ["runs/current/runtime_truth_layer.json", {
    schemaVersion: "runtime_truth_layer_v1",
    generatedAt: "before",
    status: "old",
    items: [
      { shotId: "S01", status: "old", expectedOutputPath: "old.png" },
      { shotId: "S02", status: "kept", expectedOutputPath: "runs/current/outputs/S02.png" },
    ],
  }],
  ["runs/current/preview_plan.json", {
    schemaVersion: "preview_plan_v1",
    generatedAt: "before",
    previewStatus: "old",
    productionStatus: "old",
    reviewOverlayShots: ["S02"],
    productionNeedsReviewShots: ["S02"],
    clips: [
      { shotId: "S01", status: "old", mediaPath: "old.png" },
      { shotId: "S02", status: "kept", mediaPath: "runs/current/outputs/S02.png" },
    ],
  }],
  ["runs/current/report.json", {
    schemaVersion: "old_report",
    generatedAt: "before",
    projectId: "fixture_project",
    runId: "fixture_run",
    observations: [
      { shotId: "S01", qaStatus: "old" },
      { shotId: "S02", qaStatus: "kept" },
    ],
  }],
]);

const api = createRuntimeApiCurrentProjectOneShotReturn({
  currentProjectSource: () => undefined,
  currentProjectImage2OneShotResponse: () => undefined,
  oneShotStateJson: () => undefined,
  oneShotExecutorContract: () => undefined,
  readReturnedJson: () => undefined,
  readRuntimeJson: (relativePath) => runtimeFiles.get(relativePath),
  runtimeRelativeFromValue: (value) => value,
  runtimePathExists: () => false,
  oneShotPathInsideRoot: () => false,
  scopedRepoPath: (relativePath) => relativePath,
  readFileSync: () => Buffer.from(""),
  sha256Bytes: () => "sha256:fake",
  sha256File: () => "sha256:fake",
  writeOneShotExecutorBytes: () => undefined,
  writeOneShotExecutorJson: () => undefined,
  writeCurrentProjectRuntimeJson: () => undefined,
  providerObservationContextBlockers: () => [],
  actualProviderObservationMatches: () => false,
  actualSemanticQaMatches: () => false,
  runtimePolicy: () => ({}),
  runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
  currentProjectImage2OneShotExecuteReturnEndpoint: "/api/runtime/projects/current/image2-one-shot/execute-return",
});

const source = {
  runtimeTruthLayerRelativePath: "runs/current/runtime_truth_layer.json",
  previewPlanRelativePath: "runs/current/preview_plan.json",
  reportRelativePath: "runs/current/report.json",
};

const projection = api.currentProjectOneShotReturnProjection(source, {
  generatedAt: "2026-05-10T00:00:00.000Z",
  project: { projectId: "fixture_project", runId: "fixture_run" },
  receipt: { selectedShotId: "S01" },
  handoff: { selectedShotId: "S01" },
  expectedOutputPath: "runs/current/outputs/S01.png",
  providerObservationPath: "runs/current/provider/S01.json",
  semanticQaPath: "runs/current/qa/S01.json",
  manifestPath: "runs/current/manifest.json",
  qaReportPath: "runs/current/qa/report.json",
  outputSha256: "sha256:return",
  imageInfo: { bytes: 9, sha256: "sha256:return" },
  sourceImagePath: "runs/current/provider-output/S01.png",
  providerName: "openai-image2-api",
});

const s01Truth = projection.runtimeTruth.items.find((item) => item.shotId === "S01");
const s02Truth = projection.runtimeTruth.items.find((item) => item.shotId === "S02");
assert(s01Truth.status === "needs_review", "runtime truth should upsert returned shot as needs_review");
assert(s01Truth.outputSha256 === "sha256:return", "runtime truth should bind returned shot hash");
assert(s02Truth.status === "kept", "runtime truth should preserve unrelated shots");
assert(projection.runtimeTruth.items.length === 2, "runtime truth should upsert by shotId instead of appending duplicate shots");

const s01Clip = projection.previewPlan.clips.find((item) => item.shotId === "S01");
assert(s01Clip.status === "returned_with_review_overlay", "preview plan should upsert returned shot clip");
assert(projection.previewPlan.productionStatus === "needs_review", "preview plan production status must remain needs_review");
assert(projection.previewPlan.reviewOverlayShots.includes("S01"), "preview plan should mark returned shot for review overlay");
assert(projection.previewPlan.productionNeedsReviewShots.includes("S01"), "preview plan should mark returned shot as production needs review");

const s01Observation = projection.report.observations.find((item) => item.shotId === "S01");
assert(projection.report.status === "real_image2_one_shot_returned_needs_review", "report should stay in returned needs_review state");
assert(projection.report.productionStatus === "needs_review", "report should not promote production automatically");
assert(s01Observation.qaStatus === "needs_review", "report observation should upsert needs_review");
assert(projection.report.latestOneShotReturn.status === "needs_review", "latest return should be needs_review");
assert(projection.report.formalPromotionAllowed !== true, "projection must not directly allow formal promotion");

console.log("runtime-api-current-project-one-shot-return-test: ok");
