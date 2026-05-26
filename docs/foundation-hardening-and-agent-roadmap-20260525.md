# Vibe Director 基础能力夯实与 Agent 增强规划

生成日期：2026-05-25

## 当前判断

软件的核心能力已经铺开，但还没有到稳定日用状态。当前阶段不建议继续扩大功能面，应该先把已有能力收紧：项目管理、统一输入、AI 分镜、三种 Seedance 参考模式、素材复核、TTS/音乐、Web Search、导出和长队列恢复。

一句话目标：

> 把 Vibe Director 从“功能很多的原型”夯实成“一个用户可以稳定从自然语言开始做视频项目的本地导演工作台”。

## 已实现的主要能力

1. 本地项目与 Project.vibe
   - 支持本地项目文件夹创建、打开、恢复。
   - Project.vibe 可以保存草案、故事事实、资产引用和执行回执。
   - 当前已经修过空项目/旧项目残留的一部分问题，但还需要继续用真实前端流程压测。

2. 统一输入入口
   - 脚本、图片、音频、修改意见可以进入底部统一输入框。
   - 脚本会先生成草案，确认后再写入 Project.vibe。
   - 音频会区分声音参考和配乐参考。

3. AI 分镜与节奏判断
   - LLM planner 已接入，可以根据脚本、风格、时长和用户偏好拆镜头。
   - 支持 rhythm profile、execution mode、visible cut budget、reference strategy。
   - 已避免部分机械拆行问题，但复杂动作、日漫分镜感和资产规划仍需加强。

4. 三种视频参考策略
   - `storyboard_narrative`：故事板叙事，用于构图、人物关系、情绪承接。
   - `storyboard_rapid_cut`：故事板快切，用于赛车、动作链、训练、快速切镜。
   - `omni_reference`：场景图 + 角色/道具参考 + 文本方向，用于单一连续镜头。

5. Image2 / 参考素材
   - 可以规划和生成角色、场景、道具、故事板参考图。
   - 有 candidate / needs_review / locked 等资产状态。
   - 但前端复核、锁定、继续生成的体验还不够顺。

6. Seedance / Jimeng 视频提交
   - 已有 Seedance prompt 编译、参考图打包、串行视频队列、submit id、恢复查询。
   - 默认 no BGM，音乐不进入视频模型 prompt。
   - 长排队、退出恢复、自动继续下一段还需要真实验证。

7. 音频与 TTS
   - 已有 voice reference、music reference、音乐节奏规划、最终导出混音的基础合同。
   - TTS 接入方向已有 Qwen / IndexTTS 相关路线，但产品主流程还没完全打磨。

8. Web Search / 知识卡
   - Tavily / Web Search 后端和测试已存在。
   - 目前还没有真正产品化成“风格研究卡 / 可内化知识卡”的主流程体验。

9. 选中镜头后反馈
   - 用户可以点选镜头后在底部输入框提出修改。
   - 当前会生成 staged 修改并重编译，不直接提交 provider。
   - 但它仍偏规则补丁，不是强 Agent 操作系统。

## 当前没有做好的地方

### 1. 项目管理仍不够清楚

症状：

- 旧项目标题和旧故事流容易残留在 UI 中。
- 最近项目、当前项目、打开项目、删除记录之间的关系不够直观。
- 空项目和已有项目的状态差异还不够清楚。

目标：

- 项目像 Codex workspace 一样明确。
- 用户知道自己当前在哪个项目里。
- 新建项目、打开项目、移除记录、忘记项目都清楚可控。

### 2. 前端 UI 与后端执行合同仍有漂移

症状：

- UI 仍可能出现旧词，比如起始帧、补参考、故事流、提交视频等，和当前三模式策略不完全一致。
- 有些按钮看起来像会“自动生成全部”，实际只触发某个后端动作。
- 用户看不到足够清楚的状态：草案、待确认、已写入、待复核、已锁定、可提交。

目标：

- 每一个 UI 动作都对应一个明确后端合同。
- 每一个后端状态都能用创作者语言显示出来。

### 3. 参考资产策略还不够泛化

症状：

