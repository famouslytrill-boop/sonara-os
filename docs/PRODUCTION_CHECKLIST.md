# Production Checklist

## Required Before Public Launch

- [ ] `pnpm install --frozen-lockfile` passes.
- [ ] `pnpm audit --audit-level moderate` passes or a reviewed exception is documented.
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm run build` passes.
- [ ] No `package-lock.json` exists.
- [ ] No real secrets are committed.
- [ ] Old public product names are absent from active UI.
- [ ] `sonaraindustries.com` is connected.
- [ ] SSL is active.
- [ ] Legal pages are present as review-ready drafts.
- [ ] Privacy, terms, refund, acceptable-use, security, and accessibility pages are linked.
- [ ] Stripe keys and price IDs are configured in Vercel.
- [ ] Stripe webhook signature verification is active.
- [ ] Supabase env vars are configured.
- [ ] RLS policies are reviewed before production data.
- [ ] Admin access is secured.
- [ ] Sound, voice, push, SMS, and haptics preferences default to off or user-controlled.

## Human-Required Tasks

- Review legal pages with qualified counsel.
- Configure production database and storage buckets.
- Test real checkout and customer portal.
- Test real login and role access.
- Configure support email and provider alerts.
- Complete final domain, cookie, privacy, and analytics review.
