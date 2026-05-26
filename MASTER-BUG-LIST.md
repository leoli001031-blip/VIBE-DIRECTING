# Vibe Director Studio — 完整 Bug 汇总

**汇总日期:** 2026-05-23
**来源:** REVIEW-FINDINGS.md (185 issues) + 架构梳理新发现 (10 issues) + explore agent 新发现 (3 issues)
**去重后总计:** 198 个问题

---

## P0 — 阻断真实项目使用 (27 个)

### 运行时崩溃

| # | 问题 | 文件:行 | 现象 |
|---|---|---|---|
| 1 | `spread undefined` 两处导致 runtime crash | `runtimeTruthLayer.ts:541,609` | `{...observation}` 当 observation 为 undefined → TypeError |
| 2 | Runtime server 无 uncaughtException/unhandledRejection handler | `local-runtime-api-server.mjs` | 29,523 行无全局异常处理，任何异常 → 进程崩溃 |
| 3 | 8 处 unhandled Promise rejection (UI 初始化链) | `useCurrentProjectRuntimePanels.ts:84,90,93,129,132,135` + `SettingsShell.tsx:157` + `sandboxWatcherNode.ts:47` | `.then()` 无 `.catch()`，初始化失败 → 静默空白 |
| 4 | JSON.parse LLM output 无 try/catch | `directorAiStoryboardPlanner.ts:143` | LLM 返回非 JSON → 整个 storyboard planning 崩溃 |
| 5 | 全 UI 无 Error Boundary | 所有 `src/ui/` | 任何组件异常 → 整棵树卸载 → 白屏 |
| 6 | `runLocalExportAction` 无 try/catch | `App.tsx:2632` | 导出失败 → `exportActionState` 永久 "running" |
| 7 | `style-research-preflight:test` crash 阻断 verify:mvp | `style-research-preflight-test.mts:269` | `.prompt` 访问 undefined，41 个测试被阻断 |
| 8 | 根目录 `main.mts` dead code，import 会崩溃 | `main.mts:9` | imports `./projectScope.mts`（不在根目录），直接 crash |

### 并发/竞态

| # | 问题 | 文件:行 | 现象 |
|---|---|---|---|
| 9 | 6 个 async handler 闭包捕获 `prototypeProjectVibe` → 静默数据丢失 ⚠️ 新发现 | `App.tsx:2040,2522,2648,2755,2924,3040` | 快速连续操作 → 第二个覆盖第一个，无 error |
| 10 | 打开无 project.vibe 的目录 → 不可恢复空白 ⚠️ 新发现 | `App.tsx:3113-3157` | state 在 async 前清空，connect 失败后旧项目也丢了 |
| 11 | useEffect 项目初始化竞态 ⚠️ 新发现 | `App.tsx:2185-2292` | 两轮 openOrInitializeProjectDraft() 并发执行互相覆盖 |
| 12 | Seedance running flag 可能永久 stuck | `local-runtime-api-server.mjs` (Seedance handler) | `setRunning(false)` 不在 finally，running 永久 true |
| 13 | Seedance TOCTOU 竞态 → maxConcurrentVideoJobs:1 被绕过 | `current-project-seedance-submit.mts:457-499` | check 和 set 不原子，并发请求可同时通过 |
| 14 | 5 条 route handler 无 try/catch + readRequestJsonBody 无超时 | `credentials.mts`, `agent-web-search.mts`, `director-storyboard-plan.mts`, `local-index-tts.mts`, `local-qwen3-tts-clone.mts` | 慢速 client 不发送 body → 永久挂起 |

### 安全/隔离

| # | 问题 | 文件:行 | 现象 |
|---|---|---|---|
| 15 | projectRootScope 永不 forget → 跨项目文件访问 | `electron/projectScope.mts:14-34`, `electron/main.mts:56-57` | 忘记 A → 打开 B → IPC 仍可读写 A 文件 |
| 16 | spawnAllowed 允许 node 零参数 → REPL 泄露 | `electron/projectScope.mts:40` | `args.length === 0` → 启动永不退出的 REPL |
| 17 | Electron 无 CSP 头 | `electron/main.mts:438-460` | XSS 可访问 preload bridge |

### 状态管理

