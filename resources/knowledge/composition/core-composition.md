# Core Composition Pack

用途：把用户对“画面感觉”的自然语言，翻译成构图、空间关系和 Shot Layout 字段。

## 1. Negative Space / 负空间

中文解释：主体旁边留出大面积空白或空环境，让人物显得孤独、渺小、无力。

适合：孤独、压抑、等待、情绪空白。

Prompt：

```text
large negative space around the subject, the character appears small and isolated within the frame
```

Shot Layout：

```yaml
composition: negative_space
subject_position: lower_right_or_side
empty_zone: left_or_upper_frame
```

QA：

- 主体是否没有塞满画面。
- 空白是否有情绪作用，而不是构图空洞。

## 2. Symmetry / 对称构图

中文解释：画面左右或上下高度对称，产生秩序、控制、仪式感或荒诞感。

适合：控制感、仪式感、荒诞、角色被系统困住。

Prompt：

```text
perfectly symmetrical front-facing composition, centered subject, controlled and orderly frame
```

QA：

- 对称是否明确。
- 是否和项目自然主义风格冲突。

## 3. Frame Within Frame / 框中框

中文解释：用门、窗、镜子、走廊、屏幕等把主体框起来。

适合：监视感、被困住、旁观、信息隔离。

Prompt：

```text
the subject is framed within the doorway, creating a frame-within-frame composition
```

Shot Layout：

```yaml
spatial_anchor: doorway/window/mirror/screen
subject_position: inside_anchor_frame
```

QA：

- 框是否来自真实场景锚点。
- 框是否没有随机改变场景布局。

## 4. Foreground Obstruction / 前景遮挡

中文解释：用前景物遮挡一部分画面，让镜头有偷窥、距离、层次或不安。

适合：旁观感、悬疑、人物被隔开、增加空间深度。

Prompt：

```text
foreground obstruction partially covers the frame, as if observed from behind a shelf
```

QA：

- 遮挡是否不挡住主体关键信息。
- 是否没有变成随机糊块。

## 5. Deep Staging / 深度调度

中文解释：前景、中景、背景都有叙事信息，人物和道具在空间深处形成关系。

适合：多人关系、空间叙事、角色距离变化、同一镜头内表达多层信息。

Prompt：

```text
deep staging with foreground table, subject in midground, window and street reflection in background
```

QA：

- 前中后景是否可读。
- 每层信息是否服务故事。

## 6. Leading Lines / 引导线

中文解释：用道路、走廊、灯带、桌边、墙线把视线引向主体或目标。

适合：引导注意、强化空间方向、通往未知或危险。

Prompt：

```text
strong leading lines from the hallway walls guide the eye toward the distant door
```

QA：

- 线条是否指向正确目标。
- 是否改变了空间轴线。

## 7. Over The Shoulder / 过肩构图

中文解释：从一个角色肩膀后方看另一个角色，建立对话、对峙或观察关系。

适合：对话、审问、亲密关系、权力关系。

Prompt：

```text
over-the-shoulder composition, foreground shoulder blurred, main subject facing the camera in midground
```

QA：

- 前景肩膀是否不会变成新角色。
- 眼线方向是否合理。

## 8. Profile Shot / 侧面构图

中文解释：人物侧面，强调方向、距离、犹豫或人与空间的关系。

适合：行走、等待、选择前停顿、人与门/窗/车的关系。

Prompt：

```text
clean profile shot, subject facing right toward the window, strong horizontal spatial relationship
```

QA：

- 朝向是否符合动作轴线。
- 侧脸是否保持身份。

## 9. Center-Framed Isolation / 中心孤立

中文解释：主体居中，但周围空间空旷或秩序强，形成被展示、被审判、被困住的感觉。

适合：系统压迫、仪式、角色暴露。

Prompt：

```text
center-framed isolated subject, surrounded by empty symmetrical space, exposed and vulnerable
```

QA：

- 居中是否有叙事意义。
- 是否不是普通证件照。

## 10. Crowded Frame / 拥挤构图

中文解释：画面元素很多，制造混乱、压力、社会环境或信息过载。

适合：城市压力、拥堵、家庭冲突、办公室压迫。

Prompt：

```text
crowded frame with layered people and objects, the subject partially boxed in by the environment
```

QA：

- 拥挤是否可读。
- 主体是否仍然明确。

## 11. Empty Frame / 空镜构图

中文解释：没有人物或人物离开后留下空间，用环境表达情绪或时间。

适合：过渡、失落、结尾、等待、回声。

Prompt：

```text
empty frame after the character has left, quiet room with lingering emotional traces
```

QA：

- 空镜是否有故事功能。
- 是否不是随机 B-roll。

## 12. Scale Contrast / 尺度对比

中文解释：用巨大建筑、天空、机械或空间对比渺小人物。

适合：科幻、孤独、命运感、进入未知。

Prompt：

```text
tiny human figure against a massive structure, overwhelming scale contrast, deep focus
```

QA：

- 人物是否可读。
- 巨物是否稳定、不过度复杂。
