# Migration and runtime release hardening

Checked: 2026-10-04
Review by: 2026-10-11

## Resulting release behavior

The native replay workflow now tests Node 22, 24 and 26 against PostgreSQL 16 and 17. Each job selects its PostgreSQL binary directory explicitly, so an installed newer major cannot silently replace the matrix's intended version. An incomplete or relative selection fails. Evidence includes the candidate commit, migration hashes, Node version, PostgreSQL version, runner identity and SQL log; artifact names distinguish both runtime and database major.

The production deployment workflow now requires a successful **Native migration replay** workflow for the exact current main SHA before consulting production credentials or reaching migration/deployment steps. Its existing exact-SHA, rollback checkpoint and post-deployment checks remain in place. The repository continues to declare Node 24.x for production; Node 26 is a blocking compatibility target.

The owner commands `db:push` and `db:push:all` verify frozen migration checksums before calling Supabase. They no longer run the trigger rewrite script as part of a push. This prevents a deployment convenience command from changing the SQL it is about to submit. `pnpm run db:preview` performs the same integrity check followed by a linked dry run. It requires the existing CLI installation and project link and does not apply SQL.

The replay ownership resolver is a small separately tested helper. Ownership tests do not import the entire command-line replay program; this fixes the uncovered CLI population introduced by the prior ownership import without changing the coverage floor. The concurrency fixture uses the same resolved numeric user/group pair as the rest of the replay.

The upstream security scan also identified one new credential-shaped webhook fixture in the billing regression test. That synthetic fixture is now assembled from parts, preserving its exact test value and signed-request behavior. No production credential, scanner rule or reviewed-findings baseline is changed.

## Runtime verification

Official release metadata identified Node **24.21.0 LTS** and **26.10.0 Current** as the latest releases in those majors on the check date. Both local Linux binaries were downloaded from Node.js and verified against their release SHA256 manifests. The application lockfile remains unchanged and pnpm remains pinned to 12.7.0.

Vercel's current documented production versions are 24.x, 22.x and 20.x. Advancing the local patch and compatibility testing does not establish Node 26 production hosting support. Production hosting settings are unchanged by this increment.

## Production migration preflight

Read-only production observations on the check date found PostgreSQL **17.6**, **151 applied migrations**, **409 public tables**, and **zero public tables with RLS disabled**. An enabled RLS flag is not behavioral proof of every policy or grant.

The invoice payment tenant-link migration is already recorded as applied. The candidate's formula seed migration `20261004130000_seed_bounded_planning_formulas.sql` remains unapplied. No SQL was applied to production during this increment. The candidate remains stacked on PR #429, whose release checks must be resolved before the stack can reach main and the controlled production pipeline.

The current Supabase PostgreSQL minor-upgrade notice covers 17.6 to 17.11. The observed extension list contains no `ltree` or `btree_gist`; metadata probes found no affected custom selectivity operators and no public function body mentioning PGP encryption. The repository search also found no legacy PGP cipher calls. These limited probes do not inspect encrypted customer data or prove every external caller's behavior. A managed database upgrade still needs its own restore checkpoint, maintenance plan and post-upgrade verification.

The security advisor retains 58 informational no-policy findings and warnings for eight authenticated security-definer functions, one public-schema extension, and disabled leaked-password protection. Some no-policy tables deliberately serve only server-side paths; adding broad policies to remove a warning would change their authority. These observations require separate assessment and do not become resolved merely because migration replay passes.

## Validation and remaining gates

Verification covers explicit binary selection, Unix ownership, migration push integrity, runtime/database matrix coverage, production release dependency, frozen installation, dependency audit, typecheck, lint, the complete server suite, build, generated inventory, route/database/tenant contracts and available local release gates. Local native PostgreSQL execution and complete optional Python-tool measurement remain hosted-CI responsibilities in this workspace. Each published candidate must receive its own successful hosted evidence.

The production formula seed, managed PostgreSQL minor upgrade, real provider transactions, physical-device qualification and observed customer retention are not completed by these checks.

## Primary sources

- [Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0)
- [Node 26.10.0 release](https://nodejs.org/en/blog/release/v26.10.0)
- [Vercel supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [PostgreSQL's official Ubuntu package repository](https://www.postgresql.org/download/linux/ubuntu/)
- [Supabase migration push and dry run](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Supabase PostgreSQL 15.19 / 17.11 upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
- [No-policy advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Public-schema extension advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- [Security-definer advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
