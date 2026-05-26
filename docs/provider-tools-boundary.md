# Provider/tools Boundary Draft

## Scope

Worker D round 1 only defines the new provider/tools edge for the future self-owned Agent Loop. It does not touch the legacy `src/core/provider*`, `src/core/realProvider*`, `src/agent/**`, credentials, Electron, lockfiles, or real provider submission.

## State Machine

The shared provider request status lives in `src/providers/providerBoundary.ts`:

1. `planned`
2. `ready_to_submit`
3. `submitted`
4. `return_ingested`
5. `needs_review`
6. `promoted`
7. `failed`

Allowed forward path:

`planned -> ready_to_submit -> submitted -> return_ingested -> needs_review -> promoted`

Any non-terminal state may move to `failed`. `promoted` and `failed` are terminal in this draft. The test covers rejected transitions such as `planned -> submitted`.

## Provider API Shape

The draft exports these stable data shapes:

- `ProviderBoundaryRequest`: request id, provider id, task kind, state, input, input hash, output path, review status, receipt, response summary, submit policy, timestamps, notes.
- `ProviderRequestReceipt`: mock request receipt with request id, provider id, task kind, input hash, created time, `liveSubmit: false`, and `adapterMode: "mock_only"`.
- `ProviderInputHash`: deterministic `input_*` hash from stable input serialization.
- `ProviderOutputPath`: expected artifact path carried from request to response summary.
- `ProviderResponseSummary`: output path, artifact count, optional mime/dimensions/duration/remote id, warnings, and `liveSubmit: false`.
- `ProviderReviewStatus`: `not_started`, `pending_human_review`, `approved`, `rejected`.

`Image2Provider` and `JimengProvider` live in `src/providers/mockAdapters.ts`. Both are mock-only adapters. They can:

- prepare a request
- mark it ready
- attach a mock receipt
- ingest a mocked return
- mark it ready for review
- promote a reviewed return

They cannot read credentials, call a network endpoint, write artifacts, or perform a real provider submission.

## Agent Tool Edge

`src/tools/providerBoundaryTools.ts` exposes future Agent Loop helpers without importing `src/agent/**`:

- `provider_prepare_request`
- `provider_mock_submit`
- `provider_ingest_mock_return`
- `provider_promote_reviewed_return`

Every descriptor is `fastTestOnly: true`, `liveSubmitAllowed: false`, and `credentialsAllowed: false`. If a caller asks for live submit, `prepareProviderToolRequest` returns a blocker and does not create a request.

## Fast-test Rule

Fast tests are contract tests only. They may create mock receipts and mocked response summaries, but they must never:

- call `fetch`
- use `node:http` or `node:https`
- read `process.env`
- call `child_process`
- write provider outputs
- import `src/agent/**`
- import legacy `src/core/provider*` or `src/core/realProvider*`

`scripts/provider-tools-boundary-test.mts` scans the new source files for these forbidden routes.

## MVP Runbook Boundary

`provider-tools:test` covers only the fast provider/tools edge. It proves that Agent Loop helpers can prepare and mock-ingest provider-shaped requests without crossing into real execution.

It is not a real Image2 permission receipt, a real submit, a return-ingest proof, or a QA/promotion gate. Those stages stay separate in `docs/verification-checklists.md` so a passing fast test cannot be used as approval to call Image2, read credentials, ingest actual provider output, or promote facts into `project.vibe`.

## Next `src/agent` Integration

Later Agent Loop work can wrap the tool helpers in the existing tool registry or a new Agent Loop registry:

1. Convert an agent plan step into `ProviderPrepareToolInput`.
2. Call `prepareProviderToolRequest` to get a `ready_to_submit` request and deterministic input hash.
3. Persist or display the request receipt boundary separately from any real provider execution.
4. For fast tests, call `mockSubmitProviderToolRequest` and `ingestMockProviderReturnForReview`.
5. Require a human or review gate before `promoteMockProviderReturn`.

Real submission should be added as a separate adapter behind an explicit policy gate, not by changing the mock-only fast-test path.

## Round 2 Demo Path Boundary

The second-round prototype demo path stays on the UI side of the provider/tools boundary.

- It may display a local prototype result in the main Director surface.
- It may use static contract tests to prove `MinimalAgentPanel -> DirectorModeShell -> App.tsx` wiring exists.
- It must not read credentials, inspect provider config, call provider adapters, submit real work, or reuse runtime-cache state as fact authority.
- It must keep credential, schema, runtime-cache, and real-submit language out of the main Director UI; those terms belong in Diagnostics or provider-specific documents.

`npm run prototype-ui:test` is the guard for this lane. A passing result only means the second-round demo callback and result display are wired and the Director copy stays clean; it does not claim Image2, Jimeng, Seedance, or any other real provider execution.
