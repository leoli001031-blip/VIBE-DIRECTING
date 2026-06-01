# Historical Snapshot Notice

This `PLAN.md` is a 2026-05-13 historical planning snapshot. Keep it for
context, but do not use it as the current worker baseline or active deletion
plan without rechecking the active repo state.

Current baseline:

- `docs/mvp-integration-development-plan.md`
- `docs/mvp-delivery-technical-debt-plan.md`

---

# Vibe Directing — Agent 框架完整开发规划

日期：2026-05-13
工作空间：`/Users/lichenhao/Desktop/new vibe directing`
源项目：`/Users/lichenhao/Desktop/vibe core`

---

## 目录

1. [项目定位与目标](#1-项目定位与目标)
2. [当前架构深度分析](#2-当前架构深度分析)
3. [目标架构设计](#3-目标架构设计)
4. [文件处置矩阵](#4-文件处置矩阵)
5. [Phase 1：Agent Loop + 基础类型整理](#5-phase-1agent-loop--基础类型整理)
6. [Phase 2：合约层对接 + 拆分巨物文件](#6-phase-2合约层对接--拆分巨物文件)
7. [Phase 3：Gate 合并 + 重写 phaseRoadmapRuntime](#7-phase-3gate-合并--重写-phaseroapmapruntime)
8. [Phase 4：脚本现代化与测试精简](#8-phase-4脚本现代化与测试精简)
9. [Phase 5：废弃代码删除 + Schema 清理 + 集成测试](#9-phase-5废弃代码删除--schema-清理--集成测试)
10. [测试策略与验证门禁](#10-测试策略与验证门禁)
11. [风险登记册](#11-风险登记册)
12. [里程碑与时间线](#12-里程碑与时间线)

---

## 1. 项目定位与目标

### 1.1 是什么

一个**本地优先的 AI 视频导演工作台**。创作者面对 Story Flow、Visual Memory、自然语言导演输入和预览。系统底层由自有 Agent 框架驱动，调度 Image2 API 和即梦 CLI 完成图像和视频生成。

### 1.2 核心问题

vibe core 的**合约层（task envelope、provider gate、preflight、runtime truth、project transaction）已经搭好**，但 **Agent 执行层全部绑定在 Codex/Claude CLI 上**，且大部分处于 mock/dry-run 状态。

### 1.3 改造目标

| 维度 | 现状 | 目标 |
|------|------|------|
| Agent 执行 | Codex CLI spawn（mock） | 自有 Agent Loop，直接调 LLM API |
| LLM Provider | Claude-only（Codex 中转） | Multi-provider（Vercel AI SDK） |
| Image2 | Codex app server 中转 | HTTP API 直连 |
| 即梦 | Codex CLI 中转 | spawn 子进程直接调 CLI |
| Provider Gate | 4 层分散 gate | 1 层统一 providerGate |
| 代码量 | core 61k + schemas 21k + scripts 67k | core ~42k + schemas 0 + scripts ~45k |
| HardLocks | 39 个独立接口（31 文件） | 1 个 BaseHardLocks + extends |
| 脚本执行 | 75 个用内联 TS 转译 | 全部改用 tsx |

---

## 2. 当前架构深度分析

### 2.1 代码规模

```
src/core/         95 文件   61,329 行
schemas/         101 文件   21,224 行
scripts/         175 文件   67,744 行
src/App.tsx         1 文件    9,288 行
src/ui/             7 目录       --
TOTAL                     ~150,000 行
```

### 2.2 最大文件 Top 10

| 文件 | 行数 | 臃肿程度 |
|------|------|---------|
| `phaseRoadmapRuntime.ts` | 5,045 | **85% 冗余** — 23 个相同模式的 decision 函数 |
| `types.ts` | 2,884 | 100% 类型，251 个 export，8 个重复 HardLocks |
| `visualConsistency.ts` | 1,956 | 30% 类型，重叠 gate 类型 |
| `projectTransaction.ts` | 1,930 | 57% 类型，多组重叠 summary |
| `projectRealChainStatus.ts` | 1,799 | 含 Codex 特定字段 |
| `taskPacketBuilder.ts` | 1,640 | 知识路由+provider 注入 |
| `imageKeyframeRuntime.ts` | 1,469 | 关键帧逻辑 |
| `projectStateBuilder.ts` | 1,465 | 合理——组装器 |
| `localOrchestrator.ts` | 1,097 | 含 CodexActivityState |
| `import-runtime-test.mjs` | 7,798 | **最冗余测试** — 内联 TS 转译 |

### 2.3 跨文件冗余模式

**HardLocks 泛滥：** 39 个 HardLocks 接口在 31 个文件中，每个重复相同的 8-10 个字段。

**dryRunOnly / liveSubmitAllowed 重复：** 在 65 个文件中出现 ~2,400 次，但它们是全局不变量。

**手写 Schema：** 101 个 JSON schema 与 TS 类型 1:1 镜像，双维护负担。

**脚本内联转译：** 75 个脚本用 `typescript.transpileModule` 手动转译 TS 文件。

---

## 3. 目标架构设计

```
┌─────────────────────────────────────────────────┐
│               UI Layer (保留不动)                │
│  Story Flow │ Asset Library │ Agent Panel       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         Agent Loop (PHASE 1 — NEW)              │
│  agentLoop → LLMProvider → ToolRegistry         │
│  Tools: image2, jimeng, file, shell             │
│  Session: context, compaction, checkpoint       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│        Task Layer (KEEP — Phase 2 对接)         │
│  taskEnvelope → taskPacketBuilder → taskQueue   │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│     Provider Gate (PHASE 3 — MERGED)            │
│  planned → readiness → permission → handoff     │
│  → submit → return_ingest → QA → promotion      │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│   Provider Executor (PHASE 3 — MERGED)          │
│  image2 → Image2 API / jimeng → shell spawn     │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│    Runtime Truth + Project Facts (KEEP)         │
└─────────────────────────────────────────────────┘
```

---

## 4. 文件处置矩阵

### 4.1 新建文件（Phase 1）

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/agent/agentLoop.ts` | ~400 | Agent 核心循环 |
| `src/agent/llmProvider.ts` | ~200 | LLM provider 抽象（Vercel AI SDK） |
| `src/agent/toolRegistry.ts` | ~250 | 工具注册与分发 |
| `src/agent/sessionManager.ts` | ~300 | 会话管理 + context compaction |
| `src/agent/image2Tool.ts` | ~200 | Image2 API 工具 |
| `src/agent/jimengTool.ts` | ~200 | 即梦 CLI 工具 |
| `src/agent/fileTools.ts` | ~150 | 文件系统工具 |
| `src/agent/shellTool.ts` | ~120 | Shell 执行工具 |
| `src/agent/index.ts` | ~30 | 统一导出 |
| `src/core/types/base.ts` | ~200 | 基础类型（拆自 types.ts） |
| `src/core/types/provider.ts` | ~400 | Provider 类型（拆自 types.ts） |
| `src/core/types/runtime.ts` | ~350 | Runtime 类型（拆自 types.ts） |
| `src/core/types/task.ts` | ~500 | Task 类型（拆自 types.ts） |
| `src/core/types/qa.ts` | ~400 | QA 类型（拆自 types.ts） |
| `src/core/providerGate.ts` | ~1,500 | 合并 5 个 gate 文件 |
| `src/core/providerExecutor.ts` | ~1,200 | 合并 realPilot+executor+oneShot |
| `src/core/agentRuntime.ts` | ~500 | 合并 subagent runner/gate/worker |

### 4.2 删除/迁移文件

**14 个删除（Phase 5）：**
`agentCliMockRunner.ts`(17k) · `codexCliAdapterSpike.ts`(18k) · `codexWorkerRuntimeGate.ts`(19k) · `codexAppServerAdapter.ts`(15k) · `codexAppServerImage2EditAdapter.ts`(19k) · `providerLiveGate.ts`(24k) · `providerExecutionPermissionGate.ts`(13k) · `providerClosedLoopShell.ts`(32k) · `realExecutionGate.ts`(20k) · `providerHandoffStatus.ts`(13k) · `realProviderPilot.ts`(31k) · `subagentRunner.ts`(21k) · `subagentRuntimeGate.ts`(20k) · `subagentWorkerRuntime.ts`(15k)

**schemas/ → schemas.legacy/（Phase 5）：** 101 个手写 JSON schema（21,224 行）

### 4.3 修改文件统计

| Phase | 新建 | 修改 | 删除 | 净变化 |
|-------|------|------|------|--------|
| Phase 1 | +1,850 | ~31 文件改 HardLocks | 0 | +1,850 |
| Phase 2 | +1,850 | ~8 文件对接 | 0 | +1,850 |
| Phase 3 | +3,200 | ~5 文件简化 | 0 | +3,200 |
| Phase 4 | 0 | ~75 脚本改 tsx | 0 | -16,000 |
| Phase 5 | 0 | ~3 文件更新文档 | -14 文件, -21k schemas | -302,000 |
| **总计** | **+6,900** | | **-323,000** | **~87,000 行** |

---

## 5. Phase 1：Agent Loop + 基础类型整理

**目标：** 新建 Agent 框架核心 + 合并 HardLocks + 引入运行时策略常量

### 5.1 Agent 框架核心（9 个新 Task）

#### Task 1.1-1.8: 实现 src/agent/ 目录

核心接口：

```typescript
// agentLoop(config, taskEnvelope) → AgentResult
// while (step < maxSteps) { llm.call() → tools.dispatch() → loop }
// hooks: onStepStart, onStepFinish, onToolCall, onBlocked, onError
```

- `agentLoop.ts` — 核心循环（`agentLoop()`, `agentStep()`, `createAgentState()`）
- `llmProvider.ts` — 基于 Vercel AI SDK 的 `generateText` 封装
- `toolRegistry.ts` — `register()` + `getToolSet()` + `dispatch()`
- `sessionManager.ts` — Context window 管理 + compaction + checkpoint
- `image2Tool.ts` — HTTP API 直连 Image2（不经过 Codex）
- `jimengTool.ts` — `spawn` 即梦 CLI 子进程
- `fileTools.ts` — 文件系统操作（路径逃逸防护）
- `shellTool.ts` — 白名单 shell 执行

#### Task 1.9: Phase 1 集成测试

Mock LLM + 真实 file tools → 模拟"生成一张图"任务闭环

### 5.2 基础类型精简

#### Task 1.10: 合并 39 个 HardLocks → `BaseHardLocks`

在 `types.ts` 中定义一次，31 个文件改为 `extends BaseHardLocks`，只声明特有字段。

```typescript
// 定义一次
export interface BaseHardLocks {
  dryRunOnly: true; liveSubmitAllowed: false;
  providerSubmissionForbidden: true; noFileMutation: true;
  noCredentialRead: true; noCredentialWrite: true;
  noShellExecution: true; noWorkerSpawn: true;
}
// 各模块只写特有字段
export interface RealProviderExecutorHardLocks extends BaseHardLocks {
  noPlanWithoutAssetLock: true;
}
```

#### Task 1.11: 引入 `RUNTIME_POLICY` 常量

```typescript
export const RUNTIME_POLICY = { dryRunOnly: true, liveSubmitAllowed: false } as const;
```

State builder 引用常量而非写死字面量。消除 ~4,800 行重复断言。

#### Task 1.12: 从 BaseHardLocks 移除 `dryRunOnly` / `liveSubmitAllowed`

它们现在是全局常量，不需要在每个 HardLocks 中存储。

### 5.3 完成标准
- 9 个 agent test 通过
- `npx tsc --noEmit` + `npm run build` 通过
- Agent loop 跑通最小闭环
- 39 个 HardLocks 全部 extends BaseHardLocks
- RUNTIME_POLICY 已生效

---

## 6. Phase 2：合约层对接 + 拆分巨物文件

**前置：** Phase 1 全部通过

### 6.1 合约层对接

#### Task 2.1-2.6: 对接 Agent Loop 到 workflow

- `directorWorkflow.ts` — 替换 Codex 引用为 Agent Loop 调用
- `localOrchestrator.ts` — 替换 CodexActivityState 为 AgentActivityState
- `agentRuntime.ts`（新建） — 合并 subagent runner/gate/worker 保留逻辑
- `runtimeTruthLayer.ts` — 合并 ingest + receipts
- `projectRealChainStatus.ts` — 标记 Codex 字段 @deprecated
- `App.tsx` — 替换 import 路径

### 6.2 巨物文件拆分

#### Task 2.7: 拆分 `types.ts`（2,884 行 → 5 个领域文件）

```
src/core/types/
├── index.ts          # barrel export
├── base.ts           # Severity, GateStatus, BaseHardLocks, RUNTIME_POLICY
├── provider.ts       # ProviderSlot, RequiredMode, etc.
├── runtime.ts        # RuntimePlatform, RuntimeToolKind, etc.
├── task.ts           # TaskEnvelope, SubagentTaskEnvelope, etc.
└── qa.ts             # QaHarness, GenerationHarness, etc.
```

原 `types.ts` 保留为 `export * from "./types"` 兼容旧 import。

#### Task 2.8: 合并 `projectTransaction.ts` 重叠类型（1,930 → ~1,300 行）

泛型 summary 包装器 + 3 个 commit 函数合并为 1 个 pipeline。

### 6.3 完成标准
- `verify:ui` + `verify:runtime-fast` 通过
- `npx tsc --noEmit` 全项目通过
- directorWorkflow 通过 Agent Loop 创建 task packet
- types.ts 拆分为 5 个领域文件，旧 import 全部兼容

---

## 7. Phase 3：Gate 合并 + 重写 phaseRoadmapRuntime

**前置：** Phase 2 全部通过

### 7.1 Gate 层合并

#### Task 3.1-3.4: 新建 providerGate.ts + providerExecutor.ts

**合并图：**
```
providerLiveGate.ts ─────────┐
providerExecutionPermissionGate ─┤
providerClosedLoopShell.ts ──┼──→ providerGate.ts (统一生命周期)
realExecutionGate.ts ────────┤
providerHandoffStatus.ts ────┘

realProviderPilot.ts ────────┐
realProviderExecutor.ts ─────┼──→ providerExecutor.ts
realProviderOneShot.ts ──────┘
```

统一生命周期：`planned → readiness → permission → handoff → submit → return_ingest → QA → promotion`

#### Task 3.5: 重写 `phaseRoadmapRuntime.ts`（5,045 → ~1,500 行）

**问题：** 18 个 per-phase evidence interface + 23 个完全相同的 decision 函数 = 85% 冗余

**方案：** Table-Driven
```typescript
const PHASE_CHECKS: Record<PhaseId, EvidenceCheck[]> = {
  phase_24: [{ check: "typedEvidencePresent", source: "subagentRuntimeGate" }],
  // 每个 phase 3-5 行配置
};
function resolvePhase(phaseId, evidence) { /* 1 个通用函数 */ }
```

### 7.2 完成标准
- `verify:provider-fast` + `verify:provider-contracts` 通过
- 新 providerGate 走通完整生命周期
- phaseRoadmapRuntime 行为与旧版等价，test 通过

---

## 8. Phase 4：脚本现代化与测试精简

**前置：** Phase 3 全部通过

### 8.1 脚本 tsx 迁移

**问题：** 75 个脚本用 `typescript.transpileModule` 内联转译 TS 文件。每个有 ~25-50 行 boilerplate。

**方案：**
1. 所有 test scripts 从 `node scripts/xxx.mjs` → `tsx scripts/xxx.mjs`
2. 删除内联 transpile boilerplate，替换为正常 ES import
3. 删除脚本中内联的重复数据构造

**重点精简：**

| 脚本 | 当前 | 目标 | 节省 |
|------|------|------|------|
| `import-runtime-test.mjs` | 7,798 | ~1,500 | 6,298 |
| `phase-roadmap-runtime-test.mjs` | 4,126 | ~1,200 | 2,926 |
| `minimal-ui-contract-test.mjs` | 1,344 | ~800 | 544 |
| 其余 72 个 | ~20,000 | ~14,000 | 6,000 |

### 8.2 完成标准
- 所有 175 个 scripts 改用 tsx
- 75 个内联转译脚本已清理
- `verify:all` 通过
- 脚本层净减少 ~16,000 行

---

## 9. Phase 5：废弃代码删除 + Schema 清理 + 集成测试

**前置：** Phase 4 全部通过

### 9.1 废弃文件删除

**Task 5.1:** 检查 14 个废弃文件的隐式依赖
**Task 5.2:** 迁移剩余引用 → 逐个删除 → 每删一个跑 build
**Task 5.3:** 清理 package.json 中引用废弃文件的 test scripts

### 9.2 Schema 目录迁移

**Task 5.4:** `schemas/` → `schemas.legacy/`
- 当前是 TS 单体，无跨语言消费者
- 需要 JSON schema 时用 `ts-json-schema-generator` 按需生成

### 9.3 端到端测试

**Task 5.5:** Dry-run pipeline test
**Task 5.6:** 真实链路（手动触发）— 1 张 Image2 图 + 1 个即梦视频

### 9.4 文档更新

**Task 5.7:** 更新 AGENT.md、README.md 反映新架构

### 9.5 完成标准
- 14 个废弃文件已删除
- schemas/ 已迁移到 legacy
- `verify:all` 通过
- 端到端 pipeline 测试通过
- 真实链路手动验证通过
- **最终代码规模：~87,000 行（从 ~150,000 行精简 42%）**

---

## 10. 测试策略与验证门禁

### 10.1 测试金字塔

```
       E2E Tests      1 个 (pipeline) + 手动真实链路
     Integration       3 个 (agent+task / agent+provider / agent+truth)
   Unit Tests          9 个 (每个新文件的独立测试)
Existing verify:*      保留现有验证门禁
```

### 10.2 每 Phase 门禁

| Phase | 门禁 |
|-------|------|
| Phase 1 | `npx tsc --noEmit` + 9 个新 test + `npm run build` |
| Phase 2 | `verify:ui` + `verify:runtime-fast` |
| Phase 3 | `verify:provider-fast` + `verify:provider-contracts` |
| Phase 4 | `verify:all` |
| Phase 5 | `verify:all` + E2E test + 真实链路手动验证 |

### 10.3 回滚策略

每个 Phase 一个独立 commit。Phase N 失败 → `git checkout HEAD~1` → 分析 → 修复 → 重试。

---

## 11. 风险登记册

| # | 风险 | 概率 | 影响 | 缓解 |
|---|------|------|------|------|
| R1 | types.ts 拆分导致 UI 编译错误 | 高 | 中 | 保留 barrel export，Phase 2 只做文件拆分不改结构 |
| R2 | taskPacketBuilder 与 knowledge 层耦合 | 中 | 高 | 本次不动 taskPacketBuilder |
| R3 | projectRealChainStatus Codex 字段清理破坏 UI | 中 | 高 | 只标记 @deprecated，不删除字段 |
| R4 | 合并 provider gate 遗漏边缘逻辑 | 中 | 中 | 先做 1:1 逻辑映射表 |
| R5 | 新 agent loop 在真实 LLM 下与 mock 行为差异 | 中 | 高 | Phase 1 就有真实 LLM 测试 |
| R6 | 即梦 CLI 接口不稳定 | 高 | 低 | 独立 input schema |
| R7 | 75 个脚本改 tsx 导致路径/import 错误 | 中 | 中 | 分批迁移，每批 run test 验证 |
| R8 | schemas 移除影响未发现的消费者 | 低 | 中 | 先 move 到 legacy，不删除 |

---

## 12. 里程碑与时间线

| 里程碑 | Phase | 交付物 | 验收标准 |
|--------|-------|--------|---------|
| M0 | Prep | node_modules + build | 基础构建零错误 |
| M1 | Phase 1 | 9 新文件 + 31 文件改 HardLocks + RUNTIME_POLICY | Agent loop 闭环 + 类型基础整理 |
| M2 | Phase 2 | 6 修改 + 1 新建 + types 拆分 | verify:ui + verify:runtime-fast |
| M3 | Phase 3 | 2 新文件 + 3 修改 + phaseRoadmap 重写 | verify:provider-fast |
| M4 | Phase 4 | 75 个脚本 tsx 迁移 | verify:all + -16k 行 |
| M5 | Phase 5 | 14 文件删除 + schemas 迁移 + E2E | 最终 ~87k 行 + 真实链路 |

```
Phase 1        Phase 2        Phase 3        Phase 4        Phase 5
Agent Loop     Contract+Types  Gate+           Scripts        Cleanup
+BaseHards     +Split         +Roadmap        Modernize      +E2E
```

---

## 附录：废弃文件迁移对照

| 删除文件 | 迁移至 |
|---------|--------|
| agentCliMockRunner.ts | agentLoop.ts (mock mode) |
| codexCliAdapterSpike.ts | 直接 HTTP API（不需要 adapter） |
| codexWorkerRuntimeGate.ts | agentRuntime.ts |
| codexAppServerAdapter.ts | 直接 LLM API（不需要 app server） |
| codexAppServerImage2EditAdapter.ts | image2Tool.ts |
| providerLiveGate.ts | providerGate.ts (readiness 阶段) |
| providerExecutionPermissionGate.ts | providerGate.ts (permission 阶段) |
| providerClosedLoopShell.ts | providerGate.ts (handoff→QA→promotion 阶段) |
| realExecutionGate.ts | providerGate.ts (submit 阶段) |
| providerHandoffStatus.ts | providerGate.ts (handoff 阶段) |
| realProviderPilot.ts | providerExecutor.ts |
| subagentRunner.ts | agentRuntime.ts |
| subagentRuntimeGate.ts | agentRuntime.ts |
| subagentWorkerRuntime.ts | agentRuntime.ts |
