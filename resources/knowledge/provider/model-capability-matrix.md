# Provider Model Capability Matrix

更新时间：2026-04-28

用途：记录每个生成后端到底能做什么、不能做什么、需要哪些输入，以及 Vibe Director 应该如何把 `Shot Spec`、`Visual Memory`、`Spatial Memory` 和 `Shot Layout` 编译成不同 provider 可执行的任务。

核心原则：

1. `Shot Layout` 不直接等于 prompt。
2. `Shot Spec` 是创作意图源，provider prompt 是派生产物。
3. 每个模型都必须经过 adapter 编译，不能让 UI、Story Flow 或 subagent 直接假设某个模型支持 bbox、参考图、首尾帧、角色资产或镜头控制。
4. v0.3 主路径只把 `gpt-image-2 / Image 2` 和 `Seedance 2.0` 当作生产级核心后端。
5. 新增模型前必须先补完 `provider-onboarding-research-checklist.md`，再进入开发。

## 当前 v0.3 后端

| Provider | 当前角色 | 输入 | 输出 | 适合做 | 不适合做 | 必查限制 |
|---|---|---|---|---|---|---|
| `gpt-image-2 / Image 2` | 关键帧、资产参考、语义图像编辑 | 文本 prompt、参考图、编辑图、必要时 mask | 图片 | 角色主参考、场景主参考、关键帧、局部语义编辑、风格统一 | 视频运动、镜头时长、真实连续动作、已经生成视频的语义修复 | 尺寸、质量档位、参考图数量、编辑能力、Codex CLI 与 API 路径差异 |
| `Seedance 2.0` | 已批准关键帧的视频化 | 文本、图片、视频、音频输入；v0.3 主要用图片到视频 | 视频，可能带音频 | 把关键帧变成 5-15 秒镜头、应用运镜、角色表演、灯光和动作 | 修复人物身份、服装、场景空间、故事逻辑；正式主线文生视频；自动生成 BGM | 时长、比例、分辨率、参考图数量、首尾帧模式、平台限制、是否可关闭音频 |
| `FFmpeg / local media tools` | 预览、拼接、转码、波形和缩略图 | 图片、视频、音频、时间线 manifest | 预览视频、导出素材 | 轻量转码、统一尺寸、批量导出、实时预览 | 创意语义修复、人物一致性修复、场景重绘 | 编码、帧率、色彩空间、音频采样率 |
| TTS provider | 配音 | 旁白、对白、音色 ID、情绪标记 | 音频 | 生成旁白、角色对白、临时配音 | 决定故事内容、替代演员表演设计 | 语言、音色授权、情绪控制、时长、API 限额 |
| Music provider | BGM / 氛围音乐 | 音乐描述、情绪、时长、节奏 | 音频 | 背景音乐、氛围声床、临时 demo | 精确影视混音、声音版权托管 | 时长、loop、stem、商用许可、API 限额 |

## 预留 API Slot

未来新增模型时，先挂到 slot，不直接改 UI。

| Slot | 说明 | 主路径状态 |
|---|---|---|
| `image.generate` | 生图、关键帧、资产参考 | v0.3 启用 |
| `image.edit` | 图像语义编辑、局部修改 | v0.3 启用 |
| `image.reference_asset` | 角色、场景、道具参考资产 | v0.3 启用 |
| `video.i2v` | 图生视频，从 approved keyframe 出发 | v0.3 启用 |
| `video.t2v.experimental` | 文生视频探索 | 默认关闭 |
| `video.extend` | 视频延长 | 预留 |
| `video.edit` | 视频编辑、视频风格迁移 | 预留 |
| `audio.tts` | 配音和旁白 | 预留 |
| `audio.music` | BGM 和氛围音乐 | 预留 |
| `local.workflow` | ComfyUI / ControlNet / Depth / Pose 等本地工作流 | 预留 |

详细接口见 `provider-api-extension-slots.md`。

## Provider Adapter 需要输出的能力字段

每个 provider 必须声明：

```yaml
provider_id: openai-gpt-image-2
version_checked_at: "2026-04-28"
task_types:
  - image_generate
  - image_edit
supported_inputs:
  text_prompt: true
  reference_images: true
  mask: provider_specific
  start_frame: false
  end_frame: false
  video_reference: false
  audio_reference: false
controls:
  aspect_ratio: true
  exact_resolution: true
  duration_seconds: false
  camera_motion: prompt_only
  bbox_or_layout: prompt_only
  controlnet: false
  seed: unknown_or_unavailable
output:
  media_type: image
  formats:
    - png
    - jpeg
known_failure_modes:
  - style_drift
  - identity_drift
  - over_texture
  - reference_pollution
source_priority:
  - official_docs
  - model_card
  - api_reference
  - verified_project_tests
```

## 当前推荐编译路径

### Image 2

```text
Shot Spec
-> Visual Memory
-> Spatial Memory
-> Shot Layout
-> Style Capsule
-> Image2 Prompt Compiler
-> Image2 Adapter
-> Candidate Keyframe
-> Image QA
-> Story / Continuity QA
-> Approved Keyframe
```

### Seedance 2.0

```text
Approved Keyframe
-> Motion Spec
-> Camera Movement Pack
-> Provider Capability Check
-> Seedance Adapter
-> Candidate Video
-> Video QA
-> Preview / Export
```

## 未来模型接入原则

新增 OpenAI future video API、即梦、Runway Gen、Kling、ComfyUI、Wan、Hunyuan、FramePack 等后端时，不能只新增一个 prompt 模板。必须新增：

- provider capability entry
- provider API slot
- provider onboarding research record
- adapter 输入输出 schema
- task validator
- prompt compiler mapping
- QA failure routing
- 最小回归测试样例

## 参考来源

- OpenAI Image Generation API: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI GPT Image prompting guide: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- OpenAI Codex CLI features: https://developers.openai.com/codex/cli/features
- OpenAI Sora discontinuation notice: https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation
- Runway Seedance 2.0 guide: https://help.runwayml.com/hc/en-us/articles/50488490233363-Creating-with-Seedance-2-0
- ByteDance Seedance 2.0 official page: https://seed.bytedance.com/en/seedance2_0
- Seedance 2.0 model card / arXiv: https://arxiv.org/abs/2604.14148
