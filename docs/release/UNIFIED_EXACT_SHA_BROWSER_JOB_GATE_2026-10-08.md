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

## Required follow-through

- Verify test count and generated artifact parity at the final combined head.
- Run exact-head CI, API simulations, branch and job falsification tests, native SQL replay and browser matrix.
- Have independent security/DB reviewers approve entitlement, migrations, RLS, rights, provider and billing changes.
- Configure GitHub repository settings externally; repeat the official `main` release gate after the approved merge.
