# Brainok Payment System

## Purpose

Payments are separate from downloads. Brainok Store must always allow free downloads with no login, no email, and no payment.

Payment exists only to confirm that a customer paid. License activation is handled by the centralized Brainok Firebase license system.

## Phase 1 Operation

There is one product:

```text
Brainok Lifetime License
```

The license:

- activates every Brainok desktop application
- is a one-time purchase
- has no expiration date
- has no subscription or monthly billing
- supports the selected device limit

Customer options:

- 2 devices: 20,000 KRW for Korea bank transfer, 15 USD for PayPal
- 5 devices: 40,000 KRW for Korea bank transfer, 30 USD for PayPal

Region controls the payment method:

- Korea: bank transfer
- International: PayPal Checkout

Users can manually select the region. The site must not rely only on IP address.

## Central License Issuing Function

Every successful payment path must call:

```text
issueBrainokLifetimeLicense()
```

This function:

- generates the Brainok license code
- writes `/licenses/{licenseCode}`
- sets `licenseType: "lifetime"`
- sets `status: "active"`
- sets `maxDevices` and `maxActivations` from the purchased plan
- sends the activation email through Resend
- records email delivery fields on the license

Payment providers must not generate licenses directly.

## Firestore

Orders are stored in:

```json
{
  "orderId": "BRN-20260722-ABC123",
  "email": "buyer@example.com",
  "depositorName": "Buyer Name",
  "amount": 0,
  "currency": "KRW",
  "status": "awaiting_payment",
  "paymentMethod": "bank_transfer",
  "licenseType": "lifetime",
  "planId": "lifetime_2",
  "maxDevices": 2,
  "maxActivations": 2,
  "createdAt": "serverTimestamp"
}
```

Licenses are stored in:

```json
{
  "licenseId": "lic_...",
  "licenseCode": "BRAINOK-SUPPORTER-....",
  "email": "buyer@example.com",
  "licenseType": "lifetime",
  "plan": "personal",
  "status": "active",
  "maxDevices": 2,
  "maxActivations": 2,
  "allowedApps": ["*"],
  "issuedAt": "serverTimestamp",
  "expiresAt": null
}
```

The `plan: "personal"` field remains for backward compatibility with existing desktop activation code. The user-facing license type is Brainok Lifetime License.

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
- license type
- license email delivery

## Korea Bank Transfer

The customer enters:

- email
- depositor name
- agreement checkbox

The server creates `/orders/{orderId}` with `status: "awaiting_payment"`.

The admin opens `/admin/orders`, confirms the bank transfer, and clicks `Approve Payment`.

Approval updates the order to `paid`, calls `issueBrainokLifetimeLicense()`, then updates the order to `completed`.

## International PayPal Checkout

The site uses the official PayPal JavaScript SDK. The browser never issues a license.

PayPal checkout uses USD because PayPal Orders API does not support KRW checkout orders for this account. Korea bank transfer remains KRW.

Flow:

```text
Buyer clicks PayPal
  -> Browser asks Firebase Functions to create a PayPal order
  -> Buyer approves in PayPal
  -> Browser asks Firebase Functions to capture the PayPal order
  -> Server verifies PayPal status, amount, and currency
  -> Server calls issueBrainokLifetimeLicense()
  -> Server sends the license email
```

## Configuration

Defaults live in `firebase-functions/src/store-config.ts`, and production should override values through environment variables or Firebase secrets.

Environment variables:

- `BRAINOK_LIFETIME_2_AMOUNT`
- `BRAINOK_LIFETIME_2_CURRENCY`
- `BRAINOK_LIFETIME_5_AMOUNT`
- `BRAINOK_LIFETIME_5_CURRENCY`
- `PAYPAL_LIFETIME_2_AMOUNT`
- `PAYPAL_LIFETIME_2_CURRENCY`
- `PAYPAL_LIFETIME_5_AMOUNT`
- `PAYPAL_LIFETIME_5_CURRENCY`
- `BRAINOK_PAYPAL_CURRENCY`
- `BANK_NAME`
- `BANK_ACCOUNT_NUMBER`
- `BANK_ACCOUNT_HOLDER`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_ENVIRONMENT`
- `SUPPORT_EMAIL`

Firebase secrets:

- `RESEND_API_KEY`

Current bank transfer defaults:

```text
Bank: 우리은행
Account: 126-296921-12-001
Account Holder: 남효석
```

## Email Delivery

All license emails should use:

```text
From: Brainok Licensing <licenses@brainok.net>
Reply-To: brainok777@gmail.com
```

Email content should include:

- Brainok Lifetime License code
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
  -> Admin creates Brainok Lifetime License with source "manual"
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
- review orders by status
- approve bank transfer orders
- cancel pending orders
- resend license email
- disable license after refund or abuse
- reset devices for support cases
- add internal support note

## Future Providers

Future providers such as Toss Payments, Stripe, and Paddle should only confirm payment and write payment records. After server-side verification succeeds, they should call `issueBrainokLifetimeLicense()` without changing the licensing system.

The payment layer is provider-agnostic. Do not let any payment provider call or
change desktop activation code directly. Providers should record payment state,
then call the stable internal license issuer.

Provider enum:

```ts
type PaymentProvider = "manual" | "toss" | "legacy_external";
```

Use `legacy_external` only for imported or historical records from older payment
systems. New payment automation should be implemented as a provider module such
as `toss`, `stripe`, or another PG without changing the licensing system.

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
