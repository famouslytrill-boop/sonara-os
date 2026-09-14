# three.ws Presentation Prototype

This directory is a **developer-only, opt-in presentation experiment** for SONARA. It tests whether a 3D avatar viewer can sit on top of the existing text/voice experience without becoming part of SONARA's authority, authentication, billing, memory, provider, or database boundaries.

## Upstream pin

- Repository: `nirholas/three.ws`
- Package: `@three-ws/avatar`
- Reviewed prototype version: `0.2.3`
- License: Apache-2.0
- Three.js peer pinned by this prototype: `0.180.0`

The browser module URL is version-pinned in `presentation-adapter.js`. Do not replace the pin with a floating tag or `latest` URL.

## Run locally

From the SONARA repository root:

```bash
python3 -m http.server 4173 -d experiments/three-ws-presentation
```

Then open `http://localhost:4173` in a browser. Enter a direct HTTPS URL to a `.glb` or `.gltf` asset you own or are licensed to use, then press **Enable experimental 3D**.

No upstream model asset is bundled into SONARA by this prototype. Asset rights are separate from the Apache-2.0 SDK license.

## Hard boundaries

The prototype deliberately does **not** connect three.ws to:

- SONARA authentication or session state;
- organization/tenant selection;
- Stripe or billing;
- Supabase or customer records;
- SONARA memory;
- emotional state as an authorization signal;
- model/provider credentials;
- wallets or on-chain features;
- SONARA tools;
- `lib/sonara-agent-authority.cjs`; or
- autonomous agent execution.

The page imports the pinned viewer only after a person presses the enable button. Disabling the viewer restores a normal fallback. A failure to load the SDK or model cannot disable SONARA's text or voice surfaces because this experiment is not mounted by the production server.

## Why viewer-only first

`three.ws` supports richer agent behavior, but the first SONARA experiment is intentionally limited to the presentation layer. Presentation must prove accessibility, performance, fallback behavior, rights handling, browser compatibility, and security before any broader integration is considered.

## Promotion checklist

Do not expose this experiment on a production route until a separate implementation review confirms all of the following:

1. exact upstream package/version and license are re-reviewed;
2. all distributed avatar/model/animation assets have explicit commercial rights;
3. the production Content-Security-Policy allows only the minimum required origins;
4. no secret or provider credential reaches browser code;
5. reduced-motion, keyboard, screen-reader fallback, and non-WebGL fallback are verified;
6. mobile memory/GPU/battery impact is measured;
7. model URLs are served from an approved SONARA-controlled or explicitly trusted asset origin;
8. tenant data is never encoded in public model URLs;
9. text/voice functionality works with the 3D layer disabled or unavailable;
10. any future agent behavior still routes consequential actions through SONARA's authority system; and
11. a dedicated privacy/security review approves any microphone, camera, AR, VR, wallet, or persistence capability before it exists.

## Verification

Run:

```bash
node scripts/verify-three-ws-prototype.mjs
```

The verifier ensures the prototype remains version-pinned, presentation-only, opt-in, outside the root runtime dependency graph, and disconnected from SONARA authority-sensitive systems.
