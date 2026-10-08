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
