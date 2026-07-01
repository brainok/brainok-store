# Release Checklist

## Before beta

- Firebase Auth providers are enabled.
- Firestore rules are deployed.
- Storage rules are deployed.
- `QNA_SMTP_PASSWORD` is set so new app questions email the admin.
- Admin can generate a Brainok license.
- `activateBrainokLicense` activates a test device.
- Device limit blocks an extra machine.
- Admin can reset a device activation.
- Admin can disable a license.
- Invite creation and redemption both work.
- A new user starts with `accessStatus: "pending"` and has no app access until app-specific invite redemption.
- A new user starts with `accountRole: "user"` and cannot see admin publishing tools.
- The only admin account is `brainok777@gmail.com` and has `accountRole: "admin"`.
- Each Electron build has the correct `VITE_BRAINOK_APP_ID`.

## macOS

- Apple Developer account is active.
- Developer ID certificate is installed.
- `electron-builder` notarization credentials are configured in CI.
- DMG is notarized and stapled.

## Windows

- NSIS installer builds correctly.
- SmartScreen warning is expected until code signing reputation improves.
- Add EV or OV code signing before a public paid launch.

## Website

- Netlify production deploy is connected to the Git repository.
- Firebase Auth authorized domains include the Netlify domain.
- Admin can edit homepage text from `Apps -> Site settings`.
- License tab explains free download, 30-day trial, Brainok License, and offline use.
- Download links point to the current GitHub Release.
- Private GitHub release links are only usable by GitHub collaborators.
