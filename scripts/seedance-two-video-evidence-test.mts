import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { buildCurrentProjectPreviewProjection } from "../src/core/currentProjectPreviewProjection.ts";

type JsonRecord = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath: string): JsonRecord {
  assert(existsSync(filePath), `missing file: ${filePath}`);
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  assert(isRecord(parsed), `expected object JSON: ${filePath}`);
  return parsed;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resolveExisting(projectRoot: string, repoRoot: string, value: unknown): string {
  const raw = stringValue(value);
  assert(raw.length > 0, "expected a non-empty path");
  const candidates = path.isAbsolute(raw)
    ? [raw]
    : [path.resolve(projectRoot, raw), path.resolve(repoRoot, raw)];
  const existing = candidates.find((candidate) => existsSync(candidate));
  assert(existing, `path does not exist: ${raw}`);
  return existing;
}

function nonEmptyFile(filePath: string): void {
  const stat = statSync(filePath);
  assert(stat.isFile(), `not a file: ${filePath}`);
  assert(stat.size > 0, `empty file: ${filePath}`);
}

const repoRoot = process.cwd();
const projectRootArg = process.argv.find((arg) => arg.startsWith("--project-root="));
const projectRoot = path.resolve(
  repoRoot,
  projectRootArg?.slice("--project-root=".length)
    || "tmp/two-video-real-v6-20260602-175853",
);
const reportsRoot = path.join(projectRoot, "reports");
const relayQueuePath = path.join(reportsRoot, "video_relay_queue.json");
const previewPlanPath = path.join(reportsRoot, "preview_plan.json");

const relayQueue = readJson(relayQueuePath);
const previewPlan = readJson(previewPlanPath);

assert(relayQueue.schemaVersion === "0.1.0", "relay queue schema version drifted");
assert(relayQueue.status === "complete", "real two-video relay queue should be complete");
assert(relayQueue.maxConcurrentVideoJobs === 1, "Seedance relay must stay serial");

const counts = relayQueue.counts;
assert(isRecord(counts), "relay queue counts missing");
assert(numberValue(counts.total) === 2, "expected two video tasks");
assert(numberValue(counts.completed) === 2, "expected both videos returned");
assert(numberValue(counts.active) === 0, "no video should remain active");
assert(numberValue(counts.ready) === 0, "no video should remain ready");
assert(numberValue(counts.failed) === 0, "no video should have failed");
assert(numberValue(counts.blocked) === 0, "no video should be blocked");
assert(relayQueue.autoSubmitAllowed === false, "completed queue should not keep auto-submit enabled");

const relayItems = arrayValue(relayQueue.items);
assert(relayItems.length === 2, "relay queue should preserve two items");
const submitIds = new Set<string>();
for (const [index, itemValue] of relayItems.entries()) {
  assert(isRecord(itemValue), `relay item ${index + 1} is not an object`);
  assert(stringValue(itemValue.shotId).length > 0, `relay item ${index + 1} lost shot id`);
  assert(stringValue(itemValue.submitId).length > 0, `relay item ${index + 1} lost submit id`);
  assert(stringValue(itemValue.promptPath).length > 0, `relay item ${index + 1} lost prompt path`);
  assert(arrayValue(itemValue.referencePaths).length > 0, `relay item ${index + 1} lost reference list`);
  assert(stringValue(itemValue.outputVideoPath).endsWith(".mp4"), `relay item ${index + 1} lost output mp4 path`);
  assert(stringValue(itemValue.outputVideoSha256).startsWith("sha256:"), `relay item ${index + 1} lost output sha256`);
  assert(arrayValue(itemValue.blockers).length === 0, `relay item ${index + 1} should have no blockers`);
  submitIds.add(stringValue(itemValue.submitId));

  nonEmptyFile(resolveExisting(projectRoot, repoRoot, itemValue.promptPath));
  for (const referencePath of arrayValue(itemValue.referencePaths)) {
    nonEmptyFile(resolveExisting(projectRoot, repoRoot, referencePath));
  }
  nonEmptyFile(resolveExisting(projectRoot, repoRoot, itemValue.outputVideoPath));
}
assert(submitIds.size === 2, "two returned videos should have distinct submit ids");

const projection = buildCurrentProjectPreviewProjection({
  summary: previewPlan,
  previewItems: arrayValue(previewPlan.previewItems) as never,
  previewPlan: previewPlan as never,
  relayQueue: relayQueue as never,
  projectRoot,
});

assert(projection.available === true, "preview projection should be available");
assert(projection.items.length === 2, "preview projection should expose two items");
assert(projection.returnedCount === 2, "preview projection should mark both videos returned");
assert(projection.reviewCount === 2, "returned videos should still require review");
assert(projection.blockedCount === 0, "preview projection should have no blockers");
assert(projection.missingCount === 0, "preview projection should have no missing items");
assert(projection.totalDurationSeconds === 8, "two 4s returned videos should total 8s");

for (const [index, item] of projection.items.entries()) {
  assert(item.kind === "video_clip", `preview item ${index + 1} should be a video clip`);
  assert(item.returned === true, `preview item ${index + 1} should be returned`);
  assert(item.reviewRequired === true, `preview item ${index + 1} should require review`);
  assert(item.videoGeneration.hasSubmitId === true, `preview item ${index + 1} should preserve submit-id status`);
  assert(item.videoGeneration.shortSubmitId, `preview item ${index + 1} should expose a short submit id`);
  assert(item.videoGeneration.hasVideo === true, `preview item ${index + 1} should expose returned video status`);
  assert(item.promptPath, `preview item ${index + 1} should preserve prompt path from relay queue`);
  assert(item.referencePaths?.length, `preview item ${index + 1} should preserve reference list from relay queue`);
  nonEmptyFile(resolveExisting(projectRoot, repoRoot, item.mediaPath));
}

console.log(JSON.stringify({
  ok: true,
  projectRoot,
  submitIds: [...submitIds],
  returnedCount: projection.returnedCount,
  reviewCount: projection.reviewCount,
  totalDurationSeconds: projection.totalDurationSeconds,
}, null, 2));
