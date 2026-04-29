# Launch Checklist

## Code

- [ ] `npm run build` passes.
- [ ] `npm audit --audit-level=moderate` reports no moderate-or-higher vulnerabilities.
- [ ] `npm run validate:infrastructure` passes.
- [ ] `.env.local` is not committed.
- [ ] `.vercel`, `.next`, `node_modules`, logs, and build output are ignored.
- [ ] GitHub `main` contains the corrected frontend project root.

## Environment

- [ ] `SONARA_AI_PROVIDER=local_rules`
- [ ] `SONARA_PROVIDER_TIMEOUT_MS=6000`
- [ ] `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com`
- [ ] `OPENAI_API_KEY` is blank or absent unless BYOK mode is intentionally enabled.
- [ ] Stripe keys are blank until live products and prices are ready.
- [ ] Supabase keys are blank until the Supabase project is configured.

## Supabase

- [ ] Create or open the Supabase project.
- [ ] Run `supabase/migrations/004_sonara_final_launch.sql`.
- [ ] Add Vercel env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=sonara-releases`
- [ ] Configure Auth redirect URLs:
  - `https://sonaraindustries.com/dashboard`
  - `https://sonaraindustries.com/library`
- [ ] Test sign up, login, logout, and protected routing.
- [ ] Test saving a project to `sonara_projects`.
- [ ] Test listing and deleting saved projects.

## Stripe

- [ ] Create Starter, Creator, and Studio subscription products.
- [ ] Add price IDs to Vercel:
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_CREATOR`
  - `STRIPE_PRICE_STUDIO`
- [ ] Add `STRIPE_SECRET_KEY`.
- [ ] Add `STRIPE_WEBHOOK_SECRET` after webhook endpoint setup.
- [ ] Test checkout in Stripe test mode.
- [ ] Confirm failed/missing Stripe config returns a safe disabled state.

## Production

- [ ] Deploy Vercel production from the frontend root.
- [ ] Confirm `https://sonaraindustries.com/create` returns `200`.
- [ ] Confirm `/api/sonara/analyze` returns `local_rules_complete`.
- [ ] Confirm export ZIP generation works.
- [ ] Confirm HTTPS is active for `sonaraindustries.com` and `www.sonaraindustries.com`.
- [ ] Review mobile layout on a phone viewport.

## Final Human Review

- [ ] No demo text is prefilled in user-facing forms.
- [ ] No private keys appear in repo files.
- [ ] No profit, hit, placement, legal, tax, or medical guarantees appear in product copy.
- [ ] User can understand the next practical move after generating a blueprint.

