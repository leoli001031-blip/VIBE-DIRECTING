# 6-Shot OP Plan

Title: AI大小姐们想让我告白 — OP Proof

Purpose:

做一个 28-34 秒左右的群像 OP 概念展示。重点不是完整剧情，而是让观众立刻理解：

- 这是 AI 拟人大小姐校园恋爱喜剧。
- 每个角色有明显颜色和性格区分。
- 男主是被众人卷入事件中心的无脸代入位。
- Vibe Director 能把已有角色/场景资产组织成多段可执行 Seedance 请求。

Global video settings:

- Aspect ratio: `16:9`
- Resolution: `720p`
- Model: `seedance2.0_vip`
- BGM in Seedance: `no BGM`
- Submission: serial only, no concurrency
- Audio: 暂不上传音源，先做无对白 OP 视觉段；后续可以再加角色声线或旁白

## Shot List

| # | Title | Duration | Mode | References | Function |
|---|---:|---:|---|---|---|
| 1 | ZC学院开场 | 5s | anime_op_cuts | academy + protagonist | 建立世界观与男主代入 |
| 2 | Claude / GPT 对位 | 5s | anime_op_cuts | corridor + Claude + GPT | 建立两位核心大小姐的气质对比 |
| 3 | Gemini / 豆包闯入 | 4s | anime_op_cuts | clubroom + Gemini + 豆包 | 喜剧能量进入 |
| 4 | DeepSeek / MiniMax / Kimi 三连 | 6s | storyboard_rapid_cut-like prompt without visible storyboard | sports_field + rooftop + 3 character refs | 群像速度感和性格差异 |
| 5 | 社团室全员据点 | 6s | anime_op_cuts | clubroom + 5-6 character refs | 明确“这是一个团队/项目” |
| 6 | 男主被包围的 OP Hook | 6s | anime_op_cuts | academy/corridor + protagonist + main heroines | 标题前 hook，恋爱喜剧张力 |

## Shot Details

### 1. ZC学院开场

用 3 个日漫 OP cut 建立世界：校园定版、男主背影、抬头近景。樱花、夕阳、校园广播感。男主作为无脸代入位站在画面下方，抬头看向学院。

Skill reference:

- `EWS 大远景` 用于世界观与命运感。
- `2D compositing / foreground layer parallax` 用于把观众带入故事，避免真实摄影机推轨。

### 2. Claude / GPT 对位

走廊黄昏。Claude 在窗边暖橙逆光里侧身，GPT 从阴影侧经过，两人视线短暂交错。不是对话，而是 OP 中的“性格对位”。用 profile cut、passing cut、eyeline cut，不用连续滑轨。

Skill reference:

- `profile shot` 表达犹豫与方向感。
- `over-the-shoulder / eyeline` 表达权力关系和视线压力。

### 3. Gemini / 豆包闯入

社团室门被拉开，Gemini 和豆包突然占满画面，一个狡黠，一个亲切，动作夸张但不要崩。男主或 GPT 可只作为前景反应剪影。

Skill reference:

- `quick whip pan` 和 `handheld micro shake` 用于喜剧惊吓。
- 这段只做一个主要动作：闯入和招手。

### 4. DeepSeek / MiniMax / Kimi 三连

OP 快速群像。DeepSeek 在图书馆/走廊温柔回头，MiniMax 在操场朝镜头冲来，Kimi 在天台月光/夕光中安静抬眼。一个 6 秒连续片段中做三段视觉记忆点，但最终可见切点最多 3 个。

Skill reference:

- 快切用于角色性格标签。
- 每个角色只给一个明确动作和一个色彩记忆点。

### 5. 社团室全员据点

社团室内，白板、电脑、便签、暖桌。几位 AI 大小姐围绕桌面，有人在写，有人在吵，有人在冷静看平板。男主坐在中间，被信息量包围。用桌面插入、中心反应、最终群像定版三段建立，而不是慢慢拉远。

Skill reference:

- `center-framed isolation`：男主被所有人注视。
- `negative space` 和前景遮挡用于表现“被围在中心”。

### 6. 男主被包围的 OP Hook

校园走廊或校门前，男主后退半步，Claude/GPT/Gemini/豆包/MiniMax/DeepSeek 从不同方向进入画面。最后停在男主被半圆包围的构图，角色气质明确，像 OP 标题前一帧。用 snap entrance 和最终 key layout，不用 crane-up / pull-back。

Skill reference:

- `half-step retreat` 表示男主被卷入。
- `center-framed isolation` 用于被注视/被审判/被告白前的喜剧压力。

## Review Notes Before Video Submission

- 本轮是 OP 展示，优先使用可见 cut 和定版构图；不要默认把镜头写成连续真实摄影机运动。
- Shot 5 / Shot 6 多角色风险较高，若身份混乱，应拆成两个更短镜头。
- 角色 identity sheet 不可作为最终画面构图，只能作为身份参考。
- 所有 prompt 都必须明确 `No subtitles, no logos, no text overlays, no UI, no storyboard artifacts`。
