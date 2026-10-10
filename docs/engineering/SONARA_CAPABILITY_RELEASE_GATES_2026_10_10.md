# SONARA external publishing, mobile, scale, automation and claim safety — 2026-10-10

**Status: draft engineering proposal plus two executable offline decision layers (publication preflight and receipt classification). Not deployed, not connected to HTTP routes or a publisher worker.** No production change, public campaign, app submission, financial transaction, autonomous recovery or load test is implied.

## Current repo and primary blocker

Base commit inspected: `6044be8e994f28c81001895f749b776055dc3b23`. At inspection the only open PR was draft #620 (post-consolidation repair), which reported 8,691 passing, six pending and **63 failing** tests; native PostgreSQL replay and browser acceptance remained unverified. Protect main, close CI failures, verify exact head, reconcile the authoritative production Supabase project and respect the website's offline state before any controlled production release.

This change adds:
- `lib/sonara-publishing-manifest.cjs`: canonical versioned SHA-256 over exact final captions, title, accessibility text, hashtags, thumbnail digest, rights-evidence digest and each destination's exact account/copy. Unknown/unbound fields, Unicode bidi controls, non-NFC text, duplicate accounts/tags or malformed digests are rejected. **Server record ownership, authorisation and evidence authenticity are not established by hashing alone.**
- `lib/sonara-multi-channel-publication-preflight.cjs` now requires independently server-read final content hash, verified publishing-manifest hash **and** the actual server manifest. It recomputes that digest, confirms one matching destination copy per approved target and remains non-executing.
- `.github/workflows/governed-publication-contracts.yml`: exact-head isolated **Mocha** test execution through pinned pnpm, frozen dependencies and real repository dependencies on Node 24/26, in addition to (not replacing) the mandatory full suite.
- `lib/sonara-multi-channel-publication-preflight.cjs`: computes a stable SHA-256 over an immutable content digest **and separate canonical publishing manifest digest**, tenant, ordered account destinations, visibility, format, idempotency keys and schedule; uses the established `evaluateApprovalBoard` and `growth-studio-provider-registry`; denies duplicate targets, stale approvals, missing owner step-up, provider scope/account/readiness, missing rights/moderation/releases, capacity and unsupported provider maturity. TikTok public direct posts additionally require platform audit, current creator information and selected privacy level; unaudited private posting requires an eligible private account with SELF_ONLY visibility. All results explicitly report `executionAuthorized:false`.
- `lib/sonara-publication-receipt-reconciliation.cjs`: interprets authenticated provider receipt status, rejects cross-tenant/account/idempotency/snapshot mismatches, requires matching public/private visibility and stable remote post ID, and prevents blind replay after timeout or unknown 429 acceptance. It has **no provider or database execution**.
- `tests/sonara-multi-channel-publication-preflight.test.js`: deterministic happy-path and fail-closed regressions for both layers, including future-dated approvals and ambiguous receipts. Tests use dummy values and make **no provider calls**.

A `worker_claim_candidate` is not a ready-to-publish status. Neither a valid SHA-256 nor a caller-provided boolean authenticates a person, customer consent, OAuth scope, customer organization or physical provider account. Only an authenticated server resolver with transactionally checked, provider-specific authority may supply this context. The preflight is intentionally not route-wired.

## 1. External social publishing: implementation order

1. **Account authorization:** implement server-side OAuth callback, encrypted per-tenant token vault, explicit consent and provider-account binding. Scope the adapter to one named destination. Do not share tokens between tenants.
2. **Frozen proposal:** customer uploads rights-cleared content, accessible captions/alt text, purpose, target accounts, requested visibility and schedule; compute a content digest after final media processing. Construct a canonical batch hash with `publicationSnapshotHash`. Store hash and version in a durable approval request, not in query parameters.
   - `publishingManifestHash` is required and must be SHA-256 over a canonical server-built manifest containing the exact text/captions, tags, destination-specific copy, thumbnail/asset references, accessibility metadata and rights/licensing evidence. A media-file digest alone does **not** freeze the publication payload; the server must verify both hashes independently. Changes require a fresh owner approval. This is a shape constraint, not a production manifest builder.
