# Vibe Director Studio

Local-first AI video director workspace for `Project.vibe` projects.

## Current Entry

- Current status and acceptance truth: `docs/CURRENT-STATUS.md`.
- Repository working rules: `AGENTS.md`.
- Canonical development root: `/Users/lichenhao/Desktop/new vibe directing`.
- Durable project contract: `Project.vibe` inside the selected project folder.
- Focused Session Timeline gate: `npm run agent-session-timeline:test`.
- Focused Agent/UI gates: `npm run minimal-agent-p1:test` and
  `npm run minimal-ui:test`.
- Type and patch checks: `npx tsc --noEmit --pretty false` and
  `git diff --check`.
- NPM script map: `npm run scripts:groups`.
- Runtime cleanup is always two-step: `npm run runtime:prune` previews;
  `npm run runtime:prune:apply` performs only its scoped deletion.

The product path is Agent-first:

1. Open or create a local project.
2. Clarify the director intent and form a proposal.
3. Confirm any project mutation or paid execution at its own boundary.
4. Track Running work by durable job identity.
5. Review returned media as `needs_review`.
6. Select and explicitly promote accepted project facts.
7. Confirm Delivery and local export separately.

Do not start a frontend dev server for ordinary contract or packaged
acceptance. Use it only when a development task explicitly requires a renderer
session. Real Provider calls are also outside ordinary verification.

## Historical Demo Material

The following documents remain useful as dated demo evidence, but they are not
the current product-status authority:

- Demo architecture: `docs/current-demo-architecture.md`.
- Agent Kernel v1 demo status: `docs/agent-kernel-v1-demo-status.md`.
- Recording runbook: `docs/demo-recording-runbook.md`.
- Final rehearsal checklist: `docs/demo-final-rehearsal-checklist.md`.
- Historical aggregate gate: `npm run demo:ready:test`.

Old Codex/Claude CLI, subagent, P6 Image2, TTS, and music-analysis routes are
diagnostics, evidence, or deferred lanes. Read their dated acceptance records
before using them.

## Release / Package

The desktop package is built with Electron Builder from the Vite output plus the
Electron shell and bundled local runtime server.

- `npm run package:smoke` rebuilds `electron-runtime/local-runtime-api-server.mjs`
  and runs the lightweight runtime bundle and Electron preload/IPC smoke tests.
- `npm run verify:rc` is the default RC gate. It runs focused UI verification
  plus `mvp-rc:smoke`, which covers prototype verification, the P6 Image2
  no-submit preflight, package smoke, `package:dir`, and a final check that the
  packaged runtime server is present under `app.asar.unpacked/electron-runtime`,
  then runs the retained-artifact secret scan.
- `npm run package:dir` creates an unpacked local app under `release/` with the
  local signing lane: ad-hoc macOS signing, no notarization, and no upstream
  Node deprecation warning noise.
- `npm run package:mac` creates the macOS target under `release/` with the same
  local signing lane.
- `npm run package:release:preflight` checks that Developer ID signing and Apple
  notarization credentials are configured before a distributable release build.
- `npm run package:release:mac` builds the signed/notarized release lane and
  intentionally fails fast when release credentials are missing.
- `npm run package:all` runs Electron Builder for the configured macOS, Windows,
  and Linux targets through the local packaging lane.

Packaging relies on `build.files` including `electron-runtime/**/*`; that runtime
bundle is also listed in `asarUnpack` because the packaged main process starts it
as a local child process.

Local open-source RC smoke does not require a hosted account, Developer ID
signing identity, notarization, or provider credentials. Release signing and
notarization are intentionally handled by the `package:release:*` scripts.

## Legacy MVP RC Verification

These retained aliases cover the older MVP/RC baseline:

```bash
npm run verify:mvp
npm run verify:rc
```

They are broad regression suites, not the source of the current P13 acceptance
verdict. Check `docs/CURRENT-STATUS.md` before treating a package result as
current packaged-App proof.

`p6-real-image2:preflight` is the safe no-submit path inside `verify:rc`: it prepares P6 evidence and must report `providerCalled=false` plus `runtimeExternalNetworkCallMade=false`; it does not call Lanyi or any other provider. Real submit uses `p6-real-image2:submit-live` with `VIBE_IMAGE2_API_KEY` and `VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2`; it is manual, human-approved live evidence only, not default CI and not part of `verify:mvp`, `verify:rc`, or legacy diagnostics aggregators. Multi-shot live submit uses scheduler-controlled one-shot provider requests (`scheduler_one_shot_with_retry`) instead of a single provider request with `n=3`; default live policy is max concurrency 3, retry concurrency 2, and max auto retries 2.

App-triggered P6 real Image2 is gated the same way: it requires explicit action-time confirmation, a submit permission receipt, and a configured Lanyi key status. The app and runtime must never write or display the raw API key. Returned outputs project into preview as `needs_review` or `verified`, while formal promotion remains false by default until separate human QA and promotion authorization exist.

## Scope

Vibe Core is the local director desk between the creator, Project.vibe, the owned agent loop, and controlled generation providers. It should hold project structure, visual memory, shot state, provider policy, task envelopes, audit results, and preview/export status.

The MVP direction is local-first and open-source friendly: project creation, project opening, preview, export, and the self-owned agent loop should work from local files.

The main product path is Project.vibe plus the owned Agent Loop, validated task envelopes, structured results, P6 Image2 preflight/live gates, Preview/Export, Electron package checks, receipts, and controlled project-local artifacts. Legacy CLI route checks are diagnostics and compatibility surfaces, not the worker-facing MVP path.

## Sample Project Contract

`sample-projects/mvp-demo` is the checked-in demo project for MVP walkthroughs and smoke tests. It includes:

- A portable `project.vibe` with three shots, locked assets, visual memory, and local receipts.
- Text-only placeholder assets under `assets/` so the sample is safe to ship in the repository.
- A local export smoke in `scripts/mvp-demo-export-test.mts`.

Keep the sample free of remote-service assumptions. New workers should use it as the Project.vibe-first example before touching provider or legacy route checks.

## Active Policy

- Image generation and image editing are Image2 only.
- Jimeng/Seedance video generation is a gated live lane, not default CI. The app may prepare storyboard-reference / all-around-reference video plans, but live submit must remain user-enabled, action-confirmed, credential-gated, and outside `verify:mvp` / `verify:rc`.
- Required image-to-image tasks must not fall back to text-to-image.
- Candidate or failed assets must not become future reference authority.
- End-frame generation is no longer the default story-video path. The main path is script -> storyboard -> locked character/scene/prop assets -> start/storyboard reference -> Seedance all-around reference video. End-frame control stays as an advanced branch for loop, transformation, or explicit first/last-frame control.

## Continuous Development Guardrails

Before adding real model calls or polished UI, keep the core contract layer hard:

- Preflight must pass before any job can enter `ready_to_submit`.
- Unknown providers are blocked.
- Parked providers can only create task envelopes or queue placeholders.
- References must carry authority metadata, not only file paths.
- Formal worker/agent work must use a generated task envelope; no ad-hoc context handoff.
- End-frame tasks, when explicitly requested, must prove derivation from approved start/reference frames before video generation.
- Draft preview and formal preview/export are separate.
- No real Jimeng/Seedance submit unless the video provider lane is explicitly enabled for that action and the user confirms the live run.
- No complex timeline editor, prompt parameter panel, audio generation, or multi-provider UI until the schema/queue/manifest core is stable.
