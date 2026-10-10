# Phase 17 — Repair undiscovered research tests on SONARA's release branch

**Evidence date:** 2026-10-10. **Scope:** Draft PR #605, exact-head test discovery and relative module imports. No production code path, external provider operation, database migration, or deployment changed.

## Confirmed failures in original branch layout

1. `tests/sonara-research-formula-blueprints.test.js` required `./sonara-research-formula-blueprints.cjs`, even though the module lives under `lib/`. The module resolves relative to the **test file**, not the process working directory. The standalone flat-folder test used previously did not model this repository layout.
2. `tests/sonara-research-rank-sensitivity.test.cjs` required `./sonara-research-rank-sensitivity.cjs`, also incorrectly referring to the `tests/` directory.
3. `tests/sonara-research-rank-sensitivity.test.cjs` and `tests/sonara-research-evidence-reconciliation.test.cjs` used `node:test`. SONARA's `.mocharc.json` explicitly selects **only** `tests/**/*.js` and `tests/**/*.mjs`, so those `.test.cjs` files were **not included** in the normal `pnpm test` Mocha suite.

## Fix

- Correct the two relative import paths to `../lib/...`.
- Rename the two excluded `.test.cjs` test files to `.test.js` and convert their test declarations to Mocha-compatible `describe(...)` / `it(...)` using `node:assert/strict`. Remove the original `.test.cjs` copies rather than leaving confusing dormant duplicates.
- Add `tests/sonara-research-suite-discovery.test.js` to verify that the three research test files exist, are covered by the checked-in `.mocharc.json` discovery glob, and reference the correct relative `lib/` module paths. This test also executes in the normal Mocha file set.

**Mocha source:** https://mochajs.org/running/configuring/ explains `spec` discovery, and https://mochajs.org/running/test-globs/ explains glob selection. SONARA's repository `.mocharc.json` is the decisive local configuration.

## Executed verification

The exact original module and test Git blobs were copied to a local Node 22.16.0 reproduction with `lib/` and `tests/` folders and verified by `git hash-object` against the remote objects. After the edits:

- **27/27 targeted tests passed**, in four suites (formula blueprint 9, ranking sensitivity 9, evidence reconciliation 8, discovery guard 1).
- All modified files passed `node --check`.
- The harness used native `node:test` **only to supply global `describe` and `it` functions** for the Mocha-style test sources; it was **not the Mocha binary**, so a genuine `pnpm exec mocha` run under Node 24 remains mandatory.
- The committed new test Git blob hashes should match the ones computed from the locally executed files.
- Note: The formula blueprint and evidence/interval suites still contain intentional fixture stubs. Those are isolated unit tests, not independent integrated proof against real live provider data.

## Remaining P0 release process

1. Administrative resolution of GitHub Actions scheduling incident documented in issue #579. The last examined PR head had 62 queued checks and 2 skipped; it has no all-green exact-head evidence.
2. Run `pnpm exec mocha --config .mocharc.targeted.json tests/sonara-research-formula-blueprints.test.js tests/sonara-research-rank-sensitivity.test.js tests/sonara-research-evidence-reconciliation.test.js tests/sonara-research-suite-discovery.test.js` under repository's required Node 24 toolchain, then `pnpm test`, lint, security scans, typecheck/build and DB/RLS gates.
3. Confirm protected branch and approvals before merge; perform staged deployment and live tenant/billing verification separately. No approval, workflow bypass, or production activation comes from this isolated fix.
