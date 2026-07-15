# Agent-first P8-A Delivery Gate contract

Date: 2026-07-15

Status: PASS for the structured Delivery Gate contract and packaged build.

Readiness label:
`P8-A closed; P6S01 remains preview-approved only; real export still requires new authorization`.

## Baseline and scope

The verified baseline was `cbdb99d Close P7 preview review gate` with a clean
worktree. This closure changed no visual layout, styling, or display hierarchy.
It did not start a frontend dev server and did not call any text, image, or
video provider.

P6S01 remained preview-approved only. Its existing review receipt still has
`humanReviewed=true` and `promotionAuthorized=false`. This round did not
promote the video into an asset, visual memory, or reusable project fact, and
did not execute a real export.

## Audit result and root cause

All visible export actions already converged on `runExportAction` and the
shared Agent execution adapter, but the final file-write boundary was weaker
than the visible confirmation boundary:

1. `exportWorker` accepted `executionMode=adapter_execution` plus a legacy
   boolean `confirmation=true`, even when video results were `needs_review`.
2. Review matching used only an approved receipt's output path and could also
   trust `videoResult.reviewStatus=approved` without a persisted review
   receipt.
3. `localPreviewExportProjection` could synthesize an approved human review
   receipt by parsing display status text. This made presentation state look
   like delivery authority.
4. Local export did not hash source media before its first write, so a file
   replacement after review was not detected at the Delivery Gate.
5. The Agent execution receipt recorded project/fact/action identity, but a
   successful export did not persist the exact review bindings and actual
   output list needed to restore delivery completion safely.

The closure keeps the existing execution architecture. A pure structured
Delivery Gate now feeds the existing export worker, action, Agent job ledger,
and timeline receipt path.

## Delivery Gate state table

| Current evidence | Gate state | File execution |
| --- | --- | --- |
| Missing video | `blocked` / `delivery_media_missing` | Forbidden |
| No exact review receipt | `blocked` / `delivery_review_required` | Forbidden |
| `rejected` | `blocked` / `delivery_review_rejected` | Forbidden |
| `retry_requested` | `blocked` / `delivery_review_retry_requested` | Forbidden |
| Non-human `approved` | `blocked` / `delivery_review_not_human` | Forbidden |
| Shot, path, source receipt, or output hash mismatch | `blocked` / `delivery_review_identity_mismatch` | Forbidden |
| Exact human `approved`, including `promotionAuthorized=false` | `ready_for_confirmation` | Package preparation only |
| Exact approval plus current project/fact-bound export confirmation | `authorized` | Allowed through the shared adapter |
| Stale project root or fact hash confirmation | `blocked` | Forbidden |
| Physical media hash changed after review | `blocked` / `delivery_media_hash_mismatch` | Forbidden before any write |
| Same terminal action or confirmation receipt | `already_completed` | Duplicate execution forbidden |
| Corrupt or incomplete delivery receipt | `blocked` / `delivery_receipt_invalid` | Forbidden |

Review approval does not authorize project-fact promotion and does not count
as export approval. Ordinary composer input cannot construct the live export
execution receipt used by this gate.

## Receipt and recovery contract

A succeeded live delivery receipt now binds:

- `projectId`, normalized `projectRoot`, and `projectFactHash`;
- export `actionId` and `confirmationId`;
- every exact `reviewReceiptId`, `shotId`, `sourceReceiptId`, output path, and
  output hash;
- `executionMode=live`;
- the actual written and copied output paths.

Dry-run receipts use `status=validated`, contain no filesystem outputs, and
cannot claim a real package. Live succeeded receipts with empty outputs,
absolute paths, parent traversal, or paths outside `exports/` fail closed.

The delivery receipt is nested in the existing Agent execution receipt, which
is already persisted through the project generation ledger and Agent timeline.
A terminal export action therefore cannot run again after cold-start recovery.
Old fact hashes, old projects, and invalid nested receipts do not complete the
current export task.

## Minimal implementation surface

Core contract and execution:

- `src/core/exportDeliveryGate.ts`
- `src/core/exportWorker.ts`
- `src/core/exportAction.ts`
- `src/core/agentVideoExecutionAdapter.ts`
- `src/core/localPreviewExportProjection.ts`
- `src/core/previewPlayerQueue.ts`
- `src/core/finalVideoPlan.ts`
- `src/core/types/provider.ts`
- `schemas/export_worker.schema.json`

Existing Agent and packaged boundaries were extended without visual changes:

- `src/App.tsx`
- `src/ui/director/agentVideoExecutionController.ts`
- `src/ui/director/agentPanelProjection.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/ui/director/DirectorModeShell.tsx`
- `src/ui/director/MinimalExport.tsx`
- `electron/main.mts`
- `electron/preload.mts`
- `src/core/electronBridge.ts`

The Electron addition is a read-only, opened-project-scoped
`sandbox:hashFile` IPC used before export writes. It uses the existing trusted
sender and real project-root scope.

## Verification

Passed without provider calls:

- `npm run agent-current-task-projection:test`
- `npm run runtime-api-current-project-review-decision:test`
- `npx tsx scripts/current-project-preview-projection-test.mts`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run export-worker:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run new-video-golden-path:test`
- `npm run preview-export-audio-e2e:test`
- `npm run dry-run-e2e:test`
- `npx tsx scripts/video-export-package-test.mts`
- `npm run real-project-mvp-acceptance:smoke`
- `npm run p6-real-image2:preview-export-test`
- `npm run mvp-demo-export:test`
- `npm run mvp-full-chain-local:smoke`
- `npm run electron-security-policy:test`
- `npm run project-root-dialog:test`
- `npm run demo:ready:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run package:smoke`

`package:smoke` rebuilt and launched
`release/mac-arm64/Vibe Director Studio.app` successfully with local ad-hoc
signing. Developer ID signing and notarization remain intentionally outside
this local release boundary.

## Capabilities not exercised

- No provider-backed text, image, or video request was made.
- No real P6S01 export or project-fact promotion was executed.
- `npm run electron-bridge-smoke:test` was invoked but its optional macOS GUI
  branch remained skipped because `VIBE_ALLOW_ELECTRON_GUI_SMOKE` was not set.
  Sender/scope/hash-file contracts and packaged launch were covered by the
  non-GUI security and package suites instead.

## P6S01 unchanged proof

The real acceptance project was read only:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot`

Before and after P8-A:

- file count: `39`
- content-tree SHA-256:
  `ea246887e632b071260baf0364394acb05f58bc5da3271914c75a4aee4ca1ea2`
- export-like files or directories: `0`
- latest file modification: `2026-07-15T14:49:04+0800`, before the P8-A
  execution started at `2026-07-15T19:36:22+0800`

No P6S01 media, receipt, Project.vibe fact, or sidecar changed.

## Readiness for P8-B

P8-A passes and the codebase may enter P8-B. P8-B itself is not authorized by
this result: executing one real local P6S01 export still requires a fresh,
explicit user authorization. Until then, P6S01 remains preview-approved only,
unpromoted, and unexported.
