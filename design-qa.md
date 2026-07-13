# Signal Desk P5-B Design QA

## Comparison Target

- Source visual truth: `docs/product-design/p5-a-20260712/directions/option-1-signal-desk.png`
- Desktop implementation: `docs/product-design/p5-b-20260713/evidence/12-draft-confirmation-primary-visible-1195x768.png`
- Save-location implementation: `docs/product-design/p5-b-20260713/evidence/13-save-location-primary-visible-1195x768.png`
- Tight implementation: `docs/product-design/p5-b-20260713/evidence/16-tight-three-column-order-fixed-860x768.png`
- Minimum-window implementation: `docs/product-design/p5-b-20260713/evidence/17-minimum-window-agent-overlay-765x900.png`
- State: two-shot story draft confirmation, then confirmed story waiting for save-location confirmation
- Theme: packaged App, light theme, local dry-run only

## Evidence

The source board and each final packaged-App capture were opened together in the same comparison input. The desktop comparison used the matching story-confirmation state at `1195x768`; the save-location capture checks the next projected task. The full-resolution desktop captures make the right-rail typography, confirmation facts, primary action, secondary action, and composer readable, so a separate crop was not required.

Primary interactions tested through Computer Use:

- Entered and sent the two-shot story prompt.
- Waited for the local fallback draft without calling an image or video provider.
- Confirmed the story and observed the projected task change to `选择保存位置`.
- Resized the packaged window through desktop, tight three-column, and minimum-window overlay layouts.
- Closed and relaunched the packaged App to inspect recovery behavior.

Packaged process stderr was checked during each run. No renderer exception was emitted; the only recurring message was the macOS `IMKCFRunLoopWakeUpReliable` input-method warning.

## Findings

No actionable P0, P1, or P2 visual mismatch remains in the tested packaged-App viewports.

- Typography: system sans-serif hierarchy, zero letter spacing, task title weight, body line height, wrapping, and truncation preserve the restrained Signal Desk hierarchy.
- Spacing and layout: desktop uses the intended project rail, object canvas, and Agent rail; confirmation and composer stay independently contained. Tight mode preserves the three regions, and the minimum window uses an Agent overlay without overlap or vertical text collapse.
- Colors and tokens: neutral canvas/surfaces, green navigation accent, amber waiting state, brick-red confirmation action, and teal execution semantics map to the source direction without a one-hue palette.
- Images and assets: this comparison state intentionally has no generated media. The implementation uses Lucide controls and does not substitute target imagery with CSS drawings, emoji, or hand-built SVGs.
- Copy and content: current task, target, effect, boundary, mode, primary action, secondary action, and composer copy remain creator-facing and projection-driven.
- Accessibility: native buttons and text areas remain exposed in the AX tree, current confirmation uses `aria-current`, focus indicators are present, reduced motion is covered, and the primary and secondary actions are visible at desktop height.

## Comparison History

1. P1: the root grid expanded to max-content height, pushing the composer outside the visible rail. The main grid row was constrained with `minmax(0, 1fr)`, and the current confirmation was ordered first by structured confirmation ID. Post-fix evidence: `07-draft-confirmation-grid-contained-1195x768.png`.
2. P1: duplicate current-selection and confirmation summaries pushed the exact action below the first Agent viewport. Duplicate facts are now suppressed only when a structured confirmation strip exists, confirmation actions share one row, and the redundant selection block is hidden while a current confirmation is active. Post-fix evidence: `12-draft-confirmation-primary-visible-1195x768.png` and `13-save-location-primary-visible-1195x768.png`.
3. P0: the tight layout inherited `order: -3` from an older media query and rendered the Agent as a vertical sliver. The tight breakpoint now resets Agent order, while narrower breakpoints use explicit grid areas and a fixed overlay. Pre-fix evidence: `14-save-location-compact-860x768.png`; post-fix evidence: `16-tight-three-column-order-fixed-860x768.png` and `17-minimum-window-agent-overlay-765x900.png`.

## Open Questions

- macOS would not resize this packaged window below approximately `765x900`; CSS below the minimum reachable width remains contract-covered but was not visually exercised on this machine.
- The source board's media-rich query-result canvas was not treated as a fidelity requirement for the save-location state. Its hierarchy should be rechecked when the real query-result state is accepted in a later packaged flow.
- Packaged recovery of a confirmed but not-yet-saved story is a separate business-state blocker, not a remaining design mismatch.

## Follow-up Polish

- P3: compare the final video-query and execution-history states against the media-rich section of the source board after the packaged recovery blocker is fixed.

final result: passed
