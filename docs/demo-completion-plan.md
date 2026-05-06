# Vibe Core Runtime Truth Layer Plan

日期：2026-05-05

本计划取代 2026-05-02 的“继续收束 demo / 继续跑真实生成”路线。刚才四个 subagent 审计的共同结论是：产品方向和骨架是对的，但现在最缺的不是再冲一次真实 provider，而是把 `project.vibe` 事实源、TaskRun runtime、真实 worker / watcher / QA / preview 回流做成一个可信闭环。

下一阶段名称：**Runtime Truth Layer**。

## 目标转向

- 从“继续跑真实生成”改为“先建立 runtime 事实层”。
- `project.vibe` 是项目事实源，`runtime-state.json` 只能是投影 cache。
- TaskRun ledger 是执行事实源，manifest / report / preview / UI progress 都从 ledger 投影。
- 真实输出必须经过 watcher event、provider observation、artifact transaction、semantic QA、promotion gate，不能由 worker 自报成功直接完成。
- UI 继续保持极简，主界面服务普通用户自然语言生成视频，不暴露 prompt / provider / queue / manifest 细节。
- Seedance / Jimeng 继续 parked；真实视频不进入下一阶段。

## 当前判断

### 已经成立

- 极简导演台方向正确：Story Flow、Asset Library、Preview、右侧自然语言面板是合适骨架。
- Image2-first、provider hard gate、validated task packet、preview/export shell、knowledge library 底座已经足够继续工程化。
- Real Demo E2E 002 证明真实 Image2 输出可以出现，但也暴露 runtime 事实层不足。
- Codex app-server adapter 已完成 readiness，不应立刻 live-enabled，但适合作为后续 thread / turn / fs-watch / approval ingest 来源。

### 仍未成立

- 普通用户输入一句自然语言后，系统还没有形成“项目事实更新 -> 任务排队 -> worker 执行 -> 文件监听 -> QA -> 预览自动刷新”的真实闭环。
- 缺 durable TaskRun lifecycle、worker lease、append-only watcher event ledger、artifact transaction gate。
- provider observation 和 semantic QA 还没有强绑定 output hash、thread/turn/tool-call facts 和 stable finding id。
- manifest/report/preview/UI progress 仍可能来自不同文件或 verify-synthesized 状态，不是同一事实源投影。
- Knowledge/Skills 可做 80 分底座，但缺 audio pack；taskPacketBuilder 不能允许空 injection trace。
- 资产库还需要从“素材列表”变成“审核并锁定资产”的工作台。
- 右侧自然语言面板必须真正 apply 到项目事实和任务队列，而不是只显示 dry-run 文案。
- Diagnostics 入口默认不能以明文主入口压在普通用户第一屏。

## 后续 6 轮开发

### P0-1：TaskRunLedger / Runtime Event Ledger

目标：建立唯一执行事实源。

必做：

- 新增 durable `TaskRunLedger`，append-only 记录 task lifecycle。
- 新增 runtime event ledger，至少覆盖：
  - task prepared / leased / running / waiting_output
  - output created / changed / settled / hash observed
  - provider observation paired / missing / mismatch
  - semantic QA pending / passed / needs_review / failed
  - worker stalled / interrupted / resumed / completed
  - artifact promoted / rejected / rollback required
- TaskRun 状态至少区分：
  - `prepared`
  - `queued`
  - `leased`
  - `running`
  - `waiting_output`
  - `output_detected_no_sidecar`
  - `provider_observed`
  - `qa_pending`
  - `needs_review`
  - `complete_verified`
  - `stalled`
  - `interrupted`
  - `failed`
  - `parked`
- manifest、report、preview、creator progress 只能从 ledger projection 生成。
- `runtime-state.json` 标注为 derived cache，不允许作为执行事实源。

验收：

- 新增或更新 `task-run-ledger` / `runtime-event-ledger` 合同测试。
- 旧 manifest/report/preview fixture 能从 ledger 重建。
- worker 自报 success 但缺 output hash / sidecar / QA 时，状态不能进入 complete。

2026-05-05 第 1 轮完成记录：

- 已新增 `src/core/taskRunLedger.ts`、`schemas/task_run_ledger.schema.json`、`scripts/task-run-ledger-test.mjs`。
- 本轮仅完成 append-only event contract、纯函数 projection、completion gate 和合同测试；真实 artifact transaction、fs watcher ingest、UI 自动刷新留给后续轮次接入。

