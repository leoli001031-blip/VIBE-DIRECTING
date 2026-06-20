# Vibe Director Demo Package

这个包用于展示一个完整的 Vibe Director 项目链路：从一句想法开始，经过 Agent 整理、项目结构拆分、参考图生成、Prompt 编译、Seedance 提交，再到等待视频回流和最终交付。

当前包基于本地项目：

`/Users/lichenhao/Desktop/new vibe directing/.vibe-runtime/browser-projects/project-1781737355707`

## 推荐查看顺序

1. `01-input/original-idea.md`
   看最初输入给 Agent 的短片想法。

2. `02-agent-communication/agent-timeline-summary.md`
   看 Agent 如何读取项目、检查素材、判断下一步，并在视频提交前等待确认。

3. `03-project-structure/project-summary.md`
   看故事如何被整理成 2 个可执行镜头。

4. `04-reference-assets/reference-assets.md`
   看角色、场景、道具参考图。截图入口见 `screenshots/04-reference-gallery-unblocked.png`。

5. `05-storyboard-and-prompts/how-prompts-are-written.md`
   看从分镜规划到 Seedance prompt 的编译逻辑。

6. `06-video-generation/seedance-request-form.md`
   看发给 Seedance 2.0 的请求形式、参考图顺序、模型、时长、submitId 和查询命令。

7. `07-final-output/video-pending.md`
   当前视频还没有本地回流。回流后把 mp4 放进 `07-final-output/`，再更新这个文件。

## 当前状态

- 参考图：已生成并打包。
- Prompt：已编译并打包。
- Rule QA / Text QA：均通过。
- Seedance：已重新提交第 1 段，submitId `7502840c-8110-488a-ab17-4394075a2ae7`。`dreamina query_result` 确认状态为 `querying`，队列状态 `Generating`，队列位置 0。
- 本地视频：暂未回流。2026-06-18 12:35 CST 查询仍在生成中。
- 第 2 段：已在队列中 ready，但没有提交，避免真实测试时重复烧视频。

## 录制或做展示网页时怎么用

最稳的展示逻辑是：

一句想法 -> Agent 整理项目 -> 参考图结果 -> Prompt/请求形式 -> Seedance CLI 任务状态 -> 最终视频占位/回流后补成片。

不要把它讲成“一个按钮直接出片”。更准确的说法是：这个 demo 展示的是一个面向 AI 视频创作的项目管理与导演 Agent 链路，它把普通人不擅长的分镜、参考、节奏和视频请求整理成可执行资产。
