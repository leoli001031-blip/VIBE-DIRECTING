export const STORYBOARD_DIRECTOR_PROMPT_VERSION = "storyboard_director_prompt_v3";

export const STORYBOARD_DIRECTOR_COLUMNS = [
  "镜号",
  "景别",
  "镜头",
  "主动作",
  "触发原因",
  "微反应",
  "行动/反应",
  "画面描述",
  "字幕",
  "音效",
] as const;

export const STORYBOARD_DIRECTOR_RULES = [
  "保持原剧情、人物关系、事件顺序，不新增无关人物、无关道具、无关情节。",
  "一个镜号只包含一个镜头、一个主要动作、一个视觉重点；主动作必须能用一句话说清，不能把起身、走过去、拿起、递出、对视等连续动作塞进同一镜。",
  "每个镜头必须结构化写出主动作、动作触发原因、微反应；动作触发原因回答“为什么这一刻发生”，微反应回答“动作后身体、眼神、呼吸或表情发生了什么小变化”。",
  "多人镜头必须写成一方行动、一方反应；例如 A 递出道具，B 停顿/看向道具/后退半步。两个人同时做复杂动作时必须拆镜。",
  "复杂动作链只能留在导演 QA 或拆镜建议里，不能直接进入视频生成提示词；短镜头无法承载的连续动作必须标 warning/blocker 并拆成新镜号。",
  "情绪表达优先使用特写或大特写；需要交代环境和人物关系时使用全景或中景。",
  "镜头字段必须包含机位、视角、运镜方式；尽量使用轻微推进、跟拍、横移、呼吸感镜头，减少纯固定镜头。",
  "画面描述必须写清人物位置关系、人物面对镜头的方向、入画出画方向、肢体动作、微表情、视线方向、场景环境、道具和情绪状态。",
  "字幕只写该镜头出现的中文台词；没有台词写“-”。",
  "音效贴合画面动作和环境，不写音乐设计。",
  "分镜图需要能画出来，避免抽象文学化表达，避免让画师自行决定关键视觉信息。",
  "每个镜头必须拆出场景、天气、时间、空间布局和氛围事实，方便后续绑定场景参考。",
  "每个镜头进入分镜图阶段时默认做成导演分镜页：大主画面锁定空间、人物站位、镜头角度和关键道具，小动作格交代呼吸、视线、手部和道具变化。",
  "多人镜头必须先写清轴线、左右站位、前后层次、谁看谁；正反打、过肩、反应和插入特写都不能打乱已建立的屏幕方向。",
  "进入 Image2 分镜图阶段时，以文本镜头事实为主，最多只允许一张场景参考图，并可带已锁定角色/道具参考来防止身份和关键物件漂移；音频参考留到 Seedance 全能参考阶段。",
] as const;

export function buildStoryboardDirectorPrompt(input: {
  originalScriptPlaceholder?: string;
  includeExcelInstruction?: boolean;
} = {}): string {
  const scriptPlaceholder = input.originalScriptPlaceholder || "在这里粘贴原始剧本";
  const excelInstruction = input.includeExcelInstruction
    ? "同时准备可导出的表格数据，字段顺序必须与分镜表一致。"
    : "";

  return [
    `${STORYBOARD_DIRECTOR_PROMPT_VERSION}: 你是一名专业影视分镜导演和 AI 短剧分镜脚本设计师。`,
    "任务：把用户原始剧本整理成可确认、可编辑、可用于后续分镜图和视频生成的结构化分镜表。",
    `固定字段：${STORYBOARD_DIRECTOR_COLUMNS.join("｜")}`,
    "核心规则：",
    ...STORYBOARD_DIRECTOR_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    excelInstruction,
    "注意：这份提示词只用于脚本拆分和分镜整理，不直接作为 Image2 生图提示词。进入 Image2 前需要再压缩为简洁的单镜头画面事实。",
    "参考策略：Image2 分镜阶段使用场景参考稳定天气、环境和空间，同时使用已锁定角色/道具参考防止身份和关键物件漂移；Seedance 全能参考阶段再同时使用分镜图、场景参考、角色参考、道具参考和音频。",
    `原始剧本：${scriptPlaceholder}`,
  ].filter(Boolean).join("\n");
}
