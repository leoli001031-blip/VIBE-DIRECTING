import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type Step = {
  label: string;
  args: string[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function runNpmStep(step: Step) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const commandLine = `${npmCommand} ${step.args.join(" ")}`;
  console.log(`\n[mvp-rc:smoke] ${step.label}`);
  console.log(`[mvp-rc:smoke] $ ${commandLine}`);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(npmCommand, step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.label} failed with exit code ${code}`));
    });
  });
}

async function findFiles(root: string, fileName: string) {
  const found: string[] = [];
  if (!existsSync(root)) return found;

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === fileName) {
        found.push(fullPath);
      }
    }
  }

  await walk(root);
  return found;
}

async function assertRuntimeBundleUnpacked() {
  const releaseRoot = path.resolve("release");
  assert(existsSync(releaseRoot), "release directory must exist after package:dir");

  const candidates = (await findFiles(releaseRoot, "local-runtime-api-server.mjs"))
    .filter((candidate) => candidate.includes(`${path.sep}app.asar.unpacked${path.sep}electron-runtime${path.sep}`));
  assert(
    candidates.length > 0,
    "packaged runtime bundle must be present under app.asar.unpacked/electron-runtime",
  );

  for (const candidate of candidates) {
    const bundleSource = await readFile(candidate, "utf8");
    assert(!bundleSource.includes("tsx/esm/api"), "unpacked runtime bundle must not depend on tsx register");
    assert(
      !bundleSource.includes("await import(\"./local-runtime-api-server.mts\")"),
      "unpacked runtime bundle must not import the .mts source wrapper",
    );
  }

  const asarFiles = await findFiles(releaseRoot, "app.asar");
  assert(asarFiles.length > 0, "package:dir must emit an app.asar next to the unpacked runtime payload");

  const stats = await Promise.all(candidates.map(async (candidate) => ({
    candidate,
    size: (await stat(candidate)).size,
  })));
  const summary = stats.map(({ candidate, size }) => `${path.relative(process.cwd(), candidate)} (${size} bytes)`);
  console.log(`[mvp-rc:smoke] unpacked runtime bundle verified:\n${summary.join("\n")}`);
}

const steps: Step[] = [
  { label: "prototype verification", args: ["run", "verify:prototype"] },
  { label: "P6 real Image2 contract test", args: ["run", "p6-real-image2:test"] },
  { label: "P6 real Image2 no-submit preflight", args: ["run", "p6-real-image2:preflight", "--", "--shots=P6S01"] },
  { label: "packaged app smoke", args: ["run", "package:smoke"] },
];

for (const step of steps) {
  await runNpmStep(step);
}

await assertRuntimeBundleUnpacked();

console.log("\n[mvp-rc:smoke] ok");
