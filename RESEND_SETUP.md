# Resend Setup

Contact submissions must never disappear if email delivery fails.

## Domain

1. Add the sending domain in Resend.
2. Configure DNS records.
3. Wait for domain verification.

## Vercel variables

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_TO_EMAIL`

## Runtime behavior

- `/contact` always returns a reference ID for valid submissions.
- If Supabase is configured, the request is stored in `support_requests`.
- If Resend is configured, the app attempts an email notification.
- If email fails, the request remains in the database-backed queue when Supabase is configured.
- If Supabase is missing, the route returns a safe fallback reference ID and does not expose secrets.
