import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2ForbiddenProviders,
  currentProjectImage2TransportModes,
  normalizeCurrentProjectImage2TransportMode,
} from "./current-project-image2-transport-contract.mjs";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mjs";
import { createRuntimeApiCurrentProjectBinding } from "./runtime-api-current-project-binding.mjs";
import { createRuntimeApiCurrentProjectImage2Handoff } from "./runtime-api-current-project-image2-handoff.mjs";
import { createRuntimeApiCurrentProjectOneShotExecutor } from "./runtime-api-current-project-one-shot-executor.mjs";
import { createRuntimeApiCurrentProjectOneShotReturn } from "./runtime-api-current-project-one-shot-return.mjs";
import { createRuntimeApiCurrentProjectRealChainStatus } from "./runtime-api-current-project-real-chain-status.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditPrepare } from "./runtime-api-current-project-round5-strict-edit-prepare.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditReturn } from "./runtime-api-current-project-round5-strict-edit-return.mjs";
import { createRuntimeApiCurrentProjectReturnWriters } from "./runtime-api-current-project-return-writers.mjs";
import { createRuntimeApiFileServing } from "./runtime-api-file-serving.mjs";
import { createRuntimeApiProviderReturnEvidence } from "./runtime-api-provider-return-evidence.mjs";
import { createRuntimeApiRound5ArtifactIngest } from "./runtime-api-round5-artifact-ingest.mjs";
import { createRuntimeApiWorkbenchProjection } from "./runtime-api-workbench-projection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const repoRootRealPath = realpathSync(repoRoot);
const host = process.env.VIBE_CORE_RUNTIME_API_HOST || "127.0.0.1";
const port = Number(process.env.VIBE_CORE_RUNTIME_API_PORT || 8790);
const sandboxRunRootRelativePath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames";
const sandboxProjectVibeRelativePath = `${sandboxRunRootRelativePath}/project/project.vibe`;
const sandboxReportRelativePath = `${sandboxRunRootRelativePath}/reports/image2_start_long_chain_report.json`;
const verifyScript = path.join(repoRoot, "scripts/real-demo-e2e-005-anime-image2-start-verify.mjs");
const maxOutputChars = 8000;
const round5FullRealChainReportFileName = "round5_full_real_chain_report.json";
const round5StrictEditSidecarFileNames = {
  approvedStartFrame: "approved_start_frame_ref.json",
  editableRegionEvidence: "editable_region_mask_or_bbox.json",
  providerEditReceipt: "provider_edit_receipt.json",
  endProviderObservation: "end_provider_observation.json",
  endSemanticQa: "end_semantic_qa.json",
  endPairQa: "end_pair_qa.json",
};

