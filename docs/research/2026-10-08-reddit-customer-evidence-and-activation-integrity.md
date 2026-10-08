# SONARA — Reddit customer evidence and activation-integrity engineering pass

Date: 2026-10-08 (America/New_York). Scope: SONARA Industries, SONARA One, Business Builder, Creator Studio, Growth Studio. Evidence class: public user discussions plus verified repository source. Status: research and a narrowly bounded source change on a **draft branch**, not a production release.

## Decision

Build more **provable workflow completion** and less feature breadth without evidence of use. Prioritize data coherence, quick first results, reliable social publishing, recoverable billing, and explicit security proof. Do not treat Reddit threads as representative polling, official platform policy, or proof that a SONARA capability works.

The application is **Express/Node**, not Next.js. Lessons from Next.js-specific threads may inspire general auth and caching review but do **not** justify introducing Next.js or assuming Next.js CVEs affect this repository.

## Evidence matrix (retrieved 2026-10-08)

| Signal and source | Type / time | Evidence | Contradiction / confidence | SONARA decision |
| --- | --- | --- | --- | --- |
| Small-business CRM overload, https://www.reddit.com/r/smallbusiness/comments/1m1xx7f/i_am_completely_overwhelmed_by_softwarecrm_options/ | User anecdote, 2025-07-17 | Disconnected customer records, inboxes, and expensive specialist software create administrative friction | One business; low confidence in market prevalence | Test a single customer/job/contact source of truth with verified import and explicit source conflicts |
| Small-business all-in-one request, https://www.reddit.com/r/CRMSoftware/comments/1rgqv4q/looking_for_allinone_crm_software_for_small/ | User request, 2026-02-28 | CRM, invoicing, contracts, projects and time-tracking need usable continuity | A request is not willingness to pay; low | Prioritize an end-to-end job -> invoice -> receipt journey; do not call every feature production-ready |
| Founder pain discussion, https://www.reddit.com/r/SaaS/comments/1wkj42k/saas_founders_whats_your_biggest_pain_right_now/ | Multiple self-selected comments, 2026-09-19 | Onboarding delay, distribution and billing edge cases recur | Selection and promotion bias; medium confidence in practical failure modes, low in frequencies | Instrument time to first genuine value and test failed-payment recovery against real sandbox events |
| Social manager requests, https://www.reddit.com/r/SocialMediaManagers/comments/1vz5h09/which_social_media_scheduling_app_are_you_guys/ | User discussion, 2026-08-26 | A calendar, multiple channels, reliable posting, analytics and predictable price are repeatedly requested | Many vendors self-promote; medium for expressed problems, low for product choice | Make provider receipts and actionable failed/scheduled states visible before adding new channels |
| Agency approval needs, https://www.reddit.com/r/SocialMediaMarketing/comments/1qtmosb/affordablefree_social_media_scheduling_tools_for/ | User request, 2026-02-02 | Budget-constrained multi-client approvals and platform coverage | One operator; low | Owner-approved per-client publication, clear permission scopes, low-cost entry |
| Supabase authorization discussion, https://www.reddit.com/r/Supabase/comments/1mvjpr8/supabase_rls_is_not_for_production/ | Debate, 2025-08-20 | Developers find RLS and RBAC difficult to reason about | Anecdote does not disprove RLS security; low for the claim, high for need to test | Retain Supabase RLS with actual two-tenant denial tests; don't bypass RLS for convenience |
| Developer operations thread, https://www.reddit.com/r/selfhosted/comments/1w6yxnv/migrated_42_workflows_from_zapier_to_selfhosted/ | Self-report, 2026-09-04 | n8n execution retention and operational overhead matter; self-hosting can be cheaper in one setup | Savings anecdote excludes labor and support; low transferability | Validate retention, failure alerts, backup restore, cost and limits in our real environment |
| Simpler scheduler request, https://www.reddit.com/r/SocialMediaMarketing/comments/1vnljxq/best_social_media_management_platform_for_simple/ | User discussion, 2026-08-13 | Reliability and understandable failures outrank advanced dashboards for some buyers | Vendor participation, not a ranked benchmark | Expose failure reason, retry eligibility, authoritative provider result |

**Primary-source contradiction check:** 
- Supabase documents RLS as a legitimate in-database authorization control and requires grants/policies and tests: https://supabase.com/docs/guides/database/postgres/row-level-security . A Reddit opinion is not a reason to remove it.
- TikTok requires user-granted scope, audits for public third-party publishing, and honors provider limits: https://developers.tiktok.com/docs/en/content-posting-api-get-started and https://developers.tiktok.com/docs/en/content-sharing-guidelines . A scheduler interface is not itself approval to publish.
- The connected repository's root README and source establish the Express runtime and existing analytics/billing/event-contract implementation. No framework migration, new package, provider credential, SQL migration or deployment is justified by this evidence.

## Implemented, deliberately narrow improvement

