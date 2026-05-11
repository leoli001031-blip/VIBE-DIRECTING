# Vibe Core Refactor Plan 2026-05-11

更新时间：2026-05-11
适用范围：`/Users/lichenhao/Desktop/vibe core`
状态判断：可以继续重构，但必须按小批次、强边界、强 receipt 推进。当前默认 UI 已回到 minimal director desk，`minimal-ui:test` 中 Director engineering term total 为 `0`，Diagnostics engineering term total 为 `376`。这说明主界面方向已经恢复，但结构风险仍高：`src/App.tsx` 9288 行，`src/styles.css` 4397 行，`scripts/local-runtime-api-server.mjs` 1671 行。后续目标不是再堆功能，而是把事实源、运行时、provider 回流、subagent 任务、默认 UI 和验证体系拆成可审计的层。

历史审计快照曾显示 `main` ahead 33，最近已完成拆分包括 one-shot mock executor、Round5 artifact ingest、Round5 strict-edit return、one-shot return、return writers 等。这个基础可以继续用，但不能把快照当成 worker 开工基线；每个 worker 开工前必须刷新当前分支、dirty/untracked、verify scripts 和三大文件行数。也不能把 `mock`、`dry-run`、`handoff ready`、`execute-return`、`provider submit`、`formal promotion` 混在一起。特别注意：`execute-return` 是外部 provider 回流 ingest，不是 provider submit。

## 0. 硬规则

1. 所有实现改动默认由 subagents/workers 执行。主 agent 负责拆分任务、审查 diff、集成、验证和提交节奏。
2. 主 agent 可以写规划、审计、handoff、review 文档；不直接做大面积代码改动。
3. `mock`、`dry-run`、`handoff ready`、`execute-return`、`provider submit`、`formal promotion` 必须在命名、API、receipt、测试中明确分开。
4. `execute-return` 只接收外部 provider 已完成的回流结果，写 evidence/receipt/status，不代表系统发起 provider submit。
5. `project.vibe` 是长期事实源；`runtime-state.json` 是可删、可重建、不可授权事实的缓存/投影。
6. 默认 UI 只显示 Story Flow、Visual Memory/Asset Library、Agent Panel、Preview、轻状态线。工程细节全部进入 Diagnostics。
7. Asset Library 不是图库。`candidate`、`temp`、`failed`、`contact sheet` 不能成为 reference authority。
8. provider/subagent logs 只能作为 evidence/receipt，不能直接污染 project facts。
9. 写项目事实必须走 staged transaction + receipt；没有 receipt 的写入不能进入 `project.vibe`。
10. 真实 provider 扩量必须逐级：1 张 -> 3 张 -> 6-10 张。每一级都要单独 permission receipt 和 return ingest 审查。

## 1. 目标架构

### 1.1 UI 层

默认 Director UI 是创作工作台，不是工程控制台。

保留在默认 UI：

- Story Flow：故事顺序、镜头状态、当前阻塞。
- Visual Memory / Asset Library：只展示锁定 reference、可审查 candidate、缺失项和轻量状态。
- Agent Panel：自然语言 director input、任务队列摘要、worker 结果摘要。
- Preview：可播放 rough cut、关键帧/片段预览、最小状态。
- 轻状态线：ready、needs review、blocked、running、last receipt。

进入 Diagnostics：

- provider policy、adapter payload、raw handoff、worker stdout/stderr、fixture paths、ledger internals、strict-edit diff、Round5 ingest details、runtime API raw response。

默认 UI 的边界目标：

- `src/App.tsx` 只做组合和顶层状态接线。
- Director UI 组件放在 `src/ui/director/`。
- Diagnostics 组件放在 `src/ui/diagnostics/`。
- 通用 frame/button/status primitive 放在 `src/ui/common/`。
- 默认 UI 不能出现 provider implementation 术语，除非是用户可理解的状态文案。

### 1.2 Project Facts 层

`project.vibe` 是唯一长期事实源。它保存人物、场景、道具、镜头、锁定 reference、story facts、voice facts、package manifest 等长期事实。

需要产品化的事实结构：

```ts
type FactFile = {
  role: "project" | "character_reference" | "scene_reference" | "prop_reference" | "shot_frame" | "voice_source" | "export_package";
  path: string;
  hash: string;
  schemaVersion: string;
  sourceOfTruth: "project.vibe" | "external_locked_file";
  status: "locked" | "needs_review" | "missing" | "deprecated";
  receiptId?: string;
};
```

`runtime-state.json` 只能由 `project.vibe`、task ledger、receipt、文件扫描重建。UI 可以读 runtime projection，但不能从 runtime projection 反推授权事实。

### 1.3 Runtime API 层

Runtime API 负责 route + DI + 少量投影，不能成为业务事实和 provider 执行的混合巨物。

目标拆分：

- `strict-edit prepare`：生成 edit package、handoff、permission intent，不调用 provider。
- `provider submit`：独立 permission receipt，明确实际触发外部 provider。
- `execute-return`：接收 provider 外部回流结果，写 evidence/receipt/status，默认 `needs_review`。
- `formal promotion`：把审查通过的结果写入 project facts，必须 staged transaction + receipt。
- `real-chain status`：只读状态聚合，不写事实。
- `image2 batch plan`：计划和批次边界，不直接 promotion。
- `legacy 005 adapter`：旧 demo 兼容层，不能反向塑造新 API。

### 1.4 Provider/Subagent 层

所有 image、asset、pair QA、scene QA、story audit 都必须有 task envelope。worker 只做任务执行和报告输出，不直接 provider submit，不直接 project fact promotion。

worker 输出必须包含：

- task envelope id
- input hash
- output artifacts
- evidence paths
- decision summary
- blocked reasons
- recommended next action
- receipt candidate

主 agent 审查后才能决定是否进入 staged transaction 或 provider permission。

### 1.5 Verification 层

验证需要分层，不能把所有东西都塞进 `verify:all`：

