# Real Demo E2E Readiness Harness

Date: 2026-05-03

This harness exists to keep the demo language honest. It can say a run is ready for a real-chain pressure test, but it cannot claim real generation completion unless an actual provider observation is present.

Required chain:

`UI action -> validated task packet/subagent envelope -> worker/subagent provenance -> Image2 provider observation -> scoped sandbox output -> watcher event -> manifest match -> QA report -> preview update`

Hard blockers:

- Provider self-report completes task.
- Manual file copy detected.
- Fixture reuse detected, including batch_004-style reuse.
- Simulated state detected.
- Missing `project.vibe`, source index, visual memory, or shot layout.
- Missing watcher / manifest / QA / preview return-path evidence.

Pressure readiness rule:

- A pressure run must cover 6-10 shots.
- Only 1-3 Image2 outputs may be planned for real generation.
- Remaining shots must be queued or parked.
- Every shot needs task packet, subagent envelope, worker provenance, and expected output path.

Script:

- `npm run real-demo-e2e:test`

The script does not call Image2, Seedance, Jimeng, Fast, or VIP paths. It only verifies readiness evidence and blocker behavior.
