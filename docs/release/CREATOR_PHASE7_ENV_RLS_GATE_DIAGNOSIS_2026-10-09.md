# Creator Studio — Phase 7 Release Gate Failure Analysis
Date: 2026-10-09. Draft-only stacked change after PR #594; do not deploy.

## Confirmed latest PR #594 CI (head `5a93f82856ebefbe9382a58e760b451bdb5f93a9`)

- Docker Image CI: successful.
- dependency-scan: successful.
- Node Runtime Compatibility: failure in Test (not in Lint).
- SONARA Industries CI: failure in Test.
- Native migration replay: failure across PostgreSQL replay matrices.

### Node failure — verified from workflow logs

The application's source reads `SONARA_INTERACTIVE_DRAFT_PREVIEW_ENABLED` and `SONARA_STORY_REVISION_PERSISTENCE_ENABLED`, and `.env.example` declares both `false`. But `scripts/verify-env.mjs` rejects any source-referenced key missing from `lib/sonara-environment-classification.cjs`. The test harness therefore failed in its before-all hook and displayed a secondary after-all cleanup error. The two flags have been added to **OPTIONAL_CAPABILITY**, not REQUIRED: paying customers are not dependent on these experimental modules; their routes explicitly fail closed when disabled.

The classification check must remain bidirectional. Do not whitelist unknown environment variables or stop executing it.

### PostgreSQL P1 failure — confirmed by workflow logs

`tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` aborts at its **preflight** with `P1 policy definition drift on 25 policies`. Native migration history replay reached that staging-only probe. This result does **not** show that the proposed Creator tables were migrated — they reside in `docs/sql-proposals` only. A single unexpected definition could change access rights; a 25-row mismatch needs exact row-by-row evidence.

The diagnostic replay supplied the exact answer: migration `supabase/migrations/20261008100000_tighten_service_role_rls_policies.sql` has **already** hardened the target policies. Native pg_policies reports 21 service-only policies using `TO service_role USING true WITH CHECK true` and four authenticated ownership SELECT policies using `(( SELECT auth.uid() AS uid) = user_id)`. The old P1 test targeted their pre-migration scalar `auth.role()` and `auth.uid()` forms, making it obsolete after the approved migration history executes.

The updated P1 probe now requires those **exact post-hardening definitions for all 25 policies** (21 + 4). It keeps the strict role, command, permissive, USING and WITH CHECK comparisons; confirms the categories again after the approved subscription-duplicate drop, and still ends `ROLLBACK`. It no longer re-applies legacy `ALTER POLICY` commands that would conflict with the already-hardened state. A dedicated regression test pins these 25 expected roles/predicates and proves the rollback cannot disappear. The existing P0 two-tenant role matrix still runs first.

This is a *test-fixture reconciliation*, not a production migration, bypass of tenant access, approval to merge, or proof that the next native replay has passed.

## Release gates

1. Prove `pnpm run verify:env`, `pnpm run lint`, `pnpm test`, typecheck and Node compatibility pass on the exact head.
2. Preserve `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` fail-closed preflight, 21 service-role and 4 ownership definitions, strict expression equality, P0 two-tenant role matrix, subscription duplicate proof, and mandatory `ROLLBACK`.
3. Confirm the updated P1 expected values on native PostgreSQL 16, 17, and 18. Any version-specific policy output divergence must fail until separately explained; do not relax equality.
4. Re-run P0 tenant role tests, P1 protected RLS pre/postflight, and independent story-save double-writer/archiving/rollback tests before applying any Creator story or World Bible migrations.
5. Preserve default-off `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED`, `SONARA_INTERACTIVE_DRAFT_PREVIEW_ENABLED`, `SONARA_STORY_REVISION_PERSISTENCE_ENABLED`. Require owner-approved staging + tenant canary before activation.

References:
- Supabase RLS, grants and testing: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL `pg_policies`: https://www.postgresql.org/docs/current/view-pg-policies.html

## Follow-on policy proof, 2026-10-09

**Native replay evidence (PostgreSQL 16, 17, 18):** once the 25 legacy-policy expectations were reconciled, the next preflight revealed that the assumed pair of `"Users can view own subscriptions"` policies does not exist in the current table. The live migration history produces **three different policies**, confirmed by the native log:

| Policy | Roles | Command | Exact USING / WITH CHECK |
| --- | --- | --- | --- |
| `org members can read subscriptions` | `{public}` | SELECT | `((organization_id IS NOT NULL) AND is_org_member(organization_id))` / NULL |
| `service role can manage subscriptions` | `{service_role}` | ALL | `true` / `true` |
| `subscriptions_select_member` | `{authenticated}` | SELECT | `(is_org_member(organization_id) OR is_admin_or_founder())` / NULL |

These three are **not identical duplicate authorizations**. The new replay fixture asserts all roles, actions and predicates exactly both before and after its dry-run phase, verifies the count is exactly three and deliberately executes **no DROP POLICY or ALTER POLICY**. Any changed policy remains blocking. This is a read-only attestation on the disposable replay database, not a new security grant.

**Node test evidence after the environment fix:** the previous branch run reached Mocha and reported 15 failures. The cause was not just environment classification. Specific observed defects corrected on this draft branch are an unclassified advanced worldbuilding JSON-preview endpoint in the form-reachability inventory, POST test mocks erroneously checking nonexistent query filters rather than posted tenant identifiers, raw HTML metacharacters in authored Markdown exports, and a stale handoff test-file count of 513 vs the observed 525. A new SQL contract test initially counted 25+3 rows together; it now scopes the population to exactly 25.

**Pending:** Current full CI and native PostgreSQL replay must independently prove these corrections. Do not describe previously failing suites as passing until a complete exact-head result reports success.
