# Agent-first P9 delivery RC acceptance

Date: 2026-07-16

Status: PASS for delivery terminal convergence, package portability, atomic
publication, recovery isolation, and local packaged RC acceptance.

Readiness label:
`P9 closed; local packaged delivery RC passed; P6S01 remains preview-approved only and unpromoted; ready to enter P10 Product Design/ImageGen discovery`.

## Authorization and boundary

The user authorized related local packaged App export, verification, and test
actions through `2026-07-17T22:05:31+08:00`.

P9 did not authorize or perform:

- a provider submit, query, retry, or media generation;
- project-fact promotion;
- deletion, publishing, or distribution;
- frontend dev-server startup;
- Product Design, ImageGen, or visual UI changes.

The accepted review receipt still has `humanReviewed=true` and
`promotionAuthorized=false`. Local package generation is not project-fact
promotion.

## Baseline and result

P9 started from clean commit:

`286c381 Close P8-B packaged local export`

The implementation retained the existing Agent execution, project sidecar,
Delivery Gate, export-worker, and Electron security boundaries. P9 made only
the minimum contract changes required by failures reproduced during the audit.

Final verdicts:

| Stage | Result | Closure |
| --- | --- | --- |
| P9-A terminal convergence | PASS | Current fact-bound live completion owns the terminal delivery state. |
| P9-B portability | PASS | All 16 outputs are self-contained and hash-valid; the local root leak was removed. |
| P9-C atomic delivery | PASS | Live exports stage completely and publish once; incomplete work cannot receive a success receipt. |
| P9-D recovery matrix | PASS | Invalid, stale, terminal, and cross-project state fails closed or remains history. |
| P9-E packaged local RC | PASS | A fresh packaged App export and repeated cold-start recovery completed without duplicate writes. |

## P9-A terminal convergence

The structured `AgentCurrentTaskProjection` remains the authoritative current
task. A current-project, current-fact export completion now carries a terminal
projection payload:

```json
{
  "step": "idle",
  "requiresConfirmation": false,
  "completion": {
    "step": "export",
    "executionMode": "live",
    "actionId": "...",
    "completedAt": "..."
  }
}
```

Only `executionMode=live` can mark the delivery surface as written. A dry-run
completion remains a boundary-validation result and cannot claim a local
package.

The packaged recovery audit found two stale presentation paths after the
projection had correctly returned to idle:

1. The delivery page still derived `waiting for export confirmation` from an
   older local export action projection.
2. The Agent selection chips could still advertise `next: confirm export`
   after a restored live completion.

Both consumers now use structured, current-identity live completion evidence.
No Chinese display-copy regex was added to decide business state.

Final terminal behavior:

- the right Agent shows `continue describing the idea` and no old confirmation;
- the delivery page shows `export completed` and `package generated`;
- the package path remains visible for review;
- no export confirmation or second write action is offered;
- failed and cancelled jobs remain historical evidence only.

## P9-B package portability

