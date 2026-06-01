import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mts";
import { createRuntimeApiFileServing } from "./runtime-api-file-serving.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(headers = {}) {
  return { method: "GET", headers };
}

function response() {
  return {
    headers: undefined,
    statusCode: undefined,
    body: "",
    runtimeAllowedOrigin: undefined,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    write(chunk = "") {
      this.body += String(chunk);
    },
    end(body = "") {
      this.body += String(body);
    },
  };
}

function payload(res) {
  return JSON.parse(res.body);
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-runtime-file-serving-"));
const repoRoot = path.join(workingRoot, "repo");
const projectRoot = path.join(repoRoot, "projects/current");
const otherProjectRoot = path.join(repoRoot, "projects/other");
const imagePath = path.join(projectRoot, "outputs/shot.png");
const otherImagePath = path.join(otherProjectRoot, "outputs/shot.png");
const largeImagePath = path.join(projectRoot, "outputs/large.png");

mkdirSync(path.dirname(imagePath), { recursive: true });
mkdirSync(path.dirname(otherImagePath), { recursive: true });
writeFileSync(imagePath, "png-bytes");
writeFileSync(otherImagePath, "other-png-bytes");
writeFileSync(largeImagePath, "large-png-bytes");

const boundary = createRuntimeApiBoundary({
  repoRoot,
  repoRootRealPath: realpathSync(repoRoot),
});

let sourceMode = "bound";
const fileServing = createRuntimeApiFileServing({
  runtimeFileEndpoint: "/api/runtime/files",
  scopedRepoPath: boundary.scopedRepoPath,
  pathWithinRoot: boundary.pathWithinRoot,
  contentTypeFor: boundary.contentTypeFor,
  corsHeaders: boundary.corsHeaders,
  runtimePolicy: boundary.runtimePolicy,
  writeRuntimeFileError: boundary.writeRuntimeFileError,
  currentProjectSourceResult() {
    if (sourceMode === "unbound") {
      const error = new Error("No current project is bound. Use POST /api/runtime/projects/select first.");
      error.code = "CURRENT_PROJECT_UNBOUND";
      return { error, message: error.message, unbound: true };
    }
    return {
      source: {
        runRootPath: projectRoot,
        runRootRelativePath: boundary.repoRelativePath(projectRoot),
      },
    };
  },
  createReadStream(filePath, options = {}) {
    return {
      pipe(res) {
        const range = options.start !== undefined ? `:${options.start}-${options.end}` : "";
        res.end(`stream:${boundary.repoRelativePath(filePath)}${range}`);
      },
    };
  },
  existsSync,
  statSync,
  realpathSync,
  maxFileBytes: 10,
});

try {
  assert(
    fileServing.runtimeFileUrl("projects/current/outputs/shot.png", "current-project") ===
      "/api/runtime/files?scope=current-project&path=projects%2Fcurrent%2Foutputs%2Fshot.png",
    "runtimeFileUrl should include encoded scope and path",
  );
  assert(
    fileServing.runtimeFileUrl("projects/current/outputs/shot.png") ===
      "/api/runtime/files?path=projects%2Fcurrent%2Foutputs%2Fshot.png",
    "runtimeFileUrl should omit scope query when scope is empty",
  );

  const missingPath = response();
  fileServing.serveRuntimeFile(request(), missingPath, "");
  assert(missingPath.statusCode === 400, "missing path should return 400");
  assert(payload(missingPath).status === "bad_request", "missing path status mismatch");

  const traversal = response();
  fileServing.serveRuntimeFile(request(), traversal, "../package.json");
  assert(traversal.statusCode === 403, "path escape should return 403");
  assert(payload(traversal).status === "forbidden", "path escape status mismatch");

  const missingMedia = response();
  fileServing.serveRuntimeFile(
    request({ accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" }),
    missingMedia,
    "projects/current/outputs/missing.png",
  );
  assert(missingMedia.statusCode === 404, "missing media should return 404");
  assert(missingMedia.headers["content-type"] === "image/png", "missing media should keep image content type");
  assert(missingMedia.headers["content-length"] === "0", "missing media should have empty body header");
  assert(missingMedia.body === "", "missing media body should be empty");

  sourceMode = "unbound";
  const unbound = response();
  fileServing.serveRuntimeFile(request(), unbound, "projects/current/outputs/shot.png");
  assert(unbound.statusCode === 409, "unbound current project should return 409");
  assert(payload(unbound).status === "unbound", "unbound status mismatch");
  sourceMode = "bound";

  const outsideBoundProject = response();
  fileServing.serveRuntimeFile(request(), outsideBoundProject, "projects/other/outputs/shot.png");
  assert(outsideBoundProject.statusCode === 403, "file outside bound project should return 403");
  assert(payload(outsideBoundProject).status === "forbidden", "outside bound project status mismatch");

  const tooLarge = response();
  fileServing.serveRuntimeFile(request(), tooLarge, "projects/current/outputs/large.png");
  assert(tooLarge.statusCode === 413, "oversized runtime file should return 413");
  assert(payload(tooLarge).status === "too_large", "oversized runtime file status mismatch");

  const validMedia = response();
  validMedia.runtimeAllowedOrigin = "http://localhost:5173";
  fileServing.serveRuntimeFile(request(), validMedia, "projects/current/outputs/shot.png");
  assert(validMedia.statusCode === 200, "valid media should return 200");
  assert(validMedia.headers["content-type"] === "image/png", "valid media content-type mismatch");
  assert(validMedia.headers["access-control-allow-origin"] === "http://localhost:5173", "valid media should echo trusted origin");
  assert(validMedia.headers["x-content-type-options"] === "nosniff", "valid media should keep nosniff");
  assert(validMedia.headers["cache-control"] === "no-store", "valid media should keep no-store");
  assert(validMedia.headers["accept-ranges"] === "bytes", "valid media should advertise byte ranges");
  assert(validMedia.headers["content-length"] === String(statSync(imagePath).size), "valid media should include content-length");
  assert(validMedia.body === "stream:projects/current/outputs/shot.png", "valid media should stream the file");

  const rangedMedia = response();
  fileServing.serveRuntimeFile(request({ range: "bytes=0-3" }), rangedMedia, "outputs/shot.png");
  assert(rangedMedia.statusCode === 206, "range request should return 206");
  assert(rangedMedia.headers["content-range"] === `bytes 0-3/${statSync(imagePath).size}`, "range request should include content-range");
  assert(rangedMedia.headers["content-length"] === "4", "range request should include byte length");
  assert(rangedMedia.body === "stream:projects/current/outputs/shot.png:0-3", "range request should stream selected bytes");

  const currentRootRelativeMedia = response();
  fileServing.serveRuntimeFile(request(), currentRootRelativeMedia, "outputs/shot.png");
  assert(currentRootRelativeMedia.statusCode === 200, "current-project-relative media should return 200");
  assert(currentRootRelativeMedia.body === "stream:projects/current/outputs/shot.png", "current-project-relative media should stream from bound project root");

  const currentAbsoluteMedia = response();
  fileServing.serveRuntimeFile(request(), currentAbsoluteMedia, imagePath);
  assert(currentAbsoluteMedia.statusCode === 200, "absolute media inside the bound project should return 200");
  assert(currentAbsoluteMedia.body === "stream:projects/current/outputs/shot.png", "absolute media inside the bound project should stream the file");
} finally {
  rmSync(workingRoot, { recursive: true, force: true });
}

console.log("runtime-api-file-serving-test: ok");
