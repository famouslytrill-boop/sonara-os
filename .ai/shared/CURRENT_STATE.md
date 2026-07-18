# Current State — updated 2026-07-18 by Codex (Agent A)

## Operational database query contract — merged and deployed

- PR #25 merged to `main` as `9ca3487d38050322ab2b51a91f98bc92553fb3ac`.
- Vercel production status succeeded for that exact main-branch merge commit.
- The release adds deterministic membership resolution, selective paid-entitlement and subscription queries, an unmapped-product fail-closed guard, and eight evidence-backed operational indexes.
- `tests/database-query-contract.test.js` enforces patch idempotence, deterministic query ordering, server-side paid-access filtering, canonical index declarations, privilege neutrality, and RLS preservation.
- Final PR head `b96bd14cbe4275da2c27a841eed959f3cab39c46` passed SONARA Industries CI, dependency scan, Docker Image CI, Supabase preview and migration validation, and Vercel preview before merge.
- The application and source-code update is deployed, but the hosted Supabase schema was not mutated. Migration `20260718193000_operational_query_index_contract.sql` remains approval-dependent and must follow migrations 40 and 41.

## PWA convergence — merged and deployed

- PR #23 merged to `main` as `277c3bb6c58bfe29399265a0dae52830c02d1d99`.
- `public/site.webmanifest` is the single install manifest. The legacy `/manifest.webmanifest` URL reaches the permanent redirect instead of a duplicate static file.
- The shipped browser script registers `/sw.js` only on an explicit public-page allowlist and only in secure or local-development contexts.
- The service worker handles only public navigations and same-origin static assets. Authenticated customer, account, admin, and API traffic stays outside its response path.
- Public navigation is network-first with an offline fallback. Static assets use stale-while-revalidate. Private, no-store, cookie-bearing, opaque responses and the worker script itself are not cached.

## Production baseline

- Root Express application: `server.js` exported by `api/index.js`; Vercel rewrites traffic to `/api`.
- Production main is `9ca3487d38050322ab2b51a91f98bc92553fb3ac` after the operational database query contract merge.
- Supabase, Stripe, webhook, founder access, and checkout report configured. Google OAuth remains deferred. Legal pages remain review-required.
- Email delivery remains blocked by an invalid sender environment value.

## Database and storage baseline

- Canonical repository inventory: three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets in `lib/sonara-database-contract.cjs`.
- Repository contains 42 migrations; production was last verified at 39 applied migrations.
- Migrations 40, 41, and 42 are repository-verified but require approved hosted application in timestamp order plus post-apply authorization, advisor, readiness, and query-index checks.
- All seven launch buckets were last verified private with scoped policies; anonymous reads returned no customer records in the recorded live checks.

## Security and launch status

- Hosted database changes require approved secure operator access outside chat.
- Paid access remains derived only from persisted active entitlements, active or trialing subscription state, or the documented owner and administrator path.
- Paid launch is not cleared. Remaining gates: secure operator access, migrations 40–42, valid sender configuration and delivery proof, Stripe test-mode lifecycle proof, and owner legal, pricing, and provider approvals.

Detailed historical evidence remains in `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the ADRs, research documents, and the reports directory.
