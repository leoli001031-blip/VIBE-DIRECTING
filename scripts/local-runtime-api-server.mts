import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllCredentials, getProviderConfigStatuses, getProviderApiKey, setProviderCredential, removeProviderCredential, getMaskedKey } from "./runtime-api-credentials.mts";
import {
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2ForbiddenProviders,
  currentProjectImage2TransportModes,
  normalizeCurrentProjectImage2TransportMode,
} from "./current-project-image2-transport-contract.mts";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mts";
import { createRuntimeApiCurrentProjectBinding } from "./runtime-api-current-project-binding.mts";
import { createRuntimeApiCurrentProjectBindingRoutes } from "./runtime-api-current-project-binding-routes.mts";
import { createCurrentProjectRouteContext, isCurrentProjectEndpoint } from "./runtime-api-current-project-route-context.mts";
import { createRuntimeApiCurrentProjectAssetStatus } from "./runtime-api-current-project-asset-status.mts";
import { createRuntimeApiCurrentProjectImage2AssetGenerate } from "./runtime-api-current-project-image2-assets-generate.mts";
import { createRuntimeApiCurrentProjectImage2EndFrameSubmit } from "./runtime-api-current-project-image2-end-frame-submit.mts";
import { createRuntimeApiCurrentProjectImage2Handoff } from "./runtime-api-current-project-image2-handoff.mts";
import { createRuntimeApiCurrentProjectImage2BatchPlan } from "./runtime-api-current-project-image2-batch-plan.mts";
import { createRuntimeApiCurrentProjectOneShotExecutor } from "./runtime-api-current-project-one-shot-executor.mts";
import { createRuntimeApiCurrentProjectOneShotReturn } from "./runtime-api-current-project-one-shot-return.mts";
import { createRuntimeApiCurrentProjectOneShotReturnRoutes } from "./runtime-api-current-project-one-shot-return-routes.mts";
import { createRuntimeApiCurrentProjectOneShotRoutes } from "./runtime-api-current-project-one-shot-routes.mts";
import { createRuntimeApiCurrentProjectP6RealImage2Routes } from "./runtime-api-current-project-p6-real-image2-routes.mts";
import { createRuntimeApiCurrentProjectReadCheckRoutes } from "./runtime-api-current-project-read-check-routes.mts";
import { createRuntimeApiCurrentProjectRealChainStatus } from "./runtime-api-current-project-real-chain-status.mts";
import { createRuntimeApiCurrentProjectReviewDecision } from "./runtime-api-current-project-review-decision.mts";
import { createRuntimeApiCurrentProjectRound5StrictEditPrepare } from "./runtime-api-current-project-round5-strict-edit-prepare.mts";
import { createRuntimeApiCurrentProjectRound5StrictEditPrepareRoutes } from "./runtime-api-current-project-round5-strict-edit-prepare-routes.mts";
import { createRuntimeApiCurrentProjectRound5StrictEditReturn } from "./runtime-api-current-project-round5-strict-edit-return.mts";
import { createRuntimeApiCurrentProjectRound5StrictEditReturnRoutes } from "./runtime-api-current-project-round5-strict-edit-return-routes.mts";
import { createRuntimeApiCurrentProjectReturnWriters } from "./runtime-api-current-project-return-writers.mts";
import { createRuntimeApiFileServing } from "./runtime-api-file-serving.mts";
import { createRuntimeApiProviderReturnEvidence } from "./runtime-api-provider-return-evidence.mts";
import { readRequestJsonBody } from "./runtime-api-request-body.mts";
import { createRuntimeApiEndpoints } from "./runtime-api-endpoints.mts";
import { createRuntimeApiRealDemo005Runner } from "./runtime-api-real-demo-005-runner.mts";
import { createRuntimeApiRealDemo005Routes } from "./runtime-api-real-demo-005-routes.mts";
import { createRuntimeApiRound5ArtifactIngest } from "./runtime-api-round5-artifact-ingest.mts";
import { createRuntimeApiWorkbenchProjection } from "./runtime-api-workbench-projection.mts";
import { createRuntimeApiCredentialsRoute } from "./runtime-routes/credentials.mts";
import { createRuntimeApiAgentWebSearchRoute } from "./runtime-routes/agent-web-search.mts";
import { createRuntimeApiCurrentProjectSeedanceSubmit } from "./runtime-routes/current-project-seedance-submit.mts";
import { createRuntimeApiDirectorStoryboardPlanRoute } from "./runtime-routes/director-storyboard-plan.mts";
import { createRuntimeApiDirectorTextQaRoute } from "./runtime-routes/director-text-qa.mts";
import { createRuntimeApiLocalIndexTtsRoute } from "./runtime-routes/local-index-tts.mts";
import { createRuntimeApiLocalQwen3TtsCloneRoute } from "./runtime-routes/local-qwen3-tts-clone.mts";
import { createRuntimeApiStatusRoute } from "./runtime-routes/status.mts";
import { saveProjectVibe } from "../src/project/projectVibe.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const repoRootRealPath = realpathSync(repoRoot);
function runtimeEnv(primaryName, legacyName) {
  return process.env[primaryName] || (legacyName ? process.env[legacyName] : undefined);
}

