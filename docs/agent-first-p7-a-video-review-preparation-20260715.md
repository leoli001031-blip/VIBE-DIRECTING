# Agent-first P7-A video review preparation

Date: 2026-07-15

Status: READY FOR HUMAN DECISION. No approval, rejection, promotion, retry, or
export has been executed.

Follow-up: the user selected preview-only approval. The applied decision and
packaged cold-start evidence are recorded in
`docs/agent-first-p7-b-review-gate-closure-20260715.md`.

Readiness label:
`P7-A real video review prepared; awaiting explicit human decision`.

## Bound evidence

- shot: `P6S01`
- external task id: `d2c02c02-1c3d-4763-af77-d60816f642cb`
- model: standard `seedance2.0`
- requested output: 5 seconds, 720p, 16:9
- project-relative media:
  `video/seedance_2026-07-14T14-03-45-563Z/video/d2c02c02-1c3d-4763-af77-d60816f642cb_video_1.mp4`
- SHA-256:
  `bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`
- file size: 8,191,853 bytes
- probed media: H.264, 1280x720, yuv420p, 5.062 seconds, AAC audio
- review contract: `needs_review`, `returned_with_review_overlay`,
  `reviewRequired=true`

The real path resolves inside the project root. The calculated file hash
matches `seedance_resume_report.json`, `video_relay_queue.json`, and
`preview_plan.json`. The relay is terminal-complete with one completed item,
zero active items, no resume commands, and `autoSubmitAllowed=false`.

## Non-destructive review

Observed passes:

- one continuous visible shot with no extra cut, split screen, text overlay,
  subtitle, logo, watermark, or UI artifact;
- rooftop, wet ground, sunset lighting, school uniform, short dark hair, yellow
  bow, shoulder bag, and paper-plane identity remain coherent with the locked
  references;
- the character enters, crouches, and reaches toward the plane without an
  obvious identity swap or severe body discontinuity;
- an ffmpeg scene-change pass at threshold `0.30` detected zero hard-cut
  frames;
- resolution, aspect ratio, duration, codec, and project-relative output path
  match the requested delivery boundary.

Items needing a human decision:

- the final frame stops just before an unmistakable hand-to-plane touch, so the
  requested `触碰` action reads as reaching rather than completed contact;
- the paper plane has a cool bright edge but glows less strongly than the locked
  object reference;
- the rendering is coherent anime, but it is smoother and more contemporary
  than a strict low-detail 1990s TV-cel look;
- an AAC track exists. It is extremely quiet (`mean -57.3 dB`, `max -33.0 dB`)
  and no music was identified from the technical pass, but final listening is
  still part of human review.

## Recovery observation

After return, a fresh packaged-App start no longer restored `查询视频结果` as the
current task. The right rail projected `导出交付包` with a confirmation boundary
and copy directing the creator to preview first. No export was confirmed.

This ordering is the main P7 contract question: Preview/Export is allowed to
consume `needs_review` media, but a creator-facing export task now appears
before an explicit approve/reject decision. Treat that as a review-flow risk,
not as proof that the video was approved.

## Review options

1. Approve for preview: create a review receipt bound to this exact hash. Keep
   formal project-fact promotion and export as separate confirmed actions.
2. Request revision: require visible finger-to-plane contact, stronger blue
   emission/reflection, and the same character/scene continuity. Any new
   provider submission needs fresh explicit authorization and should use the
   recorded `720p + seedance2.0_vip` preference.
3. Reject without retry: retain the returned clip and evidence in review
   history, but do not expose it as a reusable project fact or export authority.

No option is selected by this preparation pass.

## Verification

Passed without provider calls:

- `npm run current-project-seedance-mode-compiler:test`
- `npm run video-relay-queue:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

The packaged App was stopped after the return and cold-recovery observations.
