import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadPhaseRoadmapRuntime() {
  const sourcePath = path.resolve("src/core/phaseRoadmapRuntime.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-phase-roadmap-runtime-"));
  const outPath = path.join(tmpDir, "phaseRoadmapRuntime.mjs");
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function phase(plan, phaseId) {
  const found = plan.phases.find((item) => item.phaseId === phaseId);
  assert(found, `${phaseId} missing`);
  return found;
}

function projectFactsEvidence(overrides = {}) {
  return {
    kind: "project_facts_integration",
    phase: "phase20_project_facts_integration",
    status: "ready",
    summary: {
      blockerCount: 0,
      blocked: 0,
      missing: 0,
    },
    hardLocks: {
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noFastVip: true,
      seedanceJimengVideoParked: true,
      projectFactsAreProjectLocal: true,
    },
    ...overrides,
  };
}

function subagentEnvelopeValidatorReceipt(overrides = {}) {
  return {
    kind: "subagent_envelope_validator",
    status: "ready",
    valid: true,
    validatedEnvelopeRequired: true,
    structuredResultRequired: true,
    freeTextWorkerBlocked: true,
    hardLocks: {
      noFreeTextTask: true,
      validatedEnvelopeRequired: true,
      structuredResultRequired: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    ...overrides,
  };
}

function providerLiveGateReceipt(overrides = {}) {
  return {
    kind: "provider_live_gate",
    phase: "phase_11_provider_adapter_live_gate",
    status: "ready_for_confirmation",
    confirmationTokenPlaceholderPresent: true,
    providerPacketComplete: true,
    forbiddenProviderModesAbsent: true,
    summary: {
      readyForConfirmation: 1,
      blocked: 0,
      parked: 0,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialStorage: false,
    },
    hardLocks: {
      noProviderSubmit: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
    },
    ...overrides,
  };
}

function watcherManifestQaClosedLoopReceipt(overrides = {}) {
  return {
    kind: "watcher_manifest_qa_closed_loop",
    status: "closed",
    closedLoop: true,
    watcherReady: true,
    manifestMatcherReady: true,
    qaReportReady: true,
    ...overrides,
  };
}

function agentCliMockRunnerEvidence(overrides = {}) {
  const {
    observations: observationOverrides,
    contract: contractOverrides,
    hardLocks: hardLockOverrides,
    roadmapEvidence: roadmapEvidenceOverrides,
    ...rest
  } = overrides;
  const observations = {
    providerSubmitObserved: false,
    freeTextTaskObserved: false,
    spawnCodexObserved: false,
    resumeCodexObserved: false,
    shellExecutionObserved: false,
    credentialReadObserved: false,
    credentialWriteObserved: false,
    fileMutationObserved: false,
    ...(observationOverrides || {}),
  };
  return {
    kind: "agent_cli_mock_runner",
    phase: "phase_26_agent_cli_mock_runner",
    status: "ready_for_replacement_proof",
    runnerKind: "mock_noop",
    mockRunnerNoopReady: true,
    replacementProofReady: true,
    contract: {
      inputSource: "validated_envelope_only",
      resultKind: "structured_noop",
      canReplaceCodexCli: true,
      canSpawnCodex: false,
      canResumeCodex: false,
      canSubmitProvider: false,
      canExecuteShell: false,
      canReadCredentials: false,
      canWriteCredentials: false,
      canMutateFiles: false,
      ...(contractOverrides || {}),
    },
    observations,
    hardLocks: {
      mockOnly: true,
      dryRunOnly: true,
      noSpawnCodex: true,
      noResumeCodex: true,
      noProviderSubmit: true,
      noFreeTextTask: true,
      validatedEnvelopeRequired: true,
      structuredResultRequired: true,
      noShellExecution: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noFileMutation: true,
      ...(hardLockOverrides || {}),
    },
    roadmapEvidence: {
      phaseId: "phase_26_agent_cli_mock_runner",
      mockRunnerNoopReady: true,
      replacementProofReady: true,
      providerSubmitObserved: observations.providerSubmitObserved,
      freeTextTaskObserved: observations.freeTextTaskObserved,
      spawnCodexObserved: observations.spawnCodexObserved,
      resumeCodexObserved: observations.resumeCodexObserved,
      shellExecutionObserved: observations.shellExecutionObserved,
      credentialReadObserved: observations.credentialReadObserved,
      credentialWriteObserved: observations.credentialWriteObserved,
      fileMutationObserved: observations.fileMutationObserved,
      ...(roadmapEvidenceOverrides || {}),
    },
    ...rest,
    observations,
  };
}

function exportWorkerEvidence(overrides = {}) {
  const {
    ioContract: ioContractOverrides,
    adapterBoundary: adapterBoundaryOverrides,
    hardLocks: hardLockOverrides,
    observations: observationOverrides,
    validation: validationOverrides,
    roadmapEvidence: roadmapEvidenceOverrides,
    summary: summaryOverrides,
    ...rest
  } = overrides;
  const observations = {
    providerSubmitObserved: false,
    credentialReadObserved: false,
    credentialWriteObserved: false,
    shellExecutionObserved: false,
    mediaRenderObserved: false,
    copyObserved: false,
    moveObserved: false,
    deleteObserved: false,
    outsideProjectRootObserved: false,
    ...(observationOverrides || {}),
  };
  return {
    kind: "export_worker",
    phase: "phase_27_export_worker_mvp",
    status: "ready",
    readiness: "ready_to_plan",
    executionMode: "plan_only",
    scope: "export_project_io_contract",
    ioContract: {
      scope: "export_project_io_contract",
      pathMode: "project_root_relative",
      allowedDirectories: ["exports", "reports/exports"],
      entries: [
        {
          path: "exports/export-worker/package-plan.vibe.json",
          role: "export",
          pathOrigin: "project_root_relative",
          canWrite: true,
        },
        {
          path: "reports/exports/export-worker/export-worker-report.vibe.json",
          role: "report",
          pathOrigin: "project_root_relative",
          canWrite: true,
        },
      ],
      ...(ioContractOverrides || {}),
    },
    summary: {
      plannedEntries: 2,
      blockedReasons: [],
      canExecuteAdapterNow: false,
      providerSubmitAllowed: false,
      credentialAccessAllowed: false,
      arbitraryShellAllowed: false,
      mediaRenderAllowed: false,
      ...(summaryOverrides || {}),
    },
    adapterBoundary: {
      realAdapterExecutionAllowed: false,
      providerSubmitAllowed: false,
      shellAllowed: false,
      credentialReadAllowed: false,
      credentialWriteAllowed: false,
      mediaRenderAllowed: false,
      copySourceFilesAllowed: false,
      moveSourceFilesAllowed: false,
      deleteAllowed: false,
      outsideProjectRootAllowed: false,
      ...(adapterBoundaryOverrides || {}),
    },
    observations,
    hardLocks: {
      exportProjectIoContractOnly: true,
      defaultPlanOnly: true,
      pathsProjectRootRelative: true,
      pathsAllowlisted: true,
      noAbsolutePaths: true,
      noParentTraversal: true,
      noOutsideProjectRoot: true,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noArbitraryShell: true,
      noMediaRender: true,
      noCopySourceFiles: true,
      noMoveSourceFiles: true,
      noDelete: true,
      noNleProjectGeneration: true,
      ...(hardLockOverrides || {}),
    },
    validation: {
      ok: true,
      pathsAllowlisted: true,
      hardLocksPinned: true,
      errors: [],
      warnings: [],
      ...(validationOverrides || {}),
    },
    roadmapEvidence: {
      phaseId: "phase_27_export_worker_mvp",
      scopeReady: true,
      pathsAllowlisted: true,
      hardLocksPinned: true,
      providerSubmitObserved: observations.providerSubmitObserved,
      credentialReadObserved: observations.credentialReadObserved,
      credentialWriteObserved: observations.credentialWriteObserved,
      shellExecutionObserved: observations.shellExecutionObserved,
      mediaRenderObserved: observations.mediaRenderObserved,
      moveObserved: observations.moveObserved,
      deleteObserved: observations.deleteObserved,
      outsideProjectRootObserved: observations.outsideProjectRootObserved,
      ...(roadmapEvidenceOverrides || {}),
    },
    ...rest,
    observations,
  };
}

function voiceAudioSettingsEvidence(overrides = {}) {
  const {
    videoProviderPolicy: videoProviderPolicyOverrides,
    summary: summaryOverrides,
    adapterBoundary: adapterBoundaryOverrides,
    observations: observationOverrides,
    hardLocks: hardLockOverrides,
    validation: validationOverrides,
    roadmapEvidence: roadmapEvidenceOverrides,
    audioPlanning: audioPlanningOverrides,
    ...rest
  } = overrides;
  const videoProviderPolicy = {
    musicAllowed: false,
    noBgmForVideoProvider: true,
    bgmIncludedInVideoPrompt: false,
    ...(videoProviderPolicyOverrides || {}),
  };
  const observations = {
    providerSubmitObserved: false,
    credentialReadObserved: false,
    credentialWriteObserved: false,
    shellExecutionObserved: false,
    fileMutationObserved: false,
    sampleCopyObserved: false,
    audioSubmitObserved: false,
    ttsSubmitObserved: false,
    musicSubmitObserved: false,
    liveSubmitObserved: false,
    bgmIncludedInVideoPrompt: false,
    ...(observationOverrides || {}),
  };
  return {
    kind: "voice_audio_settings",
    phase: "phase_28_voice_audio_settings_ui",
    status: "ready",
    readiness: "ready",
    scope: "voice_audio_project_facts",
    purpose: "voice_audio_project_facts",
    noBgmForVideoProvider: videoProviderPolicy.noBgmForVideoProvider,
    bgmIncludedInVideoPrompt: videoProviderPolicy.bgmIncludedInVideoPrompt,
    videoProviderPolicy,
    audioPlanning: {
      videoProviderPolicy,
      providerSubmissionForbidden: true,
      dryRunOnly: true,
      ...(audioPlanningOverrides || {}),
    },
    summary: {
      noBgmForVideoProvider: videoProviderPolicy.noBgmForVideoProvider,
      bgmIncludedInVideoPrompt: videoProviderPolicy.bgmIncludedInVideoPrompt,
      providerSubmitAllowed: false,
      credentialAccessAllowed: false,
      arbitraryShellAllowed: false,
      fileMutationAllowed: false,
      sampleCopyAllowed: false,
      audioSubmitAllowed: false,
      ttsSubmitAllowed: false,
      musicSubmitAllowed: false,
      liveSubmitAllowed: false,
      ...(summaryOverrides || {}),
    },
    adapterBoundary: {
      providerSubmitAllowed: false,
      credentialReadAllowed: false,
      credentialWriteAllowed: false,
      shellAllowed: false,
      fileMutationAllowed: false,
      sampleCopyAllowed: false,
      audioSubmitAllowed: false,
      ttsSubmitAllowed: false,
      musicSubmitAllowed: false,
      liveSubmitAllowed: false,
      ...(adapterBoundaryOverrides || {}),
    },
    observations,
    hardLocks: {
      projectFactsOnly: true,
      voiceAudioProjectFactsOnly: true,
      dryRunOnly: true,
      noProviderSubmit: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noArbitraryShell: true,
      noShellExecution: true,
      noFileMutation: true,
      noSampleAudioCopy: true,
      noAudioSubmit: true,
      noTtsSubmit: true,
      noMusicSubmit: true,
      noBgmForVideoProvider: true,
      noBgmInVideoProviderPrompt: true,
      bgmIncludedInVideoPrompt: false,
      ...(hardLockOverrides || {}),
    },
    validation: {
      ok: true,
      hardLocksPinned: true,
      errors: [],
      warnings: [],
      ...(validationOverrides || {}),
    },
    roadmapEvidence: {
      phaseId: "phase_28_voice_audio_settings_ui",
      voiceAudioSettingsReady: true,
      noBgmForVideoProvider: videoProviderPolicy.noBgmForVideoProvider,
      bgmIncludedInVideoPrompt: videoProviderPolicy.bgmIncludedInVideoPrompt,
      hardLocksPinned: true,
      providerSubmitObserved: observations.providerSubmitObserved,
      credentialReadObserved: observations.credentialReadObserved,
      credentialWriteObserved: observations.credentialWriteObserved,
      shellExecutionObserved: observations.shellExecutionObserved,
      fileMutationObserved: observations.fileMutationObserved,
      sampleCopyObserved: observations.sampleCopyObserved,
      audioSubmitObserved: observations.audioSubmitObserved,
      ttsSubmitObserved: observations.ttsSubmitObserved,
      musicSubmitObserved: observations.musicSubmitObserved,
      liveSubmitObserved: observations.liveSubmitObserved,
      ...(roadmapEvidenceOverrides || {}),
    },
    ...rest,
    videoProviderPolicy,
    observations,
  };
}

function codexCliAdapterEvidence(overrides = {}) {
  const {
    contract: contractOverrides,
    adapterBoundary: adapterBoundaryOverrides,
    observations: observationOverrides,
    hardLocks: hardLockOverrides,
    validation: validationOverrides,
    roadmapEvidence: roadmapEvidenceOverrides,
    resultContract: resultContractOverrides,
    executionPolicy: executionPolicyOverrides,
    ...rest
  } = overrides;
  const observations = {
    providerSubmitObserved: false,
    credentialReadObserved: false,
    credentialWriteObserved: false,
    shellExecutionObserved: false,
    fileMutationObserved: false,
    freeTextTaskObserved: false,
    freeTextWorkerObserved: false,
    actualSpawnObserved: false,
    actualResumeObserved: false,
    unstructuredResultObserved: false,
    ...(observationOverrides || {}),
  };
  return {
    kind: "codex_cli_adapter_spike",
    phase: "phase_29_codex_cli_adapter_spike",
    status: "ready",
    readiness: "ready_for_adapter_spike",
    adapterContractReady: true,
    phase26ReplacementProofReady: true,
    contract: {
      inputSource: "validated_envelope_only",
      resultKind: "structured_result",
      providerSubmitAllowed: false,
      credentialAccessAllowed: false,
      arbitraryShellAllowed: false,
      fileMutationAllowed: false,
      freeTextAllowed: false,
      actualSpawnAllowed: false,
      actualResumeAllowed: false,
      spawnResumeMode: "contract_only",
      ...(contractOverrides || {}),
    },
    adapterBoundary: {
      inputContract: "validated_subagent_task_envelope_only",
      outputContract: "structured_subagent_result_shape_only",
      contractMode: "contract_only",
      providerSubmitAllowed: false,
      credentialReadAllowed: false,
      credentialWriteAllowed: false,
      shellAllowed: false,
      fileMutationAllowed: false,
      freeTextTaskAllowed: false,
      actualSpawnAllowed: false,
      actualResumeAllowed: false,
      spawnResumeAvailable: false,
      ...(adapterBoundaryOverrides || {}),
    },
    executionPolicy: {
      liveSubmitAllowed: false,
      actualSpawnAllowed: false,
      actualResumeAllowed: false,
      providerSubmitAllowed: false,
      credentialAccessAllowed: false,
      arbitraryShellAllowed: false,
      fileMutationAllowed: false,
      freeTextTaskAllowed: false,
      ...(executionPolicyOverrides || {}),
    },
    resultContract: {
      structured: true,
      expectedResultSchema: "subagent_result_v1",
      freeTextAccepted: false,
      notRealExecution: true,
      ...(resultContractOverrides || {}),
    },
    observations,
    hardLocks: {
      contractOnly: true,
      dryRunOnly: true,
      noActualSpawn: true,
      noActualResume: true,
      noProviderSubmit: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noCredentials: true,
      noArbitraryShell: true,
      noShellExecution: true,
      noFileMutation: true,
      noFreeTextWorker: true,
      noFreeTextTask: true,
      validatedEnvelopeRequired: true,
      structuredResultRequired: true,
      ...(hardLockOverrides || {}),
    },
    roadmapEvidence: {
      phaseId: "phase_29_codex_cli_adapter_spike",
      adapterContractReady: true,
      phase26ReplacementProofReady: true,
      inputSourceValidatedEnvelopeOnly: true,
      structuredResultRequired: true,
      providerSubmitBlocked: true,
      credentialBlocked: true,
      arbitraryShellBlocked: true,
      fileMutationBlocked: true,
      freeTextBlocked: true,
      actualSpawnResumeUnavailable: true,
      hardLocksPinned: true,
      providerSubmitObserved: observations.providerSubmitObserved,
      credentialReadObserved: observations.credentialReadObserved,
      credentialWriteObserved: observations.credentialWriteObserved,
      shellExecutionObserved: observations.shellExecutionObserved,
      fileMutationObserved: observations.fileMutationObserved,
      freeTextTaskObserved: observations.freeTextTaskObserved,
      freeTextWorkerObserved: observations.freeTextWorkerObserved,
      actualSpawnObserved: observations.actualSpawnObserved,
      actualResumeObserved: observations.actualResumeObserved,
      unstructuredResultObserved: observations.unstructuredResultObserved,
      ...(roadmapEvidenceOverrides || {}),
    },
    validation: {
      ok: true,
      hardLocksPinned: true,
      errors: [],
      warnings: [],
      ...(validationOverrides || {}),
    },
    ...rest,
    observations,
  };
}

function providerExecutionPermissionGateEvidence(overrides = {}) {
  const {
    phase31Evidence: phase31EvidenceOverrides,
    summary: summaryOverrides,
    hardLocks: hardLockOverrides,
    requests: requestOverrides,
    ...rest
  } = overrides;
  const requests = requestOverrides || [
    {
      status: "ready_for_user_review",
      canAskUserToConfirm: true,
      actionTimeConfirmationRequired: true,
      userConfirmedAtActionTime: false,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noWorkerSpawn: true,
      noFileMutation: true,
      blockers: [],
      warnings: [],
    },
  ];
  return {
    kind: "provider_execution_permission_gate",
    phase: "phase_31_provider_execution_permission_gate",
    status: "ready",
    readiness: "ready_for_final_permission_gate",
    phase31Evidence: {
      phaseId: "phase_31_provider_execution_permission_gate",
      typedEvidencePresent: true,
      phase30GateConsumed: true,
      actionTimeUserConfirmationRequired: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
      forbiddenProviderModesAbsent: true,
      ...(phase31EvidenceOverrides || {}),
    },
    summary: {
      readyForUserReview: requests.filter((request) => request.status === "ready_for_user_review").length,
      blocked: requests.filter((request) => request.status === "blocked").length,
      parked: requests.filter((request) => request.status === "parked").length,
      canAskUserToConfirm: requests.filter((request) => request.canAskUserToConfirm).length,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
      ...(summaryOverrides || {}),
    },
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      reviewPlanOnly: true,
      actionTimeConfirmationRequired: true,
      providerSubmissionForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noApiKeyCreation: true,
      noArbitraryProviderCommand: true,
      noWorkerSpawn: true,
      noFileMutation: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
      ...(hardLockOverrides || {}),
    },
    forbiddenActions: [
      "provider_submit",
      "credential_read",
      "credential_write",
      "api_key_create",
      "arbitrary_provider_command",
      "worker_spawn",
      "file_mutation",
      "fast_model",
      "vip_channel",
      "text_to_video_main_path",
      "bgm_in_video_prompt",
    ],
    requests,
    ...rest,
  };
}

