# SONARA cross-device interface and hardware architecture (8 October 2026)

**Status:** implementation slice proposed in a review branch, not deployed or native-device-qualified.

**Product scope:** SONARA One, Business Builder, Creator Studio, Growth Studio.
SONARA OS is an **application operating environment**, not a replacement for Android, One UI, iOS, iPadOS, macOS or device firmware.

## Research translated into engineering contracts

| Platform | Useful public design guidance | SONARA contract |
| --- | --- | --- |
| Samsung One UI / Galaxy phones | Task-first layout, controls within reach, clear separation of viewing and interaction | Compact touch workspace shortcuts; clear scrollable content; no inaccessible swipe-only action |
| Galaxy Z Fold / Flip, Galaxy Tab, Samsung DeX | App continuity, resize, multitasking, multi-pane layout and posture | Layout follows **available window width**, not phone model; do not discard in-progress drafts on resize; test split-screen and fold/unfold transitions |
| Google Pixel / Android | Adaptive Material 3 patterns, window size classes, navigation bar / rail / drawer | Compact below 600 CSS px; evaluate list/detail 600–839; large workspaces at 840+; native shell should use WindowInsets / Material adaptive components |
| iPhone / iPad / Mac | Human Interface Guidelines: safe areas, simple gestures, scalable text, responsive windows | Safe-area-aware viewport, keyboard/VoiceOver paths and size changes; prefer platform file pickers and system authorization controls |
| Desktop browsers / PWAs | Semantic HTML, keyboard and mouse alongside touch, reduced motion, independent screen readers | Existing SSR pages and URLs remain the source of navigation truth; do not invent a second router or require JS to navigate |

Primary references:
- Samsung One UI: https://developer.samsung.com/one-ui/index.html
- Samsung large-screen: https://developer.samsung.com/one-ui/largescreen-and-foldable/intro.html
- Samsung foldable continuity: https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html
- Android adaptive: https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps
- Android edge-to-edge: https://developer.android.com/develop/ui/views/layout/edge-to-edge
- Apple HIG layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HIG accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HIG privacy: https://developer.apple.com/design/human-interface-guidelines/privacy/
- Web safe areas: https://web.dev/learn/pwa/app-design
- WCAG 2.2: https://www.w3.org/WAI/WCAG22/quickref/

## Implemented in this slice (review branch)

1. `lib/sonara-page-frame.cjs` emits an authenticated-only, non-marketing four-destination work dock pointing to the already-rendered `/dashboard`, `/business-builder/dashboard`, `/creator-studio/assets`, and `/growth-studio/campaigns` routes. Plain links work without JavaScript.
2. Viewport uses `viewport-fit=cover`. `ui/sonara/styles/99-zzzzzz-frontend-operations-2026.css` and its served counterpart `public/sonara-application-ui.css` apply safe-area insets, a compact-touch dock, touch targets >=48px, focus indication, landscape fallback, keyboard-focused hiding and print suppression. Existing desktop header and mobile menu are retained.
3. `tests/cross-device-workspace-navigation.test.js` guards the exact dock destinations, authorized rendering condition, canonical stylesheet synchronization, safe-area handling and non-permission behavior.

No new dependencies, analytics, customer records, database migrations or device permissions are required. There is **no** claim of native iOS/Android app implementation or a real-world device test in this slice.

## Capability boundaries and planned adapters

| Capability | Browser/PWA | Android native | Apple native | Consent / fallback |
| --- | --- | --- | --- | --- |
| Photo/file input | File input or picker, user initiated | System Photo Picker / SAF | PhotosPicker / document picker | No media library sweep; manual upload fallback |
| Camera, microphone | `getUserMedia` on supported secure contexts | CameraX + platform runtime permissions | AVFoundation + Info.plist purpose strings | Ask only from the feature action; deny = upload/transcript/typed text |
| Location / mapping | Geolocation where supported | Fused/system location with foreground scope | Core Location, optional one-time authorization | No background tracking without separate purpose, permission and store review |
| Motion / orientation | Feature-detect sensor APIs and request platform consent if needed | SensorManager | Core Motion | Not required for core forms; alternative physical controls |
| Notifications / haptics | Web Push where supported; capability checks | Notification runtime permission, vibration/haptic APIs | UNUserNotificationCenter / haptic feedback | **Off by default**, user opt-in and reversible |
| Offline records | Existing service worker / customer-scoped drafts where supported | App-scoped encrypted storage, background queue | App-scoped storage / BackgroundTasks | Never assume replay is authorized; idempotency, conflict detection, tenant isolation |
| Passkeys | WebAuthn on compatible browsers | Credential Manager | AuthenticationServices | Offer password/approved recovery path; server verifies credentials |
| Multitasking / foldables | Window-width and visibility event handling | Activity lifecycle, WindowManager posture, WindowInsets | SwiftUI size class / scene lifecycle | Preserve unsaved work; no auto-submit on orientation change |

