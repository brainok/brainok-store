# Architecture

## Runtime flow

```text
Brainok macOS App
  -> Public DMG download, no login required
  -> First launch stores trial start locally, preferably in Keychain
  -> 30-day trial
  -> User enters Brainok license after trial
  -> Callable Function: activateBrainokLicense
  -> Firestore /licenses/{licenseCode}
  -> Firestore /activations/{licenseId-deviceHash}
  -> App stores local license and works offline

Netlify Website
  -> Public app listings and DMG links
  -> Admin Auth
  -> Callable Functions: createLicense, listLicenses, resetLicenseDevice, disableLicense
  -> Firestore /licenses and /activations

Future Toss Payments
  -> Payment Success
  -> Webhook
  -> Generate License
  -> Save to Firestore
  -> Send Email
```

## Trust boundary

- The DMG is always public. Do not protect the download; protect software use after the trial.
- The app may cache a successful license for offline use, but initial activation must be verified by Firebase.
- Firestore `/licenses` and `/activations` are the license source of truth.
- Clients cannot directly read or write license documents; they use callable functions.
- Clients cannot write `accountRole`, `accessStatus`, `deviceLimit`, or `inviteQuota`.
- Admin-only publishing is controlled by the single admin email `brainok777@gmail.com`.
- The backend normalizes every other email to `/users/{uid}.accountRole == "user"`.
- Invite quota controls how many codes an admin can create; it does not grant admin access by itself.
- Webhooks are accepted only after `X-Signature` verification.

## Universal Brainok license

One Brainok license unlocks all Brainok apps:

- PageWheel
- Clipboard
- Hotkey Launcher
- Future Brainok apps

The Friend / Severance shared code is `BRAINOK-SEVERANCE-2026`, configured as a
`friend` plan with 50 devices.

## Deployable services

- Desktop: macOS apps with local trial/license storage, preferably Keychain.
- Web: React + Vite, deployed to Netlify.
- Backend: Firebase Auth, Firestore, Functions, Storage.
- Payment: future Toss Payments webhook for automatic license generation.
