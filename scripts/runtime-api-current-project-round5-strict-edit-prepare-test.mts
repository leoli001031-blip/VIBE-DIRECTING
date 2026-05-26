import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiCurrentProjectRound5StrictEditPrepare } from "./runtime-api-current-project-round5-strict-edit-prepare.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-round5-strict-edit-prepare.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

for (const movedFunction of [
  "round5StrictEditRequestInput",
  "round5NormalizeBbox",
  "round5DefaultStrictEditBbox",
  "round5StartFramePathInfo",
  "currentProjectRound5StrictEditPrepareResponse",
]) {
  assert(
    !new RegExp(`\\bfunction\\s+${movedFunction}\\b`).test(serverSource),
    `local runtime server should not define moved prepare helper ${movedFunction}`,
  );
}

for (const forbidden of [
  "provider submit",
  "provider-submit",
  "runtimeProviderSubmitAttempted: true",
  "projectVibeWritten: true",
  "liveSubmitAllowed: true",
  "videoSubmitted: true",
]) {
  assert(!moduleSource.includes(forbidden), `Round5 strict-edit prepare module must not contain ${forbidden}`);
}

const sidecarNames = {
  approvedStartFrame: "approved_start_frame_ref.json",
  editableRegionEvidence: "editable_region_mask_or_bbox.json",
  providerEditReceipt: "provider_edit_receipt.json",
};

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "vibe-round5-prepare-"));
try {
  const runRootRelativePath = "runs/r1";
  const runRootPath = path.join(tmpRoot, runRootRelativePath);
  const startFrameRelativePath = "shots/ZP05/start.png";
  const startFramePath = path.join(runRootPath, startFrameRelativePath);
  mkdirSync(path.dirname(startFramePath), { recursive: true });
  writeFileSync(startFramePath, Buffer.from("round5 strict edit start frame"));
  const startSha256 = createHash("sha256").update(readFileSync(startFramePath)).digest("hex");

  const source = {
    reportPath: path.join(runRootPath, "reports/round5_full_real_chain_report.json"),
    reportRelativePath: `${runRootRelativePath}/reports/round5_full_real_chain_report.json`,
    runRootPath,
    runRootRelativePath,
    projectRootMode: "fixture",
  };

  function createApi(overrides = {}) {
    const jsonWrites = [];
    const blockedCalls = [];
    const report = overrides.report;
    const api = createRuntimeApiCurrentProjectRound5StrictEditPrepare({
      currentProjectSource: () => source,
      readJsonIfPresent: () => report,
      isRound5FullRealChainReport: overrides.isRound5FullRealChainReport || ((value) => Boolean(value?.schemaVersion)),
      round5QaStatusFor: overrides.round5QaStatusFor || (() => "pass"),
      round5EndRequiredFor: overrides.round5EndRequiredFor || (() => true),
      round5BboxValid: overrides.round5BboxValid || ((bbox) => (
        Number.isFinite(bbox?.x)
        && Number.isFinite(bbox?.y)
        && Number.isFinite(bbox?.width)
        && Number.isFinite(bbox?.height)
        && bbox.x >= 0
        && bbox.y >= 0
        && bbox.width > 0
        && bbox.height > 0
        && bbox.x + bbox.width <= 1
        && bbox.y + bbox.height <= 1
      )),
      round5StrictEditSidecarFileNames: sidecarNames,
      round5StrictEditBlockedResponse: (blockedSource, requestContext, input, blockers, extra) => {
        blockedCalls.push({ blockedSource, requestContext, input, blockers, extra });
        return {
          ok: false,
          status: "blocked",
          blockers,
          sidecarWrites: [],
          strictEditPreflightPrepareRan: false,
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          videoSubmitted: false,
          workerSpawnForbidden: true,
          ...extra,
        };
      },
      currentProjectRealChainResponse: overrides.currentProjectRealChainResponse || (() => ({
        previewStatus: "needs_review",
        productionStatus: "blocked",
        reportStatus: "needs_review",
        currentProject: { bound: true },
        requestContext: { fromProjection: true },
        round5ArtifactIngest: {
          shotGateMatrix: [
            { shotId: "ZP05", gateStatus: "strict_edit_ready" },
          ],
        },
      })),
      projectIdentityFromSource: () => ({ projectRoot: "/fixture/project", projectId: "fixture_project" }),
      requestOverrideDiagnostics: (requestContext) => ({ ...requestContext, normalized: true }),
      runtimePolicy: () => ({
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        videoSubmitted: false,
      }),
      normalizeRelativePath: (value) => String(value || "").replaceAll("\\", "/").replace(/^\/+/, ""),
      oneShotPathInsideRoot: (candidate, root) => candidate === root || String(candidate).startsWith(`${root}/`),
      scopedRepoPath: (relativePath) => path.join(tmpRoot, relativePath),
      existsSync,
      statSync,
      realpathSync,
      isPathInsideRealRoot: (candidate, root) => candidate === root || candidate.startsWith(`${root}${path.sep}`),
      readFileSync,
      writeCurrentProjectRuntimeJson: (relativePath, payload, writeSource) => jsonWrites.push({ relativePath, payload, writeSource }),
      repoRelativePath: (absolutePath) => path.relative(tmpRoot, absolutePath).replaceAll(path.sep, "/"),
      currentProjectRound5StrictEditPrepareEndpoint: "/custom/round5/prepare",
    });
    return { api, jsonWrites, blockedCalls };
  }

  const missingReport = createApi({ report: undefined });
  const blockedResponse = missingReport.api.currentProjectRound5StrictEditPrepareResponse({
    shotId: "ZP05",
    inputSha256: "request-sha-must-be-ignored",
  }, { requestContext: { requestId: "blocked-test" } }, source);

  assert(blockedResponse.ok === false, "missing report should block strict-edit prepare");
  assert(blockedResponse.blockers.includes("round5_full_real_chain_report_missing"), "missing report blocker should be preserved");
  assert(blockedResponse.ignoredInputSha256 === "sha256_from_request_ignored", "request sha should be explicitly ignored");
  assert(blockedResponse.sidecarWrites.length === 0, "blocked prepare must not write sidecars");
  assert(blockedResponse.providerCalled === false, "blocked prepare must not call provider");
  assert(blockedResponse.projectVibeWritten === false, "blocked prepare must not write project.vibe");
  assert(blockedResponse.liveSubmitAllowed === false, "blocked prepare must not allow live submit");
  assert(blockedResponse.videoSubmitted === false, "blocked prepare must not submit video");
  assert(blockedResponse.workerSpawnForbidden === true, "blocked prepare must forbid worker spawn");

  const report = {
    schemaVersion: "round5_full_real_chain_report_v1",
    generatedStartFrames: [
      { shotId: "ZP05", exists: true, sha256: startSha256, startFramePath: startFrameRelativePath },
    ],
    shotQa: [
      { shotId: "ZP05", qaStatus: "pass", endStatus: "required" },
    ],
  };
  const success = createApi({ report });
  const parsedInput = success.api.round5StrictEditRequestInput(new URL("http://runtime.test/custom/round5/prepare"), {
    selectedShotId: "ZP05",
    bbox: { x: "0.2", y: "0.1", width: "0.3", height: "0.4" },
    sourceStartFrameSha256: "request-sha-must-be-ignored",
  });
  const successResponse = success.api.currentProjectRound5StrictEditPrepareResponse(parsedInput, {
    running: false,
    requestContext: { requestId: "success-test" },
  }, source);

  assert(successResponse.ok === true, "ready prepare should pass");
  assert(successResponse.endpoint === "/custom/round5/prepare", "prepare endpoint should come from injection");
  assert(successResponse.status === "prepared", "prepare status should remain prepared");
  assert(successResponse.providerCalled === false, "prepare must not call provider");
  assert(successResponse.prepareRan === false, "prepare must not mark one-shot prepare ran");
  assert(successResponse.projectVibeWritten === false, "prepare must not write project.vibe");
  assert(successResponse.liveSubmitAllowed === false, "prepare must not allow live submit");
  assert(successResponse.videoSubmitted === false, "prepare must not submit video");
  assert(successResponse.workerSpawnForbidden === true, "prepare must forbid worker spawn");
  assert(successResponse.strictEditPreflightPrepareRan === true, "strict edit preflight prepare should run on success");
  assert(successResponse.message.includes("No provider call or project.vibe write was performed."), "message should preserve no-provider/no-promotion wording");
  assert(successResponse.ignoredInputSha256 === "sha256_from_request_ignored", "ready prepare should preserve ignored request sha marker");
  assert(success.jsonWrites.length === 3, "ready prepare should write exactly three preflight sidecars");
  assert(successResponse.sidecarWrites.length === 3, "ready prepare should report three sidecar writes");
  assert(successResponse.editableRegionEvidence.bboxNormalized.x === 0.2, "request bbox should be normalized to numbers");
  assert(successResponse.providerEditReceipt.providerCalled === false, "provider receipt must not call provider");
  assert(successResponse.providerEditReceipt.liveSubmitAllowed === false, "provider receipt must not allow live submit");
  assert(successResponse.providerEditReceipt.videoSubmitted === false, "provider receipt must not submit video");
  assert(successResponse.providerEditReceipt.workerSpawnForbidden === true, "provider receipt must forbid worker spawn");

  const defaultBbox = createApi({ report });
  const defaultBboxResponse = defaultBbox.api.currentProjectRound5StrictEditPrepareResponse({
    shotId: "ZP05",
  }, {}, source);
  assert(defaultBboxResponse.editableRegionEvidence.bboxNormalized.x === 0.42, "ZP05 default bbox should be preserved");
  assert(defaultBbox.jsonWrites.length === 3, "default bbox ready prepare should write three sidecars");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log("runtime-api-current-project-round5-strict-edit-prepare-test: ok");
