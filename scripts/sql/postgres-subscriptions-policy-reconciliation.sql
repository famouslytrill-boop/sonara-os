-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
--
-- READ-ONLY investigation: compare the canonical repo policy against
-- two subscriptions policies currently observed in Supabase preview.
-- This is intentionally NOT a migration or an instruction to DROP policies.
-- Never infer that preview is production; reconcile the target project ID.
--
-- Canonical policy source:
--   supabase/migrations/011_sonara_saas_launch_system.sql
-- Client authentication/role behavior must be regression-tested separately.
SELECT policyname, permissive, roles::text AS roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'subscriptions'
  AND policyname IN (
    'subscriptions_select_member',
    'Users can view own subscriptions',
    'Users can view their own subscription'
  )
ORDER BY policyname;

WITH candidates AS (
  SELECT policyname, permissive, roles::text AS roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'subscriptions'
    AND policyname IN (
      'Users can view own subscriptions',
      'Users can view their own subscription'
    )
)
SELECT
  count(*) AS candidate_count,
  count(*) FILTER (
    WHERE permissive = 'PERMISSIVE'
      AND roles = '{authenticated}'
      AND cmd = 'SELECT'
      AND qual = '(( SELECT auth.uid() AS uid) = user_id)'
      AND with_check IS NULL
  ) AS exact_approved_shape_count,
  count(DISTINCT (permissive, roles, cmd, qual, with_check))
    AS distinct_effective_definitions
FROM candidates;

-- A nonzero candidate_count is evidence for REVIEW, not approval to drop.
-- The repo's native replay must instead verify its own migration baseline.