function providerActionConfirmationReceiptEvidence(overrides = {}) {
  const {
    phase32Evidence: phase32EvidenceOverrides,
    summary: summaryOverrides,
    hardLocks: hardLockOverrides,
    receipts: receiptOverrides,
    requests: requestOverrides,
    ...rest
  } = overrides;
  const receipts = receiptOverrides || requestOverrides || [
    {
      status: "ready_for_receipt_review",
      actionTimeConfirmationRequired: true,
      receiptPlanPresent: true,
      confirmed: false,
      userConfirmedAtActionTime: false,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      credentialStorage: false,
      automaticSubmitAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
      forbiddenProviderModesAbsent: true,
      blockers: [],
      warnings: [],
    },
  ];
  return {
    kind: "provider_action_confirmation_receipt",
    phase: "phase_32_action_time_confirmation_receipt",
    status: "ready",
    readiness: "ready_for_receipt_gate",
    phase32Evidence: {
      phaseId: "phase_32_action_time_confirmation_receipt",
      typedEvidencePresent: true,
      phase31EvidenceConsumed: true,
      actionTimeConfirmationReceiptPlanPresent: true,
      confirmedReceiptCount: 0,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
      forbiddenProviderModesAbsent: true,
      hardLocksPinned: true,
      ...(phase32EvidenceOverrides || {}),
    },
    summary: {
      readyForReceiptReview: receipts.filter((receipt) => receipt.status === "ready_for_receipt_review").length,
      receiptPlanCount: receipts.filter((receipt) => receipt.receiptPlanPresent).length,
      confirmedReceiptCount: receipts.filter((receipt) => receipt.confirmed || receipt.userConfirmedAtActionTime).length,
      blocked: receipts.filter((receipt) => receipt.status === "blocked").length,
      parked: receipts.filter((receipt) => receipt.status === "parked").length,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
      ...(summaryOverrides || {}),
    },
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      reviewShellOnly: true,
      receiptPlanOnly: true,
      actionTimeConfirmationRequired: true,
      providerSubmissionForbidden: true,
      automaticSubmitForbidden: true,
      automaticSubmitAllowed: false,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noApiKeyCreation: true,
      noArbitraryProviderCommand: true,
      noWorkerSpawn: true,
      noFileMutation: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
      ...(hardLockOverrides || {}),
    },
    forbiddenActions: [
      "provider_submit",
      "credential_read",
      "credential_write",
      "api_key_create",
      "arbitrary_provider_command",
      "worker_spawn",
      "file_mutation",
      "fast_model",
      "vip_channel",
      "text_to_video_main_path",
      "bgm_in_video_prompt",
    ],
    receipts,
    ...rest,
  };
}

