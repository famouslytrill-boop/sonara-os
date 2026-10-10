# SONARA shared trust, cross-platform reliability and performance — 2026-10-09

**Status:** reviewed engineering plan and incremental PWA cache hardening. This is not a statement that production is certified or customer features are fully operational.

## Scope and architecture decision

SONARA Industries is the parent brand; SONARA One is the shared application platform; Business Builder, Creator Studio and Growth Studio are separately positioned products built on the same Express/Node 24 runtime. Keep shared identity, tenant authorization, consent, billing entitlements, provider connections, audit events and observability **single-source**. Keep each product's navigation, workspace records and customer workflows product-scoped.

The repository already has contracts for tenants, subscriptions, capabilities, routes, Android TWA, release verification and browser tests. Do not create replacement Next.js, identity or payment stacks merely for a design refresh. Corporate subsidiaries are a legal question, not something a code branch can establish.

## Evidence-backed security standards

| Concern | Baseline | Required SONARA proof |
| --- | --- | --- |
| Secure development | NIST SP 800-218 SSDF v1.1 (final); v1.2 draft is not final | Trace threat model, code review, testing, provenance and recovery records to release SHAs |
| Application security | OWASP ASVS 5.0 | Server-verified sessions; tenant membership plus resource/action scope, consistent authorization and negative tests |
| Android/iOS security | OWASP MASVS and MASTG | Local storage, platform permissions, HTTPS, session revocation, app association and device testing |
| Accessibility | WCAG 2.2 AA | Keyboard/focus, no obscured focus, errors and labels, reflow, contrast, screen-reader and touch tests |
| Web performance | Core Web Vitals | Mobile and desktop **field** p75 LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1; include real-user sample/coverage |
| PWA caching | MDN Cache API/CacheStorage, web.dev service-worker caching | Public-asset allowlist; network-only private routes; rejection of sensitive requests/responses; offline fallbacks never impersonate completed writes |

Primary references:
- https://csrc.nist.gov/pubs/sp/800/218/final
- https://owasp.org/www-project-application-security-verification-standard/
- https://mas.owasp.org/MASVS/
- https://www.w3.org/TR/WCAG22/
- https://web.dev/articles/defining-core-web-vitals-thresholds
- https://developer.mozilla.org/en-US/docs/Web/API/Cache
- https://web.dev/articles/service-worker-caching-and-http-caching

## P0: protect the source and production execution plane

1. **Branch governance:** GitHub reported `main.protected=false` on October 9, 2026. Configure protection/rulesets with required exact-head checks, controlled reviewer approval, blocked force-pushes/deletions and no direct unreviewed merges. The GitHub integration cannot edit the protection endpoint. Do not claim it is enabled.
2. **Release chain:** on the final head SHA execute locked dependencies, typecheck, lint, full test/coverage, build, route/API and security contracts, native PostgreSQL migration replay and browser/device gates. Treat missing/skipped required jobs as **unknown**, not green.
3. **Data authority:** migrate only from reviewed SQL with backups and restore drills; verify tenant RLS as both member and attacker, service-role isolation, function grants, durable idempotency and production schema drift. No live migration as part of this document.
4. **Identity + payment:** prohibit owner-bypass in customer workloads. Mutations require authenticated user, active tenant membership, resource ownership, action grant, no lock and explicit owner approval for sensitive actions. Payment/subscription entitlements arise from provider-verified, tenant-bound evidence, never browser assertions.
5. **Connector egress:** approved provider-specific HTTPS origins and secrets kept server-side; bounded retries/timeouts; safe redirects; scrubbed structured logs; customer-visible disconnect; ability to revoke authorization.
6. **Deployment control:** maintain a dry-run, signed artifact provenance, one-tenant canary, automatic stop criteria, rollback rehearsals, and post-deploy health and commit evidence before making a customer-availability claim.

## P1: shared cross-platform execution contract

| Surface | Product/customer contract | Gate |
| --- | --- | --- |
| Desktop/mobile web | Same route, action result, error and accessible controls; low-bandwidth fallbacks | Chromium/Firefox/WebKit; 320/390/768/1280 px; keyboard and screen-reader passes |
| Installable PWA | Canonical manifest, public offline page, conservative public asset caching | No caching any account URL, bearer URL, personalized response or business transaction |
| Android TWA | Verified app association, real release signing, notification/permission consent | Play-signed AAB, asset links on production domain, physical-device cold/warm/auth flows |
| iOS web / Home Screen | Core web flows without mandatory native features; progressive enhancement | Safari and installed-mode flow; unsupported APIs show truthful fallback |
| Cross-device account | Server-side user/session/tenant authority, explicit device action consent | Cross-account browser cache tests, session revocation and offline queue isolation |
| Provider adapters | Read and write via per-tenant grants, auditable delivery receipts | Reauthorization, outages, replay/conflict and provider-rejection tests |

Resource policy: no automatic camera/microphone/location/notifications on page load. Provide opt-in and revoke controls; when an API is unavailable, display an actionable unsupported state. An offline enqueue must not be described as a successfully committed server transaction.

