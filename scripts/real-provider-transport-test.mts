import fs from "node:fs";

import { buildRealProviderOneShotState } from "../src/core/realProviderOneShot.ts";
import {
  buildRealProviderTransportPlan,
  buildRealProviderTransportReceipt,
  buildRealProviderTransportResult,
  realProviderTransportSchemaVersion,
} from "../src/core/realProviderTransport.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
      referenceImageInputs: [
        {
          inputId: "source_start_frame_S01",
          role: "source_start_frame",
          path: `${sandboxRoot}/shots/S01/start.png`,
          source: "approved_start_frame",
          required: true,
          mustUseAsVisualInput: true,
          status: "available",
          notes: ["Transport fixture must carry the approved start frame as an explicit visual input."],
        },
      ],
      sourceStartFrameId: `${sandboxRoot}/shots/S01/start.png`,
      outputPath,
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
    requestPreview,
    adapterRequest,
    imageReferenceTransport: imageReferenceTransport(),
    imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
    actionConfirmation: {
      confirmationId: "confirm_S01_real_test_round",
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

function imageReferenceTransport(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    generatedAt,
    phase: "image_reference_transport_handoff",
    status: "dispatch_ready",
    requestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    operation: "image2image",
    frameRole: "end_frame",
    requiredSourceStartFrame: true,
    sourceStartFrame: {
      inputId: "source_start_frame_S01",
      path: `${sandboxRoot}/shots/S01/start.png`,
      hash: "sha256:source-start-frame",
      mime: "image/png",
      dimensions: { width: 1280, height: 720 },
      role: "source_start_frame",
      transportRole: "explicit_local_image_reference",
    },
    capabilityEvidence: {
      providerId: "openai-image2-api",
      providerSlot: "image.edit",
      requiredMode: "image2image",
      interfaceKind: "explicit_image_input",
      promptOnly: false,
      actionSupportsExplicitImageInput: true,
      appServerImageRuntimeReady: true,
      appServerSupportsExplicitImageInput: true,
      supportedReferenceRoles: ["source_start_frame"],
    },
    outputSandbox: {
      root: sandboxRoot,
      expectedOutputPath: outputPath,
      manifestPath: `${sandboxRoot}/manifest.json`,
      qaReportPath: `${sandboxRoot}/qa/qa-report.json`,
      scopedSandboxOnly: true,
      outsideRootWriteAllowed: false,
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
    warnings: [],
    notes: [],
    ...overrides,
  };
}

function imageReferenceDeliveryReceipt(overrides = {}) {
  return {
    status: "delivered",
    requestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    operation: "image2image",
    frameRole: "end_frame",
    requiredSourceStartFrame: true,
    sourceStartFrame: {
      inputId: "source_start_frame_S01",
      path: `${sandboxRoot}/shots/S01/start.png`,
      sha256: "sha256:source-start-frame",
      mime: "image/png",
      byteLength: 1024,
      dimensions: { width: 1280, height: 720 },
      exists: true,
      readable: true,
      pathScope: "sandbox",
      role: "source_start_frame",
      transportRole: "explicit_local_image_reference",
    },
    delivery: {
      deliveredInputKind: "app_server_localImage",
      actionSchemaParamName: "input_image",
      acceptedByActionSchema: true,
      deliveredSha256: "sha256:source-start-frame",
      promptOnly: false,
      protocol: {
        threadId: "dry_thread_S01",
        turnId: "dry_turn_S01",
        toolCallId: "dry_tool_call_S01",
      },
      toolSchemaHash: "sha256:dry-image-action-schema",
      generatedSchemaVersion: "dry_fixture_v0",
    },
    verification: {
      dispatchReady: true,
      sourceReceiptMatchedTransport: true,
      deliveredBytesMatchedSource: true,
      acceptedByActionSchema: true,
      protocolBindingPresent: true,
      explicitImageInput: true,
      promptOnly: false,
    },
    transportPolicy: {
      receiptOnly: true,
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
    deliveryPolicy: {
      sideEffectAllowed: false,
      providerSubmitAllowed: 0,
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
    ...overrides,
  };
}

function text2imageOneShotActionInput() {
  const input = oneShotActionInput();
  return {
    ...input,
    requestPreview: {
      ...input.requestPreview,
      providerSlot: "image.generate",
      requiredMode: "text2image",
      operation: "text2image",
    },
    adapterRequest: {
      ...input.adapterRequest,
      operation: "text2image",
      payload: {
        ...input.adapterRequest.payload,
        referenceImageInputs: [],
        sourceStartFrameId: undefined,
        sourceIntent: ["generate the start frame from source intent"],
      },
      forbiddenFallbacks: ["provider_or_mode_fallback", "text2image_to_image2image"],
    },
    budgetNotice: {
      ...input.budgetNotice,
      estimatedImageCount: 1,
      maxImagesAllowed: 1,
    },
  };
}

const oneShotReady = buildRealProviderOneShotState(oneShotActionInput({
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
}));
assert(oneShotReady.status === "ready_to_submit", `fixture must produce a ready one-shot state: ${oneShotReady.blockers.join("; ")}`);
assert(oneShotReady.summary.providerSubmitAllowed === 1, "fixture must allow one submit");
assert(oneShotReady.compiledPayload, "fixture must compile payload");

const plan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
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
assert(plan.imageReferenceDelivery.status === "delivered", "transport plan must expose delivered image reference evidence");
assert(plan.imageReferenceDelivery.sourceStartFrameSha256 === "sha256:source-start-frame", "transport plan must preserve delivered source sha256");

const missingImageReferenceTransport = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
});
assert(missingImageReferenceTransport.status === "blocked", "image2image transport without image reference handoff must block");
assert(
  missingImageReferenceTransport.blockers.includes("Image reference transport dispatch-ready evidence is required before image2image transport planning."),
  "missing image reference transport blocker missing",
);

const blockedImageReferenceTransport = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport({
    status: "blocked",
    sourceStartFrame: undefined,
    blockers: ["source_start_frame_file_facts_missing"],
  }),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
});
assert(blockedImageReferenceTransport.status === "blocked", "blocked image reference handoff must block transport plan");
assert(
  blockedImageReferenceTransport.blockers.includes("Image reference transport must be dispatch_ready before image2image transport planning."),
  "blocked handoff status blocker missing",
);
assert(
  blockedImageReferenceTransport.blockers.includes("Image reference transport blocker: source_start_frame_file_facts_missing"),
  "nested image reference blocker missing",
);

