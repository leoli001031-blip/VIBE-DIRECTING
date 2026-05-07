import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const host = process.env.VIBE_CORE_RUNTIME_API_HOST || "127.0.0.1";
const port = Number(process.env.VIBE_CORE_RUNTIME_API_PORT || 8790);
const reportRelativePath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json";
const reportPath = path.join(repoRoot, reportRelativePath);
const verifyScript = path.join(repoRoot, "scripts/real-demo-e2e-005-anime-image2-start-verify.mjs");
const maxOutputChars = 8000;

const runtimeBasePath = "/api/runtime";
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

function unavailableResponse(extra = {}) {
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint: realDemo005StatusEndpoint,
    status: "unavailable",
    previewStatus: "unavailable",
    productionStatus: "unavailable",
    reportPath,
    reportRelativePath,
    reportUrl: runtimeFileUrl(reportRelativePath),
    reviewOverlayShots: [],
    productionNeedsReviewShots: [],
    shotCount: 0,
    blockerCount: 0,
    observations: [],
    message: "005 report is unavailable. The runtime API can only verify an existing prepared report and output set.",
    ...extra,
  };
}

function responseFromReport(extra = {}) {
  if (!existsSync(reportPath)) return unavailableResponse(extra);

  try {
    const report = readJson(reportPath);
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
      reportPath,
      reportRelativePath,
      reportUrl: runtimeFileUrl(reportRelativePath),
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
    });
  }
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

async function handleRun(res) {
  if (running) {
    writeJson(res, 409, responseFromReport({
      ok: false,
      endpoint: realDemo005RunEndpoint,
      status: "running",
      running: true,
      message: "Real Demo E2E 005 verification is already running.",
    }));
    return;
  }

  running = true;
  try {
    const command = await runVerify();
    const payload = responseFromReport({
      ok: command.code === 0,
      endpoint: realDemo005RunEndpoint,
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
      endpoint: realDemo005RunEndpoint,
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      reportPath,
      reportRelativePath,
      reportUrl: runtimeFileUrl(reportRelativePath),
      message: error instanceof Error ? error.message : "Unknown run failure.",
    });
  } finally {
    running = false;
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}`);
  if (req.method === "OPTIONS") {
    writeJson(res, 204, {});
    return;
  }
  if (req.method === "GET" && url.pathname === `${runtimeBasePath}/status`) {
    writeJson(res, 200, { ok: true, ...runtimePolicy({ endpoints: { realDemo005StatusEndpoint, realDemo005RunEndpoint, runtimeFileEndpoint } }), running });
    return;
  }
  if (req.method === "GET" && url.pathname === runtimeFileEndpoint) {
    serveRuntimeFile(res, url.searchParams.get("path") || "");
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
