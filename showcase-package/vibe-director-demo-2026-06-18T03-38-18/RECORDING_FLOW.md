# Recording Flow

这是一条适合录制项目展示的顺序。你可以用它做网页，也可以按这个顺序录屏。

## 1. 开场：一句想法

展示素材：

- `screenshots/00-input-draft.png`
- `01-input/original-idea.md`

要表达的重点：

用户不需要先填一堆表。先说想拍什么，Agent 会把它整理成项目。

## 2. Agent 开始整理

展示素材：

- `screenshots/01-agent-status-and-story.png`
- `02-agent-communication/agent-timeline-summary.md`

要表达的重点：

Agent 会读取项目状态、检查参考素材、判断下一步，并在写入项目或提交视频前等待确认。

## 3. 项目结构成型

展示素材：

- `03-project-structure/project-summary.md`
- `03-project-structure/shots.json`

要表达的重点：

短片不是平均切段，而是被拆成有动作、时长、参考策略的镜头。

## 4. 参考图生成与复核

展示素材：

- `screenshots/04-reference-gallery-unblocked.png`
- `04-reference-assets/character-girl.png`
- `04-reference-assets/scene-rain-street.png`
- `04-reference-assets/prop-glowing-ticket.png`

要表达的重点：

角色、场景、道具会分开沉淀。视频模型收到的是结构化参考，而不是一堆随便堆进去的图片。

## 5. Prompt 编译

展示素材：

- `05-storyboard-and-prompts/how-prompts-are-written.md`
- `05-storyboard-and-prompts/prompt-summary.md`
- `05-storyboard-and-prompts/seedance_prompt.md`

要表达的重点：

Agent 会把镜头目标、参考图职责、视频时长、禁用项和风格要求编译成一个可提交的视频请求。

## 6. 发给 Seedance 2.0

展示素材：

- `06-video-generation/seedance-request-form.md`
- `06-video-generation/input-manifest.json`
- `06-video-generation/video-status.md`

要表达的重点：

这是一个真实提交链路。当前第 1 段已经拿到 submitId；因为视频排队慢，展示时可以说明这里进入了可恢复查询状态。

## 7. 最终成片

展示素材：

- 当前：`07-final-output/video-pending.md`
- 回流后：把 mp4 放到 `07-final-output/`，并补一张预览截图或关键帧。

要表达的重点：

视频回来后，这个包可以继续更新成完整交付包：最终视频、参考图、prompt、receipt、项目结构都在一起。
