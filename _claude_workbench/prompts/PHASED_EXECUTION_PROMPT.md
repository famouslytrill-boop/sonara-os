# PHASED EXECUTION PROMPT

Use this if the master prompt is too large. Do not attempt everything in one giant unstable patch.

## Phase 1 — Stabilize
Fix vercel.json schema, lint config/globals, service worker/client JS globals, bad encoding. Verify build/test/scan/lint.

## Phase 2 — Navigation and app shell
Verify all public/product/admin routes exist. Replace dead buttons with real links. Fix mobile nav and clipped hero.

## Phase 3 — Free tools
Add free tools for Business Builder, Creator Studio, Growth Studio. Render useful output even if saving unavailable.

## Phase 4 — Service lifecycle
Add shared statuses, service catalog, service requests/deliverables/support route structure, setup-required for missing DB tables.

## Phase 5 — Admin/operator console
Add admin requests/deliverables/support/billing/storage/system views. Every card links to a real route.

## Phase 6 — Optional AI gateway/docs
Add OmniRoute documentation/readiness only. Do not make it production dependency.

## Phase 7 — Final verification
Run all checks and commit only after all pass.
