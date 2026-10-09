# Engineering and Science Calculation Expansion — 2026-10-09

**Status:** feature-branch implementation only. This is not a production launch, a structural design approval, a wage survey, a satellite tracking service, an operating quantum processor, or proof that database migrations have reached production.

## Implementation

The existing `/formulas` page, `/formulas/:formulaKey` page, `POST /api/formulas/evaluate`, and signed-in save flow receive **17 additional deterministic, allowlisted calculators** through `lib/sonara-formula-library.cjs`. The implementation lives in `lib/sonara-engineering-formulas.cjs`; it never executes expression strings or third-party code. All saved results continue to be scoped to the authorized business by the existing route. A new additive SQL migration registers formula groups and formula definitions, **without applying the migration to a live database**.

## Calculation families and assumptions

| Formula keys | Area | Governing measurement assumption |
| --- | --- | --- |
| `fully_burdened_labor_cost`, `trade_bid_price` | Labor and pricing | Paid hours vs. productive hours, employer wage/benefit/tax/overhead as separately entered currency per hour; input wage is not assumed to be total labor cost; bid applies markup **not** target margin |
| `economic_profit` | Opportunity cost | Economic profit = chosen net benefit minus benefit of the best foregone alternative; alternative is valued on the **same time horizon** |
| `project_net_present_value` | Capital and buildings | Constant annual end-of-year net cash flow; discount rate per year in decimal; includes upfront cost but does not automatically include residual values, tax schedules, inflation or multiple changing cash flows |
| `material_quantity_with_waste`, `concrete_volume_m3`, `roofing_squares`, `paint_gallons` | Trades and construction | Geometric quantity and allowance estimates, not stamped structure/permit designs; roof area must already reflect actual slope; one roofing square = 100 ft²; `paint_gallons` is US gallons |
| `single_phase_ac_real_power_watts`, `pipe_flow_m3_s` | Electrical and plumbing | Single-phase RMS active power with known power factor, not electrical service/protection sizing; flow assumes full circular pipe and area-average fluid speed, not friction or pressure modeling |
| `square_feet_to_square_meters` | Unit conversion | Exact conversion 1 ft² = 0.09290304 m²; no mixed units inside a formula |
| `byte_transfer_seconds`, `compute_job_cost` | Computing and media | Nominal bits per second **after** overhead; run-time and monthly storage rates entered explicitly, not a cloud-provider price quote; excludes egress/extra requests unless included in inputs |
| `satellite_orbital_period_seconds` | Satellite fundamentals | Ideal two-body Keplerian period; semi-major axis from central body's center, not surface altitude; user supplies central-body `mu` in m³/s²; **not** collision avoidance, perturbation modeling or ground pass prediction |
| `telescope_rayleigh_arcseconds` | Optical science | Ideal clear circular aperture, wavelength entered in nm, diameter in m; small-angle approximation only, not real-world seeing/aberration quality |
| `quantum_ideal_one_probability`, `quantum_sampling_standard_error` | Quantum education | Single ideal qubit `Ry(theta)` from |0⟩ and binomial shot uncertainty; no device noise, calibration, entanglement, error correction or QPU execution |

All calculators return `missing_inputs` or `invalid_input` on missing or invalid fields. Units are encoded in field names where material. Percentage rates are fractions, e.g., **0.15 for 15%**. No exchange-rate conversion, implied labor-law compliance, or automatic authorization results from an estimate. Large/unrepresentable numeric results fail closed. Existing shared display currently rounds results to 4 decimal places; additional precision and an uncertainty model are needed before lab-grade use.

### Worked examples

- **Labor:** 8 paid hours × ($20 wages + $5 benefits + $2 employer taxes + $3 allocated overhead)/hour = **$240 estimated cost**.
- **Trade bid:** 8 productive hours ÷ 0.8 utilization × $30 burdened rate/hour = $300 labor; + $100 materials = $400 cost; 20% markup → **$480 bid**, before jurisdiction-specific tax requirements.
- **Economic profit:** $1,500 chosen benefit − $1,200 best foregone alternative = **$300 economic profit**.
- **Concrete:** 4 m × 3 m × 0.2 m = **2.4 m³**, excluding shape irregularities and batching adjustments.
- **Network:** 125,000,000 bytes × 8 ÷ 100,000,000 effective bits/s = **10 seconds idealized transfer**.

