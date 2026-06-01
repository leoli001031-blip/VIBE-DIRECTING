function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
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

export function round5StrictEditReturnRequestInput(url, body) {
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

export function createRuntimeApiCurrentProjectRound5StrictEditReturnRoutes(deps) {
  const {
    currentProjectRound5StrictEditReturnEndpoint,
    currentProjectRouteContext,
    writeJson,
    currentProjectRound5StrictEditReturnResponse,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  async function handleCurrentProjectRound5StrictEditReturnRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectRound5StrictEditReturnEndpoint) {
      return false;
    }

    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRound5StrictEditReturnEndpoint);
    if (!routeContext) return true;
    const input = round5StrictEditReturnRequestInput(url, routeContext.body);
    const payload = currentProjectRound5StrictEditReturnResponse(input, {
      running: runtimeState(),
      requestContext: routeContext.requestContext,
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    round5StrictEditReturnRequestInput,
    handleCurrentProjectRound5StrictEditReturnRoute,
  };
}
