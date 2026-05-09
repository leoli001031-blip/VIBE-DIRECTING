import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importProjectRealChainStatus() {
  const sourcePath = "src/core/projectRealChainStatus.ts";
  const output = ts.transpileModule(readText(sourcePath), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  return import(dataUrl(sourcePath, output.outputText));
}

const { deriveProjectRealChainStatus } = await importProjectRealChainStatus();

const round5ArtifactIngest = {
  schemaVersion: "0.1.0",
  projectId: "round5-zero-project-planning-anime",
  runId: "run-round5-ui",
  shotGateMatrix: [
    {
      shotId: "ZP01",
      gateStatus: "start_observed",
      ledgerStatus: "provider_observed",
      nextAction: "none",
      strictEditPilotCandidate: false,
      blockers: [],
      warnings: [],
    },
    {
      shotId: "ZP02",
      gateStatus: "end_edit_preflight_blocked",
      ledgerStatus: "provider_observed",
      nextAction: "collect_strict_edit_provenance",
      strictEditPilotCandidate: false,
      blockers: ["missing_providerRequestId"],
      warnings: [],
    },
    {
      shotId: "ZP03",
      gateStatus: "start_observed",
      ledgerStatus: "provider_observed",
      nextAction: "none",
      strictEditPilotCandidate: false,
      blockers: [],
      warnings: [],
    },
    {
      shotId: "ZP04",
      gateStatus: "start_regeneration_required",
      ledgerStatus: "parked",
      nextAction: "regenerate_start_frame",
      strictEditPilotCandidate: false,
      blockers: ["start_motion_affordance_failed"],
      warnings: [],
    },
    {
      shotId: "ZP05",
      gateStatus: "end_edit_preflight_blocked",
      ledgerStatus: "provider_observed",
      nextAction: "collect_strict_edit_provenance",
      strictEditPilotCandidate: true,
      blockers: ["missing_inputSha256", "missing_providerRequestId"],
      warnings: [],
    },
    {
      shotId: "ZP06",
      gateStatus: "start_observed",
      ledgerStatus: "provider_observed",
      nextAction: "none",
      strictEditPilotCandidate: false,
      blockers: [],
      warnings: [],
    },
  ],
  ledgerProjection: {
    total: 6,
    completeVerified: 0,
    endEditPreflightBlocked: 2,
  },
  assetGateSummary: {
    total: 6,
    needsReview: 1,
    pass: 5,
  },
  uiSummary: {
    status: "blocked",
    complete: false,
    completeVerified: false,
    providerCalled: false,
    generatedImages: false,
    totalShots: 6,
    observedStarts: 6,
    endFramesComplete: 0,
  },
  isolation: {
    mainThreadImageBytesForbidden: true,
    sidecarOnlyImageTransport: true,
    noProjectVibeMutation: true,
  },
};

const status = deriveProjectRealChainStatus({
  project: {
    projectId: "round5-zero-project-planning-anime",
    projectRoot: "real-test-sandbox/round5-zero-project-planning-anime",
  },
  round5ArtifactIngest,
}, "runtime_endpoint");

const byShot = new Map(status.round5Gate.shotGateMatrix.map((shot) => [shot.shotId, shot]));
assert(status.uiStatus === "blocked", `round5 blocked ui status drifted: ${status.uiStatus}`);
assert(status.returnedImageCount === 6, `returnedImageCount should stay 6, got ${status.returnedImageCount}`);
assert(status.totalPlannedImages === 6, `totalPlannedImages should stay 6, got ${status.totalPlannedImages}`);
assert(byShot.get("ZP04").nextAction === "regenerate_start_frame", "ZP04 nextAction should be preserved");
assert(byShot.get("ZP05").strictEditPilotCandidate === true, "ZP05 strictEditPilotCandidate should be preserved");
assert(status.round5Gate.ledgerProjection.endEditPreflightBlocked === 2, "ledgerProjection should be preserved");

const topLevelStatus = deriveProjectRealChainStatus({
  projectId: "round5-zero-project-planning-anime",
  shotGateMatrix: round5ArtifactIngest.shotGateMatrix,
  ledgerProjection: round5ArtifactIngest.ledgerProjection,
  assetGateSummary: round5ArtifactIngest.assetGateSummary,
  uiSummary: { ...round5ArtifactIngest.uiSummary, status: "needs_review" },
  isolation: round5ArtifactIngest.isolation,
}, "runtime_endpoint");

assert(topLevelStatus.uiStatus === "blocked", "shot gate blockers should dominate top-level needs_review uiSummary");
assert(topLevelStatus.round5Gate.shotGateMatrix.length === 6, "top-level shotGateMatrix should be parsed");

console.log("Project real-chain Round 5 UI derive tests passed.");
