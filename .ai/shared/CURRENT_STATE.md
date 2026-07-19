# Current State — updated 2026-07-19 by Codex (Agent A)

## Production baseline

- Production remains on verified runtime merge `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`, deployment `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f`.
- Live health reports that exact SHA on `main` in `production`.
- Production readiness remains configured for the account database, payments, payment updates, email delivery, checkout plans, and founder/admin protection.
- Production database evidence remains 42/42 migrations with linked schema lint passed.
- Paid access remains fail-closed on persisted active/trialing billing state or documented owner/admin authorization.

## Readiness Preview UI repair

- The supplied screenshot is from Preview deployment `dpl_4zWpZ54t762xCsD2gUx3pdPY29WX`, branch `codex/payload-size-production-handoff`, SHA `e1c5e3f8aa83199d780e61c4465659eeacc468d3`; it is not the production domain.
- The page rendered every internal compatibility alias, producing duplicate Account database, Payment connection, Payment updates, Email delivery, Google sign-in, and founder/admin cards.
- A source-level founder check and the fail-closed aggregate admin check were both labeled “Founder access,” producing the contradictory Missing/Configured cards visible in the screenshot.
- Branch `codex/fix-readiness-preview-ui` renders one canonical human-facing card per operational concept, uses the aggregate founder/admin protection status, and adds deployment environment, commit, and branch context.
- `/api/readiness` keeps its machine-readable compatibility fields; the change is presentation-only.
- Preview data services remain isolated from Production. Real Preview integration testing requires a separate non-production backend scoped to Preview or the specific branch and a new deployment.
- Production provider configuration, migrations, pricing, legal state, and paid-access behavior are unchanged.

## Existing evidence boundaries

- The 1 MiB structured-body/HTTP 413 repair remains deployed and verified.
- Preview display correctness is pending exact-head CI and deployment verification.
- Preview backend connectivity is not claimed until an isolated Preview environment is configured and tested.
- One real production email delivery, the authenticated payment/cancellation/relock lifecycle, qualified legal review, access replacement, PWA install/offline proof, and physical-device vibration remain pending.
