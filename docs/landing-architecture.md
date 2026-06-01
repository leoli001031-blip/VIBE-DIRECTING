# Landing Architecture Notes

## MVP User Path Contract

The MVP landing path is a local, open-source friendly Project.vibe workflow:

- A user opens a project folder that contains `project.vibe`; the repository sample is `sample-projects/mvp-demo`.
- The app reads Project.vibe as the source of truth for manifest, story flow, locked visual memory, shots, assets, and run receipts.
- The owned Agent Loop works from those facts and writes structured receipts back into the project.
- P6 Image2 work is gated: contract tests and explicit preflight are safe no-submit paths, and real submit requires explicit human approval.
- Preview and export operate on project-local artifacts and text package plans.
- Electron package checks prove the same local-first path works from the desktop shell and bundled local runtime.
- The path runs from local files and project-local receipts.

Worker-facing docs should present this as the main route. Legacy Codex/Claude CLI, subagent, and old real-provider checks may remain as compatibility diagnostics, but they should not be described as the MVP user journey.

## Project.vibe Minimal Fact Source

This round introduces a small `src/project` module as the first landing point for the owned Agent Loop. It is intentionally separate from the older runtime-fixture path and the heavier `src/core` Project Store gates.

The minimal Project.vibe document is a single JSON file named `project.vibe`. Its TS model is the source of truth for now; this round does not add JSON schemas, so there is no second schema surface to keep in sync.

Current minimum facts:

- `manifest`: project identity, version, timestamps, `sourceOfTruth=project_vibe`, and `runtimeFixtureAuthority=false`.
- `storyFlow`: adaptive sections and canonical shot order.
- `visualMemory`: locked/candidate asset authority policy plus visual memory entries.
- `shots`: shot intent and asset bindings.
- `assets`: portable project-root-relative references and text constraints.
- `runs`: receipts from Agent Loop, patch, provider, QA, or export work. Receipts are evidence, not authority over project facts.
- `sourceIndex`: generated pointers back into the current Project.vibe facts for Agent Panel reads.

The module supports create, open, save, patch, and transaction receipts through pure TypeScript types and runtime guards. Save/open use a small adapter interface, so the same code can roundtrip on disk in tests and later plug into desktop storage without importing provider, UI, Electron, or legacy CLI diagnostics.

Agent Panel connection plan:

- Read `project.vibe` through `openProjectVibe` at project selection time.
- Show `manifest`, `storyFlow.shotOrder`, locked `visualMemory.entries`, and latest `runs` as the current project facts strip.
- Convert a user request into `ProjectVibeTransaction.operations`, preview the touched shot/asset IDs, then call `applyProjectVibeTransaction`.
- Queue Agent Loop work from the transaction receipt only after `validateProjectVibe` stays green.
- Keep runtime fixtures and provider receipts as evidence refs; never promote them into `sourceOfTruth`.

## Round 2 Demo Path Status

The second-round demo path is a UI contract, not a real provider path. The intended landing flow is:

- `MinimalAgentPanel` owns the visible prototype demo action and result summary.
- `DirectorModeShell` only passes the callback/result wiring through; it should not add provider, schema, credential, or runtime-cache copy.
- `App.tsx` owns the final demo handler or an explicit `prototypeDemoPathWired` marker while parallel workers finish the main-thread implementation.
- The result shown in the Director surface is a lightweight preview receipt for user confidence, not an execution receipt.

Static verification lives in `scripts/prototype-ui-contract-test.mts` and can be run with `npm run prototype-ui:test`. If another worker has not landed the handler yet, the script should fail on the missing target string instead of silently passing.

## Browser Entry Boundary

The browser landing path must not use the `src/agent` barrel. `src/App.tsx` may import a deliberately browser-safe agent submodule such as `./agent/directorPrototypeLoop`, but it must not import `./agent` or `./agent/index`.

The static boundary guard lives in `scripts/browser-entry-boundary-test.mts` and can be run with `npm run browser-entry-boundary:test`. It checks:

- `src/App.tsx` does not import the `src/agent` barrel.
- `src/ui/director` files do not import Node-only modules or read `process.env`.
- The runtime import graph starting at `src/App.tsx` does not reach `src/agent/index.ts`, `src/agent/image2Tool.ts`, or `src/agent/jimengTool.ts`.
- The same graph does not statically import Node-only modules such as `node:fs`, `node:http`, `node:child_process`, or `process`.

This guard is included in `verify:prototype` so prototype UI work fails before provider, legacy CLI, or filesystem-only code leaks into the Vite browser bundle.

## Verification Entry Direction

The landing path now treats `npm run verify:prototype` and `npm run verify:ui` as the main verification surface. They cover the owned Agent Loop, Project.vibe facts, prototype UI contract, minimal UI, export/audio preview, Electron bridge/runtime smoke, and build checks without presenting old Codex/subagent/provider routing as the product path.

The older Codex/subagent/real-provider route is a legacy compatibility surface. Its commands remain available under explicit `verify:legacy:*` names, and the historical aliases still exist only so older handoffs do not break:

- `verify:legacy:subagent` is the named replacement for legacy subagent route checks.
- `verify:legacy:provider-fast` is the named replacement for the non-submitting provider boundary check.
- `verify:legacy:all` preserves the broad historical aggregate.
- `verify:subagent`, `verify:provider-fast`, and `verify:all` are deprecated aliases.

New architecture notes, worker briefs, and checklist updates should point to the prototype/UI mainline first. Legacy route checks should be mentioned only when maintaining older scripts, reviewing old receipts, or proving backward compatibility.

## MVP RC Mainline

The MVP release-candidate chain is:

1. Project.vibe local project open and persistence.
2. Owned Agent Loop against locked Project.vibe facts.
3. P6 Image2 contract tests and no-submit preflight.
4. Preview/Export output from project-local artifacts.
5. Electron package smoke and unpacked package build.

Use `docs/mvp-rc-checklist.md` as the operational RC checklist. Its required commands are:

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

`mvp-rc:smoke` is a packaging-centered shortcut, not the whole evidence set. Keep the individual commands visible for release notes and worker handoffs.

The no-submit P6 preflight is part of RC because it proves the provider gate remains closed while still writing evidence. The optional `p6-real-image2:submit-live` path is not an RC default and must not be added to aggregators.

## Owned Agent Prototype Loop Split

The first owned Director Agent closed loop is `runDirectorPrototypeClosedLoop` in `src/agent/directorPrototypeLoop.ts`. That function remains the public compatibility entrypoint for App and tests, but the implementation now delegates to smaller owned-Agent modules instead of letting the demo handler do every job:

- `directorAgentPlan.ts`: resolves the selected Project.vibe shot, derives run/request ids, builds the locked-facts prompt, and creates the tool context.
- `directorAgentProviderTools.ts`: registers the mock-only provider boundary tools and publishes the required tool order.
- `directorAgentMockProvider.ts`: drives the deterministic local Agent Loop provider with no live provider or credential path.
- `reviewState.ts`: tracks provider request state and enforces promoted, mock-only review completion.
- `projectWriter.ts`: creates and appends the Project.vibe run receipt through a transaction.
- `previewAdapter.ts`: turns the promoted provider request into the preview item and provider summary consumed by the UI.

This split is still intentionally prototype-scoped: it appends a Project.vibe run receipt, returns one preview item, preserves provider tool trace order, and keeps all provider work mock-only. It should not be used to reopen the old Codex/subagent route or the real-provider route.
