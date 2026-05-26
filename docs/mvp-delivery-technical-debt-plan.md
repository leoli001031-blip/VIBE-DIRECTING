# MVP Delivery And Technical Debt Plan

Updated: 2026-05-18

This is the execution plan after the Project.vibe / Script Planner / Lanyi
Image2 integration round. It assumes the product remains local-first,
open-source friendly, and Project.vibe centered. It also assumes the old
Codex/Claude CLI route is legacy diagnostics only.

## Current Baseline

What is now proven:

- Project.vibe create/open/save/restore works.
- Natural-language director intent stages a transaction first; confirmation is
  required before Project.vibe facts are written.
- Confirmed creative-loop input writes typed shot intent facts instead of only
  appending receipts.
- Script Planner produces `script_brief`, sections, shots, blockers, source
  knowledge pack ids, and Project.vibe patch operations.
- Project.vibe rebuild now produces prompt/image task/keyframe planning instead
  of empty `jobs`.
- Start frames are planned through `image.generate`; end frames are planned as
  `image.edit` / image-to-image derived from start frames.
- Owned Agent Loop has a Lanyi/Image2 tool contract. It accepts validated
  envelopes or structured image tasks only and emits receipt/evidence
  candidates, not automatic project promotion.
- Real Lanyi `gpt-image-2` has been tested:
  - 1-shot text-to-image succeeded.
  - 3-shot serial P6 path safely handled partial return.
  - 3-concurrent text-to-image has succeeded in prior probes but was unstable
    in the latest integrated probe, where all three concurrent requests failed
    with network errors.
  - Retry/downshift to concurrency 2 partially recovered the latest integrated
    text-to-image probe.
  - 5-concurrent text-to-image was not stable enough for default use.
  - 3-concurrent reference edit succeeded.
- Preview/Export can consume returned `needs_review` media, including partial
  returns matched by `shotId`.
- `verify:mvp` and `package:smoke` passed after the latest integration work.

Current known debt markers:

- `src/App.tsx`: about 5.8k lines.
- `src/core/phaseRoadmapRuntime.ts`: about 5k lines.
- `scripts/local-runtime-api-server.mts`: about 850 lines.
- `src/core` top-level files: about 134 files.
- `scripts` top-level files: about 242 files.
- Public macOS distribution still needs Developer ID signing and Apple notarization
  credentials; local MVP smoke now uses an explicit ad-hoc packaging lane.
- Main app entry is now about 180 kB uncompressed; `core-runtime` remains about
  808 kB and should stay on the v0.2 bundle-health list.
- Historical docs and old scripts still mention legacy CLI/subagent paths.

## Target MVP Definition

The MVP is not a full video editor. The MVP is a local director desk where a
creator can:

1. Create or open a local Project.vibe folder.
2. Enter a story idea or shot change in natural language.
3. Review a staged plan before project facts change.
4. Generate or update a script/story-flow draft.
5. Plan prompts plus start/end frames from Project.vibe facts.
6. Submit controlled Image2 batches through a permission gate.
7. See successful returns as `needs_review` media and failed returns as missing
   placeholders.
8. Review outputs and optionally promote approved results to project facts.
9. Export a project-local package containing Project.vibe, media, receipts,
   reports, and preview/export manifests.
10. Run the same path in Electron dev and packaged smoke.

## Workstream A: Batch Generation Main Path

Goal: move from one-off P6 scripts to the product batch path.

Default policy:

- `image.generate` default max concurrency: 3, guarded by retry/downshift
  behavior rather than treated as guaranteed provider stability.
- Failed text-to-image retry concurrency: 2.
- Max auto retries: 2.
- `image.edit` / reference edit concurrency: 3.
- Five-concurrent text-to-image stays experimental.
- Every returned output starts as `needs_review`.
- Missing or late outputs cannot promote.

Implementation steps:

1. Add an Image2 batch scheduler around existing task envelopes and provider
   retry scheduler.
2. Consume `IMAGE2_GENERATE_MAX_CONCURRENCY`,
   `IMAGE2_GENERATE_RETRY_CONCURRENCY`, and
   `IMAGE2_GENERATE_MAX_AUTO_RETRIES` from provider policy instead of hardcoded
   route constants.
3. Replace P6-only serial live behavior in the product path with a batch plan
   that can run up to 3 active text-to-image requests.
4. Keep the existing P6 serial script as a diagnostics/manual runbook path.
5. Write per-attempt receipts with input hash, permission receipt id,
   provider request id when available, output hash, status, and retry reason.
6. Represent partial runs as successful batch execution with missing items, not
   as global failure.

Acceptance:

```bash
npm run provider-retry-scheduler:test
npm run reference-edit-policy:test
npm run runtime-api-current-project-image2-batch-plan:test
npm run p6-real-image2:app-action-test
npm run p6-real-image2:serial-batch-test
npm run verify:runtime-fast
```

