# Vibe Director Studio P11-C local Beta package

Date: 2026-07-20

Status: **PASS**.

P11-C produced and verified a local macOS arm64 Beta package using the existing
Electron packaging architecture. The package is ad-hoc signed, is not
notarized, and is not presented as a public release.

## Artifacts

The generated local artifacts are under `release/` and are described by
`release/p11-local-beta/release-manifest.json`.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Vibe Director Studio-0.0.1-arm64.dmg` | 119172413 bytes | `e32d680a55c3ee1819c8dc8cb96bd2573f2e770d5572027d2c5a45dce9cce764` |
| `Vibe Director Studio-0.0.1-arm64-mac.zip` | 115207993 bytes | `24fa1efc291977c53d88dd0f1271ae790ad052ed743ea6de53e3418205ee792f` |

The generated example project contains two planned shots, no credentials, and
no media. Its `project.vibe` SHA-256 is
`30f879da602430c48a92312e62e8eb040d139e86e6090fd632769bcfc3d33a74`.

## Diagnostic export

The existing Settings shell now includes one `Export diagnostics` action. The
Electron main process writes a ZIP selected by the user. Packaged acceptance
uses an authenticated test-only `/tmp` destination and cannot widen normal file
access.

The bundle includes:

- application version, platform, and architecture;
- a bounded runtime log and recent error list;
- structural status and count summaries for known sidecars;
- a privacy declaration and a short support README.

The bundle excludes credentials, tokens, complete project files, media, media
filenames, and unredacted absolute paths. ZIP creation uses the fixed
`/usr/bin/ditto` executable with shell execution disabled.

## Packaged verification

The P11-C packaging acceptance performed all of the following with zero
Provider calls:

1. Verified the unpacked App with `codesign --verify --deep --strict` and
   confirmed `Signature=adhoc`.
2. Verified the DMG with `hdiutil verify`.
3. Extracted the generated ZIP into a fresh `/tmp` directory.
4. Re-verified the extracted App signature and launched that extracted App.
5. Opened the copied two-shot sample project.
6. Exported and extracted a diagnostic ZIP from the packaged App.
7. Confirmed all five diagnostic privacy flags were `false` for included
   sensitive material.

Repository evidence:

- `docs/evidence/p11-c-local-beta-package-20260720/release-summary.json`
- ignored build evidence: `release/p11-local-beta/evidence/packaged-acceptance.json`

## Support material

The ignored release bundle contains:

- `README.md`
- `BACKUP-UPGRADE-ROLLBACK.md`
- `KNOWN-LIMITATIONS.md`
- `example-project/`
- `release-manifest.json`

The limitations explicitly retain the P11-B failed-canary boundary. Real video
Provider execution remains unverified.

## Gate

The package is suitable for local internal Beta observation. Gatekeeper may
show an unidentified-developer warning because there is no Developer ID or
notarization. This is expected for this scope.

Local ad-hoc Beta package PASS

Public distribution NOT CLAIMED
