import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LanguageModel, ModelMessage, ToolSet } from "ai";

import {
  buildInputHash,
  buildNonOverridableGateHashes,
  buildPolicyBinding,
  envelopeSchemaVersion,
} from "../src/core/envelopeValidator.ts";
import type { TaskEnvelope } from "../src/core/types.ts";
import {
  canPromoteOwnedAgentResult,
  createLanyiImage2AgentTool,
  createOwnedAgentToolRegistry,
  lanyiImage2AgentToolName,
  runOwnedAgentTaskEnvelope,
  validateOwnedAgentTaskEnvelope,
  type LLMCallResult,
  type LLMProvider,
} from "../src/agent/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function assertSubmitPlanCandidate(
  value: unknown,
  expected: {
    label: string;
    providerMode: string;
    taskEnvelopeId: string;
    inputHash: string;
    shotId: string;
    expectedOutputPath: string;
  },
): void {
  const plan = asRecord(value, expected.label);
  assert(plan.kind === "lanyi_image2_submit_plan_candidate", `${expected.label}.kind must expose a Lanyi/Image2 submit plan candidate`);
  assert(plan.taskEnvelopeId === expected.taskEnvelopeId, `${expected.label}.taskEnvelopeId must match TaskEnvelope`);
  assert(plan.inputHash === expected.inputHash, `${expected.label}.inputHash must match TaskEnvelope inputHash`);
  assert(typeof plan.permissionReceiptId === "string" && plan.permissionReceiptId.length > 0, `${expected.label}.permissionReceiptId must be present`);
  assert(plan.shotId === expected.shotId, `${expected.label}.shotId must be derived from the expected output`);
  assert(plan.expectedOutputPath === expected.expectedOutputPath, `${expected.label}.expectedOutputPath must match the candidate path`);
  assert(plan.providerMode === expected.providerMode, `${expected.label}.providerMode must match the selected provider mode`);
  assert(plan.providerCalled === false, `${expected.label}.providerCalled must stay false`);
  assert(plan.networkIoAllowed === false, `${expected.label}.networkIoAllowed must stay false`);
  assert(plan.liveSubmitAllowed === false, `${expected.label}.liveSubmitAllowed must stay false`);
  assert(plan.promotionAllowed === false, `${expected.label}.promotionAllowed must stay false`);
}

function assertOwnedImage2SubmitPlans(
  result: unknown,
  expected: Parameters<typeof assertSubmitPlanCandidate>[1],
): void {
  const record = asRecord(result, "owned result");
  assert(Array.isArray(record.image2SubmitPlans), "owned result must expose image2SubmitPlans");
  assert(record.image2SubmitPlans.length === 1, "owned result should expose exactly one Lanyi/Image2 submit plan for this run");
  assertSubmitPlanCandidate(record.image2SubmitPlans[0], expected);
}

function taskEnvelope(id = "task_owned_agent_lanyi_image2_A1_01"): TaskEnvelope {
  const base = {
    schemaVersion: envelopeSchemaVersion,
    id,
    purpose: "keyframe",
    providerSlot: "image.generate",
    providerId: "lanyi-image2",
    executionState: "planned",
    requiredMode: "text2image",
    storyFunction: "Hero waits on an empty platform under soft morning light.",
    sourceIndexHash: "source_hash_lanyi_agent_123",
    dependencies: [],
    contextLevel: "L2",
    expectedOutputs: ["outputs/lanyi-image2/A1_01_start.png"],
    hardRules: ["no_free_text_task", "provider_submit_forbidden", "live_submit_forbidden"],
    references: [{
      id: "hero_locked",
      path: "visual_memory/hero_locked.png",
      referenceRole: "identity_authority",
      authorityScope: ["prompt_reference", "future_reference"],
      polarity: "positive",
      lockedStatus: "locked",
      allowedUse: ["prompt_reference", "future_reference", "draft_preview"],
      canPromoteToFormal: true,
      canUseAsFutureReference: true,
    }],
    qaChecklist: ["identity_gate", "scene_gate", "story_gate"],
    preflight: {
      taskId: id,
      preflightScope: "formal_execution",
      status: "pass",
      blockers: [],
      warnings: [],
      checkedAt: "2026-05-18T00:00:00.000Z",
    },
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    sourceFactTrace: ["source_index:source_hash_lanyi_agent_123"],
    blockingReasons: [],
  } as TaskEnvelope;
  const policyBinding = buildPolicyBinding(base);
  const withBinding = {
    ...base,
    policyBinding,
    nonOverridableGateHashes: buildNonOverridableGateHashes({ ...base, policyBinding }),
  };
  return {
    ...withBinding,
    inputHash: buildInputHash(withBinding),
  };
}