| # | 问题 | 文件:行 | 现象 |
|---|---|---|---|
| 18 | forgetProjectFileRoot 15+ state 未重置 | `App.tsx:3254-3271` | 忘记 A → 打开 B → B 显示 A 的残留数据 |
| 19 | prototypeProjectDraftStatus orphan state → ~20 次无意义重渲染 | `App.tsx:1694` | _ 丢弃值，仅 setter 被调用，触发全树重渲染 |
| 20 | newVideoStagedTransaction orphan state | `App.tsx:1705` | 值从不被读取，每次 set 触发无意义重渲染 |
| 21 | Agent 所有工具调用在生产中自动批准 | `agentLoop.ts:228-237` | Agent 可 spawn 进程、写文件、调 provider |
| 22 | module-level mkdirSync → server 启动崩溃 | `agent-web-search.mts:50` | 权限问题 → server 无法启动 |
| 23 | 005 verify spawn 无 timeout 无 kill | `local-runtime-api-server.mjs:9649` | 脚本挂起 → process 泄露 + running flag stuck |

### 构建系统

| # | 问题 | 文件:行 | 现象 |
|---|---|---|---|
| 24 | esbuild 不是直接依赖 | `build-electron-app.mts:1` | tsx/vite 依赖变化 → 构建崩溃 |
| 25 | runtime server 未最小化 1.2MB | `build-electron-runtime-server.mts` | 无 minify: true |
| 26 | 6.4MB runtime-state.json 每次构建复制到 dist | `public/runtime-state.json` | 发布包携带测试数据 |
| 27 | deterministicTimestamp 使用 epoch 默认值 | `directorSession.ts:100` | "1970-01-01" 作为默认时间戳 |

---

## P1 — 影响体验/数据完整性 (55 个)

### 数据完整性与转换丢失

| # | 问题 | 文件:行 |
|---|---|---|
| 28 | ProjectVibeShot → ShotRecord 丢失 15+ 字段: camera, executionMode, rhythmProfile, splitPolicy, actionBeats, primaryAction, actionTrigger, microReaction, seedanceDirection, directorFeedbackDirectives, characterGuidance, sceneGuidance, propGuidance, durationSeconds, sourceRefs | `projectVibePlanningProjection.ts:92-126` |
| 29 | toAssetRecord() 丢失 roleBinding | `projectVibeRuntimeState.ts:73-87` |
| 30 | rejected 资产状态映射错误 (→ "planned"/"needs_review") | `projectVibeRuntimeState.ts:47-53` |
| 31 | projectVibeToProjectAudit 不验证字段存在性 → 损坏 JSON 直接 crash | `projectVibeRuntimeState.ts:132-176` |
| 32 | sourceIndex 每次保存完全重建 → 原始顺序和值丢失 | `projectVibe.ts:688-691` |
| 33 | sourceIndexHash 硬编码 "" | `projectVibeRuntimeState.ts:117` |
| 34 | currentPromptHashes 硬编码 {} | `projectVibeRuntimeState.ts:121` |
| 35 | staleArtifactIds 硬编码 [] | `projectVibeRuntimeState.ts:127` |
| 36 | runtime-state.json 只存 cache policy 不存完整 state ⚠️ 新发现 | `projectStoreIo.ts:287-289` |
| 37 | empty snapshot 在有 bug 的 blocker 下可能覆盖真实数据 | `projectStoreIo.ts:611-613` |

### 状态持久化与一致性

| # | 问题 | 文件:行 |
|---|---|---|
| 38 | ProjectVibeShot 无 referenceStrategy typed 字段 → 跨 session 漂移 | `project/types.ts:95-125` |
| 39 | referenceStrategy 降级为中文字符串塞进 directorFeedbackDirectives | `newVideoProjectVibePlanner.ts:669-670` |
| 40 | applyProjectVibeTransaction validation 失败 → caller 不检查 receipt.status ⚠️ 新发现 | `projectVibe.ts:212-258` |
| 41 | selectedShotId 在 5+ 处手动同步，可从 selectedShotIds[0] 派生 | `App.tsx:1712-1713,2507,2608,3085` |
| 42 | ~10 个 async callback 存在 stale closure 风险 (App.tsx) | `App.tsx:2040-3107` |
| 43 | 损坏的 shot 引用静默丢弃无 warning | `projectVibePlanningProjection.ts:200-201` |
| 44 | plannerNotes 在 rebuildPlannerPatchOperations 中被 strip | `newVideoProjectVibePlanner.ts:715` |

### Agent Loop

