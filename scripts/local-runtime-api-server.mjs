import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
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
import { createRuntimeApiCurrentProjectBindingRoutes } from "./runtime-api-current-project-binding-routes.mjs";
import { createCurrentProjectRouteContext, isCurrentProjectEndpoint } from "./runtime-api-current-project-route-context.mjs";
import { createRuntimeApiCurrentProjectImage2Handoff } from "./runtime-api-current-project-image2-handoff.mjs";
import { createRuntimeApiCurrentProjectImage2BatchPlan } from "./runtime-api-current-project-image2-batch-plan.mjs";
import { createRuntimeApiCurrentProjectOneShotExecutor } from "./runtime-api-current-project-one-shot-executor.mjs";
import { createRuntimeApiCurrentProjectOneShotReturn } from "./runtime-api-current-project-one-shot-return.mjs";
import { createRuntimeApiCurrentProjectOneShotReturnRoutes } from "./runtime-api-current-project-one-shot-return-routes.mjs";
import { createRuntimeApiCurrentProjectOneShotRoutes } from "./runtime-api-current-project-one-shot-routes.mjs";
import { createRuntimeApiCurrentProjectReadCheckRoutes } from "./runtime-api-current-project-read-check-routes.mjs";
import { createRuntimeApiCurrentProjectRealChainStatus } from "./runtime-api-current-project-real-chain-status.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditPrepare } from "./runtime-api-current-project-round5-strict-edit-prepare.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditPrepareRoutes } from "./runtime-api-current-project-round5-strict-edit-prepare-routes.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditReturn } from "./runtime-api-current-project-round5-strict-edit-return.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditReturnRoutes } from "./runtime-api-current-project-round5-strict-edit-return-routes.mjs";
import { createRuntimeApiCurrentProjectReturnWriters } from "./runtime-api-current-project-return-writers.mjs";
import { createRuntimeApiFileServing } from "./runtime-api-file-serving.mjs";
import { createRuntimeApiProviderReturnEvidence } from "./runtime-api-provider-return-evidence.mjs";
import { readRequestJsonBody } from "./runtime-api-request-body.mjs";
import { createRuntimeApiEndpoints } from "./runtime-api-endpoints.mjs";
import { createRuntimeApiRealDemo005Runner } from "./runtime-api-real-demo-005-runner.mjs";
import { createRuntimeApiRealDemo005Routes } from "./runtime-api-real-demo-005-routes.mjs";
import { createRuntimeApiRound5ArtifactIngest } from "./runtime-api-round5-artifact-ingest.mjs";
import { createRuntimeApiStatusRoute } from "./runtime-api-status-route.mjs";
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
const round5FullRealChainReportFileName = "round5_full_real_chain_report.json";
const round5StrictEditSidecarFileNames = {
  approvedStartFrame: "approved_start_frame_ref.json",
  editableRegionEvidence: "editable_region_mask_or_bbox.json",
  providerEditReceipt: "provider_edit_receipt.json",
  endProviderObservation: "end_provider_observation.json",
  endSemanticQa: "end_semantic_qa.json",
  endPairQa: "end_pair_qa.json",
};

const {
  runtimeBasePath,
  runtimeStatusEndpoint,
  currentProjectBindingEndpoint,
  currentProjectSelectEndpoint,
  currentProjectRecentEndpoint,
  currentProjectStatusEndpoint,
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
  legacyStatusEndpoint,
  legacyRunEndpoint,
  currentProjectEndpoints,
  runtimeStatusEndpoints,
  realDemo005Endpoints,
} = createRuntimeApiEndpoints();
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

function writeSecurityBlocked(res, security) {
  res.runtimeAllowedOrigin = security.origin && isTrustedLocalOrigin(security.origin) ? security.origin : undefined;
  writeJson(res, security.statusCode || 403, {
    ok: false,
    ...runtimePolicy(),
    status: "forbidden",
    message: security.message || "Runtime API request was blocked.",
  });
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

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
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

const currentProjectRouteContext = createCurrentProjectRouteContext({
  readRequestJsonBody,
  currentProjectRequestContext,
  currentProjectSourceResult,
  writeJson,
  blockedCurrentProjectResponse,
  unboundCurrentProjectResponse,
});

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
  currentProjectImage2BatchPlanResponse,
  currentProjectImage2BatchRunCheckResponse,
} = createRuntimeApiCurrentProjectImage2BatchPlan({
  currentProjectSource,
  projectProjectionFromSource,
  readProjectFacts,
  runtimePolicy,
  runtimeFileUrl,
  existsSync,
  currentProjectImage2BatchPlanEndpoint,
});

const {
  handleCurrentProjectBindingRoute,
} = createRuntimeApiCurrentProjectBindingRoutes({
  currentProjectBindingEndpoint,
  currentProjectRecentEndpoint,
  currentProjectSelectEndpoint,
  readRequestJsonBody,
  writeJson,
  runtimePolicy,
  currentProjectBindingStatusResponse,
  currentProjectRecentResponse,
  selectCurrentProjectBindingResponse,
  running: () => running,
});

