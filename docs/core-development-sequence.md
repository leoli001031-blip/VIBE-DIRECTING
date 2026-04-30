# Core Development Sequence

日期：2026-04-29

这份文件用于约束 Vibe Core 的连续开发顺序。核心原则是：先把项目事实源、任务合同、文件监听、知识注入和门禁做硬，再做 UI 抛光和真实模型调用。

## 开发执行规则

后续默认由 subagent 执行局部开发，主 agent 负责规划、集成、review 和验证。

每个开发 subagent 任务必须包含：

- 任务目的。
- 允许修改的文件范围。
- 必须读取的输入资料。
- 禁止修改的文件范围。
- 必须遵守的硬规则。
- 验证命令。
- 期望输出摘要。

subagent 不应自由浏览整个项目后临时发挥。它只处理一个边界清楚的小任务。主 agent 合并前要检查：是否越权修改、是否绕过 provider policy、是否把临时 audit 逻辑固化成生产逻辑、是否保持 Mac/Windows 可迁移。

## Phase 0.5：Development Harness

目标：把“如何开发 Vibe Core”本身标准化，避免连续开发时靠聊天记忆推进。

优先项：

- `development_task_envelope` 文档模板。
- subagent 任务包模板：写入范围、输入资料、禁止事项、验证命令、输出格式。
- review checklist：provider、preflight、reference、queue、manifest、QA、Mac/Win。
- baseline commit 策略：完成一组核心变更后提交，避免长时间未提交。
- 禁止事项清单：不在未完成门禁前接真实视频 provider，不把 prompt 参数面板做成主界面，不让 subagent 直接改大范围 UI。

完成标准：

- 每个后续开发任务都能直接拆给 subagent。
- 主 agent 能根据统一 checklist 做集成 review。
- 任何任务都能回答：谁改了什么、为什么改、如何验证。

## Phase 1：Contract Layer

目标：任何生产任务进入执行前，都必须有可校验合同。

当前状态：第一版已建立，后续继续补齐。

已完成或正在完成：

- JSON Schemas。
- ProjectSourceIndex。
- ReferenceAuthority。
- PreflightGate。
- TaskEnvelope。
- SubagentTaskEnvelope。
- TaskRun。
- ManifestMatcher。
- WorkflowGuard。
- Provider hard gate。

补强项：

- `provider_registry.schema.json`。
- `provider_capability.schema.json`。
- `qa_report.schema.json`。
- schema 与 TypeScript 类型的同步检查脚本。

完成标准：

- `npm run build` 通过。
- schema JSON 解析通过。
- 每个正式任务都能回答：事实来自哪里、引用是否允许、provider 是否允许、预期输出是什么、失败后停在哪里。
- parked / planned / unknown provider 不能进入真实提交。

## Phase 2：Project Format + Domain Schemas

目标：把 runtime audit viewer 升级成真正的本地项目格式和影视生产事实源。

优先项：

- `project.vibe` 文件夹结构。
- 从 runtime test 生成 ProjectSourceIndex。
- 从 existing outputs 生成 TaskRun 和 ManifestMatcher 状态。
- 区分 `draft` / `candidate` / `formal` 素材。
- 建立项目级 source index，不默认信任旧聊天、旧 prompt、旧失败图。

必须补的影视域 schema：

- `production_bible.schema.json`：故事设定、人物、场景、道具、风格、声音基准。
- `story_flow.schema.json`：自适应故事段落，不写死 Act I-IV。
- `shot_spec.schema.json`：每个镜头的叙事功能、动作、情绪、时长、对白。
- `shot_layout.schema.json`：主体位置、机位、镜头方向、空间锚点、动作方向。
- `shot_prompt_plan.schema.json`：provider prompt 的源头计划，不直接等于最终 prompt。
- `style_capsule.schema.json`：视觉风格、材质、纹理、光线、色彩、禁忌。
- `visual_memory.schema.json`：人物、场景、道具、风格资产。
- `spatial_memory.schema.json`：场景空间、视角、轴线、可用镜位。
- `voice_memory.schema.json`：角色声音、旁白声音、音源授权、TTS 预留。
- `scene_asset_pack.schema.json`：master scene、derived views、candidate views、locked views。
- `asset_readiness_report.schema.json`：资产是否可以进入正式分镜生成。

项目格式要产出：

- `project.json` 或等价项目入口。
- `source_index.json`。
- `task_runs.jsonl`。
- `manifest_match_report.json`。
- `queue_summary.json`。
- `visual_memory.json`。
- `story_flow.json`。
- `production_bible.json`。

完成标准：

- 导入器不只生成 `runtime-audit.json`，还生成项目事实文件。
- UI 和后续任务从项目事实文件读取，而不是从自由文本或旧对话读取。
- Scene Asset Pack 未 ready 时，相关镜头只能 draft，不能 formal。

## Phase 2.2：Watcher / Health Checker / Checkpoint

目标：把长任务、Codex reconnect、临时图、缺失报告、worker 中断这些真实生产问题前置处理。

优先项：

- Filesystem watcher。
- generated image cache watcher。
- task-owned temp folder。
- expected output matcher。
- generation health checker。
- checkpoint resume。
- final promotion pipeline。
- stalled task detector。
- missing report blocker。

Watcher 事件：

- `temp_output_detected`。
- `expected_output_detected`。
- `provider_ready_derivative_detected`。
- `qa_report_detected`。
- `manifest_mismatch_detected`。
- `stall_timeout_reached`。
- `worker_exit_without_expected_output`。
- `postprocess_recoverable`。
- `formal_output_promoted`。

硬规则：

- 临时图可以显示，但不能作为 future reference。
- worker 自报成功不等于任务成功。
- expected output + manifest match + QA coverage 同时满足，才可进入 formal。
- missing QA report = not formal。
- checkpoint 恢复时必须重新跑 manifest matcher。

完成标准：

- 断点恢复后能识别已完成、部分完成、未整理、失败、卡住的任务。
- UI 能显示“Codex 正在干活”的真实进度，而不是只显示最终文件。
- Queue 的下一步动作来自 watcher / matcher / QA，不来自 agent 自觉判断。

## Phase 2.5：Knowledge Library + Router + Context Budgeter

目标：把前期收集的风格、分镜、运镜、构图、脚本、prompt、provider、QA 和 audio 资料迁入 Vibe Core，并按任务注入。这个阶段必须把 Knowledge Pack 做成正式工程对象，让用户后续可以从前端添加风格包、运镜包、分镜包、prompt 包、QA 包等类似“技能包”的扩展能力。

Knowledge Library 必须迁入 Vibe Core：

- 推荐目录：`resources/knowledge/`。
- 可选未来拆包：`packages/knowledge/`。
- `knowledge_pack_manifest.json`：记录 pack id、version、hash、路径、适用任务、依赖。
- `knowledge_pack.schema.json`。
- `knowledge_route_result.schema.json`。
- `context_budget.schema.json`。
- pack hash/version 计算脚本。
- 从旧 `/Users/lichenhao/Desktop/Vibe Director/knowledge` 导入并锁版本。

Knowledge Pack P0 工程对象：

- `schemas/knowledge_pack.schema.json`。
- `schemas/knowledge_pack_manifest.schema.json`。
- `schemas/knowledge_route_result.schema.json`。
- `schemas/context_budget.schema.json`。
- `src/core/knowledgeTypes.ts`。
- `src/core/knowledgeLibrary.ts`。
- `src/core/knowledgeRouter.ts`。
- `src/core/contextBudgeter.ts`。
- `src/core/knowledgeManifest.ts`。

Knowledge Pack 类型：

- `system_builtin`：系统内置包，随 Vibe Core 发布，默认启用，不允许用户直接覆盖硬规则。
- `user_custom`：用户个人添加的跨项目知识包，例如个人偏好的风格、运镜、构图、prompt 写法。
- `project_local`：当前项目专用知识包，例如某个短片的世界观、专属视觉规则、角色表演规则。
- `external_imported`：从外部导入的知识包，默认需要验证、查看依赖和冲突后才能启用。

第一批 Knowledge Packs：

- `script/storyflow`：把想法、脚本、对白、散乱笔记拆成 Story Flow、Scene、Beat、ShotSpec。
- `story-function/storyboard`：定义镜头叙事功能，例如 establish、reveal、react、payoff。
- `style`：把自然语言风格变成 Style Capsule。
- `composition`：构图、主体位置、负空间、框中框、过肩、尺度对比。
- `camera`：静止机位、慢推、拉远、横摇、跟拍、视差揭示。
- `lighting-color`：光线、色彩、质感、低纹理、调色风险。
- `prompt`：Image2 关键帧、Image2 edit、I2V motion、reference selection、shot layout 到 prompt 的模板。
- `provider`：模型能力矩阵、Image2、Seedance/Jimeng parked、未来 provider onboarding。
- `qa`：风格、人物、场景、连续性、镜头功能、参考污染、首尾帧派生检查。
- `audio`：旁白、对白、音源、环境音、BGM brief、no bgm、TTS/BGM provider 预留。

Knowledge Router：

