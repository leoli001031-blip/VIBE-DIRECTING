# Core Style Packs

用途：把用户的抽象风格意图翻译成 Style Capsule 字段、Prompt 片段和 QA 标准。

每个风格包包含：

- 用户说法
- 后台字段
- Image 2 片段
- Seedance 2.0 片段
- QA 要点
- 风险

## 1. Restrained Realism / 克制现实主义

用户说法：

- 冷一点。
- 不要太戏剧化。
- 像真实生活。
- 少一点 AI 味。
- 纪录感但画面要稳。

后台字段：

```yaml
lighting: natural practical light, low contrast, soft readable shadows
color: low saturation, cool gray, muted palette
composition: restrained framing, negative space, subject not overly centered
lens: 35mm to 50mm natural perspective
texture: clean image, low texture, no heavy grain
performance: minimal gestures, subtle facial expression
editing: slower pacing, fewer cuts
avoid:
  - dramatic spotlight
  - glossy commercial look
  - exaggerated neon
  - heavy micro texture
```

Image 2：

```text
realistic restrained cinematic keyframe, natural practical lighting, low-saturation cool gray palette, clean low-texture image, subtle facial expression, quiet negative space composition
```

Seedance 2.0：

```text
locked camera or very slow camera movement, subtle body motion only, preserve the quiet realistic lighting and low-saturation style
```

QA：

- 是否像真实空间，而不是广告棚拍。
- 是否避免过度调色、过度纹理、过度戏剧光。
- 人物动作是否克制。

风险：

- 过于平淡，缺乏镜头功能。
- 低饱和变成灰黄脏图。

## 2. Oppressive Lonely / 压抑孤独

用户说法：

- 更压抑。
- 让人喘不过气。
- 她更孤独一点。
- 环境压过人物。

后台字段：

```yaml
lighting: low key, dim practical light, heavier readable shadows
color: cool desaturated palette, black/gray/green undertone
composition: subject small in frame or trapped by architecture
lens: medium to long lens for compressed space, or wide lens for empty space
texture: clean but heavy atmosphere, no dirty AI fog
blocking: subject isolated, far from others
editing: longer hold, delayed reaction
avoid:
  - horror cliché
  - random smoke
  - over-dark unreadable image
```

Image 2：

```text
oppressive quiet cinematic keyframe, subject small and isolated within the architecture, dim practical lighting, cool desaturated palette, heavy negative space, readable shadows
```

Seedance 2.0：

```text
very slow dolly in toward the isolated subject, minimal movement, the environment remains still and heavy
```

QA：

- 是否通过空间和构图制造压迫，而不是简单调黑。
- 人物是否仍然可读。
- 是否没有脏雾、随机烟、恐怖片套路。

风险：

- 暗部不可读。
- 人物被环境吞没到无法识别。

## 3. Warm Hopeful / 温暖但克制的希望

用户说法：

- 暖一点。
- 不要鸡汤，但有一点希望。
- 结尾松动一点。

后台字段：

```yaml
lighting: warm practical light, soft bounce, gentle highlights
color: warm white, muted amber, soft green or blue contrast
composition: more breathing room, less trapped framing
lens: natural perspective, moderate depth of field
texture: clean, soft, not glossy
performance: small relaxation in shoulders or gaze
editing: longer hold after emotional change
avoid:
  - golden commercial glow
  - exaggerated smile
  - over-sentimental look
```

Image 2：

```text
quiet hopeful cinematic keyframe, soft warm practical light, muted amber highlights, realistic low-saturation palette, subtle emotional release
```

Seedance 2.0：

```text
the subject slowly relaxes her shoulders and looks up, locked camera or gentle slow push, preserve the soft warm practical light
```

QA：

- 希望感是否很轻。
- 表演是否内收。
- 暖色是否只作为情绪焦点，而不是全片变甜。

风险：

- 变成鸡汤广告。
- 光线过度金黄。

## 4. Noir Suspense / 黑色电影悬疑

用户说法：

- 黑色电影一点。
- 更像犯罪片。
- 让它有悬疑感。

后台字段：

```yaml
lighting: low key, hard side light, strong shadow shape
color: monochrome or muted blue/green/amber
composition: blinds, door frames, reflections, silhouettes
lens: medium lens, strong foreground/background separation
texture: controlled grain, not dirty noise
performance: restrained suspicion, guarded posture
editing: holds before reveal, motivated cut
avoid:
  - random detective hat cliché
  - excessive smoke
  - unreadable crushed blacks
```

