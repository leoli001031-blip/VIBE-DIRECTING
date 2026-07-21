# Vibe Director Studio P12-D internal dogfooding acceptance

Date: 2026-07-22

Baseline: `a0c3f22 Accept P12-C internal proxy observation`

Preregistered plan:
`docs/agent-first-p12-d-internal-dogfooding-plan-20260722.md`

Plan SHA-256:
`14c2c7f0d98eab946a25ae82dd8610ccc8fcbdf04a0e9f66b60c43bb6a617b0f`

## Verdict

`P12-D internal dogfooding PASS`

Three original short-film tasks were completed in the packaged App after
fixing the reproduced P1 parsing and targeting blockers. All final reruns used
an isolated `HOME`, fresh profile/projects/Runtime roots, blank Provider keys,
and `VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS=1`.

No project save, reference generation, video generation, promotion, Delivery,
or export action was confirmed. Text Provider calls: 0. Media Provider calls:
0. Retries: 0.

This is owner-side internal dogfooding. It is not external creator research.

## Task results

| Task | Result | Messages | Clarify | Stable task | Disk artifacts |
| --- | --- | ---: | ---: | --- | --- |
| D1 restrained visual metaphor | `PASS after P1 fixes` | 2 | 0 | `确认这版故事` | 0 project / 0 Runtime |
| D2 memory-like ambiguity | `PASS after P1 fixes` | 3 | 1 | `确认这版故事` | 0 project / 0 Runtime |
| D3 selected-shot revision | `PASS with P2 copy friction` | 2 | 0 | `确认这版故事` | 0 project / 0 Runtime |

Interaction duration was not instrumented in this manual Computer Use run and
is recorded as `not_instrumented`, rather than estimated from wall-clock tool
activity.

## D1 result

The initial local draft now contains three actual story shots. `安静、克制`,
`镜头数量由你决定`, and the save/generation boundary remain planning metadata
instead of becoming extra shots.

The natural revision independently targets the second and final shots. The
second shot uses blue reflected light without showing a complete beach; the
final shot still ends with the unlit wet match returning to the girl's pocket.
One `确认这版故事` task remains.

Fixed P1:

- compact style and delegated shot-count language leaking into story beats;
- a natural second-shot plus final-shot revision collapsing into one target;
- `不要完整出现` being previewed as a deletion.

Remaining P2:

- the second-shot scene label still reads `海边` rather than the laundry
  reflection context;
- the wet match is not surfaced in the structured props field.

## D2 result

`先问我一个关键问题，再动草案` now enters a real `Clarify` turn with
`conversation_only`. The original two-shot draft remains intact while the
question is active. The freeform answer then returns to one updated unsaved
draft proposal and one `确认这版故事` task; the old Clarify card no longer
competes.

The final second-shot action is:

`用菜篮挡光，鱼就看不见了，水洼只剩天空倒影`

Fixed P1:

- `镜头怎么拆你决定` leaking into the story;
- natural deferred clarification routing directly to a draft edit;
- the protected basket-shadow action being replaced by the new ending;
- `天空倒影` being misclassified as `山路上空`.

Remaining P2:

- `菜市场` is not yet identified as a structured scene;
- the basket and transparent fish are not surfaced as structured prop
  candidates.

## D3 result

The first, non-final shot was explicitly selected. `这个镜头` resolved to
`1-1`, only that row changed, and the second shot remained:

`最后只剩他自己的倒影，但现实车厢从头到尾都是空的`

The route, target, ending protection, current-task count, and execution
boundary all passed. Two non-blocking P2 observations remain:

- the pre-send summary describes `不要让倒影立刻消失` as
  `去掉：让倒影立刻消失`, although the applied edit is correct;
- the applied action retains the command prefix `只改动作：`.

These P2 items are recorded for a later language-quality pass. They did not
justify further code expansion in this P0/P1-only round.

## Changed behavior

The minimum code changes:

1. Separate compact style and delegated shot-planning language from story
   beats.
2. Recognize natural deferred clarification phrasing.
3. Preserve independent second/final targets and strip workflow/audio control
   clauses from draft revisions.
4. Preserve an explicitly protected action when adding a new ending beat.
5. Stop a generic sky reflection from becoming a mountain-road aerial scene.

No colors, layout, typography, density, card style, Provider adapter,
Delivery, promotion, or persistence architecture changed.

## Packaged evidence

Computer Use observed the rebuilt local ad-hoc package at:

`release/mac-arm64/Vibe Director Studio.app`

- `app.asar` SHA-256:
  `3b73eab7833945c9b6947ee198d59b5658fc2def17f9b517631b8a35db090ada`
- main executable SHA-256:
  `6834f0da651f3067dfacec4a80c132b124586471c4f9e239a330b4be1d0ffde9`
- final observation roots:
  `/tmp/vibe-director-p12d-d2-r6` and
  `/tmp/vibe-director-p12d-d3-r1`
- project files after clean reruns: 0
- Runtime files after clean reruns: 0
- generated media or export files: 0

The release package required clearing generated xattrs before Computer Use
launch. This is local ad-hoc packaged acceptance, not notarized distribution.

Structured observation:
`docs/evidence/p12-d-internal-dogfooding-20260722/packaged-observation.json`

Visual evidence: 14 JPEG files, 1195 x 768, in
`docs/evidence/p12-d-internal-dogfooding-20260722/`.

## Verification

Passed:

- `npm run director-ai-storyboard-planner:test`
- `npm run agent-director-clarification:test`
- `npm run new-video-start-contract:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run runtime-api-provider-call-lock:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Preserved dirty files

The six pre-existing P10-E evidence modifications and the pre-existing
generated `electron-runtime/local-runtime-api-server.mjs` modification were
not staged, committed, reverted, or cleaned.

## Gate labels

`P12-D internal dogfooding PASS`

`External creator usability NOT VERIFIED`

`Real Provider execution NOT VERIFIED`

`Public distribution NOT CLAIMED`
