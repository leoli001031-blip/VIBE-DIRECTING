import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModule(sourcePath, exportPath) {
  const resolved = path.resolve(sourcePath);
  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: resolved,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-round5-artifact-ingest-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const runRoot = path.resolve("real-test-sandbox/round5-zero-project-planning-anime/runs/run-2026-05-09T11-09-28-642Z");
const reportPath = path.join(runRoot, "reports/round5_full_real_chain_report.json");
const report = readJson(reportPath);

const {
  buildRound5ArtifactIngest,
  round5EndFrameBlockers,
  round5ArtifactIsolationFlags,
} = await loadModule("src/core/round5ArtifactIngest.ts", "round5ArtifactIngest.mjs");

const projection = buildRound5ArtifactIngest({
  runRoot,
  projectId: "round5-zero-project-planning-anime",
  runId: "run-2026-05-09T11-09-28-642Z",
  report,
});

assert(projection.schemaVersion === "0.1.0", "schema version should be stable");
assert(projection.runRoot === runRoot, "runRoot should round-trip");
assert(projection.shotGateMatrix.length === 6, "all 6 shots must be ingested");
assert(projection.ledgers.length === 6, "one ledger should be created per shot");
assert(projection.ledgerProjection.total === 6, "ledger projection should include all shots");
assert(projection.uiSummary.totalShots === 6, "uiSummary should include all shots");
assert(projection.uiSummary.observedStarts === 6, "all 6 start.png artifacts should be observed");

const byShot = new Map(projection.shotGateMatrix.map((shot) => [shot.shotId, shot]));
for (const shotId of ["ZP01", "ZP02", "ZP03", "ZP04", "ZP05", "ZP06"]) {
  assert(byShot.has(shotId), `missing shot ${shotId}`);
  assert(byShot.get(shotId).startExists === true, `${shotId} start.png should be observed`);
  assert(byShot.get(shotId).completeVerified === false, `${shotId} must not be complete_verified`);
}

const zp04 = byShot.get("ZP04");
assert(zp04.ledgerStatus === "parked", "ZP04 should be parked because start affordance failed");
assert(
  zp04.nextAction === "regenerate_start_frame" || zp04.nextAction === "block_regenerate_start",
  "ZP04 nextAction should regenerate or block-regenerate start",
);
assert(zp04.gateStatus === "start_regeneration_required", "ZP04 should require start regeneration");
assert(!zp04.blockers.includes("complete_verified"), "ZP04 blockers should not pretend completion happened");

const zp02 = byShot.get("ZP02");
assert(zp02.gateStatus === "end_edit_preflight_blocked", "ZP02 should enter end_edit_preflight_blocked");
assert(zp02.ledgerStatus === "provider_observed", "ZP02 start should be provider_observed only");
assert(zp02.completeVerified === false, "ZP02 must not be complete_verified");

const zp05 = byShot.get("ZP05");
assert(zp05.strictEditPilotCandidate === true, "ZP05 should be marked as strict edit pilot candidate");
assert(zp05.gateStatus === "end_edit_preflight_blocked", "ZP05 end should remain blocked");
assert(zp05.ledgerStatus === "provider_observed", "ZP05 start should be provider_observed only");
assert(zp05.completeVerified === false, "ZP05 must not be complete_verified");
assert(zp05.nextAction === "collect_strict_edit_provenance", "ZP05 should wait for strict edit provenance");

for (const blocker of round5EndFrameBlockers) {
  assert(projection.shotGateMatrix.some((shot) => shot.blockers.includes(blocker)), `missing end blocker ${blocker}`);
  assert(report.endFrameStage.blockers.includes(blocker), `source report missing expected blocker ${blocker}`);
}

for (const shotId of ["ZP02", "ZP04", "ZP05"]) {
  const endPath = path.join(runRoot, `shots/${shotId}/end.png`);
  assert(!fs.existsSync(endPath), `${shotId} end.png should not exist in the run`);
  assert(byShot.get(shotId).endExists === false, `${shotId} end.png must not be projected as complete`);
}

assert(projection.ledgerProjection.completeVerified === 0, "no shot should be complete_verified");
assert(projection.ledgerProjection.endEditPreflightBlocked === 2, "only ZP02 and ZP05 should be end edit preflight blocked");
assert(projection.ledgerProjection.endEditPreflightReady === 0, "no shot should be strict edit ready without evidence");
assert(projection.uiSummary.complete === false, "uiSummary must not mark complete");
assert(projection.uiSummary.completeVerified === false, "uiSummary must not mark completeVerified");
assert(projection.uiSummary.status !== "complete", "uiSummary status must not be complete");
assert(projection.uiSummary.generatedImages === false, "ingest must not claim image generation");
assert(projection.uiSummary.providerCalled === false, "ingest must not claim a provider call");

const projectionWithStrictZp05 = buildRound5ArtifactIngest({
  runRoot,
  projectId: "round5-zero-project-planning-anime",
  runId: "run-2026-05-09T11-09-28-642Z",
  report,
  strictEditEvidence: {
    approvedStartFrames: [
      {
        shotId: "ZP05",
        startFramePath: "shots/ZP05/start.png",
        sha256: zp05.startFrameSha256,
        providerAttachmentId: "attachment_round5_ZP05_start",
        approvalStatus: "approved_for_strict_edit",
      },
    ],
    editableRegionEvidence: [
      {
        shotId: "ZP05",
        sourceStartFrameSha256: zp05.startFrameSha256,
        evidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
        evidenceSha256: "sha256:fixture-zp05-editable-region",
        bboxNormalized: { x: 0.42, y: 0.34, width: 0.22, height: 0.2 },
        qaStatus: "pass",
      },
    ],
    providerEditReceipts: [
      {
        shotId: "ZP05",
        receiptId: "round5_zp05_strict_edit_handoff",
        receiptPath: "shots/ZP05/provider_edit_receipt.json",
        status: "ready_for_provider_edit",
        operation: "image.edit",
        sourceStartFramePath: "shots/ZP05/start.png",
        sourceStartFrameSha256: zp05.startFrameSha256,
        sourceStartFrameAttachmentId: "attachment_round5_ZP05_start",
        editableRegionEvidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
        editableRegionEvidenceSha256: "sha256:fixture-zp05-editable-region",
        noFallbackUsed: true,
        providerCalled: false,
      },
    ],
  },
});

const strictByShot = new Map(projectionWithStrictZp05.shotGateMatrix.map((shot) => [shot.shotId, shot]));
const strictZp05 = strictByShot.get("ZP05");
assert(strictZp05.gateStatus === "end_edit_preflight_ready", "ZP05 should become strict edit preflight ready when evidence is complete");
assert(strictZp05.ledgerStatus === "waiting_output", "ZP05 should wait for provider output after strict edit preflight");
assert(strictZp05.nextAction === "submit_strict_image_edit", "ZP05 next action should submit strict image edit");
assert(strictZp05.strictEditPreflightStatus === "ready_for_provider_edit", "ZP05 strict edit status mismatch");
assert(strictZp05.blockers.length === 1 && strictZp05.blockers[0] === "end_frame_blocked_until_approved_start_attachment_and_edit_provenance", "ZP05 should keep source warning only after evidence clears hard blockers");
assert(strictZp05.approvedStartFrameRef === "shots/ZP05/start.png", "ZP05 approved start ref missing");
assert(strictZp05.editableRegionEvidenceRef === "shots/ZP05/editable_region_mask_or_bbox.json", "ZP05 editable region evidence ref missing");
assert(strictZp05.providerEditReceiptRef === "shots/ZP05/provider_edit_receipt.json", "ZP05 edit receipt ref missing");
assert(strictByShot.get("ZP02").gateStatus === "end_edit_preflight_blocked", "ZP02 should remain blocked without strict edit evidence");
assert(projectionWithStrictZp05.ledgerProjection.endEditPreflightBlocked === 1, "strict ZP05 evidence should leave only ZP02 end edit preflight blocked");
assert(projectionWithStrictZp05.ledgerProjection.endEditPreflightReady === 1, "strict ZP05 evidence should count one ready strict edit preflight");
assert(projectionWithStrictZp05.ledgerProjection.completeVerified === 0, "strict edit preflight must not complete any shot");
assert(projectionWithStrictZp05.uiSummary.providerCalled === false, "strict edit preflight must not claim provider call");
assert(projectionWithStrictZp05.uiSummary.generatedImages === false, "strict edit preflight must not claim image generation");

const projectionWithLooseStatusTraps = buildRound5ArtifactIngest({
  runRoot,
  projectId: "round5-zero-project-planning-anime",
  runId: "run-2026-05-09T11-09-28-642Z",
  report,
  strictEditEvidence: {
    approvedStartFrames: [
      {
        shotId: "ZP05",
        startFramePath: "shots/ZP05/start.png",
        sha256: zp05.startFrameSha256,
        providerAttachmentId: "attachment_round5_ZP05_start",
        approvalStatus: "unapproved",
      },
    ],
    editableRegionEvidence: [
      {
        shotId: "ZP05",
        sourceStartFrameSha256: zp05.startFrameSha256,
        evidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
        evidenceSha256: "sha256:fixture-zp05-editable-region",
        bboxNormalized: { x: 0.42, y: 0.34, width: 0.22, height: 0.2 },
        qaStatus: "not_ready",
        status: "not_ready",
      },
    ],
    providerEditReceipts: [
      {
        shotId: "ZP05",
        receiptId: "round5_zp05_strict_edit_handoff",
        receiptPath: "shots/ZP05/provider_edit_receipt.json",
        status: "not_ready",
        operation: "fake_image.edit_wrapper",
        sourceStartFramePath: "shots/ZP05/start.png",
        sourceStartFrameSha256: zp05.startFrameSha256,
        sourceStartFrameAttachmentId: "attachment_round5_ZP05_start",
        editableRegionEvidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
        editableRegionEvidenceSha256: "sha256:fixture-zp05-editable-region",
        noFallbackUsed: true,
        providerCalled: false,
      },
    ],
  },
});
const trappedZp05 = new Map(projectionWithLooseStatusTraps.shotGateMatrix.map((shot) => [shot.shotId, shot])).get("ZP05");
assert(trappedZp05.gateStatus === "end_edit_preflight_blocked", "loose status substrings must not make ZP05 preflight ready");
assert(trappedZp05.nextAction === "collect_strict_edit_provenance", "loose status substrings should keep ZP05 collecting strict evidence");
for (const blocker of ["approved_start_attachment_missing", "editable_region_mask_or_bbox_missing", "provider_edit_receipt_missing", "strict_image_edit_provenance_missing"]) {
  assert(trappedZp05.blockers.includes(blocker), `loose status trap missing blocker ${blocker}`);
}

const zp05Ledger = projectionWithStrictZp05.ledgers.find((ledger) => ledger.taskRunId.endsWith(":ZP05:start"));
assert(
  zp05Ledger?.events.some((event) => event.eventType === "strict_edit_preflight_ready"),
  "ZP05 ledger should record strict edit preflight readiness",
);

assert(round5ArtifactIsolationFlags.mainThreadImageBytesForbidden === true, "module isolation flag should forbid main-thread image bytes");
assert(round5ArtifactIsolationFlags.sidecarOnlyImageTransport === true, "module isolation flag should require sidecar-only image transport");
assert(round5ArtifactIsolationFlags.noProjectVibeMutation === true, "module isolation flag should forbid project.vibe mutation");
assert(projection.isolation.mainThreadImageBytesForbidden === true, "projection isolation should forbid main-thread image bytes");
assert(projection.isolation.sidecarOnlyImageTransport === true, "projection isolation should require sidecar-only image transport");
assert(projection.isolation.noProjectVibeMutation === true, "projection isolation should forbid project.vibe mutation");

const serialized = JSON.stringify(projection);
assert(!serialized.includes("end.png\",\"verified\":true"), "no end.png should be serialized as verified");
assert(!serialized.includes("\"eventType\":\"complete_verified\""), "ingest ledgers must not contain complete_verified events");
assert(!serialized.includes("providerTaskId"), "ingest projection must not invent provider task ids");
assert(!serialized.includes("submitId"), "ingest projection must not invent submit ids");

const source = fs.readFileSync("src/core/round5ArtifactIngest.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "spawn(", "exec(", "writeFile", "providerTaskId", "submitId"]) {
  assert(!source.includes(forbiddenCode), `round5ArtifactIngest source must not contain ${forbiddenCode}`);
}

console.log("Round 5 artifact ingest projection tests passed. No provider calls or project mutations were made.");
