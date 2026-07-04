# Brainok Universal License System

## Purpose

Brainok Store is the public download site for all Brainok applications. Downloads must remain free, with no login, email, or payment required.

The license system starts only after each app's 30-day fully functional trial. One Brainok License should activate every Brainok application:

- Brainok Clipboard
- PageWheel
- Hotkey Launcher
- Multiple File Viewer
- Future macOS apps
- Future Windows apps

## Core Rules

- Never protect the DMG, ZIP, EXE, or installer download.
- Protect continued use inside the application after the trial period.
- Activation requires Internet once.
- After successful activation, the application must work completely offline.
- Device limits are server data in Firebase, not constants compiled into apps.
- macOS and Windows apps use the same licensing protocol and Firestore records.
- Existing shared activation codes and signed activation codes must continue working.

## Current Project Fit

The current repo already contains the first layer of this architecture:

- `web-netlify`: public store, downloads, account/admin views.
- `firebase-functions`: callable functions for app management, license creation, activation, reset, and disabling.
- `shared-types`: shared TypeScript contracts.
- `firestore.rules`: client access rules that block direct license and activation writes.
- Existing admin email: `brainok777@gmail.com`.

The implementation should evolve from the current code instead of replacing it all at once.

## Trust Boundary

```text
Public Store
  -> Free downloads
  -> No license checks

Desktop App
  -> Local 30-day trial
  -> Shows activation UI after trial
  -> Calls Firebase only for first activation or optional online checks
  -> Stores signed local activation cache

Firebase Functions
  -> Validates license code
  -> Enforces license status and device limit
  -> Creates activation record
  -> Returns signed activation payload

Firestore
  -> Source of truth for licenses, plans, activations, payments, support records
```

Clients must not directly read or write `/licenses`, `/activations`, `/payments`, or admin-only fields. Desktop apps talk to callable or HTTPS functions. Admin tools talk to callable functions.

## License Lifecycle

1. User downloads any Brainok app for free from `https://store.brainok.net`.
2. First launch starts a local 30-day full-feature trial.
3. During trial, no account, email, payment, or activation is required.
4. After the trial, the app asks for a Brainok License code.
5. The app sends license code, app metadata, OS, app version, and a stable device identifier to Firebase.
6. Firebase validates:
   - code exists
   - license is active
   - plan is valid
   - device limit has not been exceeded
   - this app is allowed by `allowedApps`
7. Firebase creates or reuses an activation for that license-device pair.
8. Firebase returns an activation payload.
9. The app stores the activation payload locally in a tamper-resistant location.
10. The app works offline after successful activation.

## App-Side Requirements

Every Brainok desktop app should implement the same client-side adapter:

- Trial store:
  - first launch timestamp
  - trial start source
  - trial end timestamp
  - app version
- Device identity:
  - stable per-machine device ID
  - hashed before storing server-side when possible
  - no macOS-only assumptions
- Activation API client:
  - `activateBrainokLicense`
  - `checkBrainokLicense` for optional support diagnostics
- Offline activation cache:
  - signed server payload
  - license ID
  - license code fingerprint, not necessarily full plain code
  - plan
  - activated device ID
  - activated apps or wildcard
  - issued timestamp
  - optional expiry timestamp
- Compatibility adapter:
  - existing shared activation codes
  - existing signed activation code verifier

Recommended local storage:

- macOS: Keychain plus local app support file for non-secret metadata.
- Windows: Windows Credential Manager or DPAPI-protected file.
- Cross-platform fallback: encrypted or signed local JSON with clear tamper detection.

## Server-Side License Model

One `/licenses/{licenseCode}` document represents one universal Brainok License. It should not be app-specific by default.

Important fields:

- `licenseId`: stable non-secret ID derived from the code.
- `licenseCode`: normalized code.
- `status`: `active`, `disabled`, `expired`, or `refunded`.
- `plan`: `personal`, `pro`, `lab`, or compatibility-specific plan.
- `maxDevices`: copied from Firebase plan configuration at issue time.
- `allowedApps`: usually `["*"]`.
- `emailLower`: optional owner/supporter email.
- `source`: `manual`, `toss`, `legacy`, `migration`, or `support`.
- `activationCount`: derived or maintained by transaction.

