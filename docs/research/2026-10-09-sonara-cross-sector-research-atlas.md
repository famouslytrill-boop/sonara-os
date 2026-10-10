# SONARA Research Atlas — Cross-sector top-50 and scientific capability expansion
**Research date:** 2026-10-09 (America/New_York). **State:** Draft PR source code only; no ingestion, verified top-50 datasets, public Research Atlas UI, payments or production activation.

## Technical delivery
`lib/sonara-research-atlas.cjs` establishes **50 named research cohorts** spanning U.S., Europe and world companies; wealth; small business, hospitality and restaurants; security; manufacturing, logistics, distribution, rentals, automotive, SaaS and analytics; finance, hedge funds, law and nonprofits; media, streaming, music/publishing/recording/production; physicists, mathematicians, scientists, inventors, entrepreneurs, CEOs, CFOs, U.S. painters, visual artists, musicians and authors. Each cohort has a SONARA product fit, comparison metric label, source reference, review requirements and default-deny ingest/republication/customer-decision flags.

**Important semantic boundary:** This is *50 categories capable of asking a top-50 research question*, **not** 50 ranked entries in every category. Four have an identified publisher ranking whose *edition and data still require independent verification*; 46 require a specific cohort, metric, geography, source and time window before constructing a defensible ranking. Never invent the missing 50 people or organizations.

### Original primary-source reference map

