# AI Engineering Changelog

## 2026-07-17

- Recorded a blocked intake for `sonara-branch-all-commits.patch`; the reported upload was unavailable in the attachment cache, so no patch content or product code was changed.
- Added repository-based dual-agent shared memory under `.ai/shared/`.
- Recorded the actual current runtime: pnpm monorepo, static web artifact in `packages/web/dist`, Vercel API functions under `api/`, and SPA fallback routing.
- Added initial route, module, integration, database, frontend, API, security, design, and test contracts.
- Added task ownership, risk, open-question, lock, and ADR systems.
- Validated the shared-file set, JSON registries, package-manager policy, migration ordering, controlled architecture, and shared patch hygiene.
- No product code, migration, dependency, deployment configuration, or provider setting changed.
- Shared contract task committed as `d693c58a89fa15e884a4b2513767819531ee8cc8`; no push or deployment was performed.

## 2026-09-15

- Added opt-in browser notification subscription settings, service worker handling, server-only authenticated subscription storage, and an RLS migration.
- Added signup confirmation state so email-confirmation flows do not imply an authenticated redirect.
- Aligned app palette and manifest theme colors with the evergreen/cobalt launch system.
- Added notification/media operations documentation and shared route, API, module, integration, and test-contract entries.
- Tightened the service worker to safely parse payloads and accept only same-origin paths; removed a broad RLS policy rejected by the repository checker.
- Verification: install, build, 79 test files/265 tests, client secret scan, lint, smoke routes, and `verify:launch` all passed.
