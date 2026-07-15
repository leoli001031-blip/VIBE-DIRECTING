# Agent-first P10-S director Skill system acceptance

Date: 2026-07-16

Status: PASS.

Readiness label:
`P10-S closed; Director Skill learning system and no-provider packaged path passed; P10-B Product Design/ImageGen may begin after the closing commit`.

## Boundary

P10-S upgrades the existing project Skill card into a declarative, evidence-bound learning system. It does not redesign the UI and does not grant any production authority.

This closure did not:

- start a frontend dev server;
- invoke a real text, image, or video provider;
- run `director-production-skill-image2:live` or `director-production-skill-seedance:live`;
- generate project media or submit a provider task;
- retry, approve, promote media, or promote a project fact;
- change color, layout, typography, card styling, or visual density;
- modify the real user Skill Library;
- push a Git branch.

P6S01 remains preview-approved only as media authority, with `promotionAuthorized=false`. Its later local Delivery Gate evidence does not promote it into a project fact.

## Stage verdicts

| Stage | Result | Closure |
| --- | --- | --- |
| S0 audit | PASS | The previous saved Markdown/index path was display-only after restore and did not feed Planner, Prompt Compiler, or QA. |
| S1 contract | PASS | Canonical Skill v2 and Recipe contracts have stable semantic identity, version/hash, guards, migration, and hard locks. |
| S2 evidence | PASS | Case and Invocation Receipt bind current project, fact, action, Skill, provider mode, Knowledge, QA, and human evidence. |
| S3 routing | PASS | A saved project candidate enters Story Planner, Image2/Seedance prompt compilation, and QA through one bounded dry-run binding. |
| S4 registry | PASS | Project candidates remain local; verified/trusted promotion, pin, disable, deprecate, and rollback require explicit operations. |
| S5 evaluation | PASS | Positive, negative, ambiguous, and conflict fixtures distinguish useful routing from false activation. |
| S6 package | PASS | Portable packages are hash-bound, redacted, validated, confirmed, and atomically imported with rollback coverage. |
| Packaged acceptance | PASS | Fresh packaged App save, cold restore, dry-run injection receipt, isolated promotion, and rollback completed with zero provider calls. |

## Root cause

The old path persisted a readable `director_skill_card_v1` Markdown file and an index item, but cold start restored only index metadata. Runtime consumers continued using built-in strategy contracts. The saved rule body therefore appeared in the Agent but did not affect planning, prompt compilation, or QA.

Its ID also included `strategy + shotId + shotTitle`. The same directing method used on another shot produced a new identity and duplicate file instead of one reusable method with multiple Case records.

P10-S separates semantic method, compiler recipe, project outcome, routed knowledge, invocation evidence, and global maturity. That removes duplicate identity without turning one project result into a trusted rule.

## Contract architecture

### Skill Definition

`director_skill_definition/2.0.0` is the canonical source of truth. It contains stable semantic ID, scope, maturity, version, content hash, applicability, guards, typed inputs/outputs, dependencies, conflicts, provider compatibility, Recipe IDs, rules, QA checks, and context budget.

The contract is declarative. Validation rejects executable/script-like fields and preserves these non-overridable hard locks:

- provider policy;
- Preflight Gate;
- Review Gate;
- Delivery Gate;
- confirmation boundary;
- Electron security boundary.

Markdown remains a readable projection. A v1 card can migrate repeatedly to the same v2 identity and hash; invalid or incomplete source data fails closed.

### Recipe and Knowledge Pack

Recipe owns Planner/Image2/Seedance/QA compiler fragments, parameter hints, and provider compatibility. It never owns submit authorization or auto-approval.

Knowledge Pack remains a separate versioned source of knowledge and examples. A Skill may bind compatible Knowledge hashes, but neither object absorbs the other or overrides current project facts.

### Case and Invocation Receipt

A Case records one fact-bound outcome and optional user decision. Accepted, modified, rejected, retry-requested, failed, and needs-review outcomes remain distinguishable. Only current, accepted, QA-passed, explicitly reviewed evidence can support promotion.

Each recommendation/selection/injection/validation can write an Invocation Receipt bound to:

