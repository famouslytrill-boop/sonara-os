# Handoff Log

## 2026-07-19 - Readiness Preview UI repair

- The supplied screenshot came from Preview deployment `dpl_4zWpZ54t762xCsD2gUx3pdPY29WX`, not the production domain.
- The page rendered every internal compatibility field, producing duplicate cards for database, payments, payment updates, email, Google sign-in, and founder/admin readiness.
- Two different founder/admin checks were assigned the same visible label, creating the contradictory Missing/Configured cards shown in the screenshot.
- Branch `codex/fix-readiness-preview-ui` adds a canonical display list, uses the fail-closed aggregate Founder/Admin protection result, and adds deployment environment, commit, and branch context.
- The JSON readiness endpoint keeps its compatibility fields; this is a presentation repair.
- Regression coverage recreates the screenshot condition, requires every canonical card exactly once, checks Preview labeling, and verifies that private configuration details are not rendered.
- Production remains healthy and unchanged. Preview integration with data services remains a separate owner-dependent task using an isolated non-production environment followed by a new deployment.

## 2026-07-19 - Recent verified releases

- PR #30 merged the 1 MiB structured-body and stable HTTP 413 repair as `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`; production deployment `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f` is READY.
- PR #29 reconciled retry evidence after the missing local mount and model/Exit 144 failure were correctly classified as execution-environment failures.
- PR #27 completed paid-launch application/database finalization with 42/42 migrations and linked schema lint passed.
- PR #25 completed deterministic membership, paid-access query hardening, and reviewed operational indexes.
- PR #23 completed the canonical PWA and private-cache contract.
- Earlier detailed handoff history remains available in repository history.

## Outstanding launch gates

- One real production email delivery with persisted provider evidence.
- The authenticated payment → persisted entitlement → cancellation → relock lifecycle.
- Qualified legal review.
- Replacement of previously disclosed production access outside chat.
- Reproducible PWA/browser and physical-device evidence.
