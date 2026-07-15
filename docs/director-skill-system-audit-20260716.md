# Vibe Director Studio P10-S Skill System Audit

Date: 2026-07-16

Status: S0 PASS

Scope: read-only audit of the existing project-local director Skill path. No provider was called, no media was generated, and no UI styling was changed.

## 1. Current Save And Restore Path

The current path is:

1. `MinimalAgentPanel` derives the selected shot.
2. `buildDirectorSkillCardFromShot` builds a `director_skill_card_v1` object from the built-in production strategy.
3. The `save_skill` timeline confirmation waits for an explicit user decision.
4. Confirmation writes a readable Markdown card under `skills/*.md`.
5. Confirmation also writes `skills/skill-index.json`.
6. Cold start restores only index metadata into the right-panel Skill stack.

The confirmation and project-local write boundary are real. The restored runtime value, however, contains only index metadata. The rule body in the Markdown card is not loaded back into Planner, Prompt Compiler, Knowledge Router, or QA.

## 2. Actual Consumers

| Surface | Current source | Saved project Skill consumed? | Result |
| --- | --- | --- | --- |
| Skill recommendation | selected shot `referenceStrategy` | No | Built-in strategy label only |
| Storyboard planner | `buildDirectorProductionSkillPlan` | No | Built-in strategy contracts only |
| Prompt compiler | `buildScriptStoryboardPromptPack` | No | Built-in strategy and asset-authority blocks only |
| Knowledge Router | `KnowledgePack[]` | No | Skill library is a separate, disconnected path |
| Rule QA / text QA | shot, asset, and prompt facts | No | No Skill version/hash is bound to QA |
| Right-panel Skill stack | `skill-index.json` metadata | Yes | Display and saved-state check only |

Therefore the current project-local Skill is persisted and displayed, but it is not an executable or verifiable production input.

## 3. Duplicate Accumulation Root Cause

`skillIdFor` currently derives the ID from:

```text
strategyId + shotId + shotTitle
```

Two shots using the same directing method produce different IDs and different Markdown files. Re-saving the same reusable method across shots therefore accumulates duplicates instead of attaching additional evidence to one stable Skill identity.

The stable identity must be semantic and shot-independent. Shot-specific outcomes belong in Case records, not in the Skill ID.

## 4. Required Object Boundaries

### Skill

A reusable, declarative directing decision method. It owns applicability, guards, inputs, outputs, conflicts, dependencies, maturity, version, content hash, and QA checks. It cannot execute scripts or grant provider authorization.

### Recipe

A compiler/provider-facing parameter recipe selected by a Skill. It owns prompt fragments, compiler profile, parameter hints, and provider compatibility. It does not contain project outcomes or promotion evidence.

### Case

One fact-bound project use or review outcome. It owns project/shot/action identity, input and output hashes, QA evidence, and the human decision. Accepted Cases may support promotion; rejection, retry, failure, or missing human evidence may not.

### Knowledge Pack

Versioned knowledge, rules, and examples that can be routed into bounded context. It remains separate from Skill identity and promotion. A Skill may depend on compatible Knowledge Pack hashes, but cannot rewrite or downgrade Knowledge Pack, provider, preflight, review, delivery, confirmation, or Electron hard locks.

## 5. Missing Contracts

- Canonical Skill JSON as the source of truth; Markdown is currently the only rule-bearing artifact.
- Stable semantic Skill IDs and append-only version history.
- Fail-closed, repeatable v1 migration.
- Structured Recipe and Case records.
- Fact-bound Skill invocation receipts.
- Skill routing with primary, auxiliary, rejected, conflict, and context-budget results.
- Planner, Prompt Compiler, and QA consumption of the same Skill version/hash.
- Candidate promotion, explicit global-library confirmation, rollback, disable, pin, and deprecate operations.
- Positive, negative, ambiguous, and conflict evaluation fixtures.
- Portable package manifest with hashes and atomic import.

## 6. Reusable Existing Infrastructure

The Knowledge system already provides useful patterns for version/hash identity, trust levels, dependencies, conflicts, bounded injection, and route receipts. Project agent timeline and generation-ledger sidecars provide identity checking and fail-closed recovery patterns. The Skill system should reuse those patterns without merging Skill and Knowledge Pack into one object or creating a second current-task state machine.

## 7. Baseline Evidence

The following existing headless checks passed before any implementation change:

- `npm run director-production-skill:test`
- `npm run director-skill-library:test`
- `npm run director-production-skill-flow:smoke`
- `npm run knowledge:test`
- `npm run knowledge-pack-manager:test`
- `npm run project-local-knowledge-file:test`

The production-skill flow smoke used local dry-run fixtures only. No live provider command was run.

## 8. S0 Gate Decision

S0 is complete. S1 may proceed with a narrowly scoped v2 contract. The existing v1 card/index path must remain readable during migration, but it cannot remain the runtime source of truth.
