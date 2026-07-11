export type DirectorAgentPermissionIntentMode = "plan_only" | "reference_allowed" | "video_allowed";

const noImageGenerationPhrases = [
  "只告诉我",
  "只跟我说",
  "只说明",
  "只解释",
  "只分析",
  "只给建议",
  "只给我建议",
  "先不要执行",
  "不要执行",
  "别执行",
  "不执行",
  "先别执行",
  "先确认范围",
  "先确认生成范围",
  "先确认参考范围",
  "先确认参考生成范围",
  "别直接生成",
  "不要直接生成",
  "先别直接生成",
  "先不要直接生成",
  "先别生成",
  "先不要生成",
  "别生成",
  "不要生成",
  "暂不生成",
  "先不要写项目",
  "不要写项目",
  "不写项目",
  "别写项目",
  "只看下一步",
  "只告诉下一步",
  "不要生图",
  "先不要生图",
  "不生图",
  "先不生图",
  "先别生图",
  "别生图",
  "不要真实生图",
  "先不要真实生图",
  "不真实生图",
  "不要生成图片",
  "不生成图片",
  "先不要生成图片",
  "不要生成画面",
  "不生成画面",
  "先不要生成画面",
  "先别生成画面",
  "不要生成参考",
  "不生成参考",
  "先不要生成参考",
  "先不生成参考",
  "先别生成参考",
  "不用生成参考",
  "不要生成参考图",
  "不生成参考图",
  "先不要生成参考图",
  "先别生成参考图",
  "不要做参考",
  "先不要做参考",
  "先别做参考",
  "不要做参考图",
  "先不要做参考图",
  "不要补参考",
  "先不要补参考",
  "先别补参考",
  "不要补参考图",
  "先不要补参考图",
  "先别补参考图",
  "不用生图",
  "先不用生图",
  "不跑生图",
  "先不跑生图",
  "别跑生图",
  "不走生图",
  "先不走生图",
  "不生图不提交视频",
  "不生图不生视频",
  "不走生图生视频",
  "不跑生图生视频",
  "生图生视频都先不跑",
  "不要调用生图模型",
  "不调用生图模型",
  "跑到生图前",
  "先跑到生图前",
  "只规划",
  "只看规划",
  "只做规划",
  "只做计划",
  "只要规划",
  "只要计划",
  "只整理故事",
  "只整理故事和镜头",
  "只整理故事镜头",
  "只整理镜头",
  "只整理分镜",
  "只整理节奏",
  "先整理故事",
  "先整理故事和镜头",
  "先整理故事镜头",
  "先整理镜头",
  "先整理分镜",
  "先整理节奏",
  "先只整理故事",
  "先只整理故事和镜头",
  "先只整理故事镜头",
  "先只整理镜头",
  "先只整理分镜",
  "先做计划",
  "先规划",
  "先看规划",
  "先只看规划",
  "只跑文本",
  "只看文本",
  "只拆分镜",
  "只拆脚本",
];

const noVideoSubmitPhrases = [
  "先不要提交视频",
  "先不要自动提交视频",
  "先不要提交视频测试",
  "先不提交视频",
  "不要提交视频",
  "先不要发送视频",
  "先不发送视频",
  "不要发送视频",
  "不发送视频",
  "不要自动提交视频",
  "不提交视频",
  "不自动提交视频",
  "不会自动提交视频",
  "先别提交视频",
  "别提交视频",
  "先别发送视频",
  "别发送视频",
  "先不要提交任何外部生成",
  "不要提交任何外部生成",
  "先不提交任何外部生成",
  "不提交任何外部生成",
  "先别提交任何外部生成",
  "别提交任何外部生成",
  "先别提交",
  "先不测试视频",
  "不测试视频",
  "不测视频",
  "先不测视频",
  "不要生视频",
  "先不要生视频",
  "先不生视频",
  "不要生成视频",
  "先不要生成视频",
  "先别生成视频",
  "不跑视频",
  "先不跑视频",
  "先不用跑视频",
  "视频先不用跑",
  "视频先别跑",
  "别跑视频",
  "先别跑视频",
  "不走生视频",
  "先不走生视频",
  "视频先不用管",
  "先不用管视频",
  "不跑即梦",
  "先不跑即梦",
  "别跑即梦",
  "不提交即梦",
  "不要提交即梦",
  "不提交到即梦",
  "不要提交到即梦",
  "不要调用视频模型",
  "不调用视频模型",
  "跑到视频前",
  "先跑到视频前",
];

const referenceAllowedPhrases = [
  "开始生成参考",
  "开始做参考",
  "开始补参考",
  "先生成参考",
  "只生成参考",
  "只做参考",
  "只补参考",
  "可补参考",
  "可以补参考",
  "允许补参考",
  "可补参考图",
  "可以补参考图",
  "允许补参考图",
  "可做参考",
  "可以做参考",
  "允许做参考",
  "可生成参考",
  "可以生成参考",
  "允许生成参考",
  "先补参考",
  "只生成参考图",
  "只补参考图",
];

const videoAllowedPhrases = [
  "可以提交视频",
  "可提交视频",
  "允许提交视频",
  "可以发送视频",
  "可发送视频",
  "允许发送视频",
  "可以发视频",
  "可发视频",
  "允许发视频",
  "开始提交视频",
  "开始发送视频",
  "提交视频",
  "发送视频",
  "发视频",
];

