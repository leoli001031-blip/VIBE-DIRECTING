# Short Film Structure Pack

用途：为 Vibe Director 提供短片/个人影像/创意短片的结构模板。系统根据用户想法自适应选择，不强制三幕。

## 1. 极短片 15-30 秒

适合：情绪瞬间、产品氛围、一个视觉点子、AI 测试片。

```yaml
structure:
  length: 15-30s
  sections:
    - setup_image: 1-2 shots
    - interruption_or_turn: 1-2 shots
    - final_image: 1 shot
```

规则：

- 只讲一个变化。
- 不展开背景。
- 最后一镜必须有余味。

## 2. 30-90 秒情绪短片

适合：个人影像、城市、孤独、治愈、回忆。

```yaml
structure:
  sections:
    - current_state: 建立主角状态
    - pressure: 加深困境
    - encounter: 遇到微小事件
    - turn: 角色状态松动
    - aftertaste: 留下结尾画面
```

注意：

- 不需要大和解。
- 转变可以非常轻。
- 结尾用 final image，不用总结台词。

## 3. 1-3 分钟叙事短片

适合：完整小故事、微悬疑、轻科幻、关系片段。

```yaml
structure:
  sections:
    - opening_image: 主题和状态
    - inciting_incident: 触发事件
    - pursuit_or_avoidance: 主角行动或逃避
    - midpoint_reveal: 发现新信息
    - choice: 主角做选择
    - final_image: 选择后的世界
```

QA：

- inciting incident 是否足够早。
- midpoint reveal 是否改变了局面。
- choice 是否来自主角，而不是系统强行安排。

## 4. 悬疑发现结构

```yaml
sections:
  - ordinary_state: 普通世界
  - anomaly: 异常出现
  - approach: 主角靠近异常
  - partial_reveal: 揭示一部分
  - consequence: 主角状态改变
```

适合：

- 门外有人。
- 屏幕里出现异常。
- 城市里出现不该存在的东西。
- 记忆和现实错位。

规则：

- 不要过早解释。
- 每个 reveal 必须比上一个多一点信息。
- 结尾可以不解释全部，但必须有情绪后果。

## 5. 关系冲突结构

```yaml
sections:
  - shared_space: 两人处于同一空间
  - surface_action: 表面上在做一件普通事
  - subtext_pressure: 潜台词压力出现
  - rupture_or_withdrawal: 关系破裂或退让
  - residue: 留下关系余波
```

适合：

- 母女对话。
- 分手前一晚。
- 老友重逢。
- 同事之间的沉默冲突。

规则：

- 表面动作必须具体，比如吃饭、等车、收拾房间。
- 潜台词不要直接说出来。
- 通过停顿、避开视线、拿起/放下物件表达关系。

## 6. 记忆/梦境结构

```yaml
sections:
  - present_trigger: 现实中的触发物
  - memory_fragment: 记忆片段
  - distortion: 记忆出现偏差
  - return: 回到现实
  - changed_perception: 主角看现实的方式改变
```

规则：

- 记忆片段要有视觉锚点。
- 不要滥用粒子和光晕。
- 回到现实后必须有状态变化。

## 7. AI / 科幻短片结构

```yaml
sections:
  - normal_interface: 普通技术场景
  - small_glitch: 小异常
  - pattern: 异常重复成规律
  - human_choice: 人类角色做选择
  - unresolved_aftertaste: 留下不安或希望
```

规则：

- 科幻点子必须服务人物状态。
- 不要堆设定。
- UI、屏幕、设备都要有具体画面功能。

## 8. 结构选择规则

```yaml
if user_intent contains "一个瞬间" or "情绪":
  use: 30-90 秒情绪短片
if user_intent contains "发现", "门外", "异常":
  use: 悬疑发现结构
if user_intent contains "两个人", "对话", "关系":
  use: 关系冲突结构
if user_intent contains "记忆", "梦", "过去":
  use: 记忆/梦境结构
if user_intent contains "AI", "系统", "屏幕", "未来":
  use: AI / 科幻短片结构
```
