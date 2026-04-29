# Vibe Core 功能遗漏审计 2026-04-30

审计角色：功能遗漏审计 subagent  
审计范围：当前对话上下文、`/Users/lichenhao/Desktop/vibe core` 当前规划与代码、`/Users/lichenhao/Desktop/Vibe Director` 资料、`/Users/lichenhao/Desktop/AGI 新人类` 方法论与测试记录线索。  
约束：未修改业务代码，未调用 provider，未生图/生视频。

## 结论摘要

当前 Vibe Core 的方向是对的：核心已经从“聊天记忆”转成了 schema、harness、adapter、watcher、QA、checkpoint、knowledge router 等硬约束。但仍有几个高风险缺口没有完全落到当前项目规划或代码实现里：

1. Phase 8.9 `Generation Health Checker` 和 Phase 8.10 `Prompt Conflict Checker` 仍停在架构文档，`core-development-sequence` 尚未写入实现完成范围。
2. Production Bible / Story Flow / Shot Spec / Shot Layout / Visual Memory / Spatial Memory / Voice Memory 仍缺第一类项目文件 schema，当前更多是 runtime 聚合状态，不是可迁移项目事实源。
3. AGI 视觉一致性方法论里的 master scene 派生、多视角锁定、世界坐标、身份/场景/首尾帧分门禁，还没有完整变成工程对象。
4. subagent task envelope 已经很强，但还主要在 video execution preview 中可见，缺少图片生成、资产生成、pair QA、scene QA 等生产任务的统一 packet generator 和强制入口。
5. UI 目前仍偏工程监控台；用户最初想要的极简 Story Flow / Visual Memory / Director Input / Preview 形态还没有成为默认主界面的硬规格。

## P0

### P0-1. Phase 8.9 / 8.10 未完成收口

- 缺失点：`Generation Health Checker` 需要检查进程运行、stdout/stderr 新鲜度、temp output、expected output、文件可读性、尺寸/格式/hash、QA 覆盖、worker exit code 与产物状态是否一致，并把 postprocess failure + temp output 标成 `postprocess_recoverable`。`Prompt Conflict Checker` 需要把 prompt 与 Story Flow、Shot Layout、Visual Memory、Keyframe Pair 等结构化事实做冲突检查。当前已有 `generationHealthReports` 和 `promptConflictReports`，但还不是架构文档定义的 top-level hard harness。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/docs/software-architecture.md` 8.9、8.10；`/Users/lichenhao/Desktop/vibe core/docs/core-development-sequence.md` 当前只写到 8.8 已实现范围；`/Users/lichenhao/Desktop/vibe core/src/core/generationHealth.ts` 只从 file snapshot / manifest / QA / asset readiness 推导，不含进程、日志、可读性、尺寸格式、worker exit code；`/Users/lichenhao/Desktop/vibe core/src/core/promptCompiler.ts` 只检查部分 capability、unsafe reference、end frame fallback。
- 建议落地位置：新增 `schemas/generation_health_harness.schema.json`、`src/core/generationHealthHarness.ts`、`scripts/generation-health-harness-test.mjs`；新增 `schemas/prompt_conflict_harness.schema.json`、`src/core/promptConflictHarness.ts`、`scripts/prompt-conflict-test.mjs`；更新 `ProjectRuntimeState`、`schemaRegistry`、`projectStateBuilder`、`import-runtime-test`、Diagnostics。
- 是否应进入近期开发：是。应作为 Phase 8.9 和 8.10 立即完成，否则“项目规划结束”还没有真正闭环。

### P0-2. 项目事实源 schema 仍缺第一类对象

- 缺失点：规划中反复要求 `production_bible.schema.json`、`story_flow.schema.json`、`shot_spec.schema.json`、`shot_layout.schema.json`、`visual_memory.schema.json`、`spatial_memory.schema.json`、`voice_memory.schema.json`、`scene_asset_pack.schema.json`，但当前仓库没有这些 schema 文件。现在 `ProjectRuntimeState.storyFlow` / `visualMemory` 是 runtime view 聚合，不能替代项目文件事实源。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/docs/core-development-sequence.md` Phase 2；`/Users/lichenhao/Desktop/vibe core/docs/schema-contracts.md` 把这些列为 Next Schema Candidates；`/Users/lichenhao/Desktop/vibe core/schemas` 当前只有 patch、report、task、harness 类 schema，没有完整 production bible / shot spec / shot layout / spatial memory schema。
- 建议落地位置：Phase 9 或 Phase 2 completion：新增 `schemas/project.schema.json`、`production_bible.schema.json`、`story_flow.schema.json`、`shot_spec.schema.json`、`shot_layout.schema.json`、`visual_memory.schema.json`、`spatial_memory.schema.json`、`voice_memory.schema.json`、`scene_asset_pack.schema.json`；同步 `src/core/types.ts` 和 project import/export。
- 是否应进入近期开发：是。没有这些，后续真实项目仍会依赖 runtime-audit 或旧聊天摘要，风险很高。

