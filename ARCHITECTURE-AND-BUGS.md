# Vibe Director Studio — 完整架构 + 功能 Bug 梳理

## 一、软件完整逻辑

### 1. 五层数据模型

```
Layer 1: ProjectVibeDocument (project.vibe, JSON 文件, ~320 行类型定义)
    ├── manifest: projectId, title, version, timestamps
    ├── storyFlow: sections[], shotOrder[]
    ├── visualMemory: entries[] (角色/场景/道具/风格的锁定引用)
    ├── shots[]: 每个镜头的完整导演数据 (25 个字段)
    ├── assets[]: 参考资产 (角色/场景/道具/风格/引用)
    ├── runs[]: 运行收据 (agent_loop/patch/provider/qa/export)
    ├── receipts: 收据分类账 (script/promptKeyframe/batch/review)
    └── sourceIndex: 所有引用的索引汇总

Layer 2: ProjectVibePlanningProjection (派生层, projectVibePlanningProjection.ts)
    Shot + ShotRecord + GenerationJob + KeyframePairDerivation
    桥接 ProjectVibe ↔ RuntimeState

Layer 3: ProjectRuntimeState (运行时状态, projectVibeRuntimeState.ts → core/projectState.ts)
    完整运行时视图: audit + storyFlow + assetLibrary + shots + jobs + pairs

Layer 4: ProjectStoreSnapshot (缓存层, projectStoreIo.ts)
    snapshot + runtimeCachePolicy + factFiles
    用于高效的 save/load gate

Layer 5: UI State (App.tsx, ~23 个 useState)
    视图状态 + 编辑状态 + 选择状态 + 导出状态
```

### 2. 核心数据流

```
用户输入 (NewVideoStart.tsx)
    │
    ├──→ 1. Director Session (directorSession.ts)
    │       └──→ Script Planner (scriptPlanner.ts)
    │           └──→ Storyboard Planner (directorAiStoryboardPlanner.ts)
    │               └──→ Rhythm Planner (directorRhythmPlanner.ts)
    │                   └──→ Production Skill (directorProductionSkill.ts)
    │
    ├──→ 2. ProjectVibeDocument 构建 (newVideoProjectVibePlanner.ts)
    │       └──→ buildNewVideoProjectVibeStagedTransaction()
    │           └──→ applyProjectVibeTransaction() → writes project.vibe
    │
    ├──→ 3. Runtime State 重建 (projectVibeRuntimeState.ts)
    │       └──→ projectVibeToProjectAudit()
    │           └──→ buildProjectVibePlanningProjection()
    │               └──→ buildProjectRuntimeState()
    │
    ├──→ 4. Agent Loop 资源生成 (agentLoop.ts/ownedAgentLoop.ts)
    │       └──→ Jimeng Tool → Image2 Tool → Web Search → File I/O
    │           └──→ Tool dispatch 并行执行所有 tool calls
    │
    ├──→ 5. Provider 提交 (runtime API routes)
    │       ├──→ Image2: runtime-api-current-project-image2-assets-generate.mts
    │       └──→ Seedance: current-project-seedance-submit.mts
    │           └──→ dreamina multimodal2video CLI
    │
    └──→ 6. 导出管线
            └──→ exportBuilder.ts → finalVideoRender.ts
                └──→ ffmpeg concat + audio mix → .mp4
```

### 3. 三大参考策略的选择流

```
directorProductionSkill.selectStrategy()  ← 输入: actionBeats, rhythmProfile, executionMode 等
    │
    ├── storyboard_narrative → 生成干净叙事分镜 → Seedance compilerProfile: "storyboard_narrative"
    ├── storyboard_rapid_cut  → 生成带颜色标注 previs 分镜 → Seedance compilerProfile: "storyboard_rapid_cut"
    └── omni_reference        → 不生成分镜 → Seedance compilerProfile: "omni_reference"
```

### 4. 串行队列架构 (runtime server)

```
全局 running flag (boolean, 非 mutex)
    ├── Seedance submit  ─┐
    ├── TTS              ─┼── 所有这些操作共享同一个 running flag
    └── 005 verify       ─┘   任一操作 running=true → 所有其他操作被阻塞
                                (即使它们之间毫无关系)
```

---

## 二、按数据流分层发现的 Bug

### A. ProjectVibeShot → ShotRecord 转换层 (数据完整性)

**A1 [P0]: `shotRecordFromSource()` 丢失 15+ 个关键字段**

`projectVibePlanningProjection.ts:92-126`

