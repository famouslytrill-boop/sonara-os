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
pnpm run verify:email-env
pnpm run test:email
```

`pnpm run test:email` is a dry run. A real provider test requires:

```powershell
pnpm run test:email -- --send
```

Do not run the send test from CI. Confirm the message arrives in the real support inbox before claiming outbound email is live.

## Provider Setup Still Required

1. Verify `sonaraindustries.com` in Resend or the selected outbound provider.
2. Add DNS records for SPF, DKIM, and DMARC.
3. Add `RESEND_API_KEY` as a sensitive server-only Vercel environment variable.
4. Add `RESEND_FROM_EMAIL` and recipient routing variables in Vercel.
5. Redeploy after env values are changed.
6. Submit a test support/contact form and verify both storage and email behavior.
