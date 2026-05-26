# Vibe Director Studio — 完整 Review 报告

**Review date:** 2026-05-23（三轮审查：18 agent 并行 + 6 deep agent + max-effort 逐文件直接分析 20+ 核心源文件）
**Scope:** Electron shell、核心类型、运行时、AI代理、Director领域、Provider集成、音频管线、导出管线、UI、设置/凭证、测试、构建配置、CSS、Schema、领域逻辑、Agent Loop、BGM执行链、项目忘记流程、凭据安全、spawn沙箱
**总 issue 数:** **117**（12 P0 · 22 P1 · 83 P2）

---

## 0. 当前状态总判断

**离可演示 MVP 还差 ~2 周。** 核心架构设计合理，主要链路（Project.vibe读写、三种参考策略、Seedance提交、导出）可跑通。但存在 2 个 runtime crash bug（spread undefined）、3 个安全/隔离缺陷（无 CSP、spawn REPL 泄露、forget 后跨项目文件访问）、1 个阻断 verify:mvp 的测试崩溃、15+ state 的跨项目数据泄露、以及 ProjectVibeShot → ShotRecord 16 个字段的完整数据丢失。

---

## P0 — 必须立即修复（阻塞真实项目测试）

### P0-1: `runtimeTruthLayer.ts` 两处 spread undefined 导致 runtime crash ⚠️ CRITICAL

- **文件：** `src/core/runtimeTruthLayer.ts:541`, `:609`
- **现象：**
  ```typescript
  const observation = input.providerObservation; // ProviderObservationReceiptV2Facts | undefined
  return { ...observation }; // 若 observation 为 undefined → TypeError
  ```
  同样的 bug 在 `buildSemanticQaReceiptV2State` 重复出现。
- **影响：** 任何 providerObservation 或 semanticQa 缺失的 provider 调用，runtime truth layer 直接 crash。TypeScript 不会报错因为联合类型包括 undefined。
- **修法：** `return { ...(observation || {}) }`
- **验收：** 需要新测试覆盖 observation/qa 为 undefined 的场景。

### P0-2: `style-research-preflight:test` 崩溃，阻断 `verify:mvp`

- **文件：** `scripts/style-research-preflight-test.mts:269`
- **现象：** `promptPack.shots[0]?.image2StoryboardPlan` 为 undefined，`.prompt` 访问抛 TypeError。`verify:mvp` 用 `&&` 串联 41 个测试，这一个崩溃让整个 suite 停止。
- **原因：** `buildScriptStoryboardPromptPack` 对 `executionMode: "relationship_wide"` 的 shot 不生成 `image2StoryboardPlan`。
- **修法：** `promptPack.shots[0]?.image2StoryboardPlan?.prompt || ""`
- **验收：** `npm run style-research-preflight:test && npm run verify:mvp` 全绿

### P0-3: Electron `projectRootScope` 永不清理 + watcher 泄露 ⚠️ 安全

- **文件：** `electron/projectScope.mts:14-34`, `electron/main.mts:56-57`
- **现象：**
  - `rememberProjectRoot()` 只 add，无 `forgetProjectRoot()`
  - `electron/main.mts` 无 `project:forget` IPC handler
  - `electron/preload.mts` 无 forget bridge
  - `sandboxWatchers` 只在 `will-quit` 清理
  - 忘记项目全部走 HTTP DELETE 到 runtime server，主进程完全不知情
- **影响：** 打开项目 A → 忘记 → 打开项目 B 后，sandbox IPC 仍可读写项目 A 的文件。`electron-project-scope:test` 不覆盖 forget 场景。
- **修法：**
  1. `projectScope.mts` 加 `forgetProjectRoot(path)`
  2. `electron/main.mts` 加 `project:forget` IPC handler → close watchers + remove root
  3. `electron/preload.mts` 加 `forgetProject` bridge
  4. UI forget 流程调用 IPC
- **验收：** 新建 test：open A → forget A → sandbox:readFile A内文件 → 应被拒绝

### P0-4: 根目录 `main.mts` 是死代码，import 会崩溃

- **文件：** `main.mts` (root, 231行) vs `electron/main.mts` (478行)
- **现象：** 根 `main.mts:9` import `./projectScope.mts`，该文件只存在于 `electron/`。`package.json` `"main"` 指向 `electron-dist/main.mjs`。
- **影响：** 若有人执行 `npx tsx main.mts` 直接 crash。代码库有歧义。
- **修法：** 确认无引用后删除（或加 `// @deprecated` 注释后保留）

### P0-5: `projectScope.mts` spawnAllowed 允许 `node` 无参数 → 泄露 REPL 进程

- **文件：** `electron/projectScope.mts:40`
- **现象：** `spawnAllowed` 允许 `node` 无参数通过（`args.length === 0` 的 case）。这会在 `stdio: "pipe"` 下启动一个永不退出的 REPL。
- **影响：** sandbox:spawn 进程泄露。Promise 永不 resolve。
- **修法：** 要求 `args.length === 1 && ["--version", "-v"].includes(args[0])`

### P0-6: Electron 无 CSP 头 ⚠️ 安全

- **文件：** `electron/main.mts:438-460`
- **现象：** 无 Content-Security-Policy（未在 BrowserWindow/session 设置，`index.html` 也无 CSP meta 标签）。
- **影响：** 若渲染进程存在 XSS，攻击者可访问 preload bridge。
- **修法：** 在 `createWindow` 中设置 `session.defaultSession.webRequest.onHeadersReceived` 或在 `index.html` 加 CSP meta。

---

## P1 — 影响体验/数据完整性

### P1-1: `ProjectVibeShot` 缺少 `referenceStrategy` 字段

- **文件：** `src/project/types.ts:95-125`, `src/core/newVideoProjectVibePlanner.ts:670`
- **现象：** 三种策略不持久化到 Project.vibe，降级为文本塞进 `directorFeedbackDirectives`。重开项目时需 `directorProductionSkill.selectStrategy()` 重新计算。
- **影响：** 跨 session 策略可能漂移（若关键字段如 durationSeconds 变化）。
- **修法：** 给 `ProjectVibeShot` 加 `referenceStrategy?: "storyboard_narrative" | "storyboard_rapid_cut" | "omni_reference"`，优先读取此值，缺失时重新计算。

### P1-2: 忘记项目时 React 状态重置不完整

- **文件：** `src/App.tsx:3254-3271`
- **现象：** 重置 12 个 state，但 `animationKey`、`exportActionState`、`shareState`、`localStoryPreviewQueue`、`agentWebSearchSettings`、`sceneEditorState` 未重置。
- **影响：** 忘记 A → 打开 B，残留 A 的数据。
- **修法：** 统一 `resetAllProjectState()` 函数或用 key prop 重 mount director 子树。

### P1-3: `ImageTaskPlan` 有重复字段 `requiredMode` 和 `mode`

- **文件：** `src/core/types/provider.ts:318-319`
- **现象：** 两个字段类型相同(`RequiredMode`)，无注释区分。疑似重构遗留。
- **修法：** 确认语义后删除一个或重命名区分。

### P1-4: `LocalTaskStatus` 与 `ProviderTaskStatus` 命名不一致

- **文件：** `src/core/types/base.ts:41-42, 50-51`
- **现象：** `"succeeded"` vs `"success"`, `"failed"` vs `"fail"`
- **修法：** 统一为一种命名。

### P1-5: `runtimeTruthLayer.ts` QA gate keys 与 `GateSet` 不匹配

- **文件：** `runtimeTruthLayer.ts:302` vs `base.ts:117-124`
- **现象：** truth layer 用 `["identity","scene","style","story","neighbor","output"]`，GateSet 用 `["identity","scene","pair","story","prop","style"]`。`"neighbor"/"output"` 和 `"pair"/"prop"` 是两套不同的键。
- **修法：** 统一门控键模型或文档化映射。

### P1-6: `directorProductionSkill.ts` 中 `comedy_reaction`/`commercial_short` 始终 fallthrough 到 omni

- **文件：** `src/core/directorProductionSkill.ts:201-248`
- **现象：** 这两个 rhythm profile 从未匹配任何显式条件，永远走最后 `return "omni_reference"`。comedy_reaction 的 split_for_reaction 策略暗示适合 storyboard_narrative。
- **修法：** 给 `comedy_reaction` 加显式路由到 `storyboard_narrative`。

