# Agent-first P8-B packaged local export acceptance

Date: 2026-07-15

Status: PASS for one authorized packaged App local export, receipt validation,
and cold-start recovery.

Readiness label:
`P8-B closed; P6S01 is exported for local delivery but remains preview-approved only and unpromoted; ready for the next non-UI stage`.

## Authorization and boundary

The user authorized related local packaged App export, verification, and test
actions for 48 hours from `2026-07-15T22:05:31+08:00` through
`2026-07-17T22:05:31+08:00`.

This authorization did not permit a provider submission or retry, project-fact
promotion, deletion, or publishing. P8-B made no text, image, or video provider
call and did not change `promotionAuthorized=false`.

## Accepted project and review evidence

Project root:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot`

The export used the existing P7 review receipt:

- review receipt: `review_P6S01_20260715064610`
- shot: `P6S01`
- status: `approved`
- human reviewed: `true`
- promotion authorized: `false`
- source receipt: `seedance_submit_d2c02c02-1c3d-4763-af77-d60816f642cb`
- media: `video/seedance_2026-07-14T14-03-45-563Z/video/d2c02c02-1c3d-4763-af77-d60816f642cb_video_1.mp4`
- media SHA-256: `bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`

After export and cold restart, authoritative `Project.vibe` still contained one
shot, eight assets, eight visual-memory entries, no batch receipt, and the same
review receipt. `P6S01` remained `blocked` as a project fact because preview
approval and local export do not authorize promotion.

## Packaged App execution result

The successful packaged execution was:

- project fact hash: `pv_cc4049f3`
- action: `agent_action_2026_07_15t15_18_12_103z_prepare_export`
- confirmation: `agent_tool_handoff_2026_07_15t15_19_35_245z_agent_action_2026_07_15t15_18_12_103z_prepare_export`
- job: `agent_video_job_minimal_agent_current_task_export_001`
- delivery receipt: `export_delivery_agent_action_2026_07_15t15_18_12_103z_prepare_export_agent_tool_handoff_2026_07_15t15_19_35_245z_agent_action_2026_07_15t15_18_12_103z_prepare_export`
- execution mode: `live`
- status: `succeeded`
- provider called: `false`

The UI reported 24 completed worker steps. The delivery receipt bound 16
physical output files under:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot/exports/current-project`

Files:

1. `Project.vibe`
2. `asset_package_manifest.json`
3. `audio/manifest.json`
4. `export_manifest.json`
5. `final-video/01_P6S01.mp4`
6. `final-video/composition_manifest.json`
7. `knowledge_references.json`
8. `locked_assets.json`
9. `preview_media.json`
10. `receipts.json`
11. `receipts/video/video_receipts.json`
12. `report.md`
13. `rough_cut_timeline.json`
14. `storyboard_table.tsv`
15. `video-report/summary.md`
16. `videos/video_manifest.json`

Every receipt output existed, stayed inside `exports/current-project`, and
matched its recorded SHA-256. The copied final video and source video both
matched:

`bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`

## Fail-closed discoveries

Four real packaged attempts stopped before a successful write boundary. Their
project, timeline, and ledger evidence was preserved outside the project:

1. `/private/tmp/vibe-director-p8b-blocked-evidence-20260715T141711Z`
   A blocked adapter result incorrectly advertised a planned output path, and
   export preparation used a runtime-derived project that could omit the P7
   review receipt.
2. `/private/tmp/vibe-director-p8b-blocked-evidence-20260715T145205Z`
   A startup empty draft remained in the Project.vibe ref and could overwrite
   the real project with zero shots and a mismatched ledger identity.
3. `/private/tmp/vibe-director-p8b-blocked-evidence-20260715T150119Z`
   A cached local export projection carried an old Delivery Gate identity after
   Project.vibe changed, producing `delivery_confirmation_invalid`.
4. `/private/tmp/vibe-director-p8b-blocked-evidence-20260715T151012Z`
   A selected keyframe used an absolute project path where the export manifest
   contract requires a project-root-relative reference.

The final implementation now:

- propagates structured adapter errors and clears output claims for blocked,
  failed, and cancelled results;
- reopens authoritative Project.vibe from disk before export preparation;
- rebuilds the local Delivery Gate against the current fact hash for every
  execution;
- converts in-project local media and keyframe paths to project-relative
  manifest references while leaving outside-root paths fail-closed.

## Cold-start recovery root cause and closure

The first post-export cold start did not duplicate any file, but the right-side
Agent incorrectly returned to `waiting for export confirmation`.

The underlying local-project restore effect published its loaded target ID
immediately after opening Project.vibe. That state update triggered the effect
cleanup, so the following knowledge, timeline, and generation-ledger awaits saw
`cancelled=true` and stopped. A late bootstrap runtime fixture then supplied an
empty Project.vibe fact hash, leaving the pipeline plan to propose export again.

The loaded target is now published only after the entire local restore
transaction finishes. Bootstrap fixtures cannot overwrite an already restored
local Project.vibe, and current-task completion reads the full restored timeline
instead of a confirmation-focused visible slice.

Final packaged cold-start evidence:

- current fact hash: `pv_cc4049f3`
- restored timeline entries: `17`
- restored ledger jobs: `1`, terminal `succeeded`
- current Agent step: `idle`
- current Agent source: `pipeline_plan`
- requires confirmation: `false`
- visible `confirm export` buttons: `0`
- output size, modification time, and SHA-256 changes after restart: `0/16`
- duplicate export result entries: `0` (one successful result total)

## Minimal implementation surface

- `src/App.tsx`
- `src/core/agentVideoExecutionAdapter.ts`
- `src/core/localPreviewExportProjection.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `scripts/agent-video-execution-adapter-test.mts`
- `scripts/current-project-ui-closed-loop-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/preview-export-audio-e2e-test.mts`
- generated `electron-runtime/local-runtime-api-server.mjs`

No color, layout, typography, card style, or visual-density change was made.
No frontend dev server was started.

## Verification

Passed:

- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run agent-current-task-projection:test`
- `npm run export-worker:test`
- `npm run preview-export-audio-e2e:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npx tsc --noEmit --pretty false`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `git diff --check`

Provider-aware tests reported that no external provider was called. Packaged
build and launch used local ad-hoc signing; Developer ID and notarization remain
outside the local acceptance boundary.

## Readiness

P8-B is closed. The local package exists, its exact review and file evidence is
recoverable, restart does not duplicate writes, and the Agent no longer restores
an obsolete export confirmation as its current task.

P6S01 remains preview-approved only and unpromoted. Any future provider submit
or retry, promotion into project facts, deletion, publishing, or distribution
action remains a separate authorization boundary.