```typescript
function shotRecordFromSource(source: ProjectionShotSource): ShotRecord {
  return {
    id: source.shot.id,
    actId: actIdForSequence(...),
    sectionId: source.shot.sectionId,
    title: source.shot.title,
    storyFunction: source.shot.intent || ...,
    narrationText: source.shot.narrationText,
    dialogueLines: source.shot.dialogueLines,
    subtitle: source.shot.subtitle,
    sound: source.shot.sound,
    audioUsage: source.shot.audioUsage,
    videoControlMode,
    startFrame,
    status: plannedShotStatus(source.shot),
    gates: { ... },
    issues: [ ... ],
    // 以下字段全部缺失:
    // camera, executionMode, rhythmProfile, splitPolicy,
    // actionBeats, primaryAction, actionTrigger, microReaction,
    // seedanceDirection, directorFeedbackDirectives,
    // characterGuidance, sceneGuidance, propGuidance,
    // durationSeconds, sourceRefs
  };
}
```

影响：任何依赖 ShotRecord 的代码（视频 preflight、导出、preview）看不到导演决策数据。

**A2 [P1]: `referenceStrategy` 不持久化到 ProjectVibeShot**

`project/types.ts:95-125` — `ProjectVibeShot` 类型没有 `referenceStrategy` 字段。策略降级为中文文本塞进 `directorFeedbackDirectives`。重开项目后需重新计算策略，结果可能因浮点数精度、字段微小变化而漂移。

**A3 [P1]: sourceIndex 每次保存完全重建**

`projectVibe.ts:688-691` — `refreshProjectVibeSourceIndex()` 从零重建并 sort 所有数组。原始顺序丢失。

---

### B. App.tsx 状态管理层 (并发/一致性)

**B1 [P0]: 6 个异步 handler 使用闭包捕获的 `prototypeProjectVibe` → 静默数据丢失**

位置: `App.tsx` lines 2040, 2522, 2648, 2755, 2924, 3040

所有异步函数通过闭包读取 `useState` 的值。快速连续两次操作 → 两个 handler 读到同一份旧 state → 第二个覆盖第一个。

```
handler1 读到 state v1 → 生成 tx_A
handler2 读到 state v1 → 生成 tx_B  (应该读到 v1+tx_A!)
setState(v1 + tx_A) → state = v2
setState(v1 + tx_B) → state = v3  ← tx_A 的修改被覆盖
```

**B2 [P0]: 打开无 project.vibe 的目录 → 不可恢复空白 UI**

`App.tsx:3113-3157` — state 在 async 调用**之前**被清空。如果 `connectCurrentProject` 失败，UI 空白且前一个项目丢失。

**B3 [P0]: useEffect 项目初始化竞态**

`App.tsx:2185-2292` — 依赖 `workbenchRuntimeState` 的 effect 频繁重执行。两轮 `openOrInitializeProjectDraft()` 并发运行，同时读到空 project.vibe → 两轮都初始化 → 覆盖。

---

### C. Runtime Server 层 (进程/安全/稳定性)

**C1 [P0]: 无 uncaughtException/unhandledRejection handler → 静默崩溃**

`electron-runtime/local-runtime-api-server.mjs` (29,523行) 没有任何全局异常处理器。唯一 process 事件是 SIGINT/SIGTERM。任何未捕获异常 → 整个 runtime server 进程崩溃 → 所有 provider/file/credential 功能全断。

**C2 [P0]: Seedance 路径 running flag 可能永久 stuck**

Seedance submit handler 中的 `setRunning(false)` 不在 `finally` 块。若异常在 try/catch 之外抛出 → `running` 永久 true → 所有后续操作被阻塞。

**C3 [P0]: Seedance TOCTOU 竞态 → maxConcurrentVideoJobs: 1 可被绕过**

`runtimeState()` check 和 `setRunning(true)` 之间不是原子操作。两个请求在 event loop yield 时可能同时通过检查。

**C4 [P0]: 5 条 route handler 无 try/catch + readRequestJsonBody 无超时**

`credentials.mts`, `agent-web-search.mts`, `director-storyboard-plan.mts`, `local-index-tts.mts`, `local-qwen3-tts-clone.mts` — 恶意/慢速 client 不发送 body → `readRequestJsonBody` 永久挂起 → 阻塞所有其他请求。

**C5 [P1]: running flag 序列化无关操作**

Seedance、TTS、005 verify 共享同一个 `running` flag。一个 TTS 任务会阻塞所有视频提交——它们完全无关。

**C6 [P1]: Seedance CLI path 来自用户输入**

`cliPath` 来自请求 body 中用户提供的字段。可执行任意二进制。

**C7 [P1]: SIGTERM 无 SIGKILL 回退**

