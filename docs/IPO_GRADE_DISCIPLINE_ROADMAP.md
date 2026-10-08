# SONARA 10/10 Engineering and Operating Evidence Standard

SONARA is not entitled to a 10/10 score because a feature exists in source code. A
10/10 is an **exit condition backed by current evidence**. Architecture, security,
production, scale, commerce, devices, integrations, and market proof are scored
independently so strength in one area cannot hide a red condition in another.

This document converts the old aspirational scorecard into a falsifiable standard.
A dimension may be marked 10/10 only while every required proof below is current.
If evidence expires, a production gate turns red, or a required external system is
disabled, the score falls automatically in the next review.

## Current blocking facts — 8 October 2026

The following prevent an all-10 score today:

- GitHub `main` is not protected by mandatory required checks.
- The Vercel project reports `live: false`; the newest production deployments are
  blocked and the last READY production deployment is behind the current repository
  head.
- The live Supabase security advisor still reports security findings, including
  authenticated-callable SECURITY DEFINER authorization helpers and leaked-password
  protection disabled. Those helpers are policy dependencies in migration history,
  so they must be changed only with a proven replacement, never by blindly revoking
  EXECUTE.
- The live Supabase performance advisor still reports RLS/init-plan, permissive-policy,
  foreign-key-index, and unused-index work. The 20261008100000 migration begins the
  next safe reduction by narrowing pure service-role policies and optimizing the
  remaining direct auth.uid ownership predicates.
- Connector acceptance testing, Android/iOS store/device evidence, GPU/media worker
  scale evidence, disaster-recovery/load evidence, and sustained paying-customer
  evidence are incomplete.
- Customer adoption, retention, revenue, and enterprise operating proof cannot be
  manufactured by tests or documentation.

## Rating contract

| Dimension | 10/10 exit evidence |
| --- | --- |
| Architecture sophistication | Capability map has no unexplained route/data/workflow gaps; every consequential action has ownership, authorization, persistence, failure, retry/idempotency and audit contracts; architecture-delta and dependency checks pass at exact release SHA. |
| Product breadth | Each advertised capability has a real customer route, working state transition, persistence or explicit deterministic/no-write contract, truthful unsupported/setup-required state, and end-to-end acceptance test. No roadmap/research item is marketed as live. |
| Database/data model | Production migration history matches repository, migration replay is green, tenant classification is complete, no unexplained schema drift exists, required foreign keys/indexes are justified, RLS/Data API exposure is reviewed, backup + restore drills are proven. |
| Deterministic systems | Every declared formula/workflow has validated input bounds, deterministic fixtures, numerical/error tolerances, saved-result lineage, versioning and falsification tests; AI is not required for deterministic claims. |
| Security architecture | Protected release branch; required checks cannot be bypassed; no unresolved critical/high findings; Supabase/CodeQL/dependency/secret/webhook/tenant tests green; credential and approval boundaries proven; incident + recovery exercise completed. |
| Governance architecture | Sensitive actions default-deny, approval evidence is immutable/auditable, legal/licence/provider policies map to runtime enforcement, policy changes are versioned, and exception/expiry/review controls are tested. |
| Commerce architecture | Real provider sandbox/live-canary proof covers checkout, webhook replay, entitlement, connected merchant money, refund, dispute win/loss, fulfilment, stock, reconciliation and recovery without SONARA taking unnecessary custody. |
| Creator architecture | Project graph, approvals, provenance, generation lifecycle, licensing, marketplace sale/delivery, archive/export and rights/consent gates pass end-to-end with real stored artifacts. |
| Growth/CRM architecture | Lead → consent → campaign → send/publish → delivery receipt → touchpoint → conversion → attribution → experiment/report chain is tenant-safe and provider-verified; unsubscribe/suppression/error recovery are proven. |
| Connector depth | Every connector advertised as operational has least-privilege authorization, read/write contract as applicable, idempotency, pagination/rate-limit/retry/revoke/reconnect tests, sanitized telemetry, real-account acceptance evidence and a support owner. |
| Mobile/device maturity | Android and iOS release builds, signing, deep links, passkeys, push, permissions, accessibility, offline conflict recovery, upgrade/rollback and representative physical-device tests are green; store distribution evidence exists. |
| Media/GPU infrastructure | Durable queue + worker fleet supports cancellation, retry/backoff, idempotency, provenance, quotas/cost controls, artifact integrity and observability; representative image/audio/video loads meet declared SLOs under failure injection. |
| Production readiness | Exact release SHA is staged, migration checks pass, production-like E2E/smoke/performance/accessibility/security tests pass, deployment is promoted atomically, post-deploy checks are green, rollback is exercised, monitoring/on-call/runbooks exist. |
| Enterprise operational proof | Published SLOs backed by measured availability/latency/error-budget history; load and disaster-recovery exercises meet RTO/RPO; audit/support/escalation/access-review/key-rotation and tenant-isolation exercises are repeatable over sustained operation. |
| Real customer/market proof | Real paying customers complete core jobs, cohorts show measured activation/retention, churn and support burden are known, revenue/refund/dispute data reconcile, and customer feedback demonstrates repeat use. No synthetic/demo activity counts. |

## Non-negotiable release hierarchy

P0 work outranks new feature expansion until all release-critical evidence is green:

1. protect `main` and make exact-head checks mandatory;
2. keep generated/release evidence reproducible at the exact commit;
3. eliminate or explicitly disposition live security findings without breaking RLS;
4. reconcile production schema/migrations and prove two-tenant read/write denial;
5. stage → test → promote the exact build; keep rollback evidence;
6. prove the complete money pathways with provider-backed canaries;
7. prove observability, load thresholds, backup/restore and incident response;
8. qualify mobile/device and connector lanes with real providers/devices;
9. run bounded customer pilots and measure activation, retention, support and unit
   economics before claiming market or enterprise maturity.

## Score integrity

A score is **not** rounded up. Documentation, mocks, unit tests, generated schemas and
architecture diagrams are supporting evidence, not substitutes for production/provider
proof. A missing external credential is `setup_required`; an unapproved provider is
`approval_required`; an untested capability is not production-ready.

A 10/10 rating therefore means: **the capability exists, is protected, is observable,
has survived realistic failure modes, and has current external evidence where external
systems or customers are part of the claim.**

## Operating metrics

Track these continuously once production is resumed:

- MRR / ARR, gross margin and payment failure/refund/dispute rates;
- activation, time-to-value, conversion, retention and churn;
- LTV / CAC and CAC payback once acquisition spend is material;
- support volume, response/resolution time and repeated defect classes;
- availability, latency, error rate, queue age, saturation and error budget;
- backup/restore success, RTO/RPO and incident recovery time;
- security findings by severity/age, access reviews, key rotation and audit completion;
- provider success/rate-limit/retry/reconnect health;
- per-capability generation/compute/storage cost against plan margin; and
- accessibility, mobile/device and offline-sync failure rates.
