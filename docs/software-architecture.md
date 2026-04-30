# Vibe Core Software Architecture

日期：2026-04-29  
状态：开发架构草案 v0.1  
目标平台：macOS / Windows  
当前项目根目录：`/Users/lichenhao/Desktop/vibe core`

## 1. 架构定位

Vibe Core 是 Vibe Director 的桌面应用和本地执行核心。它不是大模型本身，也不是一个重型剪辑软件，而是创作者和 Codex / 生成模型之间的导演台。

一句话：

```text
Vibe Core 负责把“我要拍什么”变成可观测、可恢复、可复验的 AI 视频生产流程。
```

核心边界：

- 用户面对的是极简 Story Flow、Visual Memory、Director Input、Preview 和导出。
- 智能来自 Codex / Agent / Provider；软件负责结构、状态、上下文、任务、资产、队列和 QA。
- 不做无限画布，不做节点编辑器，不做重型剪辑软件。
- 不把所有 prompt、参数、日志和技能暴露给普通用户。

## 2. 技术栈决策

### 2.1 当前代码

当前已实现：

- React
- TypeScript
- Vite
- CSS
- Node.js import script

这部分继续保留，作为桌面应用的前端层。

### 2.2 桌面壳首选：Tauri v2

推荐主线使用 Tauri v2：

```text
React / TypeScript / Vite 前端
-> Tauri WebView
-> Rust Local Orchestrator
-> Codex CLI / Provider CLI / Local Tools
-> Project Store
```

选择理由：

- Tauri 支持 macOS、Windows 和 Linux，未来还能预留移动端。
- 可以复用现有 React/Vite 前端。
- 包体相对轻，使用系统 WebView，不需要每个 app 都带 Chromium。
- Rust 后台适合做本地文件系统、进程管理、队列、watcher、sidecar、权限和安全边界。
- Vibe Core 的核心需求不是复杂网页服务，而是本地生产工作台。

### 2.3 Electron 作为备选

Electron 可以作为备选方案，不作为第一选择。

Electron 优点：

- Node.js 能力内置，接 CLI、文件系统、FFmpeg 和 watcher 更直接。
- 生态成熟，跨平台案例多。
- 如果 Tauri WebView 兼容性或 Rust 开发成本成为明显阻碍，可以切换。

Electron 缺点：

- 包体更大。
- Chromium / Node 权限边界需要更谨慎。
- 对 Vibe Core 这种偏本地控制台的产品来说，默认有点重。

结论：

```text
先按 Tauri v2 设计，保留 Electron fallback。
```

## 3. 总体分层

```text
Desktop App
  Frontend UI
    Story Flow
    Visual Memory
    Director Input
    Preview Timeline
    Settings
    Export

  Local Orchestrator
    Project Store
    State Machine
    Task Queue
    Context Manager
    Knowledge Router
    Task Envelope Builder
    Provider Registry
    Agent Adapter
    Generation Adapters
    Filesystem Watcher
    QA Gate
    Export Packager

  External / Local Executors
    Codex CLI
    Image2 via Codex CLI or API
    Seedance / Jimeng Adapter
    TTS Provider
    Music Provider
    FFmpeg
    Local lightweight postprocess
```

原则：

- UI 不直接调用模型。
- UI 不直接维护复杂 prompt。
- Provider 不直接读 Story Flow。
- 所有生成任务必须先经过 Project Store、State Machine、Task Envelope、Provider Adapter 和 QA Gate。

## 4. 进程模型

### 4.1 桌面主进程

Tauri 主进程负责：

- 打开主窗口。
- 管理文件访问权限。
- 调用 Rust command。
- 管理 sidecar 进程。
- 读写本地项目。
- 发出文件系统事件。

### 4.2 Orchestrator Runtime

Orchestrator 是后台核心，不应该写在 React 组件里。

职责：

- 项目创建、打开、保存。
- Story Flow、Visual Memory、Spatial Memory、Voice Memory 的读写。
- 任务状态机。
- 本地队列调度。
- Codex CLI 子进程管理。
- Provider job 编译、验证和提交。
- 文件夹监听。
- 断点续跑。
- QA 报告收集。

v0.1 可以先用 Node.js sidecar 承接部分逻辑，后续逐步迁到 Rust：

```text
Phase A: React + Node scripts
Phase B: Tauri shell + Node sidecar orchestrator
Phase C: Rust orchestrator owns filesystem/process/queue
Phase D: Node 只保留开发脚本或 provider SDK bridge
```

### 4.3 Worker 进程

长任务不应阻塞主窗口。

Worker 类型：

- `agent_worker`：调用 Codex CLI。
- `image_worker`：Image2 生成/编辑。
- `video_worker`：Seedance / Jimeng / future I2V。
- `audio_worker`：TTS / BGM。
- `qa_worker`：生成 QA packet，调用 subagent 或本地检查。
- `export_worker`：FFmpeg 拼接、转码、打包。

Worker 必须只通过 manifest 和 task envelope 工作，不依赖主界面临时状态。

## 5. 项目数据模型

每个项目是一个可迁移文件夹。

推荐结构：

```text
project.vibe/
  project.json
  production_bible.yaml
  story_flow.yaml
  visual_memory/
    visual_memory.yaml
    characters/
    scenes/
    props/
    style/
  spatial_memory/
    spatial_memory.yaml
    scene_asset_packs/
  voice_memory/
    voice_memory.yaml
  shots/
    shot_spec.yaml
    shot_layouts/
    keyframes/
    videos/
  prompts/
    image2/
    video/
    audio/
  manifests/
    generation_manifest.jsonl
    task_events.jsonl
    provider_registry.yaml
  reports/
    qa/
    contact_sheets/
    audits/
  preview/
    timeline.json
    rough_cut.mp4
  exports/
```

### 5.0 Project Store 实现策略

Vibe Core 的项目状态采用 file-first + index 的混合结构。

事实源：

- YAML / JSON / JSONL 文件是可迁移、可审计、可被 Codex 直接读写的事实源。
- 大媒体文件保存在项目目录内。
- 报告、manifest 和 prompt 都落盘，方便复盘和重跑。

索引层：

- 桌面端可以用 SQLite 保存派生索引和 UI 查询缓存。
- SQLite 不作为唯一事实源；如果数据库损坏，应能从 project files 重建。
- 队列状态、全文搜索、最近打开项目、缩略图缓存、事件聚合适合放 SQLite。

推荐策略：

```text
Project files = canonical source of truth
SQLite index = fast local cache and queue index
```

这样做的原因：

- Agent / Codex 更容易读写普通文件。
- 用户可以把整个项目文件夹拷贝到另一台 Mac/Windows。
- UI 不需要每次扫全量文件才能展示状态。
- 后续 schema migration 和 project repair 更清晰。

### 5.1 必须 schema 化的文件

第一批需要落地：

- `project.schema.json`
- `production_bible.schema.json`
- `story_flow.schema.json`
- `visual_memory.schema.json`
- `spatial_memory.schema.json`
- `scene_asset_pack.schema.json`
- `shot_spec.schema.json`
- `shot_layout.schema.json`
- `shot_prompt_plan.schema.json`
- `keyframe_pair.schema.json`
- `style_capsule.schema.json`
- `voice_memory.schema.json`
- `provider_registry.schema.json`
- `task_envelope.schema.json`
- `generation_job.schema.json`
- `qa_report.schema.json`
- `timeline.schema.json`
- `export_manifest.schema.json`
- `preflight_report.schema.json`
- `queue_state.schema.json`
- `task_run.schema.json`
- `manifest_matcher.schema.json`
- `subagent_result.schema.json`
- `audio_plan.schema.json`
- `director_intent_result.schema.json`
- `story_change_transaction.schema.json`
- `reflow_impact_report.schema.json`
- `artifact_invalidation.schema.json`
- `production_bible_patch.schema.json`
- `voice_change_transaction.schema.json`
- `reference_submission.schema.json`
- `keyframe_pair_derivation.schema.json`