### P1-7: BGM 禁止仅靠 prompt text，无结构锁

- **文件：** `src/core/directorProductionSkill.ts:292,305`, `directorFeedbackRecompile.ts:203-205,223`
- **现象：** no BGM 只在 seedance directive 文本中体现（"默认 no BGM，不自动加音乐"），无 boolean lock 或 validator。
- **修法：** 在 `seedanceDirectiveFor` 返回值和 seedance submit 前加 `noBgmEnforced: true` 字段并验证。

### P1-8: `jimengTool.ts` 两个安全隐患

- **文件：** `src/agent/jimengTool.ts:85-89, 166-168`
- **现象：**
  1. `input.extraArgs` 直接展开到 CLI args 无验证——LLM 可注入任意参数
  2. `input.outputPath` 无沙箱转义检查——可写 `../../etc/` 路径
- **修法：** 1) 白名单 extraArgs；2) normalizeRelativePath 检查 outputPath

### P1-9: `__VIBE_RUNTIME_API_BASE_URL__` 按值暴露不更新

- **文件：** `electron/preload.mts:21`, `src/core/runtimeApiClient.ts:118`
- **现象：** `contextBridge.exposeInMainWorld` 传递字符串值，后续更新不反映到 `window.__VIBE_RUNTIME_API_BASE_URL__`。渲染进程直接读此变量会得到空字符串。
- **修法：** 改为 getter 函数或在 `ensureRuntimeApiBaseUrl` 完成后重新设置。

### P1-10: `waitForRuntimeStatus` fetch 无超时 → 可能永久挂起

- **文件：** `electron/main.mts:380`
- **现象：** 外层有 15 秒循环，但 `fetch(url)` 本身无 `AbortSignal.timeout()`。服务器挂起连接时 `await fetch()` 永不返回，外层的 `Date.now` 检查无法触发。
- **修法：** `fetch(statusUrl, { signal: AbortSignal.timeout(5000) })`

### P1-11: 长脚本本地切割 max 10 段

- **文件：** `src/core/directorSession.ts:353-354`
- **现象：** 两条代码路径都 `slice(0, 10)`。
- **修法：** 上限提到 30，或改为不截断而在 AI prompt 中传完整文本。

---

## P2 — 技术债（不阻塞交付）

### 类型系统
| # | 问题 | 位置 |
|---|------|------|
| P2-1 | `PromptConflictSeverity` 与 `Severity` 完全相同 | `base.ts:16, 238` |
| P2-2 | `SubagentIssue.severity` 用 P0/P1/P2 而 `Severity` 用 blocker/warning/info | `base.ts:402` |
| P2-3 | `GenerationJob.status`, `ShotRecord.status` 各自独立 union，不共享 | `base.ts:210-216, 226` |
| P2-4 | `qaReviewStatusForLedger` 是恒等函数（死代码） | `artifactTransactionGate.ts:171-173` |
| P2-5 | `envelopeProductionGate.ts:84-85` 中 `allPassed` 和 `valid` 值重复 | `envelopeProductionGate.ts` |

### 安全/凭证
| # | 问题 | 位置 |
|---|------|------|
| P2-6 | API 密钥以明文 JSON 存储在 `~/.vibe-director/credentials.json` | `runtimeConfig.ts:568-572` |
| P2-7 | 凭证通过 HTTP（非 HTTPS）传输到 localhost runtime | `providerCredentialsClient.ts:132-143` |
| P2-8 | `VITE_VIBE_*_RUNTIME_API_TOKEN` 泄露到前端构建产物 | `runtimeApiClient.ts:216-220` |
| P2-9 | `use-mock-keychain` 在发布版也始终启用 | `electron/main.mts:14` |

### 构建/配置
| # | 问题 | 位置 |
|---|------|------|
| P2-10 | `vite.config.ts` 硬编码 `../Vibe Director` fallback 路径 | `vite.config.ts:12` |
| P2-11 | `schemaRegistry.ts` 从未被 import，`schemas/` 964KB 全是文档 | `schemaRegistry.ts`, `schemas/` |
| P2-12 | `real_demo_e2e.schema.json` 在磁盘但不在 registry 中 | `schemas/real_demo_e2e.schema.json` |
| P2-13 | tsconfig 缺少 `noUncheckedIndexedAccess`、`noUnusedLocals` 等 | `tsconfig.json` |
| P2-14 | tsconfig 空 `"references": []` | `tsconfig.json:20` |
| P2-15 | `core-runtime` chunk 1,059 KB 超 1000 KB 限制 | build output |
| P2-16 | 无 macOS 代码签名/公证配置 | `package.json` build 段 |

### UI/交互
| # | 问题 | 位置 |
|---|------|------|
| P2-17 | SettingsShell "工程设置明细" 暴露 `providerId`、`envKey`、`baseUrl` | `SettingsShell.tsx:580-588` |
| P2-18 | `minimal-ui:test` 报告 Diagnostics 工程术语数 1400（Director 为 0） | test result |
| P2-19 | 旧 `startFrame`/`endFrame` 在 `ShotRecord`、`directorEdit`、`directorWorkflow` 中 | `base.ts:207-208`, `directorEdit.ts:30-31` |
| P2-20 | `SubagentRunnerTaskKind` 仍包含 `start_frame`/`end_frame` | `types/runtime.ts:453-454` |
| P2-21 | `lanyiImage2AgentTool.ts` 默认 model `"gpt-image-2"` 是假名/占位符 | `lanyiImage2AgentTool.ts:253` |

### 测试
| # | 问题 | 位置 |
|---|------|------|
| P2-22 | `preview-export-audio-e2e-test.mts:58` 断言 `>= 0` 始终为真 | test |
| P2-23 | `preview-export-audio-e2e-test.mts` 多处 `as any` 绕过类型检查 | test |
| P2-24 | `new-video-golden-path-test.mts:199` 硬编码 `runnable.length >= 2` | test |
| P2-25 | 几乎所有测试用模拟数据，无真实 provider 调用 | all tests |
| P2-26 | `electron-project-scope:test` 不覆盖 forget 场景 | test |
| P2-27 | 无 `src/` 内单元测试，333 测试全在 `scripts/` | 整体 |

### director 领域
| # | 问题 | 位置 |
|---|------|------|
| P2-28 | `directorFeedbackRecompile.ts:175-179` 硬编码 actionBeats | recompile |
| P2-29 | recompile 的 guidance arrays 只追加不重置 | 同上:227-232 |
| P2-30 | `directorAnalysisEnvelope.ts` 的 `providerCalled: false` 永不更新 | envelope |
| P2-31 | `agentRuntime.ts:96` 双重 `as unknown as` 绕过类型检查 | agent |

---

## 三种视频参考模式一致性 — 完整验查

| 层 | 类型名 | 值 | 状态 |
|---|---|---|---|
| UI (`NewVideoStart.tsx:70-72`) | `NewVideoReferenceStrategy` | `"storyboard_narrative" \| "storyboard_rapid_cut" \| "omni_reference"` | ✅ |
| AI Planner (`directorAiStoryboardPlanner.ts:13-15`) | `DirectorAiStoryboardReferenceStrategy` | 同上三个字符串 | ✅ |
| Production Skill (`directorProductionSkill.ts:14-16`) | `DirectorProductionSkillId` | 同上三个字符串 | ✅ |
| Rhythm Planner (`scriptMusicRhythmPlanner.ts:12-14`) | `ScriptMusicReferenceStrategy` | 同上三个字符串 | ✅ |
| Image2 Pipeline (`storyboardReferencePipeline.ts:911`) | 内部 mode | `"narrative_storyboard"`, `"rapid_cut_storyboard"`, `"none"` | ✅ 正确派生 |
| Seedance Prompt (runtime server L26534) | `compilerMode` | 三个策略名 + 中文标签 | ✅ |
| Manifest (runtime server L26824) | `compilerMode` | 三个策略名 | ✅ |
| **Project.vibe** (`project/types.ts:95-125`) | `ProjectVibeShot` | **❌ 无 `referenceStrategy` 字段** | ⚠️ P1-1 |