### P0-3. 视觉一致性方法论还没有完整工程化

- 缺失点：AGI 方法论要求“角色身份 -> 场景空间 -> 镜头布局 -> 首尾帧 -> 视频”的事实链，并明确 reference role、master scene 派生、多视角 camera vector、世界坐标、identity/scene/pair/story/prop/style gate。当前已覆盖一部分 reference authority、asset readiness、keyframe derivation、QA harness，但缺少可执行的 Scene Asset Pack / Shot Layout / Spatial Memory 实体和 master inheritance QA。
- 证据/来源：`/Users/lichenhao/Desktop/Vibe Director/AGI视觉一致性生产方法_20260429.md`；`/Users/lichenhao/Desktop/AGI 新人类/V3_MasterScene派生规范_20260428.md`、`V2_SpatialContinuityLocks_20260428.md`、`V2_VisualMemory_SceneAssetPack_20260428.md`；当前仓库没有 `scene_asset_pack.schema.json`、`shot_layout.schema.json`、`spatial_memory.schema.json`。
- 建议落地位置：新增 Scene Asset Pack Builder / Importer、Spatial Memory schema、Shot Layout schema、master inheritance QA report；Asset Readiness Gate 应读取这些对象，而不是只读泛化 asset record。
- 是否应进入近期开发：是。它直接对应用户最痛的“人物/场景/位置漂移”问题。

### P0-4. subagent 硬约束尚未覆盖所有生产任务