Image 2：

```text
neo-noir cinematic keyframe, low-key hard side lighting, strong shadow shapes, muted cool palette, framed through doorway reflections, restrained suspense
```

Seedance 2.0：

```text
locked camera, subtle shadow movement, the subject slowly turns her eyes toward the doorway, preserve noir side lighting
```

QA：

- 是否靠光影、构图和信息遮挡制造悬疑。
- 是否没有变成廉价烟雾或 cosplay。

风险：

- 黑场压死。
- 套用侦探帽、香烟等刻板符号。

## 5. Dream Memory / 梦与记忆感

用户说法：

- 像回忆。
- 有点梦。
- 不真实但不要奇幻。

后台字段：

```yaml
lighting: soft diffused light, gentle halation
color: faded pastel palette, lower contrast
composition: centered stillness or floating negative space
lens: slight softness, shallow depth of field
texture: soft bloom, no heavy detail
motion: slow, drifting, low physical intensity
avoid:
  - fantasy particles everywhere
  - overblown glow
  - random surreal objects
```

Image 2：

```text
dreamlike memory-like cinematic keyframe, soft diffused light, gentle halation, faded pastel palette, shallow depth of field, quiet stillness
```

Seedance 2.0：

```text
very slow floating camera drift, subtle atmospheric motion, preserve the soft diffused memory-like image
```

QA：

- 是否是记忆感，不是魔法特效。
- 光晕是否克制。
- 是否没有随机漂浮物。

风险：

- 过曝。
- 变成廉价奇幻。

## 6. Premium Commercial / 高级商业感

用户说法：

- 更精致。
- 更像品牌短片。
- 产品要高级。

后台字段：

```yaml
lighting: controlled softbox, clean highlights, glossy edge light
color: polished palette, disciplined accent colors
composition: centered hero framing, clean background
lens: longer lens, shallow depth of field, product separation
texture: polished, smooth, premium
motion: smooth dolly, turntable, slow reveal
avoid:
  - clutter
  - handheld chaos
  - rough documentary texture
```

Image 2：

```text
premium commercial cinematic keyframe, controlled softbox lighting, clean highlights, polished color palette, centered hero composition, smooth premium texture
```

Seedance 2.0：

```text
smooth slow dolly in, controlled product reveal, stable camera, preserve premium lighting and clean composition
```

QA：

- 是否干净、有控制感。
- 是否和项目整体风格冲突。
- 是否削弱故事真实感。

风险：

- 过度广告化。
- 人物变成模特棚拍。

## 7. Documentary Handheld / 纪录片现场感

用户说法：

- 像纪录片。
- 更真实现场。
- 不要太摆拍。

后台字段：

```yaml
lighting: motivated natural/practical light
color: imperfect but controlled natural color
composition: observational framing, slightly imperfect edges
camera: subtle handheld, follow at human pace
texture: real-camera feel, not polished commercial
performance: natural pause, small hesitation
avoid:
  - aggressive shake
  - news footage look unless requested
  - over-processed HDR
```

Image 2：

```text
observational documentary-style cinematic keyframe, natural practical light, slightly imperfect but intentional framing, real lived-in environment, restrained color
```

Seedance 2.0：

```text
subtle handheld camera with small natural micro-movements, following the subject at human walking pace, no aggressive shake
```

QA：

- 是否自然但仍有画面组织。
- 手持是否轻微。
- 是否没有变成随手拍废片。

风险：

- 画面廉价。
- 运镜抖动造成身份漂移。

## 8. Analog VHS / 模拟录像与监控感

用户说法：

- 复古录像。
- 监控感。
- 90 年代 VHS。

后台字段：

```yaml
lighting: fluorescent or practical store light
color: faded analog colors, color bleed
composition: fixed high angle or surveillance framing
texture: VHS noise, timestamp, low fidelity
motion: locked camera, slight frame jitter
avoid:
  - modern clean digital sharpness
  - excessive glitch
  - unreadable image
```

Image 2：

```text
low-fidelity 1990s VHS surveillance still, fixed high-angle camera, fluorescent store lighting, faded color bleed, subtle analog noise, timestamp overlay
```

Seedance 2.0：

