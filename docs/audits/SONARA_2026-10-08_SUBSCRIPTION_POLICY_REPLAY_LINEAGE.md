# Subscription-policy RLS replay lineage — 2026-10-08

**Status:** P0 investigation and draft source-only test correction. This note is not production authorization and does not assert green CI. Authoritative source-control changes reside in draft PR #545, based on draft PR #526. Main branch governance must be enforced by a repository administrator before release.

## Evidence on the exact observed release chain
- Main `9d141e68d1ec14c037f92d1eebb3c2718d583c0a` (October 8) is reported unprotected by GitHub.
- Main SONARA Industries CI 37815158957: 7,083 tests passed; one failed (handoff declared 513 Mocha files while runner discovers 516).
- Native replay 37815158798: all nine Node 22/24/26 × PostgreSQL 16/17/18 combinations failed after the P1 forward hardening migration because a historical 25-policy staging fixture expected obsolete pre-hardening definitions.
- Draft PR #526 runs the historical fixture *before* migration `20261008100000_tighten_service_role_rls_policies.sql`, and separately tests the 21 service-role + four owner policies after migration. Its replay still fails when it requires two optional `subscriptions` owner-SELECT policies.

## Why active database state is not source history
A **read-only** inspection of active Supabase project `yqncsonkxgwhcxedgevk` found these policies on `public.subscriptions`:
- `Users can view own subscriptions`
- `Users can view their own subscription`

Both have role `authenticated`, command `SELECT`, permissive mode, `USING (( SELECT auth.uid() AS uid) = user_id)` and no `WITH CHECK`. This finding is NOT evidence about production project `ltzpppffnwopdxbchajr` and does not establish that the ephemeral native-replay schema has the same policies.

Tracked historical migration `supabase/migrations/011_sonara_saas_launch_system.sql` creates `subscriptions_select_member` for `authenticated` using `public.is_org_member(organization_id) OR public.is_admin_or_founder()`. The two additional owner-only policy names are not established by that migration's text. A replay must not fabricate them just so a proposed DROP statement succeeds.

## New guarded, transaction-local test behavior
The original 25 policies are still checked exactly **before** forward migration. The post-migration probe still checks hardening. For the optional subscription policy pair:
1. If neither extra policy exists, check `subscriptions_select_member` has the exact reviewed organization-scoped authenticated SELECT predicate, with no `WITH CHECK`; do not execute deduplication.
2. If both exist, verify *both* have the exact same reviewed authenticated, permissive, owner-only SELECT tuple before a transaction-local drop of one policy.
3. If one exists, an unexpected count is observed, a policy differs, or the canonical predicate is absent, abort the gate. The test does not authorize new grants, bypass RLS, create subscription policies or change customer data.
4. Require `ROLLBACK` at end of each pre/post proof so source-controlled migrations and live grants remain unchanged.

The policy-checking script is an executable experiment against a **disposable** Postgres instance, not a migration to production. The source-vs-active difference must be separately reconciled in a signed migration/rollback package and with independent tenant denial tests. If full CI remains red, inspect exact mismatch output and retain the gate rather than widening access.

## Next exact-head gate
Review #545 and run: Node24/26 blocking tests, all nine native PostgreSQL replay combinations, `pnpm test`, `pnpm run verify:gates`, lint/typecheck, generated docs and role-scoped adversarial tests on the same final SHA. Because merged source can change while CI runs, validate against the actual merge commit, not a prior PR head.

Production remains blocked until GitHub ruleset protection, independent required status checks and environment reviewers are enforced and an attempted red merge is **rejected** by GitHub. The connected repository integration cannot administer the ruleset. Do not execute a red-merge negative test while `main` remains unprotected.