| # | 问题 | 文件:行 |
|---|---|---|
| 45 | Agent 状态无持久化 → crash 后全部丢失 | `sessionManager.ts`, `agentLoop.ts` |
| 46 | Context compaction 丢弃消息不做摘要 | `sessionManager.ts:136-143` |
| 47 | 工具输出无 sanitization → LLM 可能接收任意 context 注入 | `toolRegistry.ts:169`, `sessionManager.ts:26-32` |
| 48 | Tool dispatch 并行执行 → 同文件并发读写竞态 | `toolRegistry.ts:139` |
| 49 | maxTurns: 6/4 — 复杂多步骤任务可能不足 | `ownedAgentLoop.ts:158,371` |

### Runtime Server

| # | 问题 | 文件:行 |
|---|---|---|
| 50 | running flag 序列化无关操作 (Seedance↔TTS↔verify 互斥) | `local-runtime-api-server.mjs` |
| 51 | Seedance CLI path 来自用户输入 → 执行任意二进制 | `local-runtime-api-server.mjs:26665` |
| 52 | SIGTERM 无 SIGKILL 回退 (Seedance/TTS/verify 子进程) | `local-runtime-api-server.mjs:26615,28030,28452` |
| 53 | Reference images 整文件读入内存无上限 → OOM | `local-runtime-api-server.mjs:2585` |
| 54 | Runtime 输出文件永不清理 → 磁盘累积无界 | `local-runtime-api-server.mjs` |
| 55 | 错误消息泄露内部细节给 client | `local-runtime-api-server.mjs` 多处 |
| 56 | TTS 子进程接收完整 process.env → API keys 泄露 | `local-qwen3-tts-clone.mts:216-217` |
| 57 | TTS speaker/reference 音频路径无范围限制 | `local-index-tts.mts:80-85`, `local-qwen3-tts-clone.mts:92-99` |
| 58 | TTS running flag 管理不一致 (Qwen3 finally vs IndexTTS 手动) | `index-tts.mts:298-353`, `qwen3-tts-clone.mts:418-420` |
| 59 | Image2 visualMemory/storyFlow read-modify-write 无文件锁 | `assets-generate.mts:429-601` |
| 60 | Seedance CLI timeout (150s) vs 队列等待 (50min) 严重不符 | `current-project-seedance-submit.mts:647,640` |
| 61 | Image2 provider 默认值不一致 (generate="lanyi-image2", edit="openai-image2-api") | `assets-generate.mts`, `end-frame-submit.mts` |

### 导出管线

| # | 问题 | 文件:行 |
|---|---|---|
| 62 | 导出无进度报告 | `exportWorker.ts` |
| 63 | 导出无取消机制 (唯一停止是杀进程) | `exportWorker.ts`, `finalVideoRender.ts` |
| 64 | 导出失败无重试 | `exportWorker.ts` |
| 65 | sha256File 读整个视频进内存 → OOM | `finalVideoRender.ts:82` |
| 66 | ffmpeg timeout 只 SIGTERM 无 SIGKILL → orphan 进程 | `finalVideoRender.ts:216-221` |

### 安全/凭据

| # | 问题 | 文件:行 |
|---|---|---|
| 67 | jimengTool extraArgs 直接展开到 CLI 无白名单 | `jimengTool.ts:166-168` |
| 68 | jimengTool outputPath 无沙箱转义检查 | `jimengTool.ts:89` |
| 69 | __VIBE_RUNTIME_API_BASE_URL__ 按值暴露不更新 | `electron/preload.mts:21`, `runtimeApiClient.ts:118` |
| 70 | waitForRuntimeStatus fetch 无单次超时 | `electron/main.mts:380` |

### 领域逻辑

| # | 问题 | 文件:行 |
|---|---|---|
| 71 | comedy_reaction/commercial_short 永远 fallthrough 到 omni | `directorProductionSkill.ts:201-248` |
| 72 | BGM 禁止仅靠 prompt text，无 boolean lock | `directorProductionSkill.ts:292,305` |
| 73 | quiet_dialogue + 高动作密度 → 错误路由到 rapid_cut | `directorRhythmPlanner.ts:83-90` |
| 74 | 节奏规划器 BGM 理由文本误导 (音乐标签实际参与评分) | `directorRhythmPlanner.ts:139-141` |
| 75 | 脚本切割上限 slice(0,10) 硬确认 | `directorSession.ts:353-354` |
| 76 | projectReadyForNewStory 销毁所有现有故事 → 不能增量 | `newVideoProjectVibePlanner.ts:183-204` |
| 77 | 流式请求双失败时原始错误被丢弃 ⚠️ 新发现 | `director-storyboard-plan.mts:336-347` |
| 78 | streamFallbackReason 在 stream 成功时为 undefined ⚠️ 新发现 | `director-storyboard-plan.mts:447,617` |
| 79 | runtimeTruthLayer QA gate keys 与 GateSet 不匹配 | `runtimeTruthLayer.ts:302` |

