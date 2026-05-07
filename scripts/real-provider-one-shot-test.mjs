import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModule(sourcePath, exportPath) {
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-provider-one-shot-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

async function loadModuleGraph(entrySourcePath, entryExportPath, dependencyMap = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-provider-one-shot-graph-"));
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function executor(overrides = {}) {
  const root = "real-provider-executor/project_1/batch_A";
  return {
    phase: "real_test_round_executor_shell",
    mode: "executor_review",
    status: "review_ready",
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    oneShotReadiness: {
      status: "reviewable_not_executable",
      selectedShotCount: 1,
      estimatedImageCount: 2,
      confirmationSatisfied: false,
      reviewable: true,
      executable: false,
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      blockers: [],
      notes: [],
    },
    budgetGuard: {
      status: "passed",
      estimatedImageCount: 2,
      maxImagesPerPilot: 3,
      selectedShotCount: 1,
      selectedShotIds: ["S01"],
      selectedTaskPlanCount: 1,
      checks: [],
      blockers: [],
      reviewOnly: true,
      actualExecutionAllowed: false,
    },
    providerRequestPreviews: [
      {
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
        outputPath: `${root}/shots/S01/result.png`,
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
      },
    ],
    outputWatcherBridgePlan: {
      sandboxRoot: root,
      expectedOutputs: [
        {
          shotId: "S01",
          role: "image",
          path: `${root}/shots/S01/result.png`,
          source: "image2_request",
        },
      ],
      manifestPath: `${root}/manifest.json`,
      qaReportPath: `${root}/qa/qa-report.json`,
      watchGlobs: [`${root}/shots/**/*.png`, `${root}/manifest.json`, `${root}/qa/**/*.json`],
      watcherStarted: false,
      daemonStarted: false,
      noFileMutation: true,
      fileMutationAllowed: false,
      autoPromoteAllowed: false,
      promotionAllowed: false,
      planOnly: true,
    },
    summary: {
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      workerSpawnsAllowed: 0,
      fileMutationsAllowed: 0,
      automaticRetryAllowed: false,
      maxConcurrency: 1,
      maxAutoRetries: 0,
    },
    warnings: [],
    ...overrides,
  };
}

const { buildRealProviderOneShotTestState, realProviderOneShotTestHardLocks } = await loadModule(
  "src/core/realProviderOneShotTest.ts",
  "realProviderOneShotTest.mjs",
);

const { compileImage2OneShotRealCallPayload } = await loadModule(
  "src/core/providerAdapters/image2Adapter.ts",
  "image2Adapter.mjs",
);

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

const generatedAt = "2026-05-02T00:00:00.000Z";
const readyState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
  realProviderExecutor: executor(),
});

assert(readyState.schemaVersion === "0.1.0", "schema version drifted");
assert(readyState.phase === "one_creator_loop_real_test_gate", "phase drifted");
assert(readyState.status === "ready_for_action_time_confirmation", "ready executor should prepare action-time confirmation");
assert(readyState.summary.readyForActionTimeConfirmation === true, "summary must mark action-time confirmation readiness");
assert(readyState.actionReview.canAskUserForActionTimeConfirmation === true, "ready state may ask for action-time confirmation");
assert(readyState.actionReview.userConfirmedAtActionTime === false, "One Creator Loop state must not self-confirm");
assert(readyState.actionReview.confirmationReceiptPresent === false, "One Creator Loop state must not fabricate a confirmation receipt");
assert(readyState.plannedAction.providerId === "openai-image2-api", "planned action must keep Image2 provider");
assert(readyState.plannedAction.providerSlot === "image.edit", "planned action must keep image slot");
assert(readyState.plannedAction.requiredMode === "image2image", "planned action must keep Image2 mode");
assert(readyState.plannedAction.actualExecutionAllowed === false, "planned action must not allow execution");
assert(readyState.plannedAction.providerSubmitAllowed === 0, "planned action must not allow provider submit");
assert(readyState.plannedAction.liveSubmitAllowed === false, "planned action must not allow live submit");
assert(readyState.plannedAction.credentialAccessAllowed === false, "planned action must not allow credential access");
assert(readyState.plannedAction.canSpawnWorker === false, "planned action must not allow workers");
assert(readyState.plannedAction.noFileMutation === true, "planned action must not allow file mutation");
assert(readyState.outputWatcherExpectation.planOnly === true, "output watcher must stay plan-only");
assert(readyState.outputWatcherExpectation.watcherStarted === false, "watcher must not start");
assert(readyState.outputWatcherExpectation.daemonStarted === false, "daemon must not start");
assert(readyState.budgetSnapshot.estimatedImageCount === 2, "budget snapshot should carry image count");
assert(readyState.hardLocks.singleActionOnly === true, "hard locks must be single-action only");
assert(readyState.hardLocks.oneShotOnly === true, "hard locks must be one-shot only");
assert(readyState.hardLocks.image2Only === true, "hard locks must be Image2 only");
assert(readyState.hardLocks.seedanceParked === true, "Seedance must stay parked");
assert(readyState.summary.actualExecutionAllowed === false, "summary must not allow actual execution");
assert(readyState.summary.providerSubmitAllowed === 0, "summary provider submit allowance must be zero");
assert(readyState.summary.liveSubmitAllowed === false, "summary live submit must be false");
assert(readyState.summary.credentialAccessAllowed === false, "summary credential access must be false");
assert(readyState.summary.workerSpawnsAllowed === 0, "summary worker spawns must be zero");
assert(readyState.summary.fileMutationsAllowed === 0, "summary file mutations must be zero");

