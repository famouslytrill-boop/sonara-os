# SONARA applied education, STEM, CAD geometry and motion-capture mathematics

**Engineering addition:** 2026-10-09. Stack on `codex/applied-formulas-labor-trades-science-20261009` / draft PR #581; this must not be merged to production ahead of that dependency.

## Scope and integrity

36 new deterministic, named, input-bounded functions live in
`lib/sonara-education-stem-cad-mocap.cjs`. The existing
`lib/sonara-formula-library.cjs` allowlist, `/formulas` index, page and
`POST /api/formulas/evaluate` provide calculation. The additive Supabase
migration `20261009180000_education_stem_cad_mocap_formulas.sql` creates
matching **definition rows only** so organization-scoped result saving can
work after controlled migration. No new routes, data-processing provider,
AutoCAD credentials, camera permission, Google provider, biometric collection,
image/video capture, CAD export, polling or direct hardware interaction.

### Capability boundaries by domain

| Domain | Examples included | Safe boundaries / additional required engineering |
| --- | --- | --- |
| Mathematics | geometric areas, Pythagorean distance, compound value, grade percentage, union probability | probability intersection validation; rates entered explicitly; no financial investment forecasts |
| Physical science | Ohm's law, DC power, simple wave speed, density | not AC reactive power, conductor sizing, electrical safety, circuit topology, material certification |
| Social studies | population density, population change, school participation, aggregate turnout, map distance | denominator/source date/geography must match; no demographic inference or political targeting |
| Language arts | reading pace, unique word ratio, Flesch reading ease, citation-coverage ratio | counts supplied by user; does not assess reading ability, truth, plagiarism or writing quality |
| Creative arts | beat grid duration, animation frames, image DPI and frame ratio | no generative audio/video, image editing, or render engine is implied |
| Physical education | MET-minutes, pace and approximate energy expenditure | not health advice, a fitness diagnosis, dietary recommendation or measured metabolic rate |
| CAD | plotted scale, 3D length, cylinder volume, inch/foot to mm | not DWG/DXF import/export, Autodesk automation or structural engineering approval |
| Motion capture | marker speed, frame sampling interval, Nyquist frequency, vector angle, tracked-frame coverage | takes already measured numeric inputs; no camera, model inference, skeleton identification or biometric storage |

### Data standards, dimensional consistency and provenance

- **NIST dimensional analysis**: unit conversions require declared start
  and destination units; do not round intermediate results. Here
  `in * 25.4 = mm` and `ft * 304.8 = mm` use exact international units.
  Survey-foot (historical) is **not** treated as international foot.
- **Autodesk CAD**: `INSUNITS=1` inches, `2` feet, `4` millimeters,
  `6` meters, `21` historical US survey feet. AutoCAD `INSUNITS`
  affects insertion scale and is not proof every coordinate was drawn in
  that unit. This change requires users to enter explicitly labeled mm.
  A future DXF import must read `$INSUNITS`, reject 0/unknown mappings,
  preserve source coordinate system and resolve block transformations.
- **Motion capture**: position deltas must be in **meters from the same
  stable reference frame**. Screen pixels, uncalibrated normalized keypoints
  and ARCore per-frame world coordinates cannot be interpreted as meters
  across time without calibration/anchoring. Angles require two nonzero
  vectors expressed in the same 3D orientation convention.
- **Frame rate**: `1000 / sample_rate_hz` milliseconds and
  `sample_rate_hz / 2` Nyquist Hz are theoretical sample properties, not
  performance certifications. Irregular timestamps, missing frames, drift,
  smoothing, aliasing and sensor calibration require separate treatment.
- **Flesch reading ease** uses
  `206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)`. Validity
  applies primarily to English prose with an appropriate counting method.
  Scores can be outside a nominal 0-100 reporting range. The result is
  **not** a diagnosis or assessment of any student's ability; formulas do
  not count syllables or interpret meaning.
- **Social studies**: participation rates are based on enrollment in any
  level among the official school-age population, matching UNESCO's
  **total net enrolment** definition; inputs must be from compatible date
  and geography. A ratio of counts is descriptive, not a causal or historical
  conclusion. `social_voter_turnout_percent` is aggregate arithmetic for
  historical/statistical analysis only and cannot target individuals.
