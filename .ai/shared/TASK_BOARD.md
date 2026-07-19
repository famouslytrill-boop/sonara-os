# Shared Task Board

Updated: 2026-07-19 by Codex (Agent A)

## In progress

- None for the production connectivity release.

## Blocked / owner-dependent

- Complete an authenticated organization-creation smoke test against the deployed hosted-compatible schema.
- Configure an isolated non-production backend for complete Preview account testing.
- Complete one authenticated billing lifecycle and confirm access relock.
- Complete one approved production email delivery and verify persistence.
- Run authenticated tenant-isolation and private-storage tests.
- Configure Google sign-in after an approved redirect URI is available.
- Obtain qualified legal review.
- Complete PWA/browser and physical-device verification.

## Done

- Merged PR #36 with exact-head protection to `aebee84129f3488d91bc51ea81aa0f8c423fc8e7`.
- Deployed READY Vercel Production deployment `dpl_7RzByXjMYwGp7C78CuNVC6AuiV8Q` on the exact merge SHA.
- Expanded main CI to run complete build, test, lint, typecheck, client-secret, route, database/storage, configuration, registry, OpenAPI, and documentation checks.
- Added scheduled and post-main production connectivity verification with exact-SHA deployment waiting.
- Verified live health, provider/database readiness, support connection, public routes, PWA assets, redirects, protected access boundaries, and safe validation failures.
- Verified no Vercel runtime errors after the release.
- Released the cohesive 2027 frontend and canonical SONARA registry in PR #34.
- Connected the public presentation to live non-secret readiness while keeping Supabase Postgres authoritative.
- Merged organization setup compatibility with deterministic slug recovery and canonical organization membership.
- Released payload-size handling and the production database/paid-launch baseline.
