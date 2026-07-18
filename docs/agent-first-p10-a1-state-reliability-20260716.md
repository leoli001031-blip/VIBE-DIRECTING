# Vibe Director Studio P10-A.1 state reliability acceptance

Date: 2026-07-16

Status: **PASS**. The two P0 packaged-state blockers found in the P10-A audit are fixed. This acceptance does not approve the P10-B UI simplification work.

## Scope and controls

- App: `release/mac-arm64/Vibe Director Studio.app`
- Main-flow root: `/tmp/vibe-director-p10-a1-bHYlJX`
- Main-flow project: `/tmp/vibe-director-p10-a1-bHYlJX/projects/p10-a1-main-flow`
- Export-restore profile: `/tmp/vibe-director-p10-a1-export-RtI28a`
- Export fixture: `/tmp/vibe-director-p9-rc-20260716-BgDWNG/projects/p9-fresh-export`
- Capture method: Computer Use against the rebuilt packaged Electron app plus direct durable-file inspection
- UI changes: `0`
- Provider calls: `0`
- Frontend dev server: not started
- Git commit or staging: not performed

Machine-readable result: `docs/evidence/p10-a1-state-reliability-20260716/acceptance.json`.

## P0-1: preselected empty local project

Packaged sequence:

1. Started with a fresh profile and a binding to an empty local `project.vibe`.
2. Sent the two-shot rain-night story through the right Agent.
3. Waited for the `确认这版故事` card and clicked it once.
4. Observed `故事 2 镜头`, `参考 缺 2 张`, and the next task `补参考`.
5. Closed the app and relaunched with the same profile.

Durable result after confirmation and again after cold start:

- shot count: `2`
- shot order: `shot_storyboard_1-1`, `shot_storyboard_1-2`
- section count: `2`
- `project.vibe` SHA-256: `416ebd87d2f44f8b3c7e39f3b4b8f9c6c9bda6798cecbcdd8ce1fbcefb63827c`
- no stale `确认这版故事` card returned

Root cause fixed: Agent intake now reuses an explicitly connected local project only when its current story has zero shots. A project that already has shots still receives a `new_project` target, so this change cannot silently overwrite existing story content.

## P0-2: terminal export restore

The existing P9 fixture was opened with a fresh profile. Its durable state contained a succeeded live export job, a current-fact cleared staged-plan marker, and an older waiting export confirmation.

Observed packaged result:

- right Agent current task: `继续描述想法`
- current task requires no confirmation
- no active `导出交付包` confirmation button
- historical execution remains visible as `真实执行`, `Provider 未调用`, `真实产物 16 项`
- delivery page shows `交付包已生成` and a disabled `交付包已生成` action

The cleared marker was not rewritten during restore:

- status: `cleared`
- cleared at: `2026-07-15T17:23:13.359Z`
- source fact hash: `pv_17dd191f`
- SHA-256 before and after launch: `49ad73ff4feddc5963b7c35207d50c205307731f721d04c41c9e1390ab185d0f`

Root cause fixed: App restore now retains a real, identity-validated cleared marker for current-task projection. Only a synthetic clear result derived from an active superseded plan is persisted as a new marker. Old-fact cleared markers are rejected before projection.

## Verification

Passed:

- `npm run new-video-start-contract:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-ui:test`
- `npm run agent-current-task-projection:test`
- `npm run minimal-agent-p1:test`
- `npm run new-video-project-vibe:test`
- `npm run project-vibe-draft-store:test`
- `npm run project-vibe-local-persistence:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`

## Remaining work

P10-A.1 removes the two state blockers and allows work to continue to P10-B. It does not resolve the previously audited UI complexity. In particular, delivery still presents a `14 个文件` summary beside a receipt history containing `16 项`, and reference availability/review wording remains dense. Those are P10-B information-architecture and status-vocabulary tasks, not reasons to reopen these P0 fixes.