## P1: one consistent economic path per child product

**Business Builder:** captured lead -> quote -> owner approval -> booking/order -> payment evidence -> inventory reservation -> fulfillment -> reconciliation -> customer receipt. Use one authoritative stock ledger, integer minor currency units and exact idempotency keys. A draft PO receipt table cannot be described as complete warehouse accounting.

**Creator Studio:** rights provenance -> project graph -> approved generation estimate and usage reserve -> queued render -> moderation/review -> licensed marketplace listing -> verified purchase -> controlled delivery -> settlement. Measure provider cost and margin per job; a preview is not proof of licensed fulfillment.

**Growth Studio:** audience opt-in -> approved campaign -> channel connector eligibility -> rate-limited dispatch -> delivery receipt -> unsubscribe/bounce processing -> attribution and revenue reconciliation. Avoid fabricated reach/conversion numbers when provider evidence is missing.

**Parent SONARA:** explicitly public, rights-cleared discovery only. No private child tenant content in public indexing. Cross-product administration must be scoped to each customer organization's permission grants.

## P1: performance and resilience budget

- Capture separate p75 Core Web Vitals for mobile and desktop. Measure a representative sample and report the number of sessions, timeframe and which routes were covered; do not claim compliance from a single Lighthouse run.
- Define practical service objectives for availability, route p95, database/query p95, queue age, payment reconciliation lag, provider failure rate, and failed job rate. **Baseline before selecting targets**; alert on user-impacting conditions, not alert volume.
- Apply explicit timeout and concurrency budgets to every outbound adapter. Bound payload size, retries and costs. Queue expensive media operations; support cancellation and dead-letter/manual review rather than retry storms.
- Add controlled fault injection: absent OAuth provider, database 500, stale sessions, double webhook, concurrent receipts, offline replay, wrong tenant, unsupported permission and cache failure.
- Set per-tenant resource budgets and admission control so one customer's GPU/media burst or connector backlog does not starve another customer's booking/payment flow.

## Increment delivered in this review branch

