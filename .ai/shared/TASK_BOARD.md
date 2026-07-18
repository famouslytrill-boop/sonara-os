# Shared Task Board

Updated: 2026-07-18T04:20:00Z by Claude (reconciled with Codex board of 2026-07-17T23:39-04:00)

## In progress
- [Claude] LOCKED frontend audit: 235/124-route surface audit (visual duplication, dead ends, setup states, mobile overflow, a11y, route-to-renderer parity). Lock in LOCKS.md.

## Blocked
- [Shared] Codex reports a dirty tree in ITS clone (155 modified / 1 deleted / 18 untracked). NOT visible from Claude's clone (clean at origin/main + 2 commits). Codex must partition/commit its own worktree; Claude cannot own that.
- [Shared] Live provider proof pending owner approvals + authenticated provider access.

## NEEDS RECONCILIATION (both agents read before any architecture work)
- RUNTIME DISCREPANCY: Codex board claims "pnpm monorepo/Vercel SPA plus serverless API runtime". Claude's live verification (2026-07-16/18) shows production = ROOT EXPRESS app (server.js via api/index.js, Vercel rewrite-all to /api; /api/health returns deployed SHA; deployment metadata confirms root build). See ADR-0001 + SYSTEM_MAP.json. If Codex's claim comes from the nested frontend/ or my-app/ trees, those are NON-PRODUCTION experiments. Do NOT repoint Vercel without a parity ADR.
- ROUTE COUNT: Codex says 235 routes; canonical registry gate says 124 required GET / 347 registrations (scripts/verify-route-registry.cjs). Claude's audit (in progress) will produce the machine-checked list from the canonical source.
- .ai FORK: Codex bootstrapped its own .ai/shared in its clone; this repo-side .ai/shared (this file's tree) is the pushed/canonical one once merged. Codex must rebase its shared-memory edits onto this tree, not overwrite it.

## Ready for Codex
- Rebase Codex-local .ai/shared content onto this canonical tree; resolve the runtime + route-count discrepancies with evidence links.
- Partition + commit the 155/1/18 dirty-tree changes in its clone in logical groups.
- Stripe TEST-MODE end-to-end proof (checkout → signed webhook → billing_subscriptions active → unlock → cancel → relock) → reports/BILLING_REPORT.md.
- After owner sets RESEND_FROM_EMAIL: verify readiness flip + one approved test delivery → reports/EMAIL_REPORT.md.
- Membership naming contract normalization: propose compatibility ADR BEFORE migrations (organization_memberships vs workspace_memberships vs business_memberships all exist).
- openapi/sonara.yaml for existing routes; no shape changes without contract-first log entry here.

## Ready for Claude (after current audit)
- Live production browser QA after redesign deploys.
- Dark-mode toggle UI (CSS remap shipped; needs control + pre-paint snippet + user_preferences sync).
- Canvas product-identity scenes behind existing enhancement ladder.

## Done
- [Codex] Merged PR #20: expanded paid-launch verification report + Supabase runbook (supersedes Claude's doc commits; content reconciled).
- [Codex] Own-clone inventory + local shared-contract drafts (NOT yet in repo).
- [Claude] Production DB verification + 5 owner-approved migrations applied; ledger=39 (2026-07-16).
- [Claude] Clark visual redesign implemented + QA'd (commit "Redesign visual system", gates green, 65 browser checks clean).
- [Claude] Canonical .ai/shared bootstrap pushed on branch claude/sonara-mvp-launch-g6ec8v.
