# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Cohesive 2027 frontend integration

- Runtime patch applies twice without changing output.
- Homepage loads the cohesive CSS and JavaScript after the accepted interface engine.
- Canonical runtime registry contains SONARA Industries, SONARA One, the three product names/routes/logos, and approved `$0 / $7 / $19 / $39` pricing.
- Homepage renders live readiness states and never replaces a missing write with visual success.
- Product controls use tab semantics; founder milestones expose pressed state and visible text.
- CSS is scoped to the homepage, supports light/dark appearance, 44-pixel controls, 360-pixel mobile widths, and reduced motion.
- JavaScript adds no automatic sound or vibration and respects reduced motion.
- Full tests, typecheck, lint, build, secret scan, route smoke, database contract, route registry, OpenAPI, dependency scan, Docker, and Vercel Preview must pass before merge.
- Production must be verified by exact SHA, live homepage/assets/readiness, and runtime-error inspection after merge.

## Organization setup compatibility

- Runtime patch applies twice without changing output.
- Hosted-compatible organization records include private legacy requirements, deterministic slug, owner identity, and canonical membership.
- Partial-write retries reuse the deterministic organization rather than duplicating it.
- Failure logs contain sanitized status/code evidence only.

## Existing evidence

- Production database connection reports configured and migration ledger remains 42/42.
- No frontend integration migration, RLS policy, secret, billing rule, or customer-data mutation is included.

## Pending evidence

- Exact-head cohesive UI CI and Vercel Preview.
- Exact-SHA cohesive UI Production deployment and live smoke.
- Authenticated deployed organization-creation smoke test.
- Remaining launch gates recorded in TASK_BOARD.md.
