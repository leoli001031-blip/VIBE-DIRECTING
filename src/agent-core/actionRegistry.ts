import type {
  VibeAgentActionDescriptor,
  VibeAgentToolName,
} from "./types";

export const vibeAgentActionRegistry: Record<VibeAgentToolName, VibeAgentActionDescriptor> = {
  inspect_project: {
    id: "inspect_project",
    label: "读取项目",
    description: "读取 Project.vibe、镜头、素材和队列摘要，只观察不修改。",
    mutatesProject: false,
    callsProvider: false,
    requiresConfirmation: false,
    minimumPermission: "plan_only",
  },
  scan_assets: {
    id: "scan_assets",
    label: "检查素材缺口",
    description: "根据当前镜头和素材状态判断缺角色、场景、道具还是复核。",
    mutatesProject: false,
    callsProvider: false,
    requiresConfirmation: false,
    minimumPermission: "plan_only",
  },
  plan_next_action: {
    id: "plan_next_action",
    label: "判断下一步",
    description: "结合用户意图、项目状态和权限边界，选择下一步待确认动作。",
    mutatesProject: false,
    callsProvider: false,
    requiresConfirmation: false,
    minimumPermission: "plan_only",
  },
  write_agent_message: {
    id: "write_agent_message",
    label: "写入回复",
    description: "把观察、判断、权限边界和下一步整理成创作者能看懂的 Agent 回复。",
    mutatesProject: false,
    callsProvider: false,
    requiresConfirmation: false,
    minimumPermission: "plan_only",
  },
  write_project: {
    id: "write_project",
    label: "写项目",
    description: "把已确认的故事、镜头、策略或复核结果写回 Project.vibe。",
    mutatesProject: true,
    callsProvider: false,
    requiresConfirmation: true,
    minimumPermission: "project_write_allowed",
  },
  research_style: {
    id: "research_style",
    label: "查风格资料",
    description: "按用户指定风格检索或整理资料，生成可进入项目的导演参考。",
    mutatesProject: true,
    callsProvider: true,
    requiresConfirmation: true,
    minimumPermission: "project_write_allowed",
  },
  generate_references: {
    id: "generate_references",
    label: "生成参考",
    description: "调用现有参考图/故事板生成链路，为缺失镜头或素材补齐可复核参考。",
    mutatesProject: true,
    callsProvider: true,
    requiresConfirmation: true,
    minimumPermission: "reference_allowed",
  },
  submit_video: {
    id: "submit_video",
    label: "提交视频",
    description: "将已复核片段按串行队列提交到 Seedance，并记录 submit id。",
    mutatesProject: true,
    callsProvider: true,
    requiresConfirmation: true,
    minimumPermission: "video_allowed",
  },
  query_video: {
    id: "query_video",
    label: "查询视频",
    description: "读取视频任务回流状态并同步预览，不重复提交任务。",
    mutatesProject: true,
    callsProvider: false,
    requiresConfirmation: false,
    minimumPermission: "project_write_allowed",
  },
  export_project: {
    id: "export_project",
    label: "导出项目",
    description: "生成交付包、报告和最终文件路径。",
    mutatesProject: true,
    callsProvider: false,
    requiresConfirmation: true,
    minimumPermission: "export_allowed",
  },
  request_user_confirmation: {
    id: "request_user_confirmation",
    label: "请求确认",
    description: "对会写项目、生成参考、提交视频或导出的动作生成明确确认请求。",
    mutatesProject: false,
    callsProvider: false,
    requiresConfirmation: false,
    minimumPermission: "plan_only",
  },
  run_confirmed_action: {
    id: "run_confirmed_action",
    label: "执行已确认动作",
    description: "只执行已经通过权限门和用户确认的白名单动作。",
    mutatesProject: true,
    callsProvider: true,
    requiresConfirmation: true,
    minimumPermission: "project_write_allowed",
  },
};

export function listVibeAgentActionNames(): VibeAgentToolName[] {
  return Object.keys(vibeAgentActionRegistry).sort() as VibeAgentToolName[];
}

export function getVibeAgentActionDescriptor(name: VibeAgentToolName): VibeAgentActionDescriptor {
  return vibeAgentActionRegistry[name];
}