## Sources and engineering provenance

- U.S. BLS, Employer Costs for Employee Compensation, June 2026 (September 9, 2026 release): https://www.bls.gov/news.release/ecec.nr0.htm — benchmark only; customer supplies occupation, location, actual wages and employer costs.
- U.S. BLS, May 2025 OEWS occupational wages: https://www.bls.gov/oes/tables.htm — occupation-specific sourcing guidance.
- NIST, Guide to SI / unit notation: https://www.nist.gov/pml/special-publication-811 and exact conversions in NIST Handbook 44.
- NIST, Life Cycle Costing Manual (HB 135, 2025): https://doi.org/10.6028/NIST.HB.135e2025 and DOE BLCC overview: https://www.energy.gov/cmei/femp/building-life-cycle-cost-programs.
- NASA, Kepler and Earth satellite dynamics: https://pwg.gsfc.nasa.gov/stargaze/Skepl3rd.htm.
- NASA, Rayleigh angular-resolution criterion: https://ntrs.nasa.gov/api/citations/19680013447/downloads/19680013447.pdf.
- IBM Quantum, Qiskit circuit documentation: https://quantum.cloud.ibm.com/docs/en/api/qiskit/circuit.

## Release gate and next engineering steps

1. Run on the feature head: `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build`, and migrate/seed replay tests. **Do not claim these passed until they run.**
2. Check live migration history before additive database apply; use the standard migration authority. Validate RLS for results and review new group-key referential integrity.
3. Add backend numerical precision (not four-decimal shared round) and uncertainty/provenance/versioned input schema before scientific production use.
4. Later phases: occupation/location labor benchmarking; local regulations and overtime policy engines; blueprint geometric takeoffs with human review; HVAC thermal models, construction scheduling, life-cycle costing with real cash-flow arrays; cloud billing telemetry; orbital perturbations/SGP4 via reviewed integration; full quantum circuit simulation via a licensed optional adapter. **No safety-critical design decisions from basic scalar formulas.**

The new calculators are public learning/estimating utilities, and their saved results require existing authenticated, tenant-scoped records. They do not implicitly activate external vendors, create new entitlements, or collect personal pay-rate data.

## Phase 2: accuracy, traceability, and broader estimators (October 9, 2026)

Phase 2 adds seven formula keys to the 17 above (24 total) and preserves the original five formula database tables. These new formulas are mapped into the existing public formula page and saved-result route.

| Key | Core equation | Validation/caveats |
| --- | --- | --- |
| `project_variable_cash_flow_npv` | `-upfront_cost + Σ CF_t/(1+r)^t`, t from 1 to n | Customer enters 1–100 annual net cash flows in identical currency, constant annual discount rate 0–1; negative net cash flow is allowed; no tax or subsidy assumptions |
| `roof_pitch_surface_sqft` | `horizontal_plan_area * sqrt(1 + (rise_per_12/12)^2)` | Enter **horizontal projection area**, not already sloped roof area; uniform roof pitch; excludes dormers, valleys, cuts, overhangs, waste and safety review |
| `trade_bid_gross_margin_percent` | `100*(bid - direct_cost)/bid` | Distinguishes gross margin from markup; excludes overhead unless included in direct job cost |
| `base64_encoded_bytes` | `4*ceil(source_bytes/3)` | Padded Base64 payload bytes in ASCII form; excludes MIME newlines, data-URI prefixes, headers and external transport overhead |
| `circular_orbit_speed_m_s` | `sqrt(mu / orbital_radius)` | Ideal Newtonian two-body *circular* orbit; radius from central-body center, not altitude; not valid for collision avoidance |
| `nadir_ground_sample_distance_m` | `pixel_pitch_um*1e-6*altitude_m/focal_length_m` | Small-angle, ideal nadir optics and flat-ground approximation; not real sensor modulation transfer function, geographic error, or usable spatial resolution |
| `combined_standard_uncertainty` | `hypot(u_a,u_b)` | Only two **independent**, uncorrelated *standard uncertainties* expressed in the same unit. Correlation, bias, coverage factors and additional uncertainty sources must be analyzed separately |

### Precision defect fixed on this branch