Source package:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot/exports/current-project`

Independent read-only audit copy:

`/tmp/vibe-director-p9-portability-20260716-xb2j9J/package/current-project`

Audit result:

- expected outputs: `16`;
- present outputs: `16`;
- missing receipt outputs: `0`;
- undeclared package files: `0`;
- receipt hash mismatches: `0`;
- parent-directory traversal: `0`;
- unresolved external dependencies: `0`.

The final MP4 was independently probed:

- path: `final-video/01_P6S01.mp4`;
- video/audio: H.264 and AAC;
- dimensions: `1280x720`;
- duration: approximately `5.06195` seconds;
- size: `8,191,853` bytes;
- SHA-256:
  `bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`.

One portability blocker was reproduced. `export_manifest.json` included the
local absolute `agentToolTrace.sourceProjectRoot`. Export manifests now write
the symbolic value `project_root`; the runtime receipt and project sidecars
retain their identity-bound roots outside the portable package. The audited
manifest contains no `/tmp` or `/private/tmp` source root.

## P9-C atomic write and failure matrix

The live Electron bridge previously wrote directly into the final export
directory. A failure after the first successful mutation could therefore leave
a partial directory even though no success receipt existed.

Live export now uses one project-scoped transaction:

1. Stage all writes and copies under
   `exports/.vibe-staging/<manifest-id>-<transaction-hash>`.
2. Verify the worker completed with no error or cancellation.
3. Publish the staged directory through trusted Electron IPC.
4. Create the delivery receipt only after publication succeeds.

The IPC accepts only a real directory inside the opened project's
`exports/.vibe-staging` or `reports/exports/.vibe-staging` tree and a final
directory under the matching export base. It rejects cross-project paths,
symlinks, and reserved `.vibe-*` destinations. If a previous final package
exists, it is moved under `.vibe-previous`; a failed publish restores it.

| Injected case | Required result | Observed result |
| --- | --- | --- |
| Complete transaction | Publish exactly once, then receipt | PASS; one publish and no current staging files. |
| Nth mutation failure | No publish, no final mutation, no receipt | PASS; partial evidence stayed under staging. |
| Mid-plan cancellation | Stop before publish and receipt | PASS; no final output was claimed. |
| Publish failure | Preserve previous final and retain staged evidence | PASS. |
| Unrelated stale staging | Do not delete it or confuse it with current work | PASS. |
| Missing publish capability | Block before the first write | PASS. |
| Repeated terminal action/confirmation | No second execution | PASS. |

This closes the application-level partial-package gap. It does not claim a
filesystem power-loss guarantee beyond the same-filesystem rename semantics
used by the packaged App.

## P9-D recovery matrix

Recovery priority remains:

1. current valid confirmation;
2. current non-terminal job;
3. current pipeline step;
4. passive project status.

A current-fact terminal live receipt closes the task before older prerequisite
steps can be revived.

| Recovery evidence | Required behavior | Result |
| --- | --- | --- |
| Missing timeline | Rebuild only from other current valid evidence | PASS |
| Corrupt timeline | Reject corrupt evidence; do not synthesize success | PASS |
| Missing or corrupt ledger | No terminal or running job inferred | PASS |
| Cleared, expired, or invalid staged plan | Remain history; do not become current | PASS |
| Corrupt/incomplete delivery receipt | Fail closed; no completion claim | PASS |
| Old project fact hash | Cannot complete or authorize the current export | PASS |
| Physical media hash change | Delivery Gate blocks before any write | PASS |
| Failed/cancelled terminal job | Remains history and consumes its old confirmation | PASS |
| Project A completion while Project B is open | Cannot close Project B's task | PASS |
| `/private/tmp` sidecar root restored as `/tmp` | Treat as the same macOS temporary root | PASS |

The packaged App exposed the final alias defect: a timeline persisted with a
`/private/tmp` root was rejected when the same project reopened as `/tmp`.
Root normalization now canonicalizes that macOS alias before identity matching.

## P9-E packaged local RC

RC root:

`/tmp/vibe-director-p9-rc-20260716-BgDWNG`

Packaged App:

`/Users/lichenhao/Desktop/new vibe directing/release/mac-arm64/Vibe Director Studio.app`

Projects:

- copied restore project:
  `/tmp/vibe-director-p9-rc-20260716-BgDWNG/projects/p9-restore-existing`;
- fresh local export project:
  `/tmp/vibe-director-p9-rc-20260716-BgDWNG/projects/p9-fresh-export`;
- same-root alias recovery source:
  `/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot`.

The fresh packaged execution used the real right-side Agent confirmation:

- project fact hash: `pv_17dd191f`;
- action:
  `agent_action_2026_07_15t17_06_13_383z_prepare_export`;
- confirmation:
  `agent_tool_handoff_2026_07_15t17_09_22_031z_agent_action_2026_07_15t17_06_13_383z_prepare_export`;
- job:
  `agent_video_job_minimal_agent_current_task_export_001`;
- delivery receipt:
  `export_delivery_agent_action_2026_07_15t17_06_13_383z_prepare_export_agent_tool_handoff_2026_07_15t17_09_22_031z_agent_action_2026_07_15t17_06_13_383z_prepare_export`;
- execution mode: `live`;
- status: `succeeded`;
- provider called: `false`;
- output count: `16`.

The package was written under:

`/tmp/vibe-director-p9-rc-20260716-BgDWNG/projects/p9-fresh-export/exports/current-project`

All 16 physical files matched the delivery receipt. The pre-restart aggregate
file-metadata snapshot was:

`1072f9d1a118cc7822f6e07b4249e1e1ca2b4055c8bead96f7f3f592775fc554`

It remained identical after repeated cold starts and delivery-view navigation.
Exactly one succeeded export job and one succeeded execution result remained;
no current transaction directory remained under `.vibe-staging`.

Final packaged observations:

- current Agent task: idle;
- visible old confirmation cards: `0`;
- visible second-export action: `0`;
- delivery status: completed;
- package status: generated;
- local package contents and path remained reviewable;
- output changes after restart: `0/16`;
- provider calls: `0`.

P6S01 stayed unchanged as a project fact:

- shot status: `blocked`;
- review status: human-approved for preview;
- `promotionAuthorized=false`;
- source and exported video hash unchanged;
- no promotion, provider operation, or automatic approval occurred.

The App and local runtime started for this RC were stopped after verification.

## Root causes and minimal implementation

The P9 blockers had four concrete causes:

1. Portable manifests copied a machine-local source root.
2. Live bridge writes targeted the final directory before the transaction was
   complete.
3. macOS `/private/tmp` and `/tmp` aliases did not compare as the same project
   root during timeline restore.
4. Delivery and Agent secondary surfaces could outlive the projection-owned
   live completion and show stale confirmation copy.

Minimal production files changed:

- `electron/main.mts`
- `electron/preload.mts`
- `src/core/agentCurrentTaskProjection.ts`
- `src/core/electronBridge.ts`
- `src/core/exportAction.ts`
- `src/core/exportWorker.ts`
- `src/project/projectAgentTimeline.ts`
- `src/ui/director/DirectorModeShell.tsx`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/ui/director/MinimalExport.tsx`

