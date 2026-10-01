# Company patterns to SONARA operational contracts

**Date:** 2026-09-30
**Status:** implemented as a deterministic planning and validation contract; no production workflow was activated.

## What changed

`lib/sonara-backend-operations-intelligence-2026.cjs` now exposes three product-specific lifecycle contracts and `evaluateProductWorkflowTransition()`. The validator is pure: it checks a proposed state transition against the product's allowed path, required evidence fields, and explicit approval evidence for sensitive targets. It does not persist data, call providers, send campaigns, publish creator work, move money, or authorize a user.

| Product | Operational lifecycle | Key gates |
|---|---|---|
| Business Builder | Captured → scoped → scheduled → in progress → fulfillment/payment → reconciled | Scope, schedule, operator assignment, fulfillment evidence, payment reconciliation |
| Creator Studio | Idea → working → review → rights cleared → approved → packaged → published | Project manifest, asset-rights records, owner approval, export validation, provider receipt |
| Growth Studio | Draft → audience validated → consent checked → previewed → approved → scheduled/dispatched → measured | Audience snapshot, consent evaluation, preview, owner approval, provider receipt, outcome record |

Each product retains its own workflow vocabulary and terminal states while sharing the same evidence-first validation approach. This is the backend counterpart to the separate product landing pages, brand kits, and distinct work surfaces mapped in `docs/market-intelligence/2026-09-30-company-reference-design-and-engineering.md` and `lib/sonara-frontend-visual-intelligence-2026.cjs`.

## Research interpretation

The company list spans many unrelated industries, so SONARA should not pretend that Marvel, game studios, automakers, delivery networks, social platforms, streaming services, retailers, and restaurants all share one internal architecture. Their public interfaces instead suggest a set of transferable operational questions:

- Commerce and restaurant ordering: is availability current, is the customer commitment explicit, and can retries avoid duplicate orders or charges?
- Creator and media products: are project source, rights, review, export, and publication separate traceable steps?
- Social and campaign distribution: is the audience and consent state known before an external send, and is the send result recorded?
- Mobility and field operations: can an operator see assignment, current state, exceptions, and next action quickly?
- Games, consoles, and connected screens: are input, status, accessibility, and recovery legible across devices?
- Platform design systems: are identity, account, permissions, billing, and error behavior consistent while products keep distinct task models?

These are design and engineering prompts, not claims about private company systems. The implementation uses original SONARA state names and does not copy brands, trade dress, proprietary assets, or undocumented architecture.

## Safety and integration boundary

The validator's `evidence` argument is input data, not proof of authorization. Production callers must obtain approval records from the authenticated approval store, verify actor and tenant scope, validate evidence provenance, and persist the resulting transition atomically with its audit/outbox record. Provider receipts are written only after an actual authorized provider response. No research reference creates a provider connection or grants execution authority.

This contract is a useful next building block, not a complete durable workflow engine. Database persistence, transaction/outbox integration, webhook inbox deduplication, retry policy, tenant RLS, route wiring, and operational telemetry still need to be connected and tested before a customer-facing action may rely on it.

## Research sources

- [Apple Human Interface Guidelines: design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/) — purpose, agency, legibility, accessibility, and feedback.
- [Shopify webhooks](https://shopify.dev/docs/apps/build/webhooks/subscribe/https) — authenticating and handling external commerce events.
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) — safe retry identity for mutating payment requests.
- [AWS Well-Architected operational excellence](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/operational-excellence.html) — observable operations, actionable signals, and continual improvement.
- SONARA's company-by-company source map and limits: `docs/market-intelligence/2026-09-30-company-reference-design-and-engineering.md`.
