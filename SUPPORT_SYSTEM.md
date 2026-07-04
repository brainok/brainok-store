# Brainok Support System

## Primary Support Email

Use this email consistently:

```text
brainok777@gmail.com
```

Use it for:

- license requests
- activation help
- general support
- supporter questions
- payment questions
- license email resend requests

## Support Principles

- Downloads stay free and public.
- Users should not need an account to ask for basic support.
- License and activation support should be searchable by email and license code.
- Admin support actions should be auditable.
- Support should work during the manual phase and the future Toss Payments phase.

## Current Manual Flow

```text
User emails brainok777@gmail.com
  -> Admin verifies request
  -> Admin searches license or supporter record
  -> Admin creates, disables, resets, or resends as needed
  -> Admin replies from brainok777@gmail.com
```

## Support Categories

| Category | Description | Typical Admin Action |
| --- | --- | --- |
| License request | User/supporter asks for a license | Create manual license, email code |
| Activation help | Device limit, invalid code, offline issue | Search license, reset device, resend code |
| General support | App install or usage question | Reply or create app-specific support note |
| Supporter question | Plan, payment, lab use, invoice | Search payment/license, reply |
| Payment help | Toss payment issue in future flow | Search payment/order, resend license, escalate |

## Admin Workflow

Admin account:

```text
brainok777@gmail.com
```

Admin tools should support:

- search by email
- search by license code
- search by payment/order ID
- search by app name
- search by device label or device hash
- create license
- disable license
- reset device activation
- resend license email
- open support ticket
- add internal note
- close support ticket

## License Request Workflow

Manual phase:

1. User emails `brainok777@gmail.com`.
2. Admin confirms the plan:
   - Personal: up to 3 devices
   - Pro: up to 5 devices
   - Lab: 20+ devices
3. Admin creates a Brainok License from the admin panel.
4. Admin sends the code by email.
5. User activates inside the app.

Future Toss phase:

1. User pays through Toss Payments.
2. Backend confirms payment.
3. Backend creates license automatically.
4. Backend emails the license.
5. Admin only intervenes if payment, email, or activation fails.

## Activation Help Workflow

Common cases:

- user entered a typo
- license disabled or expired
- device limit reached
- old app version using legacy activation
- offline cache missing or damaged
- user changed computer

Admin steps:

1. Search license by code or email.
2. Confirm license status.
3. Review active devices.
4. Reset old device if appropriate.
5. Ask user to activate again while online.
6. If the app is older, provide compatibility instructions for existing shared or signed activation code handling.

## Resend License Email Workflow

1. Search by buyer email, payment ID, or license code.
2. Confirm license belongs to requester.
3. Create `/licenseEmails/{emailJobId}` with `type: "license_delivery"`.
4. Send to the verified email.
5. Log admin action in `/adminAuditLogs`.

## Support Ticket Schema

Store support cases in `/supportTickets/{ticketId}`.

```json
{
  "ticketId": "ticket_abc123",
  "type": "activation_help",
  "status": "open",
  "priority": "normal",
  "email": "user@example.com",
  "emailLower": "user@example.com",
  "subject": "Activation help",
  "message": "I need to reset my old computer.",
  "appId": "pagewheel",
  "licenseCode": "BRAINOK-PRO-ABCD-1234",
  "assignedTo": "brainok777@gmail.com",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Recommended ticket statuses:

```text
open
waiting_for_user
waiting_for_admin
resolved
closed
spam
```

## Email Templates

### License Delivery

Subject:

```text
Your Brainok License
```

Body should include:

- license code
- plan
- device limit
- activation steps
- support email: `brainok777@gmail.com`

### Activation Reset

Subject:

```text
Your Brainok License device reset is complete
```

Body should tell the user:

- old device was reset
- open the app while online
- enter the same Brainok License code again
- after success, offline use continues

### Payment Issue

Subject:

```text
Brainok payment support
```

Body should request:

- payment email
- approximate payment time
- order ID or receipt if available
- desired license plan

## Public Website Copy Rules

Use consistent wording:

- "Free download. No account required."
- "30-day fully functional trial."
- "One Brainok License unlocks every Brainok app."
- "Activation requires Internet only once."
- "After activation, apps work offline."
- "For help, email brainok777@gmail.com."

Do not imply that the DMG or installer is protected. Protection happens inside the app after trial.

## Future Admin Views

Recommended admin support screens:

- Support inbox
- License search
- Payment search
- Device reset panel
- Resend email panel
- Supporter profile page
- Audit log viewer

The existing account/admin panel can grow into these views gradually.
