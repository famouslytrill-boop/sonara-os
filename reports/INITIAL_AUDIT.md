# SONARA Initial Audit — Premium Application Rebuild

Date: 2026-07-14
Baseline commit: `7134895` (clean tree; one untracked scratch file
`debug-session.cjs` from an earlier debugging session, excluded from commits).

## Architecture

- Root Express app (`server.js`, ~4,300 lines) deployed to Vercel serverless
  via `api/index.js` (`module.exports = require("../server")`); `vercel.json`
  rewrites all traffic to `/api`, `includeFiles` is a string glob
  (`{public/**,routes/**,lib/**}`). Framework null; root deployment intact.
- Six injected route modules under `routes/`: infrastructure, ecosystem,
  formulas, creator-music readonly, last9 operational pages, and
  `sonara-service-lifecycle-routes.cjs` (this session's service platform).
  Two orphaned modules remain unmounted by design: creator-artist-system,
  free-launch-stack.
- Build-time codemods (`apply:runtime` chain) mutate `server.js` on every
  build/pretest; they are idempotent-by-guard and were re-verified green
  after every layout edit this session.
- 296 registered routes, zero duplicates (programmatic router scan).

## Data layer

- Raw `fetch` against Supabase REST with service-role key server-side only;
  anon key used solely for `/auth/v1` flows. No Supabase JS client in the
  Express app. All write helpers degrade to `setup_required` naming the
  exact dependency.
- 35 migration files. `20260714120000_sonara_service_lifecycle_runtime_tables.sql`
  added the service lifecycle tables plus the runtime-expected tables no
  earlier migration created (module_outputs, billing_subscriptions,
  billing_entitlements, billing_webhook_events, user_roles,
  business_memberships, business_employee_invites) with the unique
  constraints PostgREST upserts require. RLS enabled with service-role
  manage + org-member read policies. `public.is_org_member` helper exists
  from `20260603090000`.
- Storage: seven required buckets checked live via `/storage/v1/bucket`;
  never faked.

## Auth, billing, email

- Email/password auth via Supabase; HttpOnly session cookies
  (`sonara_customer_session`, `sonara_admin_session`); Google OAuth
  deliberately deferred (`/auth/callback` returns 503 setup-required).
- Paid gating: `requirePaidOrOwnerAccess` → owner/admin override or
  active/trialing `billing_entitlements`/`billing_subscriptions` written
  only by HMAC-verified Stripe webhooks (two endpoints, raw-body parsing
  before JSON middleware). Checkout redirect never unlocks.
- Resend server-side; honest `setup_required` fallbacks with reference IDs.

## Frontend

- Server-rendered HTML through a single `layout()` template: inline style
  block → `sonara-brand-system.css` → `sonara-friendly-premium.css` →
  `sonara-interface-engine.css` (+ `sonara-experience.js`,
  `sonara-interface-engine.js`, all `?v=interface-dom-20260714`).
- Interface engine ships a progressive-enhancement ladder (reduced-motion
  static → low-power static → Canvas 2D → WebGPU-presence quality hint),
  `aria-current` nav state, hero command panel tiles, mobile bottom quick
  bar (50px measured targets), no horizontal overflow, hero clip fix.
- `express.static` now resolves from `__dirname` (fixed after live 404
  repro when launched from a foreign cwd).
- Service worker `public/sw.js` is minimal (offline fallback for
  navigations, single cache name `sonara-stage-v1`) — flagged: no asset
  versioning story; to be rebuilt this phase.

## Verification baseline

```
npm run build               OK
npm test                    213 passing
npm run scan:client-secrets PASSED
npm run lint                0 problems
npm run verify:launch       exit 0
git diff --check            clean
```

## Gaps this rebuild addresses

1. Brand assets are generic (`favicon.svg`, `icon.svg`, old marks) — no
   original parent/product/admin identity system. → new `public/brand/`.
2. No design-token layer; palettes exist but are flattened by
   friendly-premium's `!important` cascade. → token block + shell layer.
3. Header is a flat 10+ pill row; no command palette/search; no sticky
   command bar. → app-shell v2 in engine CSS/JS.
4. Service lifecycle uses two short status lists, not the canonical
   ten-state lifecycle. → centralize.
5. Catalog items carry name/summary/price only — no slug, inputs,
   turnaround, deliverable type. → enrich defaults + rendering.
6. Homepage lacks "How SONARA works", free-tools preview, paid-workflow
   preview sections and the plain-words positioning sentence.
7. Missing routes: `/admin/integrations`, product `/requests` and
   `/content` pages, customer-facing `/business-builder/inventory`,
   `/vendors`, `/locations`.
8. OmniRoute env entries incomplete (`OMNIROUTE_ENABLED`, `OMNIROUTE_MODEL`).
9. No user_notifications / integration_statuses structures
   (saved_tool_outputs is served by the existing `module_outputs` table —
   reuse, not duplication).
10. No Dockerfile/compose/Rancher notes; no performance/accessibility/
    database/billing/deployment reports.
11. No haptics layer; motion lacks press/success micro-feedback.
12. Service worker has no stale-asset replacement strategy.
