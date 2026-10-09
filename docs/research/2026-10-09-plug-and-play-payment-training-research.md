# SONARA Industries — Payment Choice, Plug-and-Play Operations and Safe Simulation R&D
**Reviewed October 9, 2026. Status:** research + unconnected read-only source on an isolated branch, not deployed.

## Decision and repository reconciliation

Build integration-safe merchant payment option reviews and original deterministic training exercises, not duplicate checkout/employee/game-account systems. Start with the authoritative main baseline `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`. The following already exist and must remain canonical:

- `lib/sonara-integration-activation-policy.cjs`: reviewed vendor terms, rate limits, operator approval, tenant scope, server-only secrets and verified provider connection.
- `lib/sonara-money-pathway-guards.cjs`: allowed money-flow types, tenant/account routing, pricing, processor reconciliation; no customer-to-customer transfers or stored-value wallets without legal/operator framework.
- Business Builder customer/order/booking, warehouse and employee records; Creator Studio media project/rights graph; Growth Studio consented campaigns. Avoid new copies of customer, employee, order, booking or money ledgers.
- Draft PR #574 implements restaurant seating/staffing previews. Draft PR #576 implements scoped operational ranking and communication review. **This PR does not import either draft's new code or represent it as merged.**

## Implemented code and explicit limits

### `lib/sonara-checkout-method-review.cjs`

- `assessCheckoutMethod` is read-only. Three known adapter options: `paypal_checkout`, `paypal_venmo`, and `square_cash_app_pay`, for one-time business invoice or merchant storefront **web** payments. All other flows fail closed. These are **candidate integration profiles**, not online payment buttons.
- Venmo and Cash App Pay candidates require US merchant + US buyer + USD. In this bounded design `paypal_checkout` additionally requires a provider-backed, per-transaction eligibility proof rather than asserting any global country/currency entitlement. Country/currency coverage is not inferred for unknown processors.
- Strict complete UUID tenant IDs, matching independently authenticated tenant, exact amount and currency from a source-verified price revision, current method eligibility (max two-minute data age), and verified merchant account binding are required for a positive review-candidate status.
- The existing `evaluateIntegrationActivation` remains mandatory for commercial terms, reviewed license/terms, rate limits, owner control, secure credentials and provider-specific grants. No new permissions or secrets are introduced.
- **Every** output sets `checkoutEnabled: false`, `mayCreatePayment: false`, `mayCapture: false`, `mayRefund: false`, `mayPayout: false`, `mayFulfillOrder: false` and `executionAuthorized: false`. Even a good outcome means only `sandbox_integration_review_candidate`; the production payment path has not been added.
- `describePaymentEvent` is an informational mapping for a *previously authenticated, deduplicated, merchant-bound* processor event; PayPal approval/pending/denied/reversal events cannot authorize fulfillment, and a completed capture still needs separate order reconciliation. It never proves bank settlement or signature itself. Unknown providers/events fail closed.

**Crucial trust boundary:** the pure functions cannot prove that a caller's `serverVerified` flags came from an authenticated server. Never expose the functions as a web endpoint taking raw browser-submitted proof; build the server-only source adapter first. Per-method SDK eligibility and real provider webhook verification occur in the authorized payment subsystem, not this code.

**Provider references (retrieved 2026-10-09):**
- PayPal JavaScript SDK v6 (Aug 6, 2026): https://developer.paypal.com/sdk/js/set-up
- PayPal method-specific eligibility: https://developer.paypal.com/sdk/js/reference/
- Venmo US/USD/method restrictions: https://developer.paypal.com/v5/venmo/overview
- PayPal Orders/capture webhooks: https://developer.paypal.com/payment-methods/webhooks/
- Square Cash App Pay merchant + buyer US and SDK limitations: https://developer.squareup.com/docs/payments-api/take-payments/cash-app-payments
- Square Cash App Web Payments SDK: https://developer.squareup.com/docs/web-payments/add-cash-app-pay
- Cash App partner API approval: https://developers.cash.app/cash-app-pay-partner-api/guides/partnerships/partner-with-cash-app-pay

### `lib/sonara-training-simulation.cjs`

A four-industry **fictional resource allocation exercise** for restaurant service, trades dispatch, retail fulfillment and creator rendering. Turns are `replenish`, `fulfill` or `pass`; quantities and resource point costs use immutable SONARA-owned scenario constants. This is a learning mechanic, not actual POS sales, employee management, media renders, stock moves or money transfers.

