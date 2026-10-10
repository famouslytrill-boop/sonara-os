# Research-to-product: global benchmarks, scientific methods and ranked-list integrity
**Research date: 2026-10-09 | Evidence: publisher pages + SONARA source inspection | Phase 2 hardening: 2026-10-09 | Not a deployment or provider certification**

## What this work actually does

This change adds a **read-only CommonJS research gate** at `lib/sonara-research-benchmark-gates.cjs`, with negative tests. It does not add a new database, external API consumer, live web crawler, paid financial advice, executive directory, autonomous operation, UI route, marketing publication, or production activation. `source_transcription_needs_audit` deliberately remains unverified even if all 50 entries appear; neither user-supplied ranks nor URL strings independently verify publisher content.

## Primary ranking authorities and incompatible metrics

| Requested population | Authority | Metric / timing | Important limit |
|---|---|---|---|
| Top 50 US companies | https://fortune.com/ranking/fortune500/ | 2026 Fortune 500, revenue | Not largest by market capitalization |
| Top 50 European companies | https://fortune.com/europe/ranking/fortune500-europe/ | 2026 European ranking, revenue | Europe geographic definition follows publisher |
| Top 50 world companies | https://fortune.com/ranking/global500/ | 2026 Global 500, revenue | Fiscal years differ; not brand quality |
| Top 50 richest people | https://www.forbes.com/real-time-billionaires/ | Forbes continuously estimated net worth | Intraday estimates change; two-day freshness gate |
| US small business classification | https://data.sba.gov/dataset/small-business-size-standards | SBA NAICS size/receipts standards | No universal objective “top 50 small businesses” |
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

Before implementing, check existing `sonara-formula-engine.cjs`, `sonara-formula-library.cjs` and current deterministic formula PRs to avoid duplicates. These are **concept references**, not proof that all 50 execute in production. Each needs domain validation, units, edge cases, numeric bounds and user-visible assumptions.

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
3. **P1 research-to-capability scorer:** use `scoreCapabilityIdeas` only as a *planning aid*; require recorded owner, one customer commitment, source evidence, a cost ceiling and specialist/owner review for high-impact actions. Never auto-merge, auto-deploy or auto-charge based on score.
4. **P1 formula coverage audit:** map 50 formula concepts to verified current handlers/tests; implement missing ones only with dimensional analysis and failing negative cases.
5. **P2 cross-sector starter packs:** restaurant demand and waste, creator rights/readiness, service-business dispatch, distributor reorder, audio production planning and consent-safe growth; each must pass customer-value and cost-to-serve tests.
6. **P2 company/people index:** opt-in and source-linked metadata for scientists, inventors, artists and business leaders, with attribution, jurisdiction, edition and deletion/retraction handling; no celebrity likeness cloning or unauthorized content ingestion.

## Verification and disclosure

- This module reads only caller-supplied objects and does **no fetching**.
- A recognized source ID is not proof of data authenticity.
- A complete rank 1–50 transcription is still **not approved for publication** by the library.
- Sensitivity and budget decisions remain human-owned; specialist regulated-domain advice is outside scope.
- Run targeted mocha, full pnpm tests, lint, typecheck, build, CI and exact-head review before merging.

## Phase 2: evidence hardening and independently checked source methodology

Source review on 2026-10-09 confirmed the following direct publisher/authority positions:

