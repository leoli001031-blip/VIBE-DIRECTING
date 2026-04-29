# Vibe Core 开发预期一致性审计

日期：2026-04-30  
审计范围：当前对话上下文、`/Users/lichenhao/Desktop/vibe core` 现有代码、PRD/架构/开发规划、`resources/knowledge`、用户指定的 UI 参考图 `12-v4-minimal-act-view`、`13-v4-minimal-asset-bible`、`14-v4-minimal-selected-edit`、`15-v4-minimal-preview`。  
边界：只审计和记录，不改业务代码，不跑 provider，不生图/生视频。

## 总体判断

当前实现的底层方向基本正确：Provider policy、Preflight、Reference Authority、TaskEnvelope、SubagentTaskEnvelope、Knowledge Router、Adapter Contract、Generation/Watcher/Resume/QA/Tool Runtime Harness 都在把系统推向“硬性约束优先”，而不是靠 Agent 说自己记住了。

主要偏差不在底层合同，而在产品体验和执行闭环：

- 主界面仍然有较重的开发控制台感，和最初想要的极简 Story Flow / Asset Library / Selected Edit / Preview 还有距离。
- `SubagentTaskEnvelope` 已经有 schema 和 builder，但正式 Agent/Worker 执行入口还没有真正被“只能收 envelope”锁死。
- Prompt Conflict Checker 目前只是第一版 prompt plan 伴生报告，还没有覆盖用户反复遇到的故事顺序、门语义、机位冲突、衣服锁定冲突等硬检查。
- Knowledge Pack 架构已经迁入，但前端“添加/管理技能包”的能力还只是规划和 Diagnostics，不是用户可操作的扩展机制。
- 项目还没有真实 `project.vibe` file-first 项目格式和桌面壳，当前更多是 runtime test viewer + core contract shell。

## P0

### P0-1：正式 subagent 执行还没有被运行时硬锁

实际实现/规划：

- `src/core/subagentEnvelope.ts` 已有 `buildSubagentTaskEnvelope`。
- `schemas/subagent_task_envelope.schema.json` 已存在。
- `src/core/adapterContracts.ts` 要求 worker 使用 `subagent_task_envelope.schema.json`，并禁止 `freeform_context` / `envelope_bypass`。
- `src/core/videoExecutionPreview.ts` 会生成只读 `SubagentTaskEnvelope` 预览。

预期：

- 正式 subagent 任务必须只能由系统生成的 `SubagentTaskEnvelope` 启动。
- 主 Agent 不能临时口头转述上下文。
- 每个 subagent 必须获得统一的 source index、前后镜头、locked / forbidden references、Shot Layout、provider policy、must preserve / must not add、QA checklist 和 expected output contract。

偏差风险：

- 现在“合同存在”，但真实 CLI/worker runner 尚未实现，后续接 Codex CLI 时仍可能从按钮或脚本直接拼自由文本任务。
- 这会复现之前的核心问题：subagent 每次拿到的信息不一样，导致人物、场景、风格、故事线漂移。

建议改法：

- 下一阶段增加 `AgentWorkerRuntime` 或 `SubagentRunner` 合同：唯一入口参数是已校验通过的 `SubagentTaskEnvelope`。
- 所有 image / video / QA / audit worker task 在 queue 中只保存 envelope id，不保存自由 prompt。
- 加 `subagent-envelope-runner:test`：构造自由文本 task、缺 sourceIndexHash、缺 provider policy、缺 expected output contract 时必须失败。

需要改代码还是改文档：

- 改代码为主，补文档为辅。

### P0-2：Prompt Conflict Checker 尚未覆盖真实失败类型

实际实现/规划：

- `src/core/promptCompiler.ts` 会生成 `ShotPromptPlan` 和 `PromptConflictReport`。
- 目前能拦截 provider capability blocker、end frame 缺 start 派生、end frame fallback 到 text2image、不安全 reference。
- `docs/software-architecture.md` 明确 Phase 8.10 要检查 Story Flow 改动后 prompt 仍引用旧功能、garage door/front door、固定机位 vs 大幅推拉、end frame 独立生图、服装锁定冲突等。

预期：

- 生成前必须检查 prompt 与当前结构化事实是否冲突。
- 冲突不能靠 Agent 承诺解决，必须更新 Shot Spec / Shot Layout / Shot Prompt Plan 后重新编译。

偏差风险：

