# License Payment Notes

Brainok Store now uses a Brainok License model:

- Public DMG download
- 30-day trial
- Brainok license activation after trial
- Offline use after activation

There is no public tip or contribution panel.

## Current operation

Licenses are issued manually from the admin account:

1. Open the website.
2. Sign in as `brainok777@gmail.com`.
3. Open `Account`.
4. Use `Brainok Licenses` to generate, search, disable, or reset licenses.

## Future Toss Payments flow

```text
Toss Payments success
  -> Webhook
  -> Generate Brainok license
  -> Save /licenses/{licenseCode}
  -> Send email
```

The desktop app does not need payment-provider logic. It only needs to call
`activateBrainokLicense` with the user-entered code and the device ID.
