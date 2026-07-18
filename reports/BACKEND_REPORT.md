# SONARA Agent A Phase 0 Backend Report

Date: 2026-07-18
Branch: `codex/integrate-clark-redesign`
Runtime: root Express application (`server.js` exported through `api/index.js`)

## Executive result

The current backend is a working, test-backed Express MVP with real Supabase, Stripe, Resend, and Vercel integration boundaries. This audit did not change runtime behavior, provider configuration, secrets, or the production database. It closed the highest-priority contract gap by documenting every currently registered API operation and adding a bidirectional drift gate.

The application is not cleared for paid launch. The remaining launch blockers are provider/owner evidence: valid `RESEND_FROM_EMAIL`, Stripe test-mode checkout-to-webhook-to-entitlement-to-cancel proof, unrestricted live smoke, and business/legal/provider approvals.

## Verified architecture

- `vercel.json` rewrites the deployment to `api/index.js`, which exports the root `server.js` application. Nested frontend projects are not the production runtime under ADR-0001.
- The Express stack currently registers 85 `/api` method/path pairs across 62 distinct paths.
- Public/server-rendered navigation is separately governed by the 124-required-GET / 347-registration route registry gate.
- The new `openapi/sonara.yaml` covers the complete registered API method/path set. `pnpm run verify:api` fails for missing documentation, stale documentation, or duplicate operation IDs.
- No API response shape changed. The existing error object remains the compatibility baseline.

## Authentication, authorization, and billing

- Customer auth is resolved server-side from Supabase bearer sessions. Workspace, business-manager, paid-or-owner, and admin middleware remain the authorization boundaries.
- Admin routes fail closed when configuration or authorization cannot be established.
- Paid product records remain gated by persisted active/trialing billing state; checkout redirects do not unlock access.
- Checkout uses server-side plan/price allowlists. Portal creation requires an authenticated user, primary organization, Stripe configuration, and a Stripe customer.
- Both Stripe webhook aliases share raw-body signature verification and an idempotent provider-event persistence path.
- Full Stripe test-mode lifecycle evidence is still pending and must not be represented as verified.

## Database and storage

- `pnpm run verify:db` passes against the repository migration ledger: 39 SQL migration files, 15 required launch tables, and the seven declared private storage buckets.
- Applied migrations are append-only; this audit made no SQL changes and did not attempt to replay or edit them.
- RLS and scoped storage policies are part of the accepted database contract. Service-role use remains server-only.
- Membership naming remains fragmented across organization, workspace, and business membership concepts. Normalize only after an explicit compatibility ADR; do not rename production objects speculatively.

## Security findings

Existing controls:

- non-secret readiness responses and a required client-secret scan;
- raw-body, signed Stripe webhooks;
- server-side admin/customer authorization;
- private storage contract and RLS-backed organization data;
- explicit setup-required responses instead of simulated provider success.

Open hardening work:

- Supabase leaked-password protection remains disabled according to the last recorded advisor review;
- the recorded advisor backlog includes mutable `search_path` functions, callable `SECURITY DEFINER` helpers, and the vector extension in `public`;
- historical migrations contain policies written with older role-expression syntax. Applied migrations must not be edited; any hardening must be a new generated migration, reviewed against current production state and tested for RLS regressions;
- no new secrets or provider credentials should be introduced until the relevant adapter, health check, test, contract, and rollback path exist.

## Infrastructure and integrations

- Vercel is the declared hosting runtime; Supabase supplies auth/database/storage; Stripe supplies billing; Resend supplies transactional email.
- Google OAuth remains explicitly deferred. Optional gateways and integrations remain disabled or setup-required unless their registry evidence says otherwise.
- There are no background workers configured for the Express MVP; `workers:smoke` accurately reports that state.
- No Docker/Rancher migration or alternate production runtime is justified by current evidence. Such a change would require a parity ADR and deployment proof.

## Testing and observability

- Existing required gates cover build, 255 Mocha tests, lint, client-secret scan, route smoke, repository schema verification, launch configuration, and public route registry verification.
- `verify:launch` now also executes the OpenAPI drift gate.
- Health and readiness endpoints are implemented, but live production smoke remains a separate network-dependent gate.
- The API baseline uses generic success schemas for heterogeneous record payloads. Endpoint-specific schemas should be added incrementally without changing deployed shapes.

## Prioritized Agent A backlog

1. Complete the Stripe test-mode lifecycle proof and update the billing report; no live-mode mutation without approval.
2. Verify Resend only after the owner supplies a valid sender address.
3. Write the membership naming compatibility ADR before any migration or API field normalization.
4. Address Supabase advisor findings through new append-only migrations after current-state verification.
5. Add endpoint-specific OpenAPI request/response schemas and focused contract tests, starting with checkout, webhooks, auth errors, and entitlement-gated record APIs.

## Coordination result

Agent B's independent Phase 0 review is recorded in `reports/AGENT_B_PHASE0_REVIEW.md`. Its immediate recommended frontend task is a bounded preference-safety repair: unify the theme attribute, initialize theme before paint, remove unconditional vibration, and add behavioral regression tests. That task is intentionally separate from this backend contract change.
