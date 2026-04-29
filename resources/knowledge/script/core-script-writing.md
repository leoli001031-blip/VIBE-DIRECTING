# Core Script Writing Pack

用途：把用户的散乱想法、主题、片段、对白和情绪，整理成 Vibe Director 可执行的 Story Flow、Scene、ShotSpec 和分镜方向。

这不是传统长片剧本课，而是 AI 视频/短片上游的脚本知识包。核心目标：

```text
想法
-> 可理解的故事
-> 可拆分的场景
-> 可分镜的动作
-> 可生成的视觉和声音任务
```

## 1. 核心原则

### 1.1 从“可拍”而不是“好听”开始

脚本不是文案。对 Vibe Director 来说，任何内容都要最终落到：

- 谁在场。
- 在哪里。
- 想要什么。
- 被什么阻挡。
- 发生了什么可见动作。
- 角色状态发生了什么变化。
- 下一场/下一镜为什么会发生。

如果一句话不能转成可见动作、声音或明确心理状态，就不能直接进入 ShotSpec。

### 1.2 短片只抓一个核心变化

短片最怕塞太多世界观、人物背景和支线。

推荐结构：

```yaml
short_film_core:
  protagonist: 主角
  situation: 当前困境
  desire: 主角想要什么
  obstacle: 阻碍是什么
  turn: 发生了什么让局面改变
  final_state: 结尾时主角有什么变化
```

例子：

```yaml
protagonist: 一个刚失业的女孩
situation: 雨夜，她不想回家
desire: 找到一个能让自己继续撑下去的理由
obstacle: 她觉得世界和自己无关
turn: 便利店老板默默把快过期的热饭留给她
final_state: 她没有被治愈，但愿意继续往前走
```

### 1.3 每场戏都是一个小电影

每场戏要有：

```yaml
scene_unit:
  entry_state: 角色进入时的状态
  objective: 角色在这场戏想要什么
  obstacle: 阻碍
  beat_turn: 中途发生的变化
  consequence: 结尾带来的后果
  exit_state: 角色离开时的状态
```

如果一场戏没有 objective、obstacle 或 consequence，很可能只是信息说明。

### 1.4 用动作表达心理

弱：

```text
她很难过。
```

强：

```text
她把手机屏幕按亮，又立刻按灭，把没打开的伞攥得很紧。
```

Prompt Compiler 和分镜生成更需要后者。

## 2. Story Flow 基础结构

Vibe Director 不强制三幕结构，应该根据故事自适应段落。但后台仍需要检查叙事功能。

```yaml
story_flow:
  structure_type: adaptive
  sections:
    - purpose: 建立状态
    - purpose: 触发变化
    - purpose: 加深冲突
    - purpose: 情绪转折
    - purpose: 余波或结尾
```

常见短片结构：

### 2.1 Moment Structure / 单一时刻结构

适合 15-90 秒短片。

```text
一个人处在一个明确困境中
-> 一个微小事件打破原状态
-> 主角做出一个小选择
-> 留下一个情绪余波
```

### 2.2 Discovery Structure / 发现结构

适合悬疑、科幻、记忆、情绪短片。

```text
普通状态
-> 异常迹象
-> 主角靠近
-> 发现真相的一部分
-> 结尾保留余味或反转
```

### 2.3 Transformation Structure / 转变结构

适合情绪短片。

```text
主角处于 A 状态
-> 遭遇阻碍
-> 看见/经历一个改变视角的东西
-> 进入 B 状态
```

### 2.4 Loop Structure / 循环结构

适合荒诞、记忆、AI、时间主题。

```text
重复行为
-> 重复中出现差异
-> 主角意识到差异
-> 打破循环或接受循环
```

## 3. 剧本字段模型

```yaml
script_brief:
  logline: 一句话故事
  theme: 主题
  protagonist:
    name:
    visible_identity:
    desire:
    flaw_or_wound:
  world:
    time:
    place:
    rules:
  conflict:
    external:
    internal:
    stakes:
  ending:
    final_image:
    emotional_aftertaste:
```

## 4. 从脚本到分镜的转换规则

每段脚本都要转成：

```yaml
scene:
  scene_id:
  location:
  time:
  entry_state:
  objective:
  obstacle:
  turn:
  exit_state:
  visual_opportunities:
  sound_opportunities:
  shots:
```

每个 shot 再转成：

```yaml
shot:
  story_function:
  visible_action:
  emotional_turn:
  subject:
  location:
  shot_layout_hint:
  style_capsule_id:
  dialogue_or_sound:
```

## 5. 常见脚本问题和系统修复

| 问题 | 表现 | 修复 |
|---|---|---|
| 没有主角目标 | 画面发生了很多事，但不知道角色要什么 | 补 `desire` 和每场 `objective` |
| 没有阻碍 | 主角一路顺利，缺乏张力 | 增加外部阻碍或心理阻碍 |
| 太多背景解释 | 一直旁白讲设定 | 转成视觉线索或删掉 |
| 情绪跳变 | 前一秒崩溃，后一秒治愈 | 增加 turn 和 reaction beat |
| 不可拍 | 只有抽象概念 | 转成动作、物件、空间和声音 |
| 太像短视频文案 | 只有 hook 和反转，没有影像 | 增加场景、动作和情绪余波 |
| 结尾太满 | 把意义讲死 | 留 final image 和 aftertaste |

## 6. 对 Vibe Director 的执行规则

- 用户输入散乱想法时，先生成 `script_brief`，不要直接出分镜。
- 如果缺主角目标、阻碍、转折或结尾状态，先让 `story-shot-director` 补齐。
- 脚本生成不追求长篇文学性，追求可分镜、可生成、可预览。
- 每个 scene 必须能落到 location、objective、obstacle、turn、exit_state。
- 每个 shot 必须有 story_function。
- 对白只保留必要内容，优先让动作和画面承担信息。
