import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function request(method, headers = {}, url = "/api/runtime/status") {
  return { method, headers, url };
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
    end(body = "") {
      this.body = body;
    },
  };
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-runtime-boundary-"));
const workingRepoRoot = path.join(workingRoot, "repo");
const workingOutsideRoot = path.join(workingRoot, "outside");
const workingRepoFile = path.join(workingRepoRoot, "project", "image.png");
const workingOutsideFile = path.join(workingOutsideRoot, "escape.png");
const workingOutsideDirectoryLink = path.join(workingRepoRoot, "escape-directory");

mkdirSync(path.dirname(workingRepoFile), { recursive: true });
mkdirSync(workingOutsideRoot, { recursive: true });
writeFileSync(workingRepoFile, "png-bytes");
writeFileSync(workingOutsideFile, "outside");
symlinkSync(workingOutsideFile, path.join(workingRepoRoot, "escape-link.png"));
symlinkSync(workingOutsideRoot, workingOutsideDirectoryLink, "dir");

const boundary = createRuntimeApiBoundary({
  repoRoot: workingRepoRoot,
  repoRootRealPath: realpathSync(workingRepoRoot),
  runtimeToken: "secret",
  legacyRunEnabled: true,
});

assert(boundary.isTrustedLocalOrigin(undefined) === true, "no-origin requests should be trusted");
assert(boundary.isTrustedLocalOrigin("") === true, "empty-origin requests should be trusted");
assert(boundary.isTrustedLocalOrigin("http://localhost:5173") === true, "localhost origin should be trusted");
assert(boundary.isTrustedLocalOrigin("http://127.0.0.1:5173") === true, "127.0.0.1 origin should be trusted");
assert(boundary.isTrustedLocalOrigin("http://[::1]:5173") === true, "IPv6 localhost origin should be trusted");
assert(boundary.isTrustedLocalOrigin("https://localhost:5173") === false, "https localhost should not change the local http-only policy");
assert(boundary.isTrustedLocalOrigin("http://example.com") === false, "remote origins should be untrusted");

assert(boundary.runtimeRequestSecurity(request("GET", {})).ok === false, "GET should require the configured token");
assert(boundary.runtimeRequestSecurity(request("GET", { "x-vibe-runtime-token": "wrong" })).ok === false, "GET should reject the wrong token");
assert(boundary.runtimeRequestSecurity(request("GET", { origin: "http://localhost:5173", "x-vibe-runtime-token": "secret" })).ok === true, "trusted GET origin and token should pass");
assert(boundary.runtimeRequestSecurity(request("GET", {}, "/api/runtime/status?runtimeToken=secret")).ok === false, "non-media reads must not accept a token in the URL");
assert(boundary.runtimeRequestSecurity(request("GET", {}, "/api/runtime/files?path=image.png&runtimeToken=secret")).ok === true, "media elements should be able to authenticate scoped file reads through the session URL");
assert(boundary.runtimeRequestSecurity(request("OPTIONS", { origin: "http://localhost:5173" })).ok === true, "CORS preflight should not require a token");
const blockedOrigin = boundary.runtimeRequestSecurity(request("GET", { origin: "http://example.com" }));
assert(blockedOrigin.ok === false && blockedOrigin.statusCode === 403, "untrusted origin should be blocked");
const blockedPost = boundary.runtimeRequestSecurity(request("POST", {}));
assert(blockedPost.ok === false && blockedPost.message.includes("token"), "POST should require token when configured");
assert(boundary.runtimeRequestSecurity(request("POST", { "x-vibe-runtime-token": "wrong" })).ok === false, "POST should reject the wrong token");
assert(boundary.runtimeRequestSecurity(request("POST", { "x-vibe-runtime-token": "secret" })).ok === true, "POST should pass with token");

const tokenlessBoundary = createRuntimeApiBoundary({
  repoRoot: workingRepoRoot,
  repoRootRealPath: realpathSync(workingRepoRoot),
});
assert(tokenlessBoundary.runtimeRequestSecurity(request("GET", {})).ok === true, "development Runtime without a configured token should remain available");

assertThrows(() => boundary.scopedRepoPath("../escape.png"), "repo-relative path escape should be blocked");
assertThrows(() => boundary.repoRelativePath(workingOutsideFile), "absolute path outside repo should be blocked");
assertThrows(() => boundary.resolveRepoInputPath("escape-link.png"), "realpath escape through symlink should be blocked");
assertThrows(() => boundary.resolveRepoInputPath("escape-directory/new-export.mp4"), "nonexistent targets below an escaping symlink parent should be blocked");
assert(boundary.runtimeRelativeFromValue(workingRepoFile) === "project/image.png", "absolute repo file should normalize to repo-relative path");
assert(boundary.runtimeRelativeFromValue(workingOutsideFile) === undefined, "absolute outside file should not normalize into runtime path");
assert(boundary.runtimePathExists("project/image.png") === true, "runtimePathExists should see files inside repo");
assert(boundary.runtimePathExists("../escape.png") === false, "runtimePathExists should fail closed for escapes");

assert(boundary.contentTypeFor("asset.PNG") === "image/png", "png content type mismatch");
assert(boundary.contentTypeFor("clip.webm") === "video/webm", "webm content type mismatch");
assert(boundary.contentTypeFor("data.json") === "application/json; charset=utf-8", "json content type mismatch");
assert(boundary.isMediaContentType("image/png") === true, "image content type should count as media");
assert(boundary.isMediaContentType("video/mp4") === true, "video content type should count as media");
assert(boundary.isMediaContentType("application/json; charset=utf-8") === false, "json should not count as media");
assert(boundary.acceptsMedia(request("GET", { accept: "text/html,image/png" })) === true, "image accept header should accept media");
assert(boundary.acceptsMedia(request("GET", { accept: "application/json" })) === false, "json accept header should not accept media");

const mediaRes = response();
mediaRes.runtimeAllowedOrigin = "http://localhost:5173";
boundary.writeRuntimeFileError(request("GET", { accept: "image/png" }), mediaRes, 404, { ok: false }, "missing.png");
assert(mediaRes.statusCode === 404, "media error status mismatch");
assert(mediaRes.headers["content-type"] === "image/png", "media error should keep media content type");
assert(mediaRes.headers["content-length"] === "0", "media error should return an empty media body");
assert(mediaRes.headers["access-control-allow-origin"] === "http://localhost:5173", "trusted media error should include CORS origin");
assert(mediaRes.body === "", "media error body should be empty");

const jsonRes = response();
boundary.writeRuntimeFileError(request("GET", { accept: "application/json" }), jsonRes, 404, { ok: false, status: "not_found" }, "missing.png");
assert(jsonRes.statusCode === 404, "json error status mismatch");
assert(jsonRes.headers["content-type"] === "application/json; charset=utf-8", "json error content type mismatch");
assert(JSON.parse(jsonRes.body).status === "not_found", "json error payload mismatch");

assert(boundary.runtimePolicy().security.legacyRunEnabled === true, "legacy run policy should come from factory input");
assert(boundary.runtimePolicy().tokenRequired === true, "token policy should come from factory input");

rmSync(workingRoot, { recursive: true, force: true });
assert(!existsSync(workingRoot), "temp root should be cleaned up");

console.log("runtime-api-boundary-test: ok");
