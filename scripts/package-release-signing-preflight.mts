import { execFileSync } from "node:child_process";

function hasAll(names: string[]) {
  return names.every((name) => Boolean(process.env[name]));
}

function findDeveloperIdIdentity() {
  if (process.platform !== "darwin") return false;
  try {
    const output = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return /Developer ID Application/.test(output);
  } catch {
    return false;
  }
}

const signingReady =
  Boolean(process.env.CSC_LINK) ||
  Boolean(process.env.CSC_NAME) ||
  findDeveloperIdIdentity();

const notarizationReady =
  hasAll(["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]) ||
  hasAll(["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"]) ||
  hasAll(["APPLE_KEYCHAIN", "APPLE_KEYCHAIN_PROFILE"]);

const missing: string[] = [];
if (!signingReady) {
  missing.push("Developer ID signing identity (CSC_LINK/CSC_NAME or macOS keychain identity)");
}
if (!notarizationReady) {
  missing.push(
    "notarization credentials (APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER, or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or APPLE_KEYCHAIN + APPLE_KEYCHAIN_PROFILE)",
  );
}

if (missing.length) {
  console.error(JSON.stringify({
    ok: false,
    releaseReady: false,
    missing,
    localSmokeAllowed: true,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  releaseReady: true,
  signingReady,
  notarizationReady,
}, null, 2));
