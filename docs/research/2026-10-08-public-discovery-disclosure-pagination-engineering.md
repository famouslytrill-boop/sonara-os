# SONARA Public Discovery: disclosure, pagination and trust engineering
**Research and source pass:** 2026-10-08. Status: review-only; discovery selector is NOT currently registered as a production route.

## User-controlled discovery, from published research
TikTok's November 2025 disclosure/Manage Topics update and July 2026 transparency update highlight user AI-content controls, provenance, creator labeling and combating generated-content spam:
- https://newsroom.tiktok.com/more-ways-to-spot-shape-and-understand-ai-generated-material?lang=en-150
- https://newsroom.tiktok.com/helping-people-spot-and-understand-aigc-on-tiktok?lang=en-150
- https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content/

U.S. FTC guidance requires advertising/endorsement material relationships to be disclosed visibly, near the endorsement, rather than buried in a profile or a distant footnote:
- https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews

These are research references, not evidence that SONARA implemented a legal disclosure workflow or that another company's proprietary ranking formula is known.

## Defects addressed in this PR
1. **False content classification:** an untrusted/missing sponsorship value was previously coerced to `false` using `c.sponsored === true`, and absent AI-generation metadata was similarly represented as non-generated content. Now the server-supplied public projection must provide **boolean** metadata for both; unknown labels are ineligible to be displayed. This does not substitute for actual seller-content rights reviews or independent advertising-disclosure checks.
2. **False pagination promise:** `hasMoreCandidates` previously compared raw moderated candidates with displayed output. Publisher-diversity caps remove extra candidates; the flag could be true when every remaining candidate was excluded. Now the selector checks for at least one further **eligible** candidate after the display limit. The page indicator stays false when a diversity cap exhausts the pool. No cursor, next-page retrieval or personalized activity tracking is created by this patch.
3. Test coverage: existing `tests/free-platform-surface-policy.test.js` receives disclosure and diversity pagination regression cases; no new Mocha test file increases the generated handoff file-count contract.

The branch changes only `lib/sonara-community-discovery.cjs`, its existing test file and this note. It cannot affect checkout, payout, database migration, posting or real notifications.

## Trust gates for future runtime wiring
All data must originate from a **server-authored** projection after verifying: public visibility, published state, rights clearance, moderated approval, territory, age eligibility, current creator block status, current viewer topic preferences, current subscription/follow rules and explicit personalized-feed consent. User-supplied booleans are not authorization.

Show public labels **Sponsored** and **AI-generated** within the content card itself, not just as JSON flags. Allow creator appeal and correction of disputed metadata while content remains restricted until verified. Separate paid-placement disclosures from neutral organic ranking. Expose an accessible chronological feed option, persistent user block/mute controls and an explanation for the main reason each eligible item was shown.

Error behavior: missing block preferences, unknown rights state, malformed source, provider read failure or inconsistent user consent yields a visible unavailable state; do not fall back to showing content that would otherwise be blocked. Cache identity-based decisions only with verified tenant/user scope, short expiry and invalidation on block/role changes.

## Evaluation and operations acceptance matrix
| Test | Expected result | Proof |
| --- | --- | --- |
| Unknown promoted/AI classification | Excluded, not falsely rendered as organic/human | Four strict-boolean negative cases |
| Three items, one publisher, max two per publisher | Two outputs, `hasMoreCandidates=false` | Regression test |
| Eligible third-party item after diversity-excluded items | Two visible + `hasMoreCandidates=true` | Regression test |
| Chronological mode with more posts | Correct next-item signal, no discovery cap | Regression test |
| Blocked publisher or overlarge blocklist | Never leaks blocked content | Existing negative tests |
| No personalization consent | Deterministic chronological availability; personalized mode refused | Existing tests |
| Worker/provider timeout | No partial unmoderated result, bounded retry and clear error | Pending integration test |
| Keyboard/screen-reader/zoom/reduced motion | Navigation and inline labels announced meaningfully | Pending browser/assistive-technology proof |
| Two-tenant read audit | Only server-authorized public projections, no private metadata | Pending RLS/API adversarial test |
| High cardinality traffic | p95 latency, bounded CPU, correct backpressure, safe caching | Pending benchmark |
| Moderation and advertising challenge | Report, appeal, human decision and visible sponsor identification | Pending application work |

Ranking is a testable **SONARA heuristic**, never a claim to use TikTok/Meta's secret weights. Log version and explainable reason without sensitive clickstream leakage; test for demographic and creator diversity with an appropriate privacy review. An opt-in feed algorithm must not be optimized exclusively for addictive engagement. Cost modeling should measure eligible items per scan, cache hit ratio, update invalidations and aggregate query work; estimates are not measured performance.

## P0 release constraints
Main `9d141e68d1ec14c037f92d1eebb3c2718d583c0a` was unprotected and red at this research pass. Existing stacked PRs #545 (guarded RLS replay), #547 (license diagnostics), and #549 (merge_group checks) own their respective P0 repairs. The owner must enforce branch rules before merging. The new discovery tests may pass independently while full `sonara-industries` / native replay remains blocked. Do not call a code-ready module a launched social product.

Related official guidance:
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://api-security.owasp.org/editions/2023/en/0x11-t10/
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