运行原则：

```text
不要相信 Agent 说“我明白了”。
只相信 schema 校验通过、路径存在、状态转移合法、QA gate 通过。
```

### 5.2 Project Source Index

每个项目必须维护自己的 source index。它是 Agent 查询当前事实的入口，优先级高于旧聊天、全局搜索和历史文件。

Source Index 记录：

- 当前 Production Bible、Story Flow、Shot Spec、Shot Layout。
- Visual Memory、Spatial Memory、Style Capsule、Voice Memory 的当前版本。
- locked / candidate / rejected 资产。
- 当前正式 keyframes、videos、audio。
- 当前 prompt hash 和 stale 状态。
- 当前 QA 结论、P0/P1/P2 问题。
- 用户确认过的删改决策。
- 旧失败图、禁用 reference、negative case。
- 关联 Codex thread / session id，仅作为溯源，不作为事实源。

规则：

- Agent 只能把 source index 指向的当前版本当成事实。
- 从旧对话、旧项目、旧测试目录搜到的内容必须先通过 project id、版本号和确认状态过滤。
- rejected / failed / temp / exploratory 不能自动进入 current facts。

### 5.3 Queue / Task Run / Manifest Matcher

队列必须有明确 schema，不能只靠 worker 日志。

`queue_state` 至少包含：

```yaml
queue_id: image2_keyframes_A1
provider_slot: image.generate
concurrency: 3
status: running
active_task_ids: []
pending_task_ids: []
paused_reason: null
```

`task_run` 至少包含：

```yaml
task_id: keyframe_A1_03_start
local_status: pending_local | ready_to_submit | submitted | connection_retrying | generating | temp_candidate_available | qa_pending | succeeded | failed | cancelled | parked
provider_status: not_submitted | querying | queueing | generating | success | fail | unknown
provider_id: openai-image2-api
codex_session_id: null
submit_id: null
retry_count: 0
backoff_until: null
stall_timeout_seconds: 600
temp_dirs: []
expected_outputs: []
actual_outputs: []
last_event_at: null
```

`manifest_matcher` 负责判断：

- expected filename 是否出现。
- 文件 hash 是否匹配。
- 临时图是否已复制到正式 outputs。
- provider-ready derivative 是否存在。
- QA report 是否覆盖该输出。

任务是否完成以 manifest matcher 为准，不以“worker 说完成了”为准。

### 5.4 Preflight Report

每次生成、编辑、视频化、导出前都必须生成 `preflight_report`。

最小字段：

```yaml
preflight_report:
  task_id: keyframe_A1_03_start
  status: pass | blocked | warning
  blockers:
    - code: missing_locked_character
      message_for_user: 这个镜头缺少已锁定的主角参考，不能正式生成。
      technical_detail: visual_memory.character.sora.locked_status != locked
  warnings: []
  checked_at: "2026-04-29T00:00:00Z"
```

Preflight 必查：

- Production Bible 是否存在。
- Shot Spec / Shot Layout 是否 current。
- 绑定资产是否 locked 或允许 candidate。
- reference role 是否正确。
- 是否引用 rejected / temp / failed 资产。
- prompt 是否 stale。
- provider 是否 active。
- provider 是否支持当前 required mode。
- start/end pair 是否满足同镜头派生规则。
- QA blocker 是否未解决。
- 输出路径是否可写。

Preflight 失败时，任务不能进入 queue 的 `ready_to_submit`。

## 6. 核心域模型

### 6.1 Project

保存：

- 项目名
- 根目录
- 当前版本
- 当前 workflow state
- 创建时间和更新时间
- active provider registry
- active style capsule
- active voice source

### 6.2 Production Bible

Story Agent 在整理故事时同步生成。

内容：

- 主题
- 角色列表和剧情功能
- 场景列表和剧情功能
- 重要道具定义
- 视觉禁忌
- 声音方向
- 哪些资产需要长期复用
- 哪些镜头需要 Keyframe Pair

Production Bible 缺失时，只能进入草稿，不允许正式生成。

### 6.3 Story Flow

不是固定 Act I-IV。

段落由故事自适应：

- Act I / Act II / Act III
- 开场 / 失控 / 发现 / 对峙 / 结尾
- 第一章 / 第二章 / 尾声
- 情绪段落

UI 只显示当前故事结构，不强迫所有作品套四幕。

### 6.4 Visual Memory

Visual Memory 是资产一致性系统，不是图库。

管理：

- 核心人物
- 关键场景
- 重要道具
- 风格参考
- 禁用反例

状态：

- `locked`
- `candidate`
- `needs_review`
- `rejected`
- `missing`

规则：

- 临时图、失败图、未验收候选不能成为 future reference authority。
- 资产必须记录被哪些 shot 引用。
- 用户可以用自然语言锁定资产，但系统必须写入结构化锁。

v0.3 最低标准：

- 每个主角 1 张主参考图 + 文本约束 + locked 状态。
- 每个关键场景 1 张主参考图 + 文本约束 + locked 状态。
- 每个重要道具 1 个视觉定义 + 文本约束 + locked 状态。

### 6.5 Spatial Memory

Spatial Memory 负责空间关系。

管理：

- 场景锚点
- 世界坐标
- camera vector
- subject blocking
- 前后镜头轴线
- reveal 状态
- 多视角派生关系

原则：

- 不只用“画面左/右”，还要保存世界位置。
- 多视角不能靠同一段文字重生相似房间。
- 无法确认从 master scene 派生时，只能标 `candidate`，不能标 `locked`。

### 6.6 Shot Spec

Shot Spec 是每个镜头的创作意图源。

字段：

- shot id
- story section
- story function
- emotional turn
- characters
- scene
- props
- dialogue / narration
- duration
- visual memory refs
- spatial memory refs
- style capsule id
- voice refs
- status

### 6.7 Shot Layout

Shot Layout 是后台空间和镜头语言结构，不是给普通用户看的参数面板。

字段：

- camera position
- shot size
- lens hint
- camera movement
- subject world position
- subject screen zone
- depth layer
- anchors
- must preserve
- must avoid

### 6.8 Shot Prompt Plan

生成前必须先有 Shot Prompt Plan。

它同时规划：

- start frame
- end frame
- motion prompt
- pair constraints
- allowed delta
- forbidden changes

规则：

- start/end 不是两条独立 prompt，而是一对镜头状态。
- 同一镜头内 end frame 默认从 start frame 派生。
- 如果变化过大，系统应建议拆镜头或增加 middle frame。

### 6.9 Keyframe Pair

正式视频镜头的默认最小单位：

```text
Shot = start_frame + end_frame + motion_intent + locked_assets + pair_qa_report
```

只有低风险静态镜头可以只用 single anchor frame。

### 6.10 Voice Memory

声音也作为资产管理。

管理：

- 旁白音源
- 角色音源
- 用户自定义音源
- BGM 风格
- 环境音方向
- 授权/商用状态

Settings 要支持添加音源：

- provider
- voice id
- language
- use as narrator / character / brand voice
- commercial use status
- sample path

### 6.11 Reference Authority Model

