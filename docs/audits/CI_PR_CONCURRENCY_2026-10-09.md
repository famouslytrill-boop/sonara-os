# PR CI concurrency controls — October 9, 2026

## Scope
PR #539's twelve workflows remained queued for an extended period. Six
expensive workflows had no workflow-level concurrency control, permitting
superseded pull-request revisions to consume runner capacity. This change
reduces redundant future runs; it does not prove the cause of the existing
GitHub Actions queue, increase runner capacity, or alter required checks.

## Policy

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

The group scopes an update to one workflow and one PR. Main pushes and
manually dispatched runs use their unique run ID, so their release evidence
cannot be displaced by a separate push, PR or manual rerun. A cancelled stale
PR revision is never considered a passing check. Existing job names, workflow
triggers, test matrices, permissions and release criteria are unchanged.

`tests/ci-pr-concurrency.test.js` checks each of the six workflow contracts.
Actual GitHub Actions workflow parsing, PR supersession behavior, and every
exact-head release gate must still be verified before merge. Investigate
runner capacity or account billing independently if the queue remains stalled.

GitHub reference:
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency
