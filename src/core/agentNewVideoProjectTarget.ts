export type AgentNewVideoProjectTargetMode = "new_project" | "current_project";

export function agentNewVideoProjectTargetMode(input: {
  localProjectReady: boolean;
  currentProjectShotCount: number;
}): AgentNewVideoProjectTargetMode {
  return input.localProjectReady && input.currentProjectShotCount === 0
    ? "current_project"
    : "new_project";
}
