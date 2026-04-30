import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadSubagentRunner() {
  const sourcePath = path.resolve("src/core/subagentRunner.ts");
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-subagent-runner-"));
  const outPath = path.join(tmpDir, "subagentRunner.mjs");
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function fixtureTaskEnvelope() {
  return {
    id: "task_video_A1_01",
    purpose: "video",
    providerSlot: "video.i2v",
    providerId: "seedance2-provider",
    executionState: "parked",
    requiredMode: "frames2video",
    storyFunction: "test shot",
    sourceIndexHash: "source_hash_123",
    dependencies: [],
    contextLevel: "L2",
    expectedOutputs: ["outputs/video/A1_01.mp4"],
    hardRules: ["no_live_submit", "no_provider_credentials", "no_shell_execution"],
    references: [],
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate"],
    preflight: {
      taskId: "task_video_A1_01",
      preflightScope: "formal_execution",
      status: "blocked",
      blockers: [],
      warnings: [],
      checkedAt: "2026-04-30T00:00:00.000Z",
    },
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    blockingReasons: [],
  };
}

function fixtureSubagentEnvelope() {
  const taskEnvelope = fixtureTaskEnvelope();
  return {
    id: "subagent_video_A1_01",
    parentTaskId: taskEnvelope.id,
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    storyFunction: "test shot",
    neighborShots: [],
    lockedReferences: [],
    forbiddenReferences: [],
    providerPolicySummary: ["slot=video.i2v", "provider=seedance2-provider", "state=parked", "mode=frames2video"],
    taskEnvelope,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories: ["provider", "qa"],
    qaPackBindings: {},
    allowedReadScopes: ["task_envelope", "locked_references", "injected_knowledge_snippets"],
    disallowedReadScopes: ["provider_credentials", "api_keys", "live_provider_task_ids", "unrouted_knowledge_library"],
    sourceIndexRequired: true,
    mustInspectNeighborShotIds: [],
    authorityPriority: ["source_index", "provider_policy", "preflight"],
    resultMustReferencePackHashes: true,
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate"],
    mustPreserve: ["character identity", "scene layout"],
    allowedDelta: ["motion"],
    mustNotAdd: ["new characters", "unapproved props", "provider submit"],
    expectedOutputContract: {
      format: "subagent_result_v1",
      requiredFields: ["taskId", "status", "inspectedFiles", "gates", "issues", "requiredFixes", "summaryForMainAgent"],
      severityLevels: ["P0", "P1", "P2"],
      gateFields: ["identity", "scene", "pair", "story", "prop", "style"],
    },
  };
}

function fixtureVideoExecutionPreview() {
  return {
    previews: [
      {
        previewId: "video_execution_preview_A1_01",
        shotId: "A1_01",
        taskPlanId: "video_task_plan_A1_01",
        readinessGateId: "video_gate_A1_01",
        subagentTaskEnvelope: fixtureSubagentEnvelope(),
        warnings: ["Provider remains parked."],
      },
    ],
  };
}

function fixtureGenerationHarness() {
  return {
    jobs: [
      {
        harnessJobId: "generation_harness_img_A1_01",
        jobId: "job_img_A1_01",
        shotId: "A1_01",
        taskPlanId: "image_task_plan_A1_01",
        promptPlanId: "prompt_plan_A1_01",
        providerId: "openai-image2-api",
        providerSlot: "image.edit",
        requiredMode: "image2image",
        warnings: [],
      },
      {
        harnessJobId: "generation_harness_asset_prop",
        jobId: "job_asset_prop",
        shotId: "asset_prop",
        taskPlanId: "image_task_plan_asset_prop",
        promptPlanId: "prompt_plan_asset_prop",
        providerId: "openai-image2-api",
        providerSlot: "image.reference_asset",
        requiredMode: "text2image",
        warnings: [],
      },
    ],
  };
}

function fixtureQaHarness() {
  return {
    items: [
      {
        qaItemId: "qa_harness_item_A1_01",
        shotId: "A1_01",
        taskPlanId: "image_task_plan_A1_01",
        harnessJobId: "generation_harness_img_A1_01",
        videoTaskPlanId: "video_task_plan_A1_01",
        audioPlanId: "audio_plan_A1_01",
      },
    ],
  };
}

const { buildSubagentRunnerState } = await loadSubagentRunner();

const freeTextState = buildSubagentRunnerState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  freeTextTaskRequests: [
    {
      requestId: "ad_hoc_story_prompt",
      taskKind: "story_audit",
      prompt: "Check this however you think best.",
    },
  ],
});
assert(freeTextState.noFreeTextTask === true, "runner must hard-lock noFreeTextTask=true");
assert(freeTextState.validatedEnvelopeRequired === true, "runner must require validated envelopes");
assert(freeTextState.summary.freeTextBlocked === 1, "free text request must be counted as blocked");
assert(freeTextState.slots[0].status === "blocked_missing_envelope", "free text task without envelope must be blocked_missing_envelope");
assert(freeTextState.slots[0].blockedReasons.includes("free_text_task_input_forbidden"), "free text blocker must be explicit");
assert(freeTextState.summary.canExecute === 0, "runner cannot execute");

