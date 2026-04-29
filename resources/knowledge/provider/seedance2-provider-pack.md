# Seedance 2.0 Provider Pack

更新时间：2026-04-28

目标：把 Seedance 2.0 定义成“已通过 QA 的关键帧的视频化后端”，而不是把它当成万能视频生成器。

## 当前定位

Seedance 2.0 在 v0.3 中负责：

- 把 Image 2 已批准关键帧转成视频。
- 根据 Motion Spec 执行轻到中等强度的镜头运动。
- 根据角色状态生成合理表演和微动作。
- 在低风险镜头中做有限多参考融合。

Seedance 2.0 不负责：

- 修正人物身份漂移。
- 修正服装、场景视角、空间关系。
- 重新发明剧情动作顺序。
- 作为正式主线的文生视频默认路径。
- 通过视频 prompt 硬修关键帧中的 P0 错误。

## 当前已确认能力

Runway 官方 Seedance 2.0 指南显示，它支持 Text to Video、Image to Video、Video to Video，并提供 References、Start / End frames 和 Text to Video 三类创作模式；Runway 文档列出时长 5-15 秒、比例 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16，输出 480p、720p、1080p，并支持文本、图片、视频、音频输入。

ByteDance 官方页和 Seedance 2.0 model card 也强调它是多模态音视频生成模型，支持文本、图像、音频、视频输入。arXiv model card 中写到开放平台支持最多 9 张图片、3 段视频、3 段音频作为多模态参考，原生输出 480p 和 720p，时长 4-15 秒。

对 Vibe Director 的意义：

- v0.3 主路径应使用 Start frame / Image to Video 思路。
- 如果未来接入的平台支持首尾帧，才能把 `start_keyframe` 和 `end_keyframe` 都传给 adapter。
- 如果平台只支持单张起始图，`end_frame` 只能变成 prompt 约束，不能当成硬能力。
- 不同平台上的 Seedance 2.0 能力可能不完全一致，必须以实际接入渠道重新验证。

## Seedance Task 输入

```yaml
task_type: video_from_keyframe
shot_id: "05_08"
approved_keyframe: "shots/05_08/keyframe_v003.png"
provider_ready_keyframe: "shots/05_08/keyframe_v003_seedance_720p.png"
duration_seconds: 6
aspect_ratio: "16:9"
motion_spec:
  camera_motion: "slow push-in"
  subject_action: "母亲停在车库门边，手扶着门框，迟疑地看向里面"
  performance: "克制、心里有话但不说"
  motion_intensity: "low"
style_capsule:
  visual_tone: "低纹理、冷暖对比、真实电影感"
must_preserve:
  - "关键帧构图和人物身份"
  - "车库空间结构"
  - "低纹理，不要增加复杂质感"
must_avoid:
  - "改变门的位置"
  - "新增不在故事中的人物"
  - "提前展示摩托车全貌"
audio_policy:
  bgm_allowed: false
  music_track_allowed: false
  diegetic_ambience_allowed: true
```

## Provider-ready 输入帧

不要把 Image 2 master keyframe 直接丢给 Seedance。

Seedance adapter 必须先生成 provider-ready derivative：

- 720p 输出：输入帧标准化为 `1280x720`。
- 保留原始 approved keyframe，不覆盖 master。
- 如果 master 不是目标比例，先按 Shot Layout 做安全裁切或 padding，再缩放。
- 如果 master 已经是 16:9，也仍然要缩放到目标像素尺寸。
- derivative 必须写入 manifest，记录原图、尺寸、hash、生成方式和用途。

原因：

- 图生视频模型可能在内部对输入图重采样、裁切或重新锚定。
- 即使比例一致，像素尺寸不一致也可能造成开头几帧轻微抽搐或画面重新对齐。
- 对“几乎锁机 / very subtle push-in”这类低运动镜头，开头抖动会特别明显。

推荐命名：

```text
keyframe_v003.png
keyframe_v003_seedance_720p.png
```

## 首尾帧模式

当接入渠道支持 `frames2video` / start-end frames 时，首尾帧模式优先用于：

- 需要明确结束姿态的镜头。
- 低运动、情绪表演、轻微推近、手部/视线/道具状态变化。
- 需要减少单首帧模式中模型自由发挥的镜头。

首尾帧模式不适合：

- start frame 和 end frame 已经人物或场景漂移。
- 两帧机位差异过大，但 prompt 只要求平滑运动。
- 两帧之间包含复杂动作、跨空间移动、转场、打斗或大幅运镜。
- 试图用 end frame 修正 start frame 中已有的 P0 错误。

Adapter 必须做的事：

