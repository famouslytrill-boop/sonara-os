# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Organization setup compatibility

- Runtime patch must apply twice without changing output.
- Authenticated setup must create an organization when the hosted table requires company_key and created_by.
- The write must include owner_id and a deterministic slug and must not include owner_user_id.
- Canonical organization_memberships ownership must be recorded.
- Retrying after a partial write must reuse the slug and avoid duplicate organizations.
- Failure logs may contain HTTP status and database error code only.
- Full tests, typecheck, lint, build, dependency scan, Docker, database validation, and Vercel Preview are required before merge.

## Existing evidence

- Production logs show HTTP 503 for the organization setup route.
- The database connection is configured.
- The migration ledger remains 42/42; this repair adds no migration.

## Pending evidence

- Deployed authenticated organization setup smoke test.
- Remaining launch gates recorded in TASK_BOARD.md.
