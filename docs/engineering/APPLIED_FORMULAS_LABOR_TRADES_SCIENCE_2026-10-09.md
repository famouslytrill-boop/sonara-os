# Applied cost, measurement, trades and research formulas (2026-10-09)

## Deployment status and execution boundary

This change extends the EXISTING `/formulas` list, allowlisted `/api/formulas/evaluate`
executor, and authenticated organization-scoped result-saving workflow; no parallel
expression evaluator, arbitrary `eval`, new permissions, tax-law classifier, hardware
control, pricing lookup or external calls. The migration only adds definition rows.
Applying it to the correct production database is a separate gated operation.
The calculators are user-supplied **estimates**, not verified pay statements, permit
calculations, engineering drawings, orbit controls, or quantum-computer runs.

`lib/sonara-applied-formulas.cjs` provides 15 bounded, synchronous handlers, grouped:

| Key | Unit | Domain / interpretation |
| --- | --- | --- |
| loaded_labor_cost | user's currency | paid hours x (wage + benefits/h + employer payroll burden/h), not overtime |
| weekly_wage_projection | user's currency | supplied regular/OT hours, pay rate and multiplier; no overtime classification |
| billable_utilization_percent | % | billable/paid hours; refuses billable > paid |
| opportunity_value_gap | user's currency | next alternative net value minus selected net value; signed |
| project_unit_margin_percent | % | (bid minus direct cost minus allocated overhead)/bid |
| material_quantity_with_waste | source quantity | net quantity x (1 + waste %) |
| concrete_volume_cubic_yards | yd³ | feet x feet x feet divided by 27 with waste factor |
| crew_duration_hours | hours | labor-hours / staffed parallel workers, assuming equal output rates |
| trade_job_cost | user's currency | loaded labor + materials + equipment + permits |
| length_meters_from_feet | m | exact international-foot conversion 0.3048 |
| data_transfer_seconds | seconds | ideal payload MiB x 8,388,608 / measured bit/s |
| base64_encoded_bytes | bytes | 4 x ceil(input bytes / 3), excludes metadata and wrapping |
| quantum_qubit_layer_shots | proxy units | qubits x critical-path layers x shots; NOT device time or gate count |
| earth_circular_orbit_period_minutes | minutes | ideal Keplerian two-body circular orbit with fixed Earth parameters |
| telescope_diffraction_arcseconds | arcseconds | ideal Rayleigh angular resolution 1.22 lambda/D, radians to arcseconds |

### Critical measurement rules

- Every numeric value must be finite and within a declared bound. Negative
  prices/hours/materials are rejected; opportunity values may be signed.
- Do not mix feet with meters or ft³ with yd³. Attach units in any later API
  workflow, and only transform units using allowlisted dimensional conversions.
- `paid_hours`, `labor_hours`, `crew_size` and `billable_hours` represent
  different things. A crew estimate assumes worker parallelism; site
  access/weather, fatigue, subcontractor coordination and specialized trades
  invalidate that simplification.
- Money figures are expressed in ONE consistent currency; this library does
  not convert currency, calculate taxes, or promise cent-perfect settlement.
  Store payments in minor units in commerce pipelines, not these projections.
- `base64_encoded_bytes` counts encoded data bytes without MIME line breaks or
  header overhead; ideal transfer time excludes congestion, retransmission,
  TLS, startup latency, packet overhead, and provider throttling.
- `quantum_qubit_layer_shots` is an illustrative workload proxy. Actual cost
  depends on layout, transpilation, measurement, queueing, noise, topology,
  gate durations and classical feedback. It is NOT a proxy for quantum advantage.
- Orbit calculation uses Earth equatorial radius 6378.137 km and gravitational
  parameter 398600.4418 km³/s² with altitude above that equatorial radius.
  Valid only as a classroom estimate: oblateness, eccentricity, drag, third
  bodies, clock offsets and relativistic effects omitted.
- Telescope estimate assumes unobstructed circular pupil, a single wavelength
  and diffraction-limited seeing. Atmospheric turbulence, sensors, scattering
  and optical aberrations may dominate actual image sharpness.

### Labor and compliance gate

The BLS June 2026 employer-cost report gives national private-industry
wage $32.82/hour, benefits $14.07/hour and total $46.89/hour (released
September 9, 2026). **These values are reference context, not program
defaults or rates for local trades.** Enter actual benefits, taxes, union
costs, payroll burden, contract rates and schedule premiums separately.

For covered nonexempt employees the federal FLSA generally requires at least
1.5x the *regular rate* after 40 hours in the workweek. State laws, collective
agreements, wage classifications and special rate components differ. The
weekly-wage *projection* accepts a user-selected overtime multiplier and
does not determine employee status or compute a legally final payroll.
This tool must never automatically generate pay statements or approve payroll.

### Phased trade-specialization roadmap (not shipped by this change)

1. Construction/architecture: takeoff geometry, assemblies, crew production
   factors, cost-code allocations, change orders, materials provenance.
2. Carpentry/roofing/tiling/painting: studs, drywall sheets, roof slope and
   squares, tile cuts, coats/coverage and packaging rounding.
3. HVAC/electrical/plumbing: equipment sizing, conductor/voltage-drop
   preliminaries, pipe length and pressure-loss **preliminary** models. Block
   permit-ready, safety-critical or stamped calculations until licensed review,
   current code references, jurisdiction, dimensions, and verified datasets.
4. Welding, landscaping, concrete, excavation: measured production curves,
   machinery cycles, soil bulking/compaction, weather factors, equipment cost.
5. Business administration: job-level contribution, overhead allocation,
   what-if scenarios, staffing and client sign-off with auditable assumptions.
6. Quantum/space/optics research: import *authorized measured* data through
   dedicated adapters, instrument provenance and uncertainty intervals. Never
   control physical hardware from educational calculators.

### Runtime and migration verification

Run `pnpm install --frozen-lockfile`, `pnpm exec mocha
tests/applied-formulas.test.js tests/every-formula-can-be-saved.test.js
tests/formulas.test.js`, `pnpm run lint`, `pnpm test`, `pnpm run
typecheck`, `pnpm run build`, plus security/migration gates. Check actual
migration application and authenticated organization result saving before
claiming customer-ready. No deployment or merge occurs from this change.

### Primary references

- US Bureau of Labor Statistics ECEC June 2026:
  https://www.bls.gov/news.release/ecec.nr0.htm
- US DOL overtime and regular rate: https://www.dol.gov/agencies/whd/overtime/
  and https://www.dol.gov/agencies/whd/fact-sheets/56a-regular-rate
- NIST SI usage: https://www.nist.gov/publications/guide-use-international-system-units-si
- NIST international foot: https://www.nist.gov/pml/us-surveyfoot
- IBM Quantum circuit depth:
  https://quantum.cloud.ibm.com/docs/en/guides/construct-circuits
- NASA/NASA JPL reference constants and orbital dynamics must be revalidated
  against the latest mission ephemerides for any real spacecraft analysis.
