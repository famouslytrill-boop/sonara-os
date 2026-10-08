# SONARA operating reliability, product and marketing pass

Date: 2026-10-08 UTC / evening of 2026-10-07 in Columbus, Ohio.
Base: `207372e40e56716199286d6ca95984eed2882b49`.

## Outcome and boundaries

This pass strengthens an existing customer workflow: staff check-in → optional device location at the person's chosen precision → local retention when delivery is uncertain → retry → server receipt → removal from the device queue. It also reviews how to position and prioritize the wider SONARA ecosystem without presenting architecture or tests as production proof.

The earlier broad assessment remains `SONARA_ENGINEERING_MARKETING_PASS_2026-10-08.md`. PR #451 is a separate financial reporting change: all eleven hosted workflows for commit `fc7078a8957c4313868f71942e7f08dca8ae6a60` passed when checked in this pass. That is CI evidence, not proof of deployment or customer adoption. This branch starts from main and does not incorporate that unmerged PR.

## Research question and verified defects

Question: can a staff member trust “recorded” after using the application with weak connectivity, rate limiting, an expired login or a malformed response?

Source inspection found four counterexamples:

1. The queue treated every 4xx response as permanent rejection, including temporary throttling.
2. A successful HTTP response with unreadable JSON, or JSON that did not explicitly accept the check-in, could clear the queue as delivered.
3. A retry held a snapshot of all pending entries and wrote it back after a network request. A newly saved check-in could be overwritten by that older snapshot. Overlapping flushes were not coordinated within a page.
4. The server's idempotent insert helper converted an unreadable database response into an empty array, then labeled that as a confirmed duplicate.

A further consistency gap was checked: a saved event can outlive the session in which it was captured. New captures now carry user/workspace identifiers checked against the current server session. They are consistency constraints, never a source of authorization.

## Evidence matrix

