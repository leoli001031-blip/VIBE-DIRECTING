# Vibe Director Studio P10-E packaged director workflow acceptance

Date: 2026-07-19

Status: **PASS FOR LOCAL/DRY-RUN PACKAGED ACCEPTANCE**.

This acceptance closes the selected P10 Agent-first director workflow with two
deterministic local media candidates. It validates the real packaged UI,
production projections and ledgers, local filesystem promotion/export, and
cold recovery. It does not call a model or media Provider.

## Accepted chain

1. `Review` exposes one `needs_review` result and one focused Agent turn.
2. `需要修改` preserves the original candidate and enters structured revision.
3. `Clarify` resolves intent without creating a generation job.
4. `Proposal` stages the revision and requires its own confirmation.
5. The confirmed local/dry-run action restores as one `Running` job without
   Provider submission or automatic retry.
6. A second deterministic local result forms an identity-complete A/B pair.
7. Winner selection writes an independent selection receipt.
8. Project-fact promotion requires a second, exact confirmation and creates a
   new fact hash.
9. Delivery requires its own export confirmation and packages only the promoted
   winner.
10. Cold start restores the completed package with one idle current task and no
    stale actionable confirmation.

## Packaged fixture

- QA root: `/tmp/vibe-director-p10-e-20260719-lqHliu`
- project root:
  `/tmp/vibe-director-p10-e-20260719-lqHliu/projects/p10-e-packaged-director-workflow`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project id: `p10_e_packaged_project`
- shot id: `P10ES01`
- source fact hash: `pv_efadc4ac`
- promoted fact hash: `pv_53bee4bc`

The profile, projects, runtime, and project roots were created under a fresh
`/tmp` fixture. Provider credentials were unset, live submission was disabled,
and the authenticated acceptance control used an ephemeral token.

## State matrix

| Surface | Accepted state |
| --- | --- |
| Candidate A | `needs_review_historical` |
| Candidate B | `needs_review_historical` |
| Winner selection | `selected` |
| Project fact | `promoted` |
| Delivery | `delivered` |
| Generation mode | `dry_run` / local fixture |
| Provider execution | `not_verified` |

Candidate A SHA-256:
`44f307d58d3404952d98d1933f1771e632c8db500355878cebdd35b837832d6f`

Candidate B and delivered media SHA-256:
`0a8586e8445e1c4285910b413b273a02e4ef25e97863c12af561ccf166e7f544`

Both source candidates remain byte-identical. The losing candidate remains
historical and is not copied into Delivery.

## Identity and confirmation boundaries

- Candidate A job:
  `agent_video_job_p10_e_initial_review_plan_submit_video_001`
- Candidate B job:
  `agent_video_job_review_regeneration_proposal_agent_video_P10ES01_1289dfec_submit_video_002`
- Selection receipt:
  `review_selection_receipt_review_selection_confirmation_review_pair_P10ES01_e7cf315e_b_001`
- Promotion confirmation and promotion receipt use distinct identities from
  selection and remain bound to the exact project, fact, pair, winner, source
  receipt, output path, and output hash.
- Delivery action: `footer_project_export`
- Delivery confirmation: `footer_action_export`
- Delivery execution receipt: `agent_video_execution_receipt_footer_action_export`

Selection does not mutate `Project.vibe`, Visual Memory, or Delivery. Promotion
does not export. Delivery does not select or promote. Replays and stale facts
fail closed.

## Delivery result

- Published root: `exports/current-project`
- Published entries: `16`
- Only media source: `video/P10ES01-version-b.mp4`
- Copied media: `exports/current-project/final-video/01_P10ES01.mp4`
- The manifest and Delivery receipt bind the promoted fact and winner B hash.
- The package contains no absolute fixture root and no `.vibe-staging` files.
- Cold restart leaves the package byte-identical and does not rewrite it.

`executionMode: live` in the Delivery receipt means a real local filesystem
write occurred. It does not mean a Provider was called.

## Packaged and visual observations

- At every observed workflow stage, the Agent rail projected exactly one current
  task or one focused turn; old Review, Confirmation, Selection, Promotion, and
  Delivery cards did not reclaim focus.
- Desktop `1440 x 900` and constrained `900 x 760` had no horizontal page
  overflow, clipped Review button copy, or buttons outside the focused turn.
- The focused turn can shrink and scroll at constrained height, so the composer
  remains inside the Agent panel.
- Composer copy does not overlap file/send buttons.
- Restored material facts use a full-width summary plus readable two-column
  facts; no narrow vertical label or history-card overflow remains.
- Cold restore projects one `idle` current task, zero focused turns, and zero
  stale actionable confirmations.

Screenshots:

- `docs/evidence/p10-e-packaged-director-workflow-20260719/01-running-desktop.png`
- `docs/evidence/p10-e-packaged-director-workflow-20260719/02-version-review-desktop.png`
- `docs/evidence/p10-e-packaged-director-workflow-20260719/03-version-review-constrained.png`
- `docs/evidence/p10-e-packaged-director-workflow-20260719/04-delivery-confirmation-desktop.png`
- `docs/evidence/p10-e-packaged-director-workflow-20260719/05-delivered-cold-restore.png`

Structured evidence:

- `docs/evidence/p10-e-packaged-director-workflow-20260719/packaged-observation.json`

## Verification

Passed:

- `npm run agent-director-review-decision:test`
- `npm run agent-director-clarification:test`
- `npm run agent-director-review-regeneration:test`
- `npm run agent-director-review-version-pair:test`
- `npm run agent-director-review-selection:test`
- `npm run agent-director-delivery-handoff:test`
- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
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
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `npm run p10-e-packaged-acceptance:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Limits

- Provider calls: `0`
- Provider fees: `0`
- Original user projects or media changed: `false`
- Real model submission, polling, and Provider result recovery: not verified
- Package signing: local ad-hoc only; no Developer ID, notarization, App Store,
  or public release claim is part of this acceptance

## Final gate

P10 local/dry-run packaged acceptance PASS

Real Provider execution NOT VERIFIED
