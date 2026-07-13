# Agent-first P6-B offline recovery matrix audit

Date: 2026-07-13

Status: PASS for P6-B offline live-shape and recovery coverage.

Readiness label: `local packaged RC + offline provider recovery matrix`.
This phase does not authorize or prove a real image or video provider call.

## Scope

- Exercise the shared execution controller and adapter with deterministic fake
  provider callbacks only.
- Cover submitted, running, succeeded, failed, timed out, cancelled, explicit
  retry, and partial-return shapes.
- Cover duplicate confirmation, concurrent duplicate execution, duplicate
  callback settlement, late return, corrupted sidecar, and cold restore.
- Prove query does not become another submit, action ids remain idempotent, and
  old project facts cannot consume a current result.
- Keep Signal Desk, Product Design, ImageGen, credentials, and live provider
  routes unchanged.

## Findings and minimal fixes

### Query identity gap

Before P6-B, a submitted video job persisted its `externalTaskId`, but a new
query job did not inherit that id. The UI callback could still consult runtime
state, but the durable execution job itself did not prove which provider task
it was querying.

`planAgentVideoProductionAction` now requires a query to find the most recent
running, fact-bound video job with a non-empty `externalTaskId`. The query job
inherits that id before the callback runs. If no matching id exists, query
fails closed and cannot fall back to submit.

### Sidecar validation gap

The generation ledger validated job identity and lifecycle fields but did not
validate the optional `externalTaskId` type. A malformed sidecar could carry a
non-string value through structural restoration.

The sidecar parser now rejects any present `externalTaskId` that is not a
non-empty string.

## Offline matrix

`scripts/agent-video-fake-execution-adapter-test.mts` proves:

- submit persists one running job and one external task id;
- concurrent and repeated confirmations do not resubmit;
- cold-restored query reuses the submitted task id;
- repeated polling updates one query job and can finish with reviewable media;
- old fact hashes cannot restore or query the previous task;
- thrown provider failure remains terminal and does not auto-retry;
- explicit retry creates a second action linked to the failed action;
- partial return preserves one returned path plus the missing shot ids;
- duplicate Promise settlement keeps only the first callback result;
- timeout aborts the callback and ignores a late media result;
- cancellation is terminal, contains no output, and remains explicitly
  retryable.

All media-looking paths in this test are in-memory fake strings. The test does
not create PNG, JPG, MP4, MOV, or other media files.

The existing generation-ledger test additionally proves matching cold-start
restore, invalid JSON rejection, malformed lifecycle rejection, project/root/
fact mismatch rejection, terminal-job filtering, and conservative legacy
migration.

## Verification

Passed:

- `npm run agent-current-task-projection:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run agent-video-fake-execution-adapter:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run demo:ready:test`
- `npm run prototype-ui:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run package:smoke`

`agent-video-fake-execution-adapter:test` is part of `demo:ready:test`, so the
offline recovery matrix remains a standing regression gate.

## Cost and artifact boundary

- Real image provider calls: 0.
- Real video provider calls: 0.
- External network calls from the fake matrix: 0.
- External cost: 0.
- Real media artifacts: none.
- Packaged result: local ad-hoc App build and launch contract passed.
- A second packaged GUI walkthrough was not run because P6-B changed no UI or
  packaged interaction behavior; P6-A already accepted that main chain.

## Remaining evidence gaps

- A provider timeout before any external task id is observed remains blocked
  from query and automatic resubmit. This is intentional duplicate-submit
  protection; P6-D must prove the real provider bridge persists an id or
  presents an explicit unknown-submit recovery state.
- Partial return is preserved for the review layer but has not yet been
  promoted or rejected through the P7 human-review contract.
- No credential status or no-submit live preflight was performed in P6-B.
- No real reference or video result has been reviewed after restart.

## Phase transition

P6-B permits entry to P6-C no-submit readiness work only. P6-C must run its
preflight, credential-status check, and secret scan, then stop for fresh user
authorization before exactly one reference-image provider call.
