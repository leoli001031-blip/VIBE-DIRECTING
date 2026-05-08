import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const currentProjectImage2OneShotExecuteMockEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-mock`;
const currentProjectImage2OneShotReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/return`;
const currentProjectImage2OneShotExecuteReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-return`;
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

function isTrustedLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || parsed.hostname === "[::1]");
  } catch {
    return false;
  }
}

function runtimeToken() {
  return process.env.VIBE_CORE_RUNTIME_API_TOKEN || "";
}

function runtimeSecurityPolicy() {
  return {
    originPolicy: "localhost_or_no_origin_only",
    tokenRequired: Boolean(runtimeToken()),
    legacyRunEnabled: process.env.VIBE_CORE_ENABLE_LEGACY_RUN === "1",
  };
}

function corsHeaders(contentType = "application/json; charset=utf-8", origin) {
  const headers = {
    "content-type": contentType,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-vibe-runtime-token,x-vibe-project-root,x-vibe-project-id,x-project-root,x-project-id",
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  };
  if (origin && isTrustedLocalOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  return headers;
}

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

function normalizeRelativePath(value) {
  return value.replace(/\\/g, "/");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function repoRelativePath(filePath) {
  const relativePath = normalizeRelativePath(path.relative(repoRoot, filePath));
  if (relativePath === "") return ".";
  if (relativePath.startsWith("../") || relativePath === ".." || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes project root: ${filePath}`);
  }
  return relativePath;
}

function resolveRepoInputPath(inputPath) {
  const candidate = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(repoRoot, inputPath);
  const rootWithSep = `${repoRoot}${path.sep}`;
  if (candidate !== repoRoot && !candidate.startsWith(rootWithSep)) {
    throw new Error(`Path escapes project root: ${inputPath}`);
  }
  if (existsSync(candidate)) {
    const candidateRealPath = realpathSync(candidate);
    const realRootWithSep = `${repoRootRealPath}${path.sep}`;
    if (candidateRealPath !== repoRootRealPath && !candidateRealPath.startsWith(realRootWithSep)) {
      throw new Error(`Path escapes project root: ${inputPath}`);
    }
  }
  return candidate;
}

