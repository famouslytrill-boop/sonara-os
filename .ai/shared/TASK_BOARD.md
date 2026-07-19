# Shared Task Board

Updated: 2026-07-19 by Codex (Agent A)

## In progress

- Verify the organization setup compatibility patch through full CI, database preview validation, Vercel Preview, and an authenticated deployed smoke test.
- Confirm a retry after a partial organization write reuses the deterministic slug and records canonical organization membership without duplication.

## Blocked / owner-dependent

- Configure an isolated non-production backend for complete Preview account testing.
- Complete one authenticated payment lifecycle through cancellation and relock.
- Complete one approved production email delivery and verify persistence.
- Obtain qualified legal review.
- Complete PWA/browser and physical-device verification.

## Done

- Reproduced the organization setup failure from production logs and traced it to the legacy required organizations.company_key field plus the undefined application owner_user_id field.
- Readiness Preview UI repair: canonical cards, aggregate Founder/Admin protection, and deployment context.
- Payload-size request handling and stable HTTP 413 release.
- Production database migration and paid-launch baseline verification.
