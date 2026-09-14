# three.ws Presentation Adapter Boundary

Status: **experimental / disabled / not production-routed**

SONARA may use `three.ws` as an optional visual presentation layer. It is not an agent authority framework, identity system, memory system, provider router, payment system, or required runtime dependency.

## Current prototype

The isolated implementation lives at:

- `experiments/three-ws-presentation/index.html`
- `experiments/three-ws-presentation/presentation-adapter.js`
- `scripts/verify-three-ws-prototype.mjs`

The prototype loads the pinned `@three-ws/avatar@0.2.3` viewer only after explicit user action and instantiates `three-ws-viewer`. It does not instantiate `agent-3d` and does not configure an LLM brain.

## Authority model

The presentation adapter may receive **presentation state** such as:

- selected licensed model URL;
- non-sensitive expression/animation name;
- lip-sync timing derived from already-approved audio; and
- non-authoritative display labels.

The adapter may never infer or grant:

- organization membership;
- administrator/founder role;
- billing entitlement;
- permission to contact customers;
- permission to deploy or merge code;
- permission to refund or pay money;
- permission to delete data;
- provider credentials; or
- tool execution authority.

If a future 3D agent receives the same conversational state as the text/voice agent, consequential actions still pass through `lib/sonara-agent-authority.cjs`. A facial expression, emotion value, avatar gesture, remembered preference, or model-generated request is context—not permission.

## Dependency boundary

The experiment intentionally does not add `@three-ws/avatar` or `three` to the root `package.json`. This prevents a presentation experiment from becoming required by Vercel/server startup, authentication, billing, database routes, or text/voice operation.

A future production adoption may use a locally bundled reviewed dependency instead of a browser CDN, but that requires a separate architecture/license/security review and CSP update. The current experiment must not silently change that boundary.

## Asset boundary

The SDK license and model/animation asset rights are separate. Only user-owned, SONARA-owned, CC0, or otherwise explicitly commercially licensed GLB/glTF assets may be used. The prototype intentionally ships no third-party avatar asset.

Tenant-private information must not appear in public model URLs, filenames, query strings, or asset metadata.

## Promotion gates

Before any production route may expose the adapter:

1. all experiment CI checks are green;
2. the exact SDK version and license are re-reviewed;
3. CSP/network origins are minimized and documented;
4. the asset-hosting and rights policy is approved;
5. keyboard/screen-reader/reduced-motion/fallback behavior is verified;
6. mobile and low-power performance budgets are measured;
7. no server or provider secret is present in browser source or network configuration;
8. camera, microphone, AR, VR, wallet, persistence, or telemetry remain absent unless separately approved;
9. the 3D layer can be disabled without changing text/voice/auth/billing/data behavior; and
10. an explicit feature flag defaults the production adapter to disabled.

Passing these gates permits presentation. It does not permit autonomous action.
