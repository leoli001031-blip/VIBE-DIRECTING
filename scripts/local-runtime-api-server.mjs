import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
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
const currentProjectStatusEndpoint = `${runtimeBasePath}/projects/current/real-chain/status`;
const currentProjectRunEndpoint = `${runtimeBasePath}/projects/current/real-chain/run-check`;
const currentProjectImage2BatchPlanEndpoint = `${runtimeBasePath}/projects/current/image2-batch/plan`;
const currentProjectImage2BatchRunCheckEndpoint = `${runtimeBasePath}/projects/current/image2-batch/run-check`;
const realDemo005StatusEndpoint = `${runtimeBasePath}/real-demo-e2e/005/status`;
const realDemo005RunEndpoint = `${runtimeBasePath}/real-demo-e2e/005/run`;
const runtimeFileEndpoint = `${runtimeBasePath}/files`;
const legacyStatusEndpoint = "/api/real-demo-e2e/005/status";
const legacyRunEndpoint = "/api/real-demo-e2e/005/run";

let running = false;

function corsHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-vibe-project-root,x-vibe-project-id,x-project-root,x-project-id",
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  };
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

function writeRuntimeFileError(req, res, statusCode, payload, relativePath) {
  const contentType = contentTypeFor(relativePath || "");
  if (isMediaContentType(contentType) && acceptsMedia(req)) {
    res.writeHead(statusCode, {
      ...corsHeaders(contentType),
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
    providerCalled: false,
    prepareRan: false,
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
  return {
    present: true,
    actual,
    status,
    passed: actual && status === "pass",
    needsReview: actual && status === "needs_review",
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
    const expectedOutputPath = runtimeRelativeFromValue(shotPlan.expectedOutputPath)
      || runtimeRelativeFromValue(previewClip.mediaPath)
      || runtimeRelativeFromValue(reportObservation.expectedOutputPath)
      || `${source.runRootRelativePath}/outputs/shots/${shotId}/start.png`;
    const providerObservationPath = runtimeRelativeFromValue(shotPlan.providerObservationPath)
      || derivedShotPath(source, shotId, "provider_observations", "_start_provider_observation", "json");
    const semanticQaPath = runtimeRelativeFromValue(shotPlan.semanticQaPath)
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

  return {
    ok: projection.ok,
    ...runtimePolicy(),
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
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  res.writeHead(statusCode, corsHeaders());
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

  res.writeHead(200, corsHeaders(contentTypeFor(filePath)));
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
      verifyScriptRan: false,
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
    || pathname === currentProjectStatusEndpoint
    || pathname === currentProjectRunEndpoint
    || pathname === currentProjectImage2BatchPlanEndpoint
    || pathname === currentProjectImage2BatchRunCheckEndpoint;
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
  return { requestContext, source: sourceResult.source };
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
          currentProjectRunEndpoint,
          currentProjectImage2BatchPlanEndpoint,
          currentProjectImage2BatchRunCheckEndpoint,
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
  if (req.method === "GET" && (url.pathname === realDemo005StatusEndpoint || url.pathname === legacyStatusEndpoint)) {
    writeJson(res, 200, responseFromReport({ running }));
    return;
  }
  if (req.method === "POST" && (url.pathname === realDemo005RunEndpoint || url.pathname === legacyRunEndpoint)) {
    void handleRun(res);
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
