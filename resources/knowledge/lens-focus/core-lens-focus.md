# Core Lens And Focus Pack

用途：把镜头、透视、景深、焦点变化转成 Shot Layout 和 Prompt Compiler 可用字段。

## 1. Wide Angle / 广角

中文解释：空间感强，近大远小明显，能强调环境或扭曲压迫。

Prompt：

```text
wide-angle lens, deep spatial perspective, the environment feels larger than the subject
```

适合：建立空间、压迫环境、巨物感、狭窄空间。

风险：

- 人脸靠近边缘时容易变形。
- 不适合所有角色近景。

## 2. Standard Lens / 标准镜头

中文解释：接近人眼自然透视，适合现实主义和稳定叙事。

Prompt：

```text
natural 35mm to 50mm perspective, realistic spatial proportions
```

适合：日常感、纪录感、角色中景、对话。

## 3. Telephoto Compression / 长焦压缩

中文解释：空间被压扁，背景靠近人物，适合疏离、偷窥、压迫。

Prompt：

```text
telephoto compression, background layers feel close and heavy behind the subject
```

QA：

- 是否真的压缩空间。
- 是否没有把背景糊成不可读。

## 4. Shallow Depth Of Field / 浅景深

中文解释：主体清楚，背景虚化，强调注意力。

Prompt：

```text
shallow depth of field, subject sharply focused, background softly blurred but still recognizable
```

风险：

- 场景锚点不可读。
- 不适合需要空间连续性的镜头。

## 5. Deep Focus / 深焦

中文解释：前景到背景都清楚，适合空间叙事和多层信息。

Prompt：

```text
deep focus, foreground, subject, and background anchors all readable
```

适合：建立空间、多人关系、场景锚点、巨物科幻。

## 6. Rack Focus / 焦点转移

中文解释：焦点从一个平面转到另一个平面，不是摄影机运动。

Prompt：

```text
rack focus from the wet umbrella in the foreground to the subject's face in the midground, camera remains locked
```

QA：

- 焦点是否明确转移。
- 构图和主体是否没有重生。

## 7. Split Diopter / 分焦镜头感

中文解释：前景和背景同时清楚，中间可能略不自然，适合强烈悬疑和双重信息。

Prompt：

```text
split-diopter style composition, foreground object and background subject both sharp, unsettling spatial tension
```

风险：

- AI 可能理解不稳。
- v0.3 只作为高级风格，不默认使用。