3. **Human decision:** `sonara-customer-approval-board.cjs` obtains owner step-up, approvals and expiry for the exact snapshot. Editing media or account selection invalidates the old approval. Provider-required user confirmations must be freshly captured.
4. **Trusted preflight:** server reads customer identity, rights, blocks, moderation, connected account, OAuth scope, provider terms/audit/creator info, rate quota and pending work from authoritative storage; feed only reviewed values to `evaluatePublicationBatch`. Unknown is DENY.
5. **Durable dispatch (not implemented here):** insert one outbox record per destination under a transaction with unique `(organization_id, provider, account_id, idempotency_key)`; acquire fenced job claims, lock and revalidate approval immediately before an external side effect. No broad multi-platform publish switch. Every provider adapter owns its actual request format and policies.
6. **Receipt and ambiguity:** after provider acknowledgment persist remote ID, received timestamp, visibility, status and trace. On 429 honor retry-after and exponential backoff with jitter; on 5xx use bounded retries and dead-letter; on network timeout query provider status before any retry that could duplicate publication. A `202 Accepted` upload is not proof of published visibility. Cancellation and revoked consent block **future** attempts, not already acknowledged external posts.
7. **Customer controls:** clear preview, per-target blockers, explicit approval/revoke, status `draft / awaiting_review / queued / uploading / provider_processing / published / failed / outcome_unknown / cancelled`, activity log and manual reauthorization.

**Provider facts:** TikTok Direct Post requires approved `video.publish` scope, user authorization, creator-info/privacy UX and platform audit for public visibility. YouTube's `videos.insert` requires OAuth/upload handling and quota; SONARA's registry currently classifies it reference-only, so it is denied by this candidate gate. LinkedIn has an existing versioned adapter contract, but source presence is not account-based provider acceptance. Meta publishing must be separately tested per app review, account type and endpoint.
- https://developers.tiktok.com/docs/en/content-posting-api-get-started
- https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- https://developers.google.com/youtube/v3/docs/videos/insert
- https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api

**Manifest trust boundary:** the caller assembling `serverPublishingManifest` must have already fetched frozen, tenant-owned material, rights evidence and creator-approved provider copy from the database and verified source revision/asset hashes. Neither a browser-submitted `serverPublishingManifest` nor a browser-submitted matching hash is authoritative. This PR intentionally does not supply that authenticated resolver or execute a publisher worker. Source unit tests must run against the real provider registry and approval board, not mocks; a passing isolated matrix is not a green platform release.

**Acceptance:** two tenants cannot see/use one another's tokens, accounts, approvals or publishing receipts; edited contents fail old hashes; repeated jobs create at most one provider-visible effect where provider idempotency supports it; partial destination failure is visible and retryable only after operator review; unsupported provider never masquerades as success. Test with each **real approved sandbox/provider account** before staged rollout.

### Offline receipt acceptance and uncertainty

`classifyPublicationReceipt` is a deterministic state interpreter. It accepts only independently authenticated provider evidence from a server-controlled integration path, not provider claims submitted by browser JSON. A recognized remote post ID and matching requested visibility can produce `provider_published_receipt`, which is **provider-reported** state, not a separate public reachability audit or guarantee of retention. An accepted upload and an in-progress processing result are **not** published posts. Unknown network outcomes and incomplete 429 responses require provider status reconciliation; a verified not-accepted 429 yields only a `retry_review_candidate`, never automatic execution. Terminal published/cancelled/rejected jobs are not silently replayed.

The current layer does not create a PostgreSQL outbox, consume idempotency claims, or send work to a provider. Before shipping, design the durable execution state machine and test crash-after-publish/before-ack, simultaneous worker claims, OAuth revocation during retry, 429/5xx handling, duplicate webhooks, provider status drift, and long-running uploads under isolated real provider accounts.

## 2. Android and iOS distribution

Reuse `lib/sonara-device-qualification-evidence.cjs`, `scripts/verify-device-qualification-evidence.cjs`, `data/device-qualification-evidence.json` and the existing Android TWA / iOS shell work. Current qualification is not demonstrated.

- **Android:** immutable-SHA signed AAB, verified Digital Asset Links on production domain, Play internal test installation, authentic sign-in/deep link/notification consent and permission behavior, offline public fallback with account-private cache exclusion, error/ANR evidence and required physical Android phone models.
- **iOS:** macOS/Xcode signed build, correct team/bundle/entitlements, Universal Links, TestFlight internal installation, VoiceOver, permissions, safe WebKit/offline mode, account-private cache exclusion and real iPhone proof.
- **Both:** verify real sign-out/revocation, tenant switching, 320–1280 px layouts, 200% text scaling, keyboard/screen readers where applicable, slow network, offline/logout sync, device storage clean-up, billing flow policy and in-app purchase classification. App Store and Play approval are separate from source build.
- Only qualify exact immutable release SHA with `pnpm run verify:device-qualification`. Submit store apps **only** through authorized operator actions.
- Official references: https://support.google.com/googleplay/android-developer/answer/9845334 ; https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app .

## 3. Enterprise-scale reliability (unproven)

