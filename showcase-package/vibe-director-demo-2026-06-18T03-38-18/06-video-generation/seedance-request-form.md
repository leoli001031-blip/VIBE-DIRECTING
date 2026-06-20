# Seedance 2.0 Request Form

这一页把真实发给 Seedance 2.0 的请求拆成人能看懂的形式。

## Provider

- 模型：`seedance2.0_vip`
- 分辨率：`720p`
- 比例：`16:9`
- 时长：`6s`
- 模式：`全能参考 / omni_reference`
- 并发：`1`
- BGM：不使用

## Reference Images

| 顺序 | 角色 | 文件 | 说明 |
|---:|---|---|---|
| Image 1 | scene_reference | `../04-reference-assets/scene-rain-street.png` | 地点、天气、光线、色温 |
| Image 2 | character_reference | `../04-reference-assets/character-girl.png` | 女孩身份、发型、服装轮廓 |
| Image 3 | prop_reference | `../04-reference-assets/prop-glowing-ticket.png` | 发光车票外观和交互尺度 |

## Prompt

完整 prompt：

`../05-storyboard-and-prompts/seedance_prompt.md`

摘要：

```text
全能参考 video request.
Use the attached references and written direction only.
Create exactly 1 continuous visible clip.
Total duration: 6s.
Use Image 1 only as environment reference.
Use Image 2 only as character identity reference.
Use Image 3 only as object appearance reference for 发光车票.
No music, no BGM, no subtitles.
```

## Submit Result

- submitId：`7502840c-8110-488a-ab17-4394075a2ae7`
- 当前状态：`dreamina query_result` 确认 `gen_status=querying`，队列状态 `Generating`
- 队列位置：`queue_idx=0`，`queue_length=0`
- 本地视频：尚未回流
- 最近查询时间：2026-06-18 12:35 CST
- 说明：旧 submitId `8c00dfe3-f5a8-41d1-9ba5-460d5af223c0` 的 receipt 里出现过 `context deadline exceeded`，本页记录的是重新提交后的新任务。

查询命令：

```bash
dreamina query_result --submit_id=7502840c-8110-488a-ab17-4394075a2ae7 --download_dir="/Users/lichenhao/Desktop/new vibe directing/.vibe-runtime/browser-projects/project-1781737355707/video/seedance_resubmit_2026-06-18T04-31-50-3NZ/video"
```

## Receipts

- `input-manifest.json`
- `dreamina-submit.json`
- `dreamina-resume-query.json`
- `seedance-submit-report.json`
- `seedance-resume-report.json`
- `video_relay_queue.json`
- `seedance-resubmit-2026-06-18T04-31-50-3NZ/dreamina-resubmit.json`
