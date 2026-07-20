import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exportDiagnosticBundle } from "../electron/diagnosticBundle.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = await mkdtemp(join(tmpdir(), "vibe-diagnostic-bundle-test-"));
const projectRoot = join(root, "private-project");
const userDataRoot = join(root, "user-data");
const outputPath = join(root, "diagnostics.zip");
const extractRoot = join(root, "extracted");
const secret = "sk-test-diagnostic-secret-123456789";

try {
  await mkdir(join(projectRoot, ".vibe-runtime"), { recursive: true });
  await mkdir(join(projectRoot, "video"), { recursive: true });
  await mkdir(userDataRoot, { recursive: true });
  const outsideSidecar = join(root, "outside-timeline.json");
  await writeFile(outsideSidecar, JSON.stringify({ status: `secret=${secret}`, path: "/Volumes/PrivateDrive/timeline.json" }), "utf8");
  await symlink(outsideSidecar, join(projectRoot, ".vibe-runtime", "agent-timeline.json"));
  await writeFile(join(projectRoot, "project.vibe"), JSON.stringify({ projectId: "private-project", title: "Private Story" }), "utf8");
  await writeFile(join(projectRoot, "video", "private-shot.mp4"), "not-real-media", "utf8");
  await writeFile(join(projectRoot, ".vibe-runtime", "agent-generation-job-ledger.json"), JSON.stringify({
    schemaVersion: "test/1 /Volumes/PrivateDrive/schema.json",
    jobs: [{
      status: "failed",
      outputPath: join(projectRoot, "video", "private-shot.mp4"),
      error: `failed at ${join(projectRoot, "video", "private-shot.mp4")} token=${secret}`,
      apiKey: secret,
    }],
  }), "utf8");

  const result = await exportDiagnosticBundle({
    outputPath,
    projectRoot,
    userDataRoot,
    runtimeRoot: root,
    runtimeLogs: [`runtime opened ${projectRoot}`, `authorization=${secret}`, "cache at /Volumes/PrivateDrive/runtime.json"],
    recentMainErrors: [`write failed under ${userDataRoot}`],
    appInfo: {
      name: "Vibe Director Studio",
      version: "0.0.1",
      packaged: true,
      platform: "darwin",
      arch: "arm64",
      electron: "test",
      node: process.versions.node,
    },
    tempRoot: root,
    generatedAt: "2026-07-20T10:00:00.000Z",
  });
  assert(result.sidecarCount === 1, "diagnostic bundle should summarize one known sidecar");
  const outputHash = createHash("sha256").update(await readFile(outputPath)).digest("hex");
  assert(result.sha256 === outputHash, "diagnostic bundle hash should match the archive");

  await mkdir(extractRoot, { recursive: true });
  const extracted = spawnSync("/usr/bin/ditto", ["-x", "-k", outputPath, extractRoot], { encoding: "utf8" });
  assert(extracted.status === 0, `diagnostic bundle should unzip: ${extracted.stderr}`);
  const bundleRoot = join(extractRoot, "Vibe Director Diagnostics");
  const manifestText = await readFile(join(bundleRoot, "diagnostics.json"), "utf8");
  const runtimeLog = await readFile(join(bundleRoot, "runtime.log"), "utf8");
  const readme = await readFile(join(bundleRoot, "README.txt"), "utf8");
  const combined = `${manifestText}\n${runtimeLog}\n${readme}`;
  assert(!combined.includes(secret), "diagnostic bundle must redact secrets");
  assert(!combined.includes(projectRoot), "diagnostic bundle must redact the project absolute path");
  assert(!combined.includes(userDataRoot), "diagnostic bundle must redact the user-data absolute path");
  assert(!combined.includes("/Volumes/PrivateDrive"), "diagnostic bundle must redact arbitrary absolute paths");
  assert(!combined.includes("private-shot.mp4"), "diagnostic bundle must not include media names or paths");
  const manifest = JSON.parse(manifestText);
  assert(manifest.privacy.credentialsIncluded === false, "diagnostic bundle must declare credential exclusion");
  assert(manifest.privacy.mediaIncluded === false, "diagnostic bundle must declare media exclusion");
  assert(manifest.sidecars.length === 1, "diagnostic bundle must ignore sidecars that resolve outside the project");
  assert(manifest.sidecars[0].statusCounts.failed === 1, "diagnostic bundle should retain structural failure status");
  console.log("diagnostic-bundle-test: ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