- 不把整库注入 Codex / subagent。
- 根据用户意图、任务类型、镜头风险、provider slot 选择小包。
- 输出结构化 `knowledge_route_result`，不是自由文本。
- 每个 TaskEnvelope / SubagentTaskEnvelope 记录 `injectedKnowledgePacks`。
- QA Gate 使用同一批或兼容版本的 pack 反查结果。
- pack hash 不一致时标记 `qa_pack_version_mismatch`。

Knowledge Pack Manager 是后续前端能力：

- 导入知识包。
- 新建知识包。
- 启用 / 禁用知识包。
- 查看版本、hash、依赖、适用任务和作用范围。
- 测试路由，确认某个自然语言意图会命中哪些 pack。
- 查看最近哪些任务使用过某个 pack。
- 检测 pack 冲突，例如两个风格包同时要求相反的色彩、纹理或镜头规则。
- 把外部导入包从 `external_imported` 提升为可信可用包前，必须通过验证。

硬规则：

- Knowledge Pack 可以影响创作建议、Prompt Compiler、QA 检查和 subagent 的参考知识。
- Knowledge Pack 不能覆盖 `provider policy`。
- Knowledge Pack 不能覆盖 `preflight`。
- Knowledge Pack 不能覆盖 `reference authority`。
- Knowledge Pack 不能覆盖 `keyframe pair derivation`。
- Knowledge Pack 不能覆盖 `QA gate`。
- 用户自定义 pack 不能把 rejected/temp/failed 资产变成可用正式参考。
- 用户自定义 pack 不能把 parked provider 变成可真实提交 provider。

Context Budgeter：

- L0：当前镜头 + 绑定资产摘要 + 用户意图。
- L1：增加前后 1 镜、story function、must/avoid。
- L2：增加前后 2-3 镜、失败原因、关键锚点、参考图路径。
- L3：整幕审计、contact sheet、空间/动作顺序表。
- 建立 `context_summary_cache`，复用上一轮审计摘要，避免每次塞全量上下文。
- 建立 `knowledge_route_cache`，同一任务意图和项目版本不重复路由。
- 每个 pack 必须声明 `maxInjectionTokens`。
- 长 pack 默认只注入 summary、命中条目和必要示例，不注入全文。
- QA Gate 优先用 pack hash/version 反查知识包，不把整包重新塞给 Agent。
- route result 必须记录实际注入片段、摘要 hash 和被截断原因。
- subagent result summary 要写回项目，供下一轮任务复用。

Prompt Compiler / Prompt Conflict Checker：

- Phase 2.5 开始建立接口，不等到真实 Image2 阶段才做。
- `prompt_plan.schema.json`。
- `prompt_conflict_report.schema.json`。
- prompt hash / source shot spec hash。
- stale prompt propagation。
- provider prompt 只能作为 Shot Prompt Plan 的派生产物。

完成标准：

- SourceIndex 能记录 knowledge library 根目录、pack id、version/hash。
- TaskEnvelope 和 SubagentTaskEnvelope 能显示本任务注入了哪些知识包。
- Prompt Compiler 和 QA Gate 的接口预留 `knowledgePacks` 输入。
- Knowledge Pack Manifest 能区分 `system_builtin`、`user_custom`、`project_local`、`external_imported`。
- Knowledge Router 能返回结构化 `knowledge_route_result`。
- Context Budgeter 能按 `maxInjectionTokens` 只注入命中内容。
- 前端规划中有 Knowledge Pack Manager，不把 pack 管理藏成开发者配置文件。
- UI 默认不展示术语库，只在 Inspector / Diagnostics 显示注入摘要。

## Phase 3：UI Connects Real Core State

目标：前端展示真实核心状态，而不是只展示导入 JSON。

优先项：

- Director mode 默认简洁。
- Story Flow 读取项目事实文件。
- Visual Memory 读取 `visual_memory.json` 和 source index。
- Queue 读取真实 TaskRun 状态。
- ManifestMatcher status 进入 Diagnostics。
- Preflight blockers 用自然语言解释。
- Inspector 显示 TaskEnvelope / SubagentEnvelope / preflight。
- Diagnostics 显示 queue / provider policy / watcher events / injected knowledge packs。
- Settings shell 初步入口，但不启用真实视频 provider。

完成标准：

- 用户能看到 Story Flow、资产状态、队列状态、阻断原因和下一步建议。
- 普通用户默认不看到 prompt、provider、QA 细节。
- 被 blocker 卡住时，可以展开 Diagnostics 看到机器可读原因。

## Phase 3.5：Story Change Transaction / Reflow

目标：把自然语言修改变成结构化变更事务，避免用户一改剧情就让资产、prompt、QA 全部失控。

优先项：

- `director_intent_result.schema.json`。
- `story_change_transaction.schema.json` 接入 UI。
- `production_bible_patch.schema.json`。
- `reflow_impact_report.schema.json`。
- `artifact_invalidation.schema.json`。
- `asset_lock_scope.schema.json`。
- `voice_change_transaction.schema.json`。

必须支持的变更：

- 插入分镜。
- 删除分镜。
- 移动分镜。
- 改角色设定。
- 改场景设定。
- 改风格。
- 改对白 / 旁白。
- 改音色 / 音源。

硬规则：

- 用户自然语言不能直接变成 prompt patch。
- 先产生 transaction，再计算 impact scope。
- 受影响的资产、prompt、关键帧、视频、音频、preview 必须标记 stale。
- 关键人物、场景、声音变更需要用户确认。

完成标准：

- 每一次故事变更都能列出：保留什么、失效什么、需要重生什么、是否需要用户确认。
- reflow 结果能写回 SourceIndex 和 TaskRun。

## Phase 3.8：Tauri Runtime Spike + Settings Shell

目标：验证 Mac/Windows 桌面路线，不把业务编排过早下沉到 Rust。

优先项：

- Tauri shell spike。
- macOS / Windows path abstraction。
- sidecar permission model。
- runtime config。
- credential storage。
- tool detection UI。
- FFmpeg detection。
- Codex/Image2 runtime detection。
- diagnostics export。
- provider enablement settings。
- voice source registry placeholder。

边界：

- 早期 Rust/Tauri 只管窗口、权限、文件选择、sidecar 启停、基础文件监听。
- 业务编排、schema、prompt compiler、queue 先留在 TypeScript/Node core。
- Seedance / Jimeng 在用户显式启用前仍是 parked。

完成标准：

- 同一项目能在 Mac/Windows 路径规则下打开。
- sidecar 只有白名单命令和参数。
- Settings 能显示工具是否可用，但不自动提交真实 provider 任务。

### Phase 3.8.1：最小安全 runtime/settings shell

完成范围：

- `ProjectRuntimeState.runtime` 记录只读 RuntimeConfig、ToolDetectionReport、provider enablement summary。
- import runtime test 只用本机 `which/where` 与版本命令检测 Node/npm/git/FFmpeg/FFprobe/Codex，不安装、不下载、不读取凭证、不提交 provider。
- Settings Shell 只在 Diagnostics 中展示 runtime facts、tool detection、sidecar policy、provider enablement、voice source placeholder。
- Image2 slots 可显示为 active；Seedance/Jimeng video slots 仍 parked；audio 仍 planned。

## Phase 4：Image2 Adapter + Prompt Compiler + Asset Readiness

目标：只接图片链路，不碰视频真实提交。

优先项：

- Image2 provider capability。
- Image2 adapter。
- Image2 prompt compiler。
- Knowledge Router 接入 prompt compiler。
- Asset Readiness Gate。
- Scene Asset Pack 生成 / 导入 / 锁定。
- character reference generation。
- scene master reference generation。
- derived scene view generation。
- start frame generation。
- end frame edit from start。
- QA packet generator。
- contact sheets。

硬规则：

- Image2 only 是图片链路默认策略。
- 不允许 image-to-image fallback 成 text-to-image。
- end frame 默认必须从 start frame 派生。
- candidate / temp / rejected 不能作为 future reference。
- 无 locked scene view 只能 draft，不能 formal。
- OpenCV/local postprocess 只允许尺寸、格式、轻量裁切、预览，不做语义修复。

完成标准：

- 单镜头关键帧闭环：SourceIndex -> Preflight -> TaskEnvelope -> Image2 -> Watcher -> ManifestMatcher -> QA -> formal promotion。
- 插入新分镜时能复用 locked assets，并正确标记受影响 prompt stale。

### Phase 4.0-4.2：核心合同层完成范围

已完成：

- Provider Capability Matrix：新增 `ProviderRegistry` / `ProviderCapability` 合同与 schema，Image2 图片 slots 只做 dry-run 能力声明，Seedance/Jimeng 视频能力保持 parked，所有 capability 的 `liveSubmitAllowed=false`。
- Prompt Compiler Skeleton：新增 `ShotPromptPlan` / `PromptConflictReport` 合同与 schema，编译结果只保留 source intent、preserve/avoid/reference/style/adaptor 状态，不把自然语言直接改写成 provider prompt patch。
- Asset Readiness Gate：新增 `AssetReadinessReport` 合同与 schema，检查 locked、candidate、missing、temp/rejected/failed 污染风险；无 locked scene view 或 locked character 时仅允许 draft/formal blocked。
- `ProjectRuntimeState.imagePipeline` 汇总 provider registry、prompt plans、prompt conflict reports、asset readiness reports。
- `import-runtime-test` 生成 Phase 4 dry-run 初始状态，不提交 Image2，不调用 Seedance/Jimeng，不允许 `image.edit` fallback 到 `text2image`。

