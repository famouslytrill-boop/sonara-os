# SONARA One — Cross-studio mathematical and simulation integration, October 8, 2026

**Status:** coded on draft PR #530, **not merged**, **not deployed**, **not available publicly; three bounded, stateless educational GET calculations are now implemented on the existing customer-authenticated research page, subject to release**. Existing invention-systems research catalog has been augmented with READ-ONLY metadata; no new API endpoint was added; the existing authenticated page now supports three fixed-schema, inexpensive customer-supplied examples. No migrations, database writes, provider accounts, billing hooks or platform permissions were changed.

## What changed

1. **lib/sonara-simulation-integration.cjs** is the new owned, dependency-free internal registry and dispatcher. It imports the existing pure engines for calculus/geometry, game state, probability/roulette, cards/poker and strategy, and now music/narrative theory. It does not import Express, Stripe, Supabase, network or storage.
2. **lib/sonara-creative-theory-models.cjs** adds named chord intervals and MIDI note frequencies, plus tension-curve analysis of caller-authored narrative beat IDs/scores. No sounds, copyrighted book text or films are generated.
3. **routes/invention-systems-routes.cjs** extends the EXISTING authenticated-by-host \`GET /api/invention-systems/catalog\` with \`researchSimulations\` and adds a clearly qualified overview card to the EXISTING \`/market-intelligence/invention-systems\` page. No POST, new API endpoint, mutation or cash transfer endpoint was added. Fixed reference examples remain, while bounded customer-supplied inputs now calculate geometry, chord and 2×2 strategic-payoff examples.
4. **tests/sonara-simulation-integration.test.js**, **tests/invention-simulation-catalog-route.test.js** and **tests/sonara-creative-theory-models.test.js** verify cross-studio mapping, read-only route behavior, bounded inputs, malicious parameters, non-execution status, harmony and story-beat arithmetic.

### Studio capability mapping (15 total)

| Studio | Capability IDs | Product use after separate promotion |
| --- | --- | --- |
| Business Builder | layout_area, distance_2d, incident_scenario | Restaurant layouts, home-service dimensions, bounded "what-if" job scenarios |
| Creator Studio | film_timeline, music_pitch, chord_harmony, narrative_beats, game_physics, poker_classification, board_minimax | Score/harmony learning, screenplay beats, film and timeline studies, game-maker instructional templates, optional visuals |
| Growth Studio | strategy_payoffs, trend_rehearsal, odds_calculator | Business-strategy payoff exercises, clearly hypothetical metrics and trading/odds education |
| SONARA One | card_probability, polynomial_integral | Common education/research base for all workspaces, not a hidden payment or access subsystem |

The website catalog advertises that the implementations exist **as research source** but sets \`customerEnabled=false\`, \`requiresServerAuthorization=true\`, \`executionEnabled=false\` and \`externalActionsEnabled=false\`. Metadata must never be interpreted as effective server permission.

## Numerical, engineering, security and economic controls

- **No uncontrolled computation:** internal dispatcher accepts one of 15 exact studio/operation pairs only; rejects invalid JSON-like values, cyclic/non-plain objects, prototype-pollution property names, nonfinite numbers, invalid engine arguments, oversized payloads and excessive nesting/nodes. Request payload max 4 KiB; serialized result max 64 KiB; underlying engines retain their domain-specific computational limits.
- **No user-provided script execution:** no eval, Function, dynamic import, expressions-to-JavaScript, external URL fetch, shell, filesystem, network, payment or customer data access in the actual kernel. A key is chosen from an owned, static function table.
- **No new auth powers:** current route reuses its existing \`requireCustomer\` guard as provided by \`routes/market-intelligence-routes.cjs\`. The pure library is not an authorization service. New request-execution APIs, if later approved, need separate server-side authentication AND tenant/organization ownership checks and rate/concurrency quotas. Never assume a request body with \`tenantId\` is trusted.
- **No live gaming/trading:** card and roulette maths, odds, synthetic backtests and score reducers do not have certified gambling RNG, real-money payout, custody, sportsbook bookmaking, broker-dealer capabilities, market data feeds or financial advice status. Direct execution is not exposed by this PR.
- **Numerical quality:** bounded doubles and integer frame counts; BigInt-backed exact card combinatorics and some virtual money primitives. Floating-point scores are not settlement amounts and a reproducible random stream is not cryptographically secure. All solver outputs include caveats.
- **Content and privacy:** narrative analysis uses metadata IDs and tension scores rather than book manuscript content. Music theory generates note numbers/frequencies, not audio samples or copyrighted music. Media rights, attribution, private workspace files and allowed content sources remain with existing Creator systems.
- **Accessibility:** an eventual research UI must have semantic form inputs, keyboard-only completion, focus visibility, 24 px minimum pointer targets with appropriate spacing, reduced motion for visuals, captions/transcripts and meaningful text equivalents to Canvas/WebGL. Audio and vibration should be off until chosen.
- **Deployment budget:** estimate max worst-case CPU/memory per engine with k6/Node worker benchmarks before enabling a caller-facing execution endpoint. Rate limit per user, tenant, IP, studio, operation and global queue; cut off repeated failures. No unlimited free heavy calculations.

References:
- OWASP API4 resource consumption: https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- OWASP API1 object-level authorization: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Supabase RLS/grants: https://supabase.com/docs/guides/database/postgres/row-level-security

## Release sequencing and database work plan

**P0 — prove the current draft:** check original base commit, preserve exact head SHA, run pinned pnpm frozen install/audit/typecheck/lint/Mocha/build/full release workflows and existing staging replay; do not merge if these are unknown/red. Source-level harness verification does not prove CI.

**P1 — secure runtime design before implementing it:** decide whether simulation results should be persistent. Define research_experiments and scenario_provenance tables only when a real customer workflow requires them, with explicit tenant, user, studio, engine_version, input_hash, retention, budget reservation and state transition columns. Scope \`SELECT\`/\`INSERT\`/deletion policy separately. Migration must revoke default anon/authenticated grants and grant only needed operations, enable RLS and include pgTAP cross-tenant allow/deny checks. Existing tables might already cover provenance; deduplicate before migration.

**P1 — actual customer UI:** use the existing research-lab/invention-systems destination as an entry point; deliver step-by-step educational simulations with consented manual input, labeled uncertainty, accessible focus/keyboard navigation and typed outputs. Do NOT add inert buttons or fake subscription/betting dashboards. The existing page now also includes three functional and accessible educational calculation forms. It is not a general-purpose game engine or persisted experiment workspace.

**P1 — Creator asset/story integration:** map chord note frequencies into the existing Creator Project Graph as non-destructive editable educational overlays, not a new music timeline. Map narrative beats into user-owned project references without duplicating rights/approval status. All storage and exports require existing tenant-safe file contracts.

**P1 — Business and Growth integration:** reuse shared math in opt-in quote/layout/forecast scenarios, but never let expected-value output initiate a real refund, trade, payout, betting action or campaign. Owner confirmation, provenance and a separate capability grant remain mandatory.

**P2 — game/render worker architecture:** evaluate Godot, boardgame.io, OpenSpiel, PettingZoo, three.js, Tone.js and licensed FFmpeg builds in isolated workers. Favor DOM 2D alternatives and progressive enhancement over WebGL/WebGPU dependency. CPU/GPU credits, cancellation, storage cleanup, content rights and licensing reviews required.

**P2 — better scientific engines:** A* and weighted shortest path, interval arithmetic, numeric error bounds, property-based combinatorial test sets, scenario Monte Carlo confidence intervals, game-tree/mixed-strategy benchmarks, constrained resource allocation and responsible design of engagement systems. Casino/paper results require explicit educational framing, not claims of advantage.

## Measured evidence at authoring time

- Initial code change series previously included **72 isolated V8 test cases** across five suites.
- This integration adds **15 cross-studio dispatcher cases**, **five guarded read-only route registration/response cases** and **eight music/narrative cases**; these were executed with isolated JavaScript and route stubs, not an actual Node/Mocha/web deployment.
- Zero runtime dependencies, database migrations, new money paths, casino routes, real trading endpoints or execution-enabled public API paths were added here.
- CI readiness must be confirmed from the latest PR head; do not infer passing status from green isolated tests or PR mergeability.

**No production claim:** source work is ready for review as a draft implementation; release gating is a separate evidence-driven step.

## October 8 engineering continuation — authenticated study forms

- lib/sonara-research-workbench.cjs is the new stateless and dependency-free page component, using the existing cross-studio calculation dispatch instead of a second engine. It is registered only within the existing authenticated invention-systems GET page.
- Three actually working native GET forms: (1) Business Builder rectangle width/height, 0.01–100 units with two decimal precision; (2) Creator Studio 0–116 MIDI chord root and a four-entry chord-quality allowlist; (3) Growth Studio four 2×2 zero-sum payoff entries, each −10…10. These invoke the respective limited pure calculation engines and return explanatory text.
- The other computational engines — Monte Carlo, expensive searches, backtesting, roulette, physics and arbitrary formulas — are intentionally NOT exposed as user-submitted web calculations in this patch.
- Customer inputs are restricted to at most five named fields and 256 bytes of JSON, disallowing extra/repeated keys, prototype-pollution attempts, arbitrary expressions and nonnumeric values. Native form constraints are only convenience; server-side parsing independently enforces limits.
- HTML uses labels paired with input IDs, native number fields and selects, keyboard-operable submit controls, a polite result output and a text alert on invalid input. All derived results and errors are escaped and rendered without any third-party JavaScript dependency.
- No customer data, tenant ID, file, transaction, secret, account, payment, order, trading provider or broker connection is referenced or stored. User GET values appear in the URL; the interface instructs users not to include private information.
- Existing customer middleware is unchanged. Page response adds private no-store caching and no-referrer headers to prevent accidental forwarding of submitted calculations. It does not automatically implement cross-tenant permissions for any future persisted scenario.
- Route tests now cover actual customer-submitted bounded calculations and injection rejection. Together with previous suites, 118 focused tests passed in the isolated JavaScript harness BEFORE the latest immutability improvement; full Node/Mocha/browser testing remains pending.
- New preview forms are an incremental functional research interface, not an authorized production roll-out. No new mutations, endpoints, database migrations, billing or subscription permissions were created.

### Research and next infrastructure gates

OWASP API4 recommends limits on request sizes, work units, concurrency, latency and expense; continue with per-user and per-tenant quotas and real load tests before offering more expensive simulations: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/

Express documents that CPU-heavy work should move off the main event loop into workers: https://expressjs.com/en/advanced/best-practice-performance/

WCAG 2.2 requires accessible input labels, error identification and keyboard use; verify the actual composed SONARA layout in real browsers and assistive technologies: https://www.w3.org/TR/WCAG22/

Before any merge or production deployment require full exact-head CI, pnpm/Node tests, security, route/CSP verification, authentication checks, accessibility/browser checks, load budgets and approved release controls. Do not equate test-harness success with production readiness.

## October 8 follow-on review: deny-by-default route wiring and board invariants

### Corrected implementation defects

1. The invention-systems child router previously used `deps.requireCustomer || passthrough`. If an unrelated caller or future refactor omitted the injected customer guard, the previously customer-only catalog and GET study page would have become anonymously accessible. The router now selects only an explicitly provided function; when it is unavailable, both endpoints use an unavailable-guard middleware returning HTTP 503 and a generic structured response. The top-level production wiring still passes `requireCustomer`. A negative test proves no next-handler call occurs with an omitted guard. This is defense in depth, not a replacement for session/tenant entitlement tests.
2. Board turns previously accepted a structurally forged state where `turn` did not match `revision`, or where the scores map omitted players or contained extra player keys. Every transition now verifies turn/revision agreement, unique and nonreserved players, a matching exact set of score keys, valid finite bounded integer scores, and legal next-score bounds. States and nested player/score records are frozen upon creation and each turn; this prevents accidental mutation but is **not** proof of multiplayer authentication or tamper-resistant persistent state.
3. Security and math boundary regression tests cover absent customer guard, forged and missing score records, altered turn counter, score overflow, and immutable results. Focused isolated V8 suite passed 121/121 cases across nine suites after these changes; this run emulates Node assertions/route callbacks, and does **not** constitute real Node/Mocha/browser CI.

### Research basis and open infrastructure gaps

- OWASP API5 discusses broken function-level authorization: an authorization middleware fallback must **not** silently grant access. https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/
- OWASP API4 warns against unrestricted work, cost and frequency; bounded computation is only the first step. Authenticated session, account/tenant request limits, request time budgets and capacity monitoring still need direct verified tests. https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- A GET form encodes its query in the URL; the study fields allow only numeric and fixed-choice educational inputs, with `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`. Browsers can nonetheless retain URL history and servers may log request targets, so never collect or show personal secrets, financial account details, identifiers, manuscript text or provider tokens in these fields. https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Sending_and_retrieving_form_data
- Explicit production authorization and shared state consistency require external trust boundaries: a server-verified actor, tenant-scoped persisted revision and event log, transaction isolation, idempotency and replay resilience. Frozen JS objects and research-side revision checks do not provide these guarantees.
- Do not widen this feature to customer-operated wagering, securities transaction execution, payments or prize redemption. The mathematics remains simulation/education and has no regulatory operator authority.

### Required release proof still missing

Exact SHA full mandatory GitHub workflow matrix and pnpm Node 24/26, lint, typecheck, test, build, package/audit, route/browser accessibility, observed auth denial on real Express, load/rate limits, migration/security dependencies and controlled deployment authorization. Until those succeed, keep PR #530 draft and do not merge or deploy.

## Hardening review: validated research math and safe form contracts — 2026-10-08

This subsequent engineering pass modified existing owned files in the draft PR; it did **not** introduce a new endpoint, migration, dependency or runtime payment/trading capability.

### Concrete defects corrected

1. **Polygon area validity:** \`polygonSignedArea\` used the shoelace formula but previously did not check the simple-polygon precondition. A self-crossing bow-tie outline could yield a zero or misleading area. It now rejects repeated points, zero-length edges, nonadjacent crossing/touching edges, and zero-area degenerate polygons before returning an area. Concave simple polygons and reversed clockwise winding still work. Pairwise edge checks are O(n²), bounded to 128 vertices. This is a bounded educational geometry check, not licensed survey/CAD or robust geodesic computation.
2. **Query object integrity:** \`parseSubmission\` previously permitted absent form fields to be resolved via the object's prototype and called \`JSON.stringify(query)\` before validating whether object keys contained getters or \`toJSON\` hooks. It now requires each submitted field to be an **own data property** containing a string, computes its own byte budget from validated primitive strings, and rejects fields that are missing, arrays, accessors or unsafe values. The GET input cannot trigger an arbitrary JavaScript accessor through serialization.
3. **Explicit operation schemas:** the 15-item \`sonara-simulation-integration.cjs\` registry now defines frozen \`required\` and \`optional\` field lists per studio operation. Any undocumented field fails closed rather than being silently ignored; missing required inputs are rejected. The read-only catalog publishes these contract field names but never runner functions, arbitrary code or privilege grants.

### Focused regression evidence

The latest isolated V8 harness exercise retrieved the nine real test source files and the current repository implementation modules, including the real invention-intelligence dependency. It completed **132 tests passed in that historical run / 0 failing** test cases across:
- Creative simulation kernel: 16
- Casino odds / virtual paper portfolio: 16
- Applied geometry/trigonometry/calculus/physics: 19
- Five-card/game-theory strategy: 17
- Synthetic backtesting: 10
- Creative music/narrative theory: 8
- Cross-studio integration: 19
- Customer-input research workbench: 18
- Existing invention-system route: 9

New negative cases cover crossing polygon edges, touching/repeated/degenerate boundaries, inherited query properties, accessor and \`toJSON\` hooks, undocumented cross-studio parameters, and missing required fields. Positive cases include concave area, optional defaults, unchanged routes and zero new mutation APIs.

**Evidence boundary:** the V8 harness substitutes an assertion adapter and route callback harness. It is neither the official Node/Mocha runtime nor exact-head CI and must not be represented as passing the pinned pnpm/Node 24/26 matrix. The local runtime cannot resolve GitHub DNS to clone and run the actual repository. GitHub checks still require independent completion.

### Additional promotion/security requirements

- Document a stable per-operation typed JSON Schema or equivalent strict validator, including nested item constraints and canonical serialization, before exposing new execution endpoints. The current owned required/optional lists are first-layer allowlists, not complete runtime JSON Schemas.
- Enforce tenant, user and role authorization, queue/concurrency and per-user rate quotas at the real execution boundary; avoid assuming \`customerEnabled\` catalog metadata enforces access control.
- Add fuzz/property-based experiments against a trusted geometric reference and integer-coordinate segment-intersection inputs. Floating point equality on near-collinear vertices is still a numerical precision limitation.
- Check real Express authentication denial, content security policy, password/session cookies, URL/history data exposure, accessibility, mobile rendering, security scans and production CI.
- No merge, migration or deployment while exact-head required GitHub checks are pending or failing.

Research basis: MDN prototype-pollution avoidance recommends explicit own-property checks, safe data schemas and disallowing extra fields: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Prototype_pollution ; OWASP API4:2023 recommends bounded inputs, resource consumption and rate limits: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/ .