function typedEvidence(overrides = {}) {
  return {
    projectFactsIntegration: projectFactsEvidence(overrides.projectFactsIntegration),
    subagentEnvelopeValidator: subagentEnvelopeValidatorReceipt(overrides.subagentEnvelopeValidator),
    agentCliMockRunner: agentCliMockRunnerEvidence(overrides.agentCliMockRunner),
    codexCliAdapter: codexCliAdapterEvidence(overrides.codexCliAdapter),
    exportWorker: exportWorkerEvidence(overrides.exportWorker),
    voiceAudioSettings: voiceAudioSettingsEvidence(overrides.voiceAudioSettings),
    providerLiveGate: providerLiveGateReceipt(overrides.providerLiveGate),
    providerExecutionPermissionGate: providerExecutionPermissionGateEvidence(overrides.providerExecutionPermissionGate),
    providerActionConfirmationReceipt: providerActionConfirmationReceiptEvidence(overrides.providerActionConfirmationReceipt),
    watcherManifestQaClosedLoop: watcherManifestQaClosedLoopReceipt(overrides.watcherManifestQaClosedLoop),
  };
}

function readyInput() {
  return {
    generatedAt: "2026-05-01T00:00:00.000Z",
    evidence: typedEvidence(),
    projectFactsValidated: true,
    subagentEnvelopeValidatorReady: true,
    knowledgePackManagerReady: true,
    mockRunnerNoopReady: true,
    mockRunnerProviderSubmitObserved: false,
    voiceAudioSettingsReady: true,
    replacementProofFromMockRunner: true,
    codexCliAdapterDryRunReady: true,
    providerConfirmationTokenPlaceholderPresent: true,
    providerPacketComplete: true,
    watcherManifestQaClosedLoop: true,
    forbiddenProviderModesAbsent: true,
    providerExecutionPermissionGateReady: true,
    providerActionConfirmationReceiptReady: true,
  };
}

const {
  buildPhaseRoadmapRuntimePlan,
  phaseRoadmapRuntimeHardLocks,
  phaseRoadmapPhaseIds,
} = await loadPhaseRoadmapRuntime();

const legacyOnlyPhase24 = buildPhaseRoadmapRuntimePlan({
  generatedAt: "2026-05-01T00:00:00.000Z",
  projectFactsValidated: true,
  subagentEnvelopeValidatorReady: true,
});
const legacyOnlyPhase24Gate = phase(legacyOnlyPhase24, "phase_24_subagent_runtime_gate");
assert(legacyOnlyPhase24Gate.readiness === "blocked", "Phase 24 must block when typed evidence is missing");
assert(
  legacyOnlyPhase24Gate.blockedReasons.includes("project_facts_typed_evidence_missing"),
  "Phase 24 must explain missing project facts typed evidence",
);
assert(
  legacyOnlyPhase24Gate.blockedReasons.includes("subagent_envelope_validator_receipt_missing"),
  "Phase 24 must explain missing subagent validator receipt",
);
assert(
  legacyOnlyPhase24.evidenceSummary.typedEvidenceRequiredForPhase24 === true,
  "Phase 24 evidence summary must require typed evidence",
);
assert(
  legacyOnlyPhase24.evidenceSummary.decisions.some(
    (decision) =>
      decision.evidenceKey === "projectFactsIntegration" &&
      decision.source === "legacy_boolean_override" &&
      decision.ready === false,
  ),
  "Phase 24 project facts boolean must be recorded as a blocked legacy override without typed evidence",
);
assert(
  legacyOnlyPhase24Gate.notes.some((note) => note.includes("not suitable proof for real Phase 24")),
  "Phase 24 notes must call out boolean readiness as legacy-only proof",
);

const typedPhase24Ready = buildPhaseRoadmapRuntimePlan({
  generatedAt: "2026-05-01T00:00:00.000Z",
  evidence: {
    projectFactsIntegration: projectFactsEvidence(),
    subagentEnvelopeValidator: subagentEnvelopeValidatorReceipt(),
  },
});
assert(
  phase(typedPhase24Ready, "phase_24_subagent_runtime_gate").readiness === "ready",
  "Phase 24 must be ready with typed project facts evidence and a ready validator receipt",
);

const typedPhase24InvalidValidator = buildPhaseRoadmapRuntimePlan({
  generatedAt: "2026-05-01T00:00:00.000Z",
  evidence: {
    projectFactsIntegration: projectFactsEvidence(),
    subagentEnvelopeValidator: subagentEnvelopeValidatorReceipt({
      status: "invalid",
      valid: false,
      validation: { ok: false, errors: [] },
    }),
  },
});
const invalidValidatorPhase24 = phase(typedPhase24InvalidValidator, "phase_24_subagent_runtime_gate");
assert(invalidValidatorPhase24.readiness === "blocked", "Phase 24 must block if validator receipt is not ready");
assert(
  invalidValidatorPhase24.blockedReasons.includes("validated_subagent_task_envelope_gate_missing"),
  "Phase 24 validator-ready blocker missing",
);

const blockedBeforeFacts = buildPhaseRoadmapRuntimePlan({
  generatedAt: "2026-05-01T00:00:00.000Z",
  projectFactsValidated: false,
  subagentEnvelopeValidatorReady: true,
});
const phase24Blocked = phase(blockedBeforeFacts, "phase_24_subagent_runtime_gate");
assert(phase24Blocked.readiness === "blocked", "Phase 24 must block before project facts are validated");
assert(phase24Blocked.blockedReasons.includes("project_facts_not_validated"), "Phase 24 project facts blocker missing");
assert(
  phase(blockedBeforeFacts, "phase_25_knowledge_pack_manager").blockedReasons.includes(
    "preceding_phase_not_ready:phase_24_subagent_runtime_gate",
  ),
  "Phase 25 must inherit the Phase 24 preceding-phase gate",
);

