# SONARA Phase 19 — First completed CI matrix: precise blocker triage and bounded fixes

**Evidence:** 2026-10-10 UTC, PR #605 base head `6bd19ccf54a4a2a51512e91f6e45af35abcfe7ef`. The run queue recovered enough to finish checks. **45 success, 18 failure, 2 skipped** on the inspected exact head. Not a production release.

## Evidence directly read from GitHub job logs

### P0 test integrity / required Node 24 suite
`Build, test, and security` and Node 24 compatibility lanes ran the actual Mocha suite. The relevant job reported **7,205 passing and four failing tests** (its own log). Four failures:
1. `tests/a-script-nobody-runs-is-not-a-check.test.js`: `scripts/report-actions-queue.cjs` was neither connected to a workflow nor registered as a deliberately manual operator tool.
2. `tests/sonara-research-runtime-integration.test.js`: invalid URL receipt expectation failed (0 != 1).
3. Same integration test: canonical formula metadata association expectation failed (`existingEngineAssociations >= 9` was false).
4. `tests/the-handoff-counts-what-mocha-runs.test.js`: generated `docs/HANDOFF_PROMPT.md` said 513 test files; actual Mocha discovery counted **525**.

The failed integration assertions had a source-grounded explanation: fixture unit suites temporarily patch `Module._load` to inject fake `auditEvidencePacket()` and three fake formula handlers but left the fixture-constructed **target module** in the process-wide `require.cache`. When Mocha later imported the real module, it reused that cached fake. This is a test-isolation failure with cross-suite behavior, not reason to loosen the source URL audit or alter formula integrity.

**Corrections implemented in this patch:** preserve and restore the target module's preexisting `require.cache` entry around each fixture import in three test suites. Restore `Module._load` in `finally` as before; delete the fixture export and replace any preexisting real module entry exactly. Keep all actual production URL checks, formula guards, and test assertions intact.

### P0 unreachable operator script
Register `scripts/report-actions-queue.cjs` in the existing `OPERATOR_TOOLS` manual-run list of `scripts/report-unreferenced-scripts.mjs`, with a concrete safety explanation. This offline tool reads a sanitized local JSON snapshot for human incident triage. No workflow, production script, privileged API, check suppression or credential exchange was introduced.

### P0 source license hygiene
`verify:source-licence` identified `ios/README.md:7` as apparently proclaiming SONARA open-source when describing the independently licensed XcodeGen utility. The iOS documentation now distinguishes **third-party XcodeGen's own licence** from SONARA's proprietary pilot shell. The root source-license check, not a weakened exception, remains authoritative.

### P0 generated handoff count
Reconcile the generated handoff's 513 figure to **525**, the count measured by GitHub's own executed Mocha discovery. This is an exact single-derived-field update in `docs/HANDOFF_PROMPT.md`; the full generator must verify that it reproduces the file after checkout.

### Remaining P0/P1 blockers not waived
- GitHub reported **two new high-severity CodeQL alerts** in the PR. Review the exact alerts in the GitHub code-scanning UI and repair the vulnerable dataflow with a security-specific PR/test before considering the release.
- The native PostgreSQL 16/17/18 replay jobs across Node lanes reported **25 policy definition drifts** during the P1 RLS initplan/policy-overlap guarded rollback proof and intentionally aborted. Do **not** change expected-policy assertions or force a migration just to pass; reconcile actual migration history and policy definitions under DBA/security review with rollback.
- Playwright Firefox and WebKit failed; Firefox logs show 40/41 browser tests passed, one test timed out in navigation. Root cause of Firefox/WebKit variation is not established and they need reproduction, environment/network timing and browser evidence.
- `verify:coverage-floor` also failed; a precise coverage deficit has not been isolated from the fetched log in this pass. Keep that gate blocking.
- Skipped check conclusions are not blanket approval. Main branch protection and production tenant/commerce pathways require their own evidence.

## Targeted validation already executed

- Three proposed fixture suites were executed **with their exact GitHub source blobs in an isolated V8 CommonJS-cache simulation**, including test assertions and the pre-existing real-module cache sentinel. All **26/26 unit assertions passed**, and the original module-cache state and `Module._load` were restored after each suite.
- GitHub logs provided independent negative evidence that the prior fake cache was harmful; the original full integration tests caught it.
- The source-license phrase no longer contains a claim that SONARA source is `open-source`; the source-license scanner itself is unchanged.
- This is **not** a full native Node 24/Mocha run after edits, nor a rerun of GitHub required checks, coverage, migration, CodeQL or browser proofs.

## Safe next exact-head sequence

1. Commit this bounded patch to draft PR #605 without merge/deploy.
2. Let GitHub run a new exact-commit matrix; prioritize Node 24 Mocha failures, `verify:source-licence`, unused-script audit and `verify:handoff` evidence.
3. Triage CodeQL's two high alerts, RLS policy drift and browser failures separately, with source-specific failing tests; no bypasses or unreviewed production schema changes.
4. Complete production protections and staged release only after all mandatory checks actually succeed.

**No customer data access, feature flag activation, social/mobile release, charge or provider credential use in this patch.**
