import type { PreflightReport, ProjectAudit, ProjectWorkflowState, TaskRun, WorkflowStage } from "./types";

export interface WorkflowGuardInput {
  state: ProjectWorkflowState;
  preflight?: PreflightReport;
  taskRuns?: TaskRun[];
  hasP0Issues?: boolean;
  requiredAssetsReady?: boolean;
  keyframePairsReady?: boolean;
  videosReady?: boolean;
}

export interface WorkflowGuardResult {
  canProceed: boolean;
  nextState?: ProjectWorkflowState;
  blockers: string[];
  allowedActions: string[];
}

const transitions: Partial<Record<ProjectWorkflowState, ProjectWorkflowState[]>> = {
  draft_intake: ["story_structured", "blocked"],
  story_structured: ["production_bible_ready", "blocked"],
  production_bible_ready: ["visual_memory_planned", "blocked"],
  visual_memory_planned: ["visual_memory_ready", "blocked"],
  visual_memory_ready: ["spatial_memory_ready", "shot_spec_ready", "blocked"],
  spatial_memory_ready: ["shot_spec_ready", "blocked"],
  shot_spec_ready: ["shot_layout_ready", "blocked"],
  shot_layout_ready: ["prompt_plan_ready", "blocked"],
  prompt_plan_ready: ["keyframe_queue_ready", "blocked"],
  keyframe_queue_ready: ["keyframe_generating", "blocked"],
  keyframe_generating: ["keyframe_qa_pending", "blocked"],
  keyframe_qa_pending: ["keyframe_pair_ready", "blocked"],
  keyframe_pair_ready: ["video_queue_ready", "preview_ready", "blocked"],
  video_queue_ready: ["video_generating", "blocked"],
  video_generating: ["video_qa_pending", "blocked"],
  video_qa_pending: ["preview_ready", "blocked"],
  preview_ready: ["export_ready", "blocked"],
  export_ready: ["blocked"],
  blocked: ["draft_intake", "story_structured", "visual_memory_ready", "shot_spec_ready", "prompt_plan_ready"],
};

export function canTransition(from: ProjectWorkflowState, to: ProjectWorkflowState): boolean {
  return Boolean(transitions[from]?.includes(to));
}

export function evaluateWorkflowGuard(input: WorkflowGuardInput): WorkflowGuardResult {
  const blockers: string[] = [];
  const taskRuns = input.taskRuns || [];

  if (input.preflight?.status === "blocked") {
    blockers.push(...input.preflight.blockers.map((item) => item.messageForUser));
  }

  if (input.hasP0Issues) {
    blockers.push("存在 P0 问题，不能进入下一阶段。");
  }

  if (taskRuns.some((task) => task.localStatus === "submitted" || task.localStatus === "generating" || task.localStatus === "connection_retrying")) {
    blockers.push("仍有任务在生成或连接恢复中。");
  }

  if (input.state === "prompt_plan_ready" && !input.requiredAssetsReady) {
    blockers.push("正式生成前必须先锁定所需视觉资产。");
  }

  if (input.state === "keyframe_pair_ready" && !input.keyframePairsReady) {
    blockers.push("首尾帧对还没有通过验收。");
  }

  const canProceed = blockers.length === 0;
  const nextState = canProceed ? transitions[input.state]?.find((state) => state !== "blocked") : "blocked";
  return {
    canProceed,
    nextState,
    blockers,
    allowedActions: canProceed ? ["proceed", "edit", "audit"] : ["inspect_blockers", "edit", "rerun_preflight"],
  };
}

export function buildWorkflowStages(audit: Pick<ProjectAudit, "metrics" | "issues">): WorkflowStage[] {
  const hasBlockers = audit.issues.some((issue) => issue.severity === "blocker");
  const videosReady = audit.metrics.existingVideos >= audit.metrics.expectedVideos;
  const keyframesReady = audit.metrics.existingKeyframes >= audit.metrics.expectedKeyframes;
  const assetsReady = audit.metrics.existingAssets >= audit.metrics.expectedAssets;

  return [
    {
      id: "production_bible",
      label: "Production Bible",
      status: "done",
      detail: "Story facts exist and can be imported as the project authority.",
    },
    {
      id: "visual_memory",
      label: "Visual Memory",
      status: assetsReady ? "done" : "active",
      detail: `${audit.metrics.existingAssets}/${audit.metrics.expectedAssets} assets found.`,
    },
    {
      id: "keyframe_pairs",
      label: "Keyframe Pairs",
      status: keyframesReady ? "done" : assetsReady ? "active" : "pending",
      detail: `${audit.metrics.existingKeyframes}/${audit.metrics.expectedKeyframes} start/end frames found.`,
    },
    {
      id: "provider_policy",
      label: "Provider Policy",
      status: hasBlockers ? "blocked" : "done",
      detail: hasBlockers ? "Policy blockers exist. Formal generation must stop." : "No blocker detected.",
    },
    {
      id: "videos",
      label: "Video Provider",
      status: videosReady ? "done" : "pending",
      detail: videosReady ? `${audit.metrics.existingVideos}/${audit.metrics.expectedVideos} video clips found.` : "Seedance/Jimeng adapter parked; no live submit.",
    },
    {
      id: "preview",
      label: "Preview Timeline",
      status: videosReady && !hasBlockers ? "done" : "pending",
      detail: videosReady ? "Ready to build rough cut." : "Waiting for video clips and video QA.",
    },
  ];
}

export function computeProjectState(stages: WorkflowStage[]): string {
  const blocked = stages.find((stage) => stage.status === "blocked");
  if (blocked) return `blocked_at_${blocked.id}`;

  const active = stages.find((stage) => stage.status === "active");
  if (active) return `active_${active.id}`;

  const pending = stages.find((stage) => stage.status === "pending");
  if (pending) return `pending_${pending.id}`;

  return "export_ready";
}
