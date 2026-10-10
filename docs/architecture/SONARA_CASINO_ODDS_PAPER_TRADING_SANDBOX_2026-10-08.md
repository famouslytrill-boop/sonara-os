# SONARA casino probability, betting science and paper-trading sandbox — 2026-10-08

**Status:** source-level educational research prototype only; unmerged draft PR; no web routes, DB migrations, payments, gaming provider, deposits/withdrawals, order execution or public activation.

## Reuse / architecture

Build on lib/sonara-creative-simulation-kernel.cjs (seeded noncryptographic research sampler, game theory, pathfinding, film/music timing), rather than introduce an isolated casino product or another payment authority. New owned module: **lib/sonara-game-risk-paper-trading.cjs**. New tests: **tests/game-risk-paper-trading.test.js**.

The hard-coded BOUNDARIES object labels live wagering, redeemable points, deposits, withdrawals, live trading, market orders and certification **false**. This is an advisory signal inside code, **not** a permission enforcement system; existing server authority must deny such external operations independently. No external games, sportsbook, broker, exchange or wallet is connected.

### Actual new computational capabilities

| Function | Purpose | Mathematical model / boundary |
| --- | --- | --- |
| evaluateRouletteTheory | American 38-pocket wheel theoretical bets | 18 red/18 black/2 green; even-money, three dozens, straight and double-zero selections. EV = stake × [win pockets × payout ratio − losing pockets] / 38. House edge 2/38 ≈ 5.263% for supported bets. No spin execution. |
| sampleRouletteColors | Reproducible bounded 38-pocket red/black/green samples | xorshift32 from prior kernel, at most 10,000 trials. No certified randomness, fairness, cash, stakes or live gaming. |
| evaluateHypotheticalOdds | Break-even threshold and assumed fixed-odds EV | Break-even probability = 1 / decimal odds. Net EV (virtual points) = stake × [p × decimal odds − 1], where p is a declared hypothesis, not calibrated truth. |
| createPaperPortfolio | Create fictional cash ledger | Up to 1 trillion virtual cents (strictly NOT redeemable/custodial), no debt. |
| applyPaperOrder | Synthetic buy/sell at caller-supplied price | Integer cents and whole shares, BigInt intermediate cost, immutable revisions, 200-order limit, no margin/shorting/live fill. |
| markPaperPortfolio | Mark synthetic holdings at caller-supplied prices | Virtual equity = hypothetical cash + sum(shares × supplied price), with explicit no-market-data condition. |
| evaluateMaxDrawdown | Peak-to-trough synthetic-equity drawdown | d_max = max_t((max_{s<=t} E_s - E_t) / max_{s<=t} E_s), for positive initial equity, capped at 1,000 observations. |

No mathematical model guarantees a positive return or constitutes an investment recommendation. A casino's theoretical edge is not a betting strategy.

### Example boundaries and things **not built**

1. Roulette calculations are not slot machines, live spins, real cash, gambling wallets, sweepstakes, odds feeds or an exchange. Do **not** use the research PRNG for regulated payouts, secure tokens or fairness proof.
2. Fixed-odds calculation uses user-supplied hypothetical probability. No event outcome feeds, scoring, bookmaker accounts, affiliate routing or bet execution. A favorable computed EV based on an invented probability has no predictive power.
3. Paper trades require fabricated prices and virtual cents. No brokerage account, real exchange connectivity, market quotes, verified fills, financial records, dividends, slippage modeling, split-adjustment or tax logic. A synthetic mark should not be represented as actual portfolio performance.
4. The paper reducer accepts in-process state, **not** authenticated or persisted commands. Revisions demonstrate concurrency logic but do not prevent forged clients. Never expose it as an authority endpoint without separately verified server identity, tenancy, optimistic lock and tamper-evident log.
5. No changes to Stripe, Supabase, mobile billing, regulatory standing, user age collection or permissions.

## Governance: Ohio and the U.S.

**Ohio sports wagering:** Ohio Revised Code chapter 3775 establishes licensing for sports gaming; section 3775.02 delegates regulation to the Ohio Casino Control Commission and calls for controls including age ≥21, responsible gaming, advertising disclosures, voluntary exclusion and equipment/system approval. Section 3775.04 governs online sports-pool proprietor licenses. Ohio's statutory definition of sports gaming specifically distinguishes sports betting from casino gaming and fantasy contests; never assume one license permits all three product classes.

