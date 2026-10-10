# Research-to-product: global benchmarks, scientific methods and ranked-list integrity
**Research date: 2026-10-09 | Evidence: publisher pages + SONARA source inspection | Not a deployment or provider certification**

## What this work actually does

This change adds a **read-only CommonJS research gate** at \`lib/sonara-research-benchmark-gates.cjs\`, with negative tests. It does not add a new database, external API consumer, live web crawler, paid financial advice, executive directory, autonomous operation, UI route, marketing publication, or production activation. \`source_transcription_needs_audit\` deliberately remains unverified even if all 50 entries appear; neither user-supplied ranks nor URL strings independently verify publisher content.

## Primary ranking authorities and incompatible metrics

| Requested population | Authority | Metric / timing | Important limit |
|---|---|---|---|
| Top 50 US companies | https://fortune.com/ranking/fortune500/ | 2026 Fortune 500, revenue | Not largest by market capitalization |
| Top 50 European companies | https://fortune.com/europe/ranking/fortune500-europe/ | 2026 European ranking, revenue | Europe geographic definition follows publisher |
| Top 50 world companies | https://fortune.com/ranking/global500/ | 2026 Global 500, revenue | Fiscal years differ; not brand quality |
| Top 50 richest people | https://www.forbes.com/real-time-billionaires/ | Forbes continuously estimated net worth | Intraday estimates change; two-day freshness gate |
| US small business classification | https://www.sba.gov/counseling/get-started/ | SBA NAICS size/receipts standards | No universal objective “top 50 small businesses” |
| Technology readiness | https://www.nasa.gov/directorates/somd/space-communications-navigation-program/technology-readiness-levels/ | NASA TRL 1–9 | Technical maturity is not market adoption |
| Model governance | https://airc.nist.gov/airmf-resources/airmf/5-sec-core/ | NIST Govern / Map / Measure / Manage | Voluntary risk guidance, not certification |

**Do not build a fabricated combined "top 50"** from unrelated finance, rankings, subjective art, social influence, or social media engagement. Artist, author, restaurant, entrepreneurship and company rankings require separately documented methodology, date, scope and primary data; some cannot be defensibly ordered without the user's chosen criterion. No dataset of 50 entries in these categories is asserted by this change.

## Industry intelligence coverage queue

- **Science, mathematics, engineering, inventors:** Newton, Einstein, Maxwell, Emmy Noether, Gauss, Euler, Fourier, Shannon, Turing, Dijkstra. Extract reproducible methods, models, and experiment discipline; do not claim these individuals endorse SONARA.
- **Entrepreneurs, CEOs/CFOs, wealth, investment firms, philanthropy:** Amazon, Berkshire Hathaway, BlackRock, Vanguard, Fidelity, JPMorgan Chase, Goldman Sachs, Rockefeller Foundation. Benchmark controls, cash conversion, capital efficiency, and audit trails. No investments, tax or legal advice from market research alone.
- **Law firms, security companies, communications, analytics:** evaluate permission models, service agreements, business continuity, verification, and audit evidence. Avoid copying third-party proprietary procedures.
- **U.S./European/global software and applications:** Microsoft, Alphabet, Apple, SAP, Salesforce, Adobe, Shopify, Stripe, Atlassian, ServiceNow. Benchmark identity, accessibility, data portability, permissions, onboarding, and enterprise resilience.
- **Music, recording, audio/video production, publishing, streaming, game companies:** Universal Music Group, Sony Music, Warner Music Group, Spotify, YouTube, Twitch, Disney, Nintendo, Sony Interactive Entertainment, Microsoft Gaming. Benchmark rights metadata, original-asset provenance, interoperable project formats, exports, content moderation and human-controlled distribution.
- **Transportation, automobile, manufacturing, production/distribution:** Toyota, Volkswagen, Ford, UPS, FedEx, DHL, Siemens, ASML, Boeing. Benchmark order traceability, takt time, capacity, maintenance, reliability and supply-chain visibility; never claim provider integration is live.
- **Restaurants, hospitality, rentals, retail and local small business:** McDonald's, Chipotle, Yum! Brands, Starbucks, Marriott, Hilton, Airbnb, Enterprise Mobility, Walmart. Benchmark recipe yield, waste, table capacity, inventory reconciliation, service quality, rental calendars and fulfillment.
- **Fine artists, musicians, authors, painters and designers:** build a *curated works-and-rights bibliography*, not a universal ranking of human creativity. Attribute every work, era, licence/rights and source; do not import copyrighted content without permission.

## Curated set of 50 applied formulas to investigate, not a universal ranking

Before implementing, check existing \`sonara-formula-engine.cjs\`, \`sonara-formula-library.cjs\` and current deterministic formula PRs to avoid duplicates. These are **concept references**, not proof that all 50 execute in production. Each needs domain validation, units, edge cases, numeric bounds and user-visible assumptions.

| # | Concept / standard expression | SONARA use |
|---|---|---|
| 01 | Percent change: (new-old)/old | Growth KPIs |
| 02 | Weighted mean: Σwx/Σw | Quality score |
| 03 | Expected value: Σpᵢxᵢ | Scenario planning |
| 04 | Variance: E[(X-μ)²] | Forecast uncertainty |
| 05 | Standard deviation: √variance | Risk/dispersion |
| 06 | Z-score: (x-μ)/σ | Outlier monitoring |
| 07 | Compound growth: P(1+r)^n | Demand scenarios |
| 08 | Conditional probability: P(A∩B)/P(B) | Customer segments |
| 09 | Linear model: y=β₀+β₁x | Simple forecasts |
| 10 | Logistic function: 1/(1+e^-z) | Probability calibration |
| 11 | Economic order quantity: √(2DS/H) | Purchase quantity |
| 12 | Reorder point: lead-time demand+safety stock | Inventory |
| 13 | Safety stock: zσ_LT (specified distribution) | Stock buffering |
| 14 | Newsvendor fractile: Cu/(Cu+Co) | Perishable purchasing |
| 15 | Little's law: L=λW | Queues |
| 16 | Utilization: busy time/available time | Operations |
| 17 | Cycle time: duration/completed units | Production |
| 18 | Throughput: completed units/time | Fulfillment |
| 19 | OEE: availability×performance×quality | Manufacturing |
| 20 | Cpk: min((USL-μ)/(3σ),(μ-LSL)/(3σ)) | Process capability |
| 21 | Contribution margin: revenue-variable costs | Business |
| 22 | Gross margin: (revenue-COGS)/revenue | Pricing |
| 23 | Break-even volume: fixed costs/unit contribution | Pricing |
| 24 | CAC payback: acquisition cost/monthly contribution | Marketing |
| 25 | Simple LTV: monthly contribution/monthly churn | SaaS assumption |
| 26 | NPV: ΣCF_t/(1+r)^t | Project selection |
| 27 | IRR: rate such that NPV=0 | Capital projects |
| 28 | ROI: (gain-cost)/cost | Investments/projects |
| 29 | Cash conversion cycle: DIO+DSO-DPO | Working capital |
| 30 | Cash runway: available cash/net cash burn | Business planning |
| 31 | Newton's second law: F=ma | Mechanics |
| 32 | Mass-energy equivalence: E=mc² | Physics education |
| 33 | Newtonian gravity: F=Gm₁m₂/r² | Orbital approximation |
| 34 | Ohm's law: V=IR | Trades/electrical |
| 35 | Electric power: P=VI | Trades/electrical |
| 36 | Constant-acceleration motion: s=ut+½at² | Simulations |
| 37 | Bernoulli equation: p+½ρv²+ρgh=constant | Fluid flow (ideal) |
| 38 | Ideal gas law: PV=nRT | STEM |
| 39 | Sensible heat: Q=mcΔT | HVAC / energy |
| 40 | Wave speed: v=fλ | Sound / engineering |
| 41 | Shannon entropy: -Σp log₂p | Data compression |
| 42 | Binary cross-entropy: -[y ln p+(1-y)ln(1-p)] | Model evaluation |
| 43 | Sigmoid derivative: σ(z)(1-σ(z)) | Optimization |
| 44 | Softmax: e^zᵢ/Σe^zⱼ | Class probabilities |
| 45 | Precision: TP/(TP+FP) | Detection quality |
| 46 | Recall: TP/(TP+FN) | Detection quality |
| 47 | F1: 2PR/(P+R) | Classifier balance |
| 48 | p95 latency: empirical 95th percentile | API operations |
| 49 | Availability: good service time/total time | SLO |
| 50 | MTBF: operating time/failures (repairable systems) | Maintenance |

Cautions: break-even denominators must be positive; sigma and appropriate sample sizes must be defined; cash flow sign conventions matter; probabilities require calibration and datasets; physical models require their stated assumptions; financial numbers are estimates rather than advice.

## Candidate SONARA upgrades, with accountable decision gates

1. **P0 release integrity:** verify current exact-SHA CI, migration/RLS proof, protected main, billing/checkout receipts and offline/production flags before customer activation.
2. **P1 benchmark ingestion adapter:** approved import of official ranking exports with edition, metric, observation date, publisher URL, proof of source-page matching, and contradiction review; default read-only.
3. **P1 research-to-capability scorer:** use \`scoreCapabilityIdeas\` only as a *planning aid*; require recorded owner, one customer commitment, source evidence, a cost ceiling and specialist/owner review for high-impact actions. Never auto-merge, auto-deploy or auto-charge based on score.
4. **P1 formula coverage audit:** map 50 formula concepts to verified current handlers/tests; implement missing ones only with dimensional analysis and failing negative cases.
5. **P2 cross-sector starter packs:** restaurant demand and waste, creator rights/readiness, service-business dispatch, distributor reorder, audio production planning and consent-safe growth; each must pass customer-value and cost-to-serve tests.
6. **P2 company/people index:** opt-in and source-linked metadata for scientists, inventors, artists and business leaders, with attribution, jurisdiction, edition and deletion/retraction handling; no celebrity likeness cloning or unauthorized content ingestion.

## Verification and disclosure

- This module reads only caller-supplied objects and does **no fetching**.
- A recognized source ID is not proof of data authenticity.
- A complete rank 1–50 transcription is still **not approved for publication** by the library.
- Sensitivity and budget decisions remain human-owned; specialist regulated-domain advice is outside scope.
- Run targeted mocha, full pnpm tests, lint, typecheck, build, CI and exact-head review before merging.
