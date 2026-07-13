# Signal Desk Specification

## Design Intent

Signal Desk is a quiet production workspace with one unmistakable Agent task, an inspectable creative object in the center, and compact factual history. It should feel like directing software, not a chat client, marketing page, or operations dashboard.

The design should reduce explanation through hierarchy rather than remove safety copy. Confirmation boundaries, execution mode, blockers, job identity, and real-vs-dry-run truth remain explicit.

## Information Architecture

### Top utility bar

- Product and current project identity.
- Runtime/provider health only when actionable.
- Global project switch, settings, and window-level commands.
- No duplicate current-task status.

### Left project navigation

- Project stages: story, references, video, delivery.
- Passive counts and completion state.
- Shot list or project outline for direct navigation.
- No primary execution buttons.

### Center work area

- A single contextual stage header.
- The object being inspected or confirmed: story rows, save target, reference slots, video jobs/results, or export manifest.
- Selected-shot/media inspector where useful.
- No second full copy of the Agent confirmation card.

### Right Agent rail

Five stable layers in this order:

1. Current task header.
2. Confirmation or execution surface.
3. Structured facts and blockers.
4. Collapsible history.
5. Composer.

Only one confirmation or execution surface is expanded at a time.

## Layout

| Mode | Width | Left | Center | Agent |
| --- | --- | --- | --- | --- |
| Full desktop | >= 1280 px | 220 px | min 640 px, flexible | 368 px |
| Compact desktop | 1100-1279 px | 176 px | min 548 px, flexible | 352 px |
| Tight desktop | 900-1099 px | 56 px icons | min 500 px, flexible | 336 px |
| Narrow | 720-899 px | 52 px icons | remaining width | 360 px overlay |
| Very narrow | < 720 px | mode switch | one surface at a time | full-width task mode |

Dimensions include their internal padding but not the 1 px separators. The center and Agent rail must never both shrink below their minimums. At narrow widths, the current task opens as an overlay/drawer instead of squeezing the storyboard.

Use a 48 px top utility bar. Use stable grid tracks so status labels, long shot names, loading text, and button state changes do not resize the application shell.

## Core Components

| Component | Responsibility | State source |
| --- | --- | --- |
| `SignalDeskShell` | Stable four-region desktop grid | viewport only |
| `ProjectStageNav` | Stage navigation and passive counts | project observation |
| `CurrentTaskHeader` | One task label, status, and concise next effect | current-task projection |
| `TaskObjectInspector` | Center object relevant to the task | project/job/export data selected by projection step |
| `StoryboardList` | Shot order, duration, reference/video state | storyboard rows |
| `ShotRow` | One stable, selectable shot record | one storyboard row |
| `MediaInspector` | Real reference/video or honest empty state | asset facts/receipts |
| `ConfirmationPanel` | Exact effect, boundary, mode, blockers, actions | active confirmation plus projection |
| `ExecutionPanel` | Running/succeeded/failed job state | job ledger and receipt |
| `JobLedgerRow` | Compact job identity and output facts | job ledger |
| `HistoryList` | Resolved confirmations and terminal results | timeline/history only |
| `AgentComposer` | New intent and revisions | composer route |
| `ExecutionModeTag` | Dry-run/live text and icon | execution contract |
| `InlineBlocker` | Structured blocker and resolution hint | projection blockers |

These components present existing state. They must not infer task or action state from message copy.

## Visual Tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F4F5F3` | Application background |
| `surface` | `#FFFFFF` | Main work surfaces |
| `surface-subtle` | `#EBEEEB` | Selected rows and grouped metadata |
| `ink` | `#1E2220` | Primary text |
| `muted` | `#53605A` | Secondary text |
| `line` | `#C7CEC9` | Dividers and control borders |
| `confirm` | `#A73728` | Explicit confirmation action |
| `running` | `#2B665F` | Running/query state |
| `success` | `#1F6A50` | Verified completion |
| `warning` | `#855C14` | Waiting or caution |
| `blocked` | `#9F352D` | Failure or blocker |
| `info` | `#315E73` | Neutral system information |

Contrast checks against white: muted 6.59:1, confirm 6.52:1, running 6.63:1, success 6.49:1, warning 5.94:1, blocked 6.95:1, info 7.05:1, and ink 16.09:1. Recheck real combinations and disabled states in implementation; do not create disabled text by opacity alone.

### Typography

