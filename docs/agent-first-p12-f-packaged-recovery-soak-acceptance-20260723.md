# Vibe Director Studio P12-F packaged recovery and soak acceptance

Date: 2026-07-23

Baseline: `dde51cb Implement P12-E structured draft revision intent`

## Verdict

`P12-F packaged recovery and soak PASS`

Unconfirmed browser drafts now survive packaged App termination through an
Electron-owned durable profile store. The recovery contract retains the
current draft, selected shot, structured storyboard rows, current Agent task,
and save-location confirmation without turning an old or damaged sidecar into
an actionable confirmation.

The packaged intake matrix, the P11/P12 reliability matrix, and a real
30-minute packaged soak all passed with isolated `/tmp` fixtures and
`VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS=1`.

Text Provider calls: 0. Image Provider calls: 0. Video Provider calls: 0.

## Root cause

The P12-E packaged observation exposed four related persistence defects:

1. An unconfirmed browser draft relied on Chromium `localStorage`, which was
   not durable across forced packaged App termination.
2. `DirectorModeShell` filtered `draft_selection_context_*` entries, so the
   selected-shot identity could drift after restore.
3. Modified storyboard rows existed only in React state. The timeline retained
   a summary script, not the structured row snapshot required to restore exact
   edits.
4. Corrupt-sidecar acceptance matched passive onboarding copy instead of an
   actionable current task, which could hide a fail-closed regression.

## Minimum change

1. Added `electron/browserDraftProfileStore.mts`, an app-owned store under
   `userData/browser-drafts` with hashed storage-key directories, safe relative
   paths, symlink rejection, atomic writes, and active/pending pointers.
2. Added trusted Electron IPC and preload bridge methods for browser-draft
   read, write, delete, pointer, and forget operations.
3. Made the Electron bridge authoritative for packaged browser drafts while
   retaining `localStorage` as the browser-only fallback.
4. Added structured pending-intake restoration in
   `src/core/newVideoIntakeRecovery.ts`, including selected-shot identity and
   validated storyboard-row snapshots.
5. Persisted local, AI, fallback, and revised storyboard rows in the intake
   timeline and restored them in `NewVideoStart`.
6. Extended packaged acceptance controls for Clarify and Proposal SIGKILL
   recovery, intake corruption/missing-sidecar handling, and an explicit
   30-minute P12 soak mode.

No color, layout, typography, card style, Provider adapter, Delivery,
promotion, or public-distribution behavior changed.

## Packaged intake results

| Path | Result | Restored task / boundary |
| --- | --- | --- |
| Ready two-shot draft after SIGKILL | `PASS` | one `确认这版故事` task |
| Selected-shot draft after SIGKILL | `PASS` | selected shot identity retained |
| Modified structured draft after SIGKILL | `PASS` | exact storyboard rows retained |
| Duplicate timeline restore | `PASS` | one current task; no duplicate confirmation |
| Duplicate story confirmation | `PASS` | one `选择保存位置` boundary |
| Save-location cold restore | `PASS` | one `选择保存位置` task |
| Corrupt pending sidecar | `PASS` | fail closed to `整理新视频草案` |
| Missing pending sidecar | `PASS` | fail closed to `整理新视频草案` |

Structured evidence:
`docs/evidence/p12-f-packaged-recovery-20260723/packaged-intake-recovery-observation.json`

Visual evidence: four PNG files in
`docs/evidence/p12-f-packaged-recovery-20260723/`.

## Reliability matrix

The isolated matrix passed for:

- one fresh complete local chain with seven forced workflow restarts,
  including Clarify and Proposal;
- one copied old project, with the source project unchanged;
- corrupt generation ledger, selection ledger, and timeline;
- missing media;
- read-only project paths;
- simulated write and publish `ENOSPC` failures;
- interrupted export requiring explicit recovery;
- no partial final package and no stale current-task takeover.

Evidence:
`docs/evidence/p12-f-packaged-recovery-20260723/reliability/packaged-reliability-observation.json`

Provider calls: 0.

## Thirty-minute soak

Evidence:
`docs/evidence/p12-f-packaged-recovery-20260723/soak-30m/packaged-soak-observation.json`

| Measurement | Result |
| --- | --- |
| Status | `pass` |
| Elapsed | 1,800,471 ms |
| Launches | 7 |
| SIGKILL restarts | 6 / 6 |
| View-state advances | 10 / 10 |
| Main samples | 60 |
| RSS samples | 84 |
| RSS first / last | 182,704 KB / 180,240 KB |
| RSS min / max | 178,480 KB / 184,192 KB |
| RSS delta | -2,464 KB |
| Runtime orphans after every kill | 0 |
| Task identity drift | 0 |
| Duplicate current task | 0 |
| Staging files | 0 |
| Provider calls | 0 |

The 30-second preflight also passed and is retained at
`docs/evidence/p12-f-packaged-recovery-20260723/soak-preflight/packaged-soak-observation.json`.

## Final bundle

Validated candidate:
`release/mac-arm64/Vibe Director Studio.app`

- `app.asar` SHA-256:
  `10c3720c3b89163f9ead4792b8c4476a718f0781884ac70ae3ebf5f8e0c6d70e`
- main executable SHA-256:
  `3f0002f834c6cf13815d2af5bff192dd66311dbeac8d7ddf6e412cf7ddb03bb3`

This is local packaged acceptance, not notarized public distribution.

## Verification

Passed:

- `npm run electron-browser-draft-profile-store:test`
- `npm run new-video-intake-recovery:test`
- `npm run project-vibe-draft-store:test`
- `npm run new-video-start-contract:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run project-agent-timeline:test`
- `npm run agent-director-clarification:test`
- `npm run agent-director-turn-projection:test`
- `npm run agent-director-review-regeneration:test`
- `npm run p12-f-packaged-intake-recovery:test`
- `npm run p11-a-packaged-reliability:test`
- `npm run p12-f-packaged-soak:test`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Preserved dirty files

The six pre-existing P10-E evidence modifications and the pre-existing
`electron-runtime/local-runtime-api-server.mjs` modification were not staged,
committed, reverted, or cleaned. Its preserved SHA-256 remains:
`98352bb6a43bbd59566537a584691402c9998dc9763d58573d5a68dcec9e2a8e`.

## Next gate

P12-F permits entry to P13-A. The user has authorized one Image2 generation
followed, only if valid, by one Seedance `seedance2.0_vip` submission. Each
operation is single-attempt with no automatic retry. Returned media must stay
`needs_review`; it must not be auto-approved, promoted, delivered, or exported.

## Gate labels

`P12-F packaged recovery and soak PASS`

`External creator usability NOT VERIFIED`

`Real Provider execution NOT VERIFIED`

`Public distribution NOT CLAIMED`
