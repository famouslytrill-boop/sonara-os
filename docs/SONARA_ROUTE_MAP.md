# SONARA Route Map

Date: 2026-07-15  
Machine-readable source: `lib/sonara-route-registry.cjs`  
Registration module for newly completed routes: `routes/sonara-route-registry-routes.cjs`

## Registry contract

Each required GET route records its title, description, product owner, visibility, sitemap inclusion, navigation placement, indexing policy, required role, required plan, required provider, readiness label, and canonical URL when public.

The registry contains 124 required GET routes. `scripts/verify-route-registry.cjs` proves that every entry is registered in Express, that method/path registrations are unique, and that protected routes never enter the public sitemap.

## Public and authentication

| Group | Routes |
| --- | --- |
| Public | `/`, `/start`, `/products`, `/service-catalog`, `/free-tools`, `/pricing`, `/how-it-works`, `/tutorials`, four tutorial pages, `/help`, `/contact`, `/security`, `/accessibility`, legal/policy pages, `/sitemap.xml`, `/robots.txt`, and the three product landing pages |
| Authentication | `/login`, `/signup`, `/logout`, `/forgot-password`, `/reset-password`, `/auth/callback` |

Only registry records with `visibility: public` and `sitemap: true` appear in `/sitemap.xml`. Authentication and protected application pages use `noindex,nofollow` metadata in the registry.

## Customer account and shared application

`/dashboard`, `/requests`, `/deliverables`, `/billing`, `/support`, `/notifications`, `/account`, `/account/profile`, `/account/security`, `/account/preferences`, `/account/setup`, `/account/workspaces`, `/account/integrations`.

These require a validated customer session. Anonymous HTML requests redirect to `/login`; API requests receive a safe error response.

## Business Builder

`/business-builder/dashboard`, `/start`, `/tutorial`, `/catalog`, `/tools`, `/offers`, `/pricing`, `/customers`, `/records`, `/employees`, `/locations`, `/inventory`, `/vendors`, `/routes`, `/vehicles`, `/launch-readiness`, `/requests`, `/deliverables`, `/billing`, `/support`.

Workspace and paid records remain server-gated. `/business-builder/pricing` is a canonical redirect to the shared pricing surface.

## Creator Studio

`/creator-studio/dashboard`, `/start`, `/tutorial`, `/catalog`, `/tools`, `/assets`, `/music-system`, `/offers`, `/releases`, `/content`, `/calendar`, `/media-kit`, `/rights`, `/requests`, `/deliverables`, `/billing`, `/support`.

## Growth Studio

`/growth-studio/dashboard`, `/start`, `/tutorial`, `/catalog`, `/tools`, `/campaigns`, `/leads`, `/followups`, `/content`, `/checklist`, `/analytics`, `/automations`, `/requests`, `/deliverables`, `/billing`, `/support`.

## Administrator

`/admin`, `/admin/env-readiness`, `/admin/system`, `/admin/database`, `/admin/storage`, `/admin/migrations`, `/admin/users`, `/admin/roles`, `/admin/organizations`, `/admin/workspaces`, `/admin/catalog`, `/admin/requests`, `/admin/deliverables`, `/admin/support`, `/admin/billing`, `/admin/webhooks`, `/admin/email`, `/admin/integrations`, `/admin/pipelines`, `/admin/deployments`, `/admin/audit`, `/admin/formulas`, `/admin/ecosystem`, `/admin/ai-gateway`.

All administrator pages use `requireAdmin`. Database, storage, migration, provider, and deployment pages are read-only operational views; no raw SQL or secret display is exposed.

## Redirect and error behavior

- Product tutorial aliases redirect to canonical `/tutorials/...` pages.
- Shared billing remains the canonical account entry and redirects to the existing product billing implementation where appropriate.
- Anonymous protected HTML routes redirect to `/login`.
- Unknown routes retain the existing branded 404 response.
- Setup-dependent routes identify the missing provider and do not pretend a write succeeded.

## Proof commands

```powershell
pnpm run smoke:routes
pnpm run verify:config
pnpm run verify:launch
```