const lockedState = buildRealProviderOneShotTestState({
  generatedAt,
  realProviderExecutor: executor(),
});
assert(lockedState.status === "locked", "default state must stay locked");
assert(lockedState.actionReview.canAskUserForActionTimeConfirmation === false, "locked state must not ask for confirmation");

const missingExecutorState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
});
assert(missingExecutorState.status === "blocked", "missing executor must block");
assert(missingExecutorState.blockers.includes("Real test round executor state is required."), "missing executor blocker missing");

const multiShotState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
  realProviderExecutor: executor({
    selectedShotIds: ["S01", "S02"],
    budgetGuard: {
      ...executor().budgetGuard,
      selectedShotCount: 2,
      selectedShotIds: ["S01", "S02"],
    },
  }),
});
assert(multiShotState.status === "blocked", "multi-shot state must block");
assert(multiShotState.blockers.includes("One-shot test requires exactly one selected shot."), "multi-shot blocker missing");

const blockedBudgetState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
  realProviderExecutor: executor({
    budgetGuard: {
      ...executor().budgetGuard,
      status: "blocked",
      estimatedImageCount: 4,
      blockers: ["Estimated image count exceeds the pilot cap."],
    },
  }),
});
assert(blockedBudgetState.status === "blocked", "blocked budget must block One Creator Loop");
assert(blockedBudgetState.blockers.includes("Budget guard must pass before action-time confirmation."), "budget blocker missing");

function oneShotActionInput(overrides = {}) {
  const baseExecutor = executor();
  const preview = baseExecutor.providerRequestPreviews[0];
  const sourceStartFramePath = "real-provider-executor/project_1/batch_A/shots/S01/start.png";
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
      referenceImageInputs: [
        {
          inputId: "source_start_frame_S01",
          role: "source_start_frame",
          path: sourceStartFramePath,
          source: "approved_start_frame",
          required: true,
          mustUseAsVisualInput: true,
          status: "available",
          notes: ["One-shot image2image must receive the approved start frame as an explicit visual input."],
        },
      ],
      sourceStartFrameId: sourceStartFramePath,
      outputPath: preview.outputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["image2image_to_text2image", "independent_end_frame_generation", "provider_or_mode_fallback"],
  };

  return {
    generatedAt,
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    requestPreview: preview,
    adapterRequest,
    imageReferenceTransport: {
      status: "dispatch_ready",
      requestId: "image2_request_S01",
      taskPlanId: "image_task_plan_S01",
      operation: "image2image",
      requiredSourceStartFrame: true,
      sourceStartFrame: {
        inputId: "source_start_frame_S01",
        path: sourceStartFramePath,
        hash: "sha256:source-start-frame",
        mime: "image/png",
        dimensions: { width: 1280, height: 720 },
        role: "source_start_frame",
        transportRole: "explicit_local_image_reference",
      },
      transportPolicy: {
        handoffOnly: true,
        dispatchSideEffectAllowed: false,
        providerSubmitAllowed: 0,
        canSubmitProvider: false,
        liveSubmitAllowed: false,
        externalNetworkIoAllowed: false,
        providerSelfReportCanComplete: false,
        promptOnlyImageEditAllowed: false,
        seedanceOrJimengAllowed: false,
        videoAllowed: false,
        fastOrVipAllowed: false,
        textToVideoAllowed: false,
      },
      blockers: [],
    },
    actionConfirmation: {
      confirmationId: "confirm_S01_round4",
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
      root: "real-provider-executor/project_1/batch_A",
      allowedPrefixes: ["real-provider-executor/project_1/batch_A"],
      manifestPath: "real-provider-executor/project_1/batch_A/manifest.json",
      qaReportPath: "real-provider-executor/project_1/batch_A/qa/qa-report.json",
      outsideRootWriteAllowed: false,
    },
    ...overrides,
  };
}

const compiled = compileImage2OneShotRealCallPayload({
  request: oneShotActionInput().adapterRequest,
  preview: oneShotActionInput().requestPreview,
  actionConfirmationId: "confirm_S01_round4",
  credentialRef: "user-authorized:image2:demo",
  outputSandboxRoot: "real-provider-executor/project_1/batch_A",
  manifestPath: "real-provider-executor/project_1/batch_A/manifest.json",
  qaReportPath: "real-provider-executor/project_1/batch_A/qa/qa-report.json",
  imageCount: 2,
  budgetNotice: "This action may spend up to two Image2 images from the user's configured provider quota.",
});
assert(compiled.issues.length === 0, `compiled payload should not have issues: ${compiled.issues.join(",")}`);
assert(compiled.payload.providerFamily === "Image2", "compiled payload must target Image2");
assert(compiled.payload.providerId === "openai-image2-api", "compiled payload must keep the Image2 provider");
assert(compiled.payload.operation === "image2image", "compiled payload must preserve operation");
assert(compiled.payload.output.path.endsWith("/shots/S01/result.png"), "compiled payload must preserve output path");
assert(compiled.payload.sourceStartFrameId === "real-provider-executor/project_1/batch_A/shots/S01/start.png", "compiled payload must carry source start frame id");
assert(compiled.payload.referenceImageInputs.some((input) => input.role === "source_start_frame" && input.path.endsWith("/shots/S01/start.png")), "compiled payload must carry explicit source start visual input");
assert(compiled.payload.executionPolicy.actionTimeConfirmationRequired === true, "compiled payload must require action-time confirmation");
assert(compiled.payload.executionPolicy.budgetNoticeRequired === true, "compiled payload must require budget notice");
assert(compiled.payload.executionPolicy.scopedSandboxOnly === true, "compiled payload must require scoped sandbox");
assert(compiled.payload.executionPolicy.maxProviderSubmits === 1, "compiled payload must allow at most one submit");
assert(compiled.payload.executionPolicy.maxImages === 2, "compiled payload must cap image count at two");
assert(compiled.payload.executionPolicy.automaticRetryAllowed === false, "compiled payload must forbid automatic retry");
assert(compiled.payload.executionPolicy.arbitraryShellAllowed === false, "compiled payload must forbid arbitrary shell");
assert(compiled.payload.executionPolicy.unauthorizedCredentialAllowed === false, "compiled payload must forbid unauthorized credentials");
assert(compiled.payload.executionPolicy.fastOrVipAllowed === false, "compiled payload must forbid fast/VIP");
assert(compiled.payload.executionPolicy.textToVideoFallbackAllowed === false, "compiled payload must forbid text-to-video fallback");
assert(compiled.payload.executionPolicy.outputMayCompleteFromProviderSelfReport === false, "provider self-report must not complete output");