Set explicit *proposed* SLOs, not a promise: for non-media customer APIs, at the **agreed staged reference workload**, HTTP 5xx under 1% and p95 latency under 800 ms; define separate queues/media SLOs. A target is not measured evidence. Determine baseline production RPS, DB pool usage, p99, queue depth/age, webhook duplicate suppression, memory, CPU, spend and error rate first.

- Run isolated k6 **smoke → median workload → 2x burst → soak → throttling/failure injection** against owner-authorized nonproduction targets with synthetic tenant records only.
- Verify Postgres RLS on every query/work order; simulate 429 provider throttling, provider outage, worker crash after effect-before-ack, duplicate webhooks, dead-letter replay, database connection exhaustion, event/backpressure and customer-scoped quotas.
- Recovery: take encrypted backups, practice point-in-time restore in an isolated database, verify tenant data and receipt integrity; measure **actual** recovery point objective (RPO) and recovery time objective (RTO), including identity and storage dependency restoration.
- Gate canaries at 1% then 5% then 25% only if actual error budgets, exact-SHA telemetry and automated stop criteria are in place. If production remains intentionally offline, do not bring it online for measurement.
- No 'enterprise scale' marketing claim until independent **sustained production** metrics, restore/failover drill and support/on-call records exist.
- Sources: https://grafana.com/docs/k6/latest/using-k6/thresholds/ ; https://sre.google/workbook/canarying-releases/ ; https://sre.google/workbook/error-budget-policy/ .

## 4. Governed self-healing and self-coding

Existing sources: `lib/sonara-adaptive-learning-policy.cjs`, `lib/sonara-customer-automation-policy.cjs`, `lib/sonara-controlled-recovery-execution.cjs`, `lib/sonara-postgres-operator-gate.cjs`. Preserve their governance. Proposed stages:
- Observe instrumented SLO anomaly -> classify known failure mode -> propose reviewed reversible playbook -> verify live claim/fence and operator grant -> execute only allowlisted reversible task -> compare telemetry -> verify rollback and incident report.
- An autonomous **proposal** may open a scoped branch and PR with reproducible tests, but may never self-approve, rewrite release checks, push directly to protected main, alter production credentials/RLS, change money state or self-deploy.
- Require kill switch, bounded incident/day cost budget, operator revocation, dry-run proof, evidence on duplicate/reordered events and independently controlled release.
- No assertion of autonomous self-awareness or all-purpose repair.

## 5. Payments, banking, investments and custody

SONARA remains a software vendor. Customer checkout, invoices, transaction records and reconciliation can be orchestrated through a regulated/contracted provider after explicit authorization. SONARA itself does **not** hold customer funds, issue deposit accounts, safeguard investments, operate escrow, lend, transmit money or guarantee financial returns. Do not store CVV or private banking credentials. Refund/payout/beneficiary changes are approval-gated. Sandbox webhooks and ledger proofs first; finance/legal review before changing any operating model.

Maintain a separation between subscription fees charged by SONARA and merchants' sale proceeds handled by their connected payment processor. Provider integration availability is **not** a bank or money-services license.

## 6. Truthful marketing outcomes and compliance

Growth Studio may prepare campaigns, segment opted-in audiences, publish to authorized accounts, report performance, and suggest statistically qualified experiments. SONARA cannot guarantee sales, ROI, SEO position, conversion uplift, ad approval or regulatory compliance. For any performance claim retain attribution method, sampling, window, cost basis, source, confidence/uncertainty, consent and independent human review. No fabricated customer testimonials, proof of sales, unverified comparative statistics or legally definitive compliance advice.

The FTC expects a reasonable evidentiary basis **before** making objective advertising claims: https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation .

## Release acceptance sequence

1. Keep this branch as a **draft** and reconcile with open #620; avoid merging while baseline failures persist.
2. Verify Node 24/26, frozen pnpm install, ESLint, Mocha, tsconfig contracts, full build, CodeQL/secrets and any generated-index checks at the **exact** commit. Run the new test on real repository dependencies, not mocks alone.
3. On a disposable database, implement/review tenant-isolated approvals, outbox and receipt models, RLS adversarial tests and provider contract integration; never add duplicate schema objects.
4. Run per-platform sandbox/real-account negative and idempotency tests; gather physical Android/iOS artifacts and load/restore evidence; demonstrate rollback.
5. Operator signs off on distinct one-tenant publishing/mobile/reliability canaries. Public activation remains disabled until the live SHA, permission state and post-deploy checks independently agree.

**Non-goals of this PR:** production endpoint, queue worker, app binary, store publication, provider OAuth connection, production load performance claim, autonomous repairs, custody or financial licensing, guaranteed customer outcomes.
