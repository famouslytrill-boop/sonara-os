# SONARA Industries — Parallel Industry Scaling: Engineering, UX, Compliance and Marketing
**2026-10-08 | Research and implementation continuation | Not a live-deployment certification**

## Mandate and repository evidence
SONARA Industries is parent; SONARA One is its shared **application OS** (not a device/desktop OS); Business Builder™, Creator Studio™ and Growth Studio™ keep separate customer identities and task-based workspaces. The owner directed parallel industry-scale development **instead of first completing one paid-customer workflow**. That scope change does **not** authorize inaccurate “ready” badges, skipping QA, provider permissions, financial controls or a production restart.

GitHub `famouslytrill-boop/sonara-os`: previous #445 resource/waitlist and #446 commercial workflow branches and #454 handoff docs have merged. At inspection `main` SHA was `e64176a46f569ecf8c642626ce7fd93d0362053b`, merge of #455. PR #455 added 17 declarative industry templates to existing `lib/sonara-workflow-planner.cjs`, five new source tests in `tests/operations-automation-media-expansion.test.js`, and business-template documentation. Branch PR was merged by another actor **while workflows were still in progress**, so merge alone is not test evidence.

Supabase `yqncsonkxgwhcxedgevk`: ACTIVE_HEALTHY, 161 applied migrations, most recent `20261007130000`; this is schema evidence, not proof of paid traffic or complete Resend deliverability. Security advisors: 66 RLS-enabled/no-policy informational, eight authenticated-executable SECURITY DEFINER warnings, one leaked-password-protection warning and one extension-in-public warning. Investigate each call/grant rather than blindly creating open policies. Vercel project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY`: live=false, latest production deployment BLOCKED. Respect existing offline directive. Proprietary code repository remained public on review.

Current generated `docs/CAPABILITY_MAP.md` (source inventory) reports 957 registered HTTP operations, 303 declared page routes, 338 API operations with OpenAPI matches, zero *static* route/data gaps, 15 workspace-home fallback destinations, 59 deterministic formula evaluators and 161 migration files. Counts cannot certify execution.

## Reusable application-platform architecture
```text
SONARA INDUSTRIES (brand, compliance and governance)
  SONARA ONE (identity + tenant + entitlement + approval + budget)
    PROVIDER GATEWAY / CREDENTIAL VAULT / RATE LIMIT / AUDIT
    EVENT INBOX & OUTBOX -> DURABLE JOB -> PROVIDER OR LOCAL WORKER
    DOCUMENT, MEDIA AND OBJECT STORAGE -> RETENTION + PERMISSION
      BUSINESS BUILDER (17 vertical declarative workflow plans)
      CREATOR STUDIO (project/asset/licence/marketplace and media work)
      GROWTH STUDIO (campaigns/connectors/attribution/consent)
