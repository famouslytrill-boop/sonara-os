# SONARA Applied Mathematics, Game Science, Strategy & Creative Engines
**Engineering research and source implementation — October 8, 2026**

**Authority:** source-level, pure, dependency-free **research/sandbox** capabilities on draft PR #530. Not merged, deployed, public, regulator-certified, an actual sportsbook/casino, or a trading broker. No routes, provider credentials, database migrations, money paths, payment connectors or new npm/pnpm dependencies added.

## Architectural decision

Extend the existing SONARA One deterministic simulation kernel instead of importing a second game platform into auth/commerce services. Scientific calculators belong in a pure computation layer; product interactions belong in authenticated, bounded, tenant-authorized application services; media/game rendering belongs in isolated resource-metered workers. Model outputs must remain hypotheses/evidence until verified against observed facts.

Existing modules on this branch:
- lib/sonara-creative-simulation-kernel.cjs — RNG for repeatable experiments (not cryptographic), grid path, board turn revisions, pure zero-sum saddle analysis, music beats and MIDI frequencies, integral shot timelines.
- lib/sonara-game-risk-paper-trading.cjs — roulette EV, hypothetical fixed odds, synthetic paper holdings/marks and observed-sequence drawdown.
- lib/sonara-applied-game-mathematics.cjs — **new** geometry, trig, calculus and research motion.
- lib/sonara-card-game-strategy.cjs — **new** exact deck combinatorics, five-card poker classification, 2x2 pure/mixed zero-sum solution, deterministic memoized tic-tac-toe minimax.
- lib/sonara-synthetic-strategy-backtest.cjs — **new** next-sample synthetic moving-average strategy with no access to outside market data.

Tests: tests/applied-game-mathematics.test.js, tests/card-game-strategy.test.js and tests/synthetic-strategy-backtest.test.js. Each runs under the existing Mocha tests/**/*.js glob. They assert both positive mathematics and deliberately invalid or unsafe inputs.

## Scientific and mathematical design contracts

| Domain | Implementation | Formula / governing idea | Explicit limits |
| --- | --- | --- | --- |
| Coordinate geometry | rotatePoint2D, distance2D | (x',y')=(x cos θ−y sin θ, x sin θ+y cos θ); d=hypot(Δx,Δy) | 2D double precision, bounded inputs |
| Trigonometry | rightTriangleTrigonometry | sin θ = opposite/hypotenuse; cos θ=adjacent/hypotenuse; atan2(opposite,adjacent) | right triangle only; tangent null at vertical singularity |
| Polygon area | polygonSignedArea | shoelace = Σ(xᵢyᵢ₊₁−yᵢxᵢ₊₁)/2 | ordered vertices, assume *simple* non-self-crossing polygon; no CAD validity proof |
| Polynomial calculus | evaluatePolynomial, derivativeCoefficients | Horner evaluation; d(Σaᵢxⁱ)/dx = Σ i aᵢ xⁱ⁻¹ | degree ≤ 12, bounded coefficients/domains |
| Definite integration | integratePolynomial, simpsonPolynomial | Σ aᵢ(bⁱ⁺¹−aⁱ⁺¹)/(i+1); composite Simpson's 1/3 | bounded subdivision count; approximation not a generic symbolic CAS |
| Ballistics | projectileAtTime | x=v cos θ t; y=h+v sin θ t−gt²/2 | idealized; no drag, collision, ground stopping |
| Physics stepping | stepBody2D | vₙ₊₁=vₙ+aΔt; xₙ₊₁=xₙ+vₙ₊₁Δt | fixed tick, semi-implicit Euler, no collision engine; bounded steps |
| Card probability | choose, cardDrawProbability | C(n,k); hypergeometric C(K,k)C(N−K,n−k)/C(N,n) | exact BigInt counts; educational probability, not secure draw |
| Card-game scoring | evaluateFiveCardHand | rank frequencies, suit equality, 5-card straight incl. A-2-3-4-5 | 5-card high poker only; no dealer/shuffle/cash/side games |
| Game theory | solveTwoByTwoZeroSum | row/column maximin/minimax; interior 2x2 mixed equilibrium when no saddle exists | strictly zero-sum and 2x2; not all Nash equilibria |
| Adversarial search | solveTicTacToe | recursively optimal minimax, memoized by board | fixed nine cells; no network, identity, player authorization |
| Trading hypotheses | backtestSyntheticSma | average of prior fast/slow windows determines a long/flat *hypothetical* decision at the next observation | 500 samples max, integer cents, whole shares, no shorting/leverage, no market feed, ideal fills |

Important numerical rules: financial settlement cannot use JS floating point research outputs. Paper trading uses virtual integer cents with BigInt intermediate arithmetic. Sample probabilities are numerical ratios derived from exact counts; they do not imply real-world calibration. The fixed-step numerical trajectory is reproducible under the same implementation and inputs but is not guaranteed bit-for-bit across different JavaScript engines/hardware. Disclose numerical/conditioning limits.

## How these engines fit the three SONARA Studios

**Business Builder:** polygon/angle calculations for layouts and measurements; modeling capacity, maintenance, and labor scenarios; optional simulation visualizations. Do not use scientific demos as licensed structural, medical, transportation, regulated gambling, financial or engineering design certification.

