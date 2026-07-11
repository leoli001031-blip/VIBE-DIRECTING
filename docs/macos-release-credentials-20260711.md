# macOS Release Credentials And Verification

> Optional future public-distribution guide. Developer ID signing, notarization,
> and Gatekeeper acceptance are not part of the current local-only product gate.

## Current Machine State

- Available identity: `Apple Development: 8618552681031 (83CKM5U692)`
- Missing identity: `Developer ID Application`
- Notarization credentials: not configured
- Local package: ad-hoc signed; valid structurally, rejected by Gatekeeper

`Apple Development` is not a substitute for `Developer ID Application` distribution signing.

## Required Signing Identity

Import a valid Developer ID Application certificate and private key into a keychain in the user keychain search list. Verify it with:

```sh
security find-identity -v -p codesigning
```

The output must contain `Developer ID Application:`. `CSC_LINK` may instead provide an exported certificate to electron-builder in CI.

## Notarization Options

Use exactly one complete strategy. Partial variables from a higher-priority strategy intentionally fail preflight.

### App Store Connect API Key

```sh
export APPLE_API_KEY=/absolute/path/to/AuthKey_KEYID.p8
export APPLE_API_KEY_ID=KEYID
export APPLE_API_ISSUER=ISSUER_UUID
```

### Apple ID And App-Specific Password

```sh
export APPLE_ID=account@example.com
export APPLE_APP_SPECIFIC_PASSWORD=app-specific-password
export APPLE_TEAM_ID=TEAMID
```

### Stored notarytool Profile

Create the profile outside the repository:

```sh
xcrun notarytool store-credentials vibe-director-notary \
  --apple-id account@example.com \
  --team-id TEAMID \
  --password app-specific-password
export APPLE_KEYCHAIN_PROFILE=vibe-director-notary
```

`APPLE_KEYCHAIN` is optional and is only needed when the profile is stored in a non-default keychain.

## Release Commands

```sh
npm run package:release:preflight
npm run package:release:mac
```

The release command now performs these gates in order:

1. Release contract and entitlement validation.
2. Developer ID and notarization credential preflight.
3. Application build.
4. Developer ID signing with hardened runtime and explicit Electron entitlements.
5. electron-builder notarization and stapling.
6. Post-build checks for Developer ID authority, Team ID, hardened runtime, entitlements, stapling, Gatekeeper acceptance, and DMG integrity.
7. Read-only mount of the final DMG followed by the same signature, stapling, and Gatekeeper checks against the enclosed App.

Do not store certificate exports, `.p8` files, Apple passwords, or keychain credentials in this repository.
