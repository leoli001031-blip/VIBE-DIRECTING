import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiRound5ArtifactIngest } from "./runtime-api-round5-artifact-ingest.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function normalizeRelativePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function shotById(projection, shotId) {
  return projection.shotGateMatrix.find((shot) => shot.shotId === shotId);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

for (const functionName of [
  "round5ArtifactIngestFromReport",
  "round5LedgerEvents",
  "round5StrictEditProviderObservationBlockers",
  "round5QaStatusFor",
  "round5EndRequiredFor",
  "round5StrictEditEvidenceBlockers",
  "round5StrictEditEndReturned",
  "round5ReadStrictEditEvidence",
  "round5ReadStrictEditReturns",
]) {
  assert(
    !new RegExp(`\\bfunction\\s+${functionName}\\b`).test(serverSource),
    `local runtime server should not redeclare migrated ${functionName}`,
  );
}

const fixtureRunRoot = path.join(
  repoRoot,
  "real-test-sandbox/round5-zero-project-planning-anime/runs/run-2026-05-09T11-09-28-642Z",
);
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "vibe-runtime-round5-artifact-ingest-"));

try {
  const runRoot = path.join(tempRoot, "run-2026-05-09T11-09-28-642Z");
  cpSync(fixtureRunRoot, runRoot, { recursive: true });

  const reportPath = path.join(runRoot, "reports/round5_full_real_chain_report.json");
  const report = readJson(reportPath);
  const source = {
    runRootPath: runRoot,
    reportRelativePath: "reports/round5_full_real_chain_report.json",
    requestProjectId: "round5-zero-project-planning-anime",
  };
  const project = {
    projectId: "round5-zero-project-planning-anime",
    runId: "run-2026-05-09T11-09-28-642Z",
  };
  const sidecars = {
    approvedStartFrame: "approved_start_frame_ref.json",
    editableRegionEvidence: "editable_region_mask_or_bbox.json",
    providerEditReceipt: "provider_edit_receipt.json",
    endProviderObservation: "end_provider_observation.json",
    endSemanticQa: "end_semantic_qa.json",
    endPairQa: "end_pair_qa.json",
  };
  const ingest = createRuntimeApiRound5ArtifactIngest({
    existsSync,
    statSync,
    readJsonIfPresent(filePath) {
      if (!existsSync(filePath)) return undefined;
      try {
        return readJson(filePath);
      } catch {
        return undefined;
      }
    },
    sha256File,
    normalizeRelativePath,
    round5FullRealChainReportFileName: "round5_full_real_chain_report.json",
    round5StrictEditSidecarFileNames: sidecars,
  });

  const baseProjection = ingest.round5ArtifactIngestFromReport(source, project, report);
  assert(baseProjection, "fixture report should produce Round5 artifact ingest");
  assert(baseProjection.shotGateMatrix.length === 6, "base projection should include all 6 shots");
  assert(baseProjection.ledgerProjection.total === 6, "ledger projection should include all 6 shots");
  assert(baseProjection.ledgerProjection.completeVerified === 0, "base projection must not complete any shot");
  assert(baseProjection.uiSummary.complete === false, "base projection must not mark complete");
  assert(baseProjection.uiSummary.completeVerified === false, "base projection must not mark completeVerified");
  assert(baseProjection.uiSummary.providerCalled === false, "base projection must not claim providerCalled");
  assert(baseProjection.uiSummary.generatedImages === false, "base projection must not claim generatedImages");

  const baseZp04 = shotById(baseProjection, "ZP04");
  const baseZp05 = shotById(baseProjection, "ZP05");
  assert(baseZp04?.gateStatus === "start_regeneration_required", "ZP04 should require start regeneration");
  assert(baseZp05?.gateStatus === "end_edit_preflight_blocked", "ZP05 should start blocked before sidecars");
  assert(baseZp05.completeVerified === false, "ZP05 must not complete before sidecars");

  const zp05ShotDir = path.join(runRoot, "shots/ZP05");
  const attachmentId = "attachment_round5_ZP05_start";
  const editableEvidenceSha = "sha256:fixture-zp05-editable-region";
  const receiptId = "round5_zp05_strict_edit_handoff";
  writeJson(path.join(zp05ShotDir, sidecars.approvedStartFrame), {
    schemaVersion: "round5_approved_start_frame_ref_v1",
    shotId: "ZP05",
    startFramePath: "shots/ZP05/start.png",
    sha256: baseZp05.startFrameSha256,
    sourceStartFrameSha256: baseZp05.startFrameSha256,
    providerAttachmentId: attachmentId,
    approvalStatus: "approved_for_strict_edit",
    providerCalled: false,
  });
  writeJson(path.join(zp05ShotDir, sidecars.editableRegionEvidence), {
    schemaVersion: "round5_editable_region_mask_or_bbox_v1",
    shotId: "ZP05",
    sourceStartFrameSha256: baseZp05.startFrameSha256,
    evidencePath: `shots/ZP05/${sidecars.editableRegionEvidence}`,
    evidenceSha256: editableEvidenceSha,
    bboxNormalized: { x: 0.42, y: 0.34, width: 0.22, height: 0.2 },
    qaStatus: "pass",
    status: "ready",
    providerCalled: false,
  });
  writeJson(path.join(zp05ShotDir, sidecars.providerEditReceipt), {
    schemaVersion: "round5_provider_edit_receipt_v1",
    shotId: "ZP05",
    receiptId,
    receiptPath: `shots/ZP05/${sidecars.providerEditReceipt}`,
    status: "ready_for_provider_edit",
    operation: "image.edit",
    sourceStartFramePath: "shots/ZP05/start.png",
    sourceStartFrameSha256: baseZp05.startFrameSha256,
    sourceStartFrameAttachmentId: attachmentId,
    editableRegionEvidencePath: `shots/ZP05/${sidecars.editableRegionEvidence}`,
    editableRegionEvidenceSha256: editableEvidenceSha,
    noFallbackUsed: true,
    providerCalled: false,
  });

  const preflightProjection = ingest.round5ArtifactIngestFromReport(source, project, report);
  const preflightZp05 = shotById(preflightProjection, "ZP05");
  assert(preflightZp05.gateStatus === "end_edit_preflight_ready", "ZP05 should become preflight ready after sidecars");
  assert(preflightZp05.nextAction === "submit_strict_image_edit", "ZP05 nextAction should be the UI handoff signal");
  assert(preflightZp05.completeVerified === false, "preflight ready must not complete ZP05");
  assert(preflightProjection.uiSummary.providerCalled === false, "preflight sidecars must not claim providerCalled");
  assert(preflightProjection.uiSummary.generatedImages === false, "preflight sidecars must not claim generatedImages");

  const endPath = path.join(zp05ShotDir, "end.png");
  writeFileSync(endPath, Buffer.from("fixture strict edit end bytes"));
  const endSha = sha256File(endPath);
  writeJson(path.join(zp05ShotDir, sidecars.endProviderObservation), {
    schemaVersion: "round5_strict_edit_end_provider_observation_v1",
    provider: "openai_image2_via_codex_imagegen",
    providerObservationMode: "actual_provider_call_observed",
    operation: "image.edit",
    providerRequestId: "provider-request-zp05",
    outputPath: "shots/ZP05/end.png",
    outputSha256: endSha,
    providerCalled: true,
    actualImage2Triggered: true,
    sourceStartFrameSha256: baseZp05.startFrameSha256,
    sourceStartFrameAttachmentId: attachmentId,
    editableRegionEvidenceSha256: editableEvidenceSha,
    preflightReceiptId: receiptId,
    noFallbackUsed: true,
    referenceAttachmentReceipt: {
      deliveredInputKind: "local_image",
      sourceStartFrameAttachmentId: attachmentId,
      sourceStartFrameSha256: baseZp05.startFrameSha256,
      promptOnly: false,
      acceptedByActionSchema: true,
    },
  });
  writeJson(path.join(zp05ShotDir, sidecars.endSemanticQa), {
    schemaVersion: "round5_strict_edit_end_semantic_qa_v1",
    semanticReviewMode: "actual_image_semantic_review",
    outputPath: "shots/ZP05/end.png",
    reviewedOutputSha256: endSha,
    status: "needs_review",
    finalAssessment: { status: "needs_review" },
  });

  const returnedProjection = ingest.round5ArtifactIngestFromReport(source, project, report);
  const returnedZp05 = shotById(returnedProjection, "ZP05");
  assert(returnedZp05.gateStatus === "end_returned_needs_review", "ZP05 returned end should stay needs_review");
  assert(returnedZp05.nextAction === "review_strict_edit_end_frame", "returned end should require review");
  assert(returnedZp05.completeVerified === false, "returned end must not complete ZP05");
  assert(returnedProjection.ledgerProjection.completeVerified === 0, "returned projection must not complete any shot");
  assert(returnedProjection.uiSummary.complete === false, "returned projection must not mark complete");
  assert(returnedProjection.uiSummary.completeVerified === false, "returned projection must not mark completeVerified");
  assert(returnedProjection.uiSummary.endFramesComplete === 0, "returned end frames must not be promoted complete");
  assert(returnedProjection.uiSummary.providerCalled === true, "returned end should project external providerCalled fact");
  assert(returnedProjection.uiSummary.generatedImages === true, "returned end should project external generatedImages fact");

  const providerObservationBase = {
    provider: "openai_image2_via_codex_imagegen",
    providerObservationMode: "actual_provider_call_observed",
    operation: "image.edit",
    providerRequestId: "provider-request-zp05",
    sourceStartFrameSha256: baseZp05.startFrameSha256,
    sourceStartFrameAttachmentId: attachmentId,
    editableRegionEvidenceSha256: editableEvidenceSha,
    preflightReceiptId: receiptId,
    noFallbackUsed: true,
  };
  const blockerInput = {
    providerRequestId: "provider-request-zp05",
    generated: { sha256: baseZp05.startFrameSha256 },
    approvedStartFrame: { providerAttachmentId: attachmentId },
    editableRegionEvidence: { evidenceSha256: editableEvidenceSha },
    providerEditReceipt: { receiptId },
  };
  const promptOnlyBlockers = ingest.round5StrictEditProviderObservationBlockers({
    ...blockerInput,
    providerObservation: {
      ...providerObservationBase,
      promptOnly: true,
      deliveredInputKind: "prompt_only",
      referenceAttachmentReceipt: {
        deliveredInputKind: "local_image",
        sourceStartFrameAttachmentId: attachmentId,
        sourceStartFrameSha256: baseZp05.startFrameSha256,
        promptOnly: false,
        acceptedByActionSchema: true,
      },
    },
  });
  assert(promptOnlyBlockers.includes("prompt_only_image_edit_forbidden"), "prompt-only provider observation must be blocked");

  const missingReceiptBlockers = ingest.round5StrictEditProviderObservationBlockers({
    ...blockerInput,
    providerObservation: providerObservationBase,
  });
  assert(
    missingReceiptBlockers.includes("source_reference_attachment_receipt_missing"),
    "provider observation without reference attachment receipt must be blocked",
  );

  console.log("runtime-api-round5-artifact-ingest-test: ok");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
