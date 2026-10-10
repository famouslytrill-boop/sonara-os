# SONARA Engineering Preview API — Phase 5 review gates (2026-10-09)

## Purpose and activation state

This change wires previously built **strict read-only adapters** into three
authenticated, rate-limited JSON preview routes. Default is **disabled**, even
after deployment, until the deployment operator sets the server-only
`SONARA_ENGINEERING_PREVIEWS_ENABLED=true` **after release approval**.

**Current status: draft branch only; no PR has been merged, no endpoint
deployed or flag activated.** Earlier stacked PRs #581, #583, #584 and #585
must land in dependency order following exact-head green release evidence.

The activation flag is checked by server-side middleware for each request;
a request body cannot override it. Even when enabled, the existing
`requireWorkspaceAccess()` middleware and durable-capable Postgres-backed
`createRateLimiter()` stay in the route execution chain. The rate limiter
has a bounded in-memory fallback if its store is unavailable; operational
approval must confirm production rate-limit durability before enablement.
**A feature flag is not an authorization mechanism.**

## Route contracts

| Method/path | Required workspace | Body | Output |
| --- | --- | --- | --- |
| POST `/api/business-builder/engineering/dxf-preview` | business_builder | JSON `{"dxfText":"<small ASCII DXF>"}` | Supported geometry length (meters), bounding box, source SHA-256 |
| POST `/api/business-builder/engineering/linear-estimate` | business_builder | JSON `dxfText`, `materialCostPerMeter`, `wastePercent`, `laborHours`, `loadedLaborCostPerHour`, `otherCosts`, `currency` | Non-binding material/labor total and quantity |
| POST `/api/creator-studio/engineering/pose-preview` | creator_studio | JSON MediaPipe 33-world-landmark frames with coordinateSpace, jointIndices and timestamps | Per-frame joint angles and validity statuses, optional rational media indices |

Only `application/json` requests are accepted. Existing server global
JSON parser is bounded at **1 MB**, while these routes separately limit
DXF source strings to 512 KiB and pose request JSON to 512 KiB. All
responses set `Cache-Control: no-store`. The router never accepts a path,
URL, external reference or multipart stream to read a file; it does not
invoke provider APIs, write to Supabase, create records or store video.

- Disabled flag -> **404**, without entering authorization or computation.
- Workspace authorization failure -> existing **401/403** policy (or login
  redirect for HTML callers, depending on existing auth middleware).
- Rate limit -> **429** from existing rate middleware, maximum 30 requests
  per hour for each hashed source-IP/subject counter.
- Wrong content type -> **415**; missing input -> 400/413 depending on
  route input; oversized request -> **413**; unsupported CAD/pose model ->
  **400** with bounded error code; valid supported input -> **200**.

These routes are compute/preview surfaces. They do not mutate an account,
post a bid, make a payment, create an order, or stream motion-capture data.
A payload source hash establishes byte equality, **not calibration, source
authenticity, certified drawing integrity or engineering accuracy**.

## Attack surface reduction

The DXF interpreter in this review also rejects:

- Any `SECTION` other than the minimal `HEADER` and `ENTITIES`. In a
  full DXF, `TABLES` contains layer metadata; ignoring it would produce
  deceptive material takeoffs when layers are hidden. This experimental
  implementation refuses such drawings rather than silently omit rules.
- `ENTITIES` before `HEADER`, duplicate/out-of-order sections, and
  hidden entities using visibility code 60 or negative entity color 62.
- All curved entities, unsupported bulges/width, non-default extrusion,
  3D faces, text, blocks/references, XREF, paper-space layouts and
  unsupported units.

**Important compatibility limitation:** most complete third-party AutoCAD
DXF drawings contain extra sections/layers/blocks. The strict subset will
reject them. Do not market full AutoCAD/DXF interoperability. A production
DXF adapter must handle these structures through a vetted library or
independently verified parser, with licensing and security review.

The Pose adapter only accepts already measured MediaPipe **world**
landmarks (hip-centered metric coordinates), not image-normalized 2D
landmarks. No ability to infer a person's global displacement/velocity is
added. Camera permissions remain unchanged and disabled by this work.

## Testing and release requirements

New:
- `routes/sonara-engineering-preview-routes.cjs`
- `tests/sonara-engineering-preview-routes.test.js`
- DXF parser hardening and regression coverage
- `server.js` registration with default-off operator gate.

Focused Node gate:

```sh
pnpm install --frozen-lockfile
pnpm exec mocha \
  tests/sonara-engineering-preview-routes.test.js \
  tests/sonara-dxf-readonly-intake.test.js \
  tests/sonara-pose-world-readonly-intake.test.js \
  tests/sonara-cad-linear-estimate.test.js \
  tests/sonara-measurement-pipeline.test.js \
  tests/education-stem-cad-mocap.test.js \
  tests/applied-formulas.test.js \
  tests/every-formula-can-be-saved.test.js
pnpm run verify:applied-migrations
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Also require: native Node `crypto.createHash("sha256")` tests, tenant/workspace
authorization tests using real middleware, rate-limit durability/failure
tests, secure headers, migrations replay, security scanners and controlled
deployment dry run. Earlier draft migrations remain unapplied.

**Isolated test evidence:** 58/58 dedicated JavaScript cases passed
in a V8 harness with a deterministic hash stub, plus successful sample
evaluations of all 110 registered formulas. This is NOT equivalent to
the above Node/pnpm CI, nor evidence the API is running in production.

## Operator rollout and rollback

1. Clear exact-head CI and security gates for PRs #581 → #583 → #584
   → #585 → this PR. Resolve any migration pin/DB discrepancies before
   applying schema changes.
2. Verify the production commit matches the reviewed head; confirm required
   workspace guards and rate limit RPC function exist and work.
3. Deploy with `SONARA_ENGINEERING_PREVIEWS_ENABLED` **unset/false**.
   Confirm preview endpoints return 404 to authenticated and anonymous users.
4. In a controlled canary environment with owner authorization, set
   `SONARA_ENGINEERING_PREVIEWS_ENABLED=true` and exercise successful,
   unauthorized, oversized, invalid, low-confidence, and rate-limited requests.
   Use a consenting test tenant and non-personal DXF/pose fixtures.
5. Check response time, memory, tenant access boundaries, log redaction and
   4xx/5xx metrics. Verify no raw source data is persisted/emailed/logged.
   Decide whether to promote only after gate evidence and review.
6. For immediate rollback, unset the server-only flag and deploy the disabled
   configuration. Confirm every preview route is inaccessible; rollback the
   release commit if required. Do **not** rollback applied DB migrations
   blindly or weaken the release gate.

## Research references

- Autodesk LWPOLYLINE group semantics (width, bulge, extrusion):
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm
- MediaPipe Pose world coordinates and metric hip-centered origin:
  https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- OWASP File Upload Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP secure by default:
  https://devguide.owasp.org/en/04-design/02-web-app-checklist/01-secure-by-default/
- OWASP security feature-flag bypass test guidance:
  https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management/15-Feature_Flag_Security_Bypass/
