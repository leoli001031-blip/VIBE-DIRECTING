export const currentProjectImage2TransportContractSchemaVersion =
  "vibe_core_current_project_image2_transport_adapter_contract_v1";

export const currentProjectImage2TransportModes = Object.freeze([
  "manual",
  "codex_app_server",
  "codex_cli",
  "disabled",
]);

export const currentProjectImage2ForbiddenProviders = Object.freeze([
  "seedance",
  "jimeng",
  "fast",
  "vip",
  "video",
]);

export function normalizeCurrentProjectImage2TransportMode(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { mode: "manual", raw, provided: false, valid: true };
  }
  const normalized = raw.toLowerCase();
  const valid = currentProjectImage2TransportModes.includes(normalized);
  return {
    mode: valid ? normalized : "manual",
    raw,
    provided: true,
    valid,
  };
}

export function buildCurrentProjectImage2TransportPlan(input) {
  const modeInfo = normalizeCurrentProjectImage2TransportMode(input.transportMode);
  const base = {
    schemaVersion: currentProjectImage2TransportContractSchemaVersion,
    generatedAt: input.generatedAt,
    transportMode: modeInfo.mode,
    requestedTransportMode: modeInfo.raw || input.requestedTransportMode,
    transportModeAllowed: modeInfo.valid,
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds || (input.selectedShotId ? [input.selectedShotId] : []),
    receiptId: input.receiptId,
    handoffId: input.handoffId,
    promptPath: input.promptPath,
    promptText: input.promptText,
    expectedOutputPath: input.expectedOutputPath,
    providerObservationPath: input.providerObservationPath,
    semanticQaPath: input.semanticQaPath,
    triggerPlanPath: input.triggerPlanPath,
    receiptStatePath: input.receiptStatePath,
    handoffStatePath: input.handoffStatePath,
    forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
    providerCallAllowed: false,
    actualExecutionAllowed: false,
    actionTimeConfirmationRequired: true,
    providerCalled: false,
    actualImage2Triggered: false,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    clearInstruction:
      "After explicit action-time confirmation, the real Image2 output image must be written to expectedOutputPath. Sidecars must include actual provider observation, actual semantic QA, and sha256 bound to that exact output.",
    returnExecutorInstruction:
      "Run the return executor only after expectedOutputPath, providerObservationPath, and semanticQaPath contain actual provider evidence with matching sha256.",
    sidecarRequirements: {
      providerObservation: {
        path: input.providerObservationPath,
        requiredFields: [
          "providerObservationMode=actual_provider_call_observed",
          "providerCalled=true",
          "actualImage2Triggered=true",
          "outputPath",
          "outputSha256",
        ],
      },
      semanticQa: {
        path: input.semanticQaPath,
        requiredFields: [
          "semanticReviewMode=actual_image_semantic_review",
          "outputPath",
          "reviewedOutputSha256",
          "status=needs_review",
        ],
      },
    },
  };

  if (modeInfo.mode === "codex_app_server") {
    return {
      ...base,
      target: "codex_app_server",
      status: modeInfo.valid ? "trigger_plan_ready" : "blocked",
      appServerPayloadPreview: {
        endpoint: "/api/codex/app-server/image2/one-shot",
        method: "POST",
        payload: {
          selectedShotId: input.selectedShotId,
          receiptId: input.receiptId,
          handoffId: input.handoffId,
          promptPath: input.promptPath,
          promptText: input.promptText,
          expectedOutputPath: input.expectedOutputPath,
          providerObservationPath: input.providerObservationPath,
          semanticQaPath: input.semanticQaPath,
          forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
          providerCallAllowed: false,
          actualExecutionAllowed: false,
          actionTimeConfirmationRequired: true,
        },
      },
      commandPreview: undefined,
    };
  }

  if (modeInfo.mode === "codex_cli") {
    const args = [
      "image2",
      "trigger",
      "--receipt",
      input.receiptStatePath,
      "--handoff",
      input.handoffStatePath,
      "--trigger-plan",
      input.triggerPlanPath,
      "--output",
      input.expectedOutputPath,
    ];
    return {
      ...base,
      target: "codex_cli",
      status: modeInfo.valid ? "trigger_plan_ready" : "blocked",
      commandPreview: {
        command: "codex",
        args,
        cwd: input.cwd,
        shellPreview: `codex ${args.map((item) => JSON.stringify(item)).join(" ")}`,
        providerCallAllowed: false,
        actualExecutionAllowed: false,
      },
      appServerPayloadPreview: undefined,
    };
  }

  if (modeInfo.mode === "disabled") {
    return {
      ...base,
      target: "disabled",
      status: "disabled",
      commandPreview: undefined,
      appServerPayloadPreview: undefined,
      blockers: ["Image2 transport mode is disabled for this request."],
    };
  }

  return {
    ...base,
    target: "manual",
    status: modeInfo.valid ? "trigger_plan_ready" : "blocked",
    commandPreview: {
      mode: "manual",
      instruction:
        "Use the prompt text and locked references manually only after action-time confirmation; write the actual output and hash-bound sidecars to the listed paths.",
      providerCallAllowed: false,
      actualExecutionAllowed: false,
    },
    appServerPayloadPreview: undefined,
  };
}