- Restrict service-worker static cache interception to public root assets and first-party `/brand/` and `/fonts/` directories, rather than all URL paths ending in a static extension.
- Reject credential-like query parameters, authenticated or explicit no-store requests, responses carrying Set-Cookie, Cache-Control private/no-store, Vary Cookie/Authorization/* and non-200/opaque responses.
- Rotate the static cache namespace so the prior extension-based cache is removed on new-worker activation.
- Add simulated service-worker fetch-event regression tests covering all three products' private paths, permitted public assets, credential-sensitive data and navigation behavior.

**Remaining proof:** exact-head CI, manual browser service-worker upgrade check, actual multi-account/cache inspection, mobile device trials and production telemetry. This branch must remain draft and must not deploy itself.

## Operational rollout checklist

1. Review diff, assign the security/browser owners and verify this branch does not conflict with payment, migration or notification draft work.
2. Obtain full CI on its final SHA, then verify the root public pages, all three product entry points, old-to-new service worker activation and offline experience in browser profiles with and without a user session.
3. Confirm a previously cached private-looking URL is not available after activation, that authorization-sensitive responses never enter CacheStorage and that all static assets still load on constrained/mobile networks.
4. Manually verify a signed Android build and Safari installed mode; document findings and product-specific limitations.
5. Merge only after branch governance is active and recorded. Deploy via the controlled procedure, record deployed commit, monitor and retain rollback evidence. Never turn on customer sends, payments or durable workers just because PWA tests pass.


## 2026-10-09 follow-up: fail-closed cache-control admission (draft PR #570)

OWASP explicitly treats cache authorization state, URL-to-content-type agreement and cache-key design as part of preventing web cache deception. MDN describes `FetchEvent.waitUntil()` as the service-worker lifetime mechanism for revalidation work. Relevant references:
- https://cheatsheetseries.owasp.org/cheatsheets/Web_Cache_Security_Cheat_Sheet.html
- https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent
- https://developer.mozilla.org/en-US/docs/Web/API/Cache

This branch now rejects static-response caching unless **all** conditions are true: public root/brand/font asset path, accepted query format, no authenticated/no-store request, HTTP 200 without redirect/opaque response, extension-matched MIME, explicit `Cache-Control: public`, no `private`/`no-store`/`no-cache`, no `Vary: Cookie`/`Authorization`/*, and no visible `Set-Cookie`. Public Express static assets currently use `Cache-Control: public, max-age=300, stale-while-revalidate=86400` or the explicit immutable revision policy. Ordinary dynamic responses no longer implicitly qualify just because an extension matches.

The generic offline HTML is deliberately a different exception: it is fetched with `credentials: "omit"`, must be 200, HTML, unredirected and without session-sensitive headers. It **does require** an explicit `Cache-Control: public` directive, as well as rejecting `private`, `no-store`, `no-cache`, `Vary: Cookie/Authorization/*` or `Set-Cookie`. The Express `/offline` route overrides the default no-store HTML middleware only for this cookie-independent fallback; all normal parent and product pages remain no-store. No other navigation HTML is cached.

### Source-level proof versus integration proof

The latest service-worker blob was exercised with **13 synthetic fetch/install/activation assertions**, all passing: public script retention; three product-private path exclusions; authorization and token bypass; HTML-as-script rejection; no-store and non-public cache policy rejection; cookie-vary rejection; safe offline install; unsafe offline refusal; old cache namespace eviction. These were in-process mock runtime checks of the exact GitHub source, **not** a substitute for GitHub CI or Playwright browser evidence.

The committed Mocha and Playwright suites are intended to independently verify these properties. All exact-head GitHub CI checks still require completed and passing runs before approval. Main branch protection, native PostgreSQL migration replay, handoff document consistency, Android/iOS device checks and production connectivity are separate blocked release gates. No live migrations, deployments, provider sends, customer operations or production availability changes were made here.


## 2026-10-09 engineering continuation: credential isolation and server/worker parity

The previous worker fetched static assets with the original page request. A same-origin `Request` commonly carries session cookies by default. That is an unnecessary risk for the origin-wide public cache even when a MIME/header guard is present. This branch now normalizes every intercepted public static request using `new Request(event.request, { credentials: "omit" })` before both its network fetch and CacheStorage match/write. Requests with an Authorization header continue to bypass interception; explicit `no-store`, `no-cache`, and `reload` request cache modes bypass interception. The cache namespace has been rotated to v5 to evict earlier entries. Reference: https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials

A mismatch was discovered and fixed: the Express-wide no-store middleware also marked `GET /offline` no-store, so a privacy-respecting service worker would refuse its own fallback installation. The **fixed, generic, anonymous** offline HTML route now sets `Cache-Control: public, max-age=0`; the service worker expressly requires this header and refuses any sensitive response. New server tests check no-store on `/`, `/pricing`, and all three child product pages, plus anonymous-versus-cookie response parity on `/offline`. Browser test checks actual offline heading **You are offline.**, public/no-store server header separation and normal recovery after reconnect.

### Reproducible evidence and pending blockers

The latest source-level Mocha-style test file, tested against the exact GitHub worker blob with a standalone V8 synthetic Node/Headers/URL adapter, passed **10 of 10 assertions** (not a full Node 24/Mocha invocation). The latest **real CI workflows remained queued/pending**, so no claim of passing Chromium/Firefox/WebKit or full Node/replay pipelines is justified. No production or database mutation was made. The release remains blocked until exact-head CI, branch protection and independent browser/device/tenant reviews are completed.


## 2026-10-09 follow-up: stale public-cache revocation and HTTP revalidation

The earlier stale-while-revalidate worker would retain an older public CacheStorage response even after a successful network response reported that the asset had become private, changed its MIME type, was redirected, or was removed. Cache API entries do **not** automatically honor new HTTP cache directives. This is an authorization and lifecycle inconsistency, not proof that actual customer data leaked.

The `public/sw.js` worker now invalidates its own cached public asset when a subsequent response definitely changes its eligibility: HTTP 200 with non-public cache policy or wrong MIME, a redirect, or 401/403/404/410/451. Temporary 5xx/429 responses, 206 partial responses, and 304 revalidation do not trigger eviction. If the entry's `cache.delete(request)` fails, the fallback deletes only the `sonara-public-...` cache namespace, not caches owned by other modules. Namespace v6 evicts the earlier v5 store during service-worker activation.

**Important revalidation finding:** the server uses long-lived immutable HTTP caching for versioned static resources. Merely calling `fetch(publicRequest)` could return an unvalidated browser HTTP-cache hit, preventing the worker from observing an origin-side policy change. The worker now uses `fetch(publicRequest, { cache: "no-cache" })`: the browser performs conditional HTTP validation when applicable instead of blindly trusting a fresh immutable HTTP cache, preserving transfer efficiency for unchanged ETag/Last-Modified assets. This does not override an incorrectly configured intermediary CDN or prove live production purging.

**Known strategy limit:** stale-while-revalidate can deliver a previously cached *public* asset one final time while the revalidation and revocation run in the background. Never use this public cache for sensitive or private responses. A strict immediately-effective revocation would require network-first access or an out-of-band invalidation protocol. Customer content remains outside this worker's allowed URL namespace.

### Source verification
The exact GitHub service-worker and Mocha source blobs were exercised using a synthetic V8 Node/URL/Headers adapter: **13 of 13 defined test cases passed**, including newly added revocation-policy changes, permanent removal, temporary error preservation, per-entry deletion failure isolation, anonymous request handling and forced HTTP revalidation. This is **not** real Node 24, Mocha, PostgreSQL, Chromium, Firefox, WebKit, Android or iOS verification. The draft PR must not merge without those mandatory exact-head controls and manual review.

References:
- https://cheatsheetseries.owasp.org/cheatsheets/Web_Cache_Security_Cheat_Sheet.html
- https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete
- https://developer.mozilla.org/en-US/docs/Web/API/Request/cache
- https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent
