# Vibe Director Studio P10-D Director Turn Design QA

Date: 2026-07-17

Scope: **P10-D Review first slice, Clarify/Proposal second slice, Paid
Confirmation/Running third slice, and Running-to-Review recovery fourth slice
only**. This is not acceptance of a real paid Provider task, A/B comparison,
project-fact promotion, or P10-E Delivery.

## Comparison targets

- Clarify ImageGen reference:
  `/Users/lichenhao/.codex/generated_images/019f0313-3dbe-7c12-a8e0-28af0b7a1f06/exec-42781c1a-d1db-43e3-9b76-7fd65881e70c.png`
- Proposal ImageGen reference:
  `/Users/lichenhao/.codex/generated_images/019f0313-3dbe-7c12-a8e0-28af0b7a1f06/exec-9f154c11-8257-4a30-b19f-378420c4add2.png`
- Review ImageGen reference:
  `/Users/lichenhao/.codex/generated_images/019f0313-3dbe-7c12-a8e0-28af0b7a1f06/exec-9156026d-a5ec-4a78-955b-2bf24f3694de.png`
- Paid Confirmation ImageGen reference:
  `/Users/lichenhao/.codex/generated_images/019f0313-3dbe-7c12-a8e0-28af0b7a1f06/exec-29fa5770-5531-44e9-8e86-532fbbb5b06f.png`
- Running ImageGen reference:
  `/Users/lichenhao/.codex/generated_images/019f0313-3dbe-7c12-a8e0-28af0b7a1f06/exec-346683eb-418b-4680-9e23-75200a157b2a.png`
- Packaged Clarify evidence:
  `docs/evidence/p10-d-clarification-proposal-20260717/01-packaged-clarification.png`
- Packaged Proposal evidence:
  `docs/evidence/p10-d-clarification-proposal-20260717/02-packaged-proposal.png`
- Packaged Review evidence:
  `docs/evidence/p10-d-review-turn-20260717/01-desktop-review.jpeg`
- Packaged Paid Confirmation evidence:
  `docs/evidence/p10-d-paid-confirmation-running-20260717/01-packaged-paid-confirmation.png`
- Packaged Running evidence:
  `docs/evidence/p10-d-paid-confirmation-running-20260717/02-packaged-running.png`
- Packaged returned Review evidence:
  `docs/evidence/p10-d-running-review-recovery-20260718/02-packaged-review-returned.png`
- Packaged cold-restart Review evidence:
  `docs/evidence/p10-d-running-review-recovery-20260718/03-packaged-review-cold-restart.png`

Each Clarify, Proposal, Paid Confirmation, and Running reference was opened
together with its corresponding packaged capture for final pairwise comparison.
The Review reference and the packaged returned-result capture were also opened
together in one comparison input.
The generated references and packaged window have different native canvas
dimensions, so this check judges the selected product hierarchy and interaction
contract rather than claiming a pixel clone.

## Visible result

No actionable P0, P1, or P2 mismatch remains in the accepted slices.

- The center keeps the real P6S01 artifact while the right rail owns one
  focused Director turn.
- Clarify shows the original feedback, one concrete question, exactly two
  bounded choices, and a visible `conversation_only` boundary.
- Proposal replaces Clarify after a choice and shows one staged action, its
  target, proposed change, and explicit `确认写入项目` / `继续调整` actions.
- Current task, Skills, work-mode controls, and history no longer compete with
  Clarify, Proposal, Paid Confirmation, Running, or Review; earlier conversation
  stays behind disclosure.
- The composer remains visible and changes its scope copy for each focused
  turn without overlapping the primary actions.
- Paid Confirmation presents one exact task identity, its external-cost and
  irreversible boundaries, one submit-once action, and one return action.
- Running presents one exact job, structured execution facts, three progress
  steps, and only background/history actions; retry, approval, promotion, and
  export are absent.
- A newly returned exact job replaces Running with one Review turn, opens the
  single returned artifact, and keeps `needs_review`, target, receipt, hash, and
  no-retry/no-promotion/no-export boundaries visible.
- Cold restart restores the same Review hierarchy without an old confirmation
  or passive export task taking priority.
- The existing restrained shell, spacing, borders, typography, and project
  navigation remain consistent across all six accepted turn states.

## Interaction QA

- `需要修改` focuses and pre-fills the composer without changing the project.
- `纸飞机亮得太早了` stops at Clarify and cannot directly stage a write.
- Choosing `情绪转折` forms a Proposal and does not call an external generation
  service, export, promote project facts, or mutate `project.vibe`.
- `继续调整` restores the resolved intent to the composer and disables project
  confirmation while text is being edited.
- Proposal confirmation is enabled only when the staged action identity matches
  the exact structured project-edit confirmation.
- Paid confirmation is enabled only when confirmation id, action id, and current
  project fact hash all match. The packaged QA did not click this live action.
- An exact dry-run non-terminal job restores as Running; terminal, stale-fact,
  and missing-identity jobs fail closed.
- `后台运行` initially exposed React error #300 because a collapsed early return
  preceded later hooks. The return was moved below all hooks; the rebuilt
  packaged App now collapses, reopens, and preserves the exact job safely.
- `查看任务记录` opens existing history without submitting or retrying a job.
- An exact local result identity transitions the current dry-run job from
  Running to `needs_review`; stale or mismatched identities fail closed.
- The returned video workspace opens once for a new Review identity, while a
  stable identity does not repeatedly force the user back after navigation.
- The packaged returned-result and cold-restart captures are byte-identical;
  the project file, media, ledger, and preview plan also remain unchanged.
- `project.vibe` remained at SHA-256
  `cef0da97eb08b309fecb438ee08b879841fb6653af60eef6ba9a4af8b49064a3`
  through Clarify, Proposal, and Continue Adjusting.
- The separate Paid Confirmation/Running fixture remained at SHA-256
  `47e5280209fa508c96ba36ce804fd370da4f62a04a06952cf9dbe7633177d5af`.
- No provider submission, paid request, retry, project-fact promotion, or export
  was triggered during this QA pass.

## Deliberate differences

- The references illustrate a two-shot project and timeline timing controls;
  the real QA project has one durable P6S01 result, so this slice does not invent
  another shot, media version, or timing editor.
- The packaged Proposal exposes durable action identity and the actual staged
  text instead of the mock's illustrative A/B recommendation card.
- The production rail remains denser than the direction images because this
  slice changes the focused turns, not the whole application shell.
- The Paid Confirmation and Running references include illustrative video
  media. The real third-slice fixture intentionally has no output media because
  no Provider task was submitted; the center keeps the real project state.
- The Review reference illustrates an A/B version pair. The fourth-slice
  fixture intentionally presents one returned P6S01 result because durable
  version-pair comparison remains outside this acceptance.

## Remaining work

- A real paid Provider transition remains outside this slice.
- Real Provider polling and result recovery remain outside this slice; the
  accepted recovery is local/dry-run only.
- A/B compare requires a durable version-pair contract and two real results.
- Project-fact promotion, Provider execution, Delivery, and export retain their
  independent boundaries and were not exercised.

final result: passed