- 车灯、轮胎、手、天空、雾、书页等部件有时会被当作独立资产。
- 一个主体对象的细节应该归属于主体，而不是拆成很多参考图。
- 同一场景、多场景、同一主体、多主体的参考图选择还需要更智能。

目标：

- 从固定“角色/场景/道具”升级为“参考权威图谱”。
- Agent 判断哪些东西需要锁定，哪些只是描述约束。
- 部件默认绑定到主体资产，不单独生成，除非它是故事关键物。

### 4. 故事板与视频 prompt 编译还需要继续清理

症状：

- 以前的 Seedance prompt 存在重复字段、工程术语、参考图权限不够硬的问题。
- 故事板叙事、故事板快切、全能参考三种模式容易在边界处混淆。
- 人看的故事板和给 Seedance 的参考图还没有完全双轨。

目标：

- Prompt 更像导演指令，不像数据库字段导出。
- Storyboard reference 只控制构图、顺序、动作节点和节奏。
- Scene / character / prop reference 各自只控制自己的权威维度。

### 5. 复核与锁定闭环不够顺

症状：

- 参考图生成后，用户不一定能立刻在前端看见。
- 锁定入口、重做入口、绑定入口还不够自然。
- 锁定后故事流和视频提交计划是否刷新，需要更多真实测试。

目标：

- 生成结果必须可见。
- 用户可以一键锁定、重做、绑定到角色/场景/道具/镜头。
- 锁定后自动刷新项目资产和后续编译结果。

### 6. Agent 能力目前还偏弱

症状：

- 当前 Agent 更像 planner + patcher。
- 它能整理草案、局部重编译，但还不能稳定地操作软件流程。
- “先不要提交视频”这类意图目前更多靠 UI 流程尊重，不是硬状态合同。

目标：

- Agent 输出 staged actions，而不是只输出文本。
- 用户确认后，action 再落地到 Project.vibe 或 runtime。
- 让 Agent 能理解当前项目状态、当前选中对象、当前阻塞点。

## 需要优先夯实的执行规划

### P0：项目管理与状态真相

要做：

- 统一新建项目、打开项目、最近项目、移除记录、忘记项目。
- 空项目不显示旧故事、旧资产、旧预览。
- 当前项目标题、路径、Project.vibe 状态必须可信。
- 建立项目切换 E2E 测试：A 项目 -> B 项目 -> 空项目 -> 回到 A 项目。

验收：

- 不再出现旧项目标题残留。
- 空项目没有假镜头。
- 最近项目列表可以清楚管理。

### P1：统一输入框与 plan-only 硬合同

要做：

- 底部输入框成为脚本、素材、反馈、搜索意图的唯一入口。
- 发送后输入框清空。
- 用户说“先不要提交视频”时，写入 project/session 级 `videoSubmitAllowed: false` 或等价合同。
- UI 显示“只规划 / 可生成参考 / 可提交视频”。

验收：

- 用户可以明确看到当前是否会提交 provider。
- 文本发送、文件拖入、选中镜头反馈都走同一交互模型。

### P2：三模式策略合同收口

要做：

- 将三种策略整理成正式 strategy contract：
  - 输入条件
  - 参考图类型
  - prompt 结构
  - 可见 cut 数
  - 风险提示
- 每个镜头显示策略原因，但默认用简短创作者语言。
- 增加 idea-only planner tests，不生成图和视频，只看拆分、资产、prompt。

验收：

- 同一个 idea 进来，可以稳定输出合理策略。
- 快切不会退化成单面板。
- 全能参考不会上传不相关道具和部件。

### P3：参考资产权威图谱

要做：

- 引入 asset authority graph：
  - identity authority
  - scene/weather authority
  - object authority
  - style authority
  - audio authority
- 车灯、轮胎、手、书页、雾、天空等默认作为主体或场景的约束，不作为独立资产。
- 只有故事关键物才生成独立 prop reference。

验收：

- 车辆案例不会把车灯/轮胎独立生成参考。
- 旧书/车票这类关键物可以保留为独立道具。
- 场景基准图不会跨不相关场景污染。

### P4：复核、锁定、继续生成闭环

要做：

