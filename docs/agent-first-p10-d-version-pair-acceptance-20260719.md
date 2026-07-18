# Vibe Director Studio P10-D7 Version Pair acceptance

Date: 2026-07-19

Status: **PASS FOR P10-D7 LOCAL/DRY-RUN VERSION PAIR ONLY**. This acceptance
covers strict A/B derivation, packaged inspection, candidate-choice boundary,
revision entry, cold recovery, and damaged-ledger fail-closed behavior. It does
not write a selection receipt, promote project facts, enter Delivery, export,
or call a Provider.

## Accepted scope

1. Two `needs_review` results form a pair only when project id, canonical
   project root, current fact hash, and shot id match.
2. Job, action, result receipt, output path, and output SHA-256 must all be
   distinct. Duplicate or incomplete identities fail closed.
3. `AgentCurrentTaskProjection` owns one `compare_versions` task. The Preview
   and Agent rail share the same active A/B candidate.
4. `查看 A`, `查看 B`, `选择版本`, and `需要修改` are available. Selection stops
   at a visible independent boundary; no receipt or promotion occurs in D7.
5. The original two jobs and media files remain immutable.
6. Cold start restores one pair without duplicate tasks or stale confirmation.
7. A malformed generation ledger exposes no A/B controls or Review turn.

## Packaged fixture

- QA root: `/tmp/vibe-director-p10-d7-20260719-Za4ii3`
- project root:
  `/tmp/vibe-director-p10-d7-20260719-Za4ii3/projects/p10-d7-version-pair`
- profile: `/tmp/vibe-director-p10-d7-20260719-Za4ii3/profile`
- runtime: `/tmp/vibe-director-p10-d7-20260719-Za4ii3/runtime`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project id: `p10_d7_packaged_project`
- project fact hash: `pv_240e033c`
- shot id: `P10D7S01`
- `project.vibe` SHA-256:
  `504c6b0fe59b3effd0a4f4966f9eab23392d4c119985f67e62bf18e36b316b54`
- generation ledger SHA-256:
  `08f7fce29fef8f68a63c05723b85a469578164da1f34d6b8702e30c642c45434`

The packaged launches used a fresh `/tmp` profile, the token-protected
loopback acceptance control, and an environment with all Provider credentials
unset.

## Candidate identity

Version A:

- job: `agent_video_job_p10_d7_pair_plan_submit_video_001`
- action: `p10d7_action_a`
- confirmation: `p10d7_confirmation_a`
- result receipt: `p10d7_local_receipt_a`
- output: `video/P10D7S01-version-a.mp4`
- SHA-256:
  `44f307d58d3404952d98d1933f1771e632c8db500355878cebdd35b837832d6f`

Version B:

- job: `agent_video_job_p10_d7_pair_plan_submit_video_002`
- action: `p10d7_action_b`
- confirmation: `p10d7_confirmation_b`
- result receipt: `p10d7_local_receipt_b`
- output: `video/P10D7S01-version-b.mp4`
- SHA-256:
  `0a8586e8445e1c4285910b413b273a02e4ef25e97863c12af561ccf166e7f544`

Both jobs are `dry_run`, `succeeded`, and carry exact `needs_review` result
identity. `providerCalled=false` and neither has an external task id.

## Packaged result

- **PASS**: initial launch projects exactly one `compare_versions` current task
  and one focused Review turn.
- **PASS**: B is the deterministic default; Preview A and Agent `查看 B` switch
  to different local media paths.
- **PASS**: `选择版本 B` opens `版本选择确认`, explicitly stating that no
  selection receipt, project-fact promotion, or export has occurred.
- **PASS**: project-fact promotion remains disabled and no export action appears
  inside the Review turn.
- **PASS**: cold restart restores one current task, one Review turn, one version
  switch, and no invented selection confirmation or promotion.
- **PASS**: `需要修改` replaces Review with one `说明修改方向` turn. It keeps
  the original result and creates no new generation task.
- **PASS**: a malformed ledger restores no version switch and no Review turn.
- **PASS**: Runtime reports token enforcement enabled, provider calls disabled,
  and live submit disabled.

## Invariants

- `project.vibe`, generation ledger, and both MP4 files retain their baseline
  hashes after all packaged interactions.
- The only new primary-project sidecar is the D7 revision-intent timeline entry
  created by `需要修改`; it does not change project facts or either candidate.
- No selection receipt, review promotion, Delivery state, export artifact,
  external task, retry, Provider invocation, or fee was created.
- The damaged-ledger test uses a separate disposable project root.

## Minimal implementation surface

- `src/core/agentDirectorReviewVersionPair.ts`
- `src/core/agentCurrentTaskProjection.ts`
- `src/ui/director/agentDirectorTurnProjection.ts`
- `src/ui/director/DirectorModeShell.tsx`
- `src/ui/director/MinimalPreview.tsx`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/styles/director.css`
- focused contract and packaged-acceptance scripts
- `design-qa.md`
- this acceptance record and machine-readable packaged observation

## Evidence

- Packaged observation:
  `docs/evidence/p10-d-version-pair-20260719/packaged-observation.json`

## Gate

P10-D7 is accepted for local/dry-run A/B Review. P10-D8 selection receipt and
project-fact promotion remain a separate confirmation and persistence stage.
Delivery and export remain out of scope.

