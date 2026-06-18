import type {
  VibeAgentPermissionMode,
  VibeAgentTimelineEntry,
} from "./types";

export type VibeAgentIntakeTimelinePhase =
  | "status_inspection"
  | "draft_collected"
  | "planning_started"
  | "planning_ready"
  | "planning_blocked"
  | "draft_confirmed";

export function buildVibeAgentIntakeTimelineEntries(input: {
  createdAt: string;
  phase: VibeAgentIntakeTimelinePhase;
  userMessage: string;
  materialCount?: number;
  imageCount?: number;
  audioCount?: number;
  shotCount?: number;
  permissionMode?: VibeAgentPermissionMode;
  assistantBody?: string;
  assistantNext?: string;
}): VibeAgentTimelineEntry[] {
  const suffix = compactId(input.createdAt);
  const userMessage = clean(input.userMessage) || "继续";
  const materialCount = input.materialCount ?? 0;
  const shotCount = input.shotCount ?? 0;
  const entries: VibeAgentTimelineEntry[] = [
    {
      id: `new_video_user_${suffix}`,
      type: "user_message",
      createdAt: input.createdAt,
      title: "你",
      body: userMessage,
      status: "done",
      details: { intakePhase: input.phase },
    },
    {
      id: `new_video_tool_read_${suffix}`,
      type: "tool_call",
      createdAt: input.createdAt,
      title: "读取输入",
      body: "Agent 正在读取脚本、风格、拖入素材和当前项目入口状态。",
      toolName: "inspect_project",
      status: "done",
      details: { intakePhase: input.phase },
    },
    {
      id: `new_video_tool_assets_${suffix}`,
      type: "tool_result",
      createdAt: input.createdAt,
      title: "识别素材",
      body: materialCount > 0
        ? "素材已进入本轮上下文，确认前不会写入正式项目。"
        : "当前没有额外素材，先根据文字拆故事和镜头。",
      toolName: "scan_assets",
      status: "done",
      facts: [
        { label: "图片", value: `${input.imageCount ?? 0} 个` },
        { label: "声音", value: input.audioCount ? `${input.audioCount} 段` : "无" },
      ],
      details: { intakePhase: input.phase },
    },
    {
      id: `new_video_tool_plan_${suffix}`,
      type: "tool_call",
      createdAt: input.createdAt,
      title: planTitle(input.phase),
      body: planBody(input.phase),
      toolName: "plan_next_action",
      status: input.phase === "planning_blocked" ? "blocked" : input.phase === "planning_started" ? "waiting" : "done",
      facts: [
        { label: "镜头", value: shotCount ? `${shotCount} 个` : "待拆分" },
        { label: "权限", value: permissionLabel(input.permissionMode) },
      ],
      details: { intakePhase: input.phase },
    },
    {
      id: `new_video_assistant_${suffix}`,
      type: "assistant_message",
      createdAt: input.createdAt,
      title: "AI 导演",
      body: input.assistantBody || assistantBody(input.phase, shotCount),
      toolName: "write_agent_message",
      status: input.phase === "planning_blocked" ? "blocked" : "done",
      facts: [
        { label: "下一步", value: assistantNextFact(input.phase) },
        { label: "生成", value: "不会自动生成" },
      ],
      details: {
        intakePhase: input.phase,
        next: input.assistantNext || assistantNext(input.phase),
      },
    },
  ];

  if (input.phase === "planning_ready") {
    entries.push({
      id: `new_video_confirmation_${suffix}`,
      type: "confirmation_request",
      createdAt: input.createdAt,
      title: "等待确认",
      body: "确认后只会把草案写入故事流；生成参考图、提交视频和导出都还要再确认。",
      toolName: "request_user_confirmation",
      confirmationRequired: true,
      status: "waiting",
      facts: [
        { label: "动作", value: "write_project" },
        { label: "镜头", value: shotCount ? `${shotCount} 个` : "待确认" },
      ],
      details: {
        intakePhase: input.phase,
        next: "可以点确认，也可以直接说要改哪里。",
      },
    });
  }

  return entries;
}

export function isVibeAgentIntakeTimelineEntry(entry: VibeAgentTimelineEntry) {
  return entry.id.startsWith("new_video_") || typeof entry.details?.intakePhase === "string";
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function compactId(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
}

function permissionLabel(mode?: VibeAgentPermissionMode) {
  if (mode === "reference_allowed") return "可做参考";
  if (mode === "video_allowed") return "可发视频";
  if (mode === "export_allowed") return "可导出";
  if (mode === "project_write_allowed") return "可写项目";
  return "先整理";
}

function planTitle(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "正在拆镜头";
  if (phase === "planning_ready") return "草案已完成";
  if (phase === "planning_blocked") return "规划遇到问题";
  if (phase === "draft_confirmed") return "草案已写入";
  return "判断下一步";
}

function planBody(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "Agent 正在把输入拆成故事节奏、镜头顺序和参考策略。";
  if (phase === "planning_ready") return "Agent 已完成草案规划，现在停在复核和确认这一步。";
  if (phase === "planning_blocked") return "Agent 暂时没有完成规划，已保留当前输入和可见状态。";
  if (phase === "draft_confirmed") return "Agent 已把确认后的草案交给项目写入链路。";
  return "Agent 会先判断是否已有故事流，或是否需要先放入脚本。";
}

function assistantBody(phase: VibeAgentIntakeTimelinePhase, shotCount: number) {
  if (phase === "planning_started") return "我正在整理故事、镜头和节奏。这里只做规划，不会生成参考图，也不会发送视频。";
  if (phase === "planning_ready") return `我拆好了一个草案：${shotCount || "若干"} 个镜头。确认前不会写入项目，也不会生成参考或视频。`;
  if (phase === "planning_blocked") return "这次没有整理完整。你可以换个说法重新发送，或者先按当前内容继续改。";
  if (phase === "draft_confirmed") return "我已经把草案放进故事流。接下来可以继续改镜头，或让我开始补参考。";
  return "我先看了当前项目状态。下一步先放入脚本或一句故事想法。";
}

function assistantNext(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "草案出来后，你可以确认，也可以直接说哪里要改。";
  if (phase === "planning_ready") return "觉得可以就确认；想改就直接说。";
  if (phase === "planning_blocked") return "修改输入后重新发送。";
  if (phase === "draft_confirmed") return "继续说你想改哪里，或说“开始补参考”。";
  return "放入脚本或一句故事想法。";
}

function assistantNextFact(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "等待草案";
  if (phase === "planning_ready") return "等待确认";
  if (phase === "planning_blocked") return "重试或修改";
  if (phase === "draft_confirmed") return "继续推进";
  return "放入故事";
}
