import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import type { VibeAgentActionDescriptor, VibeAgentToolName } from "./types";
import { getVibeAgentActionDescriptor } from "./actionRegistry";

export interface VibeAgentDispatchPlan {
  dispatcherTool: "run_confirmed_action";
  executorTool: VibeAgentToolName;
  executor: VibeAgentActionDescriptor;
  label: string;
  description: string;
}

export function buildVibeAgentDispatchPlan(action: DirectorAgentActionEnvelope): VibeAgentDispatchPlan {
  const executorTool = executorToolForDirectorAction(action);
  const executor = getVibeAgentActionDescriptor(executorTool);
  return {
    dispatcherTool: "run_confirmed_action",
    executorTool,
    executor,
    label: executor.label,
    description: executor.description,
  };
}

function executorToolForDirectorAction(action: DirectorAgentActionEnvelope): VibeAgentToolName {
  if (action.kind === "inspect_project_status") return "inspect_project";
	if (action.toolPlan.toolName === "project_vibe_patch") return "write_project";
	if (action.toolPlan.toolName === "web_search") return "research_style";
	if (action.toolPlan.toolName === "image2_reference_generation") return "generate_references";
	if (action.kind === "query_video_result") return "query_video";
	if (action.toolPlan.toolName === "seedance_video_submit") return "submit_video";
	if (action.toolPlan.toolName === "project_export") return "export_project";
  return "write_project";
}
