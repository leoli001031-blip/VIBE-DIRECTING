# Vibe Director Studio P13-C Product Design and ImageGen input

Date: 2026-07-23

Status: **THREE VISUAL OPTIONS READY. IMPLEMENTATION NOT AUTHORIZED UNTIL SELECTION.**

## Product brief

Vibe Director Studio is a macOS Agent-first directing workstation for creators
making short AI video sequences. The next design pass should make the Director
feel like a coherent collaborator around the current creative object, rather
than a dense control panel beside the editor.

The target user is a creator repeatedly moving through clarification, proposal,
paid confirmation, job observation, Review, project-fact promotion, and local
Delivery. The primary outcome is immediate confidence about four questions:

1. What object are the creator and Director discussing?
2. What is the single current decision?
3. What will the visible action change, and what will it not change?
4. What evidence and method support the recommendation?

This is a desktop tool, not a landing page. It should remain quiet, compact,
media-first, and efficient for repeated use.

## Why another direction pass

P10-C established the correct durable product layers: project facts, artifact
stage, one Director turn, and a hidden decision ledger. P10-D through P13-A
proved the interaction states and recovery contracts. P13-A also supplied a
real `needs_review` media result.

The remaining design issue is product form. The current right rail can still
read as a stack of controls and status copy. The redesign should improve the
felt continuity between conversation, current object, current decision, Skills,
Review, and downstream Delivery without weakening any confirmation boundary.

## Frozen state contract

All future UI must consume structured state. Display text, visual style, icon,
button label, and generated concept copy are never business-state inputs.

The current P13 reference state is:

- project: `p13_provider_canary`
- fact hash: `pv_6d5dcb24`
- shot: `P13S01`
- step: `submit_video`
- current task: `复核视频`
- result: `needs_review`
- source receipt:
  `seedance_submit_aeba14b4-8d30-4adf-9d5c-1b283fabc951`
- output hash:
  `sha256:deb0746c81f91b179f6f8cbcddee9d474ce2ab35f5c1abab5042aa50c1d2393b`
- approved: `false`
- promoted: `false`
- delivered: `false`
- exported: `false`

Recovery priority remains:

1. current valid confirmation;
2. current non-terminal job;
3. current pipeline step;
4. passive project status.

Exactly one `AgentCurrentTaskProjection` may own the visible current task. Old
cards, passive facts, historical results, Skills, and Delivery summaries cannot
compete with it.

## Immutable boundaries

| Boundary | Allowed effect | Forbidden implication |
| --- | --- | --- |
| Clarify | conversation only | project mutation or Provider call |
| Proposal | staged project change only | paid execution |
| Paid confirmation | one exact job | retry, approval, promotion, or export |
| Running | observe the same job | another submission |
| Review approval | one Review Receipt | project-fact promotion or Delivery |
| Request changes | return to discussion | automatic rejection or retry |
| Project-fact promotion | exact winner becomes authority after separate confirmation | Delivery or deletion of history |
| Delivery confirmation | local export only after exact gate | Provider execution or fact promotion |

Skills remain methods and evidence. A Skill may explain a recommendation but
cannot submit, approve, retry, promote, or export. Scope, maturity, version, and
content hash remain available through progressive disclosure.

## Visual references

Each ImageGen call received the actual local images, not filename-only
descriptions:

- Clarify packaged state:
  `docs/evidence/p10-d-clarification-proposal-20260717/01-packaged-clarification.png`
- Proposal packaged state:
  `docs/evidence/p10-d-clarification-proposal-20260717/02-packaged-proposal.png`
- Running packaged state:
  `docs/evidence/p10-d-paid-confirmation-running-20260717/02-packaged-running.png`
- Real P13 Review state:
  `docs/evidence/p13-a-provider-canary-20260723/packaged-needs-review.png`
- Real P13 visual reference:
  `docs/evidence/p13-a-provider-canary-20260723/P13S01-image2-reference-1280x720.png`

The P10-E Delivery confirmation was inspected as additional context but was
not attached because that file has pre-existing user changes and is intentionally
kept outside this checkpoint.

