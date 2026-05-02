import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModuleGraph(entrySourcePath, entryExportPath, dependencyMap = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-provider-transport-"));
  const writeCompiled = (sourcePath, exportPath, replacements = {}) => {
    const resolved = path.resolve(sourcePath);
    const source = fs.readFileSync(resolved, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        isolatedModules: true,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
      fileName: resolved,
    });
    let code = output.outputText;
    for (const [from, to] of Object.entries(replacements)) {
      code = code.replaceAll(from, to);
    }
    const outPath = path.join(tmpDir, exportPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, code, "utf8");
  };

  for (const dependency of Object.values(dependencyMap)) {
    writeCompiled(dependency.sourcePath, dependency.exportPath, dependency.replacements || {});
  }
  writeCompiled(entrySourcePath, entryExportPath, Object.fromEntries(
    Object.entries(dependencyMap).map(([specifier, dependency]) => [specifier, dependency.replacementSpecifier]),
  ));

  return import(pathToFileURL(path.join(tmpDir, entryExportPath)).href);
}

const { buildRealProviderOneShotState } = await loadModuleGraph(
  "src/core/realProviderOneShot.ts",
  "realProviderOneShot.mjs",
  {
    'from "./providerAdapters/image2Adapter"': {
      sourcePath: "src/core/providerAdapters/image2Adapter.ts",
      exportPath: "providerAdapters/image2Adapter.mjs",
      replacementSpecifier: 'from "./providerAdapters/image2Adapter.mjs"',
    },
  },
);

const {
  buildRealProviderTransportPlan,
  buildRealProviderTransportReceipt,
  buildRealProviderTransportResult,
  realProviderTransportSchemaVersion,
} = await loadModuleGraph(
  "src/core/realProviderTransport.ts",
  "realProviderTransport.mjs",
);

const generatedAt = "2026-05-02T00:00:00.000Z";
const sandboxRoot = "real-provider-executor/project_1/batch_A";
const outputPath = `${sandboxRoot}/shots/S01/result.png`;

function oneShotActionInput(overrides = {}) {
  const requestPreview = {
    previewId: "preview_S01",
    sourceRequestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    jobId: "job_S01",
    shotId: "S01",
    providerId: "openai-image2-api",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    adapterId: "openai-image2-api-dry-run",
    operation: "image2image",
    outputPath,
    status: "preview_ready",
    blockers: [],
    warnings: [],
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    fallbackPolicy: {
      noProviderOrModeFallback: true,
      inheritedForbiddenFallbacks: ["provider_or_mode_fallback", "image2image_to_text2image"],
    },
    dryRunOnly: true,
    manualSubmitRequired: true,
    liveSubmitAllowed: false,
    liveSubmitForbidden: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    noFileMutation: true,
  };

  const adapterRequest = {
    requestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    adapterId: "openai-image2-api-dry-run",
    operation: "image2image",
    payload: {
      sourceIntent: ["create the reviewed hero keyframe"],
      mustPreserve: ["hero identity", "locked scene geometry"],
      mustAvoid: ["style drift", "extra props"],
      references: [{ referenceId: "hero_locked", source: "prompt_plan" }],
      outputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["image2image_to_text2image", "provider_or_mode_fallback"],
  };

  return {
    generatedAt,
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    requestPreview,
    adapterRequest,
    actionConfirmation: {
      confirmationId: "confirm_S01_round5",
      confirmedBy: "user",
      confirmedAt: generatedAt,
      scope: "single_image2_one_shot",
      budgetNoticeAccepted: true,
      sandboxNoticeAccepted: true,
      oneUseReceipt: true,
    },
    credentialGrant: {
      providerId: "openai-image2-api",
      credentialRef: "user-authorized:image2:demo",
      grantScope: "image2_one_shot",
      authorizedAt: generatedAt,
      secretMaterialPresent: false,
    },
    budgetNotice: {
      estimatedImageCount: 2,
      maxImagesAllowed: 2,
      maxProviderSubmits: 1,
      budgetNotice: "This action may spend up to two Image2 images from the user's configured provider quota.",
      quotaNoticeAccepted: true,
    },
    sandbox: {
      root: sandboxRoot,
      allowedPrefixes: [sandboxRoot],
      manifestPath: `${sandboxRoot}/manifest.json`,
      qaReportPath: `${sandboxRoot}/qa/qa-report.json`,
      outsideRootWriteAllowed: false,
    },
    ...overrides,
  };
}

const oneShotReady = buildRealProviderOneShotState(oneShotActionInput());
assert(oneShotReady.status === "ready_to_submit", "fixture must produce a ready one-shot state");
assert(oneShotReady.summary.providerSubmitAllowed === 1, "fixture must allow one submit");
assert(oneShotReady.compiledPayload, "fixture must compile payload");

const plan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
});

