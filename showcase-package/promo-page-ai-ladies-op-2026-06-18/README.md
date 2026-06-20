# Promo Page Asset Pack — AI大小姐们想让我告白 OP

这个文件夹是给宣传页/项目展示页用的干净素材包。它不是运行目录，里面只保留页面会用到的素材、文案和生成证据。

## 推荐用法

静态展示页：

- `index.html`

首屏视频：

- `web/ai-ladies-op-final-web.mp4`
- `web/hero-poster.jpg`

项目成果展示：

- `hero/ai-ladies-op-final-muted.mp4`
- `hero/ai-ladies-op-timeline-contact.png`
- `shots/*.mp4`
- `stills/shot-*-contact.png`

素材能力展示：

- `references/character-reference-grid.png`
- `references/scene-reference-grid.png`
- `references/characters/*.png`
- `references/scenes/*.png`

过程与可信度展示：

- `prompts/op-6shot-plan.md`
- `prompts/shot-*-prompt.md`
- `evidence/run-state.json`
- `evidence/submit-ids.md`

软件与流程展示：

- `software-ui/01-current-entry-viewport.png`
- `software-ui/02-reference-assets.png`
- `software-ui/03-video-preview-status.png`
- `software-ui/04-export-page.png`
- `software-ui/05-story-flow.png`

页面文案草稿：

- `copy/page-copy.md`
- `copy/concept-positioning.md`
- `copy/software-screenshot-notes.md`
- `copy/page-section-outline.md`

## 页面叙事建议

1. 可以直接打开 `index.html` 看完整展示页。
2. 先放最终 OP 短片，让用户第一眼看到结果。
3. 接着放一句话：这不是单次生成，而是把角色、场景、分镜节奏和视频生成请求组织成一条链路。
4. 展示角色参考图和场景参考图，说明 Agent 能把已有素材纳入项目。
5. 展示 6 个镜头的时间线和单镜头抽帧，说明系统在做镜头规划和节奏控制。
6. 插入软件界面截图和对应解释，说明这条链路是在 Vibe Director 里组织出来的。
7. 展示一个 prompt 片段，重点突出“日漫 OP cut / no BGM / reference discipline”。

## 注意

- 所有视频素材都已做无音轨版，适合后期自己加 BGM/旁白。
- `hero/` 是母版质量；`web/` 是宣传页轻量版。
- `shots/` 是单段镜头，适合页面里做横向滚动或 hover preview。
