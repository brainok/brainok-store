# Lemon Squeezy Setup

## Product

Create one pay-what-you-want product for general support:

- Brainok Support
- Pricing: Pay what you want
- Suggested price: `$9.99`
- Minimum price: your choice, e.g. `$1.99`
- Generate license keys: off

Copy the checkout share URL into:

```text
firebase-functions/.env
```

as:

```text
LEMONSQUEEZY_CHECKOUT_URL=https://your-store.lemonsqueezy.com/checkout/buy/YOUR_VARIANT_ID
```

## Checkout metadata

The `createCheckout` function appends:

```text
checkout[custom][uid]
checkout[custom][source]
checkout[email]
```

The webhook then reads `meta.custom_data.uid` and updates `/users/{uid}`.

## Per-app paid access

For apps that should be paid, create a Lemon Squeezy product or variant for
that app, then paste its checkout URL into the app settings on the website.
The `createAppCheckout` function appends:

```text
checkout[custom][uid]
checkout[custom][appId]
checkout[custom][appName]
checkout[custom][purpose]=app_purchase
checkout[custom][source]=web
checkout[email]
```

When the webhook sees `purpose=app_purchase`, it grants or revokes only that
app's access under `/users/{uid}.apps.{appId}`.

## Webhook

Deploy `lemonsqueezyWebhook`, then paste its URL into Lemon Squeezy webhook settings.

Subscribe to:

- `order_created`
- `order_refunded`
- `subscription_created` if any app uses subscriptions
- `subscription_updated` if any app uses subscriptions
- `subscription_cancelled` if any app uses subscriptions
- `subscription_expired` if any app uses subscriptions

The webhook verifies `X-Signature` with HMAC-SHA256 before processing.

Official references:

- https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- https://docs.lemonsqueezy.com/help/webhooks/event-types
- https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