const state = buildSubagentRunnerState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  videoExecutionPreview: fixtureVideoExecutionPreview(),
  generationHarness: fixtureGenerationHarness(),
  qaHarness: fixtureQaHarness(),
});

assert(state.dryRunOnly === true, "subagentRunner dryRunOnly must be true");
assert(state.diagnosticsOnly === true, "subagentRunner diagnosticsOnly must be true");
assert(state.noSpawnAgent === true, "subagentRunner must not spawn agents");
assert(state.noSubprocess === true, "subagentRunner must not start subprocesses");
assert(state.noShellExecution === true, "subagentRunner must not execute shell");
assert(state.noProviderExecution === true, "subagentRunner must not execute providers");
assert(state.noCredentialRead === true, "subagentRunner must not read credentials");
assert(state.noFileMutation === true, "subagentRunner must not mutate files");
assert(state.providerSubmissionForbidden === true, "subagentRunner must forbid provider submission");
assert(state.liveSubmitAllowed === false, "subagentRunner liveSubmitAllowed must be false");

const videoSlot = state.slots.find((slot) => slot.taskKind === "video_execution");
assert(videoSlot, "video execution packet preview should create a runner slot");
assert(videoSlot.status === "planned", "validated video packet should be planned for diagnostics");
assert(videoSlot.envelopeStatus === "validated", "video packet envelope should validate");
assert(videoSlot.envelopeId === "subagent_video_A1_01", "video slot must keep envelope id");
assert(videoSlot.canExecute === false, "video slot cannot execute");
assert(videoSlot.requirementChecks.every((check) => check.present), "validated envelope must satisfy all packet requirements");

const missingEnvelopeSlots = state.slots.filter((slot) => slot.envelopeStatus === "missing");
assert(missingEnvelopeSlots.length >= 6, "generation and QA-derived coverage should remain missing envelopes");
assert(
  missingEnvelopeSlots.every((slot) => ["planned_missing_envelope", "blocked_missing_envelope"].includes(slot.status)),
  "tasks without envelopes cannot become ready/planned validated slots",
);
assert(
  missingEnvelopeSlots.every((slot) => slot.blockedReasons.includes("validated_subagent_task_envelope_required")),
  "missing envelope slots must explain validated envelope requirement",
);

for (const taskKind of ["image", "asset", "pair_qa", "scene_qa", "story_audit", "video_execution", "audio", "export"]) {
  assert(state.coverage.some((entry) => entry.taskKind === taskKind), `coverage must include ${taskKind}`);
}
assert(state.coverage.find((entry) => entry.taskKind === "video_execution").planned === 1, "video execution coverage should recognize validated packet");
assert(state.coverage.find((entry) => entry.taskKind === "image").plannedMissingEnvelope === 1, "image coverage should be planned_missing_envelope");
assert(state.coverage.find((entry) => entry.taskKind === "asset").plannedMissingEnvelope === 1, "asset coverage should be planned_missing_envelope");
assert(state.coverage.find((entry) => entry.taskKind === "export").totalSlots === 0, "export coverage should be present but missing for now");

const requiredPackets = [
  "source_index_hash",
  "provider_policy",
  "expected_output_contract",
  "acceptance_checklist",
  "output_schema",
  "forbidden_actions",
];
for (const requirement of requiredPackets) {
  assert(state.packetRequirements.some((item) => item.requirementId === requirement && item.required === true), `packet requirement missing ${requirement}`);
}

const schema = readJson("schemas/subagent_runner.schema.json");
assert(schema.title === "SubagentRunnerState", "subagent runner schema title drifted");
assert(schema.properties.noFreeTextTask.const === true, "schema must pin noFreeTextTask=true");
assert(schema.properties.validatedEnvelopeRequired.const === true, "schema must pin validatedEnvelopeRequired=true");
assert(schema.properties.providerSubmissionForbidden.const === true, "schema must pin provider submission forbidden");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed=false");
assert(schema.$defs.hardLocks.properties.noShellExecution.const === true, "schema must pin no shell execution");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("subagentRunner"), "project runtime schema must require subagentRunner");
assert(projectSchema.properties.subagentRunner.$ref === "subagent_runner.schema.json", "project runtime schema must reference subagent_runner schema");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("subagent_runner.schema.json"), "schema registry must include subagent_runner.schema.json");
assert(registrySource.includes("SubagentRunnerState"), "schema registry must include SubagentRunnerState type");

console.log(
  `Subagent runner tests passed: ${state.summary.totalSlots} slots, ${state.summary.validatedEnvelopes} validated envelope, ${state.summary.missingEnvelopes} missing envelopes.`,
);