三个策略名字符串在所有运行时层完全一致。唯一 gap 是 Project.vibe 没有对应的 typed 字段。

---

## 测试运行结果

```
TypeScript 编译: PASS (零错误)
npm run minimal-ui:test: PASS (Director=0 engineering terms, Diagnostics=1400)
npm run current-project-seedance-mode-compiler:test: PASS
npm run electron-project-scope:test: PASS (但不覆盖 forget)
npm run packaged-launch-contract:test: PASS
npm run new-video-golden-path:test: PASS (missingCount=1, lockGateStatus=blocked)
npm run preview-export-audio-e2e:test: PASS (9/9)
npm run verify:mvp: FAIL (被 style-research-preflight:test 阻断)
npm run style-research-preflight:test: FAIL (TypeError: Cannot read properties of undefined)
npm run build: PASS (1.48s, core-runtime 1059KB)
```

---

## 全面加速计划（4-5 天，覆盖全部 12 个 P0 + 关键 P1）

### Day 1 — 修复运行时崩溃 + 构建基础设施 (5h)

| 时间 | 任务 | 验收 |
|------|------|------|
| 30 min | **P0-1**: `runtimeTruthLayer.ts` 两处 spread undefined → `\|\| {}` | 新测试覆盖 undefined 场景 |
| 30 min | **P0-2**: `style-research-preflight-test.mts:269` → `?.prompt` | `verify:mvp` 不再被阻断 |
| 30 min | **P0-5/P0-12**: `spawnAllowed` 拒绝 `node` 零参数 | `electron-project-scope:test` |
| 15 min | **P0-4**: 删除或标记 deprecated 根 `main.mts` | grep 确认无引用 |
| 15 min | **P0-7**: `npm install -D esbuild` | 构建不依赖传递依赖 |
| 15 min | **P0-8**: build 脚本加 `minify: true` | runtime server < 500KB |
| 30 min | **P0-9**: `public/` 移出大型 JSON fixture | dist/ 减小 7.5MB |
| 1.5 h | **验证**: `npm run verify:mvp` 全绿 + `npm run build` 通过 | 41 个测试全部通过 |

### Day 2 — 安全隔离 + 数据安全 (5h)

| 时间 | 任务 | 验收 |
|------|------|------|
| 2 h | **P0-3**: `forgetProjectRoot()` + `project:forget` IPC + preload bridge + watcher cleanup | 新测试: open A → forget → readFile A 内文件 → 拒绝 |
| 1 h | **P0-6**: Electron CSP 头 | DevTools 无 CSP violation |
| 1.5 h | **P0-10**: 统一 `resetAllProjectState()` 函数，重置全部 15+ state | forget A → open B → 无 A 的残留数据 |
| 30 min | **P0-11**: `deterministicTimestamp` → `new Date().toISOString()` | git diff 确认 |

### Day 3 — 关键数据完整性 (5h)

| 时间 | 任务 | 验收 |
|------|------|------|
| 1.5 h | **P1-1**: `ProjectVibeShot` 加 `referenceStrategy` typed 字段 | 跨 session 策略一致性 |
| 1.5 h | **P1-12**: `ShotRecord` 扩展保留 camera/executionMode/rhythmProfile 等字段 | 下游代码可访问导演决策数据 |
| 1 h | **P1-9**: `__VIBE_RUNTIME_API_BASE_URL__` 改为 getter | DevTools console 验证 |
| 30 min | **P1-10**: fetch 加 `AbortSignal.timeout(5000)` | 模拟服务器挂起场景 |
| 30 min | **P1-6**: `comedy_reaction` 显式路由到 `storyboard_narrative` | 单元测试覆盖三种 rhythm profile |

### Day 4 — BGM 防护 + 脚本/资产 (4h)

| 时间 | 任务 | 验收 |
|------|------|------|
| 1 h | **P1-7**: Seedance submit 前加 `noBgmEnforced` boolean lock + validator | 新增 BGM 泄漏测试 |
| 1 h | **P1-16**: `selectStrategy()` 同时检查 `rhythmProfile` | quiet_dialogue + high action 不再路由到 rapid_cut |
| 1 h | **P1-13/P1-14**: `AssetRecord` 保留 `roleBinding` + rejected 状态修复 | 音频管线可筛选资产 |
| 30 min | **P1-11/P1-22**: 脚本切割上限 10 → 30 | 长脚本不截断 |
| 30 min | **P1-15**: 损坏 shot 引用加 `console.warn` | 日志可见损坏引用 |

### Day 5 上午 — 收尾 (2h)
1. 全量回归 `npm run verify:mvp`
2. 给 83 个 P2 开 GitHub issues 分类跟踪
3. 标记 `good first issue` 标签给低风险项

---

---

## 第二阶段审查 — 此前未覆盖的 15 个领域（2026-05-23 第二轮）

以下为 6 个并行 deep review agent 对之前遗漏领域的完整审查结果。

---

## P0 新增 — 构建系统阻断问题

### P0-7: `esbuild` 不是直接依赖项，构建可能断裂

- **文件：** `scripts/build-electron-app.mts:1`, `scripts/build-electron-runtime-server.mts:1`
- **现象：** 两个关键构建脚本 `import esbuild from "esbuild"`，但 esbuild 不在 `package.json` 的 `devDependencies` 或 `dependencies` 中。它仅作为 `tsx`/`vite` 的隐式传递依赖存在。
- **影响：** 若 tsx 或 vite 更改依赖关系图，`npm run build:electron-runtime` 和 `npm run build:electron-app` 将直接崩溃。
- **修法：** `npm install -D esbuild`

### P0-8: `electron-runtime/local-runtime-api-server.mjs` 未最小化，1.2 MB

- **文件：** `scripts/build-electron-runtime-server.mts`
- **现象：** esbuild 配置中无 `minify: true`，生成的单文件运行时服务器为 1,247,765 字节。
- **影响：** 增加应用包体积 ~500KB（gzip 后），拖慢运行时服务器启动速度。
- **修法：** 在 esbuild build options 中加 `minify: true`

### P0-9: 6.4 MB `runtime-state.json` 每次构建被复制到 dist

- **文件：** `public/runtime-state.json` (6.4 MB), `public/demo-runtime-state.json` (585 KB)
- **现象：** 两个大型 JSON fixture 文件位于 `public/`，每次 `vite build` 时原样复制到 `dist/`。合计增加 7.5 MB 包体积。
- **影响：** 发布包携带不应发布的测试/模拟数据。
- **修法：** 从 `public/` 移出，或通过 `build.rollupOptions.external` 排除，改为按需加载

---

## P1 新增 — 领域逻辑数据丢失

### P1-12: `ProjectVibeShot` → `ShotRecord` 转换丢失 7 个关键字段 ⚠️ 数据完整性

- **文件：** `src/project/projectVibeRuntimeState.ts` → `projectVibePlanningProjection.ts:92`
- **现象：** `shotRecordFromSource()` 仅映射 `id`, `sectionId`, `title`, `intent`, `narrationText`, `dialogueLines`, `subtitle`, `sound`, `audioUsage`, `videoControlMode`, `status` 和资产 ID。以下字段**完全丢失**：
  - `camera`, `executionMode`, `rhythmProfile`, `splitPolicy`, `actionBeats`, `primaryAction`, `actionTrigger`, `microReaction`, `seedanceDirection`, `directorFeedbackDirectives`, `characterGuidance`, `sceneGuidance`, `propGuidance`, `durationSeconds`, `sourceRefs`
- **影响：** 任何下游代码查询 `ShotRecord.camera` 或 `.actionBeats` 等将得到 `undefined`。运行时无法访问导演决策数据。
- **修法：** 在 `ShotRecord` 中增加对应字段，或在 `buildProjectRuntimeState()` 阶段通过额外上下文重建。

### P1-13: `ProjectVibeAsset.roleBinding` 在 `toAssetRecord()` 中丢失

- **文件：** `src/project/projectVibeRuntimeState.ts:47-53`（`assetStatus()` / `assetLockedStatus()`）
- **现象：** `toAssetRecord()` 忽略 `roleBinding` 字段。资产的角色信息（dialogue_audio、reference 等）在运行时状态中不可用。
- **影响：** TTS/音频管线无法通过角色绑定筛选资产。
- **修法：** 在 `AssetRecord` 中保留 `roleBinding`

