# ADR-0005: Billing
Status: ACCEPTED baseline. Stripe checkout server-created; webhook
signature-verified on raw body; idempotent audit; entitlements derive ONLY from
active/trialing subscription rows or explicit owner/admin override. Pricing
catalog (Free/$7/$19/$39/one-time) changes require owner approval (§19).
