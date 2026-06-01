export type DirectorRhythmProfile =
  | "quiet_dialogue"
  | "anime_emotion"
  | "action_fast_cut"
  | "comedy_reaction"
  | "suspense_pressure"
  | "commercial_short"
  | "emotion_montage"
  | "lyrical_observation";

export type DirectorActionDensity = "low" | "medium" | "high";

export type DirectorSplitPolicy =
  | "hold_single_shot"
  | "split_for_reaction"
  | "split_for_action"
  | "montage_sequence";

export interface CreativeBrief {
  filmLikes?: string[];
  rhythmLikes?: string[];
  expressionLikes?: string[];
  style?: string;
  notes?: string;
}

export interface DirectorRhythmPlanningInput {
  scriptText?: string;
  shotText?: string;
  userPreference?: string;
  creativeBrief?: CreativeBrief;
  durationSeconds?: number;
  musicAnalysis?: {
    rhythmTags?: string[];
    sections?: Array<{ rhythmHint?: string; label?: string }>;
    durationSeconds?: number;
  };
}

export interface DirectorRhythmPlan {
  rhythmProfile: DirectorRhythmProfile;
  rhythmReason: string;
  actionDensity: DirectorActionDensity;
  splitPolicy: DirectorSplitPolicy;
  userFacingLabel: string;
}

export const DIRECTOR_RHYTHM_PROFILE_LABELS: Record<DirectorRhythmProfile, string> = {
  quiet_dialogue: "安静对白",
  anime_emotion: "日漫情绪特写",
  action_fast_cut: "快切动作",
  comedy_reaction: "喜剧反应",
  suspense_pressure: "悬疑压迫",
  commercial_short: "广告短促",
  emotion_montage: "情绪蒙太奇",
  lyrical_observation: "抒情观察",
};

function normalizedText(input: DirectorRhythmPlanningInput): string {
  const brief = input.creativeBrief;
  return [
    input.scriptText,
    input.shotText,
    input.userPreference,
    brief?.style,
    brief?.notes,
    ...(brief?.filmLikes || []),
    ...(brief?.rhythmLikes || []),
    ...(brief?.expressionLikes || []),
    ...(input.musicAnalysis?.rhythmTags || []),
    ...(input.musicAnalysis?.sections || []).map((section) => `${section.label || ""} ${section.rhythmHint || ""}`),
  ].filter(Boolean).join(" ").toLowerCase();
}

function score(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (text.match(pattern)?.length || 0), 0);
}

function actionDensityFor(text: string): DirectorActionDensity {
  const markers = score(text, [
    /然后|随后|接着|同时|再|冲|跑|追|打|撞|爆|跳|切|快|转身|推开|拿起|递|接|进入|离开|then|while|run|chase|fight|hit|jump|cut|fast|turn|grab|enter|exit/g,
  ]);
  if (markers >= 6) return "high";
  if (markers >= 3) return "medium";
  return "low";
}

function splitPolicyFor(profile: DirectorRhythmProfile, density: DirectorActionDensity): DirectorSplitPolicy {
  if (profile === "emotion_montage") return "montage_sequence";
  if (profile === "action_fast_cut" || density === "high") return "split_for_action";
  if (profile === "comedy_reaction" || profile === "anime_emotion" || profile === "suspense_pressure") return "split_for_reaction";
  return "hold_single_shot";
}

function reasonFor(profile: DirectorRhythmProfile, density: DirectorActionDensity, input: DirectorRhythmPlanningInput): string {
  const short = Number(input.durationSeconds || 0) > 0 && Number(input.durationSeconds || 0) <= 6;
  const suffix = short ? "，时长较短，先保留一个清楚的主动作" : "";
  if (profile === "quiet_dialogue") return `这段靠台词、停顿和视线推进，适合慢铺，让演员反应留在镜头里${suffix}。`;
  if (profile === "anime_emotion") return `情绪主要藏在眼神、手部和短暂停顿里，适合用日漫式近景/特写承接${suffix}。`;
  if (profile === "action_fast_cut") return `动作密度${density === "high" ? "偏高" : "较明确"}，适合拆成短促动作点，避免一个镜头塞太多事。`;
  if (profile === "comedy_reaction") return `笑点来自动作后的反应差，先给动作，再留一拍给表情或尴尬停顿。`;
  if (profile === "suspense_pressure") return `信息需要慢慢压近，适合用停顿、遮挡和推进制造压力，而不是急着解释。`;
  if (profile === "commercial_short") return `诉求更像短广告，适合把产品/卖点放在第一眼，动作保持干净直接。`;
  if (profile === "emotion_montage") return `情绪跨度比单一动作更重要，适合用几个短画面连成一组感受。`;
  return `这段更像观察人物和环境的抒情段落，适合慢一点看，让空间和姿态说话${suffix}。`;
}

export function planDirectorRhythm(input: DirectorRhythmPlanningInput): DirectorRhythmPlan {
  const text = normalizedText(input);
  const density = actionDensityFor(text);
  const profileScores: Record<DirectorRhythmProfile, number> = {
    quiet_dialogue: score(text, [/对白|台词|说|问|沉默|停顿|对话|dialogue|conversation|quiet/g]),
    anime_emotion: score(text, [/日漫|动漫|眼神|特写|脸|手指|怔|心动|情绪|anime|close[- ]?up|emotion/g]),
    action_fast_cut: score(text, [/快切|动作|追|跑|打|冲|爆|高速|action|fast cut|chase|fight/g]) + (density === "high" ? 3 : 0),
    comedy_reaction: score(text, [/喜剧|尴尬|笑|荒诞|反应|吐槽|comedy|funny|awkward|reaction/g]),
    suspense_pressure: score(text, [/悬疑|压迫|紧张|危险|黑暗|阴影|逼近|suspense|thriller|pressure|tense/g]),
    commercial_short: score(text, [/广告|产品|卖点|展示|品牌|商业|commercial|product|brand/g]),
    emotion_montage: score(text, [/蒙太奇|回忆|闪回|片段|时间流逝|sectioned_music|montage|memory|flashback/g]),
    lyrical_observation: score(text, [/抒情|观察|风|雨|光|街|海|城市|孤独|lyrical|observe|poetic/g]),
  };
  if (input.musicAnalysis?.rhythmTags?.includes("high_energy") || input.musicAnalysis?.rhythmTags?.includes("rapid_cut_candidate")) {
    profileScores.action_fast_cut += 2;
  }
  if (input.musicAnalysis?.rhythmTags?.includes("quiet_open_space")) {
    profileScores.lyrical_observation += 1;
    profileScores.quiet_dialogue += 1;
  }

  let rhythmProfile: DirectorRhythmProfile = "lyrical_observation";
  for (const candidate of Object.keys(profileScores) as DirectorRhythmProfile[]) {
    if (profileScores[candidate] > profileScores[rhythmProfile]) rhythmProfile = candidate;
  }
  if (profileScores[rhythmProfile] === 0) {
    rhythmProfile = density === "high" ? "action_fast_cut" : "lyrical_observation";
  }

  return {
    rhythmProfile,
    rhythmReason: input.musicAnalysis
      ? `${reasonFor(rhythmProfile, density, input)} 音乐参考只用于节奏规划和最终混音，不进入视频模型提示词。`
      : reasonFor(rhythmProfile, density, input),
    actionDensity: density,
    splitPolicy: splitPolicyFor(rhythmProfile, density),
    userFacingLabel: DIRECTOR_RHYTHM_PROFILE_LABELS[rhythmProfile],
  };
}
