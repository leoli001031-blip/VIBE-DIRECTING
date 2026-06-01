import fs from "node:fs";
import {
  buildCliAdapterSpikeState,
  validateCliAdapterSpikeHardLocks,
  cliAdapterSpikeHardLocks,
} from "../src/core/cliAdapterSpike.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function taskEnvelopeFixture(overrides = {}) {
  return {
    id: "task_video_A1_01",
    purpose: "video",
    providerSlot: "video.i2v",
    providerId: "seedance2-provider",
    executionState: "available",
    requiredMode: "frames2video",
    sourceIndexHash: "source_hash_123",
    contextLevel: "L2",
    dependencies: [],
    expectedOutputs: [],
    hardRules: [],
    references: [],
    qaChecklist: [],
    preflight: { taskId: "task_video_A1_01", preflightScope: "dev_preview", status: "pass", blockers: [], warnings: [], checkedAt: "2026-05-01T00:00:00.000Z" },
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    ...overrides,
  };
}

function envelope(overrides = {}) {
  const task = taskEnvelopeFixture(overrides.taskEnvelope);
  return {
    id: "subagent_video_A1_01",
    parentTaskId: task.id,
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    providerPolicySummary: ["slot=video.i2v", "provider=seedance2-provider", "state=parked"],
    expectedOutputContract: {
      format: "subagent_result_v1",
    },
    taskEnvelope: task,
    neighborShots: [],
    lockedReferences: [],
    forbiddenReferences: [],
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories: ["provider"],
    qaPackBindings: {},
    allowedReadScopes: ["task_envelope"],
    disallowedReadScopes: ["provider_credentials"],
    sourceIndexRequired: true,
    mustInspectNeighborShotIds: [],
    authorityPriority: [],
    resultMustReferencePackHashes: false,
    qaChecklist: [],
    mustPreserve: [],
    allowedDelta: [],
    mustNotAdd: [],
    resultSchema: "subagent_result_v1",
    forbiddenActions: [],
    injectedKnowledgeTrace: { packs: [] },
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
      phase29Boundary: "agent_cli_adapter_spike_after_replacement_proof",
      providerSubmitAllowed: false,
      shellAllowed: false,
      fileMutationAllowed: false,
    },
    hardLocks: {
      noAgentSpawn: true,
      noAgentResume: true,
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

const schema = readJson("schemas/cli_adapter_spike.schema.json");
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "agent cli adapter spike schema $schema missing");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  registrySource.includes("cli_adapter_spike.schema.json") &&
    registrySource.includes("CliAdapterSpikeState"),
  "schema registry must include CliAdapterSpikeState",
);

const packageJson = readJson("package.json");
assert(
  packageJson.scripts["agent-cli-adapter-spike:test"] === "tsx scripts/agent-cli-adapter-spike-test.mts",
  "package script missing",
);

const source = fs.readFileSync("src/core/cliAdapterSpike.ts", "utf8");
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

const readyState = buildCliAdapterSpikeState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  phase26ReplacementProof: phase26Proof(),
  subagentTaskEnvelope: envelope(),
});
assert(readyState.phaseId === "phase_29_cli_adapter_spike", "phase id drifted");
assert(readyState.mode === "adapter_contract_spike", "mode drifted");
assert(readyState.blockers.length > 0, "happy path should have blockers from strict envelope validation");
assert(readyState.executionPolicy.providerSubmitAllowed === false, "provider submit must be blocked");
assert(readyState.executionPolicy.actualSpawnAllowed === false, "actual spawn must be blocked");
assert(readyState.executionPolicy.actualResumeAllowed === false, "actual resume must be blocked");
assert(readyState.inputContract.source === "validated_envelope_only", "input must be validated envelope only");
assert(readyState.resultContract.structured === true, "result contract must be structured");
assert(readyState.resultContract.notRealExecution === true, "adapter spike must mark no real execution");
assert(readyState.replacementProof.replacementProofReady === true, "Phase 26 proof should be preserved");
assert(readyState.roadmapEvidence.actualSpawnResumeUnavailable === true, "roadmap evidence must block spawn/resume execution");
assert(validateCliAdapterSpikeHardLocks(cliAdapterSpikeHardLocks).length === 0, "default hard locks must validate");

const corruptedProof = buildCliAdapterSpikeState({ subagentTaskEnvelope: envelope() });
assert(corruptedProof.readiness === "blocked", "envelope-only call without proof must be blocked");
const unsafeAttempts = [
  buildCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), providerSubmitAttempted: true }),
  buildCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), credentialAccessAttempted: true }),
  buildCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), actualSpawnAttempted: true }),
  buildCliAdapterSpikeState({ phase26ReplacementProof: phase26Proof(), subagentTaskEnvelope: envelope(), actualResumeAttempted: true }),
];
for (const state of unsafeAttempts) {
  assert(state.readiness === "blocked", "unsafe operation must be blocked");
}

console.log("agent-cli-adapter-spike-test passed");