- `verify:runtime-fast`：runtime API 快速路由、边界、投影、return writer。
- `verify:round5`：Round5 artifact ingest、strict-edit return、derive/prepare/return 边界。
- `verify:subagent`：task envelope、worker runtime、subagent gate、permission gate。
- `verify:provider-fast`：provider permission receipt、transport contract、adapter boundary、return ingest fixture；永不触发真实 provider submit。
- `verify:provider-full`：未来真实 Image2 runbook 入口，必须手动确认 permission receipt、真实 submit 操作和 return ingest 报告；不能被任何 fast/full verify aggregator 隐式触发真实 submit。
- browser smoke checklist：默认 UI、Diagnostics、Preview、Asset Library、Agent Panel。
- worker output receipt checklist：审查 worker 产物是否可进入下一步。

这些 P0 `verify:*` 已由 `package.json` 中的轻量 aggregator 提供，详情见 `scripts/verify-runtime-fast.mjs`、`scripts/verify-round5.mjs`、`scripts/verify-subagent.mjs`、`scripts/verify-provider-fast.mjs` 和 `docs/verification-checklists.md`。如果 worker 在旧快照中还看不到这些脚本，才使用下面的 bootstrap fallback：

- `verify:runtime-fast` 展开为：`npm run local-runtime-api:test && npm run runtime-api-boundary:test && npm run runtime-api-current-project-return-writers:test && npm run runtime-api-current-project-one-shot-return:test && npm run runtime-api-provider-return-evidence:test && npm run runtime-api-workbench-projection:test && npm run runtime-api-file-serving:test`。旧快照 fallback：直接跑这串命令；需要更宽覆盖时才用现有 `npm run verify:runtime`。
- `verify:round5` 展开为：`npm run round5-artifact-ingest:test && npm run runtime-api-round5-artifact-ingest:test && npm run runtime-api-current-project-round5-strict-edit-return:test && npm run project-real-chain-round5-ui-derive:test && npm run codex-app-server-image2-edit-adapter:test && npm run local-runtime-api:test`。旧快照 fallback：直接跑这串已有命令。
- `verify:subagent` 展开为：`npm run subagent-gate:test && npm run artifact-transaction:test && npm run provider-execution-permission-gate:test`。旧快照 fallback：直接跑这串已有命令。
- `verify:provider-fast` 展开为：`npm run provider-execution-permission-gate:test && npm run provider-action-confirmation-receipt:test && npm run provider-execution-handoff:test && npm run real-provider-transport:test && npm run provider-submit-permission-receipt:test && npm run current-project-provider-submit-permission-receipt:test && npm run codex-app-server-image2-edit-adapter:test && npm run real-image2-executor-adapter:test && npm run runtime-api-provider-return-evidence:test && npm run current-project-image2-return-executor:test`。旧快照 fallback：直接跑这串已有命令；这条链只检查 permission receipt、transport contract、adapter boundary、return ingest fixture，永不真实 submit。
- 未来 `verify:provider-full` 没有安全的自动 fallback。当前只能按 P6 runbook 手动分级执行：先 `npm run current-project-real-image2-readiness:test`，再生成/确认 permission receipt 和报告路径，真实 provider submit 由人工显式操作，最后用 `npm run current-project-image2-return-executor:test` 校验外部回流 fixture。`verify:provider-full` 不得被 `verify:all`、`verify:provider-fast` 或任何默认 CI 隐式调用。

### 1.6 Knowledge Pack 产品化边界

Knowledge Pack 是可迁移项目知识包，不是图库、`runtime-state.json` dump、provider log 汇总，也不是 contact sheet 索引。

可作为 Knowledge Pack authority 的来源只有：

- `project.vibe` 中已审查的 facts。
- locked external files，必须有 role/path/hash/schemaVersion/sourceOfTruth。
- reviewed receipts，必须可追溯到 staged transaction 或人工 review。
- voice source metadata，必须有 source hash、role、receipt/status。
- export manifest，必须有 manifest hash、source receipt ids、schemaVersion。

`candidate`、`temp`、`failed`、`contact sheet` 可以作为 evidence 附带，但不能成为 authority。Knowledge Pack 不自动 promotion；生成后仍需要 review，manifest hash、source receipt ids、schemaVersion 缺任一项都不能进入长期事实链。

## 2. 当前基线和已完成成果

已确认基线：

- 默认 UI 已回到 minimal director desk。
- `minimal-ui:test` 的 Director engineering term total 为 `0`。
- Diagnostics engineering term total 为 `376`，工程细节仍可见但已隔离到 Diagnostics。
- `src/ui/director/MinimalStoryFlow.tsx`、`MinimalPreview.tsx`、`MinimalAgentPanel.tsx` 已存在，说明 UI 拆分已经开始。
- `src/ui/common/MediaFrame.tsx` 已存在，可继续承载 preview/media frame 复用。
- `src/ui/diagnostics/AudioDiagnosticsPanel.tsx`、`PreviewExportDiagnostics.tsx` 已存在，可作为工程细节收纳点。
- `scripts/local-runtime-api-server.mjs` 已降到 1671 行，当前职责趋向 route + DI + 少量残留投影。
- package scripts 已有 `verify:ui`、`verify:runtime`、`verify:provider-contracts`、`verify:all`，但还缺少更清晰的 fast/full/round5/subagent 分层。
- provider boundary 已有 `provider-submit-permission-receipt:test`、`current-project-image2-return-executor:test`、`runtime-api-provider-return-evidence:test` 等基础。
- project facts 和 transaction 已有 `project-vibe`、`projectTransaction`、`runtimeTruthReceipts`、`runtimeTruthIngest` 等基础模块。

已完成成果应该作为地基，不应该被重写：

- One-shot mock executor 和 one-shot return 已经把 mock/return 的一部分边界拆开。
- Round5 artifact ingest 和 Round5 strict-edit return 已经给外部 artifact 回流提供路径。
- return writers 说明 runtime API 已开始把回流写入和 provider submit 分离。
- `MotionEndpointContract`、`ImageKeyframeRuntime`、`videoPlanning` 的 schema-first 路线应继续保留。

