# SONARA Authorization Report

Date: 2026-07-15

## Authentication surface

- Supabase email/password signup and login are handled server-side.
- Customer sessions use HttpOnly cookies and are validated against Supabase before protected work is served.
- Forgot-password and recovery-token reset flows are now registered. Recovery tokens are read from the URL fragment, removed from the address bar, and never logged.
- Logout clears the application session.
- Google OAuth remains deliberately deferred until owner/provider configuration is complete. No social-login readiness is claimed.

## Authorization rules

- `requireCustomer` protects account, notification, request, deliverable, billing, and product-workspace routes.
- `requireAdmin` protects every administrator route and API. Administrator visibility in navigation is not treated as authorization.
- `requirePaidOrOwnerAccess(productKey)` requires a validated customer plus an active entitlement/subscription, or the existing explicit owner override, for paid product records.
- Organization-scoped writes resolve membership before including an organization ID.
- Stripe redirects never grant access; signed webhook state updates the persisted subscription/entitlement records used by paid gates.
- Anonymous HTML requests redirect to login; API requests receive a safe JSON error.

## Local proof

The full 248-test suite covers customer/admin guards, paid access, missing provider states, invalid sessions, checkout, webhook behavior, and normalized support-delivery persistence. Route-registry verification also proves that protected records are excluded from the public sitemap.

## Production proof still required

Run real customer, administrator, cross-organization, expired-session, downgraded-subscription, and account-recovery checks against the deployed Supabase project. This local run does not claim production tenant-isolation certification.
