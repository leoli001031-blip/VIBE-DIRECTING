import {
  DIRECTOR_RHYTHM_PROFILE_LABELS,
  planDirectorRhythm,
  type CreativeBrief,
  type DirectorActionDensity,
  type DirectorRhythmPlan,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";

export const DIRECTOR_PRODUCTION_SKILL_VERSION = "director_production_skill_v1";

export type DirectorProductionStrategyId =
  | "storyboard_narrative"
  | "storyboard_rapid_cut"
  | "omni_reference";

export type DirectorProductionAssetStatus = "missing" | "candidate" | "locked" | "needs_review";

export interface DirectorProductionSkillAssetState {
  scene?: DirectorProductionAssetStatus;
  characters?: DirectorProductionAssetStatus;
  props?: DirectorProductionAssetStatus;
  audio?: DirectorProductionAssetStatus;
}

export type DirectorProductionReferenceImageType =
  | "storyboard_reference"
  | "scene_baseline"
  | "character_identity"
  | "prop_reference"
  | "dialogue_audio"
  | "text_direction";

export interface DirectorProductionStrategyContract {
  strategyId: DirectorProductionStrategyId;
  inputConditions: string[];
  referenceImageTypes: DirectorProductionReferenceImageType[];
  promptStructure: string[];
  visibleCutSemantics: string;
  riskWarnings: string[];
}

export interface DirectorProductionAssetAuthorityContract {
  identityAuthority: string;
  sceneWeatherAuthority: string;
  objectAuthority: string;
  styleAuthority: string;
  audioAuthority: string;
  independentPropRule: string;
  componentOwnershipRule: string;
  sceneConstraintRule: string;
  examples: {
    parentObjectConstraints: string[];
    sceneConstraints: string[];
    independentProps: string[];
  };
  riskWarnings: string[];
}

export interface DirectorProductionSkillInput {
  shotId: string;
  title?: string;
  durationSeconds?: number;
  scriptText?: string;
  shotText?: string;
  userPreference?: string;
  creativeBrief?: CreativeBrief;
  rhythmPlan?: DirectorRhythmPlan;
  rhythmOverride?: boolean;
  executionMode?: string;
  referenceStrategy?: DirectorProductionStrategyId;
  actionBeats?: string[];
  camera?: string;
  visualDescription?: string;
  assetState?: DirectorProductionSkillAssetState;
}

export interface DirectorProductionSkillPlan {
  schemaVersion: typeof DIRECTOR_PRODUCTION_SKILL_VERSION;
  shotId: string;
  strategyId: DirectorProductionStrategyId;
  strategyLabel: string;
  rhythmProfile: DirectorRhythmProfile;
  rhythmLabel: string;
  actionDensity: DirectorActionDensity;
  splitPolicy: DirectorSplitPolicy;
  panelCountIntent: number;
  durationGuidance: string;
  assetReadiness: {
    needsBaselineFirst: boolean;
    missingOrUnready: string[];
    requiredBeforeProviderSubmit: string[];
  };
  image2Directive: {
    mode: "none" | "narrative_storyboard" | "rapid_cut_storyboard";
    promptRole: string;
    allowProductionAnnotations: boolean;
    guidance: string[];
  };
  seedanceDirective: {
    compilerProfile: DirectorProductionStrategyId;
    referenceRoles: string[];
    guidance: string[];
    noBgmEnforced: boolean;
  };
  reasons: string[];
  warnings: string[];
  userFacingSummary: string;
  strategyContract: DirectorProductionStrategyContract;
  assetAuthorityContract: DirectorProductionAssetAuthorityContract;
}

const STRATEGY_LABELS: Record<DirectorProductionStrategyId, string> = {
  storyboard_narrative: "故事板叙事",
  storyboard_rapid_cut: "故事板快切",
  omni_reference: "全能参考",
};

export const DIRECTOR_PRODUCTION_STRATEGY_CONTRACTS: Record<DirectorProductionStrategyId, DirectorProductionStrategyContract> = {
  storyboard_narrative: {
    strategyId: "storyboard_narrative",
    inputConditions: [
      "情绪承接、人物关系、构图阅读顺序或反应时机是成败关键",
      "普通镜头需要 2-6 格叙事节点，但不需要密集动作预演",
      "AI 分镜已选择 storyboard_narrative 时必须保留该选择",
    ],
    referenceImageTypes: ["storyboard_reference", "scene_baseline", "character_identity", "prop_reference", "dialogue_audio", "text_direction"],
    promptStructure: [
      "叙事故事板说明构图/站位/情绪",
      "锁定角色/场景/关键道具参考分别提供身份、环境和物件外观",
      "Seedance 文本提示写清主动作、触发原因和微反应",
    ],
    visibleCutSemantics: "visible cuts are planned story-reading beats, not provider-side micro cuts; each panel carries one narrative/composition beat.",
    riskWarnings: [
      "不要把手部、眼神、车灯、书页等细节升级成独立道具资产",
      "不要让故事板临时角色覆盖锁定角色身份或服装轮廓",
      "不要把叙事故事板画成带箭头、编号或 UI 标注的生产表",
    ],
  },
  storyboard_rapid_cut: {
    strategyId: "storyboard_rapid_cut",
    inputConditions: [
      "赛车、追逐、训练、动作链、蒙太奇、倒计时或复杂节奏段",
      "一个视频段内部有多个动作/镜头节拍，但不应拆成大量 UI shot",
      "executionMode 为 planned_cut_sequence 或 rhythmProfile 为 action_fast_cut",
    ],
    referenceImageTypes: ["storyboard_reference", "scene_baseline", "character_identity", "prop_reference", "dialogue_audio", "text_direction"],
    promptStructure: [
      "粗糙 rapid-cut storyboard 先锁动作顺序、运镜、运动方向和 timing",
      "角色/场景/关键道具参考继续按各自权威输入",
      "Seedance 文本提示解释内部 cut 节奏，同时剥离分镜标注可见风险",
    ],
    visibleCutSemantics: "visible cuts are internal choreography/timing beats inside one generated video segment; never collapse a rapid-cut plan into one static panel.",
    riskWarnings: [
      "车灯、轮胎、仪表、手、天空、雾等只作为父主体或场景约束",
      "故事板箭头、彩线、编号、边框和时间标记必须在 Seedance 成片里消失",
      "快切镜头不等于把每个 0.5 秒剪辑点拆成独立 provider 任务",
    ],
  },
  omni_reference: {
    strategyId: "omni_reference",
    inputConditions: [
      "单一连续动作、短特写、短反应或简单关系镜头",
      "锁定场景、角色、关键道具和文本方向已经足够",
      "短 action_insert/reaction_closeup 没有额外故事板收益",
    ],
    referenceImageTypes: ["scene_baseline", "character_identity", "prop_reference", "dialogue_audio", "text_direction"],
    promptStructure: [
      "不生成故事板或单张起始帧",
      "直接使用场景/角色/关键道具/音频参考",
      "Seedance 文本提示保持短主动作、触发原因和表演节奏",
    ],
    visibleCutSemantics: "visible cuts are normally none; at most one reaction/insert cut if the user or planner explicitly asks for it.",
    riskWarnings: [
      "不要把 omni_reference 退化成隐藏的一格故事板或起始帧生成",
      "不要上传与本镜无关的部件、天气状态或背景细节作为独立图",
      "如果动作链变密，应升级为 storyboard_rapid_cut 而不是塞进单提示词",
    ],
  },
};

export const DIRECTOR_ASSET_AUTHORITY_GRAPH_CONTRACT: DirectorProductionAssetAuthorityContract = {
  identityAuthority: "角色身份参考只管脸、发型、服装轮廓、身体设计和持续表演身份；手、眼神、袖口、步伐等是角色/镜头约束。",
  sceneWeatherAuthority: "场景基准图只管地点、天气、时间、空间锚点和环境连续性；天空、雾、湿路、霓虹反光、山脊等归场景约束。",
  objectAuthority: "道具参考只给故事关键物或完整父物体建立外观权威；父物体部件必须挂回父物体，不单独生成。",
  styleAuthority: "风格资产只管画风、质感、时代感和镜头语法，不覆盖角色、场景或道具身份。",
  audioAuthority: "对白/声音只管表演节奏、口型和现场声，不引入默认 BGM 或视觉设计权威。",
  independentPropRule: "只有会被角色持有、交换、追踪、造成剧情转折或反复出现的故事关键物，才生成独立 prop reference。",
  componentOwnershipRule: "主体部件归属主体：车灯、轮胎、仪表、车窗、书页、封面、手、眼神等写进父主体/角色的文字约束。",
  sceneConstraintRule: "场景约束归场景：天空、雾、湿路、反光、雨线、路肩、山脊、霓虹和光线状态写进 scene/weather authority。",
  examples: {
    parentObjectConstraints: ["车灯", "轮胎", "仪表", "车窗反光", "书页", "手", "眼神"],
    sceneConstraints: ["天空", "雾", "湿路", "霓虹反光", "雨线", "山脊"],
    independentProps: ["旧书", "发光车票", "蓝色磁带盒", "手机", "整辆赛车"],
  },
  riskWarnings: [
    "不要因为视觉细节具体，就把它误判为资产主体",
    "同一场景的天气/光线/地面状态不能跨不相关场景污染",
    "关键物可以独立，部件和环境状态默认不能独立",
  ],
};

const STRATEGY_IDS = new Set<DirectorProductionStrategyId>([
  "storyboard_narrative",
  "storyboard_rapid_cut",
  "omni_reference",
]);

const MOTION_SYSTEM_PATTERNS = [
  /丝带|飘带|绸带|ribbon/i,
  /烟雾|雾|水流|浪|火焰|粒子|能量|闪电|魔法|smoke|fog|water|wave|fire|particle|energy|magic/i,
  /变身|变形|展开|组装|分解|爆开|蝶翼|翅膀|光环|transformation|morph|unfold|assemble|burst|wing|halo/i,
  /机械展开|机关|mandala|曼陀罗|calligraphy|书法/i,
];

const STRONG_MOTION_SYSTEM_PATTERN =
  /丝带|飘带|绸带|ribbon|变身|变形|展开|组装|分解|爆开|蝶翼|翅膀|光环|transformation|morph|unfold|assemble|burst|wing|halo|机械展开|mandala|曼陀罗|calligraphy|书法/i;

const FAST_SEQUENCE_PATTERNS = [
  /快切|连招|追逐|战斗|训练|舞蹈|滑步|跳跃|旋转|甩动|冲刺|爆发|fast cut|action sequence|action choreography|chase|fight|kata|dance|leap|spin|burst/i,
  /镜头一|镜头二|分镜一|分镜二|panel|shot by shot|sequence/i,
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanLines(lines: Array<string | undefined | false>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function strategyContractPromptLines(strategyId: DirectorProductionStrategyId): string[] {
  const contract = DIRECTOR_PRODUCTION_STRATEGY_CONTRACTS[strategyId];
  return [
    `Strategy contract: ${contract.strategyId}. Inputs: ${contract.inputConditions.join(" / ")}.`,
    `Reference image types: ${contract.referenceImageTypes.join(", ")}.`,
    `Prompt structure: ${contract.promptStructure.join(" -> ")}.`,
    `Visible cut semantics: ${contract.visibleCutSemantics}`,
    ...contract.riskWarnings.map((warning) => `Strategy risk guard: ${warning}`),
  ];
}

function assetAuthorityPromptLines(): string[] {
  const contract = DIRECTOR_ASSET_AUTHORITY_GRAPH_CONTRACT;
  return [
    "Asset authority graph:",
    `- identity_authority: ${contract.identityAuthority}`,
    `- scene_weather_authority: ${contract.sceneWeatherAuthority}`,
    `- object_authority: ${contract.objectAuthority}`,
    `- style_authority: ${contract.styleAuthority}`,
    `- audio_authority: ${contract.audioAuthority}`,
    `- independent_prop_rule: ${contract.independentPropRule}`,
    `- component_ownership_rule: ${contract.componentOwnershipRule}`,
    `- scene_constraint_rule: ${contract.sceneConstraintRule}`,
    `- parent_object_constraints: ${contract.examples.parentObjectConstraints.join("、")}`,
    `- scene_constraints: ${contract.examples.sceneConstraints.join("、")}`,
    `- independent_props: ${contract.examples.independentProps.join("、")}`,
    ...contract.riskWarnings.map((warning) => `Asset risk guard: ${warning}`),
  ];
}

export function productionSkillStrategyContractPromptBlock(strategyId: DirectorProductionStrategyId): string {
  return cleanLines(strategyContractPromptLines(strategyId));
}

export function productionSkillAssetAuthorityPromptBlock(): string {
  return cleanLines(assetAuthorityPromptLines());
}

function normalizedInputText(input: DirectorProductionSkillInput): string {
  const brief = input.creativeBrief;
  return [
    input.title,
    input.scriptText,
    input.shotText,
    input.userPreference,
    input.executionMode,
    input.camera,
    input.visualDescription,
    ...(input.actionBeats || []),
    brief?.style,
    brief?.notes,
    ...(brief?.filmLikes || []),
    ...(brief?.rhythmLikes || []),
    ...(brief?.expressionLikes || []),
  ].map(clean).filter(Boolean).join("\n");
}

function normalizedRoutingText(input: DirectorProductionSkillInput): string {
  return [
    input.title,
    input.shotText,
    input.executionMode,
    input.camera,
    input.visualDescription,
    ...(input.actionBeats || []),
  ].map(clean).filter(Boolean).join("\n");
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
}

function actionBeatCount(input: DirectorProductionSkillInput): number {
  const explicit = (input.actionBeats || []).map(clean).filter(Boolean).length;
  const text = normalizedRoutingText(input);
  // Plain "切到/切特写" is often camera grammar inside one planned cut, not proof of a
  // dense action sequence. Count explicit fast-cut/switch language, but avoid routing
  // every eye-to-window camera note into storyboard_rapid_cut.
  const markers = (text.match(/然后|随后|接着|同时|再|转身|冲|跑|跳|递|接|拿|推|拉|快切|再切|切换|then|while|turn|run|jump|grab|push|quick\s*cut|cut\s+to/gi) || []).length;
  return Math.max(explicit, markers);
}

function panelCountIntent(input: DirectorProductionSkillInput, strategyId: DirectorProductionStrategyId): number {
  const duration = Number(input.durationSeconds || 0);
  const beats = actionBeatCount(input);
  if (strategyId === "storyboard_rapid_cut") {
    if (duration > 0 && duration <= 6) return Math.min(Math.max(beats, 2), 3);
    if (duration > 0 && duration <= 10) return Math.min(Math.max(beats, 3), 4);
    if (duration >= 12 || beats >= 8) return 12;
    if (duration >= 8 || beats >= 5) return 8;
    return 6;
  }
  if (strategyId === "storyboard_narrative") {
    if (duration > 0 && duration <= 6) return 2;
    if (duration > 0 && duration <= 10) return 3;
    if (duration >= 12 || beats >= 5) return 6;
    return 3;
  }
  return 0;
}

function durationGuidance(input: DirectorProductionSkillInput, strategyId: DirectorProductionStrategyId): string {
  const duration = Number(input.durationSeconds || 0);
  if (!duration) return "时长未知：先用 AI 估算动作密度，默认不把复杂动作直接塞进一个视频任务。";
  if (strategyId === "storyboard_rapid_cut") {
    if (duration <= 5) return `${duration}s：只允许 1 个主要动作，故事板最多作为动作方向/镜头切点预演，不能塞完整动作链。`;
    if (duration <= 8) return `${duration}s：允许 2-3 个清楚动作节点，面板必须一格一动作。`;
    return `${duration}s：可以做段落级故事板，但每个 panel 仍然只承担一个动作/构图节点。`;
  }
  if (strategyId === "storyboard_narrative") {
    if (duration <= 6) return `${duration}s：用叙事故事板说明关系、构图和一个主动作，不做密集切点。`;
    return `${duration}s：用叙事故事板说明镜头顺序、关系变化和情绪承接，避免把细节拆成多余 cut。`;
  }
  if (duration <= 5) return `${duration}s：用场景、人物、道具参考加简洁导演提示，让视频模型完成小动作。`;
  return `${duration}s：不额外生成分镜图；用锁定资产和结构化提示词让 Seedance 发挥。`;
}

function assetReadiness(input: DirectorProductionSkillInput): DirectorProductionSkillPlan["assetReadiness"] {
  const state = input.assetState || {};
  const routingText = normalizedRoutingText(input);
  const required: Array<[string, DirectorProductionAssetStatus | undefined]> = [
    ["角色参考", state.characters],
    ["场景参考", state.scene],
  ];
  if (routingText.match(/道具|物件|手持|递|接|拿|prop|object|cassette|fan|weapon/i)) {
    required.push(["道具参考", state.props]);
  }
  const missingOrUnready = required
    .filter(([, status]) => status !== "locked")
    .map(([label, status]) => `${label}${status ? `:${status}` : ":missing"}`);
  return {
    needsBaselineFirst: missingOrUnready.length > 0,
    missingOrUnready,
    requiredBeforeProviderSubmit: required.map(([label]) => label),
  };
}

function selectStrategy(input: DirectorProductionSkillInput, rhythmPlan: DirectorRhythmPlan): { strategyId: DirectorProductionStrategyId; reasons: string[] } {
  const text = normalizedRoutingText(input);
  const lower = text.toLowerCase();
  const beats = actionBeatCount(input);
  const duration = Number(input.durationSeconds || 0);
  const shortStateMode = duration > 0
    && duration <= 5
    && ["action_insert", "reaction_closeup", "relationship_wide"].includes(String(input.executionMode || ""));
  const motionScore = countMatches(lower, MOTION_SYSTEM_PATTERNS);
  const sequenceScore = countMatches(lower, FAST_SEQUENCE_PATTERNS);
  const reasons: string[] = [];

  if (rhythmPlan.rhythmProfile !== "quiet_dialogue" && (motionScore >= 2 || STRONG_MOTION_SYSTEM_PATTERN.test(lower))) {
    reasons.push("检测到丝带、烟雾、水流、变形、展开等连续形态系统，需要用故事板快切/预演锁住运动逻辑。");
    return { strategyId: "storyboard_rapid_cut", reasons };
  }

  if (shortStateMode && !input.rhythmOverride) {
    reasons.push("短镜头的插入/反应/关系镜头交给全能参考更干净，不再额外生成单张起始帧。");
    return { strategyId: "omni_reference", reasons };
  }

  if (
    rhythmPlan.rhythmProfile !== "quiet_dialogue" && (
    rhythmPlan.rhythmProfile === "action_fast_cut"
    || rhythmPlan.splitPolicy === "split_for_action"
    || rhythmPlan.splitPolicy === "montage_sequence"
    || input.executionMode === "planned_cut_sequence"
    || sequenceScore > 0
    || (!shortStateMode && beats >= 5)
  )) {
    reasons.push("动作/切点密度较高，需要把镜头顺序、运动方向和节奏先做成可读的预演。");
    return { strategyId: "storyboard_rapid_cut", reasons };
  }

  if (
    input.executionMode === "action_insert"
    || input.executionMode === "relationship_wide"
    || rhythmPlan.rhythmProfile === "anime_emotion"
    || rhythmPlan.rhythmProfile === "suspense_pressure"
    || /构图|站位|递|接|手部|眼神|关系|close[- ]?up|insert|blocking/i.test(text)
  ) {
    reasons.push("这段关键在构图、站位、手部/眼神或关系压力，适合用叙事故事板先锁住镜头阅读顺序。");
    return { strategyId: "storyboard_narrative", reasons };
  }

  // comedy_reaction 和 commercial_short 需要叙事故事板锁住人物站位、表情时机和镜头节奏，
  // 避免反应镜头或广告短片的笑点/卖点节奏丢失；因此不由 omni_reference 兜底。
  if (rhythmPlan.rhythmProfile === "comedy_reaction" || rhythmPlan.rhythmProfile === "commercial_short") {
    reasons.push("喜剧反应/商业短片需要通过故事板预锁人物站位、表情时机和节奏，确保镜头阅读顺序清晰。");
    return { strategyId: "storyboard_narrative", reasons };
  }

  reasons.push("这段动作密度低，角色、场景和道具参考加结构化文本导演提示已经足够。");
  return { strategyId: "omni_reference", reasons };
}

function validatedReferenceStrategy(value: unknown): DirectorProductionStrategyId | undefined {
  return STRATEGY_IDS.has(value as DirectorProductionStrategyId)
    ? value as DirectorProductionStrategyId
    : undefined;
}

function image2DirectiveFor(strategyId: DirectorProductionStrategyId, panelCount: number): DirectorProductionSkillPlan["image2Directive"] {
  if (strategyId === "omni_reference") {
    return {
      mode: "none",
      promptRole: "不额外生成故事板或单张起始帧；直接使用锁定资产和结构化导演提示。",
      allowProductionAnnotations: false,
      guidance: [
        "不要为了每个镜头强行生成分镜图或起始帧。",
        "把预算留给角色、场景、道具基准图和 Seedance 可执行提示词。",
      ],
    };
  }
  if (strategyId === "storyboard_narrative") {
    return {
      mode: "narrative_storyboard",
      promptRole: `生成 ${panelCount} 格以内的叙事故事板，用于锁构图、人物关系、情绪承接和镜头顺序。`,
      allowProductionAnnotations: false,
      guidance: [
        "故事板必须是给视频模型使用的干净视觉参考，不放箭头、文字、面板号或生产标注。",
        "每格只承担一个叙事/构图节点；细节不要被拆成多余切镜。",
      ],
    };
  }
  return {
    mode: "rapid_cut_storyboard",
    promptRole: `生成 ${panelCount} 格粗糙电影分镜预演，规划快切顺序、运镜、动作切点和阅读方向。`,
    allowProductionAnnotations: true,
    guidance: [
      "每格只放一个清楚动作节点，优先 staging、timing、camera readability，不追求插画完成度。",
      "允许手绘箭头和少量彩色生产标注，但它们只是给视频模型理解运动，不是成片元素。",
      "角色可以简化成半抽象 mannequin；最终身份由角色参考图负责。",
    ],
  };
}

function seedanceDirectiveFor(strategyId: DirectorProductionStrategyId): DirectorProductionSkillPlan["seedanceDirective"] {
  if (strategyId === "omni_reference") {
    return {
      compilerProfile: strategyId,
      referenceRoles: ["scene_baseline", "character_identity", "prop_reference", "dialogue_audio"],
      guidance: [
        "用结构化导演提示控制动作和镜头，不上传故事板或起始帧。",
        "场景、角色、道具、音频继续按各自职责输入；默认 no BGM。",
      ],
      noBgmEnforced: true,
    };
  }
  return {
    compilerProfile: strategyId,
    referenceRoles: ["storyboard_reference", "scene_baseline", "character_identity", "prop_reference", "dialogue_audio"],
    guidance: [
      "Use the storyboard as choreography, timing, camera and motion-planning reference.",
      "If the storyboard has production colors, interpret internally only: RED=camera, BLUE=body movement, GREEN=prop/cloth/environment/motion path, ORANGE=impact/burst/danger, PURPLE=timing/pause/acceleration.",
      "Follow panel order internally. Do not render storyboard artifacts in the final video.",
      "No arrows, colored lines, motion guides, notes, panel numbers, borders, timing marks, subtitles, logos or UI elements.",
      "Character references define final identity; scene references define weather/location; prop references define object appearance.",
      "默认 no BGM，不自动加音乐。",
    ],
    noBgmEnforced: true,
  };
}

function warningsFor(input: DirectorProductionSkillInput, strategyId: DirectorProductionStrategyId, readiness: DirectorProductionSkillPlan["assetReadiness"]): string[] {
  const warnings: string[] = [];
  const duration = Number(input.durationSeconds || 0);
  const beats = actionBeatCount(input);
  if (readiness.needsBaselineFirst) {
    warnings.push(`baseline_first_required: ${readiness.missingOrUnready.join(", ")}`);
  }
  if (duration > 0 && duration <= 5 && beats >= 5) {
    warnings.push("short_duration_crowded_action: 5 秒以内不要塞完整动作链。");
  }
  if (strategyId === "storyboard_rapid_cut") {
    warnings.push("storyboard_artifact_must_be_stripped_in_seedance_prompt");
  }
  return warnings;
}

export function buildDirectorProductionSkillPlan(input: DirectorProductionSkillInput): DirectorProductionSkillPlan {
  const rhythmPlan = input.rhythmPlan || planDirectorRhythm({
    scriptText: input.scriptText,
    shotText: cleanLines([
      input.title,
      input.shotText,
      input.camera,
      input.visualDescription,
      ...(input.actionBeats || []),
    ]),
    userPreference: input.userPreference,
    creativeBrief: input.creativeBrief,
    durationSeconds: input.durationSeconds,
  });
  const explicitStrategy = validatedReferenceStrategy(input.referenceStrategy);
  const selection = explicitStrategy
    ? {
      strategyId: explicitStrategy,
      reasons: [`沿用 AI 分镜规划选择的参考模式：${STRATEGY_LABELS[explicitStrategy]}。`],
    }
    : selectStrategy(input, rhythmPlan);
  const panelCount = panelCountIntent(input, selection.strategyId);
  const readiness = assetReadiness(input);
  const image2Directive = image2DirectiveFor(selection.strategyId, panelCount);
  const seedanceDirective = seedanceDirectiveFor(selection.strategyId);
  const warnings = warningsFor(input, selection.strategyId, readiness);
  const duration = durationGuidance(input, selection.strategyId);
  const rhythmLabel = DIRECTOR_RHYTHM_PROFILE_LABELS[rhythmPlan.rhythmProfile];

  return {
    schemaVersion: DIRECTOR_PRODUCTION_SKILL_VERSION,
    shotId: input.shotId,
    strategyId: selection.strategyId,
    strategyLabel: STRATEGY_LABELS[selection.strategyId],
    rhythmProfile: rhythmPlan.rhythmProfile,
    rhythmLabel,
    actionDensity: rhythmPlan.actionDensity,
    splitPolicy: rhythmPlan.splitPolicy,
    panelCountIntent: panelCount,
    durationGuidance: duration,
    assetReadiness: readiness,
    image2Directive,
    seedanceDirective,
    reasons: selection.reasons,
    warnings,
    userFacingSummary: `${STRATEGY_LABELS[selection.strategyId]}：${selection.reasons[0] || "由导演 AI 按动作密度、时长和参考资产判断。"}${readiness.needsBaselineFirst ? " 先补齐/锁定基准资产，再提交真实生成。" : ""}`,
    strategyContract: DIRECTOR_PRODUCTION_STRATEGY_CONTRACTS[selection.strategyId],
    assetAuthorityContract: DIRECTOR_ASSET_AUTHORITY_GRAPH_CONTRACT,
  };
}

export function productionSkillImage2PromptBlock(plan: DirectorProductionSkillPlan): string {
  if (plan.image2Directive.mode === "none") {
    return cleanLines([
      `Internal director skill: ${plan.strategyId} / ${plan.strategyLabel}.`,
      "Do not generate an extra storyboard reference for this shot unless the user asks for a visual planning board.",
      ...strategyContractPromptLines(plan.strategyId),
      ...assetAuthorityPromptLines(),
    ]);
  }
  const annotationBlock = plan.image2Directive.allowProductionAnnotations
    ? [
        "Production annotation mode is allowed for this storyboard reference:",
        "- RED = camera / lens / framing / camera movement",
        "- BLUE = body movement / path / turn / leap / pose flow",
        "- GREEN = key prop / cloth / environment / motion-system path",
        "- ORANGE = burst / impact / danger / pressure / visual accent",
        "- PURPLE = timing / pause / acceleration / burst motion",
        "Annotations must be rough hand-drawn production notes, not clean UI graphics.",
      ]
    : [
        "Clean reference mode: no arrows, no labels, no text, no timing marks, no panel numbers, no production notes.",
      ];
  return cleanLines([
    `Internal director skill: ${plan.strategyId} / ${plan.strategyLabel}.`,
    `Image2 role: ${plan.image2Directive.promptRole}`,
    `Duration logic: ${plan.durationGuidance}`,
    ...strategyContractPromptLines(plan.strategyId),
    ...assetAuthorityPromptLines(),
    ...plan.reasons.map((reason) => `Routing reason: ${reason}`),
    ...plan.image2Directive.guidance.map((item) => `Guidance: ${item}`),
    plan.panelCountIntent > 0 ? `Panel count intent: ${plan.panelCountIntent}. Each panel carries one clear action/camera beat.` : undefined,
    ...annotationBlock,
  ]);
}

export function productionSkillSeedancePromptBlock(plan: DirectorProductionSkillPlan): string {
  return cleanLines([
    `Internal director skill: ${plan.strategyId} / ${plan.strategyLabel}.`,
    `Seedance compiler profile: ${plan.seedanceDirective.compilerProfile}.`,
    `Duration logic: ${plan.durationGuidance}`,
    `Reference roles: ${plan.seedanceDirective.referenceRoles.join(", ")}.`,
    ...strategyContractPromptLines(plan.strategyId),
    ...assetAuthorityPromptLines(),
    ...plan.seedanceDirective.guidance.map((item) => `Guidance: ${item}`),
    plan.assetReadiness.needsBaselineFirst
      ? `Do not submit provider job until these baselines are locked or explicitly accepted: ${plan.assetReadiness.missingOrUnready.join(", ")}.`
      : "Baseline assets are ready for provider compilation.",
  ]);
}
