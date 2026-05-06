# Visual Memory Reference Authority

用途：给角色、场景、道具和风格参考图建立最小权威规则，防止失败图污染后续生成。

## Reference states

- `locked`：已经通过视觉 QA，可作为正向 reference。
- `candidate`：可比较、可讨论，但不能默认进入后续正向 reference。
- `rejected`：只保留失败原因，禁止作为正向 reference。
- `temp`：worker 临时结果，必须整理命名、入库、QA 后才可升级。

## Authority rules

- 角色 identity、主场景、关键道具和片子总体风格都必须有各自的权威来源。
- 同一资产只能有一个当前 `locked` reference；新候选替换前要保留替换理由。
- 失败图、漂移图、污染图只能用于 negative note 或 regression evidence。
- 不要把“看起来还不错”的失败图混入正向参考池。

## Image2 checkpoint

- Image 2 reference/edit 任务必须携带真实图片附件或 provider 可读取的图片 payload。
- 只在 prompt 里写 path、文件名、描述文字，不等于传入 reference image。
- 发送前检查：附件存在、状态不是 `rejected/temp`、assetId 与用途匹配。
