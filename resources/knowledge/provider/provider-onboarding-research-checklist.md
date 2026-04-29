# Provider Onboarding Research Checklist

更新时间：2026-04-28

用途：未来增加任何图片、视频、TTS、音乐或本地生成模型前，先用这份清单做搜索和验证。目标是避免“看起来都能生成视频”，但实际开发时发现控制能力、输入格式、时长、成本和失败模式完全不同。

## 搜索优先级

1. 官方产品文档。
2. 官方 API reference / SDK 文档。
3. 官方 model card / technical report / changelog。
4. 官方 help center 或 cookbook。
5. 可复现实例仓库。
6. GitHub issue / community case。
7. 第三方博客和榜单。

Codex 内置网页搜索和 Tavily 都只是检索渠道，不是事实来源。事实必须回填到官方或可复现来源上。

## 新 provider 必填字段

```yaml
provider_id:
provider_name:
model_name:
model_version:
checked_at:
source_urls:
  - official_docs:
  - api_reference:
  - model_card:
  - examples:
commercial_status:
  api_available:
  cli_available:
  web_only:
  region_constraints:
  account_requirements:
  price_model:
task_types:
  image_generate:
  image_edit:
  image_to_video:
  text_to_video:
  video_edit:
  tts:
  music:
  local_postprocess:
inputs:
  text_prompt:
  reference_images:
  max_reference_images:
  start_frame:
  end_frame:
  video_reference:
  audio_reference:
  mask:
  bbox:
  depth:
  pose:
  canny:
  storyboard_grid:
  character_asset:
outputs:
  media_type:
  formats:
  duration_seconds:
  fps:
  resolutions:
  aspect_ratios:
controls:
  seed:
  camera_motion:
  subject_motion:
  style_reference:
  identity_reference:
  spatial_control:
  negative_prompt:
  batch:
job_lifecycle:
  sync_or_async:
  polling:
  webhook:
  cancel:
  retry:
  error_codes:
asset_handling:
  upload:
  remote_url:
  local_file:
  output_expiration:
  metadata:
quality_and_risk:
  known_strengths:
  known_failures:
  moderation_behavior:
  cost_risk:
  latency_risk:
adapter_plan:
  prompt_compiler_mapping:
  validation_rules:
  qa_rules:
  fallback_strategy:
  minimal_test_cases:
```

## 必问问题

- 这个模型是生成图片、编辑图片、图生视频、文生视频、视频编辑，还是音频？
- 它是否支持参考图？参考图是风格参考、主体参考、首帧，还是普通灵感参考？
- 它是否支持首尾帧？如果支持，是硬约束还是弱约束？
- 它是否支持 bbox、pose、depth、canny、ControlNet 这类空间控制？
- 它的输入是否会和 prompt 冲突？冲突时哪一个优先？
- 它能不能锁定角色身份？是靠图片、视频角色资产，还是 prompt？
- 它能不能锁定场景空间？是靠参考图、首帧、深度图，还是做不到？
- 它的时长、分辨率、比例、fps 和文件大小限制是什么？
- 它的输出是否自带音频？音频能否关闭？
- 它的 API 是同步还是异步？失败结果能不能结构化读取？
- 它适合批量生成吗？成本和排队时间是否可接受？
- 失败后应该回到哪个上游环节：Shot Spec、Image 2、Seedance、TTS，还是本地工具？

## 开发接入流程

1. 完成 provider research record。
2. 填入 `model-capability-matrix.md`。
3. 新增 adapter schema。
4. 新增 task validator。
5. 新增 prompt compiler mapping。
6. 新增 QA rule 和 failure routing。
7. 写 3 个最小测试任务：
   - 成功路径。
   - 输入不合法阻断。
   - 典型失败分流。
8. PRD 更新“支持范围”和“不能做什么”。

## v0.3 预留模型

优先预留但不默认启用：

- OpenAI future video API：只有在 OpenAI 发布新的、未弃用的官方视频 API 后才进入候选；Sora 2 不作为未来后端预留。
- 注意：OpenAI 官方 Help Center 在 2026-04-28 查询时显示 Sora web / app 已于 2026-04-26 停用，Sora API 将在 2026-09-24 停用。未来如果要接 OpenAI 视频模型，必须重新确认新的官方模型、API 和迁移路径，而不能按 Sora 2 方案开发。
- 即梦 / Dreamina / Jimeng：如果接入国内工作流，需要单独确认 CLI、API、账号和水印限制。
- Runway Gen 系列：可作为 Seedance 之外的视频后端候选。
- ComfyUI：可作为结构控制、ControlNet、Pose、Depth、局部工作流的本地或半本地后端。
- Kling、Wan、Hunyuan、FramePack：作为视频后端候选，必须先验证首尾帧、身份一致性和 API 可用性。
