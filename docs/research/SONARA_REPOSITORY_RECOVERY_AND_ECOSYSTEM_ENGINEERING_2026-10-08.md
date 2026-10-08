# SONARA Industries — Repository Recovery, Ecosystem Engineering and Marketing Execution Pass
**Assessed:** 2026-10-08 (America/New_York). **Review by:** 2026-10-15.
**Status:** Verified source/connector inspection + isolated branch repairs + engineering proposals. **Not** production approval, live-provider proof, legal advice, or deployment.

## Executive engineering decision
Keep SONARA Industries as parent, SONARA One as shared **application OS** (not a kernel/device operating system), and independently branded Business Builder™, Creator Studio™, and Growth Studio™. Public message: **Build. Create. Grow.** Share tenancy, identity, billing/entitlements, event processing, provider gateway, audit, observability, legal consent and design tokens. Keep differentiated workspaces and customer vocabularies. The customer sees a task and an honest result; the backend owns orchestration, data/permission contracts, retries and security.

A working paid-customer transaction with evidence matters more than a large number of menus, engines or proposed partners. Every capability has five statuses: `research` -> `implemented` -> `exact-head CI verified` -> `provider/hosted verified` -> `customer proven`; don't collapse them.

## Source and live state at the inspection
- Repository: `famouslytrill-boop/sonara-os`, public, proprietary/UNLICENSED. Reviewed `main`: `1e42bdee96c35ee99e77037d99436f5558fc4742`. Source remains publicly visible until owner changes visibility.
- Open PRs initially **both conflicted**: #446 `claude/sonara-engineering-handoff-b6ui1t` and #445 `codex/reservation-workflows-20261007`. Both reported `mergeable:false, mergeable_state:dirty` before recovery.
- #446 based at `207372e40e56716199286d6ca95984eed2882b49`; branch was 15 commits behind main and eight files overlapped new main changes. Reconciled in merge commit `77ea60e3ec17be34082373fcbc651fa748fdff2a` by retaining main tree, layering Claude's 71 changed files, and line-merging six independently edited source/test/handoff files. Generated inventory and route map were retained from Claude and require regeneration. GitHub subsequently reported `mergeable:true`. Another contributor pushed `1c5b32657a683d6bd2b0d9b57abe743334535f79`; always re-inspect before working on this head. Earlier reconciliation's CI included passes and failures; current head's actions may require authorization.
- #445 had 242 commits of divergence and 15 overlapping files on the PR diff. Reconciled in merge commit `305933929b03190e2219af70d84736c288a149aa` using the current main tree, the old branch's 28 merge-base delta files, non-overlapping line merges for route registry, service worker, last9 routes, server and fake Supabase, and a manual operations-route integration that retains newer analytics while adding a dedicated resource page, scoped location validation, bounded capacity and durable save checks. Prefer current main for nine stale generated/release documentation artifacts. GitHub reported `mergeable:true`. These changes have NOT yet passed full exact-head CI.
- #453 (push same-origin notification click fix and initial handoffs) is merged into main. It must not be reimplemented or overwritten by PR #445's older service worker.
- Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY`: `live:false`; latest production deployment BLOCKED; preserve owner's temporary-offline instruction. No restart/promotion/alias mutation performed.
- Supabase `yqncsonkxgwhcxedgevk`: `ACTIVE_HEALTHY`, 160 applied migrations through `20261007120000`. The PR #446 `20261007130000` Resend delivery migration is NOT yet applied. No DDL or data writes performed.
- Security advisor: eight authenticated-callable SECURITY DEFINER functions, 65 informational RLS-on/no-policy tables, one leaked-password warning, one extension-in-public warning. These need per-function permission review; do NOT create public RLS policies just to silence informational warnings. Performance advisor: 378 unindexed FK informational, 28 initplan warnings, 581 unused-index informational, 1,292 multiple-permissive-policy warnings and one duplicate-index warning. Use actual query plans and effective grants before acting.
- Existing code inventory (at earlier reviewed main): 955 registered route operations (577 GET, 365 POST, 10 PATCH, 3 DELETE), 303 declared page routes, 336 OpenAPI matches, 15 workspace-home fallbacks, zero *static inventory* route/data-review gaps. Source inventory is not functional/hosted proof.

## P0 execution sequence — reliability first, commercial proof second
1. **Resolve PR review/CI independently.** #446: rerun the capability inventory and generated docs, inspect exact-head failures (Android icon fetch while paused, CI lint/format/coverage, migration dry run and CodeQL/approval gates); do not unpause just for TWA assets. #445: run tests and repair against newer Business Builder analytics instead of replacing the module. No automatic merge into main until all required checks and code reviews are green.
2. **Protect production authority.** Keep environments separated; exact-SHA release manifest; controlled migrations, backup+restore test, rollback record, protected main and required CI, secret scopes and signed builds. Do not use branch mergeability as release permission.
3. **Privileged database functions.** For each eight warnings collect function name/signature, owner, `SECURITY DEFINER`, `search_path`, input predicates, effective `EXECUTE` grants to PUBLIC/anon/authenticated, tenant denial tests. Revocations/rewrites must be separate reviewed migrations with legitimate caller-positive and foreign-tenant-negative tests. Supabase official guidance: https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/guides/database/postgres/row-level-security .
4. **Provider and real paid-customer proof.** Business Builder: signed-in customer -> service/product -> merchant-owned provider checkout -> verified webhook -> inventory hold/consume -> fulfilment -> receipt -> partial refund/dispute -> ledger reconciliation. Creator: listing/licence snapshot -> paid checkout -> versioned private delivery -> download receipt -> refund/dispute and seller reconciliation. Growth: opt-in lead -> authorized send -> provider acceptance AND delivery/bounce event -> campaign attribution -> paid-cash evidence -> cost and eligible attributed return. No claim of guaranteed ROI.
5. **Replace remaining workspace fallback destinations**, recording end-to-end UI and persistent data contracts, keyboard/screen-reader behavior, mobile reflow, loading/empty/error/success states, safe actions and telemetry. Generated count should decrease only when true screens are wired.

## Product architecture and user-facing experience
### Parent / shared SONARA One
- Shared login/passkeys/OAuth/MFA; company switching; tenant/resource permissions; rate and generation limits; account security and privacy controls; contacts and encrypted provider tokens; billing/plan status; searchable help; notifications and preferences.
- Shared platform control planes: `identity`, `tenant`, `access_policy`, `capability_budget`, `approval`, `provider_connection`, `workflow`, `job_execution`, `artifact`, `money_evidence`, `audit`, `observability`.
- Public parent free tools: three; each child four. No signup before the free result. Use `verify:free-tool-count` rather than anecdotal counts.
- Controls: safe lockout on suspect sign-in; tenant-level scoped security; short-lived session tokens; consent-based microphone/camera/location/notifications; account export/deletion with audit and retention exceptions. Any dangerous action previews impact and needs authorized approval.

### Business Builder™
- Functional path: service inquiry -> CRM -> quote -> scheduling/time -> job/work order -> labor/material cost -> invoice/payment/receipt -> dispute/reconciliation -> customer follow-up. Restaurant/trades/trucking/cleaning/rentals/venues are industry templates on shared core records, not entirely separate backends.
- Add tenant-validated reservations, resource calendars, capacities, recurring appointments and waitlists; no silent stock writes for unconfirmed jobs. Staff permissions, payroll data access, checkout-provider controls, POS/kiosk adapters and offline drafts require explicit state transitions.
- Operational models: inventory reservations, route planning with opt-in GPS, delivery assignment, shift clocks, timers and calculators. Maps and gyroscope are opt-in, disabled when unsupported and not used for covert profiling.

### Creator Studio™
- Project graph with provenance/versioned media, high-resolution ingest, private buckets, signed downloads, rights/licence ledger, compositions, podcasts, filming, subtitles/transcripts, localization, MIDI/music theory education and accessible non-timeline alternatives.
- GPU/media processing via isolated, budgeted workers and `queued -> leased -> running -> succeeded/failed/cancelled` lifecycle with idempotency, quarantine, retries, cost reservations, checksums, output quality and provider contracts. Deterministic DSP/FFmpeg workflows are real only when worker and storage proofs exist. Optional AI generators must record model/provider consent, licensing, provenance and chargeable usage. Never promise unlimited rendering.

### Growth Studio™
- Channel OAuth scopes, account connect/revoke, authorized scheduling and posting, opt-in email with deliverability receipts, review/takedown queues, social content libraries, attribution, campaign spend ledger, accessible analytics, SEO and referral tracking.
- Distinguish measured attribution from causality. Revenue from a paid customer cannot be credited twice; separate currencies, known vs unknown amounts and incomplete provider reads. No unsolicited bulk outbound automation.
- An independent hosted SONARA social platform/marketplace is P2 after moderation, abuse response, retention and lawful content rights are proven. Social connectors are adapters, not equivalents to TikTok/Meta ecosystems.

## Canonical data contracts (targets — map to existing tables before migration)
| Contract | Minimal fields / invariants | Tenant/control rule |
| --- | --- | --- |
| Account/Workspace | `user_id`, `organization_id`, `workspace_id`, membership status, role | Verify server-side; never trust user-editable metadata for rights |
| Actions/Review | action ID, policy version, immutable input hash, approver, expiry, risk, result | Unknown sensitive action defaults denied/pending |
| Events/Outbox | tenant, event ID, origin, schema version, state, delivery attempt, lease | Unique idempotency; no double financial/stock transitions |
| Provider connection | provider, exact external account, scopes, consent, expiry, revocation | Encrypted server-only credentials; read/write authority separate |
| Money proof | original amount/currency, provider charge ID, balance transaction, signed fee/refund/dispute, source | No implicit zero; reconciled actor and tenant |
| Media/licence | owner, source rights, version hash, purchase licence, private delivery | No access after revocation except justified retention |
| Quota ledger | plan, resource, reservation, settlement, period, amount, unit | Atomic reserve/commit/credit; exhausted budget blocks new work |
| Knowledge/templates | catalogue ID, revision, source/provenance, accessibility language, industry, locale | Human-editable, never mistaken for professional certification |
| Measurement | time window, source, confidence, sampling, consent status, effective version | Avoid cross-tenant aggregation and invented precision |

**Schema rules:** map existing migrations first; no duplicate `payments`, `jobs`, `events` tables. Every new schema requires SELECT/INSERT/UPDATE/DELETE policy decision (including intentional denial), multi-tenant adversarial tests, owner-read route, retention, backups, encrypted storage and migration rollback plan.

## Engineering mathematics and proofs
- Payment reconciliation: `net_known = Σ signed_known_money_components` per currency **only if all material contributors have known valid amounts**; missing amount -> `unavailable`, not zero. Maintain capture/refund/chargeback provenance and provider balance currency separately.
- Job contribution: `collected_cash - labor - materials - processing - fulfilment - refunds` per currency and accounting convention; unknown constituent -> unknown output.
- Gross margin: `(recognized_net_revenue - directly_attributable_costs)/recognized_net_revenue` only when recognized revenue >0 and costs known.
- Cash runway: `available_unrestricted_cash / positive_monthly_net_burn`; do not report a finite runway when burn <=0.
- Campaign observed cash ROI: `(eligible_attributed_cash - campaign_spend)/campaign_spend` only if spend >0 and both values known; attribution window/method must be shown.
- Capacity planning: `reserved + in_use <= verified_available` enforced transactionally, never with a client read-then-write race.
- Backoff: `min(cap,base*2^attempt) + bounded_jitter`, with explicit max attempts and DLQ. Queue leasing must prevent stale-owner settlement.
- Forecast acceptance: compare seasonal naïve vs moving average vs explainable regression on rolling out-of-time splits; include MAE, calibration/coverage, data count, error and drift. No guarantees.
- Cost guard: forecast provider GPU/time/token/storage/egress costs before execution, reserve a bounded amount, settle from provider proof and refund unused reservation; deny when budget exhausted.

## UX, accessibility and privacy requirements
Use design tokens, full keyboard navigation, distinct focus and reduced motion, 200/400% reflow, large tap targets, captions/transcripts, high contrast, hearing/vision/motor assistance and accessible authentication. WCAG 2.2 AA: https://www.w3.org/TR/WCAG22/ . Don't use non-consensual push, sounds, vibration, camera, voice or location; if unsupported, say so clearly. Forms need server-acknowledged results and human-readable errors. Workspaces should present *one primary customer task*, not hundreds of engines in navigation.

## Scientific, creative and knowledge modules
Build sourced, revisioned teaching/help modules for reading/language, math, science, business/legal literacy, music theory, music production, film theory, composition, literature and media craft. Show source date and level; distinguish tutorials/templates from regulated professional recommendations. Use curated internal content, provenance-aware RAG, customer-owned records, bounded agent skills, explicit model limits, human-review decisions and right-to-delete/retention controls. No claims of external encyclopedic completeness without an actual source.

## Reliability, security, legality and cost
Adopt OWASP ASVS, NIST SSDF, W3C WCAG 2.2 and tenant-adversarial denial proof. Pin dependency versions, check provenance/licences, generate a readable SBOM and run CodeQL/secret scans. Public proprietary repo exposure and commercial hosting on Vercel Hobby are business/security risks. Vercel's terms limit Hobby to personal/noncommercial use: https://vercel.com/legal/terms .
The low-custody payment model routes merchant funds through regulated providers where approved, charges SONARA software fees, and avoids raw PAN/CVV. It does **not** waive KYC, tax, refunds, money-transmission analysis, chargebacks, consumer disclosures or marketplace liability. Require provider-contract and jurisdiction review before public legal claims.

## Marketing and sustainability
Start with one measured service-business workflow rather than advertising universal competitor parity. Customer demonstration: free calculator -> account -> first saved customer/job -> invoice or deliverable -> receipt -> repeat use -> paid subscription. Film 15–30s genuine demonstrations with captions and clear proof. SEO pages and free tools must return usable results. Track consented funnels: visitor->free-tool success, free-tool->qualified signup, signup->first durable result, week-4 use, payment conversion, refund/dispute rate, support load, gross margin by tier and cohort CAC payback. Split channels/cohorts, flag sparse data; do not invent testimonials or guaranteed income.
Protect fixed-price tiers with quotas and resource-based pay-as-you-go upgrades. Track CPU/GPU minutes, requests, storage GB-month, egress, third-party send costs, payment fees, support and refund reserve. Prove positive contribution margin on a real pilot before aggressive scaling.
Competitive position: greater workflow integration and affordability is *possible*; Shopify/Adobe/HubSpot/Salesforce/Meta ecosystem and GPU scale are not proven parities.

## Exact-head gate and bidirectional handoffs
1. Read `AGENTS.md`, generated `docs/HANDOFF_PROMPT.md`, `.ai/shared/HANDOFF_LOG.md`, current PR state and CI before branching.
2. PR #446 and #445: both source-conflict reconciliations exist but still require full exact-head CI and security review; no automatic merge to production. PR #446 may have an external later commit — do not rewind it.
3. Generate and verify `docs/CAPABILITY_MAP.md`, `data/capability-inventory.json`, `docs/CAPABILITY_ROUTE_SCHEMA_COVERAGE.md`, `docs/HANDOFF_PROMPT.md`, notices/count floors; do not manually falsify counters to make gates green.
4. Run pinned Node 24, pnpm 12.7, frozen install, typecheck, lint, full tests, build, verify:gates, tenant deny tests, browser quality, migration replay, supply-chain and secret scans. Exact evidence tied to SHA.
5. Scope future PRs by one bounded customer workflow. No prod migration, unpause, Stripe/Resend provider activation, campaign send, legal publication or role broadening without explicit separate owner review.
6. Directional handoffs: `docs/handoffs/SONARA_CHATGPT_TO_CLAUDE_2026-10-08_CONFLICT_RECOVERY.md` and `docs/handoffs/SONARA_CLAUDE_TO_CHATGPT_2026-10-08_RETURN_TEMPLATE.md`. The latter is a prepared template, **not** a statement that Claude has executed it.