function pathWithinRoot(candidatePath, rootPath) {
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

function currentProjectBindingPath() {
  const configuredPath = process.env.VIBE_CORE_CURRENT_PROJECT_BINDING_PATH;
  if (!configuredPath) return path.join(repoRoot, ".vibe-runtime", "current-project.local.json");
  return path.isAbsolute(configuredPath)
    ? path.resolve(configuredPath)
    : path.resolve(repoRoot, configuredPath);
}

function readCurrentProjectBinding() {
  const bindingPath = currentProjectBindingPath();
  const binding = readJsonIfPresent(bindingPath);
  if (!isRecord(binding)) {
    return {
      bound: false,
      bindingPath,
      bindingPathRelative: pathWithinRoot(bindingPath, repoRoot) ? repoRelativePath(bindingPath) : bindingPath,
    };
  }
  return {
    bound: typeof binding.projectRoot === "string" && binding.projectRoot.length > 0,
    bindingPath,
    bindingPathRelative: pathWithinRoot(bindingPath, repoRoot) ? repoRelativePath(bindingPath) : bindingPath,
    binding,
  };
}

function validateSelectableProjectRoot(projectRoot) {
  if (typeof projectRoot !== "string" || !projectRoot.trim()) {
    throw new Error("projectRoot is required.");
  }
  const configuredPath = resolveRepoInputPath(projectRoot.trim());
  if (!existsSync(configuredPath)) {
    throw new Error(`Project root does not exist: ${projectRoot}`);
  }
  const stats = statSync(configuredPath);
  if (!stats.isDirectory() && !(stats.isFile() && path.basename(configuredPath) === "project.vibe")) {
    throw new Error("projectRoot must be a project directory or project.vibe inside the repository.");
  }
  const source = resolveProjectSource(configuredPath, {
    projectRootMode: "runtime_current_project_binding",
    sourceLabel: "runtime endpoint / current project binding validation",
    ignoreReportEnv: true,
  });
  return source;
}

function writeCurrentProjectBinding(input) {
  const source = validateSelectableProjectRoot(input.projectRoot);
  const bindingPath = currentProjectBindingPath();
  const binding = {
    schemaVersion: "vibe_core_current_project_binding_v1",
    projectRoot: source.runRootRelativePath,
    projectRootRelativePath: source.runRootRelativePath,
    projectVibeRelativePath: source.projectVibeRelativePath,
    projectId: asString(input.projectId),
    displayName: asString(input.displayName),
    selectedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(bindingPath), { recursive: true });
  writeFileSync(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, "utf8");
  return { bindingPath, binding, source };
}

function firstExistingPath(paths) {
  return paths.find((filePath) => existsSync(filePath));
}

function resolveProjectSource(inputPath, options = {}) {
  const configuredPath = resolveRepoInputPath(inputPath || sandboxRunRootRelativePath);
  const configuredStats = existsSync(configuredPath) ? statSync(configuredPath) : undefined;
  const configuredIsProjectVibe = configuredStats?.isFile() && path.basename(configuredPath) === "project.vibe";
  const runRootPath = configuredIsProjectVibe
    ? path.basename(path.dirname(configuredPath)) === "project"
      ? path.dirname(path.dirname(configuredPath))
      : path.dirname(configuredPath)
    : configuredPath;
  const projectVibePath = configuredIsProjectVibe
    ? configuredPath
    : firstExistingPath([
      path.join(runRootPath, "project.vibe"),
      path.join(runRootPath, "project", "project.vibe"),
    ]) || path.join(runRootPath, "project", "project.vibe");

  const reportInput = options.reportPath || (options.ignoreReportEnv ? undefined : (process.env.VIBE_CORE_CURRENT_PROJECT_REPORT || process.env.VIBE_CORE_PROJECT_REPORT));
  const reportPath = reportInput
    ? resolveRepoInputPath(reportInput)
    : firstExistingPath([
      path.join(runRootPath, "reports", "image2_start_long_chain_report.json"),
      path.join(runRootPath, "reports", "real_demo_e2e_report.json"),
      path.join(runRootPath, "image2_start_long_chain_report.json"),
    ]) || path.join(runRootPath, "reports", "image2_start_long_chain_report.json");

  const runRootRelativePath = repoRelativePath(runRootPath);
  return {
    runRootPath,
    runRootRelativePath,
    projectVibePath,
    projectVibeRelativePath: repoRelativePath(projectVibePath),
    sourceIndexPath: path.join(runRootPath, "project", "source_index.json"),
    sourceIndexRelativePath: repoRelativePath(path.join(runRootPath, "project", "source_index.json")),
    storyFlowPath: path.join(runRootPath, "project", "story_flow.json"),
    storyFlowRelativePath: repoRelativePath(path.join(runRootPath, "project", "story_flow.json")),
    visualMemoryPath: path.join(runRootPath, "project", "visual_memory.json"),
    visualMemoryRelativePath: repoRelativePath(path.join(runRootPath, "project", "visual_memory.json")),
    runManifestPath: path.join(runRootPath, "run_manifest.json"),
    runManifestRelativePath: repoRelativePath(path.join(runRootPath, "run_manifest.json")),
    runtimeTruthLayerPath: path.join(runRootPath, "reports", "runtime_truth_layer.json"),
    runtimeTruthLayerRelativePath: repoRelativePath(path.join(runRootPath, "reports", "runtime_truth_layer.json")),
    previewPlanPath: path.join(runRootPath, "reports", "preview_plan.json"),
    previewPlanRelativePath: repoRelativePath(path.join(runRootPath, "reports", "preview_plan.json")),
    reportPath,
    reportRelativePath: repoRelativePath(reportPath),
    projectRootMode: options.projectRootMode || "configured_project_root",
    sourceLabel: options.sourceLabel || "runtime endpoint / project projection",
    sandboxSource: options.sandboxSource,
    binding: options.binding,
    bindingPath: options.bindingPath,
    bindingPathRelative: options.bindingPathRelative,
    requestContextSource: options.requestContextSource,
    requestProjectId: options.requestProjectId,
    requestProjectIdSource: options.requestProjectIdSource,
    requestProjectRoot: options.requestProjectRoot,
  };
}

function realDemo005Source() {
  return resolveProjectSource(sandboxRunRootRelativePath, {
    projectRootMode: "sandbox_fixture_projection",
    sourceLabel: "runtime endpoint / 005 compatibility",
    sandboxSource: "005 sandbox",
  });
}

function currentProjectSource() {
  const bindingState = readCurrentProjectBinding();
  if (!bindingState.bound) {
    const error = new Error("No current project is bound. Use POST /api/runtime/projects/select first.");
    error.code = "CURRENT_PROJECT_UNBOUND";
    error.bindingState = bindingState;
    throw error;
  }

  const binding = bindingState.binding;
  return resolveProjectSource(binding.projectRoot, {
    projectRootMode: "runtime_current_project_binding",
    sourceLabel: "runtime endpoint / current project binding",
    requestContextSource: "binding",
    requestProjectId: binding.projectId,
    requestProjectIdSource: binding.projectId ? "binding" : undefined,
    requestProjectRoot: binding.projectRoot,
    binding,
    bindingPath: bindingState.bindingPath,
    bindingPathRelative: bindingState.bindingPathRelative,
    ignoreReportEnv: true,
  });
}

function readProjectVibe(source) {
  if (!existsSync(source.projectVibePath)) return undefined;
  try {
    const projectVibe = readJson(source.projectVibePath);
    return {
      schemaVersion: projectVibe.schemaVersion,
      projectId: projectVibe.projectId,
      runId: projectVibe.runId,
      projectRoot: source.runRootRelativePath,
      projectVibePath: source.projectVibeRelativePath,
      roleIds: Array.isArray(projectVibe.roleIds) ? projectVibe.roleIds : [],
      sceneIds: Array.isArray(projectVibe.sceneIds) ? projectVibe.sceneIds : [],
      styleId: projectVibe.styleId,
    };
  } catch {
    return undefined;
  }
}

function projectIdentityFromSource(source) {
  const projectVibe = readProjectVibe(source);
  if (projectVibe) return projectVibe;
  const manifest = readJsonIfPresent(source.runManifestPath);
  if (manifest) {
    return {
      projectId: manifest.projectId || source.requestProjectId,
      runId: manifest.runId,
      projectRoot: source.runRootRelativePath,
      projectVibePath: source.projectVibeRelativePath,
    };
  }
  return {
    projectId: source.requestProjectId,
    projectRoot: source.runRootRelativePath,
    projectVibePath: source.projectVibeRelativePath,
  };
}

function projectChoiceTitle(source, project, binding) {
  const displayName = asString(binding?.displayName) || asString(binding?.name);
  if (displayName) return displayName;
  if (asString(project?.title)) return asString(project.title);
  if (asString(project?.projectId)) {
    const match = String(project.projectId).match(/real_demo_e2e_(\d{3})/);
    if (match) return `项目 ${match[1]}`;
    return String(project.projectId).replace(/_/g, " ");
  }
  const match = source.runRootRelativePath.match(/\/(\d{3})[^/]*$/);
  if (match) return `项目 ${match[1]}`;
  return path.basename(source.runRootRelativePath) || "未命名项目";
}

function projectChoiceUpdatedAt(source) {
  const candidates = [source.projectVibePath, source.reportPath, source.runRootPath];
  for (const candidate of candidates) {
    if (!candidate || !existsSync(candidate)) continue;
    return statSync(candidate).mtime.toISOString();
  }
  return undefined;
}

function projectChoiceFromSource(source, options = {}) {
  const project = projectIdentityFromSource(source);
  return {
    projectRoot: source.runRootRelativePath,
    displayName: projectChoiceTitle(source, project, options.binding),
    projectId: asString(project.projectId),
    updatedAt: projectChoiceUpdatedAt(source),
    status: options.current ? "当前" : "可打开",
  };
}

function currentProjectRecentResponse(extra = {}) {
  const choices = [];
  const seenRoots = new Set();
  const bindingState = readCurrentProjectBinding();

  if (bindingState.bound) {
    try {
      const source = currentProjectSource();
      const choice = projectChoiceFromSource(source, { current: true, binding: bindingState.binding });
      choices.push(choice);
      seenRoots.add(choice.projectRoot);
    } catch {
      // Ignore an unreadable binding; the list endpoint stays read-only and fail-closed.
    }
  }

  for (const fixtureRoot of knownProjectFixtureRoots) {
    try {
      const source = resolveProjectSource(fixtureRoot, {
        projectRootMode: "known_fixture_project_choice",
        sourceLabel: "runtime endpoint / known project choice",
        ignoreReportEnv: true,
      });
      if (!existsSync(source.projectVibePath) || seenRoots.has(source.runRootRelativePath)) continue;
      choices.push(projectChoiceFromSource(source));
      seenRoots.add(source.runRootRelativePath);
    } catch {
      // Missing or malformed fixtures are skipped instead of leaking diagnostics into the main UI.
    }
  }

  return {
    ok: true,
    ...runtimePolicy(),
    endpoint: currentProjectRecentEndpoint,
    status: "ready",
    choices,
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
    ...extra,
  };
}

function clip(value) {
  const text = String(value || "");
  if (text.length <= maxOutputChars) return text;
  return `${text.slice(0, maxOutputChars)}\n...[clipped ${text.length - maxOutputChars} chars]`;
}

function runtimeFileUrl(relativePath, scope) {
  const scopeQuery = scope ? `scope=${encodeURIComponent(scope)}&` : "";
  return `${runtimeFileEndpoint}?${scopeQuery}path=${encodeURIComponent(relativePath)}`;
}

function scopedRepoPath(relativePath) {
  const candidate = path.resolve(repoRoot, relativePath || "");
  const rootWithSep = `${repoRoot}${path.sep}`;
  if (candidate !== repoRoot && !candidate.startsWith(rootWithSep)) {
    throw new Error(`Path escapes project root: ${relativePath}`);
  }
  return candidate;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function isMediaContentType(contentType) {
  return contentType.startsWith("image/") || contentType.startsWith("video/");
}

function acceptsMedia(req) {
  const accept = String(req.headers.accept || "");
  return accept.includes("image/") || accept.includes("video/");
}

function runtimeRequestSecurity(req) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (origin && !isTrustedLocalOrigin(origin)) {
    return {
      ok: false,
      statusCode: 403,
      origin,
      message: "Runtime API only accepts localhost or no-origin requests.",
    };
  }

  const token = runtimeToken();
  if (req.method !== "GET" && req.method !== "OPTIONS" && token) {
    const suppliedToken = typeof req.headers["x-vibe-runtime-token"] === "string" ? req.headers["x-vibe-runtime-token"] : "";
    if (suppliedToken !== token) {
      return {
        ok: false,
        statusCode: 403,
        origin,
        message: "Runtime API token is required for this request.",
      };
    }
  }

  return { ok: true, origin };
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

function writeRuntimeFileError(req, res, statusCode, payload, relativePath) {
  const contentType = contentTypeFor(relativePath || "");
  if (isMediaContentType(contentType) && acceptsMedia(req)) {
    res.writeHead(statusCode, {
      ...corsHeaders(contentType, res.runtimeAllowedOrigin),
      "content-length": "0",
    });
    res.end();
    return;
  }
  writeJson(res, statusCode, payload);
}

function runtimePolicy(extra = {}) {
  return {
    schemaVersion: "vibe_core_local_runtime_api_v1",
    source: "runtime_endpoint",
    basePath: runtimeBasePath,
    security: runtimeSecurityPolicy(),
    tokenRequired: Boolean(runtimeToken()),
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    workerSpawnForbidden: true,
    videoSubmitted: false,
    runMode: "verify_only",
    ...extra,
  };
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

function runtimeRelativeFromValue(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = normalizeRelativePath(value.trim());
  if (!path.isAbsolute(normalized)) return normalized;
  try {
    return repoRelativePath(normalized);
  } catch {
    return undefined;
  }
}

function runtimePathExists(relativePath) {
  if (!relativePath) return false;
  try {
    const filePath = scopedRepoPath(relativePath);
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readRuntimeJson(relativePath) {
  if (!relativePath) return undefined;
  try {
    return readJsonIfPresent(scopedRepoPath(relativePath));
  } catch {
    return undefined;
  }
}

function projectFact(name, filePath, usedFor = []) {
  const relativePath = repoRelativePath(filePath);
  const present = existsSync(filePath);
  const parsed = present ? readJsonIfPresent(filePath) : undefined;
  return {
    name,
    path: relativePath,
    present,
    readable: parsed !== undefined,
    usedFor,
    parsed,
  };
}

function readProjectFacts(source) {
  const facts = [
    projectFact("project_vibe", source.projectVibePath, ["identity"]),
    projectFact("source_index", source.sourceIndexPath, ["project_facts"]),
    projectFact("story_flow", source.storyFlowPath, ["story_flow"]),
    projectFact("visual_memory", source.visualMemoryPath, ["visual_memory"]),
    projectFact("run_manifest", source.runManifestPath, ["ledger_plan", "identity"]),
    projectFact("runtime_truth_layer", source.runtimeTruthLayerPath, ["ledger_truth", "status"]),
    projectFact("preview_plan", source.previewPlanPath, ["preview", "status"]),
    projectFact("image2_start_long_chain_report", source.reportPath, ["compatibility_fallback"]),
  ];
  const byName = Object.fromEntries(facts.map((fact) => [fact.name, fact]));
  const factsUsed = facts
    .filter((fact) => fact.readable)
    .map(({ name, path: factPath, usedFor }) => ({ name, path: factPath, usedFor }));
  const runtimeTruthLayer = byName.runtime_truth_layer.parsed;
  const previewPlan = byName.preview_plan.parsed;
  const image2Report = byName.image2_start_long_chain_report.parsed;
  const projectionParts = [
    runtimeTruthLayer ? "runtime_truth_layer" : undefined,
    previewPlan ? "preview_plan" : undefined,
  ].filter(Boolean);
  return {
    facts,
    factsUsed,
    projectVibe: byName.project_vibe.parsed,
    sourceIndex: byName.source_index.parsed,
    storyFlow: byName.story_flow.parsed,
    visualMemory: byName.visual_memory.parsed,
    runManifest: byName.run_manifest.parsed,
    runtimeTruthLayer,
    previewPlan,
    image2Report,
    projectionSource: projectionParts.length
      ? projectionParts.join("+")
      : image2Report
        ? "image2_start_long_chain_report_fallback"
        : "unavailable",
    ledgerTruthSource: runtimeTruthLayer
      ? "runtime_truth_layer"
      : previewPlan
        ? "preview_plan"
        : image2Report
          ? "image2_start_long_chain_report_fallback"
          : "unavailable",
    primaryReportRelativePath: runtimeTruthLayer
      ? source.runtimeTruthLayerRelativePath
      : previewPlan
        ? source.previewPlanRelativePath
        : image2Report
          ? source.reportRelativePath
          : source.reportRelativePath,
    projectionAvailable: Boolean(runtimeTruthLayer || previewPlan || image2Report || byName.run_manifest.parsed),
  };
}

function byShotId(items) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (typeof item?.shotId === "string" && item.shotId) map.set(item.shotId, item);
  }
  return map;
}

function orderedShotIds(...itemLists) {
  const ids = [];
  const seen = new Set();
  for (const items of itemLists) {
    for (const item of Array.isArray(items) ? items : []) {
      const shotId = typeof item?.shotId === "string" ? item.shotId : undefined;
      if (!shotId || seen.has(shotId)) continue;
      seen.add(shotId);
      ids.push(shotId);
    }
  }
  return ids;
}

function mergeBlockers(...blockerLists) {
  return uniqueStrings(blockerLists.flatMap((blockers) => Array.isArray(blockers) ? blockers : []));
}

function providerObservationActual(providerObservation, expectedOutputPath) {
  if (!providerObservation) return false;
  const provider = String(providerObservation.provider || providerObservation.providerId || "");
  const outputPath = runtimeRelativeFromValue(providerObservation.outputPath);
  return providerObservation.providerObservationMode === "actual_provider_call_observed"
    && /image2/i.test(provider)
    && (!expectedOutputPath || outputPath === expectedOutputPath);
}

function semanticQaSummary(semanticQa) {
  if (!semanticQa) {
    return {
      present: false,
      actual: false,
      status: "missing",
      passed: false,
      needsReview: false,
    };
  }
  const status = semanticQa.finalAssessment?.status || semanticQa.status || "unknown";
  const actual = semanticQa.semanticReviewMode === "actual_image_semantic_review";
  const mockReview = semanticQa.semanticReviewMode === "mock_executor_semantic_review";
  return {
    present: true,
    actual,
    mockReview,
    status,
    passed: actual && status === "pass",
    needsReview: (actual || mockReview) && status === "needs_review",
  };
}

function projectObservationItems(source, projectFacts) {
  const manifestShotPlans = Array.isArray(projectFacts.runManifest?.shotPlans) ? projectFacts.runManifest.shotPlans : [];
  const previewClips = Array.isArray(projectFacts.previewPlan?.clips) ? projectFacts.previewPlan.clips : [];
  const truthItems = Array.isArray(projectFacts.runtimeTruthLayer?.items) ? projectFacts.runtimeTruthLayer.items : [];
  const reportObservations = Array.isArray(projectFacts.image2Report?.observations) ? projectFacts.image2Report.observations : [];
  const shotPlanById = byShotId(manifestShotPlans);
  const previewById = byShotId(previewClips);
  const truthById = byShotId(truthItems);
  const reportById = byShotId(reportObservations);
  const reviewOverlayShots = new Set([
    ...(Array.isArray(projectFacts.previewPlan?.reviewOverlayShots) ? projectFacts.previewPlan.reviewOverlayShots : []),
    ...(Array.isArray(projectFacts.image2Report?.reviewOverlayShots) ? projectFacts.image2Report.reviewOverlayShots : []),
    ...(Array.isArray(projectFacts.image2Report?.productionNeedsReviewShots) ? projectFacts.image2Report.productionNeedsReviewShots : []),
  ]);

  return orderedShotIds(manifestShotPlans, previewClips, truthItems, reportObservations).map((shotId, index) => {
    const shotPlan = shotPlanById.get(shotId) || {};
    const previewClip = previewById.get(shotId) || {};
    const truthItem = truthById.get(shotId) || {};
    const reportObservation = reportById.get(shotId) || {};
    const expectedOutputPath = runtimeRelativeFromValue(previewClip.mediaPath)
      || runtimeRelativeFromValue(shotPlan.expectedOutputPath)
      || runtimeRelativeFromValue(reportObservation.expectedOutputPath)
      || `${source.runRootRelativePath}/outputs/shots/${shotId}/start.png`;
    const providerObservationPath = runtimeRelativeFromValue(truthItem.providerObservationPath)
      || runtimeRelativeFromValue(reportObservation.providerObservationPath)
      || runtimeRelativeFromValue(shotPlan.providerObservationPath)
      || derivedShotPath(source, shotId, "provider_observations", "_start_provider_observation", "json");
    const semanticQaPath = runtimeRelativeFromValue(truthItem.semanticQaPath)
      || runtimeRelativeFromValue(reportObservation.semanticQaPath)
      || runtimeRelativeFromValue(shotPlan.semanticQaPath)
      || derivedShotPath(source, shotId, "semantic_qa", "_start_semantic_qa", "json");
    const providerObservation = readRuntimeJson(providerObservationPath);
    const semanticQa = readRuntimeJson(semanticQaPath);
    const semantic = semanticQaSummary(semanticQa);
    const outputExists = runtimePathExists(expectedOutputPath);
    const providerActual = providerObservationActual(providerObservation, expectedOutputPath);
    const previewStatus = previewClip.status || reportObservation.previewQaStatus || (outputExists ? "returned" : "missing");
    const reviewOverlay = reviewOverlayShots.has(shotId) || previewStatus === "returned_with_review_overlay" || reportObservation.reviewOverlay === true || semantic.needsReview;
    const blockers = mergeBlockers(
      truthItem.blockers,
      truthItem.runtimeTruthBlockers,
      reportObservation.blockers,
      reportObservation.runtimeTruthBlockers,
      previewStatus === "blocked" ? [`${shotId}: preview plan blocked`] : [],
      semantic.present && !semantic.actual ? [`${shotId}: semantic QA not actual review`] : [],
      semantic.present && !semantic.passed && !semantic.needsReview ? [`${shotId}: semantic QA status ${semantic.status}`] : [],
      providerObservation && !providerActual ? [`${shotId}: provider observation not actual image2 output`] : [],
    );

    return {
      order: Number(previewClip.order || reportObservation.order || index + 1),
      shotId,
      sceneId: reportObservation.sceneId,
      roleIds: Array.isArray(reportObservation.roleIds) ? reportObservation.roleIds : [],
      expectedOutputPath,
      imageUrl: expectedOutputPath ? runtimeFileUrl(expectedOutputPath) : undefined,
      outputExists,
      providerObservationPath,
      providerObservationPresent: Boolean(providerObservation),
      providerObservationActual: providerActual,
      providerOutputSha256: providerObservation?.outputSha256 || providerObservation?.outputHash,
      semanticQaPath,
      semanticQaPresent: semantic.present,
      semanticQaActual: semantic.actual,
      semanticQaStatus: semantic.status,
      semanticQaPassed: semantic.passed,
      semanticQaNeedsReview: semantic.needsReview,
      previewStatus,
      previewQaStatus: previewClip.previewQaStatus || reportObservation.previewQaStatus,
      productionQaStatus: previewClip.productionQaStatus || reportObservation.productionQaStatus || (semantic.needsReview ? "needs_review" : undefined),
      reviewOverlay,
      runtimeTruthStatus: truthItem.status || reportObservation.runtimeTruthStatus,
      blockers,
      returned: outputExists || /^returned/.test(String(previewStatus)),
      shotPlan,
    };
  });
}

function projectProjectionFromSource(source) {
  const project = projectIdentityFromSource(source);
  const projectFacts = readProjectFacts(source);
  const observations = projectObservationItems(source, projectFacts);
  const blockedObservations = observations.filter((item) => item.blockers.length > 0 || item.previewStatus === "blocked" || item.runtimeTruthStatus === "blocked");
  const reviewShotIds = observations.filter((item) => item.reviewOverlay || item.semanticQaNeedsReview).map((item) => item.shotId);
  const returnedObservations = observations.filter((item) => item.returned);
  const status = projectFacts.previewPlan?.previewStatus
    || projectFacts.previewPlan?.status
    || projectFacts.runtimeTruthLayer?.status
    || projectFacts.image2Report?.previewStatus
    || projectFacts.image2Report?.status
    || (projectFacts.projectionAvailable ? projectFacts.runManifest?.status : "unavailable")
    || "unavailable";
  const productionStatus = projectFacts.previewPlan?.productionStatus
    || projectFacts.image2Report?.productionStatus
    || (reviewShotIds.length ? "needs_review" : blockedObservations.length ? "blocked" : status === "unavailable" ? "unavailable" : "ready");

  return {
    project,
    projectFacts,
    observations,
    blockedObservations,
    reviewShotIds,
    returnedObservations,
    status,
    previewStatus: status,
    productionStatus,
    ok: projectFacts.projectionAvailable,
  };
}

function firstTextValue(record, keys) {
  if (!isRecord(record)) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeWorkbenchStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["locked", "approved", "authority", "formal"].includes(normalized)) return "locked";
  if (["needs_review", "review", "pending_review"].includes(normalized)) return "needs_review";
  if (["rejected", "blocked", "negative"].includes(normalized)) return "rejected";
  if (["missing", "not_generated", "absent"].includes(normalized)) return "missing";
  if (["candidate", "draft", "temp", "temporary"].includes(normalized)) return "candidate";
  return "locked";
}

function normalizeWorkbenchAssetType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["character", "role", "person", "cast"].includes(normalized)) return "character";
  if (["scene", "location", "set"].includes(normalized)) return "scene";
  if (["style", "look", "style_anchor"].includes(normalized)) return "style";
  return "prop";
}

function textArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function workbenchSourceKindForPath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").toLowerCase();
  if (!normalized) return "manual_definition";
  if (/(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/.test(normalized)) return "provider_temp_output";
  if (/(^|\/)(failed|failures?)(\/|$)/.test(normalized)) return "failed_output";
  if (/(^|\/)(shot[-_ ]?outputs?|outputs\/shots)(\/|$)/.test(normalized)) return "shot_output";
  return "source_asset";
}

function portableWorkbenchPath(value) {
  const normalized = runtimeRelativeFromValue(value);
  if (!normalized) return undefined;
  if (normalized.startsWith("../") || normalized === "..") return undefined;
  return normalized;
}

function workbenchAssetFromRecord(item, type, sourceRef, index) {
  if (!isRecord(item)) return undefined;
  const id = firstTextValue(item, ["id", "assetId", "roleId", "sceneId", "styleId"]) || `${type}_${index + 1}`;
  const pathValue = firstTextValue(item, ["mainReferencePath", "path", "sourcePath", "referencePath"]);
  const authority = isRecord(item.referenceAuthority) ? item.referenceAuthority : undefined;
  const authorityPath = firstTextValue(authority, ["path"]);
  const pathValuePortable = portableWorkbenchPath(pathValue) || portableWorkbenchPath(authorityPath);
  const status = normalizeWorkbenchStatus(
    firstTextValue(item, ["status", "visualMemoryStatus", "lockedStatus"])
      || firstTextValue(authority, ["lockedStatus"])
      || (pathValuePortable && workbenchSourceKindForPath(pathValuePortable) !== "source_asset" ? "candidate" : undefined),
  );
  const name = firstTextValue(item, ["displayName", "name", "title", "label"]) || id;
  const textConstraints = uniqueStrings([
    ...textArray(item.mustPreserve),
    ...textArray(item.spatialAnchors),
    ...textArray(item.textConstraints),
    firstTextValue(item, ["description", "positive"]),
    ...textArray(item.mustAvoid).map((value) => `避免 ${value}`),
    firstTextValue(item, ["negative"]) ? `避免 ${firstTextValue(item, ["negative"])}` : undefined,
  ]);
  return {
    id,
    type,
    name,
    status,
    path: pathValuePortable,
    sourceKind: workbenchSourceKindForPath(pathValuePortable),
    textConstraints,
    usedByShotIds: textArray(item.usedByShotIds),
    sourceRefs: [sourceRef],
    rejectedReason: firstTextValue(item, ["rejectedReason"]) || firstTextValue(authority, ["rejectedReason"]),
  };
}

