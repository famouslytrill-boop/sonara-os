# Platform consolidation and owner setup

Verified 29 September 2026. Baseline: `996384be` on `main`.

## Current evidence

- GitHub had no open pull requests at the start of this audit. There were no PRs to bundle.
- The repository is PUBLIC, verified after the owner's latest request. Keep it public until the owner explicitly requests another visibility change.
- The earlier private-repository branch-protection HTTP 403 was observed before visibility was restored. Protection settings still require verification; public visibility alone does not prove they are configured.
- The original checkout has extensive uncommitted changes. They remain preserved; integration is in `sonara-platform-consolidation`.
- Docker Engine 29.8.0 responds. The existing `famouslytrill-project` Supabase containers are running; its Vector log collector is restarting because its Docker log source reports NetworkUnreachable. This is an adjacent local stack, not evidence of a production database outage.
- Node reports v24.21.0. The locked pnpm 12.7.0 native binary is blocked by Windows Application Control. Dependency installation and the required full release checks cannot currently run in this worktree.
- No blanket migration, legacy deletion, optional model download, or customer-data seed was performed.

## 1. Restore the approved package manager

Ask the Windows administrator to review the Application Control event for:
`C:\Users\AXPAY\AppData\Local\node\corepack\v1\pnpm\12.7.0\pnpm-native.exe`.
The error explicitly says an Application Control policy blocked the file.
Have the administrator validate its provenance and approve the repository's pinned package manager under the organization's policy. Do not disable Application Control or substitute an unreviewed binary.

After the administrator resolves the block, open PowerShell:

```powershell
Set-Location 'C:\Users\AXPAY\Documents\Codex\2026-04-24\sonara-platform-consolidation'
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:api
pnpm run verify:db
pnpm run verify:route-surface
pnpm run smoke:routes
pnpm run scan:client-secrets
```

Expected: Node 24.x, pnpm 12.7.0, and each command exits zero. A failing command must be diagnosed before publication; do not treat a skipped provider or migration check as a pass.

## 2. Verify public-repository protections

1. Keep repository visibility public. Do not change it to private as part of maintenance.
2. Open https://github.com/famouslytrill-boop/sonara-os/settings/branches and restore the required reviews and CI checks for `main`.
3. Review https://github.com/famouslytrill-boop/sonara-os/settings/environments and confirm the production environment protections and secrets remain available on the selected plan.
4. Check GitHub Actions usage limits and Vercel's GitHub installation access.
5. Keep credentials server-only. Public source visibility does not authorize publishing secrets or customer data.

## Navigation and migration verification

- Live route smoke: 281 assertions passed against the deployed baseline, covering selected public routes, redirects, protected endpoints and assets. This is not an exhaustive crawl of every external link or authenticated journey.
- Static production schema check: 178 migrations, 146 required tables, eight operational indexes and seven private buckets passed the repository contract.
- Frozen migration check: 133 existing migration entries are unchanged; three entries remain generator-owned. Fresh database replay and live database state are not proven by this check.
- Local navigation fix: cancelled and alternate-window clicks no longer trigger the blocking loader; failed navigation recovers after eight seconds. Three focused regression tests cover click handling, timeout recovery and browser-history restoration. These edits are not deployed.

## 3. Check local database logging

```powershell
docker info --format '{{.ServerVersion}}'
docker ps --format '{{.Names}}: {{.Status}}'
docker logs --tail 30 supabase_vector_famouslytrill-project
```

The running database belongs to the adjacent `famouslytrill-project` stack. Inspect that stack's Docker log-source configuration and network routing before restarting it. Keep existing database volumes. Do not run a volume-removal or database-reset command. Confirm Vector remains running after its Docker endpoint is reachable, then verify logs arrive in Studio. Database read/write and tenant-isolation tests are separate evidence.

## 4. Verify media without AI

```powershell
pnpm run workers:smoke --local
```

This executes the existing deterministic WAV renderer twice, compares bytes, validates the WAV header, and checks escaped WebVTT output. It does not test a remote worker.

For an already configured worker, securely supply `CREATOR_MEDIA_WORKER_URL`, `CREATOR_MEDIA_WORKER_TOKEN`, and `SONARA_MEDIA_SMOKE_JOB_ID` in the terminal environment. The job ID must belong to an existing authorized test job. Then run:

```powershell
pnpm run workers:smoke
```

Exit 2 means configuration is missing. Exit 1 means the check failed. Exit 0 with `reachable` proves that the existing job can be polled; it does not prove the output artifact is correct or that a new render completes. The command never submits a job, follows a redirect, or prints tokens and provider response bodies.

Use [the existing media worker guide](MEDIA-WORKER-INSTALL.md) for the application wire contract. Follow with an authorized end-to-end job: submit, poll, download, inspect output, verify organization isolation, retry with the same idempotency key, and exercise failure recovery.

## Architecture and adoption decisions

| Area | Path | Evidence still required |
|---|---|---|
| Business operations | Preserve existing organization-scoped records, forms, workflow transitions and Supabase backend | Signed-in customer journeys and cross-tenant tests |
| Audio and captions | Existing bounded WAV synthesis and WebVTT export run without AI | Real customer output and download usability |
| Video | Template-based rendering on an isolated worker; fixed fonts, assets, codec versions and timestamps | Renderer installation, output comparison, storage authorization and resource limits |
| Voice | Recorded licensed speech or separately reviewed synthesis engine | Consent, voice provenance, license and output quality |
| Search | Keep Meilisearch and Supabase pgvector contracts | Configured services and relevance measurements |
| Transport and field work | Build on appointments, work orders, locations and consented device location | Actual routing provider, fares, dispatch rules and operator testing |
| Empty workspaces | Provide useful creation/import actions and explain genuinely missing records | Never invent transactions, users, inventory or analytics to fill a screen |
| Legacy cleanup | Trace imports, routes, migrations and compatibility use before removal | Passing gates and rollback plan per removal |
| Optional AI | Enhance explicit tasks behind existing provider boundaries | Core operations must retain their provider-free path |

Research sources checked during this audit:

- https://ffmpeg.org/legal.html: FFmpeg licensing depends on its build. Review codec and build options before distribution. No binary was installed in this pass.
- https://github.com/remotion-dev/remotion/blob/main/LICENSE.md: Remotion has commercial licensing conditions; do not classify it as unrestricted free software for every company.
- https://www.remotion.dev/docs/random: seeded values support repeatable composition, but pinning media assets and encoders is also required. This does not promise identical output across every CPU/GPU.
- https://cli.github.com/manual/gh_repo_edit: repository visibility is a separate account operation from source commits.

Product direction: measure task completion, errors, response time and customer retention for the three studios before adding another industry platform. Shared customers, bookings, orders, invoices and media assets offer a clearer progression than separate duplicated applications for every industry. No claim of superiority over every competitor has been established.

## Release and handoff

Once the local gates and repository protections work, commit the selected integration files, open one PR, and wait for its required checks. Merging `main` automatically triggers the Controlled Production Deployment workflow: it can apply migrations and update production configuration. Verify the resulting workflow and both public `/api/health` commit SHAs before declaring the release live.

Keep payment credentials server-only in the existing protected environment. Reuse the live Stripe price verification gate; do not manually invent price IDs or change catalog names in this setup pass.

Remaining scope is substantial: full deterministic video/voice execution, authenticated business journeys, hardware tests, industry-specific operations, and comparative product research have not all been completed by this audit. OS and hardware upgrades, billing purchases, license acceptance and account recovery require the relevant owner's interaction.
