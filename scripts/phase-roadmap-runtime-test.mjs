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

function typedEvidence(overrides = {}) {
  return {
    projectFactsIntegration: projectFactsEvidence(overrides.projectFactsIntegration),
    subagentEnvelopeValidator: subagentEnvelopeValidatorReceipt(overrides.subagentEnvelopeValidator),
    agentCliMockRunner: agentCliMockRunnerEvidence(overrides.agentCliMockRunner),
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
    exportWorkerIoScopeReady: true,
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
