import { readFileSync } from "node:fs";

import { createRuntimeSessionToken } from "../electron/runtimeSessionToken.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const firstToken = createRuntimeSessionToken();
const secondToken = createRuntimeSessionToken();
assert(/^[A-Za-z0-9_-]{43}$/.test(firstToken), "Runtime session token must contain 256 bits encoded as base64url");
assert(/^[A-Za-z0-9_-]{43}$/.test(secondToken), "each Runtime session token must use the same strong format");
assert(firstToken !== secondToken, "separate Electron launches must not reuse a deterministic Runtime token");

const mainSource = readFileSync("electron/main.mts", "utf8");
const preloadSource = readFileSync("electron/preload.mts", "utf8");
const bridgeSource = readFileSync("src/core/electronBridge.ts", "utf8");
const runtimeClientSource = readFileSync("src/core/runtimeApiClient.ts", "utf8");
const reviewDecisionSource = readFileSync("src/core/projectReviewDecisionClient.ts", "utf8");
const runtimeBoundarySource = readFileSync("scripts/runtime-api-boundary.mts", "utf8");

assert(mainSource.includes("createRuntimeSessionToken()"), "Electron main must generate a Runtime token at process startup");
assert(mainSource.includes("VIBE_DIRECTOR_RUNTIME_API_TOKEN: runtimeSessionToken"), "Electron main must inject the session token into the Runtime child");
assert(mainSource.includes("VIBE_CORE_RUNTIME_API_TOKEN: runtimeSessionToken"), "legacy Runtime env compatibility must receive the same session token");
assert(/handleTrustedIpc\("runtime:ensureStarted"[\s\S]{0,260}token: baseUrl \? runtimeSessionToken : ""/.test(mainSource), "trusted lazy Runtime IPC must return the in-memory session token to preload only after startup succeeds");
assert(preloadSource.includes("runtimeApiToken: () => runtimeApiToken"), "preload must expose the live in-memory Runtime token through contextBridge");
assert(preloadSource.includes('typeof payload?.token === "string"'), "preload must validate the token payload type");
assert(bridgeSource.includes("runtimeApiToken?(): string"), "renderer bridge types must expose the in-memory token getter");
assert(runtimeClientSource.includes("window.vibeRuntime?.runtimeApiToken?.()"), "Runtime requests must read the token from the Electron bridge");
assert(/toRuntimeUrl\(path: string\)[\s\S]*parsed\.pathname === `\$\{projectRuntimeBasePath\}\/files`[\s\S]*parsed\.searchParams\.set\("runtimeToken", token\)/.test(runtimeClientSource), "Runtime media URLs must carry the in-memory session token without baking it into Vite");
assert(!runtimeClientSource.includes("VITE_VIBE_DIRECTOR_RUNTIME_API_TOKEN"), "Runtime token must not come from a Vite environment variable");
assert(!runtimeClientSource.includes("VITE_VIBE_CORE_RUNTIME_API_TOKEN"), "legacy Runtime token must not come from a Vite environment variable");
assert(!reviewDecisionSource.includes("fetchRuntimeJson(endpoint, runtimeRequestInit("), "fetchRuntimeJson callers must not freeze headers before lazy Runtime startup");
assert(/req\.method !== "OPTIONS" && token/.test(runtimeBoundarySource), "configured Runtime tokens must protect reads as well as mutations");
assert(!/req\.method !== "GET" && req\.method !== "OPTIONS"/.test(runtimeBoundarySource), "Runtime GET routes must not bypass the configured session token");
assert(mainSource.includes("runtimeLoopbackHost(readEnv("), "Electron Runtime must validate host overrides as loopback-only");

console.log("electron-runtime-token-contract-test: ok");