| Population | Source | What the source proves and does not prove |
| --- | --- | --- |
| U.S. corporate revenue | [Fortune 500 2026](https://fortune.com/ranking/fortune500/) | Publisher ranking by annual revenue, not market cap, best products or most innovative |
| European corporate revenue | [Fortune Europe 2026](https://fortune.com/europe/ranking/fortune500-europe/) | Europe-specific revenue cohort; geographic rules and currency conventions differ |
| Worldwide corporate revenue | [Fortune Global 500 2026](https://fortune.com/ranking/global500/) | Global revenue list; not interchangeable with national editions |
| World wealth | [Forbes Real-Time Billionaires](https://www.forbes.com/real-time-billionaires/) | Estimated personal wealth changing with markets; date/time essential |
| U.S. small businesses | [SBA size standards](https://data.sba.gov/dataset/small-business-size-standards) | Industry-specific size eligibility; **not** a best-business or highest-sales ranking |
| Employer industry landscape | [Census County Business Patterns](https://www.census.gov/programs-surveys/cbp/data.html) | Establishments and payroll; **not** a named top-firm ranking. On Oct 9, 2026, the Census page said 2023 is its latest CBP reference year. |
| Restaurant industry | [National Restaurant Association 2026 report](https://restaurant.org/research-and-media/research/research-reports/state-of-the-industry) | Industry economics and forecasts; **not** a top-50 restaurant directory |
| Listed firms / securities | [SEC EDGAR](https://www.sec.gov/edgar/search/) | Filings; company accounts need a common GAAP/IFRS and period comparison |
| Hedge funds / advisers | [SEC IAPD](https://adviserinfo.sec.gov/) | Adviser registrations/disclosures, not product endorsements or investment recommendations |
| Physics / math / science | [OpenAlex](https://help.openalex.org/api/) | Works and author metadata; citations alone do not measure scientific merit |
| Inventors | [USPTO search](https://www.uspto.gov/patents/search/) | Patent documents and inventors; number of patents is not economic value |
| Musicians / publishing | [Copyright Office MMA](https://www.copyright.gov/music-modernization/) | Music works/recording licensing and royalty mechanics, **not** clearance to distribute songs |
| Authors / painters / visual art | [Copyright basics](https://www.copyright.gov/what-is-copyright/) | Copyright rights and limitations; aesthetic 'top 50' requires curatorial judgment |
| Charities / philanthropy | [IRS tax-exempt search](https://www.irs.gov/charities-non-profits/search-for-tax-exempt-organizations) | Tax status and Form 990 filings; current status and grant definitions require checking |
| Legal profession | [ABA state directory links](https://www.americanbar.org/groups/legal_services/flh-home/flh-bar-directories-and-lawyer-finders/) | Links to jurisdictional verification; not a national ranking or legal advice |

**Publisher rights:** Each reference is metadata only, with automated ingestion and republication disabled by default. A source link is never proof of licensing or independent verification.

## Novel read-only capability: Atlas Lens cohort distribution

`summarizeCohortDistribution({categoryId, values, unit, period})` computes **minimum, 25th percentile, median, 75th percentile, maximum** for **5–50 finite, nonnegative numeric sample values**, with a required measurement unit and calendar reference year. Quantiles use sorted-sample linear interpolation at location `(n-1)p`. Its outputs explicitly deny independent ranking, comparable unit proof, sampling-bias review, verified inputs, customer decisions and production authority.

Potential product views after further review:
- **Business Builder:** restaurant food costs versus peer quartiles; procurement reorder and safety stock; trucking throughput; rental utilization; property and labor costs. Use existing formula engine rather than replicating `eoq`, `reorder_point`, `recipe_cost`, `takt_time` or `little_law`.
- **Creator Studio:** licensed works, publishing rights, distribution readiness, media production capacity, completion times and quality metrics. Separate composition rights from sound-recording rights and capture explicit owner authorization.
- **Growth Studio:** competitive peer comparisons and audience performance *from consented/authorized data*, with provenance and forecast uncertainty. Do not trigger campaigns, tracking, scraping or social publication automatically.
- **SONARA One:** searchable cross-domain research taxonomy, evidence ledger, source-licensing checks, human reviews, version/edition tracking and user-visible uncertainty before release.

### Mathematics and scientific theories

The existing [50-item formula section](./2026-10-09-source-grounded-global-benchmarks-and-science.md) covers probability, statistics, uncertainty, inventory, business economics, physics, mechanical/electrical engineering, audio/waves, information theory and reliability. The current repository already has a canonical deterministic formula engine with explicit handlers; **50 researched concepts does not mean 50 production-tested executable formulas**. Formulas require units, assumptions, domain validation and adversarial tests.

Example cross-sector adaptations:
1. **Bayesian/conditional probability** — uncertain customer demand with priors and disclosure; avoid uncalibrated decisions.
2. **EOQ, reorder points and Little's law** — procurement, supplier distribution and restaurant queue optimization; verify stationarity and lead-time assumptions.
3. **PERT and earned value** — creative shoots, event planning, engineering/construction estimates.
4. **Fourier / wave speed / entropy** — creator audio analysis, streaming latency and codec research; do not imply a fully functional DAW or licensed codec.
5. **Uncertainty, percentile distributions and confidence intervals** — distinguish forecast models from guarantees. Reporting a median of five observations does not validate a population estimate.

## Prioritized engineering sequence

| Priority | Deliverable | Evidence needed |
| --- | --- | --- |
| P0 | GitHub CI scheduling recovery / branch protection | Actual exact-SHA Node 24, lint, test, build, security, DB/RLS replay and approved merge gate |
| P1 | Atlas categories and exploratory quartile calculations (this PR) | Targeted negative tests and caller-source caveats; no production claim |
| P1 | Publisher/editor provenance and permission records | Distinct source edition, reviewer identity, rights, timestamps and tenant authorization |
| P1 | Verified industry sources and product-specific benchmark definitions | Data dictionary, sector NAICS mapping, representative cohorts, unit and period consistency |
| P2 | Read-only Research Atlas UI inside approved Research Lab | Auth, rate limiting, accessibility and tenant isolation; explicit provenance and uncertainty |
| P2 | Formula validation plus operational scenario pilots | Golden datasets, unit checking, realistic cost/ROI, boundary and load tests |
| P2 | Governed connector imports only with approved terms and credentials | Provider routing, no unrestricted scraping, lifecycle observability, revoke/delete handling |

### Verification and costs

Targeted JavaScript assertions for the module passed **12/12 in an isolated V8 harness**, loading the real SONARA ranking/indirect formula metadata with a simulated URL/crypto dependency. This is **not a Node 24, pnpm/Mocha, full CI or production test result**. Repository administrator must still recover Actions issue #579; main's protection and deployment still need independent verification. This module uses only synchronous local calculations with O(n log n) sample sorting for at most 50 numbers; it has **no new infrastructure bill, API ingestion, storage or GPU dependency**. Future costs for authorized sources, storage, support, content rights, provider operations and legal review remain unestimated until vendors, usage, and licensing terms are known.

**Legal boundary:** SONARA provides software tools and research, not unlicensed banking, broker/dealer services, investment recommendations, escrow or legal representation. Financial, securities, legal and health decisions require specialist review, and user/owner authorization precedes sensitive actions.
