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

`node scripts/generate-release-evidence.mjs --check artifacts/release-evidence/manifest.json` fails unless every required check succeeded, every required evidence file exists, and the evidence digest is well formed.

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
