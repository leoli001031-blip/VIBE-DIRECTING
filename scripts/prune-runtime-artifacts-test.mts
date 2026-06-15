import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repoRoot, "test_artifacts", "prune-runtime-artifacts-fixture");
fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, "receipt.txt"), "regenerable runtime artifact\n");

try {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(repoRoot, "scripts", "prune-runtime-artifacts.mts"),
      "--max-age-hours=0",
      "--json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const report = JSON.parse(output) as {
    dryRun: boolean;
    candidates: Array<{ relativePath?: string }>;
  };
  assert(report.dryRun === true, "runtime prune test must run dry-run only");
  assert(
    report.candidates.some((candidate) => candidate.relativePath === "test_artifacts/prune-runtime-artifacts-fixture"),
    "runtime prune dry-run should include the scoped fixture",
  );
  const allowedRoots = ["real-test-sandbox/", "test_artifacts/", "tmp/", ".vibe-runtime/uv-cache"];
  for (const candidate of report.candidates) {
    const relativePath = candidate.relativePath || "";
    assert(
      allowedRoots.some((root) => relativePath === root.replace(/\/$/, "") || relativePath.startsWith(root)),
      `runtime prune candidate escaped allowed roots: ${relativePath}`,
    );
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("prune-runtime-artifacts-test: dry-run candidates stay inside allowed runtime roots.");
