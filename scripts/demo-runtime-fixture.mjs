import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const smallProjectFixture = {
  generatedAt: "2026-05-02T12:00:00.000Z",
  projectRoot: "fixtures/small-project-one-shot",
  batchRoot: "real-test-sandbox/small-project-one-shot/batch_001",
  projectTitle: "Small Project One Shot",
  selectedShotId: "S01",
  batchId: "batch_001",
};

smallProjectFixture.outputPath = `${smallProjectFixture.batchRoot}/shots/S01/start.png`;
smallProjectFixture.characterPath = `${smallProjectFixture.projectRoot}/assets/characters/nova/main.png`;
smallProjectFixture.scenePath = `${smallProjectFixture.projectRoot}/assets/scenes/elevated-platform/master.png`;
smallProjectFixture.stylePath = `${smallProjectFixture.projectRoot}/assets/styles/quiet-cinema/style.png`;

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function compact(value) {
  return JSON.stringify(value, null, 2);
}

function collectTsFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function rewriteRelativeImports(output) {
  return output.replace(/from\s+["'](\.{1,2}\/[^"']+)["']/g, (match, specifier) => {
    if (/\.(?:mjs|js|json|css|svg|png|jpg|jpeg|webp)$/.test(specifier)) return match;
    return match.replace(specifier, `${specifier}.mjs`);
  });
}

function transpile(sourcePath) {
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: sourcePath,
  }).outputText;
  return rewriteRelativeImports(output);
}

export async function loadCore() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-small-project-"));
  const coreRoot = path.resolve("src/core");
  for (const sourcePath of collectTsFiles(coreRoot)) {
    const relative = path.relative(coreRoot, sourcePath).replace(/\.ts$/, ".mjs");
    const outputPath = path.join(tmpDir, relative);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, transpile(sourcePath), "utf8");
  }
  return {
    projectStateBuilder: await import(pathToFileURL(path.join(tmpDir, "projectStateBuilder.mjs")).href),
    providerPolicy: await import(pathToFileURL(path.join(tmpDir, "providerPolicy.mjs")).href),
  };
}

function gates(overrides = {}) {
  return {
    identity: "PASS",
    scene: "PASS",
    pair: "N/A",
    story: "PASS",
    prop: "N/A",
    style: "PASS",
    ...overrides,
  };
}

export function buildSmallProjectAudit(providerPolicy, options = {}) {
  const fixture = { ...smallProjectFixture, ...options };
  return {
    importedAt: fixture.generatedAt,
    projectTitle: fixture.projectTitle,
    projectRoot: fixture.projectRoot,
    sourceTask: `${fixture.projectRoot}/tasks/small-project-one-shot.md`,
    state: "ready_for_scoped_real_test_review",
    fileSnapshot: [
      fixture.characterPath,
      fixture.scenePath,
      fixture.stylePath,
      fixture.outputPath,
      `${fixture.batchRoot}/qa/S01_start.qa.json`,
    ],
    metrics: {
      expectedAssets: 3,
      existingAssets: 3,
      expectedKeyframes: 1,
      existingKeyframes: 1,
      expectedVideos: 0,
      existingVideos: 0,
      providerEvents: 0,
      dreaminaImageEvents: 0,
      forbiddenFallbackEvents: 0,
    },
    providerPolicy,
    workflow: [
      {
        id: "story",
        label: "Story Flow",
        status: "done",
        detail: "One-shot small project fixture with locked assets and one Image2 start-frame plan.",
      },
      {
        id: "image2_review",
        label: "Image2 Review",
        status: "active",
        detail: "Scoped review only; no provider submit is opened.",
      },
    ],
    assets: [
      {
        id: "nova_identity_main",
        type: "character",
        name: "Nova main identity",
        path: fixture.characterPath,
        status: "exists",
        lockedStatus: "locked",
        providerId: "openai-image2-codex-cli",
        requiredMode: "text2image",
        safeForFutureReference: true,
        dimensions: "16:9",
        issues: [],
      },
      {
        id: "night_platform_master",
        type: "scene",
        name: "Rainy elevated platform master",
        path: fixture.scenePath,
        status: "exists",
        lockedStatus: "locked",
        providerId: "openai-image2-codex-cli",
        requiredMode: "text2image",
        safeForFutureReference: true,
        dimensions: "16:9",
        issues: [],
      },
      {
        id: "quiet_cinema_style",
        type: "style",
        name: "Quiet low-texture cinema style",
        path: fixture.stylePath,
        status: "exists",
        lockedStatus: "locked",
        providerId: "openai-image2-codex-cli",
        requiredMode: "text2image",
        safeForFutureReference: true,
        dimensions: "16:9",
        issues: [],
      },
    ],
    shots: [
      {
        id: "S01",
        actId: "A1",
        sectionId: "A1",
        title: "Nova waits with a star-map card",
        storyFunction:
          "Establish Nova alone on a rainy elevated train platform at night, holding a glowing star-map card before deciding to leave.",
        startFrame: fixture.outputPath,
        status: "ready",
        gates: gates(),
        issues: [],
      },
    ],
    jobs: [
      {
        id: "S01_start_image2",
        slot: "image.generate",
        requiredMode: "text2image",
        providerId: "openai-image2-codex-cli",
        status: "planned",
        outputPath: fixture.outputPath,
        promptPath: `${fixture.projectRoot}/prompts/S01_start.md`,
        references: [fixture.characterPath, fixture.scenePath, fixture.stylePath],
        issues: [],
      },
    ],
    issues: [],
    contactSheets: {},
  };
}

