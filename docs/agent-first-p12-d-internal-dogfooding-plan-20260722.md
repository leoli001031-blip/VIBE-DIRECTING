# Vibe Director Studio P12-D internal dogfooding plan

Date: 2026-07-22

Status: **PREREGISTERED BEFORE OBSERVATION**.

P12-D uses three original short-film ideas as owner-side packaged App
dogfooding. It replaces unavailable external creators with repeatable internal
tasks. It is not external user research and is not permission for Provider use.

## Fixed boundaries

- use the packaged App without a frontend dev server;
- use a fresh isolated `/tmp` HOME, profile, projects root, and Runtime root;
- launch with `VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS=1` and blank model/media keys;
- do not confirm project save, generation, promotion, Delivery, or export;
- do not call a real model or media Provider;
- preserve the six pre-existing P10-E dirty files;
- only fix a reproduced P0/P1 blocker with a narrow contract and packaged retest;
- record P2 quality/copy friction without using it to justify visual redesign.

## Task D1: restrained visual metaphor

Initial message:

`我想拍一个 12 秒短片：凌晨自助洗衣店，女孩把一根被雨淋湿的火柴放进烘干机。滚筒转起来后，墙上短暂掠过夏日海边的光影。她没有点火，只把火柴收回口袋。安静、克制，不要解释。镜头数量由你决定，先只整理故事，不保存也不生成。`

Revision:

`海边不要完整出现，只在第二镜以蓝色反光扫过衣服；最后保留她把火柴收回口袋，不加旁白。先形成修改确认，不保存也不生成。`

Expected:

- planning controls do not become story beats;
- the draft keeps the wet match, dryer, blue reflected light, and pocket ending;
- the revision targets the second and final shots independently;
- exactly one current task ends at `确认这版故事`.

## Task D2: memory-like ambiguity

Initial message:

`做一个 8 秒短片：清晨菜市场收摊，老人看到一尾透明的小鱼在水洼里游。他用空菜篮挡住阳光，鱼就看不见了。不要解释成魔法。镜头怎么拆你决定，先只整理故事，不保存也不生成。`

Ambiguous feedback:

`我还没想清楚“像记忆”应该靠光线还是动作。你先问我一个关键问题，再动草案。`

Clarifying reply, only after the App asks:

`保留老人、透明鱼和用菜篮挡光的动作；不要新增童年闪回，结尾停在水洼只剩天空倒影。仍然不保存也不生成。`

Expected:

- `先问我一个关键问题，再动草案` enters a non-executing Clarify turn;
- the ambiguous message does not silently rewrite the draft;
- the reply forms an updated draft confirmation with one current task;
- no old confirmation or Clarify card competes with the current task.

## Task D3: selected-shot deictic revision

Initial message:

`我想拍一个 15 秒短片：末班地铁的空车厢里，清洁工每擦过一扇车窗，倒影里的乘客就少一个。最后只剩他自己的倒影，但现实车厢从头到尾都是空的。不要恐怖，像疲惫后的错觉。拆成最少的镜头，先不保存也不生成。`

After selecting a non-final draft shot, revision:

`这个镜头只改动作：他擦完窗后停一下，不要让倒影立刻消失。先形成修改确认。`

Expected:

- the selected draft shot remains the target;
- `这个镜头` does not fall back to the whole story or final shot;
- only the selected row changes and the ending remains intact;
- one current confirmation task remains, with no save or generation.

## Metrics and severity

For each task record route, creator messages, Clarify turns, confirmation
boundaries, stable current-task count, stale cards, elapsed interaction time,
project/Runtime files, Provider traces, and final result.

- `P0`: write/generation/provider execution or confirmation bypass;
- `P1`: wrong route/target, unusable current task, stale-task takeover, or a
  recovery path that cannot complete;
- `P2`: weak local prose, punctuation, extra turns, or understandable copy
  friction that does not block completion.

## Gate language

`P12-D internal dogfooding PASS` or the exact blocking result

`External creator usability NOT VERIFIED`

`Real Provider execution NOT VERIFIED`

`Public distribution NOT CLAIMED`