const typedMockRunnerReady = buildPhaseRoadmapRuntimePlan(readyInput());
assert(
  phase(typedMockRunnerReady, "phase_26_agent_cli_mock_runner").readiness === "ready",
  "Phase 26 must be ready when typed mock-runner replacement proof is ready",
);
const actualShapeMockRunnerReady = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    agentCliMockRunner: {
      phase: "phase_26_agent_cli_mock_runner",
      readiness: "ready_for_phase_29_adapter_spike",
      replacementProofReady: true,
      adapterBoundary: {
        providerSubmitAllowed: false,
        shellAllowed: false,
        fileMutationAllowed: false,
      },
      hardLocks: {
        noCodexSpawn: true,
        noCodexResume: true,
        noProviderSubmit: true,
        liveSubmitAllowed: false,
        noCredentialRead: true,
        noCredentialWrite: true,
        noShellExecution: true,
        noFileMutation: true,
        validatedEnvelopeRequired: true,
        structuredResultRequired: true,
        noFreeTextWorker: true,
        mockOnly: true,
      },
      receipt: {
        replacementProofReady: true,
        blockedReasons: [],
      },
      validation: {
        ok: true,
        errors: [],
        warnings: [],
      },
    },
  }),
});
assert(
  phase(actualShapeMockRunnerReady, "phase_26_agent_cli_mock_runner").readiness === "ready",
  "Phase 26 must accept the actual AgentCliMockRunnerState shape as typed evidence",
);

const missingExportWorkerEvidence = typedEvidence();
delete missingExportWorkerEvidence.exportWorker;
const legacyOnlyPhase27 = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: missingExportWorkerEvidence,
  exportWorkerIoScopeReady: true,
});
const legacyOnlyPhase27Gate = phase(legacyOnlyPhase27, "phase_27_export_worker_mvp");
assert(legacyOnlyPhase27Gate.readiness === "blocked", "Phase 27 must block when typed export worker evidence is missing");
assert(
  legacyOnlyPhase27Gate.blockedReasons.includes("export_worker_typed_evidence_missing"),
  "Phase 27 must explain missing typed export worker evidence",
);

const exportWorkerReadyPlan = buildPhaseRoadmapRuntimePlan(readyInput());
assert(
  phase(exportWorkerReadyPlan, "phase_27_export_worker_mvp").readiness === "ready",
  "Phase 27 must be ready with typed export worker evidence",
);
assert(
  exportWorkerReadyPlan.evidenceSummary.decisions.some(
    (decision) => decision.evidenceKey === "exportWorker" && decision.source === "typed_evidence" && decision.ready === true,
  ),
  "Phase 27 export worker decision must be typed and ready",
);

const blockedExportWorkerPath = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    exportWorker: {
      ioContract: {
        entries: [
          {
            path: "../outside/export.json",
            role: "export",
            pathOrigin: "project_root_relative",
            canWrite: true,
          },
        ],
      },
      validation: {
        pathsAllowlisted: false,
        errors: ["outside_project_root_path"],
      },
      roadmapEvidence: {
        pathsAllowlisted: false,
      },
    },
  }),
});
assert(
  phase(blockedExportWorkerPath, "phase_27_export_worker_mvp").blockedReasons.includes("export_worker_paths_not_allowlisted"),
  "Phase 27 must block paths outside export/report allowlist",
);

for (const [observationKey, expectedBlocker] of Object.entries({
  providerSubmitObserved: "export_worker_attempted_provider_submit",
  credentialReadObserved: "export_worker_credential_read_observed",
  credentialWriteObserved: "export_worker_credential_write_observed",
  shellExecutionObserved: "export_worker_shell_execution_observed",
  mediaRenderObserved: "export_worker_media_render_observed",
  moveObserved: "export_worker_move_observed",
  deleteObserved: "export_worker_delete_observed",
  outsideProjectRootObserved: "export_worker_outside_project_root_observed",
})) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      exportWorker: {
        observations: { [observationKey]: true },
        roadmapEvidence: { [observationKey]: true },
      },
    }),
  });
  const blockedPhase27 = phase(blockedPlan, "phase_27_export_worker_mvp");
  assert(blockedPhase27.readiness === "blocked", `Phase 27 must block if ${observationKey} is observed`);
  assert(blockedPhase27.blockedReasons.includes(expectedBlocker), `Phase 27 blocker ${expectedBlocker} missing`);
}

const missingVoiceAudioSettingsEvidence = typedEvidence();
delete missingVoiceAudioSettingsEvidence.voiceAudioSettings;
const legacyOnlyPhase28 = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: missingVoiceAudioSettingsEvidence,
  voiceAudioSettingsReady: true,
});
const legacyOnlyPhase28Gate = phase(legacyOnlyPhase28, "phase_28_voice_audio_settings_ui");
assert(legacyOnlyPhase28Gate.readiness === "blocked", "Phase 28 must block when typed voice/audio settings evidence is missing");
assert(
  legacyOnlyPhase28Gate.blockedReasons.includes("voice_audio_settings_typed_evidence_missing"),
  "Phase 28 must explain missing typed voice/audio settings evidence",
);
assert(
  legacyOnlyPhase28.evidenceSummary.decisions.some(
    (decision) =>
      decision.evidenceKey === "voiceAudioSettings" &&
      decision.source === "legacy_boolean_override" &&
      decision.ready === false,
  ),
  "Phase 28 voiceAudioSettingsReady boolean must be ignored without typed evidence",
);

const voiceAudioSettingsReadyPlan = buildPhaseRoadmapRuntimePlan(readyInput());
assert(
  phase(voiceAudioSettingsReadyPlan, "phase_28_voice_audio_settings_ui").readiness === "ready",
  "Phase 28 must be ready with typed voice/audio settings evidence",
);
assert(
  voiceAudioSettingsReadyPlan.evidenceSummary.decisions.some(
    (decision) => decision.evidenceKey === "voiceAudioSettings" && decision.source === "typed_evidence" && decision.ready === true,
  ),
  "Phase 28 voice/audio settings decision must be typed and ready",
);

const blockedNoBgmPolicy = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    voiceAudioSettings: {
      videoProviderPolicy: { noBgmForVideoProvider: false },
      roadmapEvidence: { noBgmForVideoProvider: false },
    },
  }),
});
assert(
  phase(blockedNoBgmPolicy, "phase_28_voice_audio_settings_ui").blockedReasons.includes(
    "voice_audio_settings_no_bgm_video_policy_missing",
  ),
  "Phase 28 must require noBgmForVideoProvider=true",
);

const blockedBgmPrompt = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    voiceAudioSettings: {
      videoProviderPolicy: { bgmIncludedInVideoPrompt: true },
      observations: { bgmIncludedInVideoPrompt: true },
      roadmapEvidence: { bgmIncludedInVideoPrompt: true },
    },
  }),
});
assert(
  phase(blockedBgmPrompt, "phase_28_voice_audio_settings_ui").blockedReasons.includes(
    "voice_audio_settings_bgm_in_video_prompt_present",
  ),
  "Phase 28 must block BGM in video provider prompts",
);

for (const [observationKey, expectedBlocker] of Object.entries({
  providerSubmitObserved: "voice_audio_settings_attempted_provider_submit",
  credentialReadObserved: "voice_audio_settings_credential_read_observed",
  credentialWriteObserved: "voice_audio_settings_credential_write_observed",
  shellExecutionObserved: "voice_audio_settings_shell_execution_observed",
  fileMutationObserved: "voice_audio_settings_file_mutation_observed",
  sampleCopyObserved: "voice_audio_settings_sample_copy_observed",
  audioSubmitObserved: "voice_audio_settings_audio_submit_observed",
  musicSubmitObserved: "voice_audio_settings_music_submit_observed",
  liveSubmitObserved: "voice_audio_settings_live_submit_observed",
})) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      voiceAudioSettings: {
        observations: { [observationKey]: true },
        roadmapEvidence: { [observationKey]: true },
      },
    }),
  });
  const blockedPhase28 = phase(blockedPlan, "phase_28_voice_audio_settings_ui");
  assert(blockedPhase28.readiness === "blocked", `Phase 28 must block if ${observationKey} is observed`);
  assert(blockedPhase28.blockedReasons.includes(expectedBlocker), `Phase 28 blocker ${expectedBlocker} missing`);
}

for (const [allowanceKey, expectedBlocker] of Object.entries({
  providerSubmitAllowed: "voice_audio_settings_attempted_provider_submit",
  credentialReadAllowed: "voice_audio_settings_credential_read_observed",
  credentialWriteAllowed: "voice_audio_settings_credential_write_observed",
  shellAllowed: "voice_audio_settings_shell_execution_observed",
  fileMutationAllowed: "voice_audio_settings_file_mutation_observed",
  sampleCopyAllowed: "voice_audio_settings_sample_copy_observed",
  audioSubmitAllowed: "voice_audio_settings_audio_submit_observed",
  musicSubmitAllowed: "voice_audio_settings_music_submit_observed",
  liveSubmitAllowed: "voice_audio_settings_live_submit_observed",
})) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      voiceAudioSettings: {
        adapterBoundary: { [allowanceKey]: true },
      },
    }),
  });
  const blockedPhase28 = phase(blockedPlan, "phase_28_voice_audio_settings_ui");
  assert(blockedPhase28.readiness === "blocked", `Phase 28 must block if ${allowanceKey} is allowed`);
  assert(blockedPhase28.blockedReasons.includes(expectedBlocker), `Phase 28 blocker ${expectedBlocker} missing`);
}