- 同时保留 master start / master end。
- 为 provider 生成同尺寸 derivative，例如 `1280x720`。
- 检查 start / end 是否同一比例、同一目标像素尺寸。
- prompt 明确“use first image as exact start frame, second image as exact end frame”。
- prompt 只描述插值、微运动和保持项，不加入新的剧情信息。
- 如果首尾帧视觉差异过大，任务应回到 Image 2 修图，而不是提交视频。

## Prompt 结构

推荐顺序：

1. 明确使用图片作为起始帧。
2. 镜头运动只写一种主运动。
3. 主体动作只写一个连续动作。
4. 表演写情绪和身体细节，不写复杂剧情。
5. 明确保留人物、场景、构图、色彩、低纹理。
6. 明确禁止新增信息、改变空间方向、改变角色身份。
7. 明确音频策略：默认 `no background music, no BGM, no music track`。如果允许声音，只允许画面内合理环境声或声效。

首尾帧 prompt 推荐额外加入：

```text
Use the first image as the exact start frame and the second image as the exact end frame. Interpolate smoothly between them.
Keep the same person, clothing, scene layout, camera, lighting, color, and style. Only the described small action should change.
```

## 首尾稳定默认片段

Seedance 2.0 的图生视频和首尾帧视频可能出现开头重新锚定、结尾回弹、上下拉伸或尾帧 snap。v0.3 中任何正式视频任务都应默认加入首尾稳定约束。

推荐自然语言片段：

```text
Keep the frame stable throughout the shot. No vertical stretching, no elastic warp, no flicker, no scale rebound.
Strictly preserve the reference image composition, subject proportions, perspective, background structure, lighting, color, and low-texture cinematic style.
The action starts slowly, moves at an even speed, then slows down and holds steady before the end.
Hold the first composition steady at the beginning. Arrive at the final pose before the last half second, then hold steady.
Audio: no background music, no BGM, no music track. Allow only subtle diegetic ambience or sound effects if needed.
```

中文含义：

- 全程稳定，不要上下拉伸、弹性变形、闪烁或比例回弹。
- 严格保持参考图构图、人物比例、透视、背景结构、光线、色彩和低纹理电影感。
- 动作缓慢开始，匀速推进，结尾缓慢静止。
- 开头先稳住首帧，结尾提前抵达最终姿态并保持。
- 默认不生成 BGM，只允许画面内合理环境声或声效。

经验性标签：

```text
[stabilize:background:0.95]
[anchor_first:frame:0.95]
[sync_last:pose:0.9]
```

这些标签只能作为待验证的经验性 prompt 片段，不能作为 provider 的硬能力写死。Adapter 应优先使用自然语言约束；只有在实测确认某个接入渠道稳定识别这些标签后，才允许通过 provider-specific preset 启用。

## 音频策略

Seedance prompt 默认必须写：

```text
Audio: no background music, no BGM, no music track.
If audio is generated, allow only subtle diegetic ambience or sound effects that belong inside the scene.
```

原因：

- Vibe Director 的 BGM 应由独立 audio layer 统一生成、选择和混音。
- 视频模型自动加配乐会污染后续剪辑、配音和统一导出。
- 允许的声音应是可保留或可替换的场内声：雨声、脚步、门声、房间底噪、远处车声等。
- 如果 provider 支持关闭音频，应优先在参数层关闭音频；如果不支持，必须在 prompt 层禁止 BGM。

## 视频 QA

Seedance 输出必须检查：

- 第一帧是否承接 approved keyframe。
- 第一帧是否与 provider-ready keyframe 稳定对齐，开头是否有抽搐、缩放跳动或重新锚定。
- 人物身份、服装、场景是否漂移。
- 镜头运动是否符合 Motion Spec。
- 动作是否在当前镜头的故事功能内。
- 是否提前 reveal 后面才该出现的信息。
- 是否与前后镜头动作方向、空间轴线接得上。
- 是否出现水印、文字污染、异常手部或物体融化。
- 是否风格变成高纹理、广告片、游戏 CG 或 UI 示意图。
- 是否出现 BGM、配乐、音乐轨；如有，应标记为 P1，除非该镜头明确需要模型生成音乐。

首尾帧视频额外检查：

- 第一帧是否稳定承接 start frame。
- 最后一帧是否稳定抵达 end frame，而不是在中途改成第三种构图。
- 中间运动是否是连续插值，不是突然跳切、变脸或空间漂移。
- 如果出现开头抽动，先检查输入帧是否已经是 provider-ready 尺寸。
- 如果出现结尾上下拉伸、弹性形变或末帧抽动，优先判断为 end-frame convergence / endpoint snap：两帧虽然尺寸一致，但主体尺度、垂直位置、背景几何或机位差异过大，模型在最后几帧强行贴合尾帧。

