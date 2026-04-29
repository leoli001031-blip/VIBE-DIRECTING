# Provider API Extension Slots

更新时间：2026-04-28

用途：给未来新增生图模型、图像编辑模型、图生视频模型、文生视频模型、TTS、音乐生成和本地工作流预留统一 API 口。

## 设计原则

1. 前端不直接调用具体模型 API。
2. Story Flow 不保存 provider 私有参数。
3. 所有模型都通过 `GenerationAdapter` 接入。
4. UI 只表达创作意图，adapter 负责把意图翻译成模型参数。
5. 新模型默认先作为候选 provider，不直接替换主路径。

## 预留 Provider 类型

| Slot | 用途 | v0.3 默认 | 未来候选 |
|---|---|---|---|
| `image.generate` | 生成关键帧、资产参考、风格参考 | `openai-image2-codex-cli` / `openai-image2-api` | 即梦图片、Runway Image、Flux、其他图片 API |
| `image.edit` | 对关键帧做语义编辑 | `openai-image2-api` | 其他支持局部编辑或参考编辑的图片模型 |
| `image.reference_asset` | 生成角色、场景、道具主参考 | `openai-image2-api` | 即梦图片、Flux、ComfyUI 工作流 |
| `video.i2v` | 已批准关键帧转视频 | `seedance2-provider` | 即梦视频、Runway、Kling、Wan、Hunyuan、其他 I2V API |
| `video.t2v.experimental` | 文生视频探索 | 默认关闭 | 任何未来视频模型，但只用于低风险探索 |
| `video.extend` | 延长已有片段 | 暂不启用 | 支持 video extension 的后端 |
| `video.edit` | 视频局部修改或风格迁移 | 暂不启用 | 支持 video-to-video 的后端 |
| `audio.tts` | 配音和旁白 | 预留 | OpenAI TTS、ElevenLabs、国内 TTS、用户自定义音源 |
| `audio.music` | BGM 和氛围音乐 | 预留 | 音乐生成 API、素材库、用户上传 |
| `local.postprocess` | 本地转码、拼接、轻量处理 | `ffmpeg` | OpenCV 仅限轻量格式/尺寸/纹理处理 |
| `local.workflow` | 本地可控工作流 | 暂不启用 | ComfyUI、ControlNet、Depth、Pose 工作流 |

## Provider Registry 配置形态

```yaml
providers:
  image.generate:
    active: openai-image2-codex-cli
    fallback:
      - openai-image2-api
    candidates:
      - future-image-api

  image.edit:
    active: openai-image2-api
    fallback: []
    candidates:
      - future-image-edit-api

  video.i2v:
    active: seedance2-provider
    fallback: []
    candidates:
      - future-video-i2v-api
      - future-runway-api
      - future-jimeng-api
      - future-kling-api

  video.t2v.experimental:
    active: null
    enabled_by_default: false
    candidates:
      - future-video-t2v-api
```

## Adapter 最小契约

```ts
type GenerationSlot =
  | "image.generate"
  | "image.edit"
  | "image.reference_asset"
  | "video.i2v"
  | "video.t2v.experimental"
  | "video.extend"
  | "video.edit"
  | "audio.tts"
  | "audio.music"
  | "local.postprocess"
  | "local.workflow"

interface GenerationAdapter {
  providerId: string
  slot: GenerationSlot
  validate(task: GenerationTask): ValidationResult
  compile(task: GenerationTask): ProviderRequest
  run(request: ProviderRequest): Promise<GenerationResult>
  parseResult(raw: unknown): GenerationResult
}
```

## 新模型默认状态

任何新模型刚接入时默认是：

```yaml
status: candidate
enabled_by_default: false
allowed_usage:
  - manual_test
  - low_risk_experiment
not_allowed_usage:
  - approved_keyframe_replacement
  - main_character_shot
  - story_critical_shot
```

只有通过项目内 QA 和最小回归测试后，才能提升为：

```yaml
status: production_candidate
enabled_by_default: user_configurable
```

## 关键提醒

- 预留 API 口不是把所有模型都塞进 UI。
- 默认用户只看到“生成关键帧”“生成视频”“修这张图”这类自然语言动作。
- provider 的选择、失败重试、fallback 和参数映射都应该在后台完成。
- 新模型能力更强时，平台应该变得更稳，而不是让用户看到更多复杂选项。
