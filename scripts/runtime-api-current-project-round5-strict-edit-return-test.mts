import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiCurrentProjectRound5StrictEditReturn } from "./runtime-api-current-project-round5-strict-edit-return.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-round5-strict-edit-return.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

assert(
  !/\bfunction\s+currentProjectRound5StrictEditReturnResponse\b/.test(serverSource),
  "local runtime server should import moved Round5 strict-edit return response code",
);

for (const forbidden of [
  "currentProjectRound5StrictEditPrepareResponse",
  "round5StrictEditReturnRequestInput",
  "createServer",
  "writeJson",
  "req.method",
  "provider submit",
  "provider-submit",
  "runtimeProviderSubmitAttempted: true",
  "liveSubmitAllowed: true",
]) {
  assert(!moduleSource.includes(forbidden), `Round5 strict-edit return module must not contain ${forbidden}`);
}

const sidecarNames = {
  approvedStartFrame: "approved_start_frame_ref.json",
  editableRegionEvidence: "editable_region_mask_or_bbox.json",
  providerEditReceipt: "provider_edit_receipt.json",
  endProviderObservation: "end_provider_observation.json",
  endSemanticQa: "end_semantic_qa.json",
  endPairQa: "end_pair_qa.json",
};

const source = {
  reportPath: "/repo/runs/r1/reports/round5_full_real_chain_report.json",
  reportRelativePath: "runs/r1/reports/round5_full_real_chain_report.json",
  runRootRelativePath: "runs/r1",
  projectRootMode: "fixture",
};

function createApi(overrides = {}) {
  const runtimeReads = new Map(Object.entries(overrides.runtimeReads || {}));
  const jsonWrites = [];
  const byteWrites = [];
  const blockedCalls = [];
  const report = overrides.report;
  const api = createRuntimeApiCurrentProjectRound5StrictEditReturn({
    currentProjectSource: () => source,
    readJsonIfPresent: () => report,
    isRound5FullRealChainReport: overrides.isRound5FullRealChainReport || ((value) => Boolean(value?.schemaVersion)),
    round5QaStatusFor: overrides.round5QaStatusFor || (() => "pass"),
    round5EndRequiredFor: overrides.round5EndRequiredFor || (() => true),
    round5StrictEditSidecarFileNames: sidecarNames,
    round5StrictEditEvidenceBlockers: overrides.round5StrictEditEvidenceBlockers || (() => []),
    round5StrictEditProviderObservationBlockers: overrides.round5StrictEditProviderObservationBlockers || (() => []),
    round5StrictEditBlockedResponse: (blockedSource, requestContext, input, blockers, extra) => {
      blockedCalls.push({ blockedSource, requestContext, input, blockers, extra });
      return {
        ok: false,
        status: "blocked",
        endpoint: extra.endpoint,
        blockers,
        strictEditReturnIngestRan: extra.strictEditReturnIngestRan,
      };
    },
    currentProjectRealChainResponse: overrides.currentProjectRealChainResponse || (() => ({
      previewStatus: "round5_artifact_ingest_needs_review",
      productionStatus: "needs_review",
      reportStatus: "round5_artifact_ingest_needs_review",
      currentProject: { bound: true },
      requestContext: { fromProjection: true },
      round5ArtifactIngest: {
        shotGateMatrix: [
          { shotId: "ZP05", gateStatus: "end_returned_needs_review" },
        ],
      },
    })),
    projectIdentityFromSource: () => ({ projectRoot: "/fixture/project", projectId: "fixture_project" }),
    requestOverrideDiagnostics: (requestContext) => ({ ...requestContext, normalized: true }),
    runtimePolicy: (extra = {}) => ({
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      videoSubmitted: false,
      ...extra,
    }),
    readRuntimeJson: (relativePath) => runtimeReads.get(relativePath),
    runtimeRelativeFromValue: (value) => value,
    runtimePathExists: overrides.runtimePathExists || (() => true),
    oneShotPathInsideRoot: overrides.oneShotPathInsideRoot || ((candidate, root) => String(candidate).startsWith(`${root}/`)),
    scopedRepoPath: (relativePath) => `/repo/${relativePath}`,
    readFileSync: () => Buffer.from("returned image bytes"),
    sha256Bytes: () => "sha256:end",
    writeCurrentProjectRuntimeBytes: (relativePath, bytes, writeSource) => byteWrites.push({ relativePath, bytes, writeSource }),
    writeCurrentProjectRuntimeJson: (relativePath, payload, writeSource) => jsonWrites.push({ relativePath, payload, writeSource }),
    currentProjectRound5StrictEditReturnEndpoint: overrides.endpoint || "/custom/round5/return",
  });
  return { api, jsonWrites, byteWrites, blockedCalls };
}

