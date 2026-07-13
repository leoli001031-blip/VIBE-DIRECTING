# Agent-first P6-A execution controller audit

Date: 2026-07-13

Status: PASS for P6-A execution-boundary closure.

Readiness label: `local packaged RC + centralized execution controller`.
This is not yet a live-media creator beta. No real image or video provider was
called during this phase.

## Scope

- Preserve the accepted P5-D Signal Desk and packaged no-cost main chain.
- Move reference, video, query, and export execution orchestration out of
  `MinimalAgentPanel` into one explicit controller.
- Reuse `agentVideoExecutionAdapter` for dry-run and live-shaped execution.
- Keep provider callbacks and React presentation state in the existing UI.
- Do not add a generic workflow framework or split JSX/CSS.

## Root cause and change

Before P6-A, `MinimalAgentPanel` owned capability selection, project/fact-bound
ledger replacement, in-flight deduplication, persistence ordering, timeline
publication, footer execution, and confirmed Agent product dispatch. The
behavior was covered, but its ownership was still mixed with rendering.

`src/ui/director/agentVideoExecutionController.ts` now owns that execution
boundary. It:

- selects the existing Image2, Seedance, and local-export capabilities;
- binds jobs and receipts to project id, normalized project root, fact hash,
  action id, and confirmation receipt;
- collapses concurrent duplicate action/operation executions;
- persists every ledger transition before publishing it in memory;
- fails closed before a live callback when durable persistence is unavailable;
- routes confirmed Agent actions and existing footer actions through the same
  adapter contract;
- preserves truthful dry-run results with `providerCalled=false` and no output
  assets.

## Minimal files

- `src/ui/director/agentVideoExecutionController.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `scripts/agent-video-execution-controller-test.mts`
- the existing adapter, ledger, Agent, and UI contract tests that track the new
  ownership boundary
- `package.json` for the new test command and demo-readiness gate

No style, layout, font, color, Product Design, ImageGen, provider credential, or
public-distribution file changed.

## Headless verification

Passed:

- `npm run agent-current-task-projection:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run demo:ready:test`
- `npm run prototype-ui:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

The adapter suite covers dry-run truth, live authorization and persistence,
reference success, video submit/query, timeout, cancellation, duplicate
terminal actions, and explicit retry. The controller test adds ownership-level
coverage for capability selection, dry-run isolation, durable transitions,
concurrent submission deduplication, local export, and fail-closed persistence.

## Packaged acceptance

- App: `release/mac-arm64/Vibe Director Studio.app`
- Isolated root: `/tmp/vibe-p6a-accept.z0wRlW`
- Project: `/tmp/vibe-p6a-accept.z0wRlW/projects/p6a-agent-first-controller`
- `npm run package:smoke`: pass

The real packaged App completed:

1. two-shot local story draft;
2. story confirmation with both shots retained;
3. native save-location selection;
4. reference execution confirmation and dry-run validation;
5. video execution confirmation and dry-run validation;
6. explicit export confirmation and local export;
7. same-profile cold restart.

Observed receipts:

- reference: local contract validation, provider not called, zero outputs;
- video: local contract validation, provider not called, zero outputs;
- export: live local execution, provider not called, one manifest output;
- current-fact export job: `succeeded`, `providerCalled=false`;
- staged plan after export: `cleared`.

After cold restart, the App restored two shots, two missing references,
ungenerated video, and the export result. The Agent returned to a passive
continue state; no old confirmation card became the current task.

Filesystem inspection found no PNG, JPG, JPEG, WEBP, GIF, AVIF, BMP, TIFF, MP4,
MOV, M4V, or WEBM files. Real image/video call count: 0. External cost: 0.

## Remaining evidence gaps

- No real reference provider has been called in this phase.
- No real video provider has been called in this phase.
- During packaged acceptance, the unsubmitted phrase `允许生成参考` previewed
  as a video-policy update after a plan-only turn; the explicit phrase
  `生成参考图` correctly opened the dry-run confirmation. This is an intent
  evaluation candidate, not an execution-controller failure.
- P6-B offline failure/recovery coverage is still required before any live
  provider preflight.

## Phase transition

P6-A permits entry to P6-B only. P6-B must remain offline and no-cost. P6-C
still requires a separate no-submit preflight followed by fresh user
authorization before one real reference-image call.
