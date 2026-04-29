# Image 2 Provider Pack

更新时间：2026-04-28

目标：把 `gpt-image-2 / Image 2` 定义成 Vibe Director 的关键帧和资产生成后端，而不是让每个 subagent 自由写 prompt。

## 当前定位

Image 2 在 v0.3 中负责：

- 生成主角参考图。
- 生成场景参考图。
- 生成正式关键帧候选。
- 对已生成关键帧做语义图像编辑。
- 在必要时生成干净的风格参考和构图参考。

Image 2 不负责：

- 生成视频运动。
- 判断镜头时长。
- 修复已经视频化后的复杂语义错误。
- 替代 Story Flow / Shot Spec 做剧情判断。
- 靠一句“保持一致”长期维持项目风格。

## 当前已确认能力

OpenAI 官方 Image API 支持从文本生成图片，也支持对已有图片进行整体或局部编辑。Responses API 可以把图像生成放进多轮流程，并接受图像输入输出。Codex CLI 也支持在 CLI 中直接请求图像生成或编辑，内置图像生成使用 `gpt-image-2`。

对 Vibe Director 的意义：

- v0.3 可以先通过 Codex CLI 的 `$imagegen` 或自然语言图像生成能力执行小批量关键帧。
- 批量生成、可计费追踪和生产级稳定性应预留 OpenAI API adapter。
- 无论走 Codex CLI 还是 API，前端都只认 `ImageGenerationAdapter`，不直接认具体调用方式。

## Prompt Compiler 输入

Image2 prompt 必须从以下结构编译：

```yaml
shot_id: "03_04"
task_type: image_generate | image_edit | asset_reference
story_function: "主角第一次发现异常"
shot_spec:
  subject: "林安"
  action: "停在餐厅门口，低头看见地上的水迹"
  emotion: "犹豫、警觉"
visual_memory:
  character_refs:
    - "lin_an_main_ref_v001.png"
  scene_refs:
    - "empty_restaurant_ref_v002.png"
spatial_memory:
  scene_anchor: "餐厅入口在画面左后方，吧台在右侧"
shot_layout:
  camera_position: "门外略低机位"
  subject_position: "画面中偏左，半身"
  object_position: "水迹在前景右下"
style_capsule:
  visual_tone: "冷色、克制、低纹理、真实电影感"
must_preserve:
  - "林安的脸、发型、服装"
  - "餐厅空间结构"
  - "低纹理、不过度锐化"
must_avoid:
  - "赛博朋克霓虹"
  - "夸张 HDR"
  - "新角色"
```

## Prompt 结构

推荐顺序：

1. 镜头功能：这张图在故事里要完成什么。
2. 场景和空间：主体在哪，前景/中景/背景分别是什么。
3. 人物和动作：谁、姿态、视线、手和身体关系。
4. 构图和镜头：景别、机位、透视、焦点。
5. 光线和色彩：情绪、光源、色彩倾向。
6. 风格约束：低纹理、电影感、真实度、不要广告片。
7. 保留项和禁止项：尤其是参考图、人物身份、场景结构。

## 首尾帧生成

首尾帧不是两张独立插画，而是一段视频运动的两个稳定锚点。

推荐流程：

1. 先生成并批准 `start_keyframe`。
2. 生成 `end_keyframe` 时必须把 `start_keyframe` 作为图像参考输入。
3. prompt 中先写“必须完全保持不变”的部分，再写“只允许变化”的部分。
4. 变化只允许是一个小状态：手的位置、视线、身体前倾、道具开合、角色向窗边靠近一点。
5. 不允许同时改变人物身份、服装、场景、机位、镜头方向、时间、光线和构图。
6. end frame 生成后必须先 QA，通过后再交给视频模型。

首尾帧 prompt 应拆成两段：

```text
Preserve exactly: same person, face, hair, clothing, scene layout, camera position, framing, lens feel, lighting, color palette, and low-texture restrained realism.

Change only: 3-4 seconds later, her right hand has slowly settled onto the window frame, and her expression is slightly more resolved.
```

如果 end frame 已经漂移，不要把它交给 Seedance 硬插值。先回 Image 2 重生或编辑，否则视频模型只会在两个错误锚点之间做平滑变形。

## 关键 QA

生成后必须检查：

- 是否完成当前镜头功能。
- 人物身份是否与 Visual Memory 一致。
- 场景空间是否与 Spatial Memory 一致。
- 主体位置是否符合 Shot Layout。
- 是否出现过重纹理、过度锐化、AI 塑料感。
- 是否新增不该出现的道具、人物、文字或信息。
- 放回前后镜头是否成立。
- 如果是 end frame：是否与 start frame 保持同一人物、同一空间、同一机位、同一光线、同一风格，只发生一个小状态变化。