| Claim | Direct authority | Verified meaning | Contradiction / non-claim |
| --- | --- | --- | --- |
| Fortune U.S. list is 2026 revenue-ranked | https://fortune.com/ranking/fortune500/ | Publisher explicitly identifies 2026 Fortune 500 as U.S. revenue ranking | Not a technology/satisfaction ranking; page access does not license scraping or bulk republication |
| Fortune Europe uses published financial statements | https://fortune.com/europe/ranking/fortune500-europe/ | Revenue definitions and reporting year vary by financial business type | Do not compare U.S./European ranking methodology as if identical without review |
| Fortune Global list uses fiscal-year revenue | https://fortune.com/ranking/global500/ | 2026 list uses fiscal years ending on/before March 31, 2026 | Currency and fiscal window comparability require care |
| Forbes real-time wealth estimates change frequently | https://www.forbes.com/real-time-billionaires/ | Public holdings are updated with markets; private assets may update daily | A weekly or even two-day-old copy is not 'live'; two-day module policy is only a maximum staleness warning |
| U.S. small-business thresholds are industry-specific | https://data.sba.gov/dataset/small-business-size-standards | SBA NAICS-based standards use receipts or employee counts | No general objective top-50 small-business popularity ranking follows |
| NIST AI RMF governs continuous risk reviews | https://airc.nist.gov/airmf-resources/airmf/5-sec-core/ | Govern, Map, Measure, Manage; independent evaluation matters | The voluntary framework is not a security certificate |
| NIST SSDF final guidance is SP 800-218 v1.1 | https://csrc.nist.gov/pubs/sp/800/218/final | Secure development practices span lifecycle | The 2025 v1.2 revision URL is an initial public **draft**, not an adopted final replacement |
| USPTO novelty and protection boundaries | https://www.uspto.gov/patents/basics/essentials | Patentability requires more than calling a combination 'invented' | Product concepts/names are not established patents or registered marks |

**Implemented policy changes:** All ranking publishers default to `automatedIngestionAllowed: false` and `republicationRightsCleared: false`. Any rejected source row yields `invalid_transcription`, even if 50 valid rank numbers are present. Input evidence URLs and customer counts are explicitly unverified claims. Ideas with complete self-reported fields receive `independent_validation_required`, not 'ready' or production authority. Recognized high-impact classifications and *unknown* risk tags require specialist and owner review.

**Test changes:** 21 targeted contract/negative test cases now cover malformed rankings, complete-but-unverified lists, publisher rights denial, forecast-risk taxonomy, unknown tags, missing evidence, spoofed links, and production-denial invariants. A check that runs these tests in isolated V8 is diagnostic only; official pnpm/Node test, CI, license scans and release proof remain required.

**Implementation stages after this PR:** (1) wait for exact-head CI and merge governance; (2) human rights/terms check before any external intake; (3) reuse existing source evidence registration and tenant-safe research storage with no parallel duplicate database; (4) implement an opt-in read-only, properly labeled Research Lab surface; (5) controlled pilot with at least one customer, bounded budget and measured time-to-answer. Do not grant a research module any authority over Stripe, publishing, security, customer communication or repository deployments.

## Phase 3: cross-source contradiction graph and hostile evidence input

**New read-only function:** `auditEvidencePacket({ observations, reviewedAt, maxAgeDays })` groups source-supported research claims by stable claim ID. Each item contains an HTTPS source URL, observation date, and explicit `supports` or `contradicts` stance. The function does not fetch content, grant rights, authorize publication, change a customer record or claim to authenticate supplied URLs.

It reports:
- `contradiction_review` for claims with both supporting and contradictory observations;
- `unsupported_claim` for only adverse evidence;
- `stale_evidence` for inputs outside an explicitly bounded age window;
- `invalid_intake` for duplicate source/claim combinations, invalid dates/URLs and malformed records;
- `no_evidence` for an empty research set;
- `human_source_review_required` even for a clean packet, because URLs and other metadata supplied by the caller remain unverified.

**Source and risk controls:** Ranking names reject leading spreadsheet-formula initiators, including Unicode compatibility variants, and invisible/control/bidirectional override characters. Evidence URL inputs are HTTPS-only and capped at 2,048 characters. Localhost, local/internal DNS, common private-network IPv4 ranges, IPv6 literals, embedded credentials and control characters fail admission. There is **no network request** in this module. The URL policy is defense-in-depth for future approved adapters, not proof that arbitrary hosts are safe to fetch.

