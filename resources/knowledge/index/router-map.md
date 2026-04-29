# Knowledge Router Map

用途：把用户自然语言映射到后台资料包和字段。运行时只注入命中的包。

## 风格意图

| 用户说法 | 注入资料包 | 主要字段 |
|---|---|---|
| 更压抑 / 窒息 / 孤独 | `style/core-style-packs.md`, `composition/core-composition.md`, `lighting/core-lighting.md`, `color/core-color.md`, `qa/core-qa.md` | oppressive-lonely, negative-space, low-key, low-saturation |
| 冷一点 / 克制 / 现实 | `style/core-style-packs.md`, `lighting/core-lighting.md`, `color/core-color.md` | restrained-realism, practical-light, low-saturation |
| 暖一点 / 有一点希望 | `style/core-style-packs.md`, `lighting/core-lighting.md`, `color/core-color.md`, `performance/core-performance.md` | warm-hopeful, warm-cool-contrast, relaxation |
| 黑色电影 / 悬疑 / 犯罪片 | `style/core-style-packs.md`, `lighting/core-lighting.md`, `composition/core-composition.md` | noir-suspense, side-light, frame-within-frame |
| 像纪录片 / 真实现场 | `style/core-style-packs.md`, `camera/core-camera-movement.md`, `lighting/core-lighting.md` | documentary-handheld, subtle-handheld, motivated-lighting |
| 梦 / 回忆 / 不真实但不奇幻 | `style/core-style-packs.md`, `color/core-color.md`, `lens-focus/core-lens-focus.md` | dream-memory, pastel-faded, shallow-dof |
| 更高级 / 品牌短片 | `style/core-style-packs.md`, `lighting/core-lighting.md`, `composition/core-composition.md` | premium-commercial, high-key, center-hero |
| 复古 / VHS / 监控感 | `style/core-style-packs.md`, `color/core-color.md`, `camera/core-camera-movement.md` | analog-vhs, handheld, zoom |
| 科幻但克制 / 巨物感 | `style/core-style-packs.md`, `composition/core-composition.md`, `lens-focus/core-lens-focus.md` | monolithic-sci-fi, scale-contrast, wide-angle |

## 脚本意图

| 用户说法 | 注入资料包 | 主要动作 |
|---|---|---|
| 我有一个想法 / 帮我整理故事 | `script/core-script-writing.md`, `script/short-film-structures.md`, `script/script-to-storyflow.md`, `script/script-qa.md` | 生成 script_brief 和 Story Flow |
| 故事有点乱 / 帮我理顺 | `script/core-script-writing.md`, `script/script-to-storyflow.md`, `script/script-qa.md` | 找主角、目标、阻碍、转折、结尾状态 |
| 帮我写短片脚本 | `script/core-script-writing.md`, `script/short-film-structures.md`, `script/scene-and-dialogue.md` | 选短片结构，生成 scene 和 beats |
| 这段对白怎么改 | `script/scene-and-dialogue.md`, `script/script-qa.md` | 检查目标、潜台词、解释性对白 |
| 这个故事能不能分镜 | `script/script-to-storyflow.md`, `script/script-qa.md`, `story-function/core-shot-functions.md` | 做 shot readiness QA |
| 想做悬疑 / 发现异常 | `script/short-film-structures.md`, `script/core-script-writing.md` | 使用悬疑发现结构 |
| 想做两个人的关系片段 | `script/short-film-structures.md`, `script/scene-and-dialogue.md` | 使用关系冲突结构 |
| 想做记忆 / 梦 / 回忆 | `script/short-film-structures.md`, `style/core-style-packs.md` | 使用记忆结构并绑定 dream-memory style |
| 想做 AI / 屏幕 / 科幻 | `script/short-film-structures.md`, `style/core-style-packs.md` | 使用 AI/科幻短片结构 |

## 运镜意图

| 用户说法 | 注入资料包 | 推荐运镜 |
|---|---|---|
| 镜头别动 | `camera/core-camera-movement.md`, `qa/core-qa.md` | locked-camera |
| 慢慢靠近 | `camera/core-camera-movement.md`, `lens-focus/core-lens-focus.md`, `qa/core-qa.md` | slow-push-in / dolly-in |
| 慢慢远离 | `camera/core-camera-movement.md`, `composition/core-composition.md` | pull-back / dolly-out |
| 跟着她走 | `camera/core-camera-movement.md`, `story-function/core-shot-functions.md` | tracking-follow / steadicam |
| 从手看到脸 | `camera/core-camera-movement.md`, `lens-focus/core-lens-focus.md` | tilt-up / rack-focus |
| 展示整个场景 | `camera/core-camera-movement.md`, `composition/core-composition.md` | wide-locked / crane-up / dolly-out |
| 从旁边滑过去露出东西 | `camera/core-camera-movement.md`, `composition/core-composition.md` | parallax-reveal / truck |
| 手持一点 | `camera/core-camera-movement.md`, `qa/core-qa.md` | subtle-handheld |

## 生成任务

| 任务 | 注入资料包 |
|---|---|
| Image 2 关键帧 | `prompt/core-prompt-templates.md`, 命中的 style/composition/lighting/color/lens 包 |
| Image 2 编辑 | `prompt/core-prompt-templates.md`, `qa/core-qa.md` |
| Seedance 2.0 图生视频 | `camera/core-camera-movement.md`, `prompt/core-prompt-templates.md`, `qa/core-qa.md` |
| 判断 Image 2 / Seedance / 其他模型能不能做 | `provider/model-capability-matrix.md`, `provider/image2-provider-pack.md`, `provider/seedance2-provider-pack.md` |
| 当前 Codex CLI 怎么执行生成任务 | `provider/codex-cli-execution-boundary.md`, `provider/model-capability-matrix.md` |
| 新增 OpenAI 视频模型 / 即梦 / Runway / ComfyUI 等模型 | `provider/provider-api-extension-slots.md`, `provider/provider-onboarding-research-checklist.md`, `provider/model-capability-matrix.md` |
| 故事理顺补全 | `script/core-script-writing.md`, `script/script-to-storyflow.md`, `script/script-qa.md` |
| 脚本转分镜 | `script/script-to-storyflow.md`, `story-function/core-shot-functions.md`, `composition/core-composition.md` |
| 风格 QA | `qa/core-qa.md`, 命中的 style/lighting/color 包 |
| 连续性 QA | `qa/core-qa.md`, `story-function/core-shot-functions.md`, `composition/core-composition.md` |
