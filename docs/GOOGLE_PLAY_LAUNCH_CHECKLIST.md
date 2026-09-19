# Google Play Launch Checklist

SONARA's first Android distribution path is a Trusted Web Activity (TWA) over the existing SONARA PWA. The package remains setup-required until Play signing, Digital Asset Links, device proof, and billing policy evidence are complete.

## Canonical identity

- [x] Package name selected: `com.sonaraindustries.os`.
- [x] Production origin: `https://sonaraindustries.com`.
- [x] Canonical manifest: `/site.webmanifest`.
- [x] TWA build contract exists under `android/twa/`.
- [x] Compile SDK is required to be 36.
- [x] Target SDK is required to be 36.
- [ ] Play developer identity verified.
- [ ] Package name registered for Android developer verification.
- [ ] Play App Signing enabled.
- [ ] Play app-signing certificate fingerprint recorded outside secrets.
- [ ] Production `/.well-known/assetlinks.json` generated from that fingerprint and deployed.

## Store readiness

- [ ] Final store display name approved. Current canonical PWA name is `SONARA Industries`; launcher name is `SONARA`.
- [ ] Final short description approved.
- [ ] Full description uses approved SONARA Industries trademark language.
- [ ] 512x512 icon accepted by Play.
- [ ] 1024x500 feature graphic prepared.
- [ ] Phone screenshots prepared from the production/internal-test build.
- [ ] Tablet screenshots prepared if tablet support is listed.
- [ ] Privacy policy URL resolves to `https://sonaraindustries.com/privacy`.
- [ ] Terms URL resolves to `https://sonaraindustries.com/terms`.
- [ ] Support email is a real monitored inbox.
- [ ] Data Safety form completed against actual runtime data flows.
- [ ] Internal/closed testing requirements completed.
- [ ] No listing claim promises income, placements, hit records, approvals, legal outcomes, or distribution outcomes.

## Technical readiness

- [x] Android packaging uses TWA rather than a production Capacitor remote `server.url`.
- [x] `pnpm run verify:android-twa` checks the machine contract.
- [ ] Android TWA packaging workflow passes on the exact release SHA.
- [ ] Debug APK artifact builds.
- [ ] Unsigned release AAB artifact builds.
- [ ] Play-signed internal-test AAB installs.
- [ ] App Links verify against the Play app-signing key.
- [ ] Launch opens as a verified TWA rather than falling back to browser chrome.
- [ ] Offline public fallback works.
- [ ] Private/authenticated routes are never served from the public offline cache.
- [ ] Google login redirect/session handoff works in the Play-distributed app.
- [ ] File export/download flow works on Android.
- [ ] Push notification permission is user-controlled and a test notification opens the intended same-origin route.
- [ ] Physical-device QA passes `docs/ANDROID_TWA_DEVICE_PROOF.md`.

## Payments

Website/PWA Stripe subscriptions remain web transactions. A Play-distributed app that accepts payment for digital app functionality, subscriptions, cloud software, or comparable digital services must use the applicable Google Play billing path unless a documented policy exception or approved alternative-billing program applies.

- [ ] Every purchasable SKU is classified digital / physical / applicable exception.
- [ ] Digital SKU billing path is documented.
- [ ] No in-app CTA routes around Play policy.
- [ ] Entitlements are granted from verified provider/backend state, never solely from a return URL.
- [ ] Refund/cancel/renewal reconciliation is tested for the chosen billing provider.

## 2026 deadlines reflected by this checklist

- New apps and app updates submitted to Google Play after **August 31, 2026** must target Android 16 / API 36 or higher for standard mobile apps.
- Play package names must satisfy Android developer verification registration requirements effective **September 30, 2026**.

## Completion rule

Do not call the Android client production-ready until packaging CI, Play package/signing, Digital Asset Links, internal testing, physical-device QA, and billing-policy evidence all pass on the release intended for customers.