- `projectId`, normalized `projectRoot`, and `projectFactHash`;
- `shotId`, `actionId`, and `jobId`;
- Skill and Recipe version/content hash;
- route reasons and input/output hash;
- Knowledge Pack hashes;
- provider/model and `dry_run` or `live` mode;
- QA result and optional human decision.

Project restore rejects corrupt, cross-project, root-mismatched, or stale-fact ledgers. The current project sidecar is `.vibe-runtime/director-skill-invocations.json`; no parallel current-task state machine was added.

### Router and injection

The Router consumes structured task purpose, strategy, duration, action density, asset completeness, provider capabilities, risk, preferences, and project constraints. It returns primary and auxiliary selections, exclusions, counterexample conditions, conflicts, route reasons, hashes, and context-budget evidence.

Precedence is fixed:

```text
system hard boundaries
> current project facts and constraints
> trusted user-global Skill
> project-local candidate recommendation
```

The selected binding is applied to Story Planner and the existing Image2/Seedance prompt plans. QA validates the same Skill/Recipe/Knowledge hashes. Mismatch blocks validation. Routing and QA never infer state from Chinese display copy, and selection never authorizes provider execution.

### Registry and maturity

New learned methods are `project_local/candidate`. A candidate cannot propagate to another project automatically.

Promotion to `user_global/verified` or `trusted` requires:

- at least two accepted, QA-passed Cases;
- evidence from two distinct projects;
- no unresolved latest rejection, retry, failure, or needs-review outcome;
- one separate, exact user confirmation for the operation and target version/maturity.

Every update creates a new version. The Registry retains operation receipts and supports install, pin/unpin, enable/disable, deprecate, and rollback. Global Case evidence stores hashed project/shot identity rather than source project paths.

### Portable package

A package contains a manifest, canonical Skill, Recipe, README, redacted portable Cases, and positive/negative fixtures. Every formal file has a SHA-256 entry and every path is relative to package root.

Validation rejects secrets, absolute paths, project media, provider authorization, schema/hash mismatch, missing dependencies, unresolved conflicts, bad fixtures, downgrade, and version/content collision. External imports remain unverified until validation and a separate import confirmation pass. Import uses staging, atomic Registry replacement, and an import receipt; failure leaves the prior Registry intact.

## Packaged App evidence

The no-provider acceptance used:

- App: `/Users/lichenhao/Desktop/new vibe directing/release/mac-arm64/Vibe Director Studio.app`;
- root: `/tmp/vibe-director-p10-s-packaged-4WHkWn`;
- profile: `/tmp/vibe-director-p10-s-packaged-4WHkWn/profile`;
- project: `/tmp/vibe-director-p10-s-packaged-4WHkWn/projects/p10-s-project-local-candidate`;
- isolated global library: `/tmp/vibe-director-p10-s-packaged-4WHkWn/global-skill-library`;
- report: `/tmp/vibe-director-p10-s-packaged-4WHkWn/reports/p10-s-packaged-acceptance.json`.

Observed project candidate:

- Skill: `director.skill.storyboard_narrative@1.0.0`;
- scope/maturity: `project_local/candidate`;
- content hash: `vdsh_77298397`;
- project fact hash: `pv_38f15b01`;
- index count after save and cold start: `1`;
- revived old save confirmations: `0`;
- duplicate save actions after restore: `0`.

The restored candidate entered the dry-run Planner/Prompt/QA path and wrote one Invocation Receipt:

- receipt: `dsir_13cdf904`;
- status: `validated`;
- QA: `pass`;
- execution mode: `dry_run`;
- provider calls: `0`;
- generated media: `0`.

An isolated global fixture promoted `1.0.0` to verified `1.1.0`, promoted that evidence line to trusted `1.2.0`, then explicitly rolled back to `1.1.0`. No real user library or project was touched.

## Packaged launch closure

On macOS Darwin 25, directly spawning the bundled Mach-O was killed before application JavaScript ran. A freshly rebuilt ad-hoc bundle at the repeatedly replaced `release` path could also be terminated by AMFI on its first LaunchServices attempt even though `codesign --verify` passed. The failure left no profile, Runtime, or App output and the unified log showed the new main process dying immediately after spawn.