- 当前 conflict report 仍偏 provider/reference 层，没有真正读取 Shot Layout、Visual Memory 文本约束、Story Flow 版本、角色服装/道具/场景语义。
- 用户之前遇到的“门语义错、镜头功能停在旧位置、end frame 不是 start 派生、衣服/身份漂移”仍可能在真实生成前漏过。

建议改法：

- 实现 Phase 8.10 为独立 `promptConflictHarness` 或增强 `promptCompiler` 输入。
- 最小硬检查：`sourceShotSpecHash` stale、Shot Layout camera/motion 冲突、locked outfit / prop / scene text constraint 冲突、start/end 派生冲突、section/shot order 冲突、forbidden reference 污染。
- UI 只显示自然语言阻断原因，细节放 Diagnostics。

需要改代码还是改文档：

- 改代码。

## P1

### P1-1：主界面仍偏“开发诊断台”，和极简导演台预期不一致

实际实现/规划：

- `src/App.tsx` 已区分 `director`、`inspector`、`diagnostics` 三个模式，这是正确方向。
- 但 Director mode 仍显示 `Next Step`、`Queue`、`Blocking Reason`、Visual Memory 列表、shot card 状态、Preview status grid、VideoPlanningSummary、AudioPlanSummary、ExportProfiles、DirectorInput。
- Shot card 以文本状态、Start/End missing、Queue tasks、gate initials 为主，图片不是主视觉。

预期：

- 参考图 `12-v4-minimal-act-view`：顶部只有 Asset Library / 自适应故事段落 / Preview；中间大图完整展示分镜；右侧只有小型自然语言输入。
- 参考图 `13-v4-minimal-asset-bible`：资产库用于锁定人物三视图/表情、场景多视角/主参考，不是所有图片 dump。
- 参考图 `14-v4-minimal-selected-edit`：选中若干镜头后，右侧只显示 Selected 1-1, 1-2 和一句自然语言修改。
- 参考图 `15-v4-minimal-preview`：Preview 是沉浸式播放/时间线，不是状态表。

偏差风险：

- 普通用户打开后仍会觉得这是工程工具，不是“任何有想法的人都能自然语言生成视频”的产品。
- 太多英文状态、gate、queue、provider 词汇会削弱最初“简单直接”的设想。

建议改法：

- 把 `director` 默认页重做为 `MinimalDirectorMode`：顶部为 Asset Library + 自适应 section tabs + Preview。
- 中间 Story Flow 用大图优先，不显示 gate initials / queue tasks / provider 字段；每张图只保留 shot id + 极短功能词。
- 右侧只保留自然语言输入和选中范围 chip，不默认展开 change plan 字段表。
- `inspector` 和 `diagnostics` 保留当前机器细节。

需要改代码还是改文档：

- 改代码，文档补 UI 原则。

### P1-2：Asset Library 体验还没有体现“锁定资产”本质

实际实现/规划：

- `VisualMemoryPanel` 现在按 asset type 列表显示资产名、状态点、lockedStatus。
- `StoryWorkspace` 底部仍显示 Asset Contact Sheet / Keyframe Contact Sheet。

预期：

- 资产库主要用于锁定长期复用的角色、场景、道具、风格参考。
- 第一版至少要清楚区分：1 张主角参考、1 张场景参考、一段文本约束、locked 状态。
- 后续可扩展为人物多视角/表情、场景 master / derived views，而不是把所有生成图都混入资产库。

偏差风险：

- 用户会把 keyframe/contact sheet 误认为资产库内容，资产系统重新变成图库。
- 后续生成可能把 candidate、temp、失败图误用为正向 reference。

建议改法：

- Asset Library 页面改成专门的 Visual Memory / Asset Bible：Characters、Scenes、Props、Style，每个实体显示 reference role、locked/candidate/rejected、文本约束和被引用 shot。
- Contact Sheet 移到 Diagnostics 或 Reports，不放在默认 Story Flow 主界面。
- 增加 `visual-memory-ui-contract:test` 或静态检查，确保 temp/candidate 不出现在可锁定主资产区域。

需要改代码还是改文档：

- 改代码为主。

### P1-3：Knowledge Pack 可扩展架构已建立，但用户侧添加/管理还未落地

实际实现/规划：

- `resources/knowledge/` 已迁入大量 packs。
- `resources/knowledge_pack_manifest.json` 有 version/hash/type/category/maxInjectionTokens/trustLevel。
- `KnowledgePackManager` 在 Diagnostics 中可展示 router 测试和注入摘要。
- `docs/core-development-sequence.md` 要求未来前端可导入、新建、启用/禁用知识包。

