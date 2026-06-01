# Webhook Security

Webhook processing is not live in the current static shell. Future webhook routes must verify signatures before parsing or acting on events.

## Required Behavior

- Read the raw request body before JSON parsing.
- Require a server-only webhook secret.
- Verify timestamp tolerance.
- Verify HMAC signature before processing.
- Reject missing, stale, or mismatched signatures.
- Log only redacted metadata.
- Do not replay webhook events without owner/admin review.

## Stripe Notes

Stripe webhooks must use Stripe signature verification with the raw body and the configured webhook secret. Do not process checkout, subscription, invoice, refund, or dispute events from unsigned payloads.

## Setup-Mode Helper

`packages/web/src/lib/security/webhook-signature.ts` provides a provider-neutral HMAC helper for future server routes and tests. It is not a substitute for provider SDK verification when an SDK-specific verifier is available.

## Audit Requirements

Future webhook routes should create audit records for:

- checkout completion
- subscription creation, update, and deletion
- invoice paid
- invoice payment failed
- replay attempts
- signature failures above alert threshold

No webhook route should expose secrets or raw event payloads in public UI.
