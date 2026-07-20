import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(process.cwd());
const scriptPath = join(repoRoot, "scripts", "p11-provider-canary-acceptance.mts");
const tsxPath = join(repoRoot, "node_modules", ".bin", "tsx");
const fixtureRoot = await mkdtemp(join(tmpdir(), "vibe-p11-canary-contract-"));
const evidenceRoot = join(fixtureRoot, "evidence");
const attemptPath = join(evidenceRoot, "submit-attempt.json");

function run(args: string[]) {
  return spawnSync(tsxPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, VIBE_P11_CANARY_ROOT: fixtureRoot },
    encoding: "utf8",
  });
}

async function exists(path: string) {
  return access(path).then(() => true).catch(() => false);
}

try {
  const inspect = run(["--mode=inspect"]);
  assert(inspect.status === 0, `isolated inspect failed: ${inspect.stderr}`);
  const inspection = JSON.parse(inspect.stdout);
  assert(inspection.phase === "not_prepared", "isolated inspect must not invent a prepared canary");
  assert(inspection.providerCalls?.total === 0, "isolated inspect must report zero Provider calls");

  const lockedSubmit = run(["--mode=submit"]);
  assert(lockedSubmit.status !== 0, "submit without the exact authorization must fail closed");
  assert(`${lockedSubmit.stdout}${lockedSubmit.stderr}`.includes("P11 paid submit is locked"), "locked submit must explain the paid boundary");
  assert(!await exists(attemptPath), "locked submit must not create an attempt marker");

  const wrongSubmit = run(["--mode=submit", "--paid-authorization=wrong"]);
  assert(wrongSubmit.status !== 0, "submit with a wrong authorization must fail closed");
  assert(!await exists(attemptPath), "wrong authorization must not create an attempt marker");

  const lockedQuery = run(["--mode=query"]);
  assert(lockedQuery.status !== 0, "query without single-submit evidence must fail closed");
  assert(`${lockedQuery.stdout}${lockedQuery.stderr}`.includes("query is locked until the single submit produces exact evidence"), "locked query must explain the identity boundary");

  const [source, packageJson] = await Promise.all([
    readFile(scriptPath, "utf8"),
    readFile(join(repoRoot, "package.json"), "utf8").then(JSON.parse),
  ]);
  const submitScript = String(packageJson.scripts?.["p11-b-provider-canary:submit"] || "");
  assert(submitScript.includes("--mode=submit"), "the submit command must use the guarded submit mode");
  assert(!submitScript.includes("confirm-p11s01-seedance2.0_vip-720p-once"), "package.json must not bake in the paid authorization phrase");
  assert(/writeFile\(submitAttemptPath,[\s\S]*flag: "wx"/.test(source), "the submit attempt marker must use exclusive atomic creation");
  assert(/resumeCommand\.includes\("query_result"\)[\s\S]*!resumeCommand\.includes\("multimodal2video"\)[\s\S]*uniqueEnabledButtonTarget\(launch\.client, "确认查询结果"\)/.test(source), "query mode must reject submit commands before exposing the packaged click");
  assert(/args\[0\] === "query_result"[\s\S]*!args\.includes\("multimodal2video"\)/.test(source), "query evidence must verify the executed command stayed query-only");
  assert(/P11 submit attempt already exists; a second Provider submit is forbidden/.test(source), "the single-submit replay lock is missing");
  assert(/preflight-invalid/.test(source) && /provider-guard/.test(source), "the packaged invalid-mode preflight guard is missing");
  assert(/findingCode: "invalid_execution_mode"/.test(source), "the packaged preflight must prove the exact deterministic blocker");
  assert(/!await pathExists\(guardCalledPath\)/.test(source), "the packaged preflight must prove the Provider command was not invoked");

  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(attemptPath, `${JSON.stringify({ submitAttemptCount: 1 })}\n`, "utf8");
  const lockedPrepare = run(["--mode=prepare"]);
  assert(lockedPrepare.status !== 0, "prepare must fail after the single submit attempt is consumed");
  assert(
    `${lockedPrepare.stdout}${lockedPrepare.stderr}`.includes("prepare cannot erase the single-submit lock"),
    "prepare must explain why the consumed canary cannot be recreated",
  );
  assert(await exists(attemptPath), "failed prepare must preserve the single-submit marker");

  console.log("p11-provider-canary-contract-test passed; Provider calls: 0");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
