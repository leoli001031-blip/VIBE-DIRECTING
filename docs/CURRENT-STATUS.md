# Vibe Director Studio Current Status

Updated: 2026-07-28

Audited checkpoint: `919330b` (`Implement P13-E Clarify and Proposal session timeline`)

## Current Product

Vibe Director Studio is a local-first Electron director workspace backed by
`Project.vibe`, a bundled local runtime, and explicit Agent action boundaries.
The primary interaction is an Agent-led sequence:

`Clarify -> Proposal -> Confirmation -> Running -> Review -> Project Fact -> Delivery`

Only structured projections may decide the current task. Display text, old
confirmation cards, passive project state, and historical results must not
override the current phase.

## Current Implementation

- React 19, TypeScript, and Vite provide the renderer.
- Electron provides the packaged desktop shell and local IPC boundary.
- The local runtime and project sidecars preserve jobs, receipts, timeline
  entries, Review decisions, project-fact promotion, and Delivery evidence.
- P13-C direction 3, Session Timeline, is the selected product direction.
- P13-D integrates the timeline with the existing Review turn.
- P13-E integrates the same timeline with Clarify and Proposal.
- Confirmation, Running, Project Fact, and Delivery still use the previously
  accepted product contracts; they have not all received P13 visual acceptance.

## Acceptance Matrix

| Surface | Current fact |
| --- | --- |
| P13-A Provider canary | PASS for exactly one Image2 request and one Seedance `seedance2.0_vip` submission. Returned media remains `needs_review`; no approval, promotion, Delivery, or export was performed. |
| P13-B local Beta | Historical PASS for an ad-hoc DMG/ZIP and fresh packaged launch. No Developer ID, notarization, App Store, or public distribution claim. |
| P13-C product direction | PASS for three design directions. Direction 3 was selected in P13-D. |
| P13-D Review timeline | Implementation PASS and production-renderer visual PASS. Current packaged revalidation BLOCKED at the Electron launch layer. |
| P13-E Clarify/Proposal timeline | Implementation and contracts PASS. Production-renderer visual acceptance BLOCKED at the browser launch layer. Packaged acceptance BLOCKED at the Electron/signature environment layer. |
| Real Provider scale and reliability | NOT VERIFIED. The P13-A one-shot canary is not scale, cost, or quality proof. |
| Public release | NOT CLAIMED. Developer ID and notarization are outside the local Beta target. |

The P13-B packaged PASS and the later P13-D/P13-E launch blocker describe
different points in time. The later environment failure does not erase the
retained P13-B evidence, and the earlier PASS does not prove the current package
can launch.

## Current Blocker

Fresh Electron packages and a retained known-good package are currently
terminated before application code starts. The installed Chrome bundle also
fails the local visual-control path because of its signing/xattr state; an
isolated strictly signed copy is terminated before a control channel appears.

Until a fresh run reaches application code:

- do not describe P13-E as visually or packaged accepted;
- do not change UI or business logic to guess around the launch environment;
- do not substitute source inspection or renderer contracts for packaged proof.

## Safety State

- P13 Provider media status: `needs_review`.
- Provider calls during P13-C, P13-D, and P13-E: `0`.
- P13 Review approvals, project-fact promotions, Delivery actions, and exports:
  `0`.
- Public-distribution credentials are neither required nor claimed.
- Ordinary verification must remain local and Provider-free.

## Working Tree Boundary

At this audit checkpoint, seven pre-existing user-owned paths were dirty:

- five P10-E packaged screenshots;
- `docs/evidence/p10-e-packaged-director-workflow-20260719/packaged-observation.json`;
- `electron-runtime/local-runtime-api-server.mjs`.

They are not part of this documentation closeout. Do not stage, revert, replace,
or clean them without a separate user decision.

## Verification Entry

For the current Session Timeline source contract:

```bash
npm run agent-session-timeline:test
npm run minimal-agent-p1:test
npm run minimal-ui:test
npx tsc --noEmit --pretty false
git diff --check
```

Detailed evidence:

- [P13-A Provider canary](agent-first-p13-a-provider-canary-acceptance-20260723.md)
- [P13-B local Beta package](agent-first-p13-b-local-beta-package-acceptance-20260723.md)
- [P13-C product directions](agent-first-p13-c-product-design-directions-acceptance-20260723.md)
- [P13-D Review timeline](agent-first-p13-d-session-timeline-acceptance-20260723.md)
- [P13-E Clarify/Proposal timeline](agent-first-p13-e-session-timeline-clarify-proposal-acceptance-20260723.md)

## Next Gate

The next acceptance gate is environmental, not visual: restore or prove a
launchable local browser/Electron path, then rerun the blocked P13-E visual and
packaged checks without changing Provider, Review, promotion, Delivery, or
export state. Product expansion remains a separate decision after that result.
