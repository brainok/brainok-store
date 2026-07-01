# Brainok Lemon SaaS Starter

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

7. Deploy rules and functions:

   ```bash
   npm run deploy:rules
   npm run deploy:functions
   ```

## Licensing

Admins can generate, search, disable, and reset Brainok licenses from the web
admin account. Desktop apps call `activateBrainokLicense` once, store the
successful local license, and then run offline.

## Useful docs

- Firebase HTTP functions: https://firebase.google.com/docs/functions/http-events