const blockedVoiceAudioHardLock = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    voiceAudioSettings: {
      hardLocks: { noSampleAudioCopy: false },
      validation: { hardLocksPinned: false },
      roadmapEvidence: { hardLocksPinned: false },
    },
  }),
});
assert(
  phase(blockedVoiceAudioHardLock, "phase_28_voice_audio_settings_ui").blockedReasons.includes(
    "voice_audio_settings_hard_locks_not_pinned",
  ),
  "Phase 28 must block hard-lock drift",
);

for (const [observationKey, expectedBlocker] of Object.entries({
  providerSubmitObserved: "mock_runner_attempted_provider_submit",
  freeTextTaskObserved: "mock_runner_free_text_task_observed",
  spawnCodexObserved: "mock_runner_spawn_codex_observed",
  resumeCodexObserved: "mock_runner_resume_codex_observed",
})) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      agentCliMockRunner: {
        observations: { [observationKey]: true },
        roadmapEvidence: { [observationKey]: true },
      },
    }),
  });
  const blockedPhase26 = phase(blockedPlan, "phase_26_agent_cli_mock_runner");
  assert(blockedPhase26.readiness === "blocked", `Phase 26 must block if ${observationKey} is observed`);
  assert(blockedPhase26.blockedReasons.includes(expectedBlocker), `Phase 26 blocker ${expectedBlocker} missing`);
}

const phase29WithoutReplacementProof = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    agentCliMockRunner: {
      replacementProofReady: false,
      contract: { canReplaceCodexCli: false },
      roadmapEvidence: { replacementProofReady: false },
    },
  }),
  replacementProofFromMockRunner: false,
});
assert(
  phase(phase29WithoutReplacementProof, "phase_29_codex_cli_adapter_spike").blockedReasons.includes(
    "phase_26_replacement_proof_missing",
  ),
  "Phase 29 must require typed Phase 26 replacement proof",
);

const phase29LegacyBooleanOnly = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: {
    ...typedEvidence(),
    codexCliAdapter: undefined,
    codexCliAdapterSpike: undefined,
  },
  codexCliAdapterDryRunReady: true,
});
const phase29LegacyOnlyGate = phase(phase29LegacyBooleanOnly, "phase_29_codex_cli_adapter_spike");
assert(phase29LegacyOnlyGate.readiness === "blocked", "Phase 29 must block legacy boolean-only adapter proof");
assert(
  phase29LegacyOnlyGate.blockedReasons.includes("codex_cli_adapter_typed_evidence_missing"),
  "Phase 29 must require typed Codex adapter evidence",
);
assert(
  phase29LegacyOnlyGate.notes.some((note) => note.includes("legacy_codexCliAdapterDryRunReady_boolean_ignored")),
  "Phase 29 must report ignored legacy Codex adapter boolean",
);

for (const [observationKey, expectedBlocker] of Object.entries({
  providerSubmitObserved: "phase_29_provider_submit_not_blocked",
  credentialReadObserved: "phase_29_credential_access_not_blocked",
  shellExecutionObserved: "phase_29_arbitrary_shell_not_blocked",
  fileMutationObserved: "phase_29_file_mutation_not_blocked",
  freeTextTaskObserved: "phase_29_free_text_task_not_blocked",
  actualSpawnObserved: "phase_29_actual_spawn_resume_not_allowed",
  actualResumeObserved: "phase_29_actual_spawn_resume_not_allowed",
  unstructuredResultObserved: "phase_29_structured_result_missing",
})) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      codexCliAdapter: {
        observations: { [observationKey]: true },
        roadmapEvidence: { [observationKey]: true },
      },
    }),
  });
  const blockedPhase29 = phase(blockedPlan, "phase_29_codex_cli_adapter_spike");
  assert(blockedPhase29.readiness === "blocked", `Phase 29 must block if ${observationKey} is observed`);
  assert(blockedPhase29.blockedReasons.includes(expectedBlocker), `Phase 29 blocker ${expectedBlocker} missing`);
}

const phase29UnvalidatedInput = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    codexCliAdapter: {
      contract: { inputSource: "free_text" },
      adapterBoundary: { inputContract: "free_text" },
      roadmapEvidence: { inputSourceValidatedEnvelopeOnly: false },
    },
  }),
});
assert(
  phase(phase29UnvalidatedInput, "phase_29_codex_cli_adapter_spike").blockedReasons.includes(
    "codex_cli_adapter_validated_envelope_only_missing",
  ),
  "Phase 29 must block non-envelope adapter input",
);

const phase29ActualSpawnAllowed = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    codexCliAdapter: {
      executionPolicy: { actualSpawnAllowed: true },
      hardLocks: { actualSpawnAllowed: true },
      roadmapEvidence: { actualSpawnResumeUnavailable: false },
    },
  }),
});
assert(
  phase(phase29ActualSpawnAllowed, "phase_29_codex_cli_adapter_spike").blockedReasons.includes(
    "phase_29_actual_spawn_resume_not_allowed",
  ),
  "Phase 29 must block actual Codex spawn/resume enablement",
);

assert(
  typedMockRunnerReady.adapterBoundary.phase26.runnerKind === "mock_noop",
  "Phase 26 must be the mock/no-op runner boundary",
);
assert(typedMockRunnerReady.adapterBoundary.phase26.canSpawnCodex === false, "Phase 26 must not spawn Codex");
assert(typedMockRunnerReady.adapterBoundary.phase26.canResumeCodex === false, "Phase 26 must not resume Codex");
assert(typedMockRunnerReady.adapterBoundary.phase26.canSubmitProvider === false, "Phase 26 must not submit provider");

const typedPhase30Ready = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      phase30Evidence: {
        phaseId: "phase_30_provider_enablement_gate",
        confirmationTokenPlaceholderPresent: true,
        providerPacketComplete: true,
        watcherManifestQaClosedLoop: true,
        forbiddenProviderModesAbsent: true,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        credentialStorage: false,
        hardLocksPinned: true,
      },
    },
  }),
});
assert(
  phase(typedPhase30Ready, "phase_30_provider_enablement_gate").readiness === "ready",
  "Phase 30 must be ready with complete typed providerLiveGate Phase 30 evidence",
);
assert(
  typedPhase30Ready.providerEnablementGate.canSubmitProvider === false,
  "Phase 30 ready still cannot submit provider",
);

const providerStateShapePhase30Ready = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      kind: undefined,
      confirmationTokenPlaceholderPresent: undefined,
      providerPacketComplete: undefined,
      forbiddenProviderModesAbsent: undefined,
      summary: {
        totalSlots: 1,
        imageSlotsPendingConfirmation: 1,
        parkedVideoSlots: 0,
        totalItems: 1,
        readyForConfirmation: 1,
        blocked: 0,
        parked: 0,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        credentialStorage: false,
      },
      forbiddenActions: [
        "provider_submit",
        "credential_read",
        "credential_write",
        "api_key_create",
        "fast_model",
        "vip_channel",
        "text_to_video_main_path",
        "bgm_in_video_prompt",
        "arbitrary_provider_command",
      ],
      items: [
        {
          status: "ready_for_confirmation",
          canRequestUserConfirmation: true,
          canSubmitProvider: false,
          confirmationTokenId: "confirmation_token_placeholder:image2",
          providerSubmissionForbidden: true,
          liveSubmitAllowed: false,
          credentialStorage: false,
          noCredentialRead: true,
          noCredentialWrite: true,
          checks: [
            "adapter_contract_valid",
            "provider_capability_present",
            "envelope_valid",
            "asset_readiness_ready",
            "pair_qa_pass",
            "image2_adapter_request_valid",
            "user_confirmation_token_placeholder",
          ].map((checkId) => ({ checkId, passed: true })),
          blockers: [],
          warnings: [],
        },
      ],
      phase30Evidence: {
        watcherManifestQaClosedLoop: true,
      },
    },
  }),
});
assert(
  phase(providerStateShapePhase30Ready, "phase_30_provider_enablement_gate").readiness === "ready",
  "Phase 30 must accept phase_11_provider_adapter_live_gate state shape by inferring summary/hardLocks/forbiddenActions/items",
);

const typedEvidenceWithoutProviderLiveGate = typedEvidence();
delete typedEvidenceWithoutProviderLiveGate.providerLiveGate;
const legacyOnlyProviderGate = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidenceWithoutProviderLiveGate,
  providerConfirmationTokenPlaceholderPresent: true,
  providerPacketComplete: true,
  watcherManifestQaClosedLoop: true,
  forbiddenProviderModesAbsent: true,
});
const legacyOnlyPhase30 = phase(legacyOnlyProviderGate, "phase_30_provider_enablement_gate");
assert(legacyOnlyPhase30.readiness === "blocked", "Phase 30 must block when only legacy provider booleans are present");
assert(
  legacyOnlyPhase30.blockedReasons.includes("provider_live_gate_typed_evidence_missing"),
  "Phase 30 must explain that typed providerLiveGate evidence is required",
);

