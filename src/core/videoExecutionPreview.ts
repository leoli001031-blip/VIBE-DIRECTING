import type {
  GateSet,
  ShotRecord,
  VideoExecutionPreview,
  VideoExecutionPreviewHardLock,
  VideoExecutionPreviewState,
  VideoExecutionPreviewStep,
  VideoPlanningState,
  VideoReadinessGate,
  VideoSubagentPacketPreview,
  VideoTaskPlan,
} from "./types";

export const videoExecutionPreviewSchemaVersion = "0.1.0";

export interface BuildVideoExecutionPreviewStateInput {
  generatedAt: string;
  shots: ShotRecord[];
  videoPlanning: VideoPlanningState;
}

const hardLocks: VideoExecutionPreviewHardLock[] = [
  "no_live_submit",
  "no_fast_model",
  "no_vip_channel",
  "no_text_to_video_main_path",
  "no_bgm_in_video_prompt",
  "start_end_frames_required",
  "subagent_must_use_packet",
];

const executionOrderPreview: VideoExecutionPreviewStep[] = [
  "prepare_subagent_packet",
  "inspect_readiness_gate",
  "compile_provider_adapter_payload_placeholder",
  "wait_for_user_enablement",
];

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function fallbackGateStatus(): GateSet {
  return {
    identity: "UNKNOWN",
    scene: "UNKNOWN",
    prop: "UNKNOWN",
    style: "UNKNOWN",
    pair: "UNKNOWN",
    story: "UNKNOWN",
  };
}

function previewStatus(taskPlan: VideoTaskPlan, gate?: VideoReadinessGate): VideoExecutionPreview["status"] {
  if (taskPlan.status === "blocked" || gate?.status === "blocked" || taskPlan.blockers.length > 0 || (gate?.blockers.length || 0) > 0) {
    return "blocked";
  }
  if (taskPlan.status === "parked" || taskPlan.providerSubmissionForbidden) return "parked";
  return "preview_ready";
}

function buildPacketPreview(input: {
  shot?: ShotRecord;
  taskPlan: VideoTaskPlan;
  gate?: VideoReadinessGate;
  videoPlanning: VideoPlanningState;
}): VideoSubagentPacketPreview {
  const { shot, taskPlan, gate, videoPlanning } = input;
  const keyframePairDerivation = gate?.keyframePairDerivation;
  return {
    selectedShot: {
      shotId: taskPlan.shotId,
      storyFunction: shot?.storyFunction,
      gateStatus: shot?.gates || fallbackGateStatus(),
      taskStatus: taskPlan.status,
      queueStatus: taskPlan.queueStatus,
    },
    startFrameRef: taskPlan.startFrameRef,
    endFrameRef: taskPlan.endFrameRef,
    keyframePairDerivation,
    providerPolicySummary: videoPlanning.providerPolicySummary,
    requiredReadScopes: [
      "ProjectRuntimeState.storyFlow.shots",
      "ProjectRuntimeState.videoPlanning.readinessGates",
      "ProjectRuntimeState.videoPlanning.taskPlans",
      "ProjectRuntimeState.videoPlanning.providerPolicySummary",
      "ProjectRuntimeState.audioPlanning.videoProviderPolicy",
      "ProjectRuntimeState.sourceIndex",
    ],
    forbiddenReadScopes: [
      "provider_credentials",
      "api_keys",
      "live_provider_task_ids",
      "outside_project_runtime_state",
      "unapproved_prompt_files",
    ],
    mustPreserve: keyframePairDerivation?.mustPreserve || ["character identity", "scene layout", "style capsule"],
    allowedDelta: keyframePairDerivation?.allowedDelta || ["motion", "micro-expression", "camera movement"],
    mustNotAdd: keyframePairDerivation?.mustNotAdd || ["new characters", "unapproved props", "text-to-video fallback"],
    expectedOutputContract: {
      format: "video_execution_preview_v1",
      requiredFields: [
        "selectedShot",
        "startFrameRef",
        "endFrameRef",
        "keyframePairDerivation",
        "providerPolicySummary",
        "mustPreserve",
        "allowedDelta",
        "mustNotAdd",
      ],
      artifactPolicy: "no_real_prompt_file_no_provider_task",
      resultScope: "structured_packet_preview_only",
    },
    requiredKnowledgeCategories: ["storyflow", "story_function", "camera", "performance", "provider", "qa"],
  };
}

function buildPreview(input: {
  shot?: ShotRecord;
  taskPlan: VideoTaskPlan;
  gate?: VideoReadinessGate;
  videoPlanning: VideoPlanningState;
}): VideoExecutionPreview {
  const { shot, taskPlan, gate, videoPlanning } = input;
  const status = previewStatus(taskPlan, gate);
  const blockers = uniqueSorted([...(gate?.blockers || []), ...taskPlan.blockers]);
  const warnings = uniqueSorted([
    ...(gate?.warnings || []),
    ...taskPlan.warnings,
    "Packet preview is read-only and waits for later user enablement before any adapter handoff.",
  ]);

  return {
    previewId: `video_execution_preview_${safeId(taskPlan.shotId)}`,
    shotId: taskPlan.shotId,
    taskPlanId: taskPlan.taskPlanId,
    readinessGateId: taskPlan.readinessGateId,
    status,
    providerId: taskPlan.providerId,
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    contextLevel: "L2",
    subagentPurpose: "video_generation",
    instructionSummary:
      status === "blocked"
        ? "Structured packet cannot be prepared until inherited readiness blockers clear."
        : "Structured packet may be inspected for a future parked I2V worker; provider handoff remains disabled.",
    subagentPacketPreview: buildPacketPreview({ shot, taskPlan, gate, videoPlanning }),
    executionOrderPreview,
    hardLocks,
    blockers,
    warnings,
    canPreviewPacket: status !== "blocked",
    canExecute: false,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

export function buildVideoExecutionPreviewState(input: BuildVideoExecutionPreviewStateInput): VideoExecutionPreviewState {
  const shotsById = new Map(input.shots.map((shot) => [shot.id, shot]));
  const gatesById = new Map(input.videoPlanning.readinessGates.map((gate) => [gate.gateId, gate]));
  const previews = input.videoPlanning.taskPlans.map((taskPlan) =>
    buildPreview({
      shot: shotsById.get(taskPlan.shotId),
      taskPlan,
      gate: gatesById.get(taskPlan.readinessGateId),
      videoPlanning: input.videoPlanning,
    }),
  );

  return {
    schemaVersion: videoExecutionPreviewSchemaVersion,
    generatedAt: input.generatedAt,
    previews,
    summary: {
      total: previews.length,
      blocked: previews.filter((preview) => preview.status === "blocked").length,
      previewReady: previews.filter((preview) => preview.status === "preview_ready").length,
      parked: previews.filter((preview) => preview.status === "parked").length,
      canPreviewPacket: previews.filter((preview) => preview.canPreviewPacket).length,
      canExecute: 0,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 7.3 exposes structured subagent packet previews only.",
      "No command, provider handoff, or real prompt artifact is created by this state.",
    ],
  };
}
