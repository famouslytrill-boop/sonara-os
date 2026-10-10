# SONARA all-PR consolidation candidate — 10 October 2026

> **Continuation:** #618 and #615 were subsequently merged on GitHub. The [remaining-PR pass](remaining.md) includes all original intake heads and reports 8,676 passing / 76 failing tests. The original decisions below are historical; no release approval is implied.

Intake: **107 open pull requests**, including **104 drafts**, and **45 discussion/review comments**. The complete source descriptions and comment text are retained in `source-review.json`. Intake does not mean acceptance.

Branch: `upgrade/all-pr-consolidation-20261010`. Base: `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`. **94 source heads are ancestors of this candidate**. The other 13 heads overlap newer canonical fixes and require explicit equivalence review before closure.

## Integration decisions

- Keep the hardened RLS catalog from #617; do not replay obsolete policy rewrites or assume preview-only duplicate policies exist in a fresh database.
- Keep tenant-bound billing, verified Stripe Price mappings and strict paid-access evidence from #565. Older paid-access fixtures must not cause relaxed access checks.
- Combine audio imports, aligned WAV stems, MIDI formats 0/1, bounded camera cleanup, sensor consent, project beat grids, editorial previews and world-bible routes.
- Combine provider retries, worker readiness, receipt accounting, inventory journals and recovery diagnostics while retaining owner review and default-off activation.
- Consolidate explicit PWA update consent with anonymous, MIME-checked public caching and authoritative cache revocation. Existing pages are not automatically taken over.
- Preserve main migration SQL and hashes. Three competing version pairs required consolidation: choose the broader canonical closed-RLS migration from #520; rename the new engineering seed to `20261010181849_seed_engineering_formulas.sql`; rename the new stock journal to `20261010181900_versioned_stock_adjustment_journal.sql`. Renamed SQL bytes are unchanged; source pins and references follow the filenames.
- Restore motion runtime globals, align reviewed Actions pins, regenerate skill bridges and counts, register new abuse ceilings with a specific parser-budget exception, and show unavailable integration history when reads fail.

## Validation and remaining blockers

- Frozen pnpm install passed. Moderate dependency audit reported no known vulnerabilities.
- Typecheck and build passed. Final lint passed with zero warnings. Migration checksum and environment classification checks passed.
- Full-suite sequence: initial **8,619 passed / 118 failed**; final **8,651 passed / 6 pending / 95 failed**. `validation-failures.json` records every remaining failed case. Main merge is blocked.
- **27 focused regressions passed** for motion capture, reviewed action pins, pure preview versus external adapters, integration readiness, and offline model skill packages.
- Remaining failures include capability route/data and OpenAPI coverage, competing RLS fixture assumptions, exact-head workflow expectations, stale paid-access/provider receipts fixtures, social-consent contracts, formula input aliases, and offline-cache tests. Investigate each; do not skip tests or loosen permission checks to obtain green CI.
- Native PostgreSQL replay and cross-browser CI have not been executed locally. They must pass on the exact consolidation head before merge.
- No production deployment, remote migration, source-PR closure, branch-protection change, or main merge has been performed.
- The attempted Supabase migration CLI was rejected by automatic approval review because it tried to send telemetry to an untrusted PostHog endpoint. No retry was made. Migration collision repair used local file operations instead.

## Source PR ledger