const referenceBoundaryControlPhrases = [
  ...noVideoSubmitPhrases,
  "可补参考",
  "可以补参考",
  "允许补参考",
  "可补参考图",
  "可以补参考图",
  "允许补参考图",
  "可做参考",
  "可以做参考",
  "允许做参考",
  "可生成参考",
  "可以生成参考",
  "允许生成参考",
];

const videoBoundaryControlPhrases = [
  "可以提交视频",
  "可提交视频",
  "允许提交视频",
  "可以发送视频",
  "可发送视频",
  "允许发送视频",
  "可以发视频",
  "可发视频",
  "允许发视频",
];

const boundaryConnectorPhrases = [
  "但是",
  "不过",
  "并且",
  "而且",
  "以及",
  "同时",
  "然后",
  "但",
  "和",
  "及",
  "且",
  "也",
  "再",
];

const allControlPhrases = Array.from(new Set([
  ...noImageGenerationPhrases,
  ...noVideoSubmitPhrases,
  ...referenceBoundaryControlPhrases,
  ...videoBoundaryControlPhrases,
])).sort((left, right) => right.length - left.length);

export function normalizedDirectorAgentPermissionIntent(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]/g, "");
}

function hasPhrase(normalizedIntent: string, phrases: string[]) {
  return phrases.some((phrase) => normalizedIntent.includes(normalizedDirectorAgentPermissionIntent(phrase)));
}

function stripPhrases(normalizedIntent: string, phrases: string[]) {
  return phrases.reduce(
    (nextIntent, phrase) => nextIntent.replaceAll(normalizedDirectorAgentPermissionIntent(phrase), ""),
    normalizedIntent,
  );
}

function hasNoImageGenerationPhrase(normalizedIntent: string) {
  const normalizedWithoutVideoSubmitControls = stripPhrases(normalizedIntent, noVideoSubmitPhrases);
  return hasPhrase(normalizedWithoutVideoSubmitControls, noImageGenerationPhrases);
}

export function detectDirectorAgentPermissionIntent(userIntent: string): DirectorAgentPermissionIntentMode | undefined {
  const normalizedIntent = normalizedDirectorAgentPermissionIntent(userIntent);
  if (!normalizedIntent) return undefined;
  if (hasNoImageGenerationPhrase(normalizedIntent)) return "plan_only";
  if (hasPhrase(normalizedIntent, noVideoSubmitPhrases) || hasPhrase(normalizedIntent, referenceAllowedPhrases)) return "reference_allowed";
  if (hasPhrase(normalizedIntent, videoAllowedPhrases)) return "video_allowed";
  return undefined;
}

export function directorAgentPermissionIntentDisallowsVideoSubmit(userIntent: string) {
  const normalizedIntent = normalizedDirectorAgentPermissionIntent(userIntent);
  if (!normalizedIntent) return false;
  return hasPhrase(normalizedIntent, noVideoSubmitPhrases) || hasPhrase(normalizedIntent, noImageGenerationPhrases.filter((phrase) => /视频|即梦/.test(phrase)));
}

export function isDirectorAgentExplainOnlyIntent(value: string) {
  const normalizedIntent = normalizedDirectorAgentPermissionIntent(value);
  if (!normalizedIntent) return false;
  return hasPhrase(normalizedIntent, [
    "只告诉我",
    "只跟我说",
    "只说明",
    "只解释",
    "只分析",
    "只给建议",
    "只给我建议",
    "先不要执行",
    "不要执行",
    "别执行",
    "不执行",
    "先别执行",
    "先不要写项目",
    "不要写项目",
    "不写项目",
    "别写项目",
    "只看下一步",
    "只告诉下一步",
    "告诉我接下来",
    "告诉我下一步",
    "接下来要做什么",
    "下一步要做什么",
    "接下来该怎么做",
    "下一步该怎么做",
  ]);
}

export function stripDirectorAgentPermissionControlPhrases(value: string) {
  return allControlPhrases.reduce((nextValue, phrase) => nextValue.replaceAll(phrase, ""), value);
}

export function isDirectorAgentPermissionControlOnlyIntent(value: string) {
  const permissionIntent = detectDirectorAgentPermissionIntent(value);
  if (!permissionIntent) return false;
  const controlPhrases = permissionIntent === "plan_only"
    ? noImageGenerationPhrases
    : permissionIntent === "reference_allowed"
      ? referenceBoundaryControlPhrases
      : videoBoundaryControlPhrases;
  const normalizedValue = normalizedDirectorAgentPermissionIntent(value);
  const stripped = controlPhrases.reduce(
    (nextValue, phrase) => nextValue.replaceAll(normalizedDirectorAgentPermissionIntent(phrase), ""),
    normalizedValue,
  );
  const strippedConnectors = boundaryConnectorPhrases.reduce(
    (nextValue, phrase) => nextValue.replaceAll(normalizedDirectorAgentPermissionIntent(phrase), ""),
    stripped,
  );
  const remainder = strippedConnectors.replace(/^(先|现在|暂时|这次|本轮)+/g, "").replace(/(一下|吧|啊|哦|测试|看看)$/g, "");
  return remainder.length === 0;
}

export function directorAgentPermissionControlPhrasesForTest() {
  return {
    noImageGenerationPhrases,
    noVideoSubmitPhrases,
    referenceAllowedPhrases,
    videoAllowedPhrases,
  };
}
