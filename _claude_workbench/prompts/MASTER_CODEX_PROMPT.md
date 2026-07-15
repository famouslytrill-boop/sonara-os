# MASTER CODEX PROMPT — SONARA Software-in-a-Service Upgrade

You are Claude Code working as a senior full-stack engineer, product architect, launch engineer, QA lead, security reviewer, and design systems engineer.

## Project

SONARA Industries / SONARA OS

Repository: `famouslytrill-boop/sonara-os`

Branch: `main`

Local path: `C:\Users\AXPAY\famouslytrill-project`

## Mission

Completely stabilize, redesign, restructure, and upgrade SONARA OS into a premium SaaS + Software-in-a-Service platform ready for MVP paid customer usage.

SONARA is both SaaS and Software-in-a-Service. Users must be able to log in and use free tools, see paid tools, save real records when Supabase is configured, and track requests, deliverables, billing, support, and next actions.

## Products

- Business Builder
- Creator Studio
- Growth Studio

Parent company stays SONARA Industries. Do not rename it.

## Critical instruction

Do not blindly redesign only CSS. Wire real navigation, real shells, real service workflows, real database-backed records, real readiness states, real paywall states, and real admin/operator workflows.

## Design standard

Design like a premium Apple / Google / Tesla-level web app: bright but controlled, friendly, premium, fast, readable, mobile-first, clean, advanced, trustworthy. Use those brands only as quality references. Do not copy proprietary assets or code.

## Required routes

Public/core: `/`, `/start`, `/service-catalog`, `/dashboard`, `/requests`, `/deliverables`, `/billing`, `/support`, `/account`, `/account/setup`, `/pricing`, `/contact`, `/readiness`, `/legal`, `/terms`, `/privacy`, `/refund-policy`, `/cookies`, `/accessibility`, `/acceptable-use`, `/earnings-disclaimer`.

Admin: `/admin`, `/admin/env-readiness`, `/admin/requests`, `/admin/deliverables`, `/admin/support`, `/admin/billing`, `/admin/webhooks`, `/admin/users`, `/admin/roles`, `/admin/workspaces`, `/admin/catalog`, `/admin/storage`, `/admin/system`, `/admin/ai-gateway`.

Business Builder: `/business-builder`, `/business-builder/dashboard`, `/business-builder/start`, `/business-builder/catalog`, `/business-builder/tools`, `/business-builder/offers`, `/business-builder/customers`, `/business-builder/records`, `/business-builder/launch-readiness`, `/business-builder/deliverables`, `/business-builder/billing`, `/business-builder/support`.

Creator Studio: `/creator-studio`, `/creator-studio/dashboard`, `/creator-studio/start`, `/creator-studio/catalog`, `/creator-studio/tools`, `/creator-studio/assets`, `/creator-studio/offers/free`, `/creator-studio/music-system`, `/creator-studio/releases`, `/creator-studio/deliverables`, `/creator-studio/support`.

Growth Studio: `/growth-studio`, `/growth-studio/dashboard`, `/growth-studio/start`, `/growth-studio/catalog`, `/growth-studio/tools`, `/growth-studio/campaigns`, `/growth-studio/leads`, `/growth-studio/checklist`, `/growth-studio/deliverables`, `/growth-studio/support`.

Every visible button and nav item must go to a real route.

## Free tools

Business Builder: offer outline generator, basic pricing calculator, customer record starter, launch checklist viewer, business readiness score, simple service package builder.

Creator Studio: creator profile outline, asset checklist, release checklist, prompt/brief builder, basic content plan, music-system blueprint viewer.

Growth Studio: campaign outline, lead follow-up script, consent checklist, offer angle generator, simple KPI calculator, growth readiness score.

Free tools may save limited records if database is configured. If saving is unavailable, render output on screen and show: `Save requires account database setup.`

## Paid tools

Paid users get saved workspaces, advanced outputs, deliverable tracking, premium templates, operator/admin review queue, billing-backed service requests, and exports where implemented.