- https://codes.ohio.gov/ohio-revised-code/chapter-3775
- https://codes.ohio.gov/ohio-revised-code/section-3775.02
- https://codes.ohio.gov/ohio-revised-code/section-3775.04
- https://codes.ohio.gov/ohio-administrative-code/chapter-3775-16
- https://codes.ohio.gov/ohio-revised-code/section-2915.01
- https://codes.ohio.gov/ohio-revised-code/section-2915.02

**Interactive gaming systems:** Gaming Laboratories International GLI-19 is an industry test reference; jurisdictions determine the applicable standards. A deterministic test suite or published RNG is not a gambling regulator's approval. Independent verification of software, paytables, RNG behavior, accounting, security, responsible gaming and player controls is needed for any regulated casino proposal.

- https://gaminglabs.com/gli-standards/
- https://gaminglabs.com/getting-started/submit-new-software/
- https://csrc.nist.gov/pubs/sp/800/90/a/r1/final
- https://csrc.nist.gov/pubs/sp/800/22/r1/upd1/final

**Trading and custody:** For securities, SEC guidance states that operating a securities-trading platform or conducting customer transactions can implicate broker-dealer registration. Regulation ATS may apply to eligible alternative trading systems, with registration and reporting conditions. A demo paper portfolio with no actual securities transactions is **not** proof the surrounding website or marketing is exempt from all securities/advisory laws; legal review remains necessary before provider connections, personalized advice or paid investment services.

- https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/broker-dealers
- https://www.sec.gov/foia/frequently-requested-documents/alternative-trading-system-ats-list
- https://www.sec.gov/about/divisions-offices/division-trading-markets/division-trading-markets-compliance-guides/guide-broker-dealer-registration

**Licensing and business model:** Simulated games should be clearly described as educational/free practice without paid random rewards or redeemable credits. A paid subscription, social-game mechanics, advertising revenue, prizes, token ownership and jurisdiction changes can affect legal analysis; check the exact mechanics before launch. Avoid suggesting that labeling an interface "virtual" automatically removes gambling-law exposure.

## Mathematical and academic engineering roadmap

From board-game theory and computer science:
- Game states, Markov models, minimax/alpha-beta search, Monte Carlo tree search, Nash equilibrium and optimal mixed strategies. Only pure zero-sum saddle points and basic turn reducer are currently implemented. Repeated-game equilibria, sequential game solvers, imperfect information, collusion analysis and AI opponents require separate proofs.
- Graph theory, A* and Dijkstra, dynamic programming, fixed-timestep collision/physics, entity-component systems, deterministic rollback/replay for multiplayer, rollback netcode, causal event tracing. Only bounded BFS currently exists.
- Casino probability: expected value, Bernoulli/binomial outcomes, conditional probability, composition of independent events, variance, drawdown, ruin theory, payout/hold/return-to-player accounting, calibration and confidence intervals. The new prototype only implements roulette EV, modeled fixed odds, color sampling and drawdown.
- Markets: order books, spread/slippage, time-priority, VWAP/TWAP, Brownian/geometric Brownian motion, market regimes, maximum drawdown, volatility, VaR/CVaR, bootstrap confidence intervals, forecast error/backtesting and transaction-cost models. The new prototype only implements whole-share hypothetical buy/sell/mark with fixed provided prices and drawdown.
- Music: tuning systems, interval math, scales, voice leading, polyphony, stochastic rhythmic composition, MIDI clock and audio scheduling. Existing core handles equal-tempered notes and beat duration.
- Film and literature: scene graphs, shot/beat arcs, frame-bound narrative timelines, branching scripts, pacing, reader accessibility, caption/transcript alignment and provenance. Existing core handles integral shot frames.

Inspiration and historical concepts: John von Neumann and Oskar Morgenstern (game theory), Claude Shannon (information), Richard Bellman (dynamic programming), Edsger Dijkstra (graphs), Norbert Wiener (feedback/control), and stochastic-process approaches used in modern quantitative risk. Use licensed/public-domain books or metadata references, not unapproved bulk reproduction of protected material.

## Game engine candidates — defer runtime adoption

**Godot Engine (MIT):** suitable for isolated 2D/3D Creator game production, downloadable games, and sandboxed simulations; requires size, platform, licensing, input, network, asset and render verification. https://godotengine.org/license/

