# Email Readiness Report

## Completed In Code

- Public contact/support/feedback forms validate input server-side.
- Contact and feedback forms include consent.
- Honeypot and minimum time checks are present.
- Support actions generate a correlation ID for every submission attempt.
- Supabase storage is attempted only from server-side actions.
- Outbound email is attempted only from server-side code.
- Resend delivery runs only when `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the routed recipient are configured.
- Missing provider setup returns a clear fallback message instead of a raw stack trace.

## Current Provider Status

- Cloudflare inbound email routing is a provider/DNS task and must be verified outside the repo.
- Resend outbound email remains setup-gated until a new key is created, marked sensitive in Vercel, and the domain is verified.
- A previously exposed Resend key must be considered compromised and revoked.

## Verification Commands

```powershell
pnpm run verify:email-env
pnpm run test:email
pnpm run test:email -- --send
```

The send command must be run manually only after the new key and sender are configured.

## Launch Blockers

- Rotate exposed Resend key.
- Confirm `sonaraindustries.com` email DNS records.
- Add Vercel production env vars.
- Redeploy after env changes.
- Submit real support/contact tests and verify email arrival.