assert(plan.schemaVersion === realProviderTransportSchemaVersion, "transport schema version drifted");
assert(plan.phase === "round_5_real_provider_transport_contract", "transport phase drifted");
assert(plan.status === "mock_submit_ready", "default transport must be mock submit ready");
assert(plan.transportMode === "mock_dry_run", "transport must default to mock dry-run");
assert(plan.userReadableStatus === "准备调用", "plan should map to user-ready status");
assert(plan.payload.providerId === "openai-image2-api", "plan must carry Image2 payload only after gates pass");
assert(plan.credential.credentialRef === "user-authorized:image2:demo", "plan must carry credentialRef only");
assert(plan.credential.secretMaterialPresent === false, "plan must never carry secret material");
assert(plan.attempt.maxProviderSubmits === 1, "maxProviderSubmits must be one");
assert(plan.attempt.maxAutoRetries === 0, "maxAutoRetries must be zero");
assert(plan.attempt.automaticRetryAllowed === false, "auto retry must be forbidden");
assert(plan.transportPolicy.mockDryRunDefault === true, "mock dry-run default must be explicit");
assert(plan.transportPolicy.automaticProviderSubmitAllowed === false, "automatic provider submit must be forbidden");
assert(plan.transportPolicy.externalNetworkIoAllowed === false, "external network I/O must be forbidden");
assert(plan.transportPolicy.arbitraryShellAllowed === false, "arbitrary shell must be forbidden");
assert(plan.transportPolicy.scopedSandboxOnly === true, "transport must stay scoped to sandbox");
assert(plan.transportPolicy.outputReturnPath === "watcher_manifest_qa", "output must return through watcher/manifest/QA");
assert(plan.transportPolicy.providerSelfReportCanComplete === false, "provider self-report must not complete");
assert(plan.outputContract.expectedOutputPath === outputPath, "output contract must preserve expected path");
assert(plan.outputContract.mustReturnThroughWatcher === true, "watcher return must be required");
assert(plan.outputContract.mustMatchManifest === true, "manifest match must be required");
assert(plan.outputContract.mustPassQa === true, "QA pass must be required");

const missingPayloadPlan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: {
    ...oneShotReady,
    compiledPayload: undefined,
  },
});
assert(missingPayloadPlan.status === "blocked", "missing compiled payload must block");
assert(missingPayloadPlan.blockers.includes("Compiled Image2 one-shot payload is required before transport planning."), "missing payload blocker missing");

const nonReadyPlan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: {
    ...oneShotReady,
    status: "waiting_for_file",
    summary: {
      ...oneShotReady.summary,
      providerSubmitAllowed: 0,
    },
  },
});
assert(nonReadyPlan.status === "blocked", "non-ready state must block");
assert(nonReadyPlan.blockers.includes("Transport can only plan from ready_to_submit one-shot state."), "non-ready blocker missing");
assert(nonReadyPlan.blockers.includes("One-shot summary must allow exactly one provider submit."), "provider allowance blocker missing");

const rawCredentialPlan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  credentialRef: "sk-rawsecret123456789",
});
assert(rawCredentialPlan.status === "blocked", "raw credential-looking reference must block");
assert(rawCredentialPlan.blockers.some((blocker) => /Raw credential material/.test(blocker)), "raw credential blocker missing");