**boardgame.io (MIT):** evaluate lobby, determinism, rule authority, client reconnection and moderation; do not duplicate platform auth. https://github.com/boardgameio/boardgame.io

**Three.js and Tone.js (MIT):** optional presentation and synthesis, never an auth/payment/game-outcome authority. https://github.com/mrdoob/three.js and https://github.com/tonejs/tone.js

**FFmpeg:** possible isolated Creator worker with binary/codec and LGPL/GPL review. https://ffmpeg.org/legal.html

## SONARA launch architecture and compliance safeguards (not yet implemented)

A regulated design would need strict geographic and product eligibility, adult age and identity verification where applicable, responsible-play limits, self-exclusion, fraud/AML monitoring, approved gaming software and independently tested RNG, financial reconciliation, locked ledgers, audit retention, separate player funds/custody where mandated, security incident response, and required regulatory reporting. Neither sandbox nor documentation substitutes for licensed partner / specialized counsel / regulator approval.

For securities, a regulated partnership or independently licensed provider must own actual order placement, confirmations, custody, KYC/AML and market data entitlements. Separate exchange data licensing and investment-advice classification must also be evaluated. Never route real customer orders to a sandbox simulator.

## Next engineering gates

**P0:** exact-head Mocha/Node 24 and 26 compatibility, lint, typecheck, install audit, build, license/proprietary checks, release-gate evidence; review all open high-priority security and database PR dependencies.  
**P1:** add bounded, tenant-owned *research experiment* API schema with auth/session/tenant/RLS, schema version, provenance, explicit simulation label and quota, but no money path.  
**P1:** integrate demo visualizations with accessible game board and charts; no fake signups, no sound by default, clear alternate text.  
**P1:** improve paper-trading realism with quoted-price provenance, corporate actions, fees, realistic fill policy, stochastic tests and no look-ahead bias; perform regulatory pre-screen before any account connectivity.  
**P2:** evaluate isolated engine/worker prototypes, deterministic physics, scenario analytics, and licensed education content with observability and device tests.  
**Restricted separate decision:** real-money gaming, betting, prediction contracts, trading, token rewards or investment advice: product-by-product jurisdiction/fee/legal analysis and licensed partner approval before code or marketing promises.

**Release rule:** keep draft PR unmerged and no deployment until full exact-head verification and authorized activation.

## Additional 2026 engine research: isolate, do not embed

| Candidate | Source / architecture | Evaluation decision |
| --- | --- | --- |
| Google DeepMind OpenSpiel | Apache-2.0; C++ core with Python bindings, n-player imperfect-information games, reinforcement-learning and strategic-search algorithms. https://github.com/google-deepmind/open_spiel | Good scientific benchmark for general-sum, imperfect-information and adversarial games; isolate in offline research worker. No production dependency. |
| Farama PettingZoo | MIT Python multi-agent reinforcement learning environment standard; includes classic board-game environments. https://github.com/Farama-Foundation/PettingZoo | Use for simulation/agent-behavior benchmarks, not browser server auth or production casino odds. No production dependency. |
| QuantConnect LEAN | Apache-2.0 C# and Python strategy research/backtesting engine; also supports live brokerage integrations which must be explicitly disabled for SONARA research. https://github.com/QuantConnect/Lean | Potential future isolated **backtest-only** worker after data licenses, precision, look-ahead bias, worker cost and investment-service classification review. **Do not** install or enable provider keys. |
| Godot 4.5 web export | Official documentation identifies single-threaded WebAssembly/WebGL2 as preferable for broad web compatibility, including macOS/iOS, while noting thread/cross-origin constraints. https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html | Prefer small accessible 2D/browser sandbox first; separate native/export pipelines after browser/device evidence. |

Licenses describe engine **source** only. Datasets, game assets, prices, brokerage integrations, pre-trained models, sound banks and market feeds carry separate rights and may carry recurring fees. An Apache/MIT license is not regulatory permission to run games of chance, operate an exchange or offer investment services.

**Decision criterion:** only integrate a large engine when a tested prototype closes a measurable accuracy, user-value or labor-cost gap that the existing no-dependency mathematical kernel cannot close. Every deployment needs a cost ceiling, sandbox isolation, cancellation, observability, human approval where required and reproducible evidence.