- 缺失点：`SubagentTaskEnvelope` schema 已经很完整，但当前最强的结构化 packet 主要通过 `videoExecutionPreview` 展示。图片资产生成、Image2 start/end frame、image edit、pair QA、scene QA、identity QA、story audit 等任务还缺统一 task packet 生成器、强制验证和测试。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/schemas/subagent_task_envelope.schema.json` 很完整；`/Users/lichenhao/Desktop/vibe core/src/core/subagentEnvelope.ts` 能构建 packet；`/Users/lichenhao/Desktop/vibe core/src/core/videoExecutionPreview.ts` 已绑定完整 packet；但 `imageTaskPlanner` / `generationHarness` / `qaHarness` 尚未把所有 image/asset/QA worker 都变成必须带 packet 的任务。
- 建议落地位置：新增 `subagentPacketPlanner`，按 `visual_generation`、`visual_audit`、`continuity_audit`、`regeneration_plan`、`story_audit` 生成 packet；Preflight / Generation Harness 必须拒绝无 packet 的正式任务。
- 是否应进入近期开发：是。否则又会回到“主 agent 临时描述，subagent 听明白但执行遗漏”的问题。

### P0-5. 默认 UI 还没有回到用户最初的极简导演台

- 缺失点：用户最初明确要简单直接：顶栏 `Asset Library / 自适应故事段落 / Preview`，大图完整显示，右侧只有自然语言 Director Input，少文字、不展示 prompt/复杂参数、不像工程监控台。当前 `App.tsx` 默认仍有 `VC` 品牌块、mode switch、overview metrics、Import/Dry Check/Provider Locked、工程化状态入口；Diagnostics 很完整，但 director 默认界面还没有严格按 `12-v4-minimal-act-view`、`13-v4-minimal-asset-bible`、`14-v4-minimal-selected-edit`、`15-v4-minimal-preview` 收敛。
- 证据/来源：四张 UI 参考图在 `/Users/lichenhao/Desktop/Vibe Director/12-v4-minimal-act-view.png`、`13-v4-minimal-asset-bible.png`、`14-v4-minimal-selected-edit.png`、`15-v4-minimal-preview.png`；`/Users/lichenhao/Desktop/Vibe Director/Vibe Director PRD v0.3.md` 6 章；当前 `/Users/lichenhao/Desktop/vibe core/src/App.tsx` 默认 topbar + overview + director/inspector/diagnostics 仍偏调试产品。
- 建议落地位置：新增 `docs/ui/minimal-director-ui-spec.md`，再做 Phase 9 UI Reframe：Director 作为唯一默认主视图，Diagnostics 藏到设置/开发者入口；用 section tabs 替代 mode-first 结构；Act/Section view 使用完整图片卡片；Asset Library 只显示 locked character / scene / prop / style / voice。
- 是否应进入近期开发：是。它不要求“精致抛光”，但要求先把信息架构变成正确产品形态。

## P1

### P1-1. Visual Memory 仍容易退化成资产列表，缺少“资产库不是图库”的硬模型

- 缺失点：现有资产有 `lockedStatus` 和 `safeForFutureReference`，但 Visual Memory 还没有明确分 character / scene / prop / style / voice 的资产包结构，也没有把主角参考、场景 master、派生视角、文本约束、locked 状态做成用户可理解的资产卡。
- 证据/来源：`/Users/lichenhao/Desktop/Vibe Director/Vibe Director PRD v0.3.md` 6.5、10.2；`/Users/lichenhao/Desktop/vibe core/docs/software-architecture.md` 6.4 明确 Visual Memory 不是图库；当前 schema 未见 `visual_memory.schema.json` / `scene_asset_pack.schema.json`。
- 建议落地位置：Visual Memory schema + UI Asset Bible；Asset Card 字段：authority role、locked/candidate/rejected、future reference allowed、linked shots、last QA。
- 是否应进入近期开发：是。建议和 P0-2/P0-3 同批设计。

### P1-2. start/end frame 的“生成链路”仍未闭合

- 缺失点：Keyframe Pair Derivation schema 已有，video planning 也检查 start/end，但 Image2 任务层还没有把 start frame -> end frame edit-from-start 做成可执行队列合同。当前更多是报告中检查，而不是生成前就强制 `end_frame` 必须引用 `start_frame` 作为输入。
- 证据/来源：`/Users/lichenhao/Desktop/Vibe Director/AGI视觉一致性生产方法_20260429.md` 2.3、Phase 4；`/Users/lichenhao/Desktop/vibe core/schemas/keyframe_pair_derivation.schema.json` 已存在；`promptCompiler.ts` 有 `end_frame_missing_start_derivation` 检查，但仍缺真实 image edit task payload 和强制输入引用。
- 建议落地位置：ImageTaskPlan 增加 `inputFrameRefs`、`derivationSourceTaskId`、`endFrameDerivationMode`；Image2 adapter request 强制 image.edit end frame 带 start frame authority。
- 是否应进入近期开发：是。它直接影响 Seedance 首尾帧抽搐和连续性。

### P1-3. 音频/TTS/BGM 仍是占位，没有用户可配置音源流程

- 缺失点：Audio Planning 已有 no BGM policy、TTS/music provider slots placeholder，但 Settings 里用户自定义音源、音源授权、voice registry CRUD、TTS/BGM provider onboarding 还未落成。
- 证据/来源：用户明确要求“配音音源预留”“设置里面可以自己添加音源”；`/Users/lichenhao/Desktop/vibe core/docs/core-development-sequence.md` Phase 6 已实现范围说明仍是 placeholder；`runtime_config.schema.json` 有 voice source placeholders。
- 建议落地位置：`voice_memory.schema.json`、`voice_source_registry.schema.json`、Settings Voice Sources 面板、Audio Adapter Contract skeleton。
- 是否应进入近期开发：是，但可排在 Phase 9 事实源之后。

### P1-4. Export 仍是 dry-run package plan，未覆盖真实导出体验

- 缺失点：当前 Preview/Export 只生成 dry-run profiles，不写 rough cut、不打包素材、不生成 PR/达芬奇/剪映友好目录。用户明确希望统一导出完整视频和分批批量导出素材。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/docs/core-development-sequence.md` Phase 5 已实现范围写明“不写真实文件”；`/Users/lichenhao/Desktop/Vibe Director/Vibe Director PRD v0.3.md` 3.3、Preview/Export 章节。
- 建议落地位置：Export Worker dry-run -> local file writer gate；先实现 `asset package`、`storyboard table`、`prompt/QA archive`，rough cut 依赖 FFmpeg readiness。
- 是否应进入近期开发：是，但应在项目事实源和 health/prompt conflict 完成后。

