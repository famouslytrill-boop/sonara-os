# SONARA account-scoped offline queue pass — 2026-10-08

## Decision

The next smallest reliability slice after explicit delivery receipts is account isolation. A saved field event must be associated with the workspace and signed-in user that created it, and an older global queue must be reviewable without being silently replayed under a new account.

Base: `207372e40e56716199286d6ca95984eed2882b49`. This pass extends the offline recovery work in `SONARA_OFFLINE_RECOVERY_ENGINEERING_PASS_2026-10-08.md`. The website remains temporarily offline.

## Evidence and contradiction search

| Claim or decision | Evidence | Classification |
| --- | --- | --- |
| The existing queue stored all entries under one browser key | `public/sonara-offline-queue.js` before this change | Verified source fact |
| A queue entry could outlive the session and be encountered by a different signed-in user | Browser local storage persists beyond a page session; previous queue comments and source | Engineering inference |
| New records should use a workspace/user partition | Existing server organization resolution and employee scope checks; route payload contract | Recommendation under tenant-safety rules |
| Legacy records should not be guessed into a new account | No trustworthy account provenance exists in the v1 key | Safety recommendation |
| Rate-limit responses can carry a retry deadline | [RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585#section-4) | Verified standard |
| Review and retry status should be exposed as a non-focus-moving status | [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Verified accessibility guidance |

Contradictions tested: a valid account-specific queue must remain invisible to another user; a legacy record can be real while its owner is unknown; a scope mismatch must not be “fixed” by changing the payload; an explicit discard is safer than automatic migration; two accounts can flush concurrently in one browser when their keys differ; an invalid legacy row still needs a review token so it cannot become an undeletable local record.

## Implementation

- v1 remains a legacy key. New entries use a v2 key derived from validated lowercase workspace and user UUIDs.
- `pending`, `flush`, `review` and `discard` accept the account scope. Flush only reads the current account key; it never scans or migrates the legacy key.
- Concurrent flushes are tracked per storage key, so two account partitions do not block one another and one account cannot remove another account's receipt.
- Scope-mismatched entries in the current key and every v1 entry appear as safe summaries containing event type, time and a discard token. Payload contents are not rendered.
- Discard requires an explicit token and source. Valid event UUIDs are used when present; malformed legacy entries receive a bounded review token by position so they can still be removed deliberately.
- The staff screen has a review panel and a “Discard saved check-in” control. It uses DOM text nodes and `textContent` rather than injecting stored payload HTML.
- Browser coverage runs the path through an account-scoped retry, inserts a legacy entry, opens the review panel, verifies the explanation and discards the entry at 1280×800 and 390×844.
- The crawler fixture now renders the authenticated staff location page, so the queue remains accounted for as a loaded shipped bundle.

No database migration, dependency, provider, payment, notification, deployment or account-setting change was added.

## Marketing and business value

A truthful customer-facing claim after deployment proof is: “Saved check-ins stay with the account that made them. Older saved records are shown for review before you remove them.” Avoid “automatic migration,” “works for every account on this browser,” or “permanent offline storage.”

The product benefit is lower risk during employee turnover, shared devices and account switching. Measure it with:

- account-scoped queue events per active field user;
- records blocked for scope mismatch;
- review completion and deliberate discard rate;
- accepted replay rate and duplicate receipt rate;
- support cases involving shared devices or missing check-ins;
- time from account sign-in to successful recovery.

These metrics should be aggregate counts with no raw coordinates. A passing test does not establish retention, revenue, customer adoption or reduced support cost.

## Architecture and remaining limits

The v2 key is a browser partitioning mechanism, not authorization. The server still verifies the live session, organization and employee identity. The local queue is still bounded localStorage, not an encrypted vault. Cross-tab writes are not transactional; two tabs can still race to display stale review information. Entries captured before this version may remain in the legacy queue until the person reviews or discards them. A closed browser does not retry or clean up records. Account recovery on another device cannot see localStorage entries from the old device.

Next slice: use a transactional per-account local store or a carefully designed cross-tab protocol, add an explicit export/recovery receipt for blocked entries, and verify physical devices and assistive technology. Those steps require new evidence before claiming offline readiness or durable device synchronization.
