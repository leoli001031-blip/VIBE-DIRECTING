# Demo Recording Runbook

Updated: 2026-06-20

This is the recording-facing guide for the current Vibe Director demo. It is
not a product roadmap and should stay aligned with `README.md` and
`docs/current-demo-architecture.md`.

## Recording Goal

Show Vibe Director as a local-first video director Agent:

- the creator gives an idea, script, images, or voice reference in the right
  Agent conversation;
- the Agent decides what the project needs;
- the app generates and reviews reference material;
- the app compiles Seedance-ready video requests;
- video jobs are submitted serially and returned clips become preview/export
  material.

The demo point is not "we have a storyboard feature". The point is that the app
uses production skills to help a non-film user get better shot design, pacing,
reference binding, and provider prompts.

## Before Recording

Use the canonical repo:

```bash
cd "/Users/lichenhao/Desktop/new vibe directing"
```

Use `docs/demo-final-rehearsal-checklist.md` as the live rehearsal checklist.
The runbook below is the recording story; the checklist is the observable
proof list before you press record.

Run the quick gates:

```bash
npm run demo:goal-audit:test
npm run director-fresh-draft-intent:test
npm run minimal-ui:test
npm run current-project-ui-closed-loop:test
npm run current-project-preview-ui-runtime-closed-loop:test
```

For a fuller confidence pass, run:

```bash
npm run demo:ready:test
```

Start the local app:

```bash
npm run dev:full
```

Open:

```text
http://127.0.0.1:5174/
```

`dev:full` will reuse an already-running local runtime API on
`127.0.0.1:8790` and start only the missing dev server. This avoids the common
demo problem where a stale runtime process makes the front end fail to start.
If `5174` is already occupied, `dev:full` checks whether the existing Vite
server is fresh enough for recording. If it reports a stale frontend, stop the
old Vite process using the PID and `kill` command printed by the terminal,
rerun `npm run dev:full`, then verify the canonical recording URL with:

```bash
VIBE_FRONTEND_URL=http://127.0.0.1:5174/ npm run demo:artifact-freshness:test
```

If macOS or the current shell refuses the printed `kill` command, close the old
terminal tab that started Vite, or quit the matching Node/Vite process from
Activity Monitor, then rerun the same two commands above.

Avoid opening settings, diagnostics, provider credentials, or raw prompt files
while recording unless the segment is intentionally about engineering details.

## Suggested Demo Project

Use a small project with two or three video units. It is enough to show the
Agent loop without waiting on a long provider queue.

Paste this into the right Agent composer:

```text
做一个 10 秒的 90 年代日本 TV 动画风短片：深夜山路便利店外，一辆白色跑车和一辆黑色跑车准备起跑。便利店霓虹灯闪烁，雨后路面反光，低机位扫过车灯、轮胎和湿地，最后两辆车冲出弯道。整体紧张但克制，不要真人写实，不要 3D 游戏感。先帮我拆镜头、判断需要哪些参考素材，不要提交视频。
```

If a live provider queue would slow down the recording, show the returned
two-video evidence project instead:

```bash
npm run seedance-two-video-evidence:test
```

The evidence project path is:

```text
/Users/lichenhao/Desktop/new vibe directing/tmp/two-video-real-v6-20260602-175853
```

## Recording Flow

1. Open or create a local project folder.
2. Point out the three-column contract: left project, center results, right
   Agent conversation.
3. Paste the project idea and send it.
4. Show the Agent reply: what it understood, what it will do, what still needs
   confirmation, and which Skills it recommends. The confirmation card should
   read like a short Agent reply, for example: "I am about to change this shot;
   this will not submit video until you confirm."
5. Show reference generation and review:
   - character / object / scene references;
   - storyboard references when the Agent chooses storyboard mode;
   - voice reference only when a human voice sample is uploaded.
6. Explain the three internal production skills:
   - `omni_reference`: simple action with scene, character, and object anchors.
   - `storyboard_narrative`: ordered story progression and emotional beats.
   - `storyboard_rapid_cut`: dense action, quick cuts, or commercial rhythm.
   Keep this short on screen: the right rail shows the three Skill groups first,
   and the longer Skill explanation can stay folded unless you want to point at
   the exact rules.
7. Show the review/lock step.
8. Show Seedance submit readiness and serial queue status.
9. Select a shot or asset, then say "这个不对，重做这个" or a targeted
   change. Show that the Agent knows what "this" refers to.
10. If a returned clip is available, show preview and export readiness.
11. Close by showing that the project lives in a folder with `Project.vibe`.

## Talk Track

Opening:

```text
现在 AI 已经能生成很漂亮的画面，但普通用户和有影视经验的人之间，差距往往还在分镜、镜头调度、叙事节奏和声音设计。Vibe Director 想解决的是这件事：把导演方法做成一套 Agent skills，让用户不用懂完整流程，也能让大模型做出更像被导演过的表达。
```

When showing the input:

```text
我不希望用户去理解一堆按钮。用户只需要在右侧跟 Agent 说话，或者把脚本、图片、声音参考拖进来。Agent 会判断这是角色、场景、道具、故事板还是声音参考。
```

When showing skills:

```text
这里不是固定工作流。Agent 会根据内容选择不同生产技能：简单镜头走全能参考，叙事段落走故事板叙事，快切动作走故事板快切。visible clips 是最终视频里的剪辑数，storyboard panels 是给模型看的规划图，action beats 是镜头内部的动作节点。
```

When showing review:

```text
生成前会先经过规则 QA 和文本 QA，尽量把明显不该提交给模型的问题拦下来，比如把车灯、轮胎、手部这种局部细节误拆成独立资产，或者把故事板标注泄漏到最终视频里。
```

Closing:

```text
这个 demo 目前先收在视频前后闭环：项目、参考、故事板、串行视频队列、预览和导出。后续会继续把它做得更像一个真正管理长视频项目的 Agent，而不是半自动工作流。
```

## What Not To Claim

- Do not claim local TTS, voice cloning, automatic BGM mixing, or music rhythm
  analysis is part of the current main demo.
- Do not claim Seedance always returns instantly. The real provider queue can
  take a long time.
- Do not claim image QA is fully multimodal. Current QA is focused on text and
  rule checks.
- Do not present `Project.vibe` as a cache. It is the durable project contract.

## If Something Goes Wrong

- If the UI looks stale, restart the dev server and reload the browser.
- If the right Agent rail looks stale, restart the dev server and reload the
  browser. Avoid switching between old `localhost` and `127.0.0.1` tabs.
- If references are already usable but the right rail still asks to
  `确认生成参考`, reload once. The expected state is a `参考可用` result card
  plus next actions, not another reference-generation confirmation.
- If a project picker or modal covers the Agent composer, close the picker
  first; project selection is intentionally modal.
- If Seedance is still queued, show serial queue status and use the two-video
  evidence project for returned-clip proof.
- If a generated reference is wrong, treat it as a review moment: reject or ask
  the Agent to regenerate instead of hiding the issue.
