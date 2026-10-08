# SONARA Industries — Engineering Execution, Architecture and Market Pass
Assessed: 2026-10-08 (America/New_York). Review by: 2026-10-15.
Classification: source-verified evidence + proposed execution contracts. NOT deployment, production acceptance, financial/legal advice, or a statement that target capabilities have shipped.
Source baseline: `main` 867e40e7d3f3690d5fd7e0346d5ce28b69b1d425; engineering branch `codex/push-same-origin-handoff-20261008`.

## Executive engineering decision
**Build. Create. Grow.** SONARA Industries remains the parent; SONARA One is an *application* operating environment; Business Builder™, Creator Studio™, and Growth Studio™ remain separately marketable products. Share tenancy, identity, entitlements, audit, provider routing, event outbox, observable jobs and design tokens. Do **not** erase their boundaries with a huge public menu. Every customer-facing action needs a destination, authorization, durable outcome, visible receipt, retry/recovery and proof.

This pass patches one reproducible push-click origin confusion and adds adversarial regression cases in the existing test harness. It intentionally leaves untouched open Claude PR #446 and #445. No customer funds, provider credential, live deployment, migration or production record was changed. Temporarily offline is an explicit owner constraint.

## Observed state (distinguish source, hosted and customer evidence)
- GitHub public repo `famouslytrill-boop/sonara-os` is accessible. Current reviewed `main`: `867e40e7d3f3690d5fd7e0346d5ce28b69b1d425`, which merged #451. #448 (release evidence), #452 (offline replay) and #451 (financial unknowns) merged; #446 and #445 remain open.
- Generated `docs/CAPABILITY_MAP.md`: 955 registered methods (577 GET / 365 POST / 10 PATCH / 3 DELETE); 303 page routes; 336 OpenAPI-matched API operations; zero static route/data-contract review gaps; 15 workspace-home fallback destinations. These counts do NOT verify end-to-end live behavior.
- Supabase project `yqncsonkxgwhcxedgevk` is `ACTIVE_HEALTHY`. Its migration history ends with `20261007120000` (160 applied). PR #446 references `20261007130000`, not yet applied at this inspection. Never run migration based on filename alone: review current main/PR, migration order, backups, tenant policies and approval.
- Supabase security advisor groups: 65 RLS-enabled/no-policy informational objects, eight authenticated-executable SECURITY DEFINER warnings, one leaked-password protection warning, one public-extension warning. Service-only RLS tables may intentionally expose no policies: audit actual grants and client reachability before creating one. See official linter:
  https://supabase.com/docs/guides/database/database-linter
- Supabase performance advisor groups: 378 unindexed foreign-key informational findings, 28 auth-RLS-initplan warnings, 581 unused indexes informational, 1,292 multiple-permissive-policy warnings, one duplicate-index warning. Never bulk-delete indexes or rewrite RLS without query plans and denial tests.
- Vercel project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` reports `live:false`, newest production attempt `dpl_3DD5z9MrunPXajPqJojPaDLm1AzD` BLOCKED from `207372e40e56716199286d6ca95984eed2882b49`. Latest READY listed deployment is older (`a8890755d8bdfdcf8f899f7ab1b235f8461d8840`). Neither READY on an old SHA nor ACTIVE_HEALTHY database proves current source is publicly serving.
- Customer/provider proof missing at inspection: real subscription+entitlement, connected-account sale/refund/dispute, licensed private creator delivery, replay under contention, production email webhook signatures, exact-current-SHA live smoke, physical Android/iOS packaging tests.
- Repo is public despite proprietary/unlicensed source. Visibility/secret history/licence review are owner/security decisions.

## Implemented narrow remediation in this PR
`public/sw.js` push destinations previously allowed `"/\\\\evil.example/..."` to pass a leading-slash test even though WHATWG URL parsing treats backslash as an authority separator. The code now validates string length/ambiguous characters, parses against the worker's origin, checks parsed origin, and rechecks click-time legacy notification paths; page reuse matches full same-origin URL path rather than arbitrary substring. Existing `tests/a-push-payload-cannot-crash-the-service-worker.test.js` adds backslash and click-time tests. Verify under pinned toolchain; this is not a deployed fix until merged and released through controlled process.

## Target reference architecture — proposed, not all shipped
```text
Public marketing + public no-signup tools
  -> independently branded Business Builder / Creator Studio / Growth Studio
  -> accessible task UI, full error state, human-readable proof
  -> session / organization / workspace / role / entitlement / capability policy
  -> action gateway: validate input, tenant, permission, idempotency, budget
  -> deterministic domain modules + bounded optional AI / provider adapters
  -> transaction/outbox -> queue/worker -> trusted result + event/audit
  -> private object storage + signed delivery + version/retention controls
  -> logs/traces/metrics/security + reconciliation + customer review board
