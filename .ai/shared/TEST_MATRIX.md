# Test Matrix

## Codex integration verification - 2026-07-18
- `pnpm install --frozen-lockfile`: pass, pnpm 11.1.1.
- `pnpm audit --audit-level moderate`: pass, no known vulnerabilities.
- `pnpm run verify:launch`: pass, 255 tests plus build/lint/secret scan/route smoke/schema/config/registry gates.
- `pnpm run test:docs`: pass.
- `git diff --check`: pass.
- Served HTTP spot check: 9/9 routes/assets returned 200; interface marker and three product links present; broken encoding and retired public names absent.

Current: 255 mocha tests (tests/*.js, run via pretest apply:runtime chain).
Suites: server.test.js (routes/auth/admin/pricing/legal truthfulness),
premium-application/premium-interface (UI markers, SW, tokens), route-registry,
saas-platform-upgrade, functional-saas, formulas, ecosystem, brand-*, launch-readiness,
platform-prep, monorepo-smoke, entity-security-smoke, creator-music-config.
Gates: verify:launch = apply:runtime + build + test + scan:client-secrets +
lint + smoke:routes + verify:db + verify:config. Plus audit, test:docs,
verify:postdeploy (includes smoke:live — needs network to production).
Frontend browser QA harness (not committed): scratchpad playwright checks —
13 routes × 5 widths: status/overflow/console. Rerun after visual changes.
