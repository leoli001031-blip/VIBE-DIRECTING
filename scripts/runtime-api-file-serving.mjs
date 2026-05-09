import path from "node:path";

function defaultNormalizeRelativePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function defaultWriteJson({ corsHeaders, runtimePolicy }, res, statusCode, payload) {
  if (statusCode === 204) {
    res.writeHead(204, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
    res.end();
    return;
  }
  res.writeHead(statusCode, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export function createRuntimeApiFileServing({
  runtimeFileEndpoint,
  scopedRepoPath,
  pathWithinRoot,
  contentTypeFor,
  corsHeaders,
  runtimePolicy,
  writeRuntimeFileError,
  sourceForScope,
  currentProjectSourceResult,
  createReadStream,
  existsSync,
  statSync,
  realpathSync,
  normalizeRelativePath = defaultNormalizeRelativePath,
  writeJson,
} = {}) {
  if (!runtimeFileEndpoint) throw new Error("runtimeFileEndpoint is required.");
  if (typeof scopedRepoPath !== "function") throw new Error("scopedRepoPath is required.");
  if (typeof pathWithinRoot !== "function") throw new Error("pathWithinRoot is required.");
  if (typeof contentTypeFor !== "function") throw new Error("contentTypeFor is required.");
  if (typeof corsHeaders !== "function") throw new Error("corsHeaders is required.");
  if (typeof runtimePolicy !== "function") throw new Error("runtimePolicy is required.");
  if (typeof writeRuntimeFileError !== "function") throw new Error("writeRuntimeFileError is required.");
  if (typeof createReadStream !== "function") throw new Error("createReadStream is required.");
  if (typeof existsSync !== "function") throw new Error("existsSync is required.");
  if (typeof statSync !== "function") throw new Error("statSync is required.");
  if (typeof realpathSync !== "function") throw new Error("realpathSync is required.");

  const resolveSourceForScope = typeof sourceForScope === "function"
    ? sourceForScope
    : currentProjectSourceResult;
  if (typeof resolveSourceForScope !== "function") {
    throw new Error("sourceForScope or currentProjectSourceResult is required.");
  }

  const writeJsonResponse = typeof writeJson === "function"
    ? writeJson
    : (res, statusCode, payload) => defaultWriteJson({ corsHeaders, runtimePolicy }, res, statusCode, payload);

  function runtimeFileUrl(relativePath, scope) {
    const scopeQuery = scope ? `scope=${encodeURIComponent(scope)}&` : "";
    return `${runtimeFileEndpoint}?${scopeQuery}path=${encodeURIComponent(relativePath)}`;
  }

  function sourceResultFromScope(scope) {
    try {
      const result = resolveSourceForScope(scope);
      if (result?.source) return result;
      if (result?.error || result?.unbound) return result;
      return { source: result };
    } catch (error) {
      return {
        error,
        message: error instanceof Error ? error.message : "Current project root is unavailable.",
        unbound: error?.code === "CURRENT_PROJECT_UNBOUND",
        bindingState: error?.bindingState,
      };
    }
  }

  function runtimeFileRequest(input, options = {}) {
    if (input instanceof URL) {
      return {
        relativePath: input.searchParams.get("path") || "",
        scope: input.searchParams.get("scope") || undefined,
      };
    }
    return {
      relativePath: input || "",
      scope: options.scope,
    };
  }

  function serveRuntimeFile(req, res, input, options = {}) {
    const { relativePath, scope } = runtimeFileRequest(input, options);
    if (!relativePath) {
      writeJsonResponse(res, 400, { ok: false, ...runtimePolicy(), status: "bad_request", message: "Missing file path." });
      return;
    }

    const normalizedRelativePath = normalizeRelativePath(relativePath);
    if (path.isAbsolute(normalizedRelativePath)) {
      writeRuntimeFileError(req, res, 403, {
        ok: false,
        ...runtimePolicy(),
        status: "forbidden",
        message: "Runtime files must be addressed by repository-relative paths.",
      }, normalizedRelativePath);
      return;
    }

    let filePath;
    let allowedRootPath;
    let allowedRootLabel;
    try {
      filePath = scopedRepoPath(normalizedRelativePath);
      const sourceResult = sourceResultFromScope(scope);
      if (!sourceResult?.source) {
        const error = sourceResult?.error;
        const unbound = sourceResult?.unbound || error?.code === "CURRENT_PROJECT_UNBOUND";
        writeRuntimeFileError(req, res, unbound ? 409 : 403, {
          ok: false,
          ...runtimePolicy(),
          status: unbound ? "unbound" : "forbidden",
          message: sourceResult?.message || (error instanceof Error ? error.message : "Path is outside project root."),
        }, normalizedRelativePath);
        return;
      }
      allowedRootPath = sourceResult.source.runRootPath;
      allowedRootLabel = sourceResult.source.runRootRelativePath;
    } catch (error) {
      const unbound = error?.code === "CURRENT_PROJECT_UNBOUND";
      writeRuntimeFileError(req, res, unbound ? 409 : 403, {
        ok: false,
        ...runtimePolicy(),
        status: unbound ? "unbound" : "forbidden",
        message: error instanceof Error ? error.message : "Path is outside project root.",
      }, normalizedRelativePath);
      return;
    }

    if (!pathWithinRoot(filePath, allowedRootPath)) {
      writeRuntimeFileError(req, res, 403, {
        ok: false,
        ...runtimePolicy(),
        status: "forbidden",
        message: `Runtime file is outside the allowed project scope: ${allowedRootLabel}`,
      }, normalizedRelativePath);
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      writeRuntimeFileError(req, res, 404, {
        ok: false,
        ...runtimePolicy(),
        status: "not_found",
        message: `Runtime file not found: ${relativePath}`,
      }, normalizedRelativePath);
      return;
    }

    try {
      const fileRealPath = realpathSync(filePath);
      const rootRealPath = realpathSync(allowedRootPath);
      if (!pathWithinRoot(fileRealPath, rootRealPath)) {
        writeRuntimeFileError(req, res, 403, {
          ok: false,
          ...runtimePolicy(),
          status: "forbidden",
          message: "Runtime file symlink escapes the allowed project scope.",
        }, normalizedRelativePath);
        return;
      }
    } catch (error) {
      writeRuntimeFileError(req, res, 403, {
        ok: false,
        ...runtimePolicy(),
        status: "forbidden",
        message: error instanceof Error ? error.message : "Runtime file could not be resolved safely.",
      }, normalizedRelativePath);
      return;
    }

    res.writeHead(200, corsHeaders(contentTypeFor(filePath), res.runtimeAllowedOrigin));
    createReadStream(filePath).pipe(res);
  }

  return {
    runtimeFileUrl,
    serveRuntimeFile,
  };
}