参考图不是硬锁。每个 reference 必须声明角色和权限范围。

字段：

```yaml
reference:
  id: sora_main_ref_v001
  path: visual_memory/characters/sora/main_ref_v001.png
  reference_role: identity_authority | scene_layout_authority | style_authority | prop_authority | negative_case | rejected_case | temp_candidate
  authority_scope:
    - face
    - hair
    - age
    - costume_logic
  polarity: positive | negative
  locked_status: locked | candidate | needs_review | rejected
  can_promote_to_formal: true
  can_use_as_future_reference: true
  source_task_id: asset_character_sora_v001
  qa_report_id: asset_qa_sora_v001
```

规则：

- identity authority 优先于 scene/style reference。
- scene layout authority 只约束空间和锚点，不能覆盖人物身份。
- style authority 只约束色彩、光线、纹理密度、镜头语言。
- negative/rejected case 只能用于禁止项，不能当正向参考。
- temp candidate 可以展示给用户，但不能作为后续正式 reference。

### 6.12 Audio Plan

Voice Memory 是长期资产，Audio Plan 是每个项目/段落/镜头的声音执行计划。

`audio_plan` 至少包含：

- shot id
- narration text
- dialogue lines
- voice source id
- emotion / delivery notes
- ambience brief
- BGM profile
- music allowed / no music
- target duration
- fade in / fade out
- output path
- linked TTS job id
- linked music job id
- audio QA status

v0.3 可以先做轻量实现：

- 旁白/对白占位。
- TTS job 预留。
- BGM brief 或外部导入。
- preview mix。
- 不做专业混音。

### 6.13 Story Change Transaction / Reflow Engine

自然语言修改不能直接变成 prompt patch。

用户插入分镜、删除镜头、重排段落、修改剧情、改变全片风格、锁定资产、换配音时，系统必须先生成 `story_change_transaction`。

最小字段：

```yaml
story_change_transaction:
  id: change_001
  user_intent: 这一段太慢，删掉重复镜头，并让她更早发现异常
  intent_type: story | shot | asset | style | voice | export
  impact_scope: project | section | shot | asset | voice | export
  target_ids:
    - section_A2
  must_preserve:
    - 主角身份
    - 当前场景空间关系
  must_not_add:
    - 新人物
    - 新道具
  invalidated_artifacts:
    - prompt_A2_04
    - preview_v003
  requires_user_confirmation: true
```

Reflow Engine 负责：

- 重新计算 Story Flow 顺序。
- 标记 stale Shot Spec / Shot Layout / Prompt Plan。
- 判断哪些 keyframes、videos、audio、preview 失效。
- 生成 `production_bible_patch`。
- 关键角色、关键场景、声音和结局变化需要用户确认。

这层是为了防止“用户只是改一句话，系统却拿旧镜头功能继续生成”。

### 6.14 Keyframe Pair Derivation

每个进入视频生成的镜头必须记录首尾帧派生证明。

字段：

```yaml
keyframe_pair_derivation:
  shot_id: A1_03
  start_frame_id: A1_03_start
  end_frame_id: A1_03_end
  end_derivation_source: start_frame | independent_exception | unknown
  valid_for_i2v_pair: true
  exception_reason: null
  allowed_delta:
    - 眼神转向
    - 手部轻微移动
  must_preserve:
    - 同一人物
    - 同一机位
    - 同一场景布局
  must_not_add:
    - 新人物
    - 新道具
```

默认规则：

- 同一镜头内，end frame 必须从 start frame 派生。
- 如果是独立生成，必须提供跨时空/硬切/梦境等 exception reason。
- `valid_for_i2v_pair=false` 时不能进入正式 `video.i2v`。

## 7. 工作流状态机

项目级状态：

```text
draft_intake
story_structured
production_bible_ready
visual_memory_planned
visual_memory_ready
spatial_memory_ready
shot_spec_ready
shot_layout_ready
prompt_plan_ready
keyframe_queue_ready
keyframe_generating
keyframe_qa_pending
keyframe_pair_ready
video_queue_ready
video_generating
video_qa_pending
preview_ready
export_ready
blocked
```

每个状态必须定义：

- 进入条件
- 可执行动作
- 阻断条件
- 可回退状态
- 对用户显示的自然语言说明

示例阻断：

- Production Bible 缺失。
- 角色参考未锁定。
- 场景参考是 candidate。
- end frame 不是从 start frame 派生。
- prompt stale。
- provider 不支持当前模式。
- QA gate 为 FAIL。
- 视频 Provider 处于 parked。

### 7.1 Preflight Gate

Preflight Gate 是状态机和任务队列之间的硬门禁。

执行顺序：

```text
User intent
-> intent routing
-> task envelope draft
-> preflight gate
-> queue ready_to_submit
```

如果 Preflight 阻断，系统应该返回普通用户能理解的话：

- `这个角色还没有锁定主参考，先确认人物形象。`
- `这个场景只是候选，还不能用于正式关键帧。`
- `尾帧不是从首帧派生，不能进入视频。`
- `当前视频模型处于暂停接入状态，只能先准备任务。`

Preflight 结果必须写入项目，不允许只显示一次 toast 后丢失。

### 7.2 Provider Policy Hard Gate

Provider 策略是硬门禁，不是 UI 提示。

必须阻断：

- 未注册 slot。
- active slot 使用 unknown provider。
- provider 不在 allowlist。
- provider 在 forbidden list。
- parked / planned / unavailable provider 出现 submitted / querying / success。
- image-to-image fallback 到 text-to-image。
- video.i2v fallback 到 text-to-video。

当前策略：

- Image2 是图片链路唯一正式 provider。
- Jimeng/Seedance 只允许生成 task envelope 和 queue placeholder。
- 用户未在 Settings 显式启用前，不能提交真实视频任务。
- local postprocess 只能做尺寸、格式、轻量裁切、预览，不做语义修复。

## 8. Harness Engineering

Harness 是后台工程脚手架，不是用户可见功能。

必须实现：

### 8.1 Task Harness

- 把用户意图变成 typed job。
- 每个 job 有 id、输入、输出、依赖、状态、重试策略。
- 写入 `generation_manifest.jsonl` 和 `task_events.jsonl`。

### 8.2 Context Harness

使用 L0-L3 上下文预算：

- L0：当前镜头 + 绑定资产摘要 + 用户意图。
- L1：增加前后 1 镜、story function、must/avoid。
- L2：增加前后 2-3 镜、失败原因、关键锚点、参考图路径。
- L3：整幕审计、contact sheet、空间/动作顺序表。

Context Harness 的产物不是一段自由文本，而是标准化 `Subagent Task Envelope`。主 Agent 不允许在正式任务中临时口头转述上下文。

### 8.3 Knowledge Router / Skill Injection Harness

不全量注入所有知识库。前期收集的风格、分镜、运镜、构图、脚本、prompt、provider、QA 和 audio 资料，必须作为可索引、可版本化、可按任务注入的 Knowledge Packs，而不是常驻塞进 Agent 上下文。

Knowledge Library 必须迁入 Vibe Core，而不是长期依赖外部资料文件夹。推荐路径是 `resources/knowledge/`；未来如果需要拆成独立包，可以迁到 `packages/knowledge/`。项目必须维护 `knowledge_pack_manifest.json`，记录每个 pack 的 id、version、hash、路径、适用任务、依赖和更新时间。旧 `/Users/lichenhao/Desktop/Vibe Director/knowledge` 资料只能作为导入源，导入后要锁定版本/hash。