结尾抽动的处理顺序：

1. 先确认 start / end 都是 provider-ready 同尺寸输入。
2. 如果尺寸和格式正常，回 Image 2 重新生成或编辑 end frame，缩小变化幅度。
3. end frame 必须保持相同 crop、相同眼线高度、相同主体大小、相同背景几何。
4. video prompt 增加：arrive at the final pose before the last half second, then hold steady; no vertical stretch, no elastic warp, no final-frame snap.
5. 如果动作变化确实较大，改用中间关键帧拆成两段视频，不要用一组首尾帧硬插值。

压力测试补充：

- 即使加入 `arrive at the final pose before the last half second` 和 `no final-frame snap`，结尾 snap 仍可能出现。
- 这说明 prompt 只能降低风险，不能作为硬保证。
- v0.3 应对 frames2video 输出自动抽取最后 12 帧，计算 frame-to-frame 差异；如果最后半秒出现异常峰值，标记 `tail_snap_risk`。
- 对 rough preview 可考虑自动裁掉最后 `0.2-0.3s`，或冻结最后稳定帧；这属于机械视频后处理，不应改变创意语义。
- 对正式素材，优先重做 end frame 或拆中间关键帧。

## 队列与任务状态

Seedance 2.0 不能按实时能力设计。

实际测试中，即使深夜，首尾帧任务也可能超过 CLI `--poll` 窗口，返回 `gen_status: querying` 后继续排队/生成；白天可能等待更久。Vibe Director 应把 Seedance 任务设计成后台 Job：

- 提交后立即生成 `submit_id` 并写入 manifest。
- UI 显示排队、生成中、成功、失败、可重试。
- 用户可以继续改分镜、资产和 prompt，不被视频任务阻塞。
- 任务完成后自动入库并标记对应 shot。
- 失败时保留输入帧、prompt、模型版本、错误原因，便于重试和复盘。

## 并发策略

2026-04-28 夜间 Dreamina CLI 探针结果：

- `seedance2.0` image2video：同一时间最多 1 条未完成任务。第二条会返回 `ExceedConcurrencyLimit`。
- `seedance2.0fast` image2video：同一时间最多 1 条未完成任务。第二条会返回 `ExceedConcurrencyLimit`。
- Fast 与非 Fast 看起来可能是不同通道：Fast 任务存在时，`seedance2.0` 仍能提交并进入 `Generating`。
- 不应把 provider 当作无限队列。Vibe Director 必须有本地调度器。

建议本地调度配置：

```yaml
provider_queues:
  dreamina.seedance2.i2v:
    concurrency: 1
    on_exceed_concurrency: requeue_with_backoff
  dreamina.seedance2fast.i2v:
    concurrency: 1
    on_exceed_concurrency: requeue_with_backoff
  dreamina.seedance2.frames2video:
    concurrency: 1
    status: needs_separate_probe
```

遇到 `ExceedConcurrencyLimit` 时，前端不要显示成镜头生成失败，而应显示为“等待前一个视频任务完成后自动继续”。

## 失败分流

| 问题 | 处理 |
|---|---|
| 运动太大 | 降低 motion intensity，重新 Seedance |
| 镜头方向错 | 重写 Motion Spec，重新 Seedance |
| 开头帧不承接关键帧 | 检查起始帧输入是否生效，必要时换接入模式 |
| 人物身份漂移 | 回 Image 2 修关键帧或重生，不在 Seedance 硬修 |
| 场景空间错 | 回 Spatial Memory / Shot Layout |
| 风格断裂 | 检查 Style Capsule 是否完整注入，降低参考污染 |
| 故事动作错 | 回 Shot Spec，不在视频 prompt 里补剧情 |

## 待开发时确认

这些项目必须在实际接入渠道确认：

- 当前使用的是 Runway、即梦、ByteDance API，还是其他封装。
- 支持的最大参考图数量、最大视频参考数量、是否支持音频参考。
- 是否支持首尾帧，首尾帧是否真的作为硬约束。
- 支持的分辨率、比例、时长、队列时长和失败返回。
- 是否支持 API 调用，还是必须通过 CLI / browser / 第三方平台。
- 输出是否含音频，音频是否可关闭。
- 失败原因是否可解析，用于自动重试和 QA。

## 参考来源

- Runway Seedance 2.0 guide: https://help.runwayml.com/hc/en-us/articles/50488490233363-Creating-with-Seedance-2-0
- ByteDance Seedance 2.0 official page: https://seed.bytedance.com/en/seedance2_0
- Seedance 2.0 model card / arXiv: https://arxiv.org/abs/2604.14148
