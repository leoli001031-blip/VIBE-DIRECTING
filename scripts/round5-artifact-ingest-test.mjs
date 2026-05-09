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
assert(projection.uiSummary.complete === false, "uiSummary must not mark complete");
assert(projection.uiSummary.completeVerified === false, "uiSummary must not mark completeVerified");
assert(projection.uiSummary.status !== "complete", "uiSummary status must not be complete");
assert(projection.uiSummary.generatedImages === false, "ingest must not claim image generation");
assert(projection.uiSummary.providerCalled === false, "ingest must not claim a provider call");

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