### P1-14: `rejected` 资产状态映射错误

- **文件：** `src/project/projectVibeRuntimeState.ts:47-53`
- **现象：** `"rejected"` 状态在 `assetStatus()` 中被映射为 `"planned"`（若无路径）或 `"exists"`（若有路径文件）。在 `assetLockedStatus()` 中被映射为 `"needs_review"`。两者均不准确。
- **影响：** 被拒绝的资产无法与已计划/已存在的资产区分。
- **修法：** 新增 `"rejected"` 作为独立的资产状态

### P1-15: 损坏的 shot 引用静默丢弃

- **文件：** `src/project/projectVibePlanningProjection.ts:200-201`
- **现象：** `sourcesFromProject()` 中 `.find()` 返回 `undefined` 时静默过滤，无任何 warning 或 error。
- **影响：** 用户可能不知 Project.vibe 中有损坏的 shot 引用。
- **修法：** 在过滤时至少输出 `console.warn`

### P1-16: `quiet_dialogue` + 高动作密度 → 错误路由到 `storyboard_rapid_cut`

- **文件：** `src/core/directorRhythmPlanner.ts:83-90`, `src/core/directorProductionSkill.ts:224-233`
- **现象：** 当 `rhythmProfile === "quiet_dialogue"` 且 `actionDensity === "high"` 时，`splitPolicy` 从 `"hold_single_shot"` 变为 `"split_for_action"` → `selectStrategy()` 将其路由到 `storyboard_rapid_cut`（昂贵的 storyboard 生成）。
- **影响：** 本该是对白驱动的镜头会生成大量不必要的 Image2 参考资产。
- **修法：** `selectStrategy()` 需要在 `splitPolicy` 之外同时检查 `rhythmProfile`

### P1-17: 节奏规划器的 BGM 理由文本具有误导性

- **文件：** `src/core/directorRhythmPlanner.ts:139-141`
- **现象：** `rhythmReason` 附加从句"音乐参考只用于节奏规划和最终混音，不进入视频模型提示词"，但实际上 `rhythmTags` 被馈入文本评分，影响节奏档案选择，进而影响 `selectStrategy()` 和模型提示词。
- **修法：** 修正措辞或让音乐标签不参与文本评分

---

## P2 新增 — 构建/配置

### 构建系统

| # | 问题 | 位置 |
|---|------|------|
| P2-32 | `core-runtime` chunk 1,059 KB，超过 Vite 警告阈值 | dist/assets/core-runtime-*.js |
| P2-33 | `public/media/` 两张 PNG 合计 3.1 MB 未压缩 | public/media/ |
| P2-34 | 147 KB CSS 包，可能含未使用样式 | dist/assets/index-*.css |
| P2-35 | 无 Windows 代码签名配置 | package.json `win` 段 |
| P2-36 | macOS 发布签名仅靠 `package-release-signing-preflight.mts` 一次性检查 | scripts/ |
| P2-37 | `knowledge_pack_manifest.json` 408 KB 且未打包进 asar | resources/ |
| P2-38 | 知识包的 `snippets` 数组与 .md 文件内容重复 | resources/knowledge_pack_manifest.json |

### CSS/样式

| # | 问题 | 位置 |
|---|------|------|
| P2-39 | `.field-grid` grid-template-columns 冲突 (180px vs 80px) | layout.css:111 vs styles.css:502 |
| P2-40 | `.minimal-shell` 三次重定义，三套不同颜色方案（前两套为死代码） | director.css:2, 2320, 5070 |
| P2-41 | ~40 处非标准 `font-weight` (650/750/760) | director.css, ProjectRealChainPanel.css |
| P2-42 | `ProjectRealChainPanel.css` 大面积颜色对比度不达标（rgba 0.52 opacity） | ProjectRealChainPanel.css |
| P2-43 | 无 `prefers-reduced-motion` 支持 | 所有 CSS 文件 |
| P2-44 | 8 处 `outline: none` 无 `:focus-visible` 回退 | director.css |
| P2-45 | 数十个 phase 编号 CSS 类疑似死代码（.phase17-*, .phase27-* 等） | styles.css:2059-2395 |
| P2-46 | `--studio-*` CSS 变量在定义前被引用 | director.css:328, 381, 1741-1748 |
| P2-47 | `.text-caption`, `.nav-label`, `.button-text`, `.status-label` 未使用 | typography.css |
| P2-48 | 多处 `font-synthesis: none` 阻止 faux-bold/faux-italic | styles.css:6 |

### Schema/数据

| # | 问题 | 位置 |
|---|------|------|
| P2-49 | 103 个 schema 文件 (756 KB) 从未被加载/验证 — 纯死代码 | schemas/ |
| P2-50 | `director_workflow.schema.json` 有 3 个 required 字段无 properties 定义 | schemas/ |
| P2-51 | `real_demo_e2e.schema.json` 不在 registry 且 `$id` 域名不一致 (vibe-core vs vibecore) | schemas/, schemaRegistry.ts |
| P2-52 | `buildDefaultToolDetectionReport()` 使用 `new Date(0)` 作为默认时间戳 → Unix epoch | runtimeConfig.ts:585 |
| P2-53 | 无自动化测试验证 schema 交叉引用完整性 | — |
| P2-54 | `adapter_contract.schema.json` 硬编码 provider 特定逻辑 | schemas/ |

### 资源/文档/示例

| # | 问题 | 位置 |
|---|------|------|
| P2-55 | 6 个 docs 明确标记为历史/已废弃但仍在仓库中 | docs/ |
| P2-56 | `schema-contracts.md` 只提到 8 个 schema，实际有 107 个 | docs/schema-contracts.md |
| P2-57 | `sample-projects/` 的 `propAssetIds` 引用了 `kind: "style"` 的资产 | sample-projects/mvp-demo/project.vibe |
| P2-58 | `codex-cli-execution-boundary.md` 知识包引用已废弃的 Codex 架构 | resources/knowledge/provider/ |
| P2-59 | 缺少开发者入门指南、API 文档、CHANGELOG | docs/ |

### 无障碍/TTS/搜索/CI

| # | 问题 | 位置 |
|---|------|------|
| P2-60 | Settings 弹窗无 focus trap、无 Escape 关闭、无 `aria-modal`、无 `inert` | App.tsx:3405 |
| P2-61 | 无 `aria-live` 动态区域（状态变更无屏幕朗读） | 全部 .tsx |
| P2-62 | TTS 3 个 provider 全为抽象占位符，`providerSubmissionForbidden: true`，无实际能力 | ttsProviderPlanning.ts |
| P2-63 | Web Search 无速率限制、无缓存、无请求去重 | webSearchTool.ts, agentWebSearchClient.ts |
| P2-64 | 全部 UI 文本硬编码中文，无 i18n 框架 | 全部 .tsx |
| P2-65 | 无 CI/CD 配置（无 GitHub Actions、无任何 CI） | — |

### 运行时状态数据丢失详细清单

| ProjectVibeShot 字段 | 是否传递到 ShotRecord | 影响 |
|---|---|---|
| `camera` | ❌ | 摄像机运动数据丢失 |
| `executionMode` | ❌ | 执行模式不可知 |
| `rhythmProfile` | ❌ | 节奏档案需重建 |
| `splitPolicy` | ❌ | 拆分策略丢失 |
| `actionBeats` | ❌ | 动作节拍丢失 |
| `primaryAction` | ❌ | 主要动作丢失 |
| `actionTrigger` | ❌ | 动作触发丢失 |
| `microReaction` | ❌ | 微反应丢失 |
| `seedanceDirection` | ❌ | Seedance 指令丢失 |
| `directorFeedbackDirectives` | ❌ | 导演反馈指令丢失 |
| `characterGuidance` | ❌ | 角色指导丢失 |
| `sceneGuidance` | ❌ | 场景指导丢失 |
| `propGuidance` | ❌ | 道具指导丢失 |
| `durationSeconds` | ❌ | 时长信息丢失 |
| `sourceRefs` | ❌ | 源引用丢失 |
| `roleBinding` (Asset) | ❌ | 资产角色绑定丢失 |