### Phase 4.3-4.4：Image2 Task Planning Bridge / Adapter Dry-run Contract 完成范围

已完成：

- 新增 `ImageTaskPlan` 合同与 schema，把 `ShotPromptPlan`、`AssetReadinessReport`、`TaskEnvelope` summary 连接成 dry-run task plan。
- 新增 `Image2AdapterRequest` 合同与 schema，只输出 Image2 adapter payload skeleton/source facts，不编译最终 provider prompt 文本。
- Image2 adapter request 强制 `dry_run_only/manual_submit_required/live_submit_forbidden`，并在 `image2image` 路径显式禁止 `image2image_to_text2image` fallback。
- `ProjectRuntimeState.imagePipeline` 追加 `imageTaskPlans` 和 `image2AdapterRequests`。
- `import-runtime-test` 为图片 jobs 生成 task plans 和 dry-run adapter requests；video jobs 只保留 blocked/parked task plan，不生成 Image2 request。

### Phase 4.5：Watcher Events + Generation Health + QA Promotion Shell 完成范围

已完成：

- 新增 `WatcherEvent` / `GenerationHealthReport` / `QaPromotionReport` 合同与 schema，只从 file snapshot、manifest match、prompt/asset readiness facts 推导状态，不启动真实 watcher，不调用 provider。
- `buildWatcherEventsFromImagePipeline` 输出 expected output、temp/candidate、manifest mismatch、postprocess recoverable、blocked、worker exit without expected output 等事件 shell。
- `buildGenerationHealthReports` 合并 expected output、manifest、QA、prompt freshness、asset readiness，输出 waiting / output_detected / qa_pending / formal_ready / blocked / failed。
- `buildQaPromotionReports` 明确 required gates：expectedOutput、manifestMatch、promptFresh、assetReadiness、qaPass；只有全部通过才允许 `canPromoteToFormal=true`，且不会把 worker self-report success 当成 formal success。
- `ProjectRuntimeState.imagePipeline` 追加 `watcherEvents`、`generationHealthReports`、`qaPromotionReports`。
- `import-runtime-test` 基于 `fileSnapshot` / expected outputs 生成 4.5 reports；QA 缺失时只进入 blocked/qa_pending，不会产生 formal promotion。

## Phase 5：Preview / Export

目标：先做 rough preview 和素材导出，不做重剪辑软件。

优先项：

- draft_preview / formal_preview。
- image hold preview。
- blocked placeholder。
- audio placeholder。
- current shot highlight。
- preview event model。
- rough cut proxy。
- formal preview gate。
- export profiles。

Export profiles：

- rough cut。
- asset package。
- storyboard table。
- prompt / QA developer archive。
- PR / 达芬奇 / 剪映友好目录结构预留。
- FCPXML / EDL 未来预留。

硬规则：

- blocked material 不能进入 formal preview。
- draft preview 可以显示 candidate、image hold、blocked placeholder。
- formal preview 必须通过 pair QA、video QA、manifest matcher、无 P0、无 unknown gate。

完成标准：

- 用户能快速看节奏和故事走向。
- 用户能批量导出素材包去外部剪辑软件继续处理。

### Phase 5 Preview / Export 核心合同完成范围

已完成核心合同层，不含 UI 和真实导出：

- 新增 `PreviewPlan` / `ProjectPreviewExportState` / `ExportProfile` / `ExportPackagePlan` 合同与 schema。
- `ProjectRuntimeState.previewExport` 从 preview events、shots、manifest matches、generation health、QA promotion、task runs 推导 draft preview、formal preview gate、rough cut proxy 和四类 export profile。
- draft preview 允许 `image_hold`、`video_clip`、`blocked_placeholder`；formal preview 不接收 blocked placeholder，并在 pair QA、video QA proxy、manifest matcher、promotion、P0、unknown gate、video present 任一失败时保持 blocked。
- export profiles 仅生成 rough cut、asset package、storyboard table、prompt/QA developer archive 的 dry-run package plan；PR / 达芬奇 / 剪映目录和 FCPXML / EDL 只作为 future slots，不写真实文件、不提交 provider。

## Phase 6：Audio Planning

目标：先做声音规划和占位，不急着接真实 TTS/BGM。

优先项：

- `audio_plan.schema.json`。
- Voice Memory 接入 ProjectSourceIndex。
- voice source registry。
- narration / dialogue / ambience / bgm brief。
- no bgm for video provider 默认约束。
- TTS/BGM provider slot。
- preview mix placeholder。

硬规则：

- 视频生成 prompt 中默认 `no bgm`，除非任务明确是带环境声测试。
- BGM 由 audio plan 或后期导入处理，不和视频 provider 混在一起。
- 音源变更要产生 voice_change_transaction。

完成标准：

- 每个 shot 能知道是否有旁白、对白、环境音、BGM 需求。
- Settings 能预留用户自定义音源。

Phase 6 已实现范围（核心合同）：

- `ProjectRuntimeState.audioPlanning` 作为只读/dry-run 状态树，包含 shot-level `AudioPlan`、voice source registry 摘要、preview mix placeholder、视频 no-bgm policy、audio export package 摘要。
- 每个 shot 默认生成完整 AudioPlan；`musicAllowed=false`，`outputPath=null` 不视为真实音频成功文件。
- audio provider slots 保持 `planned` / `liveSubmitAllowed=false` / `providerSubmissionForbidden=true`，不接 TTS/BGM provider，不写真实音频文件。
- BGM 不进入 video provider；视频侧默认 `noBgmForVideoProvider=true`，环境音/SFX 只作为 audio plan placeholder。

## Phase 7：Video Provider Enablement

目标：核心链路稳定后，才允许视频 provider 从 parked 进入 user-enabled。

优先项：

- Seedance / Jimeng enablement flow。
- user confirmation gate。
- video provider capability。
- queue concurrency。
- provider-ready derivative。
- start/end frame validation。
- no bgm prompt compiler。
- video QA。
- stall timeout / long queue handling。

硬规则：

- 初期不走 text-to-video 主路径。
- Fast 模型不作为正式质量路径。
- 视频 provider 默认 parked。
- 未通过 keyframe pair QA 不能进视频生成。
- 不能使用 VIP/Fast 通道，除非用户显式切换实验模式。

完成标准：

- 视频任务可以排队、续跑、显示等待、失败重试。
- 用户不需要持续点击提交下一条。

### Phase 7.1 已实现范围：Video Provider Readiness / Queue Shell

- `ProjectRuntimeState.videoPlanning` 写入 shot-level video readiness gates、dry-run `VideoTaskPlan`、queue shell summary、provider policy summary。
- 每个 shot 检查 start/end frame、keyframe pair derivation、pair/story gate、no-BGM policy、parked video provider、manifest/preflight facts、P0/blocker；identity/scene/prop/style 允许 `N/A`，但 `FAIL` 仍阻断。
- `VideoTaskPlan` 固定 `providerSlot=video.i2v`、`requiredMode=frames2video`、Seedance/Jimeng parked provider path，并强制 `dryRunOnly=true`、`providerSubmissionForbidden=true`、`fastModelForbidden=true`、`vipChannelForbidden=true`、`textToVideoForbidden=true`。
- Queue shell 只统计 pending/ready/blocked/parked、并发 placeholder、auto-continue placeholder、long queue timeout placeholder；不会提交 Seedance/Jimeng。
- Provider policy summary 明确 video providers remain parked、`liveSubmitAllowed=false`、后续必须用户显式 enablement。

### Phase 7.2 已实现范围：Adapter Settings Shell / Video Queue Tests

- `RuntimeConfig.providerAdapterSettings` 记录 Image2、Seedance 2、Jimeng 的 read-only adapter shell；只展示 provider/slot/mode/credential/support facts，不保存 API key，不提交 provider。
- Seedance/Jimeng adapter shell 固定 `slot=video.i2v`、`requiredMode=frames2video`、`state=parked`、`liveSubmitAllowed=false`、`providerSubmissionForbidden=true`。
- Adapter shell 明确禁止 `fast_model`、`vip_channel`、`text_to_video_main_path`、`bgm_in_video_prompt`、`live_submit`。
- Settings Shell 只展示 provider adapter readiness，不提供启用、登录、保存密钥或提交入口。
- 新增 `npm run video:test`，覆盖 empty / blocked / parked / ready / blocked+parked / blocked+ready / blocked+pending 队列状态，并检查 runtime-state 中所有 video task plan 和 adapter shell 的硬锁。

### Phase 7.3 已实现范围：Video Execution Preview / Subagent Packet Preview

