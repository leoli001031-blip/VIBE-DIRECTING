# Vibe Core 复盘与后续门禁

更新时间：2026-05-10

## 当前一句话判断

Vibe Core / Vibe Director Studio 已经从“软件链路可信”走到“真实 provider 边界需要澄清和小批量验证”的阶段；最大风险是把 dry-run、handoff、real return ingest、real provider submit、formal promotion 混成一个“完成”。

## 项目目标 / 定位

Vibe Core 是一个本地优先的 AI 视频导演台。它面向创作者，而不是面向工程调试人员：用户应该看到故事、镜头、素材记忆、自然语言导演输入和预览；复杂的 provider、receipt、gate、runtime、QA、handoff 细节应该收进 Diagnostics。

核心链路是：

```text
project.vibe
-> source_index
-> story_flow
-> visual_memory
-> start/end keyframes
-> provider handoff
-> runtime truth
-> preview queue
```

系统必须用 gate 防止不可追溯的生成结果进入项目事实。尤其是 start/end keyframes、Image2 edit、provider handoff、return ingest 和 preview promotion 之间不能靠“看起来像”或“日志说成功”来晋级。

## 当前进度

### Runtime / API

- 本地 runtime API 已有安全边界：local origin / token gate、路径逃逸防护、媒体响应 MIME / ORB 防护、runtime 文件读取和 project binding。
- `runtime-state.json` 只能作为可重建缓存和 UI 投影，不是主事实源。
- 当前真实事实入口应是 current-project binding 与 project 文件结构，而不是旧聊天上下文或单个 runtime JSON。

### Current Project

- 已从手动路径输入推进到 recent-project / workspace-project 选择。
- `real-test-sandbox/real-demo-e2e` 及其子项目曾作为验证种子范围。
- current-project selection 的价值不只是 UI 方便，而是让后续 runtime、handoff、preview、QA 都绑定到明确项目根。

### Director UI

- 默认界面目标是 minimal director desk：Story Flow、Asset Library / Visual Memory、Agent Panel、Preview，以及一条创作者能理解的项目状态。
- 工程细节、Round/ZP 标签、strict edit receipt、provider gate、queue shell、blocked count 等应进入 Diagnostics。
- `App.tsx` 已经是高风险 god file，后续不应继续把大 UI 或状态逻辑塞进去。

### Image2 / Handoff / Return Ingest

- 已存在 strict preflight、strict return ingest、prompt-only/path-in-prompt blockers、prepared app-server Image2 edit packet、reference attachment receipt contract。
- 现在必须明确区分：
  - dry-run / mock：软件路径或模拟 executor 通过。
  - handoff ready：准备好了可交给外部执行的包。
  - execute-return：外部 provider 结果回流 ingest。
  - provider submit：真正把请求提交到 provider。
  - formal promotion：QA、provenance、preview、project fact 全部合格后晋级。
- `execute-return` 是回流 ingest，不是 provider submit。它能证明“系统能接收结果”，不能证明“系统已经自动提交并完成真实 provider 链路”。

### MotionEndpointContract

- `MotionEndpointContract` 已以 schema-first 方式接入：先建立 motion planning contract，再进入 video planning 和 image keyframe runtime gates。
- start/end frame 与 video motion 之间需要共同使用动作、起止姿态、editable/protected regions、bbox anchors 等约束。
- bbox 只能是辅助锚点，不是动作本身；动作必须有清晰的 start state、end state、运动方向、物理可行性和镜头语义。

### 协作方式

- 后续实现默认由 subagents / workers 执行，主 agent 负责拆分、边界传递、审查、集成和验证。
- subagent 不能凭自由文本上下文做生产任务，必须使用明确 task envelope 或等价任务包。
- subagent 返回结构化摘要和文件路径；主 agent 负责把结果纳入项目事实和验证链。

## 之前出现的错误 / 误判 / 返工点

- software pressure 不等于真实 provider ready。24 次软件路径稳定只能说明软件层可信，不能证明 provider submit / return / promotion 完整。
- 单个 `start.png` 不等于 real chain。它只能证明某次真实输出可发生，不等于绑定了角色、场景、shot metadata、strict edit provenance。
- handoff ready 不等于自动 submit。prepared packet 只是准备结果，不是 provider 已调用。
- 旧认知里曾认为没有 return endpoint；现在已有 `execute-return`，但它是外部 provider 回流 ingest，不是 provider submit。
- ORB 问题的关键不是只有 MIME header，而是缺失媒体曾向 `<img>` 返回 JSON。缺失媒体不能被当作图片内容返回。
- `runtime-state.json` 不是主事实源。它是缓存 / 投影，必须可由 project files 和 current-project binding 重建。
- bbox 不是动作。bbox anchors 只能服务于动作约束和编辑区域，不能替代 motion semantics。
- 视觉相似不等于 strict derivation。start/end 看起来像同一镜头，不代表 end frame 是由 start frame 经过 image edit / image2image 严格派生。
- provider 自述不能直接完成任务。必须有 request id、operation、input hash、attachment receipt、output hash、QA status 等证据。
- 主界面一旦混入太多 engineering diagnostics，就会偏离“导演台”定位，增加误判和操作成本。

## 后续改进路线

### 近期 commit 1：澄清 Image2 真实边界和状态命名