Observed source problem: `lib/sonara-activation-metrics.cjs` accepted coercible non-timestamp values (for example, `null` as the Unix epoch) and could select a declared first-value event **before** the organization's recorded activation. This produced misleading conversion-funnel chronology or null elapsed time despite a later valid first-value event.

Changed source:
1. `validDate` accepts nonempty date strings or Date instances and rejects numeric/boolean/null/array coercion.
2. When an `account.organization_created` timestamp exists, first-value candidates must occur at or after it; when activation timestamp is absent, the existing first-value-only reporting behavior is retained without inventing an elapsed time.
3. Added three negative/chronology tests in `tests/activation-metrics.test.js`. No change to event schema, billing, storage, permissions or API routes.

**Verification required:** run `pnpm exec mocha tests/activation-metrics.test.js` and the repository's full required exact-head checks. Until this proof runs, changes are source-proposed, **not** CI-certified or deployed.

## Product experiments and acceptance contracts

| Priority | Product | Smallest verifiable journey | Failure mode that must be tested | Required evidence |
| --- | --- | --- | --- | --- |
| P0 | Shared SONARA One | Visitor uses free tool, optionally saves result, creates workspace, then completes genuine first-value event | Replayed/backdated, unknown or malformed event must not inflate activation | Versioned event taxonomy; activation rate = eligible activated accounts / eligible started accounts; time-to-first-value p50/p90, cohort and denominator |
| P0 | Business Builder | Create customer -> service job -> issued invoice -> external-provider payment -> reconciled receipt | Cross-tenant IDs, duplicate provider webhook, payment failure, partial reads and external checkout cancellation | One source-of-truth record IDs; tenant denial test; provider sandbox ID; ledger invariants; no fictitious cleared balance |
| P0 | Release governance | Merge only a protected, fully green exact-head commit | Red or stale green CI must be rejected | Required checks, branch protection and rejected-red-merge proof; keep PR #508 CI-repair work separate |
| P1 | Growth Studio | Client-approved draft -> platform validation -> scheduled publish -> provider confirmation/failure -> analytics | Missing permission, 429, revoked token, unsupported media, timeout, duplicate retry | Consent, approval version, rate budget, provider receipt, deterministic retry + DLQ; no claim of public TikTok posting before API audit |
| P1 | Creator Studio | Owned asset -> recorded rights/licence -> queued processing -> reproducible download | Unlicensed input, job cancel/retry, partial storage failure, unknown cost | Signed delivery, provenance, job/usage ledger and accessible export |
| P1 | Business onboarding | Existing contacts import -> deduplicate preview -> explicit user approval -> real record links | Mixed-tenant file, malformed CSV, reversible import, truncation | Imported/failed counts, source mapping, cost/no-surprises review |
| P2 | Cross-suite | Cohort-level evaluation and customer-support feedback | Paid conversion before meaningful use, inactive workspaces, skewed sample | Opt-in interviews + usage events; separate paid, active, retained cohorts; privacy-preserving aggregates |

**Do not introduce fabricated targets.** Provisional experiment criteria for an internal study: recruit 5-10 consenting potential customers per relevant vertical; record task completion without moderator intervention, time, retries, support interactions and pricing comprehension. Establish baseline before choosing success thresholds or writing conversion claims. Customer interviews require consent and follow community rules; do not scrape identities, spam Reddit, or treat comments as permission to market to authors.

## Economics and security acceptance

- Pricing stays SONARA's governed catalog. Compare contribution margin, not subscription headline: **net collected subscription revenue - provider charges - payment/refund fees - media compute - storage/egress - variable support costs**. Unknown inputs remain unknown, never zero.
- Meter generation by server-side reservation + settlement; do not call features unlimited unless budget evidence supports it.
- Retry policy must distinguish safe transport retries from irreversible actions, and idempotency keys must be tenant-scoped. No automatic refund, payout change, campaign publication, security reset, or rights decision without required owner review.
- RLS changes require actual Postgres staging denial and query-plan proof. An advisor-warning count is not evidence that removing policies is safe.
- Customer support/accessibility acceptance includes keyboard focus order, clear errors, WCAG 2.2 AA testing and readable failure states. Never automatically send push/audio.
- No unapproved collection of Reddit usernames/comments into SONARA customer tables. Store this aggregate research note only, not a mined contact list.

## Current release boundary

At research time PR #508 is an open **draft** for CI/migration-contract recovery. This research branch is separate and must be rebased/retested after any change to `main`; merge only if exact-head tests are green and mandatory repository protections are active. The user's previously requested temporary production-offline state is preserved. No claim of live website restoration, database deployment, app distribution, payment settlement or confirmed customer traction is made.

Next decision order: repair exact-head CI/security and release governance; run this activation test; verify one customer money-path; collect baseline activation and failed-publish evidence; then prioritize the product experiments above based on measured task completions, not feature counts.


## Second research and engineering pass — 2026-10-08

**Further 2026 Reddit evidence, with caveats:**

