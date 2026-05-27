# Launch Checklist

Use this checklist before bringing the app online.

- [ ] `pnpm install --frozen-lockfile` passes locally.
- [ ] `pnpm audit --audit-level moderate` passes.
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run build` passes.
- [ ] GitHub Actions are green on the launch branch.
- [ ] Vercel preview is green and uses pnpm from the repo root.
- [ ] No `package-lock.json` exists.
- [ ] No real secrets are committed.
- [ ] Supabase environment variables are configured in Vercel.
- [ ] Supabase migrations are reviewed and pushed.
- [ ] RLS policies are reviewed before exposing private data.
- [ ] Stripe environment variables are configured in Vercel.
- [ ] Stripe webhook endpoint is configured and signature verification is tested.
- [ ] Stripe test checkout is completed before live mode.
- [ ] Domain is connected.
- [ ] SSL is active.
- [ ] Public pages render: `/`, `/pricing`, `/privacy`, `/terms`, `/contact`.
- [ ] Privacy policy, terms, and refund policy placeholders are reviewed before paid launch.
- [ ] Admin access is secured.
- [ ] Production smoke test is complete.

Do not mark launch ready if build, audit, Stripe webhook verification, auth, domain/SSL, or secret scanning is failing.
