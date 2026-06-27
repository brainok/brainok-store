# Release Checklist

## Before beta

- Firebase Auth providers are enabled.
- Firestore rules are deployed.
- Storage rules are deployed.
- `LEMONSQUEEZY_WEBHOOK_SECRET` is set.
- Lemon Squeezy webhook receives a test event.
- A test donation updates `/users/{uid}` to `supporterStatus: "supporter"`.
- A refund records `supporterStatus: "refunded"` and does not change app access.
- Device limit blocks an extra machine.
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
- Pricing page opens the Lemon Squeezy checkout.
- Download links point to the current GitHub Release.
- Private GitHub release links are only usable by GitHub collaborators.
- External paid-user downloads should use Firebase Storage or R2 temporary URLs.