### 错误处理

| # | 问题 | 文件:行 |
|---|---|---|
| 80 | fetchJson/postJson try/finally 无 catch → HTTP 错误未捕获 | `webSearchTool.ts:206-245` |
| 81 | projectImage2Actions.ts 11 个 catch {} 全为空 | `projectImage2Actions.ts:52-352` |
| 82 | 多个 client 函数用 catch {} 丢弃所有错误 | `providerCredentialsClient.ts`, `projectCurrentBindingClient.ts`, `projectVideoClient.ts` |

---

## P2 — 技术债/不阻塞交付 (116 个)

### 类型系统 (5)
| # | 问题 |
|---|---|
| 83 | PromptConflictSeverity 与 Severity 完全相同 |
| 84 | SubagentIssue.severity (P0/P1/P2) vs Severity (blocker/warning/info) 不一致 |
| 85 | GenerationJob.status, ShotRecord.status 各自独立不共享 |
| 86 | qaReviewStatusForLedger 是恒等函数 (死代码) |
| 87 | envelopeProductionGate allPassed 和 valid 值重复 |

### 安全/凭证 (5)
| # | 问题 |
|---|---|
| 88 | API 密钥以明文 JSON 存储在 ~/.vibe-director/credentials.json |
| 89 | 凭证通过 HTTP (非 HTTPS) 传输到 localhost runtime |
| 90 | VITE_VIBE_*_RUNTIME_API_TOKEN 泄露到前端构建产物 |
| 91 | use-mock-keychain 在发布版也始终启用 |
| 92 | API key 在 getMaskedKey 前的 in-memory 曝光 |

### 构建/配置 (6)
| # | 问题 |
|---|---|
| 93 | vite.config.ts 硬编码 fallback 路径 |
| 94 | schemaRegistry.ts 从未被 import，schemas/ 964KB 全文档 |
| 95 | real_demo_e2e.schema.json 在磁盘但不在 registry |
| 96 | tsconfig 缺少 noUncheckedIndexedAccess、noUnusedLocals |
| 97 | core-runtime chunk 1,059 KB 超阈值 |
| 98 | 无 macOS 代码签名/公证配置 |

### UI/交互 (6)
| # | 问题 |
|---|---|
| 99 | SettingsShell "工程设置明细" 暴露 providerId、envKey、baseUrl |
| 100 | minimal-ui:test 报告 Diagnostics 工程术语数 1400 (Director=0) |
| 101 | 旧 startFrame/endFrame 在 ShotRecord、directorEdit、directorWorkflow |
| 102 | SubagentRunnerTaskKind 仍含 start_frame/end_frame |
| 103 | lanyiImage2AgentTool.ts 默认 model "gpt-image-2" 是假名 |
| 104 | 全部 UI 文本硬编码中文，无 i18n |

### 测试 (6)
| # | 问题 |
|---|---|
| 105 | preview-export-audio-e2e-test.mts 断言 >=0 始终为真 |
| 106 | preview-export-audio-e2e-test.mts 多处 as any 绕过类型 |
| 107 | new-video-golden-path-test.mts 硬编码 runnable.length >= 2 |
| 108 | 几乎所有测试用模拟数据，无真实 provider 调用 |
| 109 | electron-project-scope:test 不覆盖 forget 场景 |
| 110 | 无 src/ 内单元测试，333 测试全在 scripts/ |

### Director 领域 (6)
| # | 问题 |
|---|---|
| 111 | directorFeedbackRecompile 硬编码 actionBeats |
| 112 | recompile guidance arrays 只追加不重置 |
| 113 | directorAnalysisEnvelope providerCalled: false 永不更新 |
| 114 | agentRuntime.ts 双重 as unknown as 绕过类型 |
| 115 | sourceIndex shotRefs/assetRefs/runReceiptRefs 不在映射逻辑 |
| 116 | assetRecordType default: "unknown" 对 reference 类型不友好 |

