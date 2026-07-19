# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Readiness Preview UI

- Readiness display patch applies idempotently: pass.
- Canonical launch-readiness cards render once each: pass.
- Contradictory Founder access cards are removed: pass.
- One fail-closed Founder/Admin protection card remains: pass.
- Preview/Production environment, commit, and branch context render without private values: pass.
- JSON readiness compatibility fields remain unchanged: pass.
- Full test suite and build: pass.
- Dependency scan: pass.
- Docker build: pass.
- Database preview/migration validation: pass.
- Exact-head Vercel Preview `dpl_4kcjEB6x9qUDGHAjtsTN6Y4NfB1a`: READY.

## Existing production evidence

- Production runtime health: pass.
- Production migration ledger: 42/42.
- Structured request limit and stable HTTP 413 regressions: pass.
- Paid access remains fail-closed.

## Pending evidence

- Isolated Preview backend connectivity.
- Real production email delivery.
- Authenticated payment lifecycle through cancellation/relock.
- Qualified legal review.
- PWA/browser and physical-device verification.