function normalizeWorkbenchAssets(visualMemory) {
  const assets = [];
  if (!isRecord(visualMemory)) return assets;
  for (const [key, type] of [
    ["roles", "character"],
    ["characters", "character"],
    ["scenes", "scene"],
    ["props", "prop"],
    ["styles", "style"],
  ]) {
    const items = Array.isArray(visualMemory[key]) ? visualMemory[key] : [];
    items.forEach((item, index) => {
      const asset = workbenchAssetFromRecord(item, type, `visual_memory.${key}:${index}`, index);
      if (asset) assets.push(asset);
    });
  }
  if (isRecord(visualMemory.style)) {
    const asset = workbenchAssetFromRecord(visualMemory.style, "style", "visual_memory.style", 0);
    if (asset) assets.push(asset);
  }
  const genericAssets = Array.isArray(visualMemory.assets) ? visualMemory.assets : [];
  genericAssets.forEach((item, index) => {
    const asset = workbenchAssetFromRecord(item, normalizeWorkbenchAssetType(item?.assetType || item?.type), `visual_memory.assets:${index}`, index);
    if (asset) assets.push(asset);
  });
  const seen = new Set();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

function normalizeWorkbenchStorySections(storyFlow, shots) {
  if (!isRecord(storyFlow)) return [];
  const explicitSections = Array.isArray(storyFlow.sections) ? storyFlow.sections : [];
  const sections = explicitSections
    .filter(isRecord)
    .map((section, index) => {
      const nestedShots = Array.isArray(section.shots) ? section.shots : [];
      const shotIds = textArray(section.shotIds).length
        ? textArray(section.shotIds)
        : nestedShots.filter(isRecord).map((shot) => firstTextValue(shot, ["id", "shotId"])).filter(Boolean);
      const id = firstTextValue(section, ["id", "sectionId", "actId"]) || `section_${index + 1}`;
      return {
        id,
        label: firstTextValue(section, ["label", "title", "name"]) || id,
        shotIds,
      };
    })
    .filter((section) => section.shotIds.length);
  if (sections.length) return sections;

  const byScene = new Map();
  for (const shot of shots) {
    const sectionId = shot.sceneId || shot.sectionId || "current_project";
    if (!byScene.has(sectionId)) {
      byScene.set(sectionId, {
        id: sectionId,
        label: sectionId === "current_project" ? "当前项目故事流" : sectionId,
        shotIds: [],
      });
    }
    byScene.get(sectionId).shotIds.push(shot.id);
  }
  return Array.from(byScene.values());
}

function normalizeWorkbenchStoryShots(storyFlow) {
  if (!isRecord(storyFlow)) return [];
  const directShots = Array.isArray(storyFlow.shots) ? storyFlow.shots : [];
  const sectionShots = (Array.isArray(storyFlow.sections) ? storyFlow.sections : [])
    .filter(isRecord)
    .flatMap((section) => Array.isArray(section.shots) ? section.shots.map((shot) => ({ shot, section })) : []);
  const normalized = [];
  const seen = new Set();
  for (const [index, entry] of [...directShots.map((shot) => ({ shot, section: undefined })), ...sectionShots].entries()) {
    const shot = entry.shot;
    if (!isRecord(shot)) continue;
    const id = firstTextValue(shot, ["id", "shotId"]) || `S${String(index + 1).padStart(2, "0")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const sectionId = firstTextValue(shot, ["sectionId", "sceneId"])
      || firstTextValue(entry.section, ["id", "sectionId", "actId"])
      || "current_project";
    normalized.push({
      id,
      title: firstTextValue(shot, ["title", "name", "label"]) || id,
      storyFunction: firstTextValue(shot, ["storyFunction", "action", "description"]) || "当前项目故事流",
      actId: firstTextValue(shot, ["actId"]) || "current",
      sectionId,
      sceneId: firstTextValue(shot, ["sceneId"]),
      roleIds: textArray(shot.roleIds),
      startFrame: portableWorkbenchPath(firstTextValue(shot, ["startFrame", "startFramePath", "imagePath"])),
      endFrame: portableWorkbenchPath(firstTextValue(shot, ["endFrame", "endFramePath"])),
      status: firstTextValue(shot, ["status"]),
      issues: textArray(shot.issues),
    });
  }
  return normalized;
}

function currentProjectWorkbenchFacts(source, projectFacts) {
  const storyFact = projectFact("story_flow", source.storyFlowPath, ["story_flow"]);
  const visualMemoryFact = projectFact("visual_memory", source.visualMemoryPath, ["visual_memory"]);
  const sourceIndexFact = projectFact("source_index", source.sourceIndexPath, ["source_index"]);
  const storyShots = storyFact.readable ? normalizeWorkbenchStoryShots(storyFact.parsed) : [];
  const storySections = storyFact.readable ? normalizeWorkbenchStorySections(storyFact.parsed, storyShots) : [];
  const visualAssets = visualMemoryFact.readable ? normalizeWorkbenchAssets(visualMemoryFact.parsed) : [];

  return {
    schemaVersion: "vibe_core_current_project_workbench_facts_v1",
    source: "current_project_files",
    project: projectIdentityFromSource(source),
    projectRoot: source.runRootRelativePath,
    projectVibePath: source.projectVibeRelativePath,
    sourceIndex: {
      present: sourceIndexFact.present,
      readable: sourceIndexFact.readable,
      path: sourceIndexFact.path,
      sourceIndexHash: firstTextValue(sourceIndexFact.parsed, ["sourceIndexHash"]),
      refs: Array.isArray(sourceIndexFact.parsed?.refs) ? sourceIndexFact.parsed.refs.filter((item) => typeof item === "string") : [],
    },
    storyFlow: {
      present: storyFact.present,
      readable: storyFact.readable,
      path: storyFact.path,
      shotCount: storyShots.length,
      sectionCount: storySections.length,
      sections: storySections,
      shots: storyShots,
    },
    visualMemory: {
      present: visualMemoryFact.present,
      readable: visualMemoryFact.readable,
      path: visualMemoryFact.path,
      assetCount: visualAssets.length,
      assets: visualAssets,
      summary: {
        locked: visualAssets.filter((asset) => asset.status === "locked").length,
        candidate: visualAssets.filter((asset) => asset.status === "candidate").length,
        needsReview: visualAssets.filter((asset) => asset.status === "needs_review").length,
        rejected: visualAssets.filter((asset) => asset.status === "rejected").length,
        missing: visualAssets.filter((asset) => asset.status === "missing").length,
      },
    },
    factsUsed: [
      ...projectFacts.factsUsed,
      ...(storyFact.readable ? [{ name: storyFact.name, path: storyFact.path, usedFor: storyFact.usedFor }] : []),
      ...(visualMemoryFact.readable ? [{ name: visualMemoryFact.name, path: visualMemoryFact.path, usedFor: visualMemoryFact.usedFor }] : []),
    ].filter((fact, index, facts) => facts.findIndex((item) => item.name === fact.name && item.path === fact.path) === index),
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
  };
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
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

function oneShotRequestInput(url, body) {
  const receipt = isRecord(body?.receipt) ? body.receipt : isRecord(body?.prepareReceipt) ? body.prepareReceipt : undefined;
  const requestedTransportMode = asString(url.searchParams.get("transportMode"))
    || requestBodyString(body, ["transportMode", "mode"])
    || asString(receipt?.transportMode);
  const rawSelectedShotIds = Array.isArray(body?.selectedShotIds)
    ? body.selectedShotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
  const selectedShotId = asString(url.searchParams.get("selectedShotId"))
    || requestBodyString(body, ["selectedShotId", "shotId"])
    || asString(receipt?.selectedShotId);
  const selectedShotIds = rawSelectedShotIds.length
    ? rawSelectedShotIds
    : selectedShotId
      ? [selectedShotId]
      : [];
  const imageCount = Number.isInteger(body?.imageCount) ? body.imageCount : Number.isInteger(receipt?.imageCount) ? receipt.imageCount : 1;
  return {
    selectedShotId,
    selectedShotIds,
    imageCount,
    expectedOutputPath: requestBodyString(body, ["expectedOutputPath", "outputPath"]) || asString(receipt?.expectedOutputPath),
    receipt,
    transportMode: requestedTransportMode,
    requestedTransportMode,
  };
}

function oneShotPathInsideRoot(candidatePath, rootPath) {
  if (typeof candidatePath !== "string" || !candidatePath.trim()) return false;
  if (typeof rootPath !== "string" || !rootPath.trim()) return false;
  const normalizedPath = normalizeRelativePath(candidatePath.trim());
  const normalizedRoot = normalizeRelativePath(rootPath.trim());
  if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) return false;
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function oneShotLockedReferences(workbenchFacts, shot) {
  const assets = Array.isArray(workbenchFacts.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [];
  const locked = assets.filter((asset) => asset.status === "locked");
  const shotRoleIds = new Set(Array.isArray(shot?.roleIds) ? shot.roleIds : []);
  const shotId = shot?.id;
  const sceneId = shot?.sceneId || shot?.sectionId;
  const characters = locked.filter(
    (asset) =>
      asset.type === "character" &&
      (shotRoleIds.has(asset.id) || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
  );
  const scenes = locked.filter(
    (asset) =>
      asset.type === "scene" &&
      (asset.id === sceneId || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
  );
  const styles = locked.filter((asset) => asset.type === "style");
  return { characters, scenes, styles };
}

function oneShotQaChecklist(shotId) {
  return [
    { id: "identity", label: "角色一致", required: true, status: "pending", shotId },
    { id: "scene", label: "场景一致", required: true, status: "pending", shotId },
    { id: "style", label: "风格一致", required: true, status: "pending", shotId },
    { id: "start_frame", label: "首帧可用", required: true, status: "pending", shotId },
  ];
}

const oneShotTransportModes = new Set(["manual", "codex_app_server", "codex_cli"]);
const oneShotExecutorModes = new Set(["mock_executor", "dry_run_executor", "real_provider_call"]);
const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key=|private[_-]?key|raw-secret)/i;
const secretKeyPattern = /(api[_-]?key|access[_-]?token|secret|password|bearer|credentialmaterial|rawcredential|private[_-]?key)/i;

function oneShotTransportMode(input) {
  const raw = String(input.transportMode || "").trim();
  if (!raw) return { mode: "manual", provided: false, valid: true };
  const normalized = raw.toLowerCase();
  return {
    mode: oneShotTransportModes.has(normalized) ? normalized : "manual",
    raw,
    provided: true,
    valid: oneShotTransportModes.has(normalized),
  };
}

function oneShotExecutorMode(input) {
  const raw = String(input.executorMode || input.mode || "").trim();
  if (!raw) return { mode: "dry_run_executor", provided: false, valid: true };
  const normalized = raw.toLowerCase();
  return {
    mode: oneShotExecutorModes.has(normalized) ? normalized : "dry_run_executor",
    raw,
    provided: true,
    valid: oneShotExecutorModes.has(normalized),
  };
}

function oneShotExecutorRequestInput(url, body) {
  const input = oneShotRequestInput(url, body);
  const mode = requestBodyString(body, ["executorMode"])
    || asString(url.searchParams.get("executorMode"))
    || requestBodyString(body, ["mode"])
    || asString(url.searchParams.get("mode"));
  return {
    ...input,
    receiptId: asString(url.searchParams.get("receiptId")) || requestBodyString(body, ["receiptId"]),
    executorMode: mode,
    mode,
    actualExecutionAllowed: body?.actualExecutionAllowed === true,
    providerCallAllowed: body?.providerCallAllowed === true,
    liveSubmitAllowed: body?.liveSubmitAllowed === true,
    realProviderGate: isRecord(body?.realProviderGate) ? body.realProviderGate : undefined,
    rawBody: isRecord(body) ? body : {},
  };
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

function oneShotStatePaths(shotRoot) {
  const stateRoot = `${shotRoot}/state`;
  return {
    stateRoot,
    receiptStatePath: `${stateRoot}/prepare-receipt.json`,
    handoffStatePath: `${stateRoot}/handoff-packet.json`,
  };
}

function writeOneShotStateJson(relativePath, payload, stateRoot, sandboxRoot) {
  if (!oneShotPathInsideRoot(relativePath, sandboxRoot) || !oneShotPathInsideRoot(relativePath, stateRoot)) {
    throw new Error(`Refusing to write one-shot state outside sandbox: ${relativePath}`);
  }
  const filePath = scopedRepoPath(relativePath);
  const stateRootPath = scopedRepoPath(stateRoot);
  const sandboxRootPath = scopedRepoPath(sandboxRoot);
  const stateRootWithSep = `${stateRootPath}${path.sep}`;
  if (filePath !== stateRootPath && !filePath.startsWith(stateRootWithSep)) {
    throw new Error(`Refusing to write one-shot state outside shot state root: ${relativePath}`);
  }
  const dirPath = path.dirname(filePath);
  mkdirSync(dirPath, { recursive: true });
  const dirRealPath = realpathSync(dirPath);
  const stateRootRealPath = realpathSync(stateRootPath);
  const sandboxRootRealPath = realpathSync(sandboxRootPath);
  if ((dirRealPath !== stateRootRealPath && !dirRealPath.startsWith(`${stateRootRealPath}${path.sep}`))
    || (stateRootRealPath !== sandboxRootRealPath && !stateRootRealPath.startsWith(`${sandboxRootRealPath}${path.sep}`))
    || (sandboxRootRealPath !== repoRootRealPath && !sandboxRootRealPath.startsWith(`${repoRootRealPath}${path.sep}`))) {
    throw new Error(`Refusing to write one-shot state through an unsafe real path: ${relativePath}`);
  }
  const tempPath = path.join(dirPath, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function oneShotStateJson(relativePath, stateRoot, sandboxRoot) {
  if (!oneShotPathInsideRoot(relativePath, sandboxRoot) || !oneShotPathInsideRoot(relativePath, stateRoot)) return undefined;
  return readRuntimeJson(relativePath);
}

function oneShotReceiptMatches(candidate, receipt) {
  return isRecord(candidate)
    && candidate.schemaVersion === receipt.schemaVersion
    && candidate.receiptId === receipt.receiptId
    && candidate.status === "prepared"
    && candidate.projectId === receipt.projectId
    && candidate.projectRoot === receipt.projectRoot
    && candidate.selectedShotId === receipt.selectedShotId
    && candidate.expectedOutputPath === receipt.expectedOutputPath;
}

function oneShotHandoffMatches(candidate, receipt) {
  return isRecord(candidate)
    && candidate.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1"
    && candidate.packetId === `handoff_${receipt.receiptId}`
    && candidate.status === "ready_for_manual_transport"
    && candidate.receiptId === receipt.receiptId
    && candidate.projectId === receipt.projectId
    && candidate.projectRoot === receipt.projectRoot
    && candidate.selectedShotId === receipt.selectedShotId
    && candidate.expectedOutputPath === receipt.expectedOutputPath;
}

function oneShotTransportPlan(mode, {
  projectId,
  projectRoot,
  selectedShotId,
  expectedOutputPath,
  providerObservationPath,
  semanticQaPath,
  handoffPacketPath,
  receiptStatePath,
  handoffStatePath,
  receiptId,
  requestedTransportMode,
  transportModeAllowed,
}) {
  const base = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_transport_plan_v1",
    mode,
    requestedTransportMode,
    transportModeAllowed,
    projectId,
    projectRoot,
    selectedShotId,
    receiptId,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    receiptStatePath,
    handoffStatePath,
    actualExecutionAllowed: false,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
    projectVibeWritten: false,
    requiresActionTimeConfirmation: true,
    outputMustReturnVia: "expected_output_and_sidecars",
  };
  if (mode === "codex_app_server") {
    return {
      ...base,
      target: "codex_app_server",
      endpoint: "/api/codex/app-server/image2/one-shot",
      requiredFields: ["projectId", "projectRoot", "receiptId", "selectedShotId", "expectedOutputPath", "providerObservationPath", "semanticQaPath", "receiptStatePath", "handoffStatePath"],
      externalCallPreparedOnly: true,
    };
  }
  if (mode === "codex_cli") {
    return {
      ...base,
      target: "codex_cli",
      commandTemplate: ["codex", "image", "one-shot", "--receipt", "<receiptStatePath>", "--handoff", "<handoffStatePath>"],
      command: "codex",
      args: ["image", "one-shot", "--receipt", receiptStatePath, "--handoff", handoffStatePath],
      cwd: repoRoot,
      externalCommandPreparedOnly: true,
    };
  }
  return {
    ...base,
    target: "manual",
    manualTransportRequired: true,
  };
}

function currentProjectImage2OneShotResponse(action, input, extra = {}, source = currentProjectSource()) {
  const projection = projectProjectionFromSource(source);
  const { project, projectFacts } = projection;
  const workbenchFacts = currentProjectWorkbenchFacts(source, projectFacts);
  const shots = Array.isArray(workbenchFacts.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
  const selectedShotId = input.selectedShotId;
  const selectedShotIds = input.selectedShotIds || [];
  const selectedShot = shots.find((shot) => shot.id === selectedShotId);
  const sandboxRoot = `${source.runRootRelativePath}/real-trigger-one-shot`;
  const shotRoot = `${sandboxRoot}/${safePathSegment(selectedShotId)}`;
  const statePaths = oneShotStatePaths(shotRoot);
  const expectedOutputPath = input.expectedOutputPath || `${shotRoot}/image2-start.png`;
  const providerObservationPath = `${shotRoot}/provider_observations/image2-start-provider-observation.json`;
  const semanticQaPath = `${shotRoot}/semantic_qa/image2-start-semantic-qa.json`;
  const handoffPacketPath = `${shotRoot}/handoff/image2-start-handoff-packet.json`;
  const manifestPath = `${shotRoot}/manifest.json`;
  const qaReportPath = `${shotRoot}/qa/semantic-qa.json`;
  const persistedReceipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const persistedHandoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const persistedTransportMode = asString(input.receipt?.transportMode)
    || asString(persistedReceipt?.transportMode)
    || asString(persistedHandoff?.transportPlan?.mode);
  const transport = oneShotTransportMode({
    ...input,
    transportMode: asString(input.transportMode) || persistedTransportMode,
  });
  const lockedReferences = selectedShot ? oneShotLockedReferences(workbenchFacts, selectedShot) : { characters: [], scenes: [], styles: [] };
  const outputPathSafe = oneShotPathInsideRoot(expectedOutputPath, source.runRootRelativePath)
    && oneShotPathInsideRoot(expectedOutputPath, sandboxRoot);
  const sidecarPathsSafe = [
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    manifestPath,
    qaReportPath,
    statePaths.receiptStatePath,
    statePaths.handoffStatePath,
  ]
    .every((item) => oneShotPathInsideRoot(item, sandboxRoot));
  const oneShotOnly = selectedShotIds.length === 1 && selectedShotIds[0] === selectedShotId && input.imageCount === 1;
  const blockers = uniqueStrings([
    projection.ok ? "" : "Current project runtime projection is unavailable.",
    selectedShotId ? "" : "Select one shot before preparing a sample.",
    selectedShotIds.length === 1 ? "" : "Image2 one-shot requires exactly one selected shot.",
    input.imageCount === 1 ? "" : "Image2 one-shot requires exactly one image.",
    selectedShot ? "" : "Selected shot was not found in the current project story flow.",
    outputPathSafe ? "" : "Expected output path must stay inside the current project one-shot sandbox.",
    sidecarPathsSafe ? "" : "Observation, QA, manifest, and handoff paths must stay inside the one-shot sandbox.",
    lockedReferences.characters.length ? "" : "Locked character reference is required for this shot.",
    lockedReferences.scenes.length ? "" : "Locked scene reference is required for this shot.",
    lockedReferences.styles.length ? "" : "Locked style reference is required for this shot.",
  ]);
  const receiptId = `image2_one_shot_prepare_${safePathSegment(project.projectId || "project")}_${safePathSegment(selectedShotId)}_${safePathSegment(project.runId || "run")}`;
  const transportPlan = oneShotTransportPlan(transport.mode, {
    projectId: project.projectId,
    projectRoot: project.projectRoot,
    selectedShotId,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    receiptStatePath: statePaths.receiptStatePath,
    handoffStatePath: statePaths.handoffStatePath,
    receiptId,
    requestedTransportMode: transport.raw || input.requestedTransportMode,
    transportModeAllowed: transport.valid,
  });
  const receipt = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_receipt_v1",
    receiptId,
    status: blockers.length ? "blocked" : "prepared",
    action: "prepare",
    generatedAt: new Date().toISOString(),
    projectId: project.projectId,
    projectRoot: project.projectRoot,
    projectVibePath: project.projectVibePath,
    selectedShotId,
    selectedShotIds,
    imageCount: input.imageCount,
    oneShotOnly,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    transportMode: transport.mode,
    transportPlan,
    sandbox: {
      root: sandboxRoot,
      shotRoot,
      allowedPrefixes: [sandboxRoot, shotRoot],
      manifestPath,
      qaReportPath,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
      outsideRootWriteAllowed: false,
    },
    lockedReferences: {
      characters: lockedReferences.characters.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
      scenes: lockedReferences.scenes.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
      styles: lockedReferences.styles.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
    },
    qaChecklist: oneShotQaChecklist(selectedShotId),
    policy: {
      providerCalled: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      providerSubmitAllowed: 0,
      automaticSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      artifactFileMutationAllowed: false,
      statePersistenceAllowed: true,
      confirmationRequired: true,
    },
    blockers,
  };
  const receiptMatches = input.receipt
    && input.receipt.receiptId === receipt.receiptId
    && input.receipt.selectedShotId === selectedShotId
    && input.receipt.expectedOutputPath === expectedOutputPath
    && input.receipt.status === "prepared";
  const confirmBlockers = action === "confirm"
    ? uniqueStrings([
      ...blockers,
      input.receipt ? "" : "Action-time prepare receipt is required before confirmation.",
      receiptMatches ? "" : "Action-time prepare receipt must match the current project, shot, and output path.",
      oneShotOnly ? "" : "Confirmation is limited to one shot and one image.",
    ])
    : blockers;
  const confirmed = action === "confirm" && confirmBlockers.length === 0;
  const outputExists = runtimePathExists(expectedOutputPath);
  const semanticQa = readRuntimeJson(semanticQaPath);
  const semantic = semanticQaSummary(semanticQa);
  const persistedReceiptUsable = action === "status"
    && oneShotReceiptMatches(persistedReceipt, receipt);
  const persistedHandoffUsable = action === "status"
    && persistedReceiptUsable
    && oneShotHandoffMatches(persistedHandoff, receipt)
    && persistedHandoff.providerCalled === false
    && persistedHandoff.liveSubmitAllowed === false;
  const handoffPacket = {
    packetId: `handoff_${receipt.receiptId}`,
    schemaVersion: "vibe_core_current_project_image2_one_shot_handoff_packet_v1",
    receiptId: receipt.receiptId,
    projectId: project.projectId,
    projectRoot: project.projectRoot,
    selectedShotId,
    selectedShotIds,
    imageCount: input.imageCount,
    status: "ready_for_manual_transport",
    createdAt: new Date().toISOString(),
    requiresExternalAction: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
    projectVibeWritten: false,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    receiptStatePath: statePaths.receiptStatePath,
    handoffStatePath: statePaths.handoffStatePath,
    transportPlan,
    appServerContract: {
      mode: "codex_app_server_handoff_only",
      selectedShotId,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      qaChecklistPath: qaReportPath,
      manualTransportRequired: true,
      automaticSubmitAllowed: false,
      actualExecutionAllowed: false,
    },
  };
  if (action === "prepare" && confirmBlockers.length === 0) {
    writeOneShotStateJson(statePaths.receiptStatePath, receipt, statePaths.stateRoot, sandboxRoot);
  }
  if (confirmed) {
    writeOneShotStateJson(statePaths.receiptStatePath, receipt, statePaths.stateRoot, sandboxRoot);
    writeOneShotStateJson(statePaths.handoffStatePath, handoffPacket, statePaths.stateRoot, sandboxRoot);
  }
  const receiptForResponse = persistedReceiptUsable ? persistedReceipt : receipt;
  const handoffForResponse = confirmed ? handoffPacket : persistedHandoffUsable ? persistedHandoff : undefined;
  const status = confirmBlockers.length
    ? "blocked"
    : outputExists && (semantic.passed || semantic.needsReview || semantic.present)
      ? "needs_review"
      : handoffForResponse
        ? "handoff_prepared"
        : action === "prepare" || persistedReceiptUsable
          ? "prepared"
          : "ready_to_prepare";
  const userLabel = status === "prepared"
    ? "确认生成"
    : status === "handoff_prepared"
      ? "等待文件"
      : status === "needs_review"
        ? "需要复核"
        : status === "blocked"
          ? "待补齐"
          : "生成小样";

  return {
    ok: confirmBlockers.length === 0,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_handoff_only",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    }),
    endpoint: action === "confirm"
      ? currentProjectImage2OneShotConfirmEndpoint
      : action === "prepare"
        ? currentProjectImage2OneShotPrepareEndpoint
        : currentProjectImage2OneShotStatusEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot",
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
      selectedShotId,
    },
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    identity: {
      projectId: project.projectId,
      projectRoot: project.projectRoot,
    },
    project,
    status,
    uiStatus: status,
    userLabel,
    selectedShotId,
    selectedShotIds,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    statePaths,
    receipt: receiptForResponse,
    handoffPacket: handoffForResponse,
    transportPlan,
    persistedState: {
      receiptPresent: persistedReceiptUsable || (action === "prepare" && confirmBlockers.length === 0) || confirmed,
      handoffPresent: persistedHandoffUsable || confirmed,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
    },
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      outputExists,
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: Boolean(semanticQa),
      semanticQaPassed: semantic.passed,
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: true,
    },
    previewProjection: {
      shotId: selectedShotId,
      status: outputExists ? (semantic.needsReview ? "needs_review" : "returned") : handoffForResponse ? "waiting_file" : "not_started",
      imageUrl: outputExists ? runtimeFileUrl(expectedOutputPath) : undefined,
      reviewRequired: semantic.needsReview,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      manualTransportRequired: true,
      dryRunOnly: true,
      noWorkerSpawn: true,
      artifactFileMutationAllowed: false,
      statePersistenceAllowed: true,
    },
    providerCalled: false,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers: confirmBlockers,
    message: confirmBlockers.length ? "小样暂时受阻，请补齐镜头、引用或输出位置。" : undefined,
    ...extra,
  };
}

function inspectForRawCredentialMaterial(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return rawSecretValuePattern.test(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => inspectForRawCredentialMaterial(item));
  return Object.entries(value).some(([key, child]) => {
    if (key !== "credentialRef" && secretKeyPattern.test(key)) return true;
    return inspectForRawCredentialMaterial(child);
  });
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function oneShotExecutorPathInsideSandbox(relativePath, sandboxRoot, shotRoot) {
  return oneShotPathInsideRoot(relativePath, sandboxRoot) && oneShotPathInsideRoot(relativePath, shotRoot);
}

function assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot) {
  if (!oneShotExecutorPathInsideSandbox(relativePath, sandboxRoot, shotRoot)) {
    throw new Error(`Refusing to write outside one-shot executor sandbox: ${relativePath}`);
  }
  if (path.basename(relativePath) === "project.vibe" || normalizeRelativePath(relativePath).includes("/project.vibe")) {
    throw new Error(`Refusing to mutate project.vibe from executor: ${relativePath}`);
  }
  const filePath = scopedRepoPath(relativePath);
  const sandboxPath = scopedRepoPath(sandboxRoot);
  const shotPath = scopedRepoPath(shotRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const dirRealPath = realpathSync(path.dirname(filePath));
  const sandboxRealPath = realpathSync(sandboxPath);
  const shotRealPath = realpathSync(shotPath);
  const sandboxWithSep = `${sandboxRealPath}${path.sep}`;
  const shotWithSep = `${shotRealPath}${path.sep}`;
  if ((dirRealPath !== sandboxRealPath && !dirRealPath.startsWith(sandboxWithSep))
    || (dirRealPath !== shotRealPath && !dirRealPath.startsWith(shotWithSep))
    || (sandboxRealPath !== repoRootRealPath && !sandboxRealPath.startsWith(`${repoRootRealPath}${path.sep}`))) {
    throw new Error(`Refusing to write through unsafe executor real path: ${relativePath}`);
  }
  if (existsSync(filePath)) {
    const fileRealPath = realpathSync(filePath);
    if ((fileRealPath !== sandboxRealPath && !fileRealPath.startsWith(sandboxWithSep))
      || (fileRealPath !== shotRealPath && !fileRealPath.startsWith(shotWithSep))) {
      throw new Error(`Refusing to overwrite unsafe executor path: ${relativePath}`);
    }
  }
  return filePath;
}

function writeOneShotExecutorJson(relativePath, payload, sandboxRoot, shotRoot) {
  const filePath = assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function writeOneShotExecutorBytes(relativePath, bytes, sandboxRoot, shotRoot) {
  const filePath = assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, bytes);
  renameSync(tempPath, filePath);
  return filePath;
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  if (!candidatePath || !rootPath) return false;
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

function assertCurrentProjectRuntimeWritePath(relativePath, source) {
  const normalized = normalizeRelativePath(relativePath || "");
  if (!oneShotPathInsideRoot(normalized, source.runRootRelativePath)) {
    throw new Error(`Refusing to write return projection outside current project root: ${relativePath}`);
  }
  if (path.basename(normalized) === "project.vibe" || normalized.includes("/project.vibe")) {
    throw new Error(`Refusing to mutate project.vibe from provider return ingestion: ${relativePath}`);
  }
  const filePath = scopedRepoPath(normalized);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const dirRealPath = realpathSync(path.dirname(filePath));
  const runRootRealPath = realpathSync(source.runRootPath);
  if (!isPathInsideRealRoot(dirRealPath, runRootRealPath)) {
    throw new Error(`Refusing to write through unsafe project return path: ${relativePath}`);
  }
  return filePath;
}

function writeCurrentProjectRuntimeJson(relativePath, payload, source) {
  const filePath = assertCurrentProjectRuntimeWritePath(relativePath, source);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function upsertByShotId(items, item) {
  const existingItems = Array.isArray(items) ? items.filter(isRecord) : [];
  const index = existingItems.findIndex((candidate) => candidate.shotId === item.shotId);
  if (index >= 0) {
    existingItems[index] = { ...existingItems[index], ...item };
    return existingItems;
  }
  return [...existingItems, item];
}

function currentProjectOneShotReturnProjection(source, {
  generatedAt,
  project,
  receipt,
  handoff,
  expectedOutputPath,
  providerObservationPath,
  semanticQaPath,
  manifestPath,
  qaReportPath,
  outputSha256,
  imageInfo,
  sourceImagePath,
  providerName,
}) {
  const shotId = receipt.selectedShotId;
  const runtimeItem = {
    shotId,
    status: "needs_review",
    expectedOutputPath,
    outputSha256,
    imageInfo,
    providerObservationPath,
    semanticQaPath,
    blockers: [],
  };
  const clip = {
    order: 1,
    shotId,
    mediaPath: expectedOutputPath,
    status: "returned_with_review_overlay",
    previewQaStatus: "needs_review_overlay",
    productionQaStatus: "needs_review",
    durationSeconds: 5,
  };
  const observation = {
    order: 1,
    shotId,
    expectedOutputPath,
    outputSha256,
    imageInfo,
    qaStatus: "needs_review",
    previewQaStatus: "needs_review_overlay",
    productionQaStatus: "needs_review",
    reviewOverlay: true,
    blockers: [],
  };
  const runtimeTruth = {
    ...(readRuntimeJson(source.runtimeTruthLayerRelativePath) || {}),
    schemaVersion: "runtime_truth_layer_v1",
    generatedAt,
    status: "real_image2_one_shot_returned_needs_review",
    items: upsertByShotId(readRuntimeJson(source.runtimeTruthLayerRelativePath)?.items, runtimeItem),
  };
  const previewPlan = {
    ...(readRuntimeJson(source.previewPlanRelativePath) || {}),
    schemaVersion: "preview_plan_v1",
    generatedAt,
    status: "real_image2_one_shot_returned_needs_review",
    previewStatus: "real_image2_one_shot_returned_needs_review",
    productionStatus: "needs_review",
    reviewOverlayShots: uniqueStrings([
      ...(readRuntimeJson(source.previewPlanRelativePath)?.reviewOverlayShots || []),
      shotId,
    ]),
    productionNeedsReviewShots: uniqueStrings([
      ...(readRuntimeJson(source.previewPlanRelativePath)?.productionNeedsReviewShots || []),
      shotId,
    ]),
    clips: upsertByShotId(readRuntimeJson(source.previewPlanRelativePath)?.clips, clip),
  };
  const report = {
    ...(readRuntimeJson(source.reportRelativePath) || {}),
    schemaVersion: "current_project_real_image2_one_shot_return_v1",
    generatedAt,
    projectId: project.projectId,
    runId: project.runId || `${safePathSegment(project.projectId || "project")}_one_shot_return`,
    status: "real_image2_one_shot_returned_needs_review",
    previewStatus: "real_image2_one_shot_returned_needs_review",
    productionStatus: "needs_review",
    providerCalled: true,
    actualImage2Triggered: true,
    realProviderAttemptCount: 1,
    seedanceOrJimengUsed: false,
    fastOrVipUsed: false,
    videoGenerated: false,
    reviewOverlayShots: uniqueStrings([
      ...(readRuntimeJson(source.reportRelativePath)?.reviewOverlayShots || []),
      shotId,
    ]),
    productionNeedsReviewShots: uniqueStrings([
      ...(readRuntimeJson(source.reportRelativePath)?.productionNeedsReviewShots || []),
      shotId,
    ]),
    blockers: [],
    observations: upsertByShotId(readRuntimeJson(source.reportRelativePath)?.observations, observation),
    latestOneShotReturn: {
      shotId,
      provider: providerName,
      sourceImagePath,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      outputSha256,
      status: "needs_review",
    },
  };
  return { runtimeTruth, previewPlan, report };
}

function realProviderGateSatisfied(gate) {
  return isRecord(gate)
    && gate.explicitUserConfirmed === true
    && gate.allowRealProviderCall === true
    && gate.confirmationScope === "single_image2_one_shot"
    && gate.maxProviderCalls === 1
    && gate.mainThreadFinalConfirmation === true;
}

function oneShotExecutorChecks({ modeInfo, input, receipt, handoff, sandboxRoot, shotRoot, expectedOutputPath, providerObservationPath, semanticQaPath, manifestPath, qaReportPath }) {
  const receiptPolicy = isRecord(receipt?.policy) ? receipt.policy : {};
  const transportPlan = isRecord(handoff?.transportPlan) ? handoff.transportPlan : {};
  const appServerContract = isRecord(handoff?.appServerContract) ? handoff.appServerContract : {};
  const requestedOutputPath = input.expectedOutputPath ? normalizeRelativePath(input.expectedOutputPath) : undefined;
  const requestedUnsafeFlags = input.rawBody?.liveSubmitAllowed === true
    || input.rawBody?.providerCalled === true
    || input.rawBody?.externalNetworkIoAllowed === true
    || input.rawBody?.workerSpawnAllowed === true
    || input.rawBody?.projectVibeWritten === true;
  const checks = [
    ["mode_allowlisted", modeInfo.valid, "Executor mode must be mock_executor, dry_run_executor, or explicitly gated real_provider_call."],
    ["persisted_prepare_receipt_present", isRecord(receipt), "Persisted prepare receipt is required."],
    ["persisted_handoff_packet_present", isRecord(handoff), "Persisted handoff packet is required."],
    ["prepare_receipt_schema", receipt?.schemaVersion === "vibe_core_current_project_image2_one_shot_receipt_v1", "Persisted prepare receipt schema is not recognized."],
    ["prepare_receipt_status", receipt?.status === "prepared", "Persisted prepare receipt must have status=prepared."],
    ["handoff_schema", handoff?.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1", "Persisted handoff packet schema is not recognized."],
    ["handoff_status", handoff?.status === "ready_for_manual_transport", "Persisted handoff packet must have status=ready_for_manual_transport."],
    ["handoff_receipt_id_matches", handoff?.receiptId === receipt?.receiptId, "Handoff receiptId must match the persisted prepare receipt."],
    ["handoff_packet_id_matches", handoff?.packetId === `handoff_${receipt?.receiptId || ""}`, "Handoff packetId must derive from receiptId."],
    ["selected_shot_matches", handoff?.selectedShotId === receipt?.selectedShotId, "Handoff selectedShotId must match the persisted prepare receipt."],
    ["expected_output_matches", normalizeRelativePath(handoff?.expectedOutputPath || "") === normalizeRelativePath(receipt?.expectedOutputPath || ""), "Handoff expectedOutputPath must match the persisted prepare receipt."],
    ["request_selected_shot_matches", !input.selectedShotId || input.selectedShotId === handoff?.selectedShotId, "Requested selectedShotId must match persisted handoff packet."],
    ["request_receipt_id_matches", !input.receiptId || input.receiptId === receipt?.receiptId, "Requested receiptId must match persisted prepare receipt."],
    ["request_expected_output_matches", !requestedOutputPath || requestedOutputPath === normalizeRelativePath(expectedOutputPath || ""), "Requested expectedOutputPath must match persisted handoff packet."],
    ["one_shot_only", receipt?.oneShotOnly === true && receipt?.imageCount === 1, "Executor contract only consumes one shot and one image per handoff."],
    ["sandbox_root_present", Boolean(sandboxRoot), "Persisted prepare receipt sandbox.root is required."],
    ["shot_root_inside_sandbox", oneShotPathInsideRoot(shotRoot, sandboxRoot), "Persisted prepare receipt shotRoot must stay inside sandbox.root."],
    ["expected_output_inside_sandbox", oneShotExecutorPathInsideSandbox(expectedOutputPath, sandboxRoot, shotRoot), "Expected output path must stay inside the one-shot sandbox."],
    ["provider_observation_inside_sandbox", oneShotExecutorPathInsideSandbox(providerObservationPath, sandboxRoot, shotRoot), "Provider observation path must stay inside the one-shot sandbox."],
    ["semantic_qa_inside_sandbox", oneShotExecutorPathInsideSandbox(semanticQaPath, sandboxRoot, shotRoot), "Semantic QA path must stay inside the one-shot sandbox."],
    ["manifest_inside_sandbox", oneShotExecutorPathInsideSandbox(manifestPath, sandboxRoot, shotRoot), "Manifest path must stay inside the one-shot sandbox."],
    ["qa_report_inside_sandbox", oneShotExecutorPathInsideSandbox(qaReportPath, sandboxRoot, shotRoot), "QA report path must stay inside the one-shot sandbox."],
    ["receipt_state_inside_sandbox", oneShotExecutorPathInsideSandbox(receipt?.sandbox?.receiptStatePath, sandboxRoot, shotRoot), "Receipt state path must stay inside the one-shot sandbox."],
    ["handoff_state_inside_sandbox", oneShotExecutorPathInsideSandbox(receipt?.sandbox?.handoffStatePath, sandboxRoot, shotRoot), "Handoff state path must stay inside the one-shot sandbox."],
    ["transport_mode_codex_app_server", transportPlan.mode === "codex_app_server", "Executor can only consume codex_app_server handoff transport."],
    ["transport_target_codex_app_server", transportPlan.target === "codex_app_server", "Executor can only consume codex_app_server target handoffs."],
    ["transport_endpoint_codex_app_server", transportPlan.endpoint === "/api/codex/app-server/image2/one-shot", "Codex app-server handoff endpoint drifted."],
    ["transport_prepared_only", transportPlan.externalCallPreparedOnly === true, "Codex app-server handoff must remain prepared-only before executor consumption."],
    ["app_server_contract_mode", appServerContract.mode === "codex_app_server_handoff_only", "App-server contract mode must remain handoff-only."],
    ["requires_external_action", handoff?.requiresExternalAction === true, "Handoff packet must require an external action boundary."],
    ["receipt_provider_called_false", receiptPolicy.providerCalled === false, "Persisted prepare receipt must keep providerCalled=false."],
    ["receipt_provider_submit_zero", receiptPolicy.providerSubmitAllowed === 0, "Persisted prepare receipt must keep providerSubmitAllowed=0."],
    ["receipt_automatic_submit_false", receiptPolicy.automaticSubmitAllowed === false, "Persisted prepare receipt must keep automaticSubmitAllowed=false."],
    ["receipt_live_submit_false", receiptPolicy.liveSubmitAllowed === false, "Persisted prepare receipt must keep liveSubmitAllowed=false."],
    ["receipt_external_network_false", receiptPolicy.externalNetworkIoAllowed === false, "Persisted prepare receipt must keep externalNetworkIoAllowed=false."],
    ["receipt_worker_spawn_forbidden", receiptPolicy.workerSpawnForbidden === true, "Persisted prepare receipt must keep workerSpawnForbidden=true."],
    ["receipt_project_vibe_not_written", receiptPolicy.projectVibeWritten === false, "Persisted prepare receipt must keep projectVibeWritten=false."],
    ["handoff_provider_called_false", handoff?.providerCalled === false, "Persisted handoff packet must keep providerCalled=false."],
    ["handoff_live_submit_false", handoff?.liveSubmitAllowed === false, "Persisted handoff packet must keep liveSubmitAllowed=false."],
    ["handoff_worker_spawn_forbidden", handoff?.workerSpawnForbidden === true, "Persisted handoff packet must keep workerSpawnForbidden=true."],
    ["handoff_project_vibe_not_written", handoff?.projectVibeWritten === false, "Persisted handoff packet must keep projectVibeWritten=false."],
    ["transport_actual_execution_false", transportPlan.actualExecutionAllowed === false, "Handoff transport plan must keep actualExecutionAllowed=false."],
    ["transport_provider_called_false", transportPlan.providerCalled === false, "Handoff transport plan must keep providerCalled=false."],
    ["transport_live_submit_false", transportPlan.liveSubmitAllowed === false, "Handoff transport plan must keep liveSubmitAllowed=false."],
    ["transport_worker_spawn_forbidden", transportPlan.workerSpawnForbidden === true, "Handoff transport plan must keep workerSpawnForbidden=true."],
    ["app_server_manual_transport_required", appServerContract.manualTransportRequired === true, "App-server contract must require manual transport."],
    ["app_server_automatic_submit_false", appServerContract.automaticSubmitAllowed === false, "App-server contract must keep automaticSubmitAllowed=false."],
    ["app_server_actual_execution_false", appServerContract.actualExecutionAllowed === false, "App-server contract must keep actualExecutionAllowed=false."],
    ["request_does_not_escalate_locks", requestedUnsafeFlags === false, "Executor request body must not attempt live submit, provider call, worker spawn, network I/O, or project.vibe mutation."],
    ["raw_credentials_absent", !inspectForRawCredentialMaterial(input.rawBody) && !inspectForRawCredentialMaterial(receipt) && !inspectForRawCredentialMaterial(handoff), "Raw credential material is forbidden; executor may only see scoped references."],
  ];
  if (modeInfo.mode === "real_provider_call") {
    checks.push(
      ["real_provider_gate_satisfied", realProviderGateSatisfied(input.realProviderGate), "Real provider call mode requires an explicit single-call main-thread gate."],
      ["real_provider_runtime_blocked", false, "Real provider execution remains blocked in this runtime adapter until a live provider implementation is explicitly enabled."],
    );
  }
  return checks.map(([checkId, passed, blocker]) => ({
    checkId,
    status: passed ? "passed" : "blocked",
    blocker: passed ? undefined : blocker,
  }));
}

function oneShotExecutorContract(input, context) {
  const checks = oneShotExecutorChecks({ input, ...context });
  const blockers = uniqueStrings(checks.map((item) => item.blocker));
  const outputReturned = context.outputReturned === true && context.modeInfo.mode === "mock_executor" && blockers.length === 0;
  const status = blockers.length
    ? "blocked"
    : outputReturned
      ? "mock_output_returned_needs_review"
      : context.modeInfo.mode === "mock_executor"
        ? "executor_ready_mock"
        : "dry_run_executor_ready";
  return {
    schemaVersion: "0.1.0",
    generatedAt: context.generatedAt,
    phase: "real_image2_executor_adapter_contract",
    mode: context.modeInfo.mode,
    status,
    selectedShotId: context.handoff?.selectedShotId || context.receipt?.selectedShotId,
    receiptId: context.handoff?.receiptId || context.receipt?.receiptId,
    expectedOutputPath: context.expectedOutputPath,
    checks,
    outputReturnContract: {
      expectedOutputPath: context.expectedOutputPath,
      sandboxRoot: context.sandboxRoot,
      shotRoot: context.shotRoot,
      providerObservationPath: context.providerObservationPath,
      semanticQaPath: context.semanticQaPath,
      manifestPath: context.manifestPath,
      qaReportPath: context.qaReportPath,
      watcherProjection: {
        expectedOutputDetected: outputReturned,
        watcherStarted: false,
        daemonStarted: false,
        source: context.modeInfo.mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
      },
      providerObservation: {
        providerId: "openai-image2-api",
        providerObservationMode: outputReturned ? "mock_readiness_evidence" : "not_observed",
        providerCalled: false,
        externalNetworkCallMade: false,
      },
      manifest: {
        manifestMatched: outputReturned,
        status: outputReturned ? "mock_output_present" : "not_written",
      },
      semanticQa: {
        semanticReviewMode: outputReturned ? "mock_executor_semantic_review" : "not_observed",
        status: outputReturned ? "needs_review" : "not_written",
      },
      previewProjection: {
        status,
        needsHumanReview: outputReturned,
      },
    },
    providerCallContract: {
      maxProviderCallsPerExecution: 1,
      providerCallsAttempted: 0,
      providerCalled: false,
      externalNetworkIoAllowed: false,
      rawCredentialAccessAllowed: false,
      workerSpawnAllowed: false,
      projectVibeMutationAllowed: false,
      realProviderCallRequiresExplicitGate: true,
      realProviderGateSatisfied: realProviderGateSatisfied(input.realProviderGate),
    },
    blockers,
    warnings: uniqueStrings([
      context.modeInfo.mode === "mock_executor" ? "Mock executor may write only test output and sidecars inside the one-shot sandbox." : "",
      context.modeInfo.mode === "dry_run_executor" ? "Dry-run executor validates the handoff but does not write output files." : "",
      outputReturned ? "Mock output is review evidence only and is not a real provider result." : "",
    ]),
    notes: [
      "Executor input must be the persisted prepare receipt plus persisted handoff packet.",
      "The adapter allows at most one provider call by contract, but this mock/dry-run implementation attempts zero provider calls.",
      "Completion must flow through output, provider observation, manifest, semantic QA, and preview projection evidence.",
    ],
  };
}

function actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256) {
  if (!isRecord(providerObservation)) return false;
  const provider = String(providerObservation.provider || providerObservation.providerId || "");
  const outputPath = runtimeRelativeFromValue(providerObservation.outputPath);
  const observedHash = asString(providerObservation.outputSha256) || asString(providerObservation.outputHash);
  return providerObservation.providerObservationMode === "actual_provider_call_observed"
    && /image2/i.test(provider)
    && outputPath === expectedOutputPath
    && observedHash === outputSha256
    && providerObservation.providerCalled === true
    && providerObservation.actualImage2Triggered === true;
}

function actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256) {
  if (!isRecord(semanticQa)) return false;
  const outputPath = runtimeRelativeFromValue(semanticQa.outputPath) || runtimeRelativeFromValue(semanticQa.expectedOutputPath);
  const reviewedHash = asString(semanticQa.reviewedOutputSha256) || asString(semanticQa.outputSha256);
  const status = semanticQa.finalAssessment?.status || semanticQa.qaStatus || semanticQa.status;
  return semanticQa.semanticReviewMode === "actual_image_semantic_review"
    && outputPath === expectedOutputPath
    && reviewedHash === outputSha256
    && status === "needs_review";
}

function readReturnedJson(inputObject, inputPath) {
  if (isRecord(inputObject)) return inputObject;
  return inputPath ? readRuntimeJson(inputPath) : undefined;
}

function currentProjectImage2OneShotExecutorResponse(input, extra = {}, source = currentProjectSource()) {
  const generatedAt = new Date().toISOString();
  const modeInfo = oneShotExecutorMode(input);
  const statusProjection = currentProjectImage2OneShotResponse("status", {
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds,
    imageCount: input.imageCount,
  }, {}, source);
  const statePaths = statusProjection.statePaths || {};
  const sandboxRoot = statusProjection.receipt?.sandbox?.root;
  const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
  const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
  const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
  const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
  const manifestPath = receipt?.sandbox?.manifestPath || `${shotRoot}/manifest.json`;
  const qaReportPath = receipt?.sandbox?.qaReportPath || `${shotRoot}/qa/semantic-qa.json`;
  const contextBase = {
    generatedAt,
    modeInfo,
    receipt,
    handoff,
    sandboxRoot,
    shotRoot,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
  };
  const preflightContract = oneShotExecutorContract(input, { ...contextBase, outputReturned: false });

  let outputSha256;
  let outputBytesWritten = 0;
  let providerObservation;
  let semanticQa;
  let manifest;
  let qaReport;
  let writeError;

  if (preflightContract.blockers.length === 0 && modeInfo.mode === "mock_executor") {
    try {
      const mockPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
      const outputFilePath = writeOneShotExecutorBytes(expectedOutputPath, mockPng, sandboxRoot, shotRoot);
      outputBytesWritten = mockPng.length;
      outputSha256 = sha256File(outputFilePath);
      const executorRunId = `mock_image2_executor_${safePathSegment(receipt.receiptId)}_${Date.now()}`;
      providerObservation = {
        schemaVersion: "vibe_core_real_image2_executor_provider_observation_v1",
        generatedAt,
        provider: "openai-image2-api",
        providerId: "openai-image2-api",
        providerObservationMode: "mock_readiness_evidence",
        executorMode: "mock_executor",
        executorRunId,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        handoffPacketId: handoff.packetId,
        outputPath: expectedOutputPath,
        outputSha256,
        outputBytes: outputBytesWritten,
        providerCalled: false,
        providerCallsAttempted: 0,
        maxProviderCallsPerExecution: 1,
        externalNetworkCallMade: false,
        rawCredentialMaterialSeen: false,
        workerSpawned: false,
        projectVibeWritten: false,
        notes: ["Mock executor evidence only; no external Image2 provider was called."],
      };
      semanticQa = {
        schemaVersion: "vibe_core_real_image2_executor_semantic_qa_v1",
        generatedAt,
        reviewedAt: generatedAt,
        semanticReviewMode: "mock_executor_semantic_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        reviewedOutputSha256: outputSha256,
        status: "needs_review",
        finalAssessment: {
          status: "needs_review",
          reason: "Mock executor output proves sandbox return plumbing only; human review is still required.",
        },
        gates: {
          identity: "warn",
          scene: "warn",
          style: "warn",
          story: "warn",
          neighbor: "warn",
          output: "pass",
        },
        providerCalled: false,
      };
      manifest = {
        schemaVersion: "vibe_core_real_image2_executor_manifest_v1",
        generatedAt,
        status: "mock_output_present",
        manifestMatched: true,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        expectedOutputPath,
        actualOutputPath: expectedOutputPath,
        outputSha256,
        providerObservationPath,
        semanticQaPath,
        qaReportPath,
        providerCalled: false,
        externalNetworkCallMade: false,
        items: [
          {
            shotId: receipt.selectedShotId,
            expectedOutputPath,
            actualOutputPath: expectedOutputPath,
            outputSha256,
            status: "mock_output_returned_needs_review",
          },
        ],
      };
      qaReport = {
        schemaVersion: "vibe_core_real_image2_executor_qa_report_v1",
        generatedAt,
        status: "needs_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        outputSha256,
        semanticQaPath,
        providerObservationPath,
        manifestPath,
        providerCalled: false,
        summary: "Mock executor returned output and sidecars to the sandbox; formal semantic QA remains a human review step.",
      };
      writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(manifestPath, manifest, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(qaReportPath, qaReport, sandboxRoot, shotRoot);
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Mock executor sandbox write failed.";
    }
  }

  const outputReturned = Boolean(outputSha256 && runtimePathExists(expectedOutputPath));
  const contract = oneShotExecutorContract(input, { ...contextBase, outputReturned });
  const blockers = uniqueStrings([
    ...contract.blockers,
    writeError,
  ]);
  const status = blockers.length ? "blocked" : contract.status;
  const ok = blockers.length === 0;
  const previewStatus = status === "mock_output_returned_needs_review"
    ? "mock_output_returned_needs_review"
    : status === "executor_ready_mock"
      ? "executor_ready_mock"
      : status === "dry_run_executor_ready"
        ? "dry_run_executor_ready"
        : "blocked";

  return {
    ok,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_executor_adapter",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      dryRunOnly: modeInfo.mode !== "real_provider_call",
    }),
    endpoint: currentProjectImage2OneShotExecuteMockEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot_executor_adapter",
    currentProject: statusProjection.currentProject,
    requestContext: {
      ...statusProjection.requestContext,
      selectedShotId: input.selectedShotId,
      receiptId: input.receiptId,
      executorMode: modeInfo.mode,
      requestedExecutorMode: modeInfo.raw || input.mode,
    },
    projectRootMode: source.projectRootMode,
    projectRoot: statusProjection.projectRoot,
    projectId: statusProjection.projectId,
    project: statusProjection.project,
    status,
    uiStatus: status,
    userLabel: status === "mock_output_returned_needs_review" ? "需要复核" : status === "blocked" ? "待补齐" : "执行器就绪",
    actualImage2Triggered: false,
    selectedShotId: input.selectedShotId,
    expectedOutputPath,
    outputExists: runtimePathExists(expectedOutputPath),
    outputSha256,
    outputBytesWritten,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
    statePaths,
    receipt,
    handoffPacket: handoff,
    transportPlan: handoff?.transportPlan || statusProjection.transportPlan,
    executorEvidence: {
      consumedPersistedReceipt: isRecord(receipt),
      consumedPersistedHandoff: isRecord(handoff),
      mockProviderOnly: modeInfo.mode === "mock_executor",
      externalNetworkIoAllowed: false,
      formalPromotionAllowed: false,
    },
    executorContract: {
      ...contract,
      blockers,
      status,
      outputReturnContract: {
        ...contract.outputReturnContract,
        previewProjection: {
          ...contract.outputReturnContract.previewProjection,
          status: previewStatus,
          needsHumanReview: status === "mock_output_returned_needs_review",
        },
      },
    },
    providerObservation,
    semanticQa,
    manifest,
    qaReport,
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      outputExists: runtimePathExists(expectedOutputPath),
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: runtimePathExists(semanticQaPath),
      manifestPresent: runtimePathExists(manifestPath),
      qaReportPresent: runtimePathExists(qaReportPath),
      expectedOutputDetected: outputReturned,
      manifestMatched: Boolean(manifest?.manifestMatched),
      semanticQaStatus: semanticQa?.status,
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: false,
      source: modeInfo.mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
    },
    previewProjection: {
      shotId: input.selectedShotId,
      status: status === "mock_output_returned_needs_review" ? "needs_review" : previewStatus,
      imageUrl: outputReturned ? runtimeFileUrl(expectedOutputPath) : undefined,
      reviewRequired: status === "mock_output_returned_needs_review",
      providerCalled: false,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      realProviderCallAllowed: false,
      manualTransportRequired: true,
      dryRunOnly: modeInfo.mode !== "real_provider_call",
      noWorkerSpawn: true,
      sandboxFileMutationAllowed: modeInfo.mode === "mock_executor" && ok,
      projectVibeMutationAllowed: false,
      statePersistenceAllowed: false,
    },
    providerCalled: false,
    externalNetworkCallMade: false,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers,
    message: blockers.length ? "Image2 executor adapter blocked this request before any provider call." : undefined,
    ...extra,
  };
}

function currentProjectImage2OneShotReturnIngestResponse(input, extra = {}, source = currentProjectSource()) {
  const generatedAt = new Date().toISOString();
  const modeInfo = { mode: "dry_run_executor", provided: true, valid: true, raw: input.executorMode || input.mode };
  const statusProjection = currentProjectImage2OneShotResponse("status", {
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds,
    imageCount: input.imageCount,
  }, {}, source);
  const statePaths = statusProjection.statePaths || {};
  const sandboxRoot = statusProjection.receipt?.sandbox?.root;
  const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
  const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
  const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
  const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
  const manifestPath = receipt?.sandbox?.manifestPath || `${shotRoot}/manifest.json`;
  const qaReportPath = receipt?.sandbox?.qaReportPath || `${shotRoot}/qa/semantic-qa.json`;
  const contextBase = {
    generatedAt,
    modeInfo,
    receipt,
    handoff,
    sandboxRoot,
    shotRoot,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
  };
  const preflightContract = oneShotExecutorContract(input, { ...contextBase, outputReturned: false });

  let outputSha256;
  let outputBytesWritten = 0;
  let providerObservation = readReturnedJson(input.providerObservation, input.returnedProviderObservationPath) || readRuntimeJson(providerObservationPath);
  let semanticQa = readReturnedJson(input.semanticQa, input.returnedSemanticQaPath) || readRuntimeJson(semanticQaPath);
  let manifest;
  let qaReport;
  let projections;
  let writeError;

  const returnedOutputPath = runtimeRelativeFromValue(input.returnedOutputPath) || expectedOutputPath;
  const hasReturnedOutput = runtimePathExists(returnedOutputPath);
  const outputSourceInsideProject = oneShotPathInsideRoot(returnedOutputPath, source.runRootRelativePath);
  const outputSourceIsExpected = returnedOutputPath === expectedOutputPath;

  if (preflightContract.blockers.length === 0 && input.actualProviderReturned === true && hasReturnedOutput && outputSourceInsideProject) {
    try {
      const sourceOutputPath = scopedRepoPath(returnedOutputPath);
      const outputBytes = readFileSync(sourceOutputPath);
      if (!outputSourceIsExpected) {
        writeOneShotExecutorBytes(expectedOutputPath, outputBytes, sandboxRoot, shotRoot);
      }
      outputBytesWritten = outputBytes.length;
      outputSha256 = sha256Bytes(outputBytes);
      providerObservation = {
        ...(isRecord(providerObservation) ? providerObservation : {}),
        schemaVersion: "vibe_core_real_image2_executor_provider_observation_v1",
        generatedAt,
        provider: providerObservation?.provider || providerObservation?.providerId || "openai-image2-api",
        providerId: providerObservation?.providerId || providerObservation?.provider || "openai-image2-api",
        providerObservationMode: "actual_provider_call_observed",
        executorMode: "external_provider_return",
        executorRunId: `real_image2_return_${safePathSegment(receipt.receiptId)}_${Date.now()}`,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        handoffPacketId: handoff.packetId,
        sourceOutputPath: returnedOutputPath,
        outputPath: expectedOutputPath,
        outputSha256,
        outputBytes: outputBytesWritten,
        providerCalled: true,
        actualImage2Triggered: true,
        providerCallsAttempted: 1,
        maxProviderCallsPerExecution: 1,
        externalNetworkCallMade: true,
        rawCredentialMaterialSeen: false,
        workerSpawned: false,
        projectVibeWritten: false,
      };
      semanticQa = {
        ...(isRecord(semanticQa) ? semanticQa : {}),
        schemaVersion: "vibe_core_real_image2_executor_semantic_qa_v1",
        generatedAt,
        reviewedAt: semanticQa?.reviewedAt || generatedAt,
        semanticReviewMode: "actual_image_semantic_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        expectedOutputPath,
        outputSha256,
        reviewedOutputSha256: outputSha256,
        status: "needs_review",
        qaStatus: "needs_review",
        finalAssessment: {
          ...(isRecord(semanticQa?.finalAssessment) ? semanticQa.finalAssessment : {}),
          status: "needs_review",
        },
        providerCalled: true,
        actualImage2Triggered: true,
      };
      manifest = {
        schemaVersion: "vibe_core_real_image2_executor_manifest_v1",
        generatedAt,
        status: "real_provider_returned_needs_review",
        manifestMatched: true,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        expectedOutputPath,
        actualOutputPath: expectedOutputPath,
        sourceOutputPath: returnedOutputPath,
        outputSha256,
        providerObservationPath,
        semanticQaPath,
        qaReportPath,
        providerCalled: true,
        actualImage2Triggered: true,
        externalNetworkCallMade: true,
        items: [
          {
            shotId: receipt.selectedShotId,
            expectedOutputPath,
            actualOutputPath: expectedOutputPath,
            outputSha256,
            status: "real_provider_returned_needs_review",
          },
        ],
      };
      qaReport = {
        schemaVersion: "vibe_core_real_image2_executor_qa_report_v1",
        generatedAt,
        status: "needs_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        outputSha256,
        semanticQaPath,
        providerObservationPath,
        manifestPath,
        providerCalled: true,
        actualImage2Triggered: true,
        summary: "Actual Image2 provider return was ingested into the one-shot sandbox and remains needs_review.",
      };
      writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(manifestPath, manifest, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(qaReportPath, qaReport, sandboxRoot, shotRoot);
      projections = currentProjectOneShotReturnProjection(source, {
        generatedAt,
        project: statusProjection.project,
        receipt,
        handoff,
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
        manifestPath,
        qaReportPath,
        outputSha256,
        imageInfo: { bytes: outputBytesWritten, sha256: outputSha256 },
        sourceImagePath: returnedOutputPath,
        providerName: providerObservation.provider,
      });
      writeCurrentProjectRuntimeJson(source.runtimeTruthLayerRelativePath, projections.runtimeTruth, source);
      writeCurrentProjectRuntimeJson(source.previewPlanRelativePath, projections.previewPlan, source);
      writeCurrentProjectRuntimeJson(source.reportRelativePath, projections.report, source);
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Real provider return ingest failed.";
    }
  } else if (runtimePathExists(expectedOutputPath)) {
    outputSha256 = sha256File(scopedRepoPath(expectedOutputPath));
  }

  providerObservation = readRuntimeJson(providerObservationPath) || providerObservation;
  semanticQa = readRuntimeJson(semanticQaPath) || semanticQa;
  const hashBoundActual = Boolean(
    outputSha256
      && runtimePathExists(expectedOutputPath)
      && actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256)
      && actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256),
  );
  const blockers = uniqueStrings([
    ...preflightContract.blockers,
    writeError,
    input.actualProviderReturned === true || hashBoundActual ? "" : "Actual provider return requires actualProviderReturned=true or existing actual hash-bound sidecars.",
    hasReturnedOutput || runtimePathExists(expectedOutputPath) ? "" : "Returned provider output file is required.",
    outputSourceInsideProject ? "" : "Returned provider output must stay inside the current project root.",
    outputSha256 ? "" : "Returned provider output must be hashable.",
    hashBoundActual ? "" : "Actual provider return must include hash-bound provider observation and semantic QA sidecars.",
  ]);
  const ok = blockers.length === 0;
  const status = ok ? "real_provider_returned_needs_review" : preflightContract.blockers.length ? "blocked" : "dry_run_executor_ready";
  const contract = {
    ...preflightContract,
    status,
    blockers,
    outputReturnContract: {
      ...preflightContract.outputReturnContract,
      watcherProjection: {
        ...preflightContract.outputReturnContract.watcherProjection,
        expectedOutputDetected: hashBoundActual,
        source: hashBoundActual ? "actual_provider_return_ingest" : "dry_run_projection_only",
      },
      providerObservation: {
        providerId: providerObservation?.providerId || providerObservation?.provider || "openai-image2-api",
        providerObservationMode: hashBoundActual ? "actual_provider_call_observed" : "not_observed",
        providerCalled: hashBoundActual,
        externalNetworkCallMade: hashBoundActual,
      },
      manifest: {
        manifestMatched: hashBoundActual,
        status: hashBoundActual ? "real_provider_returned_needs_review" : "not_written",
      },
      semanticQa: {
        semanticReviewMode: hashBoundActual ? "actual_image_semantic_review" : "not_observed",
        status: hashBoundActual ? "needs_review" : "not_written",
      },
      previewProjection: {
        status,
        needsHumanReview: hashBoundActual,
      },
    },
  };

  return {
    ok,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_execute_return",
      providerCalled: hashBoundActual,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      dryRunOnly: !hashBoundActual,
    }),
    endpoint: currentProjectImage2OneShotExecuteReturnEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot_execute_return",
    currentProject: statusProjection.currentProject,
    requestContext: {
      ...statusProjection.requestContext,
      selectedShotId: input.selectedShotId,
      receiptId: input.receiptId,
      executorMode: "external_provider_return",
    },
    projectRootMode: source.projectRootMode,
    projectRoot: statusProjection.projectRoot,
    projectId: statusProjection.projectId,
    project: statusProjection.project,
    status,
    uiStatus: ok ? "needs_review" : status,
    userLabel: ok ? "需要复核" : "回流检查",
    actualImage2Triggered: hashBoundActual,
    selectedShotId: input.selectedShotId,
    expectedOutputPath,
    returnedOutputPath,
    outputExists: runtimePathExists(expectedOutputPath),
    outputSha256,
    outputBytesWritten,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
    statePaths,
    receipt,
    handoffPacket: handoff,
    transportPlan: handoff?.transportPlan || statusProjection.transportPlan,
    executorEvidence: {
      consumedPersistedReceipt: isRecord(receipt),
      consumedPersistedHandoff: isRecord(handoff),
      mockProviderOnly: false,
      externalProviderReturnOnly: true,
      formalPromotionAllowed: false,
      hashBoundActual,
    },
    executorContract: contract,
    providerObservation,
    semanticQa,
    manifest,
    qaReport,
    projections,
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      outputExists: runtimePathExists(expectedOutputPath),
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: runtimePathExists(semanticQaPath),
      manifestPresent: runtimePathExists(manifestPath),
      qaReportPresent: runtimePathExists(qaReportPath),
      expectedOutputDetected: hashBoundActual,
      manifestMatched: hashBoundActual,
      semanticQaStatus: semanticQa?.status || semanticQa?.qaStatus,
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: false,
      source: hashBoundActual ? "actual_provider_return_ingest" : "dry_run_projection_only",
    },
    previewProjection: {
      shotId: input.selectedShotId,
      status: ok ? "needs_review" : status,
      imageUrl: hashBoundActual ? runtimeFileUrl(expectedOutputPath) : undefined,
      reviewRequired: hashBoundActual,
      providerCalled: hashBoundActual,
      actualImage2Triggered: hashBoundActual,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      realProviderCallAllowed: false,
      manualTransportRequired: true,
      dryRunOnly: !hashBoundActual,
      noWorkerSpawn: true,
      sandboxFileMutationAllowed: input.actualProviderReturned === true && hashBoundActual,
      projectVibeMutationAllowed: false,
      statePersistenceAllowed: false,
    },
    providerCalled: hashBoundActual,
    externalNetworkCallMade: hashBoundActual,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers,
    message: ok ? undefined : "Image2 return executor did not find hash-bound actual provider output yet.",
    ...extra,
  };
}

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

function currentProjectSourceResult() {
  try {
    return { source: currentProjectSource() };
  } catch (error) {
    return {
      error,
      message: error instanceof Error ? error.message : "Current project root is unavailable.",
      unbound: error?.code === "CURRENT_PROJECT_UNBOUND",
      bindingState: error?.bindingState,
    };
  }
}

function requestOverrideDiagnostics(requestContext = {}) {
  return {
    ignoredProjectRootSource: requestContext.projectRootSource,
    ignoredProjectRootProvided: Boolean(requestContext.projectRoot),
    ignoredProjectIdSource: requestContext.projectIdSource,
    ignoredProjectIdProvided: Boolean(requestContext.projectId),
  };
}

function blockedCurrentProjectResponse(endpoint, requestContext = {}, extra = {}) {
  const projectRoot = requestContext.projectRoot;
  const projectId = requestContext.projectId;
  const identity = { projectId, projectRoot };
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint,
    source: "runtime_endpoint",
    sourceLabel: "runtime endpoint / current project blocked",
    requestContext: {
      ...requestOverrideDiagnostics(requestContext),
    },
    projectRootMode: "blocked_project_root",
    projectRoot,
    projectId,
    identity,
    project: identity,
    status: "blocked",
    previewStatus: "blocked",
    productionStatus: "blocked",
    reportStatus: "blocked",
    reportPath: undefined,
    reportRelativePath: undefined,
    reportUrl: undefined,
    reviewOverlayShots: [],
    productionNeedsReviewShots: [],
    shotCount: 0,
    blockerCount: 1,
    observations: [],
    previewItems: [],
    message: "Current project root is blocked or unavailable.",
    ...extra,
  };
}

function unboundCurrentProjectResponse(endpoint, requestContext = {}, extra = {}) {
  const bindingState = readCurrentProjectBinding();
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint,
    source: "runtime_endpoint",
    sourceLabel: "runtime endpoint / current project unbound",
    requestContext: {
      ...requestOverrideDiagnostics(requestContext),
    },
    currentProject: {
      bound: false,
      bindingPath: bindingState.bindingPathRelative,
    },
    projectRootMode: "unbound_current_project",
    projectRoot: undefined,
    projectId: undefined,
    identity: {},
    project: {},
    status: "unbound",
    previewStatus: "unavailable",
    productionStatus: "blocked",
    reportStatus: "unavailable",
    projectionSource: "unavailable",
    ledgerTruthSource: "unavailable",
    factsUsed: [],
    reportPath: undefined,
    reportRelativePath: undefined,
    reportUrl: undefined,
    image2ReportPath: undefined,
    runtimeTruthLayerPath: undefined,
    previewPlanPath: undefined,
    reviewOverlayShots: [],
    productionNeedsReviewShots: [],
    shotCount: 0,
    blockerCount: 1,
    observations: [],
    previewItems: [],
    message: "No current project is bound. Use POST /api/runtime/projects/select before reading current-project runtime truth.",
    ...extra,
  };
}

function currentProjectBindingStatusResponse(extra = {}) {
  const bindingState = readCurrentProjectBinding();
  if (!bindingState.bound) {
    return {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectBindingEndpoint,
      status: "unbound",
      currentProject: {
        bound: false,
        bindingPath: bindingState.bindingPathRelative,
      },
      ...extra,
    };
  }

  try {
    const source = currentProjectSource();
    const project = projectIdentityFromSource(source);
    return {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectBindingEndpoint,
      status: "bound",
      currentProject: {
        bound: true,
        bindingPath: bindingState.bindingPathRelative,
        binding: bindingState.binding,
        project,
        projectRoot: source.runRootRelativePath,
        projectRootRelativePath: source.runRootRelativePath,
        projectVibeRelativePath: source.projectVibeRelativePath,
      },
      ...extra,
    };
  } catch (error) {
    return {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectBindingEndpoint,
      status: "blocked",
      currentProject: {
        bound: true,
        bindingPath: bindingState.bindingPathRelative,
        binding: bindingState.binding,
      },
      message: error instanceof Error ? error.message : "Current project binding could not be resolved.",
      ...extra,
    };
  }
}

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

function currentProjectRealChainResponse(extra = {}, source = currentProjectSource()) {
  const projection = projectProjectionFromSource(source);
  const { project, projectFacts, observations } = projection;
  const needsReviewShotIds = projection.reviewShotIds;
  const primaryReportRelativePath = projectFacts.primaryReportRelativePath;
  const actualProviderReturned = observations.some((item) => item.providerObservationActual === true);

  return {
    ok: projection.ok,
    ...runtimePolicy({ providerCalled: actualProviderReturned }),
    endpoint: currentProjectStatusEndpoint,
    status: projection.ok ? projection.status : "unavailable",
    previewStatus: projection.ok ? projection.previewStatus : "unavailable",
    productionStatus: projection.ok ? projection.productionStatus : "unavailable",
    reportStatus: projection.ok ? projection.status : "unavailable",
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
    projectionKind: "project_real_chain_status",
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
    workbenchFacts: currentProjectWorkbenchFacts(source, projectFacts),
    project,
    plannedImageCount: observations.length,
    totalPlannedImages: observations.length,
    returnedImageCount: projection.returnedObservations.length,
    needsReviewCount: needsReviewShotIds.length,
    needsReviewShotIds,
    reviewShotIds: needsReviewShotIds,
    reviewOverlayShots: needsReviewShotIds,
    productionNeedsReviewShots: needsReviewShotIds,
    shotCount: observations.length,
    actualImage2Triggered: actualProviderReturned,
    providerCalled: actualProviderReturned,
    blockerCount: projection.blockedObservations.length,
    reportPath: primaryReportRelativePath,
    reportRelativePath: primaryReportRelativePath,
    reportUrl: runtimeFileUrl(primaryReportRelativePath),
    image2ReportPath: source.reportRelativePath,
    image2ReportRelativePath: source.reportRelativePath,
    runtimeTruthLayerPath: source.runtimeTruthLayerRelativePath,
    previewPlanPath: source.previewPlanRelativePath,
    observations,
    previewItems: observations.map((item) => ({
      shotId: item.shotId,
      order: item.order,
      imageUrl: item.imageUrl,
      mediaPath: item.expectedOutputPath,
      outputExists: item.outputExists,
      status: item.previewStatus,
      reviewOverlay: item.reviewOverlay === true,
      previewQaStatus: item.previewQaStatus,
      productionQaStatus: item.productionQaStatus,
      runtimeTruthStatus: item.runtimeTruthStatus,
      blockers: item.blockers,
    })),
    nextAction: projection.ok
      ? needsReviewShotIds.length
        ? "review_needed_outputs_before_production_promotion"
        : projection.blockedObservations.length
          ? "resolve_blockers_before_production_promotion"
          : "preview_projection_ready"
      : "provide_project_runtime_truth_or_preview_plan",
    message: projection.ok
      ? undefined
      : "Current project projection is unavailable. Provide runtime_truth_layer.json, preview_plan.json, run_manifest.json, or a compatibility report.",
    ...extra,
  };
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

function serveRuntimeFile(req, res, relativePath, options = {}) {
  if (!relativePath) {
    writeJson(res, 400, { ok: false, ...runtimePolicy(), status: "bad_request", message: "Missing file path." });
    return;
  }

  const normalizedRelativePath = normalizeRelativePath(relativePath);
  if (path.isAbsolute(normalizedRelativePath)) {
    writeRuntimeFileError(req, res, 403, {
      ok: false,
      ...runtimePolicy(),
      status: "forbidden",
      message: "Runtime files must be addressed by repository-relative paths.",
    }, normalizedRelativePath);
    return;
  }

  let filePath;
  let allowedRootPath;
  let allowedRootLabel;
  try {
    filePath = scopedRepoPath(normalizedRelativePath);
    if (options.scope === "real-demo-e2e-005") {
      const source = realDemo005Source();
      allowedRootPath = source.runRootPath;
      allowedRootLabel = source.runRootRelativePath;
    } else {
      const source = currentProjectSource();
      allowedRootPath = source.runRootPath;
      allowedRootLabel = source.runRootRelativePath;
    }
  } catch (error) {
    const unbound = error?.code === "CURRENT_PROJECT_UNBOUND";
    writeRuntimeFileError(req, res, unbound ? 409 : 403, {
      ok: false,
      ...runtimePolicy(),
      status: unbound ? "unbound" : "forbidden",
      message: error instanceof Error ? error.message : "Path is outside project root.",
    }, normalizedRelativePath);
    return;
  }

  const rootWithSep = `${allowedRootPath}${path.sep}`;
  if (filePath !== allowedRootPath && !filePath.startsWith(rootWithSep)) {
    writeRuntimeFileError(req, res, 403, {
      ok: false,
      ...runtimePolicy(),
      status: "forbidden",
      message: `Runtime file is outside the allowed project scope: ${allowedRootLabel}`,
    }, normalizedRelativePath);
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    writeRuntimeFileError(req, res, 404, {
      ok: false,
      ...runtimePolicy(),
      status: "not_found",
      message: `Runtime file not found: ${relativePath}`,
    }, normalizedRelativePath);
    return;
  }

  try {
    const fileRealPath = realpathSync(filePath);
    const rootRealPath = realpathSync(allowedRootPath);
    if (!pathWithinRoot(fileRealPath, rootRealPath)) {
      writeRuntimeFileError(req, res, 403, {
        ok: false,
        ...runtimePolicy(),
        status: "forbidden",
        message: "Runtime file symlink escapes the allowed project scope.",
      }, normalizedRelativePath);
      return;
    }
  } catch (error) {
    writeRuntimeFileError(req, res, 403, {
      ok: false,
      ...runtimePolicy(),
      status: "forbidden",
      message: error instanceof Error ? error.message : "Runtime file could not be resolved safely.",
    }, normalizedRelativePath);
    return;
  }

  res.writeHead(200, corsHeaders(contentTypeFor(filePath), res.runtimeAllowedOrigin));
  createReadStream(filePath).pipe(res);
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

function handleCurrentProjectRunCheck(res, source, extra = {}) {
  const projectFacts = readProjectFacts(source);
  const payload = currentProjectRealChainResponse({
    ...extra,
    running,
    command: {
      mode: "read_only_projection_check",
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
      workerSpawnForbidden: true,
    },
  }, source);
  writeJson(res, payload.ok === false ? 500 : 200, payload);
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
    || pathname === currentProjectImage2OneShotExecuteMockEndpoint
    || pathname === currentProjectImage2OneShotReturnEndpoint
    || pathname === currentProjectImage2OneShotExecuteReturnEndpoint;
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
  const body = isRecord(bodyResult.body) ? bodyResult.body : {};
  const projectRoot = requestBodyString(body, ["projectRoot", "projectRootPath"]);
  const projectId = requestBodyString(body, ["projectId"]);
  const displayName = requestBodyString(body, ["displayName", "name"]);

  try {
    const { bindingPath, binding, source } = writeCurrentProjectBinding({ projectRoot, projectId, displayName });
    const project = projectIdentityFromSource(source);
    writeJson(res, 200, {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectSelectEndpoint,
      status: "bound",
      currentProject: {
        bound: true,
        bindingPath: pathWithinRoot(bindingPath, repoRoot) ? repoRelativePath(bindingPath) : bindingPath,
        binding,
        project,
        projectRoot: source.runRootRelativePath,
        projectRootRelativePath: source.runRootRelativePath,
        projectVibeRelativePath: source.projectVibeRelativePath,
      },
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
    });
  } catch (error) {
    writeJson(res, 403, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectSelectEndpoint,
      status: "blocked",
      currentProject: {
        bound: false,
      },
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      message: error instanceof Error ? error.message : "Current project selection was blocked.",
      todo: "External user project roots are intentionally fail-closed until the runtime boundary is expanded safely.",
    });
  }
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
        currentProjectImage2OneShotExecuteMockEndpoint,
        currentProjectImage2OneShotReturnEndpoint,
        currentProjectImage2OneShotExecuteReturnEndpoint,
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
    handleCurrentProjectRunCheck(res, routeContext.source, {
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    });
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
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotExecuteMockEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotExecuteMockEndpoint);
    if (!routeContext) return;
    const input = oneShotExecutorRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotExecutorResponse(input, {
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
