# SONARA Live Readiness Consolidated Plan

Date: 2026-05-30
Branch: `feat/sonara-platform-redesign-and-research-lab`

## Current State

- Root app uses Next.js App Router with pnpm 11.1.1.
- CI workflows use `pnpm/action-setup@v4`, `actions/setup-node@v5`, Node 22, and `pnpm-lock.yaml` cache.
- Public routes for core pages, support, legal, Research Lab, and open source already exist.
- Supabase migrations are timestamped and include prior duplicate-version and organization-membership dependency repairs.
- Support/contact/feedback forms exist and degrade when email/storage providers are not configured.
- Brand assets and manifest files exist, but favicon/icon references need a final consistency audit.

## Implementation Strategy

1. Keep changes append-only and scoped. Do not delete useful existing work or weaken gates.
2. Add missing safety checks and package scripts for public claims, risky features, license risk, and env safety.
3. Add missing public route surfaces only where files are absent, then wire footer, sitemap, robots, and route smoke coverage.
4. Add database foundations through new timestamped migrations only.
5. Add governed scaffolds for Permission Center, Business Builder sub-apps, Creator Studio tooling, Growth Studio planning, admin/owner command surfaces, and infrastructure docs.
6. Align favicon/manifest documentation and references without inventing a new brand mark.
7. Keep external tools as research/reference entries unless a reviewed integration already exists.
8. Run required pnpm gates and document any skipped Supabase local validation honestly.

## Non-Automated Human Tasks

- Real secrets and provider environment variables.
- DNS, email routing, SPF/DKIM/DMARC, and support inbox ownership.
- Stripe/Supabase/Vercel account approvals and production deploy approval.
- Legal, trademark, pricing, and open-source license review.
- Final PR review, merge, and production rollout.