- Small-business installations need integrated invoicing, records and documents but not necessarily inventory: https://www.reddit.com/r/smallbusiness/comments/1vwy4tp/small_business_setup/ (2026-08-24). One respondent; discovery, not demand proof.
- A six-person agency handling roughly 35-40 clients described lead/proposal/invoice/accounting fragmentation and explicitly rejected an overwhelming enterprise feature list: https://www.reddit.com/r/CRMSoftware/comments/1wnuiit/looking_for_a_crm_with_invoicing_before_our/ (2026-09-23). One unverified user report.
- A developer reported a significant first-party analytics overcount due to repeated employee QA installs: https://www.reddit.com/r/SaaS/comments/1szmfch/we_had_86_users_after_filtering_our_own_test/ (2026-04-30). Self-report; motivates sandbox/test-cohort segmentation, not acceptance of its numeric claims as benchmarks.
- An onboarding review highlights misleading dashboard and verification funnel telemetry: https://www.reddit.com/r/SaaS/comments/1sa8hiq/your_activation_rate_might_be_broken_and_your/ (2026-04-02). Self-report; investigate raw events and consented opt-in milestones before altering pricing or marketing.
- n8n developers report schema drift, retries that duplicate actions and stale credential checks: https://www.reddit.com/r/n8n/comments/1srgrst/the_n8n_skill_that_actually_matters_has_nothing/ (2026-04-21) and https://www.reddit.com/r/n8n/comments/1q1iyeg/best_practices_for_n8n_workflows_in_production/ (2026-01-01). Reports are unverified; existing SONARA event-outbox and authority design already addresses many of these categories. Run fault-injection rather than add another framework.
- A Supabase security-review post identifies permissive RLS, exposed service-role secrets and missing foreign-key indexes: https://www.reddit.com/r/Supabase/comments/1wg0u4r/12_things_that_show_up_almost_every_time_i_go/ (2026-09-14). Use real Postgres permission/EXPLAIN tests, not an unverified claim about every project.
- Reddit onboarding observations conflict: a user reports reduced friction helps, another reports purposeful setup steps can improve trial quality: https://www.reddit.com/r/SaaS/comments/1ryswro/we_tested_5_saas_onboarding_flows_last_month/ (2026-03-20) vs. https://www.reddit.com/r/SaaS/comments/1vzq839/we_added_3_extra_steps_to_a_clients_onboarding/ (2026-08-27). Therefore A/B-test **completed first result** and **qualified retention** rather than assuming fewer steps always wins.

**Verified technical finding and concrete correction:** `lib/sonara-workspace-dashboard-summary.cjs` previously fetched `order=created_at.asc&limit=1` independently for all four milestones. Combined with the first-pass change to ignore pre-workspace first value, this could permanently hide a *later* legitimate first-value event: the earliest unbounded record would still be returned by PostgreSQL. The corrected reader now gets the earliest workspace creation first, then issues two tenant-scoped, server-side `created_at=gte.<encoded canonical ISO timestamp>` queries (Creator and Growth), each still limited to one row. Paid conversion retains its original separate earliest-event query and remains **not** the canonical paid entitlement source. Invalid/malformed workspace boundary and failed milestone reads are `activation.ok=false`, not fake zero. If no creation milestone exists, report any genuine first-value event but leave its elapsed duration unknown.

Source contract: Supabase `gte` filtering semantics, https://supabase.com/docs/reference/javascript/using-filters-gte . Existing SONARA dashboard route and tenant-scoped activity-events reader remain unchanged. This is a query-order correctness fix, not a new DB schema or feature.

**Updated tests:** four new dashboard regression tests cover post-workspace filtering, missing creation timestamp, malformed boundary, and invalid provider read. Together with the first-pass three tests, seven regressions target faulty activation accounting. Required acceptance includes `pnpm exec mocha tests/activation-metrics.test.js tests/workspace-dashboard-summary.test.js`, full exact-head CI and real staging PostgREST query/tenant evidence. A local stand-in cannot establish production query efficiency or RLS behavior.

### Reddit integration, rights and privacy decision

This pass is human-scale *research from publicly viewed discussions*, with links and analysis; it does **not** integrate Reddit as a source of customer personal data. Reddit Data API Terms revised 2026-07-20: https://redditinc.com/policies/data-api-terms and Developer Terms: https://redditinc.com/policies/developer-terms require separate agreement for commercial API uses beyond expressly permitted scope. No routine harvesting, automated DMs, AI model training on Reddit user content, monetized Reddit-content feeds, or customer-profile enrichment. Any future official Reddit provider adapter must have documented authorization, lawful use case, OAuth/rate-limit compliance, deletion and retention workflow, and independent legal review before enablement. Do not confuse using public Reddit discussion as a research lead with licensing customer-facing data products.

### Stop conditions

Do **not** merge PR #509 while PR #508's exact-head release gate is unresolved or until this PR's tests and required security controls are verified. Do not activate any scraper, Reddit API connector, externally publishing bot or production website as part of this research. Confirm staging tenant-isolation and PostgREST filter behavior before calling dashboard metrics trustworthy.
