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

function readyInput() {
  return {
    generatedAt: "2026-05-01T00:00:00.000Z",
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

const mockRunnerPlan = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
  mockRunnerProviderSubmitObserved: true,
});
const phase26Blocked = phase(mockRunnerPlan, "phase_26_agent_cli_mock_runner");
assert(phase26Blocked.readiness === "blocked", "Phase 26 must block if mock runner attempts provider submit");
assert(
  phase26Blocked.blockedReasons.includes("mock_runner_attempted_provider_submit"),
  "Phase 26 provider-submit blocker missing",
);
assert(
  mockRunnerPlan.adapterBoundary.phase26.runnerKind === "mock_noop",
  "Phase 26 must be the mock/no-op runner boundary",
);
assert(mockRunnerPlan.adapterBoundary.phase26.canSpawnCodex === false, "Phase 26 must not spawn Codex");
assert(mockRunnerPlan.adapterBoundary.phase26.canResumeCodex === false, "Phase 26 must not resume Codex");
assert(mockRunnerPlan.adapterBoundary.phase26.canSubmitProvider === false, "Phase 26 must not submit provider");

const blockedProviderGate = buildPhaseRoadmapRuntimePlan({
  ...readyInput(),
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

const source = fs.readFileSync("src/core/phaseRoadmapRuntime.ts", "utf8");
for (const forbiddenCode of ["child_process", "spawn(", "exec(", "fetch(", "XMLHttpRequest", "process.env"]) {
  assert(!source.includes(forbiddenCode), `phaseRoadmapRuntime source must not contain ${forbiddenCode}`);
}

console.log(
  `Phase roadmap runtime tests passed: ${readyPlan.summary.ready} ready phase(s), ${blockedProviderGate.summary.blocked} blocked phase(s) in provider-gate fixture.`,
);
