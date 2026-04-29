# Scene And Dialogue Pack

用途：帮助系统把脚本场景写成可分镜、可生成、可演的形式，尤其处理目标、冲突、潜台词和对白。

## 1. 场景结构

每场戏必须有：

```yaml
scene:
  location:
  time:
  entry_state:
  objective:
  obstacle:
  tactics:
  turn:
  consequence:
  exit_state:
```

### 1.1 Objective / 目标

角色在这场戏想要什么。

例子：

```text
她想借伞。
她想确认母亲有没有骗她。
她想离开这个房间，但不想显得害怕。
```

### 1.2 Obstacle / 阻碍

阻碍可以是：

- 外部阻碍：门锁了、雨太大、对方拒绝。
- 人际阻碍：对方不愿说真话。
- 内部阻碍：她不敢开口、她不想承认自己需要帮助。
- 环境阻碍：噪音、黑暗、距离、时间不够。

### 1.3 Turn / 转折

一场戏必须有变化：

- 权力关系变化。
- 秘密被揭开。
- 情绪反转。
- 主角改变策略。
- 新风险出现。

如果没有 turn，这场戏很可能只是说明。

## 2. Beat 写法

Beat 是场景里的小变化，不是镜头。

```yaml
beat:
  intention: 角色想达成什么
  action: 可见动作或台词
  reaction: 对方或环境反馈
  change: 局面有什么变化
```

例子：

```yaml
beat_01:
  intention: 她想确认母亲还在生气
  action: 她把钥匙轻轻放到桌上，没有看母亲
  reaction: 母亲没有拿钥匙，只把电视声音调小
  change: 对话被迫开始
```

## 3. 对白原则

### 3.1 对白不是信息搬运

弱：

```text
我今天被公司辞退了，所以我很难过。
```

强：

```text
她：你冰箱里还有剩饭吗？
母亲：你不是说今晚加班？
```

信息通过关系和反常暴露出来。

### 3.2 每句对白背后要有目的

```yaml
dialogue_line:
  surface_text: "你不是说今晚加班？"
  subtext: 你为什么突然回来了？是不是出事了？
  tactic: 试探
  emotional_state: 担心但不直接表达
```

### 3.3 保留沉默

AI 视频不需要每一秒都说话。沉默可以成为动作：

- 视线移开。
- 手停住。
- 没有接话。
- 把杯子推远。
- 关掉电视。

## 4. 潜台词模板

```yaml
subtext_unit:
  surface_action:
  hidden_desire:
  fear:
  power_dynamic:
  what_is_not_said:
```

例子：

```yaml
surface_action: 母亲问她要不要吃饭
hidden_desire: 母亲想知道她是不是失业了
fear: 怕一问出口就伤到她
power_dynamic: 母亲仍想维持照顾者位置
what_is_not_said: 你还好吗？
```

## 5. 对话场景的分镜规则

不要只做正反打。对话也要有镜头功能变化。

推荐分布：

```yaml
dialogue_scene_coverage:
  establish: 建立两人空间关系
  pressure: 用距离或遮挡表现关系压力
  reaction: 给沉默和反应镜头
  object_beat: 用物件承载潜台词
  shift: 转折后改变景别或机位
  residue: 留下对话后的空间
```

## 6. 常见问题

| 问题 | 表现 | 修复 |
|---|---|---|
| 对白解释太多 | 角色把背景都说出来 | 改成动作和潜台词 |
| 没有冲突 | 两人只是聊天 | 增加目标和阻碍 |
| 场景无变化 | 从头到尾情绪一样 | 找 turn |
| 镜头重复 | 一直正反打 | 加物件、沉默、空间变化 |
| 表演过度 | 大哭、大喊、大动作 | 改成微动作和停顿 |
