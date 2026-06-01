import fs from "node:fs";
import { buildMinimalRuntimeProjection, minimalRuntimeProjectionSchemaVersion } from "../src/core/minimalRuntimeProjection.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function transactionRuntime(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-05-05T00:00:00.000Z",
    userStatus: "queued",
    pendingTransaction: {
      artifactInvalidation: {
        staleArtifacts: [{ artifactId: "s01_start" }, { artifactId: "s02_video" }],
      },
    },
    queueIngestSummary: {
      total: 4,
      queued: 2,
      parked: 1,
      blocked: 1,
      missingKnowledgeTrace: 0,
      ledgerEventCount: 4,
    },
    nextUiProjection: {
      status: "queued",
      shortLabel: "Queued",
      queuedCount: 2,
      parkedCount: 1,
      blockedCount: 1,
      staleArtifactCount: 2,
    },
    ...overrides,
  };
}

function previewItem(id, kind) {
  return {
    id,
    kind,
    startSeconds: 0,
    durationSeconds: 3,
    label: id,
    mediaPath: kind === "missing_placeholder" ? undefined : `media/${id}`,
  };
}

function asset(id, status) {
  return {
    id,
    assetType: "character",
    name: id,
    status,
    textConstraints: [],
    blockers: [],
    warnings: [],
    canUseAsFutureReference: status === "locked",
    referenceAuthority: { lockedStatus: status === "review" ? "needs_review" : status },
  };
}

const projection = buildMinimalRuntimeProjection({
  transactionRuntime: transactionRuntime(),
  previewQueue: [
    previewItem("s01", "image_hold"),
    previewItem("s02", "image_hold"),
    previewItem("s03", "video_clip"),
    previewItem("s04", "missing_placeholder"),
  ],
  assetLibrary: {
    assets: [
      asset("hero", "locked"),
      asset("garage", "candidate"),
      asset("style", "review"),
      asset("bad_ref", "rejected"),
    ],
  },
  ledgerProjections: [
    { currentStatus: "qa_pending", previewSummary: { status: "qa_pending" } },
    { currentStatus: "needs_review", previewSummary: { status: "needs_review" } },
  ],
});

assert(projection.schemaVersion === minimalRuntimeProjectionSchemaVersion, "projection schema version drifted");
assert(projection.shortLabel === "已加入计划", "queued transaction should become a creator-facing short label");
assert(projection.counts.queued === 2, "queued count must come from transaction runtime");
assert(projection.counts.parked === 1, "parked count must come from transaction runtime");
assert(projection.counts.blocked === 1, "blocked count must come from transaction runtime");
assert(projection.counts.stale === 2, "stale count must come from artifact invalidation");
assert(projection.countSummary === "2 已加入计划 · 1 等待复核 · 1 需要处理 · 2 需更新", "count summary should stay short and user-facing");
assert(projection.previewSummary.shortLabel === "预览 4 段", "preview summary must count visible preview items");
assert(projection.previewSummary.imageHoldCount === 2, "image holds must be counted");
assert(projection.previewSummary.videoClipCount === 1, "video clips must be counted");
assert(projection.previewSummary.missingPlaceholderCount === 1, "missing placeholders must be counted");
assert(/3 段已返回/.test(projection.previewSummary.detail), "returned media summary should be human-readable");
assert(/1 段等复核/.test(projection.previewSummary.detail), "QA pending should surface as review copy");
assert(/1 段需复核/.test(projection.previewSummary.detail), "needs-review should surface as review copy");
assert(projection.assetSummary.detail === "1 locked · 1 candidate · 1 review · 1 rejected", "asset summary must retain the four review states");
assert(projection.progressDots.length === 4, "projection must expose four compact progress dots");
assert(projection.progressDots.some((dot) => dot.id === "review" && dot.tone === "blocked"), "review dot should show blocked tone when blocked work is present");

const waitingProjection = buildMinimalRuntimeProjection({
  transactionRuntime: transactionRuntime({
    userStatus: "waiting_confirmation",
    queueIngestSummary: { total: 0, queued: 0, parked: 0, blocked: 0, missingKnowledgeTrace: 0, ledgerEventCount: 0 },
    nextUiProjection: {
      status: "waiting_confirmation",
      shortLabel: "Waiting for confirmation",
      queuedCount: 0,
      parkedCount: 0,
      blockedCount: 0,
      staleArtifactCount: 0,
    },
  }),
});
assert(waitingProjection.shortLabel === "等待确认", "waiting transaction should become waiting confirmation copy");
assert(waitingProjection.countSummary === "等待确认", "empty counts should stay compact");

const reviewProjection = buildMinimalRuntimeProjection({
  transactionRuntime: transactionRuntime({
    queueIngestSummary: { total: 2, queued: 1, parked: 1, blocked: 0, missingKnowledgeTrace: 0, ledgerEventCount: 2 },
    nextUiProjection: {
      status: "queued",
      shortLabel: "Queued",
      queuedCount: 1,
      parkedCount: 1,
      blockedCount: 0,
      staleArtifactCount: 1,
    },
  }),
});
assert(reviewProjection.progressDots.some((dot) => dot.id === "review" && dot.tone === "review"), "review dot should activate for parked/stale/review work");

const image2LedgerProjection = buildMinimalRuntimeProjection({
  ledgerProjections: [
    { currentStatus: "queued", previewStatus: "missing", completeVerified: false },
    { currentStatus: "queued", previewStatus: "qa_pending", completeVerified: false },
    { currentStatus: "parked", previewStatus: "needs_review", completeVerified: false },
  ],
});
assert(image2LedgerProjection.counts.queued === 2, "minimal projection should count queued Image2 ledger rows");
assert(image2LedgerProjection.counts.parked === 1, "minimal projection should count parked Image2 ledger rows");
assert(image2LedgerProjection.previewSummary.qaPendingCount === 1, "minimal projection should read compact ledger qa_pending status");
assert(image2LedgerProjection.previewSummary.needsReviewCount === 1, "minimal projection should read compact ledger needs_review status");
assert(image2LedgerProjection.progressDots.some((dot) => dot.id === "review" && dot.tone === "review"), "compact ledger review should affect top projection");

const previewOnlyProjection = buildMinimalRuntimeProjection({
  previewQueue: [previewItem("s01", "image_hold"), previewItem("s02", "missing_placeholder")],
});
assert(previewOnlyProjection.shortLabel === "预览 2 段", "preview-only projection should fall back to preview summary");

const serialized = JSON.stringify(projection);
for (const term of ["provider", "queue technical", "manifest", "schema.json", "TaskEnvelope", "pack hash"]) {
  assert(!serialized.includes(term), `projection must not expose ${term}`);
}

console.log("Minimal runtime projection tests passed.");
