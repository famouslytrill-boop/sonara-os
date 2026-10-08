# SONARA — Claude Code -> ChatGPT / Codex Resume Packet
Date created: 2026-10-08 America/New_York
Prepared by: ChatGPT as a **return-path template** for future Claude Code work. **This file is not authored by Claude and is not evidence that Claude performed actions described here.**
Canonical source: current GitHub repository `famouslytrill-boop/sonara-os`, not conversation recollection.

## Copy/paste into ChatGPT on the next continuation
Continue SONARA Industries engineering from the exact latest GitHub state. Before edits, inspect `AGENTS.md`, `docs/HANDOFF_PROMPT.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/TASK_BOARD.md`, the two `docs/handoffs/2026-10-08-*` packets, the latest open Claude PR #446 and ChatGPT's `codex/push-same-origin-handoff-20261008` branch/PR. Compare all exact SHAs; inspect file diffs to avoid conflicting or duplicate work. Preserve production-offline status. Fix the highest-impact previously unaddressed defect behind a separate testable PR, with negative tests, CI evidence, factual handoff and no owner-sensitive production operation.

## Latest verified facts at packet creation
| Dimension | Evidence / state | Meaning |
|---|---|---|
| Reviewed main | `867e40e7d3f3690d5fd7e0346d5ce28b69b1d425` | Must refresh before development |
| Open Claude PR | #446, `dbfcdfda497b8c88d39dc335024c845ea9cff97e` | Work underway; do not duplicate |
| Other open work | PR #445 | Booking/resource work may overlap UI paths |
| Recently merged | #448 release evidence, #452 offline queue, #451 financial unknown handling | Already incorporated into reviewed main |
| New ChatGPT work | `codex/push-same-origin-handoff-20261008` | Guard push-click same-origin and compare exact URL path; test patch pending full CI |
| Source inventory | 955 operations; 336 OpenAPI matches; 15 workspace-home fallbacks; no static route/data-review gaps | Does not establish live correctness |
| Vercel | `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY`; live false; newest production BLOCKED | Never unpause/deploy without separately reviewed authorization |
| Supabase | `yqncsonkxgwhcxedgevk`; ACTIVE_HEALTHY; latest applied `20261007120000` | `20261007130000` remains to be reviewed/applied in separate production rollout |
| Security advisors | 8 privileged function warnings; 65 no-policy RLS info; password protection and public extension warnings | Audit exact grants/access before any DDL |
| Customer success | No verified live new-subscription purchase and entitlement, creator delivery, merchant reconciliation or physical app-release acceptance from this pass | Keep commercial readiness pending |
| Code QA | Node 24/pnpm 12.7 requested; connector-side branch edits not locally run through full suite | Need exact-head CI proof |

## Work accepted as completed during this ChatGPT pass
Only the changes actually present on its branch (review current Git diff for status):
- `public/sw.js`: reject ambiguous non-local notification paths, validate new URL origin, revalidate on click, exact open-tab matching.
- `tests/a-push-payload-cannot-crash-the-service-worker.test.js`: adversarial origin escape and click-time regression coverage.
- New dated research/architecture/market implementation pass, and bidirectional handoff files.

Not completed: deploy, app-store packaging, apply migrations, connected Stripe payments, Resend webhook configuration, credential setup, live provider proof, all 15 destination replacements, physical accessibility/device proof, or full codebase modernization. A read-only look at a project is not a production action.

## Incoming Claude return report (PASTE ACTUAL EVIDENCE HERE)
Claude should replace every `NOT YET REPORTED` with measured source evidence, retaining N/A when not applicable.
- Reported time: NOT YET REPORTED
- Repo/base SHA: NOT YET REPORTED
- Branch / commit SHA: NOT YET REPORTED
- PR link / merge status: NOT YET REPORTED
- Files changed with rationale: NOT YET REPORTED
- Test commands, pass/fail/pending with job URLs: NOT YET REPORTED
- Provider/database/deployment actions including `NONE`: NOT YET REPORTED
- P0 blockers: NOT YET REPORTED
- Next one engineering slice: NOT YET REPORTED
- Risk and rollback plan: NOT YET REPORTED
- Evidence/claim level (source / CI / sandbox / customer): NOT YET REPORTED

## Deterministic next steps for ChatGPT receiving a completed report
1. Verify the reported SHA exists and is descendant of its claimed base. Confirm PR open/merged state and compare touched files with concurrently open work. Do not infer from last night's successful tests.
2. Run/inspect exact head gates and adverse-path tests; if a claim depends on real provider, compare it against provider or database status. CI-green by itself is not production proof.
3. Choose one incomplete P0 path without overlapping named owners: patch remaining current fallbacks; controlled external payment/fulfilment proof after reviewed provider config; authenticated privileged-function exposure review; unblocked Android asset generation from immutable local artifacts.
4. Keep approved tier pricing, licence, customer funds and legal review guardrails unchanged unless owner requests a specifically scoped change.
5. Append a dated account in `.ai/shared/HANDOFF_LOG.md` and issue the next direction-specific handoff referencing *new* main and branch SHAs. The static document is a checkpoint, not a dynamic truth feed.

## Evidence checklist before claiming "ready"
[ ] exact commit and clean base; [ ] tests/build/lint/security checks passed; [ ] browser keyboard/mobile coverage; [ ] tenant isolation and storage denial; [ ] real route and durable state; [ ] customer-visible errors/retry; [ ] migrations match hosted environment; [ ] provider webhook/connected account permissions; [ ] billing/entitlements/refund proof; [ ] change rollback; [ ] approved commercial hosting; [ ] owner authorizes unpause. Unchecked items are blockers, not cosmetic tasks.

## Safe work delegation
Claude: work from exact branch, implement/review code, run CLI and return verification.
ChatGPT: research/evaluate external standards, inspect repo/hosted state via approved connectors, implement separate non-overlapping branch, aggregate evidence and create handoff.
Both: keep user-specific decisions in `AGENTS.md`, control source tree and PR branches; don't promote vague product ideas into public capabilities without end-to-end proof. No silent background work.