---

---

## 第三阶段 — Max-Effort 直接深入分析（2026-05-23 第三轮）

以下为 Opus max-effort 模式下逐文件直接阅读 16+ 核心源文件的发现，聚焦前两轮 agent 无法做到的超深层逻辑分析。

---

### P0 新增 — 深层逻辑缺陷

#### P0-10: `forgetProjectFileRoot` 15+ 个 state 未重置，跨项目数据泄露 ⚠️ 数据安全

- **文件：** `src/App.tsx:3254-3271`
- **现象：** `forgetProjectFileRoot()` 只重置 12 个 state，以下至少 15 个 state 未重置：
  - `animationKey`, `exportActionState`, `realImage2Gate`, `agentWebSearchSettings`, `projectLocalKnowledgePacks`, `mode`, `tab`, `showInspector`, `selectedAssetId`, `newVideoStagedTransaction`, `projectFactsMode`, `prototypeProjectDraftStatus`, `sceneEditorState`, `localStoryPreviewQueue`, `shareState`
- **影响：** 忘记项目 A → 打开项目 B，B 的 UI 会短暂显示 A 的搜索设置、知识包、导出状态、选中资产等残留数据。
- **修法：** 创建统一的 `resetAllProjectState()` 函数，或以随机 key prop 重新挂载 director 子树

#### P0-11: `directorSession.ts` 使用 Unix epoch (`1970-01-01`) 作为默认时间戳

- **文件：** `src/core/directorSession.ts:100`
- **现象：** `const deterministicTimestamp = "1970-01-01T00:00:00.000Z"` 作为 `createdAt` 和 `updatedAt` 的默认值。此值被传递给 session turns 和 staged facts。
- **影响：** 若 downstream 代码比较时间戳判断数据新旧，epoch 值比任何真实数据都"旧"，可能误判数据为过期/无效。
- **修法：** 使用 `new Date().toISOString()` 而非 epoch sentinel

#### P0-12: `spawnAllowed` 仍允许 `node` 零参数（REPL 泄露）

- **文件：** `electron/projectScope.mts:40`
- **现象：** `spawnAllowed()` 的第二个条件 `normalizedArgs.length === 0` 允许不传参数执行 `node`，启动一个永不退出的 REPL 进程。
- **影响：** sandbox:spawn 进程泄露，Promise 永不 resolve。
- **修法：** 改为 `return normalizedArgs.length === 1 && ["--version", "-v"].includes(normalizedArgs[0])`

---

### P1 新增 — 深层数据/流程缺陷

#### P1-18: ProjectVibeShot → ShotRecord 完整字段丢失映射表

- **文件：** `src/project/projectVibeRuntimeState.ts:170-171` → `projectVibePlanningProjection.ts`
- **完整映射表：**

| ProjectVibeShot 字段 | ShotRecord 保留？ | 说明 |
|---|---|---|
| `id` | ✅ | 直接映射 |
| `sectionId` | ✅ | 直接映射 |
| `title` | ✅ | 直接映射 |
| `intent` | ✅ | 直接映射 |
| `narrationText` | ❌✳️ | `shotField` lookup 可读，但无 typed 字段 |
| `dialogueLines` | ❌✳️ | `shotArrayField` lookup 可读 |
| `subtitle` | ❌✳️ | `shotField` lookup 可读 |
| `sound`, `audioUsage` | ❌✳️ | `shotField`/`ambienceForShot` lookup 可读 |
| `videoControlMode` | ❌ | 仅在 projection 中用于生成 jobs |
| `camera` | ❌ | 完全丢失 |
| `executionMode` | ❌ | 完全丢失 |
| `rhythmProfile` | ❌ | 完全丢失 |
| `splitPolicy` | ❌ | 完全丢失 |
| `actionBeats` | ❌ | 完全丢失 |
| `primaryAction` | ❌ | 完全丢失 |
| `actionTrigger` | ❌ | 完全丢失 |
| `microReaction` | ❌ | 完全丢失 |
| `seedanceDirection` | ❌ | 完全丢失 |
| `directorFeedbackDirectives` | ❌ | 完全丢失（含 referenceStrategy） |
| `characterGuidance` | ❌ | 完全丢失 |
| `sceneGuidance` | ❌ | 完全丢失 |
| `propGuidance` | ❌ | 完全丢失 |
| `durationSeconds` | ❌ | 完全丢失 |
| `sourceRefs` | ❌ | 完全丢失 |
| `sceneAssetIds` | ✅ | 重命名为 `assetIds` |
| `characterAssetIds` | ✅ | 重命名为 `assetIds` |
| `propAssetIds` | ✅ | 重命名为 `assetIds` |
| `status` | ✅ | 映射到 `ShotRecord.status` |

✳️ 标记的字段通过 `shotField()` / `shotArrayField()` 的非类型安全字符串 key lookup 间接读取，不做编译时验证。

#### P1-19: `projectVibeRuntimeState.ts` 多处硬编码空值

- **文件：** `src/project/projectVibeRuntimeState.ts`
- Line 117: `sourceIndexHash: ""` — 始终为空字符串，无法验证源索引完整性
- Line 121: `currentPromptHashes: {}` — 始终为空对象，无法追踪 prompt hash
- Line 127: `staleArtifactIds: []` — 始终为空数组，无法追踪过期 artifact
- Line 155: `auditSchemaVersion: project.modelVersion` — 将 `"project_vibe_minimal_v1"` 作为 audit schema version，这不是 audit schema version
- Line 101: `dreaminaImageEvents: 0` — 硬编码，旧的品牌名

#### P1-20: `projectVibeToProjectAudit` 空 project 边界处理不完整

- **文件：** `src/project/projectVibeRuntimeState.ts:132-176`
- **现象：** `projectVibeToProjectAudit()` 不验证 `project.shots`、`project.assets`、`project.storyFlow.sections` 是否存在。若 Project.vibe 缺少这些字段（损坏的 JSON），函数在访问 `.length` 或 `.map()` 时直接抛 TypeError。
- **影响：** 损坏的 Project.vibe 文件导致整个 app 崩溃，无用户友好错误提示。
- **修法：** 在函数入口处做 defensive check 或 try/catch + 友好错误提示

#### P1-21: BGM 执行链完整但提示词层面缺少结构锁

- **执行链验证（全部一致 PASS）：**

| 层 | 位置 | BGM 策略 |
|---|---|---|
| 音频计划 | `audioPlanning.ts:117` | `musicAllowed: false` ✅ |
| 音乐分析 | `musicRhythmAnalysis.ts:50-53` | `noBgmForVideoProvider: true` ✅ |
| 导出策略 | `exportBuilder.ts:66-67` | `videoProviderBgmAllowed: false` + `bgmIncludedInVideoPrompt: false` ✅ |
| Seedance 指令 | `directorProductionSkill.ts:292,305` | "默认 no BGM，不自动加音乐" ✅ |
| 最终渲染 | `finalVideoRender.ts:186` | "Music reference is mixed locally as final BGM and is never sent to the video provider" ✅ |
| 音频计划 per shot | `audioPlanning.ts:116` | "配乐不交给视频模型" ✅ |

- **Gap:** 所有层都是文本/类型层面的约束，Seedance submit 前没有 boolean lock 或 validator 硬拦截。如果某条代码路径遗漏了文本约束，BGM 仍可能进入 Seedance prompt。
- **修法：** Seedance submit 前加 `noBgmEnforced: true` boolean 字段 + validator

#### P1-22: `directorSession.ts` 脚本切割上限 `slice(0, 10)` 硬确认

- **文件：** `src/core/directorSession.ts:353, 354`
- **现象：** 两条代码路径（时间码路径和无时间码路径）都 `slice(0, 10)`。长脚本（如 30 段）会静默截断。
- **修法：** 上限提到 30 或不截断

---

### P2 新增 — Max-Effort 深度分析发现

#### Agent Loop 架构

