# SONARA all-sector engineering matrix — October 8, 2026

All statements here are planned contracts unless independently proven in current source, test, production and provider credentials.

| Sector | Implement next | Required validation |
| --- | --- | --- |
| Parent and child governance | Group review boards and independent child performance | Actual legal entity proof and owners |
| Customer admin | Organization-specific staff, approvals, security, billing, audit | No cross-tenant access, verified membership |
| Frontend/navigation | Every button → route → handler → data state and error | Browser, keyboard, screen reader, mobile |
| Authentication | 2FA/passkeys, revocation, roles, device scope | IDOR, CSRF, replay and permission tests |
| Workflows/SQL | Canonical job, order, media and approval lifecycle | Idempotent migration, RLS, rollback |
| Storage/documents | Signed upload/download, retention and restore | File scoping and backup recovery |
| Free social | Profiles, follow, comment, report/block/appeal, discovery | Moderation and age/privacy gates |
| Marketplace/storefront | Free presence, independent seller receipts and payouts | Real reconciliation and licensed delivery |
| Apple/Android | Native shells, deep links, consented sensors, offline queue | Signed device and conflict tests |
| Live lobbies/servers | Authenticated rooms, TURN, moderation, captions | Network, safety, recording/egress budget |
| Music/film/arts | Projects, theory library, timeline, rights, actual renders | Provenance, accessible caption/export |
| Literature/science/math | Licensed factual curriculum, deterministic simulations | Proven sources, bounded numeric errors |
| Maps/GPS/gyroscope | User-initiated location or movement, logistics | Permission prompts, deletion and retention |
| Integrations | Microsoft Excel/Graph, Google, Apple, provider OAuth | Server secrets, token revocation, 429 retry |
| Templates/forms | Owner-editable validated schemas and premade vertical packs | Versioning, exports and access checks |
| CRM/logistics/analytics | Source-linked KPIs, demand, fulfillment and operations | Dates, units, nulls and traceability |
| Timers/clocks/calendars | UTC event store, user timezone and notifications | DST, recurrence, quiet hours, opt-in |
| Finance/calculators | Stock, margin, budget, ROI and cash runway | Minor currency units, input bounds |
| Advertising/marketing | Consent-based campaigns, SEO, public free tools | Owner approval, attribution, opt-out |
| Legal/licenses/contracts | Versioned release, ownership and consent records | Signatory authority and legal review |
| Agents and automation | Bounded deterministic actions, optional provider adapters | Resource quota and owner approval |
| Traffic/performance | CDN, indexed queries, job queues and OTel | k6 load, p95, backlog, variable costs |
| Release/CI | Protected main and exact-head full green checks | Branch policies, replay, live proof |

Industry packs: restaurants, HVAC/electrical/plumbing, trucking, cleaning, retail, delivery, rentals, venues, manufacturing, real estate and professional services. Reuse cross-industry source-of-truth contracts instead of cloning schemas per vertical.

Mathematical standards: financial amounts in integral minor units; queue Little's Law L=lambda*W only for stable systems; explicitly report unknown data, never treat missing figures as zero; forecast experiments must beat documented baselines.

The user waived a mandatory first end-to-end workflow before industry scaling; security, privacy, legal, test and production gates still apply.