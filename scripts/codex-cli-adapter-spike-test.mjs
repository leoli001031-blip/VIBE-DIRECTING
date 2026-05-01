import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importCodexCliAdapterSpike() {
  const validatorUrl = dataUrl(
    "src/core/envelopeValidator.ts",
    [
      "export function validateSubagentTaskEnvelope(envelope) {",
      "  if (!envelope || !envelope.id) return { valid: false, issues: ['subagent_task_envelope_missing'] };",
      "  if (envelope.forceInvalid) return { valid: false, issues: ['fixture_forced_invalid_envelope'] };",
      "  return { valid: true, issues: [] };",
      "}",
    ].join("\n"),
  );
  const agentUrl = dataUrl(
    "src/core/agentCliMockRunner.ts",
    [
      "export const agentCliMockRunnerPhase = 'phase_26_agent_cli_mock_runner';",
      "export const agentCliMockRunnerHardLocks = {",
      "  noCodexSpawn: true,",
      "  noCodexResume: true,",
      "  noProviderSubmit: true,",
      "  liveSubmitAllowed: false,",
      "  noCredentialRead: true,",
      "  noCredentialWrite: true,",
      "  noShellExecution: true,",
      "  noFileMutation: true,",
      "  validatedEnvelopeRequired: true,",
      "  structuredResultRequired: true,",
      "  noFreeTextWorker: true,",
      "  mockOnly: true",
      "};",
    ].join("\n"),
  );
  const output = transpile("src/core/codexCliAdapterSpike.ts")
    .replace(/from "\.\/envelopeValidator";/g, `from "${validatorUrl}";`)
    .replace(/from "\.\/agentCliMockRunner";/g, `from "${agentUrl}";`);

  return import(dataUrl("src/core/codexCliAdapterSpike.ts", output));
}

function envelope(overrides = {}) {
  return {
    id: "subagent_video_A1_01",
    parentTaskId: "task_video_A1_01",
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    providerPolicySummary: ["slot=video.i2v", "provider=seedance2-provider", "state=parked"],
    expectedOutputContract: {
      format: "subagent_result_v1",
    },
    ...overrides,
  };
}

function phase26Proof(overrides = {}) {
  const env = envelope();
  return {
    phase: "phase_26_agent_cli_mock_runner",
    generatedAt: "2026-05-01T00:00:00.000Z",
    runnerKind: "mock_noop",
    purpose: "prove_replaceable_runner_contract",
    readiness: "ready_for_phase_29_adapter_spike",
    replacementProofReady: true,
    readySlots: [
      {
        runnerSlotId: "agent_cli_mock_runner_happy_path",
        scenarioId: "happy_path",
        envelopeId: env.id,
        taskId: env.parentTaskId,
        shotId: env.shotId,
        status: "ready",
        blockedReasons: [],
        noopResult: {
          resultKind: "subagent_result_v1_mock_noop",
        },
      },
    ],
    blockedSlots: [],
    noopResults: [
      {
        resultKind: "subagent_result_v1_mock_noop",
        envelopeId: env.id,
      },
    ],
    adapterBoundary: {
      inputContract: "validated_subagent_task_envelope_only",
      outputContract: "structured_subagent_result_shape_only",
      runnerContract: "replaceable_agent_cli_adapter",
      phase26Boundary: "mock_noop_only",
      phase29Boundary: "codex_cli_adapter_spike_after_replacement_proof",
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
      receiptId: "agent_cli_mock_runner_subagent_video_A1_01",
      sourceRefs: [`envelope:${env.id}`],
    },
    validation: {
      ok: true,
      errors: [],
      warnings: [],
    },
    ...overrides,
  };
}

function assertBlocked(state, reason) {
  assert(state.readiness === "blocked", `${reason}: state should block`);
  assert(state.blockers.includes(reason), `${reason}: blocker missing`);
}

const schema = readJson("schemas/codex_cli_adapter_spike.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/codex_cli_adapter_spike.schema.json", "schema id drifted");
assert(schema.required.includes("roadmapEvidence"), "schema must expose roadmap evidence");
assert(schema.properties.executionPolicy.$ref === "#/$defs/executionPolicy", "schema must validate execution policy");
assert(schema.$defs.executionPolicy.properties.providerSubmitAllowed.const === false, "schema must forbid provider submit");
assert(schema.$defs.adapterShape.properties.spawn.properties.actualSpawnAllowed.const === false, "schema must forbid actual spawn");
assert(schema.$defs.adapterShape.properties.resume.properties.actualResumeAllowed.const === false, "schema must forbid actual resume");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  registrySource.includes("codex_cli_adapter_spike.schema.json") &&
    registrySource.includes("CodexCliAdapterSpikeState"),
  "schema registry must include CodexCliAdapterSpikeState",
);

