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

async function importCodexWorkerRuntimeGate() {
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
  const output = transpile("src/core/codexWorkerRuntimeGate.ts")
    .replace(/from "\.\/envelopeValidator";/g, `from "${validatorUrl}";`)
    .replace(/from "\.\/agentCliMockRunner";/g, `from "${agentUrl}";`);

  return import(dataUrl("src/core/codexWorkerRuntimeGate.ts", output));
}

function envelope(overrides = {}) {
  return {
    id: "subagent_packet_video_execution_A1_01",
    parentTaskId: "task_subagent_packet_video_execution_A1_01",
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    storyFunction: "test shot",
    providerPolicySummary: ["noFreeTextTask=true", "providerSubmissionForbidden=true", "liveSubmitAllowed=false"],
    expectedOutputContract: {
      format: "subagent_result_v1",
    },
    ...overrides,
  };
}

const requiredFields = {
  validatedEnvelope: true,
  expectedOutputs: true,
  sourceFactTrace: true,
  injectedKnowledgeTrace: true,
  qaChecklist: true,
  resultSchema: true,
  allowedReadScope: true,
  forbiddenActions: true,
  noFreeTextWorker: true,
  phase37VisualConsistencyTrace: true,
};

function phase38Packet(env = envelope(), overrides = {}) {
  return {
    packetId: env.id,
    taskKind: "video_execution",
    status: "ready",
    envelopeId: env.id,
    envelope: env,
    hardFields: {
      outputSchema: "subagent_result_v1",
      expectedOutputContract: {
        format: "subagent_result_v1",
      },
    },
    validationReceipt: {
      receiptKind: "phase38_task_packet_validation",
      status: "pass",
      envelopeId: env.id,
      taskEnvelopeId: env.parentTaskId,
      checkedAt: "2026-05-01T00:00:00.000Z",
      requiredFields,
      blockers: [],
    },
    blockedReasons: [],
    noFreeTextTask: true,
    canSubmitProvider: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    ...overrides,
  };
}

function phase26Proof(env = envelope(), overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    phase: "phase_26_agent_cli_mock_runner",
    generatedAt: "2026-05-01T00:00:00.000Z",
    runnerKind: "mock_noop",
    purpose: "prove_replaceable_runner_contract",
    readiness: "ready_for_phase_29_adapter_spike",
    replacementProofReady: true,
    readySlots: [
      {
        runnerSlotId: "agent_cli_mock_runner_default_noop_plan",
        scenarioId: "default_noop_plan",
        envelopeId: env.id,
        taskId: env.parentTaskId,
        shotId: env.shotId,
        status: "ready",
        blockedReasons: [],
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
      receiptId: `agent_cli_mock_runner_${env.id}`,
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
  assert(state.validation.ok === false, `${reason}: validation should fail`);
  assert(state.blockers.includes(reason), `${reason}: blocker missing`);
}

const schema = readJson("schemas/codex_worker_runtime_gate.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/codex_worker_runtime_gate.schema.json", "schema id drifted");
assert(schema.title === "CodexWorkerRuntimeGateState", "schema title drifted");
assert(schema.properties.phaseId.const === "phase_40_codex_worker_runtime_gate", "schema phase const missing");
assert(schema.$defs.commandPlan.additionalProperties === false, "command plan shape must be closed");
assert(schema.$defs.commandPlan.properties.argumentSource.const === "validated_envelope_only", "schema must pin command argument source");
assert(schema.$defs.commandPlan.properties.expectedResultSchema.const === "subagent_result_v1", "schema must pin command result schema");
for (const field of [
  "canExecuteNow",
  "canSpawnCodex",
  "canResumeCodex",
  "canStartDaemon",
  "canExecuteShell",
  "canSubmitProvider",
  "canReadCredentials",
  "canWriteCredentials",
  "canMutateFiles",
]) {
  assert(schema.$defs.commandPlan.properties[field].const === false, `schema command plan must pin ${field}=false`);
}

const projectRuntimeSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectRuntimeSchema.required.includes("codexWorkerRuntimeGate"), "ProjectRuntimeState must require codexWorkerRuntimeGate");
assert(
  projectRuntimeSchema.properties.codexWorkerRuntimeGate.$ref === "codex_worker_runtime_gate.schema.json",
  "ProjectRuntimeState must reference codex worker runtime gate schema",
);

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  registrySource.includes("codex_worker_runtime_gate.schema.json") &&
    registrySource.includes("CodexWorkerRuntimeGateState"),
  "schema registry must include CodexWorkerRuntimeGateState",
);