**Trust boundary:** client device APIs are optional inputs, not authorizers. Server tenant resolution, permission checks, provider budgets, audit and owner approval remain authoritative. Do not grant refund, payout, data deletion or publication privileges based on device or browser characteristics.

## Operating-model architecture

```text
SONARA application environment (server routes / workflow / tenant authorization)
  -> canonical SONARA design tokens and SSR content
  -> adaptive web shell (phone | foldable | tablet | desktop | PWA)
  -> native distribution adapters [independent release gates]
       Android / Galaxy (TWA or native shell, WindowInsets and device lifecycle)
       Apple (native shell, safe areas, app lifecycle and permissions)
  -> capability broker (user-initiated, opt-in, least privilege, revocable)
  -> job queue / synchronization engine (idempotency + recovery + audit)
```

Samsung and Apple visual assets, glyphs, trademarks, proprietary UI components and screenshots are reference material only. Do not copy their trade dress into SONARA code. No third-party SDK is authorized by this document.

## Device and browser qualification matrix (not yet executed)

- Narrow phone 320 and 360 px; Galaxy/Pixels 390–430 px: no horizontal scroll, dock visible only for authenticated touch workflows, 48px links, header/account menu usable.
- iPhone Safari / installed PWA: safe area around Dynamic Island, home indicator, keyboard, zoom and screen-reader focus.
- Galaxy Z Fold/Flip closed, half-open and open; 600–839 px medium app window; rapid resize and app continuity with unsaved forms.
- Galaxy Tab / iPad in landscape and split view, 840/1024/1366 px: readable list/detail, rail where relevant, no loss of controls.
- Samsung DeX, macOS, Windows, ChromeOS, 1440px+ with keyboard and mouse: no bottom dock and no pointer-only control.
- Accessibility: 200% zoom, VoiceOver/TalkBack, keyboard-only, high contrast, reduced motion, RTL and translated long labels, semantic landmarks and WCAG 2.2.
- Connectivity: offline first visit vs cached revisit, retrying requests, service-worker update, account isolation, route redirects.
- Security: no permission prompt at page load, no non-consensual capture, no cross-tenant draft leakage, CSP unchanged.
- Run `pnpm test -- --grep "cross-device workspace navigation"` as a targeted test *if supported by this repository's Mocha runner*, then use `pnpm test`, `pnpm run lint`, `pnpm run build`, `pnpm run verify:config`, and Playwright/browser device QA. The exact-head CI and mobile packaging release gates must be green before any merge or deployment.

## Next implementation order

P0: browser screenshots and geometry on the listed devices, including safe areas and virtual keyboards. Fix any actual overlap before merge.
P0: verify exact-head CI, accessibility and production release gates. Do not bypass failures or touch payments/tenant authorization to ship UI.
P1: convert existing `sonara-ops-shell` list/detail screens into measured container-query layouts, not one blanket layout for every route.
P1: native Android (Compose adaptive / insets) and iOS (SwiftUI safe areas) wrappers with signed device evidence; implement permission prompts only behind approved feature actions.
P1: foreground/background lifecycle, offline queue conflict UI, explicit camera/microphone/location consent and denial fallbacks.
P2: stylus, keyboard shortcuts, drag/drop, external display and fold posture, only after repeatable device evidence and usability testing.


## Phase 2: narrow panel and focus-visibility hardening (review branch)

