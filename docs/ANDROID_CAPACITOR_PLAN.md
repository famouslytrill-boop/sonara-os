# Android Packaging Plan — TWA First, Capacitor Later

SONARA already ships a first-party PWA surface with a canonical web manifest, service worker, offline public fallback, push handling, and responsive routes. The first production Android package therefore uses a **Trusted Web Activity (TWA)** over the owned SONARA origin.

Capacitor remains a later path when SONARA has either:

1. a local compiled web asset bundle suitable for `webDir`, or
2. a concrete native-plugin requirement that a TWA cannot satisfy.

Do **not** point a production Capacitor app at the hosted site through `server.url`. Capacitor documents that option for live reload and says it is not intended for production.

## Canonical Android identity

- Package: `com.sonaraindustries.os`
- App name: `SONARA Industries`
- Launcher name: `SONARA`
- Production origin: `https://sonaraindustries.com`
- Canonical PWA manifest: `https://sonaraindustries.com/site.webmanifest`
- TWA config: `android/twa/twa-manifest.json`
- Build/proof contract: `android/twa/build-contract.json`
- Static gate: `pnpm run verify:android-twa`
- Bubblewrap: pinned to `1.25.0` in packaging CI
- Compile SDK: 36
- Target SDK: 36
- Minimum SDK: 23

## Why TWA first

A TWA is designed to package web/PWA content owned by the same developer. The Android app and website prove that relationship through Digital Asset Links.

This fits SONARA's current runtime better than a remote-hosted Capacitor WebView because SONARA's active product is server-rendered and does not currently produce a complete local `index.html` application bundle for Capacitor to package.

The TWA keeps:

- one production web origin;
- existing Supabase/Google session flows;
- the current service worker and public offline shell;
- the current PWA navigation surface;
- server-held Stripe/Supabase/provider credentials;
- one web release path while Android packaging matures.

## Required sequence

1. Keep the PWA/web release green.
2. Run `pnpm run verify:android-twa`.
3. Let `.github/workflows/android-twa-packaging.yml` generate the Android project and build:
   - a debug APK for installation smoke tests;
   - an unsigned release AAB for packaging proof.
4. Create/verify the Google Play developer identity.
5. Register `com.sonaraindustries.os` for Android developer verification.
6. Enable Play App Signing and obtain the **Play app-signing certificate SHA-256 fingerprint**.
7. Generate `public/.well-known/assetlinks.json` from that real fingerprint:
   ```bash
   ANDROID_PLAY_SIGNING_SHA256="AA:BB:...:FF" \
     pnpm run android:twa:assetlinks -- --output=public/.well-known/assetlinks.json
   ```
8. Deploy and verify that `https://sonaraindustries.com/.well-known/assetlinks.json` returns HTTP 200, JSON content type, no redirect, the correct package, and the Play signing fingerprint.
9. Upload the release AAB to the Play internal-testing track and use the Play-signed artifact for production asset-link verification.
10. Execute `docs/ANDROID_TWA_DEVICE_PROOF.md` on a physical Android device.
11. Complete the Play Billing decision before offering digital/cloud subscription purchases inside the Play-distributed app.
12. Only after those proofs pass may the Android capability move from `next_build` to production-enabled.

## Payment boundary

Website/PWA Stripe remains valid for web commerce. A Play-distributed Android app that accepts payment for digital app functionality, subscriptions, cloud software, or similar digital services must follow the applicable Google Play payments policy.

Do not add a native/TWA in-app purchase path that silently routes around Play policy. Physical goods/services and policy-authorized exceptions are separate cases and must be classified explicitly.

## Security guardrails

- No Supabase service-role, Stripe secret, Resend key, OAuth client secret, or AI-provider secret in the Android package.
- No guessed Play signing fingerprint.
- No debug signing certificate published as production Digital Asset Links evidence.
- App Links/TWA association uses the Play app-signing certificate for the Play-distributed app.
- Keep authenticated/private application data network-controlled; the public service-worker cache remains bounded to its allowlist.
- Signing keystore files and passwords stay outside Git.
- Do not mark physical-device, login, offline, push, or billing proof complete until reproduced against the Play-distributed build.

## Research basis

- Android Trusted Web Activities and Digital Asset Links
- Android App Links / `assetlinks.json`
- Google Play target API policy effective August 31, 2026
- Android developer verification/package registration effective September 30, 2026
- Google Play Payments policy
- Bubblewrap 1.25.0 template targeting API 36
- Capacitor v8 configuration contract for local web assets and non-production `server.url`
