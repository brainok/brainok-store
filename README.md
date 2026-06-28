# Brainok Lemon SaaS Starter

This repository is structured for a real desktop app release:

- `app-electron`: Electron desktop app with Firebase Auth, invite-gated access, device registration, donation links, and updater hooks.
- `web-netlify`: React + Vite website for support, invite access, download, and account management.
- `firebase-functions`: Firebase Functions for invite codes, Lemon Squeezy donation webhooks, checkout links, and device limits.
- `shared-types`: Shared TypeScript contracts used by the app, website, and functions.
- `docs`: Deployment and operational runbooks.

## Source of truth

Firestore is the account, invite-access, and support-status source of truth. New users start as `accessStatus: "pending"` and must redeem an invite code before using the early desktop build. Donations never unlock access by themselves.

## First setup

1. Create a Firebase project, then enable Auth, Firestore, Functions, and Storage.
2. Copy `.firebaserc.example` to `.firebaserc` and set your real project id.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Add Firebase client config to `app-electron/.env` and `web-netlify/.env`.
5. Add the Lemon Squeezy checkout URL and QnA SMTP settings to `firebase-functions/.env`.
6. Set the webhook signing secret and QnA email app password:

   ```bash
   npx firebase functions:secrets:set LEMONSQUEEZY_WEBHOOK_SECRET
   npx firebase functions:secrets:set QNA_SMTP_PASSWORD
   ```

7. Deploy rules and functions:

   ```bash
   npm run deploy:rules
   npm run deploy:functions
   ```

## Lemon Squeezy webhook

Configure the webhook URL from the deployed function and subscribe to:

- `order_created`
- `order_refunded`

The function verifies Lemon Squeezy's `X-Signature` HMAC-SHA256 header against the raw request body before touching Firestore.

## Useful docs

- Lemon Squeezy webhook signing: https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- Lemon Squeezy event types: https://docs.lemonsqueezy.com/help/webhooks/event-types
- Lemon Squeezy checkout custom data: https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
- Firebase HTTP functions: https://firebase.google.com/docs/functions/http-events
