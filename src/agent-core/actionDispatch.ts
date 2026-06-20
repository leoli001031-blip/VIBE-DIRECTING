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

export function directorActionCompilesVideoRequest(action: DirectorAgentActionEnvelope) {
  return action.kind === "prepare_video_submit"
    && (
      action.status === "blocked"
      || !action.executionContract.videoSubmitAllowed
      || !action.executionContract.providerSubmitAllowed
      || !action.toolPlan.providerSubmitAllowed
    );
}

function executorToolForDirectorAction(action: DirectorAgentActionEnvelope): VibeAgentToolName {
  if (action.kind === "inspect_project_status") {
    return isAssetClassificationIntent(action.sourceContext.userIntent) ? "classify_assets" : "inspect_project";
  }
	if (action.toolPlan.toolName === "project_vibe_patch") return "write_project";
	if (action.toolPlan.toolName === "web_search") return "research_style";
	if (action.toolPlan.toolName === "image2_reference_generation") return "generate_references";
	if (action.kind === "query_video_result") return "query_video";
	if (action.toolPlan.toolName === "seedance_video_submit") {
    return directorActionCompilesVideoRequest(action) ? "compile_video_request" : "submit_video";
  }
	if (action.toolPlan.toolName === "project_export") return "export_showcase";
  return "write_project";
}

function isAssetClassificationIntent(value: string) {
  return /(?:素材|文件|参考素材|项目材料|拖入文件).{0,16}(?:整理|分类|归类|绑定|匹配|建议|识别)|(?:整理|分类|归类|绑定|匹配|识别).{0,16}(?:素材|文件|参考素材|项目材料|拖入文件)|绑定建议/u.test(value);
}
