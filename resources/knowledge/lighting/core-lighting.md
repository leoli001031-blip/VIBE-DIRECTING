# Core Lighting Pack

用途：把风格和情绪翻译成可执行光线描述，并为 QA 提供反向检查。

## 1. Low Key Lighting / 低调光

中文解释：暗部占比高，明暗对比明显，常用于悬疑、压抑、犯罪或孤独。

Prompt：

```text
low-key lighting, dim practical light, deep but readable shadows
```

适合：压抑、悬疑、孤独、黑色电影。

风险：

- 画面黑到不可读。
- 模型用随机烟雾掩盖细节。

QA：

- 暗部是否仍有层次。
- 人物关键表情是否可读。

## 2. High Key Lighting / 高调光

中文解释：整体明亮、阴影少，常用于轻松、广告、喜剧、干净空间。

Prompt：

```text
high-key soft lighting, bright even exposure, minimal harsh shadows
```

风险：

- 棚拍感过强。
- 削弱现实质感。

## 3. Practical Light / 实景光源

中文解释：画面中的灯就是光源，比如便利店灯、台灯、路灯、车灯。

Prompt：

```text
motivated practical lighting from the convenience store sign and street lamps
```

QA：

- 光源是否在画面或空间中合理存在。
- 光线方向是否和光源一致。

## 4. Backlight / 逆光

中文解释：光从主体背后打来，制造轮廓、剪影、神秘感。

Prompt：

```text
soft backlight outlines the subject, subtle rim light separating her from the dark background
```

风险：

- 人脸完全不可读。
- 变成过度英雄光。

## 5. Side Light / 侧光

中文解释：光从侧面来，强调面部结构、心理分裂和悬疑感。

Prompt：

```text
hard side light from the left, one side of the face falling into readable shadow
```

适合：犹豫、怀疑、道德压力、黑色电影。

## 6. Soft Light / 柔光

中文解释：阴影边缘柔和，适合温柔、自然、回忆、商业质感。

Prompt：

```text
soft diffused light, gentle shadow edges, natural skin tones
```

风险：

- 过度磨皮。
- 画面太甜。

## 7. Hard Light / 硬光

中文解释：阴影边缘锋利，形状明确，适合悬疑、烈日、舞台感、表达压力。

Prompt：

```text
hard directional light, sharp shadow edges, graphic contrast
```

风险：

- 脸部难看。
- 不适合需要柔和情绪的镜头。

## 8. Fluorescent Light / 荧光灯

中文解释：便利店、办公室、医院、地铁里的冷白灯，常有现实、疲惫、疏离感。

Prompt：

```text
cold fluorescent practical light, slightly greenish white tone, realistic convenience-store atmosphere
```

风险：

- 变成赛博霓虹。
- 皮肤过绿不可看。

## 9. Sodium Vapor / 钠灯

中文解释：老街道橙黄路灯，常带旧城市、潮湿、夜晚感。

Prompt：

```text
muted sodium-vapor streetlight, damp orange glow reflected on wet asphalt
```

QA：

- 橙色是否有现实来源。
- 是否没有把整张图染成廉价黄色滤镜。

## 10. Motivated Lighting / 动机光

中文解释：光线有故事和空间来源，不是凭空漂亮。

Prompt：

```text
motivated lighting from the desk lamp and window, physically plausible light direction
```

QA：

- 光源和阴影方向是否一致。
- 是否没有随机光效。

## 11. Rembrandt Lighting / 伦勃朗光

中文解释：脸部一侧形成小三角光，常用于人物肖像和心理张力。

Prompt：

```text
subtle Rembrandt-style face lighting, small triangle of light on the shadow side, restrained contrast
```

风险：

- 太像摄影棚肖像。
- 和自然主义场景冲突。

## 12. Top Light / 顶光

中文解释：光从上方来，常有审讯、疲惫、压迫或办公室感。

Prompt：

```text
overhead practical light, tired top-lit face, realistic office atmosphere
```

风险：

- 脸部阴影不美。
- 需要明确动机光源。

## 13. Underlight / 底光

中文解释：光从下方来，常有诡异、不安、火光或屏幕光感。

Prompt：

```text
subtle underlight from the phone screen, uneasy shadows on the face
```

风险：

- 恐怖片感过强。
- 不适合普通现实主义。

## 14. Silhouette / 剪影

中文解释：主体几乎成黑色轮廓，用于神秘、孤独、结尾、背光进入未知。

Prompt：

```text
clear silhouette against the bright doorway, readable body outline, no facial detail needed
```

QA：

- 轮廓是否可读。
- 是否适合当前镜头功能。

## 15. Bounce Light / 反射补光

中文解释：光从墙、地面、水面等反射回来，柔和自然。

Prompt：

```text
soft bounce light reflected from the wet pavement, gentle fill on the subject's face
```

适合：雨后街道、室内自然光、温柔现实主义。
