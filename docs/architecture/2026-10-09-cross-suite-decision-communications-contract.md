# SONARA Industries — cross-suite decision, communications and industry-engine expansion
**Research and draft implementation date:** October 9, 2026. **Status:** decision-preview code; not connected to live routes, providers or production. Owner does not authorize any unsafe change merely by requesting research.

## Repository baseline and reconciliation
The code in this branch begins at `main` commit `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`. A separate draft PR #574 develops read-only restaurant staffing/labor/seating calculations and maps `business_assets` plus `business_bookings`. **Do not replace or merge its source into this branch speculatively.** `employee_schedules` is the existing roster with a product; `employee_shifts` is a duplicate identified by prior investigation. Reuse existing organizations, business memberships, communications preferences, notification lifecycle, booking and provider gateway tables; no new schema is added here.

`lib/sonara-operational-decision-policy.cjs` introduces a **pure versionable policy contract**. It does not call a connector, read secrets or modify any user record. `tests/operational-decision-policy.test.js` checks success, failure and adversarial paths. A server must derive `organizationId`, domain, permission, records, provenance and completeness from authenticated authority — never browser JSON — before calling it. Evidence booleans alone are **not** authorization.

## Two original implementation contracts

### Bounded alternative ranking
Inputs: tenant identity; limited domain; timestamped complete source revision; owner-configured hard limits and nonnegative weights that sum to 10,000 basis points; at most 64 unique source-verified alternatives. Each alternative carries cost in **cents**, duration in **minutes**, risk index in **basis points**, and an independently measured quality index in **basis points**.

Hard filter: `cost <= maxCost` and `duration <= maxDuration` and `riskIndex <= maxRisk` and `qualityIndex >= minQuality`. No false zero for missing data. If an input is malformed, the entire evaluation fails closed.

For each eligible candidate:
```
L(v, limit) = limit > 0 ? max(0, 10,000 - round(10,000*v/limit)) : (v === 0 ? 10,000 : 0)
score_bps = round( (w_cost*L(cost,maxCost)
                  + w_duration*L(duration,maxDuration)
                  + w_risk*L(risk,maxRisk)
                  + w_quality*qualityIndex) / 10,000 )
```
Highest score first; exact-key lexical tie break. **A score is not probability, profit forecast, legal clearance or formal safety assurance.** A risk basis-point index is a preference index unless independently validated as a probability. Alternatives failing limits are excluded with reasons; if none survive, return `no_feasible_option`, not a fabricated recommendation.

Protected domains (employment decisions, credit, housing, insurance, healthcare, legal outcomes and safety-critical individual eligibility) are refused at the policy boundary. DO NOT select a different nominal domain to bypass that protection. `mayExecute: false` and owner review are always required.

### Communication review eligibility
Inputs: trusted tenant-scoped source revision, a recipient's exact tenant-scope consent grants, requested channel/purpose, stable intent key, explicit recipient quiet-hours zone/window and cooldown evidence. Channels: email/SMS/push/in-app/voice; purposes: transactional/support/marketing/staff. Deny absent consent, conflicting revoked grants, suppression, unverified source, invalid time zone, cross-tenant grants, quiet hours, recent sends and future send timestamps. Same start/end quiet-minute means 24-hour quiet rather than unrestricted sends.

This is NOT an API to send. An actual sender still needs a durable recipient- and tenant-scoped suppression registry, policy-version/approval lookup, provider credential scope, consent history, unsubscribe handling, rate limit, dedupe key, retry budget, DLQ, delivery callbacks and reconciliation. A `review_required`/preview result does not establish delivery or authorization.

## Parent and three-company architecture

```
SONARA Industries (public legal brand and product portfolio)
   |
SONARA One (authoritative tenant identity + roles + policy + budgets)
   |-- Evidence-qualified decision preview [NEW; no writes]
   |-- Consent + quiet-hours communication preview [NEW; no sends]
   |-- Existing canonical records + audit + outbox + provider gateway
   |
   |-- Business Builder: restaurant/trade/retail/staffing task and cost decisions
   |-- Creator Studio: media option budgets, rights-cleared original projects
   |-- Growth Studio: consented outreach proposals + attribution windows
```

Reuse the same contract for multiple verticals, **not** the same threshold defaults. A restaurant's guest cover forecast and a media studio's bitrate/render budget are different measurements; each needs a source adapter, units and qualified evidence. No employee hiring/firing, insurance or creditworthiness rankings.

## Sector and company benchmark map

