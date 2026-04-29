# Launch Checklist

Last checklist run: 2026-04-29

Production deployment verified:

```text
dpl_4qFV9Dkzxe3Uhrvds8aigoJteMJ3
https://sonaraindustries.com
```

## Code

- [x] `npm run build` passes.
- [x] `npm audit --audit-level=moderate` reports no moderate-or-higher vulnerabilities.
- [x] `npm run validate:infrastructure` passes.
- [x] `.env.local` is not committed.
- [x] `.vercel`, `.next`, `node_modules`, logs, and build output are ignored.
- [x] GitHub `main` contains the corrected frontend project root.
- [x] Active app root is the frontend folder containing `package.json`, `app`, `components`, `public`, and `supabase`.
- [ ] Remove or archive the stray `C:\Users\AXPAY\.git` folder after confirming nothing important depends on it.

## Environment

- [x] `SONARA_AI_PROVIDER=local_rules`
- [x] `SONARA_PROVIDER_TIMEOUT_MS=6000`
- [x] `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com`
- [x] `OPENAI_API_KEY` is blank or absent unless BYOK mode is intentionally enabled.
- [x] Stripe keys are blank until live products and prices are ready.
- [x] Supabase keys are blank until the Supabase project is configured.

## Supabase

- [ ] Create or open the Supabase project.
- [ ] Verify saved SQL query results for `sonara_projects` and `sonara_sound_assets`.
- [ ] Run `supabase/migrations/004_sonara_final_launch.sql` once if required tables or columns are missing.
- [ ] Add Vercel env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=sonara-releases`
- [x] Launch migration is idempotent and includes RLS policies for projects, release plans, billing reads, storage, and sound metadata reads.
- [ ] Configure Auth redirect URLs:
  - `https://sonaraindustries.com/dashboard`
  - `https://sonaraindustries.com/library`
- [ ] Test sign up, login, logout, and protected routing.
- [ ] Test saving a project to `sonara_projects`.
- [ ] Test listing and deleting saved projects.

## Stripe

- [ ] Create Starter, Pro Artist, and Studio monthly subscription products.
- [ ] Add price IDs to Vercel:
  - `STRIPE_PRICE_STARTER_MONTHLY`
  - `STRIPE_PRICE_PRO_ARTIST_MONTHLY`
  - `STRIPE_PRICE_STUDIO_MONTHLY`
- [ ] Create one-time kit products and add price IDs to Vercel:
  - `STRIPE_PRICE_STARTER_PROMPT_PACK`
  - `STRIPE_PRICE_VISUAL_IDENTITY_PROMPT_PACK`
  - `STRIPE_PRICE_AR_MARKET_AUDIT_KIT`
  - `STRIPE_PRICE_RELEASE_PLANNER_KIT`
  - `STRIPE_PRICE_ARTIST_OS_PRO_KIT`
  - `STRIPE_PRICE_ALBUM_BUILDER_SYSTEM`
  - `STRIPE_PRICE_LOCAL_BUSINESS_MARKETING_KIT`
  - `STRIPE_PRICE_REVENUE_PATHWAY_BLUEPRINT`
- [ ] Add `STRIPE_SECRET_KEY`.
- [ ] Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- [ ] Add `STRIPE_WEBHOOK_SECRET` after webhook endpoint setup.
- [ ] Test monthly subscription checkout in Stripe test mode.
- [ ] Test one-time kit checkout in Stripe test mode.
- [x] Confirm failed/missing Stripe config returns a safe disabled state.

## Production

- [x] Deploy Vercel production from the frontend root.
- [x] Confirm `https://sonaraindustries.com/create` returns `200`.
- [x] Confirm `/api/sonara/analyze` returns `local_rules_complete`.
- [x] Confirm export ZIP generation works.
- [x] Confirm HTTPS is active for `sonaraindustries.com` and `www.sonaraindustries.com`.
- [ ] Review mobile layout on a phone viewport.
- [ ] Complete `docs/MOBILE_QA_CHECKLIST.md`.
- [ ] Complete `docs/GOOGLE_PLAY_LAUNCH_CHECKLIST.md` before Android store submission.

## Final Human Review

- [x] No demo text is prefilled in user-facing forms.
- [x] No private keys appear in repo files.
- [x] No profit, hit, placement, legal, tax, or medical guarantees appear in product copy.
- [x] A&R Intelligence, Decision Engine, and Revenue Pathway Engine are framed as planning and readiness tools.
- [x] Prompt Vault, Artist OS, Content Studio, Visual Builder, and Local Business Kits are framed as active creator planning tools.
- [x] User can understand the next practical move after generating a blueprint.