Knowledge Pack 是 Vibe Core 的正式扩展机制。用户后续应该能够在前端添加风格包、运镜包、分镜包、构图包、prompt 包、QA 包或项目专用规则包；系统通过 manifest、hash、router 和 context budget 控制它们进入 Agent / subagent / Prompt Compiler / QA Gate 的方式。

P0 工程对象：

- `schemas/knowledge_pack.schema.json`
- `schemas/knowledge_pack_manifest.schema.json`
- `schemas/knowledge_route_result.schema.json`
- `schemas/context_budget.schema.json`
- `src/core/knowledgeTypes.ts`
- `src/core/knowledgeLibrary.ts`
- `src/core/knowledgeRouter.ts`
- `src/core/contextBudgeter.ts`
- `src/core/knowledgeManifest.ts`

Knowledge Pack 类型：

- `system_builtin`：系统内置包，随 Vibe Core 发布，默认可信，但仍然必须有 version/hash。
- `user_custom`：用户个人知识包，跨项目可用，例如个人风格偏好、常用运镜、prompt 写法。
- `project_local`：项目专用知识包，只在当前项目生效，例如世界观、视觉规则、角色表演规则。
- `external_imported`：外部导入包，默认需要验证、冲突检查和用户确认后才能启用。

Knowledge Pack 影响范围：

- 可以影响创作建议。
- 可以影响 Prompt Compiler 的素材选择、风格表达、镜头语言和 provider prompt 编译。
- 可以影响 QA Gate 的检查项、风格对照和失败解释。
- 可以给 subagent 提供领域知识和验收清单。
- 不能覆盖 provider policy。
- 不能覆盖 Preflight Gate。
- 不能覆盖 Reference Authority。
- 不能覆盖 Keyframe Pair Derivation。
- 不能覆盖 QA Gate 的硬阻断。
- 不能把 rejected / temp / failed reference 提升成正式参考。
- 不能把 parked / planned / unavailable provider 提升成可真实提交 provider。

第一批 Knowledge Packs：

- `script/storyflow`
- `story function / 分镜`
- `style`
- `composition`
- `camera`
- `lighting / color`
- `prompt`
- `provider`
- `QA`
- `audio`

Knowledge Router 输入：

- 用户自然语言意图。
- 当前 Story Flow / Shot Spec / Shot Layout。
- 当前 provider slot。
- 当前风险等级和 QA blockers。
- 当前任务目的：script、asset、keyframe、edit、i2v、audio、QA、export。

Knowledge Router 输出：

```yaml
knowledge_route_result:
  route_id: kr_shot_A1_03_style_camera_v001
  task_id: keyframe_A1_03_start
  injected_knowledge_packs:
    - pack_id: style/core-style-packs.md
      version_hash: sha256:...
      reason: style_intent
      consumer: prompt_compiler
    - pack_id: camera/core-camera-movement.md
      version_hash: sha256:...
      reason: camera_motion
      consumer: subagent_qa
  warnings: []
```

接入规则：

- Project Source Index 记录当前 knowledge library 根目录、pack id、version/hash 和项目绑定版本。
- TaskEnvelope / SubagentTaskEnvelope 记录 `injectedKnowledgePacks` 或等价字段。
- Prompt Compiler 只能使用被 Router 注入的相关包来编译 prompt。
- QA Gate 使用同一批或兼容版本的包反向检查结果。
- 如果生成和 QA 使用的 pack hash 不一致，必须标记 `qa_pack_version_mismatch`。
- UI 默认不展示知识包细节，只在 Inspector / Diagnostics 显示注入摘要。

Knowledge Pack Manager 是前端后续能力：

- 导入知识包。
- 新建知识包。
- 启用 / 禁用知识包。
- 查看 pack version、hash、依赖、适用任务、适用 provider、适用项目范围。
- 测试路由，查看一句自然语言修改会命中哪些 pack。
- 查看任务使用历史，追踪某个任务使用了哪些 pack、哪些版本、哪些注入片段。
- 冲突检测，例如两个 style pack 对纹理、色彩、画幅、镜头运动提出冲突要求。
- 外部导入包验证，通过后才能从 `external_imported` 进入可用状态。

轻量化规则：

- 每个 pack 必须声明 `maxInjectionTokens`。
- 维护 pack summary cache，长包默认注入摘要、命中条目和少量必要示例。
- 维护 route cache，同一项目版本、同一任务意图和同一输入 hash 不重复路由。
- QA Gate 优先通过 pack hash/version 反查知识包，不重新把整包塞进 Agent。
- route result 必须记录实际注入片段、摘要 hash、截断原因和未注入原因。

### 8.4 Generation Harness

所有生成都走：

```text
Shot Spec
-> Visual Memory
-> Spatial Memory
-> Shot Layout
-> Style Capsule
-> Shot Prompt Plan
-> Provider Capability Check
-> Provider Request
-> Candidate Output
-> QA Gate
```

### 8.5 Filesystem Watcher Harness

监听：

- Codex generated images 临时目录。
- 项目 outputs。
- reports。
- videos。
- audio。

临时图可以立即显示，但不能变成正式参考。

Watcher 不只是“看到文件出现”。它必须和 Generation Health Checker、Manifest Matcher、Checkpoint Resume 连在一起，输出结构化事件：`temp_output_detected`、`expected_output_detected`、`qa_report_detected`、`manifest_mismatch_detected`、`stall_timeout_reached`、`worker_exit_without_expected_output`、`formal_output_promoted`。worker 自报成功不等于任务成功；只有 expected output、manifest match、QA coverage 都满足，素材才能进入 formal。

### 8.6 Checkpoint Resume Harness

每个 batch 可恢复。

重启时：

- 读取 manifest。
- 检查已存在文件 hash。
- 跳过已完成项。
- 接管已生成但未整理的临时文件。

### 8.7 QA Harness

先判整体，再判细节：

- 同片感
- identity
- scene
- pair
- story
- prop
- style
- motion
- audio

### 8.8 Tool Runtime Harness

启动时检测：

- Codex CLI
- Node
- Rust runtime / app version
- FFmpeg / FFprobe
- ImageMagick 或系统图像工具
- Python 可选
- provider CLI 可选

Mac/Windows 的工具路径必须抽象成 runtime config，不能写死 shell 环境。

### 8.9 Generation Health Checker

生成后不能只看 provider 返回。

Health Checker 检查：

- 进程是否仍在运行。
- stdout/stderr 是否有新日志。
- temp output 是否出现。
- expected output 是否出现。
- 文件是否可读。
- 尺寸、格式、hash 是否符合 manifest。
- QA report 是否覆盖该输出。
- worker 退出码是否与产物状态一致。

如果 worker 后处理失败但临时图已生成，状态应为 `postprocess_recoverable`，而不是简单失败。

Phase 8.9 core 实现：

- `generationHealthChecker` 是 runtime-state 顶层 diagnostics harness，不接真实 provider、不生图、不修改文件。
- 输入只来自 `imageTaskPlans`、`generationHealthReports`、`manifestMatches`、`watcherEvents`、`taskRuns`、`jobs`、`fileSnapshot`。
- 输出逐任务事实链：expected output、manifest/hash/dimensions/readability、QA coverage、worker exit/artifact consistency、temp recovery。
- 状态包括 `verified_success`、`qa_missing`、`waiting`、`postprocess_recoverable`、`worker_exit_without_expected_output`、`artifact_state_mismatch`、`blocked`。
- schema 为 `schemas/generation_health_checker.schema.json`，已纳入 `project_runtime_state.schema.json` 和 schema registry；测试命令为 `npm run generation-health:test`。