预期：

- 用户后续能在前端添加风格包、运镜包、分镜包、prompt 包、QA 包或项目本地规则包。
- 普通用户默认不看术语库；系统后台按任务注入最少必要资料。

偏差风险：

- 如果长期只有 `resources/knowledge_pack_manifest.json`，技能包能力会变成开发者配置，不符合“用户可以自己扩展风格/方法”的产品方向。
- 但如果过早把完整 Knowledge Manager 暴露到主界面，又会让系统变重。

建议改法：

- 保持主界面不展示术语库。
- 在 Settings 或 Project Library 中提供极简入口：导入 pack、启用/禁用、适用范围、冲突提示、最近任务使用记录。
- 新增 pack 必须走 schema/hash/verification，不允许直接覆盖硬规则。

需要改代码还是改文档：

- 改代码和文档。

### P1-4：当前仍是 runtime test viewer，不是完整 project.vibe file-first 项目

实际实现/规划：

- `ProjectRuntimeState` 很完整，但当前 app 从 `/runtime-state.json` 或 `/runtime-audit.json` 加载。
- `docs/software-architecture.md` 要求项目是可迁移文件夹：`project.json`、`production_bible.yaml`、`story_flow.yaml`、`visual_memory/`、`shots/`、`manifests/`、`reports/`、`preview/`、`exports/`。

预期：

- Vibe Core 应是 Mac/Windows 可用的桌面项目工作台。
- Agent / Codex 读写普通文件，SQLite 只做索引缓存，项目文件夹可迁移。

偏差风险：

- 如果继续围绕 runtime JSON 叠功能，后续真实生成、恢复、多人迁移、项目修复都会困难。
- Codex CLI/subagent 也更难用 source index 作为当前事实入口。

建议改法：

- 在进入真实 provider 前实现 `project.vibe` 最小读写：create/open/save、source_index、story_flow、visual_memory、task_runs、manifest、reports。
- 当前 runtime-state 可以保留为 derived cache，不再作为唯一事实源。

需要改代码还是改文档：

- 改代码。

### P1-5：开发任务包模板没有落成可复用文件

实际实现/规划：

- `docs/core-development-sequence.md` Phase 0.5 明确需要 `development_task_envelope` 文档模板、subagent 任务包模板、review checklist。
- 目前仓库中只有规则描述，没有独立模板文件。

预期：

- 后续连续开发默认由 subagent 做局部任务，主 agent 集成 review。
- 每个开发 subagent 都必须拿到稳定信息包：任务目的、允许文件、必须读的资料、禁止事项、验证命令、输出格式。

偏差风险：

- 开发过程本身继续依赖主 agent 记忆和临时提示，容易出现和生图测试同类问题：上下文给得不一致，subagent 误判或越权修改。

建议改法：

- 新增 `docs/development/subagent_task_packet_template.md`、`docs/development/integration_review_checklist.md`、`docs/development/phase_task_envelope.schema.md`。
- 后续每个阶段的子任务都先生成 task packet，再派发。

需要改代码还是改文档：

- 改文档；后续可加轻量脚本检查。

### P1-6：Preview 仍是状态时间线，不是用户期待的实时预览体验

实际实现/规划：

- `PreviewTimeline` 显示 draft events、blocked、formal gate、proxy duration 和一条 timeline track。
- `previewExport` 合同已区分 draft/formal preview 和 export profiles。

预期：

- 用户点击 Preview 后，基于现有图片/视频按时间线播放。
- 可以看到故事节奏，而不是只看 blocked/status。
- 参考图 `15-v4-minimal-preview` 是沉浸式画面 + 极简时间线。

偏差风险：

- 当前 preview 对工程状态有用，但不能让创作者快速感知“片子是否成立”。

建议改法：

- 实现 `PreviewPlayer`：image hold、video clip、blocked placeholder 三类素材都能按 duration 播放。
- Director mode 只显示播放器和极简时间线；formal gate 细节进 Inspector/Diagnostics。

需要改代码还是改文档：

- 改代码。

## P2

### P2-1：CLI / adapter 可替换方向正确，但真实替换路径还未跑通

实际实现/规划：

- `adapterContracts` 把 AgentAdapter、WorkerAdapter、ProviderAdapter 分开。
- Codex CLI 是 `codex-cli-agent`，不是唯一架构身份。
- Provider slots 覆盖 image/video/audio/local workflow。