const mismatchedImageReferenceTransport = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport({
    requestId: "image2_request_other",
    taskPlanId: "image_task_plan_other",
    sourceStartFrame: {
      ...imageReferenceTransport().sourceStartFrame,
      path: `${sandboxRoot}/shots/S01/other-start.png`,
    },
  }),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
});
assert(mismatchedImageReferenceTransport.status === "blocked", "mismatched image reference handoff must block transport plan");
assert(
  mismatchedImageReferenceTransport.blockers.includes("Image reference transport requestId must match the compiled payload requestId."),
  "requestId mismatch blocker missing",
);
assert(
  mismatchedImageReferenceTransport.blockers.includes("Image reference transport taskPlanId must match the compiled payload taskPlanId."),
  "taskPlanId mismatch blocker missing",
);
assert(
  mismatchedImageReferenceTransport.blockers.includes("Image reference transport receipt path must match the compiled payload sourceStartFrameId."),
  "source frame path mismatch blocker missing",
);

const missingReceiptImageReferenceTransport = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport({
    sourceStartFrame: undefined,
  }),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
});
assert(missingReceiptImageReferenceTransport.status === "blocked", "missing source_start_frame receipt must block transport plan");
assert(
  missingReceiptImageReferenceTransport.blockers.includes("Image reference transport source_start_frame receipt is required before image2image transport planning."),
  "missing source_start_frame receipt blocker missing",
);

const missingPolicyImageReferenceTransport = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport({
    transportPolicy: undefined,
  }),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
});
assert(missingPolicyImageReferenceTransport.status === "blocked", "missing handoff policy must block transport plan without throwing");
assert(
  missingPolicyImageReferenceTransport.blockers.includes("Image reference transport handoff must remain handoff-only."),
  "missing handoff policy blocker missing",
);

const missingImageReferenceDeliveryReceipt = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
});
assert(missingImageReferenceDeliveryReceipt.status === "blocked", "image2image transport without delivery receipt must block");
assert(
  missingImageReferenceDeliveryReceipt.blockers.includes("Image reference delivery receipt is required before image2image transport planning."),
  "missing image reference delivery receipt blocker missing",
);

