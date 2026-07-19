# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Required gates

- frozen-lockfile install
- dependency audit
- typecheck
- lint
- complete tests
- build
- route and contract verification
- database migration preview validation
- Vercel preview

## Readiness Preview UI coverage

- The readiness display patch applies twice without changing the result.
- The Business Builder launch-readiness page renders one Deployment environment card.
- It renders one card each for Account database, Payment connection, Payment updates, Email delivery, Google sign-in, Founder/Admin protection, Checkout, Owner legal approval, Pricing catalog, Legal pages, and Legal review boundary.
- A Preview environment with a valid founder source but unavailable account services shows one fail-closed Founder/Admin protection result and no contradictory Founder access cards.
- The deployment card identifies Preview versus Production and includes sanitized commit and branch context.
- The page does not render private configuration names or values.
- The JSON readiness endpoint retains its compatibility fields.
- Production behavior and database migrations remain unchanged.

## Existing release evidence

- Production remains on verified runtime merge `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`, deployment `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f`.
- Production database evidence remains 42/42 migrations with linked schema lint passed.
- The 1 MiB structured-body and HTTP 413 regressions remain active.

## Evidence boundaries

- Readiness Preview UI code is pending exact-head branch gates.
- Preview backend connectivity remains unproven until an isolated Preview environment is configured and a new deployment is tested.
- Email-delivery proof, the authenticated payment lifecycle, qualified legal review, access replacement, PWA install/offline proof, and physical-device vibration remain pending.