const root = mkdtempSync(join(tmpdir(), "owned-agent-lanyi-image2-"));

try {
  const envelope = taskEnvelope();
  const validatedEnvelope = validateOwnedAgentTaskEnvelope(envelope);

  const mockRegistry = createOwnedAgentToolRegistry({ providerMode: "mock_provider" });
  assert(mockRegistry.listToolNames().includes(lanyiImage2AgentToolName), "owned agent registry should expose the Lanyi/Image2 dry-run tool");
  assert(!mockRegistry.listToolNames().includes("image2_generate"), "owned agent registry must keep legacy image2_generate hidden");

  const directMockTool = createLanyiImage2AgentTool();
  const directMock = await directMockTool.execute({
    kind: "validated_task_envelope_ref",
    taskEnvelopeId: envelope.id,
  }, {
    taskEnvelope: envelope as unknown as Record<string, unknown>,
    sandboxRoot: root,
    sessionId: "lanyi-direct-mock",
  });
  assert(directMock.status === "mock_candidate_ready", "default Lanyi/Image2 adapter should be mock/dry-run");
  assert(directMock.providerMode === "mock_lanyi_image2_provider", "mock path should name the mock Lanyi/Image2 provider");
  assert(directMock.providerCalled === false, "mock Lanyi/Image2 path must not call the provider");
  assert(directMock.promotionAllowed === false, "mock candidate must not auto-promote");
  assert(directMock.receiptCandidate.reviewRequired === true, "mock candidate should require review");
  assert(directMock.receiptCandidate.expectedOutputPath === envelope.expectedOutputs[0], "validated envelope ref should derive expected output path");
  assertSubmitPlanCandidate(directMock.submitPlanCandidate, {
    label: "direct mock submitPlanCandidate",
    providerMode: "mock_lanyi_image2_provider",
    taskEnvelopeId: envelope.id,
    inputHash: envelope.inputHash,
    shotId: "A1_01",
    expectedOutputPath: envelope.expectedOutputs[0],
  });

  const directRealTool = createLanyiImage2AgentTool({ providerMode: "real_lanyi_image2_provider" });
  const directReal = await directRealTool.execute({
    kind: "structured_lanyi_image2_task",
    taskEnvelopeId: envelope.id,
    promptText: "Structured prompt text from the validated keyframe plan.",
    requiredMode: "text2image",
    expectedOutputPath: "outputs/lanyi-image2/A1_01_start.png",
    references: [{ id: "hero_locked", path: "visual_memory/hero_locked.png", role: "identity_authority" }],
    qaChecklist: ["identity_gate"],
  }, {
    taskEnvelope: envelope as unknown as Record<string, unknown>,
    sandboxRoot: root,
    sessionId: "lanyi-direct-real",
  });
  assert(directReal.status === "real_provider_gated", "real Lanyi/Image2 adapter should only return a gated contract");
  assert(directReal.providerMode === "real_lanyi_image2_provider", "real path should name the real Lanyi/Image2 provider");
  assert(directReal.realProviderGateContract?.networkIoAllowed === false, "real gated contract must not allow network I/O");
  assert(directReal.realProviderGateContract?.requiresExplicitMainThreadConfirmation === true, "real gated contract should require explicit main-thread confirmation");
  assert(directReal.providerCalled === false, "real gated contract must not submit to the provider in this test");
  assertSubmitPlanCandidate(directReal.submitPlanCandidate, {
    label: "direct real submitPlanCandidate",
    providerMode: "real_lanyi_image2_provider",
    taskEnvelopeId: envelope.id,
    inputHash: envelope.inputHash,
    shotId: "A1_01",
    expectedOutputPath: envelope.expectedOutputs[0],
  });

  let freeTextRejected = false;
  try {
    await directMockTool.execute({
      prompt: "free text should not be accepted",
    } as never, {
      taskEnvelope: envelope as unknown as Record<string, unknown>,
      sandboxRoot: root,
      sessionId: "lanyi-free-text",
    });
  } catch (error) {
    freeTextRejected = Boolean(error);
  }
  assert(freeTextRejected, "Lanyi/Image2 agent tool must reject free-text shaped input");

  const mockProvider: LLMProvider = {
    async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      assert(tools?.[lanyiImage2AgentToolName], "owned loop should expose the structured Lanyi/Image2 tool");
      assert(!tools?.image2_generate, "owned loop must still hide legacy image2_generate");
      if (messages.length <= 2) {
        return {
          text: null,
          toolCalls: [{
            id: "lanyi-tool-call-1",
            name: lanyiImage2AgentToolName,
            args: {
              kind: "validated_task_envelope_ref",
              taskEnvelopeId: envelope.id,
            },
          }],
          finishReason: "tool-calls",
        };
      }
      return {
        text: "Lanyi/Image2 candidate prepared for review.",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  };

  const ownedResult = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope: validatedEnvelope,
    sandboxRoot: root,
    sessionId: "owned-agent-lanyi-loop",
    createdAt: "2026-05-18T00:00:00.000Z",
    config: {
      providerMode: "mock_provider",
      providerClient: mockProvider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "Owned agent Lanyi/Image2 mock provider.",
      },
    },
  });
  assert(ownedResult.status === "succeeded", `owned loop should produce a structured result: ${ownedResult.blockedReasons.join("; ")}`);
  assert(ownedResult.providerCalled === false, "owned loop Lanyi/Image2 dry-run must not call provider");
  assert(ownedResult.toolTrace[0]?.toolName === lanyiImage2AgentToolName, "owned loop should record the Lanyi/Image2 tool trace");
  assert(ownedResult.evidenceRefs.some((ref) => ref.startsWith("lanyi_image2_agent_tool#")), "owned loop should expose Lanyi/Image2 evidence refs");
  assert(ownedResult.outputPaths.includes(envelope.expectedOutputs[0]), "owned loop should expose expected output path candidate");
  assertOwnedImage2SubmitPlans(ownedResult, {
    label: "owned mock image2SubmitPlans[0]",
    providerMode: "mock_lanyi_image2_provider",
    taskEnvelopeId: envelope.id,
    inputHash: envelope.inputHash,
    shotId: "A1_01",
    expectedOutputPath: envelope.expectedOutputs[0],
  });
  assert(ownedResult.receiptCandidate?.reviewRequired === true, "owned loop receipt should require review for Lanyi/Image2 candidates");
  assert(ownedResult.receiptCandidate?.canPromote === false, "owned loop receipt must not be directly promotable for Lanyi/Image2 candidates");
  assert(ownedResult.promotionAllowed === false, "owned loop must not auto-promote Lanyi/Image2 candidates");
  assert(!canPromoteOwnedAgentResult(ownedResult), "promotion helper must reject Lanyi/Image2 candidates until later review gates promote them");
  assert(
    !canPromoteOwnedAgentResult({
      ...ownedResult,
      receiptCandidate: undefined,
      promotionAllowed: true,
    }),
    "promotion helper must reject Lanyi/Image2 submit plans when the owned receipt candidate is missing",
  );

  console.log("owned-agent-lanyi-image2-tool-test passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