- `remainingPoints = priorPoints - units * scenarioCostPerAction`
- `remainingStock = priorStock + replenishedUnits - fulfilledUnits`
- `trainingScore = fulfilledUnits * scenarioScorePerUnit`

Finite turn counts and positive action quantities, no overdraw, no real currency, no random wagering outcome, no deposits, no real-world prizes, no redemption and no banking integrations. Invalid later turns invalidate the entire run rather than quietly hiding a failed action. Replay is deterministic and independent of tenant data.

**Game and platform boundaries:** Strategy board games, educational card games, puzzles, scenario simulation, animation and interactive training can use the same versioned scene/turn/result structure in future. Real-money casinos, gambling payout rails, cashable chips, gambling-linked ads and payment-to-prize mechanisms are **not implemented**. Any actual simulated casino-style content must undergo separate app-store, age-rating and legal review; no assumption of Play/App Store approval. Sources:
- Google Play real-money gambling and contest restrictions: https://support.google.com/googleplay/android-developer/answer/9877032
- Apple App Review content/IP/regulatory permissions: https://developer.apple.com/app-store/review/

## Cross-industry plug-and-play target design

```
 SONARA INDUSTRIES (brand, compliance, finance oversight)
   SONARA ONE (server-derived tenant membership, billing, entitlements)
     Core operating graph: customer | employee | asset | order | booking | event
     Existing money-pathway and integration activation policies
       -> PAYMENT METHOD REVIEW [NEW pure function / NOT PAYMENT SDK]
       -> TRAINING SIMULATION [NEW pure function / NO REAL MONEY]
       -> evidence / idempotency / audit / callbacks (separate actual services)
     Business Builder:
       restaurant table/waitlist | trades job/parts | staffing shifts | merchant POS
     Creator Studio:
       original storyboard/animation | music/audio project | licensed video stream
     Growth Studio:
       approved campaigns | opt-in communications | creator social distribution
```

Business-specific modules are **typed configurations of canonical workflows**; a preview never activates an external provider or changes tenant records. At product UI level: choose industry -> connect approved services -> verify tenant provider account -> test sandbox -> see error/success/partial states -> operator approves sensitive action -> reconcile provider receipt. Disable non-functional buttons and show accurate `connection required` or `planning only` state.

## Formula and decision contracts

| Vertical | Candidate algorithm / formula | Grounding and required proof |
| --- | --- | --- |
| Restaurant | guest table fit, anticipated covers by daypart, labor budget = payroll minutes × actual rate/burden, meal plate cost = converted ingredient quantity × unit supplier cost | Vendor invoices, ingredient units, schedule coverage, source freshness, timezone-safe booking holds |
| Trades | job direct cost = loaded labor + material cost + subcontract + equipment usage; estimate variance = final invoiced cost − accepted estimate | Work order state and paid supplier costs; licensed professional reviews for safety |
| HVAC | preliminary sensible heat transfer and air volume relationships (not equipment sizing) | ACCA Manual J/S/D, installed climate, equipment and local safety review |
| Electrical | real power for single-phase AC P = V × I × power factor; loss over resistive conductor segment = I²R | Verify AC/DC phase, wiring/insulation, adopted NEC and electrician signoff |
| Plumbing | volumetric flow Q = area × mean velocity, with units and hydraulic losses | Adopted plumbing code and system-specific engineering |
| Carpentry | material takeoff, board-foot and cutting stock/kerf optimization | Measured inputs and non-structural vs structural job distinction |
| Retail | reorder point = demand during replenishment lead time + safety stock; available-to-promise = verified stock − committed orders − protected buffer | Atomic holds and physical inventory reconciliation |
| Manufacturing | batch genealogy, production capacity=min(material, qualified labor, machine-hour capacity); cycle time/defect inspection | Lot and work-order evidence, safety holds and calibration history |
| Delivery | verified route time + loading + service interval; cost = compensated labor + vehicle variable expense + tolls | Routing provider with timestamp/road metric; not straight-line distances |
| Media/audio/video | uncompressed audio bytes = sample rate × bit depth × channels × seconds / 8; frames = FPS × seconds; timecode-aligned licensed exports | User-owned/cleared assets, encoder profiles, bandwidth and storage budget |
| Finance/entrepreneurship | break-even units = positive fixed-cost / contribution-per-unit; working capital = current assets − current liabilities | Currency consistency, reconciled accounts and complete liabilities |
| Education/game | fictional inventory/point conservation and reproducible turn outcomes | No cash valuation, wagering, behavioral manipulation or eligibility decision |