const actionReady = buildRealProviderOneShotState(oneShotActionInput());
assert(actionReady.schemaVersion === "0.1.0", "Round 4 action schema version drifted");
assert(actionReady.phase === "round_4_image2_one_shot_action_layer", "Round 4 action phase drifted");
assert(actionReady.status === "ready_to_submit", "confirmed one-shot should be ready to submit");
assert(actionReady.userReadableStatus === "准备调用", "ready status should be user-readable");
assert(actionReady.summary.canSubmitThisOneShot === true, "ready action should allow one explicit submit");
assert(actionReady.summary.providerSubmitAllowed === 1, "ready action should allow exactly one submit");
assert(actionReady.summary.maxProviderSubmits === 1, "ready action max provider submits must be one");
assert(actionReady.summary.maxAutoRetries === 0, "ready action must forbid auto retries");
assert(actionReady.summary.automaticRetryAllowed === false, "ready action automatic retry flag must be false");
assert(actionReady.summary.seedanceOrJimengLiveSubmitAllowed === false, "ready action must forbid Seedance/Jimeng live submit");
assert(actionReady.summary.fastOrVipAllowed === false, "ready action must forbid fast/VIP");
assert(actionReady.summary.textToVideoFallbackAllowed === false, "ready action must forbid text-to-video fallback");
assert(actionReady.summary.outsideSandboxWriteAllowed === false, "ready action must forbid outside sandbox writes");
assert(actionReady.summary.outputMayCompleteFromProviderSelfReport === false, "ready action must not complete from provider self-report");
assert(actionReady.gateEvidence.imageReferenceTransportDispatchReady === true, "ready image2image action must carry dispatch-ready transport evidence");
assert(actionReady.gateEvidence.imageReferenceTransportRequestMatched === true, "ready image2image action must match transport request evidence");

const missingImageReferenceTransport = buildRealProviderOneShotState(oneShotActionInput({
  imageReferenceTransport: undefined,
}));
assert(missingImageReferenceTransport.status === "blocked", "missing image reference transport must block image2image one-shot");
assert(
  missingImageReferenceTransport.blockers.includes("Image reference transport dispatch_ready evidence is required for image2image/end-frame one-shot."),
  "missing image reference transport blocker missing",
);

const blockedImageReferenceTransport = buildRealProviderOneShotState(oneShotActionInput({
  imageReferenceTransport: {
    ...oneShotActionInput().imageReferenceTransport,
    status: "blocked",
    blockers: ["prompt_only_image_edit_forbidden"],
  },
}));
assert(blockedImageReferenceTransport.status === "blocked", "blocked image reference transport must block one-shot");
assert(
  blockedImageReferenceTransport.blockers.includes("Image reference transport must be dispatch_ready before one-shot readiness."),
  "blocked image reference transport status blocker missing",
);
assert(
  blockedImageReferenceTransport.blockers.includes("Image reference transport blocker: prompt_only_image_edit_forbidden"),
  "nested image reference transport blocker missing",
);

const mismatchedImageReferenceTransport = buildRealProviderOneShotState(oneShotActionInput({
  imageReferenceTransport: {
    ...oneShotActionInput().imageReferenceTransport,
    taskPlanId: "image_task_plan_other",
  },
}));
assert(mismatchedImageReferenceTransport.status === "blocked", "mismatched image reference transport must block one-shot");
assert(
  mismatchedImageReferenceTransport.blockers.includes("Image reference transport must match the Image2 requestId, taskPlanId, and operation."),
  "mismatched image reference transport blocker missing",
);

const missingPolicyImageReferenceTransport = buildRealProviderOneShotState(oneShotActionInput({
  imageReferenceTransport: {
    ...oneShotActionInput().imageReferenceTransport,
    transportPolicy: undefined,
  },
}));
assert(missingPolicyImageReferenceTransport.status === "blocked", "missing image reference transport policy must block without throwing");
assert(
  missingPolicyImageReferenceTransport.blockers.includes("Image reference transport must remain handoff-only."),
  "missing image reference transport policy blocker missing",
);

