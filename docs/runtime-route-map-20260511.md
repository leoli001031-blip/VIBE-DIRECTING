# Runtime Route Map Audit - 2026-05-11

Scope: P2 Task 11 read-only route map for `scripts/local-runtime-api-server.mjs`.

This document is a boundary artifact for the next strict-edit prepare extraction. It is not a runtime implementation plan by itself, and it should not authorize provider submit, execute-return, or `project.vibe` promotion.

## Current Endpoint Map

`scripts/local-runtime-api-server.mjs` currently defines the runtime base path at `/api/runtime` and exposes these route groups:

| Route | Method | Current handler shape | Runtime semantics |
| --- | --- | --- | --- |
| `/api/runtime/status` | `GET` | In-server route, uses `runtimePolicy()` and endpoint constants | Server/policy discovery only. No project mutation. |
| `/api/runtime/files` | `GET` | Delegated to `serveRuntimeFile()` | File serving with runtime boundary/path checks. No project mutation. |
| `/api/runtime/projects/current` | `GET` | Delegated response from binding factory | Current-project binding status. No project mutation. |
| `/api/runtime/projects/select` | `POST` | `handleCurrentProjectSelect()` delegates to binding factory | Select/write current-project binding file through the binding module. |
| `/api/runtime/projects/recent` | `GET` | Delegated response from binding factory | Recent/workspace project list projection. No project mutation. |
| `/api/runtime/projects/current/real-chain/status` | `GET` | In-server `currentProjectRealChainResponse()` | Current project status projection. Reads project facts/reports and Round 5 ingest. No provider call. |
| `/api/runtime/projects/current/real-chain/run-check` | `POST` | In-server `handleCurrentProjectRunCheck()` | Read-only projection check, not a real run. Sets `providerCalled=false`, `prepareRan=false`, `projectVibeWritten=false`. |
| `/api/runtime/projects/current/image2-batch/plan` | `GET` | In-server `currentProjectImage2BatchPlanResponse()` | Read-only Image2 batch plan projection. No prepare or provider submit. |
| `/api/runtime/projects/current/image2-batch/run-check` | `POST` | In-server `handleCurrentProjectImage2BatchRunCheck()` | Read-only batch plan check. Explicitly forbids provider submission and file mutation. |
| `/api/runtime/projects/current/image2-one-shot/status` | `GET` | Delegated to Image2 handoff factory | One-shot status projection. |
| `/api/runtime/projects/current/image2-one-shot/prepare` | `POST` | Delegated to Image2 handoff factory | Writes one-shot prepare receipt/handoff state through existing handoff boundary. No provider submit. |
| `/api/runtime/projects/current/image2-one-shot/confirm` | `POST` | Delegated to Image2 handoff factory | Confirms one-shot handoff/permission state. No provider submit. |
| `/api/runtime/projects/current/image2-one-shot/prepare-trigger` | `POST` | Delegated to Image2 handoff factory | Prepares trigger/submit permission receipt state, still no provider submit from this server route. |
| `/api/runtime/projects/current/image2-one-shot/execute-mock` | `POST` | Delegated to one-shot executor factory | Mock executor route. Writes mock output/sidecars inside the executor sandbox only. |
| `/api/runtime/projects/current/image2-one-shot/return` | `POST` | Delegated to one-shot return factory | Ingests actual external provider return evidence. Does not submit provider. |
| `/api/runtime/projects/current/image2-one-shot/execute-return` | `POST` | Delegated to one-shot return factory | Same return-ingest handler as `/return`, with execute-return endpoint naming. No formal promotion. |
| `/api/runtime/projects/current/round5/strict-edit/prepare` | `POST` | Still in server file | Writes strict-edit preflight sidecars only. No provider submit, no execute-return, no `project.vibe` write. |
| `/api/runtime/projects/current/round5/strict-edit/return` | `POST` | Delegated to strict-edit return factory | Ingests returned Round 5 strict-edit end evidence. Marks needs-review return evidence, no promotion. |
| `/api/runtime/real-demo-e2e/005/status` | `GET` | In-server legacy adapter | Legacy 005 report projection. |
| `/api/runtime/real-demo-e2e/005/run` | `POST` | In-server legacy adapter, disabled unless `VIBE_CORE_ENABLE_LEGACY_RUN=1` | Legacy diagnostics-only run of `real-demo-e2e-005-anime-image2-start-verify.mjs`; not part of new current-project route naming. |
| `/api/real-demo-e2e/005/status` | `GET` | In-server legacy alias | Legacy compatibility alias. |
| `/api/real-demo-e2e/005/run` | `POST` | In-server legacy alias, same env gate | Legacy compatibility alias. |