Additional technical findings:
- WCAG 2.2 SC 2.4.11 requires a focused component to remain at least partially visible even with sticky/fixed page chrome. Body padding alone is not a focus scroll contract. A dock-bearing page now declares its own HTML state, and CSS adds matching `scroll-padding-block-end`; short landscape and print explicitly remove it.
- Device screen width is not enough to size a component inside a desktop split-screen or inspector. The existing `.sonara-ops-panel`, `.sonara-ops-detail` and `.sonara-ops-inspector` now establish inline-size query contexts, with stacked command controls below 420px. No additional token authority or dependency is introduced.
- Samsung foldable continuity includes maintaining the same scroll position, entered text and keyboard through fold/unfold. The browser contract now checks text retention during live viewport resizing, but true device posture, virtual keyboard and hinge occlusion still need physical/simulator qualification.
- Browser virtual keyboards differ: some resize the visual viewport only, while others resize the layout viewport. SONARA does not assume a single browser behavior and does not force the experimental VirtualKeyboard API.

Added automated browser tests to the **existing** Browser Quality workflow's already-listed `browser-tests/public-experience.spec.js`. These test the authenticated dock under touch and mouse emulation, touch target geometry, input-focus hiding, scroll clearance, editing continuity across width changes, and container query layout. Separate physical device approval remains outstanding.

Official engineering evidence:
- WCAG focus visibility: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- Browser keyboard viewport differences: https://developer.chrome.com/blog/viewport-resize-behavior/
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries
- Android adaptive size classes: https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes
- Apple HIG layout (September 2026): https://developer.apple.com/design/human-interface-guidelines/layout

## Phase 3: verified cache and keyboard lifecycle (review branch)

**Concrete regression addressed:** SONARA links versioned CSS and JavaScript with an immutable cache key. Editing a stylesheet while preserving the same key leaves repeat visitors eligible to reuse the previous bytes after a deployment. This is a functional release issue, not cosmetic polish.

The review branch changes the asset version from `sonara-ui-20261007-v23-native-navigation` to `sonara-ui-20261008-v24-cross-device` in a coordinated set:
- `lib/sonara-page-frame.cjs`: browser asset URLs for the current rendered page.
- `public/sw.js`: cache `VERSION` plus all precached public asset URLs.
- `public/sonara-fonts.css`: nested first-party font URLs.

All three must agree. The earlier version must not remain in the affected asset references. No service worker is allowed to cache private pages or authenticated customer data. This change does not certify production cache invalidation without a deployed exact-SHA replay on a browser that first visited an older version.

**Keyboard lifecycle correction:** The dock is hidden while editable controls receive focus. The same state must also set the dock-reserved body padding and HTML scroll padding to zero; otherwise a focused editor can leave empty inaccessible scroll space. The rule is scoped to compact coarse-pointer viewports and leaves keyboard/mouse desktop layouts unchanged. Browser-specific keyboard behavior requires actual iOS Safari and Chrome Android testing before release.

**Cross-device verification work:**
- Static source check: new version present in rendered shell, service worker and font stylesheet.
- Targeted source tests: maintain the original authenticated/navigation/security assertions, add keyboard-release and cache-token consistency cases.
- Browser workflow: compact touch window at 390px, resizing to 820px and back with text preserved, plus a 320px minimum-width check and non-touch fallback.
- Outstanding device checks: OSK appearance/disappearance, screen-reader focus ordering, Samsung fold/unfold posture, iPad split-screen, PWA update after old-version cache, logout/private-route caching, and offline revisit.

**Platform evidence:**
- Android window size classes (dynamic width and height): https://developer.android.com/develop/ui/views/layout/use-window-size-classes
- Samsung foldable continuity: https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html
- Apple adaptive layouts and safe areas: https://developer.apple.com/design/human-interface-guidelines/layout
- W3C focus not obscured: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- Chrome on-screen keyboard and visual viewport behavior: https://developer.chrome.com/blog/viewport-resize-behavior/

**Release gate:** Do not merge merely because the static tests pass. Require exact-head CI, updated-service-worker behavioral tests, browser screenshots and accessibility evidence, plus separately authorized native device/store evidence.


## Phase 4: localized navigation and foldable continuity acceptance

**Implementation in draft PR #539 (not deployed):**

