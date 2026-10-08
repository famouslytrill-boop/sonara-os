# Unified release evidence gate — 2026-10-08

**Status: draft and blocked for production.** This candidate combines [PR #516](https://github.com/famouslytrill-boop/sonara-os/pull/516), [PR #518](https://github.com/famouslytrill-boop/sonara-os/pull/518), and [PR #521](https://github.com/famouslytrill-boop/sonara-os/pull/521). No provider credentials, production migrations, checkout transfers, or deployment are authorized by this document.

## Research decisions (GitHub first-party references)

- [Protected branch rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches): require approvals, mandatory unique status checks and no bypass. **Current main was observed unprotected**. A source-code check cannot configure it.
- [Actions workflow-run API](https://docs.github.com/en/rest/actions/workflow-runs): supports `branch` and `head_sha` filters; query the exact main commit without `event=push` so manually dispatched Browser Quality is not silently omitted.
- [Actions workflow-job API](https://docs.github.com/en/rest/actions/workflow-jobs): retrieve all latest jobs and verify total_count, run id, exact SHA, main branch, success, and critical steps.
- [GitHub Actions GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token): commits from workflows using the default token do not normally schedule a second workflow. Never substitute green results from an earlier SHA or a bot-created approval-required run for exact-head proof.

## Security invariants

1. An administrator must protect `main` and require a separate protected production environment with independent reviewers before any controlled deployment.
2. All six mandatory *push* workflows must succeed on the exact protected `main` SHA, with every required child job and conditional step completed successfully. A neutral/skipped result, missing job, incomplete response, foreign branch, foreign workflow file or duplicate name is a release failure.
3. A seventh, manually dispatched `Browser Quality` workflow must succeed on the **same** exact SHA and branch. Independently require the three jobs `Playwright chromium`, `Playwright firefox`, and `Playwright webkit`, plus their run-contract and evidence-upload steps.
4. The newest matching run wins. An earlier passing run cannot override a newer failure or incomplete rerun.
5. CI checks on a PR cannot substitute for the separately required `main` push and manual browser evidence. Production release is gated *after* merge, not just before.
6. Never relax browser or PostgreSQL checks to achieve an artificial green status; actual device-camera verification is distinct from Linux WebKit evidence.

## Current graph / source-consolidation constraints

- This PR is an **integration candidate**, not an independent branch to cherry-pick automatically before #508 resolves the post-consolidation source drift.
- Browser media repair #515 overlaps #508; review only the narrow additional production fix after #508, rather than merging both full stacked diffs.
- Database #517 and #520 use the same `20261008110000` migration version for competing grant-hardening approaches. They are **mutually exclusive until a single canonical migration is selected**. The existing `scripts/verify-production-schema.mjs` catches duplicate version prefixes; keep it blocking.
- #522 is stacked on #520; #510's durable retry migrations need independent RLS/role-matrix replay and safety approval.
- Do not auto-merge the 15 open PRs or consider a test run on a different branch as production readiness.

## Credential-free preflight

The controlled production workflow originally declared Vercel and Supabase secrets at the same job level as its read-only release checks. This could request protected-environment approval and provision the credential-bearing job before those checks executed.

The integration now defines `release-attestation-preflight` without an `environment` or provider secrets, using only the read-only GitHub token. The production job explicitly `needs: release-attestation-preflight` and retains its separate protected-environment review, exact-SHA checks, and step-scoped credentials. A failed preflight skips the dependent deployment job. GitHub documents both [job dependency behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs) and [environment-secret access after approval](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).

Administrators must ensure the actual production credentials are stored as `production` **environment secrets**, not only as unprotected repository-wide secrets. No source-code branch can verify that settings change without authorized access.

## Least-privilege production credential binding

An additional review identified four secrets incorrectly bound to the entire deployment job: `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` and `SUPABASE_DB_PASSWORD`. Before the repair, all dependency installers, third-party tooling, build, lint and test steps inherited those values.

All four bindings now exist only on **eight named consuming/credential-preflight steps**, with exactly 18 step-variable bindings. The shared job environment carries only public deployment identifiers and URLs. The release attestation preflight is separately credential-free.

The existing Mocha attestation test file contains two adversarial invariants: no provider secrets at deployment job scope and an exact allowlist of per-step credential bindings (no unapproved consumers and no missing required consumer). The agent-development sync verifier now selects `validate-migrate-deploy` explicitly, rather than silently inspecting the first job's environment after a new preflight is introduced.

**Security limitation:** Steps in the same GitHub-hosted job share a runner and mutable workspace. A compromised dependency/build step could tamper with scripts, persist state, or potentially intercept a later credentialed step. Per-step `env` scoping is risk reduction, **not an isolation boundary**. A stronger follow-up is a separate unprivileged build/test runner and a credentialed deployment runner that consumes a verified immutable artifact; this requires its own acceptance and rollback plan, not an unreviewed refactor.

Static review of the committed workflow passed and five injected regressions (job-secret leak, build-secret leak, missing migration credential, missing preflight, preflight-secret leak) were rejected by a deliberately limited contract-check harness. This is **not** hosted CI, true process isolation or live-provider validation. No production release is authorized.

## Required follow-through

- Verify test count and generated artifact parity at the final combined head.
- Run exact-head CI, API simulations, branch and job falsification tests, native SQL replay and browser matrix.
- Have independent security/DB reviewers approve entitlement, migrations, RLS, rights, provider and billing changes.
- Configure GitHub repository settings externally; repeat the official `main` release gate after the approved merge.
