# Agent 工作台 UI 收口清单

## 目标

把 demo 主界面从“半自动工作流面板”收成“Agent 主导的视频项目工作台”。用户只需要在底部输入框说目标或拖素材；Agent 负责说明它理解了什么、缺什么、准备怎么做，以及现在是否需要用户确认。

## 按钮决策

### 常驻保留

- 项目控制 / 打开项目：用于切换本地项目文件夹和恢复项目上下文。
- 设置：用于模型 Key、联网资料、运行配置。
- 导出：保持可见，但项目不完整时禁用。
- 发送：底部输入框的主操作，不能只依赖快捷键。
- 浏览器草稿或缺少本地项目时，底部主按钮仍保持“发送”；项目要求放进状态说明或确认卡，避免用户以为不能继续沟通。

### 默认隐藏

- 故事 / 参考 / 预览：故事存在后收进“查看”菜单。
- 镜头上移、下移、增加、删除：只在展开单个镜头详情时渲染。
- 镜头字段表单：只在展开单个镜头详情时渲染。
- 草案统计、清单、计划详情：只在展开“更多细节”时渲染。
- 导演讨论的分栏和待确认修改：只在展开讨论时渲染；有待确认修改时可以自动展开。

### 合并进 Agent 计划

- 整理草案、查资料、生成故事板、补参考这类动作不做常驻按钮。
- 低风险动作作为 Agent 的计划或草稿结果出现。
- 高风险动作才用确认卡出现。
- 页面摘要优先显示素材收件箱、复核、缺画面、视频排队等真实待处理项，不能在下方有待确认素材时仍显示“没有待处理项”。

### 改名规则

- 主界面使用创作者能懂的话：正在整理、缺少参考、等待复核、可生成、视频排队中、已回流、需要你确认。
- 主界面避免工程词：staged、handoff、receipt、provider、schema、runtime、real-chain、relay queue。
- 空状态必须告诉用户下一步可以说什么，不能只显示“待补 / 无 / unknown”。

## 当前落点

- `NewVideoStart`：底部输入框是主入口；镜头编辑、草案细节、讨论细节都默认收起。
- `MinimalTopNav`：故事 / 参考 / 预览只在“查看”菜单展开时渲染。
- `CreatorDeskPanels`：主界面展示四段 Agent 当前任务：理解、缺口、准备、确认。
- `ProjectObservation`：统一投影故事、参考、视频、导出和当前选择状态。
- 素材收件箱：拖入文件后先展示粗分类和绑定建议。

## 每轮验证

- `npm run minimal-ui:test`
- `npm run minimal-agent-p1:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run asset-reconciliation:test`
- `npm run director-agent-action-envelope:test`
- `npm run director-agent-tool-handoff:test`
- `npx tsc --noEmit --pretty false`