- 把 UI、runtime status、report 字段中的状态拆清楚：`dry_run_passed`、`handoff_ready`、`return_ingested`、`provider_submitted`、`promoted`。
- 所有文案避免把 mock / dry-run / handoff / return ingest 叫成 real provider ready。
- `execute-return` 的命名和说明必须明确：它只接收外部 provider 回流结果。
- provider submit 需要单独入口、单独 receipt、单独 permission gate。

### 近期 commit 2：把 subagent 规则变成门禁

- 生产 worker 任务必须带 task purpose、selected scope、source index hash、project facts、locked references、provider policy、knowledge injection trace、expected outputs、QA checklist、output schema、disallowed actions。
- 禁止 free-text worker bypass。
- 禁止 subagent ad-hoc provider submit。
- 禁止 worker 自行把 temp / candidate / rejected 资产 promotion 成 authority。
- 主 agent 必须进行 diff review、验证命令和结果归档。

### 中期：拆 `local-runtime-api-server.mjs` 和 `App.tsx`

- `scripts/local-runtime-api-server.mjs` 应按 project binding、file serving、strict edit、Image2 handoff、return ingest、preview projection、security gate 拆分。
- `src/App.tsx` 应按 MinimalStoryFlow、VisualMemoryPanel、MinimalAgentPanel、MinimalPreviewView、DiagnosticsMode、ProjectRealChainPanel 等逐步拆出。
- 拆分时只做小提交，避免移动文件同时重写业务逻辑。

### 测试升级：L0-L4

- L0：schema / pure function / contract tests。
- L1：runtime API、project binding、media serving、ORB regression。
- L2：UI -> runtime -> report / preview software closed loop。
- L3：Image2 dry-run / handoff / return ingest / provider-boundary tests。
- L4：小批真实 provider submit + return + QA + preview promotion；每次扩大批量前必须复盘证据链。

## 推荐验证命令

> 本文只是路线沉淀；实际是否运行由当次任务决定。真实 provider 测试必须先确认权限、端口和当前项目绑定。

### Provider 边界

```bash
npm run codex-app-server-image2-edit-adapter:test
npm run real-provider-transport:test
npm run image-reference-delivery-receipt:test
npm run real-provider-one-shot:test
```

检查点：

- prepared packet 是否仍明确不是 submit。
- `execute-return` 是否只做 external return ingest。
- prompt-only/path-in-prompt 是否仍被阻断。
- provider submit 是否有独立 permission gate 和 receipt。

### Subagent 门禁

```bash
npm run task-packet:test
```

检查点：

- task envelope 是否包含 source index、project facts、locked / forbidden references、provider policy、knowledge injection trace、QA checklist。
- worker 是否不能越权 provider submit。
- worker 输出是否为结构化摘要和文件路径，而不是把媒体 payload 塞回主对话。

### Runtime / UI

```bash
npm run local-runtime-api:test
npm run current-project-selection-binding:test
npm run current-project-ui-closed-loop:test
npm run current-project-preview-ui-runtime-closed-loop:test
npm run minimal-ui:test
npm run build
```

检查点：

- current-project binding 是事实入口。
- 缺失媒体不会向 `<img>` 返回 JSON。
- 默认 Director UI 不泄露 provider / gate / Round 细节。
- `runtime-state.json` 只作为可重建缓存。

### Image2 软件链路

```bash
npm run current-project-software-pressure:test
npm run current-project-one-shot-pressure:test
npm run current-project-preview-projection:test
npm run current-project-image2-closed-loop:test
npm run real-image2-batch-prepare-check:test
```

检查点：

- software pressure 只能标记软件可信。
- handoff ready 不能标记 provider submitted。
- return ingest 不能标记 formal promotion。
- QA / preview projection 必须有可追溯输入和输出证据。

### 小批真实回流前检查

```bash
lsof -i :8790
lsof -i :5176
```

检查点：

- `8790` runtime API 正在监听。
- `5176` Vite UI 正在监听。
- 当前项目绑定正确，且不是旧 sandbox / 旧 runtime cache。
- provider permission gate 显式打开；dry-run / worker-spawn-forbidden 等 flags 不应被误读。
- 小批量从 1 张或 3 张开始，禁止直接扩到整项目。

## 硬规则摘要

1. `execute-return` 是外部 provider 回流 ingest，不是 provider submit。
2. Mock、dry-run、software pressure、prepared packet、manual handoff 都不能被称为真实 provider ready。
3. 缺失媒体不能向 `<img>` 返回 JSON；避免 ORB 回归。
4. current-project binding 是事实入口；`runtime-state.json` 是可重建缓存。
5. provider submit、return ingest、QA promotion 是不同状态，必须分开命名和记录。
6. 视觉相似不等于 strict derivation；start/end 必须有 operation、input hash、attachment receipt、provider request / output evidence。
7. bbox anchors 不是动作；MotionEndpointContract 必须表达动作语义和起止状态。
8. Candidate / temp / failed assets 不能成为未来 reference authority，除非显式 QA 和 promotion。
9. 后续实现改动默认由 subagents / workers 执行，主 agent 只做拆分、审查、集成、验证。
10. 不要把 Diagnostics 细节泄漏到默认 Director UI；创作者界面只显示故事、素材、导演输入、预览和简短状态。