const runtimeWritableRoot = path.resolve(runtimeEnv("VIBE_DIRECTOR_RUNTIME_WORKDIR", "VIBE_CORE_RUNTIME_WORKDIR") || process.cwd());
const host = runtimeEnv("VIBE_DIRECTOR_RUNTIME_API_HOST", "VIBE_CORE_RUNTIME_API_HOST") || "127.0.0.1";
const port = Number(runtimeEnv("VIBE_DIRECTOR_RUNTIME_API_PORT", "VIBE_CORE_RUNTIME_API_PORT") || 8790);
const runtimeParentPid = Number(process.env.VIBE_DIRECTOR_RUNTIME_PARENT_PID || "0");
const defaultSandboxRunRootRelativePath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames";
const sandboxRunRootRelativePath = runtimeEnv("VIBE_DIRECTOR_REAL_DEMO_005_ROOT", "VIBE_CORE_REAL_DEMO_005_ROOT") || defaultSandboxRunRootRelativePath;
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

function fixtureRootsFromEnv(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const roots = value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return roots.length ? roots : fallback;
}

const {
  runtimeBasePath,
  runtimeStatusEndpoint,
  currentProjectBindingEndpoint,
  currentProjectSelectEndpoint,
  currentProjectRecentEndpoint,
  currentProjectSaveProjectVibeEndpoint,
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
  currentProjectImage2AssetGenerateEndpoint,
  currentProjectAssetStatusEndpoint,
  currentProjectImage2EndFrameSubmitEndpoint,
  currentProjectSeedanceSubmitEndpoint,
  currentProjectSeedanceResumeEndpoint,
  currentProjectReviewDecisionEndpoint,
  currentProjectP6RealImage2SubmitEndpoint,
  currentProjectP6RealImage2SubmitSerialEndpoint,
  currentProjectRound5StrictEditPrepareEndpoint,
  currentProjectRound5StrictEditReturnEndpoint,
  realDemo005StatusEndpoint,
  realDemo005RunEndpoint,
  runtimeFileEndpoint,
  runtimeCredentialsEndpoint,
  runtimeAgentWebSearchEndpoint,
  runtimeDirectorStoryboardPlanEndpoint,
  runtimeDirectorTextQaEndpoint,
  runtimeLocalIndexTtsEndpoint,
  runtimeLocalQwen3TtsCloneEndpoint,
  legacyStatusEndpoint,
  legacyRunEndpoint,
  currentProjectEndpoints,
  runtimeStatusEndpoints,
  realDemo005Endpoints,
} = createRuntimeApiEndpoints();
const knownProjectFixtureRoots = fixtureRootsFromEnv(runtimeEnv("VIBE_DIRECTOR_KNOWN_PROJECT_FIXTURE_ROOTS", "VIBE_CORE_KNOWN_PROJECT_FIXTURE_ROOTS"), [
  "real-test-sandbox/real-demo-e2e/004-image2-start-frames",
  sandboxRunRootRelativePath,
  "real-test-sandbox/real-demo-e2e/003-long-chain-software",
  "real-test-sandbox/real-demo-e2e/002-anime-pressure",
  "real-test-sandbox/real-demo-e2e/001",
]);
const currentProjectAgentTimelineEndpoint = `${runtimeBasePath}/projects/current/agent-timeline`;
const currentProjectAgentTimelineSidecarPath = ".vibe-runtime/agent-timeline.json";
const currentProjectAgentStagedPlanEndpoint = `${runtimeBasePath}/projects/current/agent-staged-plan`;
const currentProjectAgentStagedPlanSidecarPath = ".vibe-runtime/agent-staged-plan.json";
const currentProjectAgentGenerationJobLedgerEndpoint = `${runtimeBasePath}/projects/current/agent-generation-job-ledger`;
const currentProjectAgentGenerationJobLedgerSidecarPath = ".vibe-runtime/agent-generation-job-ledger.json";