- The authenticated compact mobile dock now has short, translated labels for all five configured SONARA UI dictionaries (English, Spanish, French, German, Portuguese).
- Exact shortcut pages retain `aria-current="page"`; related studio subpages use `aria-current="location"` through the existing same-origin navigation script. A sibling/unrelated path must not match on a loose substring.
- The existing design-system colors, authenticated-workspace condition, server routes, font dependencies, and device-permission boundaries remain unchanged.
- Additional source assertions and a Playwright test exercise Spanish labels and a nested Creator route. These do **not** prove a full multilingual accessibility audit or a production login.

**New platform research:**

- Apple's September 2026 iPhone Duo layout guidance treats dual displays, device poses, split-view windows, and asymmetric safe areas as normal resizing constraints. SONARA should retain task state and show more hierarchy only when there is available space; no unsupported device identification or hinge-permission requirement should be added.
- Samsung recommends that scrolling, entered text, and the keyboard survive fold/unfold transitions. Viewport emulation tests only some of this; physical or platform-emulator validation remains a required qualification.
- The most durable cross-platform abstraction remains responsive web components plus optional, separately governed native adapters—not a duplicated phone operating system.

Evidence:
- https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo
- https://developer.apple.com/design/human-interface-guidelines/layout
- https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html
- https://developer.samsung.com/one-ui/largescreen-and-foldable/intro.html

**Next release gate:** exact-head Browser Quality must execute Chromium, Firefox and WebKit tests, and the broader CI matrix must pass; physical-device and old-service-worker upgrade evidence remain separate requirements. GitHub queue/pending status is not a pass. Preserve draft status; do not auto-merge or deploy.

## Phase 5: offline cache and private-route isolation

**Finding from the real service worker:** Prior to this pass, `public/sw.js` used only an extension-based runtime asset test: a same-origin `/api/.../file.png` or `/customer/.../file.js` could reach the cache handler. Cache-Control and Set-Cookie conditions helped, but a future route regression could still admit a tenant-specific asset. Login and signup were also intercepted as public navigations (network-first, not cached), adding unnecessary worker involvement to session setup.

**Changes committed to PR #539:**
- Runtime static caching now accepts flat public filenames and approved `/brand/`, `/fonts/` and `/icons/` asset directories, with the existing static extensions only.
- The only permissible static asset query is the exact current `?v=` cache version. Unknown tokenized URLs and outdated version queries are left to the normal network path.
- Login and signup navigation now bypasses the service worker completely. Existing protected application and API navigations already bypass it.
- The installation precache manifest is verified against the same public-asset boundary. An unexpected private entry rejects worker installation rather than silently caching it.
- `tests/service-worker-public-boundary.test.js` adds six cases for release precache assets, private paths, query-key isolation, navigation bypass, malicious precache rejection and private/no-store/set-cookie response handling.
- The existing version-token equality check in `scripts/verify-customer-ready-production-experience.mjs` remains in place.

**Limits:** Public assets and offline fallback are not equivalent to permission to cache authenticated business records or creator media. This change is layered defense, not a substitute for tenant-level authorization, correct server Cache-Control headers, upload/download access checks, encrypted on-device storage, or logout purge policy. No database, permission grant, native API or payment configuration was changed.

**Acceptance criteria:**
1. Exact-head test suite (including the six new worker cases) is green.
2. In installed Chrome, Safari/WebKit and Firefox: no account, customer, API, export or private creator-media entry appears in the SONARA public CacheStorage namespace before or after sign-in.
3. Public shell fonts, brand icons, CSS and JS can be restored offline without caching live private data.
4. A returning PWA updates from the prior asset token to the new worker and does not serve mismatched old CSS/JS.
5. Device focus, reflow and service-worker qualification are attached to the PR review; do not merge or deploy without the release gates.

Research context:
- https://developer.chrome.com/docs/workbox/modules/workbox-precaching
- https://developer.chrome.com/docs/workbox/caching-resources-during-runtime
- https://developer.chrome.com/docs/workbox/service-worker-lifecycle
- https://www.w3.org/WAI/WCAG22/Techniques/css/C43

## Phase 6: atomic anonymous precache and safe worker takeover

**Root cause discovered in repository:** The server-wide HTML GET middleware applies Cache-Control: no-store to /offline. Phase 5's stricter response check therefore would have rejected the essential offline fallback during installation. Separately, the worker previously called skipWaiting() automatically during installation, potentially switching an older page to a newer service worker. The public update notice only recommended refreshing.