Manual live acceptance:

These are human-approved live evidence steps only. They must stay outside
default CI, `verify:mvp`, `verify:rc`, and diagnostics/legacy aggregators.

```bash
LANYI_API_KEY=... npm run lanyi-image-generate-concurrency:probe -- --concurrency=3
LANYI_API_KEY=... npm run lanyi-reference-edit-concurrency:probe -- --concurrency=3 --reference=<approved-start-frame>
npm run p6-real-image2:secret-scan
```

## Workstream B: Review, QA, And Promotion

Goal: turn `needs_review` returns into a real creator decision loop.

Implementation steps:

1. Add a first-class review queue for returned media:
   `needs_review`, `approved`, `rejected`, `missing`, `retry_requested`.
2. Consume `lanyi_image2_receipt_candidate` in the QA/promotion layer.
3. Require human review plus output hash binding before promotion.
4. Promotion writes Project.vibe facts only through a staged transaction.
5. Approved media can become locked visual memory only when it has review
   status, source receipt, hash, and project-relative path.
6. Rejected and missing media remain visible in Preview as placeholders or
   review history, not future references.

Acceptance:

```bash
npm run provider-qa-promotion-gate:test
npm run provider-closed-loop-shell:test
npm run p3-image2-small-batch-preview:test
npm run project-vibe-creative-loop:test
npm run project-vibe-runtime-state:test
```

Manual acceptance:

- Generate 3 shots.
- Approve one, reject one, retry one missing.
- Reopen the project.
- Verify only the approved result is available as locked project memory.

## Workstream C: Project.vibe Schema And Fact Completeness

Goal: keep Project.vibe as the durable source of truth while avoiding schema
sprawl.

Implementation steps:

1. Add optional Project.vibe sections for script planning facts:
   `scriptBrief`, `scriptPlannerReceipts`, or an equivalent compact model.
2. Add durable prompt/keyframe planning receipts without storing provider
   prompt text as raw mutable truth.
3. Add task batch receipts and review receipts.
4. Keep runtime-state as a derived cache only.
5. Add migration-sized compatibility tests for older Project.vibe files.
6. Keep artifact paths project-relative and portable.

Acceptance:

```bash
npm run project-vibe:test
npm run project-vibe-runtime-state:test
npm run project-vibe-creative-loop:test
npm run project-vibe-prompt-keyframe:test
npm run project-vibe-local-persistence:test
```

## Workstream D: Creator UI Productization

Goal: make the app feel like a usable director desk rather than a diagnostics
console with a friendly shell.

Implementation steps:

1. Add a simple Script Planner panel:
   idea input, generated brief, sections, missing questions, apply-to-project.
2. Add a batch generation panel:
   selected shots, concurrency policy, expected outputs, permission receipt,
   submit button, retry-missing action.
3. Add a review tray:
   image preview, approve, reject, retry, lock as visual memory.
4. Keep Diagnostics available but not part of the default creative path.
5. Use user-facing labels:
   `Needs review`, `Missing`, `Retry`, `Approved`, `Locked`.
6. Hide provider/schema/queue/task envelope terms from the default surface.

Acceptance:

```bash
npm run minimal-ui:test
npm run current-project-ui-closed-loop:test
npm run verify:mvp
```

Browser/Electron smoke:

- Open an empty project.
- Generate a script draft.
- Confirm a project change.
- Run a safe batch preflight.
- Show returned media as needs-review.
- Export a package.

## Workstream E: Export And Desktop RC

Goal: make the current app handoffable as a local MVP.

Implementation steps:

1. Ensure export includes Project.vibe, locked assets, reviewed media, receipts,
   reports, prompt/keyframe planning receipts, and batch summaries.
2. Add a sample project that demonstrates script planning, one generated output,
   one missing placeholder, and one review item.
3. Keep `package:smoke` as the desktop gate.
4. Keep notarization outside internal MVP, but use `package:release:preflight`
   before public macOS distribution.
5. Keep raw credentials out of package, logs, reports, and exported manifests.

Acceptance:

```bash
npm run mvp-demo-export:test
npm run preview-export-audio-e2e:test
npm run package:smoke
npm run p6-real-image2:secret-scan
```

## Technical Debt Plan

### TD1: App.tsx Split

Problem: `src/App.tsx` remains too large and owns too many unrelated concerns.

Steps:

1. Extract project file/open/save state into `src/ui/app/`.
2. Extract Image2 action state into `src/ui/director/actions/`.
3. Extract diagnostics projection builders into `src/ui/diagnostics/`.
4. Extract current-project runtime binding UI state into a hook.
5. Keep each extraction behavior-preserving and covered by `verify:mvp`.

Target:

- `src/App.tsx` below 3k lines before MVP RC.
- No product behavior changes during extraction rounds.

### TD2: Runtime API Route Layering

Problem: `scripts/local-runtime-api-server.mts` is still a composition root,
route dispatcher, credential route owner, current-project API owner, and P6
route owner in one file.

Steps:

1. Move route handlers into `scripts/runtime-routes/`.
2. Keep `local-runtime-api-server.mts` as server bootstrap plus route registry.
3. Split credentials/status/project/image2/export route modules.
4. Keep route names semantic: prepare, permission, submit, return ingest,
   review, promotion.
5. Ensure prepare routes cannot submit providers.

Acceptance:

```bash
npm run local-runtime-api:test
npm run runtime-api-boundary:test
npm run verify:runtime-fast
```

### TD3: Core Domain Physical Split

Problem: `src/core` top-level is too crowded.

Target folder shape:

- `src/core/project/`
- `src/core/providers/`
- `src/core/generation/`
- `src/core/preview-export/`
- `src/core/knowledge/`
- `src/core/qa/`
- `src/core/diagnostics/`
- `src/core/legacy/`

Rules:

- Move one domain per round.
- Keep barrel exports or compatibility aliases until tests are updated.
- Do not mix file moves with behavior changes unless the test is very narrow.

Acceptance:

```bash
npx tsc --noEmit --pretty false
npm run verify:mvp
```

### TD4: Phase Roadmap Runtime Retirement

Problem: `phaseRoadmapRuntime.ts` is a historical mega-module.

Steps:

1. Freeze it as diagnostics-only.
2. Identify which current tests still depend on it.
3. Move active facts to smaller domain modules.
4. Keep old phase names out of the default Director UI.
5. Delete or legacy-mark sections only after no current test depends on them.

Acceptance:

```bash
npm run phase-roadmap:test
npm run verify:mvp
```

### TD5: Script And Artifact Hygiene

Problem: the repo has many top-level scripts and accumulated live artifacts.

Steps:

1. Group scripts by domain:
   `scripts/runtime/`, `scripts/project/`, `scripts/provider/`,
   `scripts/ui/`, `scripts/package/`, `scripts/probes/`.
2. Keep package script aliases stable during the move.
3. Add artifact retention rules for `test_artifacts/` and
   `real-test-sandbox/`. Current rulebook:
   `docs/mvp-artifact-retention.md`.
4. Keep live reports, but remove or ignore bulky generated media that is not
   part of retained evidence.
5. Ensure secret scan covers every retained live artifact root.

Acceptance:

```bash
npm run p6-real-image2:secret-scan
npm run verify:mvp
```

### TD6: Documentation Authority Cleanup

Problem: historical docs still mention old routes and can confuse workers.

Steps:

1. Keep `README.md`, `docs/mvp-integration-development-plan.md`, this document,
   and `docs/mvp-rc-status.md` as current authority.
2. Add historical banners to old phase/audit docs when they are no longer
   active plans.
3. Do not delete old docs until all active links are updated.
4. Keep the live provider runbook separate from default verification.

Acceptance:

```bash
rg -n "Codex CLI|Claude CLI|subagent route|verify:legacy" README.md docs/*.md
```

Expected result: old terms may appear in legacy/history docs, but not as the
default MVP path.

## Recommended Execution Order

1. Batch scheduler main path:
   max concurrency 3, retry concurrency 2, partial-return receipts.
2. Review and promotion gate:
   approve/reject/retry UI and Project.vibe promotion transaction.
3. Project.vibe fact completeness:
   durable script brief, planning receipts, review receipts.
4. Creator UI productization:
   Script Planner panel, batch generation panel, review tray.
5. Export/Desktop RC:
   sample project, export package completeness, package smoke.
6. Technical debt round 1:
   App.tsx split and runtime route layering.
7. Technical debt round 2:
   core physical split and phaseRoadmapRuntime retirement.
8. Documentation and artifact cleanup:
   authority docs, retained evidence, secret scan roots.

## MVP Exit Criteria

The MVP is ready when all of these are true:

- Fresh `verify:mvp` passes.
- Fresh `verify:rc` passes.
- Fresh `package:smoke` passes.
- A local sample project can go from idea to Project.vibe facts to batch
  generation plan to needs-review media to export package.
- Human-approved real Lanyi live evidence proves 3-concurrent text-to-image or
  controlled retry from partial return; this evidence stays outside default CI.
- Reference edit with a locked reference succeeds at concurrency 3 or fails
  into `needs_review` / `missing` without promotion.
- Secret scan passes over all retained live artifact roots.
- Default UI exposes creator language, not provider/schema/queue internals.
- Project.vibe remains the durable fact source; runtime-state remains derived.
- Legacy CLI/subagent routes are not part of the MVP path.