```text
locked surveillance camera, slight analog frame jitter, subject moves naturally through the frame, preserve VHS texture
```

QA：

- 是否是模拟质感，而不是随机 glitch。
- 时间戳和低清是否不影响故事信息。

风险：

- 文字乱码。
- 风格过强，破坏主片统一。

## 9. Monolithic Sci-Fi / 克制巨物科幻

用户说法：

- 科幻但不要花。
- 巨物感。
- 像人很小、世界很大。

后台字段：

```yaml
lighting: low-contrast atmospheric light
color: industrial monochrome, muted ochre, slate gray
composition: tiny human against massive structure
lens: wide shot, deep focus, scale contrast
production_design: brutalist, minimal, monumental
motion: slow crane/dolly or locked wide
avoid:
  - busy cyberpunk detail
  - random holograms
  - glossy spaceship cliché
```

Image 2：

```text
monolithic restrained sci-fi keyframe, tiny human figure before an immense brutalist structure, low-contrast atmospheric light, industrial monochrome palette, deep focus, overwhelming scale
```

Seedance 2.0：

```text
locked wide shot or very slow crane up, preserving the massive scale and minimal brutalist composition
```

QA：

- 人物是否渺小但可读。
- 科幻是否克制。
- 是否没有赛博霓虹乱入。

风险：

- 场景尺度不稳定。
- 模型添加多余飞船/光屏。

## 10. Pastel Symmetry / 粉彩对称秩序

用户说法：

- 更可爱但要高级。
- 对称、秩序感。
- 有点童话但不要幼稚。

后台字段：

```yaml
lighting: soft even light, no harsh shadows
color: strict pastel palette, controlled accents
composition: flat front-on symmetry, centered subject
production_design: meticulously arranged objects
texture: crisp, painterly, slightly nostalgic
performance: still, deadpan, controlled
avoid:
  - chaotic background
  - random color accents
  - glossy toy look
```

Image 2：

```text
perfectly symmetrical pastel cinematic keyframe, flat front-on perspective, soft even light, meticulously arranged objects, controlled whimsical mood
```

Seedance 2.0：

```text
locked front-facing camera, subject remains still with a tiny controlled gesture, preserve strict symmetry and pastel palette
```

QA：

- 对称是否稳定。
- 色彩是否受控。
- 是否和项目主风格兼容。

风险：

- 太强的风格化会盖过故事。

## 11. Urban Night / 城市夜行现实感

用户说法：

- 城市夜晚。
- 深夜街道。
- 路灯、便利店、雨后地面。

后台字段：

```yaml
lighting: street lamps, store light, car headlights
color: wet black, cool gray, small amber highlights
composition: street depth, reflective ground, human scale
props: bikes, bins, glass stickers, puddles, distant traffic
motion: slow walking follow, locked wide, or gentle push
avoid:
  - cyberpunk overload
  - empty generic street
  - fake glossy pavement
```

Image 2：

```text
realistic urban night keyframe, wet asphalt reflections, cold convenience-store light, distant car headlights, lived-in street details, low-saturation palette
```

Seedance 2.0：

```text
slow walking pace, subtle reflections moving on wet ground, preserve realistic urban night lighting
```

QA：

- 城市细节是否具体。
- 夜景是否不赛博。
- 湿地反光是否真实。

风险：

- 模型自动加霓虹。
- 反光过度像 CGI。

## 12. Hand-Painted Animation / 手绘动画电影感

用户说法：

- 手绘动画。
- 像温柔的动画电影。
- 画面更柔和。

后台字段：

```yaml
lighting: painted soft light
color: natural greens, warm skin tones, gentle atmospheric perspective
texture: watercolor/gouache, visible brush texture, thin line art
composition: open, airy, readable silhouettes
motion: gentle wind, subtle character movement
avoid:
  - 3D render
  - plastic surfaces
  - over-detailed texture
```

Image 2：

```text
hand-painted animation keyframe, soft gouache texture, gentle atmospheric perspective, natural low-saturation colors, clean readable silhouettes
```

Seedance 2.0：

```text
gentle wind motion, subtle character movement, preserve the soft hand-painted animation texture and clean silhouettes
```

QA：

- 是否保持手绘质感。
- 是否没有变 3D。
- 动作是否轻。

风险：

- 纹理太重。
- 角色线稿漂。