| # | 发现 | 位置 |
|---|------|------|
| P2-66 | `maxTurns: 6` (default) / `4` (mock) — 防护合理但偏低，复杂多步骤任务可能不足 | ownedAgentLoop.ts:158,371 |
| P2-67 | `createOwnedAgentToolRegistry` 从 extraTools 中 filter 掉 `image2_generate` 和 `lanyiImage2AgentToolName`，但单独注册 lanyiImage2AgentTool — 逻辑正确但注释说"R-MVP-1A: fail closed" | ownedAgentLoop.ts:143-144 |
| P2-68 | Tool dispatch 并行执行同批所有 tool calls — 若两个 tool 操作同一文件可能有竞态 | toolRegistry.ts:139 |
| P2-69 | `providerCalledFromTrace` 检查 `image2_generate` 但此 tool 永远不应被注册（已被 filter） | ownedAgentLoop.ts:343 |

#### 类型/数据完整性

| # | 发现 | 位置 |
|---|------|------|
| P2-70 | `ProjectVibeShot` 无 `referenceStrategy` typed 字段 — 策略降级为中文字符串塞进 `directorFeedbackDirectives` | project/types.ts:95-125, newVideoProjectVibePlanner.ts:669-670 |
| P2-71 | `plannerNotes` 在 `rebuildPlannerPatchOperations` 中随 `{ plannerNotes, ...shot }` 被 strip，不进入 Project.vibe | newVideoProjectVibePlanner.ts:715 |
| P2-72 | `projectSourceIndex()` 中 `shotRefs`、`assetRefs`、`runReceiptRefs` 及子 receipt refs 完全不在映射逻辑中 | projectVibeRuntimeState.ts:106-130 |
| P2-73 | `assetRecordType()` 的 `default: "unknown"` 对 `"reference"` 类型的 ProjectVibeAsset 不友好 | projectVibeRuntimeState.ts:27-30 |

#### Jimeng/CLI 安全

| # | 发现 | 位置 |
|---|------|------|
| P2-74 | `jimengTool.ts:170` 错误消息中包含完整 CLI 命令（含所有参数），可能泄露文件路径到日志 | jimengTool.ts:190-192, 207-209 |
| P2-75 | `jimengTool.ts:89` 路径解析用正则 `replace(/\/[^/]*$/, "")` — 在 Windows 反斜杠路径上失效 | jimengTool.ts:89 |
| P2-76 | `jimengTool.ts:166-168` `extraArgs` 直接展开到 CLI 无白名单验证 — **仍为安全隐患** | jimengTool.ts:166-168 |

#### Storyboard 参考管线

| # | 发现 | 位置 |
|---|------|------|
| P2-77 | `STORYBOARD_REFERENCE_ROLE_BINDINGS` 结构优秀 — 每 role 有明确的 `useFor`/`ignoreFor`/`conflictRule` | storyboardReferencePipeline.ts:68-100+ |
| P2-78 | `SEEDANCE_ALL_AROUND_REFERENCE_ORDER` 将 dialogue_audio 放在最后 — 符合"no BGM"策略 | storyboardReferencePipeline.ts:35-41 |
| P2-79 | `IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES` 正确禁止 `dialogue_audio` 和 `final_color_frame` 进入 storyboard | storyboardReferencePipeline.ts:30-33 |

#### 最终渲染管线

| # | 发现 | 位置 |
|---|------|------|
| P2-80 | `finalVideoRender.ts` ffmpeg timeout 只发 SIGTERM，无 SIGKILL 回退 — orphaned ffmpeg 进程风险 | finalVideoRender.ts:216-221 |
| P2-81 | `exportBuilder.ts` 所有 future targets (FCPXML/EDL/Premiere/Jianying/DaVinci) 正确设为 `future_placeholder` | exportBuilder.ts:408-446 |
| P2-82 | `checkpointResumeHarness.ts` 整个 harness 只接受 `ImageTaskPlan` 输入 — 无法恢复 Seedance 视频任务 | checkpointResumeHarness.ts:121 |
| P2-83 | Audio 混合 `volume=0.35` 硬编码 — BGM 音量不可配置 | finalVideoRender.ts:107 |

---

---

## 第四阶段 — 7 个 Deep-Dive Agent 并行审查（2026-05-23 第四轮）

以下为 7 个后台 agent 对 runtime server 完整代码（29,523行）、错误处理、React 状态、Project.vibe 往返、导出管线、Agent Loop 安全、App.tsx 性能的深度分析结果。

---

### P0 新增 — Agent 深度分析发现

#### P0-13: Runtime server 无 `uncaughtException`/`unhandledRejection` 处理器 → 静默崩溃

- **文件：** `electron-runtime/local-runtime-api-server.mjs`
- **现象：** 整个 29,523 行 runtime server 没有 `process.on('uncaughtException')` 和 `process.on('unhandledRejection')` handler。唯一的 process 事件是 SIGINT/SIGTERM shutdown。任何未捕获的异常或未处理的 promise rejection 都会导致 server 进程直接崩溃。
- **影响：** 在本地使用中，runtime server 崩溃 = 所有 provider 调用、文件读写、凭据管理全部中断。用户看到的是"无缘无故不工作"。
- **修法：** 添加全局异常处理器，记录错误并尝试优雅恢复，而非直接崩溃
- **验收：** 注入故意抛出的异常，验证 server 继续运行

#### P0-14: 8 处未处理的 Promise Rejection（UI 初始化链）

- **文件：** `src/ui/app/useCurrentProjectRuntimePanels.ts:84,90,93,129,132,135`, `src/ui/diagnostics/SettingsShell.tsx:157`, `src/core/sandboxWatcherNode.ts:47`
- **现象：** `.then()` 调用链没有 `.catch()`，promise rejection 无人处理。每次组件挂载都会触发 6 个初始化调用，任何一个失败都是 unhandled rejection。
- **影响：** 静默的状态不一致——runtime state 可能加载失败但 UI 显示空白而非错误
- **修法：** 所有 `.then()` 链追加 `.catch()` 并更新对应错误状态，或将初始化逻辑移入带错误处理的 async function
- **验收：** 断开 runtime server 后挂载组件，验证 UI 显示错误状态而非空白

#### P0-15: `JSON.parse` on LLM output 无 try/catch → director storyboard plan 崩溃

- **文件：** `src/core/directorAiStoryboardPlanner.ts:143`, `src/core/directorAiStoryboardClient.ts:14-28`
- **现象：** `extractJsonObject()` 对 LLM 返回的文本做 `JSON.parse(source.slice(start, end + 1))`，完全没有 try/catch。`requestDirectorAiStoryboardPlan()` 调用 `fetchRuntimeJson()` 和 `normalizeDirectorAiStoryboardPlan()` 也没有 try/catch。
- **影响：** LLM 返回格式异常 → JSON.parse 抛异常 → 整个 storyboard planning 流程崩溃
- **修法：** `extractJsonObject` 加 try/catch 返回 fallback；`requestDirectorAiStoryboardPlan` 加 try/catch
- **验收：** 模拟 LLM 返回非 JSON 文本，验证不崩溃且返回可读错误

#### P0-16: 全 UI 无 React Error Boundary → 任何组件异常卸载整棵树

- **文件：** 全部 `src/ui/` 目录（grep `ErrorBoundary` 返回 0 匹配）
- **现象：** 整个项目没有任何 `ErrorBoundary` component。任何未捕获的 React 渲染异常会导致整个 component tree 以上部分全部卸载。
- **影响：** 深层 panel（如 MinimalAgentPanel 14 个 state）中的一个 crash → 白屏
- **修法：** 在 director view、inspector panel、settings shell 等关键子树包裹 ErrorBoundary
- **验收：** 注入渲染异常，验证只有对应子树显示 fallback UI，其余部分正常工作

#### P0-17: `runLocalExportAction` 无 try/catch → export 失败时 UI 永久卡在 "running"

- **文件：** `src/App.tsx:2632`
- **现象：** `runLocalExportAction()` 直接调用 `runExportAction()` 没有任何 try/catch。若导出过程抛异常，`exportActionState` 永久停留在 `"running"`。
- **影响：** 用户界面不可逆地卡住，无法重试或取消
- **修法：** 加 try/catch，失败时设置 `exportActionState` 为 `"failed"`

#### P0-18: Runtime server `running` flag 在 Seedance path 可能永久 stuck

