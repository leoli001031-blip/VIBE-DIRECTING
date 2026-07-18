# Vibe Director Studio P10-D8 Review Selection acceptance

Date: 2026-07-19

Status: **PASS FOR P10-D8 LOCAL/DRY-RUN SELECTION AND PROMOTION ONLY**.
This acceptance covers durable winner selection, an independent project-fact
promotion gate, exact identity binding, cold recovery, and stale-fact
invalidation. It does not call a Provider, enter Delivery, or export.

## Accepted scope

1. Selecting a candidate first writes a durable, idempotent selection receipt.
2. Selection and project-fact promotion are two different confirmations with
   different confirmation and action identities.
3. Selection alone does not change `project.vibe`, Visual Memory, either media
   file, the generation ledger, or Delivery state.
4. Promotion requires the exact selected, human-reviewed winner, current fact
   hash, version pair, output path, and output SHA-256.
5. Promotion appends one `agent_video_promotion` receipt and produces a new
   project fact hash. It does not delete the losing candidate.
6. The old pair, selection confirmation, promotion confirmation, and generation
   ledger cannot become the current task after the fact hash changes.
7. Corrupt, stale, cross-project, wrong-hash, and replay identities fail closed.

## Packaged fixture

- QA root: `/tmp/vibe-director-p10-d8-20260719-5vGkej`
- project root:
  `/tmp/vibe-director-p10-d8-20260719-5vGkej/projects/p10-d8-review-selection`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project id: `p10_d8_packaged_project`
- shot id: `P10D8S01`
- source fact hash: `pv_de13842f`
- promoted fact hash: `pv_988bc5d5`
- source `project.vibe` SHA-256:
  `7bca59a826eaebee9f2600a19d71ca6b46bf4407d7161071fd06b691f3c3c766`
- promoted `project.vibe` SHA-256:
  `9bf9da58fd8898a7c924406197de07baeea90080dd5a8e322804db0f2e2029e0`

All packaged launches used fresh `/tmp` state, token-protected acceptance
control, and an environment with Provider credentials unset.

## Candidate identity

Version A remains historical:

- job: `agent_video_job_p10_d8_pair_plan_submit_video_001`
- action: `p10d8_action_a`
- result receipt: `p10d8_local_receipt_a`
- output: `video/P10D8S01-version-a.mp4`
- SHA-256:
  `44f307d58d3404952d98d1933f1771e632c8db500355878cebdd35b837832d6f`

Version B is the selected and promoted winner:

- job: `agent_video_job_p10_d8_pair_plan_submit_video_002`
- action: `p10d8_action_b`
- result receipt: `p10d8_local_receipt_b`
- output: `video/P10D8S01-version-b.mp4`
- SHA-256:
  `0a8586e8445e1c4285910b413b273a02e4ef25e97863c12af561ccf166e7f544`

Both candidates remain `dry_run`, `needs_review`, and
`providerCalled=false` in the immutable generation ledger.

## Packaged result

- **PASS**: `选择版本 B` creates one durable selection confirmation and does
  not change project facts.
- **PASS**: cold start restores exactly one `confirm_version_selection` task,
  the exact confirmation id, and no passive Review card.
- **PASS**: confirming selection writes one human-reviewed receipt with
  `promotionAuthorized=false`, then creates a different promotion confirmation.
- **PASS**: a second cold start restores exactly one
  `confirm_project_fact_promotion` task and its exact identity.
- **PASS**: explicit promotion appends one identity-complete Project.vibe
  receipt, changes the fact hash, and exposes no export action.
- **PASS**: the next cold start shows `prepare_references`; old A/B and
  confirmation cards remain absent.
- **PASS**: generation ledger and both candidate media hashes are unchanged.
- **PASS**: Runtime token enforcement remains enabled; Provider and live submit
  remain disabled.

## Contract coverage

Focused tests cover idempotent replay, A to B selection reversal, stale fact,
wrong output hash, cross-project identity, damaged selection sidecar, exact
promotion replay, and loser preservation.

## Evidence

- Packaged observation:
  `docs/evidence/p10-d-review-selection-20260719/packaged-observation.json`

## Gate

P10-D8 is accepted for local/dry-run selection and project-fact promotion.
Delivery and export remain separate and unverified until P10-D9. Real Provider
execution remains unverified and Provider calls and fees are zero.
