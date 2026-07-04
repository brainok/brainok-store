# Brainok Payment System

## Purpose

Payments are separate from downloads. Brainok Store must always allow free downloads with no login, no email, and no payment.

Payment exists only to issue a Brainok License after a user decides to support or buy after the 30-day trial.

## Current Operation

Current payment/license operation is manual:

```text
Supporter contacts Brainok
  -> Admin confirms supporter/payment manually
  -> Admin creates Brainok License
  -> Admin emails license code from brainok777@gmail.com
  -> User activates inside app
```

Support email:

```text
brainok777@gmail.com
```

## Future Toss Payments Flow

Future automated flow:

```text
User chooses license plan
  -> Toss Payments checkout
  -> Payment success redirect
  -> Server confirms payment with Toss Payments
  -> Firebase records payment
  -> Server creates Brainok License
  -> Firebase records license
  -> Email is sent to user
  -> User enters license code inside any Brainok app
  -> App activates once online and then works offline
```

Official Toss Payments docs currently describe success redirect parameters such as `paymentKey`, `orderId`, and `amount`, and webhooks for real-time payment events:

- https://docs.tosspayments.com/en/integration
- https://docs.tosspayments.com/en/api-guide
- https://docs.tosspayments.com/en/webhooks

Before implementation, re-check the current Toss docs and dashboard settings because payment APIs and webhook signing requirements can change.

## Payment Boundary

Desktop apps must not know about Toss Payments.

Desktop apps only know:

- trial state
- license activation endpoint
- offline activation cache

The website and backend know:

- checkout session
- payment status
- payment amount
- license plan
- license email delivery

## Product Model

The payment product should map to Brainok License plans, not individual applications.

Recommended products:

| Product | Plan | Default Devices | Notes |
| --- | --- | ---: | --- |
| Brainok Personal License | `personal` | 3 | Individual use |
| Brainok Pro License | `pro` | 5 | Multi-device professional use |
| Brainok Lab License | `lab` | 20+ | Managed manually or quoted |

The payment layer should not hardcode the final device count. It should look up the plan in Firebase, then stamp the chosen `maxDevices` onto the license at issuance time.

## Order Creation

Recommended server-created order fields:

```json
{
  "orderId": "brn_20260704_...",
  "provider": "toss",
  "plan": "personal",
  "amount": 99000,
  "currency": "KRW",
  "buyerEmail": "user@example.com",
  "status": "created",
  "createdAt": "serverTimestamp"
}
```

The frontend can request a checkout from a server function. The server function should create a pending payment/order record before redirecting to Toss.

## Payment Confirmation

The success redirect should not by itself issue a license. It should trigger server confirmation.

Required confirmation checks:

- `paymentKey` exists.
- `orderId` matches an existing pending payment.
- `amount` matches the server-side expected amount.
- payment status from Toss is successful.
- payment has not already created a license.

Only after these checks should the backend create a Brainok License.

## Webhooks

Webhooks are the reliability layer.

Use webhooks to handle:

- payment approved
- payment canceled
- refund
- partial refund, if supported by the final product policy
- payment failure or dispute events if exposed

Webhook processing must be idempotent:

- compute or store provider event ID
- write `/webhookEvents/{eventId}`
- skip duplicate events
- never create duplicate licenses for the same paid order

## License Generation After Payment

After confirmed payment:

1. Load plan config from `/licensePlans/{plan}`.
2. Create `/payments/{paymentId}` or update it to `paid`.
3. Create `/licenses/{licenseCode}` with:
   - `source: "toss"`
   - `paymentId`
   - `provider: "toss"`
   - `emailLower`
   - `plan`
   - `maxDevices`
   - `allowedApps: ["*"]`
4. Create `/licenseEmails/{emailJobId}`.
5. Send the license email.
6. Mark email job as `sent` or `failed`.

## Email Delivery

All license emails should come from or reply to:

```text
brainok777@gmail.com
```

Email content should include:

- Brainok License code
- plan name
- device limit
- activation instructions
- support email
- reminder that downloads are free and activation happens inside the app

The system must support resending license email from the admin panel.

## Refunds and Disabled Licenses

Refund policy should be enforced server-side.

Recommended states:

- Payment `paid`, license `active`
- Payment `refunded`, license `disabled` or `refunded`
- Payment `partially_refunded`, license remains `active` unless policy says otherwise
- Payment `chargeback`, license `disabled`

Do not delete license documents. Disable them and record audit events.

## Manual Payments

Manual supporter management remains supported during and after Toss migration.

Manual flow:

```text
Admin receives request
  -> Admin records supporter in Firebase
  -> Admin creates license with source "manual"
  -> Admin sends or resends license email
```

Manual records should use the same `/licenses`, `/users`, `/payments`, and `/supportTickets` collections where possible.

## Admin Workflow

Admin email:

```text
brainok777@gmail.com
```

Admin capabilities:

- create manual payment/supporter record
- create license
- search payment by email, order ID, license code, or payment key
- resend license email
- disable license after refund or abuse
- reset devices for support cases
- add internal support note

## Implementation Notes

The current repo still has Lemon Squeezy naming in several places. Do not remove those paths until the Toss flow is implemented and tested. Add Toss as a new provider path first, then migrate naming after compatibility is proven.

Recommended provider enum:

```ts
type PaymentProvider = "manual" | "toss" | "legacy_lemonsqueezy";
```

## Failure Handling

If payment succeeds but email fails:

- keep payment `paid`
- keep license `active`
- create failed email job
- show admin resend action

If payment succeeds but license generation fails:

- keep payment `paid_needs_license`
- alert admin
- do not ask the user to pay again

If webhook arrives before redirect confirmation:

- process it idempotently
- update the same payment/order record

## Production Checklist

- Toss test keys configured.
- Toss live keys stored only as Firebase secrets.
- Success and fail URLs configured for `https://store.brainok.net`.
- Webhook endpoint registered in Toss dashboard.
- Payment confirmation validates amount server-side.
- Webhook duplicate handling tested.
- License generation transaction tested.
- Email resend tested.
- Refund disables or flags license according to policy.
