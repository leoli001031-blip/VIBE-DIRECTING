# 视频生成状态

- 队列状态：已重新提交，CLI 查询确认正在生成
- 最大并发：1
- 当前 active：seedance_segment_1
- submitId：7502840c-8110-488a-ab17-4394075a2ae7
- 当前段：雨夜偶遇发光车票
- 模型：seedance2.0_vip
- 分辨率：720p
- 本地视频：尚未回流
- 最近查询：2026-06-18 12:35 CST，`dreamina query_result` 返回 `gen_status=querying`，`queue_status=Generating`，`queue_idx=0`，`queue_length=0`
- 备注：旧提交 `8c00dfe3-f5a8-41d1-9ba5-460d5af223c0` 曾出现 `context deadline exceeded`，本轮已用新 submitId 重新提交。

队列约束：当前最多只有 1 个 active 视频任务。已有 submitId 时，后续动作应优先查询结果，不要盲目重复提交。

查询方式：

```bash
dreamina query_result --submit_id=7502840c-8110-488a-ab17-4394075a2ae7 --download_dir="/Users/lichenhao/Desktop/new vibe directing/.vibe-runtime/browser-projects/project-1781737355707/video/seedance_resubmit_2026-06-18T04-31-50-3NZ/video"
```

账号校验：

```text
CLI user_id: 2634027890908296
VIP: maestro
```
