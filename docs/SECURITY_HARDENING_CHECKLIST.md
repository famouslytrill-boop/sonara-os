# Security Hardening Checklist

Code-side launch hardening:

- Stripe checkout uses server-side secret only.
- Stripe webhook verifies signatures.
- Supabase service role is server-only.
- Sensitive routes use rate limiting where appropriate.
- Stripe webhook is not aggressively rate limited.
- Security headers are configured in Next.js.
- RLS is enabled for subscription table.
- Secret scanner checks for common Stripe, Supabase, and OpenAI secret patterns.
- No secrets belong in source code, docs, screenshots, or chat.

Manual production steps:

- Add Vercel environment variables.
- Apply Supabase migrations.
- Confirm RLS.
- Test checkout and webhook delivery.
