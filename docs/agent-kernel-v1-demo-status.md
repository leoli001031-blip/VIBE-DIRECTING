# Agent Kernel v1 Demo Status

Updated: 2026-06-21

This is the short handoff for the current Vibe Director demo. It does not
replace the detailed audit or recording runbook; it points to them.

## Current Product Shape

The demo is now framed as:

```text
Left: manage project.
Center: review story, references, video, and export.
Right: talk to the Agent.
```

The right Agent rail is the main interaction surface. The creator should be
able to type an idea, point at a shot or asset, say "这个不对", confirm costly
actions, and see the Agent explain what changed.

## Demo-Ready Claims

- The Agent message flow shows user input, understanding, selected context,
  proposed actions, confirmation cards, running/result cards, errors, and next
  suggestions.
- The composer keeps a visible `发送` button; Command Enter is only a shortcut.
- The three permission modes are visible in creator language: `先整理`,
  `可补参考`, and `可发视频`.
- The Agent can scan a project folder, classify common materials, explain
  reference gaps, and suggest bindings.
- Detail-only materials such as headlights, wheels, hands, eye direction, rain,
  or one-frame actions stay folded into parent subjects or shot notes by
  default.
- Skills are visible as `当前项目已加载`, `Agent 推荐`, and `我的 Skills`.
- Seedance requests are compiled with separated reference roles, serial submit
  expectations, queue/return status, and final `No music, no BGM, no subtitles.`
  policy.
- Showcase evidence and recording material are packaged under
  `showcase-package/`.

## Bounded Claims

- This is demo-ready for short projects.
- Seedance provider queues are external and nondeterministic.
- Live video submission should use one or two short clips, preferably Seedance
  VIP 720p during recording.
- Project hierarchy is ready for short projects; long-drama chapter/sequence
  continuity remains a future lane.

## Current Recording Note

The canonical browser recording URL is `http://127.0.0.1:5174/`. If
`npm run dev:full` says the existing frontend is stale, stop the printed PID
and rerun the launcher. The current shell may refuse `kill`; in that case close
the terminal tab that owns Vite or quit the matching Node/Vite process from
Activity Monitor. Then run:

```bash
VIBE_FRONTEND_URL=http://127.0.0.1:5174/ npm run demo:artifact-freshness:test
```

Only record once that live freshness check passes.

## Final Canonical Browser Check

The stale `5174` Vite process has been cleared. The canonical live page at
`http://127.0.0.1:5174/?case=codex-browser-final-smoke-5174&ts=1781983487030`
passed the in-app Codex browser smoke on 2026-06-21:

- `VIBE_FRONTEND_URL=http://127.0.0.1:5174/ npm run demo:artifact-freshness:test`
  passed against the live frontend.
- The right Agent rail was operable in the Codex browser.
- The composer kept one visible `发送` button, enabled after text entry and
  cleared after sending.
- An explicit explain-only message was routed as project reading: no project
  write, no reference generation, and no video submission.
- The live page still showed the three creator-facing permission modes:
  `先整理`, `可补参考`, and `可发视频`.

## Do Not Claim Yet

- Full autonomous long-drama production.
- Multimodal image QA.
- Local TTS, voice cloning, final music mixing, or music rhythm analysis as the
  main demo path.
- A Skill marketplace or full long-project knowledge graph.

## Where To Look

- Full completion audit: `docs/agent-first-demo-completion-audit.md`
- Live rehearsal checklist: `docs/demo-final-rehearsal-checklist.md`
- Frontend rehearsal record: `docs/demo-frontend-rehearsal-record.md`
- Recording script: `docs/demo-recording-runbook.md`
- Showcase package index: `showcase-package/DEMO_INDEX.md`

## Final Gates

Run before recording or handoff:

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