**Creator Studio:** frame-accurate film editing and MIDI timing from the existing kernel; optional educational music-theory generators; licensed film scripts/manuscripts and reference metadata; procedural geometry for scenes; board/card game templates with accessibility. The Creator Project Graph must remain the source of truth for media rights, assets and editor timeline. Copyright clearance required for text, scores, recordings, game art, scientific/academic text and AI training data.

**Growth Studio:** scenario comparison and competitive strategy education, e.g. 2x2 zero-sum exercises. Simulation payoffs and trading signals are hypotheses, not evidence of customer conversion or profitable investments. Any offer or campaign still requires owner authorization and opt-in/suppression protections.

**SONARA One:** possible sandbox-only research tool API following separate security review, with provenance, seed, input snapshot, model version, server-verified tenant, quota, experiment-owner permissions, immutable result and marked assumptions. Do not publish callable production APIs from this PR.

## Trading, casino and betting boundaries

- Casino and sports odds are **educational** only; no stakes with cash value, prizes, winnings, redemption, transfers or real-money wagering.
- RNG from this code is explicitly *not* cryptographically secure, independently tested or acceptable for real payout decisions.
- The new card functions evaluate static hands and exact probability; they do not produce casino outcomes, shuffle live decks or authorize player access.
- Paper-trading strategy uses **past observations only** for its signal, then assumes fill at next observed price. This mitigates direct look-ahead but does **not** handle data leakage, survivor bias, dividends, splits, availability constraints, commissions beyond one specified fee, spread, partial fill, impact, tax, calendar gaps or licensed historical data. No investment advice or demonstrated profitability.
- Regulated sportsbook/casino, prediction market, social-casino contest, trading venue and investment advisory requirements differ by jurisdiction, mechanics and revenue model. Separate specialist legal review, licensed operator contracts, age/identity/geolocation where applicable, responsible-play/exclusion controls, certified RNG and audited ledgers before real-money exposure. Labeling a game "virtual" does not itself determine legality.
- Stripe and other payment providers require independent policy and category approval before any restricted activity. No payments changes in this PR.

## Game engines and scientific library evaluation — no runtime dependencies added

- **Godot 4.x:** official physics separates fixed simulation ticks from variable rendering; default 60 physics updates per second. Adopt this separation as an architectural pattern, not Godot code. https://docs.godotengine.org/en/4.5/tutorials/scripting/idle_and_physics_processing.html
- **OpenSpiel:** supports zero-sum/general-sum games, sequential/simultaneous games, imperfect information and algorithms such as minimax, Monte Carlo tree search and CFR. Treat as an external research benchmark, not as customer-game server or financial authority. https://openspiel.readthedocs.io/en/latest/intro.html and https://openspiel.readthedocs.io/en/latest/algorithms.html
- **boardgame.io:** consider multiplayer turns/replay and lobby in a separate future pilot only after tenancy, moderation, reconnection and licensing review. https://boardgame.io/documentation/
- **PettingZoo:** optional Python multi-agent environment research without production reach. https://pettingzoo.farama.org/
- **Godot/three.js/Tone.js/FFmpeg:** prefer provider/runtime isolation, tested device support, accessibility fallback, asset licensing and capped CPU/GPU costs. https://godotengine.org/license/ https://threejs.org/ https://tonejs.github.io/ https://ffmpeg.org/legal.html

Authors and concepts: Euclid (geometry); Newton and Leibniz (calculus); Euler (differential equations); Gauss (statistics/number theory); Dijkstra (shortest paths); Bellman (dynamic programming); Claude Shannon (information theory); von Neumann/Morgenstern (game theory); Alan Turing (computation); Donald Knuth (algorithm analysis); and creative methods grounded in human-reviewed music/film/literary practice. Prefer appropriately licensed primary sources and rights-cleared/public-domain editions of books.

## Productization roadmap and gates

**P0 — existing repository quality/security:** execute full pnpm frozen install, audit, typecheck, lint, Mocha, build, exact-commit CI, provider/migration/security workflows, live database hardening and branch protections. No merge on inconclusive CI.

**P1 — trusted sandbox runtime:** publish OpenAPI/JSON schemas; tenant-safe experimental results only after Supabase RLS, server-side auth, rate-limits, usage/cost caps, audit and delete/retention controls. No automated actions from calculated outputs.

**P1 — Creator integration:** map music notes to reusable educational arrangements and existing Creator Project Graph timelines; keep game score/visualization separate from real customer transaction ledgers; add keyboard/touch control parity, reduced motion, sound-off-by-default, alt-text and captions.

**P1 — formal mathematical tests:** add property-based fuzzing across card permutations and polynomial identities, numerical error/conditioning tests, deterministic replay hashes, versioned scenario fixtures and independent reference results. Dedicated separate PR for production API wiring and migrations.

**P2 — higher-complexity algorithms:** weighted A*/Dijkstra, collision detection + broadphase, adaptive integration, constrained optimization, imperfect-information game search, more poker variants, educational blackjack mathematics, confidence intervals, stochastic process simulation, risk attribution, portfolio transaction-cost stress tests and game-state server benchmarks.

**P2 — economics and commerce:** quantify CPU milliseconds, memory and execution costs per calculation, bound free research tools, attach owner-approved tiers/entitlements and usage metering only after successful validation. Avoid AI/media claims that lack working jobs or renders.

**No production claims:** research source on a draft branch, isolated local tests and GitHub queue states do not establish a deployed feature.