## 3. 阶段规划 P0-P6

### P0. 重构治理和测试分层

目标：

- 建立重构期间的共同语言、脚本分层、fixture 并发纪律、browser smoke checklist、worker output receipt checklist。
- 让 worker 不需要猜测哪些测试能并行、哪些真实 provider 路径需要手动 permission。
- 建立 baseline capture：每个 worker 开工前刷新 `git status --short --branch`、当前 `package.json` verify scripts、`src/App.tsx` / `src/styles.css` / `scripts/local-runtime-api-server.mjs` 行数、dirty/untracked 文件清单；不能依赖文档里的历史 `main ahead 33` 或行数快照。

改动边界：

- `package.json` scripts。
- `scripts/` 下新增轻量 verify aggregator。
- `docs/` 下新增 checklist 或更新现有开发文档。
- 必要时新增 `test-fixtures/` 或 `scripts/fixtures/` 使用说明，不改业务逻辑。

禁止事项：

- 不改 provider 行为。
- 不改 `project.vibe` schema。
- 不把真实 provider submit 放进 fast verify。
- 不让多个测试共享同一个可写 fixture 目录。

subagent 写入范围建议：

- Worker A：`package.json` + `scripts/verify-*.mjs`。
- Worker B：`docs/verification-checklists.md`。
- Worker C：只审查 fixture 写入路径，不改代码。

验证命令：

- P0 新增脚本前最低 bootstrap：`npm run local-runtime-api:test && npm run runtime-api-boundary:test && npm run runtime-api-current-project-return-writers:test && npm run runtime-api-current-project-one-shot-return:test && npm run runtime-api-provider-return-evidence:test && npm run runtime-api-workbench-projection:test && npm run runtime-api-file-serving:test && npm run subagent-gate:test && npm run artifact-transaction:test`。
- P0 新增脚本后最低：`npm run verify:runtime-fast && npm run verify:subagent`。
- P0 新增脚本前完整 bootstrap：按 1.5 中 `verify:runtime-fast`、`verify:round5`、`verify:subagent`、`verify:provider-fast` 的展开命令执行，再跑 `npm run verify:ui`。
- P0 新增脚本后完整：`npm run verify:runtime-fast && npm run verify:round5 && npm run verify:subagent && npm run verify:provider-fast && npm run verify:ui`。
- 不运行：`verify:provider-full`，除非明确进入 P6 真实 provider runbook；即使进入 P6，也不能由脚本隐式触发真实 submit。

完成标准：

- `verify:*` 名称能从命令名看出风险等级。
- 每个 verify 说明是否可并行、是否写 fixture、是否需要 token/permission。
- `verify:provider-fast` 明确永不真实 provider submit，只检查 permission receipt、transport contract、adapter boundary、return ingest fixture。
- bootstrap fallback 与新增后的 `verify:*` 展开命令在文档和 `package.json` 中一致。
- browser smoke checklist 覆盖默认 UI、Diagnostics、Preview、Asset Library、Agent Panel。
- worker output receipt checklist 可直接贴进 worker handoff。

### P1. 默认 Director UI 结构拆分

目标：

- 把默认 UI 继续从 `App.tsx` 中拆出，保持行为不变。
- 抽出 `MinimalTopNav`、`MinimalAssetLibrary`、`MinimalDirectorStatusDot`、`DirectorMode`。
- 将 `styles.css` 分块，先按 UI 区域迁移，不做视觉重设计。

改动边界：

- `src/App.tsx`。
- `src/ui/director/`。
- `src/ui/common/`。
- `src/styles.css` 或新增 `src/styles/*.css`。
- 只允许补必要类型和 props。

禁止事项：

- 不改默认 UI 信息架构。
- 不把 Diagnostics 内容带回主界面。
- 不改变 provider submit/return 行为。
- 不用大规模重命名掩盖行为变化。

执行顺序：

- P1 不能并行开多个 worker 同时碰 `src/App.tsx` / `src/styles.css`。
- 第一刀：`DirectorMode + MinimalTopNav`，只改 `App.tsx`、`src/ui/director/DirectorMode.ts`、`src/ui/director/MinimalTopNav.tsx` 和必要样式引用。
- 第二刀：`MinimalDirectorStatusDot`，只改状态点/轻状态线相关组件和最小接线。
- 第三刀：`MinimalAssetLibrary`，只接收现有 projection props，不改 projection 生成逻辑。
- 第四刀：styles 分块，只搬迁 class，不改布局意图。
- 每刀完成、验证、提交后再进入下一刀。

验证命令：

- 最低：`npm run minimal-ui:test && npm run build`。
- 完整：`npm run verify:ui`。
- browser smoke：必须。检查默认 UI 无工程术语、Diagnostics 仍可打开、Preview 不空白、Asset Library 不变成图库。

完成标准：

- `App.tsx` 明显减少，顶层职责变成 composition/state wiring。
- Director 默认 UI 中 provider/adapter/ledger/raw handoff 细节不可见。
- `minimal-ui:test` 中 Director engineering term total 保持 `0`。
- 浏览器 smoke 有截图或文字记录。

### P2. Runtime Server 剩余拆分

目标：

- 继续拆 `scripts/local-runtime-api-server.mjs` 的残留投影和 route 混杂。
- 按 strict-edit prepare、real-chain status、image2 batch plan、legacy 005 adapter 分离。
- 明确 prepare/return/promotion 不混用。

改动边界：

- `scripts/local-runtime-api-server.mjs`。
- `scripts/runtime-api-*.mjs` 测试。
- `src/core/*Runtime*`、`src/core/*Return*`、`src/core/*Batch*` 相关纯函数模块。

禁止事项：

