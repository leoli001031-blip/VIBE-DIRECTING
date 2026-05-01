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

function typedEvidence(overrides = {}) {
  return {
    projectFactsIntegration: projectFactsEvidence(overrides.projectFactsIntegration),
    subagentEnvelopeValidator: subagentEnvelopeValidatorReceipt(overrides.subagentEnvelopeValidator),
    agentCliMockRunner: agentCliMockRunnerEvidence(overrides.agentCliMockRunner),
    exportWorker: exportWorkerEvidence(overrides.exportWorker),
    voiceAudioSettings: voiceAudioSettingsEvidence(overrides.voiceAudioSettings),
    providerLiveGate: providerLiveGateReceipt(overrides.providerLiveGate),
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
assert(
  typedMockRunnerReady.adapterBoundary.phase26.runnerKind === "mock_noop",
  "Phase 26 must be the mock/no-op runner boundary",
);
assert(typedMockRunnerReady.adapterBoundary.phase26.canSpawnCodex === false, "Phase 26 must not spawn Codex");
assert(typedMockRunnerReady.adapterBoundary.phase26.canResumeCodex === false, "Phase 26 must not resume Codex");
assert(typedMockRunnerReady.adapterBoundary.phase26.canSubmitProvider === false, "Phase 26 must not submit provider");

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

const readyPlan = buildPhaseRoadmapRuntimePlan(readyInput());
assert(readyPlan.schemaVersion === "0.1.0", "schema version drifted");
assert(readyPlan.phaseRange === "phase_24_to_30", "phase range drifted");
assert(readyPlan.summary.totalPhases === 7, "summary total phase count drifted");
assert(readyPlan.summary.ready === 7, "all phases should be ready for the complete fixture");
assert(readyPlan.summary.blocked === 0, "complete fixture should not block");
assert(readyPlan.summary.providerSubmitAllowed === 0, "provider submit must stay at zero");
assert(readyPlan.summary.credentialAccessAllowed === false, "credential access must be false");
assert(readyPlan.summary.arbitraryShellAllowed === false, "arbitrary shell must be false");
assert(readyPlan.summary.freeTextWorkerAllowed === false, "free text workers must be false");
assert(
  readyPlan.evidenceSummary.decisions.every((decision) => decision.ready === true),
  "complete typed fixture should make every evidence decision ready",
);
assert(phaseRoadmapPhaseIds().length === 7, "phase id list should cover Phase 24-30");

const phase26Ready = phase(readyPlan, "phase_26_agent_cli_mock_runner");
const phase29Ready = phase(readyPlan, "phase_29_codex_cli_adapter_spike");
assert(phase26Ready.status === "ready_for_noop_runner", "Phase 26 status must describe mock/no-op runner");
assert(phase29Ready.status === "ready_for_adapter_spike", "Phase 29 status must describe adapter spike");
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
assert(schema.properties.phaseRange.const === "phase_24_to_30", "schema must pin Phase 24-30 range");
assert(schema.$defs.summary.properties.totalPhases.const === 7, "schema summary must pin totalPhases=7");
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

const source = fs.readFileSync("src/core/phaseRoadmapRuntime.ts", "utf8");
for (const forbiddenCode of ["child_process", "spawn(", "exec(", "fetch(", "XMLHttpRequest", "process.env"]) {
  assert(!source.includes(forbiddenCode), `phaseRoadmapRuntime source must not contain ${forbiddenCode}`);
}

console.log(
  `Phase roadmap runtime tests passed: ${readyPlan.summary.ready} ready phase(s), ${blockedProviderGate.summary.blocked} blocked phase(s) in provider-gate fixture.`,
);
