# Release Evidence Contract

SONARA release approval is evidence-driven. A green status is not a claim that a command ran somewhere; it is a machine-readable record tying the commit to the architecture, security, tenant-isolation, dependency, and secret checks that actually ran.

## Engineering Intelligence pipeline

`.github/workflows/engineering-intelligence-security.yml` performs the following sequence on pull requests to `main`, pushes to `main`, and manual runs:

1. checks out the full SONARA Git history;
2. installs the locked pnpm dependency graph;
3. runs GitHub CodeQL for JavaScript/TypeScript SAST;
4. builds and lints the server;
5. generates `artifacts/engineering/repository-analysis.json` from tracked repository evidence;
6. checks out Archify at the exact reviewed commit recorded in the workflow, with Archify update checks disabled;
7. validates and renders `architecture/sonara-platform.architecture.json`;
8. generates an Architecture Delta against the pull request base map when one exists;
9. runs tenant-isolation and adversarial route tests;
10. runs RLS/member/tenant-query contract checks;
11. runs the dependency vulnerability audit and client-secret scan;
12. hashes the resulting evidence into `artifacts/release-evidence/manifest.json` and `manifest.md`;
13. uploads the complete evidence bundle before enforcing the final gate.

A failing check therefore remains inspectable. The workflow does not hide evidence by exiting before the artifact can be uploaded.

## Evidence bundle

The release evidence manifest records:

- repository, commit, ref, workflow run, and attempt;
- the result of each gate;
- the expected artifact path for each gate;
- SHA-256 and byte length for generated evidence files;
- missing artifacts;
- failed checks; and
- one canonical SHA-256 evidence digest over the artifact set.

`node scripts/generate-release-evidence.mjs --check artifacts/release-evidence/manifest.json` checks the manifest's reported status and digest syntax. **This check alone does not rehash evidence bytes.** The enforced CI step now runs `node scripts/verify-release-evidence-integrity.mjs --self-test`, then the existing status check, then `node scripts/verify-release-evidence-integrity.mjs --check artifacts/release-evidence/manifest.json --source artifacts --commit "$GITHUB_SHA"`. The second checker enforces all eight expected gates, each required artifact, exact SHA-1 Git commit identity, real file existence and SHA-256/byte-length equality, and a recomputed canonical digest. It rejects missing or duplicated evidence, skipped checks, traversal/symlink escape, stale bytes, and mismatched commits. It does not authenticate the original producing process or prove production/live-provider behavior; CI ownership, review, and post-deploy verification remain distinct.

## Tenant and adversarial proof

`tests/cross-tenant-isolation.test.js` drives two seeded organizations through real SONARA routes while a fake Supabase Auth/PostgREST implementation records every query. The test is intentionally capable of observing a leak because both organizations' rows exist at the same time.

The adversarial cases additionally attempt to widen authority through:

- forged organization/tenant headers;
- forged organization and user query parameters;
- forged admin/founder role headers; and
- invalid bearer tokens.

The authenticated session and server-side membership lookup remain authoritative. Caller-controlled tenant or role hints never become authorization.

This is application-level adversarial proof. It does **not** replace a controlled production/staging RLS penetration test against the live Supabase project. Provider-side RLS verification remains a separate owner/provider-dependent release activity.

## Archify boundary

Archify is a development/CI tool, not a SONARA runtime dependency. CI checks out one exact reviewed upstream commit and disables Archify update checks. The generated system map and Architecture Delta are release evidence; they do not decide risk, merge safety, user permissions, or agent authority.

## BreachLab boundary

BreachLab is an external offensive-security training reference. SONARA may derive defensive test cases and training playbooks from attack classes learned there, but BreachLab code or targets are not part of the production application. Security exercises are limited to SONARA-owned systems, local fixtures, staging environments explicitly approved for testing, or the training provider's own authorized targets.

## Authority boundary

Security findings can block a release. They cannot grant access, approve a consequential agent action, modify tenant scope, or override `lib/sonara-agent-authority.cjs`.

Release evidence records what happened. It never manufactures permission.


## Shared runtime capability authority (2026-10-08)

The runtime capability service in `lib/sonara-runtime-capabilities.cjs`
and the in-memory flag provider in `lib/sonara-feature-flags.cjs`
are reusable **denial** controls. They are not a new source of billing,
membership, or owner-approval authority.

A capability requiring customer entitlements must pass, in order:

1. An explicitly reviewed enabled boolean flag (default off).
2. Valid organization context and the configured tenant allowlist when scoped.
3. Every configured entitlement checked against a real server-side billing
   source. **No checker, provider error, non-boolean response, or missing
   entitlement means denied.** The caller must not infer a paid subscription
   from a client flag or mutable request field.

The current static `TypedInMemoryProvider` is held per capability service.
The OpenFeature SDK's process-wide named provider registry is intentionally
**not** mutated by each evaluation: constructing a second service with
different flags must not change the first service's decisions. The
`DOMAIN` property is a stable public label, not a shared mutable
authorization namespace. A remote provider should only be considered after
its isolated lifecycle, semantics, failure handling, and tenancy are tested.

| Product | Candidate high-risk operation | Additional authority outside this helper |
| --- | --- | --- |
| Business Builder™ | POS settlement, refunds and customer billing | Merchant ownership, provider confirmation, idempotent ledger and owner review where required |
| Creator Studio™ | Licensed media export, publication and GPU processing | Explicit content and distribution rights, resource budget, provider/runtime authorization and provenance |
| Growth Studio™ | Cross-platform account publishing or campaign spend | Verified OAuth scopes, connected account ownership, destination/consent approval and rate/cost ceilings |
| SONARA One | Durable event-consumer canary and autonomous recovery | Filtered claim ownership, tenant/mutation scope, fencing, operational evidence, rollback and release approval |

These are **integration requirements**; listing an operation in this
table does not claim that its route currently calls the runtime capability
service. Before a product route adopts the service, the integration PR must
name the exact handler, caller identity, tenant source, billing lookup,
user-visible denial reason, cost/approval path, unit/integration tests and
post-deploy evidence. Reuse existing agent and commerce authorization modules
rather than treating a flag as permission to spend or publish.

`tests/openfeature.test.js`, `tests/runtime-capabilities.test.js` and
`.github/workflows/event-consumer-readiness.yml` exercise shared flag and
entitlement behavior. These are local-code controls, **not** a substitute
for direct staging RLS A/B tests, Stripe/provider reconciliation, or GitHub
protected-branch and exact-SHA release governance.