| PR | Description | Candidate disposition | Review comments |
| --- | --- | --- | --- |
| [#508](https://github.com/famouslytrill-boop/sonara-os/pull/508) | fix(ci): repair post-consolidation release and native RLS replay contracts | Included by ancestry | 1 |
| [#509](https://github.com/famouslytrill-boop/sonara-os/pull/509) | research: Reddit customer evidence + correct activation-event chronology | Included by ancestry | 0 |
| [#510](https://github.com/famouslytrill-boop/sonara-os/pull/510) | feat(reliability): signed recovery sensors, durable anti-replay and fenced retry controls | Included by ancestry | 0 |
| [#511](https://github.com/famouslytrill-boop/sonara-os/pull/511) | fix(worker): require unique, scoped evidence before canary activation | Included by ancestry | 0 |
| [#512](https://github.com/famouslytrill-boop/sonara-os/pull/512) | fix(outbox): reject malformed or cross-tenant PostgREST receipts | Included by ancestry | 0 |
| [#513](https://github.com/famouslytrill-boop/sonara-os/pull/513) | Recover exact-head CI after consolidated RLS hardening | Superseded by #617; equivalence pending | 0 |
| [#514](https://github.com/famouslytrill-boop/sonara-os/pull/514) | fix(mobile): separate US Play external content links from alternative billing | Included by ancestry | 1 |
| [#515](https://github.com/famouslytrill-boop/sonara-os/pull/515) | fix(media): fail closed on unplayable camera previews across browsers | Superseded by #616; equivalence pending | 0 |
| [#516](https://github.com/famouslytrill-boop/sonara-os/pull/516) | fix(release): attest every required exact-SHA CI job before production access | Included by ancestry | 2 |
| [#517](https://github.com/famouslytrill-boop/sonara-os/pull/517) | Revoke browser grants from reviewed server-only tables | Superseded by #520; equivalence pending | 1 |
| [#518](https://github.com/famouslytrill-boop/sonara-os/pull/518) | fix(release): bind required GitHub job evidence to exact main branch and SHA | Included by ancestry | 1 |
| [#519](https://github.com/famouslytrill-boop/sonara-os/pull/519) | fix(ci): reconcile P1 RLS replay with hardened policies and Mocha inventory | Superseded by #617; equivalence pending | 0 |
| [#520](https://github.com/famouslytrill-boop/sonara-os/pull/520) | db: remove browser SQL privileges from closed RLS tables | Included by ancestry | 2 |
| [#521](https://github.com/famouslytrill-boop/sonara-os/pull/521) | fix(release): require exact-commit three-browser acceptance before production | Included by ancestry | 1 |
| [#522](https://github.com/famouslytrill-boop/sonara-os/pull/522) | db: move pgvector out of the exposed public schema | Included by ancestry | 1 |
| [#523](https://github.com/famouslytrill-boop/sonara-os/pull/523) | security(release): restrict production secrets to consuming GitHub Actions steps | Superseded by #525; equivalence pending | 1 |
| [#524](https://github.com/famouslytrill-boop/sonara-os/pull/524) | db: put privileged RLS helper logic behind a private schema | Included by ancestry | 0 |
| [#525](https://github.com/famouslytrill-boop/sonara-os/pull/525) | DRAFT: Unify exact-SHA job attestation with three-browser production gate | Included by ancestry | 1 |
| [#526](https://github.com/famouslytrill-boop/sonara-os/pull/526) | fix(P0): verify pre/post RLS migration semantics and resync Mocha handoff | Superseded by #617; equivalence pending | 0 |
| [#527](https://github.com/famouslytrill-boop/sonara-os/pull/527) | fix(marketplace): never hide duplicate licence grants or contradictory Stripe evidence | Included by ancestry | 0 |
| [#528](https://github.com/famouslytrill-boop/sonara-os/pull/528) | recovery: stop treating schema checkpoints as customer-data backups | Included by ancestry | 0 |
| [#529](https://github.com/famouslytrill-boop/sonara-os/pull/529) | security: separate free-platform owner grants, UGC consent and marketplace rights | Included by ancestry | 0 |
| [#530](https://github.com/famouslytrill-boop/sonara-os/pull/530) | feat(research): integrated bounded game-math study tools across SONARA studios | Included by ancestry | 0 |
| [#531](https://github.com/famouslytrill-boop/sonara-os/pull/531) | security(platform): validate durable rate decisions and close unmetered scope gaps | Included by ancestry | 0 |
| [#532](https://github.com/famouslytrill-boop/sonara-os/pull/532) | fix(security): fail closed on paid entitlements and isolate runtime feature flags | Included by ancestry | 0 |
| [#533](https://github.com/famouslytrill-boop/sonara-os/pull/533) | fix(growth): reconcile uncertain Resend batches instead of replaying messages | Included by ancestry | 0 |
| [#534](https://github.com/famouslytrill-boop/sonara-os/pull/534) | perf: bound Business Builder and Growth source reads with tenant-safe failure handling | Included by ancestry | 0 |
| [#535](https://github.com/famouslytrill-boop/sonara-os/pull/535) | fix(platform): stop promising rollback when an API failure follows a write | Included by ancestry | 0 |
| [#536](https://github.com/famouslytrill-boop/sonara-os/pull/536) | fix(telemetry): prevent tenant identifiers and unbounded HTTP labels | Included by ancestry | 0 |
| [#537](https://github.com/famouslytrill-boop/sonara-os/pull/537) | security(release): prevent PR code from reaching production dry-run secrets | Included by ancestry | 0 |
| [#538](https://github.com/famouslytrill-boop/sonara-os/pull/538) | feat(ops): cross-industry capacity models, live DB profiling and handoffs | Included by ancestry | 0 |
| [#539](https://github.com/famouslytrill-boop/sonara-os/pull/539) | feat(ui): adaptive SONARA workspace shortcuts for Galaxy, Android and iPhone | Included by ancestry | 0 |
| [#540](https://github.com/famouslytrill-boop/sonara-os/pull/540) | security(platform): close production support limiter fallback and unify SONARA trust flows | Included by ancestry | 0 |
| [#541](https://github.com/famouslytrill-boop/sonara-os/pull/541) | docs(research): governed 80-screenshot intake and safe adoption plan | Included by ancestry | 0 |
| [#542](https://github.com/famouslytrill-boop/sonara-os/pull/542) | feat(research): wire verified Batch 26 tool intelligence into SONARA Research Lab | Included by ancestry | 0 |
| [#543](https://github.com/famouslytrill-boop/sonara-os/pull/543) | security(media): tenant-scoped preview plans and cryptographic output receipts | Included by ancestry | 0 |
| [#545](https://github.com/famouslytrill-boop/sonara-os/pull/545) | fix(P0 RLS replay): distinguish tracked subscription policies from remote-only drift | Superseded by #617; equivalence pending | 0 |
| [#546](https://github.com/famouslytrill-boop/sonara-os/pull/546) | security(offline): reject unbound location replay after session changes | Included by ancestry | 0 |
| [#547](https://github.com/famouslytrill-boop/sonara-os/pull/547) | P0: distinguish XcodeGen MIT tooling from proprietary SONARA; add verifier proof and ecosystem handoffs | Included by ancestry | 0 |
| [#548](https://github.com/famouslytrill-boop/sonara-os/pull/548) | Draft: Customer governance preflight, atomic execution claims and review safeguards | Included by ancestry | 0 |
| [#549](https://github.com/famouslytrill-boop/sonara-os/pull/549) | ci(P0): run required checks on merge-group SHAs and cancel only stale PR runs | Included by ancestry | 0 |
| [#550](https://github.com/famouslytrill-boop/sonara-os/pull/550) | fix(discovery): accurate diversity pagination and fail-closed content labels | Included by ancestry | 0 |
| [#551](https://github.com/famouslytrill-boop/sonara-os/pull/551) | feat(reliability): default-deny PostgreSQL operator approval and controlled recovery execution | Included by ancestry | 0 |
| [#552](https://github.com/famouslytrill-boop/sonara-os/pull/552) | Harden customer automations with durable weighted budgets and approval composition | Included by ancestry | 4 |
| [#553](https://github.com/famouslytrill-boop/sonara-os/pull/553) | Provider runtime: signed OAuth and Search Console read-only canary | Included by ancestry | 0 |
| [#554](https://github.com/famouslytrill-boop/sonara-os/pull/554) | Guard customer activation claims and define paid-delivery proof gates | Included by ancestry | 0 |
| [#555](https://github.com/famouslytrill-boop/sonara-os/pull/555) | security(platform): require canonical HTTPS origin for SONARA external links | Included by ancestry | 3 |
| [#556](https://github.com/famouslytrill-boop/sonara-os/pull/556) | Measure customer activation cohorts without invented retention or paid conversion | Included by ancestry | 2 |
| [#557](https://github.com/famouslytrill-boop/sonara-os/pull/557) | Provider broker: isolate Search Console Vault custody | Included by ancestry | 0 |
| [#558](https://github.com/famouslytrill-boop/sonara-os/pull/558) | fix(billing): shared SONARA subscription destination for all studios | Superseded by #565; equivalence pending | 1 |
| [#559](https://github.com/famouslytrill-boop/sonara-os/pull/559) | CI: bound runner occupancy and cancel superseded heads | Superseded by #600; equivalence pending | 0 |
| [#560](https://github.com/famouslytrill-boop/sonara-os/pull/560) | feat(workflows): deterministic sequencing and version-pinned scoped replay | Included by ancestry | 0 |
| [#561](https://github.com/famouslytrill-boop/sonara-os/pull/561) | Push reliability: customer opt-out and tenant-safe subscription revocation | Included by ancestry | 0 |
| [#562](https://github.com/famouslytrill-boop/sonara-os/pull/562) | PWA updates: prepare automatically, activate with consent | Included by ancestry | 0 |
| [#563](https://github.com/famouslytrill-boop/sonara-os/pull/563) | fix(platform): reconcile CI gates and harden transactional operations | Included by ancestry | 0 |
| [#564](https://github.com/famouslytrill-boop/sonara-os/pull/564) | security(billing): deny one-time Stripe receipts for subscription entitlements | Superseded by #565; equivalence pending | 1 |
| [#565](https://github.com/famouslytrill-boop/sonara-os/pull/565) | P0 integration: canonical billing, cross-studio portal and Stripe tenant authorization | Included by ancestry | 6 |
| [#566](https://github.com/famouslytrill-boop/sonara-os/pull/566) | feat(supply-chain): deterministic flows and staged atomic PO receipt ledger | Included by ancestry | 0 |
| [#567](https://github.com/famouslytrill-boop/sonara-os/pull/567) | Push delivery: deterministic Retry-After and expiration policy | Included by ancestry | 0 |
| [#568](https://github.com/famouslytrill-boop/sonara-os/pull/568) | Draft: Restaurant catering quotes, finance, events and SEO planning controls | Included by ancestry | 1 |
| [#569](https://github.com/famouslytrill-boop/sonara-os/pull/569) | Event consumer: provider-aware retries and strict claimed-event scope | Included by ancestry | 0 |
| [#570](https://github.com/famouslytrill-boop/sonara-os/pull/570) | Security: restrict PWA cache to public assets across SONARA products | Included by ancestry | 3 |
| [#571](https://github.com/famouslytrill-boop/sonara-os/pull/571) | Creator Studio: variable-tempo film/music beat grid and interchange | Included by ancestry | 0 |
| [#572](https://github.com/famouslytrill-boop/sonara-os/pull/572) | Social interaction, media safety and customer notification preflight | Included by ancestry | 0 |
| [#573](https://github.com/famouslytrill-boop/sonara-os/pull/573) | Implement signed-in channel blocking and auditable Growth moderation | Included by ancestry | 0 |
| [#574](https://github.com/famouslytrill-boop/sonara-os/pull/574) | Draft: deterministic restaurant seating, peak staffing and labor budget previews | Included by ancestry | 0 |
| [#575](https://github.com/famouslytrill-boop/sonara-os/pull/575) | Feature-gated creator user blocking, UGC reports and independent moderation intake | Included by ancestry | 0 |
| [#576](https://github.com/famouslytrill-boop/sonara-os/pull/576) | Draft: evidence-gated cross-suite decisions and consent-safe communication previews | Included by ancestry | 0 |
| [#577](https://github.com/famouslytrill-boop/sonara-os/pull/577) | Draft: payment method readiness reviews and non-wagering business simulations | Included by ancestry | 0 |
| [#578](https://github.com/famouslytrill-boop/sonara-os/pull/578) | Research: bounded restaurant → Creator → Growth → social-network planner | Included by ancestry | 0 |
| [#580](https://github.com/famouslytrill-boop/sonara-os/pull/580) | Draft P0 CI convergence: generated inventory, RLS baseline and rollback proof | Superseded by #617; equivalence pending | 0 |
| [#581](https://github.com/famouslytrill-boop/sonara-os/pull/581) | feat: deterministic labor, opportunity cost, trade and science formulas | Included by ancestry | 0 |
| [#582](https://github.com/famouslytrill-boop/sonara-os/pull/582) | fix: engineering formula CI pin, proprietary notice and RLS replay proof | Included by ancestry | 2 |
| [#583](https://github.com/famouslytrill-boop/sonara-os/pull/583) | feat: 36 deterministic STEM, social studies, arts, CAD and motion capture formulas | Included by ancestry | 0 |
| [#584](https://github.com/famouslytrill-boop/sonara-os/pull/584) | feat: shared unit-aware CAD, motion, media timeline and job-estimate pipeline | Included by ancestry | 0 |
| [#585](https://github.com/famouslytrill-boop/sonara-os/pull/585) | feat: safe read-only CAD, pose and linear takeoff estimation adapters | Included by ancestry | 0 |
| [#586](https://github.com/famouslytrill-boop/sonara-os/pull/586) | feat: default-off authenticated DXF, pose and takeoff preview API | Included by ancestry | 0 |
| [#587](https://github.com/famouslytrill-boop/sonara-os/pull/587) | Creator Studio: World Bible planning, guarded project persistence and Markdown export | Included by ancestry | 2 |
| [#588](https://github.com/famouslytrill-boop/sonara-os/pull/588) | feat: Creator Studio editorial workbench for notes, blogs, storyboards, gaming and travel | Included by ancestry | 0 |
| [#590](https://github.com/famouslytrill-boop/sonara-os/pull/590) | Security: prevent World Bible cross-origin writes and archived-parent race | Included by ancestry | 0 |
| [#591](https://github.com/famouslytrill-boop/sonara-os/pull/591) | Creator Studio Phase 3: safe World Bible cue CSV, OTIO and MIDI export | Included by ancestry | 0 |
| [#592](https://github.com/famouslytrill-boop/sonara-os/pull/592) | Creator Phase 4: narrative integrity reports, DOT graphs and game/story outlines | Included by ancestry | 0 |
| [#593](https://github.com/famouslytrill-boop/sonara-os/pull/593) | Creator Phase 5: author-controlled interactive story drafts and safe state preview | Included by ancestry | 0 |
| [#594](https://github.com/famouslytrill-boop/sonara-os/pull/594) | Creator Phase 6: atomic story revision persistence proposal and guarded author saves | Included by ancestry | 0 |
| [#595](https://github.com/famouslytrill-boop/sonara-os/pull/595) | Release gate repair: classify Creator flags and reconcile P1 post-hardening policy expectations | Included by ancestry | 0 |
| [#596](https://github.com/famouslytrill-boop/sonara-os/pull/596) | Creator Phase 8: fail-closed proposal-only Supabase contract with mutation tests | Included by ancestry | 0 |
| [#597](https://github.com/famouslytrill-boop/sonara-os/pull/597) | Creator Phase 9: native PostgreSQL proof of proposed story persistence on disposable clone | Included by ancestry | 0 |
| [#598](https://github.com/famouslytrill-boop/sonara-os/pull/598) | Creator Phase 10: two-session PostgreSQL story CAS and rollback proof | Included by ancestry | 0 |
| [#599](https://github.com/famouslytrill-boop/sonara-os/pull/599) | Creator Phase 9: source-backed route/data lineage for 13 worldbuilding endpoints | Included by ancestry | 0 |
| [#600](https://github.com/famouslytrill-boop/sonara-os/pull/600) | feat(device): complete explicit bounded motion capture | Included by ancestry | 3 |
| [#601](https://github.com/famouslytrill-boop/sonara-os/pull/601) | feat(governance): evaluate opted-in adaptive learning without autonomous execution | Included by ancestry | 0 |
| [#602](https://github.com/famouslytrill-boop/sonara-os/pull/602) | feat(social): fail-closed viewer feed controls and disclosure integrity | Included by ancestry | 0 |
| [#603](https://github.com/famouslytrill-boop/sonara-os/pull/603) | feat(social): stage authenticated consent-safe public feed reader | Included by ancestry | 0 |
| [#604](https://github.com/famouslytrill-boop/sonara-os/pull/604) | feat(integrations): add one-tenant read-only readiness worker | Included by ancestry | 0 |
| [#605](https://github.com/famouslytrill-boop/sonara-os/pull/605) | Research: source-grounded top-50 benchmark gates and applied-science roadmap | Included by ancestry | 3 |
| [#606](https://github.com/famouslytrill-boop/sonara-os/pull/606) | feat(social): plan viewer-owned privacy preferences with consent-safe CAS | Included by ancestry | 0 |
| [#607](https://github.com/famouslytrill-boop/sonara-os/pull/607) | feat(social): stage attested, content-bound public Growth projections | Included by ancestry | 0 |
| [#608](https://github.com/famouslytrill-boop/sonara-os/pull/608) | feat(social): verify dual-role signed moderation and rights attestations | Included by ancestry | 0 |
| [#609](https://github.com/famouslytrill-boop/sonara-os/pull/609) | feat(industries): bounded seasonal vertical workflows and operational consolidation | Included by ancestry | 0 |
| [#610](https://github.com/famouslytrill-boop/sonara-os/pull/610) | fix(ci): verify post-hardening RLS policies in native replay | Superseded by #617; equivalence pending | 0 |
| [#611](https://github.com/famouslytrill-boop/sonara-os/pull/611) | Creator Studio: professional WAV imports, 48 kHz handoff and waveform metering | Included by ancestry | 0 |
| [#612](https://github.com/famouslytrill-boop/sonara-os/pull/612) | Unify SONARA skills/formulas for Claude, ChatGPT and Codex with verified model profiles | Included by ancestry | 2 |
| [#613](https://github.com/famouslytrill-boop/sonara-os/pull/613) | Creator Studio: synchronized source-group WAV stem handoff | Included by ancestry | 0 |
| [#614](https://github.com/famouslytrill-boop/sonara-os/pull/614) | Creator Studio: user-authored MIDI Format 0 export and DAW handoff | Included by ancestry | 0 |
| [#615](https://github.com/famouslytrill-boop/sonara-os/pull/615) | Release P0: explain 25-policy RLS replay drift without weakening preflight | Superseded by #617; equivalence pending | 0 |
| [#616](https://github.com/famouslytrill-boop/sonara-os/pull/616) | Creator Studio: MIDI Format 1 conductor and independent named tracks | Included by ancestry | 0 |
| [#617](https://github.com/famouslytrill-boop/sonara-os/pull/617) | P0: reconcile fail-closed RLS native replay with already hardened policies | Included by ancestry | 0 |