| Decision | Primary evidence, checked 2026-10-08 | Interpretation |
| --- | --- | --- |
| Retain throttled requests and respect server delay | [RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585#section-4); [MDN 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) | A rate limit requests slower delivery; it is not evidence the underlying action must be discarded. |
| Refuse automatic redirects for event delivery | [MDN Response.redirected](https://developer.mozilla.org/en-US/docs/Web/API/Response/redirected) | Detecting a redirect after it happened is too late to prevent it. Use fetch's redirect policy and require the application's acceptance receipt. |
| Expose asynchronous delivery status programmatically | [W3C Understanding SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | A status role helps assistive technology announce progress without moving focus. This single change does not certify WCAG conformance. |
| Do not claim cross-tab locking from a local promise | [MDN Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) and source inspection | The implemented WeakMap coordinates one JavaScript context. Cross-tab atomic storage needs a separate design. |
| Keep one id through uncertain delivery and retry | Existing organization/client-event uniqueness contract; route tests with a committed write and unreadable receipt | A later receipt can confirm the original record without a second write. |

Contradictions tested: an HTTP 200 may contain failure; a 429 may be temporary; a database operation may have succeeded even if its receipt was lost; a second event can be created while the first is awaiting a response; authentication can change between capture and replay; manual check-in must not acquire location. Tests exercise those conditions rather than only a successful network request.

## Implementation

- First attempts and replay share one response decision: explicit `ok: true` is required for acceptance; only an explicit duplicate flag changes the receipt type.
- 401/403, throttling, temporary responses, network failures and ambiguous receipts stay pending. Permanent request errors remain refusals.
- Retry-After is retained as a retry deadline. A missing/invalid throttling deadline uses a 30-second default. There is no polling timer or promise to deliver after the browser is closed.
- One page shares an in-flight flush. Acknowledgements remove only the acknowledged event from the latest storage contents, preserving entries added during the request.
- Storage update failure stays visible. Already accepted events may be retried with their existing id instead of silently being assumed removed.
- Only the location-event endpoint is accepted by this queue. Stored data cannot redirect replay to another destination; fetch refuses redirects.
- The current staff page gates replay by employee identity; new entries also carry capture user/workspace consistency checks, validated on the server.
- The staff screen gains a “Send saved check-ins” button and a polite status region. It distinguishes saved locally, waiting, accepted, authentication required and storage trouble.
- The database receipt parser no longer turns malformed evidence into a confirmed duplicate.

No new library, subscription, infrastructure service, migration, database table or money-moving operation was added. Existing location precision reduction, manual mode, limits of 50 queued entries and server time-window rules remain in use.

## Product and architecture priorities

| Area in the requested ecosystem | Practical advancement | Evidence needed before stronger claims |
| --- | --- | --- |
| SONARA Industries and three product brands | Keep a shared identity, authorization and billing foundation; explain each product through a small number of completed tasks | Actual onboarding and customer task completion |
| Business Builder, field work and logistics | Recover check-ins honestly; next isolate queues per account and make cross-tab updates transactional | Device recovery tests, tenant boundaries and observed delivery rates |
| Commerce, storefronts and marketplaces | Merge separately reviewed financial integrity work; complete provider/account/charge provenance | Approved provider test transactions and customer receipts |
| Creator Studio, art, music, film and literature | Prioritize provenance, licensed assets, bounded rendering, editable outputs and reliable delivery | A completed media job and authorized download, including failure/cancel paths |
| Growth Studio and social distribution | Close one provider's authorize → approve → publish → receipt → reconcile workflow | Actual provider ids, retry safety, revocation and measured outcomes |
| Authentication, integrations and permissions | Preserve server authority; treat account switching, disconnect and revoked access as explicit states | Deployed sign-in/recovery and cross-tenant negative tests |
| Storage, uploads and downloads | Measure integrity, ownership, quotas, retention and restore behavior | Real restore/download proof; policy text alone is insufficient |
| Accessibility and interactive controls | Add understandable statuses, keyboard paths, captions/transcripts and reflow checks | Screen-reader/device verification across critical customer journeys |
| Notifications, email and communications | Keep user choice explicit and record provider delivery separately from a queued request | Opt-in, suppression, bounce/failure and delivery evidence |
| Maps, GPS, motion and device interfaces | Prefer user-triggered capabilities and minimum required precision | Physical-device permission, denial and revocation tests |
| Templates, tables and workflows | Reuse canonical customer, project, order and approval records | Real input → computation → record → next action paths |
| Calculators, forecasting and simulations | Expose inputs, units, assumptions and uncertainty; validate boundaries | Reference calculations, edge cases and observed prediction quality |
| Scaling, security and operations | Restore drills, load tests, bounded queues, secrets controls and measured service objectives | Recovery timings, failure behavior and deployment-specific telemetry |
| OS/platform expansion | Treat SONARA as an application platform; build device shells around proven workflows | Packaging and device evidence; no kernel or general-purpose OS claim |

“Free flights” remains undefined in the request. No travel booking, free-airfare entitlement or provider integration is assumed. Likewise, adding terminology from mathematics, science, music theory or film theory does not itself create a usable customer capability; each needs a defined input, valid method, output and testable workflow.

## Marketing and commercial analysis

Recommendation: position this improvement as dependable field records for people doing real work in imperfect connectivity. A suitable post-validation message is: “Check in at your chosen location precision. If delivery is uncertain, see what is saved and retry it.” Avoid “never loses data,” “works completely offline,” “automatic tracking,” or “guaranteed delivery.” Local browser storage can be cleared or unavailable, and the app must be opened to retry.

A no-budget demonstration can show three moments: choose “Just that I checked in,” encounter a simulated interruption, then send the saved entry and show its receipt with the original time. Make the interruption a labeled demonstration; do not present fixture data as a customer's verified result. No campaign, advertisement, email or social post was published in this pass.

The business hypothesis is fewer disputed/missing field records and fewer support contacts about uncertain delivery. It remains unmeasured. Track aggregate outcomes, not raw location in analytics:

- accepted check-ins / deliberate attempts;
- pending check-ins by age band;
- recovery time from capture to acceptance;
- refusal rate, authentication-block rate and local-storage failure rate;
- support cases attributable to uncertain delivery;
- activation and retention among customers who use field workflows.

Recommended success criterion: demonstrate that an interruption does not cause a false receipt or a duplicate row, then measure customer recovery and support outcomes in an approved pilot. Do not infer profitability from a passing test suite.

## Costs, formulas and deployment restraint

This patch adds no vendor subscription and does not require new database infrastructure. Existing hosting, storage, authentication and request costs still apply. Retry-After may reduce wasteful requests, but savings are not yet measured.

Useful planning formulas, with measured inputs rather than invented forecasts:

- support cost avoided = reduction in relevant tickets × average handling minutes × loaded hourly support cost / 60;
- request cost = delivered attempts × measured marginal request cost;
- contribution per customer = collected subscription revenue − payment fees − attributable compute/storage/provider cost − support cost;
- pilot return = attributable contribution improvement + measured support savings − implementation/operations cost.

Pricing and revenue claims should remain subject to the existing catalog, entitlements, usage limits and measured cost model. This change does not expand paid entitlements or offer unlimited processing. Keep the owner's temporary-offline instruction; no deployment or runtime activation is part of this pass.

## Validation and remaining risk

Focused tests cover response ambiguity, transient failures, both Retry-After forms, scope changes, overlapping retries, newly appended entries, storage refusal, destination restrictions and malformed database receipts. The actual staff route can render with isolated employee/database fixtures. Browser cases run the shipped scripts and real rendered form at 1280×800 and 390×844: throttle → local save → unreadable receipt → still pending → duplicate receipt → cleared, while retaining the id and sending no coordinates in manual mode.

Browser plugin was unavailable in this session. The regular Playwright path was selected; local Chromium installation failed because the downloaded archive was invalid/truncated. Local browser execution and screenshots therefore are not claimed. Hosted Browser Quality is the required rendered verification; its outcome is recorded separately after publication.

Remaining limits are material: storage is localStorage, not an encrypted vault; closing the browser stops retries and cleanup; retention expiry is enforced on the next flush, not by a background deletion service; cross-tab writes are not transactional; a queue remains shared locally and a different account's first entry can block later entries; legacy entries have employee binding but lack the newly captured user/workspace fields. Physical-device GPS, assistive technology behavior, and live database/authentication/provider flows remain unverified. Those limits define the next scope rather than being hidden behind a broad “offline ready” claim.
