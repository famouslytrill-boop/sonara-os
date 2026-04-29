# SONARA Launch Execution Checklist

Status as of this repo update:

- Local build and typecheck pass.
- Vercel production deployment is connected to `sonaraindustries.com`.
- Security headers are configured in `frontend/next.config.ts`.
- Supabase app wiring exists for login, protected dashboard routing, and saved projects.
- Supabase SQL lives in `infra/supabase/sonara_launch_schema.sql`.
- Stripe checkout route and pricing tier UI are wired, but require real Stripe keys and price IDs.

Manual account steps still required:

1. Create or open the Supabase project.
2. Run `infra/supabase/sonara_launch_schema.sql` in the Supabase SQL editor.
3. Add Supabase env vars to Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=sonara-releases`
4. Configure Supabase Auth email settings and allowed redirect URLs:
   - `https://sonaraindustries.com/dashboard`
   - `https://sonaraindustries.com/library`
5. Create Stripe products/prices for Starter, Creator, and Studio.
6. Add Stripe env vars to Vercel:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_STARTER`
   - `STRIPE_PRICE_CREATOR`
   - `STRIPE_PRICE_STUDIO`
7. Connect a real GitHub repository to Vercel for automatic deploys from `main`.
8. Test on desktop and phone after DNS and env vars are live.
