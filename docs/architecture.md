# Architecture

## Runtime flow

```text
Electron App
  -> Firebase Auth
  -> Callable Function: ensureUserProfile
  -> Callable Function: registerDevice
  -> Firestore /users/{uid}
  -> Invite access and donation/supporter status displayed from Firestore

Netlify Website
  -> Firebase Auth
  -> Callable Function: createCheckout
  -> Lemon Squeezy Checkout
  -> Lemon Squeezy Webhook
  -> Firebase Function: lemonsqueezyWebhook
  -> Firestore /users/{uid}
```

## Trust boundary

- The app may cache UI state, but it must not decide account or supporter state locally.
- Firestore user fields are the account/access/support source of truth.
- Clients cannot write `accountRole`, `accessStatus`, `supporterStatus`, `donationTotalCents`, `deviceLimit`, or `inviteQuota`.
- Admin-only publishing is controlled by the single admin email `brainok777@gmail.com`.
- The backend normalizes every other email to `/users/{uid}.accountRole == "user"`.
- Invite quota controls how many codes an admin can create; it does not grant admin access by itself.
- Webhooks are accepted only after `X-Signature` verification.

## Deployable services

- Desktop: Electron, electron-builder, electron-updater.
- Web: React + Vite, deployed to Netlify.
- Backend: Firebase Auth, Firestore, Functions, Storage.
- Payment: Lemon Squeezy pay-what-you-want checkout and webhooks.
