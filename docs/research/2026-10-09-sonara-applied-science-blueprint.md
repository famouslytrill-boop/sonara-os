# SONARA Applied Science Blueprint — Fifty Formula Concepts
**Research edition:** 2026-10-09 (U.S. Eastern). **Engineering state:** source-level prototype in draft PR #605; not activated in a website or customer product.

## Why this exists

SONARA's earlier research memo listed 50 mathematical and scientific concepts, while `lib/sonara-formula-engine.cjs` already contains 40 registered executable formulas across SONARA OS. These are **different populations**: one is a research list; the other consists of existing deterministic handlers. Counting one as the other would overstate actual product maturity.

The new read-only `lib/sonara-research-formula-blueprints.cjs` connects the 50 research concepts to the 50-category `lib/sonara-research-atlas.cjs` and checks the canonical formula engine's **metadata only**. It does not evaluate expressions, interpret arbitrary code, read customer data, query providers, alter DB schemas, or authorize regulated decisions.

## What the module implements

- `BLUEPRINTS`: exactly 50 named research concepts, each a static explanatory expression with an identified scientific/business discipline, explicit **unverified** scientific/units status and optional existing-engine association.
- `listFormulaBlueprints({discipline})`: bounded read-only filtering. Unknown disciplines fail closed.
- `planFormulaForAtlas({conceptId,categoryId})`: match a documented concept with a known SONARA Atlas research cohort, identify product and broad domain fit, and surface the canonical executable handler's *real version, expression and assumptions* **only if one exists**. Never execute or imply a new runnable formula.
- `getFormulaResearchCoverage()`: distinguish concept count, links to existing handlers, missing executable concepts, autonomous execution and customer decision verification.

**Verified against the exact pre-commit GitHub repository metadata:** 50 research concepts; **9** have associated keys among the **40** existing formula handlers; **41** are research-only. This does **not** mean the remaining 31 existing handlers disappeared or that any of the 50 research concepts has passed domain-specific customer validation.

| Concept / reference formula | Engine association | Potential SONARA application | Gate |
| --- | --- | --- | --- |
| Economic order quantity, sqrt(2DS/H) | `eoq` | Business Builder supplier ordering and restaurant inventory | Consistent annual demand, cost units and stable demand model |
| Reorder point | `reorder_point` | Restaurant or logistics replenishment | Time window, demand, lead time and stock unit checks |
| Little's law, L = λW | `little_law` | Restaurant service capacity and job dispatch | Stable average process and compatible time units |
| Equipment effectiveness, A×P×Q | `oee` | Manufacturing operations | Rate definitions and observed sample quality |
| Cpk process capability | `cpk` | Production quality | Measured σ, controlled process and specification limits |
| Contribution margin | `contribution_margin` | Business Builder costing | Inclusive variable costs and accounting period |
| Break-even units | `break_even_units` | Business scenario planning | Positive unit contribution |
| Customer-acquisition payback | `cac_payback` | Growth economics research | Matching cohort and contribution basis |
| Simple LTV | `ltv_simple` | Retention economics | Measured churn, contribution and model stability |
| Newton's second law, F=ma | Research-only | Science education and industrial planning | SI dimensions, forces and model domain; requires a new tested evaluator |
| Wave speed, v=fλ | Research-only | Creator Studio audio engineering education | Frequency/wavelength/media assumptions and signal validity |
| Net present value | Research-only | Owner-controlled financial scenario modeling | Sign conventions, rates and periods; **not investment advice** |

**Measurement sources:** [NIST Guide to the Expression of Uncertainty in Measurement](https://www.nist.gov/publications/guide-expression-uncertainty-measurement) for measurement uncertainty and clearly stated assumptions; [OpenAlex API](https://help.openalex.org/api/) for scientific publication metadata, not an objective scientist ranking; [U.S. Copyright Office](https://www.copyright.gov/register/pa-sr.html) for the distinction between compositions and sound recordings; [SEC IAPD](https://adviserinfo.sec.gov/) for adviser disclosures, not recommendations.

### Test evidence and boundaries

The code and test source passed **9/9 targeted tests using native Node.js 22.16.0**, with **injected fixture metadata** for three example handlers and four example Atlas categories; the test hashes match the Git objects written to the PR. Separately, exact GitHub source was inspected using the canonical SONARA formula-engine and real 50-category Atlas in an isolated JavaScript environment to verify the actual 9/40/41 association counts and return objects. These do **not** replace Node 24, full pnpm/Mocha test coverage, CI, RLS or production verification.

All plans return `productionAuthorized:false`, `customerDecisionAuthorized:false`, `evaluatorExecuted:false`, `unitsVerified:false` and `evidenceIndependentlyVerified:false`; finance, investment, hedge-fund and law use cases retain separate specialist review. Domain matching is advisory and may be overinclusive; it is **not** a recommendation engine for regulated professionals.

### Engineering next steps (blocked by release governance)

1. P0: Recover GitHub Actions queue and complete protected exact-head Node 24 and security/database checks on one commit; no premature merge.
2. P1: Add explicit input-schema, measurement-unit, dimension and uncertainty specifications for each concept selected for execution; cross-check reference datasets under expert review.
3. P1: Build authenticated read-only Research Atlas views with accessibility and tenant isolation; do not query/crawl external websites without licensing and approved credentials.
4. P2: Pilot restaurant ordering, manufacturer quality, creator audio analysis and growth unit economics on **synthetic or explicitly consented** data before customer activation.
5. P2: Measure per-provider cost, supported use cases, pilot performance and marketing claims. Public descriptions must say 'research-only' or 'existing calculator' accurately.

**Billing/deployment:** this source adds no hosted worker, GPU, paid API connector, autonomous agent, new database migration, or payment operation. The costs and rights for any future external datasets cannot be assumed free and require a separate vendor review.
