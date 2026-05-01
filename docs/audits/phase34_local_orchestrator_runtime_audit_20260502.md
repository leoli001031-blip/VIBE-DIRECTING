# Phase34 Local Orchestrator Runtime Audit 2026-05-02

审计范围：`docs/core-development-sequence.md`、已实现 Phase 10 Local Orchestrator / Queue Harness、Phase 24-33 runtime/provider gate 规划、当前用户关于“长队列自动续跑、前端看到 Codex 在干活、不靠 agent 自觉”的产品要求。  
边界：只做规划和遗漏审计，不改 runtime/UI 代码，不提交 provider，不执行真实 worker，不写项目文件。

## 总体判断

Phase 34 最合理的定义不是继续向真实 provider 前进，而是把已经存在的 Local Orchestrator 变成 `ProjectRuntimeState.localOrchestrator` 一等事实。原因很直接：系统真正要解决的是大批量图片、首尾帧、视频和 QA 任务的稳定排队、续跑、阻断与复核，而不是更早打开执行权限。

用户之前反复指出的失败模式，基本都和“流程没有被机器事实锁住”有关：

- subagent 每次拿到的上下文不一致。
- worker 或 provider 自报成功后，没有被放回 story / manifest / QA / expected output 链条中复核。
- 大量任务运行时，用户只能等结果，不知道 Codex 是否正在工作。
- 一条视频生成完成后，还需要用户手动继续 click，而不是系统根据队列自动规划下一条。
- reconnect、stall、retry 和 manual review 没有成为稳定可展示状态。

所以 Phase 34 应该先补 runtime integration 和可观测性，而不是接真实 Image2 / Seedance provider submit。

## Phase34 应补齐的事实链

- `ProjectRuntimeState.localOrchestrator`：Local Orchestrator 必须成为 runtime 一等字段，不能只停留在独立 test fixture。
- Queue item 状态：`waiting`、`ready`、`running_planned`、`waiting_output`、`qa_pending`、`needs_review`、`failed`、`blocked`、`complete_verified`。
- Auto-continue plan：只表示“下一条应该准备好”，不能启动 daemon、spawn Codex、submit provider 或改文件。
- Reconnect / stall / retry：Codex CLI 或 provider 长等待时，要有机器可读状态与 retry budget。
- Manual review：任何 worker self-report、manifest 缺失、QA 未闭环、输出不符合 expected contract，都必须进入 review/blocker。
- Completion gate：完成必须由 expected output、manifest match、QA pass、promotion gate 共同决定。

## 必须保持的硬锁

- `noDaemon=true`，不得启动后台 daemon。
- `noSpawnCodex=true`，不得真实拉起 Codex / subagent。
- `noProviderSubmit=true`，不得提交 Image2、Seedance、Jimeng 或其他 provider。
- `liveSubmitAllowed=false`。
- `noShellExecution=true`。
- `noCredentialRead=true`，`noCredentialWrite=true`。
- `noFileMutation=true`。
- Worker/provider self-report 只能进入 review fact，不能单独使任务 complete。

## UI 与产品边界

主导演台仍然应保持极简，不应把 Phase34 做成工程控制台：

- 可以有一个很轻的进度状态：例如“12 个任务排队中 / 2 个等待复核 / 1 个阻断”。
- 可以有 progress strip，让用户知道系统在推进。
- 不应出现 Local Orchestrator、TaskEnvelope、manifest、provider submit、spawn、daemon、credential、shell 等工程词。
- 不应增加 Run、Submit、Execute 这类按钮。
- Diagnostics / Settings 可以展示只读队列面板：状态分布、当前 planned item、reconnect/stall/retry、manual review、expected output / manifest / QA / promotion gate。

## 验收建议

代码实现阶段建议至少跑：

- `npm run orchestrator:test`
- `npm run import:test`
- `npm run project-runtime:test`
- `npm run minimal-ui:test`
- `npm run build`

浏览器验收：

- 主 Director surface 保持干净，不出现 Local Orchestrator / queue harness / provider submit / spawn / daemon 等工程入口。
- Diagnostics 存在只读 Local Orchestrator 队列面板。
- 队列面板能展示长队列、auto-continue plan、reconnect/stall/retry/manual review、QA/manifest/expected output gate。
- 页面不出现可触发真实执行的 Run / Submit / Execute 控件。

## Phase34 之后的建议

优先建议 Phase 35 做 `Task Queue Visibility / Progress Strip`。

理由：

- 这最直接回应用户的产品要求：大批量生成时，前端要让用户看到 Codex 在干活。
- 它仍然可以保持只读，不会过早打开 provider / worker / credential / shell。
- 它能让普通用户理解“系统正在替我推进”，而不是只看到一个复杂的 Diagnostics 页面。

备选建议是 `Project Store write confirmation gate`。

理由：

- Phase 19 已经有 Project Store IO Gate，但后续真实写入前还需要动作时确认和可撤销/可审计的写入计划。
- 它能防止 runtime integration 之后直接把 queue 状态落盘，造成项目事实被错误更新。

不建议 Phase 35 直接接真实 provider。

原因：

- Provider execution handoff 仍默认缺少动作时确认。
- Local Orchestrator 尚未成为 runtime 一等事实时，真实执行缺少统一队列状态、retry、stall、QA 和 manifest 闭环。
- 直接接 provider 会重新回到“agent 自觉执行、用户等结果、出错后难追溯”的旧问题。