- `ProjectRuntimeState.videoExecutionPreview` 从 `videoPlanning.taskPlans` 和 readiness gates 派生一条只读 execution preview；每条 preview 绑定 `shotId`、`taskPlanId`、`readinessGateId`、`providerSlot=video.i2v`、`requiredMode=frames2video`。
- Preview 状态区分 `blocked`、`preview_ready`、`parked`；blocked task 继承 task/gate blockers 且 `canPreviewPacket=false`，所有 preview 都固定 `canExecute=false`、`dryRunOnly=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`。
- `subagentPacketPreview` 是结构化摘要，不是自由 prompt；包含 selected shot、start/end frame refs、keyframe pair derivation、provider policy summary、read scope allow/deny、mustPreserve/allowedDelta/mustNotAdd、expected output contract 和 required knowledge categories。
- Hard locks 固定包含 `no_live_submit`、`no_fast_model`、`no_vip_channel`、`no_text_to_video_main_path`、`no_bgm_in_video_prompt`、`start_end_frames_required`、`subagent_must_use_packet`。
- Execution order 只展示未来顺序：`prepare_subagent_packet -> inspect_readiness_gate -> compile_provider_adapter_payload_placeholder -> wait_for_user_enablement`；Phase 7.3 不执行命令、不提交 Seedance/Jimeng、不写真实 prompt 文件。
- 新增 `schemas/video_execution_preview.schema.json` 并纳入 schema registry 与 `project_runtime_state.schema.json`；`npm run import:test` 会生成 runtime-state 中的 preview，`npm run video:test` 覆盖 preview hard locks、blocked/canExecute 规则和执行暗示禁用。

## Phase 8：Multi-provider Expansion

目标：让 Vibe Core 能替换 Codex CLI、Image2、视频模型或本地 workflow，而不是重写产品。

优先项：

- AgentAdapter。
- WorkerAdapter。
- ProviderAdapter。
- future image API。
- future video API。
- local workflow。
- provider onboarding checklist。
- capability matrix。
- adapter contract tests。

硬规则：

- Story Flow、Visual Memory、Preflight、TaskEnvelope、SubagentEnvelope、Queue、ManifestMatcher、QA Gate 不能依赖某个 CLI 的身份。
- 新 provider 只能通过 adapter contract 接入。
- provider capability 不支持的能力，必须由 adapter 编译降级或阻断，不能让 prompt 假装支持。

完成标准：

- Codex CLI 是默认实现，而不是唯一架构。
- 未来替换 CLI 或模型时，核心项目格式和合同层不需要推翻。

### Phase 8.1 已实现范围：Adapter Contract Skeleton