const text2imageBase = oneShotActionInput();
const text2imageReady = buildRealProviderOneShotState({
  ...text2imageBase,
  requestPreview: {
    ...text2imageBase.requestPreview,
    providerSlot: "image.generate",
    requiredMode: "text2image",
    operation: "text2image",
    fallbackPolicy: {
      noProviderOrModeFallback: true,
      inheritedForbiddenFallbacks: ["provider_or_mode_fallback", "text2image_to_image2image"],
    },
  },
  adapterRequest: {
    ...text2imageBase.adapterRequest,
    operation: "text2image",
    frameRole: "start_frame",
    payload: {
      ...text2imageBase.adapterRequest.payload,
      sourceIntent: ["generate the reviewed start frame"],
      referenceImageInputs: [],
      sourceStartFrameId: undefined,
    },
    forbiddenFallbacks: ["provider_or_mode_fallback", "text2image_to_image2image"],
  },
  budgetNotice: {
    ...text2imageBase.budgetNotice,
    estimatedImageCount: 1,
    maxImagesAllowed: 1,
  },
  imageReferenceTransport: undefined,
});
assert(text2imageReady.status === "ready_to_submit", "text2image/start-frame one-shot must not require image reference transport");
assert(text2imageReady.gateEvidence.imageReferenceTransportDispatchReady === true, "text2image gate evidence should pass when transport is not required");
assert(
  !text2imageReady.blockers.some((blocker) => /Image reference transport|source_start_frame/.test(blocker)),
  "text2image/start-frame one-shot should not receive image reference blockers",
);

const missingVisualInputCompiled = compileImage2OneShotRealCallPayload({
  request: {
    ...oneShotActionInput().adapterRequest,
    payload: {
      ...oneShotActionInput().adapterRequest.payload,
      referenceImageInputs: [],
      sourceStartFrameId: "real-provider-executor/project_1/batch_A/shots/S01/start.png",
    },
  },
  preview: oneShotActionInput().requestPreview,
  actionConfirmationId: "confirm_S01_round4",
  credentialRef: "user-authorized:image2:demo",
  outputSandboxRoot: "real-provider-executor/project_1/batch_A",
  manifestPath: "real-provider-executor/project_1/batch_A/manifest.json",
  qaReportPath: "real-provider-executor/project_1/batch_A/qa/qa-report.json",
  imageCount: 2,
  budgetNotice: "This action may spend up to two Image2 images from the user's configured provider quota.",
});
assert(missingVisualInputCompiled.issues.includes("source_start_frame_visual_input_required"), "image2image one-shot without source visual input must not compile");

const failedCall = buildRealProviderOneShotState(oneShotActionInput({
  providerReport: {
    status: "failed",
    attemptCount: 1,
    message: "Provider returned quota_exceeded.",
  },
}));
assert(failedCall.status === "provider_call_failed", "provider failure must be visible");
assert(failedCall.userReadableStatus === "调用失败", "provider failure must use user-readable failure state");
assert(failedCall.summary.providerSubmitAllowed === 0, "failed call must not leave submit allowance open");

const waitingForFile = buildRealProviderOneShotState(oneShotActionInput({
  providerReport: {
    status: "submitted",
    attemptCount: 1,
    providerTaskId: "image2_task_123",
  },
}));
assert(waitingForFile.status === "waiting_for_file", "submitted call without output must wait for file");
assert(waitingForFile.userReadableStatus === "等待文件", "waiting state must be user-readable");

const providerSelfReportOnly = buildRealProviderOneShotState(oneShotActionInput({
  providerReport: {
    status: "succeeded",
    attemptCount: 1,
    providerTaskId: "image2_task_123",
    selfReportedComplete: true,
  },
}));
assert(providerSelfReportOnly.status === "output_missing", "provider self-report without watcher/manifest must not complete");
assert(providerSelfReportOnly.userReadableStatus === "输出缺失", "missing output must be user-readable");
assert(providerSelfReportOnly.gateEvidence.providerSelfReportIgnoredForCompletion === true, "provider self-report must be ignored for completion");

