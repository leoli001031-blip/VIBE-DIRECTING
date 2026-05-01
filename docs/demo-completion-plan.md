# Vibe Core Demo Completion Plan

日期：2026-05-02

目标：把当前已经完成的合同层、极简 UI、队列、资产、知识包、provider gate 和小项目 one-shot harness，收束成一个可以演示的基本完整 demo。后续不再继续扩展 Phase，而是按下面 5 轮把“能看、能操作、能真实跑一张图、能回流预览”做闭环。

## 总体边界

- Image2 first。图片真实调用先只做单镜头 / 小批量，不做大批量自动提交。
- Seedance / Jimeng 继续 parked，不进入基本 demo 的真实视频提交。
- 不做复杂剪辑台，不替代 PR / 剪映；只做上游导演台、资产、分镜、预览和导出包。
- 主界面继续保持极简：Story Flow、Asset Library、Preview、右侧自然语言修改。
- Diagnostics 保留工程事实，但默认不压到创作者主界面。
- 所有真实调用必须经过动作时确认；默认不读凭证、不自动提交、不自动重试、不越过 sandbox。
- 主界面进度条读取 creator-facing progress；底层 local orchestrator 的 blocked/parked 技术事实只进入 Diagnostics，不能把演示态污染成“有阻断”。

## 当前完成基线

- 极简导演台 UI 已有静态合同：`npm run minimal-ui:test`。
- Preview player MVP 已有：图片 hold、视频 clip、missing placeholder、时间线。
- Project Store / project.vibe 合同已有，但主要停留在 core/test。
- Asset Library CRUD / Visual Consistency 合同已有，但前端可操作流程还没接完整。
- Subagent packet / runner / worker runtime 已禁止 free text，要求 validated envelope。
- Image2 first one-shot review 链路已跑通：`npm run small-project:test`。
- Real Provider Pilot / Executor / One-shot 目前仍是 review shell，不是真实 provider submit。

## Round 1：Clean Demo Fixture / Runtime-State

目标：打开 demo 时看到一个干净的小项目，而不是历史 runtime import 的 blocked 状态。

### 必做事项

- 抽出 shared small project fixture，避免测试和 demo 使用两套数据。
- 新增可重复生成 clean demo runtime 的脚本。
- demo runtime 至少包含：
  - 1 个项目：`Small Project One Shot`
  - 1 个镜头：`S01`
  - 3 个 locked assets：角色、场景、风格
  - 1 个 Image2 `image.generate` task plan
  - 1 个 Image2 adapter request
  - 1 个 scoped output sandbox
  - explicit QA pass fact
- demo runtime 必须到达：
  - `imageTaskPlan.status = ready_for_dry_run`
  - `executionLedger.status = ready_for_scoped_review`
  - `realExecutionGate.status = ready_for_scoped_real_test_review`
  - `realProviderPilot.status = review_ready`
  - `realProviderExecutor.status = review_ready`
  - `realProviderOneShotTest.status = ready_for_action_time_confirmation`
- 所有硬锁仍必须保持：
  - `actualExecutionAllowed = false`
  - `providerSubmitAllowed = 0`
  - `liveSubmitAllowed = false`
  - `credentialAccessAllowed = false`
  - `canSpawnWorker = false`
  - `noFileMutation = true`
- 提供简单运行入口，例如：
  - `npm run demo:state`
  - `npm run demo:test`
- 可选：支持 `?demo=small` 或等价入口加载 demo runtime，但不能破坏默认 `/runtime-state.json` 行为。
- demo runtime 必须提供干净的创作者进度：主界面显示等待确认/等待复核，不显示底层诊断 blocker。

### 验收

- `npm run small-project:test`
- `npm run demo:test`
- `npm run build`
- 浏览器打开 demo runtime 后，Story Flow / Asset Library / Preview 都显示 clean demo 数据。

## Round 2：Project + Asset UI

目标：让用户能在前端看到和操作“项目事实”和“资产圣经”，而不是只看 runtime cache。

状态：已进入实现。当前前端已经接入 Project Store facts strip、`runtime-state = derived cache，不是事实源` 提示、Asset Library 最小添加/锁定/候选/needs_review/rejected、文本约束编辑、用户可读 blocker，以及 contact sheet/temp/failed/shot output 禁入规则的 UI 合同测试。

### 必做事项

- 前端接入 Project Store / project.vibe 的 create/open/save plan。
- UI 明确标注 runtime-state 是 derived cache，不是事实源。
- Asset Library 页面支持最小 CRUD：
  - 添加角色主参考
  - 添加场景 master
  - 添加风格锚图或风格文本
  - 编辑文本约束
  - 切换 `locked / candidate / needs_review / rejected`
- Asset Library 不显示 contact sheet、临时图、失败图、普通输出图。
- 资产卡必须显示：
  - type
  - reference role / authority
  - locked state
  - safe for future reference
  - linked shots
  - short text constraints
- 增加用户可读 blocker：
  - 缺主角参考
  - 缺场景 master
  - 资产未 locked
  - candidate/temp 不能做正式参考

### 验收

- `npm run asset-library:test`
- `npm run project-store:test`
- `npm run project-store-io:test`
- `npm run minimal-ui:test`
- `npm run build`
- UI 中能从空白/fixture 项目添加并锁定一个角色、一个场景、一个风格资产。