### CSS/样式 (10)
| # | 问题 |
|---|---|
| 117 | .field-grid grid-template-columns 冲突 (180px vs 80px) |
| 118 | .minimal-shell 三次重定义，三套不同颜色方案 (前两套死代码) |
| 119 | ~40 处非标准 font-weight (650/750/760) |
| 120 | ProjectRealChainPanel.css 大面积颜色对比度不达标 |
| 121 | 无 prefers-reduced-motion 支持 |
| 122 | 8 处 outline: none 无 :focus-visible 回退 |
| 123 | 数十个 phase 编号 CSS 类疑似死代码 |
| 124 | --studio-* CSS 变量在定义前被引用 |
| 125 | .text-caption, .nav-label, .button-text, .status-label 未使用 |
| 126 | 多处 font-synthesis: none 阻止 faux-bold/faux-italic |

### Schema/数据 (6)
| # | 问题 |
|---|---|
| 127 | 103 个 schema 文件 (756 KB) 从未被加载/验证 |
| 128 | director_workflow.schema.json 3 个 required 字段无 properties |
| 129 | real_demo_e2e.schema.json $id 域名不一致 |
| 130 | buildDefaultToolDetectionReport 使用 new Date(0) |
| 131 | 无自动化 schema 交叉引用验证 |
| 132 | adapter_contract.schema.json 硬编码 provider 特定逻辑 |

### 资源/文档/示例 (6)
| # | 问题 |
|---|---|
| 133 | 6 个 docs 标记为历史/废弃 |
| 134 | schema-contracts.md 只提 8 个 schema，实际 107 个 |
| 135 | sample-projects propAssetIds 引用 kind:"style" 资产 |
| 136 | codex-cli-execution-boundary.md 引用已废弃架构 |
| 137 | 缺少开发者入门指南、API 文档、CHANGELOG |
| 138 | knowledge_pack_manifest.json 408 KB 且未打包进 asar |

### Agent Loop (4)
| # | 问题 |
|---|---|
| 139 | providerCalledFromTrace 检查 image2_generate (已被 filter) |
| 140 | createOwnedAgentToolRegistry filter 掉 image2 又单独注册 |
| 141 | Agent 无工具优先级/访问控制 |
| 142 | 用户确认 gate 在生产中从未启用 |

### Jimeng/CLI 安全 (3)
| # | 问题 |
|---|---|
| 143 | jimengTool 错误消息含完整 CLI 命令 → 泄露路径 |
| 144 | jimengTool 路径解析正则 Windows 反斜杠失效 |
| 145 | extraArgs 直接展开无白名单 (P1 已列，此为重复提醒) |

### 导出/渲染管线 (5)
| # | 问题 |
|---|---|
| 146 | all future targets (FCPXML/EDL/Premiere/Jianying/DaVinci) = future_placeholder |
| 147 | checkpointResumeHarness 只接受 ImageTaskPlan → 无法恢复 Seedance |
| 148 | Audio 混合 volume=0.35 硬编码 |
| 149 | exportBuilder 和 previewExport 实现重复逻辑 |
| 150 | TTS 管线完全 planned 从不 executed |

### Runtime Server 补充 (12)
| # | 问题 |
|---|---|
| 151 | Runtime server 无 PUT 路由 (有意的) |
| 152 | scope 参数在 file serving 可绕过 binding |
| 153 | providerId 在 credential POST 中无 whitelist |
| 154 | Server shutdown 不等 in-flight 请求完成 |
| 155 | 错误消息中英文混杂 |
| 156 | 无 project.vibe 完整往返测试 |
| 157 | 错误响应 HTTP 200 + ok:false body → 中间件无法区分 |
| 158 | Image2 asset generator specs.slice(0,3) 硬限制 |
| 159 | Image2 硬编码 16:9 + 1280x720 + quality "low" |
| 160 | Image2 visualMemory/storyFlow read-modify-write 无锁 |
| 161 | Seedance shots.slice(0,4) 硬限制 |
| 162 | Seedance report 文件多阶段重复写入同路径 |
| 163 | Hardcoded Chinese blocker 文本含测试假设 ("本轮测试只允许 720p") |

### React/性能 (9)
| # | 问题 |
|---|---|
| 164 | App.tsx ~20 useMemo 包裹 O(n) trivial computation |
| 165 | MinimalStoryFlow 对同数据执行两次数组搜索 |
| 166 | MinimalAgentPanel 存储 File 对象在 React state |
| 167 | NewVideoStart.tsx 24 个 useState + 多个未读变量 |
| 168 | MinimalPreview currentTime ref sync effect 冗余 |
| 169 | preview 轮询 6s interval → 快速切换多余 API 调用 |
| 170 | MinimalAssetLibrary constraintDraft effect 覆盖未保存编辑 |
| 171 | Settings 弹窗无 focus trap、无 aria-modal |
| 172 | 无 aria-live 动态区域 |