The original shared formula result pipeline rounded **all** values to 4 decimal places. A qubit probability of roughly `2.5e-7` would have been returned as zero, and the public display also truncated small values to zero. The scientific/measurement subset of formulas now retains 12 significant digits; a nonzero value smaller than 0.0001 is shown in scientific notation. The existing business-money four-decimal policy remains unchanged.

**This is still not a calibrated measurement or uncertainty certificate**: preserving significant digits is not the same as proving measurement precision. NIST TN 1297 describes how uncertainty components and coverage assumptions should be reported; neither automatically follows from a calculator.

### Additional references verified for Phase 2

- NIST TN 1297, Reporting Uncertainty: https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-7-reporting-uncertainty
- NIST Handbook 44, exact international-foot area conversion: https://www.nist.gov/pml/us-surveyfoot/revised-unit-conversion-factors
- NIST Handbook 135 (2025), life-cycle project economics: https://doi.org/10.6028/NIST.HB.135e2025
- IBM Quantum Qiskit RYGate: https://quantum.cloud.ibm.com/docs/api/qiskit/2.3/qiskit.circuit.library.RYGate
- NASA planetary Kepler third-law principles: https://science.nasa.gov/solar-system/orbits-and-keplers-laws/
- RFC 4648, Base64 data encoding: https://www.rfc-editor.org/rfc/rfc4648

### Not production-verified

The feature branch has not been merged or deployed, migration replay has not been run on a live managed database, and the full pnpm CI suite is a release gate. Isolated engine checks do not establish build, payment, RLS or science certification readiness.

## Phase 3: numerical stability, covariance and customer-facing limitations (October 9, 2026)

**Change implemented on the draft PR branch (not production):**

1. **Near-zero discount rates** — the uniform end-of-year annuity factor now uses `-expm1(-years*log1p(rate))/rate` for positive rates, with an exact `years` fallback when the rate is zero. This avoids cancellation when `rate` is near machine precision. Variable-year cash flows likewise use `exp(-t*log1p(rate))`. In the fixture, $250/year for three years at a `1e-16` discount rate with a $100 upfront cost correctly returns $650 rather than a spurious negative NPV.
2. **Correlated standard uncertainties** — `correlated_standard_uncertainty` evaluates `sqrt(u_a²+u_b²+2*rho*u_a*u_b)`, with `rho` in [-1,1] and both standard uncertainties in the *same units*. For `rho=-1`, it uses `abs(u_a-u_b)` directly to avoid cancellation; for `rho=1`, it uses `u_a+u_b`. This is a narrow two-input method: it does not estimate correlation, calibrate sensors, or report a coverage interval.
3. **First-class UI warnings** — the generated public formula page now renders escaped, formula-specific "Assumptions and limits" next to the input form and calculated result. A default research/estimate warning applies to newly added engineering calculators without explicit copy. Original nonengineering pages remain unchanged.
4. **Tiny percentages** — nonzero percentage values below 0.005% now render using exponent notation rather than silently showing 0%.
5. **Labor-survey guardrail** — ECEC benefits include legally required benefits; customers must not add an employer-tax amount again if that amount is already included in their chosen benefit figure. The labor calculator takes separately entered amounts and does not assume the national BLS average is a trade's actual wage.

**Source evidence:**

- NIST TN 1297, 5. Combined Standard Uncertainty: https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-5-combined-standard-uncertainty
- NIST TN 1297, Appendix A, Eq. (A-3), covariance terms: https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty
- NIST TN 1297, 7. Reporting Uncertainty: https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-7-reporting-uncertainty
- BLS, ECEC June 2026, released September 9 2026: https://www.bls.gov/news.release/ecec.nr0.htm

**Test evidence:** 35/35 isolated JavaScript assertions passed, all 25 engineering keys appear in the additive SQL definition seed and all 25 accepted the generated HTML form's sample inputs. This does NOT establish a pnpm/Mocha CI pass, live migration correctness, accessibility compliance, financial/legal suitability or operational production readiness. Exact-head CI and protected main branch remain release requirements.

**Next engineering process:** verify exact-commit GitHub Actions gates, replay migration on a disposable database, exercise authenticated cross-tenant save/read in the full Mocha/HTTP test lane, then require owner-approved deployment with rollback plan. Make one canonical currency and measurement-unit model before regulated engineering or payroll usage.
