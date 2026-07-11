import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function hasAll(names: string[]) {
  return names.every((name) => Boolean(process.env[name]));
}

function hasAny(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function signingIdentityOutput() {
  if (process.platform !== "darwin") return "";
  try {
    return execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function commandAvailable(command: string, args: string[]) {
  if (process.platform !== "darwin") return false;
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function expandedPath(value: string) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  if (value.startsWith("file://")) return value.slice("file://".length);
  return path.resolve(value);
}

function cscLinkLooksUsable(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("https://")) return true;
  const dataPrefix = /^data:.*;base64,/i.exec(trimmed)?.[0] || "";
  const encoded = dataPrefix ? trimmed.slice(dataPrefix.length) : trimmed;
  if (dataPrefix || trimmed.length > 2048 || trimmed.endsWith("=")) {
    try {
      return Buffer.from(encoded, "base64").length > 0;
    } catch {
      return false;
    }
  }
  return existsSync(expandedPath(trimmed));
}

const identityOutput = signingIdentityOutput();
const cscLink = process.env.CSC_LINK?.trim() || "";
const cscLinkReady = cscLinkLooksUsable(cscLink);
const cscName = process.env.CSC_NAME?.trim() || "";
const cscNameHasCertificatePrefix = [
  "Developer ID Application:",
  "Developer ID Installer:",
  "Apple Development:",
  "Apple Distribution:",
].some((prefix) => cscName.startsWith(prefix));
const cscNameReady = Boolean(
  cscName
  && !cscNameHasCertificatePrefix
  && identityOutput.split(/\r?\n/).some((line) => line.includes("Developer ID Application") && line.includes(cscName)),
);
const keychainDeveloperIdReady = /Developer ID Application/.test(identityOutput);
const signingStrategy = cscLinkReady
  ? "csc_link"
  : cscName
    ? cscNameReady ? "csc_name" : undefined
    : keychainDeveloperIdReady ? "keychain_identity" : undefined;

const appleIdVariables = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
const apiKeyVariables = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
let notarizationStrategy: "apple_id" | "api_key" | "keychain_profile" | undefined;
let notarizationIssue = "";

if (hasAny(appleIdVariables)) {
  if (hasAll(appleIdVariables)) notarizationStrategy = "apple_id";
  else notarizationIssue = `incomplete Apple ID notarization credentials (${appleIdVariables.join(" + ")})`;
} else if (hasAny(apiKeyVariables)) {
  if (!hasAll(apiKeyVariables)) {
    notarizationIssue = `incomplete App Store Connect API credentials (${apiKeyVariables.join(" + ")})`;
  } else if (!existsSync(expandedPath(process.env.APPLE_API_KEY!))) {
    notarizationIssue = "APPLE_API_KEY does not point to an existing .p8 file";
  } else {
    notarizationStrategy = "api_key";
  }
} else if (process.env.APPLE_KEYCHAIN_PROFILE) {
  notarizationStrategy = "keychain_profile";
} else if (process.env.APPLE_KEYCHAIN) {
  notarizationIssue = "APPLE_KEYCHAIN_PROFILE is required when APPLE_KEYCHAIN is set";
}

const notarytoolReady = commandAvailable("xcrun", ["--find", "notarytool"]);
const staplerReady = commandAvailable("xcrun", ["--find", "stapler"]);

const missing: string[] = [];
if (!signingStrategy) {
  missing.push(
    cscLink
      ? "CSC_LINK must be an existing certificate file, HTTPS URL, or base64 certificate payload"
      : cscNameHasCertificatePrefix
        ? "CSC_NAME must omit the certificate type prefix and match a Developer ID Application identity"
        : "Developer ID signing identity (CSC_LINK/CSC_NAME or macOS keychain identity)",
  );
}
if (!notarizationStrategy) {
  missing.push(
    notarizationIssue || "notarization credentials (APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER, or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or APPLE_KEYCHAIN_PROFILE)",
  );
}
if (!notarytoolReady) missing.push("xcrun notarytool");
if (!staplerReady) missing.push("xcrun stapler");

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
  signingStrategy,
  notarizationStrategy,
  notarytoolReady,
  staplerReady,
}, null, 2));