Focused contract coverage changed:

- `scripts/agent-current-task-projection-test.mts`
- `scripts/current-project-ui-closed-loop-test.mts`
- `scripts/electron-bridge-smoke-test.mts`
- `scripts/electron-security-policy-test.mts`
- `scripts/export-worker-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `scripts/project-agent-timeline-test.mts`

No component was split or generically re-architected. No color, layout,
typography, card style, or visual density changed.

## Verification

Passed without provider calls:

- `npm run agent-current-task-projection:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run export-worker:test`
- `npm run preview-export-audio-e2e:test` (`9/9`)
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run project-agent-timeline:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run electron-security-policy:test`
- `npm run electron-project-scope:test`
- `npm run electron-lazy-runtime:test`
- `npm run electron-runtime-token:test`
- `npm run project-root-dialog:test`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `npm run package:smoke`
- `npm audit --audit-level=low` (`0` vulnerabilities)
- `git diff --check`

`package:smoke` rebuilt and launched the arm64 packaged App successfully using
local ad-hoc signing.

## Residual risk and unverified capability

- Developer ID signing, notarization, Gatekeeper distribution acceptance, and
  Mac App Store delivery remain outside scope by product-owner decision.
- This is a local Apple Silicon RC, not a cross-platform distribution matrix.
- No new external provider call, real media generation, retry, or billing path
  was exercised in P9.
- No project-fact promotion path was exercised; P6S01 intentionally remains
  preview-approved only.
- `.vibe-previous` retention is intentionally conservative; an automatic
  cleanup policy was not added in this closure.
- Product Design/ImageGen visual evidence and alternatives were intentionally
  not produced in P9.

## Readiness

P9 is closed with verdict `PASS`. The packaged App has one authoritative
terminal task, a portable and receipt-bound package, fail-closed atomic
publication, identity-safe recovery, and a repeatable local RC path.

The codebase may enter P10 Product Design/ImageGen discovery. P10 may redesign
the presentation layer only after preserving the contracts in
`docs/product-design-imagegen-p10-input-20260716.md`.
