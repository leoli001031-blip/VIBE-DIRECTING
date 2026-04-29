# Minimal UI Direction Audit 2026-04-30

本审计只针对 Vibe Core 主界面的产品方向，不评价底层 harness 是否必要。结论是：底层工程正在变硬，但主界面正在被工程可观测性吞没，需要在 Phase 9 把复杂信息压回 Diagnostics，让用户重新面对“故事、画面、资产、自然语言修改”。

## 1. UI 原则

### 1.1 主界面不是控制台

Vibe Core 的主界面应该像导演工作台，而不是 runtime dashboard。用户进入后第一眼看到的应该是：

- 当前故事段落。
- 已生成或待生成的分镜画面。
- 用于锁定一致性的角色 / 场景资产。
- 一个可以直接说修改意图的 Agent 输入区。

队列、manifest、schema、provider policy、pack hash、QA 细项、adapter 状态都可以存在，但默认不应该成为主界面视觉中心。

### 1.2 少文字，不等于少状态

用户最初要的是“简单直接”，不是失去控制。状态应该被翻译成短标签：

- `待生成`
- `生成中`
- `需复验`
- `已锁定`
- `需重生`
- `已选择 1-1, 1-2`

不要在主界面展示长 blocker、长 next step、长 envelope、长 policy note。详细原因进入 Diagnostics 或点击后的轻量浮层。

### 1.3 资产库只服务一致性

资产库不是素材网盘，不是所有输出图的图片墙。主界面中的 Asset Library 只保留：

- 角色主参考。
- 角色三视图 / 表情参考，若有。
- 场景主参考。
- 场景多视角参考，若有。
- 关键道具参考。
- 简短文本约束。
- locked / candidate / needs review 状态。

临时图、失败图、候选抽卡、contact sheet、task output 路径不应该进入主资产库视觉层。

### 1.4 Agent 面板是自然语言修改器

右侧 Agent 面板不应该像 prompt 表单，也不应该像 ChatGPT 通用聊天框。它只需要清楚表达：

- 当前作用域：全片 / 某幕 / 某几个镜头 / 某资产。
- 一个自然语言输入框。
- 一个发送动作。
- 一个极短的执行状态。

系统在后台自动打包 shot、asset、layout、reference、knowledge pack、QA gate。不要让用户看到或手填这些东西。

### 1.5 Diagnostics 是第二层产品

Diagnostics 很重要，但它是给开发、复盘、失败排查使用的第二层产品。主界面只显示“能不能继续”和“下一步是什么”的自然语言结果，不能把机器事实直接堆给创作者。

## 2. 当前偏差

### 2.1 顶部信息过重

当前 `src/App.tsx` 顶部包含 Vibe Core 品牌、项目状态、mode switch、state source、Import Runtime Test、Dry Check、Provider Locked，并紧接四个 overview metric。它更像调试入口，不像创作者的第一屏。

Phase 9 应把主界面顶部压缩成：

- 左侧：项目名。
- 中间：Asset Library / 自适应故事段落 / Preview。
- 右侧：一个很轻的状态点或 Diagnostics 入口。

### 2.2 Director 主界面仍然像三栏 dashboard

当前 `DirectorMode` 包含 `director-brief`、Visual Memory、StoryWorkspace、PreviewTimeline、VideoPlanningSummaryStrip、AudioPlanSummaryStrip、ExportProfilesPanel、DirectorInput。右栏堆叠了预览、视频、音频、导出、输入，导致真正的自然语言修改框被挤到后面。

Phase 9 应改为：

- 中央只放分镜 / 故事流。
- 右侧固定放 Agent 输入。
- 预览作为顶层 `Preview` tab 或全屏沉浸模式。
- 视频准备、音频计划、导出档案默认移到 Diagnostics / Inspector。

### 2.3 分镜卡片文字和机器状态太多

当前 `ShotCard` 显示 status、storyFunction、Start/End/Queue、六个 gate 字母。这个适合调试，但不符合参考图中的“图像第一、编号第二、功能词第三”。

Phase 9 主界面分镜卡片应只显示：

- 画面。
- `1-1` 这类编号。
- 1 个短功能词或用户可读标题，例如 `Setup` / `Decision`。
- 选中状态。
- 必要时一个小状态点。

Start/End、task count、gate 字母进入 Inspector 或 Diagnostics。

