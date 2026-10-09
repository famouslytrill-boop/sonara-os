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
- NIST, Life Cycle Costing Manual (HB 135, 2022): https://www.nist.gov/publications/life-cycle-costing-manual-federal-energy-management-program.
- NASA, Kepler and Earth satellite dynamics: https://pwg.gsfc.nasa.gov/stargaze/Skepl3rd.htm.
- NASA, Rayleigh angular-resolution criterion: https://ntrs.nasa.gov/api/citations/19680013447/downloads/19680013447.pdf.
- IBM Quantum, Qiskit circuit documentation: https://quantum.cloud.ibm.com/docs/en/api/qiskit/circuit.

## Release gate and next engineering steps

1. Run on the feature head: `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build`, and migrate/seed replay tests. **Do not claim these passed until they run.**
2. Check live migration history before additive database apply; use the standard migration authority. Validate RLS for results and review new group-key referential integrity.
3. Add backend numerical precision (not four-decimal shared round) and uncertainty/provenance/versioned input schema before scientific production use.
4. Later phases: occupation/location labor benchmarking; local regulations and overtime policy engines; blueprint geometric takeoffs with human review; HVAC thermal models, construction scheduling, life-cycle costing with real cash-flow arrays; cloud billing telemetry; orbital perturbations/SGP4 via reviewed integration; full quantum circuit simulation via a licensed optional adapter. **No safety-critical design decisions from basic scalar formulas.**

The new calculators are public learning/estimating utilities, and their saved results require existing authenticated, tenant-scoped records. They do not implicitly activate external vendors, create new entitlements, or collect personal pay-rate data.
