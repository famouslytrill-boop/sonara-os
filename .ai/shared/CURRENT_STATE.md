# Current State — updated 2026-07-18 by Codex (Agent A)

## PWA convergence — merged and deployed

- PR #23 merged to `main` as `277c3bb6c58bfe29399265a0dae52830c02d1d99`.
- Vercel production status succeeded for that exact main-branch merge commit.
- `public/site.webmanifest` is the single install manifest. The legacy `/manifest.webmanifest` URL reaches the existing permanent redirect instead of a duplicate static file.
- The shipped browser script registers `/sw.js` only on an explicit public-page allowlist and only in secure or local-development contexts.
- The service worker handles only public navigations and same-origin static assets. Authenticated customer, account, admin, and API traffic stays outside its response path.
- Public navigation is network-first with an offline fallback. Static assets use stale-while-revalidate. Private/no-store/cookie-bearing/opaque responses and the worker script itself are not cached.
- The manifest preserves tested PNG install and maskable icons, includes the current SONARA mark, and adds shortcuts for Business Builder, Creator Studio, and Growth Studio.
- Executable tests run the shipped registration code, verify public/private route behavior, validate manifest assets, and enforce cache privacy.
- Final PR head `a108e19019604983b67e11dd5a727c119128d592` passed SONARA Industries CI, dependency scan, Docker Image CI, Supabase repository validation, and Vercel preview before merge.
- No API behavior, authentication, billing, hosted database schema, storage policy, or provider configuration changed in PR #23.

## Production baseline

- Root Express application: `server.js` exported by `api/index.js`; Vercel rewrites traffic to `/api`.
- Production main is now `277c3bb6c58bfe29399265a0dae52830c02d1d99` after the PWA convergence merge.
- The prior unrestricted public/auth/legal/product smoke and runtime-error evidence remains recorded for release `4dccd10994656573ce18adcc4e4b30805cbac3f1`; a new post-merge browser PWA verification remains a bounded follow-up.
- Supabase, Stripe, webhook, founder access, and checkout report configured. Google OAuth remains deferred. Legal pages remain review-required.
- Email delivery remains blocked by an invalid sender environment value.

## Database and storage baseline

- Canonical repository inventory: three schemas, 71 application tables, 10 functions, and seven private storage buckets in `lib/sonara-database-contract.cjs`.
- Repository contains 41 migrations; production was last verified at 39 applied migrations.
- Migrations 40 and 41 are repository-verified but still require approved hosted application and post-apply authorization/readiness checks.
- All seven launch buckets were last verified private with scoped policies; anonymous reads returned no customer records in the recorded live checks.

## Security and launch status

- The previously disclosed Supabase server credential must be rotated outside chat before paid launch.
- Paid access remains derived only from persisted active/trialing subscription state or the documented owner/admin path.
- Paid launch is not cleared. Remaining gates: credential rotation, migrations 40/41, valid sender configuration and delivery proof, Stripe test-mode lifecycle proof, and owner legal/pricing/provider approvals.

Detailed historical evidence remains in `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the ADRs, and the reports directory.
