# Current State — updated 2026-07-18 by Codex (Agent A)

## Operational database query contract — PR #25

- Branch `codex/database-query-contract` adds deterministic membership resolution, selective paid-entitlement and subscription queries, an unmapped-product fail-closed guard, and eight evidence-backed operational indexes.
- The index migration is append-only and adds no tables, rows, grants, RLS bypasses, storage changes, providers, or autonomous execution.
- `tests/database-query-contract.test.js` enforces patch idempotence, deterministic query ordering, server-side paid-access filtering, canonical index declarations, privilege neutrality, and RLS preservation.
- Implementation head `41ddf5cc26a72c423e7ddbef06bb40a34a5941e3` passed SONARA Industries CI, dependency scan, Docker Image CI, Supabase preview and migration validation, and Vercel preview.
- Hosted production was not changed. Migration `20260718193000_operational_query_index_contract.sql` remains approval-dependent and must follow migrations 40 and 41.

## PWA convergence — merged and deployed

- PR #23 merged to `main` as `277c3bb6c58bfe29399265a0dae52830c02d1d99`.
- Vercel production status succeeded for that exact main-branch merge commit.
- `public/site.webmanifest` is the single install manifest. The legacy `/manifest.webmanifest` URL reaches the existing permanent redirect instead of a duplicate static file.
- The shipped browser script registers `/sw.js` only on an explicit public-page allowlist and only in secure or local-development contexts.
- The service worker handles only public navigations and same-origin static assets. Authenticated customer, account, admin, and API traffic stays outside its response path.
- Public navigation is network-first with an offline fallback. Static assets use stale-while-revalidate. Private, no-store, cookie-bearing, opaque responses and the worker script itself are not cached.
- Executable tests run the shipped registration code, verify public and private route behavior, validate manifest assets, and enforce cache privacy.

## Production baseline

- Root Express application: `server.js` exported by `api/index.js`; Vercel rewrites traffic to `/api`.
- Production main remains `277c3bb6c58bfe29399265a0dae52830c02d1d99` until PR #25 is reviewed and merged.
- Supabase, Stripe, webhook, founder access, and checkout report configured. Google OAuth remains deferred. Legal pages remain review-required.
- Email delivery remains blocked by an invalid sender environment value.

## Database and storage baseline

- Canonical repository inventory: three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets in `lib/sonara-database-contract.cjs`.
- Repository contains 42 migrations after the PR #25 operational-index migration; production was last verified at 39 applied migrations.
- Migrations 40, 41, and 42 are repository-verified but require approved hosted application in timestamp order plus post-apply authorization, advisor, readiness, and query-index checks.
- All seven launch buckets were last verified private with scoped policies; anonymous reads returned no customer records in the recorded live checks.

## Security and launch status

- Hosted database changes require approved secure operator access outside chat.
- Paid access remains derived only from persisted active entitlements, active or trialing subscription state, or the documented owner and administrator path.
- Paid launch is not cleared. Remaining gates: secure operator access, migrations 40–42, valid sender configuration and delivery proof, Stripe test-mode lifecycle proof, and owner legal, pricing, and provider approvals.

Detailed historical evidence remains in `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the ADRs, research documents, and the reports directory.