### P0-2：Artifact Transaction Gate / Hash-bound QA

目标：让文件、sidecar、QA 和 formal promotion 成为同一笔可验证事务。

必做：

- 建立 artifact transaction gate：
  - output path whitelist
  - output hash
  - provider observation sidecar hash
  - semantic QA sidecar hash
  - source taskRunId / envelopeId
  - app-server thread id / turn id / tool call id 预留
- 中间态必须一等表达：
  - `image_exists_but_provider_observation_missing`
  - `provider_observed_but_qa_pending`
  - `semantic_qa_pending`
  - `sidecar_mismatch`
  - `complete_verified`
- Semantic QA 必须绑定 reviewed output hash 和 stable finding ids。
- P0 阻断，P1 进入 needs_review，P2 写入 trend feedback。
- Real Demo E2E 002 的 arcade texture P2 应回灌 style capsule / prompt compiler trend，不只留在报告里。

验收：

- 缺 provider sidecar、缺 QA sidecar、hash mismatch 都不能 promote。
- provider observation 和 semantic QA 不绑定 output hash 时测试失败。
- promotion report、preview item、export package 只接受 complete_verified artifact。

2026-05-05 第 2 轮完成记录：

- 已新增 `src/core/artifactTransactionGate.ts`、`schemas/artifact_transaction_gate.schema.json`、`scripts/artifact-transaction-gate-test.mjs`。
- 本轮完成 hash-bound artifact transaction 纯函数合同、preview/export/promotion 可用摘要、P0/P1/P2 QA severity 策略、provider thread/turn/tool-call 预留字段，以及编译回 TaskRunLedger events 的接口。
- 仍未接真实 fs watcher、worker lease、app-server live ingest 或真实 provider sidecar 写入；这些留给第 3 轮 Worker Lease / Real Watcher 接入。

### P0-3：Worker Lease / Real Watcher / App-server Ingest Shell

目标：把 worker 生命周期和真实文件变化纳入 runtime，而不是 verify 脚本补账。

必做：

- TaskRun 增加 worker lease、lease owner、lease expires、thread cap、retry budget、stall timeout、resume policy。
- Queue 区分 `queued` 与 `parked`：
  - `queued` 是容量可用后可执行。
  - `parked` 是 provider policy 或用户 enablement 阻断。
- 建立真实 watcher ingest：
  - 本地 fs watcher 先行，记录 append-only file events。
  - verify scan 只能作为 recovery/audit，不作为正常事实来源。
- App-server live ingest 暂不默认启用，只做 shell：
  - thread/turn lifecycle ingest
  - tool-call notification ingest
  - fs/watch / fs/changed event ingest
  - approval request ingest
  - disconnect/reconnect recovery
- app-server 仍不是事实源；它只向 runtime ledger 投递事实。

验收：

- worker 中断后可以通过 ledger 判断 resumable / reassigned / failed。
- 文件出现但未 settled 时 UI 只显示“等待文件稳定”。
- app-server transport 仍默认 off；live ingest 需要独立开关和测试。

2026-05-05 第 3 轮完成记录：

- 已新增 `src/core/runtimeIngestShell.ts`、`schemas/runtime_ingest_shell.schema.json`、`scripts/runtime-ingest-shell-test.mjs`。
- 本轮完成 worker lease ingest、queued/parked 区分、watcher file event portable facts、verify-scan recovery/audit 约束、app-server ingest-only shell，以及 watcher/provider/QA facts 组装后调用第 2 轮 ArtifactTransactionGate 的接口。
- app-server live transport、真实 fs watcher daemon、真实 worker spawn、provider 调用、artifact promotion 仍保持关闭；第 4 轮继续接 `project.vibe` 自然语言 transaction 和 task enqueue transaction。

### P1-1：Project.vibe Source of Truth / Natural Language Transaction

目标：让右侧自然语言面板真正改项目事实和任务队列。

必做：

- `project.vibe` 明确为事实源：
  - production bible
  - story flow
  - visual memory
  - source index
  - task runs ledger pointer
  - knowledge route history
- 自然语言输入先生成 transaction，不直接改 prompt：
  - story change transaction
  - asset update transaction
  - shot reflow transaction
  - artifact invalidation
  - task enqueue transaction
- UI apply 后写入 pending transaction；用户确认后才进入 project facts + queue。
- taskPacketBuilder 必须有非空 injection trace：
  - injectedKnowledgePacks
  - route result hash
  - source facts
  - expected outputs
  - QA checklist
