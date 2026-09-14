# Deterministic Operations and Procurement

Updated: 2026-09-13

SONARA Industries now has a provider-independent foundation for reservations,
staff operations, business analytics, privacy-aware location summaries,
workflow planning, procurement approvals, and Creator Studio media workflows.
These capabilities use validated rules and database state; AI is optional and
is never required to run the core application.

## What runs now

- Business analytics calculate booking, labour, payment, inventory, and
  consented-location summaries from organization-scoped rows.
- Reservation resources reuse `business_assets` with explicit bookable
  metadata. Waitlist records reuse `business_bookings`, and an offer action
  changes state without pretending that a customer notification was sent.
- The staff application remains available at `/staff`, with employee records,
  schedules, time entries, and consent-controlled location events backed by
  the existing Business Builder data model.
- Location summaries reduce coordinate precision and never turn masked or
  approximate data into precise tracking. Background tracking is not enabled.
- Automation planners accept only allowlisted actions. Customer messages,
  provider actions, publishing, and money-impacting actions require approval.
- Creator Studio can return validated music and video workflow plans and job
  intents. A configured provider or isolated worker is still required to
  execute media processing or generation.

## Commercial integration gate

An integration cannot enter the `connected` state unless its non-secret
settings pass `lib/sonara-integration-activation-policy.cjs`:

- commercial status is approved or not required;
- approved terms have an HTTPS source and review date;
- rate limits either honor provider `Retry-After` guidance, use an explicit
  bounded local limit, or remain manual-only;
- secrets are server-only and records are organization-scoped;
- external actions are manual or human-approved unless the integration is an
  internal-only deterministic operation; and
- AI is disabled or optional. A configuration that requires AI fails closed.

Terms and rate limits change over time. Operators must review provider terms
before activation and repeat that review on the recorded schedule.

## Purchase-order approval

Migration `20260913190000_purchase_order_approval_controls.sql` extends the
existing `purchase_orders` table. Managers can prepare, submit, revise, and
cancel purchase orders. Only owners, admins, or business owners can approve or
reject them. Fulfillment cannot move to sent, partially received, or received
until approval is recorded.

The service-only database function locks the purchase order, validates the
transition, writes the approval state, and records a
`business_control_audit_events` row in one transaction. The browser cannot
supply an organization id or directly call the function.

## Production activation

1. Review the append-only migration and run the repository migration checks.
2. Apply it through the protected production workflow; do not paste database
   credentials into source, chat, logs, or a browser.
3. Verify a manager can submit but cannot approve, an owner can approve, and a
   cross-organization record cannot be read or changed.
4. Exercise `/api/business/operations/analytics`, reservation resources,
   waitlist, and map snapshot with an authenticated paid organization.
5. Configure a reviewed worker/provider before enabling any media execution.
6. Keep outbound notifications and consequential automation behind preview,
   consent where applicable, human approval, idempotency, and audit evidence.

## Research references

- Supabase documents authentication rate limits and HTTP 429 behavior at
  https://supabase.com/docs/guides/auth/rate-limits
- Supabase documents RLS-backed Data API security at
  https://supabase.com/docs/guides/api/securing-your-api
- The Open Source Initiative explains that approved open-source licenses allow
  commercial use at https://opensource.org/faq
- MapLibre GL JS provides an open-source TypeScript/WebGL map renderer at
  https://maplibre.org/maplibre-gl-js/docs/

These references support architecture decisions only. They do not activate a
provider, grant data rights, or replace legal, security, or operational review.
