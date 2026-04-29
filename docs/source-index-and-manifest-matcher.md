# ProjectSourceIndex / ManifestMatcher

日期：2026-04-29  
状态：Worker B implementation note

## 1. 模块目的

`ProjectSourceIndex` 和 `ManifestMatcher` 是 Vibe Core 连续开发里的两道硬约束。

它们解决两个不同问题：

- `ProjectSourceIndex`：确认“当前项目事实是什么”，避免旧对话、旧测试目录、失败图、临时图污染正式生成。
- `ManifestMatcher`：确认“任务是否真的产出了可用文件”，避免只相信 worker / agent 说已经完成。

这两个模块都先做成纯函数，不直接读文件系统，不调用模型，也不碰 UI。后续 watcher、queue、Project Store 可以把文件快照和 QA 覆盖信息传进来。

## 2. ProjectSourceIndex

文件：`src/core/sourceIndex.ts`

核心函数：

- `createEmptySourceIndex(projectId, projectVersion)`
- `computeSourceIndexHash(index)`
- `markArtifactStale(index, artifactId)`
- `assertReferenceAllowed(index, referenceId, mode)`
- `summarizeSourceIndex(index)`

### 2.1 为什么需要 Source Index

Agent 和 subagent 可能读到很多来源：

- 当前项目文件
- 历史聊天记录
- 旧测试目录
- 失败图
- 用户临时拖进来的图
- 被审掉的 rejected case

这些内容不能天然成为事实。Vibe Core 只承认 `ProjectSourceIndex` 指向的当前版本。

也就是说：

```text
旧聊天里出现过 != 当前项目可用
文件夹里存在 != 可以作为参考图
worker 生成过 != 可以进入正式生产
```

### 2.2 Reference 判断规则

`assertReferenceAllowed(index, referenceId, mode)` 是 hard guard。

当前规则：

- `lockedReferenceIds`：允许作为正式参考。
- `candidateReferenceIds`：只允许 `draft_preview`。
- `rejectedReferenceIds`：禁止所有用法。
- `failedReferenceIds`：禁止所有用法。
- `staleArtifactIds`：禁止继续引用，必须重新编译或重生。
- 不在 index 里的 reference：默认禁止。

这样做是为了防止：

- subagent 把失败图当正向参考。
- 主 agent 从旧对话里捞出一张图直接用。
- 插入/移动分镜后继续用旧 prompt。
- 临时图被误标成可复用资产。

### 2.3 Hash

`computeSourceIndexHash(index)` 对当前事实做稳定 hash。它排除 `sourceIndexHash` 和 `updatedAt`，避免时间戳变化导致事实 hash 无意义变化。

后续 `TaskEnvelope` 和 `SubagentTaskEnvelope` 应记录这个 hash。任务执行时如果 source index hash 已变化，任务应被视为 stale。

## 3. ManifestMatcher

文件：`src/core/manifestMatcher.ts`

核心函数：

- `matchTaskRunOutputs(taskRun, fsSnapshot)`
- `computeTaskCompletion(taskRun, qaCoverage)`

支持状态：

- `missing_expected_output`
- `actual_output_present`
- `qa_missing`
- `complete`
- `postprocess_recoverable`

### 3.1 为什么不能相信 worker 说完成

生成任务可能出现这些情况：

- Codex reconnect 之后 worker 说完成，但文件没有落到正式路径。
- provider 返回了临时图，尚未复制到 expected output。
- 文件生成了，但 QA 没覆盖。
- 文件名对不上，UI 看到的是旧文件。
- 视频 provider parked，但队列里留下了 submitted 状态。

所以任务完成必须由 manifest 判断：

```text
expected_outputs 存在
-> actual_outputs 对得上
-> QA coverage 覆盖
-> 才能 complete
```

### 3.2 matchTaskRunOutputs

`matchTaskRunOutputs(taskRun, fsSnapshot)` 不读文件系统。它只消费 watcher / Project Store 传入的路径快照。

判断逻辑：

- expected output 存在：`actual_output_present`
- expected output 不存在，但 temp dir 或 actualOutputs 里有候选：`postprocess_recoverable`
- expected output 不存在且没有候选：`missing_expected_output`

这个函数适合接 watcher：前端监控到新文件后，把快照喂给 matcher，而不是让 UI 自己猜任务状态。

### 3.3 computeTaskCompletion

`computeTaskCompletion(taskRun, qaCoverage)` 用 task run 的 expected / actual outputs 和 QA 覆盖报告计算能否进入下一步。

默认要求 QA：

- 输出缺失：不能推进。
- 输出存在但 QA 缺失：不能推进。
- QA failed：不能推进。
- 输出存在且 QA 覆盖：`complete`。

这能阻止“单帧生成成功，但还没放回故事线检查”的情况进入视频、preview 或 export。

## 4. 后续接入点

建议接入顺序：

1. `ProjectSourceIndex` 接 Project Store，成为当前事实入口。
2. `TaskEnvelope` 记录 `sourceIndexHash`。
3. `PreflightGate` 调用 `assertReferenceAllowed`。
4. `Watcher` 把文件路径快照传给 `matchTaskRunOutputs`。
5. `Queue` 用 `computeTaskCompletion` 决定是否进入下一状态。
6. `UI` 只展示 matcher / gate 结论，不自行判断任务完成。