const blockedProviderGate = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      confirmationTokenPlaceholderPresent: false,
      forbiddenProviderModesAbsent: false,
    },
    watcherManifestQaClosedLoop: {
      status: "blocked",
      closedLoop: false,
      watcherReady: true,
      manifestMatcherReady: false,
      qaReportReady: true,
    },
  }),
  providerConfirmationTokenPlaceholderPresent: false,
  watcherManifestQaClosedLoop: false,
  forbiddenProviderModesAbsent: false,
});
const phase30Blocked = phase(blockedProviderGate, "phase_30_provider_enablement_gate");
assert(phase30Blocked.readiness === "blocked", "Phase 30 must block without confirmation/QA/watcher closure");
for (const blocker of [
  "user_confirmation_token_placeholder_missing",
  "watcher_manifest_qa_closed_loop_missing",
  "forbidden_provider_mode_or_prompt_present",
]) {
  assert(phase30Blocked.blockedReasons.includes(blocker), `Phase 30 blocker ${blocker} missing`);
}

const missingTokenProviderGate = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      confirmationTokenPlaceholderPresent: false,
      phase30Evidence: { watcherManifestQaClosedLoop: true },
    },
  }),
});
assert(
  phase(missingTokenProviderGate, "phase_30_provider_enablement_gate").blockedReasons.includes(
    "user_confirmation_token_placeholder_missing",
  ),
  "Phase 30 must block when the confirmation token placeholder is missing",
);

const incompletePacketProviderGate = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      providerPacketComplete: false,
      phase30Evidence: { watcherManifestQaClosedLoop: true },
    },
  }),
});
assert(
  phase(incompletePacketProviderGate, "phase_30_provider_enablement_gate").blockedReasons.includes(
    "provider_enablement_packet_incomplete",
  ),
  "Phase 30 must block when the provider enablement packet is incomplete",
);

const missingClosedLoopProviderGate = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      phase30Evidence: { watcherManifestQaClosedLoop: false },
    },
  }),
});
assert(
  phase(missingClosedLoopProviderGate, "phase_30_provider_enablement_gate").blockedReasons.includes(
    "watcher_manifest_qa_closed_loop_missing",
  ),
  "Phase 30 must block when typed providerLiveGate reports missing watcher/manifest/QA closure",
);

const omittedForbiddenProviderModes = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      forbiddenProviderModesAbsent: undefined,
    },
  }),
  forbiddenProviderModesAbsent: undefined,
});
assert(
  phase(omittedForbiddenProviderModes, "phase_30_provider_enablement_gate").blockedReasons.includes(
    "forbidden_provider_mode_or_prompt_present",
  ),
  "Phase 30 must fail closed when forbiddenProviderModesAbsent is omitted",
);

const falseForbiddenProviderModes = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      forbiddenProviderModesAbsent: false,
    },
  }),
  forbiddenProviderModesAbsent: false,
});
assert(
  phase(falseForbiddenProviderModes, "phase_30_provider_enablement_gate").blockedReasons.includes(
    "forbidden_provider_mode_or_prompt_present",
  ),
  "Phase 30 must fail closed when forbiddenProviderModesAbsent is false",
);

const trueForbiddenProviderModes = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerLiveGate: {
      forbiddenProviderModesAbsent: true,
    },
  }),
  forbiddenProviderModesAbsent: true,
});
assert(
  phase(trueForbiddenProviderModes, "phase_30_provider_enablement_gate").readiness === "ready",
  "Phase 30 may pass only when forbiddenProviderModesAbsent is explicitly true and other gates are ready",
);

for (const [label, providerLiveGate, expectedBlocker] of [
  [
    "provider submit",
    { summary: { providerSubmitAllowed: 1 } },
    "provider_live_gate_allows_provider_submit",
  ],
  [
    "live submit",
    { summary: { liveSubmitAllowed: true } },
    "provider_live_gate_allows_live_submit",
  ],
  [
    "credential storage",
    { summary: { credentialStorage: true } },
    "provider_live_gate_allows_credential_storage",
  ],
  [
    "hard lock drift",
    { hardLocks: { noProviderSubmit: false } },
    "provider_live_gate_hard_lock_drift",
  ],
  [
    "Fast prompt",
    { phase30Evidence: { fastModelPromptPresent: true } },
    "provider_live_gate_fast_model_prompt_present",
  ],
  [
    "VIP prompt",
    { phase30Evidence: { vipPromptPresent: true } },
    "provider_live_gate_vip_channel_prompt_present",
  ],
  [
    "text-to-video prompt",
    { phase30Evidence: { textToVideoPromptPresent: true } },
    "provider_live_gate_text_to_video_prompt_present",
  ],
  [
    "BGM prompt",
    { phase30Evidence: { bgmPromptPresent: true } },
    "provider_live_gate_bgm_prompt_present",
  ],
]) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      providerLiveGate,
    }),
  });
  assert(
    phase(blockedPlan, "phase_30_provider_enablement_gate").blockedReasons.includes(expectedBlocker),
    `Phase 30 must block when providerLiveGate exposes ${label}`,
  );
}

assert(
  blockedProviderGate.providerEnablementGate.userConfirmationTokenPlaceholderRequired === true,
  "Phase 30 must require a confirmation token placeholder",
);
assert(
  blockedProviderGate.providerEnablementGate.watcherManifestQaClosedLoopRequired === true,
  "Phase 30 must require watcher/manifest/QA closed loop",
);
assert(
  blockedProviderGate.providerEnablementGate.noFastVipTextToVideoOrBgmPromptRequired === true,
  "Phase 30 must ban Fast/VIP/text-to-video/BGM prompt paths",
);
assert(blockedProviderGate.providerEnablementGate.canSubmitProvider === false, "Phase 30 plan must not submit provider");

const missingProviderExecutionGateEvidence = typedEvidence();
delete missingProviderExecutionGateEvidence.providerExecutionPermissionGate;
const legacyOnlyPhase31 = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: missingProviderExecutionGateEvidence,
  providerExecutionPermissionGateReady: true,
});
const legacyOnlyPhase31Gate = phase(legacyOnlyPhase31, "phase_31_provider_execution_permission_gate");
assert(legacyOnlyPhase31Gate.readiness === "blocked", "Phase 31 must block when typed execution permission evidence is missing");
assert(
  legacyOnlyPhase31Gate.blockedReasons.includes("provider_execution_permission_typed_evidence_missing"),
  "Phase 31 must require typed provider execution permission evidence",
);

const typedPhase31Ready = buildPhaseRoadmapRuntimePlan(readyInput());
assert(
  phase(typedPhase31Ready, "phase_31_provider_execution_permission_gate").readiness === "ready",
  "Phase 31 must be ready with typed provider execution permission evidence and all locks pinned",
);
assert(
  phase(typedPhase31Ready, "phase_31_provider_execution_permission_gate").status === "ready_for_final_permission_gate",
  "Phase 31 must report ready_for_final_permission_gate",
);

for (const [override, expectedBlocker] of [
  [{ phase31Evidence: { phase30GateConsumed: false } }, "provider_execution_permission_phase30_gate_missing"],
  [{ phase31Evidence: { actionTimeUserConfirmationRequired: false } }, "provider_execution_permission_action_time_confirmation_missing"],
  [{ phase31Evidence: { automaticSubmitForbidden: false } }, "provider_execution_permission_auto_submit_not_forbidden"],
  [{ phase31Evidence: { canSubmitProvider: true } }, "provider_execution_permission_can_submit_provider_true"],
  [{ phase31Evidence: { providerSubmitAllowed: 1 }, summary: { providerSubmitAllowed: 1 } }, "provider_execution_permission_provider_submit_allowed"],
  [{ phase31Evidence: { liveSubmitAllowed: true }, summary: { liveSubmitAllowed: true } }, "provider_execution_permission_live_submit_allowed"],
  [{ phase31Evidence: { credentialAccessAllowed: true }, summary: { credentialAccessAllowed: true } }, "provider_execution_permission_credential_access_allowed"],
  [{ phase31Evidence: { noWorkerSpawn: false }, hardLocks: { noWorkerSpawn: false } }, "provider_execution_permission_worker_spawn_not_blocked"],
  [{ phase31Evidence: { noFileMutation: false }, hardLocks: { noFileMutation: false } }, "provider_execution_permission_file_mutation_not_blocked"],
  [{ phase31Evidence: { forbiddenProviderModesAbsent: false } }, "provider_execution_permission_forbidden_mode_not_absent"],
]) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      providerExecutionPermissionGate: override,
    }),
  });
  const blockedPhase31 = phase(blockedPlan, "phase_31_provider_execution_permission_gate");
  assert(blockedPhase31.readiness === "blocked", `Phase 31 must block ${expectedBlocker}`);
  assert(blockedPhase31.blockedReasons.includes(expectedBlocker), `Phase 31 blocker ${expectedBlocker} missing`);
}

const phase31RequestDrift = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerExecutionPermissionGate: {
      requests: [
        {
          status: "ready_for_user_review",
          canAskUserToConfirm: true,
          actionTimeConfirmationRequired: true,
          userConfirmedAtActionTime: true,
          canSubmitProvider: true,
          providerSubmitAllowed: 1,
          liveSubmitAllowed: true,
          credentialAccessAllowed: true,
          credentialStorage: true,
          noWorkerSpawn: false,
          noFileMutation: false,
          blockers: [],
          warnings: [],
        },
      ],
    },
  }),
});
assert(
  phase(phase31RequestDrift, "phase_31_provider_execution_permission_gate").blockedReasons.includes(
    "provider_execution_permission_request_lock_drift",
  ),
  "Phase 31 must block request-level lock drift",
);

