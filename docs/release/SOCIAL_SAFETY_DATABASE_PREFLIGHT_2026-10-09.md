# SONARA Social Safety — Database Preflight and Release Evidence
Date: 2026-10-09
Status: REVIEW ONLY / NOT LIVE

## Scope
This gate covers three stacked draft changes: shared social interaction preflight (#572), Growth Studio channel moderation and blocks (#573), and Creator Studio account blocking and independent report triage (#575). No production database or website change was authorized or performed.

## Read-only database evidence
The connected Supabase project currently exposes a healthy **preview** PostgreSQL 17.6 instance; it is not established as SONARA's canonical production database.
- Existing tables inspected: growth_channels, growth_channel_posts, growth_post_reports, organization_memberships, creator_artist_profiles, creator_follows.
- Existing columns needed by proposed functions are present, including growth_channel_posts.removed_at/updated_at and the Creator profile's user_id.
- Preview Data API INSERT grants were absent for anon and authenticated on creator_follows, growth_post_reports and growth_channel_posts, and available to service_role.
- The six proposed new social-safety tables and selected RPC functions were not installed at the read-only inspection.
- Existing service_role grants vary by table: UPDATE was granted on tested baseline tables, while some DELETE grants were not. Never assume **GRANT SELECT** revokes other privileges.

## Code and SQL review findings repaired
1. The channel-block function had malformed PL/pgSQL dollar quotes. Fixed in the SQL proposal, with deterministic lexical regression tests.
2. New social-safety table permissions now explicitly REVOKE from PUBLIC, anon, authenticated **and service_role**, then re-GRANT only the exact application privileges. This avoids Supabase default-grant leakage and protects append-only moderator decisions.
3. Channel blocking now uses a transaction-locked, server-only function that enforces the 500-per-actor cap. Raw table writes are denied by the tenant firewall.
4. The new Growth safety paths are OFF by default, leaving pre-existing anonymous reporting and owner moderation working until schema activation is reviewed.
5. Owner-only report queues, a separate manually approved platform reviewer roster, and canonical HTTPS origin checks remain required.

## Verification available before migration
- scripts/verify-social-sql-proposals.cjs: lexical quote, function grant/revoke, table RLS, explicit service_role default-revoke, and exact rights check for both draft SQL proposals.
- tests/social-sql-proposal-preflight.test.js: six isolated JavaScript regressions of malformed SQL and excessive grants.
- docs/sql-proposals/tests/growth-channel-safety-pgtap.sql: 22 prepared PostgreSQL assertions, NOT RUN.
- docs/sql-proposals/tests/social-account-safety-pgtap.sql: 33 prepared PostgreSQL assertions, NOT RUN.

Run after review: node scripts/verify-social-sql-proposals.cjs

**Limitations:** The lexical validator is not a SQL parser. It neither validates PostgreSQL function bodies nor proves transaction/RLS behavior. Stubbed JavaScript tests do not prove database writes. SQL proposals have not been executed or converted into versioned migrations.

## Next controlled sequence
1. Identify the authoritative production Vercel and Supabase projects, approved deployment windows, existing migration history and rollback owner.
2. Clone the canonical source branch into a local environment; discover the current Supabase CLI commands via --help and generate versioned migrations only on a throwaway local Postgres instance.
3. Apply both SQL proposals in isolated migration replay. Inspect default grants, schema exposure, function EXECUTE and review-only evidence.
4. Run the 22+33 staged pgTAP checks through a real test database and two-session race tests: 500-vs-501 channel blocks; block-vs-follow; report dedupe/rate-limit; simultaneous moderator decisions; cross-tenant and revoked-reviewer denial.
5. Fail closed on all negative tests; regenerate tenant-table classifications, run full Node 24/26, Mocha, security, browser, migrations and release-chain CI.
6. Require operator review and private one-tenant canary before enabling SONARA_GROWTH_CHANNEL_SAFETY_ENABLED or SONARA_SOCIAL_USER_SAFETY_ENABLED. Never enable a flag to 'test' a missing migration in production.

## Sources
Supabase function privileges: https://supabase.com/docs/guides/database/functions
Supabase exposed schema grants and RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
OWASP API broken object authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