**Correction committed in this draft:**
1. /offline is now the sole explicitly allowed cacheable HTML exception. server.js sets Cache-Control: public, max-age=60 for this anonymous, generic fallback only. All other rendered HTML retains the no-store default. The PWA HTTP-response regression test checks both behaviors.
2. Essential offline resources are fetched with Request credentials: omit, cache: no-store, and redirect: error. Private, no-store, set-cookie, opaque, redirected and cross-origin responses are rejected. Scripts and stylesheets returning HTML are not cached.
3. Offline fallback, application CSS, design-system CSS and the main browser script form the essential shell. A failure rejects the install and deletes the incomplete new-version cache. Optional fonts and icons are best-effort subject to the same response policy.
4. The worker no longer calls skipWaiting() automatically on install. The unused forced-activation message handler has been removed. The public update message accurately asks people to close and reopen all SONARA tabs when convenient.
5. Runtime stale-while-revalidate also refetches static assets without credentials, rejects private or HTML responses, and uses event.waitUntil for the refresh when serving a cached asset.
6. The service-worker boundary suite now has 12 regression cases, including anonymous precache, install rollback, wrong-MIME fallback, safe takeover, anonymous background refresh and network failure. The cross-device suite has 13 separate cases.

**Verified by isolated execution:** All 12 service-worker and 13 cross-device tests passed in isolated execution harnesses. Source syntax, CSS canonical/served alignment, the HTML cache-policy source, and cache version alignment were inspected. These do NOT replace exact-head Node 24 CI, browser execution or deployed device verification.

**Remaining acceptance and rollback:**
- Run real Mocha and the entire exact-head CI matrix; run Playwright on Chromium, Firefox and WebKit.
- Confirm /offline is publicly cacheable while /pricing and customer HTML remain no-store.
- Install the previous PWA version in an isolated browser profile, update to this exact SHA, and verify tabs do not switch worker versions unexpectedly.
- Verify the offline shell works without internet and public CacheStorage never includes tenant, payment, media or account records.
- Require deployment verification and separate owner release approval.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- https://web.dev/learn/pwa/update
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
- https://web.dev/articles/http-cache-security

## Phase 7: exact-cache fallback and baseline CI remediation

**Research and implementation:** MDN documents that CacheStorage.match searches across all stored caches in creation order, while Cache.match restricts a lookup to one chosen cache. The worker's offline navigation fallback is now read strictly from its active SONARA version cache. This prevents an unrelated cache or previous-release cache from supplying the fallback. MDN also notes that Clients.claim causes a worker to take control of otherwise uncontrolled pages; the worker no longer invokes it automatically during activation. The unused forced-activation message pathway was removed.

**Auth boundary:** The browser-side service worker registration allowlist now excludes /login and /signup, matching the worker's navigation bypass. Public marketing pages continue to register as before.

**Automated evidence:** Two dedicated worker tests cover the active-cache fallback and non-claim activation behavior, bringing the worker suite to 14 cases. An isolated execution harness ran all 14 successfully. An independent eight-route registration probe confirmed registration on public pages and absence on login, signup, and private pages. These results do not replace running the suite in Node 24 through GitHub Actions.

**Baseline CI finding:** Completed main-branch SONARA Industries CI run 37815158957 contained 7,083 tests passed in that historical run tests and a single failure: the generated handoff named 513 Mocha files, but the runner matched 516. This review branch adds two Mocha test files, and the GitHub repository contents inventory now contains exactly 518 eligible .js/.mjs files. docs/HANDOFF_PROMPT.md is corrected to 518 without changing or disabling the assertion in tests/the-handoff-counts-what-mocha-runs.test.js. Generator output and exact-head tests still need independent CI proof.

**Separate production blocker:** Main-branch Production Commit Drift run 37836985899 failed because the production /api/health request returned HTTP 503. This is not evidence that PR #539 caused the failure. Do not enable production, assume a deployment cause, or bypass release gates without independent production authorization and provider evidence.

**Remaining gates:** Full CI, generated handoff verification, browser quality (Chromium/Firefox/WebKit), security, Lighthouse, migration replay, real-device continuity, offline cache migration from the previous version, and explicit release approval.

