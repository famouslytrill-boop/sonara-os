# Handoff Log

## 2026-07-19 - Organization setup schema compatibility

- User evidence showed `Organization setup required` while the non-secret readiness endpoint reported `accountDatabase=configured`.
- Vercel production logs confirmed two HTTP 503 responses for `POST /account/setup/organization`.
- Repository migration evidence explains the contradiction: migration 010 created `organizations.company_key` as required, migration 011 added `slug` and `owner_id`, and the current application insert supplied neither the required legacy `company_key` nor `created_by`.
- The application also attempted `owner_user_id`, which is not defined by the accepted repository migrations.
- Prepared an idempotent runtime compatibility patch that first looks up the deterministic slug, writes the shared hosted-schema shape, keeps canonical `organization_memberships`, retries membership safely, and logs only sanitized PostgREST status/code evidence on failure.
- Added regressions for legacy-required organization creation and partial-create retry recovery.
- No production schema migration or data mutation is included. Exact-head CI, Preview deployment, and authenticated production smoke evidence remain mandatory before the incident is closed.

## 2026-07-19 - Readiness Preview UI repair

- The supplied screenshot came from a Vercel Preview deployment, not Production.
- Root cause: the page rendered every internal compatibility field, duplicating database, payment, email, Google, and founder/admin concepts.
- Implemented one canonical human-facing card list, one aggregate Founder/Admin protection result, and Deployment environment context while preserving the JSON compatibility fields.

## Outstanding launch gates

- Organization setup exact-head verification and authenticated deployed smoke test.
- Isolated Preview backend configuration and verification.
- One real production email delivery with persistence evidence.
- Authenticated payment lifecycle through cancellation and relock.
- Qualified legal review.
- PWA/browser and physical-device evidence.