- **Physical education**: MET-minutes multiply activity duration by
  externally supplied intensity. `pe_estimated_kcal` uses a common
  oxygen-equivalent heuristic; not direct calorimetry and potentially
  inaccurate for individuals. Never infer a person's health status from it.
- **Sensitive data**: weight, motion-capture metrics, and classroom records
  may be personal data. This release only has manual numeric inputs and
  opt-in saved results through existing tenant-scoped routes. Before
  integrating wearable, pupil, minors' records, camera/biometric or live
  exercise measurements, complete consent, privacy, minimization, retention,
  access control, RLS, and deletion reviews.

### Key worked examples

- Probability: P(A)=60%, P(B)=30%, P(A and B)=10% => P(A or B)=80%.
- Physics: V = I R => 2 A x 5 ohm = 10 V (ideal model).
- English reading: words=100, sentences=5, syllables=140 => Flesch 68.095.
- Social studies: 80 school-age enrolled / 100 school-age total => 80%.
- Animation: 1.5 seconds x 24 frames per second => 36 required frames.
- Physical activity: 30 min x 4 MET => 120 MET-min; energy proxy for
  70 kg gives 147 kcal, **not a measured burn**.
- CAD: 20 mm on a 1:50 paper plan => 1,000 mm in physical model space.
- Marker speed: displacement vector (3,4,0) meters across 2 seconds =>
  2.5 m/s, conditional on stable calibrated coordinates.
- Joint angle: two orthogonal vectors produce 90 degrees.

### Architecture sequence / risk gates

1. **Now:** bounded arithmetic with group metadata, saved-definition migration,
   unit tests for 36 calculations and invalid input; no new dependencies.
2. **Before merge:** `pnpm install --frozen-lockfile`;
   `pnpm exec mocha tests/education-stem-cad-mocap.test.js tests/applied-formulas.test.js tests/every-formula-can-be-saved.test.js tests/formulas.test.js`;
   `pnpm run lint`; `pnpm test`; `pnpm run typecheck`;
   `pnpm run build`; security scans and migration replay. Verify actual
   exact-head results and all required CI jobs; refuse merge if blocked.
3. **Before migration apply:** ensure earlier migration
   `20261009170000_applied_cost_trade_and_science_formulas.sql` is present
   and applied in proper order. Confirm no formula foreign-key failures,
   organization isolation, anonymous evaluation and authorization before
   enabling saved results. No migration was applied as part of writing code.
4. **CAD adapter (separate approved change):** parse DXF read-only using
   licensed/documented source, identify version, parse `$INSUNITS`,
   reject unspecified units, resolve transformation and dimension metadata,
   establish tolerances/provenance, produce preview and user review. Never
   claim Autodesk affiliation or write DWG without authorized integration.
5. **Motion-capture adapter:** request permission at use time, accept
   calibrated landmark data with acquisition timestamps and frame-of-reference
   metadata, compute joint-angle confidence/invalid-tracking flags, allow
   local processing and user-approved retention. No silent biometric capture.
6. **Learning and creative workflows:** optional teacher/creator-authored
   worked solutions, correct unit labels and accessible visualization;
   human-approved grading, editorial review, citation audits, and
   multilingual reading measures (not English Flesch on all languages).

### Reference implementations / standards

- NIST dimensional analysis and conversion:
  https://www.nist.gov/pml/owm/metric-si/unit-conversion
- NIST revised international-foot conversion:
  https://www.nist.gov/pml/us-surveyfoot/revised-unit-conversion-factors
- Autodesk AutoCAD INSUNITS:
  https://help.autodesk.com/cloudhelp/2025/ENG/AutoCAD-Core/files/GUID-A58A87BB-482B-4042-A00A-EEF55A2B4FD8.htm
- Autodesk DXF header variables:
  https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm
- UNESCO total net enrolment rate:
  https://uis.unesco.org/en/glossary-term/total-net-enrolment-rate
- Microsoft Flesch reading ease arithmetic:
  https://support.microsoft.com/en-us/word/get-your-document-s-readability-and-level-statistics-in-microsoft-word
- CDC physical-activity intensity and MET:
  https://www.cdc.gov/physical-activity-basics/measuring/index.html
- Google ARCore coordinate frame considerations:
  https://developers.google.com/ar/reference/java/com/google/ar/core/Pose
