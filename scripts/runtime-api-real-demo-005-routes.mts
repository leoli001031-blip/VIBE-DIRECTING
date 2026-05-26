export function createRuntimeApiRealDemo005Routes(deps) {
  const {
    endpoints,
    writeJson,
    responseFromReport,
    handleRun,
    runtimePolicy,
    readLegacyRunEnabled,
    legacyRunEnabled,
    running,
  } = deps;
  const {
    realDemo005StatusEndpoint,
    realDemo005RunEndpoint,
    legacyStatusEndpoint,
    legacyRunEndpoint,
  } = endpoints;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  function canRunLegacyVerify() {
    const readEnabled = readLegacyRunEnabled || legacyRunEnabled;
    const enabled = typeof readEnabled === "function" ? readEnabled() : readEnabled;
    return enabled === true || enabled === "1";
  }

  function disabledRunResponse(endpoint) {
    return {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      status: "disabled",
      previewStatus: "blocked",
      productionStatus: "blocked",
      running: false,
      command: {
        providerCalled: false,
        prepareRan: false,
        verifyScriptRan: false,
      },
      message: "Legacy 005 run endpoint is disabled. Set VIBE_DIRECTOR_ENABLE_LEGACY_RUN=1 for diagnostics-only use.",
    };
  }

  function isStatusEndpoint(pathname) {
    return pathname === realDemo005StatusEndpoint || pathname === legacyStatusEndpoint;
  }

  function isRunEndpoint(pathname) {
    return pathname === realDemo005RunEndpoint || pathname === legacyRunEndpoint;
  }

  function handleRuntimeApiRealDemo005Route(req, res, url) {
    if (req.method === "GET" && isStatusEndpoint(url.pathname)) {
      writeJson(res, 200, responseFromReport({ running: runtimeState() }));
      return true;
    }

    if (req.method === "POST" && isRunEndpoint(url.pathname)) {
      if (!canRunLegacyVerify()) {
        writeJson(res, 403, disabledRunResponse(url.pathname));
        return true;
      }
      void handleRun(res, { endpoint: url.pathname });
      return true;
    }

    return false;
  }

  return {
    handleRuntimeApiRealDemo005Route,
  };
}