- `ProjectRuntimeState.adapterContracts` 写入只读/dry-run adapter contract state，覆盖 `codex-cli-agent`、`subagent-worker`、Image2 分 slot 合同（`image2-provider`、`image2-edit-provider`、`image2-reference-asset-provider`）、`seedance2-provider`、`jimeng-video`、`local-postprocess-planned`。
- AgentAdapter 只声明 agent runtime 能力：subagent、Image2 runtime、context packet、thread handoff、structured result；不绑定 UI，不保存 credentials，不允许 live submit。
- WorkerAdapter 固定通过 `subagent_task_envelope.schema.json` 和 context packet 执行，声明 allowed purposes、read/write scope policy，并禁止 freeform context / envelope bypass。
- ProviderAdapter 只声明 provider slot / required mode / capability refs / policy；同一个 provider 能力必须按 slot/mode 对齐，不能把 `image.generate`、`image.edit`、`image.reference_asset` 混成一个可执行入口。Image2 是 active + dry-run only，Seedance/Jimeng video parked，local postprocess planned。
- Contract summary 提供后续 UI 可直接读取的 adapter id 摘要、active image provider、parked video providers、`liveSubmitAllowed=false`、`credentialStorage=false`、contract violations。
- 新增 `schemas/adapter_contract.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；`npm run import:test` 会生成同等 adapterContracts 状态，不依赖 TS 编译产物。
- 新增 `npm run adapter:test`，覆盖 dry-run/read-only、未知 provider slot 禁止、Image2 active/dry-run、Seedance/Jimeng parked、worker/subagent envelope gate、无 credentials、无 live submit、无 arbitrary provider command。

### Phase 8.2 已实现范围：Adapter Contract Diagnostics

- Diagnostics 新增 `Adapter Contract Diagnostics`，只读展示 contract summary、agent/worker/provider contract 数量、active Image2 provider、parked video providers、contract violations。
- Provider contract 以诊断列表展示 `id`、`state`、`slot`、`requiredModes`、capability refs 数量、dry-run/read-only/provider locked 状态；不展示 provider prompt、payload、密钥、登录或复杂配置参数。
- Worker contract 展示 envelope schema、context packet required、bypass locked、read/write scope policy；不提供 bypass、freeform context、执行或提交入口。
- Settings Shell 只加入轻量 read-only 摘要，继续不提供 enable provider、submit live、run adapter、save credentials 等操作。
- `assertProjectRuntimeState` 追加 adapter contract 硬锁校验：agent/worker/provider 全部必须 dry-run/read-only/no-live/no-credential，Image2 三个 slot 必须分开，Seedance/Jimeng 必须 parked + `video.i2v/frames2video`，local postprocess 只能 planned。

### Phase 8.3 已实现范围：Knowledge Router / Skill Injection Harness

- 新增 `npm run knowledge:test`，只读验证 `resources/knowledge_pack_manifest.json` 和 `resources/knowledge/router_test_cases.json`；测试不连接真实 provider、不提交任务、不导入外部资料。
- 测试覆盖 enabled knowledge pack 的 `version`、`hash`、`path`、`maxInjectionTokens`，并要求 enabled `external_imported` pack 必须是 verified/trusted 且带 verification report。
- 测试按当前 `knowledgeRouter` 的最小路由逻辑验证每个 router case：`expectedPackIds` 必须命中，`forbiddenPackIds` 不能命中。
- 测试复刻 `contextBudgeter` 的预算注入规则，验证总注入预算不超过 L1 harness budget，单个 pack 不超过自身 `maxInjectionTokens`。
- 测试扫描结构化 route/budget 结果，禁止出现 live submit、provider unlock、provider/preflight/QA/policy/envelope bypass 等危险语义。
- `PromptCompiler` 改为只读取当前 `TaskEnvelope` 已注入的 knowledge pack 记录，不再从全量 manifest 自行挑选风格/构图/运镜资料。
- `VideoExecutionPreview` 绑定完整 `SubagentTaskEnvelope` 只读预览，展示未来 video worker 会收到的标准 context packet、injected knowledge、read scope 和 QA pack hash 要求；仍不创建真实 prompt 文件或 provider task。
- Diagnostics 中 `Skill Injection Harness / Knowledge Router` 只展示 route result、context budget、task packet 注入摘要和 warnings，不展示完整知识包正文或 provider payload。

禁止项：

- Knowledge Pack 不能覆盖 provider policy、preflight、reference authority、keyframe pair derivation 或 QA 硬阻断。
- Knowledge Router 不能把整库塞给 agent；只允许按任务、provider slot、用户意图和预算注入命中小包。
- Skill Injection Harness 不能变成用户主界面的复杂 prompt/资料面板；前端只可在 Inspector / Diagnostics 摘要展示。
- Phase 8.3 仍不接真实 provider，不启用 Seedance/Jimeng live submit，不提供 provider unlock、bypass 或 credential 写入入口。

### Phase 8.4 已实现范围：Generation Harness

- `ProjectRuntimeState.generationHarness` 写入 Phase 8.4 的硬性 dry-run 审计链，把现有 `imagePipeline` 的 `imageTaskPlans`、`promptPlans`、`promptConflictReports`、`assetReadinessReports`、`image2AdapterRequests`、`watcherEvents`、`generationHealthReports`、`qaPromotionReports` 聚合成逐 job 状态机。
- 每个 harness job 固定覆盖 `shot_spec -> visual_memory -> spatial_memory -> shot_layout -> style_capsule -> shot_prompt_plan -> provider_capability_check -> provider_request_preview -> candidate_output -> qa_gate` 十个 stage，并保留 source refs、blockers、warnings。
- 每个 harness job 和全局 state 都固定 `dryRunOnly=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`；provider request 只允许 preview，不提交 Image2、Seedance、Jimeng 或任何 text-to-video fallback。
- `forbiddenActions` 固定包含 `live_submit`、`provider_unlock`、`prompt_bypass`、`candidate_auto_promote`、`semantic_postprocess_repair`、`text_to_video_fallback`。
- Candidate output 状态显式区分 `missing`、`candidate`、`qa_pending`、`formal_ready`、`blocked`；`autoPromoteToFormal=false`，只有 health、QA promotion 和显式 QA 全部通过时才设置 `canPromoteToFormal=true`。
- Postprocess policy 明确本地只允许尺寸、格式、预览缩略图、metadata probe、manifest match 等机械处理；`semanticRepairAllowed=false`，`openCvSemanticRepairAllowed=false`，本地后处理不能改变语义、不能提升 formal。
- 新增 `schemas/generation_harness.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run generation:test` 覆盖 stage 完整性、禁止项、dry-run 锁、candidate/formal gate 和 postprocess policy。

禁止项：

- Generation Harness 不能打开真实 provider submit；不能把 ready request preview 解释成已提交任务。
- 不能通过 provider unlock、prompt bypass、candidate auto-promote 或 text-to-video fallback 绕过 Shot Prompt Plan / QA Gate。
- 不能让 OpenCV/local postprocess 承担人物、场景、构图、风格等语义修复；需要语义变化时必须回到 prompt/QA 循环。
- Worker/provider 自报成功仍不等于任务成功；expected output、manifest match、QA pass、asset readiness 和 promotion gate 必须同时满足。

### Phase 8.5 边界：Filesystem Watcher Harness

- Phase 8.5 继续以结构化 watcher event 为边界，监听 Codex generated images 临时目录、项目 outputs、reports、videos、audio，但 watcher 只产出事实事件，不负责提升素材等级。
- 临时图和 provider-ready derivative 可以立即显示为 draft/candidate diagnostics，但不能成为 future reference，不能进入 formal，不能绕过 manifest matcher 或 QA promotion。
- Watcher 必须继续和 Generation Health Checker、Manifest Matcher、Checkpoint Resume、Generation Harness 连接；`formal_output_promoted` 只能由 promotion gate 写入，不能由文件出现或 worker 自报成功触发。
- Phase 8.5 不接 Seedance/Jimeng live submit，不新增 text-to-video fallback，不把 local postprocess 扩展成语义修复器。

### Phase 8.5 已实现范围：Filesystem Watcher Harness

- `ProjectRuntimeState.filesystemWatcherHarness` 写入 Phase 8.5 的 derived/static watcher fact layer，只从 `fileSnapshot`、`manifestMatches`、`imageTaskPlans`、`image2AdapterRequests`、`watcherEvents`、`generationHealthReports`、`qaPromotionReports`、`generationHarness` 归纳事实。
- `monitoredKinds` 和 `monitoredRoots` 固定覆盖 Codex temp generated images、project outputs、reports、videos、audio；每个 root 都是 `derived_static_only`，`daemonStarted=false`，不启动真实 `fs.watch` daemon。
- 每条 watcher event 被映射成一条 `streams` 记录，保留 `eventType`、`artifactPath`、`expectedOutputPath`、`taskPlanId`、`jobId`、`shotId`，并标注 `artifactClass`、`draftOnly`、`canPromoteFormal`、`canBecomeFutureReference`、`requiresManifestMatch`、`requiresQaPass`。
- Stream 会连接 Generation Harness：能匹配时写入 `generationHarnessJobId`，不能匹配时写入 `harnessLinkStatus=missing_harness_link` 和原因；同时引用 generation health、QA promotion、manifest match 状态。
- 硬锁固定为 `watcherCannotPromoteFormal=true`、`workerSelfReportCannotComplete=true`、`tempOutputDraftOnly=true`、`semanticPostprocessForbidden=true`、`liveSubmitAllowed=false`、`providerSubmissionForbidden=true`，并额外固定 `derivedOnly=true`、`fsWatchDaemonEnabled=false`、`daemonStarted=false`。
- 新增 `schemas/filesystem_watcher_harness.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run watcher:test` 覆盖 required field、event stream 纳入、temp/candidate draft-only、promotion gate 来源、禁止锁、Generation Harness linkage、no daemon/live submit。

禁止项：

- Filesystem Watcher Harness 不能启动真实 watcher daemon，不能 move/copy/delete 本地文件，不能提交 provider，不能把 temp/candidate/expected output 自动晋升为 formal。
- Worker/provider 自报成功只能形成结构化风险事实，不能让任务 complete，也不能作为 formal promotion gate。
- `canPromoteFormal=true` 只能来自 `qaPromotionReports.canPromoteToFormal=true`；temp candidate、provider-ready derivative、recoverable derivative 永远不能成为 future reference。
- Phase 8.5 仍不接 Seedance/Jimeng live submit，不新增 text-to-video fallback，不把 local postprocess 用作语义修复器。

### Phase 8.6 已实现范围：Checkpoint Resume Harness

- `ProjectRuntimeState.checkpointResumeHarness` 写入 Phase 8.6 的 dry-run resume plan，只从 `manifestMatches`、`fileSnapshot`、`imageTaskPlans`、`generationHealthReports`、`qaPromotionReports`、`generationHarness`、`filesystemWatcherHarness` 归纳逐 job 恢复状态。
- 每个 resume item 保留 `taskPlanId`、`jobId`、`shotId`、`harnessJobId`、`expectedOutputPath`、`candidatePath`、`formalPath`、manifest / health / QA / promotion 状态、关联 watcher stream ids，以及 `resumeStatus`、`resumeDecision`、`skipAllowed`、`rerunAllowed`、`manualReviewRequired`、`blockingReasons`。
- `skipAllowed=true` 只允许出现在已存在 formal path 且 manifest match、QA pass、`qaPromotionReports.canPromoteToFormal=true`、prompt/source hash 新鲜的 item 上；expected output 存在、worker 自报、watcher 检测都不能单独完成任务。
- temp candidate、provider-ready derivative、postprocess recoverable derivative 永远不能作为 formal resume；它们只能进入 `manualReviewRequired=true` 或 `rerunAllowed=true` 的 dry-run 计划。
- 缺 expected output 会写成 `rerunAllowed=true`，但只代表计划建议；Phase 8.6 不启动 worker、不提交 provider、不改写文件。
- 硬锁固定为 `dryRunOnly=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`、`noFileMutation=true`、`noAutoSkipWithoutQa=true`、`workerSelfReportCannotComplete=true`、`tempCandidateCannotResumeAsFormal=true`，并额外固定 `planOnly=true`。
- 新增 `schemas/checkpoint_resume_harness.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run resume:test` 覆盖 required field、imageTaskPlan 全覆盖、skip gate、temp/candidate 禁 skip、missing output rerun、硬锁、watcher stream linkage、Generation Harness linkage。

禁止项：

- Checkpoint Resume Harness 不能真实 skip、rerun、move、copy、delete、rename、promote formal 或提交 provider；它只生成恢复计划。
- 不能把 `expected_output_detected`、file exists、worker/provider self-report、adapter request preview 解释为 complete。
- 不能在 stale prompt/source hash mismatch 时允许 skip。
- 不能让 temp/candidate/provider-ready derivative 自动接管为 formal；需要人工 review 或重新生成计划。

### Phase 8.7 已实现范围：QA Harness

- `ProjectRuntimeState.qaHarness` 写入 Phase 8.7 的 plan/fact/diagnostics QA 层，只从 `generationHealthReports`、`qaPromotionReports`、`manifestMatches`、`assetReadinessReports`、`promptPlans`、`promptConflictReports`、`generationHarness`、`filesystemWatcherHarness`、`checkpointResumeHarness`、`videoPlanning`、`audioPlanning`、`storyFlow.shots` 归纳事实。
- QA 输出固定 `overallFirst=true`：先生成 `overall` sequence verdict，再生成逐 shot `items`。维度顺序固定为 `whole_film`、`identity`、`scene`、`pair`、`story`、`prop`、`style`、`motion`、`audio`。
- 每个维度使用现有 `GateStatus`：`PASS|PARTIAL|FAIL|N/A|UNKNOWN`，并保留 `severity`、`blockers`、`warnings`、`sourceRefs`、`notes`。没有事实支撑时不能假装 PASS，只能落到 `UNKNOWN`、`PARTIAL` 或 `N/A`。
- 每个 QA item 至少绑定 `shotId`，并尽量绑定 `taskPlanId`、`jobId`、`harnessJobId`、`checkpointResumeItemId`、`videoTaskPlanId`、`audioPlanId`，方便 Diagnostics 从 QA 结果反查事实链。
- `formalPromotionEligible=true` 只能在 `qaPromotionReports.canPromoteToFormal=true`、generation health 为 `formal_ready`、manifest match、prompt fresh、asset readiness ready、explicit QA pass 全部满足时出现；8.7 只报告资格，不提升 formal。
- `requiresHumanReview=true` 会在任何 `UNKNOWN`、`FAIL`、`PARTIAL` 或 blocker 出现时写入；`sourceCoverage` 固定列出所有被引用或缺失的事实层，便于排查 QA 上下文缺口。
- 新增 `schemas/qa_harness.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run qa:test` 覆盖维度顺序、overall-first、硬锁、source coverage、human review、formal promotion eligibility gate。

禁止项：

- QA Harness 不能提交 Image2、Seedance、Jimeng 或任何 provider；不能 move/copy/delete/rename/promote 文件。
- 不能把 worker/provider 自报成功、file exists、adapter request preview、watcher event 单独解释成 QA PASS。
- 不能做语义修复，不能用 local postprocess/OpenCV 修人物身份、场景、构图、故事、风格、motion 或 audio 问题。
- 不能绕过 `qaPromotionReports.canPromoteToFormal`、generation health、manifest match、prompt freshness、asset readiness、explicit QA pass 这些 formal gate。

### Phase 8.8 已实现范围：Tool Runtime Harness

- `ProjectRuntimeState.toolRuntimeHarness` 写入 Phase 8.8 的 top-level runtime diagnostics 层，只从 `runtime.config`、`runtime.detectionReport`、`runtime.providerEnablementSummary`、`adapterContracts`、`generationHarness`、`filesystemWatcherHarness`、`checkpointResumeHarness`、`qaHarness` 归纳工具和路径事实。
- 固定 tool categories 覆盖 `agent_cli`、`node_runtime`、`rust_runtime_or_app_shell`、`media_binary`、`image_tool`、`python_optional`、`provider_cli_optional`、`vcs_optional`、`package_manager`；每条 check row 都保留 `checkId`、`category`、`label`、`requiredFor`、`status`、`pathStatus`、`platformSupport`、`canExecuteNow=false`、`executionMode=diagnostic_only`、`missingIsBlocker`、`blockers`、`warnings`、`sourceRefs`、`notes`。
- `runtime.detectionReport.tools` 是 Codex CLI、Node/npm/git、FFmpeg/FFprobe、Image2 runtime 等已有事实的来源；ImageMagick/system image tool、Python、Rust/app shell、provider CLI 没有检测事实时只输出 planned/missing/optional diagnostics，不假装可用。
- Hard locks 固定 `dryRunOnly=true`、`diagnosticsOnly=true`、`noInstall=true`、`noCredentialRead=true`、`noCredentialWrite=true`、`noSystemSettingsMutation=true`、`arbitraryShellExecutionBlocked=true`、`sidecarDaemonDisabled=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`、`platformPathAbstractionRequired=true`。
- Path policy 固定要求 macOS 使用 POSIX、Windows 使用 Win32、项目 artifacts 优先 project-root-relative；工具路径只能来自 runtime config / detection report，不能写死 shell-only path 或依赖 shell profile。
- `sourceCoverage` 固定列出 runtime config、detection report、provider enablement summary、adapter contracts、generation / watcher / resume / QA harnesses 的 source refs，便于 Diagnostics 反查每条工具诊断来自哪里。
- 新增 `schemas/tool_runtime_harness.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run tool-runtime:test` 覆盖 category 全量、hard locks、path policy、source coverage、schema registry 和 import runtime-state 生成。

禁止项：

- Tool Runtime Harness 不能安装、下载、升级或修复任何软件；不能修改 PATH、shell profile、系统设置或 app 权限。
- 不能读取、写入、显示或迁移 credentials；provider credential store 仍只能是 placeholder/planned fact。
- 不能执行任意 shell，不能启动真实 sidecar daemon，不能把 allowed command policy 解释成已经可以执行。
- 不能提交 Image2、Seedance、Jimeng 或任何 provider；provider CLI optional 只代表未来可诊断事实，不代表 live submit unlock。
- 不能把 optional missing 当 blocker；也不能把 planned/unknown tool 当 available。

### Phase 8.9 已实现范围：Generation Health Checker

- `ProjectRuntimeState.generationHealthChecker` 写入 Phase 8.9 的 top-level diagnostics fact layer，只从 `imageTaskPlans`、`generationHealthReports`、`manifestMatches`、`watcherEvents`、`taskRuns`、`jobs`、`fileSnapshot` 归纳生成健康事实。
- 每个 item 固定输出 expected output、manifest/hash/dimensions/readability、QA coverage、worker exit/artifact consistency、temp recovery 五类事实；worker/job 自报成功只能作为一致性输入，不能单独让任务成功。
- item status 显式区分 `verified_success`、`qa_missing`、`waiting`、`postprocess_recoverable`、`worker_exit_without_expected_output`、`artifact_state_mismatch`、`blocked`；如果 temp/candidate 已存在但 expected output 后处理失败，必须落到 `postprocess_recoverable`。
- Hard locks 固定 `dryRunOnly=true`、`diagnosticsOnly=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`、`workerSelfReportCannotComplete=true`、`expectedOutputRequired=true`、`manifestMetadataRequired=true`、`qaCoverageRequired=true`、`noFileMutation=true`。
- 新增 `schemas/generation_health_checker.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run generation-health:test` 覆盖 recoverable、worker exit without expected output、QA coverage missing、schema registry 和 import runtime-state 生成。

禁止项：

- Generation Health Checker 不能连接真实 provider，不能读 provider credentials，不能生图，不能修复或移动文件。
- 不能把 worker stdout、退出、job.status=success、providerStatus=success 当作完成事实；必须和 expected output、manifest metadata、QA coverage、artifact consistency 同时成立。
- 不能把 temp/candidate 当 formal，也不能自动 promote formal。

### Phase 8.10 已实现范围：Prompt Conflict Checker

- `ProjectRuntimeState.promptConflictChecker` 写入 Phase 8.10 的 top-level prompt fact layer，只从 `promptPlans`、`promptConflictReports`、`storyFlow.shots`、`visualMemory.assets`、`jobs` 归纳结构化冲突。
- 检查覆盖 Story Flow 旧功能、garage door vs front door、fixed camera vs 大幅运动、end frame 默认从 start 派生、Visual Memory locked outfit/scene/style 与 prompt 冲突，并保留每条冲突的 `structuredFact`、`promptEvidence`、`sourceRefs`。
- 每条冲突都带 `requiredResolution`，固定要求更新 `Shot Prompt Plan` 并 `recompileRequired=true`；Story Flow / Shot Layout 类冲突会进一步标记需要更新 Shot Spec 或 Shot Layout。
- Hard locks 固定 `dryRunOnly=true`、`diagnosticsOnly=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`、`agentPromiseCannotResolveConflict=true`、`requiresStructuredPlanUpdate=true`、`recompileRequiredAfterConflict=true`、`noPromptBypass=true`。
- 新增 `schemas/prompt_conflict_checker.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run prompt-conflict:test` 覆盖 Story Flow stale、front/garage、fixed-camera movement、independent end frame、locked outfit、schema registry 和 import runtime-state 生成。

禁止项：

- Prompt Conflict Checker 不能用 agent 口头承诺、自由文本补丁或 provider prompt 临时改写来消除冲突。
- 冲突存在时必须更新 Shot Spec / Shot Layout / Shot Prompt Plan 并重新编译；不能绕过 Shot Prompt Plan 直接生成。
- 不能连接真实 provider，不能提交 Image2、Seedance、Jimeng 或任何外部服务。

### Phase 9.1 已实现范围：Project File Core

- `ProjectRuntimeState.projectFileCore` 写入 Phase 9.1 的 top-level file-first project core，声明 `project.vibe` 和项目文件夹结构是计划中的事实源；本阶段不真实写入 `project.vibe`，不创建目录，不移动用户文件。
- `projectFileCore.plannedFileTree` 覆盖 `project.vibe`、project manifest、`production_bible`、`story_flow`、`visual_memory`、`shots`、`manifests`、`reports`、`preview`、`exports`、`knowledge`、`settings` 等规划路径，全部使用 project-root-relative contract。
- `sourceOfTruthPriority` 明确 runtime-state 只能作为 `derived_cache`，不能覆盖 project manifest / production bible / story flow / visual memory / shots 等 file-first 事实。
- `derivedCachePolicy` 以 `sourceIndexHash`、project version、generatedAt 作为 cache key，声明 runtime-state 可由项目文件事实重建，逐步从唯一事实源退为 derived cache。
- `pathPolicy` 固定只允许 `project_root_relative` 或 `user_selected_import`；硬编码 macOS/Windows 绝对路径不能进入可移植合同。
- Hard locks 固定 `dryRunOnly=true`、`readOnly=true`、`noFileMutation=true`、`noUserFileMove=true`、`noProviderSubmit=true`、`noImageGeneration=true`、`noVideoGeneration=true`、`noArbitraryShell=true`、`noCredentialRead=true`、`noCredentialWrite=true`、`projectVibeWriteAllowed=false`。
- 新增 `schemas/project_file_core.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run project-file:test` 覆盖 required planned paths、runtime-state derived cache、noFileMutation、path abstraction、schema registry 和 runtime schema 接线。

禁止项：

- Project File Core 不能写 `project.vibe`、不能创建或迁移文件夹、不能移动或重命名用户文件。
- 不能把 runtime-state 当成唯一事实源；它只能是由项目文件事实和 audit/runtime facts 构造出的缓存。
- 不能提交真实 provider，不能生图生视频，不能执行任意 shell，不能读取或写入 credentials。

### Phase 9.2 已实现范围：Project Fact Schemas

- 新增第一批 file-first 项目事实源合同：`production_bible.schema.json`、`story_flow.schema.json`、`shot_spec.schema.json`、`shot_layout.schema.json`、`visual_memory.schema.json`、`spatial_memory.schema.json`、`voice_memory.schema.json`、`scene_asset_pack.schema.json`。
- 本阶段只做 schema/docs/test-only，不接真实 provider，不生图生视频，也不让自由文本 prompt 绕过项目事实文件。
- Visual Memory 明确是资产一致性系统，不是图库；只收 `locked`、`candidate`、`rejected` 的角色、场景、道具、风格、声音锚点，并通过 ReferenceAuthority 声明权限范围。
- v0.1/v0.3 最低兼容：至少支持 1 张主角参考、1 张场景参考、文本约束和 locked 状态；结构预留三视图、多视角扩展。
- Scene Asset Pack 必须包含 master scene、derived views、camera vectors/world position、candidate/rejected 状态和 master inheritance；多视角不能只靠文字复述。
- Shot Layout 必须表达 subject placement、camera placement、axis/direction、start/end frame derivation、fixed camera / camera movement constraints。
- Story Flow section/act 自适应，不写死 Act I-IV。
- Voice Memory 只预留音源，不读也不保存敏感 provider auth material。
- OpenCV/local postprocess 不能承担身份、服装、场景、视角、风格语义修复。
- 新增 `npm run project-facts:test`，覆盖 schema JSON parse、title/id、关键 required 字段和上述产品硬规则。

未在本阶段做：

- 暂不注册 `schemaRegistry`、不接 `ProjectRuntimeState`、不改 `projectStateBuilder`；这些交由主集成统一接线，避免和 Project File worker 冲突。

### Phase 9.3 已实现范围：Subagent Envelope Runner Skeleton

- `ProjectRuntimeState.subagentRunner` 写入 Phase 9.3 的 dry-run/diagnostics-only runner skeleton，只从 `videoExecutionPreview`、`generationHarness`、`qaHarness` 归纳未来 worker slots 和 coverage。
- runner 明确表达生产 worker 只能从 validated `SubagentTaskEnvelope` 启动；`noFreeTextTask=true`、`validatedEnvelopeRequired=true`，自由文本请求只能落为 `blocked_missing_envelope`。
- packet requirements 固定要求 `sourceIndexHash`、`providerPolicySummary`、`expectedOutputContract`、`qaChecklist`、`subagent_result_v1` output schema、forbidden actions/read scopes 完整。
- coverage 显式区分 `image`、`asset`、`pair_qa`、`scene_qa`、`story_audit`、`video_execution`、`audio`、`export`；现阶段 video packet 可从 Phase 7.3 preview 识别，generation/QA/audio/export 主要标记 planned/missing coverage。
- 新增 `schemas/subagent_runner.schema.json` 并纳入 `project_runtime_state.schema.json` 与 schema registry；新增 `npm run subagent-runner:test` 覆盖 free text blocked、missing envelope blocked、video packets recognized、provider submit forbidden 和 schema 接入。

禁止项：

- Phase 9.3 不拉 Codex CLI，不 spawn agent，不执行 shell，不提交 provider，不读 credential，不移动或改写文件。
- 没有 envelope 的任务不能 ready；只能是 `planned_missing_envelope` 或 `blocked_missing_envelope`。

### Phase 9.4 测试边界：Minimal Director UI Contract

- `npm run minimal-ui:test` 是 Phase 9.4 的轻量静态合同测试，不启动浏览器、不连接 provider、不生成素材，只读取 `src/App.tsx`、`src/styles.css`、`package.json` 和相关文档。
- Director 主界面必须保留创作入口和轻量工作面：Asset Library、Preview、Selected / Scope、Diagnostics 入口、Story / section tabs。
- 工程状态词应主要收纳到 Diagnostics：provider、manifest、schema、queue、task envelope、hard lock、forbiddenActions 等不能在 `DirectorMode` 主体附近大量堆叠。
- Preview / Asset Library 不能退回 contact sheet 图库。`contactSheets` 只能留在 Diagnostics 或明确的诊断路径，不应常驻 Director minimal path。
- 新增 UI 实现时，先跑 `npm run minimal-ui:test`，再跑必要的 build / runtime 测试；如果合同测试失败，优先判断是 UI 主路径真的变重，还是合同规则需要和新组件命名同步。

Phase 9.4 UI scope：默认 Director 首屏收敛为极简导演台，只覆盖顶栏项目名 / Asset Library / 自适应故事段落 / Preview / Diagnostics 入口、image-first Story Flow、独立 Asset Library、右侧 Selected Edit 自然语言面板、沉浸 Preview MVP。工程 dashboard、provider / manifest / queue / schema 细节继续留在 Inspector 或 Diagnostics，不在主界面重复展示。

Phase 9.4 checklist：

- [x] Director 默认首屏能看见创作对象，而不是工程状态面板。
- [x] Diagnostics 是工程状态、provider policy、manifest/source index、schema/queue/task envelope 的主要入口。
- [x] Asset Library 和 Preview 是主界面能力，不是 contact sheet 总览。
- [x] `minimal-ui:test` 纳入集成验证。

### Phase 9.5 已实现范围：Project Store

- 新增 `src/core/projectStore.ts`，提供本地可测试的 file-first Project Store snapshot 合同；`project.vibe`、project manifest、`story_flow`、`visual_memory`、shot specs、source index、runtime-state cache 都只建模为内存/fixture 结构和 read/write plan。
- Project Store 只输出 `createProjectStoreSnapshot`、`openProjectStoreSnapshot`、`saveProjectStoreSnapshot`、`applyProjectStorePatch`、`validateProjectStoreSnapshot`、`deriveRuntimeCachePolicy` 等 pure functions，不创建目录、不写 `project.vibe`、不移动或删除用户文件。
- 路径策略固定为 `project_root_relative` 或 redacted `user_selected_import` token；硬编码 macOS/Windows 绝对路径不能进入 project contract。
- runtime-state 继续是 `derived_cache`，cache key 由 source index hash、project version、fact hash、generatedAt 推导，不能覆盖 project-file facts。
- 新增 `npm run project-store:test` 覆盖 create/open/save snapshot、path policy、runtime derived cache、dry-run write plan 和 no file mutation hard lock。

### Phase 9.6 已实现范围：Selected Edit Structured Loop

- 新增 `DirectorEditPlan` dry-run 闭环：Selected Edit 自然语言先归一为 scope selection、`DirectorIntentResult`、`StoryChangeTransaction` 和 `ReflowImpactReport`，不直接生成或修改 provider prompt。
- scope 基础分类覆盖 `project`、`section`、`shot`、`multi-shot`、`asset`、`voice`、`export`；多镜头范围如 `1-2 到 1-4` 会解析为 shot target set，并把 transaction scope 收敛到 shot-level reflow。
- reflow 输出继续遵守现有 schema enum，同时用 artifact id 精确表达 `shotPromptPlan`、`startFrame`、`endFrame`；Selected Edit plan 汇总更细的 affected artifacts：`shotSpec`、`shotLayout`、`shotPromptPlan`、`startFrame`、`endFrame`、`video`、`audio`、`preview`、`visualMemory`、`spatialMemory`、`productionBible` 等。
- 身份、场景、声音、插入分镜和 locked asset 相关变更会标记 confirmation required；prompt bypass/direct provider prompt patch 会进入 `blocked_prompt_bypass`，并固定 forbidden actions。
- 新增 `npm run director-edit:test` 覆盖多镜头压抑化、插入分镜、角色/场景/声音变更、locked asset confirmation 和 prompt bypass forbidden。

### Phase 9.6 追加已实现范围：Visual Consistency Hard Contracts

- 新增 `src/core/visualConsistency.ts`，提供 Asset Library、Scene Asset Pack、Shot Layout、start/end derivation、postprocess policy 的 pure validation functions。
- 硬合同覆盖：master scene inheritance、derived view world position / camera vector、locked/candidate/rejected future-reference 权限、temp/failed/contact sheet/shot output 禁止作为 future reference、end frame 默认从 start frame 派生、OpenCV/local postprocess 禁止语义修复。
- Visual Consistency 只返回内存 report，不读写项目目录、不生成素材、不提交 provider、不改 UI。
- 新增 `npm run visual-consistency:test`，覆盖通过路径和污染路径：candidate/rejected 权限、contact sheet future reference、derived view inheritance/vector、Shot Layout schema/start-end derivation、OpenCV semantic repair block。

### Phase 9.7 已实现范围：Asset Library CRUD

- 新增 `src/core/assetLibraryCrud.ts`，提供 Asset Library snapshot 的添加、更新、状态标记、Visual Memory 导出和 Scene Asset Pack placeholder 纯函数。
- Asset Library 继续是资产一致性/引用权威系统，不是图库；角色、场景、道具、风格、voice anchor 的 `locked`、`candidate`、`review`、`rejected`、`missing` 状态会映射为 Visual Memory 可用状态或 missing placeholder。
- `locked` 才能作为 future reference；`candidate` / `review` 保持 draft-only；`rejected` 保留 negative/rejected authority；`missing` 不序列化为正式 Visual Memory asset。
- `provider_temp_output`、failed output、shot output、contact sheet 和可疑 temp/cache/candidate 路径会进入 blocked import，不进入正式 Asset Library。
- scene reference 会生成 master scene placeholder，并支持 inherited derived view placeholder，保留 master inheritance、camera vector/world position 占位和 text-only recreation 禁止规则。
- 新增 `npm run asset-library:test` 覆盖主角参考、场景参考、文本约束、locked 状态、禁入 temp/failed/contact sheet/shot output，以及 scene master/derived view placeholder。

### Phase 9.8 已实现范围：Task Envelope Builder

- 新增 Task Packet Builder，从 selected shot / selected asset / story change transaction / runtime state 派生 8 类 dry-run subagent packets：`image`、`asset`、`pair_qa`、`scene_qa`、`story_audit`、`video_execution`、`audio`、`export`。
- ready packet 必须带标准 `SubagentTaskEnvelope`，并显式包含 purpose、story function、previous/next shot、bound assets、mustPreserve、mustAvoid、qaChecklist、expectedOutputContract、allowedReadScope、forbiddenActions、`subagent_result_v1` output schema。
- 缺 source index、selected shot、前后镜头、bound assets、story change transaction 或 video keyframe pair 等硬上下文时，packet 进入 `blocked_missing_context`；blocked packet 不暴露 envelope，满足 no envelope no ready。
- builder 固定 `noFreeTextTask=true`、`validatedEnvelopeRequired=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`；video packet 继承 no fast / no VIP / no text-to-video main path / no BGM in video prompt。
- 新增 `npm run task-packet:test` 覆盖 8 类 packet、缺前后镜头/资产阻断、video hard locks 和 output schema 要求；仍不 spawn agent、不提交 provider、不写真实 prompt 文件。

### Phase 10 已实现范围：Local Orchestrator / Queue Harness

- 新增 `src/core/localOrchestrator.ts`，把 task packets、TaskEnvelope/TaskRun、Generation Harness、Filesystem Watcher Harness、Checkpoint Resume Harness、QA Harness、Subagent Runner 覆盖成 dry-run/plan-only 队列状态机。
- 队列状态固定区分 `waiting`、`ready`、`running_planned`、`waiting_output`、`qa_pending`、`needs_review`、`failed`、`blocked`、`complete_verified`；每条 queue item 保留 expected outputs、completion gate、Codex reconnect/stall/retry budget、manual review、auto-continue marker 和 UI 可读 fact chain。
- Auto-continue 只生成计划：已 `complete_verified` 或 `blocked` 的任务允许下一条可执行任务进入 `ready`，但不会启动 worker、spawn Codex、提交 provider 或改写任何文件。
- Worker/provider 自报成功只能成为 review fact，不能把任务置为 `complete_verified`；完成必须同时满足 expected output declared/observed、manifest match、explicit QA pass、promotion gate。
- Hard locks 固定 `dryRunOnly=true`、`planOnly=true`、`noDaemon=true`、`daemonStarted=false`、`noSpawnCodex=true`、`noShellExecution=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`、`noFileMutation=true`。
- 新增 `schemas/local_orchestrator.schema.json` 并纳入 schema registry；新增 `npm run orchestrator:test` 覆盖 20-task queue、auto-continue plan、stalled task、worker self-report cannot complete、QA missing blocks、provider submit forbidden、no daemon/file mutation。

### Phase 11 已实现范围：Provider Adapter Live Gate

- 新增 `src/core/providerLiveGate.ts`，只从 provider registry、adapter contracts、Image2 adapter request、asset readiness、pair QA、video planning/execution preview、audio no-BGM policy 和用户确认 token placeholder 归纳 enablement readiness / confirmation plan。
- Image2 provider slots 可表示 `user_enabled_pending_confirmation`，但 slot 和 gate item 全部固定 `liveSubmitAllowed=false`、`providerSubmissionForbidden=true`、`credentialStorage=false`；ready item 也只能是 `ready_for_confirmation`，不能提交 provider。
- Seedance/Jimeng video gate 继续默认 `parked`，并固定检查 no fast model、no VIP channel、no text-to-video main path、no BGM in video prompt。
- live path readiness 必须同时满足 adapter contract、provider capability、envelope valid、asset readiness、pair QA、Image2 dry-run adapter request、user confirmation token placeholder；缺任一项都进入 `blocked`。
- 新增 `schemas/provider_live_gate.schema.json` 并纳入 schema registry；新增 `npm run provider-live-gate:test` 覆盖 Image2 readiness、Seedance/Jimeng parked、缺用户确认阻断、无 credential read/write/storage、no fast/VIP/t2v/BGM、provider submit forbidden。

禁止项：

- Phase 11 不提交 Image2、Seedance、Jimeng 或任何 provider，不读取/保存 credentials，不创建 API key，不提供 fast/VIP/text-to-video/BGM video prompt 解锁。

### Phase 11 追加已实现范围：Dry-run Production E2E Loop

- 新增 `scripts/dry-run-production-e2e-test.mjs`，以 fixture-only 方式串起 Project Store snapshot、Asset Library anchors、Director Edit plan、Task Packet Builder、Local Orchestrator plan、Provider Live Gate blocked/no-submit、Export Builder dry-run plan。
- E2E 断言缺 output schema、source hash、asset、neighbor context 任一项时不能进入 formal envelope；缺 QA / manifest / asset readiness 时 formal preview 保持 blocked。
- Worker/provider self-report success 只能进入 review fact，不能让 Local Orchestrator `complete_verified`；Provider Live Gate 始终 `canSubmitProvider=false`、`liveSubmitAllowed=false`。
- Export Builder 继续保持 `noFileMutation=true`，blocked material 只能作为 draft placeholder，不进入 formal preview。
- 新增 `npm run dry-run-e2e:test`；全流程不启动 daemon、不 spawn agent、不读取 credential、不提交 provider、不写真实项目文件。

### Phase 12 已实现范围：Preview / Export Builder

- 新增 `src/core/exportBuilder.ts`，生产 dry-run preview/export package plan：draft preview、formal preview gate、rough cut proxy、四类 export profile、future NLE target placeholder、audio/BGM export policy 和 file mutation hard lock。
- Draft preview 按 shot duration 生成 `image_hold`，已有 video clip 时替换对应 hold；缺失片段显示 `blocked_placeholder`。Formal preview 只允许通过 gate 的 `video_clip`，不会包含 blocked placeholder。
- Formal gate 继续要求 no blocked material、pair QA、video QA proxy、manifest match、QA promotion、no P0/blocker、no unknown gate、video present；失败时 formal preview 保持 `blocked`。
- Export Builder 只规划 `rough_cut`、`asset_package`、`storyboard_table`、`developer_archive` 四类 dry-run profiles；FCPXML、EDL、Premiere Pro、剪映、达芬奇仅作为 disabled future targets。
- Audio/BGM 只进入 audio plan / export plan；`videoProviderBgmAllowed=false`、`bgmIncludedInVideoPrompt=false`，不混入视频 provider prompt。
- 新增 `schemas/export_builder.schema.json` 并纳入 schema registry；新增 `npm run export-builder:test` 覆盖四类 dry-run export profiles、formal preview gate、blocked placeholder 不进入 formal、无文件 mutation、future targets 预留、BGM 只进 audio/export plan。

禁止项：

- Phase 12 不复制、移动、写入、渲染或创建任何文件/目录，不生成 FCPXML/EDL/PR/剪映/达芬奇工程文件，不提交 provider。

### Phase 13 已实现范围：Director UI 接入 Dry-run Workflow

- 右侧 Selected Edit / Agent Panel 已接入 `buildDirectorWorkflowState`，从 shot、asset、section selection 生成 UI 可读的 dry-run workflow state。
- 面板只展示 scope、自然语言输入、状态短句、少量 badge、下一步短句和必要确认提示；transaction id、operation enum、工程队列、provider、manifest、schema、task envelope 等细节继续留在 Diagnostics。
- 该接线只做本地预览计划，不真实提交 provider，不启动 worker，不读取 credential，不写项目文件，也不把 dry-run 结果当作已执行变更。
- `scripts/minimal-ui-contract-test.mjs` 增加 Phase 13 合同断言：MinimalAgentPanel 必须使用 director workflow，且不能直接调用旧 transaction/reflow builder 或暴露工程词。

### Phase 14 已实现范围：Project Runtime 极简入口

- Director 顶部项目名附近新增极简 Project / Plan 入口，只保留 `Project`、`project.vibe`、Plan preview 这类短状态，不把骨架计划误写成真实项目事实验收。
- 主 Director path 仍不展示复杂项目管理器，不暴露 provider、manifest、schema、queue、task envelope、credential 等工程细节；这些继续收纳在 Diagnostics。
- 该入口只是从当前 project state 派生 UI 摘要，不创建、不移动、不改写用户项目文件，不提交 provider，也不把 plan preview 当成已执行变更；runtime cache / no mutation 等工程细节留在 Diagnostics 和 runtime contract。
- `scripts/minimal-ui-contract-test.mjs` 增加 Phase 14 断言：Project / project.vibe / Plan preview 可以出现在主路径，但复杂工程词不能进入极简 Director surface。

## 当前禁止提前做的事

- 不先做精致 UI 抛光。
- 不先接即梦 / Seedance 真实提交。
- 不先做复杂剪辑工程导出。
- 不先做全自动三视图和场景多视角。
- 不把所有知识库一次性塞给 Agent。
- 不让自由文本 prompt 绕过 Shot Prompt Plan。
- 不让 subagent 自由决定正式任务上下文。
- 不把 OpenCV/local postprocess 用作语义修复。