Paid access unlocks only if owner/admin override is true or active/trialing subscription is confirmed in billing state. Never unlock paid tools from checkout redirect alone.

## Database requirements

Use Supabase if configured. If missing tables, show setup-required with exact missing table. Do not fake saves.

Add or reuse: service_catalog_items, service_requests, service_request_events, service_deliverables, service_comments, service_tasks, service_files, customer_workspaces, workspace_memberships, support_requests, billing_subscriptions, billing_webhook_events, module_outputs.

Before creating tables, inspect migrations and reuse equivalent tables where present.

## Storage readiness

Verify/setup-required: avatars, business-assets, creator-assets, music-stems, release-packages, support-attachments, exports. Do not fake bucket existence.

## Required POST routes

- `POST /service-requests`
- `POST /business-builder/tools/offer`
- `POST /business-builder/tools/pricing`
- `POST /business-builder/tools/readiness`
- `POST /creator-studio/tools/brief`
- `POST /creator-studio/tools/release-checklist`
- `POST /creator-studio/tools/music-blueprint`
- `POST /growth-studio/tools/campaign`
- `POST /growth-studio/tools/lead-followup`
- `POST /growth-studio/tools/readiness`
- `POST /support/request`
- `POST /account/setup/organization`

Each POST route must validate input, require login if needed, identify workspace/organization when needed, check free/paid permission, insert real record if table is available, return useful HTML for browser submits, return JSON for API clients, include reference ID if saved, and show exact setup-required dependency if missing.

## Dashboard

Update `/dashboard` into a command center with welcome/status panel, product workspace cards, free tools, paid tools, active requests, deliverables, billing status, setup blockers, next best action, support status, admin notice, and links to all three products.

If no organization membership, show create workspace/account setup path and keep free tools discoverable.

## Admin console

Update `/admin` into operations center: requests, deliverables, support, billing events, roles, memberships, blockers, catalog, system health, storage, webhooks, formula library, ecosystem manifest, optional AI gateway. Every card links to a real route.

## Billing/paywall

Keep `/api/checkout/session`, `/api/billing/create-checkout-session`, `/api/webhooks/stripe`, `/api/stripe/webhook`, `/pricing`, `/business-builder/billing`.

Add billing state panel: free plan, checkout configured, Stripe secret configured, webhook secret configured, last webhook count, subscription count/status, paid access reason.

## Visual/interface requirements

Desktop app shell, mobile stacked app shell, no horizontal overflow, no clipped hero text, no bad encoding like `â€¢`, actionable cards, 44px tap targets, product identities: Business Builder green/gold, Creator Studio magenta/violet/cyan, Growth Studio cyan/green, Admin gold/red/dark.

## Optional OmniRoute

Add OmniRoute as optional developer/operator AI gateway only. Repo: https://github.com/diegosouzapw/OmniRoute

Add docs, `.env.example` entries, `lib/optional-ai-gateway.cjs`, `/admin/ai-gateway`, and readiness detection. Do not copy OmniRoute source, require it for public site, or expose keys.

## Vercel

Keep root Express deployment. Do not change root directory to frontend. `functions.api/index.js.includeFiles` must be a string glob, not an array. Preserve rewrites to API.

## Required tests

Add/update tests proving homepage 200, Software-in-a-Service language, free tool links, workspace links, no `â€¢`, public assets 200, product routes valid, free tool routes exist, dashboard protected behavior, admin protected, Stripe routes exist, setup-required exact dependency, vercel.json valid, includeFiles string, unknown route 404, lint/build/test/scan pass.

## Required commands

```powershell
npm install
npm run build
npm test
npm run scan:client-secrets
npm run lint
npm run verify:launch
git diff --check
```

Fix failures. Do not bypass.

## Commit

```powershell
git status
git add .
git commit -m "Upgrade SONARA software-in-a-service app shell and workflows"
git push github main
```

## Final report

Write `reports/FINAL_REPORT.md` with summary, files changed, routes added/verified, free tools, paid protections, DB changes, setup-required items, verification results, manual steps, and confirmation no secrets were exposed.
