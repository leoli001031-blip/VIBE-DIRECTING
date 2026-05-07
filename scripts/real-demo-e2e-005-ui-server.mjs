import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const host = process.env.REAL_DEMO_E2E_005_UI_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.REAL_DEMO_E2E_005_UI_SERVER_PORT || 8787);
const reportRelativePath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json";
const reportPath = path.join(repoRoot, reportRelativePath);
const verifyScript = path.join(repoRoot, "scripts/real-demo-e2e-005-anime-image2-start-verify.mjs");
const maxOutputChars = 8000;

let running = false;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clip(value) {
  const text = String(value || "");
  if (text.length <= maxOutputChars) return text;
  return `${text.slice(0, maxOutputChars)}\n...[clipped ${text.length - maxOutputChars} chars]`;
}

function responseFromReport(extra = {}) {
  if (!fs.existsSync(reportPath)) {
    return {
      ok: false,
      status: "unavailable",
      previewStatus: "unavailable",
      productionStatus: "unavailable",
      reportPath,
      reportRelativePath,
      reviewOverlayShots: [],
      observations: [],
      message: "005 report is unavailable. Run the Image2 start-frame harness first.",
      ...extra,
    };
  }

  const report = readJson(reportPath);
  return {
    ok: true,
    status: report.status || "unavailable",
    previewStatus: report.previewStatus || report.status || "unavailable",
    productionStatus: report.productionStatus || "unavailable",
    reportPath,
    reportRelativePath,
    reviewOverlayShots: Array.isArray(report.reviewOverlayShots) ? report.reviewOverlayShots : [],
    productionNeedsReviewShots: Array.isArray(report.productionNeedsReviewShots) ? report.productionNeedsReviewShots : [],
    shotCount: report.shotCount || report.observations?.length || 0,
    blockerCount: Array.isArray(report.blockers) ? report.blockers.length : 0,
    observations: Array.isArray(report.observations)
      ? report.observations.map((item) => ({
          order: item.order,
          shotId: item.shotId,
          expectedOutputPath: item.expectedOutputPath,
          previewQaStatus: item.previewQaStatus,
          productionQaStatus: item.productionQaStatus,
          reviewOverlay: item.reviewOverlay === true,
          runtimeTruthStatus: item.runtimeTruthStatus,
          blockers: Array.isArray(item.blockers) ? item.blockers : [],
        }))
      : [],
    report,
    ...extra,
  };
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  });
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

async function handleRun(res) {
  if (running) {
    writeJson(res, 409, responseFromReport({
      ok: false,
      status: "running",
      message: "Real Demo E2E 005 verification is already running.",
    }));
    return;
  }

  running = true;
  try {
    const command = await runVerify();
    const payload = responseFromReport({
      ok: command.code === 0,
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
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      reportPath,
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
  if (req.method === "GET" && url.pathname === "/api/real-demo-e2e/005/status") {
    writeJson(res, 200, responseFromReport({ running }));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/real-demo-e2e/005/run") {
    void handleRun(res);
    return;
  }
  writeJson(res, 404, { ok: false, status: "not_found", path: url.pathname });
});

server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(JSON.stringify({
    event: "real-demo-e2e-005-ui-server-listening",
    host,
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
  }));
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
