# Vibe Director 4-Shot Seedance Showcase

这是一个用于展示 Vibe Director 工作流的小项目包。

项目从一个 90 年代日漫感短片概念出发，整理成 4 个独立 Seedance 视频片段，并复用同一组参考资产：

- 场景/氛围参考：雨夜街道与自动售货机
- 角色参考：戴耳机的女高中生
- 道具参考：发光车票

## 推荐查看顺序

1. `01-project-plan/showcase_4shot_plan.md`
   - 看 4 个镜头如何被拆成可执行视频段。

2. `02-reference-assets/`
   - 看 Seedance 使用的 3 张参考资产。

3. `03-seedance-prompts/`
   - 看每个镜头发给 Seedance 的独立 prompt。

4. `04-generated-videos/`
   - `shot_1_rainy_ticket.mp4`
   - `shot_2_follow_blue_light.mp4`
   - `shot_3_platform_gate.mp4`
   - `shot_4_window_reflection.mp4`
   - `combined_4shot_preview.mp4`

5. `06-thumbnails/four_shot_contact_sheet.png`
   - 快速扫一眼四个镜头画面。

## Seedance Submit IDs

- Shot 1: `7502840c-8110-488a-ab17-4394075a2ae7`
- Shot 2: `205c4737-8b2e-4664-8560-cf2dec082cc3`
- Shot 3: `6e236ed1-7454-4de7-8d53-08f71c56beb2`
- Shot 4: `83bf52d2-3fd2-49b1-8489-3a7933a9b749`

## 展示重点

这个包适合展示三件事：

1. Agent 不只是写一个视频 prompt，而是把故事拆成可执行的镜头段。
2. 参考图不是一股脑塞给模型，而是区分场景、角色、道具的用途。
3. 每段视频都是独立的 Seedance 请求，方便复核、重试、替换和最终剪辑。

合并预览只是为了观看方便，真正的项目资产仍然保留为四个独立片段。
