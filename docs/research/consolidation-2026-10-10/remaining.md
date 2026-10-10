# Remaining PR consolidation — 10 October 2026

PR #618 was merged on GitHub, followed by #615, before this continuation. This pass starts from main `7fab6d3f`, combines the twelve PRs still open at intake, and preserves all 107 original intake heads in candidate ancestry. Inclusion is not release approval. Source descriptions and current review comments are in `remaining-source-review.json`; the original intake is retained in `source-review.json`.

## Resolutions

- #513, #519, #526, #545 and #580: retain useful audits and bounded diagnostics, but replace competing preview-dependent rehearsals with the canonical hardened contract. The older post-migration rehearsal is historical material under `docs/archive/rls-replay/`, not an executed migration or probe.
- #517: retain the broader existing closed-RLS grant-revocation migration from #520. Do not add a second migration at the same version. Existing frozen SQL and its 175 pinned checksums are unchanged.
- #523: retain current step-scoped secrets and exact-SHA preflight. No provider credentials are read or changed.
- #558 and #564: retain the stricter combined billing implementation. One-time receipts cannot unlock recurring plans, and customer/tenant binding remains mandatory.
- #559: restore bounded job/test timeouts across seven workflow files. Superseded PR runs can be canceled; current main, manual and merge-queue attestations remain independent. Tests measure actual current jobs, including the new artifact job, rather than requiring a retired live-credential preview implementation.
- #515: add video-track and nonzero-preview-dimension guards without losing newer permission checks, revocation cleanup or voice finalization behavior.
- #610: combine same-origin parser-loaded component fixtures with the newer MIDI and media cases. Preserve actual CSP/security response headers, positively allowlist shipped scripts, reject missing/HTML assets, and avoid replacing the head or injecting script bytes inline.
- RLS: require the exact three migration-defined subscription policies in addition to the 25 hardened policy contracts. Both preflight and postflight enforce role, command, permissiveness, USING and WITH CHECK equality. Preview-only policies remain forbidden in native replay. No real policy CREATE/ALTER/DROP occurs. The SQL emits the exact runner success marker; the P0 tenant write/deny proof remains before P1.
- Reconcile older tests with stricter public-cache installation, anonymous Requests, current cache namespace and renderer asset version. Invalid essential assets abort installation and remove its cache. Explicit update consent and no automatic takeover remain mandatory.
- Use the established `waste_percent` and `payload_bytes` formula inputs rather than introducing conflicting units or duplicate formula keys.

## Verification

- Frozen pnpm install passed; moderate audit reported no known vulnerabilities.
- Lint passed with zero warnings; typecheck and build passed.
- Action supply-chain policy, environment classification and frozen migration integrity passed.
- **149 focused regression tests passed.**
- Full suite: **8,676 passed / 6 pending / 76 failed**, improved from the previous 95 failures. Every remaining failed case is listed in `validation-failures.json`.
- Playwright discovered all **45** public-experience tests, including newer media/MIDI cases. Discovery is not browser execution; the Chromium/Firefox/WebKit matrix is still required.
- Native PostgreSQL replay has not been executed locally. Static RLS assertions do not substitute for the PostgreSQL 16/17/18 matrix or production acceptance.
- No production deployment, remote migration, provider activation, customer mutation, original-PR closure or main merge was performed by this continuation.

**Keep draft.** Remaining failures include route/data and OpenAPI coverage, current paid-access fixtures, provider-receipt and consent contracts, OAuth assertions, workflow attestation assumptions and other application-wide contracts. No release or merge approval is claimed.

## Source heads

| PR | Title | Candidate treatment |
| --- | --- | --- |
| [#513](https://github.com/famouslytrill-boop/sonara-os/pull/513) | Recover exact-head CI after consolidated RLS hardening | Included with explicit canonical conflict resolutions; `ad16584d1236` |
| [#515](https://github.com/famouslytrill-boop/sonara-os/pull/515) | fix(media): fail closed on unplayable camera previews across browsers | Included with explicit canonical conflict resolutions; `1a514aa17c44` |
| [#517](https://github.com/famouslytrill-boop/sonara-os/pull/517) | Revoke browser grants from reviewed server-only tables | Included with explicit canonical conflict resolutions; `692a78886612` |
| [#519](https://github.com/famouslytrill-boop/sonara-os/pull/519) | fix(ci): reconcile P1 RLS replay with hardened policies and Mocha inventory | Included with explicit canonical conflict resolutions; `4046e0c9109e` |
| [#523](https://github.com/famouslytrill-boop/sonara-os/pull/523) | security(release): restrict production secrets to consuming GitHub Actions steps | Included with explicit canonical conflict resolutions; `07f3ed42861a` |
| [#526](https://github.com/famouslytrill-boop/sonara-os/pull/526) | fix(P0): verify pre/post RLS migration semantics and resync Mocha handoff | Included with explicit canonical conflict resolutions; `a7e68e4f4e3c` |
| [#545](https://github.com/famouslytrill-boop/sonara-os/pull/545) | fix(P0 RLS replay): distinguish tracked subscription policies from remote-only drift | Included with explicit canonical conflict resolutions; `dbb34ab8f488` |
| [#558](https://github.com/famouslytrill-boop/sonara-os/pull/558) | fix(billing): shared SONARA subscription destination for all studios | Included with explicit canonical conflict resolutions; `16d17781aa25` |
| [#559](https://github.com/famouslytrill-boop/sonara-os/pull/559) | CI: bound runner occupancy and cancel superseded heads | Included with explicit canonical conflict resolutions; `4f1dd2ccac05` |
| [#564](https://github.com/famouslytrill-boop/sonara-os/pull/564) | security(billing): deny one-time Stripe receipts for subscription entitlements | Included with explicit canonical conflict resolutions; `dd9c16f3c811` |
| [#580](https://github.com/famouslytrill-boop/sonara-os/pull/580) | Draft P0 CI convergence: generated inventory, RLS baseline and rollback proof | Included with explicit canonical conflict resolutions; `6f8e7dd526c0` |
| [#610](https://github.com/famouslytrill-boop/sonara-os/pull/610) | fix(ci): verify post-hardening RLS policies in native replay | Included with explicit canonical conflict resolutions; `595c0f85f973` |
