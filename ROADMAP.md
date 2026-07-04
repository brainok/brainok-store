# Brainok Store Roadmap

## Current Version

Brainok Store currently provides:

- public app listing
- free downloads
- no-login download flow
- Firebase-backed admin account
- manual Brainok License creation
- license search
- license disable
- device reset
- 30-day trial concept
- app-side activation path through Firebase
- support email: `brainok777@gmail.com`

Current apps already include:

- 30-day trial
- offline activation
- shared activation codes
- signed activation codes

These must continue working.

## Current Constraints

- Payment/license issuing is manual.
- PaymentProvider keeps payment code separate from the licensing system.
- Device limits are partly represented in code defaults.
- Activation records currently include app metadata, but the long-term model should count one device once across all apps.
- Support workflow exists through email and app QnA, but not yet as a complete support ticket platform.

## Near Future Version

Goal: stable universal licensing while payment remains manual.

Features:

- `/licensePlans` controls device limits.
- One Brainok License activates every Brainok app.
- One device consumes one seat even when using several apps.
- Admin can create, search, disable, reset, and resend.
- Compatibility codes preserved:
  - `BRAINOK-SEVERANCE-2026`
  - `XJD2-FBYT-F6QA`
- Existing signed activation codes preserved.
- Activation payloads are signed for offline use.
- Admin audit logs exist.
- Support tickets exist for license and activation help.

User experience:

```text
Download free
  -> Use 30-day trial
  -> Request/buy license
  -> Activate once online
  -> Use all Brainok apps offline
```

## Payment Automation Version

Goal: Toss Payments creates and sends Brainok Licenses automatically.

Features:

- Toss checkout
- server-side payment confirmation
- webhook processing
- idempotent event handling
- automatic license generation
- automatic email delivery
- payment search in admin
- refund-to-license-status workflow
- manual fallback remains available

Important rule:

The desktop apps still do not know about Toss Payments. They only activate Brainok Licenses.

## Complete Licensing Platform

Goal: Brainok Store becomes the central licensing and support platform for all Brainok apps.

Features:

- universal licenses
- manual and Toss-issued licenses
- macOS and Windows activation clients
- signed offline activation cache
- centralized support tickets
- license email resend
- admin audit history
- payment/refund handling
- lab license management
- device reset workflow
- app release/download management
- compatibility layer for older app versions

## App Migration Roadmap

Migrate gradually:

1. PageWheel
2. Hotkey Launcher
3. Brainok Clipboard
4. Multiple File Viewer
5. Future macOS apps
6. Future Windows apps

Each migrated app must keep:

- free installer download
- 30-day fully functional trial
- existing shared activation code support
- existing signed activation code support
- offline use after activation

## Platform Roadmap

### macOS

- keep DMG public
- do not add DMG protection
- activation happens inside app
- store activation in Keychain or signed local cache

### Windows

- keep installer public
- activation happens inside app
- use Windows-safe device identity
- store activation in Credential Manager, DPAPI, or signed local cache

### Shared

- one activation protocol
- one Firebase backend
- one support email
- one admin workflow

## Admin Roadmap

Current admin:

- app publishing
- license generation
- license search
- disable license
- reset device

Next admin:

- supporter profile
- payment search
- resend license email
- support ticket inbox
- audit log
- plan configuration

Final admin:

- complete license lifecycle
- Toss reconciliation
- refund handling
- lab license management
- usage/support diagnostics

## Compatibility Roadmap

Short term:

- keep existing functions and app-side code
- add universal license as a parallel path

Medium term:

- migrate old shared codes into compatibility license records
- apps prefer universal license, then fallback to legacy verifier

Long term:

- old activations remain readable for support
- old signed codes remain verifiable
- new purchases always receive universal Brainok Licenses

## Success Criteria

Brainok licensing is complete when:

- users can download every app freely
- users can trial every app for 30 days
- one Brainok License activates all apps
- activation requires Internet only once
- apps work offline after activation
- Personal, Pro, and Lab device limits come from Firebase
- admin can reset, disable, search, and resend
- Toss payment can generate and email licenses automatically
- old shared and signed activation codes still work
