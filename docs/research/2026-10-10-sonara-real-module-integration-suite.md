# SONARA Phase 18 — Real-module Research Atlas integration suite

**Date:** 2026-10-10. **Scope:** Draft PR #605. No runtime feature, database, provider access, CI workflow, branch protection, deployment, or paid service changed.

## Prior defect and rationale

The existing test suites for formula research, evidence reconciliation and interval-based rank sensitivity use controlled dependency fixtures. That helps isolate individual functions, but passing mocked tests does **not** show whether the real production module chain can load and interoperate in the source tree.

Added `tests/sonara-research-runtime-integration.test.js` as a **direct dependency integration suite**. It uses regular `require("../lib/...")` calls, imports no stubs, changes no `Module._load` behavior, and is included by SONARA's existing Mocha discovery expression (`tests/**/*.js`). There are no external HTTP calls, credentials, database writes, raw consumer data, rights-republication steps or background agents.

### Real module chain

`Research Atlas → Comparable Top-50 → Evidence Reconciliation → Evidence Packet`

`Research Atlas → Comparable Top-50 → Interval Rank Sensitivity`

`Research Atlas → Formula Blueprint → Canonical Formula Registry`

The test suite exercises eleven positive/adversarial flows with **synthetic U.S. restaurant operator measurements**. It checks:

1. Atlas 50-category and four-publisher-cohort metadata.
2. Provisional numeric sorting of 51 comparable observations; ranking/publication remain unauthorized.
3. A 50th/51st cutoff tie results in **zero** purported Top-50 candidates.
4. Fully matched *caller-supplied* source receipts do **not** confer independent source truth, reviewer identity or production authorization.
5. Four omitted receipts become four unsupported measurement records.
6. Contradictory references are surfaced through the real evidence audit.
7. Invalid HTTP/local URLs are rejected by the real source intake.
8. Exact synthetic rank boundaries classify 50 in-sample subjects and one out-of-sample subject without claiming a national population ranking.
9. Overlapping scenario intervals make the cutoff ambiguous and preserve the 'uncertainty not validated' flag.
10. Actual canonical executable formula metadata links a research EOQ formula **without running a calculation**.
11. Finance research keeps explicit specialist review and never authorizes autonomous customer decisions.

### Exact-source validation

- **11/11 scenarios passed in an isolated V8 harness loading eight actual SONARA library modules plus this exact committed test source**, with a URL constructor and the unused Node crypto dependency simulated.
- The test was written and syntax-checked with native Node v22.16.0 in a local repository-style layout; the committed blob hash matches the syntax-checked source.
- No native Node 24, actual Mocha binary, pnpm full suite, lint, database/RLS test, runtime provider or production pass can be inferred from this diagnostic harness.
- Because this is a real dependency integration test, it should run once under the repository's standard `pnpm test` flow when GitHub Actions runner scheduling is restored.

**Developer validation commands after runner recovery:**

```sh
pnpm exec mocha --config .mocharc.targeted.json tests/sonara-research-runtime-integration.test.js --reporter dot
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run build
```

Then run the security and database/release gates already required by protected main. Issue #579 remains the runner assignment incident; code changes in this PR do **not** repair the account-level scheduling/permissions problem.

### Product effect

This phase improves **test integrity**, not externally visible product breadth. The cross-sector research catalog remains an unverified taxonomy; formulas and Top-50 candidates still require credible source evidence, rights and licensing, domain-specific measurements, independently authenticated review, accessibility/tenant isolation and a separately approved deployment.

Reference: [Mocha: configuring spec globs](https://mochajs.org/running/configuring/), and [Mocha: test globs](https://mochajs.org/running/test-globs/).