- 不在 prepare endpoint 里 provider submit。
- 不在 execute-return 里 formal promotion。
- 不让 legacy 005 adapter 污染新 route 命名。
- 不把 runtime-state 当成授权事实写回 project facts。

执行顺序：

- 先做只读 route map，列出每条 route 的 prepare/submit/return/promotion 语义、写入点、fixture 写入目录和候选模块边界。
- P2 不能并行开多个 worker 同时改 `scripts/local-runtime-api-server.mjs`。
- 第一刀：strict-edit prepare extraction，只抽 prepare，不写 facts，不 provider submit。
- 第二刀：real-chain status projection extraction，只读状态聚合，不写事实。
- 第三刀：image2 batch plan route extraction，只做计划和批次边界，不 promotion。
- 第四刀：legacy 005 adapter isolation，旧 demo 兼容层不能反向塑造新 API。
- 每刀完成、验证、提交后再进入下一刀。

验证命令：

- 最低：`npm run local-runtime-api:test && npm run runtime-api-boundary:test`。
- P0 新增脚本前完整 bootstrap：按 1.5 中 `verify:runtime-fast` 和 `verify:round5` 的展开命令执行。
- P0 新增脚本后完整：`npm run verify:runtime-fast && npm run verify:round5`。
- 不可并行：写同一 fixture 的 runtime API 测试不能并行。

完成标准：

- Server 文件继续变小，route 只装配 request/response。
- 每条 route 名称能看出 prepare、submit、return、promotion 中的哪一类。
- return ingest 默认 `needs_review`，不自动 promotion。
- 旧 005 demo 兼容代码被隔离且有测试保护。

### P3. `project.vibe` 事实源产品化

目标：

- 让 `project.vibe` 成为更明确的长期事实源。
- 引入 `factFiles` role/path/hash/schemaVersion/sourceOfTruth。
- 建立 file-backed readers 和 runtime-state rebuild。
- 防止 UI 从 runtimeState 回推事实。

改动边界：

- `src/core/projectVibeIo.ts`。
- `src/core/projectFactsIntegration.ts`。
- `src/core/projectFileCore.ts`。
- `src/core/runtimeTruthLayer.ts`。
- schema/test fixtures。

禁止事项：

- 不把 temp/candidate/failed/contact sheet 写成 reference authority。
- 不从 runtime-state 直接写 project facts。
- 不允许 provider log 直接进入 facts。
- 不做 schema 大爆炸；先兼容迁移。

subagent 写入范围建议：

- Worker A：schema/type and migration plan。
- Worker B：file-backed reader。
- Worker C：runtime-state rebuild command/test。
- Worker D：UI read path audit，确保 UI 不回推 facts。

验证命令：

- 最低：`npm run project-facts:test && npm run project-facts-integration:test`。
- 完整：`npm run project-file:test && npm run project-facts:test && npm run project-facts-integration:test && npm run runtime-truth-layer:test && npm run runtime-truth-integration:test && npm run minimal-runtime-projection:test`。

完成标准：

- 删除 `runtime-state.json` 后可以从 facts/ledger/receipts 重建 projection。
- `factFiles` 有 hash 和 schemaVersion。
- Asset Library 的 reference authority 只能来自 locked facts 或 external locked file。
- promotion 必须有 staged transaction receipt。

### P4. Subagent/Task Envelope 生产门禁

目标：

- 所有 image/asset/pair QA/scene QA/story audit 都必须走 envelope。
- worker 输出从自由文本变成可验证 receipt candidate。
- worker 不直接 provider submit，不直接 project fact promotion。

改动边界：

- `src/core/taskEnvelope.ts`。
- `src/core/subagentEnvelope.ts`。
- `src/core/subagentWorkerRuntime.ts`。
- `src/core/envelopeValidator.ts`。
- `src/core/providerExecutionPermissionGate.ts`。
- docs checklist。

禁止事项：

- 不允许 worker 根据口头说明直接写 `project.vibe`。
- 不允许 worker 调真实 provider。
- 不允许自由文本报告作为唯一产物。
- 不允许缺 input hash 的产物进入 promotion。

subagent 写入范围建议：

- Worker A：envelope schema hardening。
- Worker B：worker runtime output validation。
- Worker C：permission gate audit。
- Worker D：docs + examples。

验证命令：

- 最低：`npm run task-packet:test && npm run subagent-gate:test`。
- P0 新增脚本前完整 bootstrap：`npm run subagent-gate:test && npm run artifact-transaction:test && npm run provider-execution-permission-gate:test`。
- P0 新增脚本后完整：`npm run verify:subagent && npm run provider-execution-permission-gate:test && npm run artifact-transaction:test`。

完成标准：

- 每类 worker 都有 envelope example。
- worker output 缺 receipt fields 时测试失败。
- provider submit 必须有单独 permission receipt。
- 主 agent review checklist 可判断是否进入 staged transaction。

### P5. Preview/Export/Audio 最小可用链路

目标：

- 做出 Preview Player、asset package export、voice source/voice memory 的最小可用链路。
- 主界面只显示创作可理解状态，不展示 provider/gate 细节。

改动边界：

- `src/core/previewPlayerQueue.ts`。
- `src/core/previewExport.ts`。
- `src/core/exportBuilder.ts`。
- `src/core/exportWorker.ts`。
- `src/core/voiceSourceLibrary.ts`。
- `src/core/voiceAudioSettings.ts`。
- `src/ui/director/MinimalPreview.tsx`。
- Diagnostics 下 audio/export panel。

禁止事项：

- 不把 provider/gate/raw ledger 放回主界面。
- 不让 export package 接收未审查 candidate 作为 locked reference。
- 不把 voice temp file 直接写成 voice memory。
- 不承诺完整剪辑系统；只做 rough cut/package 最小闭环。

subagent 写入范围建议：

- Worker A：Preview Player state and queue。
- Worker B：asset package export。
- Worker C：voice source/voice memory minimal schema。
- Worker D：Diagnostics panel update。

验证命令：

