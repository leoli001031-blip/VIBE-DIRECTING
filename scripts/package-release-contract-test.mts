import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const mac = packageJson.build?.mac || {};
assert(mac.hardenedRuntime === true, "release config must explicitly enable hardened runtime");
assert(mac.entitlements === "build/entitlements.mac.plist", "release config must pin root entitlements");
assert(mac.entitlementsInherit === "build/entitlements.mac.inherit.plist", "release config must pin inherited entitlements");
assert(mac.notarize === true, "release config must explicitly enable electron-builder notarization");
const releaseCommand = packageJson.scripts?.["package:release:mac"] || "";
const releaseStages = [
  "package:release:contract:test",
  "package:release:preflight",
  "npm run build",
  "package-electron-release.mts --mac",
  "package:release:verify",
];
assert(releaseStages.every((stage) => releaseCommand.includes(stage)), "release command must include every contract, preflight, build, package, and verification stage");
assert(releaseStages.every((stage, index) => index === 0 || releaseCommand.indexOf(releaseStages[index - 1]) < releaseCommand.indexOf(stage)), "release command must fail fast before building and verify only after packaging");

for (const file of [mac.entitlements, mac.entitlementsInherit]) {
  execFileSync("plutil", ["-lint", path.join(root, file)], { stdio: "ignore" });
  const content = readFileSync(path.join(root, file), "utf8");
  for (const entitlement of [
    "com.apple.security.cs.allow-jit",
    "com.apple.security.cs.allow-unsigned-executable-memory",
    "com.apple.security.cs.disable-library-validation",
  ]) {
    assert(content.includes(entitlement), `${file} must include ${entitlement}`);
  }
}

const verifySource = readFileSync(path.join(root, "scripts/package-release-verify.mts"), "utf8");
assert(/Authority=Developer ID Application:/.test(verifySource), "release verifier must require Developer ID Application");
assert(/Runtime Version=/.test(verifySource), "release verifier must require hardened runtime metadata");
assert(/stapler[\s\S]*validate/.test(verifySource), "release verifier must validate the stapled ticket");
assert(/spctl[\s\S]*--assess[\s\S]*--type[\s\S]*execute/.test(verifySource), "release verifier must run Gatekeeper assessment");
assert(/hdiutil[\s\S]*verify/.test(verifySource), "release verifier must validate the final DMG");
assert(/hdiutil[\s\S]*attach[\s\S]*Vibe Director Studio\.app[\s\S]*verifyReleaseApp\(mountedAppPath\)[\s\S]*hdiutil[\s\S]*detach/.test(verifySource), "release verifier must mount the final DMG and reassess the enclosed app");

const credentialNames = [
  "CSC_LINK",
  "CSC_NAME",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "APPLE_API_KEY",
  "APPLE_API_KEY_ID",
  "APPLE_API_ISSUER",
  "APPLE_KEYCHAIN",
  "APPLE_KEYCHAIN_PROFILE",
];
const baseEnv = { ...process.env };
for (const name of credentialNames) delete baseEnv[name];
const tsx = path.join(root, "node_modules", ".bin", "tsx");
const preflight = path.join(root, "scripts", "package-release-signing-preflight.mts");

function runPreflight(overrides: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(tsx, [preflight], {
    cwd: root,
    env: { ...baseEnv, ...overrides },
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

const noCredentials = runPreflight();
assert(noCredentials.status !== 0, "release preflight must reject missing credentials");

const testCscLink = `data:application/x-pkcs12;base64,${Buffer.from("test-only-certificate-placeholder").toString("base64")}`;
const keychainProfile = runPreflight({
  CSC_LINK: testCscLink,
  APPLE_KEYCHAIN_PROFILE: "vibe-director-test-profile",
});
assert(keychainProfile.status === 0 && keychainProfile.output.includes('"notarizationStrategy": "keychain_profile"'), "keychain profile notarization must not require APPLE_KEYCHAIN");

const invalidCscLink = runPreflight({
  CSC_LINK: "base64-placeholder",
  APPLE_KEYCHAIN_PROFILE: "vibe-director-test-profile",
});
assert(invalidCscLink.status !== 0 && invalidCscLink.output.includes("CSC_LINK must be"), "release preflight must reject an unusable CSC_LINK value");

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "vibe-release-contract-"));
try {
  const apiKeyPath = path.join(tempRoot, "AuthKey_TEST.p8");
  writeFileSync(apiKeyPath, "test-only-placeholder", "utf8");
  const apiKey = runPreflight({
    CSC_LINK: testCscLink,
    APPLE_API_KEY: apiKeyPath,
    APPLE_API_KEY_ID: "TESTKEYID",
    APPLE_API_ISSUER: "00000000-0000-0000-0000-000000000000",
  });
  assert(apiKey.status === 0 && apiKey.output.includes('"notarizationStrategy": "api_key"'), "complete API key credentials with an existing file must pass preflight");

  const partialAppleId = runPreflight({
    CSC_LINK: testCscLink,
    APPLE_ID: "test@example.com",
    APPLE_API_KEY: apiKeyPath,
    APPLE_API_KEY_ID: "TESTKEYID",
    APPLE_API_ISSUER: "00000000-0000-0000-0000-000000000000",
  });
  assert(partialAppleId.status !== 0 && partialAppleId.output.includes("incomplete Apple ID"), "partial higher-priority Apple ID credentials must fail instead of falling through to API key");

  const partialApiKey = runPreflight({
    CSC_LINK: testCscLink,
    APPLE_API_KEY: apiKeyPath,
    APPLE_KEYCHAIN_PROFILE: "vibe-director-test-profile",
  });
  assert(partialApiKey.status !== 0 && partialApiKey.output.includes("incomplete App Store Connect API"), "partial API key credentials must fail instead of falling through to keychain profile");

  const missingApiKeyFile = runPreflight({
    CSC_LINK: testCscLink,
    APPLE_API_KEY: path.join(tempRoot, "missing.p8"),
    APPLE_API_KEY_ID: "TESTKEYID",
    APPLE_API_ISSUER: "00000000-0000-0000-0000-000000000000",
  });
  assert(missingApiKeyFile.status !== 0 && missingApiKeyFile.output.includes("does not point to an existing .p8 file"), "API key preflight must reject a missing key file");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

const developmentIdentity = runPreflight({
  CSC_NAME: "Apple Development: 8618552681031 (83CKM5U692)",
  APPLE_KEYCHAIN_PROFILE: "vibe-director-test-profile",
});
assert(developmentIdentity.status !== 0, "Apple Development must not satisfy the Developer ID distribution gate");

console.log("package-release-contract-test: ok");