The route list is mirrored in `isCurrentProjectEndpoint()` for current-project error reporting. That list includes binding/select/recent, real-chain status/run-check, Image2 batch plan/run-check, one-shot status/prepare/confirm/prepare-trigger/execute-mock/return/execute-return, and Round 5 strict-edit prepare/return.

## Delegated Module Boundaries Already Present

These responsibilities are already delegated out of `scripts/local-runtime-api-server.mjs`:

| Boundary | Module | Server integration |
| --- | --- | --- |
| Runtime security/path/file boundary | `scripts/runtime-api-boundary.mjs` | Creates `runtimePolicy`, `runtimeRequestSecurity`, path helpers, scoped repo resolution, content types, and file-error writing. |
| Current-project binding/select/recent | `scripts/runtime-api-current-project-binding.mjs` | Creates binding path, source resolution, recent response, current binding response, select response, unbound/blocked project responses. |
| Runtime file serving | `scripts/runtime-api-file-serving.mjs` | Creates `runtimeFileUrl` and `serveRuntimeFile`. |
| Current-project workbench/status facts | `scripts/runtime-api-workbench-projection.mjs` | Creates `projectProjectionFromSource`, `readProjectFacts`, `currentProjectWorkbenchFacts`, and semantic QA summary helpers. |
| One-shot status/prepare/confirm/prepare-trigger | `scripts/runtime-api-current-project-image2-handoff.mjs` | Creates `oneShotRequestInput`, state helpers, handoff response, and prepare-trigger response. |
| Return writers | `scripts/runtime-api-current-project-return-writers.mjs` | Owns atomic writes, one-shot sandbox write assertions, and current-project runtime write assertions. It also blocks `project.vibe` writes. |
| One-shot mock executor | `scripts/runtime-api-current-project-one-shot-executor.mjs` | Owns executor input parsing, mock executor contract, sandbox writes, and mock-output evidence flags. |
| Provider return evidence helpers | `scripts/runtime-api-provider-return-evidence.mjs` | Owns provider observation context blockers, provider observation matching, semantic QA matching, and returned JSON loading. |
| One-shot return ingest | `scripts/runtime-api-current-project-one-shot-return.mjs` | Owns one-shot actual-return projection and ingest response. The server still builds `oneShotReturnRequestInput()`. |
| Round 5 artifact ingest | `scripts/runtime-api-round5-artifact-ingest.mjs` | Owns Round 5 status derivation, strict-edit evidence blockers, strict-edit provider observation blockers, sidecar reading, and shot gate projection. |
| Round 5 strict-edit return ingest | `scripts/runtime-api-current-project-round5-strict-edit-return.mjs` | Owns `currentProjectRound5StrictEditReturnResponse()`. The server still builds `round5StrictEditReturnRequestInput()` and injects the shared blocked response helper. |

The key shape is now factory-based: server constants and top-level helpers are passed into `createRuntimeApi*()` modules, while route wiring calls the returned functions.

## Strict-Edit Prepare Still Inside Server

Strict-edit prepare is the most obvious remaining extraction candidate. The server still owns these prepare-specific functions and dependencies:

| Residual item | Current responsibility | Extraction note |
| --- | --- | --- |
| `round5StrictEditRequestInput(url, body)` | Parses `shotId`, `bboxNormalized`/`bbox`, and ignored input sha. | Move with prepare factory; keep URL/body parsing close to prepare route. |
| `round5NormalizeBbox(input)` | Converts bbox fields to numbers. | Prepare-specific unless another module needs normalized bbox. |
| `round5DefaultStrictEditBbox(shotId)` | Supplies the default ZP05 bbox. | Prepare-specific policy. Inject or colocate in prepare module. |
| `round5StartFramePathInfo(source, shotId, startFramePath)` | Validates shot-relative start frame path, project-root containment, file existence, and realpath containment. | Move to prepare module or inject as path helper bundle. It depends on `normalizeRelativePath`, `oneShotPathInsideRoot`, `scopedRepoPath`, `existsSync`, `statSync`, `realpathSync`, and `isPathInsideRealRoot`. |
| `round5StrictEditBlockedResponse(source, requestContext, input, blockers, extra)` | Shared blocked-response shape for prepare and return. Defaults endpoint to prepare, while return overrides endpoint. | Either keep shared in server temporarily, or move to a small shared strict-edit response helper before extracting both prepare and return. For the next single-file extraction, inject it into prepare/return to avoid widening scope. |
| `currentProjectRound5StrictEditPrepareResponse(input, extra, source)` | Reads Round 5 report, validates shot/QA/start sha/end-required/bbox, writes three preflight sidecars, calls status projection, returns preflight response flags. | Primary extraction body. Move whole response function into new prepare factory. |
| Sidecar names | `round5StrictEditSidecarFileNames` constant in server | Keep constant in server for route wiring only if shared by prepare/return/ingest; inject into prepare factory. |
| Current-project runtime write | Uses `writeCurrentProjectRuntimeJson()` from return writers | Inject writer into prepare factory; do not create new file-write path logic. |
| Status projection | Calls `currentProjectRealChainResponse()` after writing sidecars | Inject as `currentProjectStatusProjection` or `currentProjectRealChainResponse`. |
| Round 5 helpers | Uses `isRound5FullRealChainReport`, `round5QaStatusFor`, `round5EndRequiredFor`, `round5BboxValid`, `round5ArtifactIngest` through status projection | Inject only the helpers needed by prepare. Do not duplicate Round 5 derivation logic. |
| Generic path/format helpers | Uses `asString`, `requestBodyString`, `safePathSegment`, `uniqueStrings`, `isRecord`, `sha256/readFileSync`, `repoRelativePath`, `runtimePolicy`, `requestOverrideDiagnostics`, `projectIdentityFromSource` | Either inject from server or colocate tiny local helpers in the prepare module. Prefer injection for repo/path/security helpers and local copies only for tiny pure predicates if consistent with existing modules. |

Prepare currently writes exactly these three sidecars under the selected current project shot directory:

- `approved_start_frame_ref.json`
- `editable_region_mask_or_bbox.json`
- `provider_edit_receipt.json`

It sets `strictEditPreflightPrepareRan=true`, `providerCalled=false`, `prepareRan=false`, `projectVibeWritten=false`, `liveSubmitAllowed=false`, `videoSubmitted=false`, and `workerSpawnForbidden=true`.

## Prepare Hard Boundary

The strict-edit prepare route boundary should remain narrow:

- It may read the current-project binding, project report, shot QA, generated start-frame facts, and existing project files.
- It may generate preflight sidecars/receipts only: approved start-frame ref, editable-region evidence, and provider edit receipt.
- It may refresh a status/preflight projection after sidecar writes.
- It must not submit to any provider or call any Image2/Image edit API.
- It must not invoke one-shot execute-return or strict-edit return.
- It must not promote, complete, or write `project.vibe`.
- It must not treat `runtime-state` or sidecar preflight facts as authorization to mutate project facts.
- It must not spawn workers or run full real-chain scripts.

This means prepare is a preflight projection plus sidecar authoring step. Return ingest remains the only route that can mark external provider evidence observed, and even that must stop at needs-review evidence rather than production promotion.

