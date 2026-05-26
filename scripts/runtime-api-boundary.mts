import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

function normalizeTokenReader(runtimeToken) {
  if (typeof runtimeToken === "function") return runtimeToken;
  return () => runtimeToken || "";
}

function normalizeBooleanReader(value) {
  if (typeof value === "function") return value;
  return () => Boolean(value);
}

function normalizeStringArrayReader(value) {
  if (typeof value === "function") return value;
  return () => Array.isArray(value) ? value : [];
}

export function createRuntimeApiBoundary({
  repoRoot,
  repoRootRealPath,
  runtimeToken = "",
  runtimeBasePath = "/api/runtime",
  legacyRunEnabled = false,
  allowedProjectRootInputs = [],
} = {}) {
  if (!repoRoot) throw new Error("repoRoot is required.");
  if (!repoRootRealPath) throw new Error("repoRootRealPath is required.");

  const readRuntimeToken = normalizeTokenReader(runtimeToken);
  const readLegacyRunEnabled = normalizeBooleanReader(legacyRunEnabled);
  const readAllowedProjectRootInputs = normalizeStringArrayReader(allowedProjectRootInputs);

  function isTrustedLocalOrigin(origin) {
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || parsed.hostname === "[::1]");
    } catch {
      return false;
    }
  }

  function runtimeSecurityPolicy() {
    return {
      originPolicy: "localhost_or_no_origin_only",
      tokenRequired: Boolean(readRuntimeToken()),
      legacyRunEnabled: Boolean(readLegacyRunEnabled()),
    };
  }

  function corsHeaders(contentType = "application/json; charset=utf-8", origin) {
    const headers = {
      "content-type": contentType,
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,x-vibe-runtime-token,x-vibe-project-root,x-vibe-project-id,x-project-root,x-project-id",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    };
    if (origin && isTrustedLocalOrigin(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers["vary"] = "Origin";
    }
    return headers;
  }

  function normalizeRelativePath(value) {
    return value.replace(/\\/g, "/");
  }

  function isInsideRoot(root, target) {
    const relativePath = path.relative(root, target);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
  }

  function allowedProjectRoots() {
    const roots = [];
    for (const input of readAllowedProjectRootInputs() || []) {
      if (typeof input !== "string" || !input.trim()) continue;
      const resolved = path.resolve(input.trim());
      try {
        if (!existsSync(resolved) || !statSync(resolved).isDirectory()) continue;
        roots.push(resolved, realpathSync(resolved));
      } catch {
        continue;
      }
    }
    return Array.from(new Set(roots));
  }

  function allowedRootForPath(filePath) {
    const resolved = path.resolve(filePath);
    if (isInsideRoot(repoRoot, resolved) || isInsideRoot(repoRootRealPath, resolved)) return repoRoot;
    for (const root of allowedProjectRoots()) {
      if (isInsideRoot(root, resolved)) return root;
    }
    return undefined;
  }

  function assertScopedPath(candidatePath, originalValue) {
    const resolved = path.resolve(candidatePath);
    const allowedRoot = allowedRootForPath(resolved);
    if (!allowedRoot) {
      throw new Error(`Path escapes project root: ${originalValue}`);
    }
    if (existsSync(resolved)) {
      const candidateRealPath = realpathSync(resolved);
      if (!allowedRootForPath(candidateRealPath)) {
        throw new Error(`Path escapes project root: ${originalValue}`);
      }
    }
    return resolved;
  }

  function repoRelativePath(filePath) {
    const resolved = assertScopedPath(filePath, filePath);
    if (!isInsideRoot(repoRoot, resolved)) return normalizeRelativePath(resolved);
    const relativePath = normalizeRelativePath(path.relative(repoRoot, resolved));
    if (relativePath === "") return ".";
    return relativePath;
  }

  function resolveRepoInputPath(inputPath) {
    const candidate = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(repoRoot, inputPath);
    return assertScopedPath(candidate, inputPath);
  }

  function pathWithinRoot(candidatePath, rootPath) {
    const rootWithSep = `${rootPath}${path.sep}`;
    return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
  }

  function scopedRepoPath(relativePath) {
    const candidate = path.isAbsolute(relativePath || "")
      ? path.resolve(relativePath || "")
      : path.resolve(repoRoot, relativePath || "");
    return assertScopedPath(candidate, relativePath);
  }

  function contentTypeFor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    if (ext === ".mp4") return "video/mp4";
    if (ext === ".webm") return "video/webm";
    if (ext === ".json") return "application/json; charset=utf-8";
    return "application/octet-stream";
  }

  function isMediaContentType(contentType) {
    return contentType.startsWith("image/") || contentType.startsWith("video/");
  }

  function acceptsMedia(req) {
    const accept = String(req.headers.accept || "");
    return accept.includes("image/") || accept.includes("video/");
  }

  function runtimeRequestSecurity(req) {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    if (origin && !isTrustedLocalOrigin(origin)) {
      return {
        ok: false,
        statusCode: 403,
        origin,
        message: "Runtime API only accepts localhost or no-origin requests.",
      };
    }

    const token = readRuntimeToken();
    if (req.method !== "GET" && req.method !== "OPTIONS" && token) {
      const suppliedToken = typeof req.headers["x-vibe-runtime-token"] === "string" ? req.headers["x-vibe-runtime-token"] : "";
      if (suppliedToken !== token) {
        return {
          ok: false,
          statusCode: 403,
          origin,
          message: "Runtime API token is required for this request.",
        };
      }
    }

    return { ok: true, origin };
  }

  function runtimePolicy(extra = {}) {
    return {
      schemaVersion: "vibe_core_local_runtime_api_v1",
      source: "runtime_endpoint",
      basePath: runtimeBasePath,
      security: runtimeSecurityPolicy(),
      tokenRequired: Boolean(readRuntimeToken()),
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      dryRunOnly: true,
      workerSpawnForbidden: true,
      videoSubmitted: false,
      runMode: "verify_only",
      ...extra,
    };
  }

  function writeRuntimeFileError(req, res, statusCode, payload, relativePath) {
    const contentType = contentTypeFor(relativePath || "");
    if (isMediaContentType(contentType) && acceptsMedia(req)) {
      res.writeHead(statusCode, {
        ...corsHeaders(contentType, res.runtimeAllowedOrigin),
        "content-length": "0",
      });
      res.end();
      return;
    }
    res.writeHead(statusCode, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
    res.end(`${JSON.stringify(payload, null, 2)}\n`);
  }

  function runtimeRelativeFromValue(value) {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const normalized = normalizeRelativePath(value.trim());
    if (!path.isAbsolute(normalized)) return normalized;
    try {
      return repoRelativePath(normalized);
    } catch {
      return undefined;
    }
  }

  function runtimePathExists(relativePath) {
    if (!relativePath) return false;
    try {
      const filePath = scopedRepoPath(relativePath);
      return existsSync(filePath) && statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  return {
    acceptsMedia,
    contentTypeFor,
    corsHeaders,
    isMediaContentType,
    isTrustedLocalOrigin,
    normalizeRelativePath,
    pathWithinRoot,
    repoRelativePath,
    resolveRepoInputPath,
    runtimePathExists,
    runtimePolicy,
    runtimeRelativeFromValue,
    runtimeRequestSecurity,
    runtimeSecurityPolicy,
    scopedRepoPath,
    writeRuntimeFileError,
  };
}
