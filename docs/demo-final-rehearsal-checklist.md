# Demo Final Rehearsal Checklist

Updated: 2026-06-20

Use this checklist before recording or handing off the current Vibe Director
demo. It is intentionally operator-facing: every item should be observable in
the app, a terminal command, a local file, or a returned provider artifact.
Record the observed run in `docs/demo-frontend-rehearsal-record.md`; do not
count a source-code gate as a substitute for the visible app rehearsal.

## Scope

This rehearsal proves the current Agent-first short-project loop:

```text
new local project -> Agent plan -> Skill recommendation -> selected-shot edit
-> reference review -> Seedance request -> serial submit/query -> preview
-> showcase export
```

It does not prove long-drama autonomy, local TTS, music rhythm planning,
multimodal image QA, or fully automatic batch production.

## 1. Start Clean

- Start from `/Users/lichenhao/Desktop/new vibe directing`.
- Run `npm run dev:full`.
- If `dev:full` says the existing frontend is stale, stop the old Vite process
  with the printed `kill` command, then run it again.
- If the shell refuses `kill`, close the terminal tab that owns Vite or quit the
  matching Node/Vite process in Activity Monitor.
- Run `VIBE_FRONTEND_URL=http://127.0.0.1:5174/ npm run demo:artifact-freshness:test`.
- Open `http://127.0.0.1:5174/`.
- Confirm the app shows the three-column contract:
  - left: project navigation;
  - center: story, reference, video, and export results;
  - right: Agent conversation.
- Confirm the right composer has a visible `发送` button before typing.
- Confirm the send button is still named `发送` when disabled; disabled reasons
  should appear in the status/title copy, not replace the button itself.

## 2. Create A Fresh Project

- Use the project control menu to create or open a local project folder.
- The empty state should read like a creator prompt, not an engineering
  workflow screen.
- Paste a small idea into the right Agent composer.
- The first message should clear after sending.
- The Agent should reply with:
  - what it understood;
  - current project status;
  - selected context if any;
  - recommended next action;
  - confirmation boundary.

## 3. Confirm The Agent Boundary

- If the user asks for planning only, the Agent must not generate references or
  submit video.
- If an action will spend generation cost, the message flow must show a
  confirmation card first.
- If an action will submit Seedance/Jimeng, the card must say that it submits an
  external video task.
- The three permission modes must remain visible in creator language:
  `先整理`, `可补参考`, `可发视频`.

## 4. Check Selection Context

- Click a shot, asset, or returned video segment.
- The composer footer should say `这句话会引用：...`.
- Send a follow-up such as `这个不对，只规划，不生成参考，不提交视频。`
- The Agent reply must name the selected target instead of starting a new
  unrelated project.
- Recheck with a non-first shot such as `镜头 1-2`; the Agent should still bind
  `这个` to that selected shot, not the default or previous shot.

## 5. Check Skills

- The Skills area should stay compact.
- It should show exactly these user-facing groups first:
  - `当前项目已加载`;
  - `Agent 推荐`;
  - `我的 Skills`.
- Longer Skill details should stay folded unless the user opens them.
- The Agent should explain why a Skill is recommended and which shots or
  planning surfaces it affects.

## 6. Check References

- Ask the Agent to prepare references only after confirming the plan.
- Reference generation should be a confirmed action, not a silent background
  mutation.
- Once references are available, the right Agent message flow must not keep
  older `确认生成参考` confirmation cards visible. It should show the
  reference-ready result and the next action instead.
- The Agent should keep fine details folded into parent subjects or shot notes:
  headlights, wheels, hands, eye direction, rain, and one-frame actions should
  not become standalone reference assets by default.
- Reference results should be visible in the center workbench and summarized in
  the right message flow.

## 7. Check Seedance Request And Queue

- Compile video requests only after the project has enough approved reference
  material.
- Submit no more than one or two demo clips.
- Use Seedance VIP 720p for the live demo when queue time matters.
- Keep every live clip short, usually 4 seconds.
- Submit serially: do not submit a second clip until the first one has either
  returned or is explicitly left as queued evidence.
- The final Seedance prompt should end with `No music, no BGM, no subtitles.`
- The Agent or preview page must show submit id, queue/running/returned state,
  and local returned-video path when available.

## 8. Check Preview And Export

- Returned clips should appear in the preview page without requiring the user
  to hunt through raw runtime folders.
- The preview page should focus the latest returned or selected segment.
- The export page should explain what is ready, what is missing, and where the
  package will be written.
- The showcase package should include project data, prompts, references,
  submit receipts, returned clips, software screenshots, and a short flow note.

## 9. If The Provider Queue Is Slow

- Do not retry-subscribe or submit duplicate jobs.
- Show the serial queue state in the app.
- Use the packaged two-video evidence project or showcase package for returned
  clip proof.
- State clearly that the live provider queue is external and nondeterministic.

## Required Gates

Run this stack after any final UI, Agent, reference, video, or export change:

```bash
npm run demo:goal-audit:test
npm run showcase-package-audit:test
npm run demo:ready:test
npm run current-project-ui-closed-loop:test
npm run current-project-preview-ui-runtime-closed-loop:test
npm run director-skill-library:test
npx tsc --noEmit --pretty false
git diff --check
```
