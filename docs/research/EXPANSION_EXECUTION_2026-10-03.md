# Expansion execution evidence

Baseline inspected: `8dd4050ad32f98488605ee4323d9d1a0efb0738f`.
Research checked 2026-10-03 UTC (2026-10-02 in New York).

## Source implementation versus delivery

| Area | Evidence inspected | Remaining acceptance requirement |
| --- | --- | --- |
| Creator Project Graph | Graph core, project store and routes; clip/caption editing, device drafts, WAV rendering and exports | Device/browser proof and production storage checks; this branch adds SRT import |
| Business storefront | Merchant store routes and deterministic server-side order pricing | Verify live payment, stock reservation, shipping, cancellation and reconciliation together |
| Creator marketplace | Rights/consent/licence readiness, owner listings and public catalogue | Module explicitly states checkout is not connected; payment-backed entitlements and private delivery remain required |
| Growth channels | Owner/public channels, posts, reports and Atom feed routes | This is not evidence of direct messages, video calls, live radio or live video delivery |
| Device permissions | Camera, microphone, contacts and location consent policy | Stored consent is not browser permission; prove each actual feature on supported devices |
| Free tools | `sonara-tool-access.cjs` and count verification | Retain exactly 4 tools per child and 3 parent tools; verify anonymous computed results in live deployment |
| Subscriptions | Subscription completeness verification | No quote/intake/sales gate strings found; this check does not prove provider costs or every entitlement lifecycle |

## Primary-source research and implementation implications

These are design decisions derived from documentation, not newly connected services.

| Source | Verified capability | SONARA implication |
| --- | --- | --- |
| [Shopify FulfillmentOrder](https://shopify.dev/docs/api/admin-graphql/latest/objects/FulfillmentOrder) | Fulfillment orders are automatically created; scopes affect visibility | Keep order, shipment and permission states separate; incomplete visibility must not mean no shipments |
| [eBay Fulfillment](https://developer.ebay.com/develop/api/sell/fulfillment_api) | Order completion and shipping fulfillment endpoints | Normalize shipments separately from orders and reconcile external identifiers |
| [Walmart Orders](https://developer.walmart.com/us-marketplace/docs/choose-an-orders-api) | Acknowledgement, shipping and corrective order actions | Use explicit transitions and idempotent provider writes; never infer delivery from payment |
| [Amazon developer onboarding](https://developer-docs.amazon.com/sp-api/docs/onboarding-overview) | APIs support selling operations and fulfillment | Account authorization remains required; subscription ownership does not grant access to seller accounts |
| [Pinterest creation](https://developer.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/) | Authenticated board/pin creation | Add publishing only through authorized provider adapters and explicit customer action |
| [MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | Secure context and supported GPU/browser required | Feature-detect hardware acceleration; retain CPU fallback and report actual support |

## Remaining requested research

Facebook, Instagram, X, LinkedIn, OfferUp, Myspace, Indeed, Zoom, Yahoo, IBM,
Intel and VistaPrint need individual official capability, account-access and
licensing verification before implementation. No API availability is inferred
from the company name. Existing research-only repositories must pass the existing
external-tool review before executable code is adopted. No bulk install occurred.

## Next integrated delivery slices

1. Marketplace commerce: inspect existing payment infrastructure; connect paid
   orders to verified payment events, immutable licence snapshots and short-lived
   private downloads; test duplicate events, cross-tenant access and revoked access.
2. Merchant fulfillment: durable shipment lines, stock reservations, receiving and
   reconciliation using existing inventory authority; avoid duplicate order tables.
3. Growth interaction: profile visibility, moderation and messaging authority before
   real-time transport; separate public broadcasts from private conversations.
4. Device execution: explicit user gestures, capture lifecycle cleanup, storage
   quota handling and GPU/CPU fallbacks verified on actual supported browsers.
5. Provider connections: authorize, sync, reconcile, disconnect and recover per
   provider; keep credentials server-side and preserve provider rate limits.

No production SQL was applied, no live sale was made and no deployment was
verified by this research or the subtitle implementation.
