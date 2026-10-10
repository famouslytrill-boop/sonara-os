# SONARA iOS pilot shell

**Status:** source-only, restricted internal test shell. This is **not** an App Store product, production activation, or approval for purchases.

## Build

Install Xcode and XcodeGen (a separately licensed third-party project generator) on a macOS development machine. From `ios/` run:

```bash
xcodegen generate
xcodebuild -project SonaraPilot.xcodeproj -scheme SonaraPilot -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

The project deliberately does not contain Apple developer identifiers, signing certificates, provisioning secrets, or an App Store Connect connection. Code signing/device installation and TestFlight distribution need an authorized Apple Developer account and explicit approval.

## Safety model

- Only `https://sonaraindustries.com/`, `/about`, `/privacy`, and `/terms` may open inside the nonpersistent WebKit view.
- No account auth, Google sign-in, creator digital purchase, Stripe Checkout, device API, background sync, file upload or user location is exposed.
- All other host/scheme/path navigations are blocked. This is intentionally restrictive, not a complete allowlist for a commercial app.
- The app does not cache private content or invent offline writes. A network failure yields an unavailable notice.
- The native app does not copy any server-held keys. No JavaScript bridge is installed.

## Required before a real iOS application

1. Confirm the app's distinct native value, UX/accessibility, privacy/data deletion, and App Store Review Guidelines including minimum functionality.
2. Implement first-party account login/session storage using an appropriate web or native authentication integration, verify sign-in callbacks and logout on devices; do not silently enable WKWebView third-party auth.
3. Classify physical/service versus digital/in-app products by storefront region. Implement required StoreKit purchases/entitlements or approved alternatives before enabling any in-app digital purchase CTA.
4. Add user-consented camera/mic/photos/notifications only with feature-specific explanations and platform permission handling.
5. Implement offline mutation encryption, idempotency and conflict resolution against an isolated test tenant before offering offline customer edits.
6. Use physical-device/simulator accessibility, orientation, VoiceOver, scaling, 401/403 handling, deep links and review tests. Record exact SHA, signing identity, App Store Connect build and rollback strategy.

Apple review: https://developer.apple.com/app-store/review/guidelines/
Android packaging and proof remain independent: `docs/ANDROID_TWA_DEVICE_PROOF.md`.
