# Vibe Director Studio P13-A Image2 and Seedance Provider canary

Date: 2026-07-23

Status: **PASS - ONE AUTHORIZED PROVIDER CANARY, MEDIA REMAINS NEEDS_REVIEW**.

## Scope

The user authorized one Image2 reference generation followed, only after a
valid reference returned, by one Seedance video submission for `P13S01`.

- Project root:
  `/tmp/vibe-director-p13-a-20260723/projects/p13-provider-canary`
- Project id: `p13_provider_canary`
- Project fact hash: `pv_6d5dcb24`
- Shot id: `P13S01`
- Image request: `1280x720`, standard quality, one request, no retry
- Video request: `5` seconds, `720p`, `16:9`, `seedance2.0_vip`
- Seedance command: `image2video`
- Maximum video submit count: `1`
- Automatic retry: `false`

No additional image, alternate model, video resubmission, project-fact
promotion, Delivery action, or export was authorized or performed.

## Exact call counts

| Counter | Value |
| --- | ---: |
| Image2 generation requests | 1 |
| Additional Image2 generations | 0 |
| Seedance video submissions | 1 |
| Seedance result queries | 3 |
| Automatic retries | 0 |
| Packaged-inspection Provider calls | 0 |
| Review approvals | 0 |
| Project-fact promotions | 0 |
| Delivery or export actions | 0 |

The three Seedance queries used only the single saved task identity. They did
not contain `image2video` or `multimodal2video` and did not create another
generation task.

## Image2 result

The Provider returned one valid PNG at `1672x941`, rather than the requested
exact dimensions. No retry was made. The original was retained in the isolated
project and a local `sips` normalization produced the exact `1280x720` input
used by Seedance with zero additional Provider calls.

- Original SHA-256:
  `a43edc9e80478fd03e00f7d7ba180f51686aa0b93d59b9faad1822db92728d0b`
- Normalized SHA-256:
  `b4dbf4837e31212f77027c7e3f4a01637ac02a4dc679ffe7a596205b2c6f4836`
- Provider request id:
  `resp_09ca35d095c4c41f016a613fab5a2081988967d8bfddbcfa2c`
- Final state: `needs_review`

Visual inspection found one elderly man, a visibly empty basket, diagonal
morning light, a restrained translucent fish shape, and a foreground puddle.
There are no extra people, captions, logos, split frames, or large fantasy
effects.

## Seedance result

- External task id: `aeba14b4-8d30-4adf-9d5c-1b283fabc951`
- Model: `seedance2.0_vip`
- Output SHA-256:
  `deb0746c81f91b179f6f8cbcddee9d474ce2ab35f5c1abab5042aa50c1d2393b`
- Portable project path:
  `video/provider-return/P13S01-seedance2.0_vip.mp4`
- Duration: `5.061950` seconds
- Video: H.264, `1280x720`, `yuv420p`, `60 fps`
- Audio stream: AAC
- File size: `6,566,517` bytes
- Final state: `needs_review`

The return is one continuous restrained shot. The man raises the empty basket,
the translucent fish fades, no extra character appears, and the puddle remains
visible. Review should still consider two creative issues: the ending does not
shift emphasis to the puddle as strongly as requested, and the raised basket
can read as hat-like in the final moment. No automatic approval decision was
made.

## Identity and recovery

The returned candidate is bound to one project, fact hash, action, job,
confirmation, canonical source receipt, external task, output path, and output
hash. The canonical source receipt is:

`seedance_submit_aeba14b4-8d30-4adf-9d5c-1b283fabc951`

The first packaged inspection correctly failed closed because the acceptance
fixture used a noncanonical receipt id. A second fixture-only chronology issue
also made the ledger invalid because its fixed `createdAt` was later than the
real UTC job updates. The acceptance harness now uses the canonical Seedance
receipt identity, real ledger creation time, and valid ledger chronology. No
production UI or runtime behavior was changed.

The official ledger restore function then returned `status=restored` with no
errors. The packaged App showed exactly one current task:

- Step: `submit_video`
- Label: `复核视频`
- Review turns: `1`
- Status: `needs_review`
- `通过预览`: enabled but not clicked
- `需要修改`: enabled but not clicked
- Unrelated enabled confirmations: `0`
- Provider calls during packaged inspection: `0`

The Review boundary still states that approval writes only a Review Receipt;
it does not promote project facts or export. The modification boundary states
that discussion does not retry or resubmit automatically.

## Packaged build

The canary used the already accepted P12-F packaged App, without a frontend dev
server.

- `app.asar` SHA-256:
  `10c3720c3b89163f9ead4792b8c4476a718f0781884ac70ae3ebf5f8e0c6d70e`
- Main executable SHA-256:
  `3f0002f834c6cf13815d2af5bff192dd66311dbeac8d7ddf6e412cf7ddb03bb3`

## Evidence

Repository evidence is in
`docs/evidence/p13-a-provider-canary-20260723/`:

- `canary-inspection.json`
- `canary-plan.json`
- `image2-receipt.json`
- `P13S01-image2-reference-1280x720.png`
- `seedance-submit-attempt.json`
- `seedance-submit-plan.json`
- `seedance-result-receipt.json`
- `video-contact-sheet-2fps.jpg`
- `packaged-needs-review-observation.json`
- `packaged-needs-review.png`

The full returned MP4 and raw query logs remain only in the isolated `/tmp`
project. They are not committed. Selected repository evidence was scanned for
API keys, bearer values, session cookies, credential tokens, and Provider
download URLs; none were found.

## Verification

Passed with no additional Provider generation or submission:

- `npm run p13-a-provider-canary:repair-paths`
- `npm run p13-a-provider-canary:packaged`
- `npm run p13-a-provider-canary:inspect`
- Fresh isolated `p13-a-provider-canary:prepare` and `inspect`, both showing
  zero Provider calls
- Official generation-ledger restore: `restored`, no errors
- `npm run project-agent-generation-job-ledger:test`
- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Verdict

P13-A Provider canary: **PASS**.

The one authorized Image2 request and one authorized Seedance submission both
returned usable local media and restored into the packaged Review gate. The
media remains `needs_review`. This result does not claim project-fact approval,
Delivery completion, export completion, notarization, or public release.
