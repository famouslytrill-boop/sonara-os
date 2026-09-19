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
pnpm run verify:env
```

> **Both commands now exist.** This note said "No email tooling exists in this
> repository" and that neither command was defined. That was true of
> `package.json` and false of the repository: `scripts/verify-email-env.mjs` and
> `scripts/test-email-config.mjs` had been sitting there since 25 August 2026
> with nothing pointing at them. `pnpm run verify:email-env` and
> `pnpm run test:email` were wired up on 18 September 2026 and both work.
>
> Two things changed with them, and they matter if you set these variables from
> an older copy of this file. `verify:email-env` reads its requirement from
> `lib/sonara-infrastructure-manifest.cjs` — the same declaration
> `/api/readiness` uses — and applies the application's own rules, so
> `RESEND_API_KEY=replace-me` fails rather than passing. And the recipient
> variables are **`SUPPORT_TO_EMAIL`** or **`CONTACT_TO_EMAIL`**, not
> `SUPPORT_EMAIL`/`CONTACT_EMAIL`; nothing in the runtime has ever read the
> latter pair.
>
> `pnpm run test:email` is a dry run and reaches no provider.
> `pnpm run test:email -- --send` posts a real message to Resend — run it
> deliberately, from a machine with the production values, and not from CI.
>
> Provider acceptance is not delivery. `--send` tells you Resend took the
> message; confirm it arrived in the real inbox before claiming outbound email
> is live.