### P1-5. CLI / provider 可替换架构有 skeleton，但缺真实 AgentAdapter runner

- 缺失点：Adapter Contract skeleton 很完整，但还没有真正的 `AgentAdapter.runTask/spawnWorker/resumeTask/cancelTask`、sidecar command allowlist 执行层、结果解析与 manifest 写入。当前 Codex CLI 是“可替换设计”，还不是可运行 adapter。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/docs/software-architecture.md` 9.1；`src/core/adapterContracts.ts` 与 `toolRuntimeHarness.ts` 只做 read-only/dry-run；Tool Runtime Harness 明确 `canExecuteNow=false`。
- 建议落地位置：Phase 10 Local Orchestrator / Agent Adapter Spike；必须继续保持 no credentials、no arbitrary shell、provider lock。
- 是否应进入近期开发：否，等 Phase 8.9/8.10 和项目事实源完成后进入。

### P1-6. Knowledge Pack Manager 还没有用户侧管理入口

- 缺失点：知识包资源已导入，router/test 也有，但用户后续在前端添加风格包、运镜包、分镜包、prompt 包、QA 包的能力尚未实现；pack conflict checker 也未实现。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/resources/knowledge/README.md`；`/Users/lichenhao/Desktop/vibe core/docs/core-development-sequence.md` Phase 2.5；当前 UI 的 `KnowledgePackManager` 更像 diagnostics 测试入口，不是正式用户管理。
- 建议落地位置：Settings/Library 中新增 Knowledge Pack Manager：import/create/enable/disable/version/hash/dependency/conflict test/route test。
- 是否应进入近期开发：是，但默认 UI 不应展示资料全文。

### P1-7. Provider onboarding 的研究清单已在 knowledge 中，但未接成项目工作流

- 缺失点：未来新增模型/API 的入口已经预留，但还没有从 provider onboarding checklist -> capability matrix -> adapter contract -> tests -> settings enablement 的完整 workflow。
- 证据/来源：`/Users/lichenhao/Desktop/vibe core/resources/knowledge/provider/provider-onboarding-research-checklist.md`、`provider-api-extension-slots.md`、`model-capability-matrix.md`；`adapterContracts` 当前是静态默认合同。
- 建议落地位置：Provider Onboarding Wizard / developer checklist generator，先只做文档化和 schema，避免过早真实启用。
- 是否应进入近期开发：否。放在真实 provider 接入前。

### P1-8. OpenCV / local postprocess 禁止语义修复已有原则，但缺 operation-level 白名单

- 缺失点：Generation Harness / QA Harness / Tool Runtime 已反复写明 semantic repair forbidden，但 future local.postprocess 还缺“允许操作白名单”和“语义修复拒绝原因”的 schema/test。
- 证据/来源：`/Users/lichenhao/Desktop/Vibe Director/AGI视觉一致性生产方法_20260429.md` Phase 6；`docs/core-development-sequence.md` Phase 4、8.4、8.7、8.8；`adapterContracts` 里 local postprocess 仍是 planned。
- 建议落地位置：`local_postprocess_policy.schema.json`、`src/core/localPostprocessPolicy.ts`，允许 resize/format/metadata/contact-sheet/light texture soften，拒绝 identity/outfit/scene/camera/story/style semantic repair。
- 是否应进入近期开发：可在真实本地工具执行前补。

## P2

### P2-1. 真实测试素材和失败案例尚未进入仓库 fixtures

