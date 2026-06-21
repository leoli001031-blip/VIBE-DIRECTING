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
  understandingBody?: string;
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
      id: `new_video_understanding_${suffix}`,
      type: "assistant_message",
      createdAt: input.createdAt,
      title: "我理解为",
      body: input.understandingBody || intakeUnderstandingBody(input.phase),
      lifecycle: intakeUnderstandingLifecycle(input.phase),
      status: input.phase === "planning_blocked" ? "blocked" : "done",
      facts: [
        { label: "动作", value: intakeUnderstandingAction(input.phase) },
        { label: "边界", value: "确认前不会生成参考图、提交视频或导出" },
      ],
      details: {
        intakePhase: input.phase,
        next: input.phase === "status_inspection" ? "只读取状态，不把这句话当脚本" : "继续检查项目和素材",
      },
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
        : input.phase === "status_inspection"
          ? "这次只做状态检查，不会把文字当成脚本或素材。"
        : "当前没有额外素材，先根据文字拆故事和镜头。",
      toolName: "classify_assets",
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
      toolName: intakePlanToolName(input.phase),
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
      body: "确认后只会把草案保存到项目；生成参考图、提交视频和导出都还要再确认。",
      toolName: "request_user_confirmation",
      confirmationRequired: true,
      status: "waiting",
      facts: [
        { label: "确认", value: "保存到项目" },
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

function intakePlanToolName(phase: VibeAgentIntakeTimelinePhase) {
  return phase === "status_inspection" ? "plan_next_action" : "plan_story";
}

function planTitle(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "正在拆镜头";
  if (phase === "planning_ready") return "草案已完成";
  if (phase === "planning_blocked") return "先给你本地草案";
  if (phase === "draft_confirmed") return "草案已写入";
  return "判断下一步";
}

function planBody(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "Agent 正在把输入拆成故事节奏、镜头顺序和参考策略。";
  if (phase === "planning_ready") return "Agent 已完成草案规划，现在停在复核和确认这一步。";
  if (phase === "planning_blocked") return "Agent 已先按本地规则整理出可用草案，后面仍可重拆或继续修改。";
  if (phase === "draft_confirmed") return "Agent 已把确认后的草案交给项目写入链路。";
  return "Agent 会先判断是否已有故事流，或是否需要先放入脚本。";
}

function assistantBody(phase: VibeAgentIntakeTimelinePhase, shotCount: number) {
  if (phase === "planning_started") return "我正在整理故事、镜头和节奏。这里只做规划，不会生成参考图，也不会发送视频。";
  if (phase === "planning_ready") return `我拆好了一个草案：${shotCount || "若干"} 个镜头。确认前不会写入项目，也不会生成参考或视频。`;
  if (phase === "planning_blocked") return "我先整理出一版本地草案。你可以直接改，也可以稍后让我重拆镜头。";
  if (phase === "draft_confirmed") return "我已经把草案放进故事流。接下来可以继续改镜头，或让我开始补参考。";
  return "我先看了当前项目状态。下一步先放入脚本或一句故事想法。";
}

function assistantNext(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "草案出来后，你可以确认，也可以直接说哪里要改。";
  if (phase === "planning_ready") return "觉得可以就确认；想改就直接说。";
  if (phase === "planning_blocked") return "直接说哪里要改，或让我重拆镜头。";
  if (phase === "draft_confirmed") return "继续说你想改哪里，或说“开始补参考”。";
  return "放入脚本或一句故事想法。";
}

function assistantNextFact(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_started") return "等待草案";
  if (phase === "planning_ready") return "等待确认";
  if (phase === "planning_blocked") return "继续修改";
  if (phase === "draft_confirmed") return "继续推进";
  return "放入故事";
}

function intakeUnderstandingAction(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "status_inspection") return "检查项目状态";
  if (phase === "draft_collected") return "整理输入";
  if (phase === "planning_started") return "拆故事和镜头";
  if (phase === "planning_ready") return "复核草案";
  if (phase === "planning_blocked") return "说明当前草案";
  if (phase === "draft_confirmed") return "保存到项目";
  return "整理输入";
}

function intakeUnderstandingBody(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "status_inspection") {
    return "你想让我只检查当前项目状态。我会读取项目和入口状态，不会把这句话当成脚本，也不会生成参考或提交视频。";
  }
  if (phase === "planning_started") {
    return "你想让我把输入整理成可复核的故事和镜头草案。这里只做规划，确认前不会生成参考或提交视频。";
  }
  if (phase === "planning_ready") {
    return "你想先看一版草案。我会停在确认前，等你决定写入、修改或继续。";
  }
  if (phase === "planning_blocked") {
    return "这次输入还不足以稳定推进。我会说明哪里卡住，并保留当前内容方便你继续改。";
  }
  if (phase === "draft_confirmed") {
    return "你确认了草案。我会把它保存到项目，但参考生成和视频提交仍然需要单独确认。";
  }
  return "你想先把想法和素材交给 AI 导演整理。我会先归纳，不会直接执行生成。";
}

function intakeUnderstandingLifecycle(phase: VibeAgentIntakeTimelinePhase) {
  if (phase === "planning_blocked") return "needs_user_input" as const;
  if (phase === "planning_started") return "running" as const;
  if (phase === "planning_ready") return "waiting_for_confirmation" as const;
  if (phase === "draft_confirmed") return "succeeded" as const;
  return "proposed" as const;
}