Official references:
- https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage/match
- https://developer.mozilla.org/en-US/docs/Web/API/Cache/match
- https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim


## Phase 8: MIME-verified public cache and removal of forced activation

- Public offline resources now require the content type appropriate to their file format. The offline fallback must be text/html with an explicit public Cache-Control directive. A 200 status containing an error document or JSON pretending to be executable CSS/JavaScript must not poison the cache.
- Both installation and runtime refresh use the same MIME validation. The required installation is rejected if a core asset fails validation; optional assets remain best effort.
- Removed the unused SKIP_WAITING message receiver because a forced activation can mix old pages with a new worker and retire cache entries still needed by the prior release. Repository search found no caller for that message.
- Three regression cases added for invalid stylesheet MIME, missing explicit public policy on offline HTML and absence of the force-activation message. Full exact-head CI, real browser lifecycle, and production evidence remain outstanding.
- Source: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting ; https://web.dev/articles/service-worker-mindset


## Phase 9: exact-head CI and guarded database diagnostics

- The Node 24 lint gate identified an unused test-only `version` variable in `tests/cross-device-workspace-navigation.test.js`. The declaration was removed without altering the existing cache-version assertions.
- Native replay blocked on 25 policy definition mismatches inside the rollback-only P1 InitPlan proposal. The preflight continues to abort on any mismatch, but now includes diagnostic dimensions for up to eight offending policies: missing policy, permissive mode, roles, command, USING and WITH CHECK.
- This is a read-only diagnostic inside the original staging-only rollback transaction; no grant, migration, policy or production database object was modified.
- Do not bypass this guard to obtain green CI. Use the next exact-head Node/PostgreSQL matrix results to decide whether the mismatch reflects representation differences or actual RLS changes; require owner/security review before any policy modification.
- PostgreSQL pg_policies docs: https://www.postgresql.org/docs/current/view-pg-policies.html
- Supabase RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security

- Additional completed SONARA One Validation evidence from the previous exact head: 7,114 tests passed in that historical run tests and one failing asset-version assertion caused by an obsolete hardcoded release token in a `server.js` comment. Replaced the historical literal example with a version-agnostic description; the existing asset-version test remains unchanged. Await the exact-head rerun.

## Phase 11: immutable public-asset cache-busting

**Verified risk:** SONARA serves query-versioned static CSS and JavaScript with one-year immutable HTTP caching. Workspace navigation, locale behavior, and public cache policy changed after the prior v24 token was assigned, while the displayed URLs stayed at v24. Returning browser installations could therefore keep running incompatible cached scripts or styles.

**Implementation:** Advance the common release token to `sonara-ui-20261009-v25-cross-device` across the server-side page frame, worker version and precache URL list, font-face asset references, and navigation contract assertions in the same exact-head commit. The backend's dynamic asset-version and handoff contract tests are deliberately unchanged. An unchanged URL must never be relied upon to refresh immutable resources; after any further shipped JS/CSS changes, bump the token again or replace this convention with content-hashed asset filenames.

**Acceptance:** The complete unit suite, asset-version contract, worker fallback/upgrade tests, all browser engines, and live proof of release SHA plus asset URL must be green. No production rollout or client cache purges were carried out here.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- https://web.dev/learn/pwa/update

## Phase 13: explicit public-only worker cache policy

- Service-worker CacheStorage persists only assets with a positive `Cache-Control: public` directive. The worker rejects private, no-store, no-cache, must-revalidate, identity-dependent Vary: Cookie/Authorization and Set-Cookie responses even when they are HTTP 200 and have the right MIME type.
- Root-level interception now requires a known shipped public asset pathname; arbitrary root `.js` / `.css` URL patterns, which could belong to dynamic customer routes, pass directly to the network.
- The server already labels static files with explicit public short/immutable Cache-Control, while the offline fallback uses public max-age=60. Core precache remains fail-closed with rollback on failed policy checks.
- Rotated the page, service-worker, font and regression-test asset token together to `sonara-ui-20261009-v26-public-cache-boundary` to avoid sharing the prior active worker cache.
- Added negative regression checks for unknown root-level URLs, missing cache policy, identity-varying responses and failed core installation. These are source-level changes, not release authorization.
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching and https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
