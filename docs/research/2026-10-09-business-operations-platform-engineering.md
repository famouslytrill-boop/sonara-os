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


## Second engineering increment (same draft PR; 2026-10-09)

A new pure adapter, `lib/sonara-restaurant-seating-record-adapter.cjs`, maps existing `business_assets` and `business_bookings` source rows into the independent seating algorithm. It requires:
- Server-attested `tenantAuthorized`, `queryOrganizationId`, complete reads of resources, bookings and server load, explicit `truncated: false`, and a source timestamp no more than two minutes old relative to an explicit request timestamp.
- Every source row carrying the same `organization_id`, bounded record counts, known unique resource IDs and validated table capacities.
- An *explicit* `metadata.seating_server_id` in the asset metadata, and a trusted server-cover snapshot. Existing staff schedules alone **do not** prove cover load; no source reader currently constructs this evidence automatically.
- Active reservations referencing valid resources by `metadata.resource_ids`. Incomplete/legacy resource references refuse an availability estimate. Multi-resource holds block each table. Canceled/no-show/archived rows free their resources. Waitlist requests not yet booked are not holds.
- Unknown status, malformed time, duplicate/missing resource mapping, unverifiable server load, stale evidence, mixed tenants, and incomplete reads fail closed.
- `canBookWithoutRecheck: false` for every successful preview. The write path must independently recheck in a transaction under tenant membership, role policy, concurrency lock/hold semantics and idempotency.

The seating engine was also tightened to validate **all** booking statuses before considering table choices, reject an impossible active-cover count, and reject malformed table configurations. The suite now includes `tests/restaurant-seating-record-adapter.test.js`, alongside the original `tests/restaurant-capacity-science.test.js`. This is **data contract groundwork**, not a live host page, employee assignment tool or approved reservation API.

## Original feature architecture for all requested sectors

| Industry or media reference | Shared records and engine plan | Status / constraints |
| --- | --- | --- |
| Google, Yahoo, Apple/Android charts, Editor's Choice | Search-indexing evidence, intent mapping, content scores, change logs, analytics cohorts, versioned rankings | Research; rankings are not placement guarantees. Avoid unauthorized crawling. |
| Amazon, eBay, OfferUp, Facebook Marketplace, Walmart, Best Buy, Kroger, Walgreens, Lowe's | Catalog > inventory allocation > order > payment evidence > pick/pack > ship/delivery > settlement > returns and refunds | Existing commerce work requires provider-specific authorization, receipt and inventory race tests. |
| Coca-Cola, Pepsi, Nestle, Johnson & Johnson, GE, electric utilities, manufacturing and distributors | Multi-level BOM, batch/lot traceability, units conversion, supplier lead time, recall scope, quality inspection and production order | Operational planning; no certification of regulated manufacturing, electric-grid or safety-critical machine control. |
| Toast, HotSchedules, restaurant chains, catering, venues and temp staffing | Reservation/arrival/waitlist, floor-resource topology, staff covers, shift eligibility, wage estimates, POS order and kitchen state | This PR implements verified-preview math only; no live seating or payroll mutation. |
| HVAC, plumbing, electrical, gas and carpentry | Job estimate, permit/credential check, BOM, unit-sensitive formulas, dispatch, attendance, job cost and inspection proof | Licensed-professional final signoff for design and safety calculations. Local code edition/jurisdiction must be selected. |
| Spotify, YouTube Music, Apple Music, TuneIn, iHeartRadio, labels, Universal Studios, Sony Music, radio/TV | Original media asset graph, timecode, storyboard, scene, audio track, captions, rights, territory/window and release package | Platform API data or personal playback rights do NOT authorize radio retransmission, film sync, sampling, reselling, or broadcast. |
| OBS, FL Studio, Ableton Live, Pro Tools, Twitch, Discord, TikTok, Shorts, Facebook, Instagram, Snapchat | User-owned project graph, authored timeline, nondestructive edits, production presets, livestream health and consented publishing gateway | Desktop control requires locally approved adapter; no secret exposure or public streaming default. API scopes/audit required. |
| Nvidia, Unreal Engine, Fortnite, Nintendo, Rockstar/GTA, Activision, Sony, LG/Samsung TVs | 2D/3D asset graph, animation keyframes, frame rate/bitrate budget, rendering queues, bounded GPU jobs, controller-aware interface | Reference and original implementation only; no copying protected game assets or implying console store approval. |
| Android Auto, Apple CarPlay, Tesla/Ford/Chevrolet/Honda/Toyota, Uber/Lyft/Waymo, Starlink | Safe-mode voice/navigation/audio when eligible; consented route/dispatch, telematics gateway, offline sync and fleet work evidence | Not an OEM vehicle-control or autonomous driving system; driver distraction policy enforced. |
| Duolingo, Tamagotchi, interactive diagrams, boards, QR, kiosks, signage | Task-based onboarding, accessible learning checks, role-based SOP and handbook acknowledgement, opt-in progress, printable/signed QR invitation tokens | Employee invitations require expiring single-use server-redeemed codes; avoid sensitive data in QR payloads. |
| Public access television, Viacom/CBS/NBC, Pluto, Tubi and Sling | Station/channel schedule, EPG, production asset catalog, ingest/encode/transcode, HLS/DASH playback, rights clearing and moderation | Content/license rights, transmission/royalty obligations and delivery contracts required; do not claim carriage. |
| General business administration | Tenant-scoped company/employee/customer profiles, document templates, interview scheduling, candidate status, approval queues, audit/retention, billing | Human approval for hiring/firing decisions and privacy-protecting evidence retention. |