```
Shared core records should have `id`, `organization_id` or explicit workspace ownership, `actor_id`, `created_at`, `updated_at`, immutable action/event ID, `schema_version`, and an explicit source/provenance field where applicable. Do not mechanically retrofit every legacy table; use bounded migrations and per-tenant negative tests.

### Proposed cross-product control-plane contracts
1. `capability_entitlements`: per plan, product, tenant, quota, environment and expiry; reads require matching tenant; sensitive writes server-only.
2. `action_requests` and `action_decisions`: immutable request snapshot hash, actor, target resource, authorization decision, risk category, owner approval identity and expiry, replay token, lifecycle timestamp. Unknown high-impact actions deny and require review. No direct action from generative output.
3. `execution_outbox` / `job_attempts`: durable state `queued -> leased -> running -> succeeded | retryable | failed | cancelled`; unique idempotency key scoped to tenant+action; lease token and deadline; exponential backoff with jitter; dead-letter review. Protect against stale worker commits and double settlement.
4. `provider_connections`: provider identity, account/workspace, permissions/scopes, consent timestamp, last verification time, refresh state, disconnection, rate limit, redacted error category. Secrets stored only in approved secret storage, not records or browser.
5. `resource_ledger`: allocation/reserve/commit/refund of CPU minutes, GPU minutes, media seconds, outbound sends, storage byte-days, egress, token/provider expenses and API calls with effective policy version. Never advertise unlimited compute.
6. `data_rights`: asset/version/licence holder, original-upload proof, sampling/source licences, creator approval, takedown/legal-hold status, private delivery expiry and export eligibility.
7. `evidence_ledger`: event timestamp, origin system, exact code commit, policy version, redacted trace ID and verification class: `design`, `source_test`, `hosted_test`, `provider_sandbox`, `live_customer`. No label escalation without evidence.
These names are schematic targets; first map existing production tables and canonical migrations to avoid duplicate sources of truth.

## Priority execution slices and acceptance criteria

### P0-A: Site, safety and evidence
- Reconcile exact `main` with #446 and #445 without cherry-pick duplication. Fix failing Docker and Android packaging jobs, CodeQL warnings and deployment dry-run; preserve pause until owner reactivation.
- Run full frozen-install, pinned Node 24/pnpm 12.7, typecheck, lint, tests, build, route/UI browser crawl, migration replay and release-evidence integrity. PR checks only prove that exact head; old green CI is not substitute.
- Review all eight executable privileged Supabase functions: `pg_get_functiondef`, owner, EXECUTE grants, `search_path`, input restrictions, tenant enforcement and effective client exposure. Run negative requests as unrelated tenant/anon; use a *new reviewed migration* for corrections.
- Verify real environment secrets are set without exposing values; leaked-password protection, private buckets, service-role key scope and backup-restoration proof.

### P0-B: Paid customer path
- Business Builder: visitor -> customer account -> product/service -> merchant-owned provider checkout -> signed, idempotent payment event -> stock hold/consume -> fulfilment proof -> receipt -> refund/dispute -> reconciliation. Merchant/customer funds remain provider-managed; SONARA collects authorized software fees. Fee-only positioning does **not** remove dispute, tax, consumer-law or processor-agreement obligations.
- Creator Studio: rights-reviewed listing -> licence+version snapshot -> provider checkout -> paid order -> private signed file delivery -> download audit -> creator/seller reconciliation -> reversal/revocation with payment/charge evidence. Refuse delivery on stale or missing licence.
- Growth Studio: consent-based campaign -> signed provider send -> delivery/bounce/complaint event -> tenant-attributed lead -> invoicing/payment *evidence* -> campaign cost and realized return. Separate attributed from causal revenue; no marketing guarantee.
- Three-provider adverse-path matrix: wrong tenant; replayed/late webhook; failure between ledger and fulfilment; same event twice; amount/currency mismatch; partial refund; dispute won/lost; subscription expires mid-flight; unreachable provider.

### P0-C: UX and customer proof
- Inventory 15 home-fallback destinations, one by one. For each add a genuinely owned page, primary outcome CTA, proper empty/loading/error and reversal states, link to exact persistent resource, 360px mobile and keyboard test. Generate inventory and ensure count decreases without dummy routes.
- Adopt plain customer vocabulary: `Connect account`, `Create product`, `Send invoice`, `Request approval`, `View delivery receipt`. Keep orchestration, data contracts, queues and retry complexity backstage.
- Contract for every visible form: route+method exists; CSRF/session; schema validation; disabled only while actual work is pending; errors available to assistive technology; success means durable ack; async operations show honest status; safe retry and cancellation.

### P1: Operational completeness by product
Business Builder: scoped CRM, quotes, scheduling/calendar/time, work orders, dispatch, location permission, inventory, taxes (informational only without vetted provider), POS adapters, returns, invoices, budget templates, staff roles, offline task drafts and receipts. First vertical: service businesses, then restaurant/trades/trucking/cleaning via data-driven packs only after pilot proof.

Creator Studio: project graph, media ingest, audio/video/image versioning, speech+captions, music/film knowledge modules and education, safe AI content with provenance, render job lifecycle, resource budgets, codecs, accessible timeline alternatives, licensing and owner-approved distribution. Use optional FFmpeg/isolated media compute; do not suggest complete DAW/NLE equivalence or free unlimited GPU generation.

Growth Studio: opt-in email and social OAuth, per-account posting permissions, deterministic scheduling with visible approvals, moderation/abuse/takedown, consent tracking, attribution, segment forecasts, A/B experiments, analytics and export. External social services must have real scopes/API contract and a rate-limit/expiry UI before feature is called live.

Cross-suite: language/catalog translations and accessible plain-language help; private uploads and safe signed downloads; account data export/erasure; browser/mobile shell; push consent; background sync per account; opt-in GPS/gyroscope; review boards; calculators/formula explanations; legal/terms version approval; non-custodial provider links; scoped integrations; separate free public utilities.

### P2: Expansion only after validated retention
Media/GPU autoscaling, creator and merchant marketplaces at broader throughput, partner APIs/app store, enterprise permission reporting, geo/route simulation, social/community product, independent provider ecosystem, advanced signal forecasting, streaming servers and physical iOS/Android capabilities. Every expansion needs unit economics, customer demand and irreversible-risk review.

## Math and deterministic policy (target examples)
Do calculations from typed inputs and preserve their units, version, provenance and confidence:
- Operating gross margin `(recognized_revenue - direct_service_costs) / recognized_revenue` only if denominator positive, else `unavailable`. Never call gross margin ROI.
- Marketing return on **observed attributed** cash: `(eligible_paid_cash - attributable_campaign_cost) / attributable_campaign_cost`, only for positive known spend; payments belong to one credited cohort; forbid silently treating missing amounts as zero.
- Service-job contribution `collected_sales - labor_cost - material_cost - processing_fees - fulfillment_cost`, with every currency consistent and refunds signed.
- Runway months `unrestricted_cash / positive_monthly_net_burn` where numerator and burn are known; else no numeric result.
- Conversion rate `verified_paid_conversions / eligible_unique_visits`; log attribution window, dedup rules, sample count and consent.
- Resource policy: `projected_max_cost = reserved_quantity * provider_unit_cost + storage_egress + retry_headroom`; fail closed if estimated risk exceeds tenant and platform budgets. A queue does not bypass a budget.
- Forecasts: compare simple baselines (seasonal naïve, moving average, regression) against time-split out-of-sample metrics before offering probabilistic forecasting. Clearly distinguish prediction from guarantee.
- A review board must show inputs, formula revision, evidence, impact, approver, execution preview, reversibility and timestamp. Human approval cannot be fabricated from a checked box.

## Accessibility and design acceptance
WCAG 2.2 AA target, including focus not obscured, dragging alternatives, target-size minimum/exceptions, consistent help, readable errors, accessible authentication, subtitles/transcripts, reduced motion, reflow/zoom and multilingual copy. Test keyboard, screen reader, switch/pointer, 200%/400% zoom and realistic mobile physical devices. Use calibrated visual tokens and user-selectable dark/light, without making every operational screen visually dense. Official reference: https://www.w3.org/TR/WCAG22/ .

## Security, law and provider boundaries
- Use NIST SP 800-63-4 for risk-based identity and passkeys; do not use user-writable metadata for roles. https://www.nist.gov/publications/nist-sp-800-63-4-digital-identity-guidelines
- Use OWASP ASVS and NIST SSDF for testable controls; supply-chain SBOM, provenance, dependency pins, CodeQL, secret scanning, least-privilege GitHub production environments and privacy-safe OpenTelemetry.
- Stripe Connect *direct charges* is a candidate for seller-owned charge location; confirm the actual account agreement, liability, regional support, connected-account onboarding, restricted businesses, refunds and disputes before a launch claim. https://docs.stripe.com/connect/direct-charges . Do not call SONARA a bank, escrow or licensed money transmitter.
- Media/music licensing and generated content: user owns or is licensed to input; rights to output depend on contracts and source material. Maintain license/provenance and takedown process. Qualified review before publishing legal documents or allowing high-risk transactions.
- Public repository + proprietary licence: evaluate making repository private and audit cloned/forked exposure and token history. Visibility change is owner-controlled; not done in this pass.

## User acquisition and sustainable economics
- Primary low-budget wedge: 1) free tools without signup, 2) 15–30-second genuine product clips, 3) service-business pilot, 4) proof of first saved job/invoice/receipt, 5) consented follow-up and referral. Don't market 955 routes; market a successful outcome.
- Free tools policy already encoded in repo: parent company 3, each child company 4; keep honest functional result before registration prompts.
- Dashboard must separate anonymous tool usage -> qualified signup -> first useful saved action -> second-week return -> paid activation -> month-one retention. Track onboarding friction and exact user task completion, not vanity views alone.
- Pricing: verify current approved catalog in repository/Stripe before any public claim. Historical owner documents differ by date; no prices changed here. Cap GPU minutes, storage, mail sends and requests; gross margin includes processing, compute, support, refunds and traffic spikes. Do not promise unlimited AI.
- Counterfactual product advantage: integrated outcome workflows and affordable entry versus mature specialists' depth; not credible to claim parity with Shopify/Salesforce/Adobe/TikTok, or enterprise scale without independent proof.

## Bidirectional collaboration rules
- Canonical `main`, PR numbers, exact file SHAs and migration lists are source of truth, **not** chat recollection.
- ChatGPT/Codex handoff: `docs/handoffs/2026-10-08-chatgpt-to-claude.md`. Claude-to-ChatGPT resume: `docs/handoffs/2026-10-08-claude-to-chatgpt.md`. Generated `docs/HANDOFF_PROMPT.md` remains canonical for the *full* repository; do not overwrite its generator.
- Lock one named slice and exact base per agent. Each update reports: files, test results, CI exact SHA, schema/provider/deployment actions (including none), known blockers and next safe first command.
- Forbidden without deliberate separate authorization: deploy/unpause, production migration, customer funds movement, public legal text, live marketing send, payouts, secret exposure and forced merges.

## Reviewer checklist for this branch
1. Inspect service worker patch for same-origin path and click safety. Run `pnpm test -- --grep "a push payload cannot crash the service worker"` with repository's pinned toolchain; if grep routing fails, use `pnpm test`.
2. Pin entire PR head SHA and run frozen install, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build`, `pnpm run verify:gates`; require Chrome/mobile and static security checks for affected surface.
3. Do not merge during failing or pending checks. Recheck open #446/#445 overlap. This work does not satisfy those pending PRs.
4. Keep Vercel project paused, Supabase migration `20261007130000` unapplied until separate owner-reviewed release, and all customer-provider transfers external and inactive.