| Requested reference areas | Transferable platform patterns | Classification |
| --- | --- | --- |
| Google/Yahoo/Apple/Play Store/Editors' Choice | Search and discoverability, app quality telemetry, editorial datasets, ranking provenance | Research. No guarantee of placement, access to store editorial criteria, or unrestricted scraping. |
| Amazon/eBay/OfferUp/Meta Marketplace/Walmart/Best Buy/Kroger/Walgreens/Lowe's | Canonical catalog, inventory holds, seller verification, checkout, shipping, provider receipt, refunds and customer support | Authorized marketplace-specific adapters only; merchant checkout/fulfillment state must reconcile. |
| McDonald's/Chipotle/Wendy's/Subway/Toast/HotSchedules | Guest/seat capacity, prep flow, kiosk order, kitchen queue, staff shift costs, cancellations, waitlists, walk-ins, pickup and loyalty | Restaurant PR #574 supplies pure preview logic, not a working POS integration. |
| HVAC/electrical/gas/plumbing/carpentry/GE and trade firms | Job graph, line-item estimates, technician credential, materials BOM, routing, inspection, invoices, safety compliance | Qualified engineer/licensed-trade review, local code edition. |
| Temp agencies and internal HR | Employee/company profiles, credential expiry, handbook versions, shifts, interviews, applicant scheduling, document access | No automatic applicant suitability scores or hiring/firing decisions. |
| Coca-Cola/Pepsi/Nestlé/J&J, manufacturers and distributors | Lot/serial/expiry, supplier lead times, traceable BOM, quality exceptions, recalls and GS1-compatible external identifiers | Regulatory compliance and chain-of-custody are provider/domain-specific. |
| Sony/Universal Music/Apple Music/Spotify/YouTube Music, TuneIn and iHeartRadio | Recording projects, music metadata, audio mastering, publishing metadata, catalog rights, licensed playback | Streaming access does not confer broadcasting, sync or redistribution rights. |
| OBS/FL Studio/Ableton Live/Pro Tools/Twitch/Discord, YouTube Shorts/TikTok/Meta/X/Snapchat | Storyboards, animation frames, nonlinear media timeline, streaming encode, schedule, original assets, syndication approvals | Each adapter requires verified vendor terms, account scope, rights and consent. |
| ViacomCBS/NBC/public access/Pluto/Tubi/Sling | TV station schedules, EPG, rights windows, digital playback/ads, caption QC, rights-cleared distribution | No broadcaster carriage or retransmission asserted. |
| Unreal Engine/NVIDIA/Activision/Nintendo/Fortnite/GTA | Deterministic scene state, 2D/3D graph, asset provenance, shader/render budgets, replay and controller-friendly UI | No game/IP copies, unrestricted GPU compute or console certification. |
| Ford/Chevy/Honda/Toyota/Waymo/Tesla/Uber/Lyft/SpaceX/Starlink | Driver consent, dispatch, routing, offline job drafts, telematics adapters, network resiliency | No autonomous driving or OEM control; parked/driver-safe media category rules. |
| Duolingo/Tamagotchi/Puzzles | Task-based training, non-manipulative progress, signed QR invitation, learning feedback, accessible games | Human review for HR; user controls notifications and game mechanics. |
| Microsoft/IBM/Samsung/LG/Sony/Toshiba/Rockville/Beats/Skullcandy | Device testing, file/media formats, accessibility, audio export profiles, mobile/TV peripherals | No assumption that every manufacturer's proprietary protocol is open. |

Unclear brand names such as `Angel Music` need precise company/API identity before becoming an integration candidate.

## Formula, modeling and verification registry (roadmap)

Store each formula as versioned specification: `formulaId`, industry, dimensional units, known range, input origin, assumptions, boundary cases, trusted standard, jurisdiction, numerical algorithm version, independent reference test, result uncertainty and review gate. Never deliver a single untyped general-purpose "business mathematics" endpoint.