const blocked = createApi({
  report: undefined,
  endpoint: "/override/return-endpoint",
});
const blockedResponse = blocked.api.currentProjectRound5StrictEditReturnResponse({
  shotId: "ZP05",
  actualProviderReturned: false,
}, { requestContext: { requestId: "blocked-test" } }, source);

assert(blockedResponse.ok === false, "missing report should block strict-edit return");
assert(blockedResponse.endpoint === "/override/return-endpoint", "blocked response should use injected return endpoint override");
assert(blocked.blockedCalls.length === 1, "blocked path should delegate to injected blocked response");
assert(blocked.blockedCalls[0].blockers.includes("round5_full_real_chain_report_missing"), "blocked path should preserve report-missing blocker");

const report = {
  schemaVersion: "round5_full_real_chain_report_v1",
  generatedStartFrames: [
    { shotId: "ZP05", exists: true, sha256: "sha256:start", startFramePath: "shots/ZP05/start.png" },
  ],
  shotQa: [
    { shotId: "ZP05", qaStatus: "pass", endStatus: "required" },
  ],
};
const approvedPath = "runs/r1/shots/ZP05/approved_start_frame_ref.json";
const editablePath = "runs/r1/shots/ZP05/editable_region_mask_or_bbox.json";
const receiptPath = "runs/r1/shots/ZP05/provider_edit_receipt.json";
const providerObservation = {
  provider: "openai-image2-api",
  providerObservationMode: "actual_provider_call_observed",
  operation: "image.edit",
  providerRequestId: "req_round5_return",
  sourceStartFrameSha256: "sha256:start",
  sourceStartFrameAttachmentId: "attachment_round5_ZP05_start",
  editableRegionEvidenceSha256: "sha256:editable",
  preflightReceiptId: "receipt_round5_ZP05",
  noFallbackUsed: true,
};
const success = createApi({
  report,
  runtimeReads: {
    [approvedPath]: {
      approvalStatus: "approved",
      sha256: "sha256:start",
      startFramePath: "shots/ZP05/start.png",
      providerAttachmentId: "attachment_round5_ZP05_start",
    },
    [editablePath]: {
      status: "ready",
      qaStatus: "pass",
      sourceStartFrameSha256: "sha256:start",
      evidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
      evidenceSha256: "sha256:editable",
      bboxNormalized: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
    },
    [receiptPath]: {
      status: "ready_for_provider_edit",
      operation: "image.edit",
      receiptId: "receipt_round5_ZP05",
      sourceStartFrameSha256: "sha256:start",
      sourceStartFrameAttachmentId: "attachment_round5_ZP05_start",
      noFallbackUsed: true,
    },
  },
});
const successResponse = success.api.currentProjectRound5StrictEditReturnResponse({
  shotId: "ZP05",
  actualProviderReturned: true,
  returnedOutputPath: "runs/r1/provider-return/ZP05-end.png",
  providerRequestId: "req_round5_return",
  providerObservation,
  semanticQa: { reviewer: "fixture" },
}, { requestContext: { requestId: "success-test" } }, source);

assert(successResponse.ok === true, "success-shaped return should pass");
assert(successResponse.status === "strict_edit_end_returned_needs_review", "success status should remain strict edit needs_review");
assert(successResponse.providerCalled === true, "providerCalled should be true as an external return fact");
assert(successResponse.runtimeProviderSubmitAttempted !== true, "return ingest must not mark runtime provider submit attempted");
assert(successResponse.projectVibeWritten === false, "return ingest must not write project.vibe");
assert(successResponse.liveSubmitAllowed === false, "return ingest must not allow live submit");
assert(successResponse.workerSpawnForbidden === true, "return ingest must forbid worker spawn");
assert(successResponse.videoSubmitted === false, "return ingest must not submit video");
assert(successResponse.productionStatus === "needs_review", "production should remain needs_review");
assert(success.jsonWrites.length === 3, "success-shaped return should write provider, semantic, and pair sidecars");
assert(success.byteWrites.length === 1, "non-expected provider output should be copied to expected end path");

const providerWrite = success.jsonWrites.find((write) => write.relativePath.endsWith(sidecarNames.endProviderObservation));
const semanticWrite = success.jsonWrites.find((write) => write.relativePath.endsWith(sidecarNames.endSemanticQa));
const pairWrite = success.jsonWrites.find((write) => write.relativePath.endsWith(sidecarNames.endPairQa));
assert(providerWrite?.payload.providerCalled === true, "provider observation sidecar should record providerCalled external fact");
assert(providerWrite.payload.projectVibeWritten === false, "provider observation sidecar should not claim project.vibe write");
assert(semanticWrite?.payload.status === "needs_review", "semantic QA sidecar should remain needs_review");
assert(pairWrite?.payload.completeVerified === false, "pair QA sidecar should require later verification");

console.log("runtime-api-current-project-round5-strict-edit-return-test: ok");
