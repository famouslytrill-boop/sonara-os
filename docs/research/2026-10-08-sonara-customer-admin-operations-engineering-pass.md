# SONARA Industries — Customer-Owned Control Planes and Ecosystem Engineering Pass
**Date:** 2026-10-08 (America/New_York). **Scope:** actual bounded source implementation + full cross-product architecture + QA/marketing acceptance. **State:** branch implementation, not production release.

## Executive decisions
SONARA Industries (parent company) owns the governance/brand; **SONARA One** is the shared *application* OS (not a kernel, device firmware, self-hosting hardware OS or regulated service provider); **Business Builder™**, **Creator Studio™**, **Growth Studio™** maintain distinct customer-facing applications but share tenant identity, usage ledger, provider gateway, approvals, audit, files, notifications and observed execution.

Owner instruction: **scale additional industries in parallel**, without insisting one end-to-end paying-customer transaction be completed first, **and fix the workflows**. Parallel architecture is compatible with disciplined stage labels: `researched`, `template_only`, `source_implemented`, `tested_exact_head`, `hosted_verified`, `customer_proven`. All customer claims must use the actual state.

## Connected-source evidence before this slice
- GitHub `famouslytrill-boop/sonara-os`; inspected main `f6586bffbcff2bb752d1430dbb0680a00a572d9c`. Open PR count **0** before this slice. Existing issue #457 tracks currently failing reservation, browser and source-generator tests.
- Merged #455 includes 17 industry `template_only` plans and five passing targeted assertions (not proof of execution); #456 includes parallel-industry research/handoffs. Earlier PRs #445, #446, #453, #454 merged.
- Production Vercel `sonara-os` project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` reports `live:false` and latest production BLOCKED. **Maintain owner's temporarily-offline requirement.** No deployment/unpause/alias action in this pass.
- Supabase `yqncsonkxgwhcxedgevk` migration history includes 178 migrations through `20261007130000`. This pass applies **no SQL**. Prior advisor warned eight authenticated-callable SECURITY DEFINER functions; review exact signatures/grants and tenant predicates before permission changes.
- Repo `docs/CAPABILITY_MAP.md` previously inventoried 957 source HTTP operations, 303 page routes, 338 matched OpenAPI API operations, 15 workspace-home fallback destinations. Static counts are not live transaction proof.

## Implemented code in this branch
- `lib/sonara-customer-business-operations.cjs` is a pure, non-mutating readiness/industry-summary module. It refuses mismatched `business.organization_id`, derives owner-only control links solely from verified business owner id + trusted server actor id, and produces seven per-business source states: `readable | partial | unavailable`. A failed source is `null`, not zero, and a capped read explicitly provides a lower bound. Source checks are **not** GitHub CI results, provider uptime, proof of settled funds or evidence of execution.
- `routes/sonara-business-control-plane-routes.cjs` reuses existing paid/workspace route gate, organization-context lookup, `loadBusiness`, `business.read` permission gate and existing dashboard reader. The **already registered** GET `/api/business-builder/businesses/:businessId` includes an additional `operations` summary after successful authorization, and the **existing** HTML business dashboard adds an accessible industry preview and owner-only administrative controls. No new route, collection, role, schema or elevated privilege.
- Industry selection is query-only (not persisted, not activated): exact allowlist matching 17 industry packs, defaulting to the business's saved valid sector. Includes planning status and fresh owner approval requirements for external communication. No generic run/execute button that lies about worker availability.
- `tests/business-control-plane.test.js` adds negative cross-tenant, falsified query, unreadable/capped data, owner/member grant, HTML control visibility, restricted API and no-provider-action assertions.
- No new marketing feature is presented as a paid, legally certified, automated or customer-proven service.

## Customer control planes — proposed cross-suite expansion
| Plane | Business Builder | Creator Studio | Growth Studio | Shared rule |
| --- | --- | --- | --- | --- |
| Basic | Customers, offers, bookings, tasks, inventory, local analytics | Project, file, rights, edit/export status | Contacts, campaigns, attribution, consent | One task at a time, plain terms, safe empty/unavailable states |
| Advanced | Business profile, team grants, workflow plan, stock controls, accountant/manager roles, locations | Studio collaborators, export quota, licence, rendering queue, model/provider rights | Channel grant/revoke, delivery approval, suppression list, campaign spend | Tenant-bound owner role or reviewed delegated capability, no stale claims |
| Admin/security | Session/MFA, device access, audit, recovery, data export, retention | Creator rights and moderation appeals | Review/social moderation and paid sender verification | No self-granted owner roles, per-action authorization |
| Operations/QA | Source health, provider readiness, job/retry ledger, time/schedule tests | Media queue outcomes, storage provenance, cost estimates | Deliverability events, webhook signatures, verified conversions | Real timestamps, run IDs and source links, no invented unit metrics |
| Development/customization | Industry forms, custom fields/templates, rule previews | Reusable creation presets, script/media templates | Conditional sequences and channel experiments | Declarative schema + validator + versioned approval; no executable user JS |

### Administrative boundary model
1. Resolve actor from server-side auth/session; resolve organization from active membership (not request `organizationId`).
2. Resolve requested business with `organization_id` AND `business_id` equality, excluding deleted rows.
3. Evaluate explicit permission per action and owner-only actions against the stored business owner. Owner title from client metadata is not authority. A member who can `business.read` may see aggregate source-read readiness but not private rights management links.
4. Never send privileged provider credentials, customers' raw documents, session details or private keys in any admin JSON response.
5. UI and APIs enforce same contracts. Hidden button is **not** a substitute for server authorization; denial remains 403/404 as appropriate.
6. Admin edits require version checks, immutable audit, rollback/undo for reversible changes and owner-confirmed approval for refunds, payouts, security, bulk export, legal policy, public publication or customer campaigns.
7. Control plane results use `unknown` or `unavailable` when a dependency cannot be read; do not return green “Healthy” because one server returned HTTP 200.

## Cross-industry scale matrix
Existing 17 *plan-only* Business Builder sector packs cover restaurant, food truck, trades, trucking, cleaning, retail, rentals, venues, manufacturing, real estate, professional services, delivery, salon, e-commerce, nonprofit, construction and facilities.
For every pack require a record permission matrix; versioned event source/tenant; explicit prerequisite inputs; safe time/unit/currency conversions; failure and replay behavior; owner review of sensitive transitions; cost/usage ceilings; rollback or compensating activity; keyboard/caption/noise preferences; privacy and retention. Reuse work orders, scheduling, CRM, inventory and provider ledgers across sectors rather than spawning parallel databases.

**Additional future sectors not yet delivered as live services:** publishing and literary curricula, accessibility education and captioning, film/music theory, streaming/games, manufacturing digital twins, geographic models and public transport/flight information, mobile POS, specialist tax/payroll/medical/financial integrations. Flight-information lookup does not promise “free flights,” purchased tickets or airline systems access.

## Database, migrations, storage and work tables
No new migration for this read-only change because the existing `business_workspaces`, `business_permission_grants`, resource tables and business-control audit already model the necessary relationships. Adding a table merely to claim progress increases tenant-isolation risks.

Before writing future workflow state tables, map all existing schema and migrations. New state, only if missing: `workflow_definition_version` -> `approval_request` -> `workflow_execution` -> `execution_attempt` -> `outbox_delivery` -> `provider_receipt` -> `usage_reservation`. Required invariants: per-tenant unique idempotency key, transactional writer/outbox, bounded lease and retry/dead-letter, immutable version/approval digest, accurate cancellation, audited decisions and no cross-tenant row leakage. PII and media objects remain encrypted/private, with signed short-lived download authorization.

## Equations and provable output claims
- Operational source completeness: `confirmedSources / expectedSources`; a partial page is not a complete read. This pass derives 7 sources and labels source-read checks correctly.
- Resource utilization: `sum(confirmed_active_resource_minutes) / sum(available_resource_minutes)` only with positive verified available minutes, no tentative reservations.
- Cross-industry subscription contribution: `reconciled_collected_cash - payment/provider/compute/storage/support/direct_variable_costs` by currency and cohort; missing components -> unknown, never zero.
- Job profitability: `recognised_revenue - verified_labor_materials_travel_fees_refunds`; source reconciliation required.
- Simulation/forecast: benchmark against historical holdouts; MAE/MASE/calibration, confidence and case counts. A simulation is not a transaction or expert certification.
- Work-queue budget: `reserved <= remaining_tenant_budget` transactionally; `lease_expires` and idempotent provider IDs gate duplicate event processing.
- Customer funnel: `usable_free_tool_result -> optional_customer_account -> activated_saved_record -> repeated_use -> paid_conversion` with real cohort evidence. Never fabricate conversion or scale ROI.

## UX, ADA/accessibility, safety and marketing
Calm workspaces with dark/light preference, visible focus and labels, 200–400% zoom, full keyboard, captions/transcripts, text alternative to sound, no autoplay/automatic push, reduced-motion controls, touch-target spacing and screen-reader feedback. WCAG 2.2 AA: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ .

Core marketing program in parallel: original 15–30s narrated/captioned previews for each vertical with **Template preview** or **Operating source checks** labels. Free public tools: 3 parent, 4 per child, accessible results without signup. Sell measurable workflows when they work, not universal parity against incumbents. Cross-sell Business Builder operations, Creator Studio education/production and Growth Studio customer-approved distribution, without hiding product-specific permissions or billing. Provider-paid and GPU workflows must quote estimated usage and enforce a reservation before execution.

## Security and release standards
Supabase cautions that user-editable `raw_user_meta_data` must not authorize access, and SECURITY DEFINER can bypass tenant RLS: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/functions . Governed table/role grants + app-level checks both required. Secure development reference: NIST SSDF 1.1 https://csrc.nist.gov/pubs/sp/800/218/final . Accessibility reference: W3C WCAG 2.2 above.

Release gate:
- Full exact-SHA Node 24 + compatibility lane, pnpm@12.7.0 frozen lock, lint/typecheck/build, target tests, ALL Mocha, Playwright keyboard/mobile, security scans, static route/OpenAPI/schemas, database replay and Vercel preview proof;
- Existing GitHub Issue #457 records baseline failing booking, duplicate route and generated handoff tests. Keep failures visible; do not bypass/assert away them and do not merge branches with unresolved exact-head gates.
- Release requires approved migrations/provider credentials and separate explicit owner authorization to resume currently BLOCKED/OFFLINE production. **Not done in this pass.**

## Prioritized continuation
P0: inspect exact-head CI of this business operations PR; fix its defects; preserve separate issue #457 failures as explicit blockers. P0: audit the eight privileged Supabase functions with owner-reviewed, reversible SQL corrections when necessary.
P1: carry this reusable per-tenant control-plane pattern to Creator Studio and Growth Studio, including read-only execution/usage/source evidence; add a real shared customer preferences/permissions model and accessible workspace-specific routing.
P1: industry workflow storage and safe execution; add new schema only after current tables are mapped. P1: performance baseline/p95 and cost-by-industry proof, offline authorization/concurrency.
P2: regulated and independent provider services, app store/mobile, marketplace settlement and social platform moderation, streaming/high-res GPU render, geographic simulation, multi-region disaster recovery after technical evidence.