let running = false;

function splitPathList(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readProjectRootFromJson(filePath) {
  if (typeof filePath !== "string" || !filePath.trim() || !existsSync(filePath)) return undefined;
  try {
    const record = JSON.parse(readFileSync(filePath, "utf8"));
    return typeof record?.projectRoot === "string" && record.projectRoot.trim()
      ? record.projectRoot.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function currentProjectBindingPathInput() {
  return runtimeEnv("VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH", "VIBE_CORE_CURRENT_PROJECT_BINDING_PATH");
}

function allowedProjectRootInputs() {
  return [
    ...splitPathList(runtimeEnv("VIBE_DIRECTOR_ALLOWED_PROJECT_ROOTS", "VIBE_CORE_ALLOWED_PROJECT_ROOTS")),
    readProjectRootFromJson(runtimeEnv("VIBE_DIRECTOR_REMEMBERED_PROJECT_SELECTION_PATH", "VIBE_CORE_REMEMBERED_PROJECT_SELECTION_PATH")),
    readProjectRootFromJson(currentProjectBindingPathInput()),
  ].filter(Boolean);
}

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
  runtimeToken: () => runtimeEnv("VIBE_DIRECTOR_RUNTIME_API_TOKEN", "VIBE_CORE_RUNTIME_API_TOKEN") || "",
  legacyRunEnabled: () => runtimeEnv("VIBE_DIRECTOR_ENABLE_LEGACY_RUN", "VIBE_CORE_ENABLE_LEGACY_RUN") === "1",
  allowedProjectRootInputs,
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
  clearCurrentProjectBindingResponse,
} = createRuntimeApiCurrentProjectBinding({
  repoRoot,
  sandboxRunRootRelativePath,
  knownProjectFixtureRoots,
  round5FullRealChainReportFileName,
  currentProjectBindingEndpoint,
  currentProjectSelectEndpoint,
  currentProjectRecentEndpoint,
  currentProjectBindingPathInput,
  currentProjectReportPathInput: () => runtimeEnv("VIBE_DIRECTOR_CURRENT_PROJECT_REPORT", "VIBE_CORE_CURRENT_PROJECT_REPORT")
    || runtimeEnv("VIBE_DIRECTOR_PROJECT_REPORT", "VIBE_CORE_PROJECT_REPORT"),
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

async function handleCurrentProjectSaveProjectVibeRoute(req, res, url) {
  if (url.pathname !== currentProjectSaveProjectVibeEndpoint) return false;
  if (req.method !== "POST") {
    writeJson(res, 405, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectSaveProjectVibeEndpoint,
      status: "method_not_allowed",
      message: "Method not allowed.",
    });
    return true;
  }
  const context = await currentProjectRouteContext(req, res, url, currentProjectSaveProjectVibeEndpoint);
  if (!context) return true;
  const project = isRecord(context.body?.project) ? context.body.project : undefined;
  if (!project) {
    writeJson(res, 400, blockedCurrentProjectResponse(currentProjectSaveProjectVibeEndpoint, context.requestContext, {
      status: "bad_request",
      message: "project is required.",
    }));
    return true;
  }

  const saveResult = await saveProjectVibe({
    existsFile: (filePath) => existsSync(filePath),
    mkdir: (dirPath) => mkdirSync(dirPath, { recursive: true }),
    readFile: (filePath) => readFileSync(filePath, "utf8"),
    writeFile: (filePath, content) => {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf8");
    },
    writeFileAtomic: (filePath, content) => {
      mkdirSync(path.dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
      writeFileSync(tempPath, content, "utf8");
      renameSync(tempPath, filePath);
    },
  }, project, context.source.projectVibePath);
  if (!saveResult.ok) {
    writeJson(res, 400, blockedCurrentProjectResponse(currentProjectSaveProjectVibeEndpoint, context.requestContext, {
      status: "bad_request",
      message: saveResult.errors.join("; ") || "Project.vibe validation failed.",
      validation: saveResult.validation,
    }));
    return true;
  }
  const projectId = asString(project.manifest?.projectId) || asString(project.projectId);
  const projectTitle = asString(project.manifest?.title) || asString(project.title);
  writeJson(res, 200, {
    ok: true,
    ...runtimePolicy(),
    endpoint: currentProjectSaveProjectVibeEndpoint,
    status: "saved",
    projectVibeWritten: true,
    providerCalled: false,
    videoSubmitted: false,
    projectRoot: context.source.runRootRelativePath,
    projectVibePath: context.source.projectVibeRelativePath,
    factHash: saveResult.factHash,
    projectId,
    projectTitle,
    project: {
      projectId,
      projectRoot: context.source.runRootRelativePath,
      projectVibePath: context.source.projectVibeRelativePath,
      title: projectTitle,
    },
  });
  return true;
}

async function handleCurrentProjectAgentTimelineRoute(req, res, url) {
  if (url.pathname !== currentProjectAgentTimelineEndpoint) return false;
  if (req.method !== "GET" && req.method !== "POST") {
    writeJson(res, 405, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectAgentTimelineEndpoint,
      status: "method_not_allowed",
      message: "Method not allowed.",
    });
    return true;
  }
  const context = await currentProjectRouteContext(req, res, url, currentProjectAgentTimelineEndpoint);
  if (!context) return true;
  const sidecarPath = path.join(context.source.runRootPath, currentProjectAgentTimelineSidecarPath);
  if (!isPathInsideRealRoot(sidecarPath, context.source.runRootPath)) {
    writeJson(res, 403, blockedCurrentProjectResponse(currentProjectAgentTimelineEndpoint, context.requestContext, {
      status: "forbidden",
      message: "Agent timeline path is outside the current project.",
    }));
    return true;
  }

  if (req.method === "GET") {
    if (!existsSync(sidecarPath)) {
      writeJson(res, 404, {
        ok: false,
        ...runtimePolicy(),
        endpoint: currentProjectAgentTimelineEndpoint,
        status: "missing",
        providerCalled: false,
        videoSubmitted: false,
        projectRoot: context.source.runRootRelativePath,
        path: currentProjectAgentTimelineSidecarPath,
        message: "Agent timeline sidecar not found.",
      });
      return true;
    }
    writeJson(res, 200, {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectAgentTimelineEndpoint,
      status: "read",
      providerCalled: false,
      videoSubmitted: false,
      projectRoot: context.source.runRootRelativePath,
      path: currentProjectAgentTimelineSidecarPath,
      content: readFileSync(sidecarPath, "utf8"),
    });
    return true;
  }

  const content = typeof context.body?.content === "string" ? context.body.content : undefined;
  if (content == null) {
    writeJson(res, 400, blockedCurrentProjectResponse(currentProjectAgentTimelineEndpoint, context.requestContext, {
      status: "bad_request",
      message: "content is required.",
    }));
    return true;
  }
  mkdirSync(path.dirname(sidecarPath), { recursive: true });
  const tempPath = `${sidecarPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, sidecarPath);
  writeJson(res, 200, {
    ok: true,
    ...runtimePolicy(),
    endpoint: currentProjectAgentTimelineEndpoint,
    status: "written",
    providerCalled: false,
    videoSubmitted: false,
    projectRoot: context.source.runRootRelativePath,
    path: currentProjectAgentTimelineSidecarPath,
  });
  return true;
}

async function handleCurrentProjectAgentStagedPlanRoute(req, res, url) {
  if (url.pathname !== currentProjectAgentStagedPlanEndpoint) return false;
  if (req.method !== "GET" && req.method !== "POST") {
    writeJson(res, 405, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectAgentStagedPlanEndpoint,
      status: "method_not_allowed",
      message: "Method not allowed.",
    });
    return true;
  }
  const context = await currentProjectRouteContext(req, res, url, currentProjectAgentStagedPlanEndpoint);
  if (!context) return true;
  const sidecarPath = path.join(context.source.runRootPath, currentProjectAgentStagedPlanSidecarPath);
  if (!isPathInsideRealRoot(sidecarPath, context.source.runRootPath)) {
    writeJson(res, 403, blockedCurrentProjectResponse(currentProjectAgentStagedPlanEndpoint, context.requestContext, {
      status: "forbidden",
      message: "Agent staged plan path is outside the current project.",
    }));
    return true;
  }

  if (req.method === "GET") {
    if (!existsSync(sidecarPath)) {
      writeJson(res, 404, {
        ok: false,
        ...runtimePolicy(),
        endpoint: currentProjectAgentStagedPlanEndpoint,
        status: "missing",
        providerCalled: false,
        videoSubmitted: false,
        projectRoot: context.source.runRootRelativePath,
        path: currentProjectAgentStagedPlanSidecarPath,
        message: "Agent staged plan sidecar not found.",
      });
      return true;
    }
    writeJson(res, 200, {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectAgentStagedPlanEndpoint,
      status: "read",
      providerCalled: false,
      videoSubmitted: false,
      projectRoot: context.source.runRootRelativePath,
      path: currentProjectAgentStagedPlanSidecarPath,
      content: readFileSync(sidecarPath, "utf8"),
    });
    return true;
  }

  const content = typeof context.body?.content === "string" ? context.body.content : undefined;
  if (content == null) {
    writeJson(res, 400, blockedCurrentProjectResponse(currentProjectAgentStagedPlanEndpoint, context.requestContext, {
      status: "bad_request",
      message: "content is required.",
    }));
    return true;
  }
  mkdirSync(path.dirname(sidecarPath), { recursive: true });
  const tempPath = `${sidecarPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, sidecarPath);
  writeJson(res, 200, {
    ok: true,
    ...runtimePolicy(),
    endpoint: currentProjectAgentStagedPlanEndpoint,
    status: "written",
    providerCalled: false,
    videoSubmitted: false,
    projectRoot: context.source.runRootRelativePath,
    path: currentProjectAgentStagedPlanSidecarPath,
  });
  return true;
}

async function handleCurrentProjectAgentGenerationJobLedgerRoute(req, res, url) {
  if (url.pathname !== currentProjectAgentGenerationJobLedgerEndpoint) return false;
  if (req.method !== "GET" && req.method !== "POST") {
    writeJson(res, 405, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectAgentGenerationJobLedgerEndpoint,
      status: "method_not_allowed",
      message: "Method not allowed.",
    });
    return true;
  }
  const context = await currentProjectRouteContext(req, res, url, currentProjectAgentGenerationJobLedgerEndpoint);
  if (!context) return true;
  const sidecarPath = path.join(context.source.runRootPath, currentProjectAgentGenerationJobLedgerSidecarPath);
  if (!isPathInsideRealRoot(sidecarPath, context.source.runRootPath)) {
    writeJson(res, 403, blockedCurrentProjectResponse(currentProjectAgentGenerationJobLedgerEndpoint, context.requestContext, {
      status: "forbidden",
      message: "Agent generation ledger path is outside the current project.",
    }));
    return true;
  }

  if (req.method === "GET") {
    if (!existsSync(sidecarPath)) {
      writeJson(res, 404, {
        ok: false,
        ...runtimePolicy(),
        endpoint: currentProjectAgentGenerationJobLedgerEndpoint,
        status: "missing",
        providerCalled: false,
        videoSubmitted: false,
        projectRoot: context.source.runRootRelativePath,
        path: currentProjectAgentGenerationJobLedgerSidecarPath,
        message: "Agent generation ledger sidecar not found.",
      });
      return true;
    }
    writeJson(res, 200, {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectAgentGenerationJobLedgerEndpoint,
      status: "read",
      providerCalled: false,
      videoSubmitted: false,
      projectRoot: context.source.runRootRelativePath,
      path: currentProjectAgentGenerationJobLedgerSidecarPath,
      content: readFileSync(sidecarPath, "utf8"),
    });
    return true;
  }

  const content = typeof context.body?.content === "string" ? context.body.content : undefined;
  if (content == null) {
    writeJson(res, 400, blockedCurrentProjectResponse(currentProjectAgentGenerationJobLedgerEndpoint, context.requestContext, {
      status: "bad_request",
      message: "content is required.",
    }));
    return true;
  }
  mkdirSync(path.dirname(sidecarPath), { recursive: true });
  const tempPath = `${sidecarPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, sidecarPath);
  writeJson(res, 200, {
    ok: true,
    ...runtimePolicy(),
    endpoint: currentProjectAgentGenerationJobLedgerEndpoint,
    status: "written",
    providerCalled: false,
    videoSubmitted: false,
    projectRoot: context.source.runRootRelativePath,
    path: currentProjectAgentGenerationJobLedgerSidecarPath,
  });
  return true;
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
  readdirSync,
  realpathSync,
  statSync,
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
  readJsonIfPresent,
  readFileSync,
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
  clearCurrentProjectBindingResponse,
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
  claimOneShotExecutorJson,
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

const {
  handleCurrentProjectImage2AssetGenerateRoute,
} = createRuntimeApiCurrentProjectImage2AssetGenerate({
  currentProjectImage2AssetGenerateEndpoint,
  currentProjectRouteContext,
  readProjectFacts,
  currentProjectWorkbenchFacts,
  getProviderApiKey,
  getProviderConfigStatuses,
  requestOverrideDiagnostics,
  runtimePolicy,
  runtimeFileUrl,
  sha256Bytes,
  writeCurrentProjectRuntimeBytes,
  writeCurrentProjectRuntimeJson,
  writeJson,
  readFileSync,
  writeFileSync,
  running: () => running,
});

const {
  handleCurrentProjectAssetStatusRoute,
} = createRuntimeApiCurrentProjectAssetStatus({
  currentProjectAssetStatusEndpoint,
  currentProjectRouteContext,
  writeJson,
  runtimePolicy,
  readFileSync,
  writeFileSync,
  mkdirSync,
  running: () => running,
});

const {
  handleCurrentProjectImage2EndFrameSubmitRoute,
} = createRuntimeApiCurrentProjectImage2EndFrameSubmit({
  currentProjectImage2EndFrameSubmitEndpoint,
  currentProjectRouteContext,
  projectProjectionFromSource,
  readProjectFacts,
  currentProjectWorkbenchFacts,
  getProviderApiKey,
  getProviderConfigStatuses,
  requestOverrideDiagnostics,
  runtimePolicy,
  runtimeFileUrl,
  runtimePathExists,
  runtimeRelativeFromValue,
  scopedRepoPath,
  readFileSync,
  sha256Bytes,
  writeCurrentProjectRuntimeBytes,
  writeCurrentProjectRuntimeJson,
  writeJson,
  running: () => running,
});

const {
  handleCurrentProjectSeedanceSubmitRoute,
  handleCurrentProjectSeedanceResumeRoute,
} = createRuntimeApiCurrentProjectSeedanceSubmit({
  endpoint: currentProjectSeedanceSubmitEndpoint,
  resumeEndpoint: currentProjectSeedanceResumeEndpoint,
  repoRoot,
  currentProjectRouteContext,
  readProjectFacts,
  currentProjectWorkbenchFacts,
  getProviderApiKey,
  getProviderConfigStatuses,
  requestOverrideDiagnostics,
  runtimePolicy,
  scopedRepoPath,
  sha256Bytes,
  writeCurrentProjectRuntimeBytes,
  writeCurrentProjectRuntimeJson,
  writeJson,
  mkdirSync,
  running: () => running,
  setRunning: (value) => {
    running = value;
  },
});

const {
  handleCurrentProjectP6RealImage2Routes,
} = createRuntimeApiCurrentProjectP6RealImage2Routes({
  currentProjectP6RealImage2SubmitEndpoint,
  currentProjectP6RealImage2SubmitSerialEndpoint,
  currentProjectRouteContext,
  currentProjectImage2OneShotResponse,
  currentProjectImage2OneShotReturnIngestResponse,
  getProviderApiKey,
  getProviderConfigStatuses,
  requestOverrideDiagnostics,
  runtimePolicy,
  runtimeFileUrl,
  scopedRepoPath,
  runtimePathExists,
  sha256Bytes,
  readFileSync,
  writeOneShotExecutorBytes,
  writeOneShotExecutorJson,
  claimOneShotExecutorJson,
  writeJson,
  running: () => running,
});

const {
  handleCurrentProjectReviewDecisionRoute,
} = createRuntimeApiCurrentProjectReviewDecision({
  currentProjectReviewDecisionEndpoint,
  currentProjectRouteContext,
  writeJson,
  requestOverrideDiagnostics,
  runtimePolicy,
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
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

function validJsonpCallbackName(value) {
  return typeof value === "string" && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(value);
}

function validJsonpRequestId(value) {
  return typeof value === "string" && /^[0-9A-Za-z_-]{1,96}$/.test(value);
}

async function handleRuntimeJsonpRoute(req, res, url) {
  if (url.pathname !== `${runtimeBasePath}/jsonp`) return false;
  if (req.method !== "GET") {
    writeJson(res, 405, {
      ok: false,
      ...runtimePolicy(),
      endpoint: `${runtimeBasePath}/jsonp`,
      status: "method_not_allowed",
      message: "Method not allowed.",
    });
    return true;
  }

  const callback = url.searchParams.get("callback") || "";
  const requestId = url.searchParams.get("id") || "";
  const targetPath = url.searchParams.get("path") || "";
  if (
    !(validJsonpCallbackName(callback) || validJsonpRequestId(requestId))
    || !targetPath.startsWith(`${runtimeBasePath}/`)
    || targetPath.startsWith(`${runtimeBasePath}/jsonp`)
  ) {
    writeJson(res, 400, {
      ok: false,
      ...runtimePolicy(),
      endpoint: `${runtimeBasePath}/jsonp`,
      status: "bad_request",
      message: "Invalid JSONP runtime request.",
    });
    return true;
  }

  const targetUrl = new URL(targetPath, `http://${host}:${port}`);
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      origin: isTrustedLocalOrigin(String(req.headers.origin || "")) ? String(req.headers.origin || "") : `http://${host}:${port}`,
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {
      ok: false,
      ...runtimePolicy(),
      endpoint: targetPath,
      status: "bad_response",
      message: "Runtime endpoint did not return JSON.",
    };
  }
  res.writeHead(200, corsHeaders("application/javascript; charset=utf-8", res.runtimeAllowedOrigin));
  const serializedPayload = JSON.stringify(payload);
  if (validJsonpCallbackName(callback)) {
    res.end(`${callback}(${serializedPayload});\n`);
    return true;
  }
  res.end(
    `window.dispatchEvent(new CustomEvent("vibe-runtime-jsonp",{detail:{id:${JSON.stringify(requestId)},payload:${serializedPayload}}}));\n`,
  );
  return true;
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
  readLegacyRunEnabled: () => runtimeEnv("VIBE_DIRECTOR_ENABLE_LEGACY_RUN", "VIBE_CORE_ENABLE_LEGACY_RUN") === "1",
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

const {
  handleRuntimeApiCredentialsRoute,
} = createRuntimeApiCredentialsRoute({
  credentialsEndpoint: runtimeCredentialsEndpoint,
  getAllCredentials,
  getMaskedKey,
  getProviderConfigStatuses,
  readRequestJsonBody,
  removeProviderCredential,
  runtimePolicy,
  setProviderCredential,
  writeJson,
});

const {
  handleRuntimeApiAgentWebSearchRoute,
} = createRuntimeApiAgentWebSearchRoute({
  endpoint: runtimeAgentWebSearchEndpoint,
  getProviderApiKey,
  readRequestJsonBody,
  repoRoot,
  runtimeRoot: runtimeWritableRoot,
  runtimePolicy,
  writeJson,
});

const {
  handleRuntimeApiDirectorStoryboardPlanRoute,
} = createRuntimeApiDirectorStoryboardPlanRoute({
  endpoint: runtimeDirectorStoryboardPlanEndpoint,
  getProviderApiKey,
  getProviderConfigStatuses,
  readRequestJsonBody,
  runtimePolicy,
  runtimeRoot: runtimeWritableRoot,
  writeJson,
});

const {
  handleRuntimeApiDirectorTextQaRoute,
} = createRuntimeApiDirectorTextQaRoute({
  endpoint: runtimeDirectorTextQaEndpoint,
  getProviderApiKey,
  getProviderConfigStatuses,
  readRequestJsonBody,
  runtimePolicy,
  writeJson,
});

const {
  handleRuntimeApiLocalIndexTtsRoute,
} = createRuntimeApiLocalIndexTtsRoute({
  endpoint: runtimeLocalIndexTtsEndpoint,
  readRequestJsonBody,
  runtimePolicy,
  runtimeRoot: runtimeWritableRoot,
  runtimeFileUrl,
  writeJson,
  running: () => running,
  setRunning: (value) => {
    running = value;
  },
});

const {
  handleRuntimeApiLocalQwen3TtsCloneRoute,
} = createRuntimeApiLocalQwen3TtsCloneRoute({
  endpoint: runtimeLocalQwen3TtsCloneEndpoint,
  readRequestJsonBody,
  runtimePolicy,
  runtimeRoot: runtimeWritableRoot,
  runtimeFileUrl,
  writeJson,
  running: () => running,
  setRunning: (value) => {
    running = value;
  },
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
  if (await handleRuntimeJsonpRoute(req, res, url)) return;
  if (handleRuntimeApiStatusRoute(req, res, url)) return;
  if (req.method === "GET" && url.pathname === runtimeFileEndpoint) {
    serveRuntimeFile(req, res, url.searchParams.get("path") || "", { scope: url.searchParams.get("scope") || undefined });
    return;
  }
  if (await handleCurrentProjectBindingRoute(req, res, url)) return;
  if (await handleCurrentProjectSaveProjectVibeRoute(req, res, url)) return;
  if (await handleCurrentProjectAgentTimelineRoute(req, res, url)) return;
  if (await handleCurrentProjectAgentStagedPlanRoute(req, res, url)) return;
  if (await handleCurrentProjectAgentGenerationJobLedgerRoute(req, res, url)) return;
  if (await handleCurrentProjectReadCheckRoute(req, res, url)) return;
  if (await handleCurrentProjectOneShotRoute(req, res, url)) return;
  if (await handleCurrentProjectOneShotReturnRoute(req, res, url)) return;
  if (await handleCurrentProjectImage2AssetGenerateRoute(req, res, url)) return;
  if (await handleCurrentProjectAssetStatusRoute(req, res, url)) return;
  if (await handleCurrentProjectImage2EndFrameSubmitRoute(req, res, url)) return;
  if (await handleCurrentProjectSeedanceSubmitRoute(req, res, url)) return;
  if (await handleCurrentProjectSeedanceResumeRoute(req, res, url)) return;
  if (await handleCurrentProjectP6RealImage2Routes(req, res, url)) return;
  if (await handleCurrentProjectReviewDecisionRoute(req, res, url)) return;
  if (await handleCurrentProjectRound5StrictEditPrepareRoute(req, res, url)) return;
  if (await handleCurrentProjectRound5StrictEditReturnRoute(req, res, url)) return;
  if (handleRuntimeApiRealDemo005Route(req, res, url)) return;
  if (await handleRuntimeApiCredentialsRoute(req, res, url)) return;
  if (await handleRuntimeApiAgentWebSearchRoute(req, res, url)) return;
  if (await handleRuntimeApiDirectorStoryboardPlanRoute(req, res, url)) return;
  if (await handleRuntimeApiDirectorTextQaRoute(req, res, url)) return;
  if (await handleRuntimeApiLocalIndexTtsRoute(req, res, url)) return;
  if (await handleRuntimeApiLocalQwen3TtsCloneRoute(req, res, url)) return;
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

let shuttingDown = false;
const runtimeParentWatchdog = Number.isInteger(runtimeParentPid) && runtimeParentPid > 1
  ? setInterval(() => {
      try {
        if (process.ppid !== runtimeParentPid) {
          shutdown();
          return;
        }
        process.kill(runtimeParentPid, 0);
      } catch {
        shutdown();
      }
    }, 1000)
  : undefined;
runtimeParentWatchdog?.unref();

server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(JSON.stringify({
    event: "vibe-director-runtime-api-listening",
    legacyEvent: "vibe-core-runtime-api-listening",
    host,
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
    basePath: runtimeBasePath,
  }));
});

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (runtimeParentWatchdog) clearInterval(runtimeParentWatchdog);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("uncaughtException", (error) => {
  console.error(JSON.stringify({
    event: "vibe-director-runtime-uncaught-exception",
    message: error.message,
    stack: error.stack?.split("\n").slice(0, 6).join("\n"),
  }));
  process.exitCode = 1;
  shutdown();
});

process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({
    event: "vibe-director-runtime-unhandled-rejection",
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack?.split("\n").slice(0, 6).join("\n") : undefined,
  }));
  process.exitCode = 1;
  shutdown();
});
