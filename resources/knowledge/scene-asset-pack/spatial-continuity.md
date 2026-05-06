# Scene Asset Spatial Continuity

用途：把同一场景的空间关系、机位和人物位置固定下来，支持多视角关键帧和连续镜头。

## Master scene

- 每个重要场景先定义 `masterScene`：平面方向、主要入口、光源、固定道具、可活动区域。
- `worldPosition` 用稳定描述记录人物和道具位置，如 left of desk、near doorway、back wall。
- 任何 derived view 都必须回指 master scene，不单独发明新房间。

## Derived views

- derived view 只改变 camera vector、焦段、景别和可见区域。
- 多视角镜头要保留同一轴线：左/右、前/后、远/近关系不能翻转。
- 反打或转身可以越轴，但必须显式标注这是有意的轴线变化。

## Continuity checks

- 同一场景内人物站位、视线方向、透视高度和关键道具相对位置要连续。
- 插入新镜头时，先检查相邻镜头的 camera vector 和 world position。
- 如果空间关系无法判断，先生成或更新 master scene，不直接补关键帧。
