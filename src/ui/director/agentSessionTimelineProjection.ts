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
  currentPhaseId: AgentSessionTimelinePhaseId;
  currentTone: "conversation" | "confirmation" | "review" | "blocked";
  phases: AgentSessionTimelinePhase[];
}

type SessionTurnInput = Pick<
  AgentDirectorTurnProjection,
  | "phase"
  | "mode"
  | "task"
  | "clarification"
  | "proposal"
  | "reviewRegenerationProposal"
  | "reviewIdentityReady"
  | "blockers"
>;

const phaseOrder: AgentSessionTimelinePhaseId[] = [
  "clarify",
  "proposal",
  "confirmation",
  "running",
  "review",
  "promotion",
  "delivery",
];

const phaseLabels: Record<AgentSessionTimelinePhaseId, string> = {
  clarify: "Clarify",
  proposal: "Proposal",
  confirmation: "Confirmation",
  running: "Running",
  review: "Review",
  promotion: "项目事实",
  delivery: "Delivery",
};

const completeDetails: Record<AgentSessionTimelinePhaseId, string> = {
  clarify: "导演意图已收束",
  proposal: "执行方案已形成",
  confirmation: "单次任务边界已确认",
  running: "结果已经返回",
  review: "人工复核已完成",
  promotion: "项目事实已确认",
  delivery: "交付已完成",
};

const lockedDetails: Record<AgentSessionTimelinePhaseId, string> = {
  clarify: "等待导演意图",
  proposal: "等待形成提案",
  confirmation: "等待独立确认",
  running: "尚未执行",
  review: "等待结果返回",
  promotion: "需要另行确认",
  delivery: "尚未授权",
};

function currentPhaseFor(turn: SessionTurnInput): AgentSessionTimelinePhaseId | undefined {
  if (turn.phase === "clarification" && turn.clarification) return "clarify";
  if (turn.phase === "proposal" && (turn.proposal || turn.reviewRegenerationProposal)) return "proposal";
  const reviewStep = turn.task.step === "submit_video" || turn.task.step === "compare_versions";
  if (turn.phase === "review" && reviewStep) return "review";
  return undefined;
}

function currentDetailFor(turn: SessionTurnInput, currentPhaseId: AgentSessionTimelinePhaseId) {
  if (currentPhaseId === "review") return turn.reviewIdentityReady && turn.blockers.length === 0 && turn.mode !== "blocked"
    ? "等待你的判断"
    : "复核身份待核对";
  if (turn.blockers.length > 0 || turn.mode === "blocked") return "当前身份待核对";
  if (currentPhaseId === "clarify") return "等待你的方向";
  if (currentPhaseId === "proposal") return "等待确认提案";
  return lockedDetails[currentPhaseId];
}

export function buildAgentSessionTimelineProjection(
  turn: SessionTurnInput,
): AgentSessionTimelineProjection | undefined {
  const currentPhaseId = currentPhaseFor(turn);
  if (!currentPhaseId) return undefined;
  const currentIndex = phaseOrder.indexOf(currentPhaseId);
  const currentTone = turn.mode === "blocked" || turn.blockers.length > 0
    ? "blocked"
    : currentPhaseId === "clarify"
      ? "conversation"
      : currentPhaseId === "proposal"
        ? "confirmation"
        : "review";
  const title = currentPhaseId === "clarify"
    ? turn.clarification?.targetLabel || turn.task.label
    : currentPhaseId === "proposal"
      ? turn.reviewRegenerationProposal?.targetLabel || turn.proposal?.targetLabel || turn.task.label
      : turn.task.label;

  return {
    title,
    currentPhaseId,
    currentTone,
    phases: phaseOrder.map((id, index) => ({
      id,
      label: phaseLabels[id],
      detail: index < currentIndex
        ? completeDetails[id]
        : index === currentIndex
          ? currentDetailFor(turn, currentPhaseId)
          : lockedDetails[id],
      state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "locked",
    })),
  };
}

export function buildAgentReviewSessionTimelineProjection(
  turn: SessionTurnInput,
): AgentSessionTimelineProjection | undefined {
  const projection = buildAgentSessionTimelineProjection(turn);
  return projection?.currentPhaseId === "review" ? projection : undefined;
}
