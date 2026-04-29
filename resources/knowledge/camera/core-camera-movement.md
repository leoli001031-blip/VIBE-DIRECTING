# Core Camera Movement Pack

用途：把用户的运镜自然语言翻译成 Seedance 2.0 motion prompt、Shot Layout 字段和 QA 标准。

运镜描述必须包含：

```yaml
movement_type: 运动类型
direction: 方向
speed: 速度
relationship_to_subject: 和主体的关系
start_end: 起点和终点
stability: 稳定 / 手持 / 漂浮
purpose: 这个运动在故事里的作用
```

## 1. Locked Camera / 静止机位

含义：摄影机固定不动，主体或环境在画面内变化。

适合：压抑、观察、等待、现实主义、降低 AI 视频漂移。

Prompt：

```text
locked camera, the frame remains still, only the subject makes a subtle movement
```

QA：

- 镜头是否真的没有明显漂移。
- 主体是否没有被模型强行推近或转场。

## 2. Slow Push In / Dolly In / 慢慢靠近

含义：摄影机向主体移动，透视会变化。不要和 zoom 混淆。

适合：情绪加重、角色意识到某事、观众被拉近角色内心。

Prompt：

```text
very slow dolly in toward the subject, the camera physically moves closer while preserving composition and identity
```

QA：

- 是否有真实靠近感，而不是裁切放大。
- 人物脸是否没有变形。
- 背景透视是否稳定。

## 3. Pull Back / Dolly Out / 慢慢远离

含义：摄影机远离主体，空间变大，人物变小。

适合：孤独、失落、角色被环境吞没、揭示更大空间。

Prompt：

```text
slow dolly out, the camera gently pulls away from the subject, revealing more of the empty surrounding space
```

QA：

- 空间是否合理揭示。
- 主体是否没有身份漂移。

## 4. Pan Left/Right / 横摇

含义：摄影机位置不动，镜头水平转向。

适合：从一个主体转到另一个主体、揭示画面外信息。

Prompt：

```text
slow pan right, the camera pivots from the subject toward the glass door, revealing the reflection outside
```

QA：

- 是否只是水平转向，不是平移穿越空间。
- reveal 的目标是否正确出现。

## 5. Tilt Up/Down / 俯仰

含义：摄影机位置不动，镜头向上或向下转。

适合：从手/脚/道具揭示到脸，从人物揭示建筑或天空。

Prompt：

```text
slow tilt up from her hands gripping the umbrella handle to her face, preserving the same lighting and framing style
```

QA：

- 是否是垂直转向，不是飞起来。
- 终点是否落在正确主体上。

## 6. Tracking / Follow / 跟拍

含义：摄影机跟随主体移动，和主体保持相对距离。

适合：角色走路、进入新空间、主观陪伴感、连续动作。

Prompt：

```text
the camera follows behind the subject at walking speed, keeping her in the center-left of the frame as she moves down the corridor
```

QA：

- 主体是否稳定。
- 背景空间是否连续。
- 摄影机速度是否和角色动作匹配。

## 7. Truck Left/Right / 横移

含义：摄影机整体向左或右移动，和 pan 不同，透视会改变。

适合：视差、平行跟随、展示空间层次。

Prompt：

```text
slow truck left, the camera moves sideways parallel to the subject, creating gentle parallax between foreground and background
```

QA：

- 是否有侧向位移和视差。
- 是否没有变成横摇。

## 8. Handheld / 手持

含义：轻微不稳定，像人手持摄影机。

适合：纪录感、紧张感、现场感。

Prompt：

```text
subtle handheld camera, small natural micro-movements, no aggressive shake
```

QA：

- 是否只是轻微手持。
- 人物和场景是否没有被晃到变形。

## 9. Steadicam / 稳定跟拍

含义：移动但稳定，适合人物行走和空间穿行。

Prompt：

```text
a smooth steadicam follows the subject from behind as she walks through the quiet hallway, maintaining stable distance and framing
```

QA：

- 是否稳定顺滑。
- 是否没有过度漂浮。

## 10. Crane / Jib / 升降臂

含义：摄影机上升、下降或做大幅空间移动。

适合：建立空间、reveal 大场景、结尾打开情绪。

Prompt：

```text
slow crane up, the camera rises from behind the subject to reveal the empty street beyond the convenience store
```

风险：

- 容易变成无人机航拍。
- 不建议用于角色脸部一致性要求高的镜头。

## 11. Zoom In/Out / 变焦

含义：镜头焦距变化，摄影机位置不动。和 dolly 不同。

Prompt：

```text
subtle zoom in on the subject's face, the camera position remains fixed, the background compression increases slightly
```

QA：

- 是否是变焦而不是向前移动。
- 是否没有夸张裁切导致脸变形。

## 12. Orbit / 环绕

含义：摄影机绕主体旋转。

适合：角色被审视、情绪不稳定、展示对象三维结构。

Prompt：

```text
slow partial orbit around the subject, only 20 degrees, preserve character identity and background layout
```

风险：

- AI 视频中身份和背景容易漂。
- v0.3 不建议用于关键角色正脸镜头。

## 13. Parallax Reveal / 视差揭示

含义：摄影机横移，前景移开，露出背景信息。

Prompt：

```text
slow sideways truck right, foreground shelf slides out of frame to reveal the subject in the background
```

适合：揭示门后、窗外、桌上物件。

## 14. Whip Pan / 快速甩镜

含义：快速横摇，常用于突然反应或转场。

Prompt：

```text
quick whip pan to the right, motion blur during the transition, ending on the empty doorway
```

风险：

- v0.3 谨慎使用。
- 更适合低风险 B-roll。

## 15. Dolly Zoom / 变焦推拉

含义：摄影机移动和变焦同时反向变化，制造空间变形和心理冲击。

Prompt：

```text
subtle dolly zoom effect, the subject remains the same size while the background stretches slightly, psychological unease
```

风险：

- 高级运镜，不作为默认能力。
- 必须先短测试。

## 16. POV / 主观镜头

含义：从角色视角看出去。

Prompt：

```text
first-person POV, walking slowly toward the glass door, slight natural handheld motion
```

QA：

- 是否明确是主观视角。
- 是否没有突然出现角色本人的身体错位。
