# Agent-first P5-D packaged local RC audit

Date: 2026-07-13

Status: PASS for local packaged RC acceptance.

This audit does not certify live image/video providers, Developer ID signing,
notarization, or public distribution. The packaged app uses local ad-hoc
signing, which is the intended release boundary for this project.

## Scope

- Packaged app only; no frontend dev server.
- No UI redesign or visual tuning.
- No live image or video provider credentials.
- One fresh project flow followed by a same-profile cold restart.
- Only a confirmed local export was allowed to write deliverables.

## Isolated acceptance root

- Root: `/tmp/vibe-p5d-local-rc.zEMJ1g`
- Profile: `/tmp/vibe-p5d-local-rc.zEMJ1g/profile`
- Projects: `/tmp/vibe-p5d-local-rc.zEMJ1g/projects`
- Runtime: `/tmp/vibe-p5d-local-rc.zEMJ1g/runtime`
- Accepted project: `/tmp/vibe-p5d-local-rc.zEMJ1g/projects/p5d-agent-first-final`

## Real packaged path

| Step | Result | Evidence |
| --- | --- | --- |
| Launch and Computer Use | Pass | Packaged executable opened with an isolated profile and accepted text, clicks, and the native folder chooser. |
| New story draft | Pass | The requested two-shot story reached `Confirm this story`; no generation or export ran. |
| Confirm story | Pass | Two shots remained and the current task moved to save-location selection. |
| Choose save location | Pass | The local project was created without reference, video, or export side effects. |
| Reference confirmation | Pass | Dry-run confirmation explicitly stated that no provider and no real reference output would be used. |
| Video confirmation | Pass | Dry-run confirmation explicitly stated that no provider submission or real video output would occur. |
| Export confirmation | Pass | Files were written only after the explicit export confirmation. |
| Local export | Pass | The current-fact export job succeeded with `providerCalled=false` and one recorded manifest output. |
| Cold restart | Pass after the fix below | Two shots, two missing references, ungenerated video, and the export package restored; the current task returned to idle and no old confirmation owned the rail. |

## Blocking regression found and fixed

Before the fix, the same-profile cold restart restored the project and export
correctly but projected `prepare_references / waiting confirmation`. The old
reference confirmation disabled the composer even though the staged plan was
cleared and the current-fact export had succeeded.

Root cause:

1. The current export completion was correctly bound to project id, normalized
   project root, and fact hash `pv_b15d1a9e`.
2. Empty composer input was represented as an intent route with `kind=status`
   and the passive observation's `reference_generation` confirmation kind.
3. `AgentCurrentTaskProjection` treated that passive status route as a new
   explicit action, so it preempted the current-fact export completion.

Minimal fix:

- `src/core/agentCurrentTaskProjection.ts` now lets a current-fact export
  completion close the pipeline when the only route is passive `status`.
- Explicit user routes still start a new reference, video, or export boundary.
- A changed project fact hash still invalidates the old export completion.
- `scripts/agent-current-task-projection-test.mts` covers the packaged restart
  shape: missing references, cleared plan, old reference confirmation, passive
  status route, and current-fact live export completion.

## Persisted evidence

- Staged plan: `status=cleared`, `sourceFactHash=pv_b15d1a9e`.
- Export job: `kind=export`, `executionMode=live`, `status=succeeded`,
  `providerCalled=false`.
- Export directory: `exports/current-project`.
- Export output: 13 local project, manifest, receipt, report, and table files.
- Real media side effects: no PNG, JPG, JPEG, WEBP, MP4, or MOV files.

## Verification

Passed:

- `npm run agent-current-task-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run demo:ready:test`
- `npm run prototype-ui:test`
- `npm run package:smoke`
- `npx tsc --noEmit --pretty false`
- `npm audit --audit-level=low` (`0 vulnerabilities`)
- `git diff --check`

## Release judgment

P5-D is complete for the local packaged RC boundary. The Agent-first main chain,
local export, and cold-start stale-task filtering are accepted without a dev
server or a live provider call. Live provider execution and public macOS
distribution remain separate, explicitly unverified capabilities.
