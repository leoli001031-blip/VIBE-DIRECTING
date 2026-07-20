# Vibe Director Studio P11-F local Beta continuous-use acceptance

Date: 2026-07-21

Status: **PASS FOR LOCAL PACKAGED BETA CONTINUOUS-USE PREFLIGHT AND DIAGNOSTICS**.

P11-F rebuilt the P11-E workflow as a clean ad-hoc local Beta, exercised its
pending regeneration confirmation through repeated packaged restarts and view
changes, and exported a real redacted diagnostic ZIP from the resulting state.
All projects and media were isolated under `/tmp`; no Provider was called.

This was a three-minute post-change preflight. It complements, but does not
replace or claim to rerun, the 60-minute P11-A soak.

## Findings and fixes

### Tracked runtime bundle was stale

The first Beta build passed functionally but reported `sourceState: dirty`
because `electron-runtime/local-runtime-api-server.mjs` no longer matched its
current source graph. The bundle was reproducibly regenerated, checked, and
committed separately.

Checkpoint: `14d03a5 Sync packaged runtime bundle`.

### Pending regeneration sidecar drifted during continuous use

The first three-minute run kept one correct visible task, but Video/Delivery
navigation rewrote `.vibe-runtime/agent-staged-plan.json`. Its regeneration
handoff moved from `awaiting_confirmation` to passive
`video_submit_already_sent` blockers.

Restore now waits for the persisted generation ledger and requires exact
agreement between the current project, source Review job, new staged job,
timeline confirmation, and staged handoff. Missing, stale, cross-project, or
hash-mismatched identities fail closed.

Checkpoint: `94fe083 Harden P11-F regeneration restore`.

## Final local Beta

The final artifacts are generated under `release/` and described by
`release/p11-local-beta/release-manifest.json`.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Vibe Director Studio-0.0.1-arm64.dmg` | 119172764 bytes | `8b560f6d5aa530ed3102729a396a708c7795832cb23998d67e7ddce89a86ef9b` |
| `Vibe Director Studio-0.0.1-arm64-mac.zip` | 115208869 bytes | `a9f02e61b6aee9e7af3fc7c441b0f3914bfbe851b5066db52bc558493437ec2c` |

Release facts:

- source commit: `94fe0834aff46f2d950fc505e877c5416a7add46`
- source state: `clean`
- architecture: `macOS arm64`
- signature: `ad_hoc`
- notarized: `false`
- public distribution claimed: `false`
- ZIP extracted App launch: PASS
- DMG verification: PASS

## Final interaction path

The clean packaged App used a fresh project and passed:

1. qualified reference request -> one enabled reference confirmation;
2. concrete Review feedback -> Proposal directly, with zero visible Clarify
   turns;
3. Proposal confirmation -> one separate `staged + dry_run` job;
4. cold restore -> `确认验证视频流程` from `timeline_confirmation`;
5. old Review hidden, original media and project facts unchanged;
6. final generation confirmation left unexecuted.

## Three-minute preflight

Final result: `preflight_pass`.

- configured duration: `180000 ms`
- elapsed: `180244 ms`
- packaged launches: `3`
- forced SIGKILL restarts: `2`
- Video/Delivery state advances: `4`
- periodic samples: `35`
- RSS samples: `45`
- RSS first / last: `201840 KB / 180704 KB`
- RSS min / max: `173376 KB / 203392 KB`
- project or media drift: `false`
- residual staging files: `0`
- orphan Runtime processes: `0`
- unexpected log errors: `0`
- known macOS IMK warnings: `3`
- Provider calls: `0`

Every observation contained exactly one current Agent task. Both forced
restarts preserved the exact task identity.

## Diagnostic acceptance

The packaged App exported and reopened one diagnostic ZIP after the final
preflight.

- ZIP SHA-256: `ec56f6c25a06d581563593841df0a5f3c58a0a7cc198646fcdc2ee4bbef7a794`
- generation ledger records: `2`
- required statuses present: `succeeded` and `staged`
- staged plan status: `active`
- timeline records: `7`
- project state changed by export: `false`
- credentials included: `false`
- tokens included: `false`
- full project files included: `false`
- media included: `false`
- absolute paths included: `false`

Status counts in the diagnostic manifest recursively include job history and
Review result states; `recordCount: 2` is the authoritative top-level job count.

## Evidence

- `docs/evidence/p11-f-local-beta-continuous-use-20260721/initial-drift-reproduction.json`
- `docs/evidence/p11-f-local-beta-continuous-use-20260721/release-summary.json`
- `docs/evidence/p11-f-local-beta-continuous-use-20260721/interaction-observation.json`
- `docs/evidence/p11-f-local-beta-continuous-use-20260721/packaged-soak-observation.json`
- `docs/evidence/p11-f-local-beta-continuous-use-20260721/diagnostic-observation.json`
- `docs/evidence/p11-f-local-beta-continuous-use-20260721/01-post-soak-confirmation-and-diagnostics.png`
  - SHA-256: `0d103816747741b40df6b9a5c08b0b903ce25efe63f49433c3bc772bd3b0bf46`

## Verification

Passed:

- `npm run director-agent-action-envelope:test`
- `npm run project-agent-workspace:test`
- `npm run agent-director-review-regeneration:test`
- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run agent-video-execution-controller:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run diagnostic-bundle:test`
- `npm run electron-security-policy:test`
- `npm run package:smoke`
- `npm run package:p11-local-beta`
- `npm run p11-f-local-beta-diagnostics:test -- <app> <project> <evidence>`
- `VIBE_P11_SOAK_PREFLIGHT=1 VIBE_P11_SOAK_DURATION_MS=180000 npx tsx scripts/p11-packaged-soak-acceptance.mts <app> <project> <evidence>`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Boundaries

- Provider calls: `0`
- Provider fees: `0`
- final generation execution confirmed: `false`
- automatic retry: `false`
- project-fact promotion: `false`
- Delivery/export: `false`
- visual redesign: not performed
- Developer ID/notarization/public release: outside scope

## Gate

P11-F local packaged Beta continuous-use preflight and diagnostics PASS

Real Provider execution NOT VERIFIED

Public distribution NOT CLAIMED