export async function buildSmallProjectDemoRuntime(options = {}) {
  const fixture = { ...smallProjectFixture, ...options.fixture };
  const { projectStateBuilder, providerPolicy } = await loadCore();
  const audit = buildSmallProjectAudit(providerPolicy.defaultProviderPolicy, fixture);
  const runtimeState = projectStateBuilder.buildProjectRuntimeState(audit, projectStateBuilder.emptyKnowledgeManifest, {
    generatedAt: fixture.generatedAt,
    selectedShotId: fixture.selectedShotId,
    realTestMode: "scoped_real_test",
    realTestBatchId: fixture.batchId,
    realTestShotIds: [fixture.selectedShotId],
    realTestOutputSandbox: {
      root: fixture.batchRoot,
      allowedPrefixes: [fixture.batchRoot],
      manifestPath: `${fixture.batchRoot}/manifest.json`,
      qaReportPath: `${fixture.batchRoot}/qa/qa-report.json`,
      ledgerPath: `${fixture.batchRoot}/execution-ledger.json`,
    },
    generationQaStatusByOutputPath: {
      [fixture.outputPath]: "pass",
    },
    stateSource: options.stateSource,
  });
  runtimeState.directorProgress = {
    label: "等待确认",
    detail: "1 个 Image2 小样 · 动作确认后生成",
    tone: "review",
    total: 1,
    preparing: 0,
    working: 0,
    review: 1,
    blocked: 0,
    complete: 0,
  };
  return { audit, runtimeState, fixture };
}

