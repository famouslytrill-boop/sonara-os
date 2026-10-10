# SONARA engineering measurement pipeline v1 — 2026-10-09

## Status, sources and safety

Internal deterministic **library implementation**, not a deployed API or
connected CAD/video/provider service. This PR is stacked above #583, which
is stacked above #581. Merge only in this dependency order, after exact-head
tests and migration replay. No new migrations, grants, tables, endpoints,
cameras, subscriptions, providers, AI models or telemetry are introduced.

`lib/sonara-measurement-pipeline.cjs` is the single bounded computation plane
for four customer workflows:

| Input | Deterministic stage | Output |
| --- | --- | --- |
| Declared CAD/unit and 3D frame | Unit to meters, optional T*R*S transform | Coordinates in world meters |
| Monotonically timestamped calibrated positions | Segment displacement, speed, aggregate | Distance / speed with source frame |
| Rational media rate and zero-time | Floor(exact rational frame index) | Frame indices at measurement timestamps |
| Rectangular takeoff + explicit trade costs | Unit volume + waste + entered cost | Volume m³, material/labor/other/total, currency |

Existing `cad_distance_3d_mm` and `mocap_marker_speed_mps` public formulas
now call shared library primitives. Public formula pages remain operational.
The **full multi-step pipeline** has no new customer-facing route yet; a
future JSON handler requires body limits, auth/tenant policy, evidence
persistence and abuse tests first.

### Version 1 request contract

```json
{
  "schemaVersion": 1,
  "mode": "combined",
  "source": {"origin": "manual", "reference": "estimate-001"},
  "frame": {"unit": "ft", "handedness": "right", "upAxis": "Y", "frameId": "scene-01"},
  "confidenceFloor": 0.8,
  "samples": [
    {"timestampUs": 1000000, "confidence": 0.9, "position": {"x": 0, "y": 0, "z": 0}},
    {"timestampUs": 2000000, "confidence": 0.95, "position": {"x": 3, "y": 4, "z": 0}}
  ],
  "media": {"startTimestampUs": 1000000, "rateNumerator": 30000, "rateDenominator": 1001},
  "job": {
    "length": 10, "width": 10, "height": 0.5, "lengthUnit": "ft",
    "wastePercent": 8, "materialPricePerCubicMeter": 200,
    "laborHours": 5, "loadedLaborPricePerHour": 50,
    "otherCost": 100, "currency": "USD"
  }
}
```

Other modes:
- `motion`: samples only.
- `media`: samples plus a rational media rate.
- `cad` and `trade`: explicit rectangular job dimensions/costs only.
- `combined`: motion samples plus a job, optionally aligned to media.
Mode combinations are validated; mislabeled modes fail closed.

### Unit and coordinate contracts

- Length units are explicitly allowlisted: m, cm, mm, km, in, ft, yd,
  historical us_survey_ft. The international foot is exactly 0.3048 m,
  and 1 inch exactly 0.0254 m. Historical US survey foot uses 1200/3937 m.
- Frame must declare right-handed, Y-up and a reference frame ID.
  No implicit left-handed/Z-up conversion or unvalidated camera orientation.
- An optional rigid/uniform transform uses translation in meters,
  unit-length XYZW quaternion rotation and strictly positive uniform scale.
  When a transform is supplied, `frame.targetFrameId` is mandatory; results
  report both sourceFrameId and destination referenceFrameId to prohibit
  silently combining incompatible coordinate frames.
  Processing order T*R*S is glTF-style. Coordinate conventions must be
  converted by a separately verified adapter before calling this module.
- This library does not open DXF/DWG or read `$INSUNITS`. A future read-only
  DXF adapter must interpret units, per-entity transformations, and
  block-reference nesting correctly and reject ambiguous/unitless data.
  Autodesk `INSUNITS` controls inserted-object scaling rather than
  certifying dimensions in arbitrary source drawings.

### Time, quality and provenance

- Time inputs are integer microseconds and strictly increasing per sample.
  Maximum 128 samples per call, to bound CPU and memory.
- Motion segments only calculated when every sample meets the **caller
  supplied** minimum confidence. Numbers derived from uncalibrated 2D image
  points must not be passed as real-world metric 3D positions.
- Media timeline frame index uses integer BigInt arithmetic:
  `floor((timestampUs - startTimestampUs) * fpsNumerator /
  (1000000 * fpsDenominator))`. Supports 30000/1001 rates with no float
  boundary drift. This is **non-drop-frame indexing**, not SMPTE drop-frame
  timecode presentation.
- Output evidence is SHA-256 of only validated, declared fields, plus
  source origin/reference and assumptions. A hash proves exact data equality
  when verified against the original, **not** real-world calibration or
  device authenticity. No network call, DB write, camera read, or secret
  storage takes place.
- Source reference is a bounded opaque safe token; do not place PII, license
  plates, minors' names, biometric identifiers or provider secrets in it.

### Job cost limitations

Rectangular geometry is an **idealized box**. Volume is not a construction
permit takeoff; waste percent is a planning input, not a universal standard.
Rates, labor-hours, burden and currency must all be entered explicitly.
The result is not a certified contractor bid or a merchant settlement amount:
there are no taxes, rush charges, shipping, breakage probability models,
site hazards, building codes, licensure checks, quote approval or change orders.

### Tests and release gates

New: `tests/sonara-measurement-pipeline.test.js`.
Regression coverage includes exact foot factors, historical survey foot,
3D quaternion transform, rational frames, multiple workflow modes, motion
velocity, material/labor plan, deterministic evidence, bounds, missing data,
invalid coordinate assumptions and secret minimization. Existing CAD and
motion formulas still have their original contract.

To validate exact branch head in Node 24, run:

```sh
pnpm install --frozen-lockfile
pnpm exec mocha tests/sonara-measurement-pipeline.test.js tests/education-stem-cad-mocap.test.js tests/applied-formulas.test.js tests/every-formula-can-be-saved.test.js
pnpm run verify:applied-migrations
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Also require native migration replay, source checks, security scans,
browser contract gates and production deployment dry run before release.
The previous branches #581/#583 introduced 15+36 formulas and two migrations;
**both migration pins were added** after observing failed Node CI in #581.
Do not claim full green until the rerun on updated commit heads succeeds.

### Authoritative standards / references

- NIST revised conversion factors (2026 updated):
  https://www.nist.gov/pml/us-surveyfoot/revised-unit-conversion-factors
- Autodesk AutoCAD 2026 INSUNITS and historical survey feet:
  https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-A58A87BB-482B-4042-A00A-EEF55A2B4FD8.htm
- Khronos glTF coordinate conventions (m, right-handed Y-up) and T*R*S:
  https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- ASWF OpenTimelineIO rational time (value/rate seconds):
  https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-serialized-schema.html
- Google MediaPipe landmarks: normalized image coordinates are **not**
  the same as world landmarks in meters:
  https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md

## Next bounded engineering increment

1. Add a strict JSON schema and route integration only after API authorization,
   requests-per-tenant budgets and payload size limits are agreed and tested.
2. Add provenance receipts into the tenant-scoped formula result storage
   (with no raw video, student or health data by default).
3. Build separate DXF **read-only** importer and mocap-landmark adapter behind
   explicit user selection, source-license validation, coordinate metadata,
   unit checks, retention rules, and visual verification.
4. Build user-visible comparison of estimated labor/material quote vs actual
   reconciled work-order costs, preserving revision/approval history.
5. Adopt motion interpolation and uncertainty propagation only after direct
   timestamp/calibration reliability evidence; do not invent confidence.
