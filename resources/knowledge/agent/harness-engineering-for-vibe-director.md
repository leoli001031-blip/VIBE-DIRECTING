# Harness Engineering for Vibe Director

更新时间：2026-04-28

用途：把长流程 AI 视频创作从“一个大 prompt + 一堆临时 subagent”变成可观测、可恢复、可复验的工程系统。

## 核心判断

Harness engineering 在 Vibe Director 里不是新增一个用户可见功能，也不是再堆一组 skills。它是后台执行脚手架：

- 把用户自然语言变成 typed task。
- 把每个任务写入 manifest。
- 把上下文打包成稳定 task envelope。
- 把生成结果、临时结果、失败原因和 QA 结论落盘。
- 把长任务拆成可暂停、可重试、可续跑的小任务。
- 把不同 provider 的差异藏在 adapter 后面。

用户看到的是简单的 Story Flow、资产库、Agent 输入框和实时进度；复杂性留在 harness 层。

## 为什么对 Vibe Director 重要

AI 视频生产最容易失败的地方不是单次生成，而是长链路失控：

- 100+ 张关键帧生成中间没有进度，用户以为卡死。
- subagent 每次拿到的上下文不同，导致风格、人物、场景漂移。
- 临时图已经生成，但 worker 没有复制到项目目录，主 Agent 误判失败。
- Codex CLI reconnect 后进入 HTTP fallback，UI 把恢复流程误显示成错误。
- 镜头插入、删除、移动后，后续 prompt 没有重新绑定故事功能。
- Seedance 排队慢，用户不得不机械点击下一条视频任务。

Harness 的价值是把这些“流程风险”收敛成工程规则，而不是每次靠主 Agent 记忆和临场发挥。

## v0.3 必须有的 harness

| Harness | 作用 | v0.3 要求 |
|---|---|---|
| `task-harness` | 把用户意图变成 typed job、依赖、状态和 manifest。 | 每个生成/审查/导出任务必须有 task id、输入、输出、状态、重试策略。 |
| `context-harness` | 控制给 Codex / subagent 的上下文预算。 | 使用 L0-L3 分层；默认传摘要，高风险才传更多相邻镜头和参考图路径。 |
| `skill-injection-harness` | 按任务注入最少必要资料包。 | 不全量注入 skill；只注入 story/style/prompt/QA/provider 中相关小包。 |
| `generation-harness` | 从 Shot Spec 编译 provider job。 | Image 2 / Seedance 2.0 任务都必须经过 prompt compiler 和 provider adapter。 |
| `filesystem-watcher-harness` | 监听 Codex 临时目录、项目 outputs、reports。 | 临时图出现即更新 UI，但只有命名、标准化、QA 通过后才进正式资产。 |
| `checkpoint-resume-harness` | 长任务可恢复。 | 每个 batch 可从 manifest 续跑，跳过已落盘且 hash 匹配的产物。 |
| `qa-harness` | 统一验收规则。 | 先判整体视觉是否同片，再判人物、场景、空间、动作、纹理和相邻连续性。 |
| `provider-adapter-harness` | 隐藏不同模型能力差异。 | UI 不直连 Image 2 / Seedance；统一走 capability matrix 和 adapter schema。 |
| `subagent-contract-harness` | 固定 subagent 输入输出格式。 | subagent 只返回结构化文字摘要和文件路径，不把图片 payload 带回主上下文。 |
| `tool-runtime-harness` | 统一本地工具路径和运行环境。 | worker 调用 `magick`、`ffmpeg`、`cp`、`find`、`sips` 等工具时，必须使用可检测的绝对路径或项目内 runtime 配置。 |

## 不应该做成重系统的部分

为了保持产品轻，以下内容不应该默认变成重型 LLM 流水线：

- 每次用户输入都跑全套 story/style/shot/audio/QA skills。
- 每张图都联网搜索风格资料。
- 每个镜头都做完整多 agent 讨论。
- 每次生成都注入完整项目历史。
- 把所有候选图都变成长期正向参考。

默认策略是代码和 manifest 先行，LLM 只处理语义判断、创意补全、prompt 编译和视觉审查。

## 本地工具运行规则

Codex worker 可能处在不同 shell 环境里，不能假设 `PATH`、shell 变量和系统工具都稳定可用。2026-04-28 的 B1 测试中，worker 已生成 8 张临时图，但整理 contact sheet 时因为 shell 变量和工具路径问题失败。

v0.3 必须遵守：

- 启动时检测 `magick`、`ffmpeg`、`ffprobe`、`python3`、`node`、`find`、`cp` 等工具路径。
- harness 传给 worker 的命令优先使用绝对路径或 runtime alias。
- 禁止在 zsh 脚本里使用容易冲突的变量名，如 `path`。
- worker 后处理失败不能抹掉已生成临时图。
- checkpoint/resume harness 应能接管“已生成但未整理”的任务，把临时图复制、重命名、标准化并送入 QA。

## 对前端的影响

前端不需要暴露 harness 术语，但必须展示 harness 产生的状态：

- `等待生成`
- `提交中`
- `连接恢复中`
- `生成中`
- `临时图已出现`
- `正在整理命名`
- `等待复验`
- `已锁定`
- `需要重生`
- `已跳过`

这能让用户知道 Codex 在持续干活，而不是面对一个无反馈的黑箱。

## 对测试的影响

后续压力测试不要只问“这张图好不好看”，而要验证：

- 任务是否被写入 manifest。
- reconnect 是否被正确显示为恢复中。
- 临时文件是否被 watcher 捕获。
- worker 没报告但图片已落盘时，系统能否自动发现。
- 已完成图片是否能在重启后跳过。
- 插入新镜头后，相邻镜头和故事功能是否重新编译。
- QA 失败后，废弃图是否被移出正向参考列表。

## 参考来源

- OpenAI Harness Engineering: https://openai.com/index/harness-engineering/
- Anthropic Building Effective Agents: https://www.anthropic.com/engineering/building-effective-agents
- LangGraph durable execution and persistence: https://langchain-ai.github.io/langgraph/concepts/durable_execution/
- Model Context Protocol specification: https://modelcontextprotocol.io/specification
- Node.js file system watching: https://nodejs.org/api/fs.html
