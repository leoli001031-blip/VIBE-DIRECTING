import type { LanguageModel, ModelMessage, ToolSet } from "ai";

import {
  lanyiImage2AgentToolName,
  queueOwnedAgentImage2SubmitPlansForP6,
  runOwnedAgentTaskEnvelope,
  validateOwnedAgentTaskEnvelope,
  type LLMCallResult,
  type LLMProvider,
  type OwnedAgentStructuredResult,
} from "../src/agent/index.ts";
import { buildProjectRuntimeStateFromProjectVibe, createProjectVibe, type ProjectVibeDocument } from "../src/project/index.ts";
import type { ProjectRuntimeTaskState, TaskEnvelope } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-18T10:00:00.000Z";

function fixtureProject(videoControlMode: ProjectVibeDocument["shots"][number]["videoControlMode"] = "first_frame_default"): ProjectVibeDocument {
  return createProjectVibe({
    projectId: "owned_agent_project_vibe_image2",
    title: "Owned Agent Project.vibe Image2 Submit Plan",
    version: "0.4.0",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    storyFlow: {
      id: "story_flow_agent_submit",
      sections: [{
        id: "section_signal",
        title: "Signal",
        summary: "A courier finds the signal.",
        sequenceIndex: 0,
        shotIds: ["S010"],
      }],
      shotOrder: ["S010"],
    },
    visualMemory: {
      id: "visual_memory_agent_submit",
      entries: [
        {
          id: "vm_courier",
          assetId: "char_courier",
          kind: "character",
          label: "Courier",
          status: "locked",
          textConstraints: ["yellow raincoat"],
          usedByShotIds: ["S010"],
          canUseAsFutureReference: true,
          sourceRefs: ["fixture"],
        },
        {
          id: "vm_station",
          assetId: "scene_station",
          kind: "scene",
          label: "Station",
          status: "locked",
          textConstraints: ["wet neon platform"],
          usedByShotIds: ["S010"],
          canUseAsFutureReference: true,
          sourceRefs: ["fixture"],
        },
      ],
    },
    shots: [{
      id: "S010",
      sectionId: "section_signal",
      title: "Signal on the platform",
      intent: "The courier pauses as an impossible signal appears on the platform display.",
      sceneAssetIds: ["scene_station"],
      characterAssetIds: ["char_courier"],
      propAssetIds: [],
      durationSeconds: 6,
      status: "ready",
      videoControlMode,
      sourceRefs: ["fixture:shot:S010"],
    }],
    assets: [
      {
        id: "char_courier",
        kind: "character",
        label: "Courier",
        status: "locked",
        path: "assets/char_courier.png",
        textConstraints: ["yellow raincoat"],
        usedByShotIds: ["S010"],
        sourceRefs: ["fixture:asset:char_courier"],
        lockedBy: "user",
      },
      {
        id: "scene_station",
        kind: "scene",
        label: "Station",
        status: "locked",
        path: "assets/scene_station.png",
        textConstraints: ["wet neon platform"],
        usedByShotIds: ["S010"],
        sourceRefs: ["fixture:asset:scene_station"],
        lockedBy: "user",
      },
    ],
    runs: [],
  });
}

function providerFor(envelope: TaskEnvelope): LLMProvider {
  return {
    async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      assert(tools?.[lanyiImage2AgentToolName], "owned agent must expose the gated Lanyi/Image2 submit-plan tool");
      assert(!tools?.image2_generate, "owned agent must not expose legacy image2_generate");
      if (messages.length <= 2) {
        return {
          text: null,
          toolCalls: [{
            id: `tool_${envelope.id}`,
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
        text: "Project.vibe Image2 submit plan is ready for explicit confirmation.",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  };
}

async function runAgentForTask(task: ProjectRuntimeTaskState, sessionId: string): Promise<OwnedAgentStructuredResult> {
  const validatedTaskEnvelope = validateOwnedAgentTaskEnvelope(task.envelope);
  return runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope,
    sandboxRoot: "/tmp/owned-agent-project-vibe-image2",
    sessionId,
    createdAt: generatedAt,
    config: {
      providerMode: "real_provider",
      providerClient: providerFor(task.envelope),
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "Project.vibe owned agent Image2 submit-plan test.",
      },
      lanyiImage2Tool: {
        baseUrl: "http://127.0.0.1:9",
      },
    },
  });
}

function taskBySlot(tasks: ProjectRuntimeTaskState[], slot: "image.generate" | "image.edit") {
  const task = tasks.find((item) => item.envelope.providerSlot === slot);
  assert(task, `Project.vibe runtime should expose ${slot} task envelope`);
  assert(task.validator.valid, `${slot} task envelope must be valid`);
  return task;
}

function taskBySlotOptional(tasks: ProjectRuntimeTaskState[], slot: "image.generate" | "image.edit") {
  return tasks.find((item) => item.envelope.providerSlot === slot);
}

function assertSubmitPlan(result: OwnedAgentStructuredResult, task: ProjectRuntimeTaskState, mode: "text2image" | "image2image") {
  assert(result.status === "succeeded", `owned agent result should succeed: ${result.blockedReasons.join("; ")}`);
  assert(result.providerCalled === false, "owned agent must not call the provider");
  assert(result.promotionAllowed === false, "Image2 submit plan must not auto-promote");
  assert(result.receiptCandidate?.reviewRequired === true, "Image2 receipt candidate should require review");
  assert(result.image2SubmitPlans.length === 1, "owned agent should expose one Image2 submit plan");
  const plan = result.image2SubmitPlans[0];
  assert(plan.taskEnvelopeId === task.envelope.id, "submit plan taskEnvelopeId must match validated envelope");
  assert(plan.inputHash === task.envelope.inputHash, "submit plan inputHash must match validated envelope");
  assert(plan.shotId === "S010", "submit plan shotId should come from Project.vibe shot");
  assert(plan.expectedOutputPath === task.envelope.expectedOutputs[0], "submit plan output path must match envelope");
  assert(plan.providerSlot === task.envelope.providerSlot, "submit plan provider slot must match envelope");
  assert(plan.requiredMode === mode, "submit plan required mode mismatch");
  assert(plan.providerCalled === false && plan.networkIoAllowed === false && plan.liveSubmitAllowed === false, "submit plan must stay non-networked");
  assert(plan.promotionAllowed === false, "submit plan must not allow promotion");
  return plan;
}

const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project: fixtureProject(),
  projectRoot: "/tmp/owned-agent-project-vibe-image2",
  projectPath: "project/project.vibe",
  generatedAt,
});