## 修改和插入分镜的风险

压力测试结论：改图比新生图更容易出现“看起来更合理但违背用户要求”的漂移。

典型问题：

- 用户只要求改变情绪，模型偷偷新增手机、杯子、人物或文字。
- 用户要求插入一个因果镜头，模型生成了风格相近但故事功能不够明确的画面。
- 参考图可以维持风格和空间气质，但不等于锁死人物身份。
- Image 2 输出尺寸可能不是目标生产尺寸，例如 `1672x941`，必须再生成 provider-ready derivative。

修改任务必须显式拆分：

```yaml
allowed_delta:
  - "只改变视线、姿态和轻微表情"
must_preserve:
  - "同一人物身份"
  - "同一服装"
  - "同一机位和构图"
  - "同一桌面道具"
must_not_add:
  - "手机"
  - "新人物"
  - "可读文字"
  - "新光源"
  - "新场景"
```

如果是插入新分镜，prompt 必须包含：

- 插入位置：位于哪两个 shot 之间。
- 镜头功能：它为什么存在，补充什么因果或情绪。
- 前后连续性：上一镜头如何接进来，下一镜头如何接出去。
- 资产绑定：使用哪些角色、场景、道具、风格参考。

QA 必须额外检查：

- 新增物体是否是用户明确要求的。
- 插入镜头是否真的补足故事，而不是只多了一张好看的图。
- 修改镜头是否只改变 allowed delta。
- 输出是否需要标准化尺寸后才能交给 Seedance。

## 长片段批量关键帧生成风险

Act I 图片压力测试结论：Image 2 可以在明确参考锚点下生成 6 张连续关键帧。这个结果支持 Vibe Director 做整幕、全片或 100+ 张关键帧的批量生成，但 Codex CLI worker 路径不能被设计成不可见的大黑箱。

观察结果：

- 4 张参考锚点 + 6 个镜头一次生成可以跑通。
- 输出可能先是 `1672x941`，必须标准化到项目尺寸和 provider-ready 尺寸。
- 前 4 张角色和场景连续性较好，后段远景/门口镜头更容易隐藏或暴露身份漂移。
- Codex CLI worker 中间进度反馈弱，最终显示 token 用量很高，实测约 `120,053` tokens。

默认执行建议：

- 关键帧生成也走本地队列。
- 用户可以一次发起整幕、全片或 100+ 张生成意图。
- 系统内部按 2-5 张一组拆分，按场景、动作连续段或故事功能连续段执行。
- 每批结束立刻生成 contact sheet、尺寸报告和轻量 QA。
- 前端必须显示进度和当前阶段，避免用户误以为 Codex 没有工作。
- 如果某批出现人物、场景、风格漂移，应暂停后续批次并修复当前批次，不能让错误参考继续扩散。

批量生成的一致性优先级高于速度。

Image 2 批量任务必须绑定：

- `character_anchor`：核心人物参考。
- `scene_anchor`：当前场景参考。
- `style_capsule_version`：全片或当前段落风格版本。
- `spatial_memory_version`：场景空间关系版本。
- `approved_neighbor_refs`：已通过 QA 的相邻镜头。

禁止使用未验收的 draft / failed / temporary image 作为后续批次参考。

## 失败分流

| 问题 | 处理 |
|---|---|
| 轻微纹理过重 | 可考虑轻量后处理，但不得改变语义 |
| 人物身份漂移 | 重生或图像编辑，不能靠 OpenCV 修 |
| 服装错 | 重生或图像编辑 |
| 场景视角错 | 回到 Shot Layout / Spatial Memory 后重生 |
| 风格偏移 | 检查 Style Capsule 和参考图污染，再重生 |
| 构图主体位置错 | 编译更明确的空间描述后重生 |
| 与相邻镜头接不上 | 先修 Shot Spec / Shot Layout，再重生 |

## 待开发时确认

这些项目必须在实际开发 adapter 前重新验证：

- Codex CLI `$imagegen` 的批量生成限制、输出路径和失败报告格式。
- OpenAI API `gpt-image-2` 在目标账号中的可用性、价格、速率限制和组织验证要求。
- 当前可用尺寸、质量档位、最大参考图数量、mask 支持方式。
- Codex CLI 路径和 API 路径是否能共享同一 prompt compiler。
- 是否需要把大批量生成默认切到 API，而不是 Codex CLI 内置生成。

## 参考来源

- OpenAI Image Generation API: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI GPT Image prompting guide: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- OpenAI Codex CLI features: https://developers.openai.com/codex/cli/features
