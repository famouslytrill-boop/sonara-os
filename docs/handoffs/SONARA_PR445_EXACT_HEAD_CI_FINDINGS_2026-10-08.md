# SONARA PR #445 — Post-conflict Exact-head CI Findings
Assessed: 2026-10-08 UTC after branch reconciliation.
Head: `305933929b03190e2219af70d84736c288a149aa`.
Status: GitHub source conflicts cleared; PR converted to **draft** after CI reported failures. DO NOT MERGE.

## Hosted findings
- [SONARA One Validation run 37733158526](https://github.com/famouslytrill-boop/sonara-os/actions/runs/37733158526) test stage failed with **28 test failures**, not zero. Browser and SONARA Industries CI share many of these failures.
- [Browser Quality run 37733158521](https://github.com/famouslytrill-boop/sonara-os/actions/runs/37733158521) reported **five Playwright failures**:
  1. Resource form expected `?saved=resource` but new main's native redirect uses `?done=resource`.
  2. Unreadable resource route did not yield the expected 503.
  3. Expected reservation resource page navigation element absent or not visible.
  4. Unconfirmed save warning string differs from the branch's expected copy.
  5. Additional desktop/mobile form-navigation mismatch due merged contracts.
- Source tests `tests/reservation-workflow-destinations.test.js` revealed genuine contract gaps beyond copy: native HTML POST returned 201 instead of redirect; some capacities (including noncanonical inputs) were accepted; foreign location scope returned 403 instead of expected 404 (an intentional denial code choice to review); missing in-form error data; waitlist resource IDs/contact/date validation and tenant FK checks incomplete; offer transition missing compare-and-swap protection against concurrent booking/metadata updates; unreadable lookup failure status differed (502 vs 503).
- `tests/the-handoff-counts-what-mocha-runs.test.js`: generated handoff reported 495 test files; Mocha's spec matched 499. Regenerate via repo generator and reverify.
- `tests/workspace-hub.test.js`: duplicate module destination after branch registry integration (230 distinct vs 231 entries). Resolve source registration duplication, do NOT weaken the uniqueness test.
- Other checks may still be queued or may subsequently change. Inspect latest head and current runs before editing.

## Specific engineering repair (not yet completed)
1. Keep main's operations analytics and staged payment truth; do not restore old `payments` source / drop invoice/shop/work order costs.
2. Merge the reservation module's strict validation into main's registered handlers **surgically**. For every native HTML form use correct Accept negotiation and safe redirect, preserving JSON clients' response contract. Acknowledgement requires a saved row ID.
3. Enforce UUID format and organization-owned foreign keys for resources, locations, customers, bookings, staff and referenced service. Invalid foreign id -> refusal before any write; no silent fallback.
4. Validate capacity and party-size as canonical bounded integer (reject arrays, decimals, out-of-range and empty where required); validate UTC date ranges and resource status.
5. Offer update must guard `requested` state and existing metadata revision/marker in a conditional atomic write; simultaneous writes must not revive cancelled/booked entry. A failed/short read is `unavailable`, never missing/empty.
6. Render native form errors and retained safe inputs with alert text; avoid raw JSON page responses, unsafe query text reflection and misleading success banners.
7. Reconcile module directory once per destination, then regenerate inventory/handoff/test-count docs with repo-owned generators. Re-run 28 failing tests unchanged unless product contract revisions explicitly justify an assertion update.
8. On CI green (pinned Node 24/pnpm 12.7), run migration replay, tenant negative tests, browser desktop/mobile, keyboard/screen-reader checks, supply chain and exact-SHA release gate. Only after review should draft become ready. Production stays paused.

## Ownership/evidence
This packet records current failed hosted checks. It does **not** attest that the defects were fixed, migrations applied, or production became operational. Branch `main` and PR #446 must be rechecked for concurrent updates before any further source change.
