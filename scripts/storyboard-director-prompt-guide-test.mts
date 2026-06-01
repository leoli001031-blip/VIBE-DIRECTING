import {
  buildStoryboardDirectorPrompt,
  STORYBOARD_DIRECTOR_COLUMNS,
  STORYBOARD_DIRECTOR_PROMPT_VERSION,
  STORYBOARD_DIRECTOR_RULES,
} from "../src/core/storyboardDirectorPrompt.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prompt = buildStoryboardDirectorPrompt({
  originalScriptPlaceholder: "测试剧本",
  includeExcelInstruction: true,
});

for (const column of ["镜号", "景别", "镜头", "主动作", "触发原因", "微反应", "行动/反应", "画面描述", "字幕", "音效"]) {
  assert(STORYBOARD_DIRECTOR_COLUMNS.includes(column as typeof STORYBOARD_DIRECTOR_COLUMNS[number]), `missing column ${column}`);
  assert(prompt.includes(column), `prompt missing column ${column}`);
}

for (const required of [
  "一个镜号只包含一个镜头",
  "主动作必须能用一句话说清",
  "动作触发原因",
  "一方行动、一方反应",
  "warning/blocker",
  "机位、视角、运镜方式",
  "人物位置关系",
  "微表情",
  "不直接作为 Image2 生图提示词",
  "场景、天气、时间、空间布局和氛围事实",
  "大主画面锁定空间",
  "小动作格交代呼吸",
  "多人镜头必须先写清轴线",
  "不能打乱已建立的屏幕方向",
  "最多只允许一张场景参考图",
  "已锁定角色/道具参考",
  "防止身份和关键物件漂移",
  "Seedance 全能参考阶段",
]) {
  assert(prompt.includes(required), `prompt missing rule: ${required}`);
}

assert(prompt.includes(STORYBOARD_DIRECTOR_PROMPT_VERSION), "prompt version missing");
assert(STORYBOARD_DIRECTOR_RULES.length >= 10, "storyboard prompt should keep enough production constraints");
assert(!/api[-_\s]?key|credential|provider submit|live submit/i.test(prompt), "storyboard prompt must not mention provider/runtime secrets");

console.log(`storyboard-director-prompt-guide-test: version=${STORYBOARD_DIRECTOR_PROMPT_VERSION}, columns=${STORYBOARD_DIRECTOR_COLUMNS.length}, rules=${STORYBOARD_DIRECTOR_RULES.length}.`);
