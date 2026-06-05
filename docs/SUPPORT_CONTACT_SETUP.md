# Support And Contact Setup

SONARA includes public support and contact paths for beta users without requiring production email credentials during build.

## Public Routes

- `/contact` for general questions, sales/pricing, billing/refund, technical support, security reports, legal/privacy, and partnership requests.
- `/support` for the support-center landing page.
- `/help` for the documentation and policy index.
- `/feedback` for beta feedback, bugs, feature requests, friction, pricing, mobile, accessibility, and general feedback.

## Email Routing And Outbound Provider

Cloudflare Email Routing can forward inbound messages to real inboxes. It does not send outbound app notifications from support/contact forms.

The current server-side outbound adapter supports Resend when these values are configured:

- `SUPPORT_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`
- `NEXT_PUBLIC_SUPPORT_CONTACT_LABEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

`RESEND_API_KEY` is sensitive and server-only. Do not commit it, print it, put it in `NEXT_PUBLIC_*`, or paste it into screenshots.

## Safe Degradation

The forms validate requests server-side. If email provider env vars are missing, the user sees a clear message that the email provider is not configured.

If Supabase server env vars are configured and the `support_requests` or `feedback_reports` table exists, the server action attempts to store the request. If Supabase is missing or the table is not deployed yet, the public page does not crash.

If neither storage nor outbound email is configured, the form returns a clear fallback with a reference ID and asks the user to use the listed support inbox.

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

## Verification

```powershell
pnpm run verify:email-env
pnpm run test:email
pnpm run test:email -- --send
```

The send test must be run manually after Resend domain verification and key rotation.
