# Task Queue And Preflight

日期：2026-04-29  
状态：Worker C implementation note

## 核心原则

Vibe Core 的任务状态不能靠 agent 自觉。

Agent 可以理解用户意图、拆镜头、写提示词、请求生成、总结 QA，但不能自己决定任务是否可以进入正式执行。正式执行必须由系统合同判断：

```text
Task Envelope
-> Preflight Gate
-> Provider Policy
-> TaskRun Queue
-> Manifest Matcher
-> QA Gate
```

这样做是为了避免几个已经反复出现的问题：

- agent 口头说“我知道了”，但执行时漏掉 reference、首尾帧派生或 provider 限制。
- subagent 只看单帧，忘记故事线、相邻镜头和空间轴线。
- parked provider 被误提交。
- unknown provider 或 fallback 路径绕过 Image2 only。
- 临时图、失败图、rejected 图被当成后续正向参考。

## Preflight Gate 的职责

`PreflightGate` 在任务进入队列前运行，输出 `preflight_report`。

硬规则：

- `preflight.status === blocked` 时，任务不能进入 `ready_to_submit`。
- provider 未注册、unknown、不在 allowlist、在 forbidden list 时阻断。
- required mode 不被当前 provider slot 支持时阻断。
- 任务缺少 expected outputs 时阻断。
- rejected、temp、unsafe reference 不能作为正式参考。
- 视频任务必须有合法 keyframe pair derivation。

Preflight 的结果必须写入任务合同，不应该只显示一次 toast。

## TaskRun Queue 的职责

`TaskRun` 是本地执行状态，不等同于 provider 返回状态。

当前实现位于：

```text
src/core/taskQueue.ts
```

关键函数：

- `canEnterReadyToSubmit(envelope)`：根据 preflight 和 provider policy 判断能否进入 `ready_to_submit`。
- `createTaskRunFromEnvelope(envelope)`：从任务合同创建本地 `TaskRun`。
- `transitionTaskRun(taskRun, event)`：只允许合法事件推进任务状态。
- `queueNextRunnable(taskRuns, concurrency)`：根据并发和 backoff 选择下一批可运行任务。
- `parkTaskRun(taskRun, reason)`：把任务明确停在 `parked`，只保留占位。

## Parked Provider 规则

Seedance / Jimeng 当前只允许 parked。

这意味着：

```text
允许：生成 Task Envelope
允许：生成 Queue placeholder
允许：在 UI 显示“已预留 / 未启用”
禁止：submitted
禁止：querying
禁止：generating
```

当 provider 处于 `parked / planned / unavailable` 时，queue 不会把任务放进 `ready_to_submit`，只会停在 `parked`。

## Unknown Provider 规则

`providerId === "unknown"` 不能提交。

原因是 unknown provider 无法证明：

- 是否在 allowlist。
- 是否支持 required mode。
- 是否会触发 forbidden fallback。
- 是否会污染正式输出。

因此 unknown provider 只能停在 `pending_local`，等待 ProviderTaskValidator 或 adapter 编译补齐。

## 后续要接 Watcher 的状态

接入 filesystem watcher 和 manifest matcher 后，还需要把这些事件接进 queue：

- `provider_ready_derivative_detected`
- `expected_output_detected`
- `temp_output_detected`
- `qa_report_detected`
- `manifest_mismatch_detected`
- `stall_timeout_reached`
- `worker_exit_without_expected_output`
- `postprocess_recoverable`
- `formal_output_promoted`

最终任务完成不能以 agent 或 worker 的一句“完成了”为准，只能以 manifest matcher、文件 hash、expected outputs、QA coverage 共同判定。
