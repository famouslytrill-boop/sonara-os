# Security Contract

## Secrets

- Keep Supabase service-role keys, Stripe secrets/webhook secrets, Resend keys, OAuth client secrets, GitHub/GitLab tokens, Rancher credentials, and signing keys server-only.
- Never print, screenshot, commit, or return secret values.
- Public environment values are limited to explicitly client-safe URLs/anonymous keys.

## Access control

- Authentication, active organization/workspace membership, role, ownership, and entitlement checks are enforced server-side and with RLS where applicable.
- Admin and owner routes require server-verified authorization.
- Checkout redirects do not grant entitlements.
- Opt-outs and consent requirements override outreach workflows.

## Data and operations

- Validate all external input.
- Use idempotency for webhooks, retries, and high-impact operations.
- Redact logs and errors.
- Private storage is default; executable uploads are blocked/quarantined.
- No arbitrary code execution, hidden tracking, surveillance, piracy, offensive security automation, automatic charges, or unapproved outbound actions.

## Engineering gates

- Never weaken RLS, tests, secret scans, lint, dependency checks, or migration checks for convenience.
- High-risk changes require a feature flag defaulted off, tests, audit coverage, rollback notes, and owner approval.

