# Production dry-run pull-request credential boundary

Date: 2026-10-08. Applies to all SONARA Industries, Business Builder™, Creator Studio™ and Growth Studio™ releases.

## Threat model

The previous `.github/workflows/controlled-production-deploy-dry-run.yml` ran on `pull_request` and referenced `environment: production`, with Vercel, Supabase, database, service-role and Stripe credentials available to the job. A same-repository contributor could propose arbitrary source executed by package install, build, tests, or verification. Environment approvals mitigate exposure only if they are actually configured, enforced and not bypassed. A **dry run is not an exception to least privilege**.

## New trust boundary

| Event | Required context | Job | Production credentials |
| --- | --- | --- | --- |
| Pull request to `main` | Code can be untrusted | `pull-request-contract` (static event-isolation proof) | **Never** |
| Manual dispatch from another branch | Any input | Neither production job eligible | **Never** |
| Manual dispatch on `main` without explicit boolean approval | Flag false/missing | Neither production job eligible | **Never** |
| Approved dispatch on unprotected or changed `main` | Protected-branch API response fails or SHA differs | `verify-current-main` refuses; production job skipped | **Never** |
| Approved dispatch from protected current `main` | Exact commit and preflight pass | Production-environment job awaits environment governance/approval | After approval, in that manual job only |

The production job still performs read-only checks and **never** applies migrations, writes provider configuration or deploys the site. The dedicated production deployment workflow remains a separately approved action. This PR makes no deployment or database change.

## Proof and controls

- `scripts/verify-production-dry-run-boundary.cjs --self-test` statically audits all workflow jobs, rejecting a production secret reference or environment on a PR job, a missing exact-ref/approval/`needs` guard, an unprotected-main admission path, or provider credentials in job-level environment variables. **Nine negative mutations must fail.**
- The GitHub API lookup of `branches/main` uses read-only `github.token` before the credential-bearing job can start, and fails on `protected !== true` or `commit.sha !== GITHUB_SHA`.
- The production job has `needs: [verify-current-main]` and independently requires manual event, `refs/heads/main`, the explicit boolean, and successful preflight.
- The production environment job calls the existing `scripts/verify-production-environment-governance.cjs` before running any dependencies.
- **Least privilege after approval:** Vercel and Supabase tokens are removed from the production job-level `env`; no provider credential is available to dependency installation, build, lint, static tests or smoke tests. The credential-presence check receives only its needed secret inputs; the migration preview gets Supabase connection credentials; the Vercel read-only environment pull gets the Vercel token; Stripe/service-role checkers receive only their specific keys.
- A manual-main dry run has no pull-request migration allowance. Its database verifier receives an empty `SONARA_ALLOWED_PENDING_MIGRATIONS` so that un-applied migrations cannot be waved through as a PR exception.

- Branch protection and production-environment required reviewers must still be configured by a GitHub administrator. Main was reported unprotected in the audit, so the credential-bearing job must remain blocked until governance is enabled.

## Verification

Run `node scripts/verify-production-dry-run-boundary.cjs --self-test`. The pull-request job runs the same test with `contents: read` and no environment/secrets. A successful PR static job **does not** prove that protected-main governance, the production environment, provider credentials or full release tests passed. Confirm all those separately at the exact promoted SHA.

## Primary references

- [GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments)
- [GitHub deployment restrictions and required reviewers](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub Actions secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
- [Supabase API/Data API and RLS trust boundaries](https://supabase.com/docs/guides/database/postgres/row-level-security)
