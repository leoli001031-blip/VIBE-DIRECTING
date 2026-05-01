export const phaseRoadmapRuntimeSchemaVersion = "0.1.0";

export type PhaseRoadmapPhaseId =
  | "phase_24_subagent_runtime_gate"
  | "phase_25_knowledge_pack_manager"
  | "phase_26_agent_cli_mock_runner"
  | "phase_27_export_worker_mvp"
  | "phase_28_voice_audio_settings_ui"
  | "phase_29_codex_cli_adapter_spike"
  | "phase_30_provider_enablement_gate"
  | "phase_31_provider_execution_permission_gate"
  | "phase_32_action_time_confirmation_receipt";

export type PhaseRoadmapReadiness = "ready" | "blocked";
export type PhaseRoadmapStatus =
  | "ready_for_implementation"
  | "ready_for_noop_runner"
  | "ready_for_adapter_spike"
  | "ready_for_confirmation_gate"
  | "ready_for_final_permission_gate"
  | "ready_for_receipt_gate"
  | "blocked_by_gate";
export type PhaseRoadmapEvidenceDecisionSource = "typed_evidence" | "legacy_boolean_override" | "missing";
export type PhaseRoadmapEvidenceStatus =
  | "ready"
  | "valid"
  | "pass"
  | "passed"
  | "closed"
  | "ready_for_confirmation"
  | "ready_for_replacement_proof"
  | "ready_for_receipt_gate"
  | "blocked"
  | "invalid"
  | "fail"
  | "failed"
  | "missing";