- **文件：** `electron-runtime/local-runtime-api-server.mjs`（Seedance submit handler）
- **现象：** 全局 `let running = false` 控制 Seedance/TTS/005 verify 的互斥。但 Seedance submit 路径的 `setRunning(false)` 不在 `finally` 块中，若异常在 try/catch 之外抛出，`running` 永久为 `true`。
- **影响：** 所有后续 Seedance/TTS/verify 操作被永久阻塞
- **修法：** `setRunning(false)` 移入 `finally` 块

#### P0-19: `prototypeProjectDraftStatus` orphan state → ~20 次无意义全 App 重渲染

- **文件：** `src/App.tsx:1694`
- **现象：** `const [_, setPrototypeProjectDraftStatus] = useState<PrototypeProjectDraftStatus>(...)` — 值被 destructure 为 `_`（丢弃），仅 setter 被使用。~20 个 call site 调用 `setPrototypeProjectDraftStatus(...)` 触发的重渲染无任何可观察效果。
- **影响：** ~20 次不必要的全 App component tree 重渲染，浪费 CPU/内存
- **修法：** 替换为 `useRef` 或移除（如果下游不依赖此重渲染作为 side effect）

#### P0-20: `newVideoStagedTransaction` orphan state — 值从不被读取

- **文件：** `src/App.tsx:1705`
- **现象：** `newVideoStagedTransaction` 的 setter 在两处被调用，但值从不被任何渲染输出或 effect 读取
- **影响：** 每次设置触发无意义重渲染
- **修法：** 将值移入 ref 或直接删除

#### P0-21: 005 verify 脚本 spawn 无 timeout 无 kill → orphaned 进程风险

- **文件：** `electron-runtime/local-runtime-api-server.mjs:9649`
- **现象：** `spawn(process.execPath, [verifyScriptPath])` 无 `timeoutMs`、无 `maxBuffer`、无 SIGKILL 回退。如果 verify 脚本挂起，子进程永远不被清理。
- **影响：** 资源泄露，且 `running` flag 永远 stuck
- **修法：** 加 timeout + SIGTERM/SIGKILL + maxBuffer 限制

---

### P1 新增 — Agent 深度分析发现

#### Agent Loop & 安全

| # | 发现 | 位置 |
|---|------|------|
| P1-18 | 用户确认 gate 在生产环境中从未启用 — `requireToolApproval` config flag 在所有 caller 中均为默认 undefined，所有工具调用自动批准 | agentLoop.ts:137, ownedAgentLoop.ts:366, agentRuntime.ts:101 |
| P1-19 | Agent 状态完全无持久化 — 无 `save()`/`load()` 方法，crash 后所有 messages/traces/results 全部丢失 | sessionManager.ts, agentLoop.ts |
| P1-20 | Context compaction 丢弃中间消息且不做摘要 — 简单的 naive sliding window，丢失的 context 无法恢复 | sessionManager.ts:136-143 |
| P1-21 | 工具输出无任何 sanitization — LLM 直接接收任意工具输出作为 context 注入 | toolRegistry.ts:169, sessionManager.ts:26-32 |

#### Runtime Server 关键缺陷

| # | 发现 | 位置 |
|---|------|------|
| P1-22 | Seedance CLI path 来自用户输入 (`input?.cliPath`) → 可执行任意二进制 | runtime-api-server:26665 |
| P1-23 | SIGTERM 后无 SIGKILL 回退 — Seedance/TTS/verify 子进程若忽略 SIGTERM 则永久运行 | runtime-api-server:26615,28030,28452 |
| P1-24 | Reference images 整文件读入内存无上限 — 大文件可致 OOM | runtime-api-server:2585 |
| P1-25 | Runtime 输出文件永不清理 — `.vibe-runtime/`, `assets/generated/`, `provider_observations/` 等累积无界 | runtime-api-server:755 (clear 只重置 binding) |
| P1-26 | 错误消息泄露内部细节给 client — `error.message` 原样返回给前端 | runtime-api-server 多处 |

#### 导出管线

| # | 发现 | 位置 |
|---|------|------|
| P1-27 | 导出管线全链路无进度报告 — `executeExportWorkerPlan()` 依次执行条目无事件/回调 | exportWorker.ts |
| P1-28 | 导出无取消机制 — 唯一停止方式是杀进程（ffmpeg 有 timeout 但无外部 cancellation signal） | exportWorker.ts, finalVideoRender.ts |
| P1-29 | 导出失败条目无重试逻辑 — 错误被收集但不会重新执行 | exportWorker.ts |
| P1-30 | `sha256File()` 将整个视频文件读入内存 — 大视频文件可致 OOM | finalVideoRender.ts |

#### React 状态管理

| # | 发现 | 位置 |
|---|------|------|
| P1-31 | ~10 个 async callback 存在 stale closure 风险 — `await` 后继续使用创建时捕获的 state | App.tsx:2040,2522,2648,2755,2924,3040 |
| P1-32 | `forgetProjectFileRoot` 遗漏 `realImage2Gate`、`newVideoStagedTransaction`、`exportActionState` 重置 | App.tsx:3254-3271 |
| P1-33 | `selectedShotId` 完全可从 `selectedShotIds[0]` 派生，但双方被手动同步在 5+ 处 | App.tsx:1712-1713,2507,2608,3085 |

#### Project.vibe 往返

| # | 发现 | 位置 |
|---|------|------|
| P1-34 | `projectReadyForNewStory` 销毁现有故事 — 每次新草稿强制全量替换，不能增量更新 | newVideoProjectVibePlanner.ts |
| P1-35 | `manifest.updatedAt` 每次 transaction 被覆盖，原始值丢失 | projectVibe.ts |
| P1-36 | `sourceIndex` 每次 save 被完全重建并 sort 所有 ref 数组，原始顺序和值丢失 | projectVibe.ts:refreshProjectVibeSourceIndex |

#### 错误处理

| # | 发现 | 位置 |
|---|------|------|
| P1-37 | `fetchJson`/`postJson` 使用 try/finally 无 catch → HTTP 错误未被捕获 | webSearchTool.ts:206-245 |
| P1-38 | `projectImage2Actions.ts` 11 个 catch {} 全部为空 — 任何错误被无声丢弃，返回中文 fallback | projectImage2Actions.ts:52-352 |
| P1-39 | 多个 client 函数用 catch {} 丢弃所有错误 → 调用者只能看到 fallback 值 | providerCredentialsClient.ts, projectCurrentBindingClient.ts, projectVideoClient.ts |

---

### P2 新增 — 第四轮 Deep-Dive 发现

| # | 发现 | 位置 |
|---|------|------|
| P2-84 | Runtime server 无 PUT 路由 — 全部 mutation 用 POST/DELETE（有意的，非 bug） | runtime-api-server |
| P2-85 | `scope` 参数在 file serving 中可绕过当前 binding — `?scope=real-demo-e2e-005` | runtime-api-server:29470 |
| P2-86 | `providerId` 在 credential POST 中无 whitelist 验证 — 任意 string 可写入 | runtime-api-server:11082 |
| P2-87 | Server shutdown 不等待 in-flight 请求完成也不 kill 子进程 | runtime-api-server:29519-29521 |
| P2-88 | `exportBuilder.ts` 和 `previewExport.ts` 实现重复逻辑（formal gating、profile building）— 应合并 | exportBuilder.ts, previewExport.ts |
| P2-89 | TTS 管线完全 planned、从不 executed — 所有 provider 有 `providerSubmissionForbidden: true` | ttsProviderPlanning.ts |
| P2-90 | 错误消息中英文混杂 — 用户可见消息为中文，内部 blocker 为英文 | exportBuilder.ts, runtime-api-server |
| P2-91 | Agent 无工具优先级/访问控制 — LLM 可调用任何注册工具 | toolRegistry.ts |
| P2-92 | `useCurrentProjectRuntimePanels.ts` preview 轮询 6s interval — 快速切换视图会产生多余 API 调用 | useCurrentProjectRuntimePanels.ts:143-162 |
| P2-93 | `MinimalAssetLibrary` 的 `constraintDraft` effect 依赖数组引用可能每次 render 变化 → 覆盖未保存编辑 | MinimalAssetLibrary.tsx:101 |
| P2-94 | `MinimalAgentPanel` 存储 `File` 对象在 React state — 大文件直到 unmount 才被 GC | MinimalAgentPanel.tsx:154 |
| P2-95 | `NewVideoStart.tsx` 有 24 个 useState + 多个未读变量 — 应 consolidate | NewVideoStart.tsx |
| P2-96 | `MinimalPreview` 中 `currentTime` ref sync effect 冗余 — animation frame 已直接更新 ref | MinimalPreview.tsx:131-133 |
| P2-97 | App.tsx ~20 个 useMemo 包裹 O(n) 小数组的 trivial computation — memoization 开销超过计算 | App.tsx |
| P2-98 | `storyboardReferenceForShot` 在 MinimalStoryFlow render 中对同一数据执行两次数组搜索 | MinimalStoryFlow.tsx:360,386 |
| P2-99 | Runtime server 无文件大小限制在 file serving `createReadStream` — 超大文件可流式传输 | runtime-api-server:9318 |
| P2-100 | `readdirSync` 在 Seedance submit 中无深度限制 — 递归遍历视频文件 | runtime-api-server:26643 |
| P2-101 | 无 project.vibe 完整往返测试 — 现有测试仅覆盖单向 Document→Runtime | project-vibe-runtime-state-test.mts |
| P2-102 | Runtime server 错误响应中 `error.message` 原样泄露到 HTTP response body | runtime-api-server 多处 |

