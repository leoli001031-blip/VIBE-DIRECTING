# Vibe Director Demo Index

这个目录用来录制或展示 Vibe Director 当前 demo。

最简单的理解方式：

- 左边管项目。
- 中间看故事、参考、视频和交付结果。
- 右边和 AI 导演沟通。

## 推荐演示顺序

### 1. 先展示软件形态

打开本地应用：

```bash
npm run dev:full
```

浏览器进入：

```text
http://127.0.0.1:5174/
```

录制时先讲一句：

> 我不是在做一个“多按钮工作流”，而是在把 AI 视频项目收束成一个导演 Agent：我说想拍什么，它负责拆故事、管理参考、生成请求、串行提交视频、回流复核和导出。

可以展示这些界面：

- `promo-page-ai-ladies-op-2026-06-18/software-ui/01-current-entry-viewport.png`
- `promo-page-ai-ladies-op-2026-06-18/software-ui/02-reference-assets.png`
- `promo-page-ai-ladies-op-2026-06-18/software-ui/05-story-flow.png`
- `promo-page-ai-ladies-op-2026-06-18/software-ui/03-video-preview-status.png`
- `promo-page-ai-ladies-op-2026-06-18/software-ui/04-export-page.png`

### 2. 展示 Agent + Skills 的想法

素材：

- `promo-page-ai-ladies-op-2026-06-18/copy/concept-positioning.md`
- `promo-page-ai-ladies-op-2026-06-18/copy/software-screenshot-notes.md`

核心表达：

> AIGC 已经能生成漂亮画面，但普通人和专业人士的差距往往在分镜、镜头调度和叙事节奏。Vibe Director 的 Skills 不是模板，而是让 AI 知道“这段应该怎么拍”的导演经验。

可以在软件里演示：

```text
把这个沉淀成 Skill
```

预期效果：

- 右侧消息流出现“保存导演经验”。
- “我的 Skills”显示已保存的导演经验。

### 3. 展示 4 镜头真实 Seedance 闭环

目录：

- `vibe-director-4shot-seedance-showcase-2026-06-18T13-00/`

看这些文件：

- `01-project-plan/showcase_4shot_plan.md`
- `02-reference-assets/`
- `03-seedance-prompts/`
- `04-generated-videos/combined_4shot_preview.mp4`
- `06-thumbnails/four_shot_contact_sheet.png`

这部分用于证明：

- 一个想法会被拆成多个可执行视频段。
- 场景、角色、道具参考分工明确。
- 每段 Seedance prompt 可以单独复核、重试和替换。
- 视频生成按串行队列推进，不并发乱提交。

### 4. 展示 AI 大小姐 OP 项目页

目录：

- `promo-page-ai-ladies-op-2026-06-18/`

直接打开：

```text
showcase-package/promo-page-ai-ladies-op-2026-06-18/index.html
```

重点素材：

- 最终网页视频：`web/ai-ladies-op-final-web.mp4`
- 单段视频：`shots/*.mp4`
- 角色参考：`references/character-reference-grid.png`
- 场景参考：`references/scene-reference-grid.png`
- 软件截图：`software-ui/*.png`
- 生成证据：`evidence/submit-ids.md`
- 分镜计划与 prompts：`prompts/`

这部分用于展示最终产品感：从素材宇宙、镜头规划、prompt、视频段，到宣传页素材都能被打包。

## 录制前检查

跑：

```bash
npm run showcase-package-audit:test
```

这个检查会确认：

- 4 镜头 Seedance 包的视频、prompt、参考图和提交证据都存在。
- AI 大小姐宣传页包的视频、软件截图、角色/场景参考、prompt 和证据都存在。
- 关键理念文案没有丢。

## 当前 demo 的边界

已经适合展示：

- Agent-first 三栏结构。
- 右侧消息流和行动解释。
- 点选上下文。
- Skills 可见、可解释、可沉淀。
- 参考资产、视频请求、回流状态、导出/展示包。

还不建议在录制里承诺：

- 长剧全自动管理。
- 多模态图片 QA。
- 完整 TTS / 音乐节奏闭环。
- 多人协作或 Skill 商店。
