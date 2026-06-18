# Deployment Checklist

Code checks:
- `pnpm install --frozen-lockfile`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`
- `pnpm run validate:migrations`

Provider checks:
- Vercel env vars entered for production and preview.
- Supabase Auth redirect URLs match production domain.
- Supabase migrations reviewed and applied.
- Stripe products and prices created.
- Stripe env values use `price_` IDs, not display prices or product IDs.
- Email provider and DNS are verified.

Launch rule:
Do not launch until CI passes, Vercel deploy passes, Supabase Preview passes or intentionally skips for missing secrets, support/contact flows are tested, and owner review approves.
