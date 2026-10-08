# SONARA One — Cross-studio mathematical and simulation integration, October 8, 2026

**Status:** coded on draft PR #530, **not merged**, **not deployed**, **not available to execute from the public/customer website**. Existing invention-systems research catalog has been augmented with READ-ONLY metadata; no endpoints were added that evaluate arbitrary customer computations. No migrations, database writes, provider accounts, billing hooks or platform permissions were changed.

## What changed

1. **lib/sonara-simulation-integration.cjs** is the new owned, dependency-free internal registry and dispatcher. It imports the existing pure engines for calculus/geometry, game state, probability/roulette, cards/poker and strategy, and now music/narrative theory. It does not import Express, Stripe, Supabase, network or storage.
2. **lib/sonara-creative-theory-models.cjs** adds named chord intervals and MIDI note frequencies, plus tension-curve analysis of caller-authored narrative beat IDs/scores. No sounds, copyrighted book text or films are generated.
3. **routes/invention-systems-routes.cjs** extends the EXISTING authenticated-by-host \`GET /api/invention-systems/catalog\` with \`researchSimulations\` and adds a clearly qualified overview card to the EXISTING \`/market-intelligence/invention-systems\` page. No POST, mutation, user-input evaluation endpoint or cash transfer endpoint added. The precomputed research examples shown on page load are read-only: 4×3 area, C major chord notes and matching-pennies mixed equilibrium.
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

**P1 — actual customer UI:** use the existing research-lab/invention-systems destination as an entry point; deliver step-by-step educational simulations with consented manual input, labeled uncertainty, accessible focus/keyboard navigation and typed outputs. Do NOT add inert buttons or fake subscription/betting dashboards. The current read-only catalog, accompanied by three fixed-input examples, is not such a user-interactive UI.

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
