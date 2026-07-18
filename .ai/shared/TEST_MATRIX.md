# Test Matrix

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