- 缺失点：大量有价值的 AGI 新人类失败案例、contact sheets、runtime-tests 还留在桌面项目中。当前 Vibe Core 依赖 fallback/runtime import 测试，缺少小型脱敏 fixture 覆盖：人物漂移、场景多视角失败、start/end 独立生成、front door / garage door prompt 冲突、Seedance no bgm / stretch 稳定提示等。
- 证据/来源：`/Users/lichenhao/Desktop/AGI 新人类/故事线问题审计_20260428.md`、`V2样片测试报告_20260428.md`、`contact_sheets_video_keyframes_v1*`；`/Users/lichenhao/Desktop/Vibe Director/runtime-tests` 资料线索。
- 建议落地位置：`fixtures/visual-consistency-cases/` 或 `test-fixtures/`，只放小型 metadata/contact-sheet，不把大媒体全量进 git。
- 是否应进入近期开发：是，但低于 P0/P1 架构缺口。

### P2-2. Story Agent 同时承担制片拆解的实现边界仍需写清

- 缺失点：产品判断是不新增常驻“剧情拆解 Agent”，让写作/理顺剧情的 agent 同时产出 Production Bible、Story Flow、Shot Spec、Visual Opportunities。但当前代码还没有 story intake -> production bible -> shot spec 的生成/验证 pipeline。
- 证据/来源：`/Users/lichenhao/Desktop/Vibe Director/PRD缺口审计_20260429.md`；`/Users/lichenhao/Desktop/Vibe Director/双幕十镜头完整生成测试任务_20260429.md`；`docs/software-architecture.md` 11.1。
- 建议落地位置：Story Intake Harness / Script-to-StoryFlow Builder；先 dry-run schema 和 fixtures，再接 agent。
- 是否应进入近期开发：是，但应在项目事实源 schema 后做。

### P2-3. 实时预览还没有真正连到文件监听与媒体 playback

- 缺失点：Preview Plan/Events 已有，但“点击之后把已有图片/视频按时间线播放出来”的实时预览仍未实现为真正媒体播放队列；当前主要是 preview/export state 和 UI skeleton。
- 证据/来源：用户早期明确要求“预览”“实时预览”；`docs/core-development-sequence.md` Phase 5 只完成核心合同；`src/App.tsx` 有 Preview UI 但不是真实播放器/rough cut renderer。
- 建议落地位置：Preview Player MVP：image hold + local video playback + blocked placeholder + current shot highlight；绑定 watcher events 自动刷新。
- 是否应进入近期开发：是，但可晚于事实源和 UI Reframe。

### P2-4. 权利/版权风险过滤按用户意愿不进入默认流水线

- 缺失点：不是实际缺口。用户明确认为 rights-risk-filter 会让系统过重，且“怎么用是用户选择与表达”。当前不应把它做成 P0/P1。
- 证据/来源：当前对话上下文中用户明确要求不管此项。
- 建议落地位置：仅保留为未来可选 external/user pack，不进入默认 hard gate。
- 是否应进入近期开发：否。

## 已覆盖但需要保持的约束

- Provider policy：Image2 图片链路 active/dry-run，Seedance/Jimeng video parked，不走 text-to-video 主路径，不用 Fast/VIP 默认路径。
- Knowledge Router：已有资源、manifest、router test、context budget，不全量注入所有资料。
- QA Harness：已建立 overall-first 和 identity/scene/pair/story/prop/style/motion/audio 维度。
- Watcher / Resume / Tool Runtime：已经形成 dry-run fact layer，方向正确。
- OpenCV/local postprocess：原则上已明确禁止语义修复，后续只需补 operation-level 白名单。

## 建议近期开发顺序

1. 完成 Phase 8.9 Generation Health Harness。
2. 完成 Phase 8.10 Prompt Conflict Harness。
3. 补齐项目事实源 schema：Production Bible、Story Flow、Shot Spec、Shot Layout、Visual/Spatial/Voice Memory、Scene Asset Pack。
4. 把 AGI 视觉一致性方法论转成 Scene Asset Pack / Shot Layout / Keyframe Pair 的 builder + QA fixtures。
5. 做 Minimal Director UI Reframe：默认主界面参考四张 v4 minimal 图，复杂 harness 只进 Diagnostics。
6. 扩展 Subagent Packet Planner，让 image/asset/pair QA/scene QA 都必须通过统一 envelope。
