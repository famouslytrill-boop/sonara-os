# SONARA Recommended Product Catalog — 2026

**Version:** 2026-07-25  
**Total product suites:** 34  
**Pricing change:** None

This catalog converts the approved market research and product bets into one versioned portfolio for SONARA Industries, Business Builder, Creator Studio, and Growth Studio. It does not claim every product is complete. Each entry declares its lifecycle status, plan floor, dependencies, route, customer outcome, safety boundary, entitlement-verification state, and direct-execution state.

## Portfolio rules

- Keep the connected path from business launch, to creator operations, to measurable growth.
- Prefer complete governed workflows over large collections of disconnected features.
- Preserve the existing Free, Starter, Core, and Pro plan families. This catalog does not create or change Stripe prices.
- Treat a paid plan floor as packaging guidance until a real production entitlement test passes for that product.
- Keep provider-backed execution setup-gated and approval-gated.
- Do not present validation-required, planned, or setup-required products as production-complete.
- Preserve the existing done-for-you service catalog alongside the software product catalog.
- Keep direct execution fail-closed. A published catalog record is not automatically an executable product.

## Lifecycle meanings

| Status | Meaning |
|---|---|
| `active` | The core workflow is available, but paid execution still requires verified entitlement integration. |
| `beta` | A meaningful workflow exists, but production coverage, integration depth, or validation is incomplete. |
| `validation_required` | The market bet is approved for testing, but measurable customer commitment is required before full build. Direct execution is prohibited. |
| `planned` | The capability is approved directionally but must not execute or be sold as complete. |
| `setup_required` | The workflow depends on customer, provider, database, or production configuration. Direct execution is prohibited. |

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

- `lib/sonara-recommended-product-catalog.cjs` is the versioned code source for product definitions and default execution boundaries.
- `scripts/apply-recommended-product-catalog.cjs` integrates the catalog into the shared and company-specific catalog pages.
- `supabase/migrations/20260725180000_recommended_product_catalog.sql` extends `service_catalog_items` and upserts all 34 products idempotently.
- `supabase/migrations/20260725193000_product_catalog_production_boundary.sql` adds `entitlement_integration_verified` and `execution_enabled`, validates the 34-record and 10/8/8/8 company counts, and adds database constraints preventing restricted execution.
- `scripts/verify-production-product-catalog.mjs` compares the live database against all 34 versioned definitions and verifies the deployed catalog page, checkout readiness, and fail-closed entitlement source contract.
- The customer catalog merges database records with the code registry, so database state can override verified fields without losing the richer product definition.
- The original done-for-you services remain in the catalog.

## Production boundary

The initial catalog code is merged into `main`. Production is considered verified only when the controlled deployment workflow completes all of the following in order:

1. Dry-run all linked Supabase migrations.
2. Apply `20260725180000_recommended_product_catalog.sql` and `20260725193000_product_catalog_production_boundary.sql`.
3. Query production `service_catalog_items` with the server-only service-role credential.
4. Confirm exactly 34 software-product records.
5. Confirm the company distribution is 10 SONARA Industries, 8 Business Builder, 8 Creator Studio, and 8 Growth Studio.
6. Compare every service key, name, company, plan floor, lifecycle status, route, entitlement-verification flag, and execution flag with the versioned registry.
7. Reject deployment if any `planned`, `validation_required`, or `setup_required` product has execution enabled.
8. Reject deployment if any paid product can execute without `entitlement_integration_verified = true`.
9. Remove the temporary production environment file before sending source to Vercel.
10. Deploy the exact verified `main` commit.
11. Confirm the apex and `www` aliases report that exact commit.
12. Verify the production catalog page is database-backed, contains all 34 products, and visibly states lifecycle and entitlement restrictions.
13. Confirm Supabase, Stripe, the Stripe webhook, and the configured Starter, Core, Pro, and Business Builder setup checkout plans report ready.

## Paid-entitlement verification policy

The existing server authorization layer reads active `billing_entitlements` first and then active or trialing `billing_subscriptions`. Missing or unmapped billing state fails closed with an upgrade-required response.

That source contract and configured Stripe infrastructure can be verified automatically. A positive subscribed-user test cannot be honestly inferred from configuration alone. Therefore:

- every paid catalog product starts with `entitlement_integration_verified = false`;
- every paid catalog product starts with `execution_enabled = false`;
- catalog pages offer an access-verification request instead of a direct product link;
- a paid product may be marked verified only after a real production account with the intended plan is granted access and a lower-plan or unpaid account is denied;
- the verification result must be recorded before paid execution is advertised as available.

## Lifecycle restriction policy

Products marked `planned`, `validation_required`, or `setup_required` remain visible for transparent roadmap and validation discussions, but direct execution is blocked. They may become executable only after lifecycle evidence, stage approval, implementation, security testing, provider readiness, and any required entitlement verification are complete.
