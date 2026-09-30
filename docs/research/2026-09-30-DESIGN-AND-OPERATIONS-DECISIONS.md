# SONARA design and operations decisions — 30 September 2026

## Status and decision

This is the first bounded implementation of the owner's 30 September research brief, not a claim that the full redesign is complete. Baseline: `42964583fcad6801384ef3f5078c704d4ca47234`, freshly fetched from origin/main. The GitHub open-PR search returned no records during this pass; there were no open changes to consolidate at that point.

Decision question: which newly checked design and engineering patterns improve a real SONARA customer task without introducing a second application shell, fake records, an unreviewed dependency, or an unreachable capability?

The owner's request supersedes earlier aesthetic recommendations. It does not establish that deleting working authentication, records, or security boundaries improves the product. A replacement must demonstrate the same customer journeys before the existing implementation is retired. This pass installs no third-party code and changes no production database or provider configuration.

## Evidence matrix

Sources checked 2026-09-30. Retrieval date is not publication date. Recommendations below are SONARA judgments, not vendor endorsements or measured conversion outcomes.

| Source / verified fact | Implication for SONARA | Confidence and limitation |
| --- | --- | --- |
| [Shopify changelog](https://shopify.dev/changelog/posts/polaris-2-0-release-candidate), published 2026-09-24: Polaris 2.0 is a release candidate for embedded App Home | Study merchant task hierarchy and consistent components; do not blindly adopt an older Polaris React recommendation | High on release status; no evidence it fits this Express application |
| [Polaris references](https://shopify.dev/docs/api/polaris): App Home interfaces have supported integration surfaces | Keep an external Shopify integration distinct from SONARA's own product shell | High on documented scope; commercial integration is not implemented here |
| [GOV.UK complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/): simplify first; use task lists for longer, multi-session transactions | Business onboarding should resume actual saved tasks with explicit completion states | High; task lists are not appropriate for every short action |
| [Xbox guideline 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117), updated 2026-03-04: provide controls to stop distracting motion | A cinematic marketing surface must stop immediately when the person opts out | High; gaming guidance informs the interaction but is not web conformance certification |
| [Material transitions](https://m3.material.io/styles/motion/transitions/applying-transitions): transitions should respect accessibility settings and maintain stable layouts | Use motion for orientation and state changes; preserve a static experience | High for guidance, unmeasured for SONARA task completion |
| [Adobe Spectrum](https://spectrum.adobe.com/): shared components and token foundations support cohesive applications | Share semantics and accessible primitives across products while varying composition and identity | High on stated system purpose; no Spectrum code imported |
| [Uber Base](https://base.uber.com/6d2425e9f/p/6d2425e9f): a design system spans an ecosystem of products and services | A shared interaction vocabulary need not make all three SONARA products look identical | Medium; current source summary was available, detailed page extraction limited |
| [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): 24 CSS-pixel minimum has specified exceptions and spacing alternatives | Prefer generous controls; verify size, spacing, keyboard use and focus rather than checking one number | High; a target-size pass alone is not a complete accessibility audit |
| [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests): keys support safe retries subject to documented behavior | Treat retry identity and business-operation identity explicitly; never infer exactly-once delivery | High; SONARA production payments were not revalidated in this pass |
| [Stripe webhooks](https://docs.stripe.com/webhooks): webhook processing has signature verification and delivery considerations | Verify signatures, deduplicate persisted events and reconcile provider state | High; requires integration evidence, not a new visual badge |
| [OWASP object authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/): object IDs create authorization attack surfaces | Every record read, write, file and export must check the current tenant and actor | High; a threat pattern, not evidence that every SONARA endpoint is secure |
| [FFmpeg documentation](https://www.ffmpeg.org/ffmpeg.html): bitexact options exist | Investigate reproducible media exports with pinned inputs and tools | High on option existence; does not establish universal cross-platform binary determinism |

Contradictions actively checked: Polaris is an embedded-app release candidate rather than a universal replacement foundation; task lists can add unnecessary complexity to short flows; continuous animation can harm readability; media bitexact options do not guarantee arbitrary hardware and codec combinations produce identical bytes. Apple motion guidance was located but its full JavaScript-rendered page was not extracted. Carbon's empty-state page and Spectrum's motion page failed retrieval, so neither supports a detailed claim here. Netflix and Airbnb historical articles surfaced in search but were not used to assert current 2026 implementation details.

## Brand and market decisions

Keep SONARA Industries as parent, SONARA One as platform, and Business Builder, Creator Studio, and Growth Studio as distinct products. The parent explains the relationship and directs people to a product. Each child needs its own landing narrative, setup sequence, task vocabulary and working composition. Account identity, tenant membership and billing authority remain shared.

The following are proposed visual directions, not implemented replacements or experimentally proven palettes:

| Surface | Proposed composition | Customer outcome | Palette exploration |
| --- | --- | --- | --- |
| Parent | Editorial product overview with one restrained cinematic brand scene | Understand which product solves the immediate need | Graphite, ivory and one restrained spectral accent |
| Business Builder | Daily work list, schedule, records and visible next actions | Finish today's business task and recover interrupted work | Ink, warm neutral surfaces and copper accents |
| Creator Studio | Asset browser, preview, project timeline and export status | Turn owned source material into an inspectable output | Obsidian, plum and restrained coral |
| Growth Studio | Campaign steps, audience eligibility, experiment and outcome views | Understand what was sent, to whom, and what happened | Deep teal, neutral surfaces and lime accents |

Semantic status colors must remain consistent and have labels; brand color is not a substitute for error, success or pending state. All proposed combinations need measured contrast in light, dark, high-contrast and disabled states. Logos require original vector construction, small-size and monochrome checks, and a separate visual review; no new logo was created by this patch.

Marketing hypothesis: an affordable product that demonstrably completes a small business task will be easier to explain than a claim to replace every major software category. Test this rather than claiming it. For the first validation cohort, compare task completion, time to first saved output, repeat weekly use, support requests and paid retention. Measure successful outcomes per eligible visitor; do not optimize animation engagement as a proxy for customer value.

Potential moat: accumulated permissioned records, reliable cross-product workflows, useful industry templates and low support burden. This is a strategy hypothesis. Neither a large research register nor a visually impressive interface proves customer adoption, network effects or switching value. Preserve customer export rights rather than manufacturing lock-in.

The attachment's market-cap figures, app rankings, audience counts, agency prices and broad “best company” labels are not accepted as verified facts. They are unnecessary to the implementation decision. No ranking or revenue inference was used to select a framework.

## Route and workflow contract

Use the existing `lib/sonara-route-registry.cjs`, not a parallel registry. Existing route anchors inspected in this pass include `/`, `/products`, the three product landing pages, `/account/setup`, `/account/workspaces`, `/account/integrations`, `/billing`, `/support`, `/business-builder/dashboard`, `/business-builder/checklist`, `/business-builder/owner/bookings`, and `/business-builder/owner/products`. Listing a route proves a declaration, not a complete production transaction.

Before exposing any additional action, record its originating screen, destination or API method, permission, input validation, persisted entity, success receipt, recoverable failure and test. A redirect to login is an authentication behavior, not proof that the task works after login. Read-only tasks need no invented database write. Multiple legitimate entry links may converge on one canonical destination; avoid duplicate implementations rather than forbidding useful links.

Empty customer data is legitimate. A new account should have an explanation and a real create/import action, not fabricated customer rows. Distinguish loading, no records, no search results, missing configuration, insufficient permission and upstream failure. Never convert a failed read to a successful empty list. Operational setup belongs in an actionable configuration flow rather than in a button claiming to generate a deliverable.

## Deterministic and optional-provider boundaries

| Capability | Non-generative baseline | Evidence required before claiming completion |
| --- | --- | --- |
| Business calculations | Versioned formulas, units, rounding, validated inputs and saved results | Boundary cases and reproducible calculation fixtures |
| Video | User-owned clips, explicit edit decisions, fixed render settings and export receipt | Decodeable output, timestamps, duration and repeatability test under a pinned runtime |
| Audio/music | Owned recordings or licensed samples, score/event data, explicit processing | Playable output and sample-rate/channel/peak validation |
| Translation | Human-editable translations, locale catalogs and controlled terminology | Coverage and fallback checks; never label untranslated text translated |
| Speech | Recorded audio with explicit transcript; optional separately governed speech adapter | Consent, playable output, transcript correspondence and clear unavailable state |
| Maps/scheduling | Saved locations, timezone-aware appointments and explicit routing inputs | Permission denial, stale location, DST and routing-provider outage behavior |
| Agents/RAG | Permission-filtered retrieval, cited records, bounded actions and approval states | Tenant rejection, stale-document handling, replay, retries and spend limits |

Deterministic control flow means a versioned decision is reproducible from its declared inputs. External services, clocks, concurrent events, browser speech, GPU rendering and model output need recorded inputs/results or narrower guarantees. A fallback should deliver its stated smaller capability, not invent a successful external operation.

## Industry expansion map

These are requirements to investigate against current code, not newly shipped industry products.

| Requested group | Reusable domain model | Additional proof needed |
| --- | --- | --- |
| Restaurants, retail, ordering, POS, kiosk | Orders, line items, stock, payment references and fulfillment states | Device/payment support, reconciliation, refunds and offline collision handling |
| Trades, cleaning, waste services | Jobs, estimates, appointments, crews, locations and completion evidence | Dispatch changes, cancellation, customer access and job-cost reconciliation |
| Trucking, delivery, transport | Vehicles, stops, assignments, trip events and location freshness | Real routing integration, consent, provider limits and operational requirements |
| Rentals, venues and real estate | Resources, availability, bookings, contracts and deposits | Double-booking prevention and controlled payment transitions |
| Creator media, books, podcasts, streaming | Projects, assets, rights, revisions, render jobs and publishing receipts | Real exports, storage lifecycle, provider permissions and recovery |
| Manufacturing, robotics and CAD | Jobs, specifications, inventory and external artifact references | Specialist tool integration and domain validation; no general replacement claim |
| Finance, insurance, government and health | Permissioned records, approvals and audit trails | Domain-specific legal and operational validation before service claims |
| Social, communities, learning and games | Profiles, content, permissions, moderation and progression | Abuse controls, accessibility, consent and actual delivery infrastructure |

Researching Sony, Marvel, Rockstar, DC, Honda, Fortnite, TikTok, Suno, Activision, Meta, Amazon, Google, Apple, Ford, Chevrolet, Nintendo, Walmart, Netflix, Vizio, TCL, PlayStation, Reddit, Uber, Lyft, quick-service restaurants, Spotify, Tesla and SpaceX is not one interchangeable benchmark. Future passes should examine one observable flow per relevant category and record its date, source and SONARA task fit. Most named companies have not been inspected in this pass. “Fluido TV” and “2B” remain unresolved names; do not silently substitute a guessed company.

## Implementation delivered in this branch

`public/sonara-depth.js` previously removed scroll/pointer listeners during teardown but left scheduled animation frames alive. A pending scroll frame could restore `--sonara-hero-depth` after motion was disabled. The new regression test executes the real script with a queued-frame scheduler. It failed on the unchanged code with a restored value of `10.0` where no value should exist.

Teardown now cancels both pending frame handles and resets them. The same test verifies visible content and successful motion re-enablement. Existing entrance and marketing-surface tests were also run. Shared asset versions are advanced so the service-worker cache does not keep the prior script.

This fixes one prerequisite for the requested cinematic experience. It does not constitute the whole redesign, full browser accessibility proof, every-industry support, a migration, production activation, or customer shipping readiness. Repository readiness prose includes dated observations and must not be presented as freshly measured production state.

## Next implementation sequence

1. Capture current signed-in and signed-out journeys with representative account states; establish task and performance baselines.
2. Review three visual directions against the owner's new brief, including separate child-product compositions and original identity work.
3. Implement one complete journey per product using existing routes and data authority; include empty/error/permission and recovery states.
4. Compare the new journey against the baseline on mobile, keyboard, reduced motion, slow connections and real outputs.
5. Retire replaced code only after callers, routes, data dependencies and rollback are accounted for.
6. Complete exact-commit CI, intentional merge and controlled deployment, then validate the live commit and current paid/auth/tenant paths.

No production migration is justified by this motion fix. Broader schema changes need reviewed entity relationships, migration replay and tenant-access tests. Never merge unrelated PRs merely because they are open or alter tests merely to make the suite green.
