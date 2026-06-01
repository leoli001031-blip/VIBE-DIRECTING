function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapRequestJsonBody(parsedBody) {
  if (isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody) return parsedBody.body;
  return parsedBody;
}

function allowedProviderIds(getProviderConfigStatuses) {
  try {
    return new Set((getProviderConfigStatuses() || [])
      .map((entry) => typeof entry?.providerId === "string" ? entry.providerId.trim() : "")
      .filter(Boolean));
  } catch {
    return new Set();
  }
}

function providerAllowed(providerId, getProviderConfigStatuses) {
  return allowedProviderIds(getProviderConfigStatuses).has(providerId);
}

export function createRuntimeApiCredentialsRoute(deps) {
  const {
    credentialsEndpoint,
    getAllCredentials,
    getProviderConfigStatuses,
    getMaskedKey,
    readRequestJsonBody,
    removeProviderCredential,
    runtimePolicy,
    setProviderCredential,
    writeJson,
  } = deps;

  async function handleRuntimeApiCredentialsRoute(req, res, url) {
    if (url.pathname !== credentialsEndpoint) return false;

    try {
      if (req.method === "GET") {
        writeJson(res, 200, {
          ok: true,
          credentials: getAllCredentials(),
          providerConfigs: getProviderConfigStatuses(),
          ...runtimePolicy(),
        });
        return true;
      }

      if (req.method === "POST") {
        const parsedBody = await readRequestJsonBody(req, { signal: AbortSignal.timeout(10_000) });
        if (isRecord(parsedBody) && parsedBody.ok === false) {
          writeJson(res, 400, {
            ok: false,
            message: typeof parsedBody.message === "string" ? parsedBody.message : "Request body must be valid JSON.",
            ...runtimePolicy(),
          });
          return true;
        }
        const body = unwrapRequestJsonBody(parsedBody);
        const providerId = typeof body?.providerId === "string" ? body.providerId.trim() : "";
        const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        if (!providerId || !apiKey) {
          writeJson(res, 400, { ok: false, message: "providerId and apiKey are required", ...runtimePolicy() });
          return true;
        }
        if (!providerAllowed(providerId, getProviderConfigStatuses)) {
          writeJson(res, 400, { ok: false, message: "providerId is not configured for this runtime.", ...runtimePolicy() });
          return true;
        }
        const result = setProviderCredential(providerId, apiKey, body.label);
        writeJson(res, 200, {
          ok: true,
          credential: {
            providerId: result.providerId,
            label: result.label,
            maskedKey: getMaskedKey(result.apiKey),
            hasKey: true,
          },
          ...runtimePolicy(),
        });
        return true;
      }

      if (req.method === "DELETE") {
        const providerId = (url.searchParams.get("providerId") || "").trim();
        if (!providerId) {
          writeJson(res, 400, { ok: false, message: "providerId required", ...runtimePolicy() });
          return true;
        }
        if (!providerAllowed(providerId, getProviderConfigStatuses)) {
          writeJson(res, 400, { ok: false, message: "providerId is not configured for this runtime.", ...runtimePolicy() });
          return true;
        }
        removeProviderCredential(providerId);
        writeJson(res, 200, { ok: true, ...runtimePolicy() });
        return true;
      }

      return false;
    } catch (error) {
      writeJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "Internal error handling credentials route.",
        ...runtimePolicy(),
      });
      return true;
    }
  }

  return {
    handleRuntimeApiCredentialsRoute,
  };
}
