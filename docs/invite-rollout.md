# Brainok License Rollout

The preferred desktop flow is universal Brainok licensing:

- Anyone can download the DMG without login.
- The desktop app starts a 30-day trial on first launch.
- After the trial, the user enters one Brainok license inside the app.
- Firebase verifies the license once and records the device activation.
- The app stores the successful license locally, preferably in Keychain.
- Activated apps can run offline forever unless the local license is removed.

Do not protect the DMG. Protect the software after the trial.

## Seed your own account

After signing in once on the website, open Firebase Console > Firestore >
`users/{yourUid}` for `brainok777@gmail.com` and set:

```json
{
  "accountRole": "admin",
  "accessStatus": "active",
  "inviteQuota": 50
}
```

Then open the website Account tab:

1. Edit app listings and download URLs as needed.
2. Open `Brainok Licenses`.
3. Generate personal, pro, lab, or friend licenses.
4. Search license holder email or license code when support is needed.
5. Reset devices or disable licenses from the same panel.

Do not give normal users `accountRole: "admin"`. License access should be
granted through Brainok licenses, trials, or future payment webhooks.

## Friend / Severance Code

Use this shared Friend code:

```txt
BRAINOK-SEVERANCE-2026
```

Create it as:

- `plan`: `friend`
- `status`: `active`
- `maxDevices`: `50`
- `allowedApps`: `["*"]`

## User Flow

1. Visitor downloads the DMG from `store.brainok.net`.
2. The app stores first launch/trial start locally.
3. The user gets a 30-day trial.
4. After trial expiry, the app shows an activation dialog.
5. The user enters a code such as `BRAINOK-PRO-4A7K-92QD`.
6. The app calls `activateBrainokLicense` with `code`, `deviceId`, and optional app/device metadata.
7. Firebase validates `/licenses/{licenseCode}` and writes `/activations/{licenseId-deviceHash}`.
8. The app stores the returned local license record and continues offline.

## Desktop Call

Callable function:

```txt
activateBrainokLicense
```

Request:

```json
{
  "code": "BRAINOK-SEVERANCE-2026",
  "deviceId": "stable-device-id-from-the-app",
  "deviceName": "Hyosuk MacBook Pro",
  "appId": "brainok-pagewheel",
  "appName": "Brainok PageWheel",
  "os": "mac",
  "appVersion": "1.0.0"
}
```

Success response:

```json
{
  "ok": true,
  "activated": true,
  "activatedDate": "2026-07-01T00:00:00.000Z",
  "licenseId": "lic_sha256-prefix",
  "licenseCode": "BRAINOK-SEVERANCE-2026",
  "plan": "friend",
  "status": "active",
  "maxDevices": 50,
  "deviceId": "stable-device-id-from-the-app"
}
```

## Local App Storage

Store trial data:

- first launch date
- trial start date

Store activated license data:

```json
{
  "activated": true,
  "licenseId": "lic_sha256-prefix",
  "activatedDate": "2026-07-01T00:00:00.000Z",
  "plan": "friend",
  "deviceId": "stable-device-id-from-the-app"
}
```

Prefer Keychain. UserDefaults is acceptable only as a fallback.

## License Shape

```json
{
  "licenseId": "lic_sha256-prefix",
  "licenseCode": "BRAINOK-PRO-4A7K-92QD",
  "email": "subscriber@example.com",
  "plan": "pro",
  "status": "active",
  "maxDevices": 5,
  "activationCount": 0,
  "allowedApps": ["*"],
  "issuedAt": "serverTimestamp"
}
```

## Activation Shape

```json
{
  "activationId": "lic_sha256-prefix-devicehash",
  "licenseId": "lic_sha256-prefix",
  "licenseCode": "BRAINOK-PRO-4A7K-92QD",
  "deviceId": "stable-device-id-from-the-app",
  "deviceIdHash": "sha256",
  "deviceName": "Hyosuk MacBook Pro",
  "appId": "brainok-pagewheel",
  "appName": "Brainok PageWheel",
  "status": "active",
  "source": "brainok_license",
  "activatedAt": "timestamp"
}
```

## Thumbnail assets

Use 16:9 thumbnails for app cards and product previews.

- Recommended source: `1600 x 900`.
- Minimum practical size: `1200 x 675`.
- Small preview fallback: `800 x 450`.
- Format: WebP or JPG for screenshots, PNG only for sharp UI mockups with text.
- File size target: under `300 KB`; keep under `1 MB` at most.
- Avoid text-heavy thumbnails because they shrink on the app board.
- Google Drive share links must be public to anyone with the link. The website
  converts `drive.google.com/file/d/.../view` links to a thumbnail URL
  automatically, but private Drive files still cannot render.
