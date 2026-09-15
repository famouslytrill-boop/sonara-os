# Shared Task Board

Updated: 2026-09-15T12:30:00-04:00

## In progress

- [Codex] Notification subscription foundation, signup confirmation state, palette alignment, and launch documentation. Implementation complete; metadata lock release pending.

## Blocked

- [Shared] Product code work is blocked from safe dual-agent parallelism until ownership of the 155 modified, 1 deleted, and 18 untracked pre-existing paths is established or committed in logical groups.
- [Shared] Live provider proof is blocked pending authenticated dashboard/provider access and explicit production approval.
- [Shared] Main integration is blocked by unrelated Git histories (`fix/activate-real-saas-system` and `origin/main` have no merge base); use an owner-reviewed migration onto the current main architecture before merging.
- [Codex] Inspect/apply `sonara-branch-all-commits.patch` after the actual file is attached or an absolute local path is provided. Before application, verify patch format, source/base commits, affected paths, secret exposure, binary payloads, and `git apply --check` against the dirty worktree.

## Ready for Codex

- Audit the in-flight backend/API/migration changes after ownership is established; run focused tests and produce a change partition plan.
- Normalize the database membership naming contract without duplicating tables; propose a compatibility ADR before migration work.
- Verify Stripe, contact/email, auth, readiness, and RLS contracts against tests and current migrations.
- Generate a complete machine-checked route/API registry from canonical sources after the dirty tree is stabilized.

## Ready for Claude

- Read all `.ai/shared/**` files, claim a frontend audit task, and lock only the exact frontend paths needed.
- Audit the 235-route frontend surface for visual duplication, dead ends, setup states, mobile overflow, accessibility, and route-to-renderer parity.
- Do not modify API shapes, migrations, billing/auth behavior, `package.json`, Vercel config, service worker, or shared route contracts without a coordinated lock.

## Done

- [Codex] Added explicit opt-in web push subscription storage and gateway, signup confirmation state, palette alignment, service-worker delivery boundary, and notification/media documentation. Build, tests, secret scan, lint, smoke, and aggregate launch verification passed on 2026-09-15.

- [Codex] Discovered current pnpm monorepo/Vercel SPA plus serverless API runtime.
- [Codex] Inventoried routes, packages, migrations, API handlers, and dirty-worktree risk.
- [Codex] Created the first shared contracts, registries, risks, questions, and eight architecture decisions.
- [Codex] Validated required shared files, JSON registries, package-manager policy, migrations, controlled architecture, and shared patch hygiene.
