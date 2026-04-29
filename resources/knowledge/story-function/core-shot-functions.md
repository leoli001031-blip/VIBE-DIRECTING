# Core Shot Function Pack

用途：把每个镜头的叙事功能写清楚。Vibe Director 判断一个镜头是否可用，不能只看画面好不好看，还要看它是否完成 `story_function`。

## 镜头功能表

| 功能 | 中文解释 | 常见镜头策略 |
|---|---|---|
| establish | 建立空间、人物和情境 | wide / locked / slow reveal |
| orient | 让观众知道人物在哪里、往哪走 | wide + spatial anchors |
| isolate | 把人物从环境或他人中隔离 | negative space / long lens / locked |
| reveal | 揭示新信息 | pan / tilt / rack focus / dolly out |
| conceal | 隐藏关键信息 | foreground obstruction / back angle / frame within frame |
| emphasize | 强调道具或表情 | insert / close-up / rack focus |
| react | 展示人物反应 | close-up / held shot |
| transition | 从一个空间或情绪过渡到另一个 | match cut / movement continuation |
| escalate | 提高紧张感 | slow push in / tighter framing / shorter cuts |
| release | 释放压力 | wider frame / warmer light / slower hold |
| misdirect | 让观众误以为重点在 A | offscreen sound / selective focus |
| payoff | 回收前面埋的信息 | repeat composition / reveal changed state |
| anchor | 稳定空间或关系 | repeated angle / same camera setup |
| suspense_beat | 在揭示前延迟半拍 | held close-up / offscreen sound |
| false_resolution | 假装问题解决，随后反转 | warm light then abrupt contrast cut |
| callback | 呼应前面某个镜头 | repeated composition / changed detail |
| information_delay | 延迟提供关键信息 | obstruction / shallow focus / partial reveal |

## ShotSpec 示例

```yaml
story_function: reveal
function_detail: 通过玻璃门反光第一次暗示门外有人，但不直接展示对方
recommended_strategy:
  shot_size: medium
  composition: frame within frame
  motion: slow pan right
  focus: rack focus from her hand to the reflection
qa:
  - 是否真的揭示了新信息
  - 是否没有提前展示后面才该出现的信息
  - 是否能接上前后镜头
```

## QA 规则

- 画面漂亮但没有完成镜头功能，不能通过。
- 如果相邻两个镜头功能重复，应提示合并或重写其中一个。
- 插入、移动、删除镜头后，必须重算 story_function。
- reveal、payoff、callback 需要检查前后镜头关系。
