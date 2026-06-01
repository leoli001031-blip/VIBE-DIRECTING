import type { BaseHardLocks } from "./types";

export const phaseRoadmapRuntimeSchemaVersion = "0.1.0";

export type PhaseRoadmapPhaseId =
  | "phase_24_subagent_runtime_gate"
  | "phase_25_knowledge_pack_manager"
  | "phase_26_agent_cli_mock_runner"
  | "phase_27_export_worker_mvp"
  | "phase_28_voice_audio_settings_ui"
  | "phase_29_cli_adapter_spike"
  | "phase_30_provider_enablement_gate"
  | "phase_31_provider_execution_permission_gate"
  | "phase_32_action_time_confirmation_receipt"
  | "phase_33_provider_execution_handoff"
  | "phase_34_local_orchestrator_runtime_integration"
  | "phase_35_task_queue_visibility_progress_strip"
  | "phase_36_project_file_fact_source"
  | "phase_37_visual_consistency_contract"
  | "phase_38_full_task_subagent_packet_planner"
  | "phase_39_knowledge_pack_user_management"
  | "phase_40_worker_runtime_gate"
  | "phase_41_provider_closed_loop_shell"
  | "phase_42_export_desktop_beta_acceptance";

export type PhaseRoadmapReadiness = "ready" | "blocked";
export type PhaseRoadmapStatus =
  | "ready_for_implementation"
  | "ready_for_noop_runner"
  | "ready_for_adapter_spike"
  | "ready_for_confirmation_gate"
  | "ready_for_final_permission_gate"
  | "ready_for_receipt_gate"
  | "ready_for_final_handoff_review"
  | "ready_for_runtime_integration"
  | "ready_for_queue_visibility"
  | "ready_for_project_fact_source"
  | "ready_for_visual_consistency_contract"
  | "ready_for_packet_planner"
  | "ready_for_user_management"
  | "ready_for_gated_worker_runtime"
  | "ready_for_provider_closed_loop_shell"
  | "ready_for_beta_acceptance"
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
  | "ready_for_final_handoff_review"
  | "ready_for_runtime_integration"
  | "ready_for_queue_visibility"
  | "ready_for_project_fact_source"
  | "ready_for_visual_consistency_contract"
  | "ready_for_packet_planner"
  | "ready_for_user_management"
  | "ready_for_gated_worker_runtime"
  | "ready_for_provider_closed_loop_shell"
  | "ready_for_beta_acceptance"
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