const {
  handleCurrentProjectReadCheckRoute,
} = createRuntimeApiCurrentProjectReadCheckRoutes({
  currentProjectStatusEndpoint,
  currentProjectRunEndpoint,
  currentProjectImage2BatchPlanEndpoint,
  currentProjectImage2BatchRunCheckEndpoint,
  currentProjectRouteContext,
  writeJson,
  requestOverrideDiagnostics,
  currentProjectRealChainResponse,
  currentProjectRealChainRunCheckResponse,
  currentProjectImage2BatchPlanResponse,
  currentProjectImage2BatchRunCheckResponse,
  running: () => running,
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
  handleCurrentProjectOneShotRoute,
} = createRuntimeApiCurrentProjectOneShotRoutes({
  currentProjectImage2OneShotStatusEndpoint,
  currentProjectImage2OneShotPrepareEndpoint,
  currentProjectImage2OneShotConfirmEndpoint,
  currentProjectImage2OneShotPrepareTriggerEndpoint,
  currentProjectImage2OneShotExecuteMockEndpoint,
  currentProjectRouteContext,
  writeJson,
  requestOverrideDiagnostics,
  oneShotRequestInput,
  currentProjectImage2OneShotResponse,
  currentProjectImage2OneShotPrepareTriggerResponse,
  oneShotExecutorRequestInput: oneShotExecutorApi.oneShotExecutorRequestInput,
  currentProjectImage2OneShotExecutorResponse: oneShotExecutorApi.currentProjectImage2OneShotExecutorResponse,
  running: () => running,
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

const {
  handleCurrentProjectOneShotReturnRoute,
} = createRuntimeApiCurrentProjectOneShotReturnRoutes({
  currentProjectImage2OneShotReturnEndpoint,
  currentProjectImage2OneShotExecuteReturnEndpoint,
  currentProjectRouteContext,
  writeJson,
  requestOverrideDiagnostics,
  currentProjectImage2OneShotReturnIngestResponse,
  running: () => running,
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
  handleCurrentProjectRound5StrictEditPrepareRoute,
} = createRuntimeApiCurrentProjectRound5StrictEditPrepareRoutes({
  currentProjectRound5StrictEditPrepareEndpoint,
  currentProjectRouteContext,
  writeJson,
  round5StrictEditRequestInput: round5StrictEditPrepareApi.round5StrictEditRequestInput,
  currentProjectRound5StrictEditPrepareResponse: round5StrictEditPrepareApi.currentProjectRound5StrictEditPrepareResponse,
  running: () => running,
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

const {
  handleCurrentProjectRound5StrictEditReturnRoute,
} = createRuntimeApiCurrentProjectRound5StrictEditReturnRoutes({
  currentProjectRound5StrictEditReturnEndpoint,
  currentProjectRouteContext,
  writeJson,
  currentProjectRound5StrictEditReturnResponse,
  running: () => running,
});

function writeJson(res, statusCode, payload) {
  if (statusCode === 204) {
    res.writeHead(204, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
    res.end();
    return;
  }
  res.writeHead(statusCode, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

const {
  responseFromReport,
  handleRun,
} = createRuntimeApiRealDemo005Runner({
  endpoints: realDemo005Endpoints,
  existsSync,
  readJson,
  realDemo005Source,
  repoRoot,
  runtimeFileUrl,
  runtimePolicy,
  setRunning: (value) => {
    running = value;
  },
  verifyScript,
  writeJson,
  running: () => running,
});

const {
  handleRuntimeApiRealDemo005Route,
} = createRuntimeApiRealDemo005Routes({
  endpoints: realDemo005Endpoints,
  writeJson,
  responseFromReport,
  handleRun,
  runtimePolicy,
  readLegacyRunEnabled: () => process.env.VIBE_CORE_ENABLE_LEGACY_RUN === "1",
  running: () => running,
});

const {
  handleRuntimeApiStatusRoute,
} = createRuntimeApiStatusRoute({
  statusEndpoint: runtimeStatusEndpoint,
  endpoints: runtimeStatusEndpoints,
  writeJson,
  runtimePolicy,
  running: () => running,
});

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
  if (handleRuntimeApiStatusRoute(req, res, url)) return;
  if (req.method === "GET" && url.pathname === runtimeFileEndpoint) {
    serveRuntimeFile(req, res, url.searchParams.get("path") || "", { scope: url.searchParams.get("scope") || undefined });
    return;
  }
  if (await handleCurrentProjectBindingRoute(req, res, url)) return;
  if (await handleCurrentProjectReadCheckRoute(req, res, url)) return;
  if (await handleCurrentProjectOneShotRoute(req, res, url)) return;
  if (await handleCurrentProjectOneShotReturnRoute(req, res, url)) return;
  if (await handleCurrentProjectRound5StrictEditPrepareRoute(req, res, url)) return;
  if (await handleCurrentProjectRound5StrictEditReturnRoute(req, res, url)) return;
  if (handleRuntimeApiRealDemo005Route(req, res, url)) return;
  writeJson(res, 404, { ok: false, ...runtimePolicy(), status: "not_found", path: url.pathname });
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}`);
  void handleRequest(req, res).catch((error) => {
    const endpoint = isCurrentProjectEndpoint(url.pathname, currentProjectEndpoints) ? url.pathname : undefined;
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
