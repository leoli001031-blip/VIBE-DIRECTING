export type DirectorAgentPermissionIntentMode = "plan_only" | "reference_allowed" | "video_allowed";

const noImageGenerationPhrases = [
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
  "先不要提交视频测试",
  "先不提交视频",
  "不要提交视频",
  "不提交视频",
  "先别提交视频",
  "别提交视频",
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
  "先生成参考",
  "只生成参考",
  "只做参考",
  "只补参考",
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
  "开始提交视频",
  "提交视频",
];

const allControlPhrases = [
  ...noImageGenerationPhrases,
  ...noVideoSubmitPhrases,
  ...referenceAllowedPhrases,
  ...videoAllowedPhrases,
];

const referenceBoundaryControlPhrases = [
  ...noVideoSubmitPhrases,
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
];

export function normalizedDirectorAgentPermissionIntent(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]/g, "");
}

function hasPhrase(normalizedIntent: string, phrases: string[]) {
  return phrases.some((phrase) => normalizedIntent.includes(normalizedDirectorAgentPermissionIntent(phrase)));
}

export function detectDirectorAgentPermissionIntent(userIntent: string): DirectorAgentPermissionIntentMode | undefined {
  const normalizedIntent = normalizedDirectorAgentPermissionIntent(userIntent);
  if (!normalizedIntent) return undefined;
  if (hasPhrase(normalizedIntent, noImageGenerationPhrases)) return "plan_only";
  if (hasPhrase(normalizedIntent, noVideoSubmitPhrases) || hasPhrase(normalizedIntent, referenceAllowedPhrases)) return "reference_allowed";
  if (hasPhrase(normalizedIntent, videoAllowedPhrases)) return "video_allowed";
  return undefined;
}

export function directorAgentPermissionIntentDisallowsVideoSubmit(userIntent: string) {
  const normalizedIntent = normalizedDirectorAgentPermissionIntent(userIntent);
  if (!normalizedIntent) return false;
  return hasPhrase(normalizedIntent, noVideoSubmitPhrases) || hasPhrase(normalizedIntent, noImageGenerationPhrases.filter((phrase) => /视频|即梦/.test(phrase)));
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
  const remainder = stripped.replace(/^(先|现在|暂时|这次|本轮)+/g, "").replace(/(一下|吧|啊|哦|测试|看看)$/g, "");
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
