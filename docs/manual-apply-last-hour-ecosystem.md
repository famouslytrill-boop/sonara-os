# Manual Apply Guide: SONARA Full Ecosystem

The last-hour ecosystem infrastructure has been added to the repository as:

```text
supabase/migrations/012_sonara_full_ecosystem_schema.sql
```

This migration adds the database layer for:

- company-wide platform builder
- website pages and subpages
- apps and subapps
- modules
- templates
- paywall plans and entitlements
- customer records
- order records
- creator assets and releases
- growth campaigns, leads, and experiments
- automation rules in disabled-by-default state

## Apply locally

From PowerShell:

```powershell
cd C:\Users\AXPAY\famouslytrill-project

git pull origin main
# If Vercel deploys from GitHub remote too, also pull or sync that remote as needed.

npx supabase migration list
npx supabase db push
```

If Supabase reports migration history mismatch, do not reset the database. Repair migration history only as prompted by the Supabase CLI.

## Verify Supabase tables

Run in Supabase SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans',
    'organization_entitlements',
    'sonara_platforms',
    'sonara_platform_pages',
    'sonara_platform_apps',
    'sonara_platform_modules',
    'sonara_platform_publications',
    'sonara_platform_templates',
    'customer_records',
    'order_records',
    'creator_assets',
    'creator_releases',
    'growth_campaigns',
    'growth_leads',
    'growth_experiments',
    'automation_rules'
  )
order by table_name;
```

Verify seeded plans and templates:

```sql
select plan_key, company_key, name, billing_interval, access_level, limits
from public.plans
order by company_key, plan_key;

select company_key, template_key, name, platform_type, access_level, status
from public.sonara_platform_templates
order by company_key, template_key;
```

Expected:

- 16 ecosystem tables from the verification query
- 5 plans
- 4 platform templates

## Source-code wiring still required

The migration creates the infrastructure. The Express app still needs route wiring for:

```text
GET    /api/platforms
POST   /api/platforms
GET    /api/platforms/:id
PATCH  /api/platforms/:id
DELETE /api/platforms/:id

GET    /api/platforms/:id/pages
POST   /api/platforms/:id/pages
PATCH  /api/platform-pages/:pageId
DELETE /api/platform-pages/:pageId

GET    /api/platforms/:id/apps
POST   /api/platforms/:id/apps
PATCH  /api/platform-apps/:appId
DELETE /api/platform-apps/:appId

GET    /api/platform-apps/:appId/modules
POST   /api/platform-apps/:appId/modules
PATCH  /api/platform-modules/:moduleId
DELETE /api/platform-modules/:moduleId

POST   /api/platforms/:id/publish
GET    /p/business/:slug
GET    /p/creator/:slug
GET    /p/growth/:slug
GET    /p/sonara/:slug
```

Do not add visible platform-builder buttons until those routes work.

## Quality gates

After applying source-code wiring:

```powershell
node --check .\server.js
pnpm run build
pnpm test
pnpm run scan:client-secrets
```

Do not deploy if build, tests, or secret scan fail.
