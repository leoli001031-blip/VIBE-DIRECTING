import type { AgentDirectorTurnProjection } from "./agentDirectorTurnProjection";

export type AgentSessionTimelinePhaseId =
  | "clarify"
  | "proposal"
  | "confirmation"
  | "running"
  | "review"
  | "promotion"
  | "delivery";

export type AgentSessionTimelinePhaseState = "complete" | "current" | "locked";

export interface AgentSessionTimelinePhase {
  id: AgentSessionTimelinePhaseId;
  label: string;
  detail: string;
  state: AgentSessionTimelinePhaseState;
}

export interface AgentSessionTimelineProjection {
  title: string;
  currentPhaseId: "review";
  currentTone: "review" | "blocked";
  phases: AgentSessionTimelinePhase[];
}

type ReviewTurnInput = Pick<
  AgentDirectorTurnProjection,
  "phase" | "mode" | "task" | "reviewIdentityReady" | "blockers"
>;

export function buildAgentReviewSessionTimelineProjection(
  turn: ReviewTurnInput,
): AgentSessionTimelineProjection | undefined {
  const reviewStep = turn.task.step === "submit_video" || turn.task.step === "compare_versions";
  if (turn.phase !== "review" || !reviewStep) return undefined;

  return {
    title: turn.task.label,
    currentPhaseId: "review",
    currentTone: turn.mode === "blocked" || turn.blockers.length > 0 ? "blocked" : "review",
    phases: [
      { id: "clarify", label: "Clarify", detail: "导演意图已收束", state: "complete" },
      { id: "proposal", label: "Proposal", detail: "执行方案已形成", state: "complete" },
      { id: "confirmation", label: "Confirmation", detail: "单次任务边界已确认", state: "complete" },
      { id: "running", label: "Running", detail: "结果已经返回", state: "complete" },
      {
        id: "review",
        label: "Review",
        detail: turn.reviewIdentityReady ? "等待你的判断" : "复核身份待核对",
        state: "current",
      },
      { id: "promotion", label: "项目事实", detail: "需要另行确认", state: "locked" },
      { id: "delivery", label: "Delivery", detail: "尚未授权", state: "locked" },
    ],
  };
}