### 8.10 Prompt Conflict Checker

生成前必须检查 prompt 与当前结构化事实是否冲突。

典型冲突：

- Story Flow 已经改了，但 prompt 仍引用旧镜头功能。
- 第五幕门应该是 garage door，但 prompt 还写 front door。
- Shot Layout 要求固定机位，但 video prompt 写大幅推拉。
- end frame 需要从 start 派生，但 prompt 被编译成独立生图。
- Visual Memory 里角色服装已锁定，但 prompt 写了另一套衣服。

冲突不能靠 Agent 口头承诺解决，必须更新 Shot Spec / Shot Layout / Shot Prompt Plan 后重新编译。

Phase 8.10 core 实现：

- `promptConflictChecker` 是 runtime-state 顶层 diagnostics harness，不提交 provider、不把自由文本 prompt 直接送生成。
- 输入只来自 `promptPlans`、`promptConflictReports`、`storyFlow.shots`、`visualMemory.assets`、`jobs`。
- 检查 Story Flow 旧功能、garage/front door、fixed camera vs 大幅运动、independent end frame、Visual Memory locked outfit/scene/style 冲突。
- 每条冲突输出 `structuredFact`、`promptEvidence`、`sourceRefs` 和 `requiredResolution`；冲突必须更新 Shot Spec / Shot Layout / Shot Prompt Plan 并重新编译，agent promise 不能解除。
- schema 为 `schemas/prompt_conflict_checker.schema.json`，已纳入 `project_runtime_state.schema.json` 和 schema registry；测试命令为 `npm run prompt-conflict:test`。

### Phase 9.1 Project File Core

`project.vibe` 是计划中的 file-first 项目入口，而不是 Phase 9.1 会真实写入的文件。当前实现只把它作为 `ProjectRuntimeState.projectFileCore` 的规划事实暴露，帮助 runtime-state 从唯一事实源逐步退为 derived cache。

Phase 9.1 core 实现：

- `projectFileCore.plannedFileTree` 规划 `project.vibe`、project manifest、Production Bible、Story Flow、Visual Memory、Shots、Manifests、Reports、Preview、Exports、Knowledge、Settings 等路径，所有 portable contract 路径都是 project-root-relative。
- `sourceOfTruthPriority` 把 project manifest / production bible / story flow / visual memory / shots 等项目事实放在 runtime-state 之前；runtime-state 固定为 `derived_cache`，不能覆盖 file-first facts。
- `derivedCachePolicy` 用 `sourceIndexHash`、project version、generatedAt 标识可重建缓存，明确 runtime-state 不是 sole source of truth。
- `pathPolicy` 只允许 `project_root_relative` 和 `user_selected_import`；macOS/Windows 绝对路径只能作为用户选择导入证据，不能成为跨平台合同。
- Hard locks 固定 no provider submit、no file mutation、no user file move、no arbitrary shell、no credential read/write、no image/video generation、`projectVibeWriteAllowed=false`。
- schema 为 `schemas/project_file_core.schema.json`，已纳入 `project_runtime_state.schema.json` 和 schema registry；测试命令为 `npm run project-file:test`。

## 9. Agent 架构

### 9.1 Agent Adapter

默认：

- `codex_cli`

未来：

- Codex SDK
- Claude Code
- 自研 Agent
- 其他 CLI

接口：

```ts
interface AgentAdapter {
  runTask(task: AgentTask): Promise<AgentTaskResult>
  spawnWorker(task: WorkerTask): Promise<WorkerHandle>
  resumeTask(taskId: string): Promise<AgentTaskResult>
  cancelTask(taskId: string): Promise<void>
}
```

### 9.2 主 Agent

主 Agent 保存：

- 项目结构化状态
- shot / scene / section 摘要
- 资产路径
- prompt hash
- QA 结论
- 失败原因

主 Agent 不保存：

- 大量图片 payload
- 视频 payload
- 失败图作为正向参考
- 未经筛选的完整历史聊天

Phase 9.2 schema scope:

- Production Bible、Story Flow、Shot Spec、Shot Layout、Visual Memory、Spatial Memory、Voice Memory、Scene Asset Pack 先作为 file-first schema 合同落地。
- 本 scope 只定义 schema、文档和本地合同测试；不接真实 provider、不提交生成、不读取 provider auth material。
- 主 Agent 后续读取这些事实文件时，必须尊重 Visual Memory 的 ReferenceAuthority、Story Flow 的 adaptive sections、Shot Layout 的 start/end derivation、Scene Asset Pack 的 master inheritance。
- OpenCV/local postprocess 只能做文件级后处理和检测，不能替代身份、服装、场景、视角、风格语义修复。
- 当前 schema 尚未注册到 runtime schema registry；主集成需要在 ProjectRuntimeState / ProjectSourceIndex / schemaRegistry 接线时统一处理。

### 9.3 Subagent / Worker

subagent 负责：

- 生图
- 视频生成
- 看图
- 看视频
- QA
- 输出结构化报告

subagent 不是普通聊天对象，而是拿标准 `Subagent Task Envelope` 工作。

正式 subagent 任务的输入必须由系统生成，不允许主 Agent 临时自由发挥。输入必须包含：

- 任务目的
- context level：L0-L3
- 当前 shot 的 story function
- 前后镜头摘要，必要时前后 2-3 个
- locked references：人物、场景、道具、风格，带 reference role
- forbidden references：rejected、failed、temp、negative case
- Shot Layout：机位、主体位置、世界坐标、空间锚点、动作方向
- provider policy
- must preserve
- allowed delta
- must not add
- QA checklist
- expected output contract

输出必须包含：

- P0/P1/P2 问题
- gate 结果
- 文件路径
- 是否可作为正式资产
- 是否需要重生/编辑/回到 Story Flow

执行顺序：

```text
User intent
-> Source Index
-> Context Budgeter
-> Task Envelope
-> Subagent Task Envelope
-> Schema validation
-> Subagent / Worker
-> Structured Subagent Result
-> QA Gate / Project Store
```

关键规则：

- subagent 不能重新定义故事事实。
- subagent 不能把 forbidden reference 当正向参考。
- subagent 不能绕过 provider policy。
- subagent 不能只做单帧判断；至少要输出是否放回故事线成立。
- 主 Agent 只接收结构化结果和文件路径摘要，不接收大量图片 payload。

Phase 9.3 runner skeleton：

- `subagentRunner` 是 `ProjectRuntimeState` 顶层 dry-run diagnostics 状态，不是真 worker 调度器。
- 它只从 `videoExecutionPreview`、`generationHarness`、`qaHarness` 归纳未来 worker slots、coverage、blocked reasons 和 packet requirements。
- hard locks 固定 `noFreeTextTask=true`、`validatedEnvelopeRequired=true`、`noSpawnAgent=true`、`noShellExecution=true`、`noProviderExecution=true`、`noCredentialRead=true`、`noFileMutation=true`、`providerSubmissionForbidden=true`、`liveSubmitAllowed=false`。
- 未来生产 worker 必须从 validated `SubagentTaskEnvelope` 启动；自由文本 prompt 不能启动 worker，没有 envelope 的任务只能标记 `planned_missing_envelope` 或 `blocked_missing_envelope`。
- coverage 区分 image、asset、pair QA、scene QA、story audit、video execution、audio、export。Phase 9.3 只识别 video packet preview 中已有的标准 envelope，其余 coverage 保持 planned/missing。
- schema 为 `schemas/subagent_runner.schema.json`，已纳入 `project_runtime_state.schema.json` 和 schema registry；测试命令为 `npm run subagent-runner:test`。