A diagnostic deep ad-hoc re-sign was rejected: it removed electron-builder's hardened-runtime flag and Electron JIT/unsigned-memory/library-validation entitlements. The final local packaging/test lane now:

- lets electron-builder produce the local ad-hoc signature and preserves its hardened-runtime flags and entitlements;
- verifies the source bundle with `codesign --verify --deep --strict`;
- copies the same signed bundle with `ditto` into one fresh, immutable `/tmp` smoke root;
- verifies the copied signature, entitlements, and runtime flag before one LaunchServices `open` launch;
- waits for Runtime shutdown before smoke completion;
- retains the `/tmp` root on failure and removes it only after a passing launch;
- exposes a test-only, random-token, loopback acceptance bridge when an explicit packaged-acceptance environment flag is present.

The default packaged App opens no acceptance control port. The bridge accepts only `evaluate` and `close`, requires a random token of at least 32 characters, binds `127.0.0.1`, and closes during App shutdown. Public release signing configuration was not changed.

## Minimal implementation surface

Core contracts and stores:

- `src/core/directorSkillContract.ts`
- `src/core/directorSkillEvidence.ts`
- `src/core/directorSkillRouter.ts`
- `src/core/directorSkillRegistry.ts`
- `src/core/directorSkillRegistryStore.ts`
- `src/core/directorSkillEvaluation.ts`
- `src/core/directorSkillPackage.ts`
- `src/project/projectDirectorSkillInvocationStore.ts`

Existing consumers were extended in place:

- `src/core/directorSkillLibrary.ts`
- `src/core/storyboardReferenceProjectPlanner.ts`
- `src/core/scriptStoryboardPromptPack.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `electron/main.mts`

Schemas and focused contract scripts mirror each v2 object and stage. No large component or Agent architecture split was performed.

## Verification

Passed without provider calls:

- `npm run director-skill-contract:test`
- `npm run director-skill-evidence:test`
- `npm run director-skill-router:test`
- `npm run director-skill-injection-flow:test`
- `npm run director-skill-registry:test`
- `npm run director-skill-evaluation:test` (`6` fixtures, hit rate `1`, false-trigger rate `0`)
- `npm run director-skill-package:test`
- `npm run director-skill-packaged-acceptance:test`
- `npm run director-production-skill:test`
- `npm run director-skill-library:test`
- `npm run director-production-skill-flow:smoke`
- `npm run knowledge:test`
- `npm run knowledge-pack-manager:test`
- `npm run project-local-knowledge-file:test`
- `npm run vibe-agent-core:test`
- `npm run agent-current-task-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-product-capabilities:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npx tsc --noEmit --pretty false`
- `npm run package:smoke`
- `npm audit --audit-level=low` (`0` vulnerabilities)
- `git diff --check`

The production-skill smoke now writes its report and prompt fixtures under a fresh `/tmp/vibe-director-production-skill-flow-*` root instead of the repository. The final package smoke rebuilt the arm64 App and passed its first immutable-copy LaunchServices attempt without a retry.

## Residual risk

- No real provider-backed Skill execution, billing path, or live media result was tested in P10-S.
- The global promotion exercise used isolated, deterministic accepted fixtures; long-term ranking quality needs real opt-in project history.
- Package import is covered by headless filesystem adapters, not a user-facing import UI.
- Local packaged acceptance covers Apple Silicon macOS, not Windows or a signed/notarized distribution build.
- The test-only packaged acceptance bridge is deliberately outside the normal production surface and must stay closed by default.

## Readiness

P10-S is `PASS`. The same semantic method no longer duplicates per shot; a project candidate survives cold start and enters Planner, Prompt Compiler, and QA; current-fact receipts and promotion gates fail closed; portable packages remain redacted and atomic; and the packaged run produced no provider calls or media.

After the exact closing commit is created, the codebase may enter P10-B Product Design/ImageGen. That next stage may redesign presentation only; it may not weaken the Skill, Agent-first, provider, review, delivery, project-fact, or Electron contracts recorded here.
