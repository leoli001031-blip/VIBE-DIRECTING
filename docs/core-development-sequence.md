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

## 当前禁止提前做的事

- 不先做精致 UI 抛光。
- 不先接即梦 / Seedance 真实提交。
- 不先做复杂剪辑工程导出。
- 不先做全自动三视图和场景多视角。
- 不把所有知识库一次性塞给 Agent。
- 不让自由文本 prompt 绕过 Shot Prompt Plan。
- 不让 subagent 自由决定正式任务上下文。
- 不把 OpenCV/local postprocess 用作语义修复。
