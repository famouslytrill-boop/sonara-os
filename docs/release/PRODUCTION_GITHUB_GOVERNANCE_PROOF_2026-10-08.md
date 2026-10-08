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