- 最低：`npm run preview-player:test && npm run export-builder:test && npm run voice-source:test`。
- 完整：`npm run preview-player:test && npm run export-builder:test && npm run export-worker:test && npm run voice-source:test && npm run voice-audio-settings:test && npm run verify:ui`。
- 未来如果新增 `preview-export:test`，再把它接入完整链路；当前不要引用不存在的脚本。

完成标准：

- Preview 可以显示 rough cut 或明确 not ready 原因。
- Export package 只包含 locked/needs_review 明确分级资产。
- Voice source 有 source hash、role、receipt/status。
- 默认 UI 没有 provider implementation 细节。

### P6. 小批真实 Image2 闭环验证

目标：

- 在软件路径稳定后，逐级验证真实 Image2 闭环。
- 每一级都明确 provider submit permission、return ingest、review、promotion。

改动边界：

- 先不改核心逻辑，优先跑受控脚本和人工 review。
- 如发现缺口，只允许 worker 做最小修复。

禁止事项：

- 不一次跑大批量。
- 不把 provider submit 混进 execute-return。
- 不让 return ingest 自动 promotion。
- 不把失败图、contact sheet、临时图变 reference authority。

subagent 写入范围建议：

- Worker A：1 张真实 Image2 runbook。
- Worker B：3 张批次 readiness audit。
- Worker C：6-10 张前的 fixture isolation audit。
- Worker D：return ingest review report。

验证命令：

- 1 张：`npm run current-project-real-image2-readiness:test`，然后人工生成/确认 permission receipt，再人工触发真实 provider submit，外部结果落盘后执行 `npm run current-project-image2-return-executor:test`。
- 3 张：`npm run real-image2-batch-prepare-check:test && npm run current-project-image2-batch:test && npm run current-project-image2-closed-loop:test`，再手动 provider permission。
- 6-10 张：先跑 `npm run current-project-software-pressure:test`，再单独 permission。
- browser smoke：每一级 return ingest 后都要看 Preview/Asset Library/Diagnostics。

完成标准：

- provider submit 有单独 permission receipt，receipt 必须记录 permission receipt 路径、报告路径、input hash、output hash、provider request id 或明确 blocked reason。
- return ingest 后状态只到 `needs_review`。
- promotion 另开 staged transaction。
- 每一级都有 report，包含 input hash、provider request id、output hash、review status、blocked reasons。

Runbook 级别要求：

- 真实 submit 不能被任何 `verify:*` 脚本隐式触发，必须由人工在 P6 runbook 中显式确认。
- `real-provider-submit-permission:test` 只表示 permission receipt 生成/确认合同测试，不等于真实 provider submit。
- 每次真实 submit 前必须写明 permission receipt 路径、报告路径、输入 hash 字段、预期输出 hash 字段；回流后必须补 provider request id、实际 output hash、return ingest receipt。
- readiness、permission receipt、transport contract、return ingest fixture 全部通过，也只能说明软件链路就绪，不代表已经完成真实 provider submit。

## 4. 详细执行顺序：2-5 天一批

### Slice 1：P0 治理和脚本分层

Task 1. 新增 verify 分层命名
文件范围：`package.json`、`scripts/verify-runtime-fast.mjs`、`scripts/verify-round5.mjs`、`scripts/verify-provider-fast.mjs`，必要时 `scripts/verify-provider-full.mjs` 只作为 P6 runbook guard，不接入默认 verify。
测试：先按 1.5 bootstrap fallback dry-run 命令审查展开内容；实施 worker 完成后再跑新增的 `npm run verify:runtime-fast`。
风险：命令名看似新脚本，实际偷偷调用真实 provider。必须检查 `verify:provider-fast` 只覆盖 permission receipt、transport contract、adapter boundary、return ingest fixture，永不真实 submit。

Task 2. 整理 subagent verify
文件范围：`package.json`，必要时 `scripts/verify-subagent.mjs`。
测试：新增前用 `npm run subagent-gate:test && npm run artifact-transaction:test`；新增后用 `npm run verify:subagent`。
风险：把 provider permission gate 漏掉，导致 worker 越权无法被测出。

Task 3. Baseline capture checklist
文件范围：`docs/verification-checklists.md` 或独立 `docs/worker-baseline-capture.md`。
测试：文档 review，用一份 worker envelope dry-run 检查是否包含 `git status --short --branch`、当前 verify scripts、三大文件行数、dirty/untracked 清单。
风险：worker 继续依赖 `main ahead 33` 或旧行数快照，导致审计判断漂移。

Task 4. Fixture 并发纪律文档
文件范围：`docs/verification-checklists.md` 或独立 `docs/fixture-concurrency.md`。
测试：文档 review。
风险：多个 runtime API 测试共享同一 sandbox，导致偶发污染。

Task 5. Browser smoke checklist
文件范围：`docs/browser-smoke-checklist.md`。
测试：人工按清单跑一次。
风险：只看 build 通过，漏掉默认 UI 文案和 Preview 空白。

Task 6. Worker output receipt checklist
文件范围：`docs/worker-output-receipt-checklist.md`。
测试：拿一个现有 worker report 做 checklist dry-run。
风险：自由文本报告继续被当成可 promotion 事实。

### Slice 2：P1 UI 拆分第一批

Task 7. 串行抽 `DirectorMode + MinimalTopNav`
文件范围：`src/ui/director/DirectorMode.ts`、`src/ui/director/MinimalTopNav.tsx`、`src/App.tsx`、必要样式引用。
测试：`npm run minimal-ui:test && npm run build`，browser smoke top nav。
风险：mode 字符串改名导致旧状态或测试失配；把 Diagnostics 入口或 project selection 行为弄丢。此刀完成、验证、提交后再开下一刀。

Task 8. 抽 `MinimalDirectorStatusDot`
文件范围：`src/ui/director/MinimalDirectorStatusDot.tsx`、`src/App.tsx`、相关样式。
测试：`npm run minimal-ui:test && npm run build`。
风险：轻状态线变成工程状态墙。不得和 Task 7/9/10 并行修改 `App.tsx` 或 `styles.css`。

