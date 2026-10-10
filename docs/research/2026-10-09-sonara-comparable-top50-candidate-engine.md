# SONARA Research Atlas — Comparable Top-50 Candidate Engine
**Research baseline:** October 9, 2026. **Implementation state:** Non-networked, non-deployed draft source only. **No actual top-50 named-entity datasets were ingested.**

## Problem, approach and original research

The existing SONARA Atlas recognizes 50 distinct research populations with 15 reference-source links. Four map to actual published ranking families (Fortune U.S./Europe/Global revenue and Forbes estimated personal wealth). Forty-six other populations—including U.S. restaurants, small businesses, creative companies, inventors, scientific figures, investment/law/finance firms and production/distribution businesses—do **not** automatically have one valid comparable public Top 50. Different cohorts have incompatible coverage, geography, measurements, reporting years, currencies and data rights.

A **comparison plan** must specify its unit, reporting period, jurisdiction, metric, evidence and ranking direction and remain unverified until independent research review. Relevant authoritative sources:

- NIST SP 811, *Guide for the Use of the International System of Units (SI)*: https://www.nist.gov/publications/guide-use-international-system-units-si — physical dimensions/measurement notation; not a validation that U.S. revenue is reported in comparable currencies.
- W3C PROV-O: https://www.w3.org/TR/prov-o/ — distinguish source entities, research activities and accountable agents; a `sourceId` string alone proves none of them.
- SBA size standards: https://data.sba.gov/dataset/small-business-size-standards — the definition of 'small' depends on NAICS, receipts/employees and affiliates, not a generic U.S. company table.
- Census County Business Patterns: https://www.census.gov/programs-surveys/cbp/data.html — sector/establishment context, not a named U.S. 'best 50' list.
- SEC IAPD: https://adviserinfo.sec.gov/ — firm registrations and disclosures, **not** suitability or investment rankings.
- Fortune 500: https://fortune.com/ranking/fortune500/ ; Fortune 500 Europe: https://fortune.com/europe/ranking/fortune500-europe/ ; Fortune Global 500: https://fortune.com/ranking/global500/ ; Forbes Real-Time Billionaires: https://www.forbes.com/real-time-billionaires/ — separate publisher ranking families, excluded from this **custom ranking candidate builder**.

## New engineering module

`lib/sonara-research-comparable-top50.cjs` exports:

- `MEASURES`: ten strict, typed measure keys, with compatible units and subject kinds (revenue, employees, annual output, on-time delivery rate, gross margin rate, annual grantmaking, authored works, citations, patents and audience counts).
- `planComparableTop50(request)`: non-networked, bounded research intake and reproducible sorting across at most 500 entries. A valid intake contains a recognized Atlas category, one declared metric/unit/year/geography/direction, a caller-supplied review date, and individual records with **exactly** `entityId`, `value`, `metric`, `unit`, `period`, `geography`, `evidenceId`, `observedAt`. The IDs are opaque, sanitized tokens rather than names/PII. Unexpected object fields, duplicated entities, impossible dates, future/unfinished annual periods, incomparable units/periods/geographies, nonfinite values, negative measures, oversized arrays and invalid ratios fail closed.
- If fewer than 50 distinct observations pass, **no candidate list** is returned. At 50+, `candidateTop50` is only a provisional value-sorted sample. It uses competition ranks with equal numeric scores (1, 1, 3), reports ties across the 50th cut and never resolves a boundary tie as definitive. The input array is not mutated.
- Crucially, the output always says `rankingVerified:false`, `populationVerified:false`, `sourceVerified:false`, `officialPublisherRanking:false`, `publicationAuthorized:false`, `productionAuthorized:false`, `automatedIngestionAllowed:false` and `customerDecisionAuthorized:false`. Each result carries mandatory blockers for sampling, source evidence, licensing, metric semantics, human approval and release; small-business cohorts additionally flag SBA size eligibility and regulated professions receive specialist review.
- **Annual timing:** fiscal/calendar year definitions vary; this first conservative model rejects future years and the current year for `annual_*` measures because its input schema cannot prove a finalized fiscal period. Future coverage requires an explicit audited fiscal-period start/end schema and accounting standard. For point-in-time measures, a declared current-year reporting value can be accepted but remains unverified.

### Example usage (illustrative synthetic data only)

```js
const { planComparableTop50 } = require("./lib/sonara-research-comparable-top50.cjs");
const synthetic = Array.from({ length: 50 }, (_, i) => ({
  entityId: `example_${i + 1}`, value: i + 1,
  metric: "employee_count", unit: "persons", period: "2026",
  geography: "US", evidenceId: `sample_${i + 1}`,
  observedAt: "2026-10-01"
}));
const report = planComparableTop50({
  categoryId: "us_restaurants", metric: "employee_count",
  unit: "persons", period: "2026", geography: "US",
  reviewedAt: "2026-10-09", observations: synthetic
});
console.log(report.candidateTop50.length); // 50 unverified synthetic candidate rows
console.log(report.productionAuthorized); // false
```

**No evidence certification:** An `evidenceId` is caller-authored metadata, not an attestation, a checked SEC filing, an executed PROV-O activity, an independently verified financial statement, an audited intellectual-property license or permission to publish third-party material. A numeric, comparable ordering can still be biased, based on an incomplete population, materially misleading, or inapplicable to 'best of' quality rankings.

### Verification scope

A targeted suite of **14 assertions passed in an isolated JavaScript V8 harness** against the exact proposed source blob and the actual committed SONARA Atlas/formula registry. Negative cases cover absent cohorts, mixed units/periods/geographies, future/invalid dates, unclosed annual reporting years, duplicate IDs, leaked extra personal fields, ratio ranges, unbounded values, publisher ranks, regulated domains, deterministic tie ordering, and release locks. Deliberate mutations of annual-year and production-authorization guards caused targeted tests to fail. **This is not the repository's native Node 24, Mocha/pnpm, CI, DB/RLS, performance, security or production proof.**

### Next controlled implementation

1. **P0 release:** recover GitHub Actions runner scheduling and full exact-head test evidence; protect `main`; approve controlled, audited deployment separately. Do not 'mark green' a draft branch.
2. **P1 evidence model:** signed reviewer metadata/rights decision, provider terms, independently checked documents, immutable source hashes, authorized source edition, confidence bands and stale-source revision history. Distinguish data ingestion rights from redistribution.
3. **P1 measurements:** add measurement dictionaries, NAICS cohort scope, fiscal end dates, unit conversion where technically valid and rounding uncertainty/precision rules (especially financial currencies). Reject unconstrained negative costs/units and arbitrary cross-currency comparisons.
4. **P1 business value:** Business Builder restaurant supplier and financial benchmarks; Creator Studio licensed production/publishing and scientific audio/media quality; Growth Studio privacy-compliant marketing statistics. Never infer that a publisher list of 50 firms provides all suppliers' prices, licensed media assets, or customer consent.
5. **P2 user interface:** authenticated, tenant-safe read-only Atlas table and transparent methodology cards, accessible keyboard/screen reader support, cache/provenance and request budgets. Do not publish actual ranking entries until source permissions and review pass.
6. **P2 sector pilots:** synthetic/reference datasets first, then explicitly approved organizations in restaurant, trades, logistics, creators and nonprofits; estimate hosting, support, data-license and legal review cost before activation.
