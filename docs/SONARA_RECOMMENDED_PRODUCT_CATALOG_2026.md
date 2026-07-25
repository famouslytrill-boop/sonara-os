# SONARA Recommended Product Catalog — 2026

**Version:** 2026-07-25  
**Total product suites:** 34  
**Pricing change:** None

This catalog converts the approved market research and product bets into one versioned portfolio for SONARA Industries, Business Builder, Creator Studio, and Growth Studio. It does not claim every product is complete. Each entry declares its lifecycle status, plan floor, dependencies, route, customer outcome, and safety boundary.

## Portfolio rules

- Keep the connected path from business launch, to creator operations, to measurable growth.
- Prefer complete governed workflows over large collections of disconnected features.
- Preserve the existing Free, Starter, Core, and Pro plan families. This change does not create Stripe prices or modify subscriptions.
- Treat the plan floor as packaging guidance until verified billing entitlements are connected.
- Keep provider-backed execution setup-gated and approval-gated.
- Do not present validation-required or planned products as production-complete.
- Preserve the existing done-for-you service catalog alongside the software product catalog.

## Lifecycle meanings

| Status | Meaning |
|---|---|
| `active` | The core workflow is already available and may be presented as active. |
| `beta` | A meaningful workflow exists, but production coverage, integration depth, or validation is incomplete. |
| `validation_required` | The market bet is approved for testing, but measurable customer commitment is required before full build. |
| `planned` | The capability is approved directionally but must not execute or be sold as complete. |
| `setup_required` | The workflow depends on customer, provider, database, or production configuration. |

## SONARA Industries shared products

1. SONARA Nexus Shared Operating Spine
2. Identity, Organizations & Access
3. Billing & Entitlements
4. Customer, Consent & Evidence Timeline
5. Asset & Document Vault
6. Integration Hub
7. Automation & Approval Center
8. Usage, Cost & Value Scorecards
9. Audit, Security & Readiness Center
10. Market Intelligence & Product Lifecycle

## Business Builder products

1. First Transaction Mode
2. Business Readiness & Operating Plan
3. Market, Offer & Pricing Lab
4. Customer, Intake & Service CRM
5. Quotes, Billing & Payments
6. Booking, Operations & Team
7. Vertical Starter Packs
8. Business Evidence, Compliance & Portability

## Creator Studio products

1. Brand & Asset System
2. Content Project & Repurposing Workspace
3. Release Package Builder
4. Rights, Originality & Collaborators
5. Creator Commerce & Digital Products
6. Fan, Buyer & Partner CRM
7. Brand Deal Operations
8. Creator Export & Revenue Intelligence

## Growth Studio products

1. Customer Timeline & Consent Center
2. Lead Capture, Segments & CRM
3. Campaign & Journey Builder
4. Lifecycle Messaging & Social Planning
5. Landing Pages & Conversion Tracking
6. Attribution & Incrementality Lab
7. Reviews, Referrals & Partnerships
8. Provider Diagnostics & Answer Visibility

## Runtime and database integration

- `lib/sonara-recommended-product-catalog.cjs` is the versioned code source for product definitions.
- `scripts/apply-recommended-product-catalog.cjs` integrates the catalog into the customer service-catalog route and ecosystem manifest during the standard runtime pipeline.
- `supabase/migrations/20260725180000_recommended_product_catalog.sql` extends `service_catalog_items` with product keys, plan floors, lifecycle statuses, route paths, and metadata, then upserts all 34 products idempotently.
- The customer catalog merges database records with the code registry, so the product list remains available before the migration is applied and retains richer registry context after database overrides.
- The original done-for-you services remain in the catalog.

## Production boundary

Merging this catalog does not itself make every product operational. Production completion still requires the appropriate database migration, provider configuration, entitlement checks, workflow implementation, security tests, and product-lifecycle approval for each entry.
