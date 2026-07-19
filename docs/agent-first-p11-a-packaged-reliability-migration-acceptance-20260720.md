# Vibe Director Studio P11-A packaged reliability and migration acceptance

Date: 2026-07-20

Status: **PASS FOR LOCAL PACKAGED RELIABILITY AND MIGRATION**.

This acceptance audits the packaged Agent-first workflow under forced restarts,
legacy-project migration, damaged sidecars, missing media, filesystem failures,
and a 60-minute soak. It uses only deterministic local fixtures and copies under
`/tmp`. It does not call a model or media Provider.

## Accepted scope

1. A fresh project completed the P10-E local workflow while the packaged app was
   forcibly restarted at Review, Running, version review, selection/promotion,
   and Delivery boundaries.
2. A full copy of an older project opened without mutating its source project.
3. Corrupt generation, selection, and timeline sidecars failed closed while
   preserving one current Agent task.
4. A candidate whose media file was missing could not form an actionable A/B
   version pair.
5. A read-only project rejected writes and restored its explicit confirmation.
6. Simulated staging-write and atomic-publish `ENOSPC` failures left no partial
   final package and no residual staging files.
7. Killing the packaged app during atomic publish restored the export as failed,
   required an explicit retry, and completed without automatically retrying.
8. A 60-minute packaged soak repeatedly advanced and restarted the workflow
   without state drift, residual runtime processes, or unexpected errors.

## Fixtures and evidence

- reliability root: `/tmp/vibe-director-p11-a-tlFmhc`
- fresh project:
  `/tmp/vibe-director-p10-e-20260719-4p0Tc4/projects/p10-e-packaged-director-workflow`
- old source project:
  `real-test-sandbox/fresh-storyboard-seedance720-20260522-03`
- old-project audit target:
  `/tmp/vibe-director-p11-a-tlFmhc/scenarios/migrated-old-project/projects/fresh-storyboard-seedance720-20260522-03`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- reliability evidence:
  `docs/evidence/p11-a-packaged-reliability-20260720/packaged-reliability-observation.json`
- soak evidence:
  `docs/evidence/p11-a-packaged-reliability-20260720/packaged-soak-observation.json`

The original old project remained byte-identical during the audit. No original
P6 or P10 acceptance project was used as a writable test target.

## Reliability matrix

| Scenario | Result | Accepted behavior |
| --- | --- | --- |
| Fresh packaged chain | PASS | Five forced workflow restarts; one current task after every restore |
| Old-project copy | PASS | Opened from a full `/tmp` copy; source project unchanged |
| Corrupt generation ledger | PASS | Invalid job evidence did not become an actionable current task |
| Corrupt selection ledger | PASS | Invalid selection evidence did not authorize promotion |
| Corrupt timeline | PASS | Projection recovered from current structured facts |
| Missing candidate media | PASS | Pair construction failed closed |
| Read-only project | PASS | Write refused; confirmation remained available |
| Staging write failure | PASS | Job failed; staging was removed |
| Atomic publish failure | PASS | Existing final package was preserved; staging was removed |
| Kill during publish | PASS | No automatic retry; explicit recovery completed cleanly |
| 60-minute soak | PASS | No drift, orphan runtime, staging residue, or unexpected errors |

## Root causes and fixes

- Packaged acceptance could leave runtime children after the Electron parent was
  killed. Electron now passes its parent PID and the local runtime exits when
  that parent disappears.
- Version-pair construction trusted ledger paths without proving that media
  still existed and matched its hash. Pair creation now receives only verified
  candidate identities and fails closed when media is absent or changed.
- A local export left in `running` after a renderer interruption had no explicit
  recovery boundary. Cold restore now records it as failed and requires a new
  confirmation instead of retrying automatically.
- Export failures could leave job-specific `.vibe-staging` data. The renderer
  can now request narrowly scoped cleanup for exactly one safe staging job path;
  write, cancel, and publish failures use that boundary.
- Replayed timeline entries differed only by regenerated timestamps and caused
  unnecessary state rewrites. Timeline append is now idempotent for equal entry
  identities and semantic content.
- Acceptance lacked deterministic filesystem fault and lifecycle controls. The
  packaged harness now supports test-only write/publish faults, publish delay,
  forced snapshots, and restart observations without changing production UI.

## Soak result

- elapsed: `3,600,416 ms`
- packaged launches: `11`
- samples: `120`
- forced restarts: `10`
- state advances: `20`
- RSS samples: `162`
- RSS first / last: `183,168 KB` / `178,896 KB`
- RSS min / max: `172,752 KB` / `183,168 KB`
- RSS delta: `-4,272 KB`
- project-state drift: `false`
- final staging files: `0`
- orphan runtime processes: `0`
- unexpected log errors: `0`
- known macOS IMK warnings: `11`
- Provider calls: `0`

Every observation contained exactly one current Agent task. The known IMK lines
are macOS input-method warnings and were not treated as application failures.

## Verification

Passed:

- `npm run agent-current-task-projection:test`
- `npm run agent-director-review-version-pair:test`
- `npm run agent-director-review-selection:test`
- `npm run agent-director-delivery-handoff:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-timeline:test`
- `npm run export-worker:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npm run p11-a-packaged-reliability:test`
- `npm run p11-a-packaged-soak:test`
- `npm run package:smoke`
- `npm run p10-e-packaged-acceptance:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Limits

- Provider calls: `0`
- Provider fees: `0`
- Original user projects or media changed: `false`
- Real Provider submission, polling, media recovery, and billing: not verified
- Visual redesign: not performed
- Package signing: local ad-hoc only; Developer ID, notarization, App Store, and
  public-release claims remain outside this stage

## Gate

P11-A local packaged reliability and migration audit PASS

P11-B may proceed to one exact canary specification and one paid-submit
confirmation boundary.

Real Provider execution NOT VERIFIED
