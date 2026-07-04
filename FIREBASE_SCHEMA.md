# Firebase Schema

## Design Goals

- One universal Brainok License for every Brainok application.
- Free downloads without login.
- Internet required only once for activation.
- Offline use after activation.
- Device limits configured in Firebase.
- Compatibility with existing shared and signed activation codes.
- Future Toss Payments automation.
- Admin support through `brainok777@gmail.com`.

Official Firestore rules and data modeling references:

- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/security/rules-structure
- https://firebase.google.com/docs/firestore/best-practices

## Collection Overview

```text
/site/public
/users/{uid}
/apps/{appId}
/licensePlans/{planId}
/licenses/{licenseCode}
/activations/{activationId}
/payments/{paymentId}
/orders/{orderId}
/supportTickets/{ticketId}
/licenseEmails/{emailJobId}
/adminAuditLogs/{auditId}
/webhookEvents/{eventId}
/legacyActivationCodes/{code}
/activationCodes/{code}
/sharedAccessCodes/{code}
```

## `/site/public`

Public site settings for Brainok Store.

```json
{
  "brandName": "Brainok Store",
  "downloadTitle": "Download Brainok Store",
  "downloadBody": "Free download. No account required.",
  "supportEmail": "brainok777@gmail.com",
  "updatedAt": "serverTimestamp"
}
```

Read:

- public

Write:

- admin function only

## `/users/{uid}`

User records are for admin/support workflows and optional signed-in support. Downloads do not require user records.

```json
{
  "uid": "firebase-auth-uid",
  "email": "supporter@example.com",
  "emailLower": "supporter@example.com",
  "displayName": "Supporter Name",
  "accountRole": "user",
  "supporterStatus": "none",
  "primaryLicenseId": "lic_abc123",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "lastLoginAt": "serverTimestamp"
}
```

Admin user:

```json
{
  "emailLower": "brainok777@gmail.com",
  "accountRole": "admin"
}
```

Only `brainok777@gmail.com` should resolve as admin. Backend functions should normalize all other accounts to `user`.

## `/apps/{appId}`

Public catalog and download metadata.

