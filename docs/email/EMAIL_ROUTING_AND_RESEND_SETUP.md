# Email Routing And Resend Setup

Cloudflare Email Routing handles inbound forwarding for public inboxes such as `support@sonaraindustries.com`. It does not send outbound application email.

Outbound app notifications require a verified email provider. The current server-side adapter supports Resend when these Vercel environment variables are configured:

- `RESEND_API_KEY` - sensitive, server-only
- `RESEND_FROM_EMAIL` - for example `SONARA Industries <no-reply@sonaraindustries.com>`
- `SUPPORT_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`

Do not put `RESEND_API_KEY` in `NEXT_PUBLIC_*` variables, screenshots, frontend code, browser console snippets, or public docs.

## Routing

- Contact/general requests route to `CONTACT_EMAIL`.
- Support requests route to `SUPPORT_EMAIL`.
- Help requests route to `HELP_EMAIL`.
- Billing/refund and sales/pricing requests route to `BILLING_EMAIL`.
- Security reports route to `SECURITY_EMAIL`.
- Privacy/legal requests route to `PRIVACY_EMAIL` or `LEGAL_EMAIL`.
- Feedback notifications route to `SUPPORT_EMAIL`.

## Local Verification

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
> So outbound email cannot be verified from this repository today. Confirm it in
> the provider dashboard, and treat any claim that email is live as unproven
> until there is a script here that proves it.

> The instruction this replaces was more specific than the truth: it described
> `pnpm run test:email` as "a dry run" and `pnpm run test:email -- --send` as a
> real provider test, with a warning not to run the send from CI. That warning
> was written before the aliases existed and is now doing the job it was written
> for: both commands work as described, and the send reaches Resend. Confirm the
> message arrives in the real support inbox before claiming outbound email is
> live — the command tells you the provider accepted it, which is not the same
> as somebody receiving it.

## Provider Setup Still Required

1. Verify `sonaraindustries.com` in Resend or the selected outbound provider.
2. Add DNS records for SPF, DKIM, and DMARC.
3. Add `RESEND_API_KEY` as a sensitive server-only Vercel environment variable.
4. Add `RESEND_FROM_EMAIL` and recipient routing variables in Vercel.
5. Redeploy after env values are changed.
6. Submit a test support/contact form and verify both storage and email behavior.