| Workstream | Candidate formula/model | Validation |
| --- | --- | --- |
| Entrepreneurship / pricing | contribution/unit = realized price - verified variable/unit; break-even = fixed cost / positive contribution/unit | Per-currency cents, source completeness, positive denominator, fixed/variable classification |
| Scheduling | demand by interval, paid minutes, max/min coverage, shift-rest and qualification constraints; consider bounded CP-SAT for complex cases | Infeasible returns no solution; prohibit unsafe/illegal rosters and automatic employment decisions |
| Restaurant inventory | recipe ingredient quantity × converted unit cost; prep buffer from observed covers, forecast error, spoilage and vendor lead time | Recipe units and waste evidence, actual food safety handling |
| Commerce | available-to-promise = owned on-hand - unfulfilled reservations - operator safety reserve | Atomic reservation and refund/settlement reconciliation |
| Distribution | reorder point = expected demand during lead time + safety stock; shipment cost = measured handling + carrier + packaging + returns reserve | Volatility, route constraints and actual carrier quotes |
| HVAC | building energy transfer relations and airflow capacity bounds | ACCA Manual J/S/D and climate/installation evidence; no unreviewed sizing |
| Electrical | power/energy with measured voltage/current, phase and power factor; ohmic loss I²R | NEC/NFPA adopted local edition, conductor protective devices and licensed electrician |
| Plumbing | volumetric continuity Q=A·v, pressure loss and fittings, fixture supply diversity | Material, fluid, unit conversion and adopted plumbing code |
| Carpentry | board-feet, cut-list bin packing, saw kerf and waste bounds | Structural design separately certified; optimize offcuts only from actual stock |
| Delivery | ETA distribution from route provider data, traffic timestamps and confidence intervals; fleet utilization | Do not equate haversine straight-line with road travel |
| Creator audio | PCM raw size = sample rate × bit depth × channels × seconds / 8; encoded bitrate and loudness QC | Codec/container profiles, VBR, overhead, perceived-quality measurements |
| Video/animation | frames = FPS × seconds; pixel-throughput and encode bitrate budgets; animation interpolation from keyframes | Rights/caption completeness, bounded GPU worker, low-motion fallback |
| Growth/marketing | experiment lift and revenue per eligible conversion, uncertainty/holdout; attribution ≠ causality | Consent, randomized experiments when practical, actual reconciled outcomes |
| Forecasting | rolling-origin backtesting, MASE/MAE, calibration/coverage and drift | Compare seasonal naive baseline, sample size, data freshness and error bars |
| Health education | BMI = kg / m² for adults only, with limitations | Personal medical decision support belongs to qualified clinical workflows; never employment screening |

## Work graph, event/communication and UI surfaces to implement next

1. Profile setup: authenticated identity -> organization -> optional industry pack -> tenant permission -> relevant landing screen; save only verified records.
2. Employee onboarding: owner creates one-use expiring invitation token, shares QR/deep link with nonce but no sensitive personnel data, user accepts and reviews handbook version, audit acknowledgment.
3. Reservations: sourced availability -> host preview -> atomically lock/recheck resource -> actual reservation -> customer-specific notification proposal -> reviewed send -> callback.
4. Marketing: owner-owned media/storyboard -> rights and permissions -> campaign draft -> channel-specific render -> human approval -> audited publish/receipt -> later measurement.
5. Creator broadcasting: captured licensed media -> project timeline -> encoder/transcoder -> stream/broadcast resource -> health telemetry -> rights-expiry and cancellation handling.
6. Staff scheduling: qualified availability + business coverage + wage/certification rules -> approved roster -> change audit -> employee notice; never silently replace the roster.
7. Trading/manufacturing: serial/lot/asset evidence -> production/quality workflow -> fulfillment/safety hold -> signed receipt and reconciliation.
8. UI: accessible dashboards, role-specific profiles, calendars, planners, graphs, maps, diagrams, storyboards, privacy screen mode, kiosk and mobile layouts. Screens show source as-of timestamps and loading/error/missing data without manufactured green status.

## Authoritative reference links checked in this research pass

- Google OR-Tools scheduling and CP-SAT: https://developers.google.com/optimization/scheduling/employee_scheduling
- CloudEvents core attributes and duplicate identity: https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md
- NIST AI RMF: https://airc.nist.gov/airmf-resources/airmf/5-sec-core/
- NIST SSDF 1.1 final, 1.2 draft: https://csrc.nist.gov/Projects/ssdf/publications
- YouTube Live Streaming: https://developers.google.com/youtube/v3/live/broadcasts-and-streams
- Apple MusicKit and user permission: https://developer.apple.com/documentation/musickit
- Android car quality and allowed categories: https://developer.android.com/docs/quality-guidelines/car-app-quality
- ACCA Manual J: https://www.acca.org/standards/technical-manuals/manual-j
- GS1 Digital Link: https://www.gs1.org/standards/gs1-digital-link

## Release and validation stop conditions

- Current PR is a draft, not customer-visible.
- Require Node 24/pnpm 12 install/lockfile, lint, TS contract verification, complete tests and build. Validate actual security, RLS, deployment, legal, cost and retention gates.
- An independent negative/poison-data test should become red if the tenant check, suppression, output boundary or hard resource limit is removed; do not trust a vacuous green test.
- Provider connectors need OAuth token scopes, provider-specific rate limits, lawful rights, owner approval, callback signature, webhooks and retry/dedupe records.
- No module may send a message, change hiring outcomes, spend funds, publish video or move money based solely on a decision preview.
- No merge, schema migration, production restart, live deployment or external provider credential activation is part of this PR.
