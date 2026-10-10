# SONARA One — cross-suite industry server preflight (2026-10-10)

**Status: code + isolated test coverage on draft PR #623, not a live route, verified provider connection, customer authorization, rollout, or completed production job.** The production site stays offline unless separately authorized.

## What was added

`lib/sonara-industry-package-preflight.cjs` is a read-only boundary around the existing industry package blueprint previews. It requires three injected **server-side** reader functions:

- `resolveMemberOrganization({userId})`: caller supplies the authenticated user ID from server middleware; result must name the same user and an active organization membership.
- `readProductEntitlement({organizationId,product})`: reader must use the canonical billing/entitlement system and explicitly confirm an active product entitlement in the resolved organization, including cancellation/expiry handling.
- `readCapabilityEvidence({organizationId,product,requiredFields})`: reads existing same-tenant, source-verifiable provider/record/rights artifacts for each field. Distinguish unreadable from absent. Content hashes, signed provider receipts, freshness, rights and approvals must be validated **inside the real adapter**, not inferred from identifier format.

No adapter is wired to a route yet; this change cannot establish the truth of a row a stub returns. The module accepts no browser-supplied `organizationId`, `entitledProducts`, or evidence map as authority. A complete-looking preflight continues to return `canActivate:false`, `canExecute:false`, `canPublish:false`, and `canDeliverPaidAssets:false`. Sensitive references are omitted from the response.

## Follow-on production integration: do not skip these gates

1. **Canonical readers, scoped to the session.** Resolve identity from the existing authentication middleware and use the existing primary organization/membership machinery. Inspect actual `organization_entitlements` and/or billing entitlement source schema before authoring queries; never equate a user-supplied plan label with a paid subscription. Reject expired, canceled, mismatched tenant and unreadable states. Use server-held credentials only.
2. **Focused proof for each vertical.** For Creator: source hash compared to stored bytes; rights/consent and license snapshots; actual provider-confirmed payment and short-lived scoped delivery grant. For Social: user/account block state, moderation/report intake, provider OAuth scopes/account identity/audit eligibility, original approval and provider response receipt. For Professional: canonical quote/customer/version, business service/employee availability, consent and explicit booking validation. Reuse existing quote, booking and invoice modules.
3. **Authorized read surface.** Add a single strictly scoped, no-store management API only after route registry, tenant RLS, rate controls and JSON contract checks are reviewed. Do not expose per-tenant capability details to public booking visitors.
4. **Never let preflight perform side effects.** Execute only through existing role, agent authority, approval, idempotency, durable worker, webhook verification and reconciliation paths; preflight must not become an alternate action gate.
5. **Test before enabling.** Two-tenant tests, missing membership, failed/malformed DB read, stale entitlement, forged provider/rights/payment reference, revoked grant, source checksum mismatch, published-without-approval denial, concurrent booking, social reports/blocks and appeals, retry/double-send prevention, browser keyboard/mobile and request/worker budgets. Prove red tests against deliberate regressions.
6. **Release:** resolve unrelated failing CI and PostgreSQL native replay, ensure exact-commit suite is all green, gain owner release approval and stage controlled provider canaries. Site offline state is not changed by this work.

## Actual research decisions

- Audio/DAW: Standard MIDI Files and synchronized, source-hashed WAV stems first; native workstation session formats are not equivalent. The current Creator code's local track export and worker plans are not proof of a professional DAW bridge. MIDI Association: https://midi.org/standard-midi-files.
- Video interchange: OpenTimelineIO serializes editorial cuts and references media externally; it does **not** embed finished video/audio or render a movie. https://opentimelineio.readthedocs.io/en/latest/
- Social provider: TikTok direct-post requires user authorization and approved `video.publish` scope; without audit posts are private. https://developers.tiktok.com/docs/en/content-posting-api-get-started
- Instagram API with Facebook Login: professional accounts only, permissioned access. https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- External calendar: Google Calendar `freeBusy.query` returns busy intervals and per-calendar errors; the booking decision must treat provider errors as unreadable and still recheck internally at commit. https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query

## Validation evidence

Run `pnpm exec mocha tests/industry-package-blueprints.test.js tests/industry-package-preflight.test.js` with the **real** repository dependencies, then `pnpm test`, lint, typecheck, build, tenant/route/agent-sync, and native migration replay. An isolated Node 22 harness using stubbed planners passed 7 original blueprint + 8 preflight tests; this is not the full integration suite or Node 24/26 compatibility proof. CI of the previous commit on PR #623 had 7 failed and 4 successful workflow families; do not label release green based on the focused tests.


## 2026-10-10 engineering increment: canonical session and billing reads

Added `lib/sonara-industry-session-preflight.cjs` plus `tests/industry-session-preflight.test.js` and `tests/industry-paid-entitlement-readonly.test.js`.

- Resolve organization membership using the **authenticated session user** and `getCustomerPrimaryOrganization(user, {autoBootstrap:false})`; reject unrecognized membership sources. No client-supplied tenant, role or plan can select the organization.
- Reuse the real `getCustomerPaidEntitlement(user, product, {autoBootstrap:false})`. The optional no-bootstrap parameter was added to the existing paid reader without changing its default for established callers. Check that the canonical billing reader's returned organization exactly matches membership, and accept only subscription/entitlement proof sources it knows.
- Parallel preflight requests use distinct per-call scopes; an earlier result cannot be reused by a later request. A billing outage remains `entitlement_unavailable`, not a prompt to buy again.
- Provider evidence remains a **required injected reader**. Until real rights/moderation/calendar/payment verification is built, a caller must provide an adapter that fails on unavailable data. This is not approval to fabricate green `verified` rows. No server route was registered.
- The three products remain `template_only`, with `canActivate`, `canExecute`, `canPublish`, and `canDeliverPaidAssets` false.

### Source-specific acceptance criteria

1. Creator Studio: BWF source time references are sample-index metadata, not a DAW project import claim. EBU Tech 3285: https://tech.ebu.ch/publications/tech3285/ . OpenTimelineIO interchange references external audio/video and is not a renderer: https://opentimelineio.readthedocs.io/en/latest/ .
2. Growth Studio: current TikTok Content Posting API demands `video.publish` app approval and user authorization; unaudited clients are private-only and creator information/visibility must be checked before posting: https://developers.tiktok.com/docs/en/content-posting-api-get-started . Meta Instagram with Facebook Login requires a linked professional account and appropriately scoped token: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api .
3. Business Builder: Google Calendar FreeBusy can return calendar-level errors. Fail closed on those errors, then recheck SONARA booking resource conflicts atomically before confirmation: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query .

**Integration still outstanding:** bind a read-only authenticated route only after there are true tenant-safe media rights, provider permissions, social moderation and booking evidence readers; test it in two-tenant integration fixtures and the actual production-like authentication/migration environment. Do not treat stubbed reader tests as live proof. PR checks and native database replay remain release gates.