Task 9. 抽 `MinimalAssetLibrary`
文件范围：`src/ui/director/MinimalAssetLibrary.tsx`、`src/App.tsx`。
测试：`npm run minimal-ui:test && npm run current-project-ui-closed-loop:test && npm run build`。
风险：Asset Library 被做成图库，candidate/temp/failed 混成 reference。不得和 Task 7/8/10 并行修改 `App.tsx` 或 `styles.css`。

Task 10. Styles 第一批分块
文件范围：`src/styles.css`、可新增 `src/styles/director.css`、`src/styles/diagnostics.css`。
测试：`npm run minimal-ui:test && npm run build`，browser smoke。
风险：搬 class 时改变 cascade，导致移动端或 Preview 布局回归。必须等前三刀 UI 提交后再做。

### Slice 3：P2 Runtime Server 拆分第一批

Task 11. 只读 route map
文件范围：只读审计 `scripts/local-runtime-api-server.mjs`、`scripts/runtime-api-*.mjs`、相关 route tests。
测试：审计报告，不改代码。
风险：没有先画 route map 就抽模块，容易把 prepare/return/promotion 边界抽错。

Task 12. Extract strict-edit prepare route
文件范围：`scripts/local-runtime-api-server.mjs`、优先新增 `scripts/runtime-api-current-project-round5-strict-edit-prepare.mjs`、对应 test；保持和现有 runtime scripts 风格一致，不优先放到 `src/core/strictEditPrepareRuntime.ts`。
测试：`npm run runtime-api-current-project-round5-strict-edit-return:test && npm run runtime-api-boundary:test`。
风险：prepare 意外写 facts 或触发 provider。此刀完成、验证、提交后再开下一条 route。

Task 13. Extract real-chain status projection
文件范围：`scripts/local-runtime-api-server.mjs`、`src/core/projectRealChainStatus.ts` 或新 projection 模块。
测试：`npm run local-runtime-api:test && npm run runtime-api-workbench-projection:test`。
风险：status projection 变成事实写入入口。不得和其他 P2 task 并行修改 `scripts/local-runtime-api-server.mjs`。

Task 14. Extract image2 batch plan route
文件范围：`scripts/local-runtime-api-server.mjs`、`src/core/currentProjectImage2Batch.ts`、batch tests。
测试：`npm run current-project-image2-batch:test && npm run current-project-image2-batch-ledger:test`。
风险：batch plan 混入 submit/promotion。不得和其他 P2 task 并行修改 `scripts/local-runtime-api-server.mjs`。

Task 15. Isolate legacy 005 adapter
文件范围：`scripts/local-runtime-api-server.mjs`、`src/core/realDemoE2e005UiBridge.ts` 或 adapter 文件。
测试：`npm run real-demo-e2e-005:test && npm run local-runtime-api:test`。
风险：旧 demo path 继续影响新 route 命名和 facts 结构。不得和其他 P2 task 并行修改 `scripts/local-runtime-api-server.mjs`。

### Slice 4：P3 Facts 产品化

Task 16. 设计 `factFiles` schema 兼容迁移
文件范围：schema fixtures、`src/core/projectVibeIo.ts`、`src/core/types.ts`。
测试：`npm run project-facts:test && npm run project-file:test`。
风险：一次性 schema 迁移过大，破坏旧 project.vibe。

Task 17. File-backed reader
文件范围：`src/core/projectFileCore.ts`、`src/core/projectFactsIntegration.ts`。
测试：`npm run project-file:test && npm run project-facts-integration:test`。
风险：reader 默认信任任意文件路径，绕过 role/hash。

Task 18. Runtime-state rebuild
文件范围：`src/core/runtimeTruthLayer.ts`、`src/core/runtimeTruthIngest.ts`、scripts test。
测试：`npm run runtime-truth-layer:test && npm run runtime-truth-integration:test && npm run minimal-runtime-projection:test`。
风险：rebuild 时把 evidence 当 facts。

Task 19. UI facts read-path audit
文件范围：只读审计 `src/App.tsx`、`src/ui/director/*`、`src/core/minimalRuntimeProjection.ts`。
测试：审计报告 + `npm run minimal-ui:test`。
风险：UI 继续从 runtimeState 写回 facts。

### Slice 5：P4 Envelope 门禁

Task 20. Envelope schema hardening
文件范围：`src/core/taskEnvelope.ts`、`src/core/subagentEnvelope.ts`。
测试：`npm run task-packet:test`。
风险：schema 太松，worker 自由文本继续穿透。

Task 21. Worker output validation
文件范围：`src/core/subagentWorkerRuntime.ts`、`src/core/envelopeValidator.ts`。
测试：`npm run subagent-worker:test && npm run subagent-runtime-gate:test`。
风险：缺 input hash/output hash 仍被接受。

Task 22. Provider permission gate review
文件范围：`src/core/providerExecutionPermissionGate.ts`、`src/core/providerSubmitPermissionReceipt.ts`。
测试：`npm run provider-execution-permission-gate:test && npm run provider-submit-permission-receipt:test`。
风险：worker 能绕过主 agent permission。

### Slice 6：P5 Preview/Export/Audio

Task 23. Preview Player MVP
文件范围：`src/core/previewPlayerQueue.ts`、`src/ui/director/MinimalPreview.tsx`。
测试：`npm run preview-player:test && npm run verify:ui`。
风险：Preview 不空白但状态含工程细节。

Task 24. Asset package export MVP
文件范围：`src/core/exportBuilder.ts`、`src/core/exportWorker.ts`、Diagnostics export panel。
测试：`npm run export-builder:test && npm run export-worker:test`。
风险：export 把 temp/candidate 当 locked reference。

