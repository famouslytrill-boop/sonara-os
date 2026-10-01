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
| Authentication | `/login`, `/signup`, `/logout`, `/forgot-password`, `/reset-password`, `/auth/google`, `/auth/callback` |

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

## Business owner controls

`/owner/administration`, `/owner/agent-activity`, `/owner/agent-schedule`.

`/owner/administration` lets a business owner see which parts of their own
business are running and pause or restart one. It is organization-scoped: every
read and every write is filtered to the caller's organization, status is an
allow-list of three values, and nothing is deleted.

The operator console that used to be listed here -- 24 pages under `/admin`,
plus 15 JSON endpoints under `/api/admin` -- was removed on 1 October 2026 at
the owner's instruction. Every one of those paths now answers 404. Removing it
also removed `verifyAdminRequest`, which `resolveWorkspaceAccess` and
`requireBusinessManager` each consulted before resolving a customer session: a
SONARA-Industries staff cookie was an owner of every organization on the
platform. There is no such session any more and no such branch in either
middleware.


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
