# Cross-industry platform research and Business Builder restaurant capacity engineering
Date: 2026-10-09. Status: **draft code and design**, not deployed or activated.

## Reuse patterns across industry reference companies

| Reference sector and examples | Original SONARA capability | Rights / integration boundary |
| --- | --- | --- |
| Search and discovery: Google, Yahoo, Apple App Store, Google Play, Editors' Choice | Verified profiles, category search, popularity signals, discoverability and marketing performance | Editorial/chart rankings change and do not give rights to scrape content or promise placement. |
| Commerce: Amazon, eBay, Walmart, Best Buy, OfferUp, Facebook Marketplace, Lowe's, Kroger | Product catalog, inventory reservations, order lifecycles, shipment/pickup and refund evidence, fraud protection | Amazon SP-API, eBay Sell and Walmart Marketplace support documented, permissioned seller data. Other systems need separate provider review. |
| Music/audio: Apple Music, Spotify, YouTube Music, Sony Music, Universal Music, TuneIn, iHeartRadio, Rockville, Beats, Skullcandy | Creator rights provenance, audio asset/version management, lawful previews, device playback metadata | Metadata access is not a streaming, film-synchronization, radio, or redistribution licence; ambiguous labels such as Angel Music require verification. |
| Media and social: YouTube, TikTok, Meta, Facebook, Instagram, X, Snapchat, Myspace, Pluto TV, Tubi, Sling TV | Content drafts, consent, moderation, distribution status, captioning, rights-aware publishing and analytics | Posting requires API-scoped account grants; streaming services require content and platform distribution rights. |
| Hardware and mobility: Apple, Google, Samsung, LG, Sony, Toshiba, Microsoft, IBM, Starlink, Tesla, Ford, Chevy, Honda, Toyota, Waymo, Uber, Lyft | Reliable app/device state, permissioned geolocation, route/dispatch, low-latency communications, offline reconciliation | CarPlay/Android for Cars require supported safety-focused categories; OEM APIs, vehicle controls and autonomous fleets are not general open access. |
| Restaurant, consumer manufacturing and retail: Chipotle, McDonald's, Wendy's, Subway, Coca-Cola, Pepsi, Nestlé, Johnson & Johnson | Staffing, guest journey, queue throughput, safety checks, batch/lot traceability, inventory and POS reconciliation | Food safety, recalls and regulated manufacturing need specific operating proof and human oversight. |
| Learning/engagement: Duolingo, Tamagotchi | Guided onboarding, short contextual training, employee handbook acknowledgment, optional progress rewards | Avoid manipulative streaks; handbook updates need visible versioned employee acknowledgments. |
| Skilled trades and temp staffing: HVAC, electrical, gas, plumbing, carpentry, field service, staffing agencies | Quote -> schedule -> qualified assignment -> job evidence -> invoice -> payment; job postings, screening, interviews and onboarding | Keep credential/permit/safety gates, fair hiring, wage and overtime rules, and human review for termination. |
| Restaurant operations: Toast, Fourth/HotSchedules, 7shifts, OpenTable, Square | Reservations/RSVPs, walk-ins, cancellations, waitlist, floor layout, server cover rotation, forecast interval scheduling, POS and communications | Toast states no standalone reservation API; OpenTable offers partner-gated integrations; Square exposes order, booking and inventory APIs. |

## Architecture rule: one canonical business graph

Reuse authenticated SONARA One membership and the existing Business Builder bookings, customers, locations, resources, employee/time data, orders, and billing records. No second booking, employee, customer or payment ledger. Future ingestion must normalize each provider into canonical internal event shapes while recording provider ID, tenant, scope, source timestamp, fetched-through cursor, evidence and reconciliation status.

Read path:
```
authenticated user -> authorized tenant membership -> complete, bounded table/shift snapshot
-> deterministic capacity module -> evidence-labelled manager preview
```
Write path (NOT implemented in this PR):
```
owner/manager approval -> state version + idempotency check -> atomic resource/time recheck
-> authoritative DB booking/assignment -> audit + outbox
-> consented provider notification/synchronization -> verified receipt/reconciliation
```

## Implemented as new pure, read-only code

`lib/sonara-restaurant-capacity-science.cjs` defines three independent calculations:

- `planServiceCoverage`: required workers by interval = max(minimum workers, ceiling(expected covers * 60 / (duration minutes * covers per worker hour))). Available worker shortfall is unknown if not supplied, never assumed zero.
- `estimateShiftLabor`: labor in integer cents and basis points from wage rate, minutes, explicitly configured overtime multiplier and employer burden. No legal payroll/tip-credit assumptions. Empty/incomplete input fails closed; unknown cost inputs are not fabricated.
- `rankSeatingOptions`: checks party fit, available tables, tenant-supplied complete reservation snapshots, overlap, server active covers, and max assigned covers; ranks least empty seats and then lowest server load. It never books or updates a table.

All successful outputs explicitly say `previewOnly: true`. The `snapshotComplete` flag must be set by a server after all relevant data has been fetched and verified. An API error, truncated pagination or uncertain tenant authority must not set it. Unknown booking statuses do not free reservations; invalid relevant reservation time blocks the table. Booking confirmation requires a second atomic check.

Tests: `tests/restaurant-capacity-science.test.js`. Separate local assertions prove deterministic outputs, peak-workload shortfall, integer money results, missing burden/overtime behavior, conflicting reservation hold behavior and incomplete snapshot rejection. Local assertions alone **do not prove full GitHub CI**.

## Subsequent engineering steps

1. Verify full, final-head GitHub CI, branch protection, deployed commit and zero new RLS/secret regressions before any merge.
2. Build authorized, paginated snapshot adapters from the existing canonical Business Builder tables. Return `unavailable` when any table, employee, reservation or rate read is incomplete.
3. Connect an accessible host/manager page with floor plans, reservation arrival status, walk-in queue and shift coverage review. Display the exact assumptions and available alternatives, allow overrides with reasons.
4. Implement atomic hold/release transitions and no-show/cancellation semantics, including DST boundaries, races, duplicate submissions, audit and safe waitlist promotion.
5. Add worker roles/certifications, handbook acknowledgment, wage jurisdiction settings, meal/break and overtime review. Candidate interviews, firing and protected-class decisions remain human governed.
6. Integrate one approved sandbox POS/reservation provider via consented OAuth, server-only secrets, webhook signatures, replay protection, rate limits, provider mapping and visible disconnect. Expand provider coverage from measured demand, not brand count.
7. Generalize the shared interval-capacity and appointment model to trade dispatch, temp placement, events, fleet pickup/delivery and retail staffing.

## Required acceptance cases

- Two concurrent reservations for the same last available resource cannot both commit.
- Foreign-tenant resource ID, empty/partial source or provider timeout cannot yield a positive availability claim.
- Any duplicate event is idempotent; canceled and no-show events preserve audit history.
- Unknown/stale booking state is blocking, not free.
- No provider write, SMS/call or employment decision occurs without required authorization and consent.
- Overtime/tips, breaks, local labor law, hiring fairness and trade safety are externally verified for relevant jurisdictions.
- Pages are keyboard accessible and support timezone localization, large screens, small screens, loading and error states.

## Primary reference documents (retrieved October 9, 2026)

- Toast reservation integration: https://doc.toasttab.com/doc/cookbook/apiIntegrationChecklistReservation.html
- Toast Tables: https://support.toasttab.com/en/article/Getting-Started-Toast-Waitlist
- OpenTable API: https://docs.opentable.com/
- Square Orders: https://developer.squareup.com/reference/square/orders
- Fourth HotSchedules: https://lp.fourth.com/hotschedules
- 7shifts Labor Budget: https://kb.7shifts.com/hc/en-us/articles/4417514442771-Use-the-Labor-Budget-Tool-to-plan-labor-costs
- Amazon SP-API: https://sell.amazon.com/developers
- eBay Sell: https://developer.ebay.com/api-docs/sell/static/selling-ig-landing.html
- Walmart Marketplace: https://developer.walmart.com/global-marketplace/docs/inventory-api-overview
- Spotify developer policy: https://developer.spotify.com/policy
- TikTok posting: https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- Android for Cars: https://developer.android.com/training/cars
- Apple CarPlay: https://developer.apple.com/carplay/
- EEOC hiring standards: https://www.eeoc.gov/prohibited-employment-policiespractices
- DOL tipped workforce: https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa
- Apple iPhone free/paid charts: https://apps.apple.com/us/iphone/charts/36?chart=top-free and https://apps.apple.com/us/iphone/charts/36?chart=top-paid