---

## 第五阶段 — 补充 Agent 深度分析（2026-05-23 第五轮）

以下为另 4 个后台 agent 对 Seedance 提交、Image2 管线、核心路由、App.tsx 深层性能的补充分析结果。

---

### P0 新增 — 补充 Agent 发现

#### P0-22: Seedance 串行队列 TOCTOU 竞态条件 → `maxConcurrentVideoJobs: 1` 可能被绕过

- **文件：** `scripts/runtime-routes/current-project-seedance-submit.mts:457-499`
- **现象：** `runtimeState()` check 和 `setRunning(true)` 之间不同原子。两个并发请求在 `await` yield event loop 时可能同时通过检查，然后两者都执行。
- **影响：** 串行队列保证被打破，两个 Seedance 作业可能并发提交，导致 provider 侧资源竞争或重复计费
- **修法：** 使用 promise-based mutex 或将 check+set 合并为原子操作（在同步代码块中完成）

#### P0-23: `agent-web-search.mts` 模块级 `mkdirSync` → 服务器启动崩溃

- **文件：** `scripts/runtime-routes/agent-web-search.mts:50`
- **现象：** `mkdirSync` 在模块 import 时执行（非 lazy）。若 `.vibe-runtime/web-search` 目录因权限问题无法创建，整个 server 启动崩溃。
- **影响：** 即使不使用 web search 功能，服务器也无法启动
- **修法：** 将 `mkdirSync` 移入首次请求时的 lazy init

#### P0-24: 5 条 runtime route handler 全无 try/catch → HTTP response 挂起

- **文件：** `credentials.mts`, `agent-web-search.mts`, `director-storyboard-plan.mts`, `local-index-tts.mts`, `local-qwen3-tts-clone.mts`
- **现象：** 所有 handler 对依赖函数（如 `readRequestJsonBody`、`writeFileSync`）的调用均无 try/catch。依赖异常传播到顶层 `.catch()` 返回 500，但调用方无法区分失败类型。
- **影响：** 慢速/恶意 client 可通过不发送 body 永久挂起 `readRequestJsonBody`（无超时），阻塞其他请求
- **修法：** 所有 handler 包裹 try/catch + `readRequestJsonBody` 加 `AbortSignal.timeout`

---

### P1 新增 — 补充 Agent 发现

| # | 发现 | 位置 |
|---|------|------|
| P1-40 | Image2 管线 provider 默认值不一致 — `image.generate` = `"lanyi-image2"`，`image.edit` = `"openai-image2-api"`，但 end-frame submit 默认也用 `"lanyi-image2"`，与 `providerPolicy.ts` 的 `image.edit` 规则不匹配 | assets-generate.mts, end-frame-submit.mts, providerPolicy.ts |
| P1-41 | TTS 子进程接收完整 `process.env` (包括所有 API keys/paths) — 恶意 Python 包可读取所有主机密钥 | local-qwen3-tts-clone.mts:216-217 |
| P1-42 | 所有 5 条 POST 路由的 `readRequestJsonBody` 均无超时 — 慢速 client 可永久阻塞 | credentials.mts, agent-web-search.mts, director-storyboard-plan.mts, index-tts.mts, qwen3-tts-clone.mts |
| P1-43 | TTS speaker/reference 音频路径无范围限制 — `path.resolve(filePath)` 未进行路径穿越检查，可能读取系统文件 | local-index-tts.mts:80-85, local-qwen3-tts-clone.mts:92-99 |
| P1-44 | TTS `running` flag 管理不一致 — Qwen3 路线用 `finally` 保证重置，IndexTTS 路线手动重置易遗漏 | index-tts.mts:298-353, qwen3-tts-clone.mts:418-420 |
| P1-45 | Seedance CLI timeout (150s) 与队列预期等待 (50min) 严重不符 — CLI 会被提前杀死，结果解析依赖部分输出 | current-project-seedance-submit.mts:647,640 |

---

### P2 新增 — 补充 Agent 发现

| # | 发现 | 位置 |
|---|------|------|
| P2-103 | Image2 asset generator 对 `specs.slice(0, 3)` 限制 — 超过 3 个缺失参考资产会被静默丢弃 | runtime-api-current-project-image2-assets-generate.mts:258 |
| P2-104 | Image2 硬编码宽高比 16:9、尺寸 1280x720、质量 "low" — 无 project/shot 级覆盖 | image2-assets-generate.mts, providerPolicy.ts |
| P2-105 | Image2 visualMemory/storyFlow 的 read-modify-write 无文件锁 — 并发请求会互相覆盖 | assets-generate.mts:429-601, end-frame-submit.mts:584 |
| P2-106 | 所有 5 个 Image2 文件各自定义 `isRecord` 函数（细节略有不同）— 代码重复且脆弱 | 全部 5 个 Image2 runtime 文件 |
| P2-107 | Seedance `shots.slice(0, 4)` 硬限制 — 超过 4 个 shot 静默截断 | current-project-seedance-submit.mts:447 |
| P2-108 | Seedance report 文件在多个阶段重复写入同一路径 — 中途崩溃可能留下错误状态 | current-project-seedance-submit.mts:566,685,767 |
| P2-109 | 全局 `running` flag 无意义地序列化所有 TTS + Seedance + 005 verify — 互不冲突的操作被彼此阻塞 | local-runtime-api-server |
| P2-110 | Hardcoded Chinese blocker 文本携带测试阶段假设（"本轮测试只允许 720p"、"不使用 VIP"）— 应移入配置 | current-project-seedance-submit.mts:458-464 |
| P2-111 | `director-storyboard-plan.mts` 在失败时返回 HTTP 200（带 `ok: false` body）— 中间件/代理无法区分成败 | director-storyboard-plan.mts:651 |

---

## 最终统计（全部五轮审查）

| 严重级别 | 第一轮 | 第二轮 | 第三轮 | 第四轮 | 第五轮(补充) | 合计 |
|---------|--------|--------|--------|--------|------------|------|
| P0 (阻断) | 6 | 3 | 3 | 9 | **3** | **24** |
| P1 (体验/完整性) | 11 | 6 | 5 | 22 | **6** | **50** |
| P2 (技术债) | 31 | 34 | 18 | 19 | **9** | **111** |
| **总计** | **48** | **43** | **26** | **50** | **18** | **185** |

---

## 一句话结论

**经过五轮审查（18 + 6 + 直接分析 20+ 文件 + 7 agents + 4 agents），共计发现 185 个问题。最危险的四个问题仍然是：P0-1（spread undefined crash）、P0-13（server 无全局异常处理）、P0-14（8 处 unhandled rejection）、P0-18（running flag 永久 stuck）。新增最关键的发现是 P0-22（Seedance 串行队列 TOCTOU race）和 P0-24（5 条 route handler 无 try/catch + 无 timeout），两者均可能导致真实使用中的静默故障。**
