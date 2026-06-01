# Known Limitations

This document lists current launch-review limitations after the feature freeze pass. These are not hidden blockers; they are the remaining items reviewers must account for before public launch.

## Static Web Shell

The current runnable app is a static TypeScript web shell. It can render routes and local setup state, but it is not a full production backend.

Impact:

- Some API routes are represented by static artifacts, typed helpers, or setup-mode documentation.
- Local route checks confirm shell availability, not full server-side workflow execution.

## Stripe

Stripe health is visible in `/admin/diagnostics` as redacted setup status.

Current limitations:

- The static shell does not provide a live Stripe webhook processor by itself.
- Webhook route reachability is setup-required unless a reviewed server route is deployed.
- Test mode and live mode must not be mixed.
- Payouts happen in Stripe Dashboard; the app does not control Stripe payout schedules.

Required before launch:

- Complete `docs/STRIPE_TEST_MODE_WALKTHROUGH.md`.
- Confirm webhook signature verification in the deployed server context.
- Confirm price IDs match the pricing page.

## Auth And Database

Auth, organization, and database surfaces include typed scaffolding and route guards, but production behavior still depends on configured provider state.

Current limitations:

- Supabase/database env vars must be configured in hosting.
- RLS policies must be manually verified before real writes are enabled.
- Service-role keys must remain server-only.

Required before launch:

- Complete `docs/PRODUCTION_ENV_CHECKLIST.md`.
- Verify RLS expectations and admin protection.
- Confirm no private organization data is readable by anonymous or non-member users.

## Payments, Customer Records, Reviews, And Follow-ups

Business Builder records are setup-oriented and safety-gated.

Current limitations:

- No payment custody.
- No raw card, CVV, or full bank credential storage.
- Customer follow-up drafts do not send automatically.
- Reviews and testimonials require owner moderation; fake reviews and fake ratings remain blocked.

Required before launch:

- Confirm owner review flows before enabling live customer communication.
- Confirm payment links are provider-hosted and reviewed.

## Monitoring And Operations

The repo includes diagnostics and launch operations docs, but production monitoring must be configured outside this static shell.

Required before launch:

- Assign alert owners.
- Confirm backup and rollback plans.
- Confirm support channel ownership.
- Complete `docs/GO_LIVE_CHECKLIST.md`.

## Current Warning

Test and smoke runs currently print:

```text
--localstorage-file was provided without a valid path
```

This warning does not fail the current gates, but it should be investigated during final launch polish.
