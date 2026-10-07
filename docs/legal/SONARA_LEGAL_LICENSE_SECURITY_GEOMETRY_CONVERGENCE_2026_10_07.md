# SONARA legal, licensing, terms, review-board, security and geometry convergence

**Date:** 2026-10-07  
**Status:** engineering/research record for review; not published terms and not legal advice.

## Boundary

SONARA remains fee-only software by default: SONARA charges its own software fees;
customer rent, deposits, merchant sales, creator revenue, ad spend and other
third-party funds stay with customer-selected providers unless a future separately
reviewed model is approved.

Operating rule: deterministic systems calculate/validate; AI may draft; humans
approve; providers execute within their own authority; SONARA records evidence.

## Added controls

### Terms / Conditions / policy evidence
`lib/sonara-terms-and-policy-governance.cjs` adds exact version/hash binding,
affirmative acceptance, actor/tenant authority, display-before-accept timing,
durable copies, receipts, optional E-SIGN consumer-record evidence, subscription
price/interval/recurrence/trial/cancellation evidence, and exact review-board
snapshot binding for policy publication. It never signs or publishes a contract.

The module also blocks treating the FTC's vacated 2024 click-to-cancel amendments
as current federal authority; current law must come from a versioned jurisdiction
registry.

### Licensing / provenance
`lib/sonara-license-compliance.cjs` separates owned, commercial, open-source,
public-domain, customer-supplied and provider-terms rights bases. Open-source
intake records SPDX evidence plus commercial-use, modification, redistribution,
attribution, notice, reciprocal/source-disclosure and patent-term review. Release
evidence requires component inventory, SBOM, notices and reciprocal-boundary review.
AI assets keep input rights, provider/model terms, likeness consent, customer
publication approval and human-authorship evidence separate.

### Security formulas / geometry
`lib/sonara-security-geometry-formulas.cjs` adds:

`coverage_bps = floor(10000 * sum(verified_current_weight) / sum(total_weight))`

This is evidence coverage, not a probability or compliance certification.

Shoelace polygon area:
`double_area = abs(sum(x_i*y_(i+1) - y_i*x_(i+1)))`

Rectangle overlap:
`overlap_bps = floor(10000 * intersection_area / min(area_A, area_B))`

Radius without square root:
`inside = (dx^2 + dy^2) <= radius^2`

Coordinates are bounded integers and products use BigInt. Geometry can support
layouts, service/delivery zones, camera/privacy zones, inventory placement and
venue planning, but it never grants authentication, physical access, payment
authority or a legal property-boundary conclusion.

## Review-board model

The existing customer approval board remains the evidence primitive. Legal/policy
release must bind the board decision to the exact snapshot hash. Keep product/
security review, owner approval, and professional legal review distinct; none
substitutes for another. Solo-owner delayed step-up remains a disclosed fallback,
not fake independent review.

## Research anchors current to 2026-10-07

- FTC Consumer Reviews and Testimonials Rule: effective Oct. 21, 2024; fake
  reviews, sentiment-conditioned review buying, undisclosed insider reviews,
  falsely independent review sites and certain suppression are restricted.
  https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- E-SIGN Act, 15 U.S.C. 7001: electronic records/signatures and consumer
  electronic-record consent/disclosure rules.
  https://www.law.cornell.edu/uscode/text/15/7001
- Ohio UETA, ORC Chapter 1306.
  https://codes.ohio.gov/ohio-revised-code/chapter-1306
- FTC negative-option posture: the Eighth Circuit vacated the 2024 amended rule
  July 8, 2025; the FTC returned to rulemaking in 2026.
  https://ecf.ca8.uscourts.gov/opndir/25/07/243137P.pdf
  https://www.ftc.gov/legal-library/browse/rules/negative-option-rule
- DMCA 17 U.S.C. 512: safe-harbor workflows can require designated-agent,
  repeat-infringer, notice/takedown and technical-measure controls.
  https://copyright.gov/512/index.html
  https://copyright.gov/dmca-directory/
- U.S. Copyright Office AI Part 2: AI-assisted works can contain protectable human
  authorship; prompting alone is not treated as sufficient human authorship.
  https://copyright.gov/policy/artificial-intelligence/
- SPDX 3.0 is current; SPDX identifiers provide machine-readable license evidence.
  https://spdx.dev/use/specifications/
  https://spdx.dev/learn/handling-license-info/
- NIST CSF 2.0 is current. NIST SSDF 1.1 remains final; SSDF 1.2 is draft.
  https://www.nist.gov/cyberframework
  https://csrc.nist.gov/projects/ssdf/publications

## Deliberately not activated

No public Terms/Privacy publication, attorney-approval claim, DMCA-agent
registration, agreement signature, subscription charge/cancel, license grant,
automatic takedown/legal notice, database migration, production environment
change, or geometry-based authorization is performed by this wave.

Exact-head Node 24 tests, lint/static/security gates, tenant authorization,
owner approval and required professional legal review remain release conditions.