预期：

- 后续只要新 CLI 能 spawn subagent、接收 context packet、返回结构化结果、调用生图能力，就能比较无感替换。

偏差风险：

- 目前只有合同和 diagnostics，没有最小 mock runner 证明“替换 CLI 不改核心项目格式”。

建议改法：

- 增加 `mock-agent-adapter` 和 `mock-provider-adapter`，用同一 `TaskEnvelope/SubagentTaskEnvelope` 跑一轮无 provider 的假任务。
- 测试保证换 adapter 后 SourceIndex、Queue、Manifest、QA 不变。

需要改代码还是改文档：

- 改代码。

### P2-2：Audio/TTS/BGM 预留符合方向，但用户添加音源仍是只读 placeholder

实际实现/规划：

- `audioPlanning` 有 Voice Source Registry、provider slots、no-bgm policy。
- Settings Shell 中 voice sources 为 planned/read-only，不存 credentials。

预期：

- Settings 里可以自己添加音源。
- 声音作为资产预留：旁白、角色音源、BGM 风格、环境音。

偏差风险：

- 当前阶段可接受，但如果 Phase 9 仍不做 CRUD，会影响“完整导演台”的平台感。

建议改法：

- 下一阶段只做本地 `VoiceSource` CRUD 和 project-local voice memory，不接真实 TTS/BGM。
- 保持 no bgm for video provider 硬约束。

需要改代码还是改文档：

- 改代码。

### P2-3：上游导演台边界总体正确，但 Export/Preview/Audio 面板可能逐步挤压主界面

实际实现/规划：

- 文档明确“不做 PR/剪映替代品”，导出是 rough cut / asset package / storyboard table / developer archive。
- Director mode 右侧同时显示 Preview、Video、Audio、Export、Director Input。

预期：

- Vibe Core 是剪辑软件上游，重点是故事流、资产一致性、关键帧/视频任务和统一导出。

偏差风险：

- 如果继续往右侧堆 Audio/Export/Video 状态，主界面会变成小型剪辑/生产软件，而不是极简导演台。

建议改法：

- Director mode 只保留 Story Flow、Asset Library、Director Input、Preview 入口。
- Audio/Export/Video readiness 作为 shot inspector 或 Diagnostics 抽屉。

需要改代码还是改文档：

- 改代码。

### P2-4：自然语言入口方向正确，但 dry-run 结果太像开发表单

实际实现/规划：

- `DirectorInput` 支持自然语言修改，并生成 `StoryChangeTransaction` + `ReflowImpactReport` dry-run。
- 输出展示 transaction、operation、intent、scope、stale、forbidden actions 等字段。

预期：

- 用户只需说“把这几张改得更压抑”“让雨小一点”“加一个她回头的镜头”。
- 系统可以先给自然语言理解摘要和少量确认，不应该默认展示内部 schema 字段。

偏差风险：

- 用户会觉得自己在操作一个工程控制台，而不是和导演助理沟通。

建议改法：

- 默认只显示一句：“我会影响 3 个镜头、1 个资产，需要重生 2 张图，是否继续？”
- schema 字段表放到 Inspector details。

需要改代码还是改文档：

- 改代码。

## 保持正确的部分

- Provider policy 很接近用户预期：Image2 图片链路 active，Seedance/Jimeng video parked，text-to-video fallback 禁止，Fast/VIP/BGM-in-video 禁止。
- Local postprocess 边界正确：只做尺寸、格式、预览、metadata/manifest，不做身份、场景、构图、风格等语义修复。
- Knowledge Library 迁入方向正确：它是后台资料包，不是主界面术语墙。
- Story Flow 已经按 `sectionId || actId` 自适应，不强制所有故事固定四幕。
- Diagnostics / Inspector / Director 三层分离是正确方向，只是 Director 层还需要更克制。

## 建议优先级

1. 先补 P0-1：让正式 subagent runner 只能吃 `SubagentTaskEnvelope`。
2. 再补 P0-2：把 Phase 8.10 Prompt Conflict Checker 做成硬检查。
3. 同步做 P1-1 / P1-2 / P1-6：把 Director mode 改成参考图那种极简、图像优先、少文字的产品形态。
4. 补 Phase 0.5 开发任务包模板，避免后续开发 subagent 重复上下文漂移。
5. 进入真实生成前，把 `project.vibe` file-first 项目格式落地。
