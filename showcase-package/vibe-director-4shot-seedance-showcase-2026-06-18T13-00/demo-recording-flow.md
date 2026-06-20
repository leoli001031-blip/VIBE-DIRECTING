# Demo Recording Flow

建议录制时不要从技术细节开始，先展示结果，再倒回项目链路。

## 1. 开场结果

打开：

`04-generated-videos/combined_4shot_preview.mp4`

说法可以很轻：

> 这是一个由 Vibe Director 拆分并提交给 Seedance 的 4 镜头小项目。每一段都是独立生成的，不是一次性塞一个长 prompt。

## 2. 展示四镜头缩略图

打开：

`06-thumbnails/four_shot_contact_sheet.png`

重点：

- 四个镜头有连续叙事。
- 每个镜头承担一个动作节点。
- 不是平均时长乱切，而是按镜头功能拆开。

## 3. 展示参考资产

打开：

`02-reference-assets/`

顺序：

1. 场景参考
2. 角色参考
3. 道具参考

重点：

> 这里不是把所有图片都当成同一种参考，而是让模型知道每张图负责什么。

## 4. 展示 Prompt 编译

打开：

`03-seedance-prompts/shot_2_seedance_prompt.md`

重点：

- 明确 visible clip 数量。
- 明确 Image 1/2/3 的职责。
- 明确 no BGM / no subtitle / no artifact。
- 镜头动作保持单一，不让 4 秒段承载太多动作。

## 5. 展示真实回执

打开：

`05-receipts/`

重点：

> 这些不是 mock 数据，是实际提交 Seedance 后保存下来的 submit/query 回执。

## 6. 收束

最后回到合并视频，说明它只是预览：

> 真正适合创作管理的是四个独立片段，因为每一段都可以重新生成、替换或进入剪辑。
