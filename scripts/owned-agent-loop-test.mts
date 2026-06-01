import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

function assertImage2SubmitPlan(
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
  assert(plan.shotId === expected.shotId, `${expected.label}.shotId must be derived from expectedOutputPath`);
  assert(plan.expectedOutputPath === expected.expectedOutputPath, `${expected.label}.expectedOutputPath must match TaskEnvelope expected output`);
  assert(plan.providerMode === expected.providerMode, `${expected.label}.providerMode must match the selected provider path`);
  assert(plan.providerCalled === false, `${expected.label}.providerCalled must stay false`);
  assert(plan.networkIoAllowed === false, `${expected.label}.networkIoAllowed must stay false`);
  assert(plan.liveSubmitAllowed === false, `${expected.label}.liveSubmitAllowed must stay false`);
  assert(plan.promotionAllowed === false, `${expected.label}.promotionAllowed must stay false`);
}

function assertOwnedImage2SubmitPlans(
  result: unknown,
  expected: Parameters<typeof assertImage2SubmitPlan>[1],
): void {
  const record = asRecord(result, "owned result");
  assert(Array.isArray(record.image2SubmitPlans), "owned result must expose image2SubmitPlans");
  assert(record.image2SubmitPlans.length === 1, "owned result should expose exactly one Image2 submit plan candidate for this run");
  assertImage2SubmitPlan(record.image2SubmitPlans[0], expected);
}