## Next Extraction Recommendation

Recommended next file:

`scripts/runtime-api-current-project-round5-strict-edit-prepare.mjs`

Recommended export:

```js
export function createRuntimeApiCurrentProjectRound5StrictEditPrepare(deps) {
  return {
    round5StrictEditRequestInput,
    currentProjectRound5StrictEditPrepareResponse,
  };
}
```

Recommended dependency injection:

- `currentProjectSource`
- `currentProjectRound5StrictEditPrepareEndpoint`
- `round5StrictEditSidecarFileNames`
- `readJsonIfPresent`
- `isRound5FullRealChainReport`
- `round5QaStatusFor`
- `round5EndRequiredFor`
- `round5BboxValid`
- `round5StrictEditBlockedResponse`
- `currentProjectStatusProjection` or `currentProjectRealChainResponse`
- `projectIdentityFromSource`
- `requestOverrideDiagnostics`
- `runtimePolicy`
- `writeCurrentProjectRuntimeJson`
- path helpers: `normalizeRelativePath`, `oneShotPathInsideRoot`, `isPathInsideRealRoot`, `scopedRepoPath`, `repoRelativePath`
- filesystem/hash helpers: `existsSync`, `statSync`, `realpathSync`, `readFileSync`, `sha256` or `sha256Bytes`
- parser helpers: `requestBodyString`, `asString`, `isRecord`, `safePathSegment`, `uniqueStrings`, unless copied as tiny local pure helpers

Recommended server shape after extraction:

- Keep endpoint constants in `scripts/local-runtime-api-server.mjs`.
- Import `createRuntimeApiCurrentProjectRound5StrictEditPrepare`.
- Instantiate it near the strict-edit return factory.
- Keep route wiring as:
  - get route context
  - call `strictEditPrepareApi.round5StrictEditRequestInput(url, body)`
  - call `strictEditPrepareApi.currentProjectRound5StrictEditPrepareResponse(input, extra, source)`
  - `writeJson()` with existing 409/200 behavior
- Do not move legacy 005, image2 batch, real-chain status, or return ingest in the same extraction.

Suggested minimal write range for the next knife:

- Add `scripts/runtime-api-current-project-round5-strict-edit-prepare.mjs`.
- Add `scripts/runtime-api-current-project-round5-strict-edit-prepare-test.mjs` only if the worker is also allowed to add tests in that slice.
- Touch `scripts/local-runtime-api-server.mjs` only for import, factory construction, and route wiring.
- Touch `package.json` only if adding the new test script is explicitly in scope.

## Test Recommendations

For this read-only document task, only `git diff --check` is required after writing the doc.

For the next strict-edit prepare extraction, run at least:

- `npm run runtime-api-current-project-round5-strict-edit-return:test`
- `npm run runtime-api-boundary:test`
- `npm run verify:round5`
- `npm run verify:runtime-fast`

If a prepare module test is added, also run the new prepare test and `npm run local-runtime-api:test` to catch route-level regressions.

## Non-Parallel And Forbidden Runs

Do not run or schedule parallel workers/tests that write the same runtime-state or sandbox fixture. In particular:

- Do not run multiple workers that modify `scripts/local-runtime-api-server.mjs` at the same time.
- Do not run fixture-writing runtime-state/sandbox tests in parallel.
- Do not run real provider submit flows as part of P2 extraction verification.
- Do not run provider/full chains implicitly from this route extraction.
- Do not use `verify:provider-full` or provider-heavy scripts as a default gate.
- Do not trigger `real-demo-e2e-00x:prepare`, `real-demo-e2e-00x:watch`, or real provider executor scripts from the prepare extraction.
- Keep legacy 005 run disabled unless a separate diagnostics task explicitly sets `VIBE_CORE_ENABLE_LEGACY_RUN=1`.

The P2 default remains route-boundary verification first, then `verify:runtime-fast` and `verify:round5` after code extraction. Provider/full validation belongs to a separately authorized provider phase.
