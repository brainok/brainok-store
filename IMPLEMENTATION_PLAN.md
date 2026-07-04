# Implementation Plan

## Goal

Migrate Brainok Store to a production-ready universal licensing platform without breaking existing apps, existing shared activation codes, or existing signed activation codes.

Do not redesign everything at once. Preserve compatibility while migrating.

## Phase 0: Freeze the Contract

Status: documentation-first.

Tasks:

- Keep downloads public.
- Keep 30-day trials inside apps.
- Keep `brainok777@gmail.com` as the admin/support email.
- Define the universal license API contract.
- Define Firestore schema.
- Define payment and support workflows.
- Document compatibility requirements:
  - `BRAINOK-SEVERANCE-2026`
  - `XJD2-FBYT-F6QA`
  - existing signed activation codes

Deliverables:

- `LICENSE_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FIREBASE_SCHEMA.md`
- `SUPPORT_SYSTEM.md`
- `IMPLEMENTATION_PLAN.md`
- `ROADMAP.md`

## Phase 1: Harden Current Manual Licensing

The repo already has manual license functions. Improve them without changing public behavior.

Tasks:

- Add `/licensePlans` collection and read device limits from Firebase.
- Keep existing defaults as fallback:
  - Personal: 3 devices
  - Pro: 5 devices
  - Lab: 20+ devices
- Make activation count unique license-device pairs across all apps.
- Ensure one computer using several Brainok apps consumes only one device seat.
- Add admin audit logs for:
  - license creation
  - license disable
  - device reset
  - email resend
- Add compatibility seed records for:
  - `BRAINOK-SEVERANCE-2026`
  - `XJD2-FBYT-F6QA`
- Keep old `/activationCodes` and shared-code flows.

Verification:

- Admin can create a Personal license.
- Same device can activate PageWheel and Hotkey Launcher without consuming two seats.
- Fourth Personal device is blocked.
- Admin can reset a device.
- Reset allows a new activation.
- Disabled license cannot activate.
- Legacy codes still work in old app versions.

## Phase 2: Signed Offline Activation Payload

Tasks:

- Add server-side activation payload signing.
- Add `schemaVersion` to activation responses.
- Include:
  - `licenseId`
  - `licenseCodeHash`
  - `plan`
  - `allowedApps`
  - `deviceIdHash`
  - `issuedAt`
  - optional `expiresAt`
  - `signature`
- Publish a stable public verification key or app-embedded verification key.
- Update new app builds to verify the signed payload offline.
- Keep legacy signed activation verification in existing apps.

Verification:

- App activates once online.
- App launches offline after activation.
- Tampered activation cache is rejected.
- Existing signed codes continue to pass in apps that support them.

## Phase 3: App Client SDK

Create a small shared licensing adapter that every Brainok app can use.

Recommended package:

```text
brainok-licensing-client
```

Responsibilities:

- normalize license codes
- manage trial state
- compute device identity
- call activation/check endpoints
- store signed activation cache
- verify offline activation payload
- expose simple states:
  - `trial_active`
  - `trial_expired`
  - `activated`
  - `activation_required`
  - `activation_invalid`

Platform support:

- macOS
- Windows
- future Linux if needed

Verification:

- Works in at least one existing macOS app.
- Device identity is stable across app restarts.
- Windows implementation has no macOS-only dependency.

## Phase 4: Admin Workflow Expansion

Tasks:

- Add license detail view.
- Add supporter search.
- Add payment/support tabs.
- Add resend license email.
- Add support ticket records.
- Add internal notes.
- Add audit log viewer.

Do this in the existing `web-netlify` admin area instead of building a separate admin app.

Verification:

- Admin can find supporter by email.
- Admin can find license by code.
- Admin can resend email.
- Admin can open and close support ticket.

## Phase 5: Toss Payments Integration

Tasks:

- Add provider enum:
  - `manual`
  - `toss`
  - `legacy_external`
- Add server-created orders.
- Add Toss checkout flow.
- Add payment confirmation function.
- Add Toss webhook endpoint.
- Add idempotent webhook event processing.
- Generate license only after confirmed payment.
- Send license email.
- Handle refund/disable workflow.

Implementation warning:

Before writing this phase, re-check the official Toss Payments docs for current checkout, confirmation, and webhook signing requirements:

- https://docs.tosspayments.com/en/integration
- https://docs.tosspayments.com/en/api-guide
- https://docs.tosspayments.com/en/webhooks

Verification:

- Test payment creates one license.
- Duplicate webhook does not create duplicate license.
- Email failure does not lose paid license.
- Refund disables or flags license according to policy.

## Phase 6: Gradual App Migration

Migrate apps one at a time.

Recommended order:

1. PageWheel
2. Hotkey Launcher
3. Brainok Clipboard
4. Multiple File Viewer
5. Future Windows apps

For each app:

- keep existing trial behavior
- add universal Brainok License activation
- keep existing shared code compatibility
- keep existing signed code compatibility
- test offline launch
- release normal public installer

No DMG protection should be added.

## Phase 7: Cleanup After Compatibility Window

Only after all supported apps have migrated:

- mark old app-specific activation paths as legacy
- keep read/verify support for old signed codes
- keep payment-provider UI labels generic
- keep historical payment records
- keep compatibility code documents

Do not delete old activation records needed for support.

## Rollback Strategy

Every phase should be reversible:

- New license fields must be additive.
- Existing functions remain until replacement is verified.
- Existing app versions keep their old activation paths.
- Toss automation can be paused while manual license creation continues.
- If email delivery fails, admin can copy and send license manually.

## Minimum Production Test Set

Backend:

- create license
- activate license
- reactivate same device idempotently
- block device limit
- reset device
- disable license
- search license
- compatibility code activation

App:

- first launch starts trial
- trial expires after 30 days
- activation requires Internet
- offline launch works after activation
- tampered cache fails
- app update preserves activation

Admin:

- admin-only access with `brainok777@gmail.com`
- non-admin blocked from license management
- audit logs written
- support email resend path works

Payment:

- test payment success
- amount mismatch blocked
- duplicate webhook ignored
- refund state handled