- System stack: SF Pro Text/Display, PingFang SC, system sans-serif.
- Page title: 24 px/32 px, semibold.
- Current task: 20 px/28 px, semibold.
- Section heading: 16 px/24 px, semibold.
- Body and controls: 14 px/20 px, regular or medium.
- Metadata: 13 px/18 px, regular.
- Monospace IDs: 12 px/18 px, system monospace.
- Letter spacing: 0.
- No viewport-scaled type and no serif type in application chrome.

### Spacing And Shape

- Spacing scale: 4, 8, 12, 16, 24, 32 px.
- Control height: 40 px primary; 36 px compact/icon with at least a 40 px effective hit area.
- Radius: 4 px controls, 6 px framed panels, 8 px modal/overlay maximum.
- Borders: 1 px. Use spacing and dividers before adding boxes.
- Shadows: overlays and menus only; no floating page sections.
- Tags: status and execution mode only. Do not turn ordinary metadata into pills.
- Icons: Lucide, normally 16 or 18 px, paired with tooltips for unfamiliar actions.

## Current Task Header

The header is always visible at the top of the Agent rail and contains:

- semantic status icon;
- projection label;
- one-line effect summary;
- optional blocker count;
- optional dry-run/live tag.

It does not contain the primary confirmation button. The action belongs to the confirmation panel directly below it. When history is expanded, the current-task header stays pinned.

## Confirmation Panel

The confirmation panel is the only strongly framed surface in the Agent rail.

Required order:

1. Exact task label.
2. Target object and concise facts.
3. “确认后会” effect statement.
4. “不会” boundary statement.
5. Execution mode.
6. Blockers or preflight result.
7. Full-width primary confirmation button.
8. Secondary revise/cancel action.

The primary button uses `confirm` only for a real side-effect boundary. Dry-run still uses the same confirmation structure, but the mode tag and effect copy state that no provider is called. Generic “继续” is never substituted for the exact action label.

## Center Object By State

| Current task | Center object |
| --- | --- |
| Draft story | Intent editor and constraints |
| Confirm story | Ordered story/shot rows with durations |
| Choose save location | Proposed project identity and selected filesystem target |
| Prepare references | Reference slots, source material, and missing-state reasons |
| Submit video | Shot readiness and submit/query job rows |
| Export | Manifest grouped by story, references, video, receipts, and metadata |
| Idle | Current project overview and suggested intent, without a marketing empty state |

## Execution And History

- Running state shows operation, immutable job ID, target shots, provider mode, start time, and supported control.
- Query state emphasizes “existing task” and shows the external task ID once.
- Success shows only outputs supported by a receipt. Dry-run success uses “合同验证通过” or equivalent, never “视频已生成”.
- Failure shows error, affected step, retry boundary, and whether a new confirmation is required.
- History uses compact rows with timestamp, action, mode, result, and receipt disclosure. It is collapsed by default when a live task exists.

## Responsive Rules

- At 900-1099 px, left navigation becomes icon-only with tooltips; it does not truncate labels into unreadable fragments.
- At 720-899 px, the Agent rail becomes a right overlay. The current task remains available as a persistent toolbar control with status and blocker count.
- A waiting confirmation opened in the overlay stays pinned until resolved or explicitly dismissed; dismissal does not execute it.
- Below 720 px, use “Project” and “Agent” modes rather than simultaneous columns. Preserve selection and scroll position when switching.
- Long Chinese labels wrap to two lines where allowed. Buttons use stable height constraints and dynamic inner layout rather than shrinking text.
- No horizontal scrolling for normal text at supported widths or 200% zoom.

## Motion And Feedback

- 120-180 ms transitions for overlay, disclosure, and selection only.
- Respect `prefers-reduced-motion`.
- Do not animate task order or use motion to imply execution before a receipt exists.
- Running indicators include text and icon; completion announcements use an accessible live region without moving keyboard focus.

## Acceptance Checklist

- One primary current task at every state.
- One expanded confirmation/execution surface.
- Center content explains what is being confirmed.
- No nested cards or decorative pills.
- No beige/brown one-note palette, gradients, or decorative blobs.
- All real/dry-run and waiting/running/succeeded/failed states remain distinguishable without color.
- Packaged App screenshots at full, compact, tight, and narrow widths show no overlap or clipped action labels.
- Keyboard, focus, screen-reader announcement, 200% zoom, and reduced-motion checks are recorded.
