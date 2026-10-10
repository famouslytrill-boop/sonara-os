# Creator World Bible write-integrity review — 9 October 2026

**Scope:** targeted follow-up stacked on Creator Studio draft PR #587. The parent already contains the canonical World Bible store, editor, tests, Markdown outline export and review-only SQL. Do not introduce competing stores, routes, migrations or API names.

## Security changes in this draft

### 1. Cross-origin write denial (runtime)

Both World Bible save entrypoints (HTML form and JSON API) reject browser requests when Fetch Metadata reports `same-site` or `cross-site` rather than `same-origin`, or when an explicit `Origin` header's host fails to match the request host. Invalid Origin values fail closed. The guard runs before reading inputs or invoking the database. An already-authenticated session is still necessary, but authentication alone is insufficient to stop CSRF.

This is **defense in depth, not a complete CSRF proof**. Some legacy/non-browser clients omit these headers, and production reverse-proxy settings/cookie SameSite attributes must be checked. Before enablement, audit the session framework's synchronizer-token or equivalent CSRF policy, host/proxy handling and CORS. See OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

### 2. Parent-project archiving race (unapplied SQL)

A successful app read of `creator_projects.archived_at is null` is not transactional with an independent PostgREST World Bible write. The staged trigger uses a `SECURITY INVOKER` function with a matching `project_id + organization_id` parent query and `FOR SHARE`, taking a row lock before INSERT/UPDATE. A missing/archived/mismatched parent raises a FK-style error, so a concurrent archive cannot silently win before a World Bible mutation commits.

This is a **proposal** in `docs/sql-proposals/creator-world-bibles-2026-10-09.sql`, not an applied migration or verified concurrency guarantee. Run native Postgres sessions with interleaved archive and insert/update transactions before promoting it.

### 3. Explicit privilege floor (unapplied SQL)

New table defaults may already have granted broad DML privileges, so only adding `grant select, insert, update` is not enough to remove `delete`. The staged script first revokes ALL from `public`, `anon`, `authenticated` **and `service_role`**, then gives `authenticated` SELECT under tenant RLS and `service_role` SELECT/INSERT/UPDATE. No direct authenticated WRITE or service-role DELETE is needed by this module. Confirm these are the effective grants on the final database.

Supabase's explicit Data API grant rollout: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## Native release tests required

1. On an isolated Supabase branch, generate a CLI-numbered migration (do not copy review-only SQL directly into production) and replay existing baseline migrations.
2. Test direct `anon` SELECT/INSERT/UPDATE/DELETE rejection, authenticated org-member SELECT, authenticated cross-org SELECT rejection, and authenticated UPDATE/INSERT denial. Test service-role DELETE denial and allowed server writes.
3. Test parent/child composite foreign key with a mismatched `organization_id`; test ON DELETE CASCADE through a privileged parent delete in isolation.
4. In two independent PostgreSQL sessions, interleave an archive update and World Bible save. Assert that writes against archived projects fail and locks settle cleanly. Verify the expected SQLSTATE and PostgREST HTTP mapping without leaking internal errors.
5. Test malformed/missing/foreign `Origin` and `Sec-Fetch-Site`; check same-origin form saves, authenticated API clients, reverse-proxy Host values and configured CORS.
6. Re-run exact-head Node 22/24 tests, lint, typecheck, build, OpenAPI, route inventory, branch protections, security scanners, browser testing and accessibility.
7. Keep `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED` disabled until tests and explicit owner approval. Do not automatically apply SQL, merge, or deploy.

## Remaining work after these gates

- A durable revision/audit history is not present: optimistic revision counters prevent stale writes, not full restore or collaboration.
- Saved World Bible source and derived planning fingerprint must retain compatibility across future planner/schema versions.
- Interchange to DAWproject/OTIO/glTF and real media rendering/streaming requires separately validated adapters; no file generated in this PR is a finished game, recording, or rights clearance.
