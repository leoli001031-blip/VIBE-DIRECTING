import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import { createProjectVibe, serializeProjectVibe } from "../src/project/index.ts";
import {
  closePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  waitForAcceptance,
} from "./lib/packaged-acceptance-harness.mts";

const releaseId = process.env.VIBE_LOCAL_BETA_RELEASE_ID?.trim() || "p11-local-beta";
const acceptanceStage = process.env.VIBE_LOCAL_BETA_STAGE?.trim() || "P11-C";
const fixtureTag = releaseId.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "local-beta";
const p13ProviderCanaryAccepted = releaseId === "p13-local-beta";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(/^[a-z0-9][a-z0-9_-]*$/i.test(releaseId), "Local Beta release id must be a simple folder name");

function run(command: string, args: string[], label: string) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert(result.status === 0, `${label} failed: ${result.stderr || result.stdout}`);
  return result;
}

async function sha256(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function newestArtifact(extension: string) {
  const candidates = (await readdir(releaseRoot))
    .filter((name) => name.toLowerCase().endsWith(extension))
    .map((name) => join(releaseRoot, name));
  assert(candidates.length > 0, `${acceptanceStage} ${extension} artifact is missing under release/`);
  const rows = await Promise.all(candidates.map(async (filePath) => ({ filePath, mtimeMs: (await stat(filePath)).mtimeMs })));
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]!.filePath;
}

function packageRelevantDirtyPaths() {
  const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  assert(status.status === 0, `git status failed: ${status.stderr}`);
  return status.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((filePath) => (
      !filePath.startsWith("docs/evidence/p10-e-packaged-director-workflow-20260719/")
      && !filePath.startsWith("release/")
    ));
}

async function writeExampleProject(exampleRoot: string) {
  const createdAt = p13ProviderCanaryAccepted ? "2026-07-23T10:00:00.000Z" : "2026-07-20T10:00:00.000Z";
  const project = createProjectVibe({
    projectId: "vibe_director_beta_sample",
    title: "内部 Beta 示例",
    version: "1.0.0",
    createdAt,
    updatedAt: createdAt,
    storyFlow: {
      id: "sample_story_flow",
      sections: [{
        id: "sample_section",
        title: "雨后递灯",
        summary: "女孩把发光纸飞机递给机器人保安。",
        sequenceIndex: 0,
        shotIds: ["S01", "S02"],
      }],
      shotOrder: ["S01", "S02"],
    },
    visualMemory: { id: "sample_visual_memory", entries: [] },
    shots: [
      {
        id: "S01",
        sectionId: "sample_section",
        title: "雨夜便利店门口",
        intent: "女孩走到机器人保安面前，拿出纸飞机。",
        camera: "中远景轻推",
        executionMode: "relationship_wide",
        referenceStrategy: "omni_reference",
        sceneAssetIds: [],
        characterAssetIds: [],
        propAssetIds: [],
        durationSeconds: 4,
        status: "planned",
        sourceRefs: [`${fixtureTag}-sample`],
      },
      {
        id: "S02",
        sectionId: "sample_section",
        title: "纸飞机亮起",
        intent: "机器人接过纸飞机，蓝光在灯箱下亮起。",
        camera: "手部动作特写后回到双人关系",
        executionMode: "action_insert",
        referenceStrategy: "omni_reference",
        sceneAssetIds: [],
        characterAssetIds: [],
        propAssetIds: [],
        durationSeconds: 4,
        status: "planned",
        sourceRefs: [`${fixtureTag}-sample`],
      },
    ],
    assets: [],
    runs: [],
  });
  await mkdir(exampleRoot, { recursive: true });
  await writeFile(join(exampleRoot, "project.vibe"), serializeProjectVibe(project), "utf8");
  await writeFile(
    join(exampleRoot, "README.md"),
    "# 内部 Beta 示例项目\n\n这是一个无凭证、无媒体、不会触发 Provider 的两镜头项目。打开后应先看到故事，再由 Agent 提示补参考。\n",
    "utf8",
  );
}

async function appInside(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = join(root, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) return candidate;
    if (entry.isDirectory()) {
      const nested = await appInside(candidate).catch(() => "");
      if (nested) return nested;
    }
  }
  return "";
}

const repoRoot = resolve(process.cwd());
const releaseRoot = join(repoRoot, "release");
const betaRoot = join(releaseRoot, releaseId);
const evidenceRoot = join(betaRoot, "evidence");
const exampleRoot = join(betaRoot, "example-project");
const version = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")).version as string;
const commitResult = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
assert(commitResult.status === 0, `git rev-parse failed: ${commitResult.stderr}`);
const commit = commitResult.stdout.trim();
const dmgPath = await newestArtifact(".dmg");
const zipPath = await newestArtifact(".zip");
const artifactStats = await Promise.all([stat(dmgPath), stat(zipPath)]);
const buildTime = new Date(Math.max(...artifactStats.map((item) => item.mtimeMs))).toISOString();
const appPath = join(releaseRoot, "mac-arm64", "Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");

await rm(betaRoot, { recursive: true, force: true });
await mkdir(evidenceRoot, { recursive: true });
await writeExampleProject(exampleRoot);