const packageJson = readJson("package.json");
assert(
  packageJson.scripts["codex-worker-runtime-gate:test"] === "node scripts/codex-worker-runtime-gate-test.mjs",
  "package script codex-worker-runtime-gate:test missing",
);

const source = fs.readFileSync("src/core/codexWorkerRuntimeGate.ts", "utf8");
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
  assert(!pattern.test(source), `Phase 40 gate must not contain ${label}`);
}

const {
  buildCodexWorkerRuntimeGateState,
  validateCodexWorkerRuntimeGateHardLocks,
  codexWorkerRuntimeGateHardLocks,
} = await importCodexWorkerRuntimeGate();

const generatedAt = "2026-05-01T00:00:00.000Z";
const env = envelope();
const readyState = buildCodexWorkerRuntimeGateState({
  generatedAt,
  subagentTaskEnvelope: env,
  phase38Packet: phase38Packet(env),
  phase26ReplacementProof: phase26Proof(env),
});
assert(readyState.schemaVersion === "0.1.0", "schema version drifted");
assert(readyState.phaseId === "phase_40_codex_worker_runtime_gate", "phase id drifted");
assert(readyState.readiness === "ready_for_permission_gate", "happy path should be ready for permission gate");
assert(readyState.validation.ok === true, `ready shell should validate: ${readyState.validation.errors.join("; ")}`);
assert(readyState.contract.workerRuntimeContractDefined === true, "runtime contract proof missing");
assert(readyState.contract.defaultGatedOff === true, "default gated-off proof missing");
assert(readyState.contract.validatedEnvelopeOnly === true, "validated envelope proof missing");
assert(readyState.contract.structuredResultOnly === true, "structured result proof missing");
assert(readyState.contract.noActualSpawnByDefault === true, "no actual spawn proof missing");
assert(readyState.inputGate.source === "validated_envelope_only", "input gate source drifted");
assert(readyState.inputGate.envelopeValidationStatus === "valid", "envelope should validate");
assert(readyState.inputGate.phase38PacketStatus === "ready", "Phase38 packet should be ready");
assert(readyState.inputGate.phase26ReplacementProofStatus === "ready", "Phase26 proof should be ready");
assert(readyState.permissionGate.readyForPermissionGate === true, "ready shell should reach permission gate");
assert(readyState.permissionGate.actionTimePermissionRequired === true, "action-time permission must be required");
assert(readyState.permissionGate.permissionGrantedNow === false, "permission cannot be granted in Phase 40");
assert(readyState.permissionGate.canExecuteNow === false, "ready shell still cannot execute");
assert(readyState.permissionGate.blockedReasons.includes("action_time_permission_required_before_any_future_worker_runtime"), "ready shell must still require future action-time permission");
assert(Object.keys(readyState.commandPlan).length === schema.$defs.commandPlan.required.length, "command plan must only expose the closed shape");
for (const field of schema.$defs.commandPlan.required) {
  assert(Object.prototype.hasOwnProperty.call(readyState.commandPlan, field), `command plan missing ${field}`);
}
assert(readyState.commandPlan.argumentSource === "validated_envelope_only", "command plan source drifted");
assert(readyState.commandPlan.expectedResultSchema === "subagent_result_v1", "command plan result schema drifted");
assert(Object.entries(readyState.commandPlan).every(([key, value]) => key === "argumentSource" || key === "expectedResultSchema" || value === false), "all command capabilities must be false");
assert(readyState.resultContract.structured === true, "result must be structured");
assert(readyState.resultContract.freeTextAccepted === false, "free-text result must be rejected");
assert(readyState.resultContract.projectStoreHandoffNow === false, "Phase 40 must not hand off to Project Store now");
assert(readyState.proof.phase38PacketValidated === true, "Phase38 proof should be true");
assert(readyState.proof.phase26ReplacementProofReady === true, "Phase26 proof should be true");
assert(readyState.proof.noActualSpawnByDefault === true, "spawn proof should be true");
assert(readyState.proof.noProviderSubmission === true, "provider proof should be true");
assert(readyState.proof.noCredentialAccess === true, "credential proof should be true");
assert(readyState.proof.noFileMutation === true, "file proof should be true");
assert(validateCodexWorkerRuntimeGateHardLocks(codexWorkerRuntimeGateHardLocks).length === 0, "default hard locks must validate");