```json
{
  "appId": "brainok-clipboard",
  "name": "Brainok Clipboard",
  "slug": "brainok-clipboard",
  "status": "active",
  "visibility": "public",
  "platforms": ["mac", "windows"],
  "licenseMode": "universal",
  "trialDays": 30,
  "downloads": {
    "macUrl": "https://...",
    "windowsUrl": "https://...",
    "releaseUrl": "https://...",
    "latestVersion": "1.0.0"
  },
  "media": {
    "iconUrl": "https://...",
    "thumbnailUrl": "https://...",
    "videoUrl": "https://..."
  },
  "supportContent": "Install notes and troubleshooting",
  "supportContentKo": "Korean install notes and troubleshooting",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Read:

- public if `visibility == "public"`
- admin for all apps

Write:

- admin function only

## `/licensePlans/{planId}`

Plan configuration. Apps must not hardcode these limits.

```json
{
  "planId": "personal",
  "name": "Personal",
  "status": "active",
  "defaultMaxDevices": 3,
  "minDevices": 1,
  "maxDevices": 3,
  "allowedApps": ["*"],
  "trialDays": 30,
  "price": {
    "currency": "KRW",
    "amount": 99000
  },
  "sortOrder": 10,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Recommended plan documents:

```text
personal -> defaultMaxDevices 3
pro -> defaultMaxDevices 5
lab -> defaultMaxDevices 20, maxDevices 1000
friend -> compatibility/shared distribution only
```

Read:

- public or app client may read if no sensitive pricing is included

Write:

- admin function only

## `/licenses/{licenseCode}`

Universal Brainok License source of truth.

```json
{
  "licenseId": "lic_sha256prefix",
  "licenseCode": "BRAINOK-PRO-ABCD-1234",
  "licenseCodeHash": "sha256",
  "email": "supporter@example.com",
  "emailLower": "supporter@example.com",
  "ownerUid": null,
  "plan": "pro",
  "status": "active",
  "maxDevices": 5,
  "activationCount": 1,
  "allowedApps": ["*"],
  "source": "manual",
  "paymentId": null,
  "legacyCode": false,
  "notes": "",
  "issuedAt": "serverTimestamp",
  "expiresAt": null,
  "disabledAt": null,
  "disabledReason": null,
  "createdByUid": "admin-uid",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Valid `status` values:

```text
active
disabled
expired
refunded
```

Valid `source` values:

```text
manual
toss
legacy
migration
support
```

Client access:

- no direct read
- no direct write

All reads/writes go through functions.

## `/activations/{activationId}`

One active record per license-device pair. This should count one device once across all Brainok apps.

```json
{
  "activationId": "lic_sha256prefix-devicehash",
  "licenseId": "lic_sha256prefix",
  "licenseCode": "BRAINOK-PRO-ABCD-1234",
  "licenseCodeHash": "sha256",
  "deviceIdHash": "sha256",
  "deviceLabel": "Hyosuk MacBook Pro",
  "status": "active",
  "source": "brainok_license",
  "os": "mac",
  "platform": "darwin",
  "firstAppId": "pagewheel",
  "firstAppName": "PageWheel",
  "appsSeen": {
    "pagewheel": {
      "firstSeenAt": "serverTimestamp",
      "lastSeenAt": "serverTimestamp",
      "appVersion": "1.0.0"
    }
  },
  "activatedAt": "serverTimestamp",
  "lastCheckedAt": "serverTimestamp",
  "resetAt": null,
  "revokedAt": null,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Valid `status` values:

```text
active
reset
revoked
```

Client access:

- no direct read
- no direct write

## `/payments/{paymentId}`

Payment provider record. Used for manual and Toss payments.

```json
{
  "paymentId": "pay_abc123",
  "provider": "toss",
  "providerPaymentKey": "toss-payment-key",
  "providerOrderId": "order-id",
  "orderId": "brn_20260704_abc123",
  "status": "paid",
  "plan": "personal",
  "amount": 99000,
  "currency": "KRW",
  "buyerEmail": "supporter@example.com",
  "buyerEmailLower": "supporter@example.com",
  "licenseId": "lic_sha256prefix",
  "licenseCode": "BRAINOK-PERSONAL-ABCD-1234",
  "rawProviderStatus": "DONE",
  "paidAt": "serverTimestamp",
  "refundedAt": null,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Valid `provider` values:

```text
manual
toss
legacy_lemonsqueezy
```

Valid `status` values:

```text
created
pending
paid
paid_needs_license
refunded
partially_refunded
failed
cancelled
chargeback
```

Client access:

- user may read own payment only if signed in and matched by `uid`
- admin through functions
- no direct writes

## `/orders/{orderId}`

Checkout/order intent created before Toss payment confirmation.

```json
{
  "orderId": "brn_20260704_abc123",
  "provider": "toss",
  "plan": "personal",
  "amount": 99000,
  "currency": "KRW",
  "buyerEmail": "supporter@example.com",
  "buyerEmailLower": "supporter@example.com",
  "status": "created",
  "checkoutSession": {
    "successUrl": "https://store.brainok.net/payment/success",
    "failUrl": "https://store.brainok.net/payment/fail"
  },
  "paymentId": null,
  "licenseId": null,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## `/supportTickets/{ticketId}`

Support workflow for license requests, activation help, general support, and supporter questions.

```json
{
  "ticketId": "ticket_abc123",
  "type": "activation_help",
  "status": "open",
  "priority": "normal",
  "email": "user@example.com",
  "emailLower": "user@example.com",
  "subject": "Activation help",
  "message": "I reached my device limit.",
  "appId": "pagewheel",
  "appName": "PageWheel",
  "licenseCode": "BRAINOK-PRO-ABCD-1234",
  "licenseId": "lic_sha256prefix",
  "deviceIdHash": "sha256",
  "assignedTo": "brainok777@gmail.com",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "closedAt": null
}
```

Subcollection:

```text
/supportTickets/{ticketId}/messages/{messageId}
```

Message document:

```json
{
  "messageId": "msg_abc123",
  "senderRole": "user",
  "senderEmail": "user@example.com",
  "body": "Message text",
  "isInternalNote": false,
  "createdAt": "serverTimestamp"
}
```

Valid `type` values:

```text
license_request
activation_help
general_support
supporter_question
payment_help
```

## `/licenseEmails/{emailJobId}`

Email delivery and resend tracking.

```json
{
  "emailJobId": "email_abc123",
  "type": "license_delivery",
  "status": "sent",
  "to": "supporter@example.com",
  "replyTo": "brainok777@gmail.com",
  "licenseId": "lic_sha256prefix",
  "licenseCode": "BRAINOK-PRO-ABCD-1234",
  "paymentId": "pay_abc123",
  "attemptCount": 1,
  "lastError": null,
  "sentAt": "serverTimestamp",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Valid `status` values:

```text
queued
sending
sent
failed
cancelled
```

## `/adminAuditLogs/{auditId}`

Immutable admin action logs.

```json
{
  "auditId": "audit_abc123",
  "actorUid": "admin-uid",
  "actorEmail": "brainok777@gmail.com",
  "action": "license.disable",
  "targetType": "license",
  "targetId": "lic_sha256prefix",
  "summary": "Disabled license after refund",
  "metadata": {
    "reason": "refund"
  },
  "createdAt": "serverTimestamp"
}
```

Do not expose direct client writes.

## `/webhookEvents/{eventId}`

Idempotency store for Toss and legacy provider webhooks.

```json
{
  "eventId": "sha256",
  "provider": "toss",
  "eventType": "payment.approved",
  "providerEventId": "provider-event-id",
  "paymentId": "pay_abc123",
  "orderId": "brn_20260704_abc123",
  "processed": true,
  "processedAt": "serverTimestamp",
  "createdAt": "serverTimestamp"
}
```

## `/legacyActivationCodes/{code}`

Compatibility mapping for old shared and signed activation systems.

```json
{
  "code": "XJD2-FBYT-F6QA",
  "type": "shared",
  "status": "active",
  "mapsToLicenseCode": "XJD2-FBYT-F6QA",
  "allowedApps": ["*"],
  "maxDevices": 50,
  "notes": "Legacy shared code preserved for compatibility",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Required compatibility codes:

```text
BRAINOK-SEVERANCE-2026
XJD2-FBYT-F6QA
```

Existing `/activationCodes/{code}` and `/sharedAccessCodes/{code}` may remain while older apps depend on them.

## Indexes

Recommended Firestore indexes:

- `/licenses`: `emailLower ASC, createdAt DESC`
- `/licenses`: `licenseId ASC`
- `/licenses`: `status ASC, createdAt DESC`
- `/activations`: `licenseId ASC, status ASC`
- `/activations`: `deviceIdHash ASC, status ASC`
- `/payments`: `buyerEmailLower ASC, createdAt DESC`
- `/payments`: `providerOrderId ASC`
- `/payments`: `providerPaymentKey ASC`
- `/supportTickets`: `emailLower ASC, createdAt DESC`
- `/supportTickets`: `status ASC, updatedAt DESC`
- `/webhookEvents`: `provider ASC, providerEventId ASC`

## Security Rules Direction

Keep direct client access narrow:

- public can read public site and public app metadata
- signed-in users can read their own profile
- admins use callable functions for all sensitive actions
- `/licenses`, `/activations`, `/payments`, `/orders`, `/licenseEmails`, `/adminAuditLogs`, and `/webhookEvents` are server-only

Cloud Functions/Admin SDK can bypass Firestore rules, so all authorization checks must also live in functions.
