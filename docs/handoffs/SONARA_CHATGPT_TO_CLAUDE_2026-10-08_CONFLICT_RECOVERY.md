# SONARA — ChatGPT/Codex -> Claude Code conflict-recovery handoff
Created: 2026-10-08 America/New_York. Verified source: GitHub + Vercel + Supabase connector reads. **No live deployment or migration authorized.**

## Paste into Claude Code
Continue SONARA Industries/SONARA One, Business Builder™, Creator Studio™, Growth Studio™ in `famouslytrill-boop/sonara-os`. Fetch and verify exact current `main`, PR #445 and PR #446 before edits. Read `AGENTS.md`, `docs/HANDOFF_PROMPT.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/TASK_BOARD.md`, and `docs/research/SONARA_REPOSITORY_RECOVERY_AND_ECOSYSTEM_ENGINEERING_2026-10-08.md`. The owner previously instructed SONARA's website to remain offline. **Do not deploy, unpause, migrate production, move funds, activate providers, send campaigns, change secrets, publish policies or force-merge.**

## Verified GitHub reconciliation
| Scope | Initial problem | Latest directly observed recovery | Follow-up |
|---|---|---|---|
| Main | `1e42bdee96c35ee99e77037d99436f5558fc4742` | Supplied as both conflict-resolution base parents | Refresh latest SHA before branch edit |
| #446 Claude source | 15 behind; eight overlapping changed files; GitHub dirty | Merge commit `77ea60e3ec17be34082373fcbc651fa748fdff2a`; GitHub mergeable=true | A different contributor subsequently advanced the branch to `1c5b32657a683d6bd2b0d9b57abe743334535f79` on inspection. **Do not reset or overwrite this later head.** Investigate latest checks |
| #445 Reservation work | 242 behind, 15 overlapping PR files; GitHub dirty | Merge commit `305933929b03190e2219af70d84736c288a149aa`; GitHub mergeable=true | Hosted CI pending, no claim test passes. Reconcile real product behavior and generated inventory |
| #453 push security | Previous draft PR | Merged into main | Keep parsed-origin guard in `public/sw.js` |

### #446 reconciliation details
On old head `dbfcdfda497b8c88d39dc335024c845ea9cff97e`, combined six non-overlapping source/test/handoff diffs against main: `lib/sonara-merchant-payments.cjs`, `routes/sonara-last9-routes.cjs`, `routes/sonara-merchant-payment-routes.cjs`, two storefront tests, handoff log. Created merged tree with 71 changed paths and current main parent. Generated `data/capability-inventory.json` and `docs/CAPABILITY_MAP.md` require exact-head regeneration. Initial CI had Android paused-site icon issue, production migration dry run and code checks. Later head workflows reported `action_required` at inspection: investigate GitHub authorization/approval, do not treat as green or as a failing code test.

### #445 reconciliation details
Preserved current main's newer operations analytics rather than replacing it with 2026-10-07 branch's older analytics/booking implementation. Combined non-overlapping changes for route registry, `public/sw.js`, last9 routes, `server.js` and fake Supabase. Added main-based resource page in `routes/sonara-operations-expansion-routes.cjs` using branch's `lib/sonara-reservation-pages.cjs`; validates business-scoped location, bounded integer capacity and confirmed row save. The new form contains a `back` destination field to support main's HTML redirect contract. Deferred old generated docs/counts to current main while CI regeneration is pending. The old branch added tests assuming its replacement handlers: they MUST be retested/refactored for current main, not blindly relabelled passing.

## Hosted controls: current verified
- Vercel project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY`: live false; latest deployment BLOCKED. Leave paused.
- Supabase `yqncsonkxgwhcxedgevk`: ACTIVE_HEALTHY; 160 applied migrations through `20261007120000`. `20261007130000` required by #446 is absent; do not apply without owner-controlled rollout.
- Supabase security: 8 authenticated-executable SECURITY DEFINER functions; 65 intentional-or-needs-review RLS-no-policy informational; password leak and extension-public warning. Performance: 378 unindexed FK, 28 initplan, 581 unused indexes, 1292 multiple permissive policies, 1 duplicate index. Don't mass-change grants/indexes/policies.
- Vercel Hobby commercial-suitability check is not waived by code review; licensing and customer receipts remain separate.

## Immediate tasks for Claude (in order)
1. Refresh GitHub exact heads and compare file sets. Inspect PR #446's **newer external head** before editing; coordinate overlap with active development.
2. Inspect PR #445 latest head; run pinned toolchain `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build`, `pnpm run verify:gates`, `pnpm run smoke:routes` and hosted Browser Quality/Node/Docker; capture exact SHA, failures, skip reasons.
3. For #445, review new reservation page and acceptance tests: GET signed in/out, location belongs to same organization, invalid/decimal/overflow capacity, missing database write receipt, form error redirect, duplicate API/HTML handlers, accessible keyboard/mobile UI. Re-run generated route/map/catalog/migration and proprietary notices with repo scripts, not hand-updated counters.
4. For #446, investigate exact-head source generator, Android packaging while live site paused, CodeQL/approval, migration dry-run dependency and provider-proof gates. Never unpause site just to make packaging fetch succeed.
5. Security-first next slice: inspect names/signatures/EXECUTE grants for eight privileged Supabase functions, write a source-grounded remediation plan; new migration only with separate approval and negative tenant tests.
6. Complete one verifiable paid business transaction in a controlled provider environment only after separately authorized provider activation and migration; Creator versioned delivery and Growth delivery receipts remain proof-dependent.
7. Append a dated log to `.ai/shared/HANDOFF_LOG.md` with exact changed file SHA/CI results. Do not rewrite `docs/HANDOFF_PROMPT.md` manually; invoke its generator if source input changed.

## Return packet MUST contain
```text
STARTED_FROM_MAIN_SHA:
PR_445_PREVIOUS_HEAD / NEW_HEAD / MERGEABLE:
PR_446_PREVIOUS_HEAD / NEW_HEAD / MERGEABLE:
CHANGED_FILES_AND_REASON:
CURRENT_GENERATED_INVENTORY_COUNTS:
EXACT_HEAD_NODE_PNPM:
CI_SUCCESS / FAILURE / PENDING with run links:
TENANT/FORM/MONEY/ACCESSIBILITY_TESTS:
SUPABASE READS / MIGRATIONS APPLIED (NONE if none):
VERCEL READS / DEPLOYMENTS (NONE if none):
PROVIDER ACTIONS / TRANSACTIONS (NONE if none):
PRODUCTION_PAUSED_CONFIRMED:
CURRENT_BLOCKERS:
FIRST_SAFE_NEXT_ACTION:
HANDOFF_TO_CHATGPT:
```
Don't mark checks green before tools report green. Never claim the author of this return packet performed work until actually reported.