const runtimeBasePath = "/api/runtime";
const currentProjectBindingEndpoint = `${runtimeBasePath}/projects/current`;
const currentProjectSelectEndpoint = `${runtimeBasePath}/projects/select`;
const currentProjectRecentEndpoint = `${runtimeBasePath}/projects/recent`;
const currentProjectStatusEndpoint = `${runtimeBasePath}/projects/current/real-chain/status`;
const currentProjectRunEndpoint = `${runtimeBasePath}/projects/current/real-chain/run-check`;
const currentProjectImage2BatchPlanEndpoint = `${runtimeBasePath}/projects/current/image2-batch/plan`;
const currentProjectImage2BatchRunCheckEndpoint = `${runtimeBasePath}/projects/current/image2-batch/run-check`;
const currentProjectImage2OneShotStatusEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/status`;
const currentProjectImage2OneShotPrepareEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/prepare`;
const currentProjectImage2OneShotConfirmEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/confirm`;
const currentProjectImage2OneShotPrepareTriggerEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/prepare-trigger`;
const currentProjectImage2OneShotExecuteMockEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-mock`;
const currentProjectImage2OneShotReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/return`;
const currentProjectImage2OneShotExecuteReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-return`;
const currentProjectRound5StrictEditPrepareEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/prepare`;
const currentProjectRound5StrictEditReturnEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/return`;
const realDemo005StatusEndpoint = `${runtimeBasePath}/real-demo-e2e/005/status`;
const realDemo005RunEndpoint = `${runtimeBasePath}/real-demo-e2e/005/run`;
const runtimeFileEndpoint = `${runtimeBasePath}/files`;
const legacyStatusEndpoint = "/api/real-demo-e2e/005/status";
const legacyRunEndpoint = "/api/real-demo-e2e/005/run";
const knownProjectFixtureRoots = [
  "real-test-sandbox/real-demo-e2e/004-image2-start-frames",
  "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames",
  "real-test-sandbox/real-demo-e2e/003-long-chain-software",
  "real-test-sandbox/real-demo-e2e/002-anime-pressure",
  "real-test-sandbox/real-demo-e2e/001",
];

let running = false;

const {
  contentTypeFor,
  corsHeaders,
  isTrustedLocalOrigin,
  normalizeRelativePath,
  pathWithinRoot,
  repoRelativePath,
  resolveRepoInputPath,
  runtimePathExists,
  runtimePolicy,
  runtimeRelativeFromValue,
  runtimeRequestSecurity,
  scopedRepoPath,
  writeRuntimeFileError,
} = createRuntimeApiBoundary({
  repoRoot,
  repoRootRealPath,
  runtimeBasePath,
  runtimeToken: () => process.env.VIBE_CORE_RUNTIME_API_TOKEN || "",
  legacyRunEnabled: () => process.env.VIBE_CORE_ENABLE_LEGACY_RUN === "1",
});

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return undefined;
  try {
    return readJson(filePath);
  } catch {
    return undefined;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const {
  currentProjectBindingPath,
  readCurrentProjectBinding,
  validateSelectableProjectRoot,
  writeCurrentProjectBinding,
  resolveProjectSource,
  realDemo005Source,
  currentProjectSource,
  readProjectVibe,
  projectIdentityFromSource,
  projectChoiceTitle,
  projectChoiceUpdatedAt,
  projectChoiceFromSource,
  currentProjectRecentResponse,
  currentProjectSourceResult,
  requestOverrideDiagnostics,
  blockedCurrentProjectResponse,
  unboundCurrentProjectResponse,
  currentProjectBindingStatusResponse,
  selectCurrentProjectBindingResponse,
} = createRuntimeApiCurrentProjectBinding({
  repoRoot,
  sandboxRunRootRelativePath,
  knownProjectFixtureRoots,
  round5FullRealChainReportFileName,
  currentProjectBindingEndpoint,
  currentProjectSelectEndpoint,
  currentProjectRecentEndpoint,
  currentProjectBindingPathInput: () => process.env.VIBE_CORE_CURRENT_PROJECT_BINDING_PATH,
  currentProjectReportPathInput: () => process.env.VIBE_CORE_CURRENT_PROJECT_REPORT || process.env.VIBE_CORE_PROJECT_REPORT,
  resolveRepoInputPath,
  repoRelativePath,
  pathWithinRoot,
  runtimePolicy,
  normalizeRelativePath,
  readJsonIfPresent,
  existsSync,
  statSync,
  mkdirSync,
  writeFileSync,
});

function clip(value) {
  const text = String(value || "");
  if (text.length <= maxOutputChars) return text;
  return `${text.slice(0, maxOutputChars)}\n...[clipped ${text.length - maxOutputChars} chars]`;
}

function writeSecurityBlocked(res, security) {
  res.runtimeAllowedOrigin = security.origin && isTrustedLocalOrigin(security.origin) ? security.origin : undefined;
  writeJson(res, security.statusCode || 403, {
    ok: false,
    ...runtimePolicy(),
    status: "forbidden",
    message: security.message || "Runtime API request was blocked.",
  });
}

function observationSummary(item, fileScope) {
  const expectedOutputPath = typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined;
  return {
    order: item.order,
    shotId: item.shotId,
    expectedOutputPath,
    imageUrl: expectedOutputPath ? runtimeFileUrl(expectedOutputPath, fileScope) : undefined,
    previewQaStatus: item.previewQaStatus,
    productionQaStatus: item.productionQaStatus,
    reviewOverlay: item.reviewOverlay === true,
    runtimeTruthStatus: item.runtimeTruthStatus,
    blockers: Array.isArray(item.blockers) ? item.blockers : [],
  };
}

function readRuntimeJson(relativePath) {
  if (!relativePath) return undefined;
  try {
    return readJsonIfPresent(scopedRepoPath(relativePath));
  } catch {
    return undefined;
  }
}

const {
  round5ArtifactIngestSchemaVersion,
  round5EndFrameBlockers,
  round5ArtifactIsolationFlags,
  isRound5FullRealChainReport,
  round5QaStatusFor,
  round5EndRequiredFor,
  round5BboxValid,
  round5StrictEditEvidenceBlockers,
  round5StrictEditProviderObservationBlockers,
  round5ArtifactIngestFromReport,
} = createRuntimeApiRound5ArtifactIngest({
  existsSync,
  statSync,
  readJsonIfPresent,
  sha256File,
  normalizeRelativePath,
  round5FullRealChainReportFileName,
  round5StrictEditSidecarFileNames,
});

function round5StrictEditReturnRequestInput(url, body) {
  const payload = isRecord(body) ? body : {};
  return {
    shotId: asString(url.searchParams.get("shotId"))
      || requestBodyString(payload, ["shotId", "selectedShotId"])
      || "ZP05",
    returnedOutputPath: requestBodyString(payload, ["returnedOutputPath", "outputPath", "endFramePath"]),
    actualProviderReturned: payload.actualProviderReturned === true,
    providerObservation: isRecord(payload.providerObservation) ? payload.providerObservation : undefined,
    semanticQa: isRecord(payload.semanticQa) ? payload.semanticQa : undefined,
    returnedProviderObservationPath: requestBodyString(payload, ["returnedProviderObservationPath", "providerObservationPath"]),
    returnedSemanticQaPath: requestBodyString(payload, ["returnedSemanticQaPath", "semanticQaPath"]),
    providerRequestId: requestBodyString(payload, ["providerRequestId", "requestId"]),
    inputSha256: requestBodyString(payload, ["sha256", "startFrameSha256", "sourceStartFrameSha256"]),
  };
}

function round5StrictEditBlockedResponse(source, requestContext, input, blockers, extra = {}) {
  const project = source ? projectIdentityFromSource(source) : {};
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint: currentProjectRound5StrictEditPrepareEndpoint,
    status: "blocked",
    previewStatus: "blocked",
    productionStatus: "blocked",
    reportStatus: "blocked",
    currentProject: source
      ? {
        bound: true,
        bindingPath: source.bindingPathRelative,
        binding: source.binding,
      }
      : undefined,
    requestContext: {
      ...requestOverrideDiagnostics(requestContext),
    },
    projectRootMode: source?.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    project,
    shotId: input?.shotId,
    blockers: uniqueStrings(blockers),
    sidecarWrites: [],
    strictEditPreflightPrepareRan: false,
    message: "Round 5 strict edit preflight sidecars were not written.",
    ...extra,
  };
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
}

function asBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return undefined;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length))];
}

function image2BatchSubmitPolicy() {
  return {
    providerCallAllowed: false,
    dryRunOnly: true,
    manualSubmitRequired: true,
    liveSubmitAllowed: false,
    noSeedance: true,
    noJimeng: true,
    noVideo: true,
    noFast: true,
    noVip: true,
  };
}

function derivedShotPath(source, shotId, folder, suffix, ext) {
  return `${source.runRootRelativePath}/${folder}/${shotId}${suffix}.${ext}`;
}

function image2BatchPlanItem(source, observation, queueOrder, shotPlan = {}) {
  const shotId = observation.shotId || shotPlan.shotId || `shot_${queueOrder}`;
  const lowerShotId = String(shotId).toLowerCase();
  const blockers = Array.isArray(observation.blockers) ? observation.blockers : [];
  const packetPath = asString(shotPlan.packetPath) || derivedShotPath(source, shotId, "task_packets", "_start_frame_packet", "md");
  const envelopePath = asString(shotPlan.envelopePath) || derivedShotPath(source, shotId, "subagent_envelopes", "_start_frame_envelope", "json");
  const shotLayoutPath = derivedShotPath(source, shotId, "project/shot_layouts", "", "json");

  return {
    shotId,
    taskRunId: asString(shotPlan.taskRunId) || `task_run_${lowerShotId}_image2_batch_plan_check`,
    packetId: asString(shotPlan.taskPacketId) || asString(shotPlan.packetId) || `task_packet_${lowerShotId}_image2_batch_plan_check`,
    envelopeId: asString(shotPlan.envelopeId) || `subagent_envelope_${lowerShotId}_image2_batch_plan_check`,
    expectedOutputPath: asString(observation.expectedOutputPath) || asString(shotPlan.expectedOutputPath) || `${source.runRootRelativePath}/outputs/shots/${shotId}/start.png`,
    providerObservationPath: asString(shotPlan.providerObservationPath) || derivedShotPath(source, shotId, "provider_observations", "_start_provider_observation", "json"),
    semanticQaPath: asString(shotPlan.semanticQaPath) || derivedShotPath(source, shotId, "semantic_qa", "_start_semantic_qa", "json"),
    promptPath: asString(shotPlan.promptRequestPath) || asString(shotPlan.promptPath) || derivedShotPath(source, shotId, "prompt_requests", "_start_frame_prompt", "md"),
    referencePaths: uniqueStrings([
      source.projectVibeRelativePath,
      shotLayoutPath,
      `${source.runRootRelativePath}/project/source_index.json`,
      `${source.runRootRelativePath}/project/story_flow.json`,
      `${source.runRootRelativePath}/project/visual_memory.json`,
      packetPath,
      envelopePath,
      ...(Array.isArray(shotPlan.referencePaths) ? shotPlan.referencePaths : []),
    ]),
    queueOrder,
    blocked: blockers.length > 0,
    blockers,
    outputExists: observation.outputExists === true,
    providerObservationPresent: observation.providerObservationPresent === true,
    providerObservationActual: observation.providerObservationActual === true,
    providerOutputSha256: observation.providerOutputSha256,
    semanticQaPresent: observation.semanticQaPresent === true,
    semanticQaActual: observation.semanticQaActual === true,
    semanticQaStatus: observation.semanticQaStatus,
    semanticQaPassed: observation.semanticQaPassed === true,
    semanticQaNeedsReview: observation.semanticQaNeedsReview === true,
    previewStatus: observation.previewStatus,
    runtimeTruthStatus: observation.runtimeTruthStatus,
    reviewOverlay: observation.reviewOverlay === true,
  };
}

function image2BatchLedgerProjection(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const projections = items.map((item) => {
    const blocked = item.blocked === true || (Array.isArray(item.blockers) && item.blockers.length > 0);
    const completeVerified = !blocked && item.outputExists === true && item.providerObservationActual === true && item.semanticQaPassed === true;
    const reviewNeeded = !blocked && !completeVerified && (item.semanticQaNeedsReview === true || item.reviewOverlay === true);
    const currentStatus = blocked
      ? "parked"
      : completeVerified
        ? "complete_verified"
        : reviewNeeded
          ? "review_needed"
          : item.outputExists === true && item.providerObservationActual === true && item.semanticQaPresent !== true
            ? "qa_pending"
            : item.outputExists === true && item.providerObservationActual === true
              ? "provider_observed"
              : item.outputExists === true
                ? "output_detected_no_sidecar"
                : "queued";
    return {
      taskRunId: item.taskRunId,
      envelopeId: item.envelopeId,
      currentStatus,
      expectedOutputPath: item.expectedOutputPath,
      expectedOutputs: [
        {
          expectedOutputPath: item.expectedOutputPath,
          exists: item.outputExists === true,
          outputSha256: item.providerOutputSha256,
        },
      ],
      previewStatus: item.previewStatus || (item.outputExists ? "returned" : "missing"),
      completeVerified,
      providerObservationPresent: item.providerObservationPresent === true,
      providerObservationActual: item.providerObservationActual === true,
      semanticQaPresent: item.semanticQaPresent === true,
      semanticQaStatus: item.semanticQaStatus,
      reviewNeeded,
    };
  });
  const parked = projections.filter((item) => item.currentStatus === "parked").length;
  const completeVerified = projections.filter((item) => item.completeVerified === true).length;
  const reviewNeeded = projections.filter((item) => item.currentStatus === "review_needed").length;
  const queued = projections.filter((item) => item.currentStatus === "queued").length;

  return {
    schemaVersion: "vibe_core_current_project_image2_batch_ledger_projection_v1",
    projectId: payload.project?.projectId,
    runId: payload.project?.runId,
    ledgerTruthSource: payload.ledgerTruthSource,
    projectionSource: payload.projectionSource,
    factsUsed: payload.factsUsed,
    projections,
    summary: {
      total: projections.length,
      queued,
      blocked: parked,
      parked,
      reviewNeeded,
      completeVerified,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
  };
}

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

function oneShotReturnRequestInput(url, body) {
  const input = oneShotRequestInput(url, body);
  return {
    ...input,
    receiptId: asString(url.searchParams.get("receiptId")) || requestBodyString(body, ["receiptId"]),
    sourceImagePath: requestBodyString(body, ["sourceImagePath", "generatedImagePath", "providerOutputPath"]),
    actualProviderReturned: body?.actualProviderReturned === true,
    returnedOutputPath: requestBodyString(body, ["returnedOutputPath", "providerOutputPath", "actualOutputPath", "sourceImagePath", "generatedImagePath"]),
    returnedProviderObservationPath: requestBodyString(body, ["returnedProviderObservationPath", "actualProviderObservationPath"]),
    returnedSemanticQaPath: requestBodyString(body, ["returnedSemanticQaPath", "actualSemanticQaPath"]),
    providerObservation: isRecord(body?.providerObservation) ? body.providerObservation : undefined,
    semanticQa: isRecord(body?.semanticQa) ? body.semanticQa : undefined,
    provider: requestBodyString(body, ["provider"]) || "openai_image2_via_codex_imagegen",
    providerObservationMode: requestBodyString(body, ["providerObservationMode"]) || "actual_provider_call_observed",
    actualImage2Triggered: body?.actualImage2Triggered === true,
    providerCalled: body?.providerCalled === true,
    rawBody: isRecord(body) ? body : {},
  };
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  if (!candidatePath || !rootPath) return false;
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

const {
  providerObservationContextBlockers,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  readReturnedJson,
} = createRuntimeApiProviderReturnEvidence({
  runtimeRelativeFromValue,
  readRuntimeJson,
});

function firstHeaderValue(req, names) {
  for (const name of names) {
    const value = req.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      const firstValue = value.find((item) => typeof item === "string" && item.trim());
      if (firstValue) return firstValue.trim();
      continue;
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function requestBodyString(body, names) {
  if (!isRecord(body)) return undefined;
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const project = body.project;
  if (isRecord(project)) {
    for (const name of names) {
      const value = project[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function currentProjectRequestContext(req, url, body) {
  const queryProjectRoot = asString(url.searchParams.get("projectRoot")) || asString(url.searchParams.get("projectRootPath"));
  const headerProjectRoot = firstHeaderValue(req, ["x-vibe-project-root", "x-project-root"]);
  const bodyProjectRoot = requestBodyString(body, ["projectRoot", "projectRootPath"]);
  const queryProjectId = asString(url.searchParams.get("projectId"));
  const headerProjectId = firstHeaderValue(req, ["x-vibe-project-id", "x-project-id"]);
  const bodyProjectId = requestBodyString(body, ["projectId"]);
  const projectRoot = queryProjectRoot || headerProjectRoot || bodyProjectRoot;
  const projectId = queryProjectId || headerProjectId || bodyProjectId;

  return {
    projectRoot,
    projectRootSource: queryProjectRoot ? "query" : headerProjectRoot ? "header" : bodyProjectRoot ? "payload" : undefined,
    projectId,
    projectIdSource: queryProjectId ? "query" : headerProjectId ? "header" : bodyProjectId ? "payload" : undefined,
  };
}

const { runtimeFileUrl, serveRuntimeFile } = createRuntimeApiFileServing({
  runtimeFileEndpoint,
  scopedRepoPath,
  pathWithinRoot,
  contentTypeFor,
  corsHeaders,
  runtimePolicy,
  writeRuntimeFileError,
  currentProjectSourceResult,
  sourceForScope(scope) {
    if (scope === "real-demo-e2e-005") {
      try {
        return { source: realDemo005Source() };
      } catch (error) {
        return {
          error,
          message: error instanceof Error ? error.message : "Project root is unavailable.",
          unbound: error?.code === "CURRENT_PROJECT_UNBOUND",
          bindingState: error?.bindingState,
        };
      }
    }
    return currentProjectSourceResult();
  },
  createReadStream,
  existsSync,
  statSync,
  realpathSync,
});

const {
  projectProjectionFromSource,
  readProjectFacts,
  currentProjectWorkbenchFacts,
  semanticQaSummary,
} = createRuntimeApiWorkbenchProjection({
  repoRoot,
  round5FullRealChainReportFileName,
  existsSync,
  realpathSync,
  pathWithinRoot,
  isPathInsideRealRoot,
  repoRelativePath,
  normalizeRelativePath,
  runtimeRelativeFromValue,
  runtimePathExists,
  runtimeFileUrl,
  scopedRepoPath,
  readJsonIfPresent,
  projectIdentityFromSource,
});

const {
  currentProjectRealChainResponse,
  currentProjectRealChainRunCheckResponse,
} = createRuntimeApiCurrentProjectRealChainStatus({
  currentProjectSource,
  projectProjectionFromSource,
  readProjectFacts,
  currentProjectWorkbenchFacts,
  round5ArtifactIngestFromReport,
  runtimePolicy,
  runtimeFileUrl,
  existsSync,
  currentProjectStatusEndpoint,
});

const {
  oneShotRequestInput,
  oneShotPathInsideRoot,
  oneShotStatePaths,
  oneShotStateJson,
  inspectForRawCredentialMaterial,
  currentProjectImage2OneShotResponse,
  currentProjectImage2OneShotPrepareTriggerResponse,
} = createRuntimeApiCurrentProjectImage2Handoff({
  repoRoot,
  repoRootRealPath,
  currentProjectSource,
  projectProjectionFromSource,
  currentProjectWorkbenchFacts,
  runtimePolicy,
  runtimeFileUrl,
  scopedRepoPath,
  readRuntimeJson,
  runtimePathExists,
  runtimeRelativeFromValue,
  normalizeRelativePath,
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2TransportModes,
  currentProjectImage2ForbiddenProviders,
  normalizeCurrentProjectImage2TransportMode,
  currentProjectImage2OneShotStatusEndpoint,
  currentProjectImage2OneShotPrepareEndpoint,
  currentProjectImage2OneShotConfirmEndpoint,
  currentProjectImage2OneShotPrepareTriggerEndpoint,
  semanticQaSummary,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  sha256File,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
  readFileSync,
});

const {
  oneShotExecutorPathInsideSandbox,
  assertOneShotExecutorSandboxWritePath,
  writeOneShotExecutorJson,
  writeOneShotExecutorBytes,
  assertCurrentProjectRuntimeWritePath,
  writeCurrentProjectRuntimeJson,
  writeCurrentProjectRuntimeBytes,
} = createRuntimeApiCurrentProjectReturnWriters({
  repoRootRealPath,
  scopedRepoPath,
  normalizeRelativePath,
  oneShotPathInsideRoot,
  isPathInsideRealRoot,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
});

const oneShotExecutorApi = createRuntimeApiCurrentProjectOneShotExecutor({
  currentProjectSource,
  currentProjectImage2OneShotResponse,
  oneShotRequestInput,
  oneShotStateJson,
  oneShotPathInsideRoot,
  inspectForRawCredentialMaterial,
  oneShotExecutorPathInsideSandbox,
  writeOneShotExecutorBytes,
  writeOneShotExecutorJson,
  normalizeRelativePath,
  runtimePathExists,
  runtimePolicy,
  runtimeFileUrl,
  sha256File,
  currentProjectImage2OneShotExecuteMockEndpoint,
});

const {
  currentProjectOneShotReturnProjection,
  currentProjectImage2OneShotReturnIngestResponse,
} = createRuntimeApiCurrentProjectOneShotReturn({
  currentProjectSource,
  currentProjectImage2OneShotResponse,
  oneShotStateJson,
  oneShotExecutorContract: oneShotExecutorApi.oneShotExecutorContract,
  readReturnedJson,
  readRuntimeJson,
  runtimeRelativeFromValue,
  runtimePathExists,
  oneShotPathInsideRoot,
  scopedRepoPath,
  readFileSync,
  sha256Bytes,
  sha256File,
  writeOneShotExecutorBytes,
  writeOneShotExecutorJson,
  writeCurrentProjectRuntimeJson,
  providerObservationContextBlockers,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  runtimePolicy,
  runtimeFileUrl,
  currentProjectImage2OneShotExecuteReturnEndpoint,
});

const round5StrictEditPrepareApi = createRuntimeApiCurrentProjectRound5StrictEditPrepare({
  currentProjectSource,
  readJsonIfPresent,
  isRound5FullRealChainReport,
  round5QaStatusFor,
  round5EndRequiredFor,
  round5BboxValid,
  round5StrictEditSidecarFileNames,
  round5StrictEditBlockedResponse,
  currentProjectRealChainResponse,
  projectIdentityFromSource,
  requestOverrideDiagnostics,
  runtimePolicy,
  normalizeRelativePath,
  oneShotPathInsideRoot,
  scopedRepoPath,
  existsSync,
  statSync,
  realpathSync,
  isPathInsideRealRoot,
  readFileSync,
  writeCurrentProjectRuntimeJson,
  repoRelativePath,
  currentProjectRound5StrictEditPrepareEndpoint,
});

const {
  currentProjectRound5StrictEditReturnResponse,
} = createRuntimeApiCurrentProjectRound5StrictEditReturn({
  currentProjectSource,
  readJsonIfPresent,
  isRound5FullRealChainReport,
  round5QaStatusFor,
  round5EndRequiredFor,
  round5StrictEditSidecarFileNames,
  round5StrictEditEvidenceBlockers,
  round5StrictEditProviderObservationBlockers,
  round5StrictEditBlockedResponse,
  currentProjectRealChainResponse,
  projectIdentityFromSource,
  requestOverrideDiagnostics,
  runtimePolicy,
  readRuntimeJson,
  runtimeRelativeFromValue,
  runtimePathExists,
  oneShotPathInsideRoot,
  scopedRepoPath,
  readFileSync,
  sha256Bytes,
  writeCurrentProjectRuntimeBytes,
  writeCurrentProjectRuntimeJson,
  currentProjectRound5StrictEditReturnEndpoint,
});

function unavailableResponse(extra = {}) {
  const source = extra.sourceProject || realDemo005Source();
  const fileScope = source.sandboxSource === "005 sandbox" ? "real-demo-e2e-005" : undefined;
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint: realDemo005StatusEndpoint,
    status: "unavailable",
    previewStatus: "unavailable",
    productionStatus: "unavailable",
    reportPath: source.reportPath,
    reportRelativePath: source.reportRelativePath,
    reportUrl: runtimeFileUrl(source.reportRelativePath, fileScope),
    reviewOverlayShots: [],
    productionNeedsReviewShots: [],
    shotCount: 0,
    blockerCount: 0,
    observations: [],
    message: "005 report is unavailable. The runtime API can only verify an existing prepared report and output set.",
    ...extra,
    sourceProject: undefined,
  };
}

function responseFromReport(extra = {}, source = realDemo005Source()) {
  if (!existsSync(source.reportPath)) return unavailableResponse({ ...extra, sourceProject: source });

  try {
    const report = readJson(source.reportPath);
    const observations = Array.isArray(report.observations)
      ? report.observations.map((item) => observationSummary(item, "real-demo-e2e-005"))
      : [];

    return {
      ok: true,
      ...runtimePolicy(),
      endpoint: realDemo005StatusEndpoint,
      status: report.status || "unavailable",
      previewStatus: report.previewStatus || report.status || "unavailable",
      productionStatus: report.productionStatus || "unavailable",
      reportPath: source.reportPath,
      reportRelativePath: source.reportRelativePath,
      reportUrl: runtimeFileUrl(source.reportRelativePath, "real-demo-e2e-005"),
      reviewOverlayShots: Array.isArray(report.reviewOverlayShots) ? report.reviewOverlayShots : [],
      productionNeedsReviewShots: Array.isArray(report.productionNeedsReviewShots) ? report.productionNeedsReviewShots : [],
      shotCount: report.shotCount || observations.length,
      blockerCount: Array.isArray(report.blockers) ? report.blockers.length : 0,
      observations,
      report,
      ...extra,
    };
  } catch (error) {
    return unavailableResponse({
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      message: error instanceof Error ? error.message : "005 report could not be parsed.",
      ...extra,
      sourceProject: source,
    });
  }
}

function currentProjectImage2BatchPlanResponse(extra = {}, source = currentProjectSource()) {
  const projection = projectProjectionFromSource(source);
  const { project, projectFacts } = projection;
  const selectedObservations = projection.observations.slice(0, 10);
  const shotPlans = Array.isArray(projectFacts.runManifest?.shotPlans) ? projectFacts.runManifest.shotPlans : [];
  const items = selectedObservations.map((observation, index) => {
    const shotPlan = shotPlans.find((item) => item?.shotId === observation.shotId) || observation.shotPlan || {};
    return image2BatchPlanItem(source, observation, index + 1, shotPlan);
  });
  const blockedItems = items.filter((item) => item.blocked);
  const primaryReportRelativePath = projectFacts.primaryReportRelativePath;
  const payload = {
    ok: projection.ok,
    ...runtimePolicy({
      runMode: "read_only_image2_batch_plan_projection",
      verifyScriptRan: false,
      liveSubmitAllowed: false,
    }),
    endpoint: currentProjectImage2BatchPlanEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    sandboxSource: source.sandboxSource,
    currentProject: {
      bound: true,
      bindingPath: source.bindingPathRelative,
      binding: source.binding,
    },
    requestContext: {
      projectRoot: source.requestProjectRoot,
      projectRootSource: source.requestContextSource,
      projectId: source.requestProjectId,
      projectIdSource: source.requestProjectIdSource,
    },
    projectionKind: "current_project_image2_batch_prepare_plan",
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    identity: {
      projectId: project.projectId,
      projectRoot: project.projectRoot,
    },
    projectRootRelativePath: source.runRootRelativePath,
    projectVibeRelativePath: source.projectVibeRelativePath,
    sourceIndexRelativePath: source.sourceIndexRelativePath,
    runManifestRelativePath: source.runManifestRelativePath,
    projectionSource: projectFacts.projectionSource,
    ledgerTruthSource: projectFacts.ledgerTruthSource,
    factsUsed: projectFacts.factsUsed,
    project,
    status: projection.ok ? projection.status : "unavailable",
    previewStatus: projection.ok ? projection.previewStatus : "unavailable",
    productionStatus: projection.ok ? projection.productionStatus : "unavailable",
    reportStatus: projection.ok ? projection.status : "unavailable",
    reportPath: primaryReportRelativePath,
    reportRelativePath: primaryReportRelativePath,
    reportUrl: runtimeFileUrl(primaryReportRelativePath),
    image2ReportPath: source.reportRelativePath,
    image2ReportRelativePath: source.reportRelativePath,
    runtimeTruthLayerPath: source.runtimeTruthLayerRelativePath,
    previewPlanPath: source.previewPlanRelativePath,
    observations: selectedObservations,
    submitPolicy: image2BatchSubmitPolicy(),
    plan: {
      mode: "read_only_image2_batch_prepare_check_projection",
      sourceObservationLimit: 10,
      items,
    },
    items,
    summary: {
      plannedCount: items.length,
      readyCount: items.length - blockedItems.length,
      blockedCount: blockedItems.length,
      returnedCount: selectedObservations.filter((item) => item.returned).length,
      reviewCount: selectedObservations.filter((item) => item.reviewOverlay || item.semanticQaNeedsReview).length,
      selectedShotIds: items.map((item) => item.shotId),
      nextAction: blockedItems.length
        ? "resolve_blockers_before_manual_image2_batch_prepare"
        : "manual_review_projection_before_any_prepare_or_provider_submit",
    },
    providerCalled: false,
    prepareRan: false,
    verifyScriptRan: false,
    liveSubmitAllowed: false,
    ...extra,
  };
  return {
    ...payload,
    ledgerProjection: image2BatchLedgerProjection(payload),
  };
}

function writeJson(res, statusCode, payload) {
  if (statusCode === 204) {
    res.writeHead(204, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
    res.end();
    return;
  }
  res.writeHead(statusCode, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function runVerify() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [verifyScript], {
      cwd: repoRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.stack || error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function handleRun(res, options = {}) {
  const endpoint = options.endpoint || realDemo005RunEndpoint;
  const source = options.source || realDemo005Source();
  const buildResponse = options.buildResponse || ((extra) => responseFromReport(extra, source));
  if (running) {
    writeJson(res, 409, buildResponse({
      ok: false,
      endpoint,
      status: "running",
      running: true,
      message: "Real chain verification is already running.",
    }));
    return;
  }

  running = true;
  try {
    const command = await runVerify();
    const payload = buildResponse({
      ok: command.code === 0,
      endpoint,
      running: false,
      command: {
        command: `${process.execPath} ${path.relative(repoRoot, verifyScript)}`,
        exitCode: command.code,
        stdout: clip(command.stdout),
        stderr: clip(command.stderr),
        providerCalled: false,
        prepareRan: false,
      },
    });
    writeJson(res, command.code === 0 ? 200 : 500, payload);
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      reportPath: source.reportPath,
      reportRelativePath: source.reportRelativePath,
      reportUrl: runtimeFileUrl(source.reportRelativePath),
      message: error instanceof Error ? error.message : "Unknown run failure.",
    });
  } finally {
    running = false;
  }
}

function handleCurrentProjectImage2BatchRunCheck(res, source, extra = {}) {
  const projectFacts = readProjectFacts(source);
  const payload = currentProjectImage2BatchPlanResponse({
    ...extra,
    running,
    command: {
      mode: "read_only_image2_batch_plan_check",
      exitCode: projectFacts.projectionAvailable ? 0 : 1,
      reportRead: projectFacts.projectionAvailable,
      projectionSource: projectFacts.projectionSource,
      ledgerTruthSource: projectFacts.ledgerTruthSource,
      projectVibeRead: existsSync(source.projectVibePath),
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      verifyScriptRan: false,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      noFileMutation: true,
      workerSpawnForbidden: true,
    },
  }, source);
  writeJson(res, payload.ok === false ? 500 : 200, payload);
}

function readRequestJsonBody(req) {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (chunk) => {
      text += chunk.toString();
      if (text.length > 1024 * 1024) {
        req.destroy(new Error("Request body is too large."));
      }
    });
    req.on("error", (error) => {
      resolve({ ok: false, message: error instanceof Error ? error.message : "Request body could not be read." });
    });
    req.on("end", () => {
      const trimmed = text.trim();
      if (!trimmed) {
        resolve({ ok: true, body: undefined });
        return;
      }
      try {
        const body = JSON.parse(trimmed);
        resolve({ ok: true, body });
      } catch {
        resolve({ ok: false, message: "Request body must be valid JSON." });
      }
    });
  });
}

function isCurrentProjectEndpoint(pathname) {
  return pathname === currentProjectBindingEndpoint
    || pathname === currentProjectSelectEndpoint
    || pathname === currentProjectRecentEndpoint
    || pathname === currentProjectStatusEndpoint
    || pathname === currentProjectRunEndpoint
    || pathname === currentProjectImage2BatchPlanEndpoint
    || pathname === currentProjectImage2BatchRunCheckEndpoint
    || pathname === currentProjectImage2OneShotStatusEndpoint
    || pathname === currentProjectImage2OneShotPrepareEndpoint
    || pathname === currentProjectImage2OneShotConfirmEndpoint
    || pathname === currentProjectImage2OneShotPrepareTriggerEndpoint
    || pathname === currentProjectImage2OneShotExecuteMockEndpoint
    || pathname === currentProjectImage2OneShotReturnEndpoint
    || pathname === currentProjectImage2OneShotExecuteReturnEndpoint
    || pathname === currentProjectRound5StrictEditPrepareEndpoint
    || pathname === currentProjectRound5StrictEditReturnEndpoint;
}

async function currentProjectRouteContext(req, res, url, endpoint) {
  const bodyResult = req.method === "POST"
    ? await readRequestJsonBody(req)
    : { ok: true, body: undefined };
  if (!bodyResult.ok) {
    writeJson(res, 400, blockedCurrentProjectResponse(endpoint, {}, {
      status: "bad_request",
      previewStatus: "bad_request",
      productionStatus: "bad_request",
      message: bodyResult.message,
    }));
    return undefined;
  }

  const requestContext = currentProjectRequestContext(req, url, bodyResult.body);
  const sourceResult = currentProjectSourceResult();
  if (sourceResult.error) {
    if (sourceResult.unbound) {
      writeJson(res, 409, unboundCurrentProjectResponse(endpoint, requestContext));
      return undefined;
    }
    writeJson(res, 403, blockedCurrentProjectResponse(endpoint, requestContext, {
      message: sourceResult.message,
    }));
    return undefined;
  }
  return { requestContext, source: sourceResult.source, body: bodyResult.body };
}

async function handleCurrentProjectSelect(req, res) {
  const bodyResult = await readRequestJsonBody(req);
  if (!bodyResult.ok) {
    writeJson(res, 400, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectSelectEndpoint,
      status: "bad_request",
      message: bodyResult.message,
    });
    return;
  }
  const { statusCode, payload } = selectCurrentProjectBindingResponse(bodyResult.body);
  writeJson(res, statusCode, payload);
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${host}`);
  const security = runtimeRequestSecurity(req);
  if (!security.ok) {
    writeSecurityBlocked(res, security);
    return;
  }
  res.runtimeAllowedOrigin = security.origin || undefined;
  if (req.method === "OPTIONS") {
    writeJson(res, 204, {});
    return;
  }
  if (req.method === "GET" && url.pathname === `${runtimeBasePath}/status`) {
    writeJson(res, 200, {
      ok: true,
    ...runtimePolicy({
      endpoints: {
        currentProjectStatusEndpoint,
        currentProjectBindingEndpoint,
        currentProjectSelectEndpoint,
        currentProjectRecentEndpoint,
        currentProjectRunEndpoint,
        currentProjectImage2BatchPlanEndpoint,
        currentProjectImage2BatchRunCheckEndpoint,
        currentProjectImage2OneShotStatusEndpoint,
        currentProjectImage2OneShotPrepareEndpoint,
        currentProjectImage2OneShotConfirmEndpoint,
        currentProjectImage2OneShotPrepareTriggerEndpoint,
        currentProjectImage2OneShotExecuteMockEndpoint,
        currentProjectImage2OneShotReturnEndpoint,
        currentProjectImage2OneShotExecuteReturnEndpoint,
        currentProjectRound5StrictEditPrepareEndpoint,
        currentProjectRound5StrictEditReturnEndpoint,
          realDemo005StatusEndpoint,
          realDemo005RunEndpoint,
          runtimeFileEndpoint,
        },
      }),
      running,
    });
    return;
  }
  if (req.method === "GET" && url.pathname === runtimeFileEndpoint) {
    serveRuntimeFile(req, res, url.searchParams.get("path") || "", { scope: url.searchParams.get("scope") || undefined });
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectBindingEndpoint) {
    writeJson(res, 200, currentProjectBindingStatusResponse({ running }));
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectRecentEndpoint) {
    writeJson(res, 200, currentProjectRecentResponse({ running }));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectSelectEndpoint) {
    await handleCurrentProjectSelect(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectStatusEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectStatusEndpoint);
    if (!routeContext) return;
    writeJson(res, 200, currentProjectRealChainResponse({
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRunEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRunEndpoint);
    if (!routeContext) return;
    const payload = currentProjectRealChainRunCheckResponse({
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 500 : 200, payload);
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectImage2BatchPlanEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2BatchPlanEndpoint);
    if (!routeContext) return;
    writeJson(res, 200, currentProjectImage2BatchPlanResponse({
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2BatchRunCheckEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2BatchRunCheckEndpoint);
    if (!routeContext) return;
    handleCurrentProjectImage2BatchRunCheck(res, routeContext.source, {
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectImage2OneShotStatusEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotStatusEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotResponse("status", input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotPrepareEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotPrepareEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotResponse("prepare", input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotConfirmEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotConfirmEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotResponse("confirm", input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotPrepareTriggerEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotPrepareTriggerEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotPrepareTriggerResponse(input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotExecuteMockEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotExecuteMockEndpoint);
    if (!routeContext) return;
    const input = oneShotExecutorApi.oneShotExecutorRequestInput(url, routeContext.body);
    const payload = oneShotExecutorApi.currentProjectImage2OneShotExecutorResponse(input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && (url.pathname === currentProjectImage2OneShotReturnEndpoint || url.pathname === currentProjectImage2OneShotExecuteReturnEndpoint)) {
    const routeContext = await currentProjectRouteContext(req, res, url, url.pathname);
    if (!routeContext) return;
    const input = oneShotReturnRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotReturnIngestResponse(input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRound5StrictEditPrepareEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRound5StrictEditPrepareEndpoint);
    if (!routeContext) return;
    const input = round5StrictEditPrepareApi.round5StrictEditRequestInput(url, routeContext.body);
    const payload = round5StrictEditPrepareApi.currentProjectRound5StrictEditPrepareResponse(input, {
      running,
      requestContext: routeContext.requestContext,
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRound5StrictEditReturnEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRound5StrictEditReturnEndpoint);
    if (!routeContext) return;
    const input = round5StrictEditReturnRequestInput(url, routeContext.body);
    const payload = currentProjectRound5StrictEditReturnResponse(input, {
      running,
      requestContext: routeContext.requestContext,
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "GET" && (url.pathname === realDemo005StatusEndpoint || url.pathname === legacyStatusEndpoint)) {
    writeJson(res, 200, responseFromReport({ running }));
    return;
  }
  if (req.method === "POST" && (url.pathname === realDemo005RunEndpoint || url.pathname === legacyRunEndpoint)) {
    if (process.env.VIBE_CORE_ENABLE_LEGACY_RUN !== "1") {
      writeJson(res, 403, {
        ok: false,
        ...runtimePolicy(),
        endpoint: url.pathname,
        status: "disabled",
        previewStatus: "blocked",
        productionStatus: "blocked",
        running: false,
        command: {
          providerCalled: false,
          prepareRan: false,
          verifyScriptRan: false,
        },
        message: "Legacy 005 run endpoint is disabled. Set VIBE_CORE_ENABLE_LEGACY_RUN=1 for diagnostics-only use.",
      });
      return;
    }
    void handleRun(res, { endpoint: url.pathname });
    return;
  }
  writeJson(res, 404, { ok: false, ...runtimePolicy(), status: "not_found", path: url.pathname });
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}`);
  void handleRequest(req, res).catch((error) => {
    const endpoint = isCurrentProjectEndpoint(url.pathname) ? url.pathname : undefined;
    writeJson(res, 500, {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      message: error instanceof Error ? error.message : "Runtime API request failed.",
    });
  });
});

server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(JSON.stringify({
    event: "vibe-core-runtime-api-listening",
    host,
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
    basePath: runtimeBasePath,
  }));
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
