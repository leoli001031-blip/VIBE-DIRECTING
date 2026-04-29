# Script To Story Flow Pack

用途：把用户输入的想法、梗概、脚本、对白片段或长文本，转换成 Vibe Director 的 Story Flow、Scene、StoryboardShot 和 ShotSpec。

## 1. 输入分类

```yaml
input_type:
  raw_idea: 一句话想法
  theme: 主题或情绪
  synopsis: 故事梗概
  script_text: 剧本文本
  dialogue_fragment: 对白片段
  reference_film: 参考片或风格
  mixed_notes: 散乱笔记
```

不同输入走不同策略：

| 输入 | 处理 |
|---|---|
| 一句话想法 | 先生成 script_brief，再补结构 |
| 主题/情绪 | 找主角、困境、转折、final image |
| 梗概 | 拆 scene 和 story beats |
| 剧本文本 | 解析场景、人物、动作、对白 |
| 对白片段 | 找关系、潜台词、场景动作 |
| 参考片 | 提炼结构和风格，不复制剧情 |
| 散乱笔记 | 先聚类，再生成 Story Flow |

## 2. 输出对象

```yaml
script_processing_output:
  brief:
  story_flow:
  scenes:
  characters:
  locations:
  props:
  visual_motifs:
  dialogue_units:
  missing_info:
  risk_notes:
```

## 3. Story Flow 生成步骤

```text
1. 识别主角和核心状态
2. 识别主角目标
3. 识别阻碍
4. 识别核心转折
5. 识别结尾状态
6. 拆成自适应段落
7. 给每段写 purpose
8. 给每段写 visual opportunity
9. 再进入分镜
```

## 4. ShotSpec 生成步骤

每个 scene 先拆 beats，再拆 shots。

```yaml
beat_to_shot:
  beat_intention:
  visible_action:
  shot_function:
  recommended_shot_size:
  composition_hint:
  camera_motion_hint:
  audio_or_dialogue:
```

规则：

- 一个 beat 不一定等于一个 shot。
- 一个 shot 必须有 story_function。
- 如果一个 shot 只是在“展示漂亮画面”，需要补功能或删除。

## 5. 视觉机会提取

脚本中这些内容应该变成 Visual Memory / Spatial Memory：

| 脚本内容 | 进入 |
|---|---|
| 角色外貌、服装、习惯动作 | Character Memory |
| 地点、空间布局、门窗桌椅车屏幕 | Scene / Spatial Memory |
| 重复出现的物件 | Prop Memory |
| 情绪色彩和画面风格 | Style Capsule |
| 反复出现的声音 | Voice / Sound Memory |
| 重要动作路线 | Shot Layout |

## 6. 缺口检查

生成前必须检查：

```yaml
script_gap_check:
  protagonist_clear: yes/no
  objective_clear: yes/no
  obstacle_clear: yes/no
  turn_clear: yes/no
  ending_state_clear: yes/no
  visualizable: yes/no
  enough_locations: yes/no
  too_many_characters: yes/no
  dialogue_overexplains: yes/no
```

如果缺口太多，不要直接生成分镜。先给用户一个“我理解的故事方向”，再补全。

## 7. 用户确认反馈

系统生成 Story Flow 后，用户看到的应该很简单：

```text
我理解这是一个关于“失落后继续往前走”的短片。
主角不是被彻底治愈，而是被一个很小的善意推了一下。

故事段落：
1. 雨夜停滞
2. 便利店门口的犹豫
3. 一次没有说出口的照顾
4. 她继续往前走
```

不要展示内部字段。

## 8. 脚本到生成的边界

脚本阶段不直接生成：

- 最终 Image 2 prompt
- Seedance 2.0 motion prompt
- 复杂镜头参数

脚本阶段应该生成：

- Story Flow
- Scene purpose
- Beat
- Shot function
- Visual opportunities
- Missing info
