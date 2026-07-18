# Vibe Director Studio P10-D9 Delivery handoff acceptance

Date: 2026-07-19

Status: **PASS FOR P10-D9 LOCAL PACKAGED DELIVERY ONLY**.
This acceptance covers the promoted-winner handoff into the existing Delivery
Gate, one explicit local export confirmation, atomic packaged export, and cold
recovery. It does not call a Provider, generate media, publish, or validate a
real paid execution.

## Accepted scope

1. Delivery reads only identity-complete `agent_video_promotion` receipts from
   the current `Project.vibe` fact.
2. An unselected candidate, loser, `needs_review` result, stale fact,
   cross-project root, unsafe path, reused hash, or incomplete identity fails
   closed.
3. A promotion receipt does not authorize export. Delivery exposes a separate
   `确认导出` boundary and writes nothing before that confirmation.
4. Preview and CreatorDesk receive the promoted winner as `approved`,
   `returned`, and `reviewRequired=false`; it is not shown as a new review
   candidate.
5. The P9 export worker retains its existing hash preflight, project-relative
   manifest, atomic staging/publish, and structured Delivery receipt.
6. Cold start restores the terminal export completion and does not recreate an
   old Review, Selection, Promotion, or Export confirmation.

## Packaged fixture

- QA root: `/tmp/vibe-director-p10-d9-20260719-p2DIK2`
- project root:
  `/tmp/vibe-director-p10-d9-20260719-p2DIK2/projects/p10-d9-delivery-handoff`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project id: `p10_d9_packaged_project`
- shot id: `P10D9S01`
- source fact hash: `pv_daf62376`
- promoted fact hash: `pv_c4e69005`

All launches used fresh `/tmp` profile, projects, and runtime roots; the
test-only acceptance control required an ephemeral token. Provider credentials
were unset.

## Version identity

Version A remains in the source project as the historical loser:

- job: `p10d9_job_a`
- action: `p10d9_action_a`
- receipt: `p10d9_generation_receipt_a`
- output: `video/P10D9S01-version-a.mp4`
- SHA-256:
  `44f307d58d3404952d98d1933f1771e632c8db500355878cebdd35b837832d6f`

Version B is the exact selected and promoted winner:

- job: `p10d9_job_b`
- action: `p10d9_action_b`
- receipt: `p10d9_generation_receipt_b`
- output: `video/P10D9S01-version-b.mp4`
- SHA-256:
  `0a8586e8445e1c4285910b413b273a02e4ef25e97863c12af561ccf166e7f544`
- version pair: `review_pair_P10D9S01_704b14c6`

The local fixture constructs the pair, selection receipt, independent
promotion confirmation, and Project.vibe promotion through the production core
contracts. No Provider adapter is invoked.

## Packaged result

- **PASS**: before confirmation, the right Agent has exactly one `export`
  current task and one enabled `确认导出` button.
- **PASS**: old Review, Selection, and Promotion cards are absent.
- **PASS**: the project rail reports `参考 1 张` and `视频 1 可预览`; the promoted
  result is not mislabeled `needs_review`.
- **PASS**: opening Delivery does not create `exports/current-project`.
- **PASS**: clicking the exact confirmation once creates one local export and
  one succeeded execution receipt.
- **PASS**: the Delivery receipt binds project id, canonical root, promoted fact
  hash, export action, export confirmation, promotion receipt, source receipt,
  output path, and output SHA-256.
- **PASS**: the published package contains 15 manifest/report files and one
  copied MP4. Its only media source is version B.
- **PASS**: copied media SHA-256 equals version B; version A is absent from the
  package and unchanged in the source project.
- **PASS**: package documents do not contain the absolute `/tmp` project root.
- **PASS**: no staged files remain after publish.
- **PASS**: cold start restores one `idle` current task, no export confirmation,
  and byte-identical package files.
- **PASS**: Runtime token enforcement remains enabled and Provider calls remain
  zero on both launches.

## Delivery receipt

- execution receipt: `agent_video_execution_receipt_footer_action_export`
- action: `footer_project_export`
- confirmation: `footer_action_export`
- Delivery receipt:
  `export_delivery_footer_project_export_footer_action_export`
- execution mode: `live` local filesystem execution
- Provider called: `false`
- review binding count: `1`
- output count: `16`

Here `live` means the existing Electron filesystem adapter wrote a real local
package. It does not mean a Provider was called.

## Evidence

- Packaged observation and complete receipt:
  `docs/evidence/p10-d-delivery-handoff-20260719/packaged-observation.json`

## Verification

Passed:

- `npm run agent-director-delivery-handoff:test`
- `npm run agent-director-review-selection:test`
- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run export-worker:test`
- `npm run preview-export-audio-e2e:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run p10-d9-packaged-acceptance:test`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Gate

P10-D9 is accepted for local packaged Delivery handoff and export. The promoted
winner is the only deliverable media, every confirmation boundary remains
independent, the loser is preserved, and Provider calls and fees are zero.
P10-E full-chain packaged acceptance remains the next stage. Real Provider
execution remains unverified.
