# Historical Demo Handoff

> This document records the pre-P13 demo scope. Use
> `docs/CURRENT-STATUS.md` for current implementation and acceptance facts.

# Vibe Director Studio Demo Handoff

Current demo scope is frozen around the creator-facing loop:

1. Create or open a local project folder.
2. Send one natural-language script / idea through the right-side Agent
   composer.
3. Let AI plan shots and choose one of three reference strategies:
   - `storyboard_narrative`
   - `storyboard_rapid_cut`
   - `omni_reference`
4. Generate reusable character / scene / prop / storyboard references.
5. Review and lock references.
6. Submit Seedance video jobs serially after the plan is confirmed.
7. Export a reviewable package.

Do not expand scope before the demo is stable. TTS, music rhythm, web search, image QA, and advanced project management are follow-up lanes unless the user explicitly asks.

For recording, use `docs/demo-recording-runbook.md` as the current operation
script. This handoff file is the engineering scope summary; the runbook is the
creator-facing demo flow.

For the shortest current-state read, use
`docs/agent-kernel-v1-demo-status.md`. It says what the demo can claim, what is
bounded, and what should not be promised yet.

Before recording, walk through `docs/demo-final-rehearsal-checklist.md`. It is
the operator-facing proof list for fresh project setup, Agent messages, Skills,
references, serial Seedance submit/query, preview, and export.

## Fast Demo Guardrail

Run this after changing planner, prompt compiler, reference generation, review tray, or minimal UI:

```bash
npm run demo:ready:test
```

It covers:

- three strategy routing;
- rule QA and text QA;
- storyboard reference prompt / Seedance prompt contract;
- current-project Image2 asset generation projection;
- creator desk review and lock projection;
- minimal creator-facing UI language;
- TypeScript compile.

## Known Non-Blocking Items

- Real Seedance queue recovery still needs occasional long-running provider
  validation.
- `core-runtime` bundle is still large; it is a warning, not a demo blocker.
- Packaged app uses local ad-hoc signing, not notarization.
- Project management is usable but still not as smooth as Codex-style recent project switching.

## Current High-Value Next Step

Run one small fresh project through the UI up to video submission. If a problem appears, add a regression test before fixing it.
