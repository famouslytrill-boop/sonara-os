# Support System

The current support system is setup-gated. Public pages can explain contact paths and validate user expectations, but real inbound and outbound delivery require provider setup.

## Public paths

- `/contact`
- `/support`
- `/help`
- `/feedback`
- `/refund-policy`
- `/privacy`
- `/security`

## Safety rules

- Do not ask for passwords, card numbers, bank details, API keys, private keys, or provider secrets.
- Do not log private message content in production.
- Do not expose stack traces or provider errors to users.
- If storage or email is missing, show a visible fallback instead of silently dropping requests.
- Security, billing, privacy, and legal requests require owner/admin review.

## Admin readiness

- `/admin/email-readiness`
- `/app/admin/email-readiness`

These routes report configured variable names only. They never reveal secret values.
