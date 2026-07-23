# Vibe Director Studio P10-D Director Turn Design QA

Date: 2026-07-18

Scope: **P10-D Review first slice, Clarify/Proposal second slice, Paid
Confirmation/Running third slice, and Running-to-Review recovery fourth slice
and Review Decision fifth slice, plus Review regeneration sixth slice only**.
This is not acceptance of a real paid Provider task, A/B comparison,
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
- Packaged Request Changes evidence:
  `docs/evidence/p10-d-review-decision-20260718/02-packaged-request-changes.png`
- Packaged approved-preview evidence:
  `docs/evidence/p10-d-review-decision-20260718/04-packaged-preview-approved.png`
- Packaged approved-preview cold-restart evidence:
  `docs/evidence/p10-d-review-decision-20260718/05-packaged-preview-approved-cold-restart.png`
- Packaged Review-regeneration Clarify evidence:
  `docs/evidence/p10-d-review-regeneration-20260718/01-packaged-clarification.png`
- Packaged Review-regeneration Proposal evidence:
  `docs/evidence/p10-d-review-regeneration-20260718/02-packaged-proposal.png`
- Packaged Review-regeneration Proposal cold-restart evidence:
  `docs/evidence/p10-d-review-regeneration-20260718/03-packaged-proposal-cold-restart.png`
- Packaged Review-regeneration Confirmation evidence:
  `docs/evidence/p10-d-review-regeneration-20260718/04-packaged-new-confirmation.png`
- Packaged Review-regeneration Confirmation cold-restart evidence:
  `docs/evidence/p10-d-review-regeneration-20260718/05-packaged-confirmation-cold-restart.png`

Each Clarify, Proposal, Paid Confirmation, and Running reference was opened
together with its corresponding packaged capture for final pairwise comparison.
The Review reference and the packaged returned-result capture were also opened
together in one comparison input.
The D6 Clarify, Proposal, and Confirmation captures were inspected as one
continuous packaged turn and again after their exact cold-restart boundaries.
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
- Request Changes replaces Review with one focused modification-intent turn,
  retains the original result, and keeps the composer available for a concrete
  revision direction.
- Preview approval removes the old Review turn and Review actions. Cold restart
  does not revive the immutable ledger result after its exact strict Review
  Receipt has been written.
- Review regeneration keeps the old P6S01 result visible while Clarify and
  Proposal own the right rail, then creates one fresh local Confirmation only
  after the Proposal is confirmed.
- The D6 Confirmation keeps `本地验证 · 不计费`, old-result preservation, and
  explicit user confirmation visible; no passive Review card or old-video
  blocker competes with it after cold restart.
- The existing restrained shell, spacing, borders, typography, and project
  navigation remain consistent across all accepted P10-D1 through D6 states.

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
- `通过预览` writes one deterministic Review Receipt; exact replay performs no
  second write and no duplicate card appears.
- `需要修改` persists the structured intent before pre-filling the composer;
  cold restart restores that one intent rather than passive export status.
- A blocked confirmation can no longer render a second stale Review card because
  the visible Review surface requires the structured `review` phase.
- D6 clarification cannot create a generation action or job. Its Proposal keeps
  the raw revision separate from the compiled generation prompt.
- Confirming the D6 Proposal creates fresh action, confirmation, and job ids;
  the old result identity is not reused as a retry identity.
- Clarify, Proposal, and the new local Confirmation each survive cold restart
  without changing `project.vibe` or the existing P6S01 media.
- The D6 staged plan remains `awaiting_confirmation`; its handoff has only
  `user_confirmation_required` and is not overwritten by the old video's
  `already_sent` state.
- The packaged returned-result and cold-restart captures are byte-identical;
  the project file, media, ledger, and preview plan also remain unchanged.
- `project.vibe` remained at SHA-256
  `cef0da97eb08b309fecb438ee08b879841fb6653af60eef6ba9a4af8b49064a3`
  through Clarify, Proposal, and Continue Adjusting.
- The separate Paid Confirmation/Running fixture remained at SHA-256
  `47e5280209fa508c96ba36ce804fd370da4f62a04a06952cf9dbe7633177d5af`.
- The D6 Review-regeneration fixture retained the same `project.vibe` SHA-256
  and P6S01 MP4 SHA-256
  `6c1cc9d172160c36634d19ba84839b5738a5c9be3a862c1a1928d46535a135f1`.
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
- The Review reference illustrates an A/B version pair. P10-D7 now implements
  that hierarchy with two identity-complete local results, one shared active
  version, and an independent selection boundary.
- The sixth slice stops before executing the new candidate. Its center therefore
  continues to show the immutable old P6S01 result rather than inventing a
  second version or an A/B comparison.

## P10-D6 boundary at acceptance time

- A real paid Provider transition remains outside this slice.
- Real Provider polling and result recovery remain outside this slice; the
  accepted recovery is local/dry-run only.
- Project-fact promotion, Provider execution, Delivery, and export retain their
  independent boundaries and were not exercised.

## P10-D7 packaged update

- The packaged Preview and Agent rail share one active A/B candidate and expose
  one stable version switch; B is the deterministic default after cold start.
- A and B resolve to separate local media paths and distinct SHA-256 values.
- The right rail keeps exactly one `compare_versions` task and one Review turn.
- `选择版本` stops at a visible confirmation boundary. Promotion remains
  disabled, and no Delivery or export action is introduced.
- `需要修改` replaces Review with one focused revision turn while both original
  candidates remain immutable.
- A damaged generation ledger fails closed: no A/B switch and no Review turn
  are restored.
