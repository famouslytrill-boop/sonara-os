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