A versioned formula registry should record units, domain, version, accepted range, source, reference test, uncertainty, applicability, jurisdiction and authorizing role. Avoid claiming engineering or medical certification from simplified calculations. BMI may be used only as optional educational arithmetic for adults, not medical diagnosis, youth assessment or hiring eligibility.

## External technology ecosystem reference categories

| Requested ecosystem examples | SONARA capability family | Status |
| --- | --- | --- |
| Amazon/eBay/OfferUp/Facebook Marketplace/Walmart/Best Buy/Kroger/Walgreens/Lowe's | Marketplace catalog, seller profile, inventory reservation, fulfillment, charge reconciliation | Provider-specific permission/adapter research; no broad integrations activated |
| Google/Yahoo/Microsoft/IBM/Apple/Samsung/LG/Sony/Toshiba | Indexing, cloud/devices, analytics, app eligibility, accessibility and UI | Pattern and SDK research only; do not impersonate app-store editorial selection |
| Toast/HotSchedules/Chipotle/McDonald's/Wendy's/Subway | Restaurant labor, online orders, POS, reservations, table rotation, kiosk | Existing booking state and separate PR #574; no new restaurant provider enabled |
| Sony Music/Universal Music/Spotify/Apple Music/YouTube Music/TuneIn/iHeartRadio | Licensed music rights, metadata, live radio and editing | Provider/rights review; no commercial radio retransmission |
| FL Studio/Ableton/Pro Tools/OBS/Twitch/Discord/TikTok/YouTube Shorts/Meta/X/Snapchat | Timecode, storyboard, scenes, broadcast scheduling, publisher adapters | Licensed content, consent, origin security, approval and provenance required |
| Pluto TV/Tubi/Sling/NBC/CBS/public access | Broadcaster schedule, captions, ingest, live event health, territory rights | Broadcast permissions and carriage agreements not established |
| Nvidia/Unreal/Nintendo/Activision/Fortnite/GTA | Frame/time models, 2D/3D scenes, deterministic simulation and accessibility | Original assets and bounded graphics compute only; no protected asset copying |
| Android Auto/CarPlay/Ford/Chevy/Honda/Toyota/Tesla/Uber/Lyft/Waymo/Starlink | Driving-safe category UIs, delivery dispatch, mobile offline state, permitted telemetry | No vehicle control or unsupported in-car commerce |
| GE/Coca-Cola/Pepsi/Nestle/J&J/manufacturers and trades | Supplier/lot traceability, QR, calibration, work orders and compliance review | No regulated automation claims |
| Duolingo/Tamagotchi/board/card/strategy games | Accessible onboarding, small training exercises, optional points/progress | Fictional simulator only; cashable gambling excluded |

Ambiguous labels (e.g., 'Angel Music') remain unresolved until identity/license and a specific integration path are verified. App Store and Play Store rankings change; do not hardcode a chart position as product success evidence.

## Next engineering process (order and acceptance)

1. **P0** protect main with required checks and verified merge workflow. Current main is not reported protected; neither PR #574 nor #576 is merged.
2. **P0** run exact-head Node 24 + pnpm 12 installation, audit, typecheck, lint, full test/build, tenant security and production schema gates. Local JavaScript test results do NOT substitute for CI.
3. **P0** reconcile existing Stripe billing, provider accounts, payouts, rights, tenant-scoped order status and webhook signatures before any parallel processor integration.
4. **P1** implement a server-only provider eligibility adapter and explicit sandbox UX for a **single** approved option. Never turn on Venmo/Cash App merely because the preflight returns candidate.
5. **P1** implement actual payment event reconciliation to authoritative order and fulfillment state with signature, idempotency, currency and provider-account checks; test pending/reversed/duplicate events.
6. **P1** implement an accessible local-only simulation UI: task instruction, moves, reset, turn review and empty/error states with no collecting PII or payment keys.
7. **P2** connect industry configuration/screens to canonical Business Builder workspaces. Add verified formula-specific QA and opted-in education, then Creator and Growth integration where useful.
8. **P2** qualify Android/iOS/TV/desktop with real-device/performance/accessibility tests; provider licenses, rights, approved games/content and regional legal review before broader shipping.

Never merge or deploy a draft merely because the number of modules or internal tests increased. This PR should remain review-only, with the live website untouched.
