function endpointValues(endpoints) {
  if (Array.isArray(endpoints)) return endpoints;
  return Object.values(endpoints || {});
}

export function isCurrentProjectEndpoint(pathname, endpoints) {
  return endpointValues(endpoints).some((endpoint) => endpoint === pathname);
}

export function createCurrentProjectRouteContext(deps) {
  const {
    readRequestJsonBody,
    currentProjectRequestContext,
    currentProjectSourceResult,
    writeJson,
    blockedCurrentProjectResponse,
    unboundCurrentProjectResponse,
  } = deps;

  return async function currentProjectRouteContext(req, res, url, endpoint) {
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
  };
}