const startTask = taskBySlot(runtimeState.taskRuns.taskViews, "image.generate");
const defaultEndTask = taskBySlotOptional(runtimeState.taskRuns.taskViews, "image.edit");
assert(!defaultEndTask, "Default Project.vibe first-frame mode must not expose an image.edit end-frame envelope");

const startResult = await runAgentForTask(startTask, "owned-agent-project-vibe-start");
const startPlan = assertSubmitPlan(startResult, startTask, "text2image");

const awaiting = queueOwnedAgentImage2SubmitPlansForP6({ result: startResult, generatedAt });
assert(awaiting.status === "awaiting_user_confirmation", "submit plan must wait for explicit user confirmation");
assert(awaiting.summary.queuedCount === 0 && awaiting.nextRunnable.length === 0, "unconfirmed submit plan must not enter P6 scheduler");
assert(awaiting.providerCalled === false && awaiting.networkIoAllowed === false && awaiting.liveSubmitAllowed === false, "unconfirmed projection must stay non-networked");

const confirmed = queueOwnedAgentImage2SubmitPlansForP6({
  result: startResult,
  generatedAt,
  confirmations: [{
    planId: startPlan.id,
    taskEnvelopeId: startPlan.taskEnvelopeId,
    permissionReceiptId: startPlan.permissionReceiptId,
    confirmed: true,
    confirmedAt: generatedAt,
    phrase: "queue-p6-image2",
  }],
});
assert(confirmed.status === "ready_for_p6_scheduler", "confirmed submit plan should enter the P6 scheduler projection");
assert(confirmed.summary.queuedCount === 1 && confirmed.nextRunnable.length === 1, "confirmed submit plan should create one runnable scheduler attempt");
assert(confirmed.tasks[0]?.taskId === startPlan.taskEnvelopeId, "scheduler taskId must preserve taskEnvelopeId");
assert(confirmed.tasks[0]?.inputHash === startPlan.inputHash, "scheduler inputHash must preserve agent submit plan inputHash");
assert(confirmed.tasks[0]?.permissionReceiptId === startPlan.permissionReceiptId, "scheduler must preserve permissionReceiptId");
assert(confirmed.tasks[0]?.shotId === "S010", "scheduler shotId must preserve Project.vibe shot");
assert(confirmed.tasks[0]?.expectedOutputPath === startPlan.expectedOutputPath, "scheduler output path must preserve submit plan output");
assert(confirmed.schedulerState.summary.providerCalled === false, "P6 scheduler projection must not call provider");

const endpointRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project: fixtureProject("first_last_endpoint"),
  projectRoot: "/tmp/owned-agent-project-vibe-image2",
  projectPath: "project/project.vibe",
  generatedAt,
});
const endTask = taskBySlot(endpointRuntimeState.taskRuns.taskViews, "image.edit");
const endResult = await runAgentForTask(endTask, "owned-agent-project-vibe-end");
const endPlan = assertSubmitPlan(endResult, endTask, "image2image");
const endToolOutput = endResult.toolTrace[0]?.output as { realProviderGateContract?: { endpoint?: string } } | undefined;
assert(endToolOutput?.realProviderGateContract?.endpoint === "/v1/images/edits", "end-frame submit plan must stay on image edit endpoint");
assert(endPlan.expectedOutputPath.endsWith("S010_end.png"), "end-frame submit plan should target the Project.vibe end frame");

console.log(
  `owned-agent-project-vibe-image2-submit-plan-test: start=${startPlan.expectedOutputPath}, endpointEnd=${endPlan.expectedOutputPath}, queued=${confirmed.summary.queuedCount}.`,
);
