# Vibe Director Studio Development Plan

## Product Direction

Vibe Director Studio is a lightweight director desk between a human creator and Codex. The app itself should not pretend to be the intelligence layer. Its job is to hold structure, context, constraints, visual memory, queue state, and audit results so Codex can execute a repeatable AI video workflow without losing key facts.

The first usable version should optimize for control and clarity, not visual polish.

## Current Build Scope

- Import an existing runtime test folder.
- Display production progress by assets, keyframes, videos, and blockers.
- Show Visual Memory as locked references, not as a general image dump.
- Show shots by act and expose per-shot gates.
- Generate a dry-run task envelope for the selected shot.
- Enforce provider policy before any formal generation.
- Keep Jimeng/Seedance video generation parked for now.

## Provider Policy

Image generation and image editing are locked to Image2.

- `image.generate`: active, Image2 only.
- `image.edit`: active, Image2 only.
- `image.reference_asset`: active, Image2 only.
- `video.i2v`: parked. Build task envelopes and queues only; do not submit live Jimeng/Seedance jobs in this phase.

Forbidden behavior:

- No image-to-image task may silently fall back to text-to-image.
- No rejected, temporary, or candidate asset may become future reference authority.
- No text-to-video fallback for video generation.
- No BGM should be requested from video generation; sound is handled in a later audio layer.

## Standard Workflow

1. Story facts
   - Define characters, locations, objects, scene order, and story function.

2. Visual memory
   - Create or import locked character reference.
   - Create or import locked scene master reference.
   - Create or import locked prop reference when needed.
   - Mark every asset as locked, candidate, needs review, or missing.

3. Shot layout
   - Each shot must know act, scene, view, story function, characters, props, camera intent, and start/end frame requirements.

4. Start/end frames
   - Start frame uses locked visual memory.
   - End frame normally derives from start frame.
   - Exceptions require explicit location or time transition.

5. QA gates
   - identity gate
   - scene gate
   - pair gate
   - story gate
   - prop gate
   - style gate

6. Video queue
   - Only after pair QA passes.
   - Current version only parks Jimeng/Seedance tasks; no live submit.

7. Preview/export
   - Preview is locked until clips exist and video QA passes.
   - Export should support complete rough cut and batch material export later.

## UI Shape

- Top bar: project identity, import, dry check, mock generate.
- Metrics: assets, keyframes, videos, blockers.
- Workflow rail: production bible, visual memory, keyframe pairs, provider policy, video provider, preview.
- Provider dock: Image2 active, Jimeng/Seedance parked.
- Left: Visual Memory.
- Center: act-aware shot board.
- Right: Director Panel.
- Bottom: audit log, task envelope, natural-language director input.

## Next Implementation Steps

1. Replace mock buttons with local file import controls.
2. Add task envelope export to JSON/Markdown.
3. Add project creation from a story document.
4. Add visual memory CRUD.
5. Add Image2 adapter bridge.
6. Add queue runner with resumable jobs and folder watch.
7. Add subagent audit packet generator.
8. Add preview timeline once video files exist.
9. Add parked Jimeng/Seedance adapter later, with no fast/VIP default and no live submit unless explicitly enabled.