assert(
  typedPhase31Ready.providerExecutionPermissionGate.actionTimeUserConfirmationRequired === true,
  "Phase 31 plan must require action-time user confirmation",
);
assert(
  typedPhase31Ready.providerExecutionPermissionGate.automaticSubmitForbidden === true,
  "Phase 31 plan must forbid automatic submit",
);
assert(
  typedPhase31Ready.providerExecutionPermissionGate.canSubmitProvider === false,
  "Phase 31 plan must not submit provider",
);

const missingProviderActionReceiptEvidence = typedEvidence();
delete missingProviderActionReceiptEvidence.providerActionConfirmationReceipt;
const legacyOnlyPhase32 = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: missingProviderActionReceiptEvidence,
  providerActionConfirmationReceiptReady: true,
});
const legacyOnlyPhase32Gate = phase(legacyOnlyPhase32, "phase_32_action_time_confirmation_receipt");
assert(legacyOnlyPhase32Gate.readiness === "blocked", "Phase 32 must block when typed action confirmation receipt evidence is missing");
assert(
  legacyOnlyPhase32Gate.blockedReasons.includes("provider_action_confirmation_receipt_typed_evidence_missing"),
  "Phase 32 must require typed provider action confirmation receipt evidence",
);
assert(
  legacyOnlyPhase32.evidenceSummary.decisions.some(
    (decision) =>
      decision.evidenceKey === "providerActionConfirmationReceipt" &&
      decision.source === "legacy_boolean_override" &&
      decision.ready === false,
  ),
  "Phase 32 legacy boolean must be recorded as blocked without typed evidence",
);

const typedPhase32Ready = buildPhaseRoadmapRuntimePlan(readyInput());
assert(
  phase(typedPhase32Ready, "phase_32_action_time_confirmation_receipt").readiness === "ready",
  "Phase 32 must be ready with typed action-time confirmation receipt evidence and all locks pinned",
);
assert(
  phase(typedPhase32Ready, "phase_32_action_time_confirmation_receipt").status === "ready_for_receipt_gate",
  "Phase 32 must report ready_for_receipt_gate",
);

const missingPhase31ForPhase32Evidence = typedEvidence();
delete missingPhase31ForPhase32Evidence.providerExecutionPermissionGate;
const phase32MissingPhase31 = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: missingPhase31ForPhase32Evidence,
});
assert(
  phase(phase32MissingPhase31, "phase_32_action_time_confirmation_receipt").blockedReasons.includes(
    "provider_action_confirmation_receipt_phase31_evidence_missing",
  ),
  "Phase 32 must block when Phase 31 typed evidence is missing",
);

for (const [override, expectedBlocker] of [
  [{ phase32Evidence: { phase31EvidenceConsumed: false } }, "provider_action_confirmation_receipt_phase31_evidence_missing"],
  [{ phase32Evidence: { actionTimeConfirmationReceiptPlanPresent: false }, summary: { receiptPlanCount: 0, readyForReceiptReview: 0 } }, "provider_action_confirmation_receipt_plan_missing"],
  [{ phase32Evidence: { confirmedReceiptCount: 1 }, summary: { confirmedReceiptCount: 1 } }, "provider_action_confirmation_receipt_confirmed_receipts_present"],
  [{ phase32Evidence: { providerSubmitAllowed: 1 }, summary: { providerSubmitAllowed: 1 } }, "provider_action_confirmation_receipt_provider_submit_allowed"],
  [{ phase32Evidence: { canSubmitProvider: true }, hardLocks: { canSubmitProvider: true } }, "provider_action_confirmation_receipt_can_submit_provider_true"],
  [{ phase32Evidence: { liveSubmitAllowed: true }, summary: { liveSubmitAllowed: true } }, "provider_action_confirmation_receipt_live_submit_allowed"],
  [{ phase32Evidence: { credentialAccessAllowed: true }, summary: { credentialAccessAllowed: true } }, "provider_action_confirmation_receipt_credential_access_allowed"],
  [{ phase32Evidence: { automaticSubmitAllowed: true }, summary: { automaticSubmitAllowed: true } }, "provider_action_confirmation_receipt_auto_submit_allowed"],
  [{ phase32Evidence: { noWorkerSpawn: false }, hardLocks: { noWorkerSpawn: false } }, "provider_action_confirmation_receipt_worker_spawn_not_blocked"],
  [{ phase32Evidence: { noFileMutation: false }, hardLocks: { noFileMutation: false } }, "provider_action_confirmation_receipt_file_mutation_not_blocked"],
  [{ phase32Evidence: { forbiddenProviderModesAbsent: false } }, "provider_action_confirmation_receipt_forbidden_mode_not_absent"],
  [{ phase32Evidence: { hardLocksPinned: false }, hardLocks: { reviewShellOnly: false } }, "provider_action_confirmation_receipt_hard_locks_not_pinned"],
]) {
  const blockedPlan = buildPhaseRoadmapRuntimePlan({
    ...readyInput(),
    evidence: typedEvidence({
      providerActionConfirmationReceipt: override,
    }),
  });
  const blockedPhase32 = phase(blockedPlan, "phase_32_action_time_confirmation_receipt");
  assert(blockedPhase32.readiness === "blocked", `Phase 32 must block ${expectedBlocker}`);
  assert(blockedPhase32.blockedReasons.includes(expectedBlocker), `Phase 32 blocker ${expectedBlocker} missing`);
}

const phase32ReceiptDrift = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  evidence: typedEvidence({
    providerActionConfirmationReceipt: {
      receipts: [
        {
          status: "ready_for_receipt_review",
          actionTimeConfirmationRequired: true,
          receiptPlanPresent: true,
          confirmed: true,
          userConfirmedAtActionTime: true,
          canSubmitProvider: true,
          providerSubmitAllowed: 1,
          liveSubmitAllowed: true,
          credentialAccessAllowed: true,
          credentialStorage: true,
          automaticSubmitAllowed: true,
          noWorkerSpawn: false,
          noFileMutation: false,
          forbiddenProviderModesAbsent: false,
          blockers: [],
          warnings: [],
        },
      ],
    },
  }),
});
assert(
  phase(phase32ReceiptDrift, "phase_32_action_time_confirmation_receipt").blockedReasons.includes(
    "provider_action_confirmation_receipt_request_lock_drift",
  ),
  "Phase 32 must block receipt/request-level lock drift",
);

assert(
  typedPhase32Ready.providerActionConfirmationReceipt.actionTimeConfirmationReceiptPlanRequired === true,
  "Phase 32 plan must require an action-time confirmation receipt plan",
);
assert(
  typedPhase32Ready.providerActionConfirmationReceipt.confirmedReceiptCount === 0,
  "Phase 32 plan must keep confirmed receipt count at zero",
);
assert(
  typedPhase32Ready.providerActionConfirmationReceipt.canSubmitProvider === false,
  "Phase 32 plan must not submit provider",
);

const readyPlan = buildPhaseRoadmapRuntimePlan(readyInput());
assert(readyPlan.schemaVersion === "0.1.0", "schema version drifted");
assert(readyPlan.phaseRange === "phase_24_to_32", "phase range drifted");
assert(readyPlan.summary.totalPhases === 9, "summary total phase count drifted");
assert(readyPlan.summary.ready === 9, "all phases should be ready for the complete fixture");
assert(readyPlan.summary.blocked === 0, "complete fixture should not block");
assert(readyPlan.summary.providerSubmitAllowed === 0, "provider submit must stay at zero");
assert(readyPlan.summary.credentialAccessAllowed === false, "credential access must be false");
assert(readyPlan.summary.arbitraryShellAllowed === false, "arbitrary shell must be false");
assert(readyPlan.summary.freeTextWorkerAllowed === false, "free text workers must be false");
assert(
  readyPlan.evidenceSummary.decisions.every((decision) => decision.ready === true),
  "complete typed fixture should make every evidence decision ready",
);
assert(phaseRoadmapPhaseIds().length === 9, "phase id list should cover Phase 24-32");

const phase26Ready = phase(readyPlan, "phase_26_agent_cli_mock_runner");
const phase29Ready = phase(readyPlan, "phase_29_codex_cli_adapter_spike");
const phase31Ready = phase(readyPlan, "phase_31_provider_execution_permission_gate");
const phase32Ready = phase(readyPlan, "phase_32_action_time_confirmation_receipt");
assert(phase26Ready.status === "ready_for_noop_runner", "Phase 26 status must describe mock/no-op runner");
assert(phase29Ready.status === "ready_for_adapter_spike", "Phase 29 status must describe adapter spike");
assert(phase31Ready.status === "ready_for_final_permission_gate", "Phase 31 status must describe final permission gate");
assert(phase32Ready.status === "ready_for_receipt_gate", "Phase 32 status must describe receipt gate");
assert(
  readyPlan.adapterBoundary.phase29.requiresPhase26ReplacementProof === true,
  "Phase 29 must require Phase 26 replacement proof",
);
assert(readyPlan.adapterBoundary.phase29.canSubmitProvider === false, "Phase 29 must not submit provider");

