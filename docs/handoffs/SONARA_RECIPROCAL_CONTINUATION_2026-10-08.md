# SONARA reciprocal ChatGPT / Claude / Codex engineering handoff — October 8, 2026

Refresh GitHub main, every branch, open PR and exact-head Actions before editing. Another coding agent can merge or delete a branch between calls. Baseline inspected main was a9e43ebf7da5f72446736a844becdda0e44f56f1; never assume that SHA remains current.

Repo: famouslytrill-boop/sonara-os. Production project ltzpppffnwopdxbchajr was INACTIVE; active preview yqncsonkxgwhcxedgevk has all 161 recorded migrations through 20261007130000. Do not migrate or deploy to production in the course of consuming this handoff.

## Proposed work in review
Draft PR #471, codex/sonara-ecosystem-discovery-governance-20261008: lib/sonara-community-discovery.cjs, four additional Mocha cases in the existing tests/free-platform-surface-policy.test.js, and architecture documents for corporate hierarchy, customer admin, free social/market/storefront discovery, mobile/device, provider/Excel, legal/security, finance, marketing and industry scaling. The discovery module is pure, not route registered and not enabled for live customers.

Draft PR #470, codex/diagnose-exact-head-coverage-drift-20261008: logs full set differences between generated route markdown and runtime route map, but deliberately preserves the failing CI gate. Separate review because changing CI acceptance criteria is forbidden. Main previously failed SONARA Industries CI at the coverage generator: the report lists /business-builder/owner/reservation-resources, but CI's expected rows do not, although both claim 804 total routes. Diagnose the complete extra/missing set under the SAME environment before changing source or regenerated artifact.

## Read first
AGENTS.md; CLAUDE.md; CONTEXT.md; docs/architecture/SONARA_RESEARCH_RELEASE_SCOPE_2026-10-08.md; docs/architecture/SONARA_PARENT_CHILD_CONTROL_PLAN_2026-10-08.md; docs/architecture/SONARA_SOCIAL_MARKETPLACE_DISCOVERY_2026-10-08.md; docs/architecture/SONARA_MOBILE_MEDIA_PROVIDER_PLAN_2026-10-08.md; docs/architecture/SONARA_LEGAL_FINANCE_SECURITY_SCALING_2026-10-08.md; docs/architecture/SONARA_ALL_SECTORS_ENGINEERING_MATRIX_2026-10-08.md.

## Important safety constraints
The SONARA One platform is a shared application architecture, not an OS kernel. Product divisions are not automatically separately incorporated entities. The free social, listing and storefront policy does not waive authentication, ownership, moderation or third-party payment fees. No client-supplied tenant ID or UI access state grants authority. Require exact-head full CI and review before merge; do not let an automatic agent merge a red PR. No refunds, payout changes, customer mass marketing, public legal policy publication, security grants or destructive data changes without verified owner approval. Don't expose service-role keys or user data in public docs.

## Prioritized next implementation
1. Investigate CI route-set mismatch via the new diagnostic log; remove conditional route divergence and then regenerate exact-head coverage. Validate the changed set, not merely counts.
2. Protect main branch with required Node compatibility, full Mocha, complete SONARA Industries CI, native migration replay and appropriate browser/security checks.
3. Audit preview authenticated-executable SECURITY DEFINER grants and overlapping RLS policy findings; classify exceptions, run multi-tenant tests, and keep production mapping separate.
4. Add authoritative rights-cleared public data projections and block/follow and moderation state to the parent discovery before exposing the pure ranking module.
5. Consolidate customer-specific organization administrative grants, approvals, analytics, imports/exports and provider scopes using existing authority tables.
6. Finish business storefront and Creator marketplace receipt/license/settlement flows with live sandbox evidence and neutral payment custody.
7. Complete Android/iOS device proof, consented GPS/camera/mic, offline conflict protocol, optional lobbies and resource budgets; one feature/PR at a time.
8. Add industry verticals and advanced marketing/SEO only after rights, accessibility, pricing and runtime evidence.

## Mandatory handoff reporting
For every change: timestamp and current base/HEAD, files changed, branch/PR, exact tests run and counts, expected failure versus newly introduced failure, DB changes (or explicit none), provider calls (or none), deployment action (or none), rollback and next minimal PR. Do not declare missing provider credentials as verified success. The user requested reciprocal handoffs so both ChatGPT and Claude/Codex can continue independently; a proposal is not proof that another agent acted.

## Observed preview security and operational evidence
Supabase advisors at inspection: 66 RLS/no-policy INFO, 8 authenticated-executable SECURITY DEFINER WARN, 28 auth RLS initplan WARN, 1292 overlapping permissive-policy WARN, 379 unindexed FK INFO, 583 unused index INFO. Some no-policy cases intentionally protect server-only tables; don't blanket-grant authenticated. Production project inactive; recent Vercel production-target deployments BLOCKED. Browser/mobile/customer/provider evidence still separate from source inventory.