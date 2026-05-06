# Keyframe Pair Action Continuity

用途：为 start/end frame 和图生视频任务提供最小动作连续性规则。

## Pair derivation

- 同一镜头的 `endFrame` 默认从 `startFrame` 派生，不从空白文生图开始。
- 只有动作结果、表情变化、手部位置、道具状态或镜头运动终点可以变化。
- 背景、身份、服装、主道具和场景透视默认继承 start frame。

## Action range

- 动作幅度要适合镜头时长：短镜头用小幅变化，长镜头才允许明显位移。
- 复杂动作拆成多个 keyframe pair，不把多个动作压进一条视频 prompt。
- end frame 应表达动作终点，不写成另一个无关构图。

## Seedance readiness

- Seedance 主路径使用 image-to-video：start image 必须存在，end image 按需提供。
- video prompt 只描述画面运动、主体动作和相机运动；不要写 BGM、配乐、旁白生成要求。
- 禁止把 text-to-video 当作关键帧缺失时的主路径兜底。