export interface PhaseRoadmapProviderExecutionHandoffEvidence {
  kind?: "provider_execution_handoff";
  phase?: "phase_33_provider_execution_handoff";
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: "ready_for_final_handoff_review" | "ready" | "blocked";
  phase33Evidence?: {
    phaseId?: "phase_33_provider_execution_handoff";
    typedEvidencePresent?: boolean;
    phase32TypedEvidenceConsumed?: boolean;
    actionTimeConfirmationEvidencePresent?: boolean;
    userConfirmedAtActionTime?: boolean;
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
    readyForFinalHandoffReview?: number;
    confirmedReceiptCount?: number | boolean;
    blocked?: number;
    parked?: number;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    automaticSubmitAllowed?: boolean;
    workerSpawnAllowed?: boolean;
    fileMutationAllowed?: boolean;
  };
  hardLocks?: {
    dryRunOnly?: boolean;
    readOnly?: boolean;
    finalHandoffReviewOnly?: boolean;
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
  handoffs?: Array<{
    status?: string;
    phase32TypedEvidenceConsumed?: boolean;
    actionTimeConfirmationEvidencePresent?: boolean;
    confirmed?: boolean;
    userConfirmedAtActionTime?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    automaticSubmitAllowed?: boolean;
    workerSpawnAllowed?: boolean;
    fileMutationAllowed?: boolean;
    noWorkerSpawn?: boolean;
    noFileMutation?: boolean;
    forbiddenProviderModesAbsent?: boolean;
    blockers?: string[];
    warnings?: string[];
  }>;
  requests?: Array<{
    status?: string;
    phase32TypedEvidenceConsumed?: boolean;
    actionTimeConfirmationEvidencePresent?: boolean;
    confirmed?: boolean;
    userConfirmedAtActionTime?: boolean;
    canSubmitProvider?: boolean;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    automaticSubmitAllowed?: boolean;
    workerSpawnAllowed?: boolean;
    fileMutationAllowed?: boolean;
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
    canReplaceAgentCli?: boolean;
    canSpawnAgent?: boolean;
    canResumeAgent?: boolean;
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
    spawnAgentObserved?: boolean;
    resumeAgentObserved?: boolean;
    shellExecutionObserved?: boolean;
    credentialReadObserved?: boolean;
    credentialWriteObserved?: boolean;
    fileMutationObserved?: boolean;
  };
  hardLocks?: {
    mockOnly?: boolean;
    dryRunOnly?: boolean;
    noAgentSpawn?: boolean;
    noAgentResume?: boolean;
    noSpawnAgent?: boolean;
    noResumeAgent?: boolean;
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
    spawnAgentObserved?: boolean;
    resumeAgentObserved?: boolean;
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

export interface PhaseRoadmapAgentCliAdapterEvidence {
  kind?: "agent_cli_adapter_spike";
  phaseId?: "phase_29_cli_adapter_spike";
  phase?: "phase_29_cli_adapter_spike";
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
    spawnAgentObserved?: boolean;
    resumeAgentObserved?: boolean;
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
    phaseId?: "phase_29_cli_adapter_spike";
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

export type PhaseRoadmapClosurePhaseId =
  | "phase_34_local_orchestrator_runtime_integration"
  | "phase_35_task_queue_visibility_progress_strip"
  | "phase_36_project_file_fact_source"
  | "phase_37_visual_consistency_contract"
  | "phase_38_full_task_subagent_packet_planner"
  | "phase_39_knowledge_pack_user_management"
  | "phase_40_worker_runtime_gate"
  | "phase_41_provider_closed_loop_shell"
  | "phase_42_export_desktop_beta_acceptance";

export interface PhaseRoadmapClosureHardLocks {
  hardLocksPinned?: boolean;
  dryRunOnly?: boolean;
  readOnly?: boolean;
  planOnly?: boolean;
  diagnosticsOnly?: boolean;
  reviewOnly?: boolean;
  defaultGated?: boolean;
  gatedRuntimeOnly?: boolean;
  closedLoopShellOnly?: boolean;
  noDaemon?: boolean;
  daemonStarted?: boolean;
  noSpawnAgent?: boolean;
  noWorkerSpawn?: boolean;
  workerSpawnAllowed?: boolean;
  canSpawnAgent?: boolean;
  noSubprocess?: boolean;
  noAgentResume?: boolean;
  agentResumeAllowed?: boolean;
  noShellExecution?: boolean;
  noArbitraryShell?: boolean;
  arbitraryShellAllowed?: boolean;
  noProviderSubmit?: boolean;
  noProviderExecution?: boolean;
  providerSubmissionForbidden?: boolean;
  canSubmitProvider?: boolean;
  providerSubmitAllowed?: number | boolean;
  providerCommitAllowed?: boolean;
  liveSubmitAllowed?: boolean;
  noCredentialRead?: boolean;
  noCredentialWrite?: boolean;
  credentialAccessAllowed?: boolean;
  credentialStorage?: boolean;
  noFileMutation?: boolean;
  fileMutationAllowed?: boolean;
  noFreeTextWorker?: boolean;
  workerSelfReportCannotComplete?: boolean;
  expectedOutputRequired?: boolean;
  manifestRequired?: boolean;
  qaGateRequired?: boolean;
  noHardGateOverride?: boolean;
  noWholeLibraryInjection?: boolean;
  noUnverifiedExternalImportInjection?: boolean;
  noParkedProviderBypass?: boolean;
  noTempRejectedCandidateShotOutputPromotion?: boolean;
}

export interface PhaseRoadmapClosureObservations {
  daemonStarted?: boolean;
  spawnAgentObserved?: boolean;
  agentResumeObserved?: boolean;
  workerSpawnObserved?: boolean;
  subprocessObserved?: boolean;
  shellExecutionObserved?: boolean;
  runControlObserved?: boolean;
  submitControlObserved?: boolean;
  executeControlObserved?: boolean;
  providerSubmitObserved?: boolean;
  providerExecutionObserved?: boolean;
  providerCommitObserved?: boolean;
  liveSubmitObserved?: boolean;
  credentialReadObserved?: boolean;
  credentialWriteObserved?: boolean;
  credentialAccessObserved?: boolean;
  fileMutationObserved?: boolean;
  queueDetailsOnDirectorSurfaceObserved?: boolean;
  workerRouteOpened?: boolean;
  providerRouteOpened?: boolean;
  fileRouteOpened?: boolean;
  credentialRouteOpened?: boolean;
  shellRouteOpened?: boolean;
  runtimeStateAsSourceObserved?: boolean;
  runtimeStateSourceOfTruthObserved?: boolean;
  runtimeCacheAsSourceObserved?: boolean;
  chatMemoryAsSourceObserved?: boolean;
  legacyChatAsSourceObserved?: boolean;
  chatHistoryAsSourceObserved?: boolean;
  directInputAsAuthorityObserved?: boolean;
  directInputSourceOfTruthObserved?: boolean;
  freeTextAsAuthorityObserved?: boolean;
  absolutePathContractObserved?: boolean;
  absolutePathAllowed?: boolean;
  parentTraversalObserved?: boolean;
  parentTraversalAccepted?: boolean;
  credentialSecretInProjectFileObserved?: boolean;
  credentialInProjectFileObserved?: boolean;
  secretInProjectFileObserved?: boolean;
  globalKnowledgeAsProjectFactObserved?: boolean;
  globalKnowledgeAuthorityObserved?: boolean;
  unvalidatedPacketObserved?: boolean;
  missingExpectedOutputsObserved?: boolean;
  missingSourceFactTraceObserved?: boolean;
  missingKnowledgeTraceObserved?: boolean;
  freeTextWorkerObserved?: boolean;
  freeTextTaskObserved?: boolean;
  unvalidatedEnvelopeAccepted?: boolean;
  unstructuredResultAccepted?: boolean;
  defaultGateOpened?: boolean;
  gateDefaultOn?: boolean;
  candidateFutureReferenceObserved?: boolean;
  tempFutureReferenceObserved?: boolean;
  rejectedFutureReferenceObserved?: boolean;
  contactSheetFutureReferenceObserved?: boolean;
  shotOutputFutureReferenceObserved?: boolean;
  derivedViewMissingMasterInheritance?: boolean;
  cameraVectorMissing?: boolean;
  worldPositionMissing?: boolean;
  shotLayoutSubjectMissing?: boolean;
  shotLayoutCameraMissing?: boolean;
  shotLayoutAxisMissing?: boolean;
  shotLayoutAnchorsMissing?: boolean;
  independentSameShotEndFrameObserved?: boolean;
  largeMotionDriftObserved?: boolean;
  semanticOpenCvRepairObserved?: boolean;
  hardGateOverrideObserved?: boolean;
  wholeLibraryInjectionObserved?: boolean;
  unverifiedExternalImportInjectionObserved?: boolean;
  parkedProviderBypassObserved?: boolean;
  tempAssetFormalPromotionObserved?: boolean;
  rejectedAssetFormalPromotionObserved?: boolean;
  candidateAssetFormalPromotionObserved?: boolean;
  shotOutputFormalPromotionObserved?: boolean;
  freeTextRouteOpened?: boolean;
  providerSubmitRouteOpened?: boolean;
}

export interface PhaseRoadmapClosureEvidence {
  kind?: string;
  phase?: PhaseRoadmapClosurePhaseId;
  phaseId?: PhaseRoadmapClosurePhaseId;
  status?: PhaseRoadmapEvidenceStatus;
  readiness?: PhaseRoadmapReadiness | PhaseRoadmapStatus;
  ready?: boolean;
  typedEvidencePresent?: boolean;
  gates?: Record<string, boolean | number | string | undefined>;
  summary?: Record<string, boolean | number | string | undefined> & {
    blockerCount?: number;
    blocked?: number;
    missing?: number;
    providerSubmitAllowed?: number | boolean;
    liveSubmitAllowed?: boolean;
    credentialAccessAllowed?: boolean;
    credentialStorage?: boolean;
    workerSpawnAllowed?: boolean;
    fileMutationAllowed?: boolean;
    daemonStarted?: boolean;
  };
  hardLocks?: PhaseRoadmapClosureHardLocks;
  observations?: PhaseRoadmapClosureObservations;
  blockers?: string[];
  blockedReasons?: string[];
  warnings?: string[];
  sourceRef?: string;
}

export interface PhaseRoadmapLocalOrchestratorRuntimeEvidence extends PhaseRoadmapClosureEvidence {
  schemaVersion?: string;
  queue?: Array<{
    queueStatus?: string;
    canExecute?: boolean;
    canSpawnAgent?: boolean;
    providerSubmissionForbidden?: boolean;
    liveSubmitAllowed?: boolean;
    noFileMutation?: boolean;
    completionGate?: {
      expectedOutputDeclared?: boolean;
      expectedOutputObserved?: boolean;
      manifestMatched?: boolean;
      qaPass?: boolean;
      promotionGatePassed?: boolean;
      workerSelfReportOnly?: boolean;
      completeVerified?: boolean;
    };
    agentActivity?: {
      retryBudget?: number;
      stalled?: boolean;
      manualReviewRequired?: boolean;
      state?: string;
    };
  }>;
  autoContinuePlan?: {
    mode?: string;
    nextReadyCount?: number;
    transitions?: unknown[];
  };
  sourceCoverage?: Array<{
    layer?: string;
    referenced?: boolean;
  }>;
  dryRunOnly?: boolean;
  planOnly?: boolean;
  providerSubmissionForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  noFileMutation?: boolean;
  daemonStarted?: boolean;
}

export interface PhaseRoadmapTaskQueueVisibilityEvidence extends PhaseRoadmapClosureEvidence {
  directorSurface?: {
    readOnlyProgressStrip?: boolean;
    queueDetailsVisible?: boolean;
    queueDetailsOnDirectorSurface?: boolean;
    runControlPresent?: boolean;
    submitControlPresent?: boolean;
    executeControlPresent?: boolean;
    runSubmitExecuteControlsPresent?: boolean;
  };
  routeSafety?: {
    workerRouteOpened?: boolean;
    providerRouteOpened?: boolean;
    fileRouteOpened?: boolean;
    credentialRouteOpened?: boolean;
    shellRouteOpened?: boolean;
  };
}

export interface PhaseRoadmapVisualConsistencyContractEvidence extends PhaseRoadmapClosureEvidence {
  referenceAuthority?: Record<string, unknown>;
  futureReferences?: Record<string, unknown>;
  sceneAssetPack?: Record<string, unknown>;
  derivedViews?: Record<string, unknown>;
  cameraGeometry?: Record<string, unknown>;
  shotLayout?: Record<string, unknown>;
  keyframePair?: Record<string, unknown>;
  motionQa?: Record<string, unknown>;
  repairPolicy?: Record<string, unknown>;
}

export interface PhaseRoadmapFullTaskSubagentPacketPlannerEvidence extends PhaseRoadmapClosureEvidence {
  taskCoverage?: Record<string, unknown>;
  packetPolicy?: Record<string, unknown>;
  outputContract?: Record<string, unknown>;
  sourceFactTrace?: Record<string, unknown>;
  knowledgeTrace?: Record<string, unknown>;
  freeTextPolicy?: Record<string, unknown>;
  routeSafety?: {
    workerRouteOpened?: boolean;
    providerRouteOpened?: boolean;
    fileRouteOpened?: boolean;
    credentialRouteOpened?: boolean;
    shellRouteOpened?: boolean;
  };
}

export interface PhaseRoadmapWorkerRuntimeGateEvidence extends PhaseRoadmapClosureEvidence {
  inputContract?: Record<string, unknown>;
  outputContract?: Record<string, unknown>;
  runtimeGate?: Record<string, unknown>;
  routeSafety?: Record<string, unknown>;
  executionPolicy?: Record<string, unknown>;
}

export interface PhaseRoadmapProviderClosedLoopShellEvidence extends PhaseRoadmapClosureEvidence {
  observations?: PhaseRoadmapClosureObservations & {
    apiKeyCreatedObserved?: boolean;
    providerCommitDefaultOn?: boolean;
    workerSelfReportCompletionAccepted?: boolean;
    missingExpectedOutputAccepted?: boolean;
    manifestMissingAccepted?: boolean;
    qaMissingAccepted?: boolean;
    promotionWithoutQaObserved?: boolean;
    fastModelObserved?: boolean;
    vipChannelObserved?: boolean;
    textToVideoMainPathObserved?: boolean;
    bgmInVideoPromptObserved?: boolean;
  };
  providerShells?: Record<string, unknown>;
  watcher?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  qaGate?: Record<string, unknown>;
  promotionGate?: Record<string, unknown>;
  providerCommitGate?: Record<string, unknown>;
  credentialPolicy?: Record<string, unknown>;
  workerPolicy?: Record<string, unknown>;
  executionPolicy?: Record<string, unknown>;
  providerModePolicy?: Record<string, unknown>;
}

export interface PhaseRoadmapBetaAcceptanceEvidence extends PhaseRoadmapClosureEvidence {
  phase?: "phase_42_export_desktop_beta_acceptance";
  phaseId?: "phase_42_export_desktop_beta_acceptance";
  gates?: PhaseRoadmapClosureEvidence["gates"] & {
    macDesktopReadiness?: boolean;
    windowsDesktopReadiness?: boolean;
    projectSaveOpen?: boolean;
    previewExport?: boolean;
    queueVisibility?: boolean;
    visualConsistency?: boolean;
    knowledgePackManagement?: boolean;
    workerRuntimeGate?: boolean;
    providerClosedLoopShell?: boolean;
    providerGate?: boolean;
    tests?: boolean;
    noAdditionalPhasesPlanned?: boolean;
    betaAcceptanceOwnsClosure?: boolean;
    finalPhaseNumberLocked?: boolean;
  };
  summary?: PhaseRoadmapClosureEvidence["summary"] & {
    finalPhaseNumber?: number;
    maxPhaseNumber?: number;
  };
  observations?: PhaseRoadmapClosureObservations & {
    macDesktopMissing?: boolean;
    windowsDesktopMissing?: boolean;
    projectSaveOpenMissing?: boolean;
    previewExportMissing?: boolean;
    queueVisibilityMissing?: boolean;
    visualConsistencyMissing?: boolean;
    knowledgePackMissing?: boolean;
    workerRuntimeGateMissing?: boolean;
    providerClosedLoopShellMissing?: boolean;
    providerGateMissing?: boolean;
    testsMissing?: boolean;
    additionalPhaseRequested?: boolean;
    phaseAfter42Observed?: boolean;
    finalPhaseNumberNot42?: boolean;
    apiKeyCreatedObserved?: boolean;
  };
  desktopReadiness?: Record<string, unknown>;
  projectReadiness?: Record<string, unknown>;
  exportReadiness?: Record<string, unknown>;
  betaClosure?: Record<string, unknown>;
  providerPolicy?: Record<string, unknown>;
  workerPolicy?: Record<string, unknown>;
  executionPolicy?: Record<string, unknown>;
}

export interface PhaseRoadmapRuntimeEvidence {
  projectFactsIntegration?: PhaseRoadmapProjectFactsIntegrationEvidence;
  subagentEnvelopeValidator?: PhaseRoadmapSubagentEnvelopeValidatorReceipt;
  agentCliMockRunner?: PhaseRoadmapAgentCliMockRunnerEvidence;
  agentCliAdapter?: PhaseRoadmapAgentCliAdapterEvidence;
  cliAdapterSpike?: PhaseRoadmapAgentCliAdapterEvidence;
  exportWorker?: PhaseRoadmapExportWorkerEvidence;
  voiceAudioSettings?: PhaseRoadmapVoiceAudioSettingsEvidence;
  providerLiveGate?: PhaseRoadmapProviderLiveGateReceipt;
  providerExecutionPermissionGate?: PhaseRoadmapProviderExecutionPermissionGateEvidence;
  providerActionConfirmationReceipt?: PhaseRoadmapProviderActionConfirmationReceiptEvidence;
  providerExecutionHandoff?: PhaseRoadmapProviderExecutionHandoffEvidence;
  localOrchestratorRuntime?: PhaseRoadmapLocalOrchestratorRuntimeEvidence;
  taskQueueVisibility?: PhaseRoadmapTaskQueueVisibilityEvidence;
  projectFileFactSource?: PhaseRoadmapClosureEvidence;
  visualConsistencyContract?: PhaseRoadmapVisualConsistencyContractEvidence;
  fullTaskSubagentPacketPlanner?: PhaseRoadmapFullTaskSubagentPacketPlannerEvidence;
  subagentPacketPlanner?: PhaseRoadmapClosureEvidence;
  knowledgePackUserManagement?: PhaseRoadmapClosureEvidence;
  workerRuntimeGate?: PhaseRoadmapWorkerRuntimeGateEvidence;
  providerClosedLoopShell?: PhaseRoadmapProviderClosedLoopShellEvidence;
  betaAcceptance?: PhaseRoadmapBetaAcceptanceEvidence;
  watcherManifestQaClosedLoop?: PhaseRoadmapClosedLoopReceipt;
}

export interface PhaseRoadmapEvidenceDecision {
  evidenceKey:
    | "projectFactsIntegration"
    | "subagentEnvelopeValidator"
    | "agentCliMockRunner"
    | "agentCliAdapter"
    | "exportWorker"
    | "voiceAudioSettings"
    | "providerConfirmationTokenPlaceholder"
    | "providerEnablementPacket"
    | "watcherManifestQaClosedLoop"
    | "forbiddenProviderModesAbsent"
    | "providerExecutionPermissionGate"
    | "providerActionConfirmationReceipt"
    | "providerExecutionHandoff"
    | "localOrchestratorRuntime"
    | "taskQueueVisibility"
    | "projectFileFactSource"
    | "visualConsistencyContract"
    | "fullTaskSubagentPacketPlanner"
    | "subagentPacketPlanner"
    | "knowledgePackUserManagement"
    | "workerRuntimeGate"
    | "providerClosedLoopShell"
    | "betaAcceptance";
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
  agentCliAdapterDryRunReady?: boolean;
  replacementProofFromMockRunner?: boolean;
  providerConfirmationTokenPlaceholderPresent?: boolean;
  providerPacketComplete?: boolean;
  watcherManifestQaClosedLoop?: boolean;
  forbiddenProviderModesAbsent?: boolean;
  providerExecutionPermissionGateReady?: boolean;
  providerActionConfirmationReceiptReady?: boolean;
  providerExecutionHandoffReady?: boolean;
  localOrchestratorRuntimeReady?: boolean;
  taskQueueVisibilityReady?: boolean;
  projectFileFactSourceReady?: boolean;
  visualConsistencyContractReady?: boolean;
  subagentPacketPlannerReady?: boolean;
  knowledgePackUserManagementReady?: boolean;
  workerRuntimeGateReady?: boolean;
  providerClosedLoopShellReady?: boolean;
  betaAcceptanceReady?: boolean;
}

export interface PhaseRoadmapHardLocks extends BaseHardLocks {
  noFreeTextWorker: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noProviderSubmit: true;
  noCredentials: true;
  noArbitraryShell: true;
  noFileMutationUnlessExplicitExportOrProjectIoPhase: true;
  fileMutationAllowed: boolean;
}

export interface PhaseRoadmapPhasePlan {
  phaseId: PhaseRoadmapPhaseId;
  phaseNumber: 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42;
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
  phaseRange: "phase_24_to_42";
  phases: PhaseRoadmapPhasePlan[];
  summary: {
    totalPhases: 19;
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
      canSpawnAgent: false;
      canResumeAgent: false;
      canSubmitProvider: false;
    };
    phase29: {
      runnerKind: "agent_cli_adapter_spike";
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
  providerExecutionHandoff: {
    phase32TypedEvidenceRequired: true;
    actionTimeConfirmationEvidenceRequired: true;
    userConfirmedAtActionTimeRequired: true;
    finalHandoffReviewOnly: true;
    automaticSubmitForbidden: true;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    workerSpawnAllowed: false;
    fileMutationAllowed: false;
  };
  betaClosure: {
    finalPhaseNumber: 42;
    noAdditionalPhasesPlanned: true;
    betaAcceptanceOwnsClosure: true;
    workerRuntimeDefaultGated: true;
    providerClosedLoopDefaultGated: true;
    canSpawnAgent: false;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    fileMutationAllowedOutsideExplicitExportOrProjectIo: false;
    requiredAcceptanceGates: string[];
  };
}

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

const phaseIds: PhaseRoadmapPhaseId[] = [
  "phase_24_subagent_runtime_gate",
  "phase_25_knowledge_pack_manager",
  "phase_26_agent_cli_mock_runner",
  "phase_27_export_worker_mvp",
  "phase_28_voice_audio_settings_ui",
  "phase_29_cli_adapter_spike",
  "phase_30_provider_enablement_gate",
  "phase_31_provider_execution_permission_gate",
  "phase_32_action_time_confirmation_receipt",
  "phase_33_provider_execution_handoff",
  "phase_34_local_orchestrator_runtime_integration",
  "phase_35_task_queue_visibility_progress_strip",
  "phase_36_project_file_fact_source",
  "phase_37_visual_consistency_contract",
  "phase_38_full_task_subagent_packet_planner",
  "phase_39_knowledge_pack_user_management",
  "phase_40_worker_runtime_gate",
  "phase_41_provider_closed_loop_shell",
  "phase_42_export_desktop_beta_acceptance",
];

export const phaseRoadmapRuntimeHardLocks: PhaseRoadmapHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  noFreeTextWorker: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noProviderSubmit: true,
  noCredentials: true,
  noArbitraryShell: true,
  noFileMutationUnlessExplicitExportOrProjectIoPhase: true,
  fileMutationAllowed: false,
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
    || status === "ready_for_replacement_proof"
    || status === "ready_for_final_handoff_review"
    || status === "ready_for_runtime_integration"
    || status === "ready_for_queue_visibility"
    || status === "ready_for_project_fact_source"
    || status === "ready_for_visual_consistency_contract"
    || status === "ready_for_packet_planner"
    || status === "ready_for_user_management"
    || status === "ready_for_gated_worker_runtime"
    || status === "ready_for_provider_closed_loop_shell"
    || status === "ready_for_beta_acceptance";
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

function hasAgentCliAdapterEvidence(
  evidence: PhaseRoadmapAgentCliAdapterEvidence | undefined,
): evidence is PhaseRoadmapAgentCliAdapterEvidence {
  return Boolean(evidence && (
    evidence.kind === "agent_cli_adapter_spike" ||
    evidence.phase === "phase_29_cli_adapter_spike" ||
    evidence.phaseId === "phase_29_cli_adapter_spike" ||
    evidence.roadmapEvidence?.phaseId === "phase_29_cli_adapter_spike"
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

function hasProviderExecutionHandoffEvidence(
  evidence: PhaseRoadmapProviderExecutionHandoffEvidence | undefined,
): evidence is PhaseRoadmapProviderExecutionHandoffEvidence {
  return Boolean(evidence && (
    evidence.kind === "provider_execution_handoff" ||
    evidence.phase === "phase_33_provider_execution_handoff" ||
    evidence.phase33Evidence?.phaseId === "phase_33_provider_execution_handoff"
  ));
}

function hasClosureEvidence(
  evidence: PhaseRoadmapClosureEvidence | undefined,
): evidence is PhaseRoadmapClosureEvidence {
  return Boolean(evidence);
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
      || evidence.contract?.canReplaceAgentCli === true;
    const providerSubmitObserved = observations.providerSubmitObserved === true
      || roadmap.providerSubmitObserved === true
      || validationErrors.some((error) => /provider[_ ]?submit/i.test(error));
    const freeTextTaskObserved = observations.freeTextTaskObserved === true
      || roadmap.freeTextTaskObserved === true
      || validationErrors.some((error) => /free[_ ]?text/i.test(error));
    const spawnAgentObserved = observations.spawnAgentObserved === true
      || roadmap.spawnAgentObserved === true
      || validationErrors.some((error) => /spawn|agent_spawn/i.test(error));
    const resumeAgentObserved = observations.resumeAgentObserved === true
      || roadmap.resumeAgentObserved === true
      || validationErrors.some((error) => /resume|agent_resume/i.test(error));
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
      ...blockedIf(spawnAgentObserved || evidence.contract?.canSpawnAgent === true || evidence.hardLocks?.noAgentSpawn === false, "mock_runner_spawn_agent_observed"),
      ...blockedIf(resumeAgentObserved || evidence.contract?.canResumeAgent === true || evidence.hardLocks?.noAgentResume === false, "mock_runner_resume_agent_observed"),
      ...blockedIf(shellExecutionObserved || evidence.contract?.canExecuteShell === true || evidence.adapterBoundary?.shellAllowed === true, "mock_runner_shell_execution_observed"),
      ...blockedIf(credentialReadObserved || evidence.contract?.canReadCredentials === true, "mock_runner_credential_read_observed"),
      ...blockedIf(credentialWriteObserved || evidence.contract?.canWriteCredentials === true, "mock_runner_credential_write_observed"),
      ...blockedIf(fileMutationObserved || evidence.contract?.canMutateFiles === true || evidence.adapterBoundary?.fileMutationAllowed === true, "mock_runner_file_mutation_observed"),
      ...blockedIf(evidence.hardLocks?.mockOnly === false, "mock_runner_hard_lock_mock_only_missing"),
      ...blockedIf(evidence.hardLocks?.dryRunOnly === false, "mock_runner_hard_lock_dry_run_missing"),
      ...blockedIf(evidence.hardLocks?.noSpawnAgent === false || evidence.hardLocks?.noAgentSpawn === false, "mock_runner_hard_lock_no_spawn_agent_missing"),
      ...blockedIf(evidence.hardLocks?.noResumeAgent === false || evidence.hardLocks?.noAgentResume === false, "mock_runner_hard_lock_no_resume_agent_missing"),
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

function agentCliAdapterEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.agentCliAdapter || input.evidence?.cliAdapterSpike;
  const roadmap = evidence?.roadmapEvidence || {};
  const observations = evidence?.observations || {};

  if (hasAgentCliAdapterEvidence(evidence)) {
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
      || observations.spawnAgentObserved === true
      || observations.resumeAgentObserved === true
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
      || validationErrors.some((error) => /actual[_ ]?spawn|actual[_ ]?resume|agent[_ ]?spawn|agent[_ ]?resume/i.test(error));
    const unstructuredResultObserved = observations.unstructuredResultObserved === true
      || roadmap.unstructuredResultObserved === true
      || evidence.resultContract?.structured === false
      || evidence.resultContract?.expectedResultSchema !== undefined && evidence.resultContract.expectedResultSchema !== "subagent_result_v1";
    const blockers = uniqueSorted([
      ...blockedIf(!adapterContractReady, "agent_cli_adapter_contract_missing"),
      ...blockedIf(!phase26ReplacementProofReady, "phase_26_replacement_proof_missing"),
      ...blockedIf(!validatedEnvelopeOnly, "agent_cli_adapter_validated_envelope_only_missing"),
      ...blockedIf(!structuredResult, "agent_cli_adapter_structured_result_contract_missing"),
      ...blockedIf(!hardLocksPinned, "agent_cli_adapter_hard_locks_not_pinned"),
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
      evidenceKey: "agentCliAdapter",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...(evidence.validation?.warnings || [])]),
    };
  }

  return {
    evidenceKey: "agentCliAdapter",
    source: input.agentCliAdapterDryRunReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: uniqueSorted([
      "agent_cli_adapter_typed_evidence_missing",
      ...blockedIf(input.agentCliAdapterDryRunReady !== true, "agent_cli_adapter_dry_run_contract_missing"),
    ]),
    warnings: uniqueSorted([
      ...blockedIf(input.agentCliAdapterDryRunReady === true, "legacy_agentCliAdapterDryRunReady_boolean_ignored_without_typed_evidence"),
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

function providerExecutionHandoffEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.providerExecutionHandoff;

  if (hasProviderExecutionHandoffEvidence(evidence)) {
    const phase33 = evidence.phase33Evidence || {};
    const handoffs = [...(evidence.handoffs || []), ...(evidence.requests || [])];
    const handoffBlockers = handoffs.flatMap((handoff) => handoff.blockers || []);
    const handoffWarnings = handoffs.flatMap((handoff) => handoff.warnings || []);
    const phase32EvidencePresent = hasProviderActionConfirmationReceiptEvidence(input.evidence?.providerActionConfirmationReceipt);
    const confirmedReceiptCount = phase33.confirmedReceiptCount ?? evidence.summary?.confirmedReceiptCount;
    const confirmedReceiptObserved = confirmedReceiptCount !== undefined && confirmedReceiptCount !== 0 && confirmedReceiptCount !== false
      || handoffs.some((handoff) => handoff.confirmed === true || handoff.userConfirmedAtActionTime === true);
    const actionTimeConfirmationEvidencePresent = phase33.actionTimeConfirmationEvidencePresent === true
      || handoffs.some((handoff) =>
        handoff.actionTimeConfirmationEvidencePresent === true ||
        handoff.confirmed === true ||
        handoff.userConfirmedAtActionTime === true,
      );
    const userConfirmedAtActionTime = phase33.userConfirmedAtActionTime === true
      || handoffs.some((handoff) => handoff.userConfirmedAtActionTime === true || handoff.confirmed === true);
    const providerSubmitAllowed = phase33.providerSubmitAllowed
      ?? evidence.summary?.providerSubmitAllowed
      ?? evidence.hardLocks?.providerSubmitAllowed;
    const hardLocksPinned = evidence.hardLocks
      ? phase33.hardLocksPinned !== false
        && evidence.hardLocks.dryRunOnly === true
        && evidence.hardLocks.readOnly === true
        && evidence.hardLocks.finalHandoffReviewOnly === true
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
    const handoffLocksPinned = handoffs.every((handoff) =>
      handoff.phase32TypedEvidenceConsumed !== false
      && handoff.canSubmitProvider !== true
      && providerSubmitValueBlocked(handoff.providerSubmitAllowed)
      && handoff.liveSubmitAllowed !== true
      && handoff.credentialAccessAllowed !== true
      && handoff.credentialStorage !== true
      && handoff.automaticSubmitAllowed !== true
      && handoff.workerSpawnAllowed !== true
      && handoff.fileMutationAllowed !== true
      && handoff.noWorkerSpawn !== false
      && handoff.noFileMutation !== false
      && handoff.forbiddenProviderModesAbsent !== false
    );
    const blockers = uniqueSorted([
      ...blockedIf(phase33.typedEvidencePresent !== true, "provider_execution_handoff_typed_evidence_missing"),
      ...blockedIf(!phase32EvidencePresent || phase33.phase32TypedEvidenceConsumed !== true, "provider_execution_handoff_phase32_evidence_missing"),
      ...blockedIf(
        !actionTimeConfirmationEvidencePresent || !userConfirmedAtActionTime || !confirmedReceiptObserved,
        "provider_execution_handoff_action_confirmation_missing",
      ),
      ...blockedIf(evidence.status === "blocked" || evidence.readiness === "blocked", "provider_execution_handoff_status_blocked"),
      ...blockedIf(!hardLocksPinned, "provider_execution_handoff_hard_locks_not_pinned"),
      ...blockedIf(!handoffLocksPinned, "provider_execution_handoff_request_lock_drift"),
      ...blockedIf(
        phase33.canSubmitProvider === true ||
          evidence.summary?.canSubmitProvider === true ||
          evidence.hardLocks?.canSubmitProvider === true ||
          handoffs.some((handoff) => handoff.canSubmitProvider === true),
        "provider_execution_handoff_can_submit_provider_true",
      ),
      ...blockedIf(!providerSubmitValueBlocked(providerSubmitAllowed), "provider_execution_handoff_provider_submit_allowed"),
      ...blockedIf(
        phase33.liveSubmitAllowed === true || evidence.summary?.liveSubmitAllowed === true || evidence.hardLocks?.liveSubmitAllowed === true,
        "provider_execution_handoff_live_submit_allowed",
      ),
      ...blockedIf(
        phase33.credentialAccessAllowed === true ||
          evidence.summary?.credentialAccessAllowed === true ||
          evidence.hardLocks?.credentialAccessAllowed === true,
        "provider_execution_handoff_credential_access_allowed",
      ),
      ...blockedIf(
        phase33.automaticSubmitAllowed === true ||
          evidence.summary?.automaticSubmitAllowed === true ||
          evidence.hardLocks?.automaticSubmitAllowed === true ||
          evidence.hardLocks?.automaticSubmitForbidden === false,
        "provider_execution_handoff_auto_submit_allowed",
      ),
      ...blockedIf(
        phase33.noWorkerSpawn !== true ||
          evidence.summary?.workerSpawnAllowed === true ||
          evidence.hardLocks?.noWorkerSpawn !== true,
        "provider_execution_handoff_worker_spawn_not_blocked",
      ),
      ...blockedIf(
        phase33.noFileMutation !== true ||
          evidence.summary?.fileMutationAllowed === true ||
          evidence.hardLocks?.noFileMutation !== true,
        "provider_execution_handoff_file_mutation_not_blocked",
      ),
      ...blockedIf(phase33.forbiddenProviderModesAbsent !== true, "provider_execution_handoff_forbidden_mode_not_absent"),
      ...(evidence.blockedReasons || []),
      ...(evidence.blockers || []),
      ...handoffBlockers,
    ]);

    return {
      evidenceKey: "providerExecutionHandoff",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted([...(evidence.warnings || []), ...handoffWarnings]),
    };
  }

  return {
    evidenceKey: "providerExecutionHandoff",
    source: "missing",
    ready: false,
    blockers: ["provider_execution_handoff_typed_evidence_missing"],
    warnings: [],
  };
}

type PhaseRoadmapClosureEvidenceKey =
  | "taskQueueVisibility"
  | "projectFileFactSource"
  | "visualConsistencyContract"
  | "fullTaskSubagentPacketPlanner"
  | "knowledgePackUserManagement"
  | "workerRuntimeGate"
  | "providerClosedLoopShell"
  | "betaAcceptance";

interface PhaseRoadmapRequiredClosureGate {
  field: string;
  blocker: string;
}

interface PhaseRoadmapClosureDecisionConfig {
  evidenceKey: PhaseRoadmapClosureEvidenceKey;
  phaseId: PhaseRoadmapClosurePhaseId;
  missingBlocker: string;
  safetyPrefix: string;
  legacyReadyInput?: keyof PhaseRoadmapRuntimeInput;
  requiredGates: PhaseRoadmapRequiredClosureGate[];
  requireGatedRuntimeOnly?: boolean;
  requireClosedLoopShellOnly?: boolean;
}

function closureValue(evidence: PhaseRoadmapClosureEvidence, field: string): unknown {
  const record = evidence as unknown as Record<string, unknown>;
  return evidence.gates?.[field] ?? evidence.summary?.[field] ?? record[field];
}

function closureGateReady(evidence: PhaseRoadmapClosureEvidence, field: string): boolean {
  return closureValue(evidence, field) === true;
}

function closureStatusBlockers(
  evidence: PhaseRoadmapClosureEvidence,
  phaseId: PhaseRoadmapClosurePhaseId,
  prefix: string,
): string[] {
  return uniqueSorted([
    ...blockedIf(evidence.phase !== undefined && evidence.phase !== phaseId, `${prefix}_phase_mismatch`),
    ...blockedIf(evidence.phaseId !== undefined && evidence.phaseId !== phaseId, `${prefix}_phase_mismatch`),
    ...blockedIf(evidence.typedEvidencePresent === false, `${prefix}_typed_evidence_missing`),
    ...blockedIf(evidence.ready === false, `${prefix}_status_not_ready`),
    ...blockedIf(evidence.status !== undefined && !readyStatus(evidence.status), `${prefix}_status_not_ready`),
    ...blockedIf(evidence.readiness === "blocked", `${prefix}_status_blocked`),
    ...blockedIf((evidence.summary?.blockerCount ?? 0) !== 0, `${prefix}_blockers_present`),
    ...blockedIf((evidence.summary?.blocked ?? 0) !== 0, `${prefix}_blocked_items_present`),
    ...blockedIf((evidence.summary?.missing ?? 0) !== 0, `${prefix}_missing_items_present`),
    ...(evidence.blockedReasons || []),
    ...(evidence.blockers || []),
  ]);
}

function closureSafetyBlockers(evidence: PhaseRoadmapClosureEvidence, prefix: string): string[] {
  const locks = evidence.hardLocks || {};
  const observations = evidence.observations || {};
  const summary = evidence.summary || {};
  const providerSubmitAllowed = locks.providerSubmitAllowed ?? summary.providerSubmitAllowed;

  return uniqueSorted([
    ...blockedIf(locks.hardLocksPinned === false, `${prefix}_hard_locks_not_pinned`),
    ...blockedIf(
      locks.noDaemon === false ||
        locks.daemonStarted === true ||
        summary.daemonStarted === true ||
        observations.daemonStarted === true,
      `${prefix}_daemon_not_blocked`,
    ),
    ...blockedIf(
      locks.noSpawnAgent === false ||
        locks.noWorkerSpawn === false ||
        locks.workerSpawnAllowed === true ||
        locks.canSpawnAgent === true ||
        locks.agentResumeAllowed === true ||
        summary.workerSpawnAllowed === true ||
        observations.spawnAgentObserved === true ||
        observations.agentResumeObserved === true ||
        observations.workerSpawnObserved === true ||
        observations.subprocessObserved === true,
      `${prefix}_spawn_not_blocked`,
    ),
    ...blockedIf(
      locks.noShellExecution === false ||
        locks.noArbitraryShell === false ||
        locks.arbitraryShellAllowed === true ||
        observations.shellExecutionObserved === true,
      `${prefix}_shell_not_blocked`,
    ),
    ...blockedIf(
      locks.noProviderSubmit === false ||
        locks.noProviderExecution === false ||
        locks.providerSubmissionForbidden === false ||
        locks.canSubmitProvider === true ||
        !providerSubmitValueBlocked(providerSubmitAllowed) ||
        locks.providerCommitAllowed === true ||
        locks.liveSubmitAllowed === true ||
        summary.liveSubmitAllowed === true ||
        observations.providerSubmitObserved === true ||
        observations.providerExecutionObserved === true ||
        observations.providerCommitObserved === true ||
        observations.liveSubmitObserved === true,
      `${prefix}_provider_submit_not_blocked`,
    ),
    ...blockedIf(
      locks.noCredentialRead === false ||
        locks.noCredentialWrite === false ||
        locks.credentialAccessAllowed === true ||
        locks.credentialStorage === true ||
        summary.credentialAccessAllowed === true ||
        summary.credentialStorage === true ||
        observations.credentialReadObserved === true ||
        observations.credentialWriteObserved === true ||
        observations.credentialAccessObserved === true,
      `${prefix}_credential_access_not_blocked`,
    ),
    ...blockedIf(
      locks.noFileMutation === false ||
        locks.fileMutationAllowed === true ||
        summary.fileMutationAllowed === true ||
        observations.fileMutationObserved === true,
      `${prefix}_file_mutation_not_blocked`,
    ),
  ]);
}

function phaseClosureEvidenceDecision(
  input: PhaseRoadmapRuntimeInput,
  config: PhaseRoadmapClosureDecisionConfig,
): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.[config.evidenceKey];

  if (hasClosureEvidence(evidence)) {
    const requiredGateBlockers = config.requiredGates.flatMap((gate) =>
      blockedIf(!closureGateReady(evidence, gate.field), gate.blocker),
    );
    const blockers = uniqueSorted([
      ...closureStatusBlockers(evidence, config.phaseId, config.safetyPrefix),
      ...closureSafetyBlockers(evidence, config.safetyPrefix),
      ...blockedIf(config.requireGatedRuntimeOnly === true && evidence.hardLocks?.gatedRuntimeOnly !== true, `${config.safetyPrefix}_gated_runtime_only_missing`),
      ...blockedIf(config.requireClosedLoopShellOnly === true && evidence.hardLocks?.closedLoopShellOnly !== true, `${config.safetyPrefix}_closed_loop_shell_only_missing`),
      ...requiredGateBlockers,
    ]);

    return {
      evidenceKey: config.evidenceKey,
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  const legacyReady = config.legacyReadyInput === undefined ? undefined : input[config.legacyReadyInput];
  return {
    evidenceKey: config.evidenceKey,
    source: legacyReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: [config.missingBlocker],
    warnings: uniqueSorted([
      ...blockedIf(legacyReady === true, `legacy_${String(config.legacyReadyInput)}_boolean_ignored_without_typed_evidence`),
    ]),
  };
}

function closureNestedValue(evidence: PhaseRoadmapClosureEvidence, section: string, field: string): unknown {
  const record = evidence as unknown as Record<string, unknown>;
  const nested = record[section];
  if (nested === undefined || nested === null || typeof nested !== "object" || Array.isArray(nested)) return undefined;
  return (nested as Record<string, unknown>)[field];
}

function closureAnyTrue(evidence: PhaseRoadmapClosureEvidence, fields: string[]): boolean {
  return fields.some((field) => closureValue(evidence, field) === true);
}

function closureAnyObservedTrue(evidence: PhaseRoadmapClosureEvidence, fields: string[], sections: string[]): boolean {
  const observations = evidence.observations as Record<string, unknown> | undefined;
  return fields.some((field) => {
    if (closureValue(evidence, field) === true) return true;
    if (observations?.[field] === true) return true;
    return sections.some((section) => closureNestedValue(evidence, section, field) === true);
  });
}

function projectFileFactSourceEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const decision = phaseClosureEvidenceDecision(input, {
    evidenceKey: "projectFileFactSource",
    phaseId: "phase_36_project_file_fact_source",
    missingBlocker: "project_file_fact_source_typed_evidence_missing",
    safetyPrefix: "project_file_fact_source",
    legacyReadyInput: "projectFileFactSourceReady",
    requiredGates: [
      { field: "projectVibeEntryDefined", blocker: "project_file_fact_source_entry_missing" },
      { field: "projectFactsAreFileFirst", blocker: "project_file_fact_source_not_file_first" },
      { field: "saveOpenContractDefined", blocker: "project_file_fact_source_save_open_contract_missing" },
      { field: "runtimeStateDerivedFromProjectFiles", blocker: "project_file_fact_source_runtime_derivation_missing" },
      { field: "projectLocalKnowledgePacksScoped", blocker: "project_file_fact_source_knowledge_scope_missing" },
    ],
  });
  const evidence = input.evidence?.projectFileFactSource;
  if (!hasClosureEvidence(evidence)) return decision;

  const blockers = uniqueSorted([
    ...decision.blockers,
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "runtimeStateAsSourceObserved",
          "runtimeStateSourceOfTruthObserved",
          "runtimeStateIsSoleSourceOfTruth",
          "runtimeCacheAsSourceObserved",
        ],
        ["sourceAuthority", "factAuthority", "runtimeState", "runtimeCache", "saveOpenContract"],
      ),
      "project_file_fact_source_runtime_state_as_source_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["chatMemoryAsSourceObserved", "legacyChatAsSourceObserved", "chatHistoryAsSourceObserved"],
        ["sourceAuthority", "factAuthority", "chatMemory", "legacyChat"],
      ),
      "project_file_fact_source_chat_memory_as_source_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["directInputAsAuthorityObserved", "directInputSourceOfTruthObserved", "freeTextAsAuthorityObserved"],
        ["sourceAuthority", "factAuthority", "directInput", "commandInput"],
      ),
      "project_file_fact_source_direct_input_as_authority_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["absolutePathContractObserved", "absolutePathAllowed", "absolutePathProjectFileObserved"],
        ["pathPolicy", "saveOpenContract", "projectFileContract"],
      ),
      "project_file_fact_source_absolute_path_contract_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["parentTraversalObserved", "parentTraversalAccepted", "parentDirectoryTraversalAllowed"],
        ["pathPolicy", "saveOpenContract", "projectFileContract"],
      ),
      "project_file_fact_source_parent_traversal_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "credentialSecretInProjectFileObserved",
          "credentialInProjectFileObserved",
          "secretInProjectFileObserved",
          "tokenInProjectFileObserved",
        ],
        ["security", "secrets", "projectFileContract", "saveOpenContract"],
      ),
      "project_file_fact_source_secret_in_project_file_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "globalKnowledgeAsProjectFactObserved",
          "globalKnowledgeAuthorityObserved",
          "globalKnowledgePackAsProjectFactObserved",
        ],
        ["knowledgeScope", "knowledgePacks", "sourceAuthority", "factAuthority"],
      ),
      "project_file_fact_source_global_knowledge_as_project_fact_observed",
    ),
  ]);

  return {
    ...decision,
    ready: blockers.length === 0,
    blockers,
  };
}

function visualConsistencyContractEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const decision = phaseClosureEvidenceDecision(input, {
    evidenceKey: "visualConsistencyContract",
    phaseId: "phase_37_visual_consistency_contract",
    missingBlocker: "visual_consistency_contract_typed_evidence_missing",
    safetyPrefix: "visual_consistency_contract",
    legacyReadyInput: "visualConsistencyContractReady",
    requiredGates: [
      { field: "identityGateDefined", blocker: "visual_consistency_identity_gate_missing" },
      { field: "sceneGateDefined", blocker: "visual_consistency_scene_gate_missing" },
      { field: "shotLayoutGateDefined", blocker: "visual_consistency_shot_layout_gate_missing" },
      { field: "spatialMemoryGateDefined", blocker: "visual_consistency_spatial_memory_gate_missing" },
      { field: "keyframePairDerivationGateDefined", blocker: "visual_consistency_keyframe_pair_gate_missing" },
      { field: "masterInheritanceQaGateDefined", blocker: "visual_consistency_master_inheritance_qa_missing" },
      { field: "cameraVectorDefined", blocker: "visual_consistency_camera_vector_missing" },
      { field: "worldPositionDefined", blocker: "visual_consistency_world_position_missing" },
      { field: "shotLayoutSubjectDefined", blocker: "visual_consistency_shot_layout_subject_missing" },
      { field: "shotLayoutCameraDefined", blocker: "visual_consistency_shot_layout_camera_missing" },
      { field: "shotLayoutAxisDefined", blocker: "visual_consistency_shot_layout_axis_missing" },
      { field: "shotLayoutAnchorsDefined", blocker: "visual_consistency_shot_layout_anchors_missing" },
    ],
  });
  const evidence = input.evidence?.visualConsistencyContract;
  if (!hasClosureEvidence(evidence)) return decision;

  const blockers = uniqueSorted([
    ...decision.blockers,
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "candidateFutureReferenceObserved",
          "futureReferenceFromCandidate",
          "candidateAsFutureReference",
          "tempFutureReferenceObserved",
          "futureReferenceFromTemp",
          "tempAsFutureReference",
          "rejectedFutureReferenceObserved",
          "futureReferenceFromRejected",
          "rejectedAsFutureReference",
          "contactSheetFutureReferenceObserved",
          "futureReferenceFromContactSheet",
          "contactSheetAsFutureReference",
          "shotOutputFutureReferenceObserved",
          "futureReferenceFromShotOutput",
          "shotOutputAsFutureReference",
        ],
        ["referenceAuthority", "futureReferences", "references", "assetReferences", "referenceSelection"],
      ),
      "visual_consistency_future_reference_pollution",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["derivedViewMissingMasterInheritance", "derivedViewWithoutMasterInheritance", "masterInheritanceMissing"],
        ["sceneAssetPack", "derivedViews", "masterInheritanceQa"],
      ),
      "visual_consistency_derived_view_master_inheritance_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["cameraVectorMissing", "missingCameraVector", "cameraVectorAbsent"],
        ["sceneAssetPack", "derivedViews", "cameraGeometry", "shotLayout"],
      ),
      "visual_consistency_camera_vector_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["worldPositionMissing", "missingWorldPosition", "worldPositionAbsent"],
        ["sceneAssetPack", "derivedViews", "cameraGeometry", "spatialMemory"],
      ),
      "visual_consistency_world_position_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["shotLayoutSubjectMissing", "subjectMissing", "missingSubject"],
        ["shotLayout"],
      ),
      "visual_consistency_shot_layout_subject_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["shotLayoutCameraMissing", "cameraMissing", "missingCamera"],
        ["shotLayout"],
      ),
      "visual_consistency_shot_layout_camera_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["shotLayoutAxisMissing", "axisMissing", "missingAxis"],
        ["shotLayout"],
      ),
      "visual_consistency_shot_layout_axis_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["shotLayoutAnchorsMissing", "anchorsMissing", "missingAnchors"],
        ["shotLayout"],
      ),
      "visual_consistency_shot_layout_anchors_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["independentSameShotEndFrameObserved", "independentSameShotEndFrame", "sameShotEndFrameIndependent"],
        ["keyframePair", "keyframePairDerivation", "endFrameDerivation"],
      ),
      "visual_consistency_independent_same_shot_end_frame",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["largeMotionDriftObserved", "largeMotionDrift", "motionDriftTooLarge"],
        ["motionQa", "spatialMemory", "keyframePair"],
      ),
      "visual_consistency_large_motion_drift",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["semanticOpenCvRepairObserved", "semanticOpenCVRepairObserved", "opencvSemanticRepairObserved", "semanticCvRepairObserved"],
        ["repairPolicy", "opencvRepair", "qaRepair"],
      ),
      "visual_consistency_semantic_opencv_repair",
    ),
  ]);

  return {
    ...decision,
    ready: blockers.length === 0,
    blockers,
  };
}

function fullTaskSubagentPacketPlannerEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const decision = phaseClosureEvidenceDecision(input, {
    evidenceKey: "fullTaskSubagentPacketPlanner",
    phaseId: "phase_38_full_task_subagent_packet_planner",
    missingBlocker: "full_task_subagent_packet_planner_typed_evidence_missing",
    safetyPrefix: "full_task_subagent_packet_planner",
    legacyReadyInput: "subagentPacketPlannerReady",
    requiredGates: [
      { field: "allProductionTaskKindsCovered", blocker: "full_task_subagent_packet_planner_task_kind_coverage_missing" },
      { field: "validatedPacketsRequired", blocker: "full_task_subagent_packet_planner_validated_packet_required_missing" },
      { field: "expectedOutputsRequired", blocker: "full_task_subagent_packet_planner_expected_outputs_missing" },
      { field: "sourceFactTraceRequired", blocker: "full_task_subagent_packet_planner_source_fact_trace_missing" },
      { field: "knowledgeTraceRequired", blocker: "full_task_subagent_packet_planner_knowledge_trace_missing" },
      { field: "freeTextWorkerForbidden", blocker: "full_task_subagent_packet_planner_free_text_worker_not_forbidden" },
    ],
  });
  const evidence = input.evidence?.fullTaskSubagentPacketPlanner;
  if (!hasClosureEvidence(evidence)) return decision;

  const routeOpened =
    closureAnyObservedTrue(
      evidence,
      ["workerRouteOpened", "providerRouteOpened", "fileRouteOpened", "credentialRouteOpened", "shellRouteOpened"],
      ["routeSafety", "routes", "workflowRoutes", "workerRoutes"],
    );

  const blockers = uniqueSorted([
    ...decision.blockers,
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["missingProductionTaskKindCoverage", "productionTaskKindCoverageMissing", "taskKindCoverageMissing"],
        ["taskCoverage", "coverage", "productionTaskKinds"],
      ),
      "full_task_subagent_packet_planner_task_kind_coverage_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["unvalidatedPacketAllowed", "unvalidatedPacketObserved", "formalTaskAcceptsUnvalidatedPacket"],
        ["packetPolicy", "validation", "formalTaskPolicy"],
      ),
      "full_task_subagent_packet_planner_unvalidated_packet_allowed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["missingExpectedOutputsAllowed", "missingExpectedOutputsObserved", "expectedOutputsMissing"],
        ["outputContract", "expectedOutputs", "formalTaskPolicy"],
      ),
      "full_task_subagent_packet_planner_expected_outputs_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["missingSourceFactTraceAllowed", "missingSourceFactTraceObserved", "sourceFactTraceMissing"],
        ["sourceFactTrace", "sourceFacts", "formalTaskPolicy"],
      ),
      "full_task_subagent_packet_planner_source_fact_trace_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["missingKnowledgeTraceAllowed", "missingKnowledgeTraceObserved", "knowledgeTraceMissing"],
        ["knowledgeTrace", "injectedKnowledge", "formalTaskPolicy"],
      ),
      "full_task_subagent_packet_planner_knowledge_trace_missing",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "freeTextWorkerAllowed",
          "freeTextTaskAllowed",
          "freeTextWorkerObserved",
          "freeTextTaskObserved",
          "formalTaskAcceptsFreeText",
          "workerAcceptsFreeText",
        ],
        ["freeTextPolicy", "formalTaskPolicy", "workerPolicy"],
      ),
      "full_task_subagent_packet_planner_free_text_worker_or_task_allowed",
    ),
    ...blockedIf(routeOpened, "full_task_subagent_packet_planner_worker_provider_file_credential_shell_route_open"),
  ]);

  return {
    ...decision,
    ready: blockers.length === 0,
    blockers,
  };
}

function knowledgePackUserManagementEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const decision = phaseClosureEvidenceDecision(input, {
    evidenceKey: "knowledgePackUserManagement",
    phaseId: "phase_39_knowledge_pack_user_management",
    missingBlocker: "knowledge_pack_user_management_typed_evidence_missing",
    safetyPrefix: "knowledge_pack_user_management",
    legacyReadyInput: "knowledgePackUserManagementReady",
    requiredGates: [
      { field: "userImportFlowReady", blocker: "knowledge_pack_user_management_import_flow_missing" },
      { field: "userCreateFlowReady", blocker: "knowledge_pack_user_management_create_flow_missing" },
      { field: "userEnableFlowReady", blocker: "knowledge_pack_user_management_enable_flow_missing" },
      { field: "userDisableFlowReady", blocker: "knowledge_pack_user_management_disable_flow_missing" },
      { field: "versionCheckReady", blocker: "knowledge_pack_user_management_version_check_missing" },
      { field: "hashCheckReady", blocker: "knowledge_pack_user_management_hash_check_missing" },
      { field: "dependencyCheckReady", blocker: "knowledge_pack_user_management_dependency_check_missing" },
      { field: "routeTestReady", blocker: "knowledge_pack_user_management_route_test_missing" },
      { field: "conflictDetectionReady", blocker: "knowledge_pack_user_management_conflict_detection_missing" },
      { field: "providerPolicyPreserved", blocker: "knowledge_pack_user_management_provider_policy_override_possible" },
      { field: "preflightPreserved", blocker: "knowledge_pack_user_management_preflight_override_possible" },
      { field: "referenceAuthorityPreserved", blocker: "knowledge_pack_user_management_reference_authority_override_possible" },
      { field: "keyframePairDerivationPreserved", blocker: "knowledge_pack_user_management_keyframe_pair_override_possible" },
      { field: "qaGatePreserved", blocker: "knowledge_pack_user_management_qa_gate_override_possible" },
      { field: "phase38ValidatedPacketPreserved", blocker: "knowledge_pack_user_management_validated_packet_override_possible" },
      { field: "cannotOverrideHardGates", blocker: "knowledge_pack_user_management_hard_gate_override_possible" },
      { field: "wholeLibraryInjectionForbidden", blocker: "knowledge_pack_user_management_whole_library_injection_possible" },
      { field: "unverifiedExternalImportInjectionForbidden", blocker: "knowledge_pack_user_management_unverified_external_import_injection_possible" },
      { field: "providerCredentialShellFileFreeTextRoutesForbidden", blocker: "knowledge_pack_user_management_provider_credential_shell_file_free_text_route_open" },
      { field: "parkedProviderBypassForbidden", blocker: "knowledge_pack_user_management_parked_provider_bypass_possible" },
      { field: "tempRejectedCandidateShotOutputPromotionForbidden", blocker: "knowledge_pack_user_management_temp_rejected_candidate_shot_output_promotion_possible" },
    ],
  });
  const evidence = input.evidence?.knowledgePackUserManagement;
  if (!hasClosureEvidence(evidence)) return decision;

  const routeOpened = closureAnyObservedTrue(
    evidence,
    [
      "providerRouteOpened",
      "providerSubmitRouteOpened",
      "credentialRouteOpened",
      "shellRouteOpened",
      "fileRouteOpened",
      "freeTextRouteOpened",
      "freeTextTaskObserved",
      "freeTextWorkerObserved",
    ],
    ["routeSafety", "routes", "providerRoutes", "userManagementRoutes", "freeTextPolicy"],
  );

  const blockers = uniqueSorted([
    ...decision.blockers,
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["hardGateOverrideObserved", "hardGateOverrideAllowed", "overrideHardGatesAllowed"],
        ["hardGatePolicy", "overridePolicy", "hardLocks"],
      ),
      "knowledge_pack_user_management_hard_gate_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["providerPolicyOverrideObserved", "providerPolicyOverrideAllowed", "packOverridesProviderPolicy"],
        ["providerPolicy", "overridePolicy"],
      ),
      "knowledge_pack_user_management_provider_policy_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["preflightOverrideObserved", "preflightOverrideAllowed", "packOverridesPreflight"],
        ["preflight", "preflightGate", "overridePolicy"],
      ),
      "knowledge_pack_user_management_preflight_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["referenceAuthorityOverrideObserved", "referenceAuthorityOverrideAllowed", "packOverridesReferenceAuthority"],
        ["referenceAuthority", "overridePolicy"],
      ),
      "knowledge_pack_user_management_reference_authority_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["keyframePairDerivationOverrideObserved", "keyframePairOverrideObserved", "packOverridesKeyframePairDerivation"],
        ["keyframePair", "keyframePairDerivation", "overridePolicy"],
      ),
      "knowledge_pack_user_management_keyframe_pair_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["qaGateOverrideObserved", "qaGateOverrideAllowed", "packOverridesQaGate"],
        ["qaGate", "qa", "overridePolicy"],
      ),
      "knowledge_pack_user_management_qa_gate_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["phase38ValidatedPacketOverrideObserved", "validatedPacketOverrideObserved", "unvalidatedPacketAcceptedByPack"],
        ["phase38", "validatedPacket", "packetPolicy", "overridePolicy"],
      ),
      "knowledge_pack_user_management_validated_packet_override_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["wholeLibraryInjectionObserved", "wholeLibraryInjectionAllowed", "injectsWholeLibrary"],
        ["injectionPolicy", "knowledgeInjection", "routeTest"],
      ),
      "knowledge_pack_user_management_whole_library_injection_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "unverifiedExternalImportInjectionObserved",
          "unverifiedExternalImportInjectionAllowed",
          "externalImportInjectedBeforeVerification",
        ],
        ["externalImport", "importPolicy", "injectionPolicy"],
      ),
      "knowledge_pack_user_management_unverified_external_import_injection_observed",
    ),
    ...blockedIf(routeOpened, "knowledge_pack_user_management_provider_credential_shell_file_free_text_route_open"),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        ["parkedProviderBypassObserved", "parkedProviderBypassAllowed", "packEnablesParkedProvider"],
        ["providerPolicy", "parkedProviders", "overridePolicy"],
      ),
      "knowledge_pack_user_management_parked_provider_bypass_observed",
    ),
    ...blockedIf(
      closureAnyObservedTrue(
        evidence,
        [
          "tempAssetFormalPromotionObserved",
          "rejectedAssetFormalPromotionObserved",
          "candidateAssetFormalPromotionObserved",
          "shotOutputFormalPromotionObserved",
          "tempRejectedCandidateShotOutputPromotionObserved",
          "packPromotesInformalAsset",
        ],
        ["assetPromotion", "referenceAuthority", "formalReferencePolicy"],
      ),
      "knowledge_pack_user_management_temp_rejected_candidate_shot_output_promotion_observed",
    ),
  ]);

  return {
    ...decision,
    ready: blockers.length === 0,
    blockers,
  };
}

function workerRuntimeGateEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const decision = phaseClosureEvidenceDecision(input, {
    evidenceKey: "workerRuntimeGate",
    phaseId: "phase_40_worker_runtime_gate",
    missingBlocker: "worker_runtime_gate_typed_evidence_missing",
    safetyPrefix: "worker_runtime_gate",
    legacyReadyInput: "workerRuntimeGateReady",
    requireGatedRuntimeOnly: true,
    requiredGates: [
      { field: "workerRuntimeContractDefined", blocker: "worker_runtime_gate_contract_missing" },
      { field: "defaultGatedOff", blocker: "worker_runtime_gate_default_not_gated" },
      { field: "validatedEnvelopeOnly", blocker: "worker_runtime_gate_validated_envelope_missing" },
      { field: "structuredResultOnly", blocker: "worker_runtime_gate_structured_result_missing" },
      { field: "noActualSpawnByDefault", blocker: "worker_runtime_gate_spawn_not_blocked" },
      { field: "noDaemonByDefault", blocker: "worker_runtime_gate_daemon_not_blocked" },
      { field: "noShellExecution", blocker: "worker_runtime_gate_shell_not_blocked" },
      { field: "noCredentialAccess", blocker: "worker_runtime_gate_credential_access_not_blocked" },
      { field: "noFileMutation", blocker: "worker_runtime_gate_file_mutation_not_blocked" },
      { field: "noProviderSubmit", blocker: "worker_runtime_gate_provider_submit_not_blocked" },
      { field: "noFreeTextWorker", blocker: "worker_runtime_gate_free_text_worker_not_blocked" },
      { field: "noAgentResumeByDefault", blocker: "worker_runtime_gate_resume_not_blocked" },
    ],
  });
  const evidence = input.evidence?.workerRuntimeGate;
  if (!hasClosureEvidence(evidence)) return decision;

  const freeTextWorkerObserved = closureAnyObservedTrue(
    evidence,
    ["freeTextWorkerObserved", "freeTextTaskObserved", "freeTextWorkerAccepted", "freeTextTaskAccepted"],
    ["runtimeGate", "inputContract", "executionPolicy", "routeSafety"],
  );
  const agentResumeObserved = closureAnyObservedTrue(
    evidence,
    ["agentResumeObserved", "resumeAgentObserved", "agentResumeAccepted"],
    ["runtimeGate", "executionPolicy"],
  );
  const unvalidatedEnvelopeAccepted = closureAnyObservedTrue(
    evidence,
    ["unvalidatedEnvelopeAccepted", "unvalidatedEnvelopeAllowed", "rawEnvelopeAccepted"],
    ["inputContract", "runtimeGate", "executionPolicy"],
  );
  const unstructuredResultAccepted = closureAnyObservedTrue(
    evidence,
    ["unstructuredResultAccepted", "unstructuredResultAllowed", "freeTextResultAccepted"],
    ["outputContract", "runtimeGate", "executionPolicy"],
  );
  const defaultGateOpened = closureAnyObservedTrue(
    evidence,
    ["defaultGateOpened", "gateDefaultOn", "defaultGatedOn", "defaultGateOpen"],
    ["runtimeGate", "executionPolicy"],
  );
  const blockers = uniqueSorted([
    ...decision.blockers,
    ...blockedIf(freeTextWorkerObserved, "worker_runtime_gate_free_text_worker_not_blocked"),
    ...blockedIf(agentResumeObserved, "worker_runtime_gate_resume_not_blocked"),
    ...blockedIf(unvalidatedEnvelopeAccepted, "worker_runtime_gate_unvalidated_envelope_accepted"),
    ...blockedIf(unstructuredResultAccepted, "worker_runtime_gate_unstructured_result_accepted"),
    ...blockedIf(defaultGateOpened, "worker_runtime_gate_default_not_gated"),
  ]);

  return {
    ...decision,
    ready: blockers.length === 0,
    blockers,
  };
}

function providerClosedLoopShellEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.providerClosedLoopShell;

  if (hasClosureEvidence(evidence)) {
    const requiredGates = [
      { field: "image2ClosedLoopShellDefined", blocker: "provider_closed_loop_shell_image2_missing" },
      { field: "seedanceClosedLoopShellDefined", blocker: "provider_closed_loop_shell_seedance_missing" },
      { field: "watcherRequired", blocker: "provider_closed_loop_shell_watcher_missing" },
      { field: "manifestRequired", blocker: "provider_closed_loop_shell_manifest_missing" },
      { field: "qaGateRequired", blocker: "provider_closed_loop_shell_qa_gate_missing" },
      { field: "promotionGateRequired", blocker: "provider_closed_loop_shell_promotion_gate_missing" },
      { field: "workerSelfReportCannotComplete", blocker: "provider_closed_loop_shell_worker_self_report_can_complete" },
      { field: "providerCommitDefaultGated", blocker: "provider_closed_loop_shell_default_not_gated" },
      { field: "noActualProviderSubmit", blocker: "provider_closed_loop_shell_provider_submit_not_blocked" },
      { field: "noLiveSubmit", blocker: "provider_closed_loop_shell_live_submit_not_blocked" },
      { field: "noCredentialAccess", blocker: "provider_closed_loop_shell_credential_access_not_blocked" },
      { field: "noFileMutation", blocker: "provider_closed_loop_shell_file_mutation_not_blocked" },
      { field: "noWorkerSpawn", blocker: "provider_closed_loop_shell_worker_spawn_not_blocked" },
      { field: "noShellExecution", blocker: "provider_closed_loop_shell_shell_not_blocked" },
      { field: "forbiddenProviderModesAbsent", blocker: "provider_closed_loop_shell_forbidden_provider_modes_present" },
    ];
    const requiredGateBlockers = requiredGates.flatMap((gate) =>
      blockedIf(!closureGateReady(evidence, gate.field), gate.blocker),
    );
    const providerSubmitObserved = closureAnyObservedTrue(
      evidence,
      ["providerSubmitObserved", "providerExecutionObserved", "providerCommitObserved"],
      ["providerShells", "providerCommitGate", "executionPolicy", "providerExecution", "providerSubmit"],
    );
    const liveSubmitObserved = closureAnyObservedTrue(
      evidence,
      ["liveSubmitObserved", "liveSubmitAllowed"],
      ["providerShells", "providerCommitGate", "executionPolicy", "liveSubmit"],
    );
    const credentialObserved = closureAnyObservedTrue(
      evidence,
      [
        "credentialReadObserved",
        "credentialWriteObserved",
        "credentialAccessObserved",
        "credentialRead",
        "credentialWrite",
        "credentialAccess",
      ],
      ["credentialPolicy", "credentials", "providerShells", "executionPolicy"],
    );
    const apiKeyCreatedObserved = closureAnyObservedTrue(
      evidence,
      ["apiKeyCreatedObserved", "apiKeyCreateObserved", "apiKeyCreated", "apiKeyCreationObserved"],
      ["credentialPolicy", "credentials", "providerShells"],
    );
    const workerSpawnObserved = closureAnyObservedTrue(
      evidence,
      ["workerSpawnObserved", "subprocessObserved", "spawnAgentObserved", "workerSpawnAllowed"],
      ["workerPolicy", "executionPolicy", "providerShells"],
    );
    const shellExecutionObserved = closureAnyObservedTrue(
      evidence,
      ["shellExecutionObserved", "shellExecutionAllowed", "arbitraryShellAllowed"],
      ["workerPolicy", "executionPolicy", "providerShells"],
    );
    const fileMutationObserved = closureAnyObservedTrue(
      evidence,
      ["fileMutationObserved", "fileMutationAllowed"],
      ["workerPolicy", "executionPolicy", "providerShells"],
    );
    const defaultGateOpened = closureAnyObservedTrue(
      evidence,
      ["providerCommitDefaultOn", "defaultGateOpened", "defaultGateOpen", "gateDefaultOn"],
      ["providerCommitGate", "executionPolicy", "providerShells"],
    );
    const workerSelfReportCompletionAccepted = closureAnyObservedTrue(
      evidence,
      ["workerSelfReportCompletionAccepted", "workerSelfReportAccepted", "workerSelfReportCanComplete"],
      ["promotionGate", "qaGate", "workerPolicy", "completionGate"],
    );
    const missingExpectedOutputAccepted = closureAnyObservedTrue(
      evidence,
      ["missingExpectedOutputAccepted", "missingExpectedOutputsAccepted", "expectedOutputMissingAccepted"],
      ["promotionGate", "qaGate", "manifest", "expectedOutput"],
    );
    const manifestMissingAccepted = closureAnyObservedTrue(
      evidence,
      ["manifestMissingAccepted", "manifestMissingObserved", "missingManifestAccepted"],
      ["manifest", "promotionGate"],
    );
    const qaMissingAccepted = closureAnyObservedTrue(
      evidence,
      ["qaMissingAccepted", "qaGateMissingAccepted", "missingQaAccepted"],
      ["qaGate", "promotionGate"],
    );
    const promotionWithoutQaObserved = closureAnyObservedTrue(
      evidence,
      ["promotionWithoutQaObserved", "promotionWithoutQaAccepted", "promotionGateWithoutQa"],
      ["promotionGate", "qaGate"],
    );
    const forbiddenProviderModeObserved = closureAnyObservedTrue(
      evidence,
      [
        "fastModelObserved",
        "vipChannelObserved",
        "textToVideoMainPathObserved",
        "bgmInVideoPromptObserved",
        "fastModelAllowed",
        "vipChannelAllowed",
        "textToVideoMainPathAllowed",
        "bgmInVideoPromptAllowed",
      ],
      ["providerModePolicy", "providerShells", "executionPolicy"],
    );
    const blockers = uniqueSorted([
      ...closureStatusBlockers(evidence, "phase_41_provider_closed_loop_shell", "provider_closed_loop_shell"),
      ...closureSafetyBlockers(evidence, "provider_closed_loop_shell"),
      ...blockedIf(evidence.hardLocks?.closedLoopShellOnly !== true, "provider_closed_loop_shell_closed_loop_shell_only_missing"),
      ...requiredGateBlockers,
      ...blockedIf(providerSubmitObserved, "provider_closed_loop_shell_provider_submit_not_blocked"),
      ...blockedIf(liveSubmitObserved, "provider_closed_loop_shell_live_submit_not_blocked"),
      ...blockedIf(credentialObserved, "provider_closed_loop_shell_credential_access_not_blocked"),
      ...blockedIf(apiKeyCreatedObserved, "provider_closed_loop_shell_api_key_creation_observed"),
      ...blockedIf(workerSpawnObserved, "provider_closed_loop_shell_worker_spawn_not_blocked"),
      ...blockedIf(shellExecutionObserved, "provider_closed_loop_shell_shell_not_blocked"),
      ...blockedIf(fileMutationObserved, "provider_closed_loop_shell_file_mutation_not_blocked"),
      ...blockedIf(defaultGateOpened, "provider_closed_loop_shell_default_not_gated"),
      ...blockedIf(workerSelfReportCompletionAccepted, "provider_closed_loop_shell_worker_self_report_can_complete"),
      ...blockedIf(missingExpectedOutputAccepted, "provider_closed_loop_shell_expected_output_gate_missing"),
      ...blockedIf(manifestMissingAccepted, "provider_closed_loop_shell_manifest_missing"),
      ...blockedIf(qaMissingAccepted, "provider_closed_loop_shell_qa_gate_missing"),
      ...blockedIf(promotionWithoutQaObserved, "provider_closed_loop_shell_promotion_without_qa_observed"),
      ...blockedIf(forbiddenProviderModeObserved, "provider_closed_loop_shell_forbidden_provider_modes_present"),
    ]);

    return {
      evidenceKey: "providerClosedLoopShell",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  return {
    evidenceKey: "providerClosedLoopShell",
    source: input.providerClosedLoopShellReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: ["provider_closed_loop_shell_typed_evidence_missing"],
    warnings: uniqueSorted([
      ...blockedIf(
        input.providerClosedLoopShellReady === true,
        "legacy_providerClosedLoopShellReady_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function betaAcceptanceEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.betaAcceptance;

  if (hasClosureEvidence(evidence)) {
    const requiredGates = [
      { field: "macDesktopReadiness", blocker: "beta_acceptance_mac_desktop_missing" },
      { field: "windowsDesktopReadiness", blocker: "beta_acceptance_windows_desktop_missing" },
      { field: "projectSaveOpen", blocker: "beta_acceptance_project_save_open_missing" },
      { field: "previewExport", blocker: "beta_acceptance_preview_export_missing" },
      { field: "queueVisibility", blocker: "beta_acceptance_queue_visibility_missing" },
      { field: "visualConsistency", blocker: "beta_acceptance_visual_consistency_missing" },
      { field: "knowledgePackManagement", blocker: "beta_acceptance_knowledge_pack_missing" },
      { field: "workerRuntimeGate", blocker: "beta_acceptance_worker_runtime_gate_missing" },
      { field: "providerClosedLoopShell", blocker: "beta_acceptance_provider_closed_loop_shell_missing" },
      { field: "providerGate", blocker: "beta_acceptance_provider_gate_missing" },
      { field: "tests", blocker: "beta_acceptance_tests_missing" },
      { field: "noAdditionalPhasesPlanned", blocker: "beta_acceptance_no_additional_phases_planned_missing" },
      { field: "betaAcceptanceOwnsClosure", blocker: "beta_acceptance_owns_closure_missing" },
      { field: "finalPhaseNumberLocked", blocker: "beta_acceptance_final_phase_number_not_42" },
    ];
    const requiredGateBlockers = requiredGates.flatMap((gate) =>
      blockedIf(!closureGateReady(evidence, gate.field), gate.blocker),
    );
    const providerSubmitObserved = closureAnyObservedTrue(
      evidence,
      ["providerSubmitObserved", "providerExecutionObserved", "providerCommitObserved"],
      ["providerPolicy", "executionPolicy", "betaClosure"],
    );
    const liveSubmitObserved = closureAnyObservedTrue(
      evidence,
      ["liveSubmitObserved", "liveSubmitAllowed"],
      ["providerPolicy", "executionPolicy", "betaClosure"],
    );
    const workerSpawnObserved = closureAnyObservedTrue(
      evidence,
      ["spawnAgentObserved", "workerSpawnObserved", "subprocessObserved", "workerSpawnAllowed"],
      ["workerPolicy", "executionPolicy", "betaClosure"],
    );
    const shellExecutionObserved = closureAnyObservedTrue(
      evidence,
      ["shellExecutionObserved", "shellExecutionAllowed", "arbitraryShellAllowed"],
      ["workerPolicy", "executionPolicy", "betaClosure"],
    );
    const credentialObserved = closureAnyObservedTrue(
      evidence,
      ["credentialReadObserved", "credentialWriteObserved", "credentialAccessObserved"],
      ["providerPolicy", "executionPolicy", "betaClosure"],
    );
    const fileMutationObserved = closureAnyObservedTrue(
      evidence,
      ["fileMutationObserved", "fileMutationAllowed"],
      ["workerPolicy", "executionPolicy", "betaClosure"],
    );
    const apiKeyCreatedObserved = closureAnyObservedTrue(
      evidence,
      ["apiKeyCreatedObserved", "apiKeyCreated", "apiKeyCreationObserved"],
      ["providerPolicy", "executionPolicy", "betaClosure"],
    );
    const additionalPhaseRequested = closureAnyObservedTrue(
      evidence,
      ["additionalPhaseRequested", "newPhaseRequested", "roadmapExtensionRequested"],
      ["betaClosure", "roadmap"],
    );
    const phaseAfter42Observed = closureAnyObservedTrue(
      evidence,
      ["phaseAfter42Observed", "postPhase42Observed", "realTestRoundObserved"],
      ["betaClosure", "roadmap"],
    );
    const finalPhaseNumber = closureValue(evidence, "finalPhaseNumber") ?? evidence.summary?.finalPhaseNumber;
    const maxPhaseNumber = closureValue(evidence, "maxPhaseNumber") ?? evidence.summary?.maxPhaseNumber;
    const finalPhaseNumberNot42 =
      closureAnyObservedTrue(evidence, ["finalPhaseNumberNot42"], ["betaClosure", "roadmap"]) ||
      (typeof finalPhaseNumber === "number" && finalPhaseNumber !== 42) ||
      (typeof maxPhaseNumber === "number" && maxPhaseNumber > 42);
    const observations = (evidence.observations || {}) as NonNullable<PhaseRoadmapBetaAcceptanceEvidence["observations"]>;
    const blockers = uniqueSorted([
      ...closureStatusBlockers(evidence, "phase_42_export_desktop_beta_acceptance", "beta_acceptance"),
      ...closureSafetyBlockers(evidence, "beta_acceptance"),
      ...requiredGateBlockers,
      ...blockedIf(observations.macDesktopMissing === true, "beta_acceptance_mac_desktop_missing"),
      ...blockedIf(observations.windowsDesktopMissing === true, "beta_acceptance_windows_desktop_missing"),
      ...blockedIf(observations.projectSaveOpenMissing === true, "beta_acceptance_project_save_open_missing"),
      ...blockedIf(observations.previewExportMissing === true, "beta_acceptance_preview_export_missing"),
      ...blockedIf(observations.queueVisibilityMissing === true, "beta_acceptance_queue_visibility_missing"),
      ...blockedIf(observations.visualConsistencyMissing === true, "beta_acceptance_visual_consistency_missing"),
      ...blockedIf(observations.knowledgePackMissing === true, "beta_acceptance_knowledge_pack_missing"),
      ...blockedIf(observations.workerRuntimeGateMissing === true, "beta_acceptance_worker_runtime_gate_missing"),
      ...blockedIf(observations.providerClosedLoopShellMissing === true, "beta_acceptance_provider_closed_loop_shell_missing"),
      ...blockedIf(observations.providerGateMissing === true, "beta_acceptance_provider_gate_missing"),
      ...blockedIf(observations.testsMissing === true, "beta_acceptance_tests_missing"),
      ...blockedIf(additionalPhaseRequested, "beta_acceptance_additional_phase_requested"),
      ...blockedIf(phaseAfter42Observed, "beta_acceptance_phase_after_42_observed"),
      ...blockedIf(finalPhaseNumberNot42, "beta_acceptance_final_phase_number_not_42"),
      ...blockedIf(providerSubmitObserved, "beta_acceptance_provider_submit_not_blocked"),
      ...blockedIf(liveSubmitObserved, "beta_acceptance_live_submit_not_blocked"),
      ...blockedIf(workerSpawnObserved, "beta_acceptance_worker_spawn_not_blocked"),
      ...blockedIf(shellExecutionObserved, "beta_acceptance_shell_not_blocked"),
      ...blockedIf(credentialObserved, "beta_acceptance_credential_access_not_blocked"),
      ...blockedIf(fileMutationObserved, "beta_acceptance_file_mutation_not_blocked"),
      ...blockedIf(apiKeyCreatedObserved, "beta_acceptance_api_key_creation_observed"),
    ]);

    return {
      evidenceKey: "betaAcceptance",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  return {
    evidenceKey: "betaAcceptance",
    source: input.betaAcceptanceReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: ["beta_acceptance_typed_evidence_missing"],
    warnings: uniqueSorted([
      ...blockedIf(
        input.betaAcceptanceReady === true,
        "legacy_betaAcceptanceReady_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function taskQueueVisibilityEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.taskQueueVisibility;

  if (hasClosureEvidence(evidence)) {
    const observations = evidence.observations || {};
    const dangerousControlsPresent =
      closureAnyTrue(evidence, [
        "runSubmitExecuteControlsPresent",
        "runControlPresent",
        "submitControlPresent",
        "executeControlPresent",
      ]) ||
      closureNestedValue(evidence, "directorSurface", "runSubmitExecuteControlsPresent") === true ||
      closureNestedValue(evidence, "directorSurface", "runControlPresent") === true ||
      closureNestedValue(evidence, "directorSurface", "submitControlPresent") === true ||
      closureNestedValue(evidence, "directorSurface", "executeControlPresent") === true ||
      observations.runControlObserved === true ||
      observations.submitControlObserved === true ||
      observations.executeControlObserved === true;
    const queueDetailsOnDirectorSurface =
      closureAnyTrue(evidence, [
        "queueDetailsOnDirectorSurface",
        "queueDetailsOnDirectorSurfaceVisible",
        "queueDetailsVisibleOnDirectorSurface",
      ]) ||
      closureNestedValue(evidence, "directorSurface", "queueDetailsVisible") === true ||
      closureNestedValue(evidence, "directorSurface", "queueDetailsOnDirectorSurface") === true ||
      observations.queueDetailsOnDirectorSurfaceObserved === true;
    const workerProviderFileCredentialShellRouteOpened =
      closureAnyTrue(evidence, [
        "workerRouteOpened",
        "providerRouteOpened",
        "fileRouteOpened",
        "credentialRouteOpened",
        "shellRouteOpened",
      ]) ||
      closureNestedValue(evidence, "routeSafety", "workerRouteOpened") === true ||
      closureNestedValue(evidence, "routeSafety", "providerRouteOpened") === true ||
      closureNestedValue(evidence, "routeSafety", "fileRouteOpened") === true ||
      closureNestedValue(evidence, "routeSafety", "credentialRouteOpened") === true ||
      closureNestedValue(evidence, "routeSafety", "shellRouteOpened") === true ||
      observations.workerRouteOpened === true ||
      observations.providerRouteOpened === true ||
      observations.fileRouteOpened === true ||
      observations.credentialRouteOpened === true ||
      observations.shellRouteOpened === true;
    const requiredGateBlockers = [
      { field: "readOnlyProgressStrip", blocker: "task_queue_visibility_read_only_progress_strip_missing" },
      { field: "consumesLocalOrchestratorSummary", blocker: "task_queue_visibility_local_orchestrator_summary_missing" },
      { field: "noQueueDetailsOnDirectorSurface", blocker: "task_queue_visibility_queue_details_on_director_surface" },
      { field: "noRunSubmitExecuteControls", blocker: "task_queue_visibility_execute_controls_present" },
      { field: "noWorkerProviderFileCredentialShellRoutes", blocker: "task_queue_visibility_worker_provider_file_credential_shell_route_open" },
    ].flatMap((gate) => blockedIf(!closureGateReady(evidence, gate.field), gate.blocker));
    const blockers = uniqueSorted([
      ...closureStatusBlockers(evidence, "phase_35_task_queue_visibility_progress_strip", "task_queue_visibility"),
      ...closureSafetyBlockers(evidence, "task_queue_visibility"),
      ...requiredGateBlockers,
      ...blockedIf(dangerousControlsPresent, "task_queue_visibility_execute_controls_present"),
      ...blockedIf(queueDetailsOnDirectorSurface, "task_queue_visibility_queue_details_on_director_surface"),
      ...blockedIf(
        workerProviderFileCredentialShellRouteOpened,
        "task_queue_visibility_worker_provider_file_credential_shell_route_open",
      ),
    ]);

    return {
      evidenceKey: "taskQueueVisibility",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  return {
    evidenceKey: "taskQueueVisibility",
    source: input.taskQueueVisibilityReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: ["task_queue_visibility_typed_evidence_missing"],
    warnings: uniqueSorted([
      ...blockedIf(
        input.taskQueueVisibilityReady === true,
        "legacy_taskQueueVisibilityReady_boolean_ignored_without_typed_evidence",
      ),
    ]),
  };
}

function localOrchestratorRuntimeEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const evidence = input.evidence?.localOrchestratorRuntime;

  if (hasClosureEvidence(evidence)) {
    const queue = evidence.queue || [];
    const projectRuntimeStateReady = closureGateReady(evidence, "projectRuntimeStateLocalOrchestratorPresent") ||
      (evidence.schemaVersion === "0.1.0" && Array.isArray(evidence.queue));
    const queueLocksPinned = queue.every((item) =>
      item.canExecute === false &&
      item.canSpawnAgent === false &&
      item.providerSubmissionForbidden === true &&
      item.liveSubmitAllowed === false &&
      item.noFileMutation === true,
    );
    const completionGatePinned = queue.every((item) => {
      if (item.queueStatus !== "complete_verified" && item.completionGate?.completeVerified !== true) return true;
      return item.completionGate?.workerSelfReportOnly !== true &&
        item.completionGate?.expectedOutputDeclared === true &&
        item.completionGate?.expectedOutputObserved === true &&
        item.completionGate?.manifestMatched === true &&
        item.completionGate?.qaPass === true &&
        item.completionGate?.promotionGatePassed === true;
    });
    const autoContinuePlanOnly = evidence.autoContinuePlan?.mode === "plan_only" ||
      closureGateReady(evidence, "autoContinuePlanOnly");
    const activityStatesPresent = queue.length > 0 &&
      queue.every((item) =>
        item.agentActivity !== undefined &&
        typeof item.agentActivity.retryBudget === "number" &&
        typeof item.agentActivity.state === "string" &&
        typeof item.agentActivity.stalled === "boolean" &&
        typeof item.agentActivity.manualReviewRequired === "boolean",
      );
    const blockers = uniqueSorted([
      ...closureStatusBlockers(evidence, "phase_34_local_orchestrator_runtime_integration", "local_orchestrator_runtime"),
      ...closureSafetyBlockers(evidence, "local_orchestrator_runtime"),
      ...blockedIf(!projectRuntimeStateReady, "local_orchestrator_runtime_state_missing"),
      ...blockedIf(evidence.dryRunOnly !== true || evidence.hardLocks?.dryRunOnly !== true, "local_orchestrator_runtime_dry_run_missing"),
      ...blockedIf(evidence.planOnly !== true || evidence.hardLocks?.planOnly !== true, "local_orchestrator_runtime_plan_only_missing"),
      ...blockedIf(evidence.hardLocks?.noDaemon !== true || evidence.hardLocks?.daemonStarted !== false, "local_orchestrator_runtime_daemon_not_blocked"),
      ...blockedIf(evidence.hardLocks?.noSpawnAgent !== true || evidence.hardLocks?.noSubprocess !== true, "local_orchestrator_runtime_spawn_not_blocked"),
      ...blockedIf(evidence.hardLocks?.noShellExecution !== true, "local_orchestrator_runtime_shell_not_blocked"),
      ...blockedIf(evidence.hardLocks?.noProviderExecution !== true, "local_orchestrator_runtime_provider_submit_not_blocked"),
      ...blockedIf(evidence.providerSubmissionForbidden !== true, "local_orchestrator_runtime_provider_submit_not_blocked"),
      ...blockedIf(evidence.liveSubmitAllowed !== false, "local_orchestrator_runtime_provider_submit_not_blocked"),
      ...blockedIf(evidence.noFileMutation !== true, "local_orchestrator_runtime_file_mutation_not_blocked"),
      ...blockedIf(evidence.daemonStarted !== false, "local_orchestrator_runtime_daemon_not_blocked"),
      ...blockedIf(queue.length === 0, "local_orchestrator_runtime_queue_missing"),
      ...blockedIf(!queueLocksPinned, "local_orchestrator_runtime_queue_locks_not_pinned"),
      ...blockedIf(!completionGatePinned, "local_orchestrator_runtime_completion_gate_not_pinned"),
      ...blockedIf(!autoContinuePlanOnly, "local_orchestrator_runtime_auto_continue_not_plan_only"),
      ...blockedIf(!activityStatesPresent, "local_orchestrator_runtime_activity_states_missing"),
      ...blockedIf(evidence.hardLocks?.noCredentialRead !== true || evidence.hardLocks?.noCredentialWrite !== true, "local_orchestrator_runtime_credential_access_not_blocked"),
      ...blockedIf(evidence.hardLocks?.workerSelfReportCannotComplete !== true, "local_orchestrator_runtime_worker_self_report_can_complete"),
      ...blockedIf(evidence.hardLocks?.expectedOutputRequired !== true, "local_orchestrator_runtime_expected_output_gate_missing"),
      ...blockedIf(evidence.hardLocks?.manifestRequired !== true, "local_orchestrator_runtime_manifest_gate_missing"),
      ...blockedIf(evidence.hardLocks?.qaGateRequired !== true, "local_orchestrator_runtime_qa_gate_missing"),
    ]);

    return {
      evidenceKey: "localOrchestratorRuntime",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(evidence.warnings || []),
    };
  }

  return {
    evidenceKey: "localOrchestratorRuntime",
    source: input.localOrchestratorRuntimeReady === undefined ? "missing" : "legacy_boolean_override",
    ready: false,
    blockers: ["local_orchestrator_runtime_typed_evidence_missing"],
    warnings: uniqueSorted([
      ...blockedIf(input.localOrchestratorRuntimeReady === true, "legacy_localOrchestratorRuntimeReady_boolean_ignored_without_typed_evidence"),
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
  const agentCliAdapterDecision = agentCliAdapterEvidenceDecision(input);
  const exportWorkerDecision = exportWorkerEvidenceDecision(input);
  const voiceAudioSettingsDecision = voiceAudioSettingsEvidenceDecision(input);
  const providerConfirmationDecision = providerConfirmationEvidenceDecision(input);
  const providerPacketDecision = providerPacketEvidenceDecision(input);
  const watcherClosedLoopDecision = watcherClosedLoopEvidenceDecision(input);
  const forbiddenProviderModesDecision = forbiddenProviderModesEvidenceDecision(input);
  const providerExecutionPermissionDecision = providerExecutionPermissionGateEvidenceDecision(input);
  const providerActionConfirmationReceiptDecision = providerActionConfirmationReceiptEvidenceDecision(input);
  const providerExecutionHandoffDecision = providerExecutionHandoffEvidenceDecision(input);
  const localOrchestratorRuntimeDecision = localOrchestratorRuntimeEvidenceDecision(input);
  const taskQueueVisibilityDecision = taskQueueVisibilityEvidenceDecision(input);
  const projectFileFactSourceDecision = projectFileFactSourceEvidenceDecision(input);
  const visualConsistencyContractDecision = visualConsistencyContractEvidenceDecision(input);
  const fullTaskSubagentPacketPlannerDecision = fullTaskSubagentPacketPlannerEvidenceDecision(input);
  const knowledgePackUserManagementDecision = knowledgePackUserManagementEvidenceDecision(input);
  const workerRuntimeGateDecision = workerRuntimeGateEvidenceDecision(input);
  const providerClosedLoopShellDecision = providerClosedLoopShellEvidenceDecision(input);
  const betaAcceptanceDecision = betaAcceptanceEvidenceDecision(input);
  const evidenceDecisions = [
    projectFactsDecision,
    envelopeDecision,
    agentCliMockRunnerDecision,
    agentCliAdapterDecision,
    exportWorkerDecision,
    voiceAudioSettingsDecision,
    providerConfirmationDecision,
    providerPacketDecision,
    watcherClosedLoopDecision,
    forbiddenProviderModesDecision,
    providerExecutionPermissionDecision,
    providerActionConfirmationReceiptDecision,
    providerExecutionHandoffDecision,
    localOrchestratorRuntimeDecision,
    taskQueueVisibilityDecision,
    projectFileFactSourceDecision,
    visualConsistencyContractDecision,
    fullTaskSubagentPacketPlannerDecision,
    knowledgePackUserManagementDecision,
    workerRuntimeGateDecision,
    providerClosedLoopShellDecision,
    betaAcceptanceDecision,
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
        "The runner proves the command/result contract is replaceable without spawning agent.",
        "The runner returns no-op structured results and never submits providers.",
        "The runner cannot read credentials, run arbitrary shell, or mutate files.",
      ],
      notes: [
        "Phase 26 is the replaceability proof, not the real agent CLI integration.",
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
        "This is the only Phase 24-33 plan item with fileMutationAllowed=true.",
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
      phaseId: "phase_29_cli_adapter_spike",
      phaseNumber: 29,
      title: "Agent CLI Adapter Spike",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
      ],
      readyPhases,
      ownBlockers: uniqueSorted([
        ...blockedIf(!agentCliMockRunnerDecision.ready, "phase_26_replacement_proof_missing"),
        ...agentCliAdapterDecision.blockers,
      ]),
      readyStatus: "ready_for_adapter_spike",
      requiredInputs: [
        "evidence.agentCliMockRunner.replacementProofReady",
        "evidence.agentCliAdapter",
        "validated-envelope-only input",
        "structured result contract",
        "provider/credential/shell/file/free-text/actual-spawn-resume blocked",
      ],
      acceptanceCriteria: [
        "Adapter spike may describe spawn/resume shape only after Phase 26 proves replaceability.",
        "Adapter input remains the validated envelope, never a free text task.",
        "Adapter output remains structured and provider submission remains blocked.",
        "Actual agent spawn/resume, credentials, arbitrary shell, and file mutation remain unavailable in Phase 29.",
      ],
      notes: [
        "Phase 29 is a contract-only spike; real agent spawn/resume execution is still postponed.",
        "The legacy agentCliAdapterDryRunReady boolean is ignored unless typed evidence is present.",
        ...evidenceNotes([agentCliAdapterDecision]),
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
        "phase_29_cli_adapter_spike",
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
        "phase_29_cli_adapter_spike",
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
        "It prepares confirmation requests; it does not call Image2, Seedance, Jimeng, agent, or a sidecar.",
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
        "phase_29_cli_adapter_spike",
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
    makePhase({
      phaseId: "phase_33_provider_execution_handoff",
      phaseNumber: 33,
      title: "Provider Execution Handoff / Final Action Gate",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
        "phase_27_export_worker_mvp",
        "phase_28_voice_audio_settings_ui",
        "phase_29_cli_adapter_spike",
        "phase_30_provider_enablement_gate",
        "phase_31_provider_execution_permission_gate",
        "phase_32_action_time_confirmation_receipt",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(providerExecutionHandoffDecision.blockers),
      readyStatus: "ready_for_final_handoff_review",
      requiredInputs: [
        "evidence.providerExecutionHandoff",
        "Phase 32 typed receipt evidence consumed",
        "action-time confirmation evidence present",
        "user confirmation captured at action time",
        "provider/credential/automatic-submit/worker/file routes blocked",
      ],
      acceptanceCriteria: [
        "Final handoff evidence is structured typed evidence, not a legacy boolean.",
        "The handoff consumes Phase 32 receipt evidence and requires action-time confirmation evidence before it can be reviewed.",
        "Provider submit, live submit, credentials, automatic submit, worker spawn, and file mutation remain blocked.",
        "Fast, VIP, text-to-video, and BGM-in-video prompt paths remain absent.",
      ],
      notes: [
        "Phase 33 is the final handoff review gate only; it still does not execute providers, spawn workers, read credentials, or mutate files.",
        "Default Phase 32 evidence has confirmedReceiptCount=0, so Phase 33 remains blocked until action-time confirmation evidence exists.",
        ...evidenceNotes([providerExecutionHandoffDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_34_local_orchestrator_runtime_integration",
      phaseNumber: 34,
      title: "Local Orchestrator Runtime Integration",
      requiredPrecedingPhases: [
        "phase_24_subagent_runtime_gate",
        "phase_25_knowledge_pack_manager",
        "phase_26_agent_cli_mock_runner",
        "phase_27_export_worker_mvp",
        "phase_28_voice_audio_settings_ui",
        "phase_29_cli_adapter_spike",
        "phase_30_provider_enablement_gate",
        "phase_31_provider_execution_permission_gate",
        "phase_32_action_time_confirmation_receipt",
        "phase_33_provider_execution_handoff",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(localOrchestratorRuntimeDecision.blockers),
      readyStatus: "ready_for_runtime_integration",
      requiredInputs: [
        "evidence.localOrchestratorRuntime",
        "ProjectRuntimeState.localOrchestrator present",
        "queue items with canExecute=false and canSpawnAgent=false",
        "auto-continue mode=plan_only",
        "expected output, manifest, QA, and promotion gates pinned",
      ],
      acceptanceCriteria: [
        "Local Orchestrator is a first-class ProjectRuntimeState fact, not a separate test fixture only.",
        "Queue states cover waiting, ready, running planned, waiting output, QA pending, needs review, failed, blocked, and complete verified.",
        "Worker self-report cannot complete a task without expected output, manifest, QA, and promotion gates.",
        "Auto-continue is a plan only and cannot start daemons, spawn agent, submit providers, execute shell, read credentials, or mutate files.",
      ],
      notes: [
        "Phase 34 makes queue activity observable without creating an execution daemon.",
        ...evidenceNotes([localOrchestratorRuntimeDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_35_task_queue_visibility_progress_strip",
      phaseNumber: 35,
      title: "Task Queue Visibility / Progress Strip",
      requiredPrecedingPhases: [
        "phase_34_local_orchestrator_runtime_integration",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(taskQueueVisibilityDecision.blockers),
      readyStatus: "ready_for_queue_visibility",
      requiredInputs: [
        "evidence.taskQueueVisibility",
        "readOnlyProgressStrip",
        "consumesLocalOrchestratorSummary",
        "noQueueDetailsOnDirectorSurface",
        "no Run/Submit/Execute controls",
        "no worker/provider/file/credential/shell routes",
      ],
      acceptanceCriteria: [
        "Main surface can show concise task progress without exposing engineering internals.",
        "Diagnostics or settings can show queue distribution, blockers, retry/stall/manual-review facts, and next planned item.",
        "Visibility is read-only and cannot trigger worker spawn, provider submit, shell execution, credentials, or file mutation.",
      ],
      notes: [
        "Phase 35 answers the product need that users can see long-running work progressing.",
        ...evidenceNotes([taskQueueVisibilityDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_36_project_file_fact_source",
      phaseNumber: 36,
      title: "Project File Fact Source",
      requiredPrecedingPhases: [
        "phase_34_local_orchestrator_runtime_integration",
        "phase_35_task_queue_visibility_progress_strip",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(projectFileFactSourceDecision.blockers),
      readyStatus: "ready_for_project_fact_source",
      requiredInputs: [
        "evidence.projectFileFactSource",
        "project.vibe entry and save/open contract",
        "runtime state derived from project files",
      ],
      acceptanceCriteria: [
        "Project files, not runtime cache or chat memory, are the fact source for save/open.",
        "Project-local knowledge packs and production facts stay scoped to the opened project.",
        "The roadmap layer still does not write arbitrary files or bypass project IO gates.",
      ],
      notes: [
        "Phase 36 freezes project-file truth as a beta prerequisite.",
        ...evidenceNotes([projectFileFactSourceDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_37_visual_consistency_contract",
      phaseNumber: 37,
      title: "Visual Consistency Contract",
      requiredPrecedingPhases: [
        "phase_36_project_file_fact_source",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(visualConsistencyContractDecision.blockers),
      readyStatus: "ready_for_visual_consistency_contract",
      requiredInputs: [
        "evidence.visualConsistencyContract",
        "identity, scene, shot layout, spatial memory, keyframe pair, and master inheritance gates",
      ],
      acceptanceCriteria: [
        "Identity, scene, prop, style, shot layout, spatial memory, and keyframe-pair derivation contracts are explicit.",
        "Master scene inheritance and visual QA are part of the gate before formal references can propagate.",
        "Visual consistency packs cannot override provider policy, reference authority, preflight, or QA gates.",
      ],
      notes: [
        "Phase 37 is the visual contract closure point before broader worker/provider shells.",
        ...evidenceNotes([visualConsistencyContractDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_38_full_task_subagent_packet_planner",
      phaseNumber: 38,
      title: "Full Task Subagent Packet Planner",
      requiredPrecedingPhases: [
        "phase_37_visual_consistency_contract",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(fullTaskSubagentPacketPlannerDecision.blockers),
      readyStatus: "ready_for_packet_planner",
      requiredInputs: [
        "evidence.fullTaskSubagentPacketPlanner",
        "all production task kinds covered by validated packets",
        "formal tasks reject missing packets, expected outputs, source facts, and knowledge trace",
      ],
      acceptanceCriteria: [
        "Image, asset, keyframe, video, QA, regeneration, story, and export tasks have packet coverage.",
        "Formal work cannot start without a validated envelope, expected outputs, injected knowledge records, and source facts.",
        "Planner output remains a contract and cannot spawn workers or submit providers.",
      ],
      notes: [
        "Phase 38 removes the last free-text subagent planning gap.",
        ...evidenceNotes([fullTaskSubagentPacketPlannerDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_39_knowledge_pack_user_management",
      phaseNumber: 39,
      title: "Knowledge Pack User Management",
      requiredPrecedingPhases: [
        "phase_38_full_task_subagent_packet_planner",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(knowledgePackUserManagementDecision.blockers),
      readyStatus: "ready_for_user_management",
      requiredInputs: [
        "evidence.knowledgePackUserManagement",
        "import/create/enable/disable user flows",
        "version/hash/dependency checks, route test, and conflict detection facts",
        "provider/preflight/reference/keyframe-pair/QA/validated-packet locks preserved",
      ],
      acceptanceCriteria: [
        "Users can manage custom and project-local packs without editing built-in hard rules.",
        "Version, hash, dependency, route-test, and conflict-test facts are validated before a pack can be enabled.",
        "Knowledge packs cannot override provider policy, preflight, reference authority, keyframe-pair derivation, QA gates, or Phase 38 validated packets.",
        "Whole-library injection, unverified external imports, provider/credential/shell/file/free-text routes, parked provider bypass, and temp/rejected/candidate/shot-output promotion all fail closed.",
      ],
      notes: [
        "Phase 39 completes user-facing Knowledge Pack management before beta.",
        "The legacy knowledgePackUserManagementReady boolean is ignored without typed evidence.",
        ...evidenceNotes([knowledgePackUserManagementDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_40_worker_runtime_gate",
      phaseNumber: 40,
      title: "Agent Worker Runtime Gate",
      requiredPrecedingPhases: [
        "phase_39_knowledge_pack_user_management",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(workerRuntimeGateDecision.blockers),
      readyStatus: "ready_for_gated_worker_runtime",
      requiredInputs: [
        "evidence.workerRuntimeGate",
        "gated runtime contract",
        "defaultGatedOff=true",
        "validatedEnvelopeOnly=true",
        "structuredResultOnly=true",
        "noActualSpawnByDefault=true",
        "noDaemonByDefault/noShellExecution/noCredentialAccess/noFileMutation/noProviderSubmit=true",
      ],
      acceptanceCriteria: [
        "Real agent worker runtime shape exists only behind a default-off gate.",
        "Validated envelope input and structured result output remain mandatory.",
        "The roadmap default cannot spawn or resume agent, start daemons, execute shell, read/write credentials, submit providers, mutate files, or accept free-text worker tasks.",
      ],
      notes: [
        "Phase 40 is a gated runtime shell, not live worker execution.",
        "The legacy workerRuntimeGateReady boolean is ignored without typed evidence.",
        ...evidenceNotes([workerRuntimeGateDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_41_provider_closed_loop_shell",
      phaseNumber: 41,
      title: "Image2/Seedance Provider Closed-loop Shell",
      requiredPrecedingPhases: [
        "phase_40_worker_runtime_gate",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(providerClosedLoopShellDecision.blockers),
      readyStatus: "ready_for_provider_closed_loop_shell",
      requiredInputs: [
        "evidence.providerClosedLoopShell",
        "Image2 and Seedance closed-loop shell evidence",
        "watcherRequired/manifestRequired/qaGateRequired/promotionGateRequired=true",
        "workerSelfReportCannotComplete=true",
        "providerCommitDefaultGated=true",
        "noActualProviderSubmit/noLiveSubmit/noCredentialAccess/noFileMutation/noWorkerSpawn/noShellExecution=true",
        "forbiddenProviderModesAbsent=true",
      ],
      acceptanceCriteria: [
        "Image2 and Seedance provider execution have closed-loop shell contracts only.",
        "Watcher, manifest, QA, and promotion gates are mandatory before any future provider commit path can be considered.",
        "Worker self-report cannot complete a provider task; expected output, manifest, QA, and promotion gates fail closed.",
        "The roadmap default cannot submit providers, live submit, store credentials, read credentials, create provider credentials, spawn workers, execute shell, or mutate files.",
      ],
      notes: [
        "Phase 41 is deliberately a provider closed-loop shell and does not submit Image2, Seedance, Jimeng, or any provider.",
        "The legacy providerClosedLoopShellReady boolean is ignored without typed evidence.",
        ...evidenceNotes([providerClosedLoopShellDecision]),
      ],
    }),
    makePhase({
      phaseId: "phase_42_export_desktop_beta_acceptance",
      phaseNumber: 42,
      title: "Export / Desktop / Beta Acceptance",
      requiredPrecedingPhases: [
        "phase_41_provider_closed_loop_shell",
      ],
      readyPhases,
      ownBlockers: uniqueSorted(betaAcceptanceDecision.blockers),
      readyStatus: "ready_for_beta_acceptance",
      requiredInputs: [
        "evidence.betaAcceptance",
        "Mac and Windows desktop readiness",
        "project save/open, preview/export, queue visibility, visual consistency, knowledge pack management, worker runtime gate, provider closed-loop shell, provider gate, and tests",
        "noAdditionalPhasesPlanned, betaAcceptanceOwnsClosure, and finalPhaseNumberLocked",
      ],
      acceptanceCriteria: [
        "Mac desktop readiness and Windows desktop readiness are both accepted.",
        "Project save/open, preview/export, queue visibility, visual consistency, Knowledge Pack management, worker runtime gate, provider closed-loop shell, provider gate, and tests all pass.",
        "Beta acceptance is the Phase 42 closure point; no additional phases are planned in this roadmap range.",
        "Phase 42 owns closure, the final phase number is locked at 42, and any phase after 42 fails closed.",
      ],
      notes: [
        "Phase 42 freezes the beta closure scope and ends the Phase roadmap growth loop.",
        "The legacy betaAcceptanceReady boolean is ignored without typed evidence.",
        ...evidenceNotes([betaAcceptanceDecision]),
      ],
    }),
  ];

  return {
    schemaVersion: phaseRoadmapRuntimeSchemaVersion,
    generatedAt,
    phaseRange: "phase_24_to_42",
    phases,
    summary: {
      totalPhases: 19,
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
        "Phase 42 is the frozen beta acceptance closure point; this roadmap does not keep adding phases after it.",
      ],
    },
    hardLocks: phaseRoadmapRuntimeHardLocks,
    adapterBoundary: {
      phase26: {
        runnerKind: "mock_noop",
        purpose: "prove_replaceable_runner_contract",
        canSpawnAgent: false,
        canResumeAgent: false,
        canSubmitProvider: false,
      },
      phase29: {
        runnerKind: "agent_cli_adapter_spike",
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
    providerExecutionHandoff: {
      phase32TypedEvidenceRequired: true,
      actionTimeConfirmationEvidenceRequired: true,
      userConfirmedAtActionTimeRequired: true,
      finalHandoffReviewOnly: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      workerSpawnAllowed: false,
      fileMutationAllowed: false,
    },
    betaClosure: {
      finalPhaseNumber: 42,
      noAdditionalPhasesPlanned: true,
      betaAcceptanceOwnsClosure: true,
      workerRuntimeDefaultGated: true,
      providerClosedLoopDefaultGated: true,
      canSpawnAgent: false,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      fileMutationAllowedOutsideExplicitExportOrProjectIo: false,
      requiredAcceptanceGates: [
        "mac_desktop_readiness",
        "windows_desktop_readiness",
        "project_save_open",
        "preview_export",
        "queue_visibility",
        "visual_consistency",
        "knowledge_pack_management",
        "worker_runtime_gate",
        "provider_closed_loop_shell",
        "provider_gate",
        "tests",
        "no_additional_phases_planned",
        "beta_acceptance_owns_closure",
        "final_phase_number_locked",
      ],
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
