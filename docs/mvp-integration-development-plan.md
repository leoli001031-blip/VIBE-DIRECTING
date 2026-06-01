# MVP Integration Development Plan

Updated: 2026-05-18

This document is the current development baseline for Vibe Director Studio. It
supersedes the root `PLAN.md` as an active worker brief, but does not delete or
rewrite historical planning documents.

## Baseline Status

Vibe Director Studio is a local-first Project.vibe desktop app. The current MVP
path is not the older Codex/Claude CLI route and not a diagnostics dashboard.

Current source-of-truth order:

1. `README.md` for repo entry, local commands, release commands, and active MVP
   path summary.
2. `docs/mvp-integration-development-plan.md` for current worker development
   baseline and six-round integration plan.
3. `docs/mvp-delivery-technical-debt-plan.md` for the post-integration
   execution plan, MVP closure order, and technical-debt cleanup.
4. `docs/mvp-rc-checklist.md` for release-candidate evidence requirements.
5. `docs/mvp-rc-status.md` for latest retained local verification evidence.
6. `AGENT.md` for product north star and default UI contract.
7. Historical docs such as root `PLAN.md`, `docs/demo-completion-plan.md`, and
   older audit notes for context only.

Do not use line counts, deletion matrices, or old phase names from root
`PLAN.md` as current implementation authority without rechecking the active
checkout.

## Main MVP Path

The main product route to preserve is:

1. Open a local project folder containing `project.vibe`.
2. Read manifest, story flow, locked visual memory, shots, assets, and receipts
   from Project.vibe facts.
3. Turn natural-language director intent into a staged Project.vibe transaction.
4. Require user confirmation before Project.vibe facts are written.
5. Queue only validated task envelopes; free text cannot enter formal work.
6. Run the owned Agent Loop from validated facts and envelopes.
7. Accept structured results as receipt candidates, not automatic truth.
8. Keep Image2 behind P6 contract, preflight, permission, submit, return ingest,
   review, and promotion boundaries.
9. Show returned media in Preview only as `needs_review` or verified media.
10. Export project-local receipts, reports, and media references.
11. Package the same local-first workflow through Electron with the local
    runtime bundle.

Creator-facing surfaces should stay simple: Story Flow, locked Visual Memory /
Asset Library, selected scope, natural-language Director input, Preview, Export,
and short status text. Provider mechanics, task envelopes, raw receipts, queue
internals, knowledge routing, QA internals, and route diagnostics belong in
Diagnostics.

## Current Six-Round Development Plan

R0 is this baseline/documentation round. R1-R6 are the active MVP integration
rounds for moving from prototype scaffolding toward a usable local creator app.
They intentionally keep the default user path separate from legacy diagnostics.

### R1: Project.vibe Creative Loop

Goal: make Project.vibe a real product fact source, not a fixture or receipt
dump.

Primary scope:

- `src/project/projectVibeCreativeLoop.ts`
- Project.vibe open/save/restore tests and fixtures
- staged transaction and validated task envelope evidence

Boundaries:

- Natural language first creates a staged transaction only.
- User confirmation is required before Project.vibe facts change.
- Free text cannot enter the formal task queue.
- Confirmed facts must be typed and recoverable from Project.vibe, not only run
  receipts.

Acceptance:

```bash
npm run project-vibe-creative-loop:test
npm run project-vibe-runtime-state:test
```

### R2: Script Planner Main Path

Goal: turn the early script-planning knowledge into a deterministic planner that
can create a story-flow draft before any provider or Agent work.

Primary scope:

- `src/core/scriptPlanner.ts`
- script knowledge routing
- Project.vibe patch operations for sections and shots

Boundaries:

- No LLM or provider call.
- Sparse ideas may produce blockers, but still return a structured draft.
- Script knowledge packs are sources; they do not become provider prompts.

Acceptance:

```bash
npm run script-planner:test
npm run knowledge:test
```

### R3: Prompt And Keyframe Planning From Project.vibe

Goal: restore Project.vibe into a runtime projection that can produce image
prompt plans, image task plans, start frames, and end-frame-from-start plans.

Primary scope:

- `src/core/projectVibePlanningProjection.ts`
- `src/project/projectVibeRuntimeState.ts`
- prompt compiler, image task planner, and image keyframe runtime integration
  tests

Boundaries:

- Runtime state remains a derived projection, not a fact authority.
- End frames must derive from start frames; no independent text-to-image end
  frame fallback.
- Missing or unsafe references block or warn instead of becoming locked facts.

Acceptance:

```bash
npm run project-vibe-prompt-keyframe:test
npm run image-keyframe:test
npm run project-vibe-runtime-state:test
```

### R4: Owned Agent Loop And Lanyi/Image2 Tool Contract

