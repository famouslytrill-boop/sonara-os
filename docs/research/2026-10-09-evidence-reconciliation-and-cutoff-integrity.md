# SONARA Research Atlas — Evidence Reconciliation and Top-50 Cutoff Integrity
**Date:** 2026-10-09 (America/New_York) · **Release state:** draft code only, not deployed or approved

## Engineering problem and result

Phase 14 could sort comparable numeric samples to propose a "Top 50" but:
1. A numeric tie across the 50th-place cutoff produced a list selected partly by lexical entity ID. Although it signaled a tie, showing exactly 50 could misleadingly conceal an equally eligible 51st record.
2. Each observation's `evidenceId` was caller supplied and not reconciled with referenced source metadata. Numeric consistency does not establish factual accuracy, independent source verification, copyright permission or reviewer identity.

**Fix:** `lib/sonara-research-comparable-top50.cjs` now *withholds the entire candidateTop50 when a cutoff tie exists*. `lib/sonara-research-evidence-reconciliation.cjs` adds `reconcileComparableEvidence({comparison, receipts, maxAgeDays})`, a bounded, non-networked evidence triage. This uses the **existing** `planComparableTop50` and canonical `auditEvidencePacket`, not another ranking/evidence algorithm.

### Exact request semantics

`comparison` is the existing strict request with metric, currency/unit, reporting year, geography, review date and up to 500 observations. `receipts` is an array of up to 500 objects with exactly:
- `entityId` — opaque non-personal observation identifier
- `evidenceId` — must equal the identifier on that entity's measurement record
- `sourceUrl` — HTTPS reference subject to canonical evidence-intake checks, **not actually fetched**
- `stance` — `supports` or `contradicts`
- `observedAt` — caller-dated source observation

Outputs aggregate counts only: submitted/accepted/rejected receipts; matched, unmatched, contradicted and stale measurements; reused evidence IDs; tie and source-validation blockers. Raw URLs, unrelated extra object properties and customer personal details are **not** reproduced in the result.

The returned flags **always** remain `evidenceIndependentlyVerified:false`, `reviewerIdentityAuthenticated:false`, `publisherRightsVerified:false`, `allSourcesRetrieved:false`, `rankingVerified:false`, `publicationAuthorized:false`, `productionAuthorized:false` and `customerDecisionAuthorized:false`.

No exact source data or customer database is read or written. No web crawler, ranking publisher export, provider credentials, personal profiles, payment action, social distribution or autonomous process is activated.

### Why source identity, measurement and owner review remain separate

The W3C [PROV-O model](https://www.w3.org/TR/prov-o/) distinguishes entities (evidence), activities (review or derivation) and agents (accountable people/services). A receipt identifier without an authenticated actor or verified source does not satisfy those relationships. NIST's [SI guide](https://www.nist.gov/publications/guide-use-international-system-units-si) explains unit conventions; a declaration of `usd`, `persons` or `fraction` does not prove two real-world sources follow the same accounting basis, reporting scope, fiscal period or sampling definition.

These controls apply differently to each category: Fortune/Forbes official publisher lists remain in the separate licensed source gate; restaurant, small-business, manufacturing, logistics and hospitality benchmarking needs a coherent operator cohort; artists, authors and scientists need defensible critical or bibliometric methods rather than sales-based rankings; music/composition and recording rights must not be conflated; SEC adviser disclosure and legal professional directories are not performance rankings.

## Test evidence

- **8/8 native Node 22.16.0** targeted tests in a local directory exercised the new module with controlled dependencies, including missing receipts, all-receipt metadata, invalid/private fields, mismatched IDs, contradictions, reused evidence ID, size guards and cutoff status. The Git blob hashes of the committed module/test are compared against those locally tested source files.
- **Five integrated scenarios** using exact SONARA GitHub source in isolated V8 with a simulated WHATWG URL and cryptography dependency: full receipt set, four missing receipts, source contradiction, rejected private/invalid URL and withheld 50th-place tie. All behaved as expected.
- The existing 14 comparator tests gained a stronger cutoff-tie assertion. These results are **not** full Node 24, `pnpm`/Mocha, security scans, DB/RLS replay, publisher fact-checking or customer launch evidence.

## Commercial engineering path

1. **P0:** Resolve issue #579 GitHub Actions execution. Require actual complete green exact-head CI, protected main, independent code review, DB/security checks, and an approved staged deployment. No bypasses or false release claims.
2. **P1:** Build authenticated reviewer workflow with source edition, original document identity, dates, content hashes, licensed rights decision, provider terms, signed reviewer identity, contradicting revisions and source retention/deletion. Do not convert caller-supplied IDs into trust.
3. **P1:** Add domain-specific fiscal period definitions, validated measurement units, statistical uncertainty and NAICS/industry cohort criteria. For a tie at rank 50, publish neither arbitrary winner nor official rank until a defensible ranking standard is approved.
4. **P2:** Connect only licensed and authorized sources to a read-only Research Atlas interface with tenant RLS, moderation/accessibility, audit, revocation and citation histories. Require owner approval for publication and regulated advice.
5. **P2:** Apply to restaurant inventory/operator benchmarks, production/distribution logistics, creator publishing/rights, scientific literature, philanthropy and growth analytics under synthetic or consented pilots with cost-to-serve tracking.

**Financial/copyright boundary:** SONARA is a software platform, not a bank, hedge fund adviser, investment intermediary, law firm or record label by virtue of this research module. Listings and URLs never grant permission to trade, distribute copyrighted recordings or advise regulated decisions.
