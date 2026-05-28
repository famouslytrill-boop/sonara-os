# Support And Contact Setup

SONARA includes public support and contact paths for beta users without requiring production email credentials during build.

## Public Routes

- `/contact` for general questions, sales/pricing, billing/refund, technical support, security reports, legal/privacy, and partnership requests.
- `/support` for the support-center landing page.
- `/help` for the documentation and policy index.
- `/feedback` for beta feedback, bugs, feature requests, friction, pricing, mobile, accessibility, and general feedback.

## Optional Email Providers

Supported placeholders are documented in `.env.example`:

- `SUPPORT_EMAIL`
- `CONTACT_EMAIL`
- `NEXT_PUBLIC_SUPPORT_CONTACT_LABEL`
- `RESEND_API_KEY`
- `SENDGRID_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

These are optional provider choices. Do not commit real credentials.

## Safe Degradation

The forms validate requests server-side. If email provider env vars are missing, the user sees a clear message that delivery is not configured yet.

If Supabase server env vars are configured and the `support_requests` or `feedback_reports` table exists, the server action attempts to store the request. If Supabase is missing or the table is not deployed yet, the public page does not crash.

## Spam Protection

The forms include:

- A hidden honeypot field.
- A form timestamp check to block instant bot submits.
- Server-side validation with Zod.

These are basic controls, not a replacement for provider-level abuse protection, CAPTCHA, rate limiting, or support-tool moderation.

## Privacy And Legal Review

Do not ask users to submit passwords, card numbers, payout details, API keys, private customer records, or legal documents through public forms.

The support/contact copy and data retention behavior should be reviewed before paid public launch.

## Real Support Channel

Configure the real support destination in hosting secrets or provider dashboards. Use `NEXT_PUBLIC_SUPPORT_CONTACT_LABEL` only for a safe label such as `your account settings`, not for secrets.
