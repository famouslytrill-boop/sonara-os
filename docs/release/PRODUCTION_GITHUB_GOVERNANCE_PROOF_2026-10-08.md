# SONARA production repository-governance evidence — 2026-10-08

**State: configured code safeguards are not the same as enforced GitHub settings. Production remains offline.** This is a read-only, fail-closed operator proof and a configuration plan, not permission to run the release.

Official sources:
- https://docs.github.com/en/rest/deployments/environments
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

## Current GitHub governance deficiencies

Read-only connected inspection on October 8 returned main.protected=false and [] active repository rulesets. Do not claim safe merges, exact-head enforcement or a protected production deployment until GitHub itself reports this resolved. Existing production workflow is manual-only, and checks current SHA, branch protection and CI status; the environment was not independently proven to require review.

## New fail-closed release precondition

Source: scripts/verify-production-environment-governance.cjs
Test: tests/production-environment-governance.test.js
Wired into: .github/workflows/controlled-production-deploy.yml before installing dependencies or using provider credentials.

Uses GitHub's read-only GET /repos/OWNER/REPO/branches/main and GET /repos/OWNER/REPO/environments/production. It refuses to pass unless:
1. main is the actual named branch and reports protected=true.
2. The checked-out release SHA is still current main.
3. An actual environment named production is returned.
4. It has required_reviewers rule with >=1 configured reviewer.
5. prevent_self_review is true.
6. can_admins_bypass is explicitly false.
7. The deployment branch policy restricts to protected branches only.
8. GitHub's API responds successfully, under the workflow's existing actions:read permission.

A network error, GitHub 403, an absent setting or uncertain metadata is NOT interpreted as a safe deployment. Nothing here modifies GitHub settings or deploys the application.

## Additional enforced rules verification — 9 October 2026, draft PR #563

The previous implementation proved `main.protected === true` and production environment reviewer policy but **did not prove which branch rules caused the protected flag**. This pass extends the existing release gate, `scripts/verify-production-environment-governance.cjs`, instead of adding a second conflicting release script.

After reading `/branches/main`, the gate now reads GitHub's read-only `/rules/branches/main?per_page=100` endpoint to inspect the rules **actually enforced on main** (repository and inherited organization rules). Evaluate-only and disabled rules are not returned by this GitHub API. The script then reads `/environments/production`; all three requests must succeed. The policy denies the release when any of these requirements is unverified:

1. An effective `pull_request` rule requiring one or more approvals, dismissal of stale reviews on new pushes, and an independent last-push approval.
2. Effective `non_fast_forward` and `deletion` rules.
3. Strict `required_status_checks` rules that include at least these **actual observed job names**, not guessed workflow titles: `sonara-industries`, `Node 24 blocking compatibility`, `Node 26 blocking compatibility`, `Node 24 / PostgreSQL 16 replay`, `scanners`, and `Architecture, SAST, tenant isolation, and release evidence`.
4. All original requirements: current head SHA, `main.protected`, production environment reviewer, no self-review, environment admin bypass disabled, and protected-branches-only deployment.

**These six are a minimum**, not the full required CI matrix. The exact-release chain still requires other mandatory checks including the complete nine-lane database replay matrix, Docker, dependency scan, browser/accessibility and relevant security checks. GitHub check contexts must be verified with the job/check-run API before administration changes.

**Evidence limitation:** GitHub's effective branch-rules API does *not* expose ruleset `bypass_actors` metadata, so the new gate cannot independently prove there are no exemptions. The repository owner must inspect and attest that all applicable rulesets are actively enforced, have acceptable bypass actor lists, and do not permit an unreviewed push. Any protected classic-branch configuration without sufficiently strong effective rules is intentionally classified as unverified by this new gate. If GitHub denies access to the rules endpoint, production promotion fails closed; never silently fall back to the boolean `protected` flag.

**Current connected snapshot:** GitHub still reports `main.protected=false`, and the repository-level ruleset listing is empty. No owner/admin settings were modified. The connected GitHub resource reader cannot request `/rules/branches/main` through its approved fetch surface, so live effective rule contents could not be independently read in this session. The new production script instead performs that read at approved workflow execution time, with explicit fail-closed handling.

