# Vibe Director Studio P13-B local Beta package

Date: 2026-07-23

Status: **PASS - LOCAL AD-HOC BETA**.

## Scope

P13-B generated and verified a local macOS arm64 Beta package from the current
Agent-first baseline. It uses ad-hoc signing, has no Developer ID, is not
notarized, and is not presented as a public release or App Store build.

The P11-C packager was minimally parameterized so its default P11 behavior
remains available while P13-B receives a separate release id, evidence root,
stage label, sample source marker, and current Provider limitation text. No UI,
workflow, Provider, Review, promotion, Delivery, or export behavior changed.

## Artifacts

The generated local artifacts are under `release/`. Support material and the
release manifest are under `release/p13-local-beta/`.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Vibe Director Studio-0.0.1-arm64.dmg` | 119166145 bytes | `87a9f31975a5a90aa09b4b4ccc7349738dc4935142ddef5d99944b8eb80717b6` |
| `Vibe Director Studio-0.0.1-arm64-mac.zip` | 115215039 bytes | `a8a67ae6074197ab41ce48a63c4ddcb9fe52197fd05daa463f52be05d96b3a38` |

- Version: `0.0.1`
- Manifest commit: `5b16466de4541f493d1cbff4321e484737147446`
- Platform: `darwin`
- Architecture: `arm64`
- Signature: `ad_hoc`
- Team identifier: not set
- Notarized: `false`
- Public distribution claimed: `false`
- `app.asar` SHA-256:
  `10c3720c3b89163f9ead4792b8c4476a718f0781884ac70ae3ebf5f8e0c6d70e`
- Packaged main executable SHA-256:
  `ebb4d6c06cad0fe2f268db163912073e01870670afdd2ce619049ad40f566a2b`

The Beta support folder includes:

- `README.md`
- `BACKUP-UPGRADE-ROLLBACK.md`
- `KNOWN-LIMITATIONS.md`
- `example-project/project.vibe`
- `release-manifest.json`
- `evidence/packaged-acceptance.json`

The example project contains two planned shots, no credentials, and no media.
Its `project.vibe` SHA-256 is
`fe7c65ed8d1b9c4992dd0937f2a4aa7b493635826f5c23bcdc4c03f3d7449963`.

## Source-state disclosure

The release manifest intentionally records `sourceState=dirty`. It lists:

- `electron-runtime/local-runtime-api-server.mjs`
- `package.json`
- `scripts/p11-local-beta-package.mts`

The package and packager changes are the P13-B release tooling in this
checkpoint. The Electron runtime bundle was a pre-existing dirty generated
file. Packaging regenerated it, after which the working-tree copy was restored
from the saved backup to its preserved SHA-256:

`98352bb6a43bbd59566537a584691402c9998dc9763d58573d5a68dcec9e2a8e`

The user-owned P10-E evidence changes were excluded from the release manifest
and were not modified, staged, or committed by P13-B. This package is not
described as a clean-source public release.

## Packaged verification

The P13-B acceptance performed all of the following with zero Provider calls:

1. Verified the unpacked App using `codesign --verify --deep --strict`.
2. Confirmed `Signature=adhoc` and no Team Identifier.
3. Verified the DMG using `hdiutil verify`.
4. Extracted the ZIP into a fresh `/tmp` directory.
5. Re-verified the extracted App signature.
6. Launched the extracted App without a frontend dev server.
7. Opened the copied two-shot example project.
8. Exported and extracted one diagnostics ZIP from the packaged App.
9. Confirmed the diagnostics bundle includes no credentials, tokens, full
   project files, media, or absolute paths.

The named `p13-b-local-beta:test` repeated the extracted-App and diagnostic
acceptance successfully. The default `p11-c-local-beta:test` also passed after
parameterization, proving the existing P11 release path still works.

## Provider boundary

P13-B made zero Provider calls. The support material records the P13-A result
without upgrading its status:

- Image2 generation requests: `1`
- Seedance video submissions: `1`
- Automatic retries: `0`
- Returned media: `needs_review`
- Approved: `false`
- Promoted: `false`
- Delivered: `false`
- Exported: `false`

The single P13-A canary is not described as scale, quality, cost, or public
release validation.

## Evidence

Repository evidence is in
`docs/evidence/p13-b-local-beta-package-20260723/`:

- `release-manifest.json`
- `packaged-acceptance.json`
- `README.md`
- `BACKUP-UPGRADE-ROLLBACK.md`
- `KNOWN-LIMITATIONS.md`
- `project.vibe`

The DMG and ZIP remain under ignored `release/` and are not committed to Git.

## Verification

Passed:

- `npm run package:p13-local-beta`
- `npm run p13-b-local-beta:test`
- `npm run p11-c-local-beta:test`
- `npm run diagnostic-bundle:test`
- `npm run package:release:contract:test`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Verdict

P13-B local Beta package: **PASS**.

Local ad-hoc Beta package PASS

Public distribution NOT CLAIMED
