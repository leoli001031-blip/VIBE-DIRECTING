export const phaseRoadmapRuntimeSchemaVersion = "0.1.0";

export type PhaseRoadmapPhaseId =
  | "phase_24_subagent_runtime_gate"
  | "phase_25_knowledge_pack_manager"
  | "phase_26_agent_cli_mock_runner"
  | "phase_27_export_worker_mvp"
  | "phase_28_voice_audio_settings_ui"
  | "phase_29_codex_cli_adapter_spike"
  | "phase_30_provider_enablement_gate";

export type PhaseRoadmapReadiness = "ready" | "blocked";
export type PhaseRoadmapStatus =
  | "ready_for_implementation"
  | "ready_for_noop_runner"
  | "ready_for_adapter_spike"
  | "ready_for_confirmation_gate"
  | "blocked_by_gate";
export type PhaseRoadmapEvidenceDecisionSource = "typed_evidence" | "legacy_boolean_override" | "missing";
export type PhaseRoadmapEvidenceStatus =
  | "ready"
  | "valid"
  | "pass"
  | "passed"
  | "closed"
  | "ready_for_confirmation"
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
    noCredentialRead?: boolean;
    noCredentialWrite?: boolean;
    fastModelForbidden?: boolean;
    vipChannelForbidden?: boolean;
    textToVideoMainPathForbidden?: boolean;
    bgmInVideoPromptForbidden?: boolean;
  };
  forbiddenActions?: string[];
  blockers?: string[];
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

export interface PhaseRoadmapRuntimeEvidence {
  projectFactsIntegration?: PhaseRoadmapProjectFactsIntegrationEvidence;
  subagentEnvelopeValidator?: PhaseRoadmapSubagentEnvelopeValidatorReceipt;
  providerLiveGate?: PhaseRoadmapProviderLiveGateReceipt;
  watcherManifestQaClosedLoop?: PhaseRoadmapClosedLoopReceipt;
}

