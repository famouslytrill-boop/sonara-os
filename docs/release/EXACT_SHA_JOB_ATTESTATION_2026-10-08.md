# SONARA exact-SHA release job attestation — 2026-10-08

**Status: draft code; NOT authorization to merge, migrate, restore, or deploy.**
Repository: `famouslytrill-boop/sonara-os`.
The target GitHub `main` branch was observed **unprotected**, with no repository
rulesets. GitHub settings must be corrected by an administrator; a green job
does not configure branch protection.

## Failure mode closed by this change

The existing controlled-production workflow already polls successful *workflow
runs* for the current `main` SHA before touching protected credentials. Its
six-run matrix did not inspect the child jobs or important conditional steps.
That leaves openings for a successful overall workflow with a skipped database
replay job, a missing Node matrix cell, a truncated GitHub jobs API response, or
a Docker job that skipped image build because `Dockerfile` was absent.

The new `scripts/verify-exact-sha-release-jobs.cjs` is a separate mandatory
read-only check after the existing run-level gate and **before** environment
governance, dependency installation, Stripe/Supabase secrets, migrations or
Vercel release.

It independently fetches current `main`, exact commit's `push` workflow
runs, and the latest per-run job page through GitHub's authenticated API.
It fails closed on changed/unprotected main, missing runs, wrong event/SHA,
non-success/neutral workflow, missing or duplicate jobs, wrong run ID, any
unexpected skipped job, incomplete pages, unknown/failed GitHub response,
and missing, failed or skipped **mandatory steps**.

## Mandatory job matrix (these are job names, not workflow names)

| Workflow | Required jobs |
| --- | --- |
| SONARA Industries CI | `sonara-industries`, `supabase-preview` |
| Docker Image CI | `build` |
| Node Runtime Compatibility | `Node 24 blocking compatibility`, `Node 26 blocking compatibility` |
| Native migration replay | `Node {22,24,26} / PostgreSQL {16,17,18} replay` (9 combinations) |
| Engineering Intelligence and Security Evidence | `Architecture, SAST, tenant isolation, and release evidence` |
| dependency-scan | `frontend-dependencies`, `backend-dependencies`, `agentkit` |

**18 mandatory jobs total.** The explicitly named
`Node 27 forward compatibility (manual, non-blocking)` is allowed to be
skipped; no other skipped job is accepted.

In addition to successful jobs, the following steps must actually complete
successfully:
- Docker: `Build the Docker image`, `Smoke test the built image`
- Node compatibility: `Test`, `Build` in both blocking lanes
- Native replay: `Replay the candidate migration history` in all nine lanes
- SONARA Industries CI: `Run tests`, `Verify database and storage contracts`

A job-level failure cannot be replaced by a passing test from another commit.
The script does not accept a `neutral` or `skipped` required job as a pass,
even though GitHub branch protection may regard such conclusions as acceptable
for some configured check contexts.

## Regression tests and evidentiary boundary

`tests/exact-sha-job-attestation.test.js` covers synthetic passing evidence,
skipped replay, missing/duplicate matrix cells, optional Node 27 exception,
incomplete API response, wrong job IDs, stale main, API errors, missing token,
skipped Docker build, missing replay step and workflow ordering.

A pure local source-code evaluation proved the complete synthetic matrix
passes while skipped SQL and Docker build steps are refused. **Exact-head
GitHub CI is still the authority**; passing those probes alone does not prove
that production GitHub settings, real third-party providers or real mobile
devices are configured.

## Owner configuration and caveats

1. GitHub **Settings → Rules → Rulesets**: create an **active** ruleset
   targeting `main`; require pull requests, approving independent human
   review, required status checks from the actual CI job contexts, no force
   pushes, and no unauthorized bypass. GitHub must verify its settings,
   not just a YAML file. Confirm an intentionally failing PR cannot merge.
2. GitHub **Settings → Environments → production**: require independent human
   reviewer(s), prevent self-review, disable admin bypass and restrict to
   protected branches. The existing
   `scripts/verify-production-environment-governance.cjs` checks the API.
3. Browser Quality and Lighthouse Quality are **PR-only and path-filtered**.
   Do not add them as unconditional required job contexts without first
   removing the path filters or defining an always-running accountable
   aggregate, or documentation-only PRs can wait forever on absent checks.
   Independently record their latest applicable PR evidence before release.
4. First obtain the complete exact-head Node/PG, tenant auth, provider sandbox
   and backup/rollback proof. The production website's temporary offline state
   must not be reversed without a separate owner-approved release decision.

## Primary documentation

- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- https://docs.github.com/en/rest/branches/branch-protection
- https://docs.github.com/en/rest/actions/workflow-jobs
- https://supabase.com/docs/guides/database/postgres/row-level-security
