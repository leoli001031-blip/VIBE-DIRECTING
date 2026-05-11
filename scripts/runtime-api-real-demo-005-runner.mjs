import { spawn } from "node:child_process";
import path from "node:path";

export function createRuntimeApiRealDemo005Runner(deps) {
  const {
    endpoints,
    existsSync,
    maxOutputChars = 8000,
    readJson,
    realDemo005Source,
    repoRoot,
    runtimeFileUrl,
    runtimePolicy,
    setRunning,
    spawnProcess = spawn,
    verifyScript,
    writeJson,
    running,
  } = deps;
  const { realDemo005StatusEndpoint, realDemo005RunEndpoint } = endpoints;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  function updateRunning(value) {
    if (typeof setRunning === "function") setRunning(value);
  }

  function clip(value) {
    const text = String(value || "");
    if (text.length <= maxOutputChars) return text;
    return `${text.slice(0, maxOutputChars)}\n...[clipped ${text.length - maxOutputChars} chars]`;
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

  function runVerify() {
    return new Promise((resolve) => {
      const child = spawnProcess(process.execPath, [verifyScript], {
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
    if (runtimeState()) {
      writeJson(res, 409, buildResponse({
        ok: false,
        endpoint,
        status: "running",
        running: true,
        message: "Real chain verification is already running.",
      }));
      return;
    }

    updateRunning(true);
    try {
      const run = options.runVerify || runVerify;
      const command = await run();
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
      updateRunning(false);
    }
  }

  return {
    responseFromReport,
    handleRun,
  };
}