- 空 injection trace 的正式任务必须 blocked。

验收：

- UI 输入一句自然语言后，可以看到“等待确认 -> 已写入项目事实 -> 已加入任务队列”的 creator-facing 状态。
- 变更角色、场景、风格、镜头顺序时，会列出 stale artifacts 和需要重生的任务。
- Queue 只接受 validated envelope，不接受 free text。

2026-05-05 第 4 轮完成记录：

- 已新增 `src/core/projectTransaction.ts`、`schemas/project_transaction.schema.json`、`scripts/project-transaction-test.mjs`。
- 本轮完成从 Director Workflow / Selected Edit / Task Packet 生成 Project.vibe pending transaction、source facts、artifact invalidation 摘要、validated task enqueue plan，以及通过 `ingestQueueDecision` 形成 queued / parked / blocked queue facts。
- Project.vibe 仍保持 `pending_only` 写入计划，`noFileMutation=true`，`projectVibeWriteAllowed=false`；空 knowledge injection trace 的正式 enqueue 会进入 `blocked_missing_knowledge_trace`，provider planned / parked 或用户未 enable 会进入 parked。
- 已把 transaction runtime summary 挂到 Director Workflow state，真实 Project.vibe 写入、用户确认后的事实应用、Minimal UI 投影和 live queue 执行留给第 5 轮。

### P1-2：Minimal UI Runtime Projection

目标：主界面只显示用户需要的短状态，但背后来自 ledger。

必做：

- 默认主界面隐藏 Diagnostics 明文入口；可以保留轻量图标或二级入口。
- Story Flow 卡片只显示画面、编号、短功能词、状态点。
- Asset Library 改成“审核并锁定资产”：
  - 角色主参考 / 三视图 / 表情
  - 场景 master / derived views
  - 风格锚图或极短约束
  - locked / candidate / needs_review / rejected
  - candidate/temp/failed/contact sheet/task output 不进入正式资产库
- 右侧自然语言面板显示作用域、输入框、确认、短进度。
- Preview 自动刷新：
  - image hold
  - video clip
  - missing placeholder
  - “4 张已返回，1 张等 QA，1 张需复核”这类短进度
- 主界面不展示 prompt、provider、queue、manifest、pack hash、schema、QA 细项。

验收：

- ledger 状态变化能自动刷新 Story Flow / Asset Library / Preview。
- 普通用户路径不出现 provider JSON / queue technical state。
- Diagnostics 仍能展开看到 ledger events、sidecar、QA、knowledge route、app-server ingest facts。

2026-05-05 第 5 轮完成记录：

- 已新增 `src/core/minimalRuntimeProjection.ts`、`scripts/minimal-runtime-projection-test.mjs`，把 transaction runtime、preview player queue、asset library 和可选 ledger projection 汇总为 creator-facing `shortLabel`、进度点、queued/parked/blocked/stale 计数、preview summary、asset summary。
- Director 主界面只消费 projection 的短状态：顶栏显示轻量状态点和“预览 N 段 / 等待确认 / 已加入计划”等短文案；Diagnostics 明文入口改为图标入口，工程细节继续留在 Diagnostics。
- Agent Panel prepare 后显示 pending transaction 的 `nextUiProjection` 短状态；confirm 后重算已确认计划摘要，只展示 queued/parked/blocked/stale 的用户文案，不暗示真实 provider 已提交。
- Preview 保持 image hold / video clip / missing placeholder 自动刷新，并改用 projection 的短摘要；Asset Library 标题调整为“审核并锁定资产”，保留 locked / candidate / review / rejected 状态。
- 第 6 轮可直接复用 `MinimalRuntimeProjection.assetSummary` 接 Knowledge / Skills / Audio 的可见状态，同时把 audio pack 的返回数、等待复核数和需复核数作为 `ledgerProjections` 或 preview summary 的附加输入接入。

### P2：Knowledge / Skills / Audio Pack / Manager

目标：把资料库变成可靠的按任务注入能力，并补上声音规划底座。

必做：

- 现有 `resources/knowledge` 作为 80 分底座继续使用。
- 补齐 `audio` pack：
  - 旁白
  - 对白
  - 音源授权
  - 环境音
  - BGM brief
  - no bgm
  - TTS/BGM provider 预留
