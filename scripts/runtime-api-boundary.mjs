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

export function createRuntimeApiBoundary({
  repoRoot,
  repoRootRealPath,
  runtimeToken = "",
  runtimeBasePath = "/api/runtime",
  legacyRunEnabled = false,
} = {}) {
  if (!repoRoot) throw new Error("repoRoot is required.");
  if (!repoRootRealPath) throw new Error("repoRootRealPath is required.");

  const readRuntimeToken = normalizeTokenReader(runtimeToken);
  const readLegacyRunEnabled = normalizeBooleanReader(legacyRunEnabled);

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
      "access-control-allow-methods": "GET,POST,OPTIONS",
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

  function repoRelativePath(filePath) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, filePath));
    if (relativePath === "") return ".";
    if (relativePath.startsWith("../") || relativePath === ".." || path.isAbsolute(relativePath)) {
      throw new Error(`Path escapes project root: ${filePath}`);
    }
    return relativePath;
  }

  function resolveRepoInputPath(inputPath) {
    const candidate = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(repoRoot, inputPath);
    const rootWithSep = `${repoRoot}${path.sep}`;
    if (candidate !== repoRoot && !candidate.startsWith(rootWithSep)) {
      throw new Error(`Path escapes project root: ${inputPath}`);
    }
    if (existsSync(candidate)) {
      const candidateRealPath = realpathSync(candidate);
      const realRootWithSep = `${repoRootRealPath}${path.sep}`;
      if (candidateRealPath !== repoRootRealPath && !candidateRealPath.startsWith(realRootWithSep)) {
        throw new Error(`Path escapes project root: ${inputPath}`);
      }
    }
    return candidate;
  }

  function pathWithinRoot(candidatePath, rootPath) {
    const rootWithSep = `${rootPath}${path.sep}`;
    return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
  }

  function scopedRepoPath(relativePath) {
    const candidate = path.resolve(repoRoot, relativePath || "");
    const rootWithSep = `${repoRoot}${path.sep}`;
    if (candidate !== repoRoot && !candidate.startsWith(rootWithSep)) {
      throw new Error(`Path escapes project root: ${relativePath}`);
    }
    return candidate;
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
