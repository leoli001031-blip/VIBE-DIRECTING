# Real Demo E2E 002 Runtime Gap Audit - 2026-05-04

## Scope

This audit captures the process issues exposed by `Real Demo E2E 002 Anime Pressure`.

The final run passed:

- 16 shot plans.
- 6 real Image2 start frames.
- 6 valid provider observation sidecars.
- 6 completed semantic QA sidecars.
- Final report status: `ready_for_real_chain_pressure_test`.
- P0/P1 findings: 0.
- P2 findings: 2, both style notes on arcade texture being slightly heavier than the low-texture anime target.

The important result is not only that the final report passed. The run showed that Vibe Core still needs a real runtime layer for worker lifecycle, watcher facts, queue state, and artifact transactions.

## Problems Observed

### 1. Final pass hid process-level gaps

`run_manifest.json` stayed in a waiting state while `real_demo_e2e_report.json` eventually declared `actual_provider_observed`.

This means the prepare manifest and final report are not yet derived from one unified task-run state machine.

### 2. Watcher events were synthesized by verify

`scripts/real-demo-e2e-002-anime-verify.mjs` generates watcher events by scanning for files.

This is acceptable for a readiness harness, but product runtime needs real append-only events:

- output created
- output changed
- output settled
- hash observed
- provider sidecar paired
- semantic QA paired
- worker stalled/interrupted/completed

### 3. Image, provider sidecar, and QA sidecar are not transactional

During the run, some images appeared before provider observation sidecars existed.

That intermediate state must be first-class:

- `image_exists_but_provider_observation_missing`
- `provider_observed_but_qa_pending`
- `semantic_qa_pending`
- `sidecar_mismatch`
- `complete_verified`

An image file alone cannot complete a task.

### 4. Subagent lifecycle is not a first-class fact

Multiple image workers were used, but the runtime does not yet keep a durable event ledger for thread id, turn id, worker lease, interruption, reconnect, or handoff.

If a worker disconnects after writing an image but before writing sidecars, the system currently recovers by later file scanning and manual rerun, not by a runtime recovery policy.

### 5. Queue state is still a script plan

The manifest can distinguish `real_image_planned`, `queued`, and `parked`, but it does not yet represent runtime states like:

- `prepared`
- `leased`
- `running`
- `waiting_output`
- `output_detected_no_sidecar`
- `provider_observed`
- `qa_pending`
- `needs_review`
- `complete_verified`
- `stalled`
- `interrupted`

Product runtime needs concurrency limits, worker leases, retry budget, stall timeout, thread cap, and resume policy.

### 6. P2 texture drift is a style trend

S06 and S08 both produced P2 style notes in the arcade scene. They remained valid anime frames, but the background texture and grime were slightly heavier than the low-texture target.

This should feed the style/prompt feedback loop:

- strengthen low-texture style capsule
- add arcade-specific avoid terms for grime and tactile surface detail
- track repeated P2 style findings by scene/style pack

### 7. Semantic QA finding identity is still text-based

The verify script now deduplicates repeated findings, but it still relies on severity, gate, and message text.

Future QA sidecars should use stable finding ids, gate ids, image hashes, and source fields so counting does not depend on wording.

## Required Product Changes

### Runtime

Add a unified task-run state machine. Manifest, preview, reports, and UI progress should be projections from that state machine, not separate one-off files.

### Adapter

Provider observation should be created or finalized by the runtime adapter where possible, and must bind:

- taskRunId
- envelopeId
- provider call id or app-server event id
- thread id / turn id when available
- output path
- output hash
- sidecar hash

### Queue

Add worker leases, concurrency caps, thread caps, stall timeouts, retry budget, and resume/interrupt handling.

Queued and parked must remain distinct:

- `queued`: schedulable when capacity is available.
- `parked`: blocked by provider policy or user enablement.

### Watcher

Replace verify-synthesized watcher evidence with append-only watcher events from real file observation. A file event is a fact, not a completion claim.

### QA

Semantic QA must bind to the reviewed image hash. P0 blocks, P1 marks `needs_review`, P2 records trend data.

### UI

The minimal UI should show creator-readable progress:

- "6 images: 4 returned, 1 waiting QA, 1 needs review"
- "sidecar missing"
- "worker interrupted, resumable"
- "style drift P2 repeated in arcade scene"

Diagnostics can show thread/turn ids, sidecar paths, watcher events, manifest match, and QA details.

## App-Server Relevance

The Codex app-server adapter can address several gaps from this run:

- Thread and turn notifications can give durable worker lifecycle facts.
- `fs/watch` and `fs/changed` can replace verify-synthesized watcher events.
- Approval requests can make rerun, skip, promote, and provider handoff explicit user actions.
- Interrupt and remote status events can make stalled or disconnected workers resumable.
- Tool-call notifications can link generated artifacts to the turn that produced them.

App-server does not replace Vibe Core's source of truth. It should feed runtime facts into the task-run state machine while task packets, context packets, provider observations, watcher facts, and QA remain mandatory gates.