**Focused verification:** 10 existing/added governance test cases and 45 assertions passed with mock GitHub responses. Exact-commit pnpm, full CI, and a genuinely protected GitHub branch are still **not** verified.

Source: https://docs.github.com/en/rest/repos/rules#get-rules-for-a-branch ; https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

## Least-privilege production workflow secret isolation — 9 October 2026

This draft also narrows the credential process-exposure window in `.github/workflows/controlled-production-deploy.yml`.

**Before:** `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, and `SUPABASE_DB_PASSWORD` were injected at the top of the entire `validate-migrate-deploy` job. Thus checkout, dependency installation, tests, source scans, builds, and unrelated diagnostic steps inherited these secrets, regardless of whether those steps needed them. The release remained protected by the production GitHub environment authorization and manual dispatch; this was a separate process-level least-privilege weakness.

**After (draft only):** the job-wide injection of those three secrets is removed. Exactly eight credential-consuming steps have explicit narrow `env` entries: credential preflight, Supabase project identity, Supabase migration preview, Vercel environment pull, explicitly approved Stripe runtime-secret synchronization, pre-migration schema checkpoint, reviewed migration execution, and controlled Vercel deployment. Each step receives only the relevant credential(s). The existing service-role key and Stripe keys were already step-scoped and remain so. Non-authentication project refs, URLs, and Vercel project IDs remain job-level configuration.

GitHub's documented distinction between `jobs.<job_id>.env` and `jobs.<job_id>.steps[*].env` ensures later steps do not automatically inherit tokens declared on previous steps. This is process-environment reduction, not isolation from a malicious or compromised runner, and it does not eliminate deployment-environment approval requirements or erase sensitive configuration files pulled for explicit verification.

**Regression enforcement:** `tests/production-environment-governance.test.js` checks that no token/password remains in the job-wide env, that the exact eight allowed step names contain required credential variables, and that every other named step is credential-free. The test compares actual expressions to expected protected-secret mappings, rejecting accidental insertion into unrelated build/test steps. In an isolated JS test harness, the 11 governance test cases passed 162 assertions; full GitHub Actions execution is still queued and has not been established as green.

**No production secret values were accessed or changed**, and the workflow was not manually dispatched. The existing canary, exact SHA, branch governance, project identity, authorization and rollback requirements remain mandatory.

Official reference: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## Owner/admin changes that remain mandatory

### Settings → Rules → Rulesets (or Branches)

Create an active branch ruleset targeting main. Require pull requests, appropriate independent review, prevent force pushes and deletion, disallow bypass (or restrict documented emergency admin break-glass), and select REQUIRED successful GitHub Actions job contexts from the actual live check-runs for:
- SONARA Industries CI
- Docker Image CI
- Node Runtime Compatibility
- Native migration replay
- Engineering Intelligence and Security Evidence
- dependency-scan

A workflow label is not necessarily a required status-check context; inspect exact check names and the check provider. Require freshness (latest head SHA) and do not accept a skipped required check as success. Verify a deliberately red PR cannot merge and that a green PR still requires review.

### Settings → Environments → production

Configure:
- Required reviewers with at least one trusted collaborator independent of the workflow trigger.
- Prevent self-review.
- Disable administrator bypass of environment protection rules.
- Deployment branches and tags: protected branches only.
- Keep least-privilege production credentials under the protected environment; do not expose them to unreviewed PR tests.
- Verify a dry manual dispatch waits for review and does not use production secrets or mutate schema before authorization.

The GitHub owner may need to invite a second reviewer for independent release approval. Do not weaken the policy merely to restore continuous deployment.

## Release sequence

1. GitHub admin changes saved; re-read both protected-branch and environment policy APIs, and attach evidence to release issue.
2. Full exact-head CI, migration SQL history/checksum reconciliation, multi-tenant RLS staging matrix, provider sandbox payments, and backup/restore drills.
3. Human approver checks intended Supabase/Vercel target, approved code SHA, rollback, social/mobile flags and cost budgets.
4. A separate written site-restoration authorization, then deliberate manual production dispatch and environment approval.
5. Verify live commit, HTTP health, authentication, database tenant isolation, money paths and monitored rollback. Mobile app distribution requires separate store proof.

This plan does NOT switch Supabase projects, initiate a real-money transaction, enable social, generate/store a GitHub PAT, or restore the website.
