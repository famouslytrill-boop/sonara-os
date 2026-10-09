# SONARA read-only CAD and pose intake — v1 (2026-10-09)

## Status, dependency chain and outcome

Code-only internal intake adapters, built on measurement pipeline PR #584,
which depends on formula PR #583, which depends on baseline PR #581.
This is **not a deployed API, AutoCAD plugin, DWG reader, MediaPipe model
runner, cloud camera service or CAD construction estimator**.

New modules:
- `lib/sonara-dxf-readonly-intake.cjs` — strictly bounded ASCII DXF subset.
- `lib/sonara-pose-world-readonly-intake.cjs` — precomputed MediaPipe Pose
  **world** landmarks in meters, for human-selected 3-point joint angles.

Neither adapter adds a web route, table, dependency, camera permission,
cloud upload, image processing, file-system read/write or background job.
They accept already supplied strings/objects and compute synchronously.
An authenticated web upload endpoint and retention rules require independent
design, threat modeling and authorization review.

## 1. CAD DXF contract

`parseAsciiDxf(text)` reads text, returning:
`{ok,format,parserVersion,sourceUnit,canonicalUnit,entityCount,
lineCount,polylineCount,segmentCount,totalLengthMeters,boundsMeters,evidence}`.

Supported **only**:
- ASCII DXF with bounded two-line group-code/value pairs, HEADER and
  ENTITIES sections and EOF, and one valid `$INSUNITS` code.
- Explicit units: inches (1), international feet (2), mm (4), cm (5),
  meters (6), km (7), yards (10), historical US survey feet (21).
- Model-space LINE entities with finite 3D start/endpoints.
- Straight LWPOLYLINE vertices in the default object coordinate system,
  no elevation or thickness, no width/bulge, and optional closed-loop flag.
- Up to 512 KiB text characters, 30,000 group pairs, 1024 entities,
  and 2048 accumulated vertices. No external packages or recursion.

Rejected **by design**:
- Unitless/ambiguous/unsupported units; paper space, ambiguous HEADER;
  mismatched polyline vertex count, nonstandard OCS/extrusion.
- Curved bulge segments, any nonzero polyline width, elevations, thickness,
  unsupported entity kinds (`INSERT`, `ARC`, `CIRCLE`, `SPLINE`,
  `HATCH`, `TEXT`, 3DFACE, proxy/custom entities), malformed
  sections, invalid groups, binary/control characters, overflow and
  excessive inputs.
- Blocks/external references are NOT flattened, guessed or ignored
  silently when referenced by an INSERT in ENTITIES. Unsupported model
  drawing entities cause a refusal, not a deceptively partial total.

Returned length is the sum of **supported** straight segments converted to
meters; a closed polyline includes its final-to-first edge. Bounds are the
axis-aligned 3D bounding box for those explicitly interpreted segments.
No area, structure, mass, certified construction material requirement,
planning permission or export of DXF/DWG is inferred. Input SHA-256 is
returned for independently verifying a source file, but input content
is not returned or persisted.

A genuine DXF import implementation needs blocks, inserted transforms,
OCS/UCS, arcs/splines, bulges, XREF, polyline widths, entity visibility,
modelspace filtering, external drawings and robust version handling.
**Do not advertise full AutoCAD interoperability.**

## 2. Pose world landmark contract

`parsePoseWorldLandmarks(request)` input shape:

```json
{
  "schemaVersion": 1,
  "coordinateSpace": "mediapipe_pose_world_meters_hip_centered",
  "source": {"origin": "manual_export", "reference": "session-01"},
  "jointIndices": [11, 13, 15],
  "minVisibility": 0.8,
  "frames": [
    {"timestampUs": 0, "landmarks": [
      {"x": 0, "y": 0, "z": 0, "visibility": 1}
    ]}
  ],
  "timeline": {
    "startTimestampUs": 0,
    "rateNumerator": 30000,
    "rateDenominator": 1001
  }
}
```

**Note:** the abbreviated single-landmark frame above illustrates the
object shape only, not a valid example. Every real `frames[*].landmarks`
must contain exactly 33 world landmarks.

The adapter validates timestamps, 33 landmarks per frame, every XYZ
and visibility number, 3 distinct indices in 0..32, and a 0..1 threshold.
It computes each angle at the middle index using SONARA's existing
`mocap_joint_angle_degrees` allowlisted formula. Low confidence or
zero-length vectors yield an explicit frame status and `angleDegrees:
null`, never an invented angle. Optional rational media frame indices
reuse `frameIndexAtTimestamp` from the measurement pipeline.

Limits: 1–128 frames, strictly increasing integer microsecond timestamps,
world coordinates in bounded meters, confidence 0–1. Output returns
angles and validation statuses only, not raw world landmarks, video,
biometric identities, segmentation masks or model internals.
SHA-256 covers *selected relevant numeric landmark data*, source metadata,
joint definition and timing. It may still be linkable biometric-like
measurement metadata; do not persist or share it without appropriate
privacy review and user consent.

**World landmark nuance:** Google MediaPipe world pose coordinates use the
hip midpoint as origin. Even when XYZ values are measured in meters,
successive frames do not automatically share a stationary Earth/world
reference frame. Therefore this adapter intentionally does NOT calculate
body translation speed or global pose displacement. The separate
motion measurement pipeline requires calibrated common-frame samples.

## 3. Tested invalid conditions

`tests/sonara-dxf-readonly-intake.test.js` and
`tests/sonara-pose-world-readonly-intake.test.js` cover:
- Accurate bounded line/polyline total and unit conversion.
- International vs historical survey feet.
- Unsupported units, arcs, splines, insert blocks, curved bulges,
  paper-space, extrusion and malformed vertex counts.
- Valid joint angles and rational frame alignment.
- Low visibility and degenerate vectors produce no angle.
- Reject normalized 2D coordinates presented as metric 3D.
- Invalid timestamps, bad pose array size, unexpected source or joint,
  unsafe numeric inputs and returned-data minimization.

Test with native Node and the repository gate suite:

```sh
pnpm install --frozen-lockfile
pnpm exec mocha tests/sonara-dxf-readonly-intake.test.js tests/sonara-pose-world-readonly-intake.test.js tests/sonara-measurement-pipeline.test.js tests/education-stem-cad-mocap.test.js tests/applied-formulas.test.js tests/every-formula-can-be-saved.test.js
pnpm run verify:applied-migrations
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Full CI, native SHA-256 execution, release security verification,
migration integrity and correct tenant-workspace checks MUST be verified
at the exact branch head. All changes remain on draft pull requests.

## Standards reviewed

- Autodesk DXF header group codes and `$INSUNITS`:
  https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm
- Autodesk LWPOLYLINE `42` bulge, `10/20` vertex and `70` closed flag:
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm
- Google MediaPipe Pose Landmarker world-3D vs image-normalized:
  https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- World landmarks hip center in meters:
  https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md