Goal: give the owned Agent Loop a clear Lanyi/Image2 main-path contract without
reviving old CLI-first routes.

Primary scope:

- `src/agent/lanyiImage2AgentTool.ts`
- `src/agent/ownedAgentLoop.ts`
- owned-loop tests

Boundaries:

- The tool accepts validated task envelopes or structured image tasks only.
- Mock and real provider paths are explicitly named.
- Real provider mode returns a gated contract and never performs network IO from
  the Agent Loop.
- Results are receipt/evidence candidates and cannot auto-promote.

Acceptance:

```bash
npm run owned-agent-lanyi-image2-tool:test
npm run owned-agent-loop:test
npm run agent-loop:test
```

### R5: Reference Image Edit Concurrency And Retry Safety

Goal: prepare for reference-image generation at controlled concurrency while
preserving review and promotion gates.

Primary scope:

- `src/core/referenceEditPolicy.ts`
- `src/core/providerRetryScheduler.ts`
- policy and scheduler tests

Boundaries:

- Reference edit is `image.edit` / `image2image`.
- Only locked or approved start-frame references are valid.
- Default and maximum reference edit concurrency is 3.
- Partial, late, and retry returns land as `needs_review` or `missing`; never
  automatic promotion.

Acceptance:

```bash
npm run reference-edit-policy:test
npm run provider-retry-scheduler:test
```

### R6: UI/Action Split And Release Validation

Goal: keep the desktop app understandable while reducing `src/App.tsx`
composition pressure and keeping the default Director desk free of internals.

Primary scope:

- `src/App.tsx`
- `src/ui/app/`
- `src/ui/director/`
- package/verification scripts

Boundaries:

- Do not change provider submit, return ingest, or promotion behavior.
- Do not expose provider, queue, schema, manifest, route, or receipt internals in
  the default surface.
- Live provider tests stay outside default verification and require explicit
  human approval.

Acceptance:

```bash
npm run minimal-ui:test
npm run verify:ui
npm run verify:prototype
npm run package:smoke
```

Human-approved live submit, when explicitly requested, is outside default
verification:

```bash
VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01
```

Record every live run report path and run `p6-real-image2:secret-scan` after it.

## Legacy And Diagnostics Boundary

Legacy routes are allowed for compatibility and debugging, but they are not the
MVP path:

```bash
npm run verify:legacy:subagent
npm run verify:legacy:provider-fast
npm run verify:legacy:all
```

Rules:

- Record why a legacy diagnostic was needed.
- Keep legacy results separate from MVP acceptance.
- Do not mention old Codex/Claude CLI or subagent routes as the default worker
  route.
- Do not use historical aliases as release gates when named current commands
  exist.
- Diagnostics may expose receipts, raw task events, provider facts, knowledge
  route traces, and app-server ingest facts; the default Director surface should
  not.

## Acceptance Command Ladder

Use the smallest command set that matches the changed surface.

Documentation-only baseline:

```bash
git diff --check
```

Default smoke before handoff:

```bash
npm run verify:ui
npm run verify:prototype
```

MVP RC evidence:

```bash
npm run mvp-rc:smoke
npm run verify:prototype
npm run verify:ui
npm run mvp-demo-export:test
npm run p6-real-image2:test
npm run p6-real-image2:preflight -- --shots=P6S01
npm run preview-export-audio-e2e:test
npm run package:smoke
npm run package:dir
```

Do not treat a passing fast provider/tools contract as live-provider approval.

## Current Risks

- Historical docs still describe old CLI/subagent and mass-delete plans. Keep
  those documents but label root `PLAN.md` as a historical snapshot.
- Real chat LLM provider execution is not wired as a live MVP gate; the owned
  Agent Loop is currently verified through structured/mock provider paths.
- Real Image2 multi-shot results can be partial. Partial return evidence must
  preserve missing shot IDs and keep promotion disabled.
- Package output is local/ad-hoc and may still have platform-specific signing or
  dependency warnings; do not treat it as notarized distribution readiness.
- Large UI/runtime files still create coordination risk. Do route maps and file
  ownership before opening parallel workers.
- Test fixtures and export/package directories can be write-heavy. Avoid running
  multiple commands that mutate the same fixture or release output at once.
- Credentials and provider keys must never be written, displayed, committed, or
  echoed in reports.

## Worker Start Checklist

1. Confirm this repo root and current command list from `package.json`.
2. If the directory is inside a git checkout, capture `git status --short`
   before editing; this workspace may also be used without a local `.git`
   directory.
3. Read `README.md`, this document, and the narrow doc or source module for the
   round being changed.
4. State the intended write range before editing.
5. Do not delete historical docs.
6. Run the lightest relevant acceptance command and report skipped heavier tests
   explicitly.
