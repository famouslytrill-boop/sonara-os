# Notifications and Media Operations

SONARA uses a progressive, provider-gated media strategy. Core account, support, billing, and workspace flows do not depend on push, camera, microphone, OBS, streaming, voice generation, or heavy rendering.

## Web notifications

- The signed-in user opens `/app/settings/notifications` and explicitly chooses **Enable notifications**.
- The browser asks for permission; no permission request runs on page load.
- The browser receives only `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. VAPID private keys and any sender implementation remain server-only.
- The server verifies the Supabase bearer token and stores the subscription in `push_notification_subscriptions` through the service-role boundary.
- The service worker displays approved notifications and opens the relevant SONARA route. It does not publish, charge, contact, or automate a customer action.
- Apply `supabase/migrations/20260915120000_push_notification_subscriptions.sql` before enabling the public VAPID key.

## Email and signup verification

Supabase Auth remains responsible for signup confirmation and password recovery. Resend remains responsible for server-side support and transactional email. Configure and verify those providers in their dashboards; the browser must never receive provider secrets.

## Media and OBS

Creator Studio can expose safe media readiness, review, asset, and export workflows. OBS Studio, streaming, audio processing, voice, and video rendering should run through an approved worker or user-owned desktop workflow. They are not executed in a Vercel request and cannot publish automatically. Rights, consent, provenance, and human review are required before customer distribution.

## Store and marketplace

The storefront presents real catalog records and setup status. Stripe Checkout is the only payment boundary. A missing price ID or webhook secret must show setup required and must not create a fake checkout link.

## Operations

Workflow records, support requests, delivery attempts, notifications, payments, and future media jobs should remain tenant-scoped, auditable, idempotent, and reversible. Provider readiness is reported as configured, setup required, or unverified; local code cannot claim live provider proof.
