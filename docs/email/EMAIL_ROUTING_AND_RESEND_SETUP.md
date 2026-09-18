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

> **No email tooling exists in this repository.** `pnpm run verify:email-env`
> and `pnpm run test:email` are named above as they were written; neither is
> defined in `package.json`, and there is no email script under `scripts/`.
> Checked 18 September 2026: no script name or body in `package.json` contains
> "email" at all. The live environment check is `pnpm run verify:env`, which
> classifies every variable the code reads — including the email variables —
> but it sends nothing and proves no provider works.
>
> So outbound email cannot be verified from this repository today. Confirm it in
> the provider dashboard, and treat any claim that email is live as unproven
> until there is a script here that proves it.

> The instruction this replaces was more specific than the truth: it described
> `pnpm run test:email` as "a dry run" and `pnpm run test:email -- --send` as a
> real provider test, with a warning not to run the send from CI. None of those
> commands exist, so the caution was protecting a capability that was never
> there. Confirm the message arrives in the real support inbox before claiming
> outbound email is live — by sending one yourself, not by running this.

## Provider Setup Still Required

1. Verify `sonaraindustries.com` in Resend or the selected outbound provider.
2. Add DNS records for SPF, DKIM, and DMARC.
3. Add `RESEND_API_KEY` as a sensitive server-only Vercel environment variable.
4. Add `RESEND_FROM_EMAIL` and recipient routing variables in Vercel.
5. Redeploy after env values are changed.
6. Submit a test support/contact form and verify both storage and email behavior.
