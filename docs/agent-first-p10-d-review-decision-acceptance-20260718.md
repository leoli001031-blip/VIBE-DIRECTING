# Vibe Director Studio P10-D Review Decision acceptance

Date: 2026-07-18

Status: **PASS FOR FIFTH VERTICAL SLICE ONLY**. This acceptance covers the
local/dry-run decisions `通过预览` and `需要修改` for one exact returned video.
It does not authorize or claim Provider execution, retry, A/B comparison,
project-fact promotion, Delivery execution, or export.

## Accepted scope

1. `通过预览` binds the exact project id, canonical project root, project fact
   hash, job id, action id, shot id, source receipt id, output path, and output
   SHA-256.
2. Approval appends one deterministic `agent_video_preview` Review Receipt and
   performs no project-fact promotion.
3. Replaying the same identity returns the existing receipt with
   `idempotent=true` and `writePerformed=false`.
4. `需要修改` persists one structured revision intent, retains the returned
   result, and returns the Director turn to Clarify without creating a job.
5. Cold restart restores an unresolved revision intent, while an approved
   result does not restore its old Review turn.
6. Passive project status cannot create a second Review turn or replace an
   unresolved revision intent.

## Packaged fixtures

- QA root: `/tmp/vibe-director-p10-d5-20260718-r1.dozQHo`
- revision project:
  `/tmp/vibe-director-p10-d5-20260718-r1.dozQHo/projects/p10-d5-revision`
- approval project:
  `/tmp/vibe-director-p10-d5-20260718-r1.dozQHo/projects/p10-d5-approval`
- approval profile and runtime:
  `/tmp/vibe-director-p10-d5-20260718-r1.dozQHo/profile-approval-r4`
  and
  `/tmp/vibe-director-p10-d5-20260718-r1.dozQHo/runtime-approval-r4`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project id: `current_project`
- project fact hash: `pv_cc4049f3`
- job id: `p10d4_job_p6s01_local_return`
- action id: `p10d4_action_p6s01_local_return`
- shot id: `P6S01`
- source receipt id: `local_return_receipt_p10d4_p6s01`
- output path: `video/P6S01.mp4`
- output SHA-256:
  `6c1cc9d172160c36634d19ba84839b5738a5c9be3a862c1a1928d46535a135f1`
- execution mode: `dry_run`

The packaged processes were launched with fresh `/tmp` profiles, isolated
runtime workdirs, a test-only token-protected acceptance-control port, and no
Provider credentials in their environment.

## Request changes

- **PASS**: the initial packaged Review exposes one enabled `需要修改` action.
- **PASS**: clicking it appends revision intent
  `revision_agent_video_P6S01_3ed6b746` to the Agent timeline.
- **PASS**: the intent status is `clarify`; the composer is prefilled with
  `P6S01 需要修改：`.
- **PASS**: `originalResultPreserved=true`.
- **PASS**: `generationJobCreated`, `providerCalled`, `projectFactsMutated`, and
  `exportTriggered` are all `false`.
- **PASS**: the project file, media, and ledger stay unchanged. Only the Agent
  timeline changes, to SHA-256
  `86e90b0a1fc810d348b60d6a78078de40ae7a231c8ac0659524eab8ae5cd63db`.
- **PASS**: cold restart restores exactly one `当前视频修改意图`; the old Review
  and passive export status do not take focus.

## Approve preview

- **PASS**: one click creates exactly one strict receipt:
  `review_agent_video_P6S01_ff2b8212`.
- **PASS**: all nine identity fields match the returned generation result.
- **PASS**: the stored output path is project-relative and its SHA-256 matches
  the returned media.
- **PASS**: `humanReviewed=true`, `promotionAuthorized=false`, and the receipt
  decision scope is `agent_video_preview`.
- **PASS**: assets, visual memory, shots, generation ledger, Agent timeline,
  media, and export state do not change.
- **PASS**: exact replay through the token-protected Runtime API returns HTTP
  200, `idempotent=true`, `writePerformed=false`,
  `promotionOperationCount=0`, `projectFactsPromoted=false`, and
  `exportTriggered=false`.
- **PASS**: cold restart and an explicit return to the Video view show zero
  `当前视频复核` turns and zero Review buttons. The next passive task may be
  `导出交付包`, but it was not confirmed or executed.

Approval artifact hashes after exact replay and cold restart:

- `project.vibe`:
  `888c73cbb43aac2fdc129f88896887061edba4f06161577320f41206f24d0fd0`
- generation ledger:
  `fc9e8619c06d561d239df2ceedf76122d62f31a99997647c27a94e8223078679`
- Agent timeline:
  `0fb131d88d111da165ab1b67e30ca8088aea6ffc1abd490a9a94a1d6c5bfe465`
- returned MP4:
  `6c1cc9d172160c36634d19ba84839b5738a5c9be3a862c1a1928d46535a135f1`

The project fact hash remains `pv_cc4049f3`; the `project.vibe` byte change is
the single Review Receipt and its source-index reference.

## Defects closed

1. The packaged Review Decision route received `existsSync` on the adjacent
   Asset Status factory instead of its own factory. Strict ledger validation
   therefore failed before reading a valid ledger. The dependency is now wired
   to the correct route and required at factory creation.
2. The generic ledger catch hid that wiring error. It now retains the local
   failure reason while continuing to fail closed.
3. After approval, the panel recovered the still-immutable `needs_review`
   result from the generation ledger without consulting the strict Review
   Receipt. Exact approved-receipt matching now suppresses only the same result.
4. A blocked Submit Video confirmation could render a second Review card because
   visibility checked the mode but not the Director phase. Review rendering is
   now restricted to `phase=review`.
5. Revision-intent persistence now rejects on a failed timeline save, so the UI
   cannot claim that a modification request survived cold restart when it did
   not.

## Runtime boundary

Both approval and cold-restart status checks reported:

- `tokenRequired=true`
- `providerCalled=false`
- `liveSubmitAllowed=false`
- `videoSubmitted=false`
- `workerSpawnForbidden=true`

No Provider task, network generation request, retry, approval-to-fact promotion,
Delivery action, or export was triggered.

Computer Use could see Vibe Director Studio but targeted the user's already-open
default instance rather than the isolated acceptance instance. The D5 packaged
evidence therefore uses the app's test-only token-protected control and an
isolated local renderer-debugging port. This is recorded as a multi-instance
targeting limitation, not as product behavior evidence from Computer Use.

## Evidence

- Initial Review:
  `docs/evidence/p10-d-review-decision-20260718/01-packaged-review-before-decision.png`
- Request changes:
  `docs/evidence/p10-d-review-decision-20260718/02-packaged-request-changes.png`
- Request changes cold restart:
  `docs/evidence/p10-d-review-decision-20260718/03-packaged-request-changes-cold-restart.png`
- Preview approved:
  `docs/evidence/p10-d-review-decision-20260718/04-packaged-preview-approved.png`
- Preview approved cold restart:
  `docs/evidence/p10-d-review-decision-20260718/05-packaged-preview-approved-cold-restart.png`

## Verification

Passed:

- `npm run agent-director-review-decision:test`
- `npm run agent-director-turn-projection:test`
- `npm run agent-current-task-projection:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-timeline:test`
- `npm run project-vibe:test`
- `npx tsx scripts/current-project-preview-projection-test.mts`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run runtime-api-current-project-review-decision:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Gate

P10-D5 is accepted for this local/dry-run vertical slice. Stop here. P10-D6,
Provider execution, A/B comparison, project-fact promotion, Delivery, and export
remain separately bounded work and were not entered.
