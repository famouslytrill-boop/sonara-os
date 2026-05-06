# Massive Update Audit

## Repo Root

Run root application checks from:

`C:\Users\AXPAY\Documents\GitHub\sonara-os`

This is the active Next.js application root with `package.json`, `app/`, `components/`, `lib/`, `scripts/`, `tests/`, `public/`, and the root `supabase/` migration folder used by local verification.

## App Root

The deployed app is the root Next.js App Router application:

- Framework: Next.js 16
- Router: `app/`
- Public assets: `public/`
- Verification scripts: `scripts/`
- Smoke tests: `tests/`

The nested scaffold at `sonara-industries/` remains the Supabase/monorepo scaffold area. Its scripts should forward to the root verification scripts when the same commands are run there.

## Where Commands Should Run

Run normal app commands from:

`C:\Users\AXPAY\Documents\GitHub\sonara-os`

Run the manual live Supabase push only after human review from:

`C:\Users\AXPAY\Documents\GitHub\sonara-os\sonara-industries`

Do not apply live migrations automatically from Codex.

## Existing Brand Files

- `config/brandSystem.ts`
- `components/BrandLegalFooter.tsx`
- `components/PublicShell.tsx`
- `components/ProductNav.tsx`
- `app/brand-system/page.tsx`

New working brand ecosystem files now live under:

- `lib/brand/`
- `components/brand/`
- `public/brand/`
- `app/brand/page.tsx`

## Existing Entity Files

- `lib/entities/config.ts`
- `lib/entities/security.ts`
- `lib/entities/operations.ts`
- `components/entities/`
- `app/dashboard/entities/`
- `supabase/migrations/008_entity_agent_operations.sql`

## Missing Scripts Found

The root package already had real backing scripts for database verification, entity security, heartbeat, smoke tests, and safe all/postdeploy checks. The nested `sonara-industries/package.json` needed forwarding scripts so commands do not fail when run from that folder.

## Migration Blockers

`sonara-industries/supabase/migrations/010_sonara_industries_v3_rls.sql` had two blockers:

- `gen_random_bytes(12)` must be qualified as `extensions.gen_random_bytes(12)`.
- The dynamic tenant policy loop referenced `company_key` on tables that only have `org_id`, especially `billing_customers`.

The migration is now grouped by ownership columns and avoids broad private-table policies.

## Manual Deployment Blockers

- Live Supabase migration retry is still manual.
- Brand/trademark review is still manual.
- Production secrets and dashboard settings are still manual.
- PWA PNG/icon export remains a human design export step if app stores require raster sizes.

## Recommended Command Order

1. `npm run build`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run scan:secrets`
5. `npm run verify:db`
6. `npm run verify:security`
7. `npm run verify:entity-security`
8. `npm run verify:brand`
9. `npm run heartbeat`
10. `npm run test:smoke`
11. `npm run verify:all`
12. `npm run verify:postdeploy`

After those pass and a human reviews SQL:

```powershell
cd C:\Users\AXPAY\Documents\GitHub\sonara-os\sonara-industries
npx supabase db push
```