function taskEnvelope(id = "task_owned_agent_image_A1_01"): TaskEnvelope {
  const base = {
    schemaVersion: envelopeSchemaVersion,
    id,
    purpose: "keyframe",
    providerSlot: "image.generate",
    providerId: "image2",
    executionState: "planned",
    requiredMode: "text2image",
    storyFunction: "Hero checks the empty platform.",
    sourceIndexHash: "source_hash_owned_agent_123",
    dependencies: [],
    contextLevel: "L2",
    expectedOutputs: ["outputs/keyframes/A1_01_start.png"],
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
      checkedAt: "2026-05-16T02:00:00.000Z",
    },
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    sourceFactTrace: ["source_index:source_hash_owned_agent_123"],
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

function contentText(message: ModelMessage): string {
  return typeof message.content === "string" ? message.content : JSON.stringify(message.content);
}

const root = mkdtempSync(join(tmpdir(), "owned-agent-loop-"));

try {
  const mockCalls: ModelMessage[][] = [];
  const mockProvider: LLMProvider = {
    async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      mockCalls.push(JSON.parse(JSON.stringify(messages)) as ModelMessage[]);
      assert(tools?.agent_file, "owned agent mock path should expose the controlled file tool");
      assert(!tools?.image2_generate, "mock_provider path must not expose the real Image2 tool by default");

      if (mockCalls.length === 1) {
        assert(contentText(messages[messages.length - 1]).includes("TaskEnvelope id: task_owned_agent_image_A1_01"), "prompt must be derived from the TaskEnvelope");
        return {
          text: null,
          toolCalls: [{
            id: "owned-tool-write",
            name: "agent_file",
            args: {
              action: "write_text",
              path: "evidence/owned-agent/result.txt",
              content: "owned agent evidence",
            },
          }],
          finishReason: "tool-calls",
          usage: { inputTokens: 20, outputTokens: 8 },
        };
      }

      return {
        text: "Structured owned-agent result is ready.",
        toolCalls: [],
        finishReason: "stop",
        usage: { inputTokens: 24, outputTokens: 10 },
      };
    },
  };

  const envelope = taskEnvelope();
  const validatedEnvelope = validateOwnedAgentTaskEnvelope(envelope);
  const result = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope: validatedEnvelope,
    sandboxRoot: root,
    sessionId: "owned-agent-session-1",
    createdAt: "2026-05-16T02:00:00.000Z",
    config: {
      providerMode: "mock_provider",
      providerClient: mockProvider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "Owned agent loop test provider.",
      },
      maxTurns: 4,
    },
  });

  assert(result.status === "succeeded", `owned agent run should succeed: ${result.blockedReasons.join("; ")}`);
  assert(result.validation.valid, "owned agent must validate TaskEnvelope input");
  assert(result.providerPath === "mock_provider_path", "structured result should name the mock provider path");
  assert(result.receiptCandidate?.taskEnvelopeId === envelope.id, "succeeded owned agent run should produce receipt candidate");
  assert(result.receiptCandidate.providerMode === "mock_provider", "receipt candidate should name mock_provider path");
  assert(result.receiptCandidate.providerPath === "mock_provider_path", "receipt candidate should name mock_provider_path");
  assert(result.promotionAllowed === true && canPromoteOwnedAgentResult(result), "receipt candidate should be required for promotion");
  assert(
    !canPromoteOwnedAgentResult({
      ...result,
      receiptCandidate: undefined,
      promotionAllowed: true,
    }),
    "promotion helper must reject succeeded structured results when the receipt is missing",
  );
  assert(
    !canPromoteOwnedAgentResult({
      ...result,
      receiptCandidate: {
        ...result.receiptCandidate,
        structuredResultHash: "tampered_receipt_hash",
      },
    }),
    "promotion helper must reject tampered receipt hashes",
  );
  assert(result.evidenceRefs.includes("agent_file#evidence/owned-agent/result.txt"), "structured result should expose evidence refs");
  assert(result.outputPaths.includes("evidence/owned-agent/result.txt"), "structured result should expose controlled output path");
  assert(result.checkpoint.turnCount >= 2 && result.checkpoint.messageCount >= 5, "owned agent should return a session checkpoint");
  assert(existsSync(join(root, "evidence/owned-agent/result.txt")), "controlled file tool should write inside sandbox evidence path");
  assert(readFileSync(join(root, "evidence/owned-agent/result.txt"), "utf8") === "owned agent evidence", "controlled file content should roundtrip");

  let invalidEnvelopeRejected = false;
  try {
    validateOwnedAgentTaskEnvelope({ ...envelope, inputHash: "tampered_hash" });
  } catch (error) {
    invalidEnvelopeRejected = String(error).includes("input_hash_mismatch");
  }
  assert(invalidEnvelopeRejected, "invalid TaskEnvelope must be rejected before owned agent run input is created");
  assert(mockCalls.length === 2, "invalid TaskEnvelope must not call the provider");

  const noEvidenceProvider: LLMProvider = {
    async call(): Promise<LLMCallResult> {
      return {
        text: "I have no controlled evidence.",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  };
  const noEvidence = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope: validatedEnvelope,
    sandboxRoot: root,
    sessionId: "owned-agent-no-evidence",
    config: {
      providerMode: "mock_provider",
      providerClient: noEvidenceProvider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "Owned agent loop no evidence test provider.",
      },
    },
  });
  assert(noEvidence.status === "failed", "completed run without controlled evidence should not become a succeeded result");
  assert(noEvidence.blockedReasons.includes("receipt_candidate_missing"), "no evidence run should expose missing receipt candidate");
  assert(!noEvidence.receiptCandidate && noEvidence.promotionAllowed === false, "no evidence must mean no receipt candidate and no promotion");

  const escapeProvider: LLMProvider = {
    async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      if (messages.length <= 2) {
        assert(tools?.agent_file, "escape test should expose file tool");
        return {
          text: null,
          toolCalls: [{
            id: "owned-tool-escape",
            name: "agent_file",
            args: {
              action: "write_text",
              path: "../escape.txt",
              content: "escape",
            },
          }],
          finishReason: "tool-calls",
        };
      }
      return { text: "done", toolCalls: [], finishReason: "stop" };
    },
  };
  const escaped = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope: validatedEnvelope,
    sandboxRoot: root,
    sessionId: "owned-agent-escape",
    config: {
      providerMode: "mock_provider",
      providerClient: escapeProvider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "Owned agent loop escape test provider.",
      },
    },
  });
  assert(escaped.status === "failed", "file sandbox escape should fail the owned agent run");
  assert(!escaped.receiptCandidate && escaped.promotionAllowed === false, "failed run without receipt cannot promote");
  assert(escaped.toolTrace.some((item) => item.error?.includes("project-relative")), "file tool should explain scoped path failure");

  let image2RequestCount = 0;
  const image2Server = createServer((request, response) => {
    image2RequestCount += 1;
    request.resume();
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      images: ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="],
      parameters: { seed: 1234 },
    }));
  });
  await new Promise<void>((resolve) => image2Server.listen(0, "127.0.0.1", resolve));
  const image2Address = image2Server.address() as AddressInfo;
  const image2BaseUrl = `http://127.0.0.1:${image2Address.port}`;
  try {
    const realImage2BypassProvider: LLMProvider = {
      async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
        assert(!tools?.image2_generate, "real_provider path must not expose image2_generate without a P6 permission/action-time gate");
        if (messages.length <= 2) {
          return {
            text: null,
            toolCalls: [{
              id: "owned-tool-image2-bypass",
              name: "image2_generate",
              args: {
                prompt: "attempted direct Image2 bypass",
                width: 64,
                height: 64,
                outputPath: "outputs/owned-image2/result.png",
              },
            }],
            finishReason: "tool-calls",
          };
        }
        return { text: "Image2 bypass blocked.", toolCalls: [], finishReason: "stop" };
      },
    };
    const realImage2Bypass = await runOwnedAgentTaskEnvelope({
      validatedTaskEnvelope: validatedEnvelope,
      sandboxRoot: root,
      sessionId: "owned-agent-real-image2-bypass",
      config: {
        providerMode: "real_provider",
        providerClient: realImage2BypassProvider,
        provider: {
          model: {} as LanguageModel,
          systemPrompt: "Owned agent loop real provider Image2 bypass test.",
        },
        image2Tool: { apiBaseUrl: image2BaseUrl },
      },
    });
    assert(realImage2Bypass.status === "failed", "real_provider Image2 bypass without P6 gate should fail closed");
    assert(realImage2Bypass.providerPath === "real_provider_path", "structured result should name the real provider path");
    assert(realImage2Bypass.providerCalled === false, "providerCalled must stay false when image2_generate is not registered");
    assert(!realImage2Bypass.receiptCandidate && realImage2Bypass.promotionAllowed === false, "blocked Image2 bypass must not promote");
    assert(realImage2Bypass.toolTrace.some((item) => item.toolName === "image2_generate" && item.error?.includes("Unknown tool")), "bypass attempt should be recorded as an unknown owned-loop tool");
    assert(!existsSync(join(root, "outputs/owned-image2/result.png")), "blocked Image2 bypass must not write an output image");
    assert(image2RequestCount === 0, "real_provider Image2 bypass must not call the fake API without P6 gate evidence");

    const realLanyiProvider: LLMProvider = {
      async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
        assert(tools?.[lanyiImage2AgentToolName], "real_provider path should expose the gated Lanyi/Image2 submit-plan tool");
        assert(!tools?.image2_generate, "real_provider path must keep legacy image2_generate hidden");
        if (messages.length <= 2) {
          return {
            text: null,
            toolCalls: [{
              id: "owned-tool-lanyi-real-gated",
              name: lanyiImage2AgentToolName,
              args: {
                kind: "validated_task_envelope_ref",
                taskEnvelopeId: envelope.id,
              },
            }],
            finishReason: "tool-calls",
          };
        }
        return { text: "Lanyi/Image2 real provider submit plan is gated.", toolCalls: [], finishReason: "stop" };
      },
    };
    const realLanyiGated = await runOwnedAgentTaskEnvelope({
      validatedTaskEnvelope: validatedEnvelope,
      sandboxRoot: root,
      sessionId: "owned-agent-real-lanyi-gated",
      config: {
        providerMode: "real_provider",
        providerClient: realLanyiProvider,
        provider: {
          model: {} as LanguageModel,
          systemPrompt: "Owned agent loop real Lanyi/Image2 gated plan test.",
        },
        lanyiImage2Tool: { baseUrl: image2BaseUrl },
      },
    });
    assert(realLanyiGated.status === "succeeded", `real Lanyi/Image2 path should return a gated submit plan: ${realLanyiGated.blockedReasons.join("; ")}`);
    assert(realLanyiGated.providerCalled === false, "real Lanyi/Image2 gated submit plan must not call the provider");
    assert(realLanyiGated.toolTrace[0]?.toolName === lanyiImage2AgentToolName, "real Lanyi/Image2 run should record the submit-plan tool trace");
    const lanyiOutput = asRecord(realLanyiGated.toolTrace[0]?.output, "real Lanyi/Image2 tool output");
    assert(lanyiOutput.status === "real_provider_gated", "real Lanyi/Image2 tool output must be a gated plan");
    assertImage2SubmitPlan(lanyiOutput.submitPlanCandidate, {
      label: "real Lanyi/Image2 tool submitPlanCandidate",
      providerMode: "real_lanyi_image2_provider",
      taskEnvelopeId: envelope.id,
      inputHash: envelope.inputHash,
      shotId: "A1_01",
      expectedOutputPath: envelope.expectedOutputs[0],
    });
    const gate = asRecord(lanyiOutput.realProviderGateContract, "real Lanyi/Image2 gate contract");
    assert(gate.providerCalled === false, "real Lanyi/Image2 gate contract must keep providerCalled=false");
    assert(gate.networkIoAllowed === false, "real Lanyi/Image2 gate contract must keep networkIoAllowed=false");
    assertOwnedImage2SubmitPlans(realLanyiGated, {
      label: "real owned image2SubmitPlans[0]",
      providerMode: "real_lanyi_image2_provider",
      taskEnvelopeId: envelope.id,
      inputHash: envelope.inputHash,
      shotId: "A1_01",
      expectedOutputPath: envelope.expectedOutputs[0],
    });
    assert(realLanyiGated.promotionAllowed === false, "real Lanyi/Image2 gated submit plan must not promote");
    assert(!canPromoteOwnedAgentResult(realLanyiGated), "real Lanyi/Image2 gated submit plan must not be promotable");
    assert(
      !canPromoteOwnedAgentResult({
        ...realLanyiGated,
        receiptCandidate: undefined,
        promotionAllowed: true,
      }),
      "promotion helper must reject real Lanyi/Image2 submit plans when the owned receipt candidate is missing",
    );
    assert(image2RequestCount === 0, "real Lanyi/Image2 gated submit plan must not perform network I/O");
  } finally {
    await new Promise<void>((resolve) => image2Server.close(() => resolve()));
  }

  const mockRegistry = createOwnedAgentToolRegistry({ providerMode: "mock_provider" });
  assert(mockRegistry.listToolNames().includes("agent_file"), "owned mock registry should include file tool");
  assert(!mockRegistry.listToolNames().includes("image2_generate"), "owned mock registry should not include real Image2 tool");
  const realRegistry = createOwnedAgentToolRegistry({
    providerMode: "real_provider",
    image2Tool: { apiBaseUrl: "http://127.0.0.1:9" },
  });
  assert(!realRegistry.listToolNames().includes("image2_generate"), "owned real registry must not expose Image2 without P6 permission/action-time gate evidence");

  console.log(
    `owned-agent-loop-test passed: evidence=${result.evidenceRefs.length}, tools=${mockRegistry.listToolNames().join(",")}, realTools=${realRegistry.listToolNames().join(",")}.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
