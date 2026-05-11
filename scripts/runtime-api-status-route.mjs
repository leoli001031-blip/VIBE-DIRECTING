export function createRuntimeApiStatusRoute(deps) {
  const {
    statusEndpoint,
    endpoints,
    writeJson,
    runtimePolicy,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  function statusResponse() {
    return {
      ok: true,
      ...runtimePolicy({ endpoints }),
      running: runtimeState(),
    };
  }

  function handleRuntimeApiStatusRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === statusEndpoint) {
      writeJson(res, 200, statusResponse());
      return true;
    }

    return false;
  }

  return {
    handleRuntimeApiStatusRoute,
  };
}