## Round 3：Agent Panel Closed Loop

目标：右侧自然语言面板不再只是 dry-run 文案，而是能进入标准 task packet / queue 流程。

状态：已完成。右侧面板现在支持自然语言生成本地修改计划，阻断上下文停在“需要补充信息”，可执行上下文进入“等待确认”，用户确认后显示“排队中 / 已计划”。真实调用仍未打开，计划只落在待写入项目事实与本地队列状态。

### 必做事项

- 自然语言输入生成 `DirectorWorkflowState`。
- 用户确认后生成正式 task packets。
- 所有正式任务必须走 validated packet：
  - image start frame
  - image end frame
  - asset update
  - scene / identity / style QA
  - story continuity audit
  - preview/export package
- Queue 只接受 packet/envelope，不接受 free text。
- UI 只显示用户可读状态：
  - 准备修改
  - 等待确认
  - 排队中
  - 等待输出
  - 需要复核
  - 已完成
  - 阻断
- Diagnostics 显示 packet、source refs、knowledge packs、expected outputs、QA checklist。
- 修改计划写回 project facts 或 pending transaction，不直接覆盖正式事实。

### 验收

- `npm run director-workflow:test`
- `npm run task-packet:test`
- `npm run subagent-runner:test`
- `npm run subagent-worker:test`
- `npm run subagent-runtime-gate:test`
- `npm run orchestrator:test`
- `npm run build`
- UI 中输入一句自然语言，可以看到 confirmation -> packet -> queue planned 状态。

## Round 4：Image2 One-Shot Real Call

目标：真正跑通一张 Image2 图片，从动作时确认、provider submit、sandbox output、watcher 回流到 UI。

### 必做事项

- 在 Phase 43-45 review shell 之后增加真实 one-shot action layer。
- 真实调用只允许：
  - Image2
  - 单镜头
  - 最多 1-2 张图
  - scoped sandbox
  - 动作时确认
  - 明确预算/额度提示
- 禁止：
  - 自动重试
  - 读取未授权 credential
  - 任意 shell
  - Seedance / Jimeng live submit
  - Fast / VIP
  - text-to-video fallback
  - 输出写到 sandbox 外
- Provider adapter 必须把请求 preview 编译成真实调用 payload。
- 真实输出必须由 watcher / manifest / QA gate 回流。
- provider 自报成功不能直接完成任务。
- 出错必须进入用户可读状态：
  - 调用失败
  - 输出缺失
  - 等待文件
  - 需要复核

### 验收

- `npm run real-provider-pilot:test`
- `npm run real-provider-executor:test`
- `npm run real-provider-one-shot:test`
- 新增真实 one-shot 测试或手动 smoke test。
- `npm run watcher:test`
- `npm run generation-health:test`
- `npm run qa:test`
- `npm run build`
- 手动确认后，生成一张图片，文件出现在 sandbox，UI 自动显示。

## Round 5：Preview / Export Demo Closure

目标：生成结果自动进入 Preview，并能导出一个 demo 包，形成完整演示闭环。

### 必做事项

- Preview 自动读取已存在图片和视频。
- 图片按 shot duration 做 image hold。
- 视频存在时替换对应 image hold。
- 缺失片段显示极简 placeholder。
- Preview 时间线支持：
  - play / pause
  - timecode
  - shot/section marks
  - selected shot sync
- Export 支持最小 demo 包：
  - storyboard table
  - selected keyframes
  - prompt/request previews
  - QA reports
  - project facts snapshot
  - 可选 rough cut proxy plan
- Export 仍然不能乱写文件；必须 project-root whitelist。
- Demo 入口能展示：
  - 资产锁定
  - 选镜头
  - 自然语言修改计划
  - Image2 one-shot 结果
  - Preview 播放
  - Export package plan / 输出

### 验收

- `npm run preview-player:test`
- `npm run export-builder:test`
- `npm run export-worker:test`
- `npm run dry-run-e2e:test`
- `npm run build`
- 浏览器手动验收一条完整 demo path。

## 完整 Demo Definition of Done

- 用户打开 app 后看到的是 clean demo project。
- 主界面不出现大量工程词、provider JSON、schema、manifest、hard lock 长列表。
- Asset Library 能解释和操作一致性资产。
- Story Flow 能选中镜头，图片完整展示。
- 右侧自然语言能生成修改计划并进入确认。
- 至少一张 Image2 真实输出能通过 sandbox 回流。
- Preview 能播放已有图片/视频。
- Export 能生成可交付 demo 包或 plan。
- Seedance / Jimeng 仍 parked，不影响 demo 成立。
- 所有测试通过：
  - `npm run minimal-ui:test`
  - `npm run small-project:test`
  - `npm run demo:test`
  - `npm run director-workflow:test`
  - `npm run task-packet:test`
  - `npm run real-provider-one-shot:test`
  - `npm run preview-player:test`
  - `npm run export-worker:test`
  - `npm run build`

## 当前推荐执行顺序

1. 立即执行 Round 1：demo fixture / runtime-state。
2. Round 1 通过后，把 demo runtime 接入浏览器入口。
3. Round 2 接 Asset Library + Project Store UI。
4. Round 3 接 Agent Panel confirmation -> packet -> queue。
5. Round 4 再打开动作确认后的 Image2 one-shot。
6. Round 5 做 Preview / Export 收口。
