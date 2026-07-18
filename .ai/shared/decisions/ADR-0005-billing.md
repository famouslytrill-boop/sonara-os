# ADR-0005: Billing

Status: Accepted

## Decision

Use server-side Stripe Checkout/Portal/Webhooks with validated `price_` identifiers, signature verification, idempotent event storage, and database-backed active/trialing entitlements.

## Consequences

- Missing/invalid configuration keeps checkout disabled.
- Client-provided prices are never trusted.
- Checkout redirects do not unlock paid features.