Task 25. Voice source/voice memory MVP
文件范围：`src/core/voiceSourceLibrary.ts`、`src/core/voiceAudioSettings.ts`、`src/ui/diagnostics/AudioDiagnosticsPanel.tsx`。
测试：`npm run voice-source:test && npm run voice-audio-settings:test`。
风险：voice temp file 没有 hash/receipt 就进入长期 memory。

### Slice 7：P6 小批真实 Image2

Task 26. 1 张真实闭环 runbook
文件范围：`docs/real-image2-runbook.md`、只读脚本审计。
测试：先 `npm run current-project-real-image2-readiness:test`，真实 submit 需单独 permission。
风险：把 readiness 通过误判为 provider 已可扩量。

Task 27. 3 张批次前置检查
文件范围：batch prepare/check 脚本和 report 模板。
测试：`npm run real-image2-batch-prepare-check:test && npm run current-project-image2-batch:test`。
风险：fixture 共享导致 return ingest 互相污染。

Task 28. 6-10 张扩量审计
文件范围：docs report + pressure test report。
测试：`npm run current-project-software-pressure:test`，真实 submit 另行审批。
风险：真实 provider 成本/失败模式过早放大。

## 5. 风险清单

UI 回归：

- 风险：拆 `App.tsx` 和 `styles.css` 时，默认 UI 重新出现工程术语或 Preview 空白。
- 控制：每个 UI slice 必跑 `minimal-ui:test`、`build` 和 browser smoke。

Provider 概念误判：

- 风险：把 `execute-return` 当作 provider submit，或把 return ingest 当作 promotion。
- 控制：API 命名、receipt 字段、测试断言三处同时区分 prepare/submit/return/promotion。

Fixture 并发污染：

- 风险：多个测试写同一 sandbox，造成偶发通过或偶发失败。
- 控制：每个测试使用独立 temp dir，verify 文档标记不可并行项。

`runtime-state.json` 反客为主：

- 风险：runtime projection 被 UI 或 runtime API 当成事实源。
- 控制：`project.vibe` + ledger + receipts 可重建 runtime-state；禁止 runtime-state 写回 facts。

资产库图库化：

- 风险：Asset Library 显示所有图片，candidate/temp/failed/contact sheet 混入 reference authority。
- 控制：UI 文案和数据模型区分 locked、needs_review、candidate、failed、temp。

Subagent 自由文本回潮：

- 风险：worker 只写自然语言报告，主 agent 难以审查和复用。
- 控制：所有 worker output 必须有 envelope id、input hash、output hash、receipt candidate。

真实 provider 扩量过快：

- 风险：软件压力测试稳定后直接跑大批真实 Image2。
- 控制：1 张、3 张、6-10 张逐级，每一级都要 permission receipt、return ingest report、人工 review。

## 6. 决策表

| 分类 | 决策 | 理由 |
| --- | --- | --- |
| 现在做 | P0 verify 分层 | 没有测试边界，后续 worker 会互相踩线。 |
| 现在做 | P1 默认 UI 小步拆分 | `App.tsx` 仍过大，且默认 UI 已有稳定 contract 可保护。 |
| 现在做 | P2 runtime route 继续拆 | runtime server 已降到 1671 行，适合继续去除残留投影。 |
| 现在做 | Browser smoke checklist | UI 拆分不能只靠 build。 |
| 现在做 | Worker receipt checklist | subagent 扩大后必须统一产物格式。 |
| 稍后做 | P3 完整 schema migration | 需要先稳定 verify 和 UI/runtime 边界。 |
| 稍后做 | P5 Preview/Export/Audio | 应在 facts 和 envelope 稳定后推进。 |
| 稍后做 | 3 张以上真实 Image2 | 需要 1 张闭环和 return ingest report 先通过。 |
| 明确不做 | 默认 UI 展示 raw provider/gate 细节 | 这会破坏 minimal director desk。 |
| 明确不做 | 把 `runtime-state.json` 当事实源 | 它是可删投影，不是授权事实。 |
| 明确不做 | worker 直接 provider submit | provider submit 必须由主 agent 审查并有 permission receipt。 |
| 明确不做 | return ingest 自动 promotion | 回流结果默认 `needs_review`。 |
| 明确不做 | Asset Library 做成文件夹图库 | 它是 reference/asset authority 工作区。 |

## 7. 验证矩阵

| 阶段 | 最低命令 | 完整命令 | Browser smoke | 不可并行 |
| --- | --- | --- | --- | --- |
| P0 | 新增前：按 1.5 `verify:runtime-fast` fallback + `verify:subagent` fallback；新增后：`npm run verify:runtime-fast && npm run verify:subagent` | 新增前：按 1.5 展开 `verify:runtime-fast`、`verify:round5`、`verify:subagent`、`verify:provider-fast`，再跑 `npm run verify:ui`；新增后：`npm run verify:runtime-fast && npm run verify:round5 && npm run verify:subagent && npm run verify:provider-fast && npm run verify:ui` | 否 | 写同一 fixture 的 verify 不可并行；`verify:provider-full` 不接入默认完整命令 |
| P1 | `npm run minimal-ui:test && npm run build` | `npm run verify:ui` | 是 | 不能并行开多个 worker 同时碰 `src/App.tsx` / `src/styles.css`；按 `DirectorMode + MinimalTopNav` -> `MinimalDirectorStatusDot` -> `MinimalAssetLibrary` -> styles 分块串行 |
| P2 | `npm run local-runtime-api:test && npm run runtime-api-boundary:test` | 新增前：按 1.5 `verify:runtime-fast` 和 `verify:round5` fallback；新增后：`npm run verify:runtime-fast && npm run verify:round5` | 视 route 是否影响 UI | 先只读 route map；不能并行开多个 worker 同时改 `scripts/local-runtime-api-server.mjs`；写 runtime-state / sandbox 的测试不可并行 |
| P3 | `npm run project-facts:test && npm run project-facts-integration:test` | `npm run project-file:test && npm run project-facts:test && npm run project-facts-integration:test && npm run runtime-truth-layer:test && npm run runtime-truth-integration:test && npm run minimal-runtime-projection:test` | 是，确认 UI 没从 projection 回推 facts | schema migration 和 rebuild 测试不可并行 |
| P4 | `npm run task-packet:test && npm run subagent-gate:test` | 新增前：`npm run subagent-gate:test && npm run artifact-transaction:test && npm run provider-execution-permission-gate:test`；新增后：`npm run verify:subagent && npm run provider-execution-permission-gate:test && npm run artifact-transaction:test` | 否 | worker ledger fixture 不可并行 |
| P5 | `npm run preview-player:test && npm run export-builder:test && npm run voice-source:test` | `npm run preview-player:test && npm run export-builder:test && npm run export-worker:test && npm run voice-source:test && npm run voice-audio-settings:test && npm run verify:ui`；未来新增 `preview-export:test` 后再接入 | 是 | Preview fixture 和 export package 写入不可并行 |
| P6 | `npm run current-project-real-image2-readiness:test` | 1 张、3 张、6-10 张逐级 runbook + permission receipt 路径 + 报告路径 + input/output hash + return ingest report；`real-provider-submit-permission:test` 只验证 permission receipt 合同 | 是 | 所有真实 provider submit 不可并行，且不能由 verify 脚本隐式触发 |