run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], "ad-hoc app codesign verification");
const signature = run("/usr/bin/codesign", ["-dv", "--verbose=4", appPath], "app signature inspection");
assert(`${signature.stdout}${signature.stderr}`.includes("Signature=adhoc"), `${acceptanceStage} app is not ad-hoc signed`);
run("/usr/bin/hdiutil", ["verify", dmgPath], "DMG verification");

const tempRoot = await mkdtemp(`/tmp/vibe-director-${fixtureTag}-`);
let packagedLaunch: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>> | undefined;
try {
  const zipExtractRoot = join(tempRoot, "zip-extracted");
  await mkdir(zipExtractRoot, { recursive: true });
  run("/usr/bin/ditto", ["-x", "-k", zipPath, zipExtractRoot], "ZIP extraction");
  const extractedAppPath = await appInside(zipExtractRoot);
  assert(extractedAppPath, `${acceptanceStage} ZIP does not contain the packaged App`);
  const extractedExecutable = join(extractedAppPath, "Contents", "MacOS", "Vibe Director Studio");
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", extractedAppPath], "extracted app codesign verification");

  const acceptanceProjectRoot = join(tempRoot, "projects", "beta-sample");
  const profileRoot = join(tempRoot, "profile");
  const runtimeRoot = join(tempRoot, "runtime");
  const bindingPath = join(profileRoot, "current-project.local.json");
  const diagnosticOutputPath = join(tempRoot, "Vibe-Director-Diagnostics.zip");
  await cp(exampleRoot, acceptanceProjectRoot, { recursive: true });
  await mkdir(profileRoot, { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(bindingPath, `${JSON.stringify({
    projectRoot: acceptanceProjectRoot,
    projectRootRelativePath: acceptanceProjectRoot,
    projectVibeRelativePath: "project.vibe",
    projectId: "vibe_director_beta_sample",
    displayName: "内部 Beta 示例",
  }, null, 2)}\n`, "utf8");

  packagedLaunch = await launchPackagedAcceptanceApp({
    appPath: extractedAppPath,
    executablePath: extractedExecutable,
    profileRoot,
    projectsRoot: join(tempRoot, "projects"),
    runtimeRoot,
    bindingPath,
    extraEnv: { VIBE_ELECTRON_ACCEPTANCE_DIAGNOSTICS_OUTPUT: diagnosticOutputPath },
  });
  await waitForAcceptance(async () => {
    const body = await packagedLaunch!.client.evaluate<string>("document.body.innerText");
    return body.includes("内部 Beta 示例") && body.includes("2 镜头") ? body : undefined;
  }, `${acceptanceStage} extracted App did not open the example project`, 60_000);
  const diagnosticResult = await packagedLaunch.client.evaluate<any>("window.vibeRuntime.exportDiagnostics()");
  assert(diagnosticResult?.cancelled === false, `${acceptanceStage} packaged diagnostic export was cancelled`);
  assert(diagnosticResult?.fileName === basename(diagnosticOutputPath), `${acceptanceStage} packaged diagnostic export returned the wrong file`);
  await closePackagedAcceptanceApp(packagedLaunch);
  packagedLaunch = undefined;

  const diagnosticExtractRoot = join(tempRoot, "diagnostic-extracted");
  await mkdir(diagnosticExtractRoot, { recursive: true });
  run("/usr/bin/ditto", ["-x", "-k", diagnosticOutputPath, diagnosticExtractRoot], "diagnostic ZIP extraction");
  const diagnosticManifestPath = join(diagnosticExtractRoot, "Vibe Director Diagnostics", "diagnostics.json");
  const diagnosticManifestText = await readFile(diagnosticManifestPath, "utf8");
  const diagnosticManifest = JSON.parse(diagnosticManifestText);
  assert(diagnosticManifest.privacy.credentialsIncluded === false, `${acceptanceStage} diagnostic bundle included credentials`);
  assert(diagnosticManifest.privacy.mediaIncluded === false, `${acceptanceStage} diagnostic bundle included media`);
  assert(!diagnosticManifestText.includes(acceptanceProjectRoot), `${acceptanceStage} diagnostic bundle leaked the project path`);
  assert(!diagnosticManifestText.includes(profileRoot), `${acceptanceStage} diagnostic bundle leaked the profile path`);

  await writeFile(join(evidenceRoot, "packaged-acceptance.json"), `${JSON.stringify({
    schemaVersion: releaseId === "p11-local-beta"
      ? "p11_local_beta_packaged_acceptance/1.0.0"
      : "vibe_director_local_beta_packaged_acceptance/1.0.0",
    generatedAt: buildTime,
    status: "pass",
    stage: acceptanceStage,
    releaseId,
    zipExtracted: true,
    extractedAppLaunched: true,
    exampleProjectOpened: true,
    diagnosticExported: true,
    diagnosticPrivacy: diagnosticManifest.privacy,
    providerCalls: 0,
    publicDistributionClaimed: false,
  }, null, 2)}\n`, "utf8");
} finally {
  if (packagedLaunch) await closePackagedAcceptanceApp(packagedLaunch).catch(() => undefined);
  await rm(tempRoot, { recursive: true, force: true });
}

const artifactRows = await Promise.all([
  { kind: "dmg", filePath: dmgPath },
  { kind: "zip", filePath: zipPath },
].map(async (artifact) => ({
  kind: artifact.kind,
  path: relative(betaRoot, artifact.filePath).replace(/\\/g, "/"),
  fileName: basename(artifact.filePath),
  sizeBytes: (await stat(artifact.filePath)).size,
  sha256: await sha256(artifact.filePath),
})));
const exampleProjectHash = await sha256(join(exampleRoot, "project.vibe"));
const relevantDirtyPaths = packageRelevantDirtyPaths();
const manifest = {
  schemaVersion: "vibe_director_local_beta_release/1.0.0",
  product: "Vibe Director Studio",
  stage: acceptanceStage,
  releaseId,
  version,
  commit,
  buildTime,
  platform: process.platform,
  arch: process.arch,
  sourceState: relevantDirtyPaths.length ? "dirty" : "clean",
  relevantDirtyPaths,
  signature: "ad_hoc",
  notarized: false,
  publicDistributionClaimed: false,
  artifacts: artifactRows,
  exampleProject: {
    path: "example-project/project.vibe",
    sha256: exampleProjectHash,
    credentialsIncluded: false,
    mediaIncluded: false,
  },
  acceptance: {
    codesignVerified: true,
    dmgVerified: true,
    zipExtracted: true,
    extractedAppLaunched: true,
    exampleProjectOpened: true,
    diagnosticExported: true,
    providerCalls: 0,
  },
  providerCanary: p13ProviderCanaryAccepted ? {
    stage: "P13-A",
    status: "needs_review",
    image2GenerationRequests: 1,
    seedanceVideoSubmissions: 1,
    automaticRetries: 0,
    approved: false,
    promoted: false,
    delivered: false,
    exported: false,
  } : undefined,
};
await writeFile(join(betaRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(join(betaRoot, "README.md"), [
  `# Vibe Director Studio ${acceptanceStage} 本地 Beta`,
  "",
  "这是内部、本机使用的 ad-hoc macOS arm64 包，不是 App Store 或公开发行版本。",
  "",
  "- DMG 和 ZIP 的文件名、尺寸、SHA-256 见 `release-manifest.json`。",
  "- 首次打开时 Gatekeeper 可能提示无法验证开发者；可在 Finder 中右键应用并选择打开。",
  "- 不包含 API Key、用户项目或用户媒体。",
  "- `example-project/` 是无凭证、无媒体的本地示例。",
  "- 设置中的“导出诊断日志”只导出脱敏摘要。",
  "",
  "Public distribution NOT CLAIMED",
  "",
].join("\n"), "utf8");
await writeFile(join(betaRoot, "BACKUP-UPGRADE-ROLLBACK.md"), [
  "# 备份、升级与回滚",
  "",
  "## 备份",
  "",
  "1. 退出 Vibe Director Studio。",
  "2. 复制整个项目文件夹；不要只复制 `project.vibe`。",
  "3. 如需完整恢复本机设置，再单独备份应用的用户数据目录；其中可能包含本机凭证，勿发送给他人。",
  "",
  "## 升级旧项目",
  "",
  "1. 先复制旧项目到新文件夹。",
  "2. 用 Beta 打开副本，确认故事、Review、选择、晋级和 Delivery 状态。",
  "3. 旧 sidecar 损坏或缺失时应 fail closed；不要手工删除原媒体。",
  "",
  "## 回滚",
  "",
  "1. 退出新版 App。",
  "2. 重新打开上一版 App，并选择升级前的项目备份。",
  "3. 不要用旧版覆盖已经由新版修改的唯一项目副本。",
  "",
].join("\n"), "utf8");
const providerLimitations = p13ProviderCanaryAccepted
  ? [
      "- P13-A 已验证一次 Image2 请求和一次 Seedance `seedance2.0_vip` 提交；返回媒体仍为 `needs_review`。",
      "- 单次 Provider Canary 不是规模化稳定性、质量通过或成本稳定性证明。",
    ]
  : ["- P11-B 的单次真实视频 Canary 在 Seedance 调用前失败；真实视频 Provider 执行仍未验证。"];
await writeFile(join(betaRoot, "KNOWN-LIMITATIONS.md"), [
  "# 已知限制",
  "",
  "- 仅验证 macOS arm64 本地 Beta。",
  "- 使用 ad-hoc 签名，没有 Developer ID，也没有 notarization。",
  "- Gatekeeper 可能显示未验证开发者提示。",
  ...providerLimitations,
  "- Provider 任务不会自动重试，Review、晋级和 Delivery 仍是独立确认边界。",
  "- 这不是公开发行或规模化 Provider 稳定性证明。",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({
  status: "pass",
  betaRoot,
  manifestPath: join(betaRoot, "release-manifest.json"),
  stage: acceptanceStage,
  releaseId,
  version,
  commit,
  sourceState: manifest.sourceState,
  artifacts: artifactRows,
  exampleProjectHash,
  providerCalls: 0,
  publicDistributionClaimed: false,
}, null, 2));
