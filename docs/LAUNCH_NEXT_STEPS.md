# Launch Next Steps

## Required Before Merge

- Confirm `pnpm install --frozen-lockfile` passes.
- Confirm `pnpm audit --audit-level moderate` passes.
- Confirm `pnpm run typecheck` passes.
- Confirm `pnpm run build` passes.
- Confirm no duplicate Supabase migration version prefixes remain.
- Confirm no `package-lock.json` exists.
- Confirm no secrets are committed.
- Confirm Supabase Preview passes or intentionally skips because required secrets are missing.

## Required Before Public Launch

- Add real Vercel environment variables.
- Add real Supabase project secrets.
- Apply and verify Supabase migrations in a safe environment.
- Configure real Stripe keys and webhook endpoint.
- Configure a real support email/provider if public support delivery is required.
- Review legal, privacy, refund, security, support, and open-source policy pages with the appropriate human reviewer.
- Test real login, checkout, webhook processing, support form storage, and mobile layouts.

## Support/Contact Follow-Up

- Decide whether support requests should go to Supabase, an email provider, or a dedicated helpdesk.
- Add rate limiting or CAPTCHA before high-traffic launch.
- Define support retention and deletion policy.
- Confirm security-report handling path.
