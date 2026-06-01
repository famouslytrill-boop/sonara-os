# SONARA Master Fast Sprint Plan

## Current Repo Status
- Branch: `feat/sonara-platform-redesign-and-research-lab`.
- Package manager source of truth: `package.json` with `pnpm@11.1.1`.
- Baseline checks include lint, typecheck, build, route smoke checks, legacy copy checks, DB validation, and infrastructure validation.
- The worktree contains an in-progress live-readiness batch that must be verified before merge.

## Existing Scripts
- Core: `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`.
- Safety: `pnpm run check:legacy`, `pnpm run check:public-claims`, `pnpm run check:risky-features`, `pnpm run check:env-safety`, `pnpm run check-license-risk`.
- Infrastructure: `pnpm run verify:db`, `pnpm run validate:infrastructure`, `pnpm run smoke:routes`, `pnpm run verify:all`.
- Missing before this sprint: provider registry checks, technology registry checks, GitHub Radar checks, and observability config checks.

## Existing Routes
- Public routes exist for SONARA parent pages, products, pricing, legal, support, Research Lab, open-source policy, and trust surfaces.
- App routes exist for dashboard, settings, files, customers, bookings, payments, reviews, campaigns, and model comparison.
- This sprint adds gated readiness routes for admin/owner systems, GitHub Radar, voice agents, commerce planning, permission/device capabilities, and Business Builder sub-app planning.

## Existing Migrations
- Historical numbered migrations are preserved.
- Append-only fixes already added for organization memberships and research source policies.
- New append-only migrations are required for provider registry, feature flags, observability, workflow audit records, and GitHub Intelligence Engine tables.

## Missing Tables Before This Sprint
- Provider registry, feature flags, license/security reviews, observability events, workflow runs, agent action logs, and GitHub Radar tables were not yet represented as first-class database scaffolds.

## Missing Checks Before This Sprint
- Provider registry policy check.
- Technology registry policy check.
- GitHub Radar risk, secret, auto-install, score, blocked-claim, and public-copy checks.
- Observability config check.

## Missing UI Routes Before This Sprint
- GitHub Radar public/admin route family.
- Voice agent builder route family.
- Some commerce, POS planning, Growth Studio CRM/pipeline, and Creator Studio content readiness routes.

## Missing Security Gates Before This Sprint
- GitHub Radar no-auto-install checks.
- Provider registry secret-safety checks.
- Technology registry blocked/reference-only checks.
- Explicit agent/workflow approval policy scaffolds.

## Human Intervention Still Required
- Verify Vercel environment variables.
- Verify Supabase secrets in GitHub and rerun Supabase Preview.
- Confirm Supabase production migrations.
- Verify support inbox and outbound email provider setup.
- Configure Stripe/Square/PayPal providers when ready.
- Configure optional GitHub token for metadata sync.
- Complete legal, privacy, and license review before production enablement.
- Approve final PR merge and production deploy.