## 8. Subagent 执行协议

### 8.1 任务 envelope 模板

```md
# Worker Task Envelope

taskId:
phase:
owner:
repo:
branch:
allowedFiles:
forbiddenFiles:
goal:
nonGoals:
requiredContext:
inputArtifacts:
expectedOutputs:
requiredTests:
browserSmokeRequired:
providerPermissionAllowed: false
projectFactPromotionAllowed: false
fixturePolicy:
receiptFields:
  - envelopeId
  - inputHash
  - outputPaths
  - outputHashes
  - changedFiles
  - testsRun
  - blockedReasons
  - recommendedNextAction
```

### 8.2 禁止越权

- worker 不得修改 envelope 外的文件。
- worker 不得运行真实 provider submit，除非 envelope 明确 `providerPermissionAllowed: true` 且主 agent 已给 permission receipt。
- worker 不得写 `project.vibe` formal facts，除非任务就是 staged transaction implementation，且 promotion 仍由主 agent review。
- worker 不得把 logs/stdout 当作 project facts。
- worker 不得把 candidate/temp/failed/contact sheet 设为 reference authority。
- worker 不得用自由文本报告替代 structured receipt。

### 8.3 主 agent review checklist

主 agent 合并 worker 结果前必须检查：

- 是否只改 allowed files。
- 是否没有碰 forbidden files。
- 是否区分 prepare/submit/return/promotion。
- 是否没有 provider submit 越权。
- 是否没有 project fact promotion 越权。
- 是否有 input hash/output hash/receipt。
- 是否有测试命令和结果。
- 是否需要 browser smoke。
- 是否引入共享 fixture 写入。
- 是否把工程细节带回默认 UI。
- 是否把 candidate/temp/failed/contact sheet 提升为 authority。

### 8.4 Commit 粒度

- 每个 commit 对应一个 slice 或一个清晰 worker task。
- UI 拆分 commit 不混入 runtime route 改动。
- Runtime route commit 不混入 facts schema migration。
- Provider permission/return/promotion 相关 commit 必须在 message 中体现边界，例如 `prepare only`、`return ingest only`、`promotion gate`。
- 真实 provider runbook/report 可以单独 commit，不和代码修复混在一起。

## 9. 下一步推荐：先下三刀

第一刀：P0 verify 分层 scripts + checklist
原因：后续 worker 会并行进场，先把 `verify:runtime-fast`、`verify:round5`、`verify:subagent`、`verify:provider-fast/full` 的未来脚本、bootstrap fallback、baseline capture 和 fixture 纪律立住。`verify:provider-fast` 显式永不触发真实 provider submit；`verify:provider-full` 只作为 P6 runbook guard，不进入默认验证链。

第二刀：P1 只抽 `DirectorMode + MinimalTopNav`
原因：默认 UI contract 已经稳定，`App.tsx` 仍是最大结构风险。第一刀只碰 mode/top nav 和必要样式引用，不并行抽 Asset Library、status dot 或 styles 分块。

第三刀：P2 先做 strict-edit prepare extraction
原因：runtime server 已经降到 1671 行，适合继续把 prepare/return/promotion 边界从 route 里显性化。先完成只读 route map，再抽 strict-edit prepare；推荐目标文件保持现有 runtime scripts 风格，优先写成 `scripts/runtime-api-current-project-round5-strict-edit-prepare.mjs`，不是 `src/core/strictEditPrepareRuntime.ts`。

建议节奏：

1. 用 1 个 worker 做 P0 scripts，1 个 worker 做 P0 docs，主 agent review。
2. P0 过后开 P1 top nav/mode worker，同时另开只读 P2 route audit。
3. P1 第一批通过 browser smoke 后，再让 P2 worker 开始 strict-edit prepare extraction。
4. 每批 2-5 天，完成一个 slice 就提交，不把 UI、runtime、facts、provider 混成一个大改。

## 10. 审计者快速检查点

后续 subagent 或 reviewer 只需要先问这 8 个问题：

1. 这个改动属于 mock、dry-run、handoff ready、execute-return、provider submit、formal promotion 中哪一类？
2. 有没有把 `execute-return` 写成 provider submit？
3. 有没有从 `runtime-state.json` 写回 project facts？
4. 有没有让 candidate/temp/failed/contact sheet 成为 reference authority？
5. 默认 UI 有没有出现 provider/adapter/ledger/raw handoff 细节？
6. worker 是否有 envelope、input hash、output hash、receipt candidate？
7. 测试是否写共享 fixture，是否被错误并行？
8. 真实 provider 是否有独立 permission receipt，return 后是否只到 `needs_review`？

只要任何一项答不上来，就不能进入下一阶段。
