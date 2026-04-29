# Core Prompt Templates

用途：为 Prompt Compiler 提供 Image 2 / Seedance 2.0 的结构化模板。用户不直接看到这些模板。

## 1. Image 2 Keyframe Template

Image 2 负责关键帧、风格、构图、人物、场景和空间锚点。

```text
Create a {aspect_ratio} cinematic keyframe for an AI short film.

Scene:
{scene_summary}

Subject:
{subject_identity}
{subject_action}

Composition:
{shot_size}, {camera_angle}, {composition_rule}.
Subject position: {subject_position}.
Spatial anchors: {spatial_anchors}.

Lighting:
{lighting_rule}

Color and texture:
{color_rule}
{texture_rule}

Style:
{style_capsule_fragment}

Must preserve:
{must_preserve}

Must avoid:
{must_avoid}

The image should feel like one frame from the same film, not a poster, not a generic AI artwork.
```

## 2. Image 2 Edit Template

编辑任务必须清楚区分不变项和允许变化。

```text
Edit the provided image.

Goal:
{edit_goal}

Must preserve exactly:
{must_preserve}

Allowed changes:
{allowed_changes}

Must avoid:
{must_avoid}

Style continuity:
Preserve the existing character identity, scene layout, camera angle, and overall film style unless explicitly listed in Allowed changes.
```

## 3. Seedance 2.0 Motion Template

Seedance 2.0 负责让已通过 QA 的关键帧动起来。不要让它重新决定人物、服装、场景和光线。

```text
Use the approved keyframe as the visual source.

Camera motion:
{camera_motion}, {speed}, {direction}, {relationship_to_subject}.

Subject action:
{subject_action}

Performance:
{performance_instruction}

Preserve:
character identity, costume, scene layout, camera framing, lighting, color palette, and the approved keyframe style.

Avoid:
new characters, changed clothing, changed location, changed lighting, exaggerated motion, scene transformation, style drift.
```

## 4. Reference Selection Template

每次生成前必须说明参考图 role。

```yaml
reference_selection:
  shot_id:
  selected_assets:
    - asset_id:
      role: character
      reason:
      strength: high
    - asset_id:
      role: scene
      reason:
      strength: high
    - asset_id:
      role: style
      reason:
      strength: medium
    - asset_id:
      role: composition
      reason:
      strength: low
  forbidden_assets:
    - asset_id:
      reason:
```

Rules:

- character reference 不等于 style reference。
- scene reference 不等于 composition reference。
- rejected / failed / unreviewed candidates cannot be positive references.
- If references conflict with text prompt, block generation and ask Prompt Compiler to resolve.

## 5. Style Capsule To Prompt Fragment

```yaml
style_capsule:
  lighting:
  color_palette:
  composition:
  lens_language:
  texture:
  performance_style:
  avoid:
```

编译为：

```text
{lighting}, {color_palette}, {composition}, {lens_language}, {texture}, {performance_style}. Avoid {avoid}.
```

规则：

- 不直接写“cinematic”作为核心风格。
- 不直接写电影名或导演名作为唯一风格。
- 必须把风格拆成光线、色彩、构图、镜头、纹理、表演。

## 6. Shot Layout To Prompt Fragment

```yaml
shot_layout:
  subject_position:
  depth_layer:
  facing:
  action:
  anchors:
  must_not:
```

编译为：

```text
The subject is positioned at {subject_position} in the {depth_layer}, facing {facing}, {action}. Spatial anchors: {anchors}. Do not show: {must_not}.
```

示例：

```text
The subject sits in the left midground, facing the right window. The table is between her and the window; the entrance door remains far left in the background. Do not center the character, do not make her stand, do not change the restaurant into a crowded cyberpunk scene.
```