export interface PhaseRoadmapEvidenceDecision {
  evidenceKey:
    | "projectFactsIntegration"
    | "subagentEnvelopeValidator"
    | "providerConfirmationTokenPlaceholder"
    | "providerEnablementPacket"
    | "watcherManifestQaClosedLoop"
    | "forbiddenProviderModesAbsent";
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
  phaseNumber: 24 | 25 | 26 | 27 | 28 | 29 | 30;
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
  phaseRange: "phase_24_to_30";
  phases: PhaseRoadmapPhasePlan[];
  summary: {
    totalPhases: 7;
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
    || status === "ready_for_confirmation";
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

function providerLiveGateSafetyBlockers(receipt: PhaseRoadmapProviderLiveGateReceipt): string[] {
  return uniqueSorted([
    ...blockedIf(receipt.summary?.providerSubmitAllowed !== undefined && receipt.summary.providerSubmitAllowed !== 0, "provider_live_gate_allows_provider_submit"),
    ...blockedIf(receipt.summary?.liveSubmitAllowed === true, "provider_live_gate_allows_live_submit"),
    ...blockedIf(receipt.summary?.credentialStorage === true, "provider_live_gate_allows_credential_storage"),
    ...blockedIf(receipt.hardLocks?.noProviderSubmit === false, "provider_live_gate_no_provider_submit_lock_missing"),
    ...blockedIf(receipt.hardLocks?.providerSubmissionForbidden === false, "provider_live_gate_submission_forbidden_lock_missing"),
    ...blockedIf(receipt.hardLocks?.liveSubmitAllowed === true, "provider_live_gate_live_submit_lock_missing"),
    ...blockedIf(receipt.hardLocks?.noCredentialRead === false, "provider_live_gate_no_credential_read_lock_missing"),
    ...blockedIf(receipt.hardLocks?.noCredentialWrite === false, "provider_live_gate_no_credential_write_lock_missing"),
    ...blockedIf(receipt.hardLocks?.fastModelForbidden === false, "provider_live_gate_fast_model_lock_missing"),
    ...blockedIf(receipt.hardLocks?.vipChannelForbidden === false, "provider_live_gate_vip_channel_lock_missing"),
    ...blockedIf(receipt.hardLocks?.textToVideoMainPathForbidden === false, "provider_live_gate_text_to_video_lock_missing"),
    ...blockedIf(receipt.hardLocks?.bgmInVideoPromptForbidden === false, "provider_live_gate_bgm_prompt_lock_missing"),
    ...(receipt.blockers || []),
  ]);
}

function providerConfirmationEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const receipt = input.evidence?.providerLiveGate;

  if (hasProviderLiveGateReceipt(receipt)) {
    const blockers = uniqueSorted([
      ...providerLiveGateSafetyBlockers(receipt),
      ...blockedIf(receipt.confirmationTokenPlaceholderPresent !== true, "user_confirmation_token_placeholder_missing"),
    ]);

    return {
      evidenceKey: "providerConfirmationTokenPlaceholder",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  return {
    evidenceKey: "providerConfirmationTokenPlaceholder",
    source: input.providerConfirmationTokenPlaceholderPresent === undefined ? "missing" : "legacy_boolean_override",
    ready: input.providerConfirmationTokenPlaceholderPresent === true,
    blockers: blockedIf(input.providerConfirmationTokenPlaceholderPresent !== true, "user_confirmation_token_placeholder_missing"),
    warnings: input.providerConfirmationTokenPlaceholderPresent === true
      ? ["legacy_providerConfirmationTokenPlaceholderPresent_boolean_used"]
      : [],
  };
}

function providerPacketEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
  const receipt = input.evidence?.providerLiveGate;

  if (hasProviderLiveGateReceipt(receipt)) {
    const providerLiveGateReady = readyStatus(receipt.status) || (receipt.summary?.readyForConfirmation ?? 0) > 0;
    const packetComplete = receipt.providerPacketComplete === true
      || (receipt.providerPacketComplete === undefined && providerLiveGateReady);
    const blockers = uniqueSorted([
      ...providerLiveGateSafetyBlockers(receipt),
      ...blockedIf(!packetComplete, "provider_enablement_packet_incomplete"),
    ]);

    return {
      evidenceKey: "providerEnablementPacket",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  return {
    evidenceKey: "providerEnablementPacket",
    source: input.providerPacketComplete === undefined ? "missing" : "legacy_boolean_override",
    ready: input.providerPacketComplete === true,
    blockers: blockedIf(input.providerPacketComplete !== true, "provider_enablement_packet_incomplete"),
    warnings: input.providerPacketComplete === true ? ["legacy_providerPacketComplete_boolean_used"] : [],
  };
}

function watcherClosedLoopEvidenceDecision(input: PhaseRoadmapRuntimeInput): PhaseRoadmapEvidenceDecision {
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

  if (hasProviderLiveGateReceipt(receipt)) {
    const blockers = uniqueSorted([
      ...providerLiveGateSafetyBlockers(receipt),
      ...blockedIf(receipt.forbiddenProviderModesAbsent !== true, "forbidden_provider_mode_or_prompt_present"),
    ]);

    return {
      evidenceKey: "forbiddenProviderModesAbsent",
      source: "typed_evidence",
      ready: blockers.length === 0,
      blockers,
      warnings: uniqueSorted(receipt.warnings || []),
    };
  }

  return {
    evidenceKey: "forbiddenProviderModesAbsent",
    source: input.forbiddenProviderModesAbsent === undefined ? "missing" : "legacy_boolean_override",
    ready: input.forbiddenProviderModesAbsent === true,
    blockers: blockedIf(input.forbiddenProviderModesAbsent !== true, "forbidden_provider_mode_or_prompt_present"),
    warnings: input.forbiddenProviderModesAbsent === true ? ["legacy_forbiddenProviderModesAbsent_boolean_used"] : [],
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
  const providerConfirmationDecision = providerConfirmationEvidenceDecision(input);
  const providerPacketDecision = providerPacketEvidenceDecision(input);
  const watcherClosedLoopDecision = watcherClosedLoopEvidenceDecision(input);
  const forbiddenProviderModesDecision = forbiddenProviderModesEvidenceDecision(input);
  const evidenceDecisions = [
    projectFactsDecision,
    envelopeDecision,
    providerConfirmationDecision,
    providerPacketDecision,
    watcherClosedLoopDecision,
    forbiddenProviderModesDecision,
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
      ownBlockers: uniqueSorted([
        ...blockedIf(!input.mockRunnerNoopReady, "mock_noop_runner_contract_missing"),
        ...blockedIf(Boolean(input.mockRunnerProviderSubmitObserved), "mock_runner_attempted_provider_submit"),
      ]),
      readyStatus: "ready_for_noop_runner",
      requiredInputs: ["mockRunnerNoopReady", "mockRunnerProviderSubmitObserved=false"],
      acceptanceCriteria: [
        "The runner proves the command/result contract is replaceable without spawning Codex.",
        "The runner returns no-op structured results and never submits providers.",
        "The runner cannot read credentials, run arbitrary shell, or mutate files.",
      ],
      notes: ["Phase 26 is the replaceability proof, not the real Codex CLI integration."],
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
      ownBlockers: blockedIf(!input.exportWorkerIoScopeReady, "explicit_export_project_io_scope_missing"),
      readyStatus: "ready_for_implementation",
      requiredInputs: ["exportWorkerIoScopeReady"],
      acceptanceCriteria: [
        "File mutation is allowed only inside explicit export/project IO contracts.",
        "Export output still requires manifest matching and structured result reporting.",
      ],
      notes: ["This is the only Phase 24-30 plan item with fileMutationAllowed=true."],
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
      ownBlockers: blockedIf(!input.voiceAudioSettingsReady, "voice_audio_settings_contract_missing"),
      readyStatus: "ready_for_implementation",
      requiredInputs: ["voiceAudioSettingsReady"],
      acceptanceCriteria: [
        "Voice and audio settings remain structured project facts.",
        "BGM prompt text does not enter provider enablement for video.",
      ],
      notes: ["This phase prepares settings only; it does not enable audio or video provider submission."],
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
        ...blockedIf(!input.replacementProofFromMockRunner, "phase_26_replacement_proof_missing"),
        ...blockedIf(!input.codexCliAdapterDryRunReady, "codex_cli_adapter_dry_run_contract_missing"),
      ]),
      readyStatus: "ready_for_adapter_spike",
      requiredInputs: ["replacementProofFromMockRunner", "codexCliAdapterDryRunReady"],
      acceptanceCriteria: [
        "Adapter spike may connect spawn/resume shape only after Phase 26 proves replaceability.",
        "Adapter input remains the validated envelope, never a free text task.",
        "Adapter output remains structured and provider submission remains blocked.",
      ],
      notes: ["Phase 29 is where real Codex spawn/resume is explored; Phase 26 intentionally does not do that."],
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
  ];

  return {
    schemaVersion: phaseRoadmapRuntimeSchemaVersion,
    generatedAt,
    phaseRange: "phase_24_to_30",
    phases,
    summary: {
      totalPhases: 7,
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