## License Plans

Plan limits must come from Firebase configuration, not app code.

Recommended plan records:

| Plan | Default Device Limit | Use Case |
| --- | ---: | --- |
| `personal` | 3 | Individual user |
| `pro` | 5 | Power user or small office |
| `lab` | 20+ | Clinic, lab, team, institution |

The existing `friend` or shared-code plan may remain for compatibility and controlled supporter distribution, but it should not become the public commercial default.

## Universal Activation

Activation should be per license-device pair, not per app-device pair. This prevents one user from consuming multiple device seats just because they use several Brainok apps on the same computer.

Recommended activation ID:

```text
{licenseId}-{deviceIdHash}
```

Each activation can record app usage as metadata:

```json
{
  "appsSeen": {
    "brainok-clipboard": {
      "firstActivatedAt": "timestamp",
      "lastSeenAt": "timestamp",
      "appVersion": "1.0.0"
    },
    "pagewheel": {
      "firstActivatedAt": "timestamp",
      "lastSeenAt": "timestamp",
      "appVersion": "1.0.0"
    }
  }
}
```

This makes one device count once across all apps.

## Backward Compatibility

Compatibility is a hard requirement.

Existing shared activation codes must continue working:

```text
BRAINOK-SEVERANCE-2026
XJD2-FBYT-F6QA
```

Existing signed activation codes must continue working.

Migration strategy:

- Keep existing app-specific activation functions until every shipped app has a universal-license update.
- Add universal license handling as a new path, not a replacement path.
- Normalize old shared codes into compatibility license documents when possible.
- Keep local signed-code verification in apps for already-issued signed codes.
- Prefer server-side mapping from legacy code to universal license behavior for new activations.
- Never revoke a user's working activation just because the backend model changed.

## Compatibility Decision Matrix

| Input Type | New Behavior |
| --- | --- |
| New Brainok License | Validate with `/licenses` and create universal activation |
| `BRAINOK-SEVERANCE-2026` | Preserve as shared compatibility license |
| `XJD2-FBYT-F6QA` | Preserve as shared compatibility license or legacy mapping |
| Existing signed activation code | Verify with existing app verifier, then optionally migrate silently |
| Existing local activated state | Continue accepting until the app naturally refreshes or user resets |

## Security Principles

- Store only hashed device identifiers in lookup fields.
- Never expose full license collections to clients.
- Use transactions for device limit checks.
- Make activation idempotent for the same license and device.
- Use server-generated timestamps.
- Return only what the app needs for offline use.
- Sign the activation response so the app can validate it without Internet.
- Version every activation payload.
- Record audit events for admin and payment actions.

## Recommended Activation Payload

```json
{
  "schemaVersion": 1,
  "licenseId": "lic_abc123",
  "licenseCodeHash": "sha256",
  "plan": "pro",
  "allowedApps": ["*"],
  "deviceIdHash": "sha256",
  "status": "active",
  "issuedAt": "2026-07-04T00:00:00.000Z",
  "expiresAt": null,
  "signature": "server-signature"
}
```

The app should verify the signature before trusting the local cache.

## Administration

The admin identity remains:

```text
brainok777@gmail.com
```

Admin tools must support:

- create license
- disable license
- reset device activation
- search supporters by email, name, license code, payment ID, or device
- resend license email
- view activation history
- view payment history
- create support note

## Near-Term Implementation Direction

The current repo already has `createLicense`, `listLicenses`, `disableLicense`, `resetLicenseDevice`, `activateBrainokLicense`, and `checkBrainokLicense`. The next production step is not a redesign. It is to harden the existing flow:

- move plan limits into Firebase config
- make activations count unique devices across apps
- add signed activation payloads
- add compatibility mappings for old codes
- add payment and email records without changing free downloads
- add admin audit logs