export function assertCleanSmallProjectRuntimeState(runtimeState, audit) {
  const taskPlans = runtimeState.imagePipeline.imageTaskPlans;
  const adapterRequests = runtimeState.imagePipeline.image2AdapterRequests;
  const taskPlan = taskPlans[0];
  const request = adapterRequests[0];
  const outputPath = smallProjectFixture.outputPath;

  if (audit) {
    assert(audit.projectTitle === "Small Project One Shot", `audit project title drifted: ${audit.projectTitle}`);
    assert(audit.jobs.length === 1, `expected one audit job, got ${audit.jobs.length}`);
  }

  assert(runtimeState.project.title === "Small Project One Shot", "project title should survive runtime build");
  assert(taskPlans.length === 1, `expected one image task plan, got ${taskPlans.length}`);
  assert(taskPlan.status === "ready_for_dry_run", `task plan should be ready, got ${taskPlan.status}: ${taskPlan.blockers.join("; ")}`);
  assert(taskPlan.providerId === "openai-image2-codex-cli", "task plan should keep Image2 Codex CLI provider");
  assert(adapterRequests.length === 1, `expected one Image2 adapter request, got ${adapterRequests.length}`);
  assert(request.operation === "text2image", `request operation should be text2image, got ${request.operation}`);
  assert(request.submitPolicy.dry_run_only === true, "adapter request must stay dry-run only");
  assert(request.submitPolicy.live_submit_forbidden === true, "adapter request must forbid live submit");
  assert(request.payload.outputPath === outputPath, "adapter request output path drifted");

  assert(runtimeState.executionLedger.status === "ready_for_scoped_review", `ledger status: ${runtimeState.executionLedger.status}`);
  assert(runtimeState.executionLedger.entries.length === 1, "ledger should have one scoped entry");
  assert(runtimeState.executionLedger.entries[0].qaStatus === "pass", "ledger entry should carry explicit QA pass");
  assert(runtimeState.executionLedger.entries[0].outputSandboxValid === true, "ledger output should stay inside sandbox");
  assert(runtimeState.realExecutionGate.status === "ready_for_scoped_real_test_review", `real gate status: ${runtimeState.realExecutionGate.status}`);
  assert(
    runtimeState.realProviderPilot.status === "review_ready",
    `pilot status: ${runtimeState.realProviderPilot.status}\n${compact({
      blockers: runtimeState.realProviderPilot.blockers,
      checks: runtimeState.realProviderPilot.checks,
      items: runtimeState.realProviderPilot.items,
    })}`,
  );
  assert(
    runtimeState.realProviderExecutor.status === "review_ready",
    `executor status: ${runtimeState.realProviderExecutor.status}\n${compact({
      blockers: runtimeState.realProviderExecutor.blockers,
      budgetGuard: runtimeState.realProviderExecutor.budgetGuard,
      previews: runtimeState.realProviderExecutor.providerRequestPreviews,
    })}`,
  );
  assert(runtimeState.realProviderExecutor.providerRequestPreviews.length === 1, "executor should expose one request preview");
  assert(runtimeState.realProviderExecutor.providerRequestPreviews[0].status === "preview_ready", "request preview should be ready");
  assert(runtimeState.realProviderExecutor.oneShotReadiness.status === "reviewable_not_executable", "one-shot readiness should be reviewable");
  assert(
    runtimeState.realProviderOneShotTest.status === "ready_for_action_time_confirmation",
    `one-shot gate status: ${runtimeState.realProviderOneShotTest.status}`,
  );
  assert(runtimeState.realProviderOneShotTest.summary.readyForActionTimeConfirmation === true, "summary should be ready for action-time confirmation");

  for (const [label, state] of [
    ["executionLedger", runtimeState.executionLedger],
    ["realExecutionGate", runtimeState.realExecutionGate],
    ["realProviderPilot", runtimeState.realProviderPilot],
    ["realProviderExecutor", runtimeState.realProviderExecutor],
    ["realProviderOneShotTest", runtimeState.realProviderOneShotTest],
  ]) {
    assert(state.hardLocks.actualExecutionAllowed === false, `${label} must not allow actual execution`);
    assert(state.hardLocks.credentialAccessAllowed === false, `${label} must not allow credential access`);
    assert(state.hardLocks.noFileMutation === true, `${label} must not allow file mutation`);
  }

  assert(runtimeState.realProviderExecutor.summary.providerSubmitAllowed === 0, "executor must allow zero provider submits");
  assert(runtimeState.realProviderOneShotTest.summary.providerSubmitAllowed === 0, "one-shot gate must allow zero provider submits");
  assert(runtimeState.realProviderOneShotTest.plannedAction.canSpawnWorker === false, "one-shot planned action must not spawn workers");
  assert(runtimeState.realProviderOneShotTest.outputWatcherExpectation.planOnly === true, "watcher expectation must stay plan-only");
  assert(runtimeState.directorProgress?.blocked === 0, "demo director progress should not surface diagnostic blockers");
  assert(runtimeState.directorProgress?.review === 1, "demo director progress should surface one action-time review item");

  return {
    taskPlan,
    request,
    outputPath,
    summary: {
      projectTitle: runtimeState.project.title,
      taskPlanStatus: taskPlan.status,
      adapterRequest: request.requestId,
      ledgerStatus: runtimeState.executionLedger.status,
      realGateStatus: runtimeState.realExecutionGate.status,
      pilotStatus: runtimeState.realProviderPilot.status,
      executorStatus: runtimeState.realProviderExecutor.status,
      oneShotStatus: runtimeState.realProviderOneShotTest.status,
      plannedProvider: runtimeState.realProviderOneShotTest.plannedAction.providerId,
      outputPath,
    },
  };
}

export async function writeDemoRuntimeArtifacts(options = {}) {
  const outputDir = path.resolve(options.outputDir || "public");
  const stateFileName = options.stateFileName || "demo-runtime-state.json";
  const auditFileName = options.auditFileName || "demo-runtime-audit.json";
  const statePublicPath = `/${stateFileName}`;
  const auditPublicPath = `/${auditFileName}`;
  const { audit, runtimeState, fixture } = await buildSmallProjectDemoRuntime({
    stateSource: {
      kind: "runtime-state",
      label: "demo small runtime",
      path: statePublicPath,
      sourceAuditPath: auditPublicPath,
      sourceImportedAt: smallProjectFixture.generatedAt,
      note: "Clean small-project demo fixture generated by scripts/build-demo-runtime-state.mjs.",
    },
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const statePath = path.join(outputDir, stateFileName);
  const auditPath = path.join(outputDir, auditFileName);
  fs.writeFileSync(statePath, `${JSON.stringify(runtimeState, null, 2)}\n`, "utf8");
  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  return { audit, runtimeState, fixture, statePath, auditPath, statePublicPath, auditPublicPath };
}
