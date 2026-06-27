# Activation Rollout

The preferred desktop flow is Snagit-style activation:

- Anyone can download the installer.
- The desktop app starts a 30-day trial on first launch.
- The user enters an app-specific activation number inside the desktop app.
- Firestore stores activation per app and per computer.
- Donations update supporter data only; they do not grant activation.

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

Then open the website Apps tab:

1. Edit `Site settings` if the homepage text needs changing.
2. Add an app name.
3. Fill the app description, media, visibility, pricing, checkout URL, and download URLs.
4. Save the app settings.
5. Create an activation number for it.

Do not give normal users `accountRole: "admin"`. App access should be granted
through activation numbers, trials, or payment, not through account role changes.

For each Electron app build, copy that app's `appId` into `app-electron/.env`:

```env
VITE_BRAINOK_APP_ID=your-app-id
```

## User flow

1. Visitor downloads the installer from the website.
2. The desktop app launches and calls `startAppTrial`.
3. Firebase creates `/activations/{appId}-{machineHashHash}` with
   `status: "trial"` and `trialEndsAt` set to 30 days later.
4. While the trial is valid, the app unlocks.
5. The user enters an activation number such as `BRN-ABCD-EFGH-IJKL`.
6. `activateAppCode` validates `/activationCodes/{code}` and updates the
   device activation to `status: "active"`.
7. After trial expiry, the app stays locked until a valid activation number is
   entered.

## Offline grace

The desktop app stores the last successful server activation check locally.
If the app cannot reach Firebase, it may unlock offline only when:

- The cached status is `active` and the last server check was within 7 days.
- Or the cached status is `trial`, the last server check was within 7 days,
  and `trialEndsAt` is still in the future.

New installs, first trial start, and activation-number entry still require an
internet connection.

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

## Activation code shape

```json
{
  "code": "BRN-ABCD-EFGH-IJKL",
  "appId": "neuro-lab-1a2b3c",
  "appName": "Neuro Lab",
  "createdByUid": "admin-uid",
  "status": "unused",
  "maxActivations": 1,
  "activationCount": 0,
  "createdAt": "serverTimestamp"
}
```

## Device activation shape

```json
{
  "activationId": "neuro-lab-1a2b3c-machinehash",
  "appId": "neuro-lab-1a2b3c",
  "appName": "Neuro Lab",
  "machineHashHash": "sha256",
  "status": "trial",
  "source": "trial",
  "trialStartedAt": "timestamp",
  "trialEndsAt": "timestamp"
}
```
