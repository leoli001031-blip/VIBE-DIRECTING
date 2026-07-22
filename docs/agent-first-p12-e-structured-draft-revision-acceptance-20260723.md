# Vibe Director Studio P12-E structured draft revision acceptance

Date: 2026-07-23

Baseline: `fd9197a Accept P12-D internal dogfooding`

## Verdict

`P12-E structured draft revision PASS`

The P12-D language-quality findings now share one structured revision contract
from right-rail preview through local draft execution. D1, D2, D3, and a final
pure-removal guard were exercised through the packaged App with isolated
`/tmp` roots and `VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS=1`.

No project save, reference generation, video generation, promotion, Delivery,
or export action was confirmed. Text Provider calls: 0. Media Provider calls:
0. Retries: 0.

## Root cause

The right Agent preview and `NewVideoStart` execution previously maintained
different natural-language parsers. Their target, removal, scene, and control
phrase rules could drift independently. The local scene/prop projection also
treated every `海边` mention as a real beach and did not recognize the D1/D2
props.

That divergence caused three P12-D P2 findings:

- temporal or visibility constraints could look like content deletion;
- execution could retain command scaffolding such as `只改动作：`;
- reflection context and visible objects did not reach structured scene/prop
  fields.

## Minimum change

1. Added typed `DraftRevisionIntent` parsing and preview generation in
   `src/core/draftRevisionIntent.ts`.
2. Routed both `MinimalAgentPanel` preview and `NewVideoStart` execution through
   that contract.
3. Kept ordinal, final-shot, selected-shot, multi-target, scene-move,
   preserve-target, pure-removal, and mixed-removal operations distinct.
4. Kept `不要让倒影立刻消失` and `海边不要完整出现` as revisions, while
   `最后一镜不要怀表` remains an explicit removal.
5. Added local structured recognition for reflected sea light in the laundry,
   `清晨菜市场`, `湿火柴`, `透明鱼`, and `菜篮`.

No color, layout, typography, card style, Provider adapter, Delivery,
promotion, or persistence architecture changed.

## Packaged results

| Path | Result | Structured result | Stable task |
| --- | --- | --- | --- |
| D1 second/final revision | `PASS` | second shot stays `凌晨洗衣店`; `湿火柴` is a prop | `确认这版故事` |
| D2 market ending | `PASS` | `清晨菜市场`, `透明鱼`, and `菜篮` are structured | `确认这版故事` |
| D3 selected action | `PASS` | no false removal preview; no `只改动作：` prefix | `确认这版故事` |
| Final pure removal | `PASS with P2 copy friction` | only the last-shot `怀表` is removed | `确认这版故事` |

All four paths retained one current right-rail task. None wrote a project or
Runtime file, and none crossed a generation boundary.

## Final bundle

Rebuilt candidate:
`release/mac-arm64/Vibe Director Studio.app`

- final `app.asar` SHA-256:
  `81251c2fa23c89fb25fedae9bfcbdc57a1cead5445b85bffae25c031f28ff982`
- release main executable SHA-256:
  `1f98b77dd7301fa6496e7c34921925e6be2acf088a65f85a0b92803644c3619d`
- final Computer Use root:
  `/tmp/vibe-director-p12e-final-qir0El`
- final project files: 0
- final Runtime files: 0
- Provider traces: 0

The Computer Use copy required clearing generated xattrs and local ad-hoc
re-signing. This remains local packaged acceptance, not notarized public
distribution.

Structured evidence:
`docs/evidence/p12-e-structured-draft-revision-20260723/packaged-observation.json`

Visual evidence: four JPEG files, 1195 x 768, in
`docs/evidence/p12-e-structured-draft-revision-20260723/`.

## Verification

Passed:

- `npm run director-ai-storyboard-planner:test`
- `npm run agent-director-clarification:test`
- `npm run draft-revision-intent:test`
- `npm run new-video-start-contract:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run runtime-api-provider-call-lock:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Remaining evidence

One non-blocking P2 copy issue remains: pure object removal can leave an
under-specified phrase such as `她握着起身离开` or `手边可见`. The target,
operation, props, confirmation boundary, and unaffected shot remain correct.
This does not justify another parser expansion in P12-E.

The D1 profile was also closed and reopened once. The unconfirmed browser
draft returned to 0 shots instead of restoring. Recovery was outside the
P12-E revision-contract scope; it is the first concrete P12-F reliability
case and must be reproduced before any Provider work.

## Preserved dirty files

The six pre-existing P10-E evidence modifications and the pre-existing
`electron-runtime/local-runtime-api-server.mjs` modification were not staged,
committed, reverted, or cleaned. Rebuilding preserved the runtime file's
pre-build SHA-256 exactly:
`98352bb6a43bbd59566537a584691402c9998dc9763d58573d5a68dcec9e2a8e`.

## Next gate

P12-E permits entry to P12-F recovery and stability work. It does not permit
Image2 or Seedance submission yet. Provider execution remains reserved for
P13-A after P12-F passes.

## Gate labels

`P12-E structured draft revision PASS`

`External creator usability NOT VERIFIED`

`Real Provider execution NOT VERIFIED`

`Public distribution NOT CLAIMED`