const packageJson = readJson("package.json");
assert(
  packageJson.scripts["codex-cli-adapter-spike:test"] === "node scripts/codex-cli-adapter-spike-test.mjs",
  "package script missing",
);

const source = fs.readFileSync("src/core/codexCliAdapterSpike.ts", "utf8");
for (const [pattern, label] of [
  [/from\s+["']node:child_process["']|from\s+["']child_process["']/, "child_process import"],
  [/\bspawn\s*\(/, "spawn call"],
  [/\bexec(?:File)?\s*\(/, "exec call"],
  [/\bfetch\s*\(/, "fetch call"],
  [/\bwriteFile(?:Sync)?\s*\(/, "writeFile call"],
  [/\bappendFile(?:Sync)?\s*\(/, "appendFile call"],
  [/\bunlink(?:Sync)?\s*\(/, "unlink call"],
  [/\bmkdir(?:Sync)?\s*\(/, "mkdir call"],
  [/\brename(?:Sync)?\s*\(/, "rename call"],
]) {
  assert(!pattern.test(source), `Phase 29 adapter spike must not contain ${label}`);
}

const {
  buildCodexCliAdapterSpikeState,
  validateCodexCliAdapterSpikeHardLocks,
  codexCliAdapterSpikeHardLocks,
} = await importCodexCliAdapterSpike();

const readyState = buildCodexCliAdapterSpikeState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  phase26ReplacementProof: phase26Proof(),
  subagentTaskEnvelope: envelope(),
});
assert(readyState.phaseId === "phase_29_codex_cli_adapter_spike", "phase id drifted");
assert(readyState.mode === "adapter_contract_spike", "mode drifted");
assert(readyState.readiness === "ready", "happy path should be ready");
assert(readyState.executionPolicy.providerSubmitAllowed === false, "provider submit must be blocked");
assert(readyState.executionPolicy.actualSpawnAllowed === false, "actual spawn must be blocked");
assert(readyState.executionPolicy.actualResumeAllowed === false, "actual resume must be blocked");
assert(readyState.inputContract.source === "validated_envelope_only", "input must be validated envelope only");
assert(readyState.inputContract.envelope.validationStatus === "valid", "validated envelope should be valid");
assert(readyState.adapterShape.spawn.status === "planned_contract_only", "spawn must be shape-only");
assert(readyState.adapterShape.resume.status === "planned_contract_only", "resume must be shape-only");
assert(readyState.resultContract.structured === true, "result contract must be structured");
assert(readyState.resultContract.notRealExecution === true, "adapter spike must mark no real execution");
assert(readyState.replacementProof.replacementProofReady === true, "Phase 26 proof should be preserved");
assert(readyState.roadmapEvidence.adapterContractReady === true, "roadmap evidence should be ready");
assert(readyState.roadmapEvidence.actualSpawnResumeUnavailable === true, "roadmap evidence must block spawn/resume execution");
assert(validateCodexCliAdapterSpikeHardLocks(codexCliAdapterSpikeHardLocks).length === 0, "default hard locks must validate");

assertBlocked(buildCodexCliAdapterSpikeState({ subagentTaskEnvelope: envelope() }), "phase_26_replacement_proof_missing");
assertBlocked(
  buildCodexCliAdapterSpikeState({
    phase26ReplacementProof: phase26Proof({ replacementProofReady: false, validation: { ok: false, errors: [], warnings: [] } }),
    subagentTaskEnvelope: envelope(),
  }),
  "phase_26_replacement_proof_not_ready",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({
    phase26ReplacementProof: phase26Proof(),
    subagentTaskEnvelope: envelope({ forceInvalid: true }),
  }),
  "invalid_envelope:fixture_forced_invalid_envelope",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), providerSubmitAttempted: true }),
  "provider_submit_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), credentialAccessAttempted: true }),
  "credential_access_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), arbitraryShellAttempted: true }),
  "arbitrary_shell_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), fileMutationAttempted: true }),
  "file_mutation_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), freeTextTaskAttempted: true }),
  "free_text_task_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), actualSpawnAttempted: true }),
  "actual_spawn_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), actualResumeAttempted: true }),
  "actual_resume_attempt_blocked",
);
assertBlocked(
  buildCodexCliAdapterSpikeState({
    phase26ReplacementProof: phase26Proof(),
    subagentTaskEnvelope: envelope(),
    resultContractOverride: { structured: false },
  }),
  "result_contract_not_structured",
);

console.log("codex-cli-adapter-spike-test passed");
