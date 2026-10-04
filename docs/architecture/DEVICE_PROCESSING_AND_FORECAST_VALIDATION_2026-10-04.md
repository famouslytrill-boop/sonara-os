# Device processing and forecast validation

Date: 4 October 2026. Base: main `054ade9a38c5e3601c68061e9dfff29061c3d9b0`.
This reconstructs the reviewed device/forecast update on current main, including
the marketplace update in PR #424. The unpublished transient checkout expired;
the earlier local SHA `34db63b` is not a published commit or deployed release.

## Implemented behavior

| Surface | Behavior and control |
| --- | --- |
| Creator Generation image editor | Owned PNG/JPEG/WebP up to 20 MB, 16 megapixels and 8192 pixels per side; devices reporting at most 2 GB use a 4 megapixel limit |
| Image processing | Bounded GPU tiles, CPU Worker fallback, then cooperative CPU fallback; progress, cancellation and repeat edits from retained originals |
| Camera | User-started local preview and PNG photo; photo enters the editor without a file picker; no upload/publication |
| Microphone | User-started local recording, browser-supported container, playback/download, up to 60 seconds and 8 MB |
| Account permission API | Fresh authenticated-user decisions; no request-selected identity, no cached grants; unreadable settings refuse access |
| Business demand forecast | Existing deterministic Holt/grid-search forecast with separate chronological one-step holdout accuracy and naive baseline |

Capture requires a click, saved account opt-in and browser permission. Camera
does not also request microphone. The account bound into the page must match the
verified session. A second check after the browser prompt refuses delayed streams
after account permission changes. Capture stops on departure, visibility loss,
track termination, cancellation, failed periodic verification or duration limit.
Continued work verifies account access every five seconds; checks have ten-second
deadlines. Manual camera stop retains an explicitly taken photo; departure or
verification failure clears temporary links. No voice cloning, remote streaming
or automatic workspace storage is introduced.

## Processing limits and formula

The shared browser/Node/Worker core owns bounds and integer RGBA scaling. Tiles
have at most 262,144 pixels (1 MiB). GPU and CPU implement
`min(255, floor((channel * percent + 50) / 100))`, preserving alpha. Only tiles
are sent to the Worker. GPU jobs reuse the pipeline and release per-tile buffers.
Results report the actual engine. Cancelled/failed edits restore the original
preview. No remote inference or subscription allowance is used.

This is bounded eight-bit processing, not HDR/color management, generative
upscaling, arbitrary GPU workloads or a graphics driver. Decoded input and canvas
still occupy memory; tiling does not promise constant total memory. Planning
estimates 16 bytes per pixel plus tile space. Decoding precedes the dimension
check; constrained browsers can refuse allocation or evict their process. PNG
exports and object URLs stay local.

## Forecast evidence

Missing, malformed, sparse, negative or non-finite histories, more than 4096
observations and figures over one trillion are refused rather than silently
dropping periods. Final forecasts still fit all valid history using the fixed
parameter grid. Validation needs ten observations: the final quarter (minimum
two, leaving at least eight) is excluded from validation tuning. Each held-out
value is predicted before updating level/trend. The naive last-observation
baseline uses the same periods. Validation exposes parameters, sample size and
MAE; legacy training-error fields remain, with `trainingMeanAbsoluteError` naming
their meaning. The customer accuracy statement uses holdout error. Eight/nine
observations can fit a trend but cannot claim validated accuracy. A baseline win
is historical one-step evidence, not full-horizon accuracy, seasonality, a
confidence interval or guaranteed sales. A loss does not diagnose random demand.

## Database and release scope

The earlier read-only inspection matched all 150 migration versions to active
Supabase history. Permission, project, generation-job and usage-reservation tables
had RLS enabled; permission SELECT/INSERT policies restricted rows to `auth.uid()`.
This update reuses those tables. It changes no production rows, permissions,
prices, credentials or migration history and needs no new migration. Policy
inspection does not replace the live member-read check, which requires credentials
and a verification-user JWT absent from this checkout.

Camera policy is overridden only on the authorized Creator page. Public tools
remain four per child and three at the parent, with results accessible without
sign-up. Release requires exact-head CI, intentional merge, controlled deployment
and live-commit/post-deploy verification. Local tests do not establish deployment.

## Remaining scope

| Work | Evidence still needed |
| --- | --- |
| Android/Apple | Signed package, physical-device tests, distribution/signing decisions |
| Storefront/marketplace/POS | Provider-backed purchase, idempotent settlement, delivery/reconciliation, approved merchant/device adapter and certification |
| Social/market tracking | Authorized scopes, receipts, consented attribution and recovery evidence |
| Streaming/game servers | Provisioned transports, admission control, concurrency/bandwidth limits and recovery proof |
| Heavy video/GPU | Licensed tools, isolated workers, authorized storage, resource quotas and actual device/output qualification |
| Logistics/forecasting | Defined tenant series, source freshness, reconciliation and decision-specific validation |
| Customer proof | An authorized customer's completed task and repeat use; synthetic QA is not a sale or testimonial |

This is an application platform update, not a kernel or native store release.
Finite serverless duration/payload limits mean remote media paths need authorized
object-storage transfers and isolated jobs, rather than unbounded request bodies
or always-on streaming inside HTTP functions.

## Primary references checked for this implementation

- [Android permissions](https://developer.android.com/training/permissions/requesting)
- [Apple capture authorization](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media); native reference only, no device claim
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Forecast accuracy](https://otexts.com/fpp3/accuracy.html)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)

## Validation

Permanent tests cover account scoping/failure/cache refusal, holdout tuning
isolation and independently calculated error, malformed history, memory bounds
and exact pixel/alpha math. Browser tests use shipped code and actual Canvas,
Workers and MediaRecorder, with controlled permission responses and synthetic
tracks. They cover 4K export dimensions/pixels, no uploads, camera/photo handoff,
audio download, late-stream cancellation/revocation, account changes, outages,
cancellation, memory refusal, visibility cleanup and duration limits.

The reconstruction requires fresh checks; earlier counts are not substituted
for this tree's results. Physical Android/iPhone, GPU hardware and real POS,
provider and customer execution remain unverified. Local migration replay and
Python coverage can skip unavailable binaries/dependencies; CI requires both
migration execution and complete Python measurement. Chromium 138 is isolated
QA tooling and adds no application dependency.

Fresh reconstruction results: 5,937 server tests passed with six pending; all
30 browser checks passed. Frozen installation, moderate audit, typecheck, lint,
build, client-secret scan, documentation checks and local release gates passed.
Runtime coverage was 94.6%. Migration replay was skipped without PostgreSQL;
Python measured 102 tests with 21 files unmeasured without their dependencies.

Security review follow-up: the image Worker now refuses supplied foreign origins
while preserving the dedicated-worker channel's empty origin. Tests cover both
refusal and successful bounded processing. The updated tree passed 5,939 server
tests with six pending and all 30 browser checks, plus frozen installation,
moderate audit, typecheck, lint and build. No CodeQL query was suppressed.

Combined-main follow-up results: 5,953 server tests passed with six pending; all
30 browser checks passed with a complete final report. Frozen installation,
moderate audit, typecheck, lint, build and local release gates passed. Generated
metadata now reflects 437 test files, 53 deterministic formulas and 369 maintained
runtime notice files. Migration replay remains unexecuted locally without
PostgreSQL; the CI gate requires execution before deployment.