## Direction 1: Turn Ledger

Evidence: `docs/evidence/p13-c-product-design-directions-20260723/01-turn-ledger.png`

The right side becomes one continuous Director conversation. Current task and
current Review stay first; Clarify, Proposal, and Running compress into a small
decision trail. Skills appear inline as the basis for the current Review.

Strengths:

- strongest continuity with the existing conversation model;
- history remains easy to recover without becoming the current task;
- maps cleanly to existing turn and timeline projections;
- works well for creators who think through dialogue.

Trade-offs:

- the right rail remains visually dense;
- media width is still constrained at desktop sizes;
- the concept labels the source receipt as a creator field in the center
  metadata, which must not be copied literally.

## Direction 2: Artifact Dock

Evidence: `docs/evidence/p13-c-product-design-directions-20260723/02-artifact-dock.png`

The media becomes the dominant workspace. Project facts move into a compact
horizontal band, the left navigation collapses, and one Director decision dock
stays attached to the selected artifact. Review, Skills, promotion, and
Delivery are legible without looking like separate dashboards.

Strengths:

- clearest relationship between the creator's words and the selected shot;
- best media inspection space;
- least duplicated status copy;
- lowest risk of making Skills or history compete with the current action;
- strongest base for an incremental implementation.

Trade-offs:

- conversational history is less visible by default;
- multi-shot project navigation needs careful compact behavior;
- the bottom fact strip must stay passive and cannot become another action bar.

## Direction 3: Session Timeline

Evidence: `docs/evidence/p13-c-product-design-directions-20260723/03-session-timeline.png`

The right side presents the Director session as Clarify, Proposal,
Confirmation, Running, and Review. Completed phases compress; only the current
phase expands. Future project-fact and Delivery gates remain inactive markers.

Strengths:

- clearest origin and consequence for every bounded decision;
- excellent cold-start recovery explanation;
- receipts and Skills fit naturally behind phase disclosures;
- strong support for long-running jobs and revision loops.

Trade-offs:

- highest risk of feeling like a wizard instead of a conversation;
- more responsive complexity at constrained widths;
- generated concept text incorrectly leaves Running sounding active while
  Review is current. Implementation must derive phase completion solely from
  projection state and show only one active phase.

## Comparison

| Criterion | Turn Ledger | Artifact Dock | Session Timeline |
| --- | --- | --- | --- |
| Conversational feel | High | Medium | High |
| Artifact anchoring | High | Highest | High |
| Current decision clarity | High | Highest | Highest |
| History visibility | Highest | Low by default | High |
| Media inspection space | Medium | Highest | High |
| Constrained-width risk | Medium | Lowest | Highest |
| Incremental implementation risk | Medium | Lowest | Highest |
| Risk of workflow/wizard feel | Low | Lowest | Highest |

Product recommendation: use **Artifact Dock** as the structural base, then
borrow Turn Ledger's compact decision history. Use Session Timeline as a
reference for recovery and phase disclosure, not as a literal always-visible
workflow rail. The user must still choose the implementation target.

## Shared visual language

- warm white base, graphite text, neutral dividers;
- restrained teal-green for one current primary action;
- amber only for `needs_review` or waiting;
- red only for destructive or irreversible warnings;
- real media as the dominant visual asset;
- compact system typography with zero letter spacing;
- 8px maximum radius;
- spacing and alignment before borders, shadows last;
- no gradients, purple dominance, glassmorphism, decorative blobs, nested
  cards, oversized hero type, or dashboard metric grids.

## Implementation gate

No production UI implementation begins until the user chooses one displayed
direction. After selection:

1. Treat the chosen image as a hierarchy and interaction target, not a source
   of business truth.
2. Start with one Review vertical slice using the real P13 identity contract.
3. Preserve existing adapters, persistence, projection, and confirmation
   boundaries.
4. Do not call a Provider, approve P13S01, promote facts, or export during the
   first UI implementation pass.
5. Verify desktop and constrained widths in the packaged App before expanding
   to Clarify, Proposal, Running, Skills, or Delivery.

User selection is required before implementation.