### 9.3.1 Subagent Task Envelope Schema

最小结构：

```yaml
subagent_task_envelope:
  id: visual_audit_A1_03_v001
  parent_task_id: keyframe_A1_03_start
  purpose: visual_audit
  context_level: L2
  source_index_hash: project_source_hash
  section_id: A1
  shot_id: A1_03
  story_function: 主角第一次意识到异常
  user_intent: 这张要更压抑，但人物不能换
  neighbor_shots:
    - shot_id: A1_02
      position: previous
      story_function: 她进入餐厅
      summary: 低机位跟拍，餐厅入口在左后方
      continuity_notes:
        - 下一镜仍应保持同一餐厅空间
  locked_references:
    - id: character_linan_main_v001
      reference_role: identity_authority
      polarity: positive
      locked_status: locked
  forbidden_references:
    - id: failed_A1_03_overtextured
      reference_role: rejected_case
      polarity: negative
  shot_layout:
    camera: medium wide, locked or very slow push
    subject_position: left midground
    anchors:
      - window background right
      - table between character and window
  provider_policy_summary:
    - image tasks are Image2 only
    - no fallback to text-to-image for image edit
  must_preserve:
    - same character identity
    - same scene layout
  allowed_delta:
    - expression becomes more tense
  must_not_add:
    - new person
    - new phone
    - readable text
  qa_checklist:
    - identity_gate
    - scene_gate
    - pair_gate
    - story_gate
    - prop_gate
    - style_gate
  expected_output_contract:
    format: subagent_result_v1
```

### 9.4 Subagent Result Schema

subagent 返回必须结构化。

最小结构：

```yaml
subagent_result:
  task_id: visual_audit_A1_03
  status: pass | fail | partial
  inspected_files: []
  gates:
    identity_gate: PASS
    scene_gate: PASS
    pair_gate: FAIL
    story_gate: PASS
    prop_gate: PASS
    style_gate: PARTIAL
  issues:
    - severity: P0
      code: end_frame_not_derived
      target: A1_03_end
      recommendation: regenerate end frame from start frame
  approved_for:
    - draft_preview
  rejected_for:
    - future_reference
    - video_i2v
  summary_for_main_agent: ""
```

主 Agent 只接收这个结构化结果和路径摘要，不接收大量图片 payload。

## 10. Provider 架构

### 10.1 Provider Registry

统一 slot：

- `image.generate`
- `image.edit`
- `image.reference_asset`
- `video.i2v`
- `video.t2v.experimental`
- `video.extend`
- `video.edit`
- `audio.tts`
- `audio.music`
- `local.postprocess`
- `local.workflow`

UI 不直接显示复杂 provider 参数。

### 10.2 Generation Adapter

接口：

```ts
interface GenerationAdapter {
  providerId: string
  slot: GenerationSlot
  capabilities: ProviderCapability
  validate(task: GenerationTask): ValidationResult
  compile(task: GenerationTask): ProviderRequest
  run(request: ProviderRequest): Promise<GenerationResult>
  parseResult(raw: unknown): GenerationResult
}
```

### 10.3 当前 Provider Policy

当前开发阶段：

- `image.generate`：Image2 only，active。
- `image.edit`：Image2 only，active。
- `image.reference_asset`：Image2 only，active。
- `video.i2v`：Jimeng / Seedance adapter parked，只预留队列和任务信封，不提交真实任务。
- `audio.tts`：预留。
- `audio.music`：预留。
- `local.postprocess`：只做尺寸、格式、轻量裁切、拼接、预览，不做语义修复。

禁止：

- image-to-image 静默 fallback 成 text-to-image。
- text-to-video 成为主路径。
- local OpenCV 修人物身份、服装、场景视角、故事动作。
- 视频模型生成 BGM 污染后续音频层。

### 10.4 Provider Capability Matrix

每个 provider 必须声明：

- 输入类型
- 输出类型
- 是否支持参考图
- 是否支持 start/end frame
- 是否支持 mask
- 是否支持 bbox / pose / depth / control
- 分辨率、比例、时长限制
- 队列和并发限制
- 失败返回
- 成本和限额
- 已知失败模式

Shot Layout 不能直接等于 prompt；必须经过 adapter 编译。

### 10.5 Provider Enablement Policy

Provider 有三层状态：

- `available`：系统检测到 adapter 或 CLI。
- `enabled`：用户在 Settings 中允许使用。
- `active`：当前 slot 正式使用。

当前规则：

- Image2 是图片主路径。
- Jimeng/Seedance 默认为 `available/parked`，不自动提交。
- 用户显式启用后，才允许 video queue 提交任务。
- Fast / VIP / experimental provider 不作为默认正式路径。

UI 可以显示“已预留”或“未启用”，但不能悄悄提交真实任务。

## 11. 生成主链路

### 11.1 从想法到故事

```text
User idea
-> director-intent-router
-> story-shot-director
-> Production Bible
-> Story Flow
-> Shot Spec
```

Story Agent 同时承担剧情理顺和制片拆解，不额外新增常驻剧情拆解 Agent。

### 11.2 资产准备

```text
Shot Spec
-> reference-asset-director
-> Visual Memory Plan
-> Image2 asset tasks
-> asset QA
-> locked / candidate / rejected
```

v0.3 不强制自动三视图和全自动多视角，但数据结构必须预留。

### 11.3 关键帧生成

```text
Shot Layout
-> Shot Prompt Plan
-> Image2 start frame
-> Image2 end frame edit from start
-> Keyframe Pair QA
-> approved keyframe pair
```

### 11.4 视频生成

当前阶段：parked。

未来启用后：

```text
approved keyframe pair
-> provider-ready derivative
-> Motion Spec
-> Seedance / future I2V adapter
-> candidate clip
-> video QA
-> preview timeline
```

视频任务默认：

- no BGM。
- start/end 尺寸统一。
- 首尾稳定约束。
- 队列并发 1 或按 provider 实测能力。
- 完成后自动继续下一条。

### 11.5 音频生成

```text
Voice Memory
-> narration / dialogue plan
-> TTS adapter
-> music brief
-> music provider or imported audio
-> ambience plan
-> preview mix
```

v0.3 音频只做轻量：

- TTS 旁白/对白。
- BGM 生成或导入。
- 环境音规划。
- 基础音量和淡入淡出。
- 不做专业混音。

## 12. UI 架构

### 12.1 主界面

布局：

```text
Top Bar: project / version / export / settings
Tabs: Visual Memory / story sections
Main: shot cards
Right: Director Input
Bottom: Preview Timeline
```

设计原则：

- 简单。
- 图片完整显示，不做过窄裁切。
- 不展示复杂 prompt。
- 不展示模型参数。
- 状态用普通话解释。

### 12.2 Visual Memory UI

只显示正式资产：

- Character
- Scene
- Prop
- Style
- Voice

不把所有生成图塞进资产库。

### 12.3 Story Flow UI

支持：

- 自适应段落。
- Shot 选择。
- 多选。
- 插入/删除/移动。
- stale 标记。
- story function 可见但简洁。

### 12.4 Director Input

不是普通聊天框，也不是复杂 prompt 面板。

显示：

- 当前选择范围。
- 当前系统理解。
- 简短状态。
- 自然语言输入。

用户可以说：

- “这几张更压抑一点。”
- “把这个角色离镜头远一点。”
- “这一段节奏太慢，帮我重新安排。”
- “旁白换成设置里的温柔女声。”

系统判断影响范围：

