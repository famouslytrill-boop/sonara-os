# Android TWA Device Proof

This checklist records evidence for the Android capability. Packaging CI is automated; the device and Play-signing rows remain manual because CI cannot truthfully substitute for a Play-signed install on a real device.

## Automated packaging evidence

The workflow `.github/workflows/android-twa-packaging.yml` must pass on the exact commit.

Required artifacts:

- `sonara-debug.apk`
- `sonara-release-unsigned.aab`
- `SHA256SUMS`

The workflow must prove that Bubblewrap generated a project with compile SDK 36 and target SDK 36.

## Play signing and domain association

Before production TWA verification:

- [ ] Google Play developer identity is verified.
- [ ] Package `com.sonaraindustries.os` is registered.
- [ ] Play App Signing is enabled.
- [ ] The Play app-signing SHA-256 certificate fingerprint is copied from Play Console.
- [ ] `public/.well-known/assetlinks.json` is generated with `pnpm run android:twa:assetlinks`.
- [ ] The deployed file answers HTTP 200 with `Content-Type: application/json`.
- [ ] The deployed file does not redirect.
- [ ] It contains `delegate_permission/common.handle_all_urls`.
- [ ] It contains `delegate_permission/common.get_login_creds`.
- [ ] The fingerprint matches the **Play app-signing key**, not merely the local upload/debug key.

## Install/launch smoke proof

Use the CI debug APK only for pre-Play installation/launch smoke testing:

```bash
adb install -r sonara-debug.apk
adb shell monkey -p com.sonaraindustries.os 1
```

For production TWA/domain proof, install the Play internal-testing build and confirm:

- [ ] launch opens SONARA without browser chrome;
- [ ] `https://sonaraindustries.com/` opens in the app through verified App Links;
- [ ] verification does not fall back to a normal Custom Tab;
- [ ] logout/login survives app restart as designed;
- [ ] Google sign-in completes and returns to the SONARA session;
- [ ] the service worker still protects only allowlisted public offline pages;
- [ ] an authenticated/private route is never replaced by a cached public page;
- [ ] push permission is user-controlled and a test notification opens the intended same-origin path;
- [ ] file download/export behavior works;
- [ ] back navigation and external links behave correctly;
- [ ] rotation, font scaling, 360px/390px widths, and reduced-motion behavior remain usable.

## Offline proof

After one successful online visit:

1. Open an allowlisted public route.
2. Disable network connectivity.
3. Reload the allowlisted public route and confirm the offline fallback works.
4. Attempt an authenticated/private workflow and confirm SONARA does **not** fabricate server state or return a cached private page.
5. Restore network access and confirm normal navigation resumes.

This does not prove local-first customer editing. That is the later offline mutation-engine stage.

## Payment proof

Before any in-app digital/cloud purchase CTA is enabled in the Play-distributed app:

- [ ] classify each SKU as digital, physical, or an applicable policy exception;
- [ ] document the Play Billing/alternative-billing decision for each digital SKU;
- [ ] prove entitlement updates originate from verified provider/backend state rather than a success redirect;
- [ ] keep website/PWA Stripe behavior separate from Play-distributed in-app purchase behavior.

## Completion rule

Android production proof is complete only when:

- packaging CI is green;
- Play package/signing evidence exists;
- Digital Asset Links verifies;
- the internal-test build passes the physical-device checklist;
- billing policy is resolved;
- the exact release SHA is recorded.

Until then, Android remains `next_build` / `setup_required`, not a shipped native capability.
