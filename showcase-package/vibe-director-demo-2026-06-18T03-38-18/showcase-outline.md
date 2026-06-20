# Showcase Outline

## 1. 首屏：一句想法到项目
素材：`screenshots/00-input-draft.png`，`01-input/original-idea.md`

说明：从一句短片想法开始，先交给 Agent 整理，而不是自己填一堆表单。

## 2. Agent 协作
素材：`screenshots/01-agent-status-and-story.png`，`02-agent-communication/agent-timeline-summary.md`

说明：Agent 读取项目、检查素材、判断下一步，并在调用视频链路前等待确认。

## 3. 项目结构
素材：`03-project-structure/project-summary.md`，`03-project-structure/shots.json`

说明：故事被拆成 2 个可执行镜头，每个镜头都有时长、动作和参考模式。

## 4. 参考素材
素材：`screenshots/04-reference-gallery-unblocked.png`，`04-reference-assets/character-girl.png`，`04-reference-assets/scene-rain-street.png`，`04-reference-assets/prop-glowing-ticket.png`

说明：参考图按角色、场景、道具归类，避免把所有图片混成一个情绪板。

## 5. 视频请求
素材：`05-storyboard-and-prompts/how-prompts-are-written.md`，`05-storyboard-and-prompts/prompt-summary.md`，`05-storyboard-and-prompts/seedance_prompt.md`

说明：Agent 把镜头目标、参考素材和视频模型约束编译成可以提交的请求。

## 6. 提交与队列
素材：`06-video-generation/seedance-request-form.md`，`06-video-generation/video-status.md`，`06-video-generation/video_relay_queue.json`

说明：代表性片段在 CLI 任务列表中可查到 submitId，但网页端暂未确认可见；队列保持串行，已有 submitId 后优先查询结果，不盲目重复提交。

## 7. 交付状态
素材：`screenshots/06-export-and-delivery.png`，`07-final-output/video-pending.md`

说明：视频还没回流时，先展示项目包、参考、prompt 和 CLI 查询状态；回流后再补成片和关键帧。

## 最适合首屏的素材

首屏建议用 `screenshots/00-input-draft.png` 搭配三张参考图中的 `scene-rain-street.png`。它能同时表达“从一句想法开始”和短片的视觉气质。