- 当前 shot
- 多选 shots
- 当前段落
- 全片风格
- Visual Memory
- Voice Memory
- Story reflow

### 12.5 Preview

Preview 是 rough preview，不是剪辑器。

功能：

- 图片按时长播放。
- 视频按片段播放。
- 音频占位或实际播放。
- 当前播放位置高亮 shot。
- 支持边看边自然语言修改。

不做：

- 多轨复杂剪辑。
- 专业调色。
- 复杂转场。

### 12.6 Settings

需要：

- Provider Registry。
- Codex CLI 路径。
- Image2 调用方式。
- Seedance / Jimeng adapter 设置，默认 parked。
- TTS providers。
- Music providers。
- Voice Sources。
- Knowledge Pack Manager：
  - 导入 / 新建 Knowledge Pack。
  - 启用 / 禁用 `user_custom`、`project_local`、`external_imported`。
  - 查看 version、hash、依赖、适用任务和最近任务使用历史。
  - 测试路由和冲突检测。
  - 提示用户：Knowledge Pack 不能覆盖 provider policy、preflight、reference authority、keyframe pair derivation 和 QA gate。
- Project storage path。
- FFmpeg path。
- Concurrency。
- API keys。

API key 存储必须走系统 keychain / credential vault，不明文写入项目。

### 12.7 Preview Event Model

Preview 使用 timeline event，而不是剪辑软件式多轨工程。

事件类型：

- `image_hold`
- `video_clip`
- `narration_audio`
- `dialogue_audio`
- `ambience_audio`
- `music_audio`
- `gap`
- `blocked_placeholder`

每个事件记录：

- shot id
- start time
- duration
- media path
- QA status
- source task id
- display state

规则：

- 没有通过 QA gate 的正式素材不能进入正式 preview，只能作为 draft preview。
- 图片按 shot duration hold。
- 视频按真实 duration 播放。
- 音频可以先用 placeholder。
- 播放位置必须能反向高亮对应 shot。
- 用户看 preview 时的自然语言修改，要带上当前 playback time 和 selected shot。

### 12.8 UI Mode

主界面分三种信息层级：

- `director`：默认模式，只显示 Story Flow、Visual Memory 摘要、Director Input、Preview、Export。
- `inspector`：显示 shot details、task envelope、QA gate、provider status。
- `diagnostics`：显示 task events、worker logs、manifest matcher、runtime tools。

原则：

- 普通用户默认只在 director mode。
- Prompt、Provider、QA、日志不压到用户脸上。
- 当任务被 blocker 卡住时，用自然语言解释，再提供“查看诊断”。

## 13. 实时进度和文件监听

前端必须显示 Codex 在干活。

状态：

- 等待生成
- 提交中
- 连接恢复中
- 生成中
- 临时图已出现
- 正在整理命名
- 等待复验
- 已锁定
- 需要重生
- 已跳过
- provider parked

Watcher 事件：

- 临时图片出现
- expected output 出现
- provider-ready derivative 出现
- QA report 更新
- video clip 出现
- audio clip 出现

规则：

- 临时图可展示。
- 临时图不可作为后续 reference。
- 只有 manifest 匹配、路径标准化、QA 通过，才能进入 formal。

## 14. QA 和失败分流

### 14.1 Gate

统一 gate：

- `identity_gate`
- `scene_gate`
- `pair_gate`
- `story_gate`
- `prop_gate`
- `style_gate`
- `motion_gate`
- `audio_gate`

### 14.2 P0/P1/P2

- P0：必须修，否则不能进入下一阶段。
- P1：建议修，影响质量或连续性。
- P2：可接受瑕疵或后期处理项。

### 14.3 失败分流

| 问题 | 分流 |
|---|---|
| 人物身份漂移 | Image2 编辑或重生 |
| 服装错 | Image2 编辑或重生 |
| 场景视角错 | 回 Spatial Memory / Shot Layout |
| 故事动作错 | 回 Shot Spec |
| end frame 漂移 | 重新从 start frame 派生 |
| 纹理略重 | 可轻量后处理，但不得语义修复 |
| 视频首尾抽动 | 检查 provider-ready 尺寸、缩小 end delta、重生 end 或拆 middle frame |
| 视频有 BGM | 标 P1/P0，后续音频层重新处理 |

## 15. 导出架构

导出不是最终剪辑交付，而是把上游成果整理给用户。

支持：

- rough cut mp4。
- 分镜表。
- keyframes。
- video clips。
- audio files。
- manifest。
- provider prompts。
- QA reports。

未来可导出：

- Premiere / DaVinci / CapCut 友好素材包。
- EDL / FCPXML / XML。
- Markdown storyboard。
- CSV/TSV shot list。

### 15.1 Export Profiles

导出 profile：

- `rough_cut`：一个完整 mp4，用于快速观看。
- `asset_package`：keyframes、clips、audio、manifest、QA。
- `storyboard_package`：分镜表、缩略图、镜头说明。
- `editor_handoff`：给剪映 / Premiere / DaVinci 的目录结构。
- `developer_archive`：完整 manifest、prompts、reports、task events。

每个 profile 必须声明：

- 包含哪些素材。
- 是否包含 prompt。
- 是否包含 QA report。
- 是否包含 rejected / draft 素材。
- 输出目录。
- 文件命名规则。

默认不导出 rejected / temp 文件，除非用户选择诊断或开发归档。

## 16. 跨平台实现

### 16.1 路径

禁止硬编码：

- `/Users/...`
- `C:\...`
- shell-specific path。

内部全部用 project root + relative path。

### 16.2 文件名

默认 ASCII-safe 文件名。

显示名可以中文，真实文件名用 slug：

```text
shot_A1_003_start.png
character_sora_main_ref_v001.png
scene_house_dining_master_v001.png
```

### 16.3 Sidecar

需要按平台打包或检测：

- Codex CLI
- FFmpeg / FFprobe
- optional ImageMagick
- optional provider CLI

优先策略：

- 开发期检测系统安装。
- 发布期提供引导安装或随 app 打包允许分发的二进制。
- 所有工具路径写入 runtime config。

### 16.4 macOS

需要考虑：

- Xcode Command Line Tools。
- 代码签名。
- notarization。
- 沙盒权限。
- 文件夹访问授权。
- Keychain。

### 16.5 Windows

需要考虑：

- WebView2。
- Microsoft C++ Build Tools 只对开发/构建需要。
- PowerShell / cmd / Git Bash 差异。
- Windows Credential Manager。
- 长路径和特殊字符。
- 防火墙和杀软对 CLI / 子进程的影响。

### 16.6 打包与发布

发布目标：

- macOS：`.dmg` / `.app`
- Windows：`.msi` 或 `.exe installer`

需要提前设计：

- app version 和 project schema version 分开。
- 启动时检查 project schema 是否需要 migration。
- 每次 migration 前自动备份 project metadata。
- sidecar / runtime tool 版本写入 diagnostics。
- 崩溃日志和任务日志保存到用户可打开的位置。
- 自动更新可以预留，但不要在早期阻塞主流程。

### 16.7 诊断包

因为 Vibe Core 会调 Codex、provider CLI、本地工具和长任务队列，必须有一键诊断包。

诊断包包含：

- app version
- OS version
- provider registry
- tool runtime check
- 最近 task events
- 最近 worker logs
- 最近 QA blockers
- project schema version
- 不包含 API key
- 不默认包含用户图片/视频，除非用户手动勾选

这会显著降低后续跨 Mac/Win 调试成本。

### 16.8 Tauri Capability / Sidecar Permission Plan