for (const [key, expected] of Object.entries({
  gatedRuntimeOnly: true,
  defaultGatedOff: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noFreeTextWorker: true,
  noActualSpawnByDefault: true,
  noSpawnCodex: true,
  noCodexResume: true,
  noDaemon: true,
  daemonStarted: false,
  noSubprocess: true,
  noShellExecution: true,
  noProviderSubmit: true,
  noProviderExecution: true,
  providerSubmissionForbidden: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  credentialAccessAllowed: false,
  credentialStorage: false,
  noFileMutation: true,
})) {
  assert(readyState.hardLocks[key] === expected, `hard lock ${key} drifted`);
  assert(codexWorkerRuntimeGateHardLocks[key] === expected, `exported hard lock ${key} drifted`);
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hard lock ${key} const drifted`);
}

assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    phase38Packet: phase38Packet(env),
    phase26ReplacementProof: phase26Proof(env),
  }),
  "validated_subagent_task_envelope_required",
);
assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: envelope({ forceInvalid: true }),
    phase38Packet: phase38Packet(envelope({ forceInvalid: true })),
    phase26ReplacementProof: phase26Proof(envelope({ forceInvalid: true })),
  }),
  "invalid_envelope:fixture_forced_invalid_envelope",
);
assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: env,
    phase26ReplacementProof: phase26Proof(env),
  }),
  "phase_38_packet_missing",
);
assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: env,
    phase38Packet: phase38Packet(env),
  }),
  "phase_26_replacement_proof_missing",
);
assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: env,
    phase38Packet: phase38Packet(env, { status: "blocked_packet_validation" }),
    phase26ReplacementProof: phase26Proof(env),
  }),
  "phase_38_packet_not_ready:blocked_packet_validation",
);
assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: env,
    phase38Packet: phase38Packet(env),
    phase26ReplacementProof: phase26Proof(env, { replacementProofReady: false }),
  }),
  "phase_26_replacement_proof_not_ready",
);

for (const [flag, reason] of [
  ["freeTextPromptAttempted", "free_text_prompt_attempt_blocked"],
  ["spawnCodexAttempted", "spawn_codex_attempt_blocked"],
  ["resumeCodexAttempted", "resume_codex_attempt_blocked"],
  ["daemonStartAttempted", "daemon_start_attempt_blocked"],
  ["shellExecutionAttempted", "shell_execution_attempt_blocked"],
  ["providerSubmitAttempted", "provider_submit_attempt_blocked"],
  ["credentialReadAttempted", "credential_read_attempt_blocked"],
  ["credentialWriteAttempted", "credential_write_attempt_blocked"],
  ["fileMutationAttempted", "file_mutation_attempt_blocked"],
]) {
  assertBlocked(
    buildCodexWorkerRuntimeGateState({
      generatedAt,
      subagentTaskEnvelope: env,
      phase38Packet: phase38Packet(env),
      phase26ReplacementProof: phase26Proof(env),
      [flag]: true,
    }),
    reason,
  );
}

assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: env,
    phase38Packet: phase38Packet(env),
    phase26ReplacementProof: phase26Proof(env),
    hardLocksOverride: { noSpawnCodex: false },
  }),
  "codex_worker_runtime_gate_hard_lock_drift:noSpawnCodex",
);
assertBlocked(
  buildCodexWorkerRuntimeGateState({
    generatedAt,
    subagentTaskEnvelope: env,
    phase38Packet: phase38Packet(env),
    phase26ReplacementProof: phase26Proof(env, {
      hardLocks: { ...phase26Proof(env).hardLocks, noCodexSpawn: false },
    }),
  }),
  "phase_26_mock_runner_hard_lock_drift:noCodexSpawn",
);

console.log(
  `codex-worker-runtime-gate-test passed: readiness=${readyState.readiness}, hardLocks=${Object.keys(readyState.hardLocks).length}.`,
);
