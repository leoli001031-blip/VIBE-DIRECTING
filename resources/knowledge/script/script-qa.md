# Script QA Pack

用途：检查脚本、Story Flow、Scene 和 ShotSpec 是否足够进入分镜和生成阶段。

## 1. Overall Script Verdict

```yaml
script_verdict:
  usable_for_story_flow: true/false
  usable_for_storyboard: true/false
  main_issue:
  required_fix:
```

直接阻断：

- 主角不清楚。
- 没有目标或阻碍。
- 没有转折。
- 结尾状态不清楚。
- 全是抽象概念，无法视觉化。
- 场景过多，短片承载不了。

## 2. Story Flow QA

```yaml
story_flow_qa:
  protagonist_clear: pass/fail
  desire_clear: pass/fail
  obstacle_clear: pass/fail
  turn_clear: pass/fail
  ending_state_clear: pass/fail
  section_purpose_clear: pass/fail
  emotional_arc_clear: pass/fail
```

检查问题：

- 每段是否有 purpose。
- 情绪是否有递进。
- 是否只是“发生了一串事”。
- 是否有不必要的解释段落。

## 3. Scene QA

```yaml
scene_qa:
  objective: pass/fail
  obstacle: pass/fail
  turn: pass/fail
  consequence: pass/fail
  visualizable_action: pass/fail
  location_clear: pass/fail
```

失败例子：

```text
她回忆起自己的一生，并感到命运荒谬。
```

修复：

```text
她在旧柜子里翻出小时候的校牌。校牌背面写着她早忘了的一句话。她没有哭，只把校牌放进外套口袋。
```

## 4. Dialogue QA

```yaml
dialogue_qa:
  over_explaining: true/false
  has_subtext: true/false
  each_line_has_intention: true/false
  too_many_lines: true/false
  can_be_replaced_by_action: true/false
```

规则：

- 能用动作表达的，不优先用对白。
- 对白要有目的，不只是传递信息。
- 允许沉默。
- 每句对白背后最好有 subtext。

## 5. Short Film Scope QA

短片需要控制范围：

```yaml
scope_qa:
  character_count:
  location_count:
  time_span:
  concept_count:
  overloaded: true/false
```

建议：

- 15-30 秒：1 个场景，1 个核心动作。
- 30-90 秒：1-2 个场景，1 个转折。
- 1-3 分钟：2-4 个场景，1 条主线。

## 6. Shot Readiness QA

每个即将进入分镜的 beat 需要：

```yaml
shot_readiness:
  visible_action: pass/fail
  story_function: pass/fail
  location: pass/fail
  subject: pass/fail
  emotional_state: pass/fail
  visual_anchor: pass/fail
```

如果 `visible_action` 和 `story_function` 不明确，不进入 Image 2。

## 7. Script Repair Routes

| 问题 | 路由 |
|---|---|
| 缺主角 | 补 protagonist / visible identity |
| 缺目标 | 补 desire 和 scene objective |
| 缺阻碍 | 补 external/internal obstacle |
| 缺转折 | 补 turn 或删场景 |
| 太抽象 | 转成物件、动作、空间、声音 |
| 对白太满 | 转成 subtext 和 action beat |
| 短片太大 | 缩成一个时刻或一个关系 |
| 结尾太直白 | 改成 final image |