Seedance/TTS/verify 子进程只收 SIGTERM。忽略 SIGTERM → 永久运行 → running flag stuck。

---

### D. 导出管线层

**D1 [P1]: ffmpeg timeout 只 SIGTERM，无 SIGKILL**

`finalVideoRender.ts:216-221` — 只发送 SIGTERM。ffmpeg 编码时常忽略 SIGTERM → 进程泄露 → Promise 永不 resolve。

**D2 [P1]: sha256File 读整个视频进内存**

`finalVideoRender.ts:82` — `readFileSync(filePath)` 读整个视频文件。2GB 视频 → OOM。

**D3 [P1]: 导出无取消机制**

`runFinalVideoRenderPlan()` 使用 `spawn` 启动 ffmpeg，无 AbortController 传入。唯一停止方式是杀 Electron 进程。

**D4 [P1]: 导出无进度报告**

`executeExportWorkerPlan()` 依次执行条目，无任何事件/callback/进度通知。UI 上看不到任何进度。

**D5 [P1]: 导出失败条目无重试**

错误被收集到数组中但不会自动重试。

---

### E. Agent Loop 层

**E1 [P0]: 所有工具调用在生产环境中自动批准**

`agentLoop.ts:228-237` — `requestApproval()` 默认实现只 `console.warn`，始终返回所有 tool calls。Agent 可以: spawn 进程、写文件、调用 provider、执行任意 CLI 命令。

**E2 [P1]: Agent 状态无持久化**

无 `save()`/`load()`。crash/重载 → 所有 messages/traces/results 丢失。

**E3 [P1]: Context compaction 丢弃消息不做摘要**

`sessionManager.ts:136-143` — naive sliding window，直接丢弃最旧消息。丢失的上下文不可恢复。

---

### F. project.vibe 读写层

**F1 [P1]: projectReadyForNewStory() 销毁所有现有内容**

`newVideoProjectVibePlanner.ts:183-204` — 每次新故事创建会清空 `shots[]`、`storyFlow.sections[]`、`shotOrder[]`。不能增量添加。

**F2 [P1]: applyProjectVibeTransaction validation 失败时 caller 可能不检查 receipt.status**

`projectVibe.ts:212-258` — 返回 `{ project: 原始project, receipt: { status: "rejected" } }`。如果 caller 直接使用返回的 project 且不检查 receipt，会继续使用旧状态但认为是新状态。

**F3 [P2]: saveProjectVibe 目录创建和写文件不是原子操作**

两个并发 save（auto-save + manual save）可能竞态。后写覆盖先写。

**F4 [P1]: projectVibeToProjectAudit 不验证字段存在性**

`projectVibeRuntimeState.ts:132-176` — 如果 `project.shots`/`project.assets`/`project.storyFlow.sections` 缺失（损坏 JSON），直接 TypeError crash。

---

### G. Electron/安全层

**G1 [P0]: projectRootScope 永不 forget → 跨项目文件访问**

`electron/projectScope.mts` — 只有 `rememberProjectRoot()`，没有 `forgetProjectRoot()`。忘记项目 A → 打开项目 B → sandbox IPC 仍可读写 A 的文件。

**G2 [P0]: spawnAllowed 允许 node 零参数 → REPL 进程泄露**

`electron/projectScope.mts:40` — `args.length === 0` 的 case 允许启动永不退出的 Node.js REPL。

**G3 [P1]: waitForRuntimeStatus fetch 无单次超时**

`electron/main.mts:380` — 外层循环 15s，但单次 `fetch()` 无 `AbortSignal.timeout()`。服务器挂起连接 → fetch 永不返回 → 循环检查失效。

---

### H. UI/React 层

**H1 [P0]: 8 处 unhandled Promise rejection**

`useCurrentProjectRuntimePanels.ts:84,90,93,129,132,135` + `SettingsShell.tsx:157` + `sandboxWatcherNode.ts:47` — `.then()` 无 `.catch()`。初始化失败 → 静默不工作。

**H2 [P0]: JSON.parse LLM output 无 try/catch**

`directorAiStoryboardPlanner.ts:143` — `extractJsonObject()` 直接 `JSON.parse(source.slice(start, end + 1))`，无 try/catch。LLM 输出异常 → 整个 storyboard planning 崩溃。

**H3 [P1]: forgetProjectFileRoot 遗漏 6+ 个 state 重置**

`App.tsx:3254-3271` — `animationKey`、`exportActionState`、`realImage2Gate`、`agentWebSearchSettings`、`projectLocalKnowledgePacks`、`newVideoStagedTransaction`、`projectFactsMode`、`prototypeProjectDraftStatus`、`sceneEditorState`、`localStoryPreviewQueue`、`shareState` 未重置。

---

### I. 新发现的深层逻辑 Bug

**I1 [P1]: 流式请求双失败时原始错误被丢弃**

`director-storyboard-plan.mts:336-347` — streaming 失败 → fallback JSON 也失败 → streamError 被 GC，用户只看到无意义的 fallback error。

**I2 [P1]: runtime-state.json 只存 cache policy**

`projectStoreIo.ts:287-289` — `runtimeStateFactContent()` 返回 `snapshot.runtimeCachePolicy`（只有缓存失效 key），而不是完整 runtime state。project.vibe 损坏时不足以恢复。

**I3 [P1]: 非标准 SSE delta 字段被当作内容拼接**

`director-storyboard-plan.mts:61` — `json.delta` 和 `json.content`（非标准字段）被无差别拼接到输出文本中。

**I4 [P2]: Image2 hardcoded 16:9 + 1280x720 + quality "low"**

无 project 或 shot 级别覆盖。所有图像固定在 16:9 1280x720。

**I5 [P2]: Seedance shots.slice(0, 4) 硬限制**

超过 4 个镜头静默截断，无警告。

---

## 三、按用户操作的端到端 Bug 影响

### 场景1: 创建新视频项目
1. 用户输入脚本+风格+参考图
2. Director session 分析脚本 → **如果 LLM 返回非 JSON 格式 → crash (H2)**
3. 生成 storyboard plan → **策略不持久化，下次打开可能漂移 (A2)**
4. 保存 project.vibe → **sourceIndex 完全重建，原始顺序丢失 (A3)**

### 场景2: 生成参考资产
1. Agent loop 启动 → **所有工具调用自动批准，无安全确认 (E1)**
2. Image2 生成 keyframes → **硬编码 16:9 1280x720 (I4)**
3. 用户 approve 资产 → **快速点击两个 approve → 数据丢失 (B1)**

### 场景3: 生成视频
1. 提交 Seedance → **TOCTOU race 可能绕过串行限制 (C3)**
2. Seedance CLI 执行 → **running flag 可能永久 stuck (C2)**
3. 视频完成 → **输出文件永不清理 (temp 累积)**

### 场景4: 忘记/切换项目
1. 忘记项目 A → **15+ state 未重置，残留数据 (H3)**
2. 打开项目 B → **Electron scope 仍包含 A 的路径，sandbox IPC 可读写 A 文件 (G1)**
3. 打开空目录 → **UI 进入不可恢复空白状态 (B2)**

### 场景5: 导出视频
1. 构建导出计划 → **无进度通知 (D4)**
2. ffmpeg 执行 → **大文件 OOM (D2)**
3. ffmpeg 超时 → **只有 SIGTERM，无 SIGKILL (D1)**
4. 无法取消 → **必须杀进程 (D3)**

### 场景6: Runtime server 崩溃
1. 任何未捕获异常 → **29,523 行代码，零全局异常处理 (C1)**
2. Server 进程退出 → **所有 provider 调用中断**
3. UI 初始化链 8 个 promise → **全部 unhandled rejection (H1)**
4. 用户看到的是"无缘无故不工作了"

---

## 四、优先级排序（按实际使用影响）

### 第一批: 让系统能稳定运行 (6 个 P0)
1. **H1** - 8 处 unhandled rejection (UI 初始化)
2. **C1** - Runtime server 无全局异常处理
3. **B1** - 闭包 state 覆盖 (快速操作数据丢失)
4. **B2** - 打开空目录不可恢复
5. **C2** - running flag 永久 stuck
6. **C4** - route handler 无 timeout (请求挂起)

### 第二批: 让数据完整不丢失 (5 个 P0/P1)
7. **A1** - ShotRecord 丢失 15+ 字段
8. **B3** - useEffect 竞态
9. **G1** - cross-project 文件访问
10. **H3** - forget 遗漏 state
11. **A2** - referenceStrategy 不持久化

### 第三批: 让功能正确运行 (6 个 P1)
12. **H2** - JSON.parse crash
13. **C3** - Seedance TOCTOU race
14. **E1** - 工具自动批准
15. **D1/D2/D3** - 导出管线缺陷
16. **E2** - Agent 无持久化
17. **F2** - transaction rejection 不检查

### 第四批: 技术债清理 (P2)
18. **I3** - 非标准 SSE 字段
19. **I4** - hardcoded 分辨率
20. **I5** - shots.slice(0,4)
21. **D5** - 导出无重试
22. **F3** - save race condition