- Project facts, the generation ledger, and both media files retain their
  baseline hashes. Provider calls and fees remain zero.
- P10-D8 selection receipt and promotion were not entered in the D7 acceptance.
- Evidence:
  `docs/evidence/p10-d-version-pair-20260719/packaged-observation.json`.

## P10-D8 packaged update

- Candidate selection now persists as its own confirmation and receipt; cold
  start restores that exact boundary without reviving the passive Review card.
- Selection confirmation and project-fact promotion use different confirmation
  and action identities. Selection does not alter Project.vibe, Visual Memory,
  either candidate, or Delivery.
- The promotion turn exposes one explicit `确认晋级项目事实` action and no
  export action. Its cold restore retains the exact selection receipt binding.
- Explicit local promotion of B changed the project fact hash from
  `pv_de13842f` to `pv_988bc5d5` and appended one identity-complete
  `agent_video_promotion` receipt.
- After promotion, the old A/B pair, selection card, promotion card, and old
  generation ledger remain historical and cannot reclaim the current task.
- Version A and B retained byte-identical SHA-256 values; the losing candidate
  was not removed.
- Provider calls, external task submissions, fees, Delivery actions, and exports
  remained zero.
- Evidence:
  `docs/evidence/p10-d-review-selection-20260719/packaged-observation.json`.

## P10-D9 packaged update

- Only the exact promoted winner enters Delivery; the loser, stale fact,
  `needs_review` result, and incomplete identity remain excluded.
- Delivery retains a separate `确认导出` boundary and writes nothing before the
  exact confirmation.
- The local package contains one winner MP4 plus project-relative manifests and
  receipts. Its copied media SHA-256 matches the promoted source.
- Atomic publish and cold restore preserve a byte-identical package without
  reviving Review, Selection, Promotion, or Export confirmations.
- Provider calls and fees remain zero.
- Evidence:
  `docs/evidence/p10-d-delivery-handoff-20260719/packaged-observation.json`.

## P10-E packaged update

- The packaged workflow completes Review, revision, Clarify, Proposal, local
  Confirmation/Running, A/B Review, selection, promotion, Delivery, and cold
  restore in one fresh `/tmp` fixture.
- Every observed stage has one current task or one focused turn. Historical
  cards, passive project status, and terminal results do not reclaim focus.
- Candidate A and B have different job, action, receipt, path, and SHA-256
  identities; both remain preserved after winner B is delivered.
- Selection, project-fact promotion, and Delivery each use an independent,
  identity-bound confirmation.
- At `1440 x 900` and `900 x 760`, the Agent rail remains inside the viewport,
  Review buttons are not clipped, and composer copy does not overlap controls.
- The constrained focused turn scrolls when needed so the composer remains
  visible. Restored material facts no longer collapse into vertical labels.
- The local export contains 16 entries and only the promoted winner B media.
- Cold restore shows one idle task and no stale actionable confirmation.
- Provider calls and fees remain zero; real Provider execution remains
  unverified.
- Evidence:
  `docs/evidence/p10-e-packaged-director-workflow-20260719/packaged-observation.json`.

## P13-D Session Timeline update

- Direction 3 is implemented only for the real `P13S01 · needs_review` Review
  state; the complete shell was not redesigned.
- The source direction and production renderer were compared together at the
  same `1058px` height. The selected hierarchy is preserved: one vertical
  session sequence, one expanded Review turn, and locked downstream gates.
- `Review` is the sole current phase. `Clarify`, `Proposal`, `Confirmation`,
  and `Running` are complete; Project Fact and Delivery are locked.
- The existing Review actions, receipt boundary, composer, and real returned
  video remain intact. No action was clicked during visual QA.
- Desktop `1480x980` and constrained `980x820` checks found no horizontal
  overflow, Review escape, composer overlap, or action-text clipping.
- The existing white top bar, center preview structure, and missing
  Skills/Receipts header are deliberate later-slice differences.
- Packaged visual QA is blocked because current, archived known-good, and
  vanilla Electron executables all exit `137` before application code starts.
  This renderer pass is not presented as packaged acceptance.
- Evidence:
  `docs/evidence/p13-d-session-timeline-20260723/renderer-observation.json`.

P10-D through P10-E prior scope: passed

P13-D production renderer visual result: passed

P13-D packaged result: blocked

## P13-E Session Timeline Clarify / Proposal checkpoint

- Direction 3 now uses the same structured Session Timeline for Clarify,
  Proposal, and Review. Display copy does not select the phase.
- Clarify is the only current phase while Proposal and all later gates remain
  locked. Proposal completes Clarify but leaves Confirmation locked.
- Existing Clarify choices, Proposal confirmation copy, callbacks, and
  authority boundaries are unchanged. No new execution control was added.
- Focused projection, clarification, regeneration, TypeScript, diff, and Vite
  production-build checks pass.
- Visual acceptance is blocked before navigation. Playwright MCP does not
  return, the installed Chrome bundle has a disallowed `FinderInfo` xattr, and
  a clean isolated Chrome copy is killed before a page appears.
- Packaged acceptance remains blocked before application code because fresh
  signatures cannot launch while Developer Mode is disabled.
- No screenshot substitute was generated. This checkpoint is not presented as
  production-renderer or packaged visual acceptance.
- Evidence:
  `docs/evidence/p13-e-session-timeline-clarify-proposal-20260723/launch-diagnostics.json`.

P13-E implementation and contract result: passed

P13-E production renderer visual result: blocked

P13-E packaged result: blocked
