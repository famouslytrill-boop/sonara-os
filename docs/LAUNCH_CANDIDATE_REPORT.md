# Launch Candidate Report

Date: 2026-05-20

Status: launch candidate prepared for review, not approved for public launch.

This report records the current local verification pass. It is not a Go decision. Production launch still requires the blockers and manual owner review items below to be closed.

## Ready Items

- Public route shell check passed for `/`, `/pricing`, `/about`, `/security`, and `/contact`.
- App route shell check passed for `/onboarding`, `/business-builder`, `/creator-studio`, and `/growth-studio`.
- Admin and shared route shell check passed for `/security-center`, `/admin/reliability-center`, `/admin/go-live-checklist`, `/admin/diagnostics`, and `/billing`.
- `pnpm install --frozen-lockfile` completed successfully.
- `pnpm run validate:infrastructure` passed.
- `pnpm run security:scan-artifacts` passed with `findings=0 critical=0`.
- `pnpm run typecheck` passed.
- `pnpm run lint` passed.
- `pnpm test` passed with 46 test files and 163 tests.
- `pnpm run build` passed when run by itself.
- `pnpm run smoke` passed.
- `.env.example` exists and includes public deployment variables, public Supabase variables, server-side Supabase service role placeholder, Stripe secret placeholders, Stripe publishable key placeholder, and Stripe price ID placeholders.
- Stripe test-mode documentation exists in `docs/STRIPE_TEST_MODE_WALKTHROUGH.md`.
- Owner payout boundaries are documented in `docs/OWNER_PAYOUTS.md`.
- Domain, DNS, and SSL checklists exist in `docs/DOMAIN_SETUP.md`, `docs/DNS_CHECKLIST.md`, and `docs/SSL_CHECKLIST.md`.
- Security and go-live checklists exist in `docs/LAUNCH_SECURITY_GATE.md` and `docs/GO_LIVE_CHECKLIST.md`.
- Final bug bash and known limitations docs exist in `docs/FINAL_BUG_BASH.md` and `docs/KNOWN_LIMITATIONS.md`.
- Feature flag validation passed through `pnpm run validate:infrastructure`.
- Advanced risky media capabilities are gated off by default:
  - `VIDEO_UPLOAD_PROCESSING_ENABLED=false`
  - `VOICE_CLONING_ENABLED=false`
  - `PUBLIC_VISUAL_GENERATION_ENABLED=false`
  - `LOCAL_VISUAL_MODELS_ENABLED=false`
- Unsafe launch and automation flags are locked false in `packages/web/src/lib/shared/feature-flags.ts`, including jailbreak tooling, provider policy bypass, system prompt extraction, automatic payment/security changes, unsafe public launch, and internal engine name launch exposure flags.

## Route Verification

| Area         | Route                       | Result   |
| ------------ | --------------------------- | -------- |
| Public       | `/`                         | HTTP 200 |
| Public       | `/pricing`                  | HTTP 200 |
| Public       | `/about`                    | HTTP 200 |
| Public       | `/security`                 | HTTP 200 |
| Public       | `/contact`                  | HTTP 200 |
| App          | `/onboarding`               | HTTP 200 |
| App          | `/business-builder`         | HTTP 200 |
| App          | `/creator-studio`           | HTTP 200 |
| App          | `/growth-studio`            | HTTP 200 |
| Admin/shared | `/security-center`          | HTTP 200 |
| Admin/shared | `/admin/reliability-center` | HTTP 200 |
| Admin/shared | `/admin/go-live-checklist`  | HTTP 200 |
| Admin/shared | `/admin/diagnostics`        | HTTP 200 |
| Admin/shared | `/billing`                  | HTTP 200 |

## Stripe Test Mode

Ready for owner review:

- Test-mode walkthrough exists and warns not to mix test mode and live mode.
- Stripe env placeholders are present and redacted in `.env.example`.
- Owner payout documentation states payouts happen in Stripe Dashboard and that SONARA One does not control payout schedules.
- The app does not store raw card numbers, CVV, or bank credentials in the documented MVP payment path.

Still required before live billing:

- Confirm real Stripe test products and prices exist.
- Confirm test webhook endpoint and webhook secret in the hosting environment.
- Complete test checkout, subscription update, `invoice.paid`, `invoice.payment_failed`, and customer portal checks.
- Confirm live mode env values are not mixed with test mode values.

## Domain And SSL

Ready for review:

- Canonical domain setup is documented.
- DNS checklist is documented.
- SSL checklist is documented.
- `.env.example` includes `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, and `NEXT_PUBLIC_COMPANY_NAME`.

Still required before public launch:

- Verify production hosting has the final canonical domain configured.
- Verify SSL is active for the root domain and redirect host.
- Verify `robots.txt`, `sitemap.xml`, `/api/health`, and page metadata use the production domain.
- Verify staging and production URLs are not mixed.

## Commands Run

| Command                                   | Result                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| `pnpm install --frozen-lockfile`          | Passed.                                                |
| `pnpm audit --audit-level moderate`       | Passed with no known vulnerabilities.                  |
| `pnpm run validate:infrastructure`        | Passed.                                                |
| `pnpm run security:scan-artifacts`        | Passed.                                                |
| `pnpm run typecheck`                      | Passed.                                                |
| `pnpm run lint`                           | Passed.                                                |
| `pnpm test`                               | Passed, with known non-blocking local storage warning. |
| `pnpm run build`                          | Passed when run by itself.                             |
| `pnpm run smoke`                          | Passed.                                                |
| Local dev HTTP route check on port `4275` | Passed for all requested routes.                       |

Note: one earlier parallel run of `pnpm run build` overlapped with `pnpm run smoke` and produced a package artifact race. `pnpm run build` passed when rerun alone, so the launch-candidate build result is passing.

## Blockers

1. Production environment values are not verified from this local checkout.
   - Hosting values for Supabase, Stripe, canonical URLs, support email, and app URL still require manual verification.

2. Stripe live readiness is not verified.
   - Test-mode checkout, webhook delivery, customer portal, invoice paid, and failed payment flows require owner-side Stripe configuration and test execution.

3. Supabase and RLS production readiness require manual verification.
   - The local checks confirm docs, migrations, and static validation, but production RLS behavior must be verified against the deployed database.

4. Full browser interaction and mobile visual QA were not completed in this pass.
   - HTTP route checks confirm routes render, but they do not replace form interaction, keyboard navigation, or mobile screenshot review.

## Remaining Warnings

- Vitest reports `--localstorage-file was provided without a valid path`. Tests still pass. This is tracked as a known warning and should be cleaned up before final release polish.
- Public launch is still blocked until payment, domain, SSL, production env, and RLS checks are completed.

## Recommendation

No-Go for public launch today.

The repo is ready for launch-candidate review because build, typecheck, lint, tests, smoke, route checks, source-leak scan, env examples, docs, audit, and feature-flag checks passed. It is not ready for live public launch until production-only verification items are closed.
