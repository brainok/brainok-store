# PaymentProvider Architecture

Brainok Store keeps payment handling separate from licensing.

## Providers

Current provider:

- `manual`: admin-created licenses and manual supporter management

Planned provider:

- `toss`: Toss Payments checkout and webhook handling

Historical provider bucket:

- `legacy_external`: imported or historical payment records from an older provider

## Boundary

Payment providers may:

- create or update `/payments`
- write `/webhookEvents`
- call the internal license issuer after a confirmed payment

Payment providers must not:

- change the desktop activation protocol
- expose `/licenses` or `/activations` directly to clients
- require changes inside Brainok apps

## License Issuer

All providers must issue licenses through the same internal path:

```text
PaymentProvider
  -> confirmed payment or manual admin action
  -> issueBrainokLicense
  -> /licenses/{licenseCode}
```

The app-side activation flow remains:

```text
Desktop app
  -> activateBrainokLicense or verifyLicense
  -> /licenses + /activations through Firebase Functions
```

## Manual First

Manual license issuance is the production path today. Toss webhooks can be added
later without changing the license schema or app activation code.

The manual admin workflow is:

```text
Admin confirms payment
  -> Create License
  -> issueBrainokLicense
  -> /licenses/{licenseCode}
  -> Resend license email when buyer email is present
  -> /mailLogs/{mailLogId}
```

License emails use `RESEND_API_KEY` from Firebase Functions secrets or the local
environment, never from source code. The default sender is
`Brainok Licensing <licenses@brainok.net>` with reply-to
`brainok777@gmail.com`.

For a local smoke test, run:

```bash
RESEND_API_KEY=... npm run test:license-email
```

The test script always sends to `brainok777@gmail.com`.