- 建立最小默认兜底：
  - script/storyflow
  - story-function
  - style
  - composition
  - camera
  - prompt
  - provider
  - qa
  - audio
- Knowledge Router 必须按任务注入小包，不把整库塞给 worker。
- Knowledge Manager 后续 UI 支持：
  - 导入知识包
  - 新建知识包
  - 启用 / 禁用
  - 版本 / hash / 依赖查看
  - 路由测试
  - 最近任务使用记录
  - 冲突检测

验收：

- 每个正式 TaskEnvelope 都有非空 injection trace。
- 缺 pack 时使用最小默认兜底，并在 Diagnostics 标注 fallback。
- audio plan 仍不接真实 TTS/BGM provider，但每个 shot 能表达对白、旁白、环境音和 no-bgm 规则。

2026-05-05 第 6 轮完成记录：

- 已新增 `resources/knowledge/audio/core-audio-planning.md`，覆盖旁白、对白、音源授权/音源预留、环境音、BGM brief、视频 prompt 默认 no BGM，以及 audio.tts/audio.music provider slot 预留；本轮不接真实 TTS/BGM API。
- 已新增 `src/core/knowledgeDefaults.ts`，定义最小默认兜底集合和按 taskPurpose/providerSlot/intent 的小包 fallback 规则；正式任务路由失败或 budget 为空时只回退到小包，不注入整库。
- `taskPacketBuilder` 现在为正式 TaskEnvelope/SubagentTaskEnvelope 调用 Knowledge Router + Context Budget，写入 `knowledgeRouteResultId`、`contextBudgetId`、pack/snippet trace、manifest/input hash 和 warnings；fallback 仍为空时写入 knowledge trace blocker。
- Audio、video no-BGM、audio.tts/audio.music 路由测试已加入；Project Transaction 可继续用非空 trace 检查阻断空 envelope。
- 主 UI 继续不展示 Knowledge Pack/Router/hash 工程细节，相关状态保留在 Diagnostics/Settings 摘要。

## 真实测试重新开启门槛

在以下条件未满足前，不再把下一轮主目标设为真实 provider 继续生成：

- TaskRunLedger 和 runtime event ledger 已落地，并能投影 manifest / report / preview / UI progress。
- artifact transaction gate 已阻断缺 sidecar、缺 QA、hash mismatch、sandbox 外文件。
- worker lease、stall timeout、retry budget、resume policy 已有合同测试。
- watcher 事件来自真实 fs/watch ingest，verify scan 只作为 recovery/audit。
- provider observation 绑定 output hash、taskRunId、envelopeId，预留 thread/turn/tool-call facts。
- semantic QA 绑定 reviewed image hash 和 stable finding ids。
- `project.vibe` 是事实源；自然语言 transaction 能写入 pending facts 并 enqueue validated task。
- taskPacketBuilder 对正式任务不能产生空 injection trace。
- UI preview 从 ledger projection 自动刷新，不靠手工刷新报告。
- Diagnostics 默认不污染主界面，但可用于审计整条链路。
- `npm run build` 和 runtime / queue / watcher / QA / minimal-ui 相关测试通过。

满足门槛后，才重新开启真实测试，且顺序是：

1. Image2 单镜头、1 张图、动作时确认。
2. watcher ingest 捕获文件 settled/hash。
3. provider observation sidecar 绑定 hash。
4. semantic QA 绑定同一 hash。
5. artifact transaction gate promote。
6. preview 自动刷新。
7. export package 只收 complete_verified artifact。

真实视频 provider 继续 parked，不进入本轮开放范围。

## 开发边界

- 不改 provider policy 绕过真实提交门禁。
- 不把 app-server live transport 默认打开。
- 不把 prompt/provider/queue 细节暴露到普通用户主界面。
- 不让 runtime-state 成为新的事实源。
- 不让临时图、失败图、candidate、contact sheet 成为 future reference。
- 不允许 task packet free text。
- 不允许 Knowledge Pack 覆盖 provider policy、preflight、reference authority、QA gate。

## 推荐执行顺序

1. P0-1：TaskRunLedger / Runtime Event Ledger。
2. P0-2：Artifact Transaction Gate / Hash-bound QA。
3. P0-3：Worker Lease / Real Watcher / App-server Ingest Shell。
4. P1-1：Project.vibe Source of Truth / Natural Language Transaction。
5. P1-2：Minimal UI Runtime Projection。
6. P2：Knowledge / Skills / Audio Pack / Manager。