const outputPath = oneShotActionInput().requestPreview.outputPath;
const needsReview = buildRealProviderOneShotState(oneShotActionInput({
  providerReport: {
    status: "succeeded",
    attemptCount: 1,
    providerTaskId: "image2_task_123",
    selfReportedComplete: true,
  },
  watcherEvents: [
    {
      id: "watcher_expected_S01",
      eventType: "expected_output_detected",
      taskId: "image_task_plan_S01",
      jobId: "job_S01",
      shotId: "S01",
      artifactPath: outputPath,
      expectedOutputPath: outputPath,
      status: "detected",
      severity: "info",
      createdAt: generatedAt,
      notes: ["Expected output exists in sandbox."],
    },
  ],
  manifestReports: [
    {
      taskId: "image_task_plan_S01",
      status: "actual_output_present",
      expectedOutputCount: 1,
      presentOutputCount: 1,
      missingExpectedOutputs: [],
      actualOutputsPresent: [outputPath],
      recoverableOutputs: [],
      outputMatches: [],
    },
  ],
  generationHealthReports: [
    {
      reportId: "generation_health_image_task_plan_S01",
      taskPlanId: "image_task_plan_S01",
      jobId: "job_S01",
      shotId: "S01",
      expectedOutputPath: outputPath,
      outputExists: true,
      manifestStatus: "actual_output_present",
      qaStatus: "pending",
      stalePrompt: false,
      assetReadinessStatus: "ready",
      healthStatus: "qa_pending",
      blockers: [],
      warnings: ["Missing explicit QA pass."],
      nextAction: "Wait for explicit QA pass before formal promotion.",
    },
  ],
}));
assert(needsReview.status === "needs_review", "output without QA pass must need review");
assert(needsReview.userReadableStatus === "需要复核", "review state must be user-readable");
assert(needsReview.gateEvidence.watcherExpectedOutputDetected === true, "watcher evidence should be recorded");
assert(needsReview.gateEvidence.manifestMatched === true, "manifest evidence should be recorded");
assert(needsReview.gateEvidence.qaPassed === false, "pending QA must not pass");

const formalReady = buildRealProviderOneShotState(oneShotActionInput({
  providerReport: needsReview.providerReport,
  watcherEvents: needsReview.gateEvidence.watcherExpectedOutputDetected ? [
    {
      id: "watcher_expected_S01",
      eventType: "expected_output_detected",
      taskId: "image_task_plan_S01",
      jobId: "job_S01",
      shotId: "S01",
      artifactPath: outputPath,
      expectedOutputPath: outputPath,
      status: "detected",
      severity: "info",
      createdAt: generatedAt,
      notes: ["Expected output exists in sandbox."],
    },
  ] : [],
  manifestReports: [
    {
      taskId: "image_task_plan_S01",
      status: "complete",
      expectedOutputCount: 1,
      presentOutputCount: 1,
      missingExpectedOutputs: [],
      actualOutputsPresent: [outputPath],
      recoverableOutputs: [],
      outputMatches: [],
    },
  ],
  generationHealthReports: [
    {
      reportId: "generation_health_image_task_plan_S01",
      taskPlanId: "image_task_plan_S01",
      jobId: "job_S01",
      shotId: "S01",
      expectedOutputPath: outputPath,
      outputExists: true,
      manifestStatus: "complete",
      qaStatus: "pass",
      stalePrompt: false,
      assetReadinessStatus: "ready",
      healthStatus: "formal_ready",
      blockers: [],
      warnings: [],
      nextAction: "Ready for QA promotion review.",
    },
  ],
}));
assert(formalReady.status === "ready_for_formal_review", "watcher/manifest/QA gates should be required for formal readiness");
assert(formalReady.gateEvidence.qaPassed === true, "QA pass evidence should be recorded");
assert(formalReady.summary.providerSubmitAllowed === 0, "formal-ready state must not keep submit allowance open");

const missingConfirmation = buildRealProviderOneShotState(oneShotActionInput({
  actionConfirmation: undefined,
}));
assert(missingConfirmation.status === "blocked", "missing action-time confirmation must block");
assert(missingConfirmation.blockers.includes("Action-time user confirmation receipt is required."), "missing confirmation blocker missing");

const unsafeCredential = buildRealProviderOneShotState(oneShotActionInput({
  credentialGrant: {
    providerId: "openai-image2-api",
    credentialRef: "raw-secret-would-not-be-accepted",
    grantScope: "image2_one_shot",
    authorizedAt: generatedAt,
    secretMaterialPresent: true,
  },
}));
assert(unsafeCredential.status === "blocked", "raw credential material must block");
assert(unsafeCredential.blockers.some((blocker) => /credential/i.test(blocker)), "credential blocker missing");

