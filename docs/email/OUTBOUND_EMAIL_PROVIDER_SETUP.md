# Outbound Email Provider Setup

Outbound support email is optional and provider-gated.

## Required if enabled

- Verified sending domain or sender.
- Server-only provider key such as `RESEND_API_KEY`.
- Server-only sender address such as `RESEND_FROM_EMAIL`.
- Abuse, unsubscribe, and consent review for any customer-facing communication.

## Blocked

- No passwords or provider keys in browser code.
- No automatic customer outreach without owner approval.
- No billing, refund, legal, or security messages without review.
- No production test sends before provider configuration is approved.
