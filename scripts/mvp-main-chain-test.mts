import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LanguageModel, ModelMessage, ToolSet } from "ai";

import type { TaskEnvelope } from "../src/core/types.ts";
import {
  canPromoteOwnedAgentResult,
  runOwnedAgentTaskEnvelope,
  validateOwnedAgentTaskEnvelope,
  type LLMCallResult,
  type LLMProvider,
} from "../src/agent/index.ts";
import {
  confirmProjectVibeCreativeLoop,
  hashProjectVibeFacts,
  parseProjectVibeText,
  stageProjectVibeCreativeLoop,
} from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function contentText(message: ModelMessage): string {
  return typeof message.content === "string" ? message.content : JSON.stringify(message.content);
}

function firstQueuedTaskEnvelope(result: ReturnType<typeof confirmProjectVibeCreativeLoop>): TaskEnvelope {
  const queuedIds = new Set(result.taskEnqueuePlan.items
    .filter((item) => item.queueStatus === "queued")
    .map((item) => item.taskEnvelopeId)
    .filter(Boolean));
  const packets = result.workflow.taskPacketState.packets as Array<{
    envelope?: { taskEnvelope?: TaskEnvelope };
  }>;
  const envelope = packets
    .map((packet) => packet.envelope?.taskEnvelope)
    .find((candidate): candidate is TaskEnvelope => Boolean(candidate && queuedIds.has(candidate.id)));
  assert(envelope, "confirmed creative loop should expose a queued validated task envelope");
  return envelope;
}

const generatedAt = "2026-05-16T03:00:00.000Z";
const root = mkdtempSync(join(tmpdir(), "vibe-mvp-main-chain-"));

try {
  const fixtureText = readFileSync("test-fixtures/projects/agent-loop-minimal/project.vibe", "utf8");
  const parsed = parseProjectVibeText(fixtureText);
  assert(parsed.ok && parsed.project, `fixture Project.vibe should parse: ${parsed.errors.join("; ")}`);
  const beforeHash = hashProjectVibeFacts(parsed.project);

  const userIntent = "让这个镜头更紧张，保留角色和场景";
  const staged = stageProjectVibeCreativeLoop({
    project: parsed.project,
    userIntent,
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: root,
    projectPath: "project.vibe",
  });
  assert(staged.status === "awaiting_confirmation", `natural language should stage first: ${staged.blockedReasons.join("; ")}`);
  assert(staged.projectVibeWritten === false, "staged natural-language input must not write Project.vibe");
  assert(staged.taskEnqueuePlan.noFreeTextTask === true, "staged task plan must reject free text formal tasks");
  assert(staged.taskEnqueuePlan.items.every((item) => item.queueStatus !== "queued"), "staged tasks must not queue before confirmation");

  const confirmed = confirmProjectVibeCreativeLoop({
    project: parsed.project,
    userIntent,
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: root,
    projectPath: "project.vibe",
    userConfirmed: true,
  });
  assert(confirmed.status === "project_facts_written", `confirmation should write project facts: ${confirmed.blockedReasons.join("; ")}`);
  assert(confirmed.nextProject, "confirmed creative loop should return the next Project.vibe");
  assert(hashProjectVibeFacts(confirmed.nextProject) !== beforeHash, "Project.vibe hash should change only after confirmation");
  assert(confirmed.formalTaskInputsAreValidated === true, "confirmed tasks must be validated envelopes");
  assert(confirmed.freeTextFormalTaskBlocked === true, "free text must remain blocked from formal task enqueue");
  assert(confirmed.providerCalled === false && confirmed.workerSpawned === false, "Project.vibe confirmation must not call providers or spawn workers");

  const taskEnvelope = firstQueuedTaskEnvelope(confirmed);
  const validatedTaskEnvelope = validateOwnedAgentTaskEnvelope(taskEnvelope);
  const expectedOutput = taskEnvelope.expectedOutputs[0];
  assert(expectedOutput, "queued task envelope should declare an expected output");

  let callCount = 0;
  const provider: LLMProvider = {
    async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      callCount += 1;
      assert(tools?.agent_file, "owned agent mock path should expose only the controlled file tool");
      assert(!tools?.image2_generate, "MVP main-chain mock path must not expose Image2 direct generation");
      if (callCount === 1) {
        assert(contentText(messages[messages.length - 1]).includes(`TaskEnvelope id: ${taskEnvelope.id}`), "owned agent prompt must be derived from the queued envelope");
        return {
          text: null,
          toolCalls: [{
            id: "mvp-main-chain-write",
            name: "agent_file",
            args: {
              action: "write_text",
              path: expectedOutput,
              content: "mvp main-chain controlled evidence",
            },
          }],
          finishReason: "tool-calls",
        };
      }
      return {
        text: "Structured MVP main-chain result is ready.",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  };

  const agentResult = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope,
    sandboxRoot: root,
    sessionId: "mvp-main-chain-agent-session",
    createdAt: generatedAt,
    config: {
      providerMode: "mock_provider",
      providerClient: provider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "MVP main-chain mock owned agent.",
      },
      maxTurns: 4,
    },
  });
  assert(agentResult.status === "succeeded", `owned agent should consume queued envelope: ${agentResult.blockedReasons.join("; ")}`);
  assert(agentResult.receiptCandidate?.taskEnvelopeId === taskEnvelope.id, "owned agent success should produce a receipt candidate linked to the envelope");
  assert(agentResult.promotionAllowed === true && canPromoteOwnedAgentResult(agentResult), "owned agent promotion requires the receipt candidate");
  assert(agentResult.providerCalled === false, "mock owned-agent main chain must not call Image2/provider");
  assert(existsSync(join(root, expectedOutput)), "owned agent should write controlled evidence at the task expected output");

  const noReceiptProvider: LLMProvider = {
    async call(): Promise<LLMCallResult> {
      return {
        text: "No controlled evidence produced.",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  };
  const noReceipt = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope,
    sandboxRoot: root,
    sessionId: "mvp-main-chain-no-receipt",
    createdAt: generatedAt,
    config: {
      providerMode: "mock_provider",
      providerClient: noReceiptProvider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "MVP main-chain no receipt provider.",
      },
    },
  });
  assert(noReceipt.status === "failed", "owned agent result without controlled evidence should fail");
  assert(!noReceipt.receiptCandidate && noReceipt.promotionAllowed === false, "no receipt candidate means no promotion");

  console.log(`mvp-main-chain-test: ok envelope=${taskEnvelope.id} output=${expectedOutput}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
