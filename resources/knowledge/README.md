# Vibe Director Knowledge Library

更新时间：2026-04-28

这是 Vibe Director 的后台资料库第一版。它不是给用户看的术语墙，而是给 `director-intent-router`、`cinematic-style-director`、`spatial-layout-director`、`prompt-compiler`、`qa-gate` 和 subagent 使用的可注入知识包。

用户继续用自然语言表达：

```text
更压抑一点。
镜头慢慢靠近她。
像凌晨便利店，冷一点，但不要赛博朋克。
这里不要那么广告片，像真实纪录片。
```

系统内部把它翻译成相关资料包：

```text
style/core-style-packs.md
composition/core-composition.md
lighting/core-lighting.md
camera/core-camera-movement.md
qa/core-qa.md
prompt/core-prompt-templates.md
```

## 目录

- `style/core-style-packs.md`：常见影视风格和情绪风格。
- `script/core-script-writing.md`：脚本核心原则，把想法整理成可拍故事。
- `script/short-film-structures.md`：短片、自适应结构、悬疑/关系/记忆/AI 结构。
- `script/scene-and-dialogue.md`：场景目标、阻碍、转折、对白和潜台词。
- `script/script-to-storyflow.md`：从想法/脚本到 Story Flow、Scene、ShotSpec。
- `script/script-qa.md`：脚本、场景、对白、短片范围和 shot readiness QA。
- `composition/core-composition.md`：构图语言和空间表达。
- `lighting/core-lighting.md`：光线类型、情绪、风险。
- `color/core-color.md`：色彩系统和调色倾向。
- `camera/core-camera-movement.md`：运镜词库。
- `lens-focus/core-lens-focus.md`：镜头、透视、景深、焦点。
- `story-function/core-shot-functions.md`：镜头功能词库。
- `performance/core-performance.md`：表演姿态和动作词库。
- `qa/core-qa.md`：风格、运镜、连续性、参考污染 QA。
- `prompt/core-prompt-templates.md`：Image 2 / Seedance 2.0 prompt 编译模板。
- `provider/model-capability-matrix.md`：模型能力矩阵，记录每个生成后端能做什么、不能做什么。
- `provider/image2-provider-pack.md`：Image 2 关键帧和图像编辑后端规则。
- `provider/seedance2-provider-pack.md`：Seedance 2.0 图生视频后端规则。
- `provider/provider-onboarding-research-checklist.md`：未来新增模型前必须完成的搜索和验证清单。
- `provider/provider-api-extension-slots.md`：未来生图、视频、音频和本地工作流的统一 API 口预留。
- `provider/codex-cli-execution-boundary.md`：Codex CLI 作为执行层和 Image 2 调用路径时的边界。
- `agent/harness-engineering-for-vibe-director.md`：把长流程 Agent 任务工程化为可观测、可恢复、可复验的后台执行脚手架。
- `index/router-map.md`：用户自然语言到资料包的路由表。

## 使用原则

1. 不把整库注入 Codex。按用户意图、镜头风险和任务类型选择小包。
2. 用户不需要看到英文术语。UI 只显示自然语言摘要。
3. Prompt Compiler 使用资料包生成结构化 prompt，不允许 subagent 每次自由发挥风格。
4. QA 必须使用同一套资料包反向检查结果。
5. 资料包可以被联网研究更新，但更新结果必须落成结构化条目。
6. 新增模型或生成平台前，必须先更新 provider 能力矩阵和 onboarding 清单。