### Formula modeling strategy

Do not add a single mega-calculator. Each independently versioned formula contract has `industry`, `formulaId`, `expression/specification`, `inputSchema`, physical or currency `units`, `jurisdiction`, `referenceSource`, `applicabilityConditions`, `sampleSize`, `assumptions`, `uncertainty`, `safetyClassification`, and `humanApprovalRequired`.

- Finance/management: labor cost ratio, contribution after verified variable costs, break-even units = fixed costs / positive contribution per unit, inventory available-to-promise = verified on-hand minus allocated and safety stock, cash conversion cycle = DIO + DSO - DPO only with measured inputs.
- Restaurant: interval staffing demand (implemented), estimated labor burden (implemented), table-seat fit and overlaps (implemented), party wait = evidenced queue and service-rate model with confidence, plate cost = actual ingredient quantities × unit purchase cost, forecast by location/daypart with out-of-time error.
- Delivery: cost/route = paid labor minutes × wage rate + vehicle variable expenses + verifiable tolls, fleet utilization = confirmed occupied driver minutes / qualified available driver minutes; GPS consent and road-network routing external.
- HVAC: sensible-load planning may cite heat transfer and airflow relations, but compliant residential equipment sizing uses ACCA Manual J, S and D. Never label simplified rules of thumb as certified loads.
- Electrical: apparent/real power relationships depend on AC/DC, phase, voltage, power factor and units. Protection/conductor sizing is code-dependent and must not be inferred from power alone.
- Plumbing: continuity Q = area × velocity with explicit SI/US customary unit conversions; pipe loss models need fittings, roughness, regime and elevation, plus licensed engineering verification.
- Carpentry: dimensional takeoffs, board-feet and cut optimization with kerf, grain constraints, rounding and waste; structural load bearing design needs certified input.
- Audio/video: estimated streaming bitrate × duration / 8 for raw transport bytes, corrected for protocol overhead, multiple representations, retransmissions and storage replicas. Capture frame rate, audio sample rate, loudness targets and measurable latency.
- Interactive games and diagrams: deterministic tick duration = 1 / updates-per-second; animated timelines use keyed monotonic timestamps and replayable scene state. Real multiplayer prediction/reconciliation requires latency measurements, authoritative server and cheating protections.
- Optional BMI education: BMI = kg / m² for adults; never use it for employment screening, individual diagnosis or decisions about children, and do not expose personal health inputs across tenants.

### Provider evidence — researched, not activated

- OpenTable approved partners use OAuth/HTTPS; publication and sandbox access depend on explicit approval: https://docs.opentable.com/
- Square Bookings `POST /v2/bookings` requires booking IDs/segments, scopes and idempotency; seller-level features have subscription limitations: https://developer.squareup.com/reference/square/bookings/create-booking
- OBS WebSocket 5.x exposes a local RPC protocol; OBS recommends password protection; do not expose local control to internet or tenants: https://github.com/obsproject/obs-websocket
- YouTube video uploads require OAuth scope and quota, and returned acceptance is not proof of finished processing: https://developers.google.com/youtube/v3/docs/videos/insert
- TikTok Content Posting API requires creator info, consent and client audit; unaudited direct-post clients have visibility restrictions: https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- Apple MusicKit supports user-permissioned catalog/library/playback pathways; developer and music-user tokens have separate scope: https://developer.apple.com/documentation/AppleMusicAPI
- Spotify commercial streaming/synchronization/broadcasting restrictions: https://developer.spotify.com/policy
- Android Automotive/Auto have category and driver-distraction quality requirements: https://developer.android.com/docs/quality-guidelines/car-app-quality
- Unreal Engine licensing varies by revenue and how engine code is distributed: https://www.unrealengine.com/license
- ACCA Manual J and 2025 ASHRAE Handbook Fundamentals define engineering load-calculation references: https://www.acca.org/standards/technical-manuals/manual-j and https://www.ashrae.org/technical-resources/publications-library/ashrae-handbook/description-2025-ashrae-handbook-fundamentals
- 2026 NFPA 70 exists but use requires local adopted edition and qualified design review: https://www.nfpa.org/codes-and-standards/nfpa-70-development/70

### Exact next delivery and stop conditions

1. Final-head CI and source audit: no merge until Node 24/pnpm full suite, security, schema and browser checks are green. Queued tests are not passed tests.
2. Implement manager-only, organization-scoped complete readers with schema-accurate projections; add verified server assignment/cover source (not supplied by this PR). Never accept caller-selected `organization_id` as authority.
3. Add accessible host preview screen with data freshness/uncertainty, floor diagram, seat rotation, waitlist and cancellation states; preview does not book.
4. Independent atomic writes with SERIALIZABLE/locking or compatible exclusion/hold strategy, fresh capacity check, stable idempotency key, tenant policy, audit and outbox. Test 2 simultaneous customers for 1 table, time-zone DST edges and stale reads.
5. Only after the restaurant path works, extract reusable scheduling/profile/costing engine for temp agencies/trades and opt-in QR onboarding, then media storyboards/broadcasting behind rights and provider approval.

**Unknowns:** actual server-cover source, completeness of legacy reservation metadata, all venue-specific role permissions, adapter credentials, future processing expenses and production release eligibility. No source here proves any paid provider connection or public broadcast rights.
