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

export interface PhaseRoadmapRuntimeInput {
  generatedAt?: string;
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
  const forbiddenProviderModesAbsent = input.forbiddenProviderModesAbsent !== false;

  const phases: PhaseRoadmapPhasePlan[] = [
    makePhase({
      phaseId: "phase_24_subagent_runtime_gate",
      phaseNumber: 24,
      title: "Subagent Runtime Gate",
      requiredPrecedingPhases: [],
      readyPhases,
      ownBlockers: uniqueSorted([
        ...blockedIf(!input.projectFactsValidated, "project_facts_not_validated"),
        ...blockedIf(!input.subagentEnvelopeValidatorReady, "validated_subagent_task_envelope_gate_missing"),
      ]),
      readyStatus: "ready_for_implementation",
      requiredInputs: ["projectFactsValidated", "subagentEnvelopeValidatorReady"],
      acceptanceCriteria: [
        "Formal workers only accept validated SubagentTaskEnvelope packets.",
        "Free text worker starts are blocked before any command plan exists.",
        "Worker results must be structured before handoff.",
      ],
      notes: ["This phase hardens the runtime boundary; it does not execute providers or mutate project files."],
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
        ...blockedIf(!input.providerConfirmationTokenPlaceholderPresent, "user_confirmation_token_placeholder_missing"),
        ...blockedIf(!input.providerPacketComplete, "provider_enablement_packet_incomplete"),
        ...blockedIf(!input.watcherManifestQaClosedLoop, "watcher_manifest_qa_closed_loop_missing"),
        ...blockedIf(!forbiddenProviderModesAbsent, "forbidden_provider_mode_or_prompt_present"),
      ]),
      readyStatus: "ready_for_confirmation_gate",
      requiredInputs: [
        "providerConfirmationTokenPlaceholderPresent",
        "providerPacketComplete",
        "watcherManifestQaClosedLoop",
        "forbiddenProviderModesAbsent",
      ],
      acceptanceCriteria: [
        "User confirmation token placeholder is present and separate from credentials.",
        "Packet is complete before any final provider gate can be considered.",
        "Watcher, manifest matcher, and QA form a closed loop.",
        "Fast, VIP, text-to-video, and BGM prompt paths are absent.",
        "Even when ready, this plan still reports canSubmitProvider=false until a later final gate exists.",
      ],
      notes: ["Phase 30 is an enablement gate plan, not provider execution."],
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
