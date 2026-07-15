# Agent-first P7-B review gate closure

Date: 2026-07-15

Status: PASS for preview-only human approval and packaged cold-start recovery.

Readiness label:
`P7 Review Gate closed; P6S01 preview-approved only; export remains unconfirmed`.

## Human decision

The user approved P6S01 for preview only. This decision does not authorize:

- promotion into an asset, locked visual memory, or reusable project fact;
- export;
- another provider submission, retry, or image generation.

The packaged App wrote one human review receipt:

- receipt: `review_P6S01_20260715064610`
- status: `approved`
- reviewer: `local_user`
- shot: `P6S01`
- source receipt:
  `seedance_submit_d2c02c02-1c3d-4763-af77-d60816f642cb`
- project-relative media:
  `video/seedance_2026-07-14T14-03-45-563Z/video/d2c02c02-1c3d-4763-af77-d60816f642cb_video_1.mp4`
- output SHA-256:
  `bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`
- `humanReviewed=true`
- `promotionAuthorized=false`

## Project-fact boundary

Before and after approval, the project retained:

- 8 asset records with the same ids;
- 8 visual-memory entries with the same ids;
- the same P6S01 shot fields and `status=blocked`;
- zero export batch receipts.

No `exports` directory exists in the accepted project. The only formal project
change was the hash-bound review receipt. The provider media hash remained
unchanged.

## Root cause and minimal closure

Two projection gaps previously let the packaged App show export before the
human review decision was recorded:

1. `AgentCurrentTaskProjection` accepted reference review counts but not video
   review counts, so a returned `needs_review` video could fall through to the
   export pipeline step.
2. The Preview projection did not consume persisted `Project.vibe` review
   receipts, so a preview-only approval could not reliably clear the old review
   overlay after restart.

The closure adds only structured review state:

- exact shot, project-relative path, source receipt, and output-hash matching;
- preview approval clears only the Preview review overlay and records the
  matching review receipt id;
- production QA is not relabeled as approved;
- a positive video review count projects `复核视频` ahead of export with no
  provider, generation, or export effect;
- returned and pending-review counts are passed to the Agent rail without
  parsing display copy.

## Packaged App acceptance

The rebuilt packaged App used the existing isolated profile and project at
`/tmp/vibe-director-p6c-live-20260714-r4`.

Observed before approval:

- project connected with one shot and one returned video;
- Preview showed `待复核` and one `通过` action;
- right Agent current task was `复核视频`;
- the old export confirmation did not own the current task.

Observed after the single approval click:

- Preview changed from `1 待看` to `1 可预览`;
- the `待复核` overlay and `通过` action disappeared;
- the App reported `已写入复核记录`;
- export appeared only as a separate confirmation and was not executed.

Observed after a same-profile cold restart:

- P6S01 remained `1 可预览`;
- `复核视频` did not return;
- the separate `导出交付包` confirmation remained waiting;
- no export files or receipts appeared.

The App and runtime were stopped after acceptance. No provider endpoint was
called during this closure.

## Verification

Passed without provider calls:

- `npx tsx scripts/current-project-preview-projection-test.mts`
- `npm run agent-current-task-projection:test`
- `npm run runtime-api-current-project-review-decision:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run current-project-seedance-mode-compiler:test`
- `npm run video-relay-queue:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npx tsc --noEmit --pretty false`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `git diff --check`

P7 Review Gate is closed for the selected preview-only decision. Export remains
a separate, unconfirmed action and requires fresh user authorization.