### 基础设施 (6)
| # | 问题 |
|---|---|
| 173 | 无 CI/CD 配置 |
| 174 | 无 Windows 代码签名配置 |
| 175 | macOS 发布签名仅靠一次性检查 |
| 176 | public/media/ 两张 PNG 3.1 MB 未压缩 |
| 177 | 147 KB CSS 可能含未使用样式 |
| 178 | 知识包 snippets 与 .md 文件内容重复 |

### Audio/TTS (4)
| # | 问题 |
|---|---|
| 179 | TTS 3 个 provider 全为抽象占位符 |
| 180 | TTS providerSubmissionForbidden: true 全部 |
| 181 | Web Search 无速率限制、无缓存、无请求去重 |
| 182 | Audio 混合 volume=0.35 硬编码不可配置 |

### Storyboard 参考管线 (3)
| # | 问题 |
|---|---|
| 183 | STORYBOARD_REFERENCE_ROLE_BINDINGS 结构优秀 ✅ |
| 184 | SEEDANCE_ALL_AROUND_REFERENCE_ORDER dialogue_audio 在最后 ✅ |
| 185 | IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES 正确禁止 ✅ |

### 新发现 — 深层逻辑/边界 (13)

| # | 问题 | 文件:行 |
|---|---|---|
| 186 | saveProjectVibe mkdir + writeFile 非原子操作 → 并发 save 竞态 ⚠️ 新发现 | `projectVibe.ts:202-205` |
| 187 | 非标准 SSE delta 字段被当作内容拼接 ⚠️ 新发现 | `director-storyboard-plan.mts:61` |
| 188 | refreshProjectVibeSourceIndex 原地修改参数 ⚠️ 新发现 | `projectVibe.ts:688-691` |
| 189 | streamFallbackReason 属性可能不存在于流成功的路径 ⚠️ 新发现 | `director-storyboard-plan.mts:617` |
| 190 | assertProjectRuntimeState 414 行检查 → schema 变化直接 crash ⚠️ 新发现 | `App.tsx:510-924` |
| 191 | agent-web-search error 分类基于 pre-validation 状态 ⚠️ 新发现 | `agent-web-search.mts:89-99` |
| 192 | TOC-TOU video file path in Seedance submit ⚠️ 新发现 | `current-project-seedance-submit.mts:689-691` |
| 193 | API key passed to getMaskedKey → in-memory exposure window | `credentials.mts:57` |
| 194 | runtime server 无文件大小限制 in createReadStream | `local-runtime-api-server.mjs:9318` |
| 195 | readdirSync in Seedance submit 无深度限制 | `local-runtime-api-server.mjs:26643` |
| 196 | jimengTool 路径解析正则 replace(/\/[^/]*$/, "") Windows 失效 | `jimengTool.ts:89` |
| 197 | 所有 5 个 Image2 文件各自定义 isRecord 函数 (代码重复) | 5 个 Image2 runtime 文件 |
| 198 | Hardcoded "本轮测试只允许 720p" / "不使用 VIP" — 应入配置 | `current-project-seedance-submit.mts:458-464` |

---

## 统计

| 严重级别 | 数量 | 说明 |
|---------|------|------|
| P0 (阻断) | 27 | 运行时崩溃 + 并发竞态 + 安全隔离 + 状态管理 + 构建 |
| P1 (体验/完整性) | 55 | 数据丢失 + 无持久化 + 无取消/重试 + 错误处理 |
| P2 (技术债) | 116 | CSS + Schema + 测试 + 硬编码 + 性能 + 文档 |
| **总计** | **198** | |

---

## 修复路线建议

### 第一周 — 稳定运行 (修复 8 个最关键的 P0)
1. spread undefined crash (runtimeTruthLayer)
2. Runtime server 全局异常处理
3. UI 8 处 unhandled rejection
4. 闭包 state 覆盖
5. 打开空目录不可恢复
6. running flag 永久 stuck
7. route handler 无 timeout
8. JSON.parse LLM output crash

### 第二周 — 数据完整性 (修复 10 个 P0 + 关键 P1)
9. projectRootScope forget
10. forgetProjectFileRoot 完整重置
11. ShotRecord 字段保留
12. useEffect 竞态
13. referenceStrategy 持久化
14. Agent 工具批准
15. Error Boundary

### 第三周及以后 — 功能正确性 + 技术债
- 导出管线 (超时/取消/进度)
- Agent 持久化
- 安全加固 (CSP/Credential/TTS env leak)
- P2 批量清理