```
Reuse one shared tenant-scoped work graph. **Do not fork 17 copies of accounts, payments, customer tables, schedulers or workflow engines**. Industry modules should be typed configuration of existing canonical tables, permissions, workflow steps, language and UI templates. Add tenant-scoped extension tables only when a required durable field cannot fit legitimate existing contracts. Avoid creating new money/staff/document tables solely to make a feature count larger.

## What was actually added in #455
The 17 industry-specific **template-only** plans cover:
- Restaurant: inventory availability task; food truck: shift closeout plan; trades: booking-to-job handoff; trucking: route/delivery report; cleaning: shift-quality review.
- Retail: stock-reorder review; rentals: customer offer requiring owner approval; venues: waitlist-opening offer requiring owner approval; manufacturing: production materials alert.
- Real estate: lead email draft requiring owner approval; professional services: intake task; last-mile delivery: completion/evidence report with approved customer contact.
- Salon: approved appointment offer; e-commerce: purchase evidence summary; nonprofit: intake review; construction: estimate review; facilities: maintenance task.

All use the existing bounded `validateWorkflow` grammar and authenticated `GET /api/business/automations/templates` route; no new route, migration, browser-side secret, provider credential or paid job was introduced. The test suite enforces 17 sector uniqueness, shared validation and `launchState:template_only`, sensitive-message approval regardless of requested autonomy, unknown-action rejection and retained business manager middleware. A **valid plan** is not a running automation: there is no claim these templates alone persisted runs, sent messages, debited inventory or dispatched staff.

## Workflows and test contracts for every industry
A future approved execution plane follows:
`template_only -> validated -> prereqs_checked -> owner_approval_pending -> approved -> queued -> leased -> executing -> completed|failed|cancelled|requires_reconciliation`.
The transition must be durable, fully auditable and tenant-scoped. A plain `200 OK` on a preview never implies a customer received a message or a provider settled funds.

Mandatory invariant matrix:
1. **Tenant:** every job, file, task, booking, device, customer, invoice and connector resolves the organization from authenticated server authority, never a caller-supplied organization header alone. Foreign-tenant IDs denied before reads and writes.
2. **Idempotency:** unique event/job key based on organization + source event + definition version; bounded retries, DLQ and lease ownership; duplicates never double-charge, double-message, double-ship or oversell stock.
3. **Owners:** per-action approval must match user, role, tenant, policy version, exact input hash, expiry and sensitive event. One prior approval is not indefinite permission. Provider writes, refunds, payouts, legal publication and public campaigning stay owner-controlled.
4. **Known data:** failed provider/database lookup -> unavailable, never zero/success; reconciliation records real identifiers, signed callbacks, timestamps and units. Do not sum unlike currencies, call payments “received” from a non-settled state, or manufacture profit.
5. **Offline:** local queued drafts need replay IDs and privacy limits; visible conflict handling; device permissions must be opt-in. GPS/gyro location and camera/audio capture cannot run secretly or without explicit permission.
6. **Contracts:** existing `route -> input DTO -> authorizer -> service -> table/proof -> result DTO -> owner screen` register remains the authority; every HTML/native form has correct success, retry, error and loading behavior; unknown source fields fail safely.
7. **Accessibility:** screen reader labels, WCAG 2.2 AA, 200%/400% reflow, full keyboard, large touch targets, color-independent errors, reduced motion, captions/transcripts, quiet notifications and localized clocks/units.
8. **Tests:** positive owner path, member allowed path, cross-tenant denial, missing/provider-timeout read, invalid type/size/date, duplicate event, concurrent mutation, approval expiry, plan budget exhaustion, live provider unavailable, canceled/offline replay.

## Canonical record and permissions design (future mappings, not migrations)
| Record family | Required durable fields | Access + proof |
| --- | --- | --- |
| Tenant/membership | organization, workspace, user, role, status | server-resolved membership; deny foreign tenant |
| Workflow plan/run | industry, definition version, trigger, steps, immutable input hash, status | validated action policy, versioned approval, idempotent lease |
| Customer + job | contact consent, assignment, schedule, state, audit | customer/staff scoped; no unauthorized notes or GPS |
| Resource/inventory | owner, stock/available, hold, version, expiry | atomic capacity; reject concurrent oversell |
| Payment and settlement | provider event ID, account, currency, signed amount, type, source | never store PAN/CVV; verify webhook signatures and reconciliation |
| Media/project/licence | owner, rights, content hash, expiry, delivery receipt | private objects/signed URLs, no rights by inference |
| Provider connector | owner external account, scopes, expiry, encrypted credential, status | explicit owner grant, revoke, health, no credential egress |
| Notification/campaign | consent, transport, recipient, attempt, provider acceptance, delivery evidence | off by default, approval before sensitive sends |
| Knowledge/rules | source/licence, version/date, locale, purpose, limitation | grounded RAG, revision history, human override |

## Formulas, modeling and logistics
- `workflow_contribution = verified_collected_cash - verified_variable_costs`, per currency and only when complete source evidence exists.
- `resource_utilization = confirmed_occupied_minutes / verifiably_available_minutes`; do not count tentative reservations.
- `capacity_tasks = floor(qualified_available_minutes / expected_task_minutes)` with labor/safety/regulatory constraints.
- `reorder_point = demand_during_lead_time + safety_stock`; task suggestion, never an automatic vendor purchase.
- `delivery_route_cost`: opt-in travel distance + time + load + vehicle capacity + service windows; unsupported/approximate GPS stays labelled.
- `cost_reserved = provider_generation + CPU/GPU minutes*rate + storage_GB_month*rate + egress*rate`; settle from measured usage, refund unused reservations.
- `attributed_cash_return = (observed_eligible_cash - documented_spend)/documented_spend` if spend >0; disclose attribution is not causality.
- Forecasts: out-of-time benchmark vs seasonal naïve baseline, sample size, MAE/MASE, calibration/coverage, drift and uncertainty. No guarantees.

## Company product growth and interface design
**SONARA Industries:** public purpose, products, three parent free tools and transparent status; content without mandatory login for promised free results. **Business Builder:** industry selector, saved organization, CRM, jobs, reservations, receipts and staff control; expose `Planning only` on unconnected plans. **Creator Studio:** versioned image/video/music projects, film/music theory education, captions, timeline, licensing, marketplace order/delivery, deterministic local processing and optional authorized paid GPU worker. **Growth Studio:** consented channels, attribution, content review, customer-approved distribution, social connector adapters, analytics/SEO and owned-network research (moderation requirements before any public social platform). All three share settings, account switching, quotas, localized times, permissions, templates, storage and auditing; avoid forcing one visual style into every task. Appearance polished, operational pages calm and accessible.

**Additional research-only areas:** manufacturing digital twins, academic/math/geometry/science simulation, sign-language/reading/language arts and literature knowledge packs, smart retail kiosks/POS, gaming/streaming servers, public transport and flight-information adapters, GPS/gyroscope and motion with consent, local cloud functions, more payment and banking-provider connectors. Do not call them built without code, rights, provider contracts and operating proof. “Free flights” does not establish free tickets, discounts or an airline connection.

## Security, accessibility, industry legal boundaries
Use NIST SSDF 1.1 (final; 1.2 draft), OWASP ASVS controls, tenant-adversarial denial proofs, SCA/SBOM/CodeQL/secrets/backup-restore. Review eight privileged Supabase functions for `EXECUTE` grants, `search_path`, invoker identity and tenant authorization; separate reversible migration if needed. WCAG 2.2 AA acceptance is core, not an add-on. Transportation: FMCSA ELD/HOS logs are regulated and require compliant/registered ELDs where applicable; a planned route summary is not an ELD. Housing, finance, regulated health, telecommunication and payroll functions need jurisdiction-specific review; low budget/non-custodial provider structure does not waive compliance. Never promote unauthorized reviews, autoplay audio, unconsented contact or invented earnings.

## Marketing pass: scale vertical landing education, not fictitious customer proof
Use 17 truthful sector landing examples, each with an original 15–30 second captioned template preview (`planning` label until executing), sector terminology and “see what you need to connect.” SEO entry via free tool -> useful result -> optional save -> relevant workflow preview. Business users can discover Creator Studio for instructional videos/voice/music and Growth Studio for consented campaigns. Define measurable adoption: organic search conversion, first template selection, validated workflow share, prerequisite completion, support requests, future verified activation, week-4 reuse and sustainable contribution margin. Protect low-price subscriptions with resource usage ceilings; optional credits for rendering, messaging and provider compute. No fabricated star ratings, case studies, performance forecasts or platform-parity marketing.

## Priorities and factual release boundary
**P0:** exact-head CI on #455 (the PR has merged while checks were still in progress at inspection); verify existing #445 booking/workflow and #446 checkout/migration regressions; protect live deployment pause. Investigate 15 source fallback destinations and eight privileged functions in isolated PRs. **P1:** build persistent, tenant-safe industry workflows with approval, event outbox, retries and tested workforce/asset assignments using shared records; deliver four sector beta paths in parallel after authorization. **P2:** real connector credentials, mobile/offline, creator licensed delivery, verified social distribution, media/GPU and compliant regulated verticals, all metered.

**Authoritative references:** repo `AGENTS.md`, `docs/CAPABILITY_MAP.md`, `lib/sonara-workflow-planner.cjs`, `lib/sonara-customer-automation-policy.cjs`; NIST https://csrc.nist.gov/pubs/sp/800/218/final and draft status https://csrc.nist.gov/projects/ssdf/publications; W3C https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/; FMCSA https://www.fmcsa.dot.gov/hours-service/elds/general-information-about-eld-rule.
