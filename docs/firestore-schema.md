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

`pricing.mode` can be `invite_only`, `free`, or `paid`. New desktop apps should
prefer the universal Brainok license flow instead of app-specific paid access.

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
Redeeming an invite sets `/users/{uid}.apps.{appId}.accessStatus` to `"active"`.

## `/licenses/{licenseCode}`

```json
{
  "licenseId": "lic_sha256-prefix",
  "licenseCode": "BRAINOK-PRO-4A7K-92QD",
  "email": "subscriber@example.com",
  "emailLower": "subscriber@example.com",
  "plan": "pro",
  "status": "active",
  "maxDevices": 5,
  "activationCount": 0,
  "allowedApps": ["*"],
  "createdByUid": "admin-uid",
  "issuedAt": "serverTimestamp",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Clients do not read or write this directly. The admin calls `createLicense`,
`listLicenses`, `resetLicenseDevice`, and `disableLicense`. Desktop apps call
`activateBrainokLicense` once with the user-entered code and device ID.

Use one universal Brainok license for every app. The Friend / Severance shared
code is:

```txt
BRAINOK-SEVERANCE-2026
```

Recommended plan/device limits:

- `personal` -> unlimited term, 3 devices
- `pro` -> unlimited term, 5 devices
- `lab` -> unlimited term, 20-100 devices
- `friend` -> shared code, usually 50 devices

## `/activations/{activationId}`

```json
{
  "activationId": "lic_sha256-prefix-devicehash",
  "licenseId": "lic_sha256-prefix",
  "licenseCode": "BRAINOK-PRO-4A7K-92QD",
  "deviceId": "desktop-generated-device-id",
  "deviceIdHash": "sha256",
  "deviceName": "Hyosuk MacBook Pro",
  "appId": "brainok-pagewheel",
  "appName": "Brainok PageWheel",
  "status": "active",
  "source": "brainok_license",
  "os": "mac",
  "appVersion": "0.1.0",
  "activatedAt": "timestamp",
  "lastCheckedAt": "serverTimestamp",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

The desktop app stores first launch/trial dates locally, preferably in Keychain.
After 30 days, the app asks for a Brainok license. Activation requires Internet
once; after `activateBrainokLicense` succeeds, the app stores the local license
record in Keychain and can run offline.

Local license cache:

```json
{
  "activated": true,
  "licenseId": "lic_sha256-prefix",
  "activatedDate": "2026-07-01T00:00:00.000Z",
  "plan": "pro",
  "deviceId": "desktop-generated-device-id"
}
```

Legacy app-specific activation collections/functions may remain for backward
compatibility, but new Brainok apps should use `/licenses` plus
`activateBrainokLicense`.

## Server-only collections

- `/subscriptions/{subscriptionId}`
- `/purchases/{orderId}`
- `/licenses/{licenseCode}`
- `/activations/{activationId}`
- `/activationCodes/{code}` for legacy app-specific codes
- `/webhookEvents/{eventId}`
- `/pendingPayments/{paymentId}`