const blockedImageReferenceDeliveryReceipt = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt({
    status: "blocked",
    blockers: ["image_reference_delivery_sha256_must_match_source_file"],
  }),
});
assert(blockedImageReferenceDeliveryReceipt.status === "blocked", "blocked delivery receipt must block transport plan");
assert(
  blockedImageReferenceDeliveryReceipt.blockers.includes("Image reference delivery receipt must be delivered before image2image transport planning."),
  "blocked delivery receipt status blocker missing",
);
assert(
  blockedImageReferenceDeliveryReceipt.blockers.includes("Image reference delivery blocker: image_reference_delivery_sha256_must_match_source_file"),
  "nested delivery receipt blocker missing",
);

const promptOnlyImageReferenceDeliveryReceipt = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt({
    delivery: {
      ...imageReferenceDeliveryReceipt().delivery,
      deliveredInputKind: "prompt",
    },
  }),
});
assert(promptOnlyImageReferenceDeliveryReceipt.status === "blocked", "prompt-only delivery receipt must block transport plan");
assert(
  promptOnlyImageReferenceDeliveryReceipt.blockers.includes("Image reference delivery input kind must be visual before transport planning."),
  "prompt-only delivery transport blocker missing",
);

const mismatchedImageReferenceDeliveryReceipt = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt({
    sourceStartFrame: {
      ...imageReferenceDeliveryReceipt().sourceStartFrame,
      sha256: "sha256:other",
    },
  }),
});
assert(mismatchedImageReferenceDeliveryReceipt.status === "blocked", "mismatched delivery receipt must block transport plan");
assert(
  mismatchedImageReferenceDeliveryReceipt.blockers.includes("Image reference delivery sha256 must match Image Reference Transport hash."),
  "delivery transport hash mismatch blocker missing",
);

const text2imageReady = buildRealProviderOneShotState(text2imageOneShotActionInput());
assert(text2imageReady.status === "ready_to_submit", "text2image fixture must produce a ready one-shot state");
const text2imagePlanWithoutImageReferenceTransport = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: text2imageReady,
});
assert(text2imagePlanWithoutImageReferenceTransport.status === "mock_submit_ready", "text2image transport must not require source_start_frame handoff");
assert(
  !text2imagePlanWithoutImageReferenceTransport.blockers.some((blocker) => /Image reference transport|source_start_frame receipt/.test(blocker)),
  "text2image start-frame transport should not receive image-reference blockers",
);

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
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
});
assert(nonReadyPlan.status === "blocked", "non-ready state must block");
assert(nonReadyPlan.blockers.includes("Transport can only plan from ready_to_submit one-shot state."), "non-ready blocker missing");
assert(nonReadyPlan.blockers.includes("One-shot summary must allow exactly one provider submit."), "provider allowance blocker missing");

const rawCredentialPlan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
  credentialRef: "sk-rawsecret123456789",
});
assert(rawCredentialPlan.status === "blocked", "raw credential-looking reference must block");
assert(rawCredentialPlan.blockers.some((blocker) => /Raw credential material/.test(blocker)), "raw credential blocker missing");

const mismatchedCredentialPlan = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
  credentialRef: "user-authorized:image2:other",
});
assert(mismatchedCredentialPlan.status === "blocked", "mismatched credentialRef must block");
assert(mismatchedCredentialPlan.blockers.includes("Credential reference must match the compiled payload reference."), "credential mismatch blocker missing");

const attemptedTwice = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
  attemptNumber: 2,
});
assert(attemptedTwice.status === "blocked", "attempt greater than one must block");
assert(attemptedTwice.blockers.includes("Transport contract allows exactly one provider submit attempt."), "attempt blocker missing");

const manualRequiresAction = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
  transportMode: "manual_real_transport",
});
assert(manualRequiresAction.status === "requires_external_action", "manual real transport must require external action by default");
assert(manualRequiresAction.transportPolicy.automaticProviderSubmitAllowed === false, "manual real transport still cannot auto-submit");

const manualReady = buildRealProviderTransportPlan({
  generatedAt,
  oneShotState: oneShotReady,
  imageReferenceTransport: imageReferenceTransport(),
  imageReferenceDeliveryReceipt: imageReferenceDeliveryReceipt(),
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
