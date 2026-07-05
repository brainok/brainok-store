# Brainok Store

This repository is structured for a real desktop app release:

- `app-electron`: Desktop app shell with Firebase integration, trial state, device registration, licensing, and updater hooks.
- `web-netlify`: React + Vite website for app listings, free downloads, Brainok License guidance, and account management.
- `firebase-functions`: Firebase Functions for app publishing, Brainok license management, QnA email, and device limits.
- `shared-types`: Shared TypeScript contracts used by the app, website, and functions.
- `docs`: Deployment and operational runbooks.

## Source of truth

Firestore is the account, app listing, license, and activation source of truth. Public DMG downloads stay free. Desktop apps use a 30-day trial, then a universal Brainok license unlocks continued use.

## First setup

1. Create a Firebase project, then enable Auth, Firestore, Functions, and Storage.
2. Copy `.firebaserc.example` to `.firebaserc` and set your real project id.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Add Firebase client config to `app-electron/.env` and `web-netlify/.env`.
5. Add Firebase client config and QnA SMTP settings to `firebase-functions/.env`.
6. Set the QnA email app password:

   ```bash
   npx firebase functions:secrets:set QNA_SMTP_PASSWORD
   ```

7. Set the Resend API key for license email delivery tests:

   ```bash
   npx firebase functions:secrets:set RESEND_API_KEY
   ```

   Optional: set `RESEND_FROM_EMAIL="Brainok Licensing <licenses@brainok.net>"` and `RESEND_REPLY_TO_EMAIL=brainok777@gmail.com` in `firebase-functions/.env` after verifying the sending domain in Resend.

   To send a safe local test email only to `brainok777@gmail.com`:

   ```bash
   RESEND_API_KEY=... npm run test:license-email
   ```

8. Deploy rules and functions:

   ```bash
   npm run deploy:rules
   npm run deploy:functions
   ```

## Licensing

Admins can create manual Brainok licenses from the web admin account. When a
buyer email is provided, the same action saves the license to Firestore, sends
the activation code through Resend, and records the email status for retry.
Desktop apps call `activateBrainokLicense` once, store the successful local
license, and then run offline.

## Useful docs

- Payment provider architecture: `docs/payment-provider.md`
- App Firebase activation integration: `README_APP_ACTIVATION_INTEGRATION.md`
- App public release repo workflow: `README_APP_RELEASE_REPO_WORKFLOW.md`
- Firebase HTTP functions: https://firebase.google.com/docs/functions/http-events