### 2.4 资产库现在偏列表，不偏视觉锁定

当前 `VisualMemoryPanel` 是左侧窄列表，主要显示资产名、lockedStatus、小圆点。它没有承接参考图 `13-v4-minimal-asset-bible` 的核心：大尺寸角色三视图、表情、场景多视角。

Phase 9 应把 Asset Library 做成一个单独顶层页面，使用大图矩阵，而不是左栏小列表。导演主界面中可以只保留最小资产入口或当前选中资产摘要。

### 2.5 Preview 被压成状态条

当前 `PreviewTimeline` 更像 preview eligibility 状态摘要，没有参考图 `15-v4-minimal-preview` 里的沉浸播放感。用户要的是点击后基于时间线时长实时预览现有图片或视频。

Phase 9 应把 Preview 做成单独模式：

- 大画面播放区。
- 下方极简时间线。
- 按幕刻度。
- 一个自然语言调整输入。
- 不展示 formal gate / blocked count / proxy duration 等机器字段。

### 2.6 Diagnostics 已经正确，但边界还不够硬

当前 Diagnostics 页面承载了很多正确内容：Generation Harness、Watcher、Resume、QA、Tool Runtime、Adapter、Audio、Preview Export、Knowledge Router。问题不是它们存在，而是部分同类信息仍在主界面重复出现。

Phase 9 要定规则：任何字段如果用户不需要用它直接创作，就默认不出现在 Director 主界面。

## 3. 参考图可继承的布局

### 3.1 `12-v4-minimal-act-view`

可继承：

- 顶部横向导航：Asset Library、故事段落、Preview。
- 大图优先，画面横向完整呈现。
- 右侧只有一个非常轻的作用域输入框。
- 留白多，边框少，文字少。

需要调整：

- Act I-IV 不能写死，应由 Story Flow 自适应生成，例如 `序幕`、`第一夜`、`转折`、`离开`。
- 右侧输入框应显示当前选中范围，而不是固定 Scope。

### 3.2 `13-v4-minimal-asset-bible`

可继承：

- Asset Library 作为独立页面。
- 角色参考用大尺寸三视图和表情组。
- 场景参考用大尺寸多视角。
- 只显示必要名字，例如角色名、场景名。

需要补足：

- 每个资产要有轻量状态：locked / candidate / review。
- 文本约束可以作为 hover / inspector，不要常驻大段显示。
- 临时图和失败图不进入此页。

### 3.3 `14-v4-minimal-selected-edit`

可继承：

- 分镜图大而完整。
- 多选后右侧显示 `Selected 1-1, 1-2`。
- 修改入口就是一句自然语言。
- 选中状态是视觉边框，不是表格行。

需要补足：

- 支持单选、多选、整幕选择。
- 输入发送后主界面只显示短状态，详细任务计划进入 Diagnostics。

### 3.4 `15-v4-minimal-preview`

可继承：

- Preview 是沉浸式大画面。
- 底部只有播放按钮、时间码、时间线和幕刻度。
- 画面暗色环境与故事预览相匹配。

需要补足：

- 当前已有图片时，用 image hold 按 shot duration 播放。
- 视频片段存在时替换对应 image hold。
- 缺失片段可以显示极简占位，不展示错误 JSON。

## 4. 需要隐藏到 Diagnostics 的信息

以下信息可以保留在系统里，但不应默认出现在 Director 主界面：

- `State Source`、runtime-state 路径、schema version。
- `Import Runtime Test`、`Dry Check` 这类开发按钮。
- Provider lock 详细规则。
- `Story Flow / Visual Memory / Queue / Blockers` overview metrics。
- workflow rail。
- `Next Step / Queue / Blocking Reason` 三格大面板。
- shot card 中的 Start / End / Queue。
- 六个 gate 字母。
- task count。
- contact sheet。
- Video Readiness、Queue Shell、Provider Lock、First Blocker。
- Audio planned、Mix placeholders、No BGM。
- Export profile list。
- dry-run change plan 的 transaction id、operation、intent type、impact scope、stale artifact 数。
- forbidden actions 长列表。
- manifest matcher、source index、preflight blocker JSON。
- knowledge pack 注入数量、token budget、pack hash。

主界面只需要它们的用户译文，例如：

- `缺少尾帧，不能生成视频`
- `这个场景还没锁定`
- `正在整理 3 张临时图`
- `已生成修改计划，等待确认`

