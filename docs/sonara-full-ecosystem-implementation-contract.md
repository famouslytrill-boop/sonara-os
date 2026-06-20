# SONARA Full Ecosystem Implementation Contract

This is the product and engineering contract for the SONARA Industries platform-builder system.

## Core rule

Every visible feature must produce a real result or be honestly gated.

Allowed states:

- Working: database/API/backend logic exists.
- Locked: paywall blocks access honestly.
- Setup required: external service is missing or invalid.
- Disabled: future feature, clearly labeled.
- Hidden: not ready for users.

No fake records, fake users, fake activity, fake testimonials, fake billing state, fake automation, or dead buttons.

## Company ecosystems

The same platform engine powers:

- SONARA Industries
- Business Builder
- Creator Studio
- Growth Studio

Each ecosystem supports platforms, website pages, subpages, apps, subapps, modules, paywall, publishing, support, billing records, activity, and admin observability.

## Database foundation

The master migration is:

```text
supabase/migrations/012_sonara_full_ecosystem_schema.sql
```

It adds:

- plans
- organization_entitlements
- sonara_platforms
- sonara_platform_pages
- sonara_platform_apps
- sonara_platform_modules
- sonara_platform_publications
- sonara_platform_templates
- customer_records
- order_records
- creator_assets
- creator_releases
- growth_campaigns
- growth_leads
- growth_experiments
- automation_rules

## Required route contract

### Platform UI routes

```text
GET /business-builder/platforms
GET /creator-studio/platforms
GET /growth-studio/platforms
GET /sonara/platforms

GET /business-builder/platforms/new
GET /creator-studio/platforms/new
GET /growth-studio/platforms/new
GET /sonara/platforms/new

GET /business-builder/platforms/:id
GET /creator-studio/platforms/:id
GET /growth-studio/platforms/:id
GET /sonara/platforms/:id

GET /business-builder/platforms/:id/pages
GET /creator-studio/platforms/:id/pages
GET /growth-studio/platforms/:id/pages
GET /sonara/platforms/:id/pages

GET /business-builder/platforms/:id/apps
GET /creator-studio/platforms/:id/apps
GET /growth-studio/platforms/:id/apps
GET /sonara/platforms/:id/apps

GET /business-builder/platforms/:id/preview
GET /creator-studio/platforms/:id/preview
GET /growth-studio/platforms/:id/preview
GET /sonara/platforms/:id/preview
```

### Platform API routes

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
```

### Published public routes

```text
GET /p/business/:slug
GET /p/creator/:slug
GET /p/growth/:slug
GET /p/sonara/:slug
```

## Real-result requirements

### Platform creation

Must create a row in `sonara_platforms`, create default pages/apps/modules from template, log an `activity_event`, and appear in My Platforms.

### Page creation

Must create a row in `sonara_platform_pages`, support parent/subpage relationships, and appear in preview.

### App creation

Must create a row in `sonara_platform_apps`.

### Module creation

Must create a row in `sonara_platform_modules` and enforce `access_level`.

### Publishing

Publishing must create a snapshot row in `sonara_platform_publications`. Public routes must read the latest published snapshot, not draft state.

### Paywall

Free users get starter limits. Paid users unlock expanded limits and publishing. Admin/founder bypasses paywall without creating fake customer paid status.

Stripe webhook/database state is the payment source of truth. Checkout success URLs must never unlock paid access by themselves.

## Free limits

Default free limits:

- 1 platform
- 5 pages
- 2 apps/modules
- Preview only
- No publish
- No custom domain

## Paid access

Paid access enables:

- More platforms
- More pages
- More apps and modules
- Publishing
- Advanced customer records
- Billing workflows
- Support workflows
- Campaign/release/customer tools

## Company-specific outputs

### Business Builder

Users can create a business website, service pages, pricing page, contact form, intake app, customer records, orders, payment setup, support queue, and launch checklist.

### Creator Studio

Users can create a creator portfolio, release pages, campaign pages, asset library, release tracker, offer builder, monetization tools, and support queue.

### Growth Studio

Users can create campaign platforms, offer/funnel pages, lead pipelines, outreach trackers, experiment checklists, analytics dashboards, and automation settings.

Automation settings may exist, but actual automations must remain disabled until a real worker exists.

### SONARA Industries

Founder/admin can manage parent company platform, company pages, legal center, billing monitor, support monitor, product catalog, system readiness, and deployment status.

## Test requirements

Add tests for:

- Free user can create platform.
- Free user cannot publish.
- Paid user can publish.
- Admin can publish.
- Customer cannot access another organization's platform.
- Page creation saves row.
- App creation saves row.
- Module creation saves row.
- Published page renders real snapshot.
- Missing Stripe locks paid features.
- Missing Resend does not block support save.
- Missing database returns setup-required.

## Definition of done

SONARA is not done until:

- A new user can sign up.
- A profile and organization exist.
- The user can create a platform.
- The user can create pages and subpages.
- The user can create apps and subapps.
- The user can add modules.
- Free limits are enforced.
- Paid modules are locked.
- Stripe payment unlocks paid access through webhook.
- The user can preview.
- Paid/admin can publish.
- Public published pages render.
- Admin sees real counts.
- Support saves real requests.
- Email sends only if Resend is valid.
- No fake records appear.
- No dead buttons exist.
- No secrets display.
