# SONARA Shared Project Memory

Last updated: 2026-07-17T23:39:04-04:00 by Codex

## Identity

- Parent: SONARA Industries
- Platform: SONARA OS
- Products: Business Builder, Creator Studio, Growth Studio
- Remote: `https://github.com/famouslytrill-boop/sonara-os.git`
- Primary branch: `main`
- Current checkout: `C:\Users\AXPAY\Documents\Codex\2026-04-24\create-the-clean-signal-os-repo`
- Current work branch: `fix/activate-real-saas-system`

## Verified architecture

- This checkout is a pnpm monorepo (`pnpm@11.1.1`, Node `22.x`).
- The deployable web runtime is built from `packages/web` into `packages/web/dist`.
- Vercel serves `/api/*` from root serverless functions and rewrites other paths to `/index.html`.
- `scripts/start.mjs` serves the built SPA locally; there is no root Express `server.js` in this checkout.
- Supabase migrations are the database contract. Stripe, Resend, and Supabase secrets remain server-only.
- `packages/web/src/routes/route-manifest.ts` is the canonical frontend route inventory.

## Agent boundaries

- Codex owns backend, APIs, auth behavior, authorization, SQL/RLS, billing, email, infrastructure, CI, security controls, contracts, and backend tests.
- Claude owns frontend architecture, presentation, design system, responsive UX, graphics, motion, accessibility presentation, and frontend tests.
- Shared files require a lock and contract-first coordination.

## Non-negotiables

- Read every file under `.ai/shared/` before editing code.
- Check `LOCKS.md`, Git status, and recent history before work.
- Do not overwrite the current dirty worktree or assume another agent's uncommitted changes are disposable.
- Do not expose secrets, disable RLS, fake database writes, fake provider readiness, or use checkout redirects as entitlement proof.
- Do not change API shapes silently. Update contracts and tests first.
- Use pnpm only in this checkout. Do not create `package-lock.json`.
- Do not force-push, auto-merge, or deploy without owner approval.

## Session close protocol

Update `CURRENT_STATE.md`, `TASK_BOARD.md`, `HANDOFF_LOG.md`, `CHANGELOG_AI.md`, `RISKS.md`, `OPEN_QUESTIONS.md`, and all affected contracts/ADRs before ending.

