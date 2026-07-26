# SONARA Premium Conversion Experience — 2026

**Status:** Implemented through an idempotent final runtime transform  
**Public scope:** SONARA Industries homepage, shared public design system, mobile behavior, localized hero copy, lifecycle disclosure, proof policy, and conversion routes  
**Pricing change:** None  
**Logo replacement:** None; the approved Prism Wave family remains in use

## Objective

The public experience must make SONARA understandable in seconds without relying on artificial luxury language, fake social proof, or unsupported business claims.

The homepage now positions SONARA Industries as the connected parent company for:

- Business Builder — launch, sell, and operate;
- Creator Studio — brand, create, and release;
- Growth Studio — consent, measure, and grow.

The conversion objective is a free account, a public company-page visit, a pricing comparison, or an informed product-status review. No page should pressure a visitor into buying an incomplete workflow.

## Experience structure

1. Outcome-led hero
2. Visible availability boundary
3. Three-company selector
4. Customer outcome cards
5. Connected operating path
6. Honest lifecycle states
7. Pricing and proof policy
8. Boundary-focused FAQ
9. Final free-account CTA

## Public truth rules

- Do not use fake testimonials, fictional customer counts, invented awards, or fabricated proof.
- Do not promise guaranteed revenue, compliance, cybersecurity, attribution, or search placement.
- Do not use false scarcity, countdown pressure, or unsupported “premium value” price comparisons.
- Do not advertise paid execution until production entitlements are verified.
- Do not expose direct execution for `planned`, `validation_required`, or `setup_required` products.
- Keep payments, publishing, outreach, provider execution, destructive changes, and other sensitive actions approval-gated.

## Mobile contract

- The decorative hero scene is removed below 680px so the value proposition and actions remain above the fold.
- Primary interactive controls use at least a 48px mobile target.
- Homepage grids collapse to one column on narrow screens.
- Content remains protected against horizontal overflow and long-word breakage.
- Native FAQ disclosure controls and visible focus states remain intact.
- Reduced-motion preferences remain supported.

## Runtime integration

`scripts/apply-premium-conversion-experience.cjs` runs last in `apply:runtime` after product catalog and market-intelligence transforms. It:

- replaces the public Express homepage route;
- synchronizes English, Spanish, French, German, and Portuguese hero and section copy;
- appends the canonical conversion and mobile CSS contract;
- rebuilds the public JavaScript and CSS assets;
- bumps the public asset version to `sonara-ui-20260725-v7`.

`scripts/apply-premium-conversion-compatibility.cjs` preserves established public route and experience-mode contracts used elsewhere in the platform without reverting the new hero or lifecycle language.

## Acceptance criteria

- The hero says: “Launch your work. Run it professionally. Grow with evidence.”
- Anonymous visitors are routed to public company pages, not protected dashboards.
- Lifecycle and entitlement restrictions are visible before purchase or execution.
- Product status links lead to the service catalog and readiness views.
- The homepage contains no fake prestige pricing or unsupported social proof.
- Mobile hero decoration does not push the offer below the fold.
- Localized client copy matches the server-rendered English experience.
- Existing Business Builder, Creator Studio, Growth Studio, request, deliverable, trust, and pricing routes remain reachable.
- The full launch verification suite must pass before merge.

## Out of scope

This change does not claim that every internal workspace has been redesigned, that every catalog product is operational, or that production database migrations and paid-entitlement tests have passed. Those remain controlled production gates.
