# Firestore Schema

## `/users/{uid}`

Only `brainok777@gmail.com` should have `"accountRole": "admin"`.

```json
{
  "uid": "firebase-auth-uid",
  "email": "test@example.com",
  "emailLower": "test@example.com",
  "accountRole": "user",
  "planType": "free",
  "licenseStatus": "free",
  "accessStatus": "pending",
  "inviteQuota": 0,
  "deviceLimit": 5,
  "subscriptionProvider": null,
  "supporterStatus": "none",
  "donationCount": 0,
  "donationTotalCents": 0,
  "apps": {
    "neuro-lab-1a2b3c": {
      "appId": "neuro-lab-1a2b3c",
      "name": "Neuro Lab",
      "role": "owner",
      "accessStatus": "active"
    }
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## `/apps/{appId}`

```json
{
  "appId": "neuro-lab-1a2b3c",
  "name": "Neuro Lab",
  "slug": "neuro-lab",
  "ownerUid": "firebase-auth-uid",
  "status": "active",
  "visibility": "public",
  "description": "Short public app description",
  "category": "Research",
  "pricing": {
    "mode": "paid",
    "priceCents": 1900,
    "currency": "USD",
    "interval": "monthly",
    "checkoutUrl": "https://brainokstore.lemonsqueezy.com/checkout/..."
  },
  "downloads": {
    "releaseUrl": "https://github.com/org/repo/releases/latest",
    "macUrl": "https://...",
    "windowsUrl": "https://...",
    "latestVersion": "0.1.0"
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`pricing.mode` can be `invite_only`, `free`, `paid`, or `donation`.
Paid app checkouts grant only that app's access. Donation checkouts update supporter data only.

Supporters are updated by the Lemon Squeezy webhook:

```json
{
  "supporterStatus": "supporter",
  "donationCount": 1,
  "donationTotalCents": 999,
  "donationCurrency": "USD",
  "lastPaymentProvider": "lemonsqueezy",
  "lemonSqueezy": {
    "customerId": "123",
    "orderId": "456",
    "variantId": "789",
    "lastEventName": "order_created"
  }
}
```

## `/devices/{deviceId}`

```json
{
  "uid": "firebase-auth-uid",
  "os": "mac",
  "machineHash": "sha256-or-node-machine-id-value",
  "appVersion": "0.1.0",
  "status": "active",
  "createdAt": "serverTimestamp",
  "lastSeenAt": "serverTimestamp"
}
```

Clients do not write this directly. They call `registerDevice`.

## `/invites/{code}`

```json
{
  "code": "ABCDE-12345",
  "appId": "neuro-lab-1a2b3c",
  "appName": "Neuro Lab",
  "inviterUid": "firebase-auth-uid",
  "usedBy": null,
  "benefit": "beta_access",
  "status": "unused",
  "expiresAt": "timestamp",
  "createdAt": "serverTimestamp"
}
```

Clients do not write this directly. They call `createInvite` and `redeemInvite`.
Redeeming an invite sets `/users/{uid}.apps.{appId}.accessStatus` to `"active"` without changing donation status.

## `/activationCodes/{code}`

```json
{
  "code": "BRN-ABCD-EFGH-IJKL",
  "appId": "neuro-lab-1a2b3c",
  "appName": "Neuro Lab",
  "createdByUid": "admin-uid",
  "status": "unused",
  "maxActivations": 1,
  "activationCount": 0,
  "activations": {},
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Clients do not read or write this directly. The admin calls
`createActivationCode`; the desktop app calls `activateAppCode`.

## `/activations/{activationId}`

```json
{
  "activationId": "neuro-lab-1a2b3c-machinehash",
  "appId": "neuro-lab-1a2b3c",
  "appName": "Neuro Lab",
  "machineHashHash": "sha256",
  "status": "trial",
  "source": "trial",
  "os": "windows",
  "appVersion": "0.1.0",
  "trialStartedAt": "timestamp",
  "trialEndsAt": "timestamp",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

The desktop app creates this through `startAppTrial` on first launch. If an
activation number is entered, `activateAppCode` updates the same document to
`status: "active"` and stores the activation code.

## Server-only collections

- `/subscriptions/{subscriptionId}`
- `/donations/{orderId}`
- `/purchases/{orderId}`
- `/activationCodes/{code}`
- `/activations/{activationId}`
- `/webhookEvents/{eventId}`
- `/pendingPayments/{paymentId}`
