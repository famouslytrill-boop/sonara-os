# SONARA Industries — P0 through P2 next engineering process
**Last verified:** October 8, 2026. **Baseline:** main `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`; `protected=false`. This is an execution gate and evidence matrix, NOT a claim that production has shipped.

## Exact P0 findings
- Main `sonara-industries` fails because `docs/HANDOFF_PROMPT.md` declares 513 Mocha files while the test runner discovers 516 (7,083 tests passed in that historical run, one failing on that main).
- All nine native replay combinations fail after a 25-policy RLS fixture assumes obsolete pre-hardening definitions. Candidate PRs #519/#526 reset the order but their proof fails on two supposed duplicate `subscriptions` policies.
- Read-only active Supabase preview inspection found two equivalent authenticated owner-read subscription policies. Source migration `011_sonara_saas_launch_system.sql` creates a different canonical member policy. The *preview* project is not the disposable replay project or verified production.
- Draft PR #545 builds on #526 with pre/post hardening proof, a source-vs-remote subscription-policy distinction, and a transaction-only deduplication guarded by exact policy shape. A P1 rollback candidate does not automatically apply a production migration.
- Draft PR #549 enables `merge_group` events on eight existing CI workflows and cancels superseded PR-head runs without canceling main/queue evidence. No GitHub ruleset has been enabled by the connector.

## Ordered release actions and acceptance criteria
| Tier | Action | Proof required | Deployment permission |
| --- | --- | --- | --- |
| P0 | GitHub admin activates no-bypass ruleset targeting main, PR review, required checks, branch freshness/queue and force-push/deletion restrictions | Read back enforced rule; non-exempt red PR refused at merge without changing main SHA | No |
| P0 | Rebase/resolve candidate SQL+handoff source (#545 or independently corrected #526), retire conflicting fixes | Exact-head Mocha and 9 native PostgreSQL replays green; all rollback fixture outputs and SQL clauses reviewed | No |
| P0 | Approve deterministic CI contracts (#549) | Same eight workflow/check names on merge-group and PR SHAs; source tests, verified queue behavior | No |
| P0 | Reconcile preview, source migrations and designated production Supabase project separately | Signed migration manifest, applied history, policy/grant diff, separate tenant A/B deny tests, independent restore proof | Only after explicit owner approval |
| P1 | Consolidate SONARA One organization/member/manager role authority | Two-tenant adversarial API + SQL tests, revocation, limited owner support and audit | Staged release only |
| P1 | Free moderated social and public discovery | Report/block/follow/comment/appeal, adults/minors, accessibility, moderation, provenance and no cross-tenant data | Staged canary only |
| P1 | Merchant/Creator marketplace and payment delivery | Provider sandbox identity, signed webhook, one receipt, replay/reconciliation, rights/license and zero unapproved payout changes | Staged canary only |
| P1 | Connector and durable job plane | Least-privilege OAuth, expiry/disconnect, 429 Retry-After, worker lease, outbox and dead-letter/cost budgets | Staged canary only |
| P2 | Android/iOS and offline sync | Signed binaries, test devices, conflict handling, opt-in sensors, store billing review, staged restore | Separate device/store authorization |
| P2 | Media/lobbies/industry packs/ranking | WebRTC moderation and consent, test GPU bills/load, rights, per-vertical E2E, fairness and accessible UI | Pilot gated by budget and evidence |

## Administrator-required main ruleset procedure
In GitHub repository settings select Rules > Rulesets, create an active branch ruleset for `main`. Require PRs with human review and conversation resolution, require exact correct check names for full SONARA CI, Node compatibility, native replay, dependency, Docker and engineering security; add merge queue when supported, and ensure `merge_group` actions run. Disable bypass for admins/bots unless separately documented and independently approved. Prevent force pushes/deletions.

**Negative test:** after protection is visible, open disposable test PR with a deliberately failing required status; attempt to merge as a nonexempt account and record GitHub rejection, unchanged main HEAD, and a clean closure of the test PR. Never test red merging before protection exists.

## Release evidence packet
For each candidate SHA record branch/PR, tested head, required check names/status/conclusions, policy-grant snapshot hashes, tenant A/B proof, migration up/down or forward/recovery procedure, restore evidence, provider account IDs redacted, UI/mobile accessibility and rollout decision. A green old SHA is not a green current SHA. Manual production approval is distinct from merge permission.

**Stopping conditions:** unknown production identity, failed/queued required checks, unprotected main, missing owner-approved legal/payment changes, unverified tenant isolation, uncertain payout state, no backup restore or unauthorized external provider. No deployment or user-data migration is performed by this document.
