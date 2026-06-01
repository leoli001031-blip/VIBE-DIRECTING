import {
  runDirectorTextQaForRuntime,
} from "./director-text-qa-runtime.mts";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapRequestJsonBody(parsedBody) {
  if (isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody) return parsedBody.body;
  return parsedBody;
}

export function createRuntimeApiDirectorTextQaRoute({
  endpoint,
  getProviderApiKey,
  getProviderConfigStatuses,
  readRequestJsonBody,
  runtimePolicy,
  writeJson,
}) {
  async function handleRuntimeApiDirectorTextQaRoute(req, res, url) {
    if (url.pathname !== endpoint) return false;

    if (req.method !== "POST") {
      writeJson(res, 405, { ok: false, ...runtimePolicy(), message: "Method not allowed." });
      return true;
    }

    const parsedBody = await readRequestJsonBody(req, { signal: AbortSignal.timeout(10_000) });
    if (isRecord(parsedBody) && parsedBody.ok === false) {
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: typeof parsedBody.message === "string" ? parsedBody.message : "Request body must be valid JSON.",
      });
      return true;
    }

    const body = unwrapRequestJsonBody(parsedBody);
    const input = isRecord(body?.input) ? body.input : body;
    const report = await runDirectorTextQaForRuntime({
      input,
      getProviderApiKey,
      getProviderConfigStatuses,
      mockProviderResult: body?.mockProviderResult === true,
    });

    writeJson(res, 200, {
      ok: true,
      ...runtimePolicy({
        runMode: "director_text_qa",
        providerCalled: report.providerCalled,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: true,
      }),
      status: report.status,
      report,
    });
    return true;
  }

  return { handleRuntimeApiDirectorTextQaRoute };
}