export interface PhaseRoadmapProjectFactsIntegrationEvidence {
  kind?: "project_facts_integration";
  phase?: "phase20_project_facts_integration";
  status: "ready" | "blocked";
  summary?: {
    blockerCount?: number;
    blocked?: number;
    missing?: number;
  };
  hardLocks?: {
    noProviderSubmit?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noFastVip?: boolean;
    seedanceJimengVideoParked?: boolean;
    projectFactsAreProjectLocal?: boolean;
  };
  blockers?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapSubagentEnvelopeValidatorReceipt {
  kind?: "subagent_envelope_validator";
  phase?: "phase_16_subagent_worker_runtime";
  status?: PhaseRoadmapEvidenceStatus;
  valid?: boolean;
  validation?: {
    ok?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  validatedEnvelopeRequired?: boolean;
  structuredResultRequired?: boolean;
  freeTextWorkerBlocked?: boolean;
  hardLocks?: {
    noFreeTextTask?: boolean;
    noFreeTextWorker?: boolean;
    validatedEnvelopeRequired?: boolean;
    structuredResultRequired?: boolean;
    providerSubmissionForbidden?: boolean;
    liveSubmitAllowed?: boolean;
  };
  issues?: string[];
  blockers?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapProviderLiveGateReceipt {
  kind?: "provider_live_gate";
  phase?: "phase_11_provider_adapter_live_gate";
  status?: PhaseRoadmapEvidenceStatus;
  phase30Evidence?: PhaseRoadmapProviderLiveGatePhase30Evidence;
  roadmapEvidence?: PhaseRoadmapProviderLiveGatePhase30Evidence;
  confirmationTokenPlaceholderPresent?: boolean;
  providerPacketComplete?: boolean;
  forbiddenProviderModesAbsent?: boolean;
  summary?: {
    readyForConfirmation?: number;
    blocked?: number;
    parked?: number;
    providerSubmitAllowed?: number;
    liveSubmitAllowed?: boolean;
    credentialStorage?: boolean;
  };
  hardLocks?: {
    noProviderSubmit?: boolean;
    providerSubmissionForbidden?: boolean;
    liveSubmitAllowed?: boolean;
    credentialStorage?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noApiKeyCreation?: boolean;
    noArbitraryProviderCommand?: boolean;
    fastModelForbidden?: boolean;
    vipChannelForbidden?: boolean;
    textToVideoMainPathForbidden?: boolean;
    bgmInVideoPromptForbidden?: boolean;
  };
  forbiddenActions?: string[];
  items?: PhaseRoadmapProviderLiveGateItem[];
  blockers?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapProviderLiveGatePhase30Evidence {
  phaseId?: "phase_30_provider_enablement_gate";
  confirmationTokenPlaceholderPresent?: boolean;
  providerPacketComplete?: boolean;
  watcherManifestQaClosedLoop?: boolean;
  forbiddenProviderModesAbsent?: boolean;
  providerSubmitAllowed?: number | boolean;
  liveSubmitAllowed?: boolean;
  credentialStorage?: boolean;
  hardLocksPinned?: boolean;
  fastModelPromptPresent?: boolean;
  vipPromptPresent?: boolean;
  textToVideoPromptPresent?: boolean;
  bgmPromptPresent?: boolean;
}

export interface PhaseRoadmapProviderLiveGateItem {
  status?: string;
  checks?: Array<{
    checkId?: string;
    passed?: boolean;
    blocker?: string;
    warning?: string;
  }>;
  blockers?: string[];
  warnings?: string[];
  canRequestUserConfirmation?: boolean;
  canSubmitProvider?: boolean;
  providerSubmissionForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  credentialStorage?: boolean;
  noCredentialRead?: boolean;
  noCredentialWrite?: boolean;
  requiredMode?: string;
  slot?: string;
  confirmationTokenId?: string;
}

export interface PhaseRoadmapProviderExecutionPermissionGateEvidence {
  kind?: "provider_execution_permission_gate";
  phase?: "phase_31_provider_execution_permission_gate";
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: "ready_for_final_permission_gate" | "ready" | "blocked";
  phase31Evidence?: {
    phaseId?: "phase_31_provider_execution_permission_gate";
    typedEvidencePresent?: boolean;
    phase30GateConsumed?: boolean;
    actionTimeUserConfirmationRequired?: boolean;
    automaticSubmitForbidden?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    forbiddenProviderModesAbsent?: boolean;
  };
  summary?: {
    readyForUserReview?: number;
    blocked?: number;
    parked?: number;
    canAskUserToConfirm?: number;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    automaticSubmitAllowed?: boolean;
  };
  hardLocks?: {
    dryRunOnly?: boolean;
    readOnly?: boolean;
    reviewPlanOnly?: boolean;
    actionTimeConfirmationRequired?: boolean;
    providerSubmissionForbidden?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noApiKeyCreation?: boolean;
    noArbitraryProviderCommand?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    fastModelForbidden?: boolean;
    vipChannelForbidden?: boolean;
    textToVideoMainPathForbidden?: boolean;
    bgmInVideoPromptForbidden?: boolean;
  };
  forbiddenActions?: string[];
  requests?: Array<{
    status?: string;
    canAskUserToConfirm?: boolean;
    actionTimeConfirmationRequired?: boolean;
    userConfirmedAtActionTime?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    blockers?: string[];
    warnings?: string[];
  }>;
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapProviderActionConfirmationReceiptEvidence {
  kind?: "provider_action_confirmation_receipt";
  phase?: "phase_32_action_time_confirmation_receipt";
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: "ready_for_receipt_gate" | "ready" | "blocked";
  phase32Evidence?: {
    phaseId?: "phase_32_action_time_confirmation_receipt";
    typedEvidencePresent?: boolean;
    phase31EvidenceConsumed?: boolean;
    actionTimeConfirmationReceiptPlanPresent?: boolean;
    confirmedReceiptCount?: number | boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    automaticSubmitAllowed?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    forbiddenProviderModesAbsent?: boolean;
    hardLocksPinned?: boolean;
  };
  summary?: {
    readyForReceiptReview?: number;
    receiptPlanCount?: number;
    confirmedReceiptCount?: number | boolean;
    blocked?: number;
    parked?: number;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    automaticSubmitAllowed?: boolean;
  };
  hardLocks?: {
    dryRunOnly?: boolean;
    readOnly?: boolean;
    reviewShellOnly?: boolean;
    receiptPlanOnly?: boolean;
    actionTimeConfirmationRequired?: boolean;
    providerSubmissionForbidden?: boolean;
    automaticSubmitForbidden?: boolean;
    automaticSubmitAllowed?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noApiKeyCreation?: boolean;
    noArbitraryProviderCommand?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    fastModelForbidden?: boolean;
    vipChannelForbidden?: boolean;
    textToVideoMainPathForbidden?: boolean;
    bgmInVideoPromptForbidden?: boolean;
  };
  receipts?: Array<{
    status?: string;
    actionTimeConfirmationRequired?: boolean;
    receiptPlanPresent?: boolean;
    confirmed?: boolean;
    userConfirmedAtActionTime?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    automaticSubmitAllowed?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    forbiddenProviderModesAbsent?: boolean;
    blockers?: string[];
    warnings?: string[];
  }>;
  requests?: Array<{
    status?: string;
    actionTimeConfirmationRequired?: boolean;
    receiptPlanPresent?: boolean;
    confirmed?: boolean;
    userConfirmedAtActionTime?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    automaticSubmitAllowed?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    forbiddenProviderModesAbsent?: boolean;
    blockers?: string[];
    warnings?: string[];
  }>;
  forbiddenActions?: string[];
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapClosedLoopReceipt {
  kind?: "watcher_manifest_qa_closed_loop";
  status?: PhaseRoadmapEvidenceStatus;
  closedLoop?: boolean;
  watcherReady?: boolean;
  manifestMatcherReady?: boolean;
  qaReportReady?: boolean;
  blockers?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapAgentCliMockRunnerEvidence {
  kind?: "agent_cli_mock_runner";
  phase?: "phase_26_agent_cli_mock_runner";
  status?: PhaseRoadmapEvidenceStatus;
  runnerKind?: "mock_noop";
  readiness?: "ready_for_replacement_proof" | "ready_for_phase_29_adapter_spike" | "ready" | "blocked";
  mockRunnerNoopReady?: boolean;
  replacementProofReady?: boolean;
  contract?: {
    inputSource?: "validated_envelope_only" | string;
    resultKind?: "structured_noop" | string;
    canReplaceCodexCli?: boolean;
    canSpawnCodex?: boolean;
    canResumeCodex?: boolean;
    canSubmitProvider?: boolean;
    canExecuteShell?: boolean;
    canReadCredentials?: boolean;
    canWriteCredentials?: boolean;
    canMutateFiles?: boolean;
  };
  adapterBoundary?: {
    providerSubmitAllowed?: boolean;
    shellAllowed?: boolean;
    fileMutationAllowed?: boolean;
  };
  observations?: {
    providerSubmitObserved?: boolean;
    freeTextTaskObserved?: boolean;
    spawnCodexObserved?: boolean;
    resumeCodexObserved?: boolean;
    shellExecutionObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    fileMutationObserved?: boolean;
  };
  hardLocks?: {
    mockOnly?: boolean;
    dryRunOnly?: boolean;
    noCodexSpawn?: boolean;
    noCodexResume?: boolean;
    noSpawnCodex?: boolean;
    noResumeCodex?: boolean;
    noProviderSubmit?: boolean;
    liveSubmitAllowed?: boolean;
    noFreeTextWorker?: boolean;
    noFreeTextTask?: boolean;
    validatedEnvelopeRequired?: boolean;
    structuredResultRequired?: boolean;
    noShellExecution?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noFileMutation?: boolean;
  };
  roadmapEvidence?: {
    phaseId?: "phase_26_agent_cli_mock_runner";
    mockRunnerNoopReady?: boolean;
    replacementProofReady?: boolean;
    providerSubmitObserved?: boolean;
    freeTextTaskObserved?: boolean;
    spawnCodexObserved?: boolean;
    resumeCodexObserved?: boolean;
    shellExecutionObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    fileMutationObserved?: boolean;
  };
  receipt?: {
    replacementProofReady?: boolean;
    blockedReasons?: string[];
  };
  validation?: {
    ok?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapExportWorkerEvidence {
  kind?: "export_worker";
  phase?: "phase_27_export_worker_mvp";
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: "ready_to_plan" | "ready_for_export_project_io" | "ready" | "blocked";
  scope?: "export_project_io_contract" | string;
  executionMode?: "plan_only" | string;
  canExecute?: boolean;
  entries?: Array<{
    path?: string;
    operation?: "create_directory" | "write_file" | string;
    projectRootRelative?: boolean;
    canExecute?: boolean;
  }>;
  ioContract?: {
    scope?: "export_project_io_contract" | string;
    pathMode?: "project_root_relative" | string;
    allowedDirectories?: string[];
    entries?: Array<{
      path?: string;
      role?: "export" | "report" | string;
      pathOrigin?: "project_root_relative" | string;
      canWrite?: boolean;
    }>;
  };
  summary?: {
    plannedEntries?: number;
    blockedReasons?: string[];
    canExecuteAdapterNow?: boolean;
    providerSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    arbitraryShellAllowed?: boolean;
    mediaRenderAllowed?: boolean;
  };
  adapterBoundary?: {
    realAdapterExecutionAllowed?: boolean;
    providerSubmitAllowed?: boolean;
    shellAllowed?: boolean;
    credentialReadAllowed?: boolean;
    credentialWriteAllowed?: boolean;
    mediaRenderAllowed?: boolean;
    copySourceFilesAllowed?: boolean;
    moveSourceFilesAllowed?: boolean;
    deleteAllowed?: boolean;
    outsideProjectRootAllowed?: boolean;
  };
  hardLocks?: {
    projectRootRelativeOnly?: boolean;
    exportScopeOnly?: boolean;
    noAbsolutePath?: boolean;
    noParentTraversal?: boolean;
    noMove?: boolean;
    noUserFileOverwriteOutsideExport?: boolean;
    exportProjectIoContractOnly?: boolean;
    defaultPlanOnly?: boolean;
    pathsProjectRootRelative?: boolean;
    pathsAllowlisted?: boolean;
    noAbsolutePaths?: boolean;
    noOutsideProjectRoot?: boolean;
    noProviderSubmit?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noArbitraryShell?: boolean;
    noMediaRender?: boolean;
    noCopySourceFiles?: boolean;
    noMoveSourceFiles?: boolean;
    noDelete?: boolean;
    noNleProjectGeneration?: boolean;
  };
  observations?: {
    providerSubmitObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    shellExecutionObserved?: boolean;
    mediaRenderObserved?: boolean;
    copyObserved?: boolean;
    moveObserved?: boolean;
    deleteObserved?: boolean;
    outsideProjectRootObserved?: boolean;
  };
  validation?: {
    ok?: boolean;
    pathsAllowlisted?: boolean;
    hardLocksPinned?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  roadmapEvidence?: {
    phaseId?: "phase_27_export_worker_mvp";
    scopeReady?: boolean;
    pathsAllowlisted?: boolean;
    hardLocksPinned?: boolean;
    providerSubmitObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    shellExecutionObserved?: boolean;
    mediaRenderObserved?: boolean;
    moveObserved?: boolean;
    deleteObserved?: boolean;
    outsideProjectRootObserved?: boolean;
  };
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapVoiceAudioSettingsEvidence {
  kind?: "voice_audio_settings";
  phase?: "phase_28_voice_audio_settings_ui";
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: "ready" | "blocked";
  scope?: "voice_audio_project_facts" | string;
  purpose?: "voice_audio_project_facts" | string;
  settingsOnly?: boolean;
  providerSubmissionForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  noBgmForVideoProvider?: boolean;
  bgmIncludedInVideoPrompt?: boolean;
  videoProviderPolicy?: {
    noBgmForVideoProvider?: boolean;
    bgmIncludedInVideoPrompt?: boolean;
    musicAllowed?: boolean;
  };
  videoProviderAudioPolicy?: {
    noBgmForVideoProvider?: boolean;
    bgmIncludedInVideoPrompt?: boolean;
    musicAllowed?: boolean;
  };
  audioPlanning?: {
    videoProviderPolicy?: {
      noBgmForVideoProvider?: boolean;
      bgmIncludedInVideoPrompt?: boolean;
      musicAllowed?: boolean;
    };
    providerSubmissionForbidden?: boolean;
    dryRunOnly?: boolean;
  };
  summary?: {
    noBgmForVideoProvider?: boolean;
    bgmIncludedInVideoPrompt?: boolean;
    providerSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    arbitraryShellAllowed?: boolean;
    fileMutationAllowed?: boolean;
    sampleCopyAllowed?: boolean;
    audioSubmitAllowed?: boolean;
    ttsSubmitAllowed?: boolean;
    musicSubmitAllowed?: boolean;
    liveSubmitAllowed?: boolean;
  };
  adapterBoundary?: {
    providerSubmitAllowed?: boolean;
    credentialReadAllowed?: boolean;
    credentialWriteAllowed?: boolean;
    shellAllowed?: boolean;
    arbitraryShellAllowed?: boolean;
    fileMutationAllowed?: boolean;
    sampleCopyAllowed?: boolean;
    copySampleAudioAllowed?: boolean;
    audioSubmitAllowed?: boolean;
    ttsSubmitAllowed?: boolean;
    musicSubmitAllowed?: boolean;
    liveSubmitAllowed?: boolean;
  };
  observations?: {
    providerSubmitObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    shellExecutionObserved?: boolean;
    fileMutationObserved?: boolean;
    sampleCopyObserved?: boolean;
    audioSubmitObserved?: boolean;
    ttsSubmitObserved?: boolean;
    musicSubmitObserved?: boolean;
    liveSubmitObserved?: boolean;
    bgmIncludedInVideoPrompt?: boolean;
  };
  hardLocks?: {
    settingsOnly?: boolean;
    projectFactsOnly?: boolean;
    voiceAudioProjectFactsOnly?: boolean;
    dryRunOnly?: boolean;
    noProviderSubmit?: boolean;
    providerSubmissionForbidden?: boolean;
    liveSubmitAllowed?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noSecretStorage?: boolean;
    noArbitraryShell?: boolean;
    noShellExecution?: boolean;
    noFileMutation?: boolean;
    noSampleAudioCopy?: boolean;
    noAudioSubmit?: boolean;
    noTtsSubmit?: boolean;
    noMusicSubmit?: boolean;
    noBgmForVideoProvider?: boolean;
    noBgmInVideoProviderPrompt?: boolean;
    noBgmInVideoProvider?: boolean;
    noVideoProviderBgmPrompt?: boolean;
    bgmIncludedInVideoPrompt?: boolean;
  };
  validation?: {
    ok?: boolean;
    hardLocksPinned?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  roadmapEvidence?: {
    phaseId?: "phase_28_voice_audio_settings_ui";
    voiceAudioSettingsReady?: boolean;
    noBgmForVideoProvider?: boolean;
    bgmIncludedInVideoPrompt?: boolean;
    hardLocksPinned?: boolean;
    providerSubmitObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    shellExecutionObserved?: boolean;
    fileMutationObserved?: boolean;
    sampleCopyObserved?: boolean;
    audioSubmitObserved?: boolean;
    ttsSubmitObserved?: boolean;
    musicSubmitObserved?: boolean;
    liveSubmitObserved?: boolean;
  };
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapCodexCliAdapterEvidence {
  kind?: "codex_cli_adapter_spike";
  phaseId?: "phase_29_codex_cli_adapter_spike";
  phase?: "phase_29_codex_cli_adapter_spike";
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: "ready_for_adapter_spike" | "ready" | "blocked";
  adapterContractReady?: boolean;
  phase26ReplacementProofReady?: boolean;
  contract?: {
    inputSource?: "validated_envelope_only" | string;
    resultKind?: "structured_result" | "structured_subagent_result_shape_only" | string;
    providerSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    arbitraryShellAllowed?: boolean;
    shellAllowed?: boolean;
    fileMutationAllowed?: boolean;
    freeTextAllowed?: boolean;
    actualSpawnAllowed?: boolean;
    actualResumeAllowed?: boolean;
    spawnResumeMode?: "shape_only" | "contract_only" | "actual_spawn_resume" | string;
  };
  adapterBoundary?: {
    inputContract?: "validated_subagent_task_envelope_only" | "validated_envelope_only" | string;
    outputContract?: "structured_subagent_result_shape_only" | "structured_result" | string;
    contractMode?: "contract_only" | "shape_only" | string;
    providerSubmitAllowed?: boolean;
    credentialReadAllowed?: boolean;
    credentialWriteAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    shellAllowed?: boolean;
    arbitraryShellAllowed?: boolean;
    fileMutationAllowed?: boolean;
    freeTextWorkerAllowed?: boolean;
    freeTextTaskAllowed?: boolean;
    actualSpawnAllowed?: boolean;
    actualResumeAllowed?: boolean;
    spawnResumeAvailable?: boolean;
  };
  observations?: {
    providerSubmitObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    shellExecutionObserved?: boolean;
    fileMutationObserved?: boolean;
    freeTextTaskObserved?: boolean;
    freeTextWorkerObserved?: boolean;
    actualSpawnObserved?: boolean;
    actualResumeObserved?: boolean;
    spawnCodexObserved?: boolean;
    resumeCodexObserved?: boolean;
    unstructuredResultObserved?: boolean;
  };
  hardLocks?: {
    contractOnly?: boolean;
    dryRunOnly?: boolean;
    noActualSpawn?: boolean;
    noActualResume?: boolean;
    actualSpawnAllowed?: boolean;
    actualResumeAllowed?: boolean;
    noProviderSubmit?: boolean;
    liveSubmitAllowed?: boolean;
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    noCredentials?: boolean;
    noArbitraryShell?: boolean;
    noShellExecution?: boolean;
    noFileMutation?: boolean;
    noFreeTextWorker?: boolean;
    noFreeTextTask?: boolean;
    validatedEnvelopeRequired?: boolean;
    structuredResultRequired?: boolean;
  };
  roadmapEvidence?: {
    phaseId?: "phase_29_codex_cli_adapter_spike";
    adapterContractReady?: boolean;
    phase26ReplacementProofReady?: boolean;
    inputSourceValidatedEnvelopeOnly?: boolean;
    structuredResultRequired?: boolean;
    providerSubmitBlocked?: boolean;
    credentialBlocked?: boolean;
    arbitraryShellBlocked?: boolean;
    fileMutationBlocked?: boolean;
    freeTextBlocked?: boolean;
    actualSpawnResumeUnavailable?: boolean;
    hardLocksPinned?: boolean;
    providerSubmitObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    shellExecutionObserved?: boolean;
    fileMutationObserved?: boolean;
    freeTextTaskObserved?: boolean;
    freeTextWorkerObserved?: boolean;
    actualSpawnObserved?: boolean;
    actualResumeObserved?: boolean;
    unstructuredResultObserved?: boolean;
  };
  inputContract?: {
    source?: "validated_envelope_only" | string;
    envelope?: {
      validationStatus?: "valid" | "invalid" | "missing" | string;
    };
  };
  resultContract?: {
    structured?: boolean;
    expectedResultSchema?: string;
    freeTextAccepted?: boolean;
    notRealExecution?: boolean;
  };
  replacementProof?: {
    replacementProofReady?: boolean;
  };
  executionPolicy?: {
    liveSubmitAllowed?: boolean;
    actualSpawnAllowed?: boolean;
    actualResumeAllowed?: boolean;
    providerSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    arbitraryShellAllowed?: boolean;
    fileMutationAllowed?: boolean;
    freeTextTaskAllowed?: boolean;
  };
  validation?: {
    ok?: boolean;
    hardLocksPinned?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapRuntimeEvidence {
  projectFactsIntegration?: PhaseRoadmapProjectFactsIntegrationEvidence;
  subagentEnvelopeValidator?: PhaseRoadmapSubagentEnvelopeValidatorReceipt;
  agentCliMockRunner?: PhaseRoadmapAgentCliMockRunnerEvidence;
  codexCliAdapter?: PhaseRoadmapCodexCliAdapterEvidence;
  codexCliAdapterSpike?: PhaseRoadmapCodexCliAdapterEvidence;
  exportWorker?: PhaseRoadmapExportWorkerEvidence;
  voiceAudioSettings?: PhaseRoadmapVoiceAudioSettingsEvidence;
  providerLiveGate?: PhaseRoadmapProviderLiveGateReceipt;
  providerExecutionPermissionGate?: PhaseRoadmapProviderExecutionPermissionGateEvidence;
  providerActionConfirmationReceipt?: PhaseRoadmapProviderActionConfirmationReceiptEvidence;
  watcherManifestQaClosedLoop?: PhaseRoadmapClosedLoopReceipt;
}

export interface PhaseRoadmapEvidenceDecision {
  evidenceKey:
    | "projectFactsIntegration"
    | "subagentEnvelopeValidator"
    | "agentCliMockRunner"
    | "codexCliAdapter"
    | "exportWorker"
    | "voiceAudioSettings"
    | "providerConfirmationTokenPlaceholder"
    | "providerEnablementPacket"
    | "watcherManifestQaClosedLoop"
    | "forbiddenProviderModesAbsent"
    | "providerExecutionPermissionGate"
    | "providerActionConfirmationReceipt";
  source: PhaseRoadmapEvidenceDecisionSource;
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

export interface PhaseRoadmapRuntimeInput {
  generatedAt?: string;
  evidence?: PhaseRoadmapRuntimeEvidence;
  legacyBooleanOverridesAllowed?: boolean;
  projectFactsValidated?: boolean;
  subagentEnvelopeValidatorReady?: boolean;
  knowledgePackManagerReady?: boolean;
  mockRunnerNoopReady?: boolean;
  mockRunnerProviderSubmitObserved?: boolean;
  exportWorkerIoScopeReady?: boolean;
  voiceAudioSettingsReady?: boolean;
  codexCliAdapterDryRunReady?: boolean;
  replacementProofFromMockRunner?: boolean;
  providerConfirmationTokenPlaceholderPresent?: boolean;
  providerPacketComplete?: boolean;
  watcherManifestQaClosedLoop?: boolean;
  forbiddenProviderModesAbsent?: boolean;
  providerExecutionPermissionGateReady?: boolean;
  providerActionConfirmationReceiptReady?: boolean;
}

export interface PhaseRoadmapHardLocks {
  noFreeTextWorker: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noProviderSubmit: true;
  noCredentials: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noArbitraryShell: true;
  noFileMutationUnlessExplicitExportOrProjectIoPhase: true;
  fileMutationAllowed: boolean;
  liveSubmitAllowed: false;
  dryRunOnly: true;
}

export interface PhaseRoadmapPhasePlan {
  phaseId: PhaseRoadmapPhaseId;
  phaseNumber: 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32;
  title: string;
  readiness: PhaseRoadmapReadiness;
  status: PhaseRoadmapStatus;
  blockedReasons: string[];
  requiredPrecedingPhases: PhaseRoadmapPhaseId[];
  hardLocks: PhaseRoadmapHardLocks;
  requiredInputs: string[];
  acceptanceCriteria: string[];
  notes: string[];
}

export interface PhaseRoadmapRuntimePlan {
  schemaVersion: "0.1.0";
  generatedAt: string;
  phaseRange: "phase_24_to_32";
  phases: PhaseRoadmapPhasePlan[];
  summary: {
    totalPhases: 9;
    ready: number;
    blocked: number;
    providerSubmitAllowed: 0;
    credentialAccessAllowed: false;
    arbitraryShellAllowed: false;
    freeTextWorkerAllowed: false;
  };
  evidenceSummary: {
    typedEvidenceRequiredForPhase24: true;
    legacyBooleanOverridesAllowed: boolean;
    decisions: PhaseRoadmapEvidenceDecision[];
    notes: string[];
  };
  hardLocks: PhaseRoadmapHardLocks;
  adapterBoundary: {
    phase26: {
      runnerKind: "mock_noop";
      purpose: "prove_replaceable_runner_contract";
      canSpawnCodex: false;
      canResumeCodex: false;
      canSubmitProvider: false;
    };
    phase29: {
      runnerKind: "codex_cli_adapter_spike";
      purpose: "connect_spawn_resume_after_mock_contract_is_proven";
      requiresPhase26ReplacementProof: true;
      canSubmitProvider: false;
    };
  };
  providerEnablementGate: {
    userConfirmationTokenPlaceholderRequired: true;
    packetCompleteRequired: true;
    watcherManifestQaClosedLoopRequired: true;
    noFastVipTextToVideoOrBgmPromptRequired: true;
    canSubmitProvider: false;
  };
  providerExecutionPermissionGate: {
    actionTimeUserConfirmationRequired: true;
    automaticSubmitForbidden: true;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
  };
  providerActionConfirmationReceipt: {
    actionTimeConfirmationReceiptPlanRequired: true;
    confirmedReceiptCount: 0;
    reviewShellOnly: true;
    automaticSubmitForbidden: true;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
  };
}

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

const phaseIds: PhaseRoadmapPhaseId[] = [
  "phase_24_subagent_runtime_gate",
  "phase_25_knowledge_pack_manager",
  "phase_26_agent_cli_mock_runner",
  "phase_27_export_worker_mvp",
  "phase_28_voice_audio_settings_ui",
  "phase_29_codex_cli_adapter_spike",
  "phase_30_provider_enablement_gate",
  "phase_31_provider_execution_permission_gate",
  "phase_32_action_time_confirmation_receipt",
];

export const phaseRoadmapRuntimeHardLocks: PhaseRoadmapHardLocks = {
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
};

function locksForPhase(phaseId: PhaseRoadmapPhaseId): PhaseRoadmapHardLocks {
  const fileMutationAllowed = phaseId === "phase_27_export_worker_mvp";
  return {
    ...phaseRoadmapRuntimeHardLocks,
    fileMutationAllowed,
  };
}

function blockedIf(condition: boolean, reason: string): string[] {
  return condition ? [reason] : [];
}

function precedingBlocked(input: {
  requiredPrecedingPhases: PhaseRoadmapPhaseId[];
  readyPhases: Set<PhaseRoadmapPhaseId>;
}): string[] {
  return input.requiredPrecedingPhases
    .filter((phaseId) => !input.readyPhases.has(phaseId))
    .map((phaseId) => `preceding_phase_not_ready:${phaseId}`);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function readyStatus(status: PhaseRoadmapEvidenceStatus | undefined): boolean {
  return status === "ready"
    || status === "valid"
    || status === "pass"
    || status === "passed"
    || status === "closed"
    || status === "ready_for_confirmation"
    || status === "ready_for_receipt_gate"
    || status === "ready_for_replacement_proof";
}

function hasProjectFactsEvidence(
  evidence: PhaseRoadmapProjectFactsIntegrationEvidence | undefined,
): evidence is PhaseRoadmapProjectFactsIntegrationEvidence {
  return Boolean(evidence && (evidence.kind === "project_facts_integration" || evidence.phase === "phase20_project_facts_integration"));
}

function hasEnvelopeValidatorReceipt(
  receipt: PhaseRoadmapSubagentEnvelopeValidatorReceipt | undefined,
): receipt is PhaseRoadmapSubagentEnvelopeValidatorReceipt {
  return Boolean(receipt && (receipt.kind === "subagent_envelope_validator" || receipt.phase === "phase_16_subagent_worker_runtime"));
}

function hasProviderLiveGateReceipt(
  receipt: PhaseRoadmapProviderLiveGateReceipt | undefined,
): receipt is PhaseRoadmapProviderLiveGateReceipt {
  return Boolean(receipt && (receipt.kind === "provider_live_gate" || receipt.phase === "phase_11_provider_adapter_live_gate"));
}

function hasClosedLoopReceipt(
  receipt: PhaseRoadmapClosedLoopReceipt | undefined,
): receipt is PhaseRoadmapClosedLoopReceipt {
  return Boolean(receipt && receipt.kind === "watcher_manifest_qa_closed_loop");
}

function hasAgentCliMockRunnerEvidence(
  evidence: PhaseRoadmapAgentCliMockRunnerEvidence | undefined,
): evidence is PhaseRoadmapAgentCliMockRunnerEvidence {
  return Boolean(evidence && (
    evidence.kind === "agent_cli_mock_runner" ||
    evidence.phase === "phase_26_agent_cli_mock_runner" ||
    evidence.roadmapEvidence?.phaseId === "phase_26_agent_cli_mock_runner"
  ));
}

function hasExportWorkerEvidence(
  evidence: PhaseRoadmapExportWorkerEvidence | undefined,
): evidence is PhaseRoadmapExportWorkerEvidence {
  return Boolean(evidence && (
    evidence.kind === "export_worker" ||
    evidence.phase === "phase_27_export_worker_mvp" ||
    evidence.roadmapEvidence?.phaseId === "phase_27_export_worker_mvp" ||
    evidence.scope === "export_project_io_contract" ||
    evidence.ioContract?.scope === "export_project_io_contract"
  ));
}

function hasVoiceAudioSettingsEvidence(
  evidence: PhaseRoadmapVoiceAudioSettingsEvidence | undefined,
): evidence is PhaseRoadmapVoiceAudioSettingsEvidence {
  return Boolean(evidence && (
    evidence.kind === "voice_audio_settings" ||
    evidence.phase === "phase_28_voice_audio_settings_ui" ||
    evidence.roadmapEvidence?.phaseId === "phase_28_voice_audio_settings_ui" ||
    evidence.scope === "voice_audio_project_facts" ||
    evidence.purpose === "voice_audio_project_facts"
  ));
}

function hasCodexCliAdapterEvidence(
  evidence: PhaseRoadmapCodexCliAdapterEvidence | undefined,
): evidence is PhaseRoadmapCodexCliAdapterEvidence {
  return Boolean(evidence && (
    evidence.kind === "codex_cli_adapter_spike" ||
    evidence.phase === "phase_29_codex_cli_adapter_spike" ||
    evidence.phaseId === "phase_29_codex_cli_adapter_spike" ||
    evidence.roadmapEvidence?.phaseId === "phase_29_codex_cli_adapter_spike"
  ));
}

function hasProviderExecutionPermissionGateEvidence(
  evidence: PhaseRoadmapProviderExecutionPermissionGateEvidence | undefined,
): evidence is PhaseRoadmapProviderExecutionPermissionGateEvidence {
  return Boolean(evidence && (
    evidence.kind === "provider_execution_permission_gate" ||
    evidence.phase === "phase_31_provider_execution_permission_gate" ||
    evidence.phase31Evidence?.phaseId === "phase_31_provider_execution_permission_gate"
  ));
}

function hasProviderActionConfirmationReceiptEvidence(
  evidence: PhaseRoadmapProviderActionConfirmationReceiptEvidence | undefined,
): evidence is PhaseRoadmapProviderActionConfirmationReceiptEvidence {
  return Boolean(evidence && (
    evidence.kind === "provider_action_confirmation_receipt" ||
    evidence.phase === "phase_32_action_time_confirmation_receipt" ||
    evidence.phase32Evidence?.phaseId === "phase_32_action_time_confirmation_receipt"
  ));
}

function projectFactsEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.projectFactsIntegration;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasProjectFactsEvidence(evidence)) {
    const blockers = uniqueSorted([
      ...blockedIf(evidence.status !== "ready", "project_facts_not_validated"),
      ...blockedIf((evidence.summary?.blockerCount ?? 0) !== 0, "project_facts_blockers_present"),
      ...blockedIf((evidence.summary?.blocked ?? 0) !== 0, "project_facts_blocked_connections_present"),
      ...blockedIf(evidence.hardLocks?.noProviderSubmit === false, "project_facts_hard_lock_no_provider_submit_missing"),
      ...blockedIf(evidence.hardLocks?.noCredentialRead === false, "project_facts_hard_lock_no_credential_read_missing"),
      ...blockedIf(evidence.hardLocks?.noCredentialWrite === false, "project_facts_hard_lock_no_credential_write_missing"),
      ...blockedIf(evidence.hardLocks?.noFastVip === false, "project_facts_hard_lock_no_fast_vip_missing"),
      ...blockedIf(evidence.hardLocks?.seedanceJimengVideoParked === false, "project_facts_video_providers_not_parked"),
      ...blockedIf(evidence.hardLocks?.projectFactsAreProjectLocal === false, "project_facts_not_project_local"),
      ...(evidence.blockers || []),
    ]);

    return {
      evidenceKey: "projectFactsIntegration",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  if (legacyAllowed && input.projectFactsValidated === true) {
    return {
      evidenceKey: "projectFactsIntegration",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_projectFactsValidated_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "projectFactsIntegration",
    source: input.projectFactsValidated === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "project_facts_typed_evidence_missing",
      ...blockedIf(input.projectFactsValidated !== true, "project_facts_not_validated"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(input.projectFactsValidated === true, "legacy_projectFactsValidated_boolean_ignored_without_typed_evidence"),
    ]),
  };
}

function envelopeValidatorEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const receipt = input.evidence?.subagentEnvelopeValidator;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasEnvelopeValidatorReceipt(receipt)) {
    const validationOk = receipt.valid === true || receipt.validation?.ok === true || readyStatus(receipt.status);
    const validatedEnvelopeRequired = receipt.validatedEnvelopeRequired === true
      || receipt.hardLocks?.validatedEnvelopeRequired === true;
    const structuredResultRequired = receipt.structuredResultRequired === true
      || receipt.hardLocks?.structuredResultRequired === true;
    const freeTextWorkerBlocked = receipt.freeTextWorkerBlocked === true
      || receipt.hardLocks?.noFreeTextTask === true
      || receipt.hardLocks?.noFreeTextWorker === true;
    const providerStillBlocked = receipt.hardLocks?.providerSubmissionForbidden !== false
      && receipt.hardLocks?.liveSubmitAllowed !== true;
    const blockers = uniqueSorted([
      ...blockedIf(!validationOk, "validated_subagent_task_envelope_gate_missing"),
      ...blockedIf(!validatedEnvelopeRequired, "validated_subagent_task_envelope_gate_missing"),
      ...blockedIf(!structuredResultRequired, "structured_subagent_result_gate_missing"),
      ...blockedIf(!freeTextWorkerBlocked, "free_text_worker_not_blocked"),
      ...blockedIf(!providerStillBlocked, "subagent_validator_provider_submit_not_blocked"),
      ...(receipt.issues || []),
      ...(receipt.blockers || []),
      ...(receipt.validation?.errors || []),
    ]);

    return {
      evidenceKey: "subagentEnvelopeValidator",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(receipt.warnings || []), ...(receipt.validation?.warnings || [])]),
    };
  }

  if (legacyAllowed && input.subagentEnvelopeValidatorReady === true) {
    return {
      evidenceKey: "subagentEnvelopeValidator",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_subagentEnvelopeValidatorReady_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "subagentEnvelopeValidator",
    source: input.subagentEnvelopeValidatorReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "subagent_envelope_validator_receipt_missing",
      ...blockedIf(input.subagentEnvelopeValidatorReady !== true, "validated_subagent_task_envelope_gate_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(
        input.subagentEnvelopeValidatorReady === true,
        "legacy_subagentEnvelopeValidatorReady_boolean_ignored_without_typed_receipt",
      ),
    ]),
  };
}

function agentCliMockRunnerEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.agentCliMockRunner;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasAgentCliMockRunnerEvidence(evidence)) {
    const observations = evidence.observations || {};
    const roadmap = evidence.roadmapEvidence || {};
    const validationErrors = [
      ...(evidence.validation?.errors || []),
      ...(evidence.receipt?.blockedReasons || []),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
    ];
    const noopReady = evidence.runnerKind === "mock_noop"
      || evidence.mockRunnerNoopReady === true
      || roadmap.mockRunnerNoopReady === true;
    const replacementProofReady = evidence.replacementProofReady === true
      || roadmap.replacementProofReady === true
      || evidence.receipt?.replacementProofReady === true
      || evidence.contract?.canReplaceCodexCli === true;
    const providerSubmitObserved = observations.providerSubmitObserved === true
      || roadmap.providerSubmitObserved === true
      || validationErrors.some((error) => /provider[_ ]?submit/i.test(error));
    const freeTextTaskObserved = observations.freeTextTaskObserved === true
      || roadmap.freeTextTaskObserved === true
      || validationErrors.some((error) => /free[_ ]?text/i.test(error));
    const spawnCodexObserved = observations.spawnCodexObserved === true
      || roadmap.spawnCodexObserved === true
      || validationErrors.some((error) => /spawn|codex_spawn/i.test(error));
    const resumeCodexObserved = observations.resumeCodexObserved === true
      || roadmap.resumeCodexObserved === true
      || validationErrors.some((error) => /resume|codex_resume/i.test(error));
    const shellExecutionObserved = observations.shellExecutionObserved === true
      || roadmap.shellExecutionObserved === true
      || validationErrors.some((error) => /shell/i.test(error));
    const credentialReadObserved = observations.credentialReadObserved === true
      || roadmap.credentialReadObserved === true
      || validationErrors.some((error) => /credential.*read|credential_read/i.test(error));
    const credentialWriteObserved = observations.credentialWriteObserved === true
      || roadmap.credentialWriteObserved === true
      || validationErrors.some((error) => /credential.*write|credential_write/i.test(error));
    const fileMutationObserved = observations.fileMutationObserved === true
      || roadmap.fileMutationObserved === true
      || validationErrors.some((error) => /file[_ ]?mutation|writeProject/i.test(error));
    const blockers = uniqueSorted([
      ...blockedIf(!noopReady, "mock_noop_runner_contract_missing"),
      ...blockedIf(!replacementProofReady, "phase_26_replacement_proof_missing"),
      ...blockedIf(evidence.contract?.inputSource !== undefined && evidence.contract.inputSource !== "validated_envelope_only", "mock_runner_validated_envelope_gate_missing"),
      ...blockedIf(evidence.contract?.resultKind !== undefined && evidence.contract.resultKind !== "structured_noop", "mock_runner_structured_noop_result_missing"),
      ...blockedIf(providerSubmitObserved || evidence.contract?.canSubmitProvider === true || evidence.adapterBoundary?.providerSubmitAllowed === true, "mock_runner_attempted_provider_submit"),
      ...blockedIf(freeTextTaskObserved, "mock_runner_free_text_task_observed"),
      ...blockedIf(spawnCodexObserved || evidence.contract?.canSpawnCodex === true || evidence.hardLocks?.noCodexSpawn === false, "mock_runner_spawn_codex_observed"),
      ...blockedIf(resumeCodexObserved || evidence.contract?.canResumeCodex === true || evidence.hardLocks?.noCodexResume === false, "mock_runner_resume_codex_observed"),
      ...blockedIf(shellExecutionObserved || evidence.contract?.canExecuteShell === true || evidence.adapterBoundary?.shellAllowed === true, "mock_runner_shell_execution_observed"),
      ...blockedIf(credentialReadObserved || evidence.contract?.canReadCredentials === true, "mock_runner_credential_read_observed"),
      ...blockedIf(credentialWriteObserved || evidence.contract?.canWriteCredentials === true, "mock_runner_credential_write_observed"),
      ...blockedIf(fileMutationObserved || evidence.contract?.canMutateFiles === true || evidence.adapterBoundary?.fileMutationAllowed === true, "mock_runner_file_mutation_observed"),
      ...blockedIf(evidence.hardLocks?.mockOnly === false, "mock_runner_hard_lock_mock_only_missing"),
      ...blockedIf(evidence.hardLocks?.dryRunOnly === false, "mock_runner_hard_lock_dry_run_missing"),
      ...blockedIf(evidence.hardLocks?.noSpawnCodex === false || evidence.hardLocks?.noCodexSpawn === false, "mock_runner_hard_lock_no_spawn_codex_missing"),
      ...blockedIf(evidence.hardLocks?.noResumeCodex === false || evidence.hardLocks?.noCodexResume === false, "mock_runner_hard_lock_no_resume_codex_missing"),
      ...blockedIf(evidence.hardLocks?.noProviderSubmit === false, "mock_runner_hard_lock_no_provider_submit_missing"),
      ...blockedIf(evidence.hardLocks?.liveSubmitAllowed === true, "mock_runner_hard_lock_live_submit_missing"),
      ...blockedIf(evidence.hardLocks?.noFreeTextTask === false || evidence.hardLocks?.noFreeTextWorker === false, "mock_runner_hard_lock_no_free_text_missing"),
      ...blockedIf(evidence.hardLocks?.validatedEnvelopeRequired === false, "mock_runner_hard_lock_validated_envelope_missing"),
      ...blockedIf(evidence.hardLocks?.structuredResultRequired === false, "mock_runner_hard_lock_structured_result_missing"),
      ...blockedIf(evidence.hardLocks?.noShellExecution === false, "mock_runner_hard_lock_no_shell_missing"),
      ...blockedIf(evidence.hardLocks?.noCredentialRead === false, "mock_runner_hard_lock_no_credential_read_missing"),
      ...blockedIf(evidence.hardLocks?.noCredentialWrite === false, "mock_runner_hard_lock_no_credential_write_missing"),
      ...blockedIf(evidence.hardLocks?.noFileMutation === false, "mock_runner_hard_lock_no_file_mutation_missing"),
      ...validationErrors,
    ]);

    return {
      evidenceKey: "agentCliMockRunner",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  if (
    legacyAllowed &&
    input.mockRunnerNoopReady === true &&
    input.replacementProofFromMockRunner === true &&
    input.mockRunnerProviderSubmitObserved !== true
  ) {
    return {
      evidenceKey: "agentCliMockRunner",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_mock_runner_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "agentCliMockRunner",
    source: input.mockRunnerNoopReady === undefined && input.replacementProofFromMockRunner === undefined
      ? "missing"
      : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "agent_cli_mock_runner_typed_evidence_missing",
      ...blockedIf(input.mockRunnerNoopReady !== true, "mock_noop_runner_contract_missing"),
      ...blockedIf(input.replacementProofFromMockRunner !== true, "phase_26_replacement_proof_missing"),
      ...blockedIf(Boolean(input.mockRunnerProviderSubmitObserved), "mock_runner_attempted_provider_submit"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(
        input.mockRunnerNoopReady === true || input.replacementProofFromMockRunner === true,
        "legacy_mock_runner_booleans_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function codexCliAdapterEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.codexCliAdapter || input.evidence?.codexCliAdapterSpike;
  const roadmap = evidence?.roadmapEvidence || {};
  const observations = evidence?.observations || {};

  if (hasCodexCliAdapterEvidence(evidence)) {
    const validationErrors = [
      ...(evidence.validation?.errors || []),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
    ];
    const adapterContractReady = evidence.adapterContractReady === true
      || roadmap.adapterContractReady === true
      || evidence.readiness === "ready_for_adapter_spike"
      || evidence.readiness === "ready"
      || readyStatus(evidence.status);
    const phase26ReplacementProofReady = evidence.phase26ReplacementProofReady === true
      || roadmap.phase26ReplacementProofReady === true
      || evidence.replacementProof?.replacementProofReady === true;
    const validatedEnvelopeOnly = evidence.contract?.inputSource === "validated_envelope_only"
      || evidence.adapterBoundary?.inputContract === "validated_subagent_task_envelope_only"
      || evidence.adapterBoundary?.inputContract === "validated_envelope_only"
      || evidence.inputContract?.source === "validated_envelope_only"
      || roadmap.inputSourceValidatedEnvelopeOnly === true;
    const structuredResult = evidence.contract?.resultKind === "structured_result"
      || evidence.contract?.resultKind === "structured_subagent_result_shape_only"
      || evidence.adapterBoundary?.outputContract === "structured_subagent_result_shape_only"
      || evidence.adapterBoundary?.outputContract === "structured_result"
      || evidence.resultContract?.structured === true
      || roadmap.structuredResultRequired === true;
    const hardLocksPinned = evidence.validation?.hardLocksPinned !== false
      && roadmap.hardLocksPinned !== false
      && evidence.hardLocks?.contractOnly !== false
      && evidence.hardLocks?.dryRunOnly !== false
      && evidence.hardLocks?.validatedEnvelopeRequired !== false
      && evidence.hardLocks?.structuredResultRequired !== false
      && evidence.hardLocks?.noActualSpawn !== false
      && evidence.hardLocks?.noActualResume !== false
      && evidence.hardLocks?.actualSpawnAllowed !== true
      && evidence.hardLocks?.actualResumeAllowed !== true
      && evidence.hardLocks?.noProviderSubmit !== false
      && evidence.hardLocks?.liveSubmitAllowed !== true
      && evidence.hardLocks?.noCredentialRead !== false
      && evidence.hardLocks?.noCredentialWrite !== false
      && evidence.hardLocks?.noCredentials !== false
      && evidence.hardLocks?.noArbitraryShell !== false
      && evidence.hardLocks?.noShellExecution !== false
      && evidence.hardLocks?.noFileMutation !== false
      && evidence.hardLocks?.noFreeTextWorker !== false
      && evidence.hardLocks?.noFreeTextTask !== false;
    const providerSubmitObserved = observations.providerSubmitObserved === true
      || roadmap.providerSubmitObserved === true
      || evidence.contract?.providerSubmitAllowed === true
      || evidence.adapterBoundary?.providerSubmitAllowed === true
      || evidence.executionPolicy?.providerSubmitAllowed === true
      || roadmap.providerSubmitBlocked === false
      || validationErrors.some((error) => /provider[_ ]?submit|live[_ ]?submit/i.test(error));
    const credentialObserved = observations.credentialReadObserved === true
      || observations.credentialWriteObserved === true
      || roadmap.credentialReadObserved === true
      || roadmap.credentialWriteObserved === true
      || evidence.contract?.credentialAccessAllowed === true
      || evidence.adapterBoundary?.credentialReadAllowed === true
      || evidence.adapterBoundary?.credentialWriteAllowed === true
      || evidence.adapterBoundary?.credentialAccessAllowed === true
      || evidence.executionPolicy?.credentialAccessAllowed === true
      || roadmap.credentialBlocked === false
      || validationErrors.some((error) => /credential/i.test(error));
    const shellObserved = observations.shellExecutionObserved === true
      || roadmap.shellExecutionObserved === true
      || evidence.contract?.arbitraryShellAllowed === true
      || evidence.contract?.shellAllowed === true
      || evidence.adapterBoundary?.shellAllowed === true
      || evidence.adapterBoundary?.arbitraryShellAllowed === true
      || evidence.executionPolicy?.arbitraryShellAllowed === true
      || roadmap.arbitraryShellBlocked === false
      || validationErrors.some((error) => /shell/i.test(error));
    const fileMutationObserved = observations.fileMutationObserved === true
      || roadmap.fileMutationObserved === true
      || evidence.contract?.fileMutationAllowed === true
      || evidence.adapterBoundary?.fileMutationAllowed === true
      || evidence.executionPolicy?.fileMutationAllowed === true
      || roadmap.fileMutationBlocked === false
      || validationErrors.some((error) => /file[_ ]?mutation|write_file|writeProject/i.test(error));
    const freeTextObserved = observations.freeTextTaskObserved === true
      || observations.freeTextWorkerObserved === true
      || roadmap.freeTextTaskObserved === true
      || roadmap.freeTextWorkerObserved === true
      || evidence.contract?.freeTextAllowed === true
      || evidence.adapterBoundary?.freeTextTaskAllowed === true
      || evidence.adapterBoundary?.freeTextWorkerAllowed === true
      || evidence.executionPolicy?.freeTextTaskAllowed === true
      || evidence.resultContract?.freeTextAccepted === true
      || roadmap.freeTextBlocked === false
      || validationErrors.some((error) => /free[_ ]?text/i.test(error));
    const actualSpawnResumeObserved = observations.actualSpawnObserved === true
      || observations.actualResumeObserved === true
      || observations.spawnCodexObserved === true
      || observations.resumeCodexObserved === true
      || roadmap.actualSpawnObserved === true
      || roadmap.actualResumeObserved === true
      || evidence.contract?.actualSpawnAllowed === true
      || evidence.contract?.actualResumeAllowed === true
      || evidence.contract?.spawnResumeMode === "actual_spawn_resume"
      || evidence.adapterBoundary?.actualSpawnAllowed === true
      || evidence.adapterBoundary?.actualResumeAllowed === true
      || evidence.adapterBoundary?.spawnResumeAvailable === true
      || evidence.executionPolicy?.actualSpawnAllowed === true
      || evidence.executionPolicy?.actualResumeAllowed === true
      || roadmap.actualSpawnResumeUnavailable === false
      || validationErrors.some((error) => /actual[_ ]?spawn|actual[_ ]?resume|codex[_ ]?spawn|codex[_ ]?resume/i.test(error));
    const unstructuredResultObserved = observations.unstructuredResultObserved === true
      || roadmap.unstructuredResultObserved === true
      || evidence.resultContract?.structured === false
      || evidence.resultContract?.expectedResultSchema !== undefined && evidence.resultContract.expectedResultSchema !== "subagent_result_v1";
    const blockers = uniqueSorted([
      ...blockedIf(!adapterContractReady, "codex_cli_adapter_contract_missing"),
      ...blockedIf(!phase26ReplacementProofReady, "phase_26_replacement_proof_missing"),
      ...blockedIf(!validatedEnvelopeOnly, "codex_cli_adapter_validated_envelope_only_missing"),
      ...blockedIf(!structuredResult, "codex_cli_adapter_structured_result_contract_missing"),
      ...blockedIf(!hardLocksPinned, "codex_cli_adapter_hard_locks_not_pinned"),
      ...blockedIf(providerSubmitObserved, "phase_29_provider_submit_not_blocked"),
      ...blockedIf(credentialObserved, "phase_29_credential_access_not_blocked"),
      ...blockedIf(shellObserved, "phase_29_arbitrary_shell_not_blocked"),
      ...blockedIf(fileMutationObserved, "phase_29_file_mutation_not_blocked"),
      ...blockedIf(freeTextObserved, "phase_29_free_text_task_not_blocked"),
      ...blockedIf(actualSpawnResumeObserved, "phase_29_actual_spawn_resume_not_allowed"),
      ...blockedIf(unstructuredResultObserved, "phase_29_structured_result_missing"),
      ...validationErrors,
    ]);

    return {
      evidenceKey: "codexCliAdapter",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...(evidence.validation?.warnings || [])]),
    };
  }

  return {
    evidenceKey: "codexCliAdapter",
    source: input.codexCliAdapterDryRunReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "codex_cli_adapter_typed_evidence_missing",
      ...blockedIf(input.codexCliAdapterDryRunReady !== true, "codex_cli_adapter_dry_run_contract_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(input.codexCliAdapterDryRunReady === true, "legacy_codexCliAdapterDryRunReady_boolean_ignored_without_typed_evidence"),
    ]),
  };
}

function isAllowlistedExportWorkerPath(pathValue: string | undefined): boolean {
  const normalized = String(pathValue || "").replace(/\\/g, "/");
  return Boolean(normalized)
    && !/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(normalized)
    && !normalized.split("/").includes("..")
    && /^(?:exports(?:\/|$)|reports\/exports(?:\/|$))/.test(normalized);
}

function exportWorkerEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.exportWorker;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasExportWorkerEvidence(evidence)) {
    const observations = evidence.observations || {};
    const roadmap = evidence.roadmapEvidence || {};
    const validationErrors = [
      ...(evidence.validation?.errors || []),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
      ...(evidence.summary?.blockedReasons || []),
    ];
    const entries: Array<{
      path?: string;
      pathOrigin?: string;
      projectRootRelative?: boolean;
      canWrite?: boolean;
    }> = evidence.ioContract?.entries || evidence.entries || [];
    const scopeReady = evidence.scope === "export_project_io_contract"
      || evidence.ioContract?.scope === "export_project_io_contract"
      || roadmap.scopeReady === true;
    const pathModeReady = evidence.ioContract?.pathMode === undefined
      || evidence.ioContract.pathMode === "project_root_relative";
    const entriesAllowlisted = entries.length === 0
      ? evidence.validation?.pathsAllowlisted === true || roadmap.pathsAllowlisted === true
      : entries.every((entry) =>
        (entry.pathOrigin === "project_root_relative" || entry.projectRootRelative === true) &&
        entry.canWrite !== false &&
        isAllowlistedExportWorkerPath(entry.path),
      );
    const pathsAllowlisted = (evidence.validation?.pathsAllowlisted !== false)
      && (roadmap.pathsAllowlisted !== false)
      && pathModeReady
      && entriesAllowlisted
      && evidence.hardLocks?.pathsAllowlisted !== false
      && evidence.hardLocks?.pathsProjectRootRelative !== false;
    const hardLocksPinned = evidence.validation?.hardLocksPinned !== false
      && roadmap.hardLocksPinned !== false
      && evidence.hardLocks?.projectRootRelativeOnly !== false
      && evidence.hardLocks?.exportScopeOnly !== false
      && evidence.hardLocks?.noAbsolutePath !== false
      && evidence.hardLocks?.noParentTraversal !== false
      && evidence.hardLocks?.noMove !== false
      && evidence.hardLocks?.noUserFileOverwriteOutsideExport !== false
      && evidence.hardLocks?.exportProjectIoContractOnly !== false
      && evidence.hardLocks?.defaultPlanOnly !== false
      && evidence.hardLocks?.noProviderSubmit !== false
      && evidence.hardLocks?.noCredentialRead !== false
      && evidence.hardLocks?.noCredentialWrite !== false
      && evidence.hardLocks?.noArbitraryShell !== false
      && evidence.hardLocks?.noMediaRender !== false
      && evidence.hardLocks?.noCopySourceFiles !== false
      && evidence.hardLocks?.noMoveSourceFiles !== false
      && evidence.hardLocks?.noDelete !== false
      && evidence.hardLocks?.noOutsideProjectRoot !== false
      && evidence.hardLocks?.noNleProjectGeneration !== false;
    const providerSubmitObserved = observations.providerSubmitObserved === true
      || roadmap.providerSubmitObserved === true
      || evidence.adapterBoundary?.providerSubmitAllowed === true
      || evidence.summary?.providerSubmitAllowed === true
      || validationErrors.some((error) => /provider[_ ]?submit/i.test(error));
    const credentialReadObserved = observations.credentialReadObserved === true
      || roadmap.credentialReadObserved === true
      || evidence.adapterBoundary?.credentialReadAllowed === true
      || validationErrors.some((error) => /credential.*read|credential_read/i.test(error));
    const credentialWriteObserved = observations.credentialWriteObserved === true
      || roadmap.credentialWriteObserved === true
      || evidence.adapterBoundary?.credentialWriteAllowed === true
      || validationErrors.some((error) => /credential.*write|credential_write/i.test(error));
    const shellExecutionObserved = observations.shellExecutionObserved === true
      || roadmap.shellExecutionObserved === true
      || evidence.adapterBoundary?.shellAllowed === true
      || evidence.summary?.arbitraryShellAllowed === true
      || validationErrors.some((error) => /shell/i.test(error));
    const mediaRenderObserved = observations.mediaRenderObserved === true
      || roadmap.mediaRenderObserved === true
      || evidence.adapterBoundary?.mediaRenderAllowed === true
      || evidence.summary?.mediaRenderAllowed === true
      || validationErrors.some((error) => /media[_ ]?render|render_media/i.test(error));
    const copyObserved = observations.copyObserved === true
      || evidence.adapterBoundary?.copySourceFilesAllowed === true
      || validationErrors.some((error) => /\bcopy\b|copy_source/i.test(error));
    const moveObserved = observations.moveObserved === true
      || roadmap.moveObserved === true
      || evidence.adapterBoundary?.moveSourceFilesAllowed === true
      || validationErrors.some((error) => /\bmove\b|move_source/i.test(error));
    const deleteObserved = observations.deleteObserved === true
      || roadmap.deleteObserved === true
      || evidence.adapterBoundary?.deleteAllowed === true
      || validationErrors.some((error) => /\bdelete\b|unlink|remove_file/i.test(error));
    const outsideProjectRootObserved = observations.outsideProjectRootObserved === true
      || roadmap.outsideProjectRootObserved === true
      || evidence.adapterBoundary?.outsideProjectRootAllowed === true
      || validationErrors.some((error) => /outside[_ ]?project|outside[_ ]?root/i.test(error));
    const realAdapterExecutionObserved = evidence.executionMode !== undefined && evidence.executionMode !== "plan_only"
      || evidence.canExecute === true
      || evidence.adapterBoundary?.realAdapterExecutionAllowed === true
      || evidence.summary?.canExecuteAdapterNow === true;
    const blockers = uniqueSorted([
      ...blockedIf(!scopeReady, "explicit_export_project_io_scope_missing"),
      ...blockedIf(!pathsAllowlisted, "export_worker_paths_not_allowlisted"),
      ...blockedIf(!hardLocksPinned, "export_worker_hard_locks_not_pinned"),
      ...blockedIf(realAdapterExecutionObserved, "export_worker_real_adapter_execution_enabled"),
      ...blockedIf(providerSubmitObserved, "export_worker_attempted_provider_submit"),
      ...blockedIf(credentialReadObserved, "export_worker_credential_read_observed"),
      ...blockedIf(credentialWriteObserved, "export_worker_credential_write_observed"),
      ...blockedIf(shellExecutionObserved, "export_worker_shell_execution_observed"),
      ...blockedIf(mediaRenderObserved, "export_worker_media_render_observed"),
      ...blockedIf(copyObserved, "export_worker_copy_observed"),
      ...blockedIf(moveObserved, "export_worker_move_observed"),
      ...blockedIf(deleteObserved, "export_worker_delete_observed"),
      ...blockedIf(outsideProjectRootObserved, "export_worker_outside_project_root_observed"),
      ...validationErrors,
    ]);

    return {
      evidenceKey: "exportWorker",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...(evidence.validation?.warnings || [])]),
    };
  }

  if (legacyAllowed && input.exportWorkerIoScopeReady === true) {
    return {
      evidenceKey: "exportWorker",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_exportWorkerIoScopeReady_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "exportWorker",
    source: input.exportWorkerIoScopeReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "export_worker_typed_evidence_missing",
      ...blockedIf(input.exportWorkerIoScopeReady !== true, "explicit_export_project_io_scope_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(input.exportWorkerIoScopeReady === true, "legacy_exportWorkerIoScopeReady_boolean_ignored_without_typed_evidence"),
    ]),
  };
}

function voiceAudioSettingsEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.voiceAudioSettings;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasVoiceAudioSettingsEvidence(evidence)) {
    const observations = evidence.observations || {};
    const roadmap = evidence.roadmapEvidence || {};
    const videoProviderPolicy =
      evidence.videoProviderPolicy ||
      evidence.videoProviderAudioPolicy ||
      evidence.audioPlanning?.videoProviderPolicy ||
      {};
    const validationErrors = [
      ...(evidence.validation?.errors || []),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
    ];
    const projectFactsScopeReady = evidence.scope === "voice_audio_project_facts"
      || evidence.purpose === "voice_audio_project_facts"
      || roadmap.voiceAudioSettingsReady === true
      || readyStatus(evidence.status)
      || evidence.readiness === "ready";
    const noBgmForVideoProvider = evidence.noBgmForVideoProvider
      ?? videoProviderPolicy.noBgmForVideoProvider
      ?? evidence.summary?.noBgmForVideoProvider
      ?? roadmap.noBgmForVideoProvider;
    const bgmIncludedInVideoPrompt = evidence.bgmIncludedInVideoPrompt
      ?? videoProviderPolicy.bgmIncludedInVideoPrompt
      ?? evidence.summary?.bgmIncludedInVideoPrompt
      ?? observations.bgmIncludedInVideoPrompt
      ?? roadmap.bgmIncludedInVideoPrompt;
    const hardLocks = evidence.hardLocks;
    const hardLocksPinned = hardLocks
      ? evidence.settingsOnly !== false
        && evidence.providerSubmissionForbidden !== false
        && evidence.liveSubmitAllowed !== true
        && evidence.validation?.hardLocksPinned !== false
        && roadmap.hardLocksPinned !== false
        && hardLocks.settingsOnly !== false
        && hardLocks.projectFactsOnly !== false
        && hardLocks.voiceAudioProjectFactsOnly !== false
        && hardLocks.dryRunOnly !== false
        && hardLocks.noProviderSubmit !== false
        && hardLocks.providerSubmissionForbidden !== false
        && hardLocks.liveSubmitAllowed !== true
        && hardLocks.noCredentialRead !== false
        && hardLocks.noCredentialWrite !== false
        && hardLocks.noSecretStorage !== false
        && hardLocks.noArbitraryShell !== false
        && hardLocks.noShellExecution !== false
        && hardLocks.noFileMutation !== false
        && hardLocks.noSampleAudioCopy !== false
        && hardLocks.noAudioSubmit !== false
        && hardLocks.noTtsSubmit !== false
        && hardLocks.noMusicSubmit !== false
        && hardLocks.noBgmForVideoProvider !== false
        && hardLocks.noBgmInVideoProviderPrompt !== false
        && hardLocks.noBgmInVideoProvider !== false
        && hardLocks.noVideoProviderBgmPrompt !== false
        && hardLocks.bgmIncludedInVideoPrompt !== true
      : false;
    const providerSubmitObserved = observations.providerSubmitObserved === true
      || roadmap.providerSubmitObserved === true
      || evidence.adapterBoundary?.providerSubmitAllowed === true
      || evidence.summary?.providerSubmitAllowed === true
      || evidence.providerSubmissionForbidden === false
      || validationErrors.some((error) => /provider[_ ]?submit/i.test(error));
    const credentialReadObserved = observations.credentialReadObserved === true
      || roadmap.credentialReadObserved === true
      || evidence.adapterBoundary?.credentialReadAllowed === true
      || evidence.summary?.credentialAccessAllowed === true
      || validationErrors.some((error) => /credential.*read|credential_read/i.test(error));
    const credentialWriteObserved = observations.credentialWriteObserved === true
      || roadmap.credentialWriteObserved === true
      || evidence.adapterBoundary?.credentialWriteAllowed === true
      || evidence.summary?.credentialAccessAllowed === true
      || validationErrors.some((error) => /credential.*write|credential_write/i.test(error));
    const shellExecutionObserved = observations.shellExecutionObserved === true
      || roadmap.shellExecutionObserved === true
      || evidence.adapterBoundary?.shellAllowed === true
      || evidence.adapterBoundary?.arbitraryShellAllowed === true
      || evidence.summary?.arbitraryShellAllowed === true
      || validationErrors.some((error) => /shell/i.test(error));
    const fileMutationObserved = observations.fileMutationObserved === true
      || roadmap.fileMutationObserved === true
      || evidence.adapterBoundary?.fileMutationAllowed === true
      || evidence.summary?.fileMutationAllowed === true
      || validationErrors.some((error) => /file[_ ]?mutation|writeProject/i.test(error));
    const sampleCopyObserved = observations.sampleCopyObserved === true
      || roadmap.sampleCopyObserved === true
      || evidence.adapterBoundary?.sampleCopyAllowed === true
      || evidence.adapterBoundary?.copySampleAudioAllowed === true
      || evidence.summary?.sampleCopyAllowed === true
      || validationErrors.some((error) => /sample.*copy|copy.*sample/i.test(error));
    const audioSubmitObserved = observations.audioSubmitObserved === true
      || observations.ttsSubmitObserved === true
      || roadmap.audioSubmitObserved === true
      || roadmap.ttsSubmitObserved === true
      || evidence.adapterBoundary?.audioSubmitAllowed === true
      || evidence.adapterBoundary?.ttsSubmitAllowed === true
      || evidence.summary?.audioSubmitAllowed === true
      || evidence.summary?.ttsSubmitAllowed === true
      || validationErrors.some((error) => /audio.*submit|tts.*submit/i.test(error));
    const musicSubmitObserved = observations.musicSubmitObserved === true
      || roadmap.musicSubmitObserved === true
      || evidence.adapterBoundary?.musicSubmitAllowed === true
      || evidence.summary?.musicSubmitAllowed === true
      || validationErrors.some((error) => /music.*submit|bgm.*submit/i.test(error));
    const liveSubmitObserved = observations.liveSubmitObserved === true
      || roadmap.liveSubmitObserved === true
      || evidence.adapterBoundary?.liveSubmitAllowed === true
      || evidence.summary?.liveSubmitAllowed === true
      || evidence.liveSubmitAllowed === true
      || evidence.hardLocks?.liveSubmitAllowed === true
      || validationErrors.some((error) => /live.*submit/i.test(error));
    const blockers = uniqueSorted([
      ...blockedIf(!projectFactsScopeReady, "voice_audio_settings_project_facts_scope_missing"),
      ...blockedIf(noBgmForVideoProvider !== true, "voice_audio_settings_no_bgm_video_policy_missing"),
      ...blockedIf(bgmIncludedInVideoPrompt !== false, "voice_audio_settings_bgm_in_video_prompt_present"),
      ...blockedIf(!hardLocksPinned, "voice_audio_settings_hard_locks_not_pinned"),
      ...blockedIf(providerSubmitObserved, "voice_audio_settings_attempted_provider_submit"),
      ...blockedIf(credentialReadObserved, "voice_audio_settings_credential_read_observed"),
      ...blockedIf(credentialWriteObserved, "voice_audio_settings_credential_write_observed"),
      ...blockedIf(shellExecutionObserved, "voice_audio_settings_shell_execution_observed"),
      ...blockedIf(fileMutationObserved, "voice_audio_settings_file_mutation_observed"),
      ...blockedIf(sampleCopyObserved, "voice_audio_settings_sample_copy_observed"),
      ...blockedIf(audioSubmitObserved, "voice_audio_settings_audio_submit_observed"),
      ...blockedIf(musicSubmitObserved, "voice_audio_settings_music_submit_observed"),
      ...blockedIf(liveSubmitObserved, "voice_audio_settings_live_submit_observed"),
      ...validationErrors,
    ]);

    return {
      evidenceKey: "voiceAudioSettings",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...(evidence.validation?.warnings || [])]),
    };
  }

  if (legacyAllowed && input.voiceAudioSettingsReady === true) {
    return {
      evidenceKey: "voiceAudioSettings",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_voiceAudioSettingsReady_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "voiceAudioSettings",
    source: input.voiceAudioSettingsReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "voice_audio_settings_typed_evidence_missing",
      ...blockedIf(input.voiceAudioSettingsReady !== true, "voice_audio_settings_contract_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(
        input.voiceAudioSettingsReady === true,
        "legacy_voiceAudioSettingsReady_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function providerLiveGatePhase30Evidence(receipt: PhaseRoadmapProviderLiveGateReceipt): PhaseRoadmapProviderLiveGatePhase30Evidence {
  return {
    ...(receipt.roadmapEvidence || {}),
    ...(receipt.phase30Evidence || {}),
  };
}

function providerLiveGateChecks(receipt: PhaseRoadmapProviderLiveGateReceipt): Array<{
  checkId?: string;
  passed?: boolean;
  blocker?: string;
  warning?: string;
}> {
  return (receipt.items || []).flatMap((item) => item.checks || []);
}

function providerLiveGateItemBlockers(receipt: PhaseRoadmapProviderLiveGateReceipt): string[] {
  return (receipt.items || []).flatMap((item) => item.blockers || []);
}

function providerLiveGateHasPassedCheck(receipt: PhaseRoadmapProviderLiveGateReceipt, checkId: string): boolean {
  return providerLiveGateChecks(receipt).some((check) => check.checkId === checkId && check.passed === true);
}

function providerLiveGateHasFailedCheck(receipt: PhaseRoadmapProviderLiveGateReceipt, checkId: string): boolean {
  return providerLiveGateChecks(receipt).some((check) => check.checkId === checkId && check.passed === false);
}

function providerLiveGateHasForbiddenAction(receipt: PhaseRoadmapProviderLiveGateReceipt, action: string): boolean {
  return (receipt.forbiddenActions || []).includes(action);
}

function providerLiveGateConfirmationTokenPresent(receipt: PhaseRoadmapProviderLiveGateReceipt): boolean | undefined {
  const evidence = providerLiveGatePhase30Evidence(receipt);
  if (evidence.confirmationTokenPlaceholderPresent !== undefined) return evidence.confirmationTokenPlaceholderPresent;
  if (receipt.confirmationTokenPlaceholderPresent !== undefined) return receipt.confirmationTokenPlaceholderPresent;
  if ((receipt.items || []).length === 0) return undefined;
  return providerLiveGateHasPassedCheck(receipt, "user_confirmation_token_placeholder")
    || (receipt.items || []).some((item) =>
      item.status === "ready_for_confirmation"
      && item.canRequestUserConfirmation === true
      && Boolean(item.confirmationTokenId),
    );
}

function providerLiveGatePacketComplete(receipt: PhaseRoadmapProviderLiveGateReceipt): boolean | undefined {
  const evidence = providerLiveGatePhase30Evidence(receipt);
  if (evidence.providerPacketComplete !== undefined) return evidence.providerPacketComplete;
  if (receipt.providerPacketComplete !== undefined) return receipt.providerPacketComplete;
  if ((receipt.items || []).length === 0) return undefined;
  const requiredChecks = [
    "adapter_contract_valid",
    "provider_capability_present",
    "envelope_valid",
    "asset_readiness_ready",
    "pair_qa_pass",
    "image2_adapter_request_valid",
  ];
  const hasReadyItem = (receipt.summary?.readyForConfirmation ?? 0) > 0
    || (receipt.items || []).some((item) => item.status === "ready_for_confirmation");
  const hasBlockedItems = (receipt.summary?.blocked ?? 0) > 0
    || (receipt.items || []).some((item) => item.status === "blocked");
  return hasReadyItem && !hasBlockedItems && requiredChecks.every((checkId) => providerLiveGateHasPassedCheck(receipt, checkId));
}

function providerLiveGateWatcherClosedLoop(receipt: PhaseRoadmapProviderLiveGateReceipt): boolean | undefined {
  const evidence = providerLiveGatePhase30Evidence(receipt);
  return evidence.watcherManifestQaClosedLoop;
}

function providerLiveGateForbiddenModesAbsent(receipt: PhaseRoadmapProviderLiveGateReceipt): boolean | undefined {
  const evidence = providerLiveGatePhase30Evidence(receipt);
  if (evidence.forbiddenProviderModesAbsent !== undefined) return evidence.forbiddenProviderModesAbsent;
  if (receipt.forbiddenProviderModesAbsent !== undefined) return receipt.forbiddenProviderModesAbsent;
  const hasModeEvidence = receipt.hardLocks !== undefined || receipt.forbiddenActions !== undefined || (receipt.items || []).length > 0;
  if (!hasModeEvidence) return undefined;
  const modeLocksPinned = receipt.hardLocks?.fastModelForbidden === true
    && receipt.hardLocks?.vipChannelForbidden === true
    && receipt.hardLocks?.textToVideoMainPathForbidden === true
    && receipt.hardLocks?.bgmInVideoPromptForbidden === true;
  const modeActionsForbidden = [
    "fast_model",
    "vip_channel",
    "text_to_video_main_path",
    "bgm_in_video_prompt",
  ].every((action) => providerLiveGateHasForbiddenAction(receipt, action));
  const modeChecksPassed = [
    "no_fast_model",
    "no_vip_channel",
    "no_text_to_video_main_path",
    "no_bgm_in_video_prompt",
  ].every((checkId) => providerLiveGateHasPassedCheck(receipt, checkId) || !providerLiveGateHasFailedCheck(receipt, checkId));
  return modeLocksPinned && (modeActionsForbidden || (receipt.forbiddenActions === undefined && (receipt.items || []).length > 0)) && modeChecksPassed;
}

function providerLiveGateSafetyBlockers(receipt: PhaseRoadmapProviderLiveGateReceipt): string[] {
  const evidence = providerLiveGatePhase30Evidence(receipt);
  const itemBlockers = providerLiveGateItemBlockers(receipt);
  const modeIssueText = [...itemBlockers, ...(receipt.blockers || [])].join("\n");
  const providerSubmitAllowed = evidence.providerSubmitAllowed ?? receipt.summary?.providerSubmitAllowed;
  const hardLocksPinned = evidence.hardLocksPinned !== false
    && receipt.hardLocks?.noProviderSubmit !== false
    && receipt.hardLocks?.providerSubmissionForbidden !== false
    && receipt.hardLocks?.liveSubmitAllowed !== true
    && receipt.hardLocks?.credentialStorage !== true
    && receipt.hardLocks?.noCredentialRead !== false
    && receipt.hardLocks?.noCredentialWrite !== false
    && receipt.hardLocks?.noApiKeyCreation !== false
    && receipt.hardLocks?.noArbitraryProviderCommand !== false
    && receipt.hardLocks?.fastModelForbidden !== false
    && receipt.hardLocks?.vipChannelForbidden !== false
    && receipt.hardLocks?.textToVideoMainPathForbidden !== false
    && receipt.hardLocks?.bgmInVideoPromptForbidden !== false
    && (receipt.items || []).every((item) =>
      item.canSubmitProvider !== true
      && item.providerSubmissionForbidden !== false
      && item.liveSubmitAllowed !== true
      && item.credentialStorage !== true
      && item.noCredentialRead !== false
      && item.noCredentialWrite !== false,
    );
  const fastPromptPresent = evidence.fastModelPromptPresent === true
    || providerLiveGateHasFailedCheck(receipt, "no_fast_model")
    || /\bfast[_ -]?model\b/i.test(modeIssueText)
    || (receipt.items || []).some((item) => /fast/i.test(String(item.requiredMode || "")));
  const vipPromptPresent = evidence.vipPromptPresent === true
    || providerLiveGateHasFailedCheck(receipt, "no_vip_channel")
    || /\bvip[_ -]?channel\b/i.test(modeIssueText);
  const textToVideoPromptPresent = evidence.textToVideoPromptPresent === true
    || providerLiveGateHasFailedCheck(receipt, "no_text_to_video_main_path")
    || /text[_ -]?to[_ -]?video|text2video/i.test(modeIssueText)
    || (receipt.items || []).some((item) => /text[_ -]?to[_ -]?video|text2video/i.test(`${item.requiredMode || ""} ${item.slot || ""}`));
  const bgmPromptPresent = evidence.bgmPromptPresent === true
    || providerLiveGateHasFailedCheck(receipt, "no_bgm_in_video_prompt")
    || /\bbgm\b|background music/i.test(modeIssueText);

  return uniqueSorted([
    ...blockedIf(providerSubmitAllowed !== undefined && providerSubmitAllowed !== 0 && providerSubmitAllowed !== false, "provider_live_gate_allows_provider_submit"),
    ...blockedIf(evidence.liveSubmitAllowed === true || receipt.summary?.liveSubmitAllowed === true, "provider_live_gate_allows_live_submit"),
    ...blockedIf(evidence.credentialStorage === true || receipt.summary?.credentialStorage === true, "provider_live_gate_allows_credential_storage"),
    ...blockedIf(!hardLocksPinned, "provider_live_gate_hard_lock_drift"),
    ...blockedIf(receipt.hardLocks?.noProviderSubmit === false, "provider_live_gate_no_provider_submit_lock_missing"),
    ...blockedIf(receipt.hardLocks?.providerSubmissionForbidden === false, "provider_live_gate_submission_forbidden_lock_missing"),
    ...blockedIf(receipt.hardLocks?.liveSubmitAllowed === true, "provider_live_gate_live_submit_lock_missing"),
    ...blockedIf(receipt.hardLocks?.credentialStorage === true, "provider_live_gate_credential_storage_lock_missing"),
    ...blockedIf(receipt.hardLocks?.noCredentialRead === false, "provider_live_gate_no_credential_read_lock_missing"),
    ...blockedIf(receipt.hardLocks?.noCredentialWrite === false, "provider_live_gate_no_credential_write_lock_missing"),
    ...blockedIf(receipt.hardLocks?.fastModelForbidden === false, "provider_live_gate_fast_model_lock_missing"),
    ...blockedIf(receipt.hardLocks?.vipChannelForbidden === false, "provider_live_gate_vip_channel_lock_missing"),
    ...blockedIf(receipt.hardLocks?.textToVideoMainPathForbidden === false, "provider_live_gate_text_to_video_lock_missing"),
    ...blockedIf(receipt.hardLocks?.bgmInVideoPromptForbidden === false, "provider_live_gate_bgm_prompt_lock_missing"),
    ...blockedIf(fastPromptPresent, "provider_live_gate_fast_model_prompt_present"),
    ...blockedIf(vipPromptPresent, "provider_live_gate_vip_channel_prompt_present"),
    ...blockedIf(textToVideoPromptPresent, "provider_live_gate_text_to_video_prompt_present"),
    ...blockedIf(bgmPromptPresent, "provider_live_gate_bgm_prompt_present"),
    ...itemBlockers,
    ...(receipt.blockers || []),
  ]);
}

function providerConfirmationEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const receipt = input.evidence?.providerLiveGate;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasProviderLiveGateReceipt(receipt)) {
    const confirmationTokenPresent = providerLiveGateConfirmationTokenPresent(receipt);
    const blockers = uniqueSorted([
      ...providerLiveGateSafetyBlockers(receipt),
      ...blockedIf(confirmationTokenPresent !== true, "user_confirmation_token_placeholder_missing"),
    ]);

    return {
      evidenceKey: "providerConfirmationTokenPlaceholder",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  if (legacyAllowed && input.providerConfirmationTokenPlaceholderPresent === true) {
    return {
      evidenceKey: "providerConfirmationTokenPlaceholder",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_providerConfirmationTokenPlaceholderPresent_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "providerConfirmationTokenPlaceholder",
    source: input.providerConfirmationTokenPlaceholderPresent === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "provider_live_gate_typed_evidence_missing",
      ...blockedIf(input.providerConfirmationTokenPlaceholderPresent !== true, "user_confirmation_token_placeholder_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(
        input.providerConfirmationTokenPlaceholderPresent === true,
        "legacy_providerConfirmationTokenPlaceholderPresent_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function providerPacketEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const receipt = input.evidence?.providerLiveGate;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasProviderLiveGateReceipt(receipt)) {
    const packetComplete = providerLiveGatePacketComplete(receipt);
    const blockers = uniqueSorted([
      ...providerLiveGateSafetyBlockers(receipt),
      ...blockedIf(packetComplete !== true, "provider_enablement_packet_incomplete"),
    ]);

    return {
      evidenceKey: "providerEnablementPacket",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  if (legacyAllowed && input.providerPacketComplete === true) {
    return {
      evidenceKey: "providerEnablementPacket",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_providerPacketComplete_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "providerEnablementPacket",
    source: input.providerPacketComplete === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "provider_live_gate_typed_evidence_missing",
      ...blockedIf(input.providerPacketComplete !== true, "provider_enablement_packet_incomplete"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(input.providerPacketComplete === true, "legacy_providerPacketComplete_boolean_ignored_without_typed_evidence"),
    ]),
  };
}

function watcherClosedLoopEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const providerReceipt = input.evidence?.providerLiveGate;
  if (hasProviderLiveGateReceipt(providerReceipt)) {
    const providerWatcherClosedLoop = providerLiveGateWatcherClosedLoop(providerReceipt);
    if (providerWatcherClosedLoop !== undefined) {
      const blockers = uniqueSorted([
        ...providerLiveGateSafetyBlockers(providerReceipt),
        ...blockedIf(providerWatcherClosedLoop !== true, "watcher_manifest_qa_closed_loop_missing"),
      ]);

      return {
        evidenceKey: "watcherManifestQaClosedLoop",
        source: "typed_evidence",
        ready: blockers.length === 0,
        blockers,
        warnings: uniqueSorted(providerReceipt.warnings || []),
      };
    }
  }

  const receipt = input.evidence?.watcherManifestQaClosedLoop;

  if (hasClosedLoopReceipt(receipt)) {
    const closedLoop = receipt.closedLoop === true
      || receipt.status === "closed"
      || (receipt.watcherReady === true && receipt.manifestMatcherReady === true && receipt.qaReportReady === true);
    const blockers = uniqueSorted([
      ...blockedIf(!closedLoop, "watcher_manifest_qa_closed_loop_missing"),
      ...(receipt.blockers || []),
    ]);

    return {
      evidenceKey: "watcherManifestQaClosedLoop",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  return {
    evidenceKey: "watcherManifestQaClosedLoop",
    source: input.watcherManifestQaClosedLoop === undefined ? "missing" : "legacy_boolean_override",
    ready: input.watcherManifestQaClosedLoop === true,
    blockers: blockedIf(input.watcherManifestQaClosedLoop !== true, "watcher_manifest_qa_closed_loop_missing"),
    warnings: input.watcherManifestQaClosedLoop === true ? ["legacy_watcherManifestQaClosedLoop_boolean_used"] : [],
  };
}

function forbiddenProviderModesEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const receipt = input.evidence?.providerLiveGate;
  const legacyAllowed = input.legacyBooleanOverridesAllowed === true;

  if (hasProviderLiveGateReceipt(receipt)) {
    const forbiddenModesAbsent = providerLiveGateForbiddenModesAbsent(receipt);
    const blockers = uniqueSorted([
      ...providerLiveGateSafetyBlockers(receipt),
      ...blockedIf(forbiddenModesAbsent !== true, "forbidden_provider_mode_or_prompt_present"),
    ]);

    return {
      evidenceKey: "forbiddenProviderModesAbsent",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  if (legacyAllowed && input.forbiddenProviderModesAbsent === true) {
    return {
      evidenceKey: "forbiddenProviderModesAbsent",
      source: "legacy_boolean_override",
      ready: true,
      blockers: [],
      warnings: ["legacy_forbiddenProviderModesAbsent_boolean_override_used"],
    };
  }

  return {
    evidenceKey: "forbiddenProviderModesAbsent",
    source: input.forbiddenProviderModesAbsent === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "provider_live_gate_typed_evidence_missing",
      ...blockedIf(input.forbiddenProviderModesAbsent !== true, "forbidden_provider_mode_or_prompt_present"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(input.forbiddenProviderModesAbsent === true, "legacy_forbiddenProviderModesAbsent_boolean_ignored_without_typed_evidence"),
    ]),
  };
}

function providerSubmitValueBlocked(value: number | boolean | undefined): boolean {
  return value === undefined || value === 0 || value === false;
}

function providerExecutionPermissionGateEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.providerExecutionPermissionGate;

  if (hasProviderExecutionPermissionGateEvidence(evidence)) {
    const phase31 = evidence.phase31Evidence || {};
    const requestBlockers = (evidence.requests || []).flatMap((request) => request.blockers || []);
    const requestWarnings = (evidence.requests || []).flatMap((request) => request.warnings || []);
    const providerSubmitAllowed = phase31.providerSubmitAllowed ?? evidence.summary?.providerSubmitAllowed ?? evidence.hardLocks?.providerSubmitAllowed;
    const hardLocksPinned = evidence.hardLocks
      ? evidence.hardLocks.dryRunOnly === true
        && evidence.hardLocks.readOnly === true
        && evidence.hardLocks.reviewPlanOnly === true
        && evidence.hardLocks.actionTimeConfirmationRequired === true
        && evidence.hardLocks.providerSubmissionForbidden === true
        && evidence.hardLocks.canSubmitProvider === false
        && evidence.hardLocks.providerSubmitAllowed === 0
        && evidence.hardLocks.liveSubmitAllowed === false
        && evidence.hardLocks.credentialAccessAllowed === false
        && evidence.hardLocks.credentialStorage === false
        && evidence.hardLocks.noCredentialRead === true
        && evidence.hardLocks.noCredentialWrite === true
        && evidence.hardLocks.noApiKeyCreation === true
        && evidence.hardLocks.noArbitraryProviderCommand === true
        && evidence.hardLocks.noWorkerSpawn === true
        && evidence.hardLocks.noFileMutation === true
        && evidence.hardLocks.fastModelForbidden === true
        && evidence.hardLocks.vipChannelForbidden === true
        && evidence.hardLocks.textToVideoMainPathForbidden === true
        && evidence.hardLocks.bgmInVideoPromptForbidden === true
      : false;
    const requestLocksPinned = (evidence.requests || []).every((request) =>
      request.actionTimeConfirmationRequired !== false
      && request.userConfirmedAtActionTime !== true
      && request.canSubmitProvider !== true
      && providerSubmitValueBlocked(request.providerSubmitAllowed)
      && request.liveSubmitAllowed !== true
      && request.credentialAccessAllowed !== true
      && request.credentialStorage !== true
      && request.noWorkerSpawn !== false
      && request.noFileMutation !== false
    );
    const providerSubmitObserved = providerSubmitAllowed !== undefined && providerSubmitAllowed !== 0 && providerSubmitAllowed !== false;
    const blockers = uniqueSorted([
      ...blockedIf(phase31.typedEvidencePresent !== true, "provider_execution_permission_typed_evidence_missing"),
      ...blockedIf(phase31.phase30GateConsumed !== true, "provider_execution_permission_phase30_gate_missing"),
      ...blockedIf(phase31.actionTimeUserConfirmationRequired !== true, "provider_execution_permission_action_time_confirmation_missing"),
      ...blockedIf(phase31.automaticSubmitForbidden !== true || evidence.summary?.automaticSubmitAllowed === true, "provider_execution_permission_auto_submit_not_forbidden"),
      ...blockedIf(!hardLocksPinned, "provider_execution_permission_hard_locks_not_pinned"),
      ...blockedIf(!requestLocksPinned, "provider_execution_permission_request_lock_drift"),
      ...blockedIf(phase31.canSubmitProvider === true || evidence.hardLocks?.canSubmitProvider === true, "provider_execution_permission_can_submit_provider_true"),
      ...blockedIf(providerSubmitObserved, "provider_execution_permission_provider_submit_allowed"),
      ...blockedIf(phase31.liveSubmitAllowed === true || evidence.summary?.liveSubmitAllowed === true || evidence.hardLocks?.liveSubmitAllowed === true, "provider_execution_permission_live_submit_allowed"),
      ...blockedIf(phase31.credentialAccessAllowed === true || evidence.summary?.credentialAccessAllowed === true || evidence.hardLocks?.credentialAccessAllowed === true, "provider_execution_permission_credential_access_allowed"),
      ...blockedIf(phase31.noWorkerSpawn !== true || evidence.hardLocks?.noWorkerSpawn !== true, "provider_execution_permission_worker_spawn_not_blocked"),
      ...blockedIf(phase31.noFileMutation !== true || evidence.hardLocks?.noFileMutation !== true, "provider_execution_permission_file_mutation_not_blocked"),
      ...blockedIf(phase31.forbiddenProviderModesAbsent !== true, "provider_execution_permission_forbidden_mode_not_absent"),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
    ]);

    return {
      evidenceKey: "providerExecutionPermissionGate",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...requestWarnings, ...requestBlockers]),
    };
  }

  return {
    evidenceKey: "providerExecutionPermissionGate",
    source: input.providerExecutionPermissionGateReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "provider_execution_permission_typed_evidence_missing",
      ...blockedIf(input.providerExecutionPermissionGateReady !== true, "provider_execution_permission_gate_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(
        input.providerExecutionPermissionGateReady === true,
        "legacy_providerExecutionPermissionGateReady_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function providerActionConfirmationReceiptEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.providerActionConfirmationReceipt;

  if (hasProviderActionConfirmationReceiptEvidence(evidence)) {
    const phase32 = evidence.phase32Evidence || {};
    const receipts = [...(evidence.receipts || []), ...(evidence.requests || [])];
    const receiptBlockers = receipts.flatMap((receipt) => receipt.blockers || []);
    const receiptWarnings = receipts.flatMap((receipt) => receipt.warnings || []);
    const phase31EvidencePresent = hasProviderExecutionPermissionGateEvidence(input.evidence?.providerExecutionPermissionGate);
    const receiptPlanPresent = phase32.actionTimeConfirmationReceiptPlanPresent === false
      ? false
      : phase32.actionTimeConfirmationReceiptPlanPresent === true
        || (evidence.summary?.receiptPlanCount ?? 0) > 0
        || (evidence.summary?.readyForReceiptReview ?? 0) > 0
        || receipts.some((receipt) =>
          receipt.receiptPlanPresent === true ||
          [
            "ready_for_receipt_review",
            "ready_for_receipt_gate",
            "receipt_plan_ready",
            "review_shell_ready",
          ].includes(String(receipt.status || "")),
        );
    const confirmedReceiptCount = phase32.confirmedReceiptCount ?? evidence.summary?.confirmedReceiptCount;
    const confirmedReceiptObserved = confirmedReceiptCount !== undefined && confirmedReceiptCount !== 0 && confirmedReceiptCount !== false
      || receipts.some((receipt) => receipt.confirmed === true || receipt.userConfirmedAtActionTime === true);
    const providerSubmitAllowed = phase32.providerSubmitAllowed
      ?? evidence.summary?.providerSubmitAllowed
      ?? evidence.hardLocks?.providerSubmitAllowed;
    const hardLocksPinned = evidence.hardLocks
      ? phase32.hardLocksPinned !== false
        && evidence.hardLocks.dryRunOnly === true
        && evidence.hardLocks.readOnly === true
        && evidence.hardLocks.reviewShellOnly === true
        && evidence.hardLocks.receiptPlanOnly === true
        && evidence.hardLocks.actionTimeConfirmationRequired === true
        && evidence.hardLocks.providerSubmissionForbidden === true
        && evidence.hardLocks.automaticSubmitForbidden === true
        && evidence.hardLocks.automaticSubmitAllowed === false
        && evidence.hardLocks.canSubmitProvider === false
        && evidence.hardLocks.providerSubmitAllowed === 0
        && evidence.hardLocks.liveSubmitAllowed === false
        && evidence.hardLocks.credentialAccessAllowed === false
        && evidence.hardLocks.credentialStorage === false
        && evidence.hardLocks.noCredentialRead === true
        && evidence.hardLocks.noCredentialWrite === true
        && evidence.hardLocks.noApiKeyCreation === true
        && evidence.hardLocks.noArbitraryProviderCommand === true
        && evidence.hardLocks.noWorkerSpawn === true
        && evidence.hardLocks.noFileMutation === true
        && evidence.hardLocks.fastModelForbidden === true
        && evidence.hardLocks.vipChannelForbidden === true
        && evidence.hardLocks.textToVideoMainPathForbidden === true
        && evidence.hardLocks.bgmInVideoPromptForbidden === true
      : false;
    const receiptLocksPinned = receipts.every((receipt) =>
      receipt.actionTimeConfirmationRequired !== false
      && receipt.confirmed !== true
      && receipt.userConfirmedAtActionTime !== true
      && receipt.canSubmitProvider !== true
      && providerSubmitValueBlocked(receipt.providerSubmitAllowed)
      && receipt.liveSubmitAllowed !== true
      && receipt.credentialAccessAllowed !== true
      && receipt.credentialStorage !== true
      && receipt.automaticSubmitAllowed !== true
      && receipt.noWorkerSpawn !== false
      && receipt.noFileMutation !== false
      && receipt.forbiddenProviderModesAbsent !== false
    );
    const blockers = uniqueSorted([
      ...blockedIf(phase32.typedEvidencePresent !== true, "provider_action_confirmation_receipt_typed_evidence_missing"),
      ...blockedIf(!phase31EvidencePresent || phase32.phase31EvidenceConsumed !== true, "provider_action_confirmation_receipt_phase31_evidence_missing"),
      ...blockedIf(!receiptPlanPresent, "provider_action_confirmation_receipt_plan_missing"),
      ...blockedIf(confirmedReceiptObserved, "provider_action_confirmation_receipt_confirmed_receipts_present"),
      ...blockedIf(!hardLocksPinned, "provider_action_confirmation_receipt_hard_locks_not_pinned"),
      ...blockedIf(!receiptLocksPinned, "provider_action_confirmation_receipt_request_lock_drift"),
      ...blockedIf(
        phase32.canSubmitProvider === true || evidence.hardLocks?.canSubmitProvider === true || receipts.some((receipt) => receipt.canSubmitProvider === true),
        "provider_action_confirmation_receipt_can_submit_provider_true",
      ),
      ...blockedIf(!providerSubmitValueBlocked(providerSubmitAllowed), "provider_action_confirmation_receipt_provider_submit_allowed"),
      ...blockedIf(
        phase32.liveSubmitAllowed === true || evidence.summary?.liveSubmitAllowed === true || evidence.hardLocks?.liveSubmitAllowed === true,
        "provider_action_confirmation_receipt_live_submit_allowed",
      ),
      ...blockedIf(
        phase32.credentialAccessAllowed === true ||
          evidence.summary?.credentialAccessAllowed === true ||
          evidence.hardLocks?.credentialAccessAllowed === true,
        "provider_action_confirmation_receipt_credential_access_allowed",
      ),
      ...blockedIf(
        phase32.automaticSubmitAllowed === true ||
          evidence.summary?.automaticSubmitAllowed === true ||
          evidence.hardLocks?.automaticSubmitAllowed === true ||
          evidence.hardLocks?.automaticSubmitForbidden === false,
        "provider_action_confirmation_receipt_auto_submit_allowed",
      ),
      ...blockedIf(phase32.noWorkerSpawn !== true || evidence.hardLocks?.noWorkerSpawn !== true, "provider_action_confirmation_receipt_worker_spawn_not_blocked"),
      ...blockedIf(phase32.noFileMutation !== true || evidence.hardLocks?.noFileMutation !== true, "provider_action_confirmation_receipt_file_mutation_not_blocked"),
      ...blockedIf(phase32.forbiddenProviderModesAbsent !== true, "provider_action_confirmation_receipt_forbidden_mode_not_absent"),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
      ...receiptBlockers,
    ]);

    return {
      evidenceKey: "providerActionConfirmationReceipt",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...receiptWarnings]),
    };
  }

  return {
    evidenceKey: "providerActionConfirmationReceipt",
    source: input.providerActionConfirmationReceiptReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "provider_action_confirmation_receipt_typed_evidence_missing",
      ...blockedIf(input.providerActionConfirmationReceiptReady !== true, "provider_action_confirmation_receipt_gate_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(
        input.providerActionConfirmationReceiptReady === true,
        "legacy_providerActionConfirmationReceiptReady_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function evidenceNotes(decisions: PhaseRoadmapEvidenceDecision[]): string[] {
  return uniqueSorted(decisions.flatMap((decision) => decision.warnings));
}

function makePhase(input: {
  phaseId: PhaseRoadmapPhaseId;
  phaseNumber: PhaseRoadmapPhasePlan["phaseNumber"];
  title: string;
  requiredPrecedingPhases: PhaseRoadmapPhaseId[];
  readyPhases: Set<PhaseRoadmapPhaseId>;
  ownBlockers: string[];
  readyStatus: PhaseRoadmapStatus;
  requiredInputs: string[];
  acceptanceCriteria: string[];
  notes: string[];
}): PhaseRoadmapPhasePlan {
  const blockedReasons = uniqueSorted([
    ...precedingBlocked({
      requiredPrecedingPhases: input.requiredPrecedingPhases,
      readyPhases: input.readyPhases,
    }),
    ...input.ownBlockers,
  ]);
  const readiness: PhaseRoadmapReadiness = blockedReasons.length ? "blocked" : "ready";

  if (readiness === "ready") input.readyPhases.add(input.phaseId);

  return {
    phaseId: input.phaseId,
    phaseNumber: input.phaseNumber,
    title: input.title,
    readiness,
    status: readiness === "ready" ? input.readyStatus : "blocked_by_gate",
    blockedReasons,
    requiredPrecedingPhases: input.requiredPrecedingPhases,
    hardLocks: locksForPhase(input.phaseId),
    requiredInputs: input.requiredInputs,
    acceptanceCriteria: input.acceptanceCriteria,
    notes: input.notes,
  };
}

export function buildPhaseRoadmapRuntimePlan(input: PhaseRoadmapRuntimeInput = {}): PhaseRoadmapRuntimePlan {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const readyPhases = new Set<PhaseRoadmapPhaseId>();
  const projectFactsDecision = projectFactsEvidenceDecision(input);
  const envelopeDecision = envelopeValidatorEvidenceDecision(input);
  const agentCliMockRunnerDecision = agentCliMockRunnerEvidenceDecision(input);
  const codexCliAdapterDecision = codexCliAdapterEvidenceDecision(input);
  const exportWorkerDecision = exportWorkerEvidenceDecision(input);
  const voiceAudioSettingsDecision = voiceAudioSettingsEvidenceDecision(input);
  const providerConfirmationDecision = providerConfirmationEvidenceDecision(input);
  const providerPacketDecision = providerPacketEvidenceDecision(input);
  const watcherClosedLoopDecision = watcherClosedLoopEvidenceDecision(input);
  const forbiddenProviderModesDecision = forbiddenProviderModesEvidenceDecision(input);
  const providerExecutionPermissionDecision = providerExecutionPermissionGateEvidenceDecision(input);
  const providerActionConfirmationReceiptDecision = providerActionConfirmationReceiptEvidenceDecision(input);
  const evidenceDecisions = [
    projectFactsDecision,
    envelopeDecision,
    agentCliMockRunnerDecision,
    codexCliAdapterDecision,
    exportWorkerDecision,
    voiceAudioSettingsDecision,
    providerConfirmationDecision,
    providerPacketDecision,
    watcherClosedLoopDecision,
    forbiddenProviderModesDecision,
    providerExecutionPermissionDecision,
    providerActionConfirmationReceiptDecision,
  ];

  const phases: PhaseRoadmapPhasePlan[] = [
    makePhase({
      phaseId: "phase_24_subagent_runtime_gate",
      phaseNumber: 24,
      title: "Subagent Runtime Gate",
      requiredPrecedingPhases: [],
      readyPhases,
      ownBlockers: uniqueSorted([
        ...projectFactsDecision.blockers,
        ...envelopeDecision.blockers,
      ]),
      readyStatus: "ready_for_implementation",
      requiredInputs: [
        "evidence.projectFactsIntegration",
        "evidence.subagentEnvelopeValidator",
        "legacy projectFactsValidated/subagentEnvelopeValidatorReady only with explicit override",
      ],
      acceptanceCriteria: [
        "Formal workers only accept validated SubagentTaskEnvelope packets.",
        "Free text worker starts are blocked before any command plan exists.",
        "Worker results must be structured before handoff.",
      ],
      notes: [
        "This phase hardens the runtime boundary; it does not execute providers or mutate project files.",
        "Phase 24 requires typed project facts and subagent envelope validator evidence by default.",
        "Boolean readiness inputs are legacy overrides and are not suitable proof for real Phase 24.",
        ...evidenceNotes([projectFactsDecision, envelopeDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_25_knowledge_pack_manager",
      phaseNumber: 25,
      title: "Knowledge Pack Manager",
      requiredPrecedingPhases: ["phase_24_subagent_runtime_gate"],
      readyPhases,
      ownBlockers: blockedIf(!input.knowledgePackManagerReady, "knowledge_pack_manager_contract_missing"),
      readyStatus: "ready_for_implementation",
      requiredInputs: ["knowledgePackManagerReady"],
      acceptanceCriteria: [
        "Knowledge packs are structured, versioned, hashed, and routed by task intent.",
        "Knowledge packs cannot override provider policy, preflight, reference authority, or QA gates.",
      ],
      notes: ["The manager can enrich envelopes, but it cannot turn parked providers into live providers."],
    }),
    makePhase({
      phaseId: "phase_26_agent_cli_mock_runner",
      phaseNumber: 26,
      title: "Agent/CLI Mock Runner",
      requiredPrecedingPhases: ["phase_24_subagent_runtime_gate", "phase_25_knowledge_pack_manager"],
      readyPhases,
      ownBlockers: uniqueSorted(agentCliMockRunnerDecision.blockers),
      readyStatus: "ready_for_noop_runner",
      requiredInputs: [
        "evidence.agentCliMockRunner",
        "replacementProofReady=true",
        "providerSubmit/freeText/spawn/resume/shell/credential/fileMutation observations all false",
      ],
      acceptanceCriteria: [
        "The runner proves the command/result contract is replaceable without spawning Codex.",
        "The runner returns no-op structured results and never submits providers.",
        "The runner cannot read credentials, run arbitrary shell, or mutate files.",
      ],
      notes: [
        "Phase 26 is the replaceability proof, not the real Codex CLI integration.",
        ...evidenceNotes([agentCliMockRunnerDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_27_export_worker_mvp",
      phaseNumber: 27,
      title: "Export Worker MVP",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(exportWorkerDecision.blockers),
      readyStatus: "ready_for_implementation",
      requiredInputs: [
        "evidence.exportWorker",
        "scope=export_project_io_contract",
        "paths project-root-relative under exports/ or reports/exports/",
        "provider/credential/shell/media render/delete/move/outside-root observations all false",
      ],
      acceptanceCriteria: [
        "File mutation is allowed only inside explicit export/project IO contracts.",
        "Export output still requires manifest matching and structured result reporting.",
        "Default runtime-state only plans export/report entries; it does not execute a real adapter.",
        "Provider, credential, shell, media render, delete, move, and outside-project-root routes are blocked.",
      ],
      notes: [
        "This is the only Phase 24-32 plan item with fileMutationAllowed=true.",
        "Phase 27 is layered on the Phase 12 dry-run Export Builder plan; the builder itself remains noFileMutation.",
        ...evidenceNotes([exportWorkerDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_28_voice_audio_settings_ui",
      phaseNumber: 28,
      title: "Voice/Audio Settings UI",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
        "phase_27_export_worker_mvp",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(voiceAudioSettingsDecision.blockers),
      readyStatus: "ready_for_implementation",
      requiredInputs: [
        "evidence.voiceAudioSettings",
        "scope=voice_audio_project_facts",
        "noBgmForVideoProvider=true",
        "bgmIncludedInVideoPrompt=false",
        "provider/credential/shell/file/sample/audio/music/live observations and allowances all false",
      ],
      acceptanceCriteria: [
        "Voice and audio settings remain structured project facts.",
        "BGM prompt text does not enter provider enablement for video.",
        "Settings cannot submit TTS/music providers, copy samples, read credentials, execute shell, or mutate files.",
      ],
      notes: [
        "This phase prepares settings only; it does not enable audio or video provider submission.",
        "The legacy voiceAudioSettingsReady boolean is ignored unless explicit legacy overrides are enabled.",
        ...evidenceNotes([voiceAudioSettingsDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_29_codex_cli_adapter_spike",
      phaseNumber: 29,
      title: "Codex CLI Adapter Spike",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
      ],
      readyPhases,
      ownBlockers: uniqueSorted([
        ...blockedIf(!agentCliMockRunnerDecision.ready, "phase_26_replacement_proof_missing"),
        ...codexCliAdapterDecision.blockers,
      ]),
      readyStatus: "ready_for_adapter_spike",
      requiredInputs: [
        "evidence.agentCliMockRunner.replacementProofReady",
        "evidence.codexCliAdapter",
        "validated-envelope-only input",
        "structured result contract",
        "provider/credential/shell/file/free-text/actual-spawn-resume blocked",
      ],
      acceptanceCriteria: [
        "Adapter spike may describe spawn/resume shape only after Phase 26 proves replaceability.",
        "Adapter input remains the validated envelope, never a free text task.",
        "Adapter output remains structured and provider submission remains blocked.",
        "Actual Codex spawn/resume, credentials, arbitrary shell, and file mutation remain unavailable in Phase 29.",
      ],
      notes: [
        "Phase 29 is a contract-only spike; real Codex spawn/resume execution is still postponed.",
        "The legacy codexCliAdapterDryRunReady boolean is ignored unless typed evidence is present.",
        ...evidenceNotes([codexCliAdapterDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_30_provider_enablement_gate",
      phaseNumber: 30,
      title: "Provider Enablement Gate",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
        "phase_27_export_worker_mvp",
        "phase_28_voice_audio_settings_ui",
        "phase_29_codex_cli_adapter_spike",
      ],
      readyPhases,
      ownBlockers: uniqueSorted([
        ...providerConfirmationDecision.blockers,
        ...providerPacketDecision.blockers,
        ...watcherClosedLoopDecision.blockers,
        ...forbiddenProviderModesDecision.blockers,
      ]),
      readyStatus: "ready_for_confirmation_gate",
      requiredInputs: [
        "evidence.providerLiveGate or legacy providerConfirmationTokenPlaceholderPresent",
        "evidence.providerLiveGate or legacy providerPacketComplete",
        "evidence.watcherManifestQaClosedLoop or legacy watcherManifestQaClosedLoop",
        "forbiddenProviderModesAbsent=true from typed receipt or explicit legacy boolean",
      ],
      acceptanceCriteria: [
        "User confirmation token placeholder is present and separate from credentials.",
        "Packet is complete before any final provider gate can be considered.",
        "Watcher, manifest matcher, and QA form a closed loop.",
        "Fast, VIP, text-to-video, and BGM prompt paths are absent.",
        "Even when ready, this plan still reports canSubmitProvider=false until a later final gate exists.",
      ],
      notes: [
        "Phase 30 is an enablement gate plan, not provider execution.",
        "forbiddenProviderModesAbsent is fail-closed: omitted or false keeps Phase 30 blocked.",
        ...evidenceNotes([
          providerConfirmationDecision,
          providerPacketDecision,
          watcherClosedLoopDecision,
          forbiddenProviderModesDecision,
        ]),
      ],
    }),
    makePhase({
      phaseId: "phase_31_provider_execution_permission_gate",
      phaseNumber: 31,
      title: "Provider Execution Permission Gate",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
        "phase_27_export_worker_mvp",
        "phase_28_voice_audio_settings_ui",
        "phase_29_codex_cli_adapter_spike",
        "phase_30_provider_enablement_gate",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(providerExecutionPermissionDecision.blockers),
      readyStatus: "ready_for_final_permission_gate",
      requiredInputs: [
        "evidence.providerExecutionPermissionGate",
        "phase31 typed evidence present",
        "action-time user confirmation required",
        "automatic submit forbidden",
        "provider/credential/worker/file routes blocked",
      ],
      acceptanceCriteria: [
        "UI may only show a future confirmation review when Phase 30 has produced a complete gate item.",
        "Action-time user confirmation is required and cannot be pre-approved by typed evidence alone.",
        "Automatic provider submit, live submit, credentials, worker spawn, arbitrary provider commands, and file mutation stay blocked.",
        "Fast, VIP, text-to-video, and BGM-in-video prompt paths remain absent.",
      ],
      notes: [
        "Phase 31 is the permission shell that Phase 32 consumes before any future live provider execution layer.",
        "It prepares confirmation requests; it does not call Image2, Seedance, Jimeng, Codex, or a sidecar.",
        ...evidenceNotes([providerExecutionPermissionDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_32_action_time_confirmation_receipt",
      phaseNumber: 32,
      title: "Action-time Confirmation Receipt / Review Shell",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
        "phase_27_export_worker_mvp",
        "phase_28_voice_audio_settings_ui",
        "phase_29_codex_cli_adapter_spike",
        "phase_30_provider_enablement_gate",
        "phase_31_provider_execution_permission_gate",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(providerActionConfirmationReceiptDecision.blockers),
      readyStatus: "ready_for_receipt_gate",
      requiredInputs: [
        "evidence.providerActionConfirmationReceipt",
        "Phase 31 typed permission evidence consumed",
        "action-time confirmation receipt plan present",
        "confirmedReceiptCount=0",
        "provider/credential/automatic-submit/worker/file routes blocked",
      ],
      acceptanceCriteria: [
        "Receipt evidence can prepare a future review shell from Phase 31 typed confirmation requests.",
        "Confirmed receipts are not accepted by the roadmap runtime default path.",
        "Provider submit, live submit, credentials, automatic submit, worker spawn, and file mutation remain blocked.",
        "Fast, VIP, text-to-video, and BGM-in-video prompt paths remain absent.",
      ],
      notes: [
        "Phase 32 is a receipt/review shell only; it does not submit providers, create credentials, spawn workers, or mutate files.",
        "Legacy providerActionConfirmationReceiptReady booleans are ignored without typed receipt evidence.",
        ...evidenceNotes([providerActionConfirmationReceiptDecision]),
      ],
    }),
  ];

  return {
    schemaVersion: phaseRoadmapRuntimeSchemaVersion,
    generatedAt,
    phaseRange: "phase_24_to_32",
    phases,
    summary: {
      totalPhases: 9,
      ready: phases.filter((phase) => phase.readiness === "ready").length,
      blocked: phases.filter((phase) => phase.readiness === "blocked").length,
      providerSubmitAllowed: 0,
      credentialAccessAllowed: false,
      arbitraryShellAllowed: false,
      freeTextWorkerAllowed: false,
    },
    evidenceSummary: {
      typedEvidenceRequiredForPhase24: true,
      legacyBooleanOverridesAllowed: input.legacyBooleanOverridesAllowed === true,
      decisions: evidenceDecisions,
      notes: [
        "Builder resolves typed evidence before considering legacy booleans.",
        "Phase 24 defaults to blocked without project facts integration evidence and a subagent envelope validator receipt.",
        "Legacy boolean readiness inputs are transitional diagnostics, not proof for real Phase 24.",
      ],
    },
    hardLocks: phaseRoadmapRuntimeHardLocks,
    adapterBoundary: {
      phase26: {
        runnerKind: "mock_noop",
        purpose: "prove_replaceable_runner_contract",
        canSpawnCodex: false,
        canResumeCodex: false,
        canSubmitProvider: false,
      },
      phase29: {
        runnerKind: "codex_cli_adapter_spike",
        purpose: "connect_spawn_resume_after_mock_contract_is_proven",
        requiresPhase26ReplacementProof: true,
        canSubmitProvider: false,
      },
    },
    providerEnablementGate: {
      userConfirmationTokenPlaceholderRequired: true,
      packetCompleteRequired: true,
      watcherManifestQaClosedLoopRequired: true,
      noFastVipTextToVideoOrBgmPromptRequired: true,
      canSubmitProvider: false,
    },
    providerExecutionPermissionGate: {
      actionTimeUserConfirmationRequired: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
    },
    providerActionConfirmationReceipt: {
      actionTimeConfirmationReceiptPlanRequired: true,
      confirmedReceiptCount: 0,
      reviewShellOnly: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
    },
  };
}

export function getPhaseRoadmapPhase(
  plan: PhaseRoadmapRuntimePlan,
  phaseId: PhaseRoadmapPhaseId,
): PhaseRoadmapPhasePlan | undefined {
  return plan.phases.find((phase) => phase.phaseId === phaseId);
}

export function phaseRoadmapPhaseIds(): PhaseRoadmapPhaseId[] {
  return [...phaseIds];
}
