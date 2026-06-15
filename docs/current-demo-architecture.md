# Current Demo Architecture

Updated: 2026-06-15

This document is the current demo-facing architecture reference. Older phase
docs remain useful background, but the product demo should be explained from
this file, `README.md`, and `docs/demo-recording-runbook.md`.

## Product Shape

Vibe Director is a local-first video director Agent desk. The user should not
need to understand the whole workflow. They give the Agent an idea, script, or
files; the app turns that into project facts, reference assets, storyboard
plans, video requests, status receipts, preview, and export state.

The demo target is:

1. Open or create a local project folder.
2. Type an idea or drop files into the bottom input.
3. Let the Agent classify materials and propose the next action.
4. Generate or review reference assets and storyboards.
5. Submit Seedance video jobs serially.
6. See queue, return, preview, and export status in one human-readable state.

## Canonical Project Root

Development work should use this repository:

```text
/Users/lichenhao/Desktop/new vibe directing
```

Created video projects live in user-selected project folders. Each durable
project is anchored by `Project.vibe`; generated runtime files are receipts,
derived assets, or provider evidence, not the source of truth.

## Frontend Layers

- `src/App.tsx` owns the high-level app state and runtime route calls.
- `src/ui/director/DirectorModeShell.tsx` renders the simplified director desk.
- `src/ui/director/NewVideoStart.tsx` handles the unified new-project input.
- `src/ui/app/projectStatusViewModel.ts` projects messy runtime state into a
  single user-facing status model.

The UI should expose one main input and a short action set: send, add file,
execute suggested action, open project, and settings.

## Demo Closeout Plan

The active demo line is intentionally narrow:

- P0 project entry: make the current project name, folder, and stage obvious.
- P1 interaction: bottom input is the main entry; scattered workflow buttons
  should collapse into one suggested action.
- P2 status: one human-readable status projection for stage, work, waiting
  state, next action, and error.
- P3 material binding: classify dropped files as character, scene, prop,
  storyboard, voice reference, script, or general reference.
- P4 voice reference: bind speaking-character audio as `voice_reference` and
  pass it to the video model only for voice identity, tone, mouth timing, and
  performance texture.
- P5 generation strategies: keep the three Agent-selected strategies stable and
  explain visible clips, storyboard panels, and action beats consistently.
- P6 video queue: submit Seedance serially, persist submit ids, recover after
  restart, and only continue after the previous shot returns.
- P7 debt cleanup: keep dependencies, scripts, runtime artifacts, docs, and
  bundle/CSS debt from blocking demo recording.

## Agent And Project State

The Agent works against local project facts rather than scattered UI state:

- `Project.vibe` is the durable project contract.
- staged plans and action logs represent proposed Agent changes before commit.
- rule QA and text QA catch planning/prompt mistakes before expensive provider
  calls.
- real provider calls remain credential-gated and action-confirmed.

The frontend should not separately explain real-chain, relay queue, preview item,
and provider receipts. Those sources are merged into the project status view.

## Reference Strategy

The current demo supports three Agent-selected video request strategies:

- `omni_reference`: simple single-shot action with clear character, scene, and
  object references.
- `storyboard_narrative`: story progression, camera order, and emotional beats.
- `storyboard_rapid_cut`: fast action, dense beats, or commercial-style cutting.

The contract terms are:

- `visibleClips`: final visible cuts in the video.
- `storyboardPanels`: panels in the storyboard reference image.
- `actionBeats`: internal movement or performance beats inside a visible clip.

Durations sent to the video model must be executable integer seconds. A single
storyboard should not combine unrelated scene spaces that need separate scene
authority.

## Asset Policy

Dropped files are classified into creator language:

- character reference
- scene/weather reference
- prop/object reference
- voice reference
- script/dialogue
- general reference material

Voice reference is attached to a character or speaking shot. It is used by the
video model for voice line, tone, mouth timing, and performance texture. It is
not BGM, music analysis, local TTS, voice cloning, or final audio mixing in this
demo phase.

Obvious music-like files or labels such as BGM, soundtrack, score, song,
eurobeat, 配乐, 音乐, or 歌曲 should not be auto-bound as character voice
references. They can be kept as general/post-production reference notes, but
they stay out of the video model request path in the demo.

Small parts such as headlights, tires, hands, gaze, weather, and body poses
should usually stay inside shot direction or prompt text instead of becoming
standalone reusable reference assets.

## Video Queue

Seedance/Jimeng submit stays serial:

```text
ready shot -> submit -> queued/running -> returned/failed -> next shot
```

Each submit record should preserve shot id, submit id, prompt, reference list,
status, and local return path. Restart recovery should query saved submit ids
before offering another submit.

The returned two-video demo project is tracked as local evidence, not as a
default unit gate:

```bash
npm run seedance-two-video-evidence:test
```

That check reads
`tmp/two-video-real-v6-20260602-175853/reports/video_relay_queue.json` and
`reports/preview_plan.json`, verifies serial completion, submit ids, prompt
paths, reference lists, mp4 paths, hashes, and confirms the current preview
projection can still show both returned clips.

## Cleanup And Verification

Generated runtime and test output can grow quickly. Use:

```bash
npm run runtime:prune
npm run runtime:prune:apply
```

`runtime:prune` is a dry run by default. Apply mode only removes scoped,
regenerable artifacts inside this repository.

Useful demo gates:

```bash
npm audit --audit-level=high
npm run scripts:groups
npm run minimal-ui:test
npm run current-project-ui-closed-loop:test
npm run current-project-seedance-mode-compiler:test
npm run seedance-two-video-evidence:test
npm run runtime:prune:test
npx tsc --noEmit --pretty false
npm run build
```
