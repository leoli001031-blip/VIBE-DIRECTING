import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const host = process.env.VIBE_CORE_RUNTIME_API_HOST || "127.0.0.1";
const port = Number(process.env.VIBE_CORE_RUNTIME_API_PORT || 8790);
const sandboxRunRootRelativePath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames";
const sandboxProjectVibeRelativePath = `${sandboxRunRootRelativePath}/project/project.vibe`;
const sandboxReportRelativePath = `${sandboxRunRootRelativePath}/reports/image2_start_long_chain_report.json`;
const verifyScript = path.join(repoRoot, "scripts/real-demo-e2e-005-anime-image2-start-verify.mjs");
const maxOutputChars = 8000;

const runtimeBasePath = "/api/runtime";
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
    "access-control-allow-headers": "content-type",
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
  return candidate;
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

  const reportInput = options.reportPath || process.env.VIBE_CORE_CURRENT_PROJECT_REPORT || process.env.VIBE_CORE_PROJECT_REPORT;
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
    reportPath,
    reportRelativePath: repoRelativePath(reportPath),
    projectRootMode: options.projectRootMode || "configured_project_root",
    sourceLabel: options.sourceLabel || "runtime endpoint / project projection",
    sandboxSource: options.sandboxSource,
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
  const configuredProjectRoot = process.env.VIBE_CORE_CURRENT_PROJECT_ROOT || process.env.VIBE_CORE_PROJECT_ROOT;
  if (configuredProjectRoot) {
    return resolveProjectSource(configuredProjectRoot, {
      projectRootMode: "configured_project_root",
      sourceLabel: "runtime endpoint / current project",
    });
  }
  return resolveProjectSource(sandboxRunRootRelativePath, {
    projectRootMode: "sandbox_fixture_projection",
    sourceLabel: "runtime endpoint / project projection",
    sandboxSource: "005 sandbox",
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

function clip(value) {
  const text = String(value || "");
  if (text.length <= maxOutputChars) return text;
  return `${text.slice(0, maxOutputChars)}\n...[clipped ${text.length - maxOutputChars} chars]`;
}

function runtimeFileUrl(relativePath) {
  return `${runtimeFileEndpoint}?path=${encodeURIComponent(relativePath)}`;
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
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
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

function observationSummary(item) {
  const expectedOutputPath = typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined;
  return {
    order: item.order,
    shotId: item.shotId,
    expectedOutputPath,
    imageUrl: expectedOutputPath ? runtimeFileUrl(expectedOutputPath) : undefined,
    previewQaStatus: item.previewQaStatus,
    productionQaStatus: item.productionQaStatus,
    reviewOverlay: item.reviewOverlay === true,
    runtimeTruthStatus: item.runtimeTruthStatus,
    blockers: Array.isArray(item.blockers) ? item.blockers : [],
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
  };
}

function image2BatchLedgerProjection(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const projections = items.map((item) => {
    const blocked = item.blocked === true || (Array.isArray(item.blockers) && item.blockers.length > 0);
    return {
      taskRunId: item.taskRunId,
      envelopeId: item.envelopeId,
      currentStatus: blocked ? "parked" : "queued",
      expectedOutputPath: item.expectedOutputPath,
      expectedOutputs: [
        {
          expectedOutputPath: item.expectedOutputPath,
        },
      ],
      previewStatus: "missing",
      completeVerified: false,
    };
  });
  const parked = projections.filter((item) => item.currentStatus === "parked").length;

  return {
    schemaVersion: "vibe_core_current_project_image2_batch_ledger_projection_v1",
    projectId: payload.project?.projectId,
    runId: payload.project?.runId,
    projections,
    summary: {
      total: projections.length,
      queued: projections.length - parked,
      blocked: parked,
      parked,
      completeVerified: 0,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
  };
}

function unavailableResponse(extra = {}) {
  const source = extra.sourceProject || realDemo005Source();
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint: realDemo005StatusEndpoint,
    status: "unavailable",
    previewStatus: "unavailable",
    productionStatus: "unavailable",
    reportPath: source.reportPath,
    reportRelativePath: source.reportRelativePath,
    reportUrl: runtimeFileUrl(source.reportRelativePath),
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
      ? report.observations.map(observationSummary)
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
      reportUrl: runtimeFileUrl(source.reportRelativePath),
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

function currentProjectRealChainResponse(extra = {}) {
  const source = currentProjectSource();
  const payload = responseFromReport(extra, source);
  const needsReviewShotIds = Array.isArray(payload.productionNeedsReviewShots) && payload.productionNeedsReviewShots.length
    ? payload.productionNeedsReviewShots
    : Array.isArray(payload.reviewOverlayShots)
      ? payload.reviewOverlayShots
      : [];
  const observations = Array.isArray(payload.observations) ? payload.observations : [];

  return {
    ...payload,
    endpoint: currentProjectStatusEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    sandboxSource: source.sandboxSource,
    projectionKind: "project_real_chain_status",
    projectRootMode: source.projectRootMode,
    projectRootRelativePath: source.runRootRelativePath,
    projectVibeRelativePath: source.projectVibeRelativePath,
    project: readProjectVibe(source),
    plannedImageCount: Number(payload.shotCount) || observations.length,
    totalPlannedImages: Number(payload.shotCount) || observations.length,
    returnedImageCount: observations.filter((item) => typeof item.imageUrl === "string").length,
    needsReviewCount: needsReviewShotIds.length,
    needsReviewShotIds,
    reviewShotIds: needsReviewShotIds,
    reportPath: source.reportRelativePath,
    reportRelativePath: source.reportRelativePath,
    reportUrl: runtimeFileUrl(source.reportRelativePath),
    previewItems: observations.map((item) => ({
      shotId: item.shotId,
      order: item.order,
      imageUrl: item.imageUrl,
      reviewOverlay: item.reviewOverlay === true,
      previewQaStatus: item.previewQaStatus,
      productionQaStatus: item.productionQaStatus,
    })),
    nextAction: "review_needed_outputs_before_production_promotion",
    ...extra,
  };
}

function currentProjectImage2BatchPlanResponse(extra = {}) {
  const source = currentProjectSource();
  const report = readJsonIfPresent(source.reportPath);
  const reportObservations = Array.isArray(report?.observations)
    ? report.observations.map(observationSummary)
    : [];
  const selectedObservations = reportObservations.slice(0, 10);
  const manifest = readJsonIfPresent(path.join(source.runRootPath, "run_manifest.json"));
  const shotPlans = Array.isArray(manifest?.shotPlans) ? manifest.shotPlans : [];
  const items = selectedObservations.map((observation, index) => {
    const shotPlan = shotPlans.find((item) => item?.shotId === observation.shotId) || {};
    return image2BatchPlanItem(source, observation, index + 1, shotPlan);
  });
  const blockedItems = items.filter((item) => item.blocked);
  const payload = {
    ok: existsSync(source.reportPath),
    ...runtimePolicy({
      runMode: "read_only_image2_batch_plan_projection",
      verifyScriptRan: false,
      liveSubmitAllowed: false,
    }),
    endpoint: currentProjectImage2BatchPlanEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    sandboxSource: source.sandboxSource,
    projectionKind: "current_project_image2_batch_prepare_plan",
    projectRootMode: source.projectRootMode,
    projectRootRelativePath: source.runRootRelativePath,
    projectVibeRelativePath: source.projectVibeRelativePath,
    project: readProjectVibe(source),
    reportStatus: report?.status || "unavailable",
    reportPath: source.reportRelativePath,
    reportRelativePath: source.reportRelativePath,
    reportUrl: runtimeFileUrl(source.reportRelativePath),
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

function serveRuntimeFile(res, relativePath) {
  if (!relativePath) {
    writeJson(res, 400, { ok: false, ...runtimePolicy(), status: "bad_request", message: "Missing file path." });
    return;
  }

  let filePath;
  try {
    filePath = scopedRepoPath(relativePath);
  } catch (error) {
    writeJson(res, 403, {
      ok: false,
      ...runtimePolicy(),
      status: "forbidden",
      message: error instanceof Error ? error.message : "Path is outside project root.",
    });
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    writeJson(res, 404, {
      ok: false,
      ...runtimePolicy(),
      status: "not_found",
      message: `Runtime file not found: ${relativePath}`,
    });
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

function handleCurrentProjectRunCheck(res) {
  const source = currentProjectSource();
  const payload = currentProjectRealChainResponse({
    running,
    command: {
      mode: "read_only_projection_check",
      exitCode: existsSync(source.reportPath) ? 0 : 1,
      reportRead: existsSync(source.reportPath),
      projectVibeRead: existsSync(source.projectVibePath),
      providerCalled: false,
      prepareRan: false,
      verifyScriptRan: false,
    },
  });
  writeJson(res, payload.ok === false ? 500 : 200, payload);
}

function handleCurrentProjectImage2BatchRunCheck(res) {
  const source = currentProjectSource();
  const payload = currentProjectImage2BatchPlanResponse({
    running,
    command: {
      mode: "read_only_image2_batch_plan_check",
      exitCode: existsSync(source.reportPath) ? 0 : 1,
      reportRead: existsSync(source.reportPath),
      projectVibeRead: existsSync(source.projectVibePath),
      providerCalled: false,
      prepareRan: false,
      verifyScriptRan: false,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      noFileMutation: true,
      workerSpawnForbidden: true,
    },
  });
  writeJson(res, payload.ok === false ? 500 : 200, payload);
}

const server = createServer((req, res) => {
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
    serveRuntimeFile(res, url.searchParams.get("path") || "");
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectStatusEndpoint) {
    writeJson(res, 200, currentProjectRealChainResponse({ running }));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRunEndpoint) {
    handleCurrentProjectRunCheck(res);
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectImage2BatchPlanEndpoint) {
    writeJson(res, 200, currentProjectImage2BatchPlanResponse({ running }));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2BatchRunCheckEndpoint) {
    handleCurrentProjectImage2BatchRunCheck(res);
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
