# Physical Device Qualification Protocol — 9 October 2026

**Status:** qualification framework implemented; no Android or iOS device is qualified by this document.

SONARA source tests, Playwright, emulators, browser automation and simulator runs are useful engineering evidence. They do **not** establish that a signed Android or Apple client works on physical hardware. Physical-device qualification is a separate release gate.

## Machine-readable authority

Accepted records live in:

- `data/device-qualification-evidence.json`
- validated by `lib/sonara-device-qualification-evidence.cjs`
- enforced by `scripts/verify-device-qualification-evidence.cjs`
- included in `pnpm run verify:config`

The ledger deliberately begins with an empty `records` array. Empty means **unqualified**, not failed and not implicitly supported.

If `android_native_client.productionEnabled` or `ios_native_client.productionEnabled` is ever set to `true`, the verifier requires a complete physical-device record for the repository's exact 40-character HEAD SHA. Evidence for an older SHA cannot qualify a newer release.

## Required record identity

A record must contain:

- platform (`android` or `ios`);
- qualification profile;
- `physicalDevice: true`;
- exact release SHA;
- ISO capture timestamp;
- device model (no serial number, IMEI, advertising identifier or personal device name);
- OS version;
- browser name/version;
- install mode;
- build identity;
- non-secret reference where the reviewed evidence bundle can be retrieved;
- SHA-256 of that reviewed evidence bundle;
- one result for every required case.

The evidence bundle may live outside Git because videos/screenshots/device logs can be large and may accidentally contain account information. The reference must identify the controlled artifact/location without embedding credentials or signed secret URLs. Remove secrets, cookies, tokens, email addresses, customer data, precise location and raw sensor streams before retaining it. The repository stores only the SHA-256 digest needed to establish which reviewed bundle the JSON record refers to.

## Common physical-device cases

Every motion/device profile must prove:

1. physical device identity is recorded without hardware identifiers;
2. the page is served from a secure context;
3. account-level Motion OFF blocks the browser permission prompt;
4. browser permission GRANTED works after explicit user activation;
5. browser permission DENIED produces a clear refusal and no capture;
6. one bounded motion sample completes;
7. hiding/leaving the page stops capture;
8. revoking the SONARA account permission after page load blocks persistence;
9. rotation/reflow remains usable;
10. text scaling remains usable;
11. reduced-motion preference remains usable;
12. authentication/session continuity behaves correctly.

A required case is qualified only by `pass`. `fail` and `not_applicable` do not satisfy a required case.

## Android TWA additions

The `android_twa` profile also requires:

- Play-signed internal-test installation;
- Digital Asset Links proof;
- app-link routing;
- offline public fallback;
- tenant-private cache exclusion;
- explicit push-permission opt-in.

Packaging, a generated AAB/APK, or an unsigned/local install is not Play-distributed proof.

## iOS internal-shell additions

The `ios_internal_shell` profile also requires:

- signed internal installation;
- Universal Link routing;
- VoiceOver navigation;
- explicit offline boundary behavior;
- tenant-private cache exclusion.

The current Swift/WebKit shell is intentionally restricted. Passing this profile is still not App Store approval and does not authorize purchases or capabilities that the shell does not expose.

## Motion/privacy research basis

The Device Orientation and Motion specification treats accelerometer/gyroscope access as powerful, policy-controlled features with a default allowlist of `self`; it requires secure contexts and permission checks, and event dispatch is conditioned on a visible document. `DeviceMotionEvent.requestPermission()` requires transient user activation where implemented.

References:

- https://www.w3.org/TR/orientation-event/
- https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static
- https://developer.mozilla.org/en-US/docs/Web/API/Window/devicemotion_event
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/accelerometer
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/gyroscope

## Claim boundary

Until a complete exact-SHA record exists:

- Android remains `next_build` / production disabled.
- iOS remains `next_build` / production disabled.
- Browser automation may be described as browser automation, not physical-device proof.
- No test record may be fabricated from screenshots, emulators or source inspection.

After evidence is added, the normal release matrix still applies. Device qualification does not replace migration replay, tenant isolation, security, browser, accessibility, app-store policy, provider or production-deployment gates.
