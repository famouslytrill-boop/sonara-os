# Business Template System

Industry guidance for **SONARA Industries → SONARA One → Business Builder™**.
Templates cover restaurants, food trucks, salons, contractors, consultants, creators, local retailers, events, agencies, nonprofits, education, mobile services, and online services. These are launch guides and reusable *workflow plans*, not guaranteed business outcomes or independently operating software.

## Implemented in source on the cross-industry expansion branch

`lib/sonara-workflow-planner.cjs` owns the single allowlisted workflow grammar, trigger registry and approval policy. Its `INDUSTRY_PACKS` register contains **17 Business Builder industry templates**. The existing authenticated `GET /api/business/automations/templates` route includes these plans; `POST /api/business/automations/validate` validates the same grammar for a specific draft.

| Industry | Source template key | Trigger | Customer-friendly proposed result | Owner review |
| --- | --- | --- | --- | --- |
| Restaurant | `restaurant-availability-task` | `inventory_low` | Check ingredients before menu work | Not needed for internal task/notice |
| Food truck | `food-truck-closeout-plan` | `route_completed` | Prepare shift closeout report | Internal only |
| Trades | `trade-job-handoff` | `booking_confirmed` | Prepare an assigned job task | Internal only |
| Trucking | `trucking-delivery-review` | `route_completed` | Review completed fleet deliveries | Internal only |
| Cleaning | `cleaning-shift-review` | `shift_ended` | Review site quality checklists | Internal only |
| Retail | `retail-reorder-review` | `inventory_low` | Prepare a stock reorder review | Internal only |
| Rentals | `rental-request-offer` | `booking_requested` | Prepare a rental offer | **Required before customer contact** |
| Venues | `venue-waitlist-offer` | `waitlist_opening` | Prepare a venue opening offer | **Required before customer contact** |
| Manufacturing | `manufacturing-stock-alert` | `inventory_low` | Review production material shortage | Internal only |
| Real estate | `real-estate-lead-follow-up` | `lead_qualified` | Draft property lead follow-up | **Required before email** |
| Professional services | `professional-service-intake` | `form_submitted` | Prepare client intake task | Internal only |
| Delivery | `last-mile-delivery-proof` | `route_completed` | Prepare delivery completion evidence | **Required before notifying customer** |
| Salon | `salon-booking-offer` | `booking_requested` | Prepare appointment offer | **Required before customer contact** |
| E-commerce | `store-purchase-summary` | `conversion_recorded` | Review verified online-store sale | Internal only |
| Nonprofit | `nonprofit-intake-review` | `form_submitted` | Prepare community intake task | Internal only |
| Construction | `construction-estimate-review` | `lead_created` | Prepare quote review task | Internal only |
| Facilities | `facility-maintenance-request` | `form_submitted` | Prepare a maintenance response | Internal only |

**Important limits:** Every one of these has `launchState: "template_only"`. A valid plan is not a saved automation, API/provider integration, inventory mutation, dispatched driver, sent message, user notification, completed job, ELD-certified hours-of-service record or customer revenue. Authorization checks and per-organization durable workflow execution still require existing SONARA authority/worker systems and operational proof.

## Reusable industry-scale architecture

Prefer one shared work graph over creating 17 separate databases.

```text
Owner / organization membership / product entitlement
  -> industry pack selection (no side effects)
  -> workflow validation (allowed trigger + bounded safe steps)
  -> record + consent + scoped reference checks (future connection)
  -> budget and owner approval (every sensitive operation)
  -> durable work intent with idempotency key
  -> queue lease + provider / local runner
  -> signed provider receipt / local audited result
  -> derived human-facing status / notification preference
```

Common record families: tenant/workspace memberships, people/contacts, business locations and resources, service/item catalog, bookings, jobs/work orders, inventory and costed materials, invoices/payments/provider evidence, tasks and shifts, event/consent history, provider connections, approvals, artifact/file records, and auditable job attempts. **Reuse the existing database migrations**. Do not manufacture a new `payments` or `jobs` table when canonical records exist.

### Required execution states

`template_only -> validated -> awaiting_prerequisites -> awaiting_owner_review -> approved -> queued -> leased -> executing -> completed | failed | cancelled`.

- The current industry packs end at the **template/validation** boundary.
- Only workflow policies explicitly labelled `safe_automatic` can become unattended candidates, subject to tenant/budget/tool grants and existing activation controls.
- External customer messages, provider writes, payouts, refunds, charges, legal publication, security setting changes, generation charges, property entry, and personal tracking must be approved through the appropriate owner/agent authority.
- Queue/retry must be idempotent; a missed database read is `unavailable` rather than zero; a retry cannot duplicate a charge or message.
- Team-specific views: business owner, scheduler/dispatcher, worker, customer. Each view receives only authorized data.
- Provider credentials are held server-side and must be revoked and scoped per provider account and organization.

## Engineering acceptance checks

1. Every industry template validates through `validateWorkflow`; unknown triggers/actions and arbitrary code are rejected.
2. Workflow templates have unique stable keys, a concrete industry, named record prerequisites, and a readable disclosure.
3. Every customer-contact plan produces `approvalRequired: true`, even if a caller requests `safe_automatic` or embeds a misleading `config.approval`.
4. `GET /api/business/automations/templates` stays behind `requireBusinessManager`, returns `arbitraryCodeAllowed:false`, and exposes the 17 industry plans without adding a new route.
5. Tests: `pnpm exec mocha tests/operations-automation-media-expansion.test.js`, `pnpm test`, `pnpm run lint`, `pnpm run build`, `pnpm run verify:capability-map`, `pnpm run verify:gates`. Check exact-head GitHub Actions; don't claim success without results.
6. For future runtime activation: cross-tenant reads/writes denied, approval fresh, provider receipts signed/confirmed, offline replay conflict-free, customer status accurate, storage/retention/permissions auditable, 200%/400% reflow and keyboard/assistive support verified, throughput and unit economics bounded.
7. Regulation-specific packs are **guidance-only** until separate domain certification/compliance assessment: FMCSA/ELD/HOS in trucking, food safety in restaurants, housing/fair lending in real estate, professional scope boundaries and child/student/medical/financial data.

## Customer-facing UX

One industry selector; one plain-language workflow name; a short preview of needed records; explicit `Not connected`, `Needs review`, `Ready to validate` and `Result recorded` states. Advanced rules are inspectable behind `Details`. Never display a simulated result as a real job completion. Use captions and visual alternatives to audio notifications, keyboard navigation, WCAG 2.2 AA and clear error/retry messages.

## Marketing and pricing

Launch positioning: **Your business workflow, your rules.** Demonstrate 15–30 second real UI walkthroughs for each sector, with honest capability labels, consent and visible customer outcomes. Use the public free tools to attract customers without a signup gate. Measure first real saved record, activated providers, 7/30-day retention, cost per processed job, monthly provider cost and margin by tier. Charge for supported value and resource budgets, not for invented integrations or automatic certified compliance.

## Official external references and standards

- NIST SSDF 1.1 (final): https://csrc.nist.gov/pubs/sp/800/218/final ; SSDF 1.2 remains a draft as checked October 2026.
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- FMCSA ELD requirements: https://www.fmcsa.dot.gov/hours-service/elds/general-information-about-eld-rule ; SONARA has not established ELD vendor registration/certification.
