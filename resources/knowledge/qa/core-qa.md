# Core QA Pack

用途：统一 subagent 和主 Agent 的验收标准。任何生成结果都必须先过整体视觉门，再过局部 checklist。

## 1. Overall Visual Verdict

必须最先判断：

```yaml
overall_visual_verdict:
  usable: true/false
  same_film_feeling: pass/fail
  visual_collapse: none/minor/major
  reason: string
```

直接失败情况：

- 不像同一部片。
- 整体视觉崩坏。
- 人物或场景一眼不对。
- 风格断裂。
- 构图完全不可用。
- 生成内容和任务无关。

规则：

局部条件通过不能覆盖整体失败。比如服装对了、道具对了，但整张图像廉价 AI 拼贴，仍然 failed。

## 2. Style QA

```yaml
style_qa:
  same_film_feeling: pass/fail
  lighting_match: pass/fail
  color_match: pass/fail
  texture_match: pass/fail
  composition_match: pass/fail
  performance_style_match: pass/fail
  drift_reason: string
```

检查项：

- 光线是否符合 Style Capsule。
- 色彩是否符合 Style Capsule。
- 纹理密度是否符合要求。
- 是否出现随机霓虹、烟雾、过度颗粒、塑料皮肤。
- 是否和整幕已有镜头一致。

## 3. Motion QA

```yaml
motion_qa:
  requested_camera_motion: very_slow_dolly_in
  actual_camera_motion: slow_zoom_in
  motion_match: pass/fail
  subject_identity_stable: pass/fail
  background_stable: pass/fail
  motion_artifacts: none/minor/major
  verdict: pass/retry/regenerate_keyframe
```

必须区分：

- dolly in vs zoom in
- pan vs truck
- tilt vs crane
- handheld vs unstable artifact
- locked camera vs model drift

## 4. Story Continuity QA

```yaml
continuity_qa:
  current_shot_function_met: pass/fail
  previous_connection: pass/fail
  next_connection: pass/fail
  spatial_axis_consistent: pass/fail
  reveal_order_correct: pass/fail
  repeated_function: true/false
```

检查项：

- 当前镜头是否完成 story_function。
- 是否接得上前一镜。
- 是否为后一镜留出正确信息。
- 是否提前 reveal。
- 是否重复相邻镜头功能。
- 人物、道具、方向、门、车、屏幕等锚点是否连续。

## 5. Reference Contamination Guard

禁止作为正向参考：

- failed 图。
- rejected 图。
- 未验收候选。
- 用户明确说丑或不对的候选。
- subagent 单帧通过但故事线失败的图。

允许使用方式：

- 作为 negative example。
- 作为失败案例。
- 作为 retry reason。

```yaml
reference_use:
  asset_id: asset_123
  allowed_as_positive_reference: false
  allowed_as_negative_example: true
  reason: style collapsed and character identity drifted
```

## 6. Image 2 Failure Map

| 失败 | 判断 | 路由 |
|---|---|---|
| 人物身份漂 | P0 | 重生或模型编辑，不用 OpenCV |
| 服装错 | P0/P1 | 模型编辑或重生 |
| 场景视角错 | P0 | 回到 Shot Layout / 重生 |
| 屏幕内容像贴图 | P1 | 重生或重新定义屏幕资产 |
| 纹理太重 | P1/P2 | 轻微可 local soften，严重则重生 |
| 风格整体偏 | P0/P1 | 回到 Style Capsule 重编译 |
| 局部小噪点 | P2 | local postprocess |

## 7. Seedance 2.0 Failure Map

| 失败 | 判断 | 路由 |
|---|---|---|
| 角色身份在视频中漂 | P0 | 回到关键帧或降低动作复杂度 |
| 场景结构变化 | P0 | 回到关键帧 / 更短运动 prompt |
| 运镜不匹配 | P1 | retry motion prompt |
| locked camera 仍漂移 | P1 | 加强 locked / 降低 motion |
| dolly 变 zoom | P1 | 重写 motion，明确 physical camera movement |
| 画面闪烁 | P1 | 重试或降低运动幅度 |
| 小动作不明显 | P2 | 可接受或轻微重试 |

## 8. Subagent 输出格式

```yaml
task_id:
shot_id:
overall_visual_verdict:
  usable:
  same_film_feeling:
  reason:
style_qa:
motion_qa:
continuity_qa:
asset_decision:
  can_promote_to_formal:
  can_use_as_reference:
  can_use_as_negative_example:
required_fix:
  priority: P0/P1/P2
  recommendation:
summary_for_main_agent:
```
