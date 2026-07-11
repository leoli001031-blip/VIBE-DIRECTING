import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
  return output;
}

function releaseAppPath() {
  const configured = process.env.VIBE_RELEASE_APP_PATH?.trim();
  if (configured) return realpathSync(configured);
  const releaseRoot = path.resolve("release");
  const candidates = readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("mac"))
    .map((entry) => path.join(releaseRoot, entry.name, "Vibe Director Studio.app"))
    .filter((candidate) => {
      try {
        return statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  if (!candidates[0]) throw new Error("No packaged Vibe Director Studio.app was found under release/mac*. ");
  return realpathSync(candidates[0]);
}

function releaseDmgPath() {
  const configured = process.env.VIBE_RELEASE_DMG_PATH?.trim();
  if (configured) return realpathSync(configured);
  const releaseRoot = path.resolve("release");
  const candidates = readdirSync(releaseRoot)
    .filter((name) => name.endsWith(".dmg"))
    .map((name) => path.join(releaseRoot, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  if (!candidates[0]) throw new Error("No release DMG was found under release/. ");
  return realpathSync(candidates[0]);
}

function verifyReleaseApp(appPath: string) {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  const signature = run("codesign", ["-dv", "--verbose=4", appPath]);
  if (!/Authority=Developer ID Application:/.test(signature)) {
    throw new Error("The release app is not signed with Developer ID Application.");
  }
  if (!/TeamIdentifier=(?!not set)\S+/.test(signature)) {
    throw new Error("The release app is missing a signing TeamIdentifier.");
  }
  if (!/Runtime Version=/.test(signature)) {
    throw new Error("The release app is missing hardened runtime metadata.");
  }

  const entitlements = run("codesign", ["-d", "--entitlements", "-", appPath]);
  for (const entitlement of [
    "com.apple.security.cs.allow-jit",
    "com.apple.security.cs.allow-unsigned-executable-memory",
    "com.apple.security.cs.disable-library-validation",
  ]) {
    if (!entitlements.includes(entitlement)) throw new Error(`The release app is missing ${entitlement}.`);
  }

  run("xcrun", ["stapler", "validate", appPath]);
  run("spctl", ["--assess", "--type", "execute", "--verbose=4", appPath]);
}

const appPath = releaseAppPath();
verifyReleaseApp(appPath);
const dmgPath = releaseDmgPath();
run("hdiutil", ["verify", dmgPath]);

const mountRoot = mkdtempSync(path.join(os.tmpdir(), "vibe-director-release-dmg-"));
const mountPoint = path.join(mountRoot, "mounted");
mkdirSync(mountPoint);
let mounted = false;
try {
  run("hdiutil", ["attach", "-nobrowse", "-readonly", "-mountpoint", mountPoint, dmgPath]);
  mounted = true;
  const mountedAppPath = realpathSync(path.join(mountPoint, "Vibe Director Studio.app"));
  verifyReleaseApp(mountedAppPath);
  run("hdiutil", ["detach", mountPoint]);
  mounted = false;
} finally {
  if (mounted) spawnSync("hdiutil", ["detach", mountPoint, "-force"], { stdio: "ignore" });
  rmSync(mountRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  releaseReady: true,
  appPath,
  dmgPath,
  developerIdSigned: true,
  hardenedRuntime: true,
  stapled: true,
  gatekeeperAccepted: true,
  dmgVerified: true,
  dmgAppGatekeeperAccepted: true,
}, null, 2));
