# SONARA Research Atlas: interval-based ranking sensitivity
**Research and implementation:** October 10, 2026. **Status:** Draft-only source; no customer interface, external imports, database migration, or production authorization.

## The real research question

A reported Top-50 comparison may depend on revenue, company size, scientific output, inventor activity, creator audience or operational performance. Two nominal numbers can be ordered, but if their **plausible measurement ranges overlap**, the apparent 50th-place boundary may be unstable. An isolated numerical rank does not prove actual population coverage, measurement reliability, a source license, or a verified scientific/research claim.

NIST Technical Note 1297, section 7, emphasizes stating the basis of any uncertainty and the coverage factor for an expanded uncertainty measure: https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-7-reporting-uncertainty. Our implementation uses only **caller-supplied deterministic intervals**, which should not be called NIST-standard uncertainties, confidence intervals, statistically calibrated error bars, or guaranteed coverage intervals.

The W3C PROV-O standard distinguishes source entities, review/derivation activities, and accountable agents: https://www.w3.org/TR/prov-o/. A caller-supplied interval and `evidenceId` are **not independent evidence** of that provenance chain. Both sources informed methodology; neither has certified SONARA.

## Implemented source contract

New `lib/sonara-research-rank-sensitivity.cjs` exports `assessTop50RankSensitivity({comparison, intervals})`:

1. Calls existing `planComparableTop50(comparison)` *first*. This preserves SONARA's whitelist of research cohorts, restrictions on publisher rankings, permitted units, reporting years, source ID syntax, bounded finite values, geographic consistency and release blocks. No separate ranking engine, sandboxed expression evaluator or crawler was added.
2. Takes **exactly one interval per observation**, max 500, using a strict schema: `{entityId,evidenceId,lower,upper,intervalType}`. The interval source type is either `source_reported_range` or `scenario_bounds`. It validates exact entity and evidence-ID linkage, no duplicates or extra personal fields, nonnegative finite ordered bounds, observed value within the bounds, integer-valued count units and rates within [0,1].
3. Calculates **conservative sample-relative rank bounds** under either descending or ascending order. For descending:
   - `bestPossibleRank = 1 + count(other.lower > this.upper)`
   - `worstPossibleRank = 1 + count(other.upper >= this.lower)`
   These bounds consider uncertainty and conservatively treat ties as potential displacement; ascending reverses the inequalities. They do not claim ranks are achievable simultaneously or that source observations are independent.
4. Classifies each observed item as `within_sample_top50_under_bounds`, `outside_sample_top50_under_bounds` or `ambiguous_sample_top50_boundary`. An interval crossing the cutoff yields a blocker, not an invented definitive ranking.
5. Always returns `uncertaintyMethodValidated:false`, `sourceIntervalsAuthenticated:false`, `publisherRightsCleared:false`, `sampleRepresentative:false`, `rankingVerified:false`, `customerDecisionAuthorized:false`, `publicationAuthorized:false` and `productionAuthorized:false`. It does **not** calculate statistical confidence, independently retrieve publisher records or activate payments or regulated investment decisions.

Complexity: O(n²) pairwise interval comparisons, bounded to at most 500 observations (~250,000 ordered comparisons), without a new GPU worker, provider integration, queue, database or per-request network cost.

### Illustrative synthetic example

If there are 51 restaurant operators in a synthetic sample and every reported measurement is an exact singleton interval, 50 appear within the **sample's** first 50 and one outside. When reported ranges overlap across the cutoff, positions become ambiguous. Neither scenario supports calling those organizations America's actual Top 50 restaurants. A 50-entity-only sample triggers `only_50_observed_no_exclusion_test` because unobserved establishments could outrank the entire observed set.

Potential uses after review:
- **Business Builder:** restaurant operating cost/revenue, manufacturer productivity, transport delivery performance and rental utilization range comparisons.
- **Creator Studio:** audio/video production throughput, creator audience metrics and licensed-content distribution statistics, not ranking artistic merit on one number.
- **Growth Studio:** ranges of campaign outcomes and competitor KPI estimates, not a claim of causal lift or reliable forecast.
- **SONARA One:** scientific bibliography and inventor output comparisons with clear sampling, normalization, domain-specific ethics and source caveats.

## Testing and limits

- **9/9 native Node.js v22.16.0** tests passed locally with an injected comparator fixture. Cases include exact-disjoint measurements, overlapping cutoff intervals, ascending comparisons, malformed, missing and duplicate evidence, invalid integer/rate ranges, 50-member sample limitations, and maintained release blocks.
- The proposed GitHub source Git blob hash matched the native Node-tested file byte-for-byte; the test blob was checked likewise.
- Additional **2 integrated scenarios** passed in isolated V8 against the actual SONARA Research Atlas, comparison gate, and existing formula engine metadata (with URL/crypto dependency shims). This is **not** an official Node 24, pnpm/Mocha/full release CI or a statistical validation with actual financial, scientific, music or business datasets.
- The pairwise bounds are conservative and do not account for correlation, shared-source bias, correlated measurement uncertainty, selection bias, source rights, survivorship bias, identity merges or data revisions. Real uncertainty distributions, fiscal-year/calendar-year basis and currency conversion require expert-reviewed measurement models.

## Required follow-on gates

**P0:** Recover GitHub Actions execution and branch protection/owner approvals (issue #579), run exact-commit full Node 24 and pnpm tests, security, production DB migrations/RLS isolation and staged release tests. Do not bypass or mark queued runs green.

**P1:** Add authenticated reviewer identities, approved source editions and licensing records, original source hashes and conflict history, provider data dictionaries, audited unit definitions and explicit statistical uncertainty models. Distinguish confidence intervals from deterministic scenario ranges.

**P1/P2:** Expose an accessible, tenant-isolated read-only Research Atlas view that shows a range and its explicit limitations beside every proposed rank. Pilot on synthetic then authorized licensed data. Record service costs, performance and actual user outcomes before marketing this as a production comparative-intelligence capability.

No merge, production deployment, website change, payment operation, live source harvesting or customer data mutation is implied by this PR.
