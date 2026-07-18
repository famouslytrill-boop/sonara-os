# ADR-0004: Supabase email/password with server-side authorization is the authentication baseline

Status: ACCEPTED baseline (2026-07-18)

## Decision

The current production baseline is Supabase email/password authentication through server routes, with bearer/cookie session resolution and server-side customer, workspace, business-manager, paid-or-owner, and admin authorization checks. Admin and protected product routes fail closed when auth configuration is unavailable.

Google OAuth remains explicitly deferred. Magic links, OTP, passkeys, MFA, recovery expansion, and additional social providers are not customer-visible capabilities until provider configuration, callback security, session behavior, abuse controls, tests, and UI contracts are implemented together.

## Consequences

- Frontend code may render only the server-documented authenticated, unauthorized, forbidden, and setup-required states.
- Client state never grants a role, workspace membership, or paid entitlement.
- New auth methods require a contract-first change and provider-specific verification; a visual control alone is not implementation.
