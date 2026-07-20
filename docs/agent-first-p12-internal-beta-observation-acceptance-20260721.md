# Vibe Director Studio P12 internal Beta observation

Date: 2026-07-21

Status: **PASS FOR LOCAL PACKAGED INTERNAL BETA OBSERVATION PREFLIGHT**.

P12 exercised the final P11 local Beta ZIP through one Computer Use first-run
story and two deterministic packaged creator paths, then exported a diagnostic
ZIP from the visible Settings UI. It did not call a model or media Provider,
execute generation, promote project facts, or export Delivery.

This is an operator-observed internal Beta preflight. It is not external user
research, real Provider usability validation, or another 60-minute soak.

## Beta artifact

- ZIP: `release/Vibe Director Studio-0.0.1-arm64-mac.zip`
- SHA-256: `a9f02e61b6aee9e7af3fc7c441b0f3914bfbe851b5066db52bc558493437ec2c`
- release manifest match: PASS
- source commit: `94fe0834aff46f2d950fc505e877c5416a7add46`
- source state recorded by release: `clean`
- extracted App ad-hoc codesign verification: PASS
- notarized: `false`
- public distribution claimed: `false`

The scenarios ran against the App extracted from that ZIP, not the rebuilt
`release/mac-arm64` development package.

## Scenario matrix

| Scenario | Result | Interaction cost | Side effects |
| --- | --- | --- | --- |
| Fresh two-shot story | PASS | One creator message; stopped at one `确认这版故事` | 2-shot local draft; no project/runtime files; no Provider |
| Qualified reference request | PASS | One creator message; one pending `确认生成参考`; one cold restart | No reference media; confirmation not executed |
| Concrete Review revision | PASS | `需要修改`, one detailed message, one Proposal confirmation; separate execution confirmation left pending | Zero visible Clarify turns; original facts/media unchanged |
| Diagnostic support | PASS | `设置` -> `导出诊断日志` | Redacted ZIP created; project unchanged; no orphan Runtime |

## First-use observation

Computer Use launched the extracted App with isolated `HOME`, profile,
projects, and Runtime roots. The creator entered:

`我要拍一个 8 秒短片：清晨旧车站，男孩把一张褪色明信片递给售票机器人，第一缕阳光穿过明信片上的小孔，在墙上投出海浪。整理成 2 个镜头，不生成参考图，不提交视频。`

The next visible state contained exactly one current Agent task:
`确认这版故事`. The middle workbench retained two shots, references were
`未开始`, video was `未生成`, and the confirmation explicitly excluded
reference generation, video submission, and Delivery. The confirmation was not
clicked. Both isolated projects and Runtime roots remained empty.

## Improvement since P11-D

1. `开始补参考。只形成确认，不执行生成。` now reaches the intended
   reference confirmation instead of becoming a generic status request.
2. Concrete timing, action, and continuity feedback now forms a Proposal with
   zero visible Clarify turns. Ambiguous feedback remains covered by contract.
3. Cold restore returns to one `timeline_confirmation` task and hides the old
   Review result.
4. Diagnostic export is reachable from the visible Settings UI and preserves
   the redaction boundary.

## Findings

No P0 or P1 product blocker was reproduced. Product code and UI were not
changed.

Three P2 observations should feed a later evidence-based simplification pass:

- confirmation explanations are repeated between the middle workbench and the
  Agent rail;
- a long Proposal can place its full primary action below the visible rail
  fold on a shorter window;
- first-use material extraction listed both `男生` and `男孩` for one
  character.

The first P12 Proposal screenshot briefly caught Review during React's staged
update even though Proposal already existed in the DOM. An independent rerun
stabilized correctly. The acceptance helper now waits for one current task, a
visible Proposal, and an invisible old Review before capturing evidence. This
was a test-timing fix, not a product-state fix.

The diagnostics helper now opens Settings and clicks `导出诊断日志`; it no
longer invokes the Electron bridge directly. It also waits for the Settings
content to render before clicking.

## Diagnostic result

- ZIP SHA-256: `af7a4f50fd02413cf760a3cdc2c59a61042e746e7f983fb7cd3309a41996fc6d`
- generation ledger records: `2`
- staged plan: `active`
- timeline records: `7`
- credentials included: `false`
- tokens included: `false`
- full project files included: `false`
- media included: `false`
- absolute paths included: `false`
- project state drift: `false`
- orphan Runtime processes: `0`

## Evidence

- `docs/evidence/p12-internal-beta-observation-20260721/p12-observation-summary.json`
- `docs/evidence/p12-internal-beta-observation-20260721/observation.json`
- `docs/evidence/p12-internal-beta-observation-20260721/diagnostic-observation.json`
- `docs/evidence/p12-internal-beta-observation-20260721/00-fresh-story-confirmation-computer-use.png`
  - SHA-256: `ea7007fd5704a84de697d60153f202bb80f85a445527741738c5dcf964ceb223`
- `docs/evidence/p12-internal-beta-observation-20260721/01-qualified-reference-confirmation.png`
  - SHA-256: `30494ab8b6e14d14037973125ee04f4def1b5fc52f2ef86ca8954d3f9b15a097`
- `docs/evidence/p12-internal-beta-observation-20260721/02-direct-review-proposal.png`
  - SHA-256: `574927275956aa297e809ba1e88be035d066ef88f6ae221bb3a37adc820e6c78`
- `docs/evidence/p12-internal-beta-observation-20260721/03-execution-confirmation-cold-restore.png`
  - SHA-256: `e79e574d19409d808b083bc2663f280cec7c2aa0d9177ffd851cdd9043c545d9`
- `docs/evidence/p12-internal-beta-observation-20260721/02-diagnostic-exported-from-settings.png`
  - SHA-256: `e8cf4dccaf168f3f835d4a63cd4b865b42eb2955f11736dc4307c2a5a49d0aaf`

`01-post-soak-confirmation-and-diagnostics.png` is an inherited helper filename.
P12 did not claim or run another soak.

## Verification

Passed:

- extracted Beta ZIP SHA-256 and codesign verification
- Computer Use first-use packaged observation
- `npx tsx scripts/p11-interaction-simplification-packaged-acceptance.mts <extracted-app> <evidence>`
- `npm run p11-f-local-beta-diagnostics:test -- <extracted-app> <project> <evidence>`
- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run diagnostic-bundle:test`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Boundaries

- Provider calls: `0`
- Provider fees: `0`
- generation confirmation executed: `false`
- automatic retry: `false`
- project-fact promotion: `false`
- Delivery/export: `false`
- visual redesign: not performed
- external creator usability: not yet observed

## Gate

P12 local packaged internal Beta observation preflight PASS

Real Provider execution NOT VERIFIED

External creator usability NOT YET OBSERVED

Public distribution NOT CLAIMED
