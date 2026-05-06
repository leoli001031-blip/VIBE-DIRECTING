# Real Demo E2E 002 Anime Pressure

Date: 2026-05-03

## Purpose

Validate that Vibe Core can prepare a larger real software-chain pressure run for anime-style image generation without relying on provider self-report, fixture reuse, or manual file copying.

## Scope

- Run folder: `real-test-sandbox/real-demo-e2e/002-anime-pressure`
- Scenario: `Blue Hour Compass`
- Style: clean anime film frame, low texture, soft cel shading, restrained background detail
- Story size: 16 shots
- Scenes: 3 complex locations
  - rooftop school observatory
  - rainy abandoned shopping arcade
  - underground maintenance platform
- Characters: 3 locked text-authority roles
  - Mika Arai
  - Ren Kasai
  - Yuna Mori
- Planned real images: 6 Image2 start frames
- Parked/queued shots: 10

## Hard Boundaries

- Image2 only through imagegen subagents.
- No Seedance, Jimeng, Fast model, VIP channel, text-to-video, or video generation.
- `prepare` creates only project facts, task packets, envelopes, prompt requests, and manifest data.
- `verify` remains blocked until all 6 planned images, provider observation sidecars, and completed semantic QA sidecars exist.

## Acceptance Criteria

The run passes only when all of these are true:

- `project.vibe`, source index, visual memory, story flow, and all 16 shot layouts exist.
- The 6 planned real-image shots have complete subagent packets and envelopes.
- Each planned image exists at its scoped sandbox output path.
- Each planned image has a valid provider observation sidecar written by the imagegen subagent.
- Each planned image has a completed semantic QA sidecar covering `identity`, `scene`, `style`, `story`, `neighbor`, and `output` gates.
- Semantic QA severity policy is explicit: P0 blocks, P1 returns `needs_review` and cannot be called a clean pass, P2 is recorded only.
- Watcher events, manifest match, QA report, preview plan, and final E2E report are generated.
- The final report declares `actual_provider_observed`.

## Why This Is Larger Than 001

001 covered 8 shots, 2 scenes, 1 character, and 2 real image plans. 002 raises the pressure to 16 shots, 3 scenes, 3 characters, and 6 real image plans, while keeping the same return-path gates. This tests whether the chain can hold style, identity, scene anchors, neighboring-shot context, and provenance under a more realistic anime storyboard workload.

## Expected Commands

```bash
npm run real-demo-e2e-002:prepare
npm run real-demo-e2e-002:verify
```

The second command should block before imagegen subagents produce the 6 images and provider sidecars, and before semantic QA has reviewed all 6 images. After subagents return the files and semantic QA is complete, the same verify command should pass only if there are no P0 or P1 findings; P1 exits as `needs_review`.

## Current Implementation Notes

- `scripts/real-demo-e2e-002-anime-prepare.mjs` writes the full run folder, including 16 shot layouts, 6 imagegen packets/envelopes/prompt requests, 6 provider observation templates, and 6 semantic QA templates.
- `scripts/real-demo-e2e-002-anime-verify.mjs` writes `watcher_events.json`, `manifest_match.json`, `qa_report.json`, `preview_plan.json`, and `real_demo_e2e_report.json` on every run.
- `src/core/realDemoE2e.ts` keeps the 001 default pressure range at 6-10 shots and 1-3 real images, while accepting scenario-specific ranges such as 002's 12-20 shots and 4-6 real images.
- `scripts/real-demo-e2e-test.mjs` covers the legacy 8-shot pressure case, the 16-shot anime pressure case, P1 `needs_review`, and P0 blocking behavior.
