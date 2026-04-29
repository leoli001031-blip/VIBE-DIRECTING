# Codex CLI Execution Boundary

更新时间：2026-04-28

用途：明确 Vibe Director v0.3 暂时在 Codex CLI 中执行时，哪些属于 Codex 的 agent 能力，哪些属于 provider 生成能力，以及未来替换其他 CLI 或模型时如何不推翻架构。

## 基本判断

Codex CLI 在 Vibe Director 中首先是 agent 执行层：

- 理解自然语言任务。
- 修改项目文件。
- 调用本地脚本和 CLI。
- 注入 skills / knowledge packs。
- 调度 subagent。
- 汇总结果。
- 维护 Story Flow、Visual Memory、Spatial Memory、Shot Spec 和 manifest。

Codex CLI 同时可以作为 Image 2 的一种调用路径：

- 官方 Codex CLI 文档显示，CLI 支持图像输入，也支持在 CLI 中生成或编辑图片。
- 内置图像生成使用 `gpt-image-2`。
- 可以通过自然语言或 `$imagegen` 调用。
- 大批量图像生成建议走 OpenAI API，以便使用 API 计费和批量控制。

所以架构上不要写成：

```text
Frontend -> Codex CLI -> Image
```

而应写成：

```text
Frontend
-> Local Orchestrator
-> Agent Adapter: Codex CLI
-> Generation Adapter: openai-image2-codex-cli | openai-image2-api | seedance2-provider
```

这样当前能用 Codex CLI 跑起来，未来也能把 Image 2 从 CLI 路径迁到 API 路径，或把视频后端替换成 Seedance / OpenAI future video API / 即梦 / Runway / ComfyUI。

## 主 Agent 和 subagent 边界

主 Agent 保存：

- 项目结构化状态。
- shot / scene / act 的文字摘要。
- 资产路径。
- prompt hash。
- QA 结论。
- 失败原因。

主 Agent 不保存：

- 大量图片 payload。
- 视频 payload。
- 每次生成的完整视觉上下文。
- 已失败素材的正向参考。

subagent 或 worker 负责：

- 运行 Image 2 / Seedance 任务。
- 查看图片和视频。
- 把结果落盘。
- 输出结构化文字报告。
- 标记 P0 / P1 / P2 问题。

## 为什么要这样做

1. 防止主上下文被图片和长视觉报告撑爆。
2. 避免 subagent 每次拿到的信息不一致。
3. 保持 provider 可替换。
4. 保证未来接入 API、CLI、本地 ComfyUI 或其他平台时，只改 adapter，不改 Story Flow。
5. 让“自然语言创作平台”不被某一个模型的 prompt 格式绑死。

## 当前 v0.3 实现建议

- `AgentAdapter` 默认使用 Codex CLI。
- `ImageGenerationAdapter` 默认先支持 `openai-image2-codex-cli`，同时预留 `openai-image2-api`。
- `VideoGenerationAdapter` 默认支持 `seedance2-provider`。
- `AudioGenerationAdapter` 先做 schema 和设置项预留，不强行做重剪辑。
- 所有生成任务必须写入 task manifest，包含输入、输出、prompt hash、provider version、QA 状态。
- 所有生成任务必须能从 manifest 重跑。

## Harness Engineering 要求

Codex CLI 只是 agent 执行层，Vibe Director 不能把整个产品押在一次长对话的临场记忆上。v0.3 需要用 harness engineering 把任务运行包起来：

- `task-harness`：每次生成、审查、导出都必须写入 typed task 和 manifest。
- `context-harness`：按 L0-L3 预算给 Codex / subagent 注入上下文，避免每次全量塞项目。
- `generation-harness`：Shot Spec 先编译成 provider job，再交给 Image 2 / Seedance adapter。
- `filesystem-watcher-harness`：监听 Codex generated_images、项目 outputs、reports，不能只等 worker 最终报告。
- `checkpoint-resume-harness`：worker 中断、reconnect、用户取消后，可从 manifest 续跑并跳过已完成文件。
- `qa-harness`：生成结果必须先进入复验，不能因为文件落盘就自动锁定。
- `subagent-contract-harness`：subagent 输入输出必须稳定，主 Agent 只接收文字摘要和文件路径。
- `tool-runtime-harness`：统一本地工具路径，避免 worker 因 `PATH`、shell 变量或缺失系统工具导致后处理失败。

这层 harness 对用户不可见，但决定前端能否显示“连接恢复中、临时图已出现、正在整理命名、等待复验、已锁定”等真实状态。

## 连接重试与任务状态

Codex CLI 在生成任务提交或流式输出过程中，可能出现多次：

```text
stream disconnected - retrying sampling request (1/5)
...
stream disconnected - retrying sampling request (5/5)
falling back to HTTP
```

这不应直接判定为失败。它更接近传输层从 streaming 切换到 HTTP 的恢复流程。

Vibe Director 判断任务状态时，应使用组合信号：

- Codex worker 进程是否仍在运行。
- 项目 `outputs/` 是否出现目标文件。
- Codex generated_images 临时目录是否出现新图。
- report 文件是否更新。
- stdout/stderr 是否持续有新日志。
- 是否超过 stall timeout。

状态映射：

| 观察到的情况 | UI / local_status |
|---|---|
| `reconnect 1/5` 到 `5/5` | `connection_retrying` |
| `falling back to HTTP` 且进程仍在 | `generating` |
| generated_images 有新图但 outputs 还没有 | `postprocessing_pending` |
| outputs 出现目标文件 | `qa_pending` |
| 进程退出且 outputs / report 完整 | `succeeded` |
| 进程退出且无目标产物 | `failed_worker_exit` |
| 进程仍在但长时间无日志和无文件变化 | `stalled_observing` |

自动恢复规则：

- 连接重试期间不要自动杀进程。
- 如果进入 `stalled_observing`，先记录 checkpoint，再由用户或调度器选择重启当前批次。
- 重启前读取 manifest 和 outputs，跳过已完成文件，避免重复生成和重复计费。
- 对用户展示简化状态，不展示整段 reconnect 日志。

## 文件夹监听与实时出图

Codex CLI 图像生成通常先把图片写入 `~/.codex/generated_images/<thread_or_task_id>/`，再由 worker 复制、重命名、标准化到项目 `outputs/`。因此实时进度不能只依赖 worker 最终报告。

Vibe Director 应使用文件夹 watcher：

- 监听 Codex generated_images 临时目录。
- 监听项目 `outputs/` 目录。
- 监听项目 `reports/` 目录。

推荐事件：

| 文件事件 | local_status |
|---|---|
| generated_images 出现新图片 | `temp_candidate_available` |
| outputs 出现 expected filename | `named_candidate_available` |
| 标准化派生图出现 | `provider_ready_available` |
| QA report 更新 | `qa_pending` 或 `qa_complete` |

临时图的使用规则：

- 可以立即推给前端预览。
- 可以显示在 `Incoming` 或当前 batch 区域。
- 不允许作为后续正式参考。
- 只有复制到 `outputs/`、匹配 manifest、通过 QA 后，才能成为 `formal_keyframe`。

## 参考来源

- OpenAI Codex CLI features: https://developers.openai.com/codex/cli/features
- OpenAI Image Generation API: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI Sora discontinuation notice: https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation
- OpenAI Harness Engineering: https://openai.com/index/harness-engineering/
- Anthropic Building Effective Agents: https://www.anthropic.com/engineering/building-effective-agents
- LangGraph durable execution and persistence: https://langchain-ai.github.io/langgraph/concepts/durable_execution/
