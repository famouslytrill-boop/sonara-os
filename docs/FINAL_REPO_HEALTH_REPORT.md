# Final Repo Health Report

Date: 2026-05-21

Status: local build-health pass, public launch not approved.

## Summary

The repo is locally reproducible and the required static web shell gates pass. The app should remain in launch-candidate review, not public launch, until production-only checks are closed.

Launch readiness score: 78/100.

Reasoning: build/typecheck/lint/test/smoke/source-leak checks pass, routes are centrally registered, safety gates exist, and pricing/payment boundaries are documented. The score is held down by unverified production Stripe/Supabase/domain/SSL state, placeholder legal pages, and beta/admin-gated systems that must stay clearly labeled.

## Package Manager

- Package manager: pnpm.
- Lockfile: `pnpm-lock.yaml`.
- Workspaces: `packages/*`.
- Install command verified: `pnpm install`.

## Framework And Build Shape

- App shape: static TypeScript web shell under `packages/web`.
- Runtime routing: centralized route registry in `packages/web/src/routes/route-manifest.ts`.
- Build system: custom Node/TypeScript transpile scripts under `scripts/`, including package builds, copied static web artifacts, `_headers`, `robots.txt`, `sitemap.xml`, and static `/api/health` output.
- Installed web dependencies include React, Supabase, Stripe-adjacent dependencies, Three, and Tailwind. This checkout currently builds through the custom static package scripts rather than a Next app runtime.

## Packages

- `@signal-os/autopilot`
- `@signal-os/core`
- `@signal-os/export`
- `@signal-os/owner-confirmation-lock`
- `@signal-os/provider-gateway`
- `@signal-os/routes`
- `@signal-os/runtime`
- `@signal-os/spec-driven-build-system`
- `@signal-os/ui`
- `@signal-os/web`

## App Routes

The route manifest currently registers 119 routes across:

- Public launch pages: `/`, `/pricing`, `/about`, `/security`, `/contact`, `/terms`, `/privacy`.
- Product surfaces: `/business-builder`, `/creator-studio`, `/growth-studio`, and their MVP child routes.
- Onboarding/setup: `/onboarding`, product setup routes, and launch checklist routes.
- Admin/security: `/security-center`, owner review, diagnostics, go-live checklist, AI providers, reliability, developer utilities, dev tunnel tools, operations, and automation rules.
- Creator workflow routes: `/create`, `/analyze`, `/compose`, `/mutation`, `/export`.
- Legacy/expanded strategy and catalog routes remain registered and should be kept gated or accurately labeled until they are launch-ready.

## Database And Migration Status

- Supabase migrations exist under `supabase/migrations`:
  - `0001_auth_organization_scaffold.sql`
  - `0002_launch_mvp_core_tables.sql`
- Owner Confirmation Lock migration exists under `infra/db/migrations`:
  - `owner_confirmation_lock.sql`
- Migration validation passed through `pnpm run smoke` and `pnpm run validate:infrastructure`.
- Production database readiness still requires manual Supabase project verification, RLS policy testing, and confirmation that service-role keys remain server-only.

## Billing, Stripe, And Owner Payment Path

- Stripe test-mode walkthrough exists in `docs/STRIPE_TEST_MODE_WALKTHROUGH.md`.
- Owner payout boundaries exist in `docs/OWNER_PAYOUTS.md`.
- The documented MVP path uses hosted Stripe Checkout, Stripe Payment Links, Stripe Billing, or Stripe Customer Portal patterns.
- The app must not store raw card numbers, CVV, full bank credentials, or provider secrets client-side.
- Live billing remains blocked until test products, prices, webhooks, customer portal, subscription updates, invoice events, and test/live separation are verified in Stripe.

## Legal, Market, And Profit Readiness

- Marketable core promise exists: build, prove, get paid, grow.
- Pricing tiers and setup service tiers are documented in the public pricing surface.
- Profitability is not guaranteed and must not be claimed.
- Terms and privacy pages are placeholders and require professional review before final public launch.
- Legal Readiness surfaces help prepare review packets only; they must not be described as legal advice or compliance certification.

## Fixed In This Sprint

- Public product cards now display a `Launch status` label.
- Business Builder dashboard cards now use launch-lock labels such as `Beta` and `Requires Review`.
- Creator Studio dashboard cards now label incomplete or risky systems as `Beta`, `Admin Only`, `Coming Soon`, or `Requires Review`.
- Growth Studio dashboard cards now label placeholders and risky workflows as `Coming Soon`, `Admin Only`, or `Requires Review`.
- Security Center cards now use `Live`, `Beta`, `Admin Only`, and `Requires Review` labels instead of vague status wording.
- Beta media safety pages now use `Admin Only`, `Beta`, and `Requires Review` labels for gated media systems.

## Known Build Issues

No blocking build, typecheck, lint, test, smoke, infrastructure, or source-leak scan failures were found in this pass.

Known non-blocking warning:

- Vitest/smoke emits `--localstorage-file was provided without a valid path`.

## Remaining Blockers

1. `pnpm audit --audit-level moderate` passes with no known vulnerabilities.
2. Stripe live billing is not production verified.
3. Supabase production RLS behavior is not manually verified.
4. Domain, DNS, SSL, canonical URL, and hosting env values are not verified from this local checkout.
5. Terms and privacy pages are placeholders and need professional legal review.
6. Full mobile visual QA and end-to-end browser interaction QA are still required before public launch.

## Recommendation

Proceed with launch-candidate review only. Do not mark the platform public-launch approved until the remaining blockers are closed and the reality audit statuses remain visible in customer/admin surfaces.