const outsideSandbox = buildRealProviderOneShotState(oneShotActionInput({
  requestPreview: {
    ...oneShotActionInput().requestPreview,
    outputPath: "../outside/result.png",
  },
  adapterRequest: {
    ...oneShotActionInput().adapterRequest,
    payload: {
      ...oneShotActionInput().adapterRequest.payload,
      outputPath: "../outside/result.png",
    },
  },
}));
assert(outsideSandbox.status === "blocked", "outside sandbox output path must block");
assert(outsideSandbox.blockers.includes("Output path must stay inside the scoped sandbox."), "outside sandbox blocker missing");

const traversalSandbox = buildRealProviderOneShotState(oneShotActionInput({
  requestPreview: {
    ...oneShotActionInput().requestPreview,
    outputPath: "real-provider-executor/project_1/batch_A/../outside/result.png",
  },
  adapterRequest: {
    ...oneShotActionInput().adapterRequest,
    payload: {
      ...oneShotActionInput().adapterRequest.payload,
      outputPath: "real-provider-executor/project_1/batch_A/../outside/result.png",
    },
  },
}));
assert(traversalSandbox.status === "blocked", "path traversal output path must block");
assert(traversalSandbox.blockers.includes("Output path must stay inside the scoped sandbox."), "path traversal blocker missing");

const tooManyImages = buildRealProviderOneShotState(oneShotActionInput({
  budgetNotice: {
    ...oneShotActionInput().budgetNotice,
    estimatedImageCount: 3,
    maxImagesAllowed: 3,
  },
}));
assert(tooManyImages.status === "blocked", "more than two images must block");
assert(tooManyImages.blockers.some((blocker) => /one or two Image2 images/.test(blocker)), "image count blocker missing");

const retried = buildRealProviderOneShotState(oneShotActionInput({
  providerReport: {
    status: "submitted",
    attemptCount: 2,
  },
}));
assert(retried.status === "blocked", "automatic retry attempt must block");
assert(retried.blockers.includes("Automatic retry is forbidden; attempt count cannot exceed one."), "retry blocker missing");

const schema = readJson("schemas/real_provider_one_shot_test.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/real_provider_one_shot_test.schema.json", "schema id drifted");
assert(schema.properties.phase.const === "one_creator_loop_real_test_gate", "schema phase drifted");
assert(schema.properties.forbiddenActions.items.enum.includes("provider_submit_without_action_confirmation"), "schema must forbid unconfirmed provider submit");
assert(schema.$defs.hardLocks.properties.actualExecutionAllowed.const === false, "schema must hard-lock actual execution");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema must hard-lock provider submit");

for (const key of [
  "defaultLocked",
  "singleActionOnly",
  "oneShotOnly",
  "image2Only",
  "seedanceParked",
  "videoProvidersParked",
  "noSubprocess",
  "noShellExecution",
  "noFileMutation",
]) {
  assert(realProviderOneShotTestHardLocks[key] === true, `${key} hard lock must be true`);
}
for (const key of [
  "actualExecutionAllowed",
  "liveSubmitAllowed",
  "credentialAccessAllowed",
  "canSpawnWorker",
  "automaticRetryAllowed",
]) {
  assert(realProviderOneShotTestHardLocks[key] === false, `${key} hard lock must be false`);
}
assert(realProviderOneShotTestHardLocks.providerSubmitAllowed === 0, "providerSubmitAllowed hard lock must be zero");
assert(realProviderOneShotTestHardLocks.maxConcurrency === 1, "max concurrency hard lock must be one");
assert(realProviderOneShotTestHardLocks.maxAutoRetries === 0, "max auto retries hard lock must be zero");

const source = fs.readFileSync("src/core/realProviderOneShotTest.ts", "utf8");
for (const forbiddenCode of ["fetch(", "spawn(", "exec(", "writeFile", "readFile", "process.env"]) {
  assert(!source.includes(forbiddenCode), `realProviderOneShotTest source must not contain ${forbiddenCode}`);
}

const actionSource = fs.readFileSync("src/core/realProviderOneShot.ts", "utf8");
for (const forbiddenCode of ["fetch(", "spawn(", "exec(", "writeFile", "readFile", "process.env"]) {
  assert(!actionSource.includes(forbiddenCode), `realProviderOneShot source must not contain ${forbiddenCode}`);
}

console.log("real-provider-one-shot tests passed");