for (const [key, expected] of Object.entries({
  noFreeTextWorker: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noProviderSubmit: true,
  noCredentials: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noArbitraryShell: true,
  noFileMutationUnlessExplicitExportOrProjectIoPhase: true,
  fileMutationAllowed: false,
  liveSubmitAllowed: false,
  dryRunOnly: true,
})) {
  assert(phaseRoadmapRuntimeHardLocks[key] === expected, `top-level hard lock ${key} drifted`);
  assert(readyPlan.hardLocks[key] === expected, `plan hard lock ${key} drifted`);
}

for (const item of readyPlan.phases) {
  assert(item.hardLocks.noFreeTextWorker === true, `${item.phaseId} must pin no free text worker`);
  assert(item.hardLocks.validatedEnvelopeRequired === true, `${item.phaseId} must require validated envelope`);
  assert(item.hardLocks.structuredResultRequired === true, `${item.phaseId} must require structured result`);
  assert(item.hardLocks.noProviderSubmit === true, `${item.phaseId} must forbid provider submit`);
  assert(item.hardLocks.noCredentials === true, `${item.phaseId} must forbid credentials`);
  assert(item.hardLocks.noArbitraryShell === true, `${item.phaseId} must forbid arbitrary shell`);
  assert(item.hardLocks.liveSubmitAllowed === false, `${item.phaseId} must keep live submit false`);
}
assert(
  phase(readyPlan, "phase_27_export_worker_mvp").hardLocks.fileMutationAllowed === true,
  "Phase 27 must be the explicit export/project IO mutation exception",
);
for (const item of readyPlan.phases.filter((phaseItem) => phaseItem.phaseId !== "phase_27_export_worker_mvp")) {
  assert(item.hardLocks.fileMutationAllowed === false, `${item.phaseId} must not allow file mutation`);
}

const schemaPath = "schemas/phase_roadmap_runtime.schema.json";
assert(fs.existsSync(schemaPath), "phase roadmap runtime schema file must exist");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const schemaRegistrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  schemaRegistrySource.includes("phase_roadmap_runtime.schema.json") &&
    schemaRegistrySource.includes("PhaseRoadmapRuntimePlan"),
  "schema registry must include PhaseRoadmapRuntimePlan",
);
assert(schema.properties.schemaVersion.const === "0.1.0", "schema must pin schemaVersion");
assert(schema.properties.phaseRange.const === "phase_24_to_32", "schema must pin Phase 24-32 range");
assert(schema.properties.phases.minItems === 9, "schema phase list must require 9 phases");
assert(schema.properties.phases.maxItems === 9, "schema phase list must cap at 9 phases");
assert(
  schema.$defs.phaseId.enum.includes("phase_32_action_time_confirmation_receipt"),
  "schema phase id enum must include Phase 32 action confirmation receipt",
);
assert(
  schema.$defs.status.enum.includes("ready_for_receipt_gate"),
  "schema status enum must include ready_for_receipt_gate",
);
assert(schema.$defs.summary.properties.totalPhases.const === 9, "schema summary must pin totalPhases=9");
assert(schema.$defs.summary.properties.providerSubmitAllowed.const === 0, "schema summary must pin providerSubmitAllowed=0");
assert(schema.$defs.summary.properties.credentialAccessAllowed.const === false, "schema summary must forbid credential access");
assert(schema.$defs.summary.properties.arbitraryShellAllowed.const === false, "schema summary must forbid arbitrary shell");
assert(schema.$defs.summary.properties.freeTextWorkerAllowed.const === false, "schema summary must forbid free-text workers");
assert(
  schema.$defs.evidenceDecision.properties.evidenceKey.enum.includes("agentCliMockRunner"),
  "schema evidence decisions must include typed Agent/CLI mock runner evidence",
);
assert(
  schema.$defs.evidenceDecision.properties.evidenceKey.enum.includes("exportWorker"),
  "schema evidence decisions must include typed export worker evidence",
);
assert(
  schema.$defs.evidenceDecision.properties.evidenceKey.enum.includes("voiceAudioSettings"),
  "schema evidence decisions must include typed voice/audio settings evidence",
);
assert(
  schema.$defs.evidenceDecision.properties.evidenceKey.enum.includes("providerExecutionPermissionGate"),
  "schema evidence decisions must include typed provider execution permission evidence",
);
assert(
  schema.$defs.evidenceDecision.properties.evidenceKey.enum.includes("providerActionConfirmationReceipt"),
  "schema evidence decisions must include typed provider action confirmation receipt evidence",
);
assert(schema.$defs.hardLocks.properties.noFreeTextWorker.const === true, "schema hard locks must pin noFreeTextWorker=true");
assert(schema.$defs.hardLocks.properties.validatedEnvelopeRequired.const === true, "schema hard locks must pin validated envelope");
assert(schema.$defs.hardLocks.properties.structuredResultRequired.const === true, "schema hard locks must pin structured result");
assert(schema.$defs.hardLocks.properties.noProviderSubmit.const === true, "schema hard locks must pin no provider submit");
assert(schema.$defs.hardLocks.properties.noCredentialRead.const === true, "schema hard locks must pin no credential read");
assert(schema.$defs.hardLocks.properties.noCredentialWrite.const === true, "schema hard locks must pin no credential write");
assert(schema.$defs.hardLocks.properties.noArbitraryShell.const === true, "schema hard locks must pin no arbitrary shell");
assert(schema.$defs.hardLocks.properties.liveSubmitAllowed.const === false, "schema hard locks must pin live submit false");
assert(
  schema.$defs.adapterBoundary.properties.phase26.properties.runnerKind.const === "mock_noop",
  "schema adapter boundary must pin Phase 26 mock/no-op",
);
assert(
  schema.$defs.adapterBoundary.properties.phase26.properties.canSubmitProvider.const === false,
  "schema adapter boundary must block Phase 26 provider submit",
);
assert(
  schema.$defs.adapterBoundary.properties.phase29.properties.runnerKind.const === "codex_cli_adapter_spike",
  "schema adapter boundary must pin Phase 29 adapter spike",
);
assert(
  schema.$defs.adapterBoundary.properties.phase29.properties.requiresPhase26ReplacementProof.const === true,
  "schema adapter boundary must require Phase 26 replacement proof",
);
assert(
  schema.$defs.providerEnablementGate.properties.userConfirmationTokenPlaceholderRequired.const === true,
  "schema provider gate must require confirmation token placeholder",
);
assert(
  schema.$defs.providerEnablementGate.properties.packetCompleteRequired.const === true,
  "schema provider gate must require complete packet",
);
assert(
  schema.$defs.providerEnablementGate.properties.watcherManifestQaClosedLoopRequired.const === true,
  "schema provider gate must require watcher/manifest/QA closed loop",
);
assert(
  schema.$defs.providerEnablementGate.properties.noFastVipTextToVideoOrBgmPromptRequired.const === true,
  "schema provider gate must require forbidden provider modes absent",
);
assert(
  schema.$defs.providerEnablementGate.properties.canSubmitProvider.const === false,
  "schema provider gate must pin canSubmitProvider=false",
);
assert(
  schema.$defs.providerExecutionPermissionGate.properties.actionTimeUserConfirmationRequired.const === true,
  "schema provider execution permission gate must require action-time user confirmation",
);
assert(
  schema.$defs.providerExecutionPermissionGate.properties.automaticSubmitForbidden.const === true,
  "schema provider execution permission gate must forbid automatic submit",
);
assert(
  schema.$defs.providerExecutionPermissionGate.properties.canSubmitProvider.const === false,
  "schema provider execution permission gate must pin canSubmitProvider=false",
);
assert(
  schema.$defs.providerExecutionPermissionGate.properties.providerSubmitAllowed.const === 0,
  "schema provider execution permission gate must pin providerSubmitAllowed=0",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.actionTimeConfirmationReceiptPlanRequired.const === true,
  "schema provider action confirmation receipt gate must require an action-time receipt plan",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.confirmedReceiptCount.const === 0,
  "schema provider action confirmation receipt gate must pin confirmedReceiptCount=0",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.reviewShellOnly.const === true,
  "schema provider action confirmation receipt gate must remain review-shell-only",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.canSubmitProvider.const === false,
  "schema provider action confirmation receipt gate must pin canSubmitProvider=false",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.providerSubmitAllowed.const === 0,
  "schema provider action confirmation receipt gate must pin providerSubmitAllowed=0",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.liveSubmitAllowed.const === false,
  "schema provider action confirmation receipt gate must pin liveSubmitAllowed=false",
);
assert(
  schema.$defs.providerActionConfirmationReceipt.properties.credentialAccessAllowed.const === false,
  "schema provider action confirmation receipt gate must pin credentialAccessAllowed=false",
);

const source = fs.readFileSync("src/core/phaseRoadmapRuntime.ts", "utf8");
for (const forbiddenCode of ["child_process", "spawn(", "exec(", "fetch(", "XMLHttpRequest", "process.env"]) {
  assert(!source.includes(forbiddenCode), `phaseRoadmapRuntime source must not contain ${forbiddenCode}`);
}

console.log(
  `Phase roadmap runtime tests passed: ${readyPlan.summary.ready} ready phase(s), ${blockedProviderGate.summary.blocked} blocked phase(s) in provider-gate fixture.`,
);