**Research basis:** W3C provenance separates *entity*, *activity* and *agent*, suitable for audit-ready attribution and contradiction chains (https://www.w3.org/TR/prov-o/). NIST AI RMF distinguishes governance, contextual mapping, independent measurement and risk management (https://airc.nist.gov/airmf-resources/airmf/5-sec-core/). OWASP warns that exporting untrusted text to CSV can trigger formula execution, and that generic escaping is not universally reliable across spreadsheet software (https://owasp.org/www-community/attacks/CSV_Injection). This implementation rejects unsafe identifier shapes, but does **not** claim to provide a CSV exporter or general spreadsheet-output sanitization.

**Verifiable engineering boundary:** Unit assertions test contradictory signals, bad provenance, source freshness, private/internal citation URLs, unsafe ranking names, publisher rights restrictions and fail-closed authorization. A mutation test deliberately granting production authorization to a claim must fail. Since GitHub Actions remain queued, merge is blocked until full exact-SHA Node/CI validation completes. No extra claims of readiness follow from test counts alone.

**Next implementation phase once exact-head gates are green:** typed imports from an approved source and explicit rights record, signed/tenant-scoped human review receipts, review UI reuse within the existing Research Lab route registration, and measured pilot. Any new database storage requires schema/RLS/migration review; do not create duplicate research source tables.

## Phase 4: evidence source diversity, risk intake and release-queue inspection (2026-10-09)

### Verified reference standards and engineering implications

- **W3C PROV-O** (https://www.w3.org/TR/prov-o/): models Entity, Activity and Agent; a research link or claim alone is not an agent-backed verification event. SONARA's source-link counts are not signed PROV-O attestations.
- **NIST AI RMF 1.0** (https://www.nist.gov/itl/ai-risk-management-framework): voluntary Govern, Map, Measure and Manage guidance. As of October 2026 NIST says the framework is undergoing revision; this PR does not confer certification or assert that the framework can replace software security controls.
- **OWASP SSRF prevention** (https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): URL input validation alone cannot prevent DNS rebinding when a future service performs network requests. The current research functions are non-networked. Any future fetch must add a vetted destination allowlist, DNS and resolved-IP safety checks, redirect restrictions, resource caps and egress isolation at request time.

### Implemented, but not production activated

1. Evidence review packets now expose `sourceHostCount` and `multipleObservationsFromOneHost` for each claim. `www.` is normalized for this *host* measure, but two distinct hosts **do not prove two independent publishers**, and host count never self-verifies a claim. Source URLs remain caller-supplied.
2. Candidate scoring rejects an empty `riskTags` array as an unclassified idea; unknown risk tags remain specialist-review-only. An explicit low-risk label is *still* unverified self-reporting and can never grant production authorization.
3. The ranking validator prioritizes `invalid_transcription` over `stale_source` if both are true, so malicious/poisoned rows cannot be masked by the document's age.
4. No new dependency, network fetcher, customer route, database migration, payment pathway, external provider credential or autonomous action was added.

### Targeted test results and limitations

The 23 committed test cases passed in an isolated JavaScript V8 harness using a simplified URL constructor, **not** in the repository's Node 24/mocha environment. Mutating each of the following safeguards made tests fail: requiring at least one risk classification, prioritizing invalid ranking rows, and reporting single-host source concentration. This does not establish full-suite, production or real-network safety.

GitHub Actions inspection of the exact PR branch showed all substantive check runs queued (62) with two skipped checks, no completed required-green evidence. An inspected `SONARA Industries CI` run likewise showed both jobs queued and no runner assigned. This is an operational blocker; this evidence does not establish why the runner queue has not drained. Avoid force-rerunning queued workflows without identifying the capacity/configuration problem. No production restoration, merge, payments, social activation or store publication is authorized by this research PR.

### Next release sequence

1. Diagnose GitHub Actions scheduling/runner entitlement and org/repository permissions without turning off required jobs. Confirm a genuinely executed exact-head CI result.
2. Run `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build` with current Node 24 and appropriate blocking compatibility matrix.
3. Review the source evidence packet against W3C/NIST research requirements, actual publisher terms, and existing SONARA registries. Stop before claiming publication rights or independent publisher diversity.
4. Merge through protected branch governance only when all required checks and approvals pass. Production deployment remains a separate controlled authorization and may remain offline.

## Phase 5: research-to-formula evaluation planning (2026-10-09)

### Why the existing engine is reused

SONARA already has a canonical deterministic execution layer at `lib/sonara-formula-engine.cjs`. Inspecting that module at the current base showed **40 executable registered formulas** with explicit allowlisted handlers, a version, expressions, assumptions, and explicit numerical input checks. The new `planResearchFormulaEvaluation(request)` function **calls only `listExecutableFormulas()` for metadata**. It does not import a third-party expression interpreter, execute formulas, evaluate customer data, fetch URLs, mutate records, or authorize providers.

**User story:** An operator researching menu costing, supplier inventory, production capacity, or media editing first assembles citations under a single claim ID. The planner matches that claim to an already-implemented SONARA formula, exposes the domain, expression, assumptions, and a unit-consistency warning, and refuses to present that plan as an independently verified computation.

| Existing executable formula | SONARA product | Planning/measurement boundary |
| --- | --- | --- |
| `recipe_cost` | Business Builder | Normalize ingredient quantity, cost units, and usable yield |
| `food_cost_pct` | Business Builder | Same currency and serving basis for numerator and menu price |
| `eoq` | Business Builder | Units/year, currency/order, currency/unit/year must agree |
| `reorder_point` | Business Builder | Lead-time demand and safety stock use a common item and time basis |
| `takt_time` | Business Builder | Available production time and required output share the same window |
| `little_law` | Business Builder | Stable queue; throughput rate and cycle time use reciprocal time units |
| `pert_expected` | Business Builder | Three duration estimates share a unit and are not guaranteed outcomes |
| `audio_beat_alignment` | Creator Studio | Beat tolerance and eligible edit-point count are explicitly defined |
| `video_pacing` | Creator Studio | Average shot duration needs units and shot-length distribution |

These are **research-plan allowlist entries**, not new formulas. Existing `campaign_roi`, `security_risk` and every unlisted executable key remain unavailable through this planning entry point, even if executable elsewhere in SONARA. The calculation handlers and their numerical tests remain solely owned by the existing formula engine.

### Controls and source methodology

- A plan has one validated `claimId`, one formula on the allowlist, at most 100 claim-matched evidence receipts, and an explicit review date. Mixed-claim evidence and all unknown fields—including `inputs` or personal customer data—are rejected.
- `auditEvidencePacket` is reused to propagate contradiction, staleness, invalid intake and no-evidence states. Even a normal observation produces `human_source_review_required`, not 'approved'.
- The returned formula name, expression, domain, version and assumptions come from `listExecutableFormulas()` in SONARA, not a second formula catalog; local planning rules only add static unit-boundary notes.
- Output always sets `evidenceIndependentlyVerified`, `inputsVerified`, `formulaEvaluated`, `canUseForCustomerDecisions`, `productionAuthorized` and `publicationAuthorized` to **false**.
- No formula numbers or source text are written to a database. The tool is a planning blueprint and **not yet an authenticated Research Lab UI or tenant-isolated runtime**.
- Reference standards: NIST *Guide to the Expression of Uncertainty in Measurement* (https://www.nist.gov/publications/guide-expression-uncertainty-measurement) emphasizes rigor when reporting quantities; W3C PROV-O (https://www.w3.org/TR/prov-o/) documents evidence lineage concepts; OWASP Input Validation (https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) requires both syntactic and semantic checks. This implementation does not assert compliance with any of these standards.

### Test evidence and release gates

At the Phase 5 commit, **30/30 source-linked targeted JavaScript assertions** passed in a V8 harness with the actual committed formula-engine/industry-registry metadata, but a simulated URL constructor and stubbed cryptographic hash constructor. Thus this is *not* actual Node 24, mocha, pnpm, database, deployment, or independent security evidence.

The next release requirement remains:
1. Confirm why GitHub required jobs are queued before further reruns. Inspect runner scheduling, Actions permissions, billable minutes, queue policy and capacity as applicable using authorized repository administration, without bypassing branch protection.
2. Obtain actual exact-head Node 24 test, lint, typecheck, build, migration replay, dependency scan and security results. Investigate any real failure and revalidate after every commit.
3. Only then consider a separate authenticated read-only Research Lab integration with explicit tenant authorizations, reviewer identity, timestamped attestations and provider-rights records. A self-reported URL, shared-host count, or consent checkbox must not be treated as a verified fact or an authorization to calculate from customer data.

### Phase 5 additional intake/privacy hardening

Evidence receipts accept **only** `claimId`, `sourceUrl`, `stance`, and `observedAt`. An extra field, including customer identity, unapproved commentary or a purported approval, is rejected without echoing its content. Plans accept only `formulaKey`, `claimId`, `observations`, `reviewedAt`, and `maxAgeDays`. In particular, input values and customer details do not travel through the planning interface.

A targeted mutation study confirmed tests fail when the formula-evaluated guard is flipped, when unknown request fields are allowed, or when unapproved receipt fields are admitted. The targeted suite is now **30/30 passing in the isolated V8 harness**; full repository CI has not executed and no production outcome follows from this result.

## Phase 6: composite issue reporting, parser safety and blocked CI execution

### Changes implemented in the non-networked research module

- `inspectRanking` rejects extra input fields rather than silently admitting customer identifiers or invented external validation metadata into a clean-looking source row. It now exposes an ordered `issueCodes` array combining `invalid_transcription`, `stale_source`, and `incomplete_transcription`. The single `status` is retained for compatibility, but consumers should inspect the entire array to avoid masked errors. A complete ranking still has no independently verified publisher provenance or republication grant.
- `auditEvidencePacket` exposes all simultaneous `invalid_intake`, `no_evidence`, `contradictions_found`, `unsupported_claims`, and `stale_evidence` findings in `issueCodes`, without hiding stale sources when another claim is contradicted. Where there are no issues, `overallStatus` remains `human_source_review_required`, **not** a verified state.
- The formula research planner propagates all packet issues into `blockingReasons`, plus the mandatory unverified source identity, publisher rights, formula units/inputs and missing reviewer authorization. Calculations remain unexecuted; customer decision and production flags remain false. Date fields explicitly return `timestampProvenance: caller_supplied_unverified`; caller-selected 'reviewedAt' is **not** server-clock attestation.
- `isHttpsUrl` now rejects raw backslashes before parsing. Node's WHATWG URL parser normalizes backslashes under an HTTPS scheme; another parser may interpret the identical bytes differently. These controls are for non-networked source intake only; **they are not an SSRF defense for a future fetcher**. Any real fetch must enforce an approved destination allowlist, safe resolved IPs, redirects, connection pinning and egress isolation at the time of the request.

### Testing evidence

The existing research test file now has **34 targeted Mocha test definitions** (30 prior + four multi-defect/extra-field/date assertions), plus a backslash URL adversarial case inside the existing invalid-URL test. All 34 passed in a constrained V8 source-execution harness against the committed library and canonical formula registry. Deliberately removing composite ranking issues or contradiction issue flags, accepting unapproved row fields, and enabling customer decisions triggered test failures. This is diagnostic **only**; full Node 24/pnpm/mocha/CI have not completed. A separate Node 22 WHATWG URL parser experiment reproduced HTTPS backslash normalization, but did **not** run this repository's full suite.

### Actual GitHub release-gate investigation

- The SONARA Industries workflow definition at `.github/workflows/sonara-industries-ci.yml` specifies `runs-on: ubuntu-latest` for both `sonara-industries` and `supabase-preview`, with setup of Node 24 and a pinned pnpm install followed by typecheck, lint, tests and build.
- The exact-commit workflow run `38017092188` and both jobs were still `queued` with **no recorded runner or started time** when inspected. There are numerous additional queued workflow runs in the repository, but the reason for the queue is **not established**.
- The connected GitHub integration received a 403 `Resource not accessible by integration` reading `branches/main/protection`; a public ruleset listing returned `[]`. **These results do not confirm that branch protection is enabled or disabled.** Admin-level protection/Actions and billing settings need review by an authorized repository administrator.
- Do not trigger new redundant workflows, bypass required checks, mark queued tasks as passed, deploy the website, merge PRs, or activate customer payments, live data collection, autonomous actions, social, or mobile based on research test results.

### Owner/administrator's next gate

1. Inspect GitHub **Actions** runner assignment, usage/limits/billing, workflow permissions and concurrency policy for the queued run. Do not assume a specific cause; record actual job-level error or runner start evidence.
2. Inspect **Settings → Branches / Rulesets** with administrative authorization. Require protected main, approved reviews, and uniquely named exact-head checks from the expected GitHub App; block bypass, force-push and deletion where applicable. GitHub documentation: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches and https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks.
3. Only when runners execute: verify full Node 24 suite, pnpm lockfile install, route and security scans, PostgreSQL/RLS replay, and consumer/payment isolation. Re-evaluate all required checks on the **exact new head SHA** after any change; perform owner-reviewed merge and separate staged deployment with post-deploy rollback evidence.

## Phase 7: read-only GitHub Actions queue diagnostics (2026-10-09)

**Why:** GitHub status history confirms October 5 and 7 Actions disruptions but no published October 9 incident (https://www.githubstatus.com/). SONARA's inspected check runs and `ubuntu-latest` workflow jobs are still queued. A global incident, runner quota, billing, permissions, repository backlog, or GitHub-internal provisioning issue cannot be inferred from that fact alone. Avoid repeat-triggering new workflow runs; do not disable blocking checks.

**Implemented files:**

- `lib/sonara-actions-queue-diagnostic.cjs` — pure, bounded, offline analyzer for an exact commit SHA, a caller-dated snapshot of GitHub check-runs, workflow runs, and jobs; returns sanitized counts, explicit issue codes, and no claimed root cause or release permission.
- `tests/sonara-actions-queue-diagnostic.test.js` — deterministic adverse cases covering all queued, wrong commit, all-success-but-unverified, skipped-only, zero evidence, failures, invalid timestamps, future workflow dates, stale queued workflow age, and hidden private fields.
- `scripts/report-actions-queue.cjs` — offline CLI consuming **one locally prepared JSON snapshot**, with a 2 MB size cap, simple exit codes and safe error messages. It makes no API calls, has no GitHub token access and does not rerun/cancel/approve/deploy.

**Run manually in an authorized SONARA checkout:**

```sh
node scripts/report-actions-queue.cjs ./local-untracked/actions-snapshot.json
# 0 = no observed blockers (NOT release-approved)
# 1 = release evidence blocked
# 2 = malformed/missing snapshot
pnpm exec mocha --config .mocharc.targeted.json tests/sonara-actions-queue-diagnostic.test.js --reporter dot
```

**Snapshot shape:** `{"headSha":"<40 hex characters>","observedAt":"2026-10-10T02:50:00Z","checkRuns":[{"head_sha":"<matching SHA>","status":"queued","conclusion":null}],"workflowRuns":[{"head_sha":"<matching SHA>","status":"queued","created_at":"2026-10-10T02:20:00Z"}],"jobs":[{"status":"queued","runner_name":null,"started_at":null}]}`. The literal SHA placeholder is explanatory and must be replaced. Acquire check-runs at `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`, workflow runs at `GET /repos/{owner}/{repo}/actions/runs/{run_id}`, and jobs at `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`, from an authorized GitHub CLI or REST session. Create a **sanitized and untracked** JSON file with only these fields; never commit API responses, credentials, customer data, authorization headers or secrets.

The job API can omit a job creation timestamp; age analysis uses a workflow's `created_at` only as **workflow-age evidence** and never pretends it is the individual job's runner wait. All timestamps remain caller supplied. A report with all check runs successful still cannot verify required-check coverage, branch protection, account authorization, migration safety, or production readiness.

**Validation actually executed:** Nine targeted test cases passed in **native Node 22.16.0** in the current tool environment via a minimal synchronous `describe/it` driver (not installed Mocha or the full SONARA repository). Git blob hashes for the source and tests match the local Node-tested files exactly. The standalone CLI was also exercised against a locally constructed queued-job fixture and returned exit code 1 with no secrets or root-cause claim. Official Node 24/pnpm full-suite tests remain pending.

**Operational next step:** An authorized repository administrator must inspect runner account/billing quota and Actions usage, allowed workflows and concurrency groups, branch protection (integration's protection read returned 403), and raise a GitHub Support case with the queued run IDs if local restrictions do not explain them. The changes in this PR do not attempt to change those permissions.

## Phase 8: accurate check/workflow/job conclusions (2026-10-09)

### Verified problem

The original offline Actions queue diagnostic was willing to treat an all-success check-run snapshot as having no observed blocker even if a matching **workflow run** or **individual job** had actually failed, timed out or been cancelled. It also treated `requested` and `waiting` check runs as unknown rather than unfinished. GitHub defines these statuses and conclusions separately; the check-runs API is not the only source of runtime evidence. See https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-checks and https://docs.github.com/en/pull-requests/reference/status-checks.

### Fix implemented

- `analyzeActionsQueueSnapshot()` now detects `failed_workflows`, `failed_jobs`, `failed_checks`, `missing_workflow_evidence`, `unfinished_execution`, `unknown_workflow_conclusion` and `unknown_job_conclusion` independently, including `failure`, `timed_out`, `cancelled`, `action_required`, `startup_failure` and `stale` final outcomes.
- `requested`, `waiting`, `pending`, `queued` and `in_progress` are unfinished states. They can never count as completed required checks.
- The analyzer reports additional `workflowQueue.unfinished/failed` and `jobCounts.unfinished/failed` counters. It still never asserts the queue's actual cause or authorizes release, because required-check configuration and branch governance must be separately verified.
- The previous test fixture was corrected to contain an actual `conclusion: "success"` for a completed workflow and job. A blank conclusion must not be silently interpreted as success.

### Tests and proof boundary

**14/14 tests passed with native Node.js 22.16.0 using Node's `node:test` driver**, after a real failure in the initial candidate exposed an incomplete completed-state test fixture. Five regression cases cover failed workflows concealed by successful checks, failed jobs concealed by successful workflows, waiting/requested states, missing workflow data or undefined final results, and stale/startup-failure/cancelled outcomes. Both committed source and test Git blob hashes were verified against the exact locally tested files: module `e81f93b830d7363a9d4284e75a71fb02e3ab62bb`, test `b289cde3136ad339bf65d198cf4963322b1dd870`. The local offline CLI returned code 1 and `unfinished_execution` for a queued snapshot.

**Do not confuse this test pass with Node 24, Mocha, pnpm, a full repository run, RLS proof, or production deployment.** The existing main CI runner and other release checks have not completed.

### GitHub runner economics and concurrency research

GitHub's current documentation states that **standard** GitHub-hosted `ubuntu-latest` runners are free for public repositories; SONARA's inspected repository is public and its workflow requests `ubuntu-latest`. Thus ordinary *private-repository included minutes* are not a sufficient explanation for this backlog. Usage and service restrictions, Actions settings, concurrency, or runner provisioning remain unverified by the connected integration. See https://docs.github.com/en/actions/concepts/billing-and-usage and https://docs.github.com/en/actions/reference/runners/github-hosted-runners.

GitHub also documents that naïve concurrency grouping can replace an earlier pending run instead of completing every required exact-head check. Therefore, **do not add automatic concurrency/cancellation changes to mandatory release workflows without a separate owner-reviewed gate analysis**. See https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency.

**Next release step:** Owner/admin investigates existing P0 issue #579, obtains GitHub's actual scheduling/runner evidence, and successfully executes a single controlled exact-SHA build/test/security/database/tenant matrix. Keep PR #605 draft, review branch protection separately, and deploy only via a separately approved staged release.