- 参考生成后自动出现在前端。
- 每张参考图有：通过并锁定、重做、绑定对象、查看 prompt。
- 锁定后刷新故事流、资产库、视频提交计划。

验收：

- 用户能从“补参考”一路走到“锁定后提交视频”。
- 不需要去文件夹里找图片才能复核。

### P5：音频与 TTS 产品化

要做：

- 音乐作为节奏参考和最终配乐，不进入视频模型。
- 声音参考绑定到角色或旁白。
- Qwen TTS 作为默认日语/多语 TTS 路线先固定。
- 输出音频需要能在前端试听、复核、替换。

验收：

- 用户拖入音乐，能看到“用于节奏和最终配乐”。
- 用户能为角色生成或绑定一条 voice reference。
- 最终导出包包含可理解的音频结构。

### P6：Web Search 与知识内化

要做：

- 用户描述风格时，Agent 判断是否需要查资料。
- 查到的资料形成“风格研究卡”。
- 用户确认后可以保存为项目知识卡或全局 skill/card。

验收：

- 用户说“像初代 EVA 的分镜感”，软件能先整理资料，再影响分镜和 prompt。
- 搜索结果不会直接污染正式事实，必须确认后内化。

### P7：真实项目回归矩阵

要做：

- 建立固定样例：
  - 3 镜头安静故事
  - 8-12 镜头日漫叙事
  - 赛车/动作快切
  - 带音乐节奏参考
  - 带 TTS/对白
- 每个样例至少跑到 prompt 编译和素材复核。
- 关键样例再跑真实 Image2 / Seedance。

验收：

- 每个功能都有一个真实用户路径验证。
- 不是只靠单元测试证明。

## 下一阶段 Agent 能力规划

暂时不建议马上做强自主 Agent。建议先实现 Agent Action Layer。

### Agent Action Layer

Agent 不直接“神经刀式”改项目，而是输出可审查动作：

- `update_shot`
- `split_shot`
- `merge_shots`
- `set_reference_strategy`
- `plan_assets`
- `prepare_references`
- `lock_asset`
- `prepare_video_segment`
- `submit_video_segment`

每个 action 都必须有：

- target
- reason
- expected change
- affected files/facts
- confirmation requirement
- rollback hint

### Agent 工作流

1. 读取当前项目状态。
2. 理解用户输入和选中对象。
3. 生成 staged actions。
4. 做 schema validation。
5. 给用户展示简短解释。
6. 用户确认后写入 Project.vibe。
7. Runtime 执行受控任务。
8. 写 receipt。
9. 前端刷新。

### 未来增强方向

- 让 Agent 能做项目自检：缺哪些参考、哪些镜头太密、哪些 prompt 有风险。
- 让 Agent 能自动拆长片段队列：一段生成完，再推下一段。
- 让 Agent 能维护风格知识卡：本地知识 + Web Search + 用户确认。
- 让 Agent 能做失败恢复：provider 失败后判断重试、改 prompt、降级模式。
- 让 Agent 能看前端状态：当前选中镜头、当前 tab、当前阻塞原因。

## 当前建议的冻结边界

本阶段不再新增大功能。冻结功能范围：

- Project.vibe 本地项目
- 统一输入框
- AI 分镜
- 三种视频参考模式
- 参考资产生成/复核/锁定
- Seedance 提交与恢复
- 音乐节奏参考
- TTS 基础入口
- Web Search 研究卡
- 导出包

优先级：

1. 先修使用体验和状态真相。
2. 再修 prompt/策略泛化。
3. 再补复核和导出闭环。
4. 最后再扩 Agent 自主操作能力。

## 已验证的当前测试面

本轮 review 中已通过：

- `npx tsc --noEmit --pretty false`
- `npm run director-ai-storyboard-planner:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-seedance-mode-compiler:test`
- `npm run new-video-audio-reference:test`
- `npm run script-music-rhythm-planner:test`
- `npm run director-feedback-recompile:test`
- `npm run agent-web-search-product:test`

注意：

- 这些测试证明关键合同没有直接断。
- 它们不等价于真实 Electron 前端全链路稳定。
- 下一步仍需要用真实前端跑固定 fixture。