## 5. 主界面应该保留的最小信息

### 5.1 顶部导航

- 项目名。
- `Asset Library`
- 自适应故事段落 tabs。
- `Preview`
- 轻量 Diagnostics 图标入口。

### 5.2 Story Flow / 分镜页

- 当前段落标题。
- 分镜图网格或横向故事流。
- 每张图完整显示，不裁成窄条。
- 编号，例如 `1-1`。
- 短功能词，例如 `Setup`、`Catalyst`、`Decision`。
- 选中态。
- 小状态点：ready / working / review / missing。

### 5.3 Asset Library 页

- 角色：主参考、三视图、表情。
- 场景：master、derived views。
- 道具：关键参考。
- 风格：1 张风格锚图或极短风格摘要。
- locked 状态。

### 5.4 右侧 Agent 面板

- 当前选中范围。
- 输入框 placeholder：`描述你想怎么改...`
- 发送按钮。
- 一行状态：`将影响 2 个镜头` / `正在准备任务` / `等待确认`。

### 5.5 Preview 页

- 大画面播放。
- 播放 / 暂停。
- 时间码。
- 时间线。
- 幕刻度。
- 缺失内容的轻量占位。

## 6. Phase 9 UI 具体落地清单

### P0：先把主界面减下来

1. 新增 `MinimalDirectorMode` 或重构当前 `DirectorMode`，让主界面只包含顶部 story tabs、分镜区、右侧 Agent 输入。
2. 将 `director-brief` 默认移除，改成右上角一个短状态文本。
3. 将 `VideoPlanningSummaryStrip`、`AudioPlanSummaryStrip`、`ExportProfilesPanel` 从 Director 主界面移入 Inspector / Diagnostics。
4. 将 `PreviewTimeline` 从右栏抽成顶层 `Preview` mode。
5. 将 `ShotCard` 改为 image-first：大图、编号、短标题、状态点；隐藏 Start/End/Queue/gate 字母。
6. 顶部 `overview` 只在 Diagnostics 显示，Director 默认不显示。
7. 顶部开发按钮移到 Diagnostics，Director 只保留轻量状态和入口。

### P1：重做 Asset Library

1. 将 Asset Library 从左栏列表变成顶层页面。
2. 使用大图矩阵展示角色、场景、道具、风格锚。
3. 区分 `locked`、`candidate`、`needs review`，但使用小标签，不显示长说明。
4. 临时图、失败图、候选输出默认不进入 Asset Library。
5. 资产详情进入右侧 Agent 面板或轻量 Inspector，不占主视觉。

### P1：右侧 Agent 面板收敛

1. `DirectorInput` 文案从 `Preview Change Plan` 改成更自然的 `发送` / `准备修改`。
2. 输入框 placeholder 改成中文自然语言。
3. 默认只显示选中范围和一句系统状态。
4. change plan 结果默认折叠，只在需要用户确认时显示 2-3 条自然语言影响。
5. transaction、operation、intent type、forbidden actions 进入 Diagnostics。

### P2：Preview 变成真正预览

1. 增加顶层 `Preview` mode。
2. 使用 `previewEvents` 生成可播放的 image hold / video clip 时间线。
3. 大画面区域优先显示当前时间点的素材。
4. 底部保留播放按钮、时间码、幕刻度。
5. 缺片段时显示安静占位，不显示 gate 表格。

### P2：视觉系统回到克制

1. Director / Asset / Preview 三个主页面采用浅色纸面或深色预览两套明确模式，不混合 dashboard 暗色块。
2. 减少卡片边框和嵌套面板。
3. 字体层级：标题大，标签小；不要让状态数字变成主角。
4. 分镜图必须完整显示，优先 16:9 / 21:9，不为了塞状态而缩小画面。
5. 图像缺失时用固定比例空白位，避免布局跳动。

## 7. 最终判断

当前 Vibe Core 的工程方向没有偏：harness、schema、provider lock、QA、watcher 都是必要底座。偏差发生在“把底座也展示给用户”。Phase 9 的核心不是继续加功能，而是建立 UI 分层：

```text
Director UI = 故事 + 画面 + 资产锁定 + 自然语言修改
Inspector = 当前选中对象的必要细节
Diagnostics = harness / schema / provider / QA / task / source index
```

只要这一层分开，产品就能同时保留工程可靠性和最初想要的极简导演台气质。