const mismatchedCredentialPlan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  credentialRef: "user-authorized:image2:other",
});
assert(mismatchedCredentialPlan.status === "blocked", "mismatched credentialRef must block");
assert(mismatchedCredentialPlan.blockers.includes("Credential reference must match the compiled payload reference."), "credential mismatch blocker missing");

const attemptedTwice = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  attemptNumber: 2,
});
assert(attemptedTwice.status === "blocked", "attempt greater than one must block");
assert(attemptedTwice.blockers.includes("Transport contract allows exactly one provider submit attempt."), "attempt blocker missing");

const manualRequiresAction = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  transportMode: "manual_real_transport",
});
assert(manualRequiresAction.status === "requires_external_action", "manual real transport must require external action by default");
assert(manualRequiresAction.transportPolicy.automaticProviderSubmitAllowed === false, "manual real transport still cannot auto-submit");

const manualReady = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  transportMode: "manual_real_transport",
  manualTransportAcknowledged: true,
});
assert(manualReady.status === "ready_for_manual_transport", "acknowledged manual transport should only be manual-ready");
assert(manualReady.transportPolicy.externalNetworkIoAllowed === false, "manual-ready must still forbid network I/O");

const receipt = buildRealProviderTransportReceipt({
  generatedAt,
  plan,
  providerTaskRef: "mock:image2:S01",
});
assert(receipt.status === "mock_submitted", "mock submit should create a mock receipt");
assert(receipt.userReadableStatus === "等待文件", "mock receipt should wait for file");
assert(receipt.attempt.attemptNumber === 1, "mock receipt should consume the single attempt");
assert(receipt.attempt.providerSubmitsRemaining === 0, "mock receipt must leave zero submits remaining");
assert(receipt.providerSelfReportIgnoredForCompletion === true, "receipt must ignore provider completion for completion gate");

const waitingResult = buildRealProviderTransportResult({
  generatedAt,
  receipt,
});
assert(waitingResult.status === "waiting_for_file", "mock submitted without watcher evidence must wait for watcher");
assert(waitingResult.userReadableStatus === "等待文件", "waiting result must map to waiting user state");
assert(waitingResult.gateEvidence.watcherExpectedOutputDetected === false, "watcher evidence should be false");
assert(waitingResult.gateEvidence.manifestMatched === false, "manifest evidence should be false");
assert(waitingResult.gateEvidence.qaPassed === false, "QA evidence should be false");

const selfReportedReceipt = buildRealProviderTransportReceipt({
  generatedAt,
  plan,
  providerTaskRef: "mock:image2:S01",
  providerSelfReportedComplete: true,
});
const selfReportOnly = buildRealProviderTransportResult({
  generatedAt,
  receipt: selfReportedReceipt,
});
assert(selfReportOnly.status === "output_missing", "provider self-report alone must not complete");
assert(selfReportOnly.userReadableStatus === "输出缺失", "self-report without output should map to missing output");
assert(selfReportOnly.gateEvidence.providerSelfReportIgnoredForCompletion === true, "self-report must be ignored in result");

const failedResult = buildRealProviderTransportResult({
  generatedAt,
  receipt,
  providerErrorMessage: "Provider returned quota_exceeded.",
});
assert(failedResult.status === "provider_call_failed", "provider error must map to call failed");
assert(failedResult.userReadableStatus === "调用失败", "provider error must be user-readable");

const reviewResult = buildRealProviderTransportResult({
  generatedAt,
  receipt,
  watcherExpectedOutputDetected: true,
  manifestMatched: true,
  qaPassed: true,
});
assert(reviewResult.status === "needs_review", "watcher/manifest/QA evidence should still require human review");
assert(reviewResult.userReadableStatus === "需要复核", "returned output should map to review");

const source = fs.readFileSync("src/core/realProviderTransport.ts", "utf8");
for (const forbiddenCode of [
  "fetch(",
  "XMLHttpRequest",
  "localStorage",
  "process.env",
  "node:fs",
  "readFile",
  "writeFile",
  "child_process",
  "spawn(",
  "exec(",
]) {
  assert(!source.includes(forbiddenCode), `realProviderTransport source must not contain ${forbiddenCode}`);
}

console.log("real-provider-transport tests passed");