Tauri 权限必须白名单化。

前端不能随意执行 shell。所有敏感操作都通过 Tauri command：

- `open_project`
- `save_project_file`
- `watch_project_folder`
- `run_agent_task`
- `run_provider_task`
- `cancel_task`
- `open_in_finder_or_explorer`
- `read_diagnostics`

Sidecar 规则：

- Codex CLI、FFmpeg、provider CLI 都作为受控 sidecar 或受控外部命令。
- 参数必须由 task envelope 编译，不允许用户输入直接拼接成 shell 命令。
- 只允许访问 project root、用户选择的 import 文件、配置目录和临时目录。
- Windows/macOS 分别维护 runtime path resolver。
- 每次 sidecar 调用写入 task events。

早期实现建议：

```text
Tauri/Rust: window, permissions, file dialog, sidecar start/stop, filesystem watch
TypeScript/Node core: schema, queue, prompt compiler, provider registry, manifest matcher
```

等核心业务稳定后，再决定哪些模块下沉到 Rust。

## 17. 安全和隐私

原则：

- 项目默认本地保存。
- API keys 不写项目文件。
- generated outputs 不自动上传。
- 用户明确选择 provider 时才发送对应素材。
- task envelope 里记录发送给 provider 的 reference 列表。
- 可以导出完整审计日志。

权限：

- 只访问用户选择的 project root。
- 读取外部图片/视频时复制到项目 imports。
- 不全盘扫描用户文件。

## 18. 测试策略

### 18.1 单元测试

- schema validation
- state machine
- provider policy
- task envelope builder
- prompt compiler
- path resolver
- asset binder

### 18.2 集成测试

- 导入 runtime test。
- 生成 task envelopes。
- watcher 捕获文件。
- checkpoint resume。
- provider parked 时不提交。
- Image2 only policy 阻断。

### 18.3 E2E 测试

用固定项目：

- 2 个段落。
- 2-3 个角色。
- 2-3 个复杂场景。
- 10 个 shots。
- 每个 shot 有 start/end。
- 视频 provider 可 mock。

验证：

- 用户一次点击发起批量。
- 前端显示进度。
- 插入新 shot 后 stale 重算。
- QA 失败不进入 reference。
- preview 只使用通过 gate 的素材。

### 18.3.1 Cross-platform E2E

必须专项测试：

- macOS / Windows 路径差异。
- 中文显示名 + ASCII slug 文件名。
- WebView 渲染差异。
- Tauri sidecar 权限。
- FFmpeg path resolver。
- Credential vault。
- 项目从 Mac 拷贝到 Windows 后能打开。
- Windows 长路径和空格路径。
- CLI reconnect / stall 状态在两端都能显示。

### 18.4 视觉生产测试

真实生成测试必须写入：

- method name
- provider version
- prompts
- references
- outputs
- QA
- failure cases
- product conclusion

不能只看“这张好不好看”。

## 19. 开发路线

详细执行顺序以 `docs/core-development-sequence.md` 为准。本节只保留架构级路线。

### Phase 0.5：Development Harness

- 开发任务包模板。
- subagent 写入范围、输入资料、禁止事项、验证命令。
- 主 agent 集成 review checklist。

### Phase 1：Contract Layer

- schema。
- ProjectSourceIndex。
- ReferenceAuthority。
- PreflightGate。
- TaskEnvelope / SubagentTaskEnvelope。
- TaskRun / ManifestMatcher。
- Provider hard gate。

### Phase 2：Project Format + Domain Schemas

- `project.vibe`。
- Production Bible。
- Story Flow。
- Shot Spec / Shot Layout / Shot Prompt Plan。
- Style Capsule。
- Visual / Spatial / Voice Memory。
- Scene Asset Pack / Asset Readiness。
- Phase 9.2 已将 Production Bible、Story Flow、Shot Spec、Shot Layout、Visual Memory、Spatial Memory、Voice Memory、Scene Asset Pack 补成 schema/docs/test-only 合同，集成到 ProjectRuntimeState 和 schema registry 由后续主集成完成。

### Phase 2.2：Watcher / Health Checker / Checkpoint

- filesystem watcher。
- generated image cache watcher。
- generation health checker。
- checkpoint resume。
- task-owned temp folder。
- final promotion pipeline。

### Phase 2.5：Knowledge Library + Router + Context Budgeter

- `resources/knowledge/`。
- `knowledge_pack_manifest.json`。
- Knowledge Pack P0 objects：
  - `schemas/knowledge_pack.schema.json`
  - `schemas/knowledge_pack_manifest.schema.json`
  - `schemas/knowledge_route_result.schema.json`
  - `schemas/context_budget.schema.json`
  - `src/core/knowledgeTypes.ts`
  - `src/core/knowledgeLibrary.ts`
  - `src/core/knowledgeRouter.ts`
  - `src/core/contextBudgeter.ts`
  - `src/core/knowledgeManifest.ts`
- Pack types：`system_builtin`、`user_custom`、`project_local`、`external_imported`。
- Knowledge Router。
- Context Budgeter L0-L3。
- Summary cache、route cache、`maxInjectionTokens` 和命中条目注入。
- Knowledge Pack Manager 进入前端规划。
- prompt conflict checker。

### Phase 3：UI Connects Real Core State

- Director mode。
- Inspector。
- Diagnostics。
- real SourceIndex / TaskRun / ManifestMatcher / Preflight state。

### Phase 3.5：Story Change Transaction / Reflow

- director intent result。
- story change transaction。
- production bible patch。
- reflow impact report。
- artifact invalidation。

### Phase 3.8：Tauri Runtime Spike + Settings Shell

- Tauri shell。
- Mac/Windows path abstraction。
- sidecar permissions。
- runtime config。
- credential storage。
- provider/tool detection。

### Phase 4：Image2 Adapter + Prompt Compiler + Asset Readiness

- Image2 adapter。
- prompt compiler。
- asset readiness gate。
- start frame。
- end frame edit from start。
- QA packet generator。

### Phase 5：Preview / Export

- draft/formal preview。
- image hold。
- blocked placeholder。
- current shot highlight。
- export profiles。

### Phase 6：Audio Planning

- Audio Plan。
- Voice Memory。
- voice source registry。
- TTS/BGM provider slot。
- preview mix placeholder。

### Phase 7：Video Provider Enablement

- Seedance / Jimeng user enablement。
- no bgm video prompt。
- queue concurrency。
- video QA。
- long queue handling。

### Phase 8：Multi-provider Expansion

- AgentAdapter。
- WorkerAdapter。
- ProviderAdapter。
- future image/video API。
- local workflow。
- adapter contract tests。

## 20. 当前必须避免的架构错误

- 把 UI 做成 prompt 参数工具。
- 把资产库做成所有图片图库。
- 把 Codex CLI 和 Image2/Seedance 混成同一层。
- 让 subagent 每次拿不同格式的上下文。
- 让生成成功等于正式可用。
- 让失败图污染后续 reference。
- 把视频生成设计成用户一条条手点。
- 把文生视频当主路径。
- 用 OpenCV 解决人物身份、服装、场景、故事问题。
- 让项目依赖长聊天上下文，而不是结构化 project index。

## 21. 参考资料

本架构基于当前项目 PRD、方法论和本地研究文档，并参考以下官方资料：

- Tauri 2.0: https://tauri.app/
- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri frontend configuration: https://v2.tauri.app/start/frontend/
- Electron: https://www.electronjs.org/
- Electron introduction: https://www.electronjs.org/docs/latest
