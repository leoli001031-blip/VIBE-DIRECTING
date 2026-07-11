# Agent-first P4 Packaged / Release Audit - 2026-07-11

## Scope

This audit used the real packaged Electron app without a frontend dev server. Image and video provider credentials were intentionally absent, so reference and video actions exercised the shared dry-run contract and incurred no external calls or cost.

## Real Packaged Main Chain

Final isolated run: `/tmp/vibe-director-p4-gui-r3-uLCyaD`

1. New-video request produced a two-shot local draft.
2. “确认这版故事” preserved both shots and advanced to “选择保存位置”.
3. The native save panel created `p4-agent-first-final` under the isolated project root.
4. Reference confirmation disclosed dry-run before confirmation; execution recorded `providerCalled=false` and zero outputs.
5. Video confirmation disclosed dry-run before confirmation; execution recorded `providerCalled=false` and zero outputs.
6. Export remained behind an explicit confirmation, then wrote `exports/current-project` with 12 manifest/report files.
7. Cold restart restored two shots, missing references, ungenerated video, cleared staged plan, and one passive “等你指令” current task.

Result: pass.

## Bugs Closed During P4

### Video plan downgraded after reference dry-run

Root cause: `MinimalAgentPanel` used effective reference counts, while `App.stagePrototypeAgentPlan` reran the Product Agent Loop without those overrides. The persisted plan therefore used raw missing assets and blocked video submission.

Minimal fix: propagate `referenceReadyCount`, `referenceReviewCount`, and `referenceMissingCount` through `RunDirectorProductAgentLoopInput`, Agent panel stage/preview inputs, and App stage/confirm paths. Regression coverage was added to the Product Agent Loop and minimal Agent contracts.

### Dry-run confirmation claimed a real provider call

Root cause: confirmation copy was derived from the action's nominal provider facts, while the adapter selected dry-run only after confirmation.

Minimal fix: derive the confirmation display mode from the same configured callback/key/readiness gates used by confirmed execution. Dry-run cards now state local contract validation, no real provider call, and no real output before the user confirms.

## Security

Passed:

- `electron-security-policy:test`
- `electron-project-scope:test`
- `electron-runtime-token:test`
- `runtime-api-boundary:test`
- `project-root-dialog:test`
- `packaged-launch-contract:test`

Coverage includes trusted main-frame IPC, guarded navigation/new windows, canonical project roots, file and directory symlink escape, not-yet-created targets below escaping parents, random per-launch Runtime token, and packaged token rejection/acceptance.

## Dependencies And Icon

- `npm audit` before fix: 2 high, 2 moderate transitive vulnerabilities.
- Non-force `npm audit fix`: upgraded safe transitive patch versions.
- `npm audit` after fix: 0 vulnerabilities.
- Added `build/icon.svg` and `build/icon.icns`.
- Packaged `Resources/icon.icns` matches the source ICNS hash, and the default Electron icon warning is gone.

## Final Regression Gates

Passed:

- `npm run demo:ready:test`
- `npm run package:smoke`
- `npm run package:smoke:gui`
- `npx tsc --noEmit --pretty false`
- `npm audit --audit-level=low`
- `git diff --check`

No packaged App process remained after the GUI smoke.

The local ad-hoc DMG `release/Vibe Director Studio-0.0.1-arm64.dmg` was also generated and checked directly:

- `hdiutil verify`: valid checksum.
- Read-only mount: succeeded.
- Enclosed App deep signature structure: valid.
- Enclosed icon and bundle identifier: correct.
- Enclosed App Gatekeeper result: rejected as expected for ad-hoc signing.

## Deferred Public Distribution

On 2026-07-11, the product owner explicitly removed Developer ID, notarization,
and Gatekeeper distribution acceptance from the current local-product scope.
They remain optional future release work and do not block packaged App acceptance
or Product Design / ImageGen implementation.

Local keychain state:

- Available: `Apple Development: 8618552681031 (83CKM5U692)`
- Missing: Developer ID Application identity
- Missing: supported Apple notarization credentials

Current consequences:

- Local ad-hoc package passes `codesign --verify --deep --strict`.
- `package:release:preflight` fails as designed.
- `spctl -a -vv --type execute` rejects the ad-hoc package.

The release path itself is now closed under a no-secret contract test:

- Hardened runtime and root/inherited Electron entitlements are explicit.
- Release notarization is explicit and cannot silently skip.
- Credential preflight mirrors electron-builder's Apple ID, API key, and keychain-profile priority.
- Incomplete higher-priority credentials fail closed.
- `package:release:mac` verifies Developer ID authority, Team ID, hardened runtime, entitlements, stapling, Gatekeeper, and DMG integrity after packaging, then mounts the DMG read-only and repeats the App checks against its enclosed copy.
- Credential setup is documented in `docs/macos-release-credentials-20260711.md`.

## Decision

P4 passes under the approved local-only acceptance scope. Functional packaged
behavior, recovery, security, dependencies, the local DMG, and design-handoff
evidence all pass. Public macOS distribution remains intentionally unsupported
until Developer ID and notarization credentials are provided, but it is not a
current product blocker. Product Design / ImageGen implementation may proceed
without changing the confirmation, execution-truth, or recovery contracts in
this audit.
