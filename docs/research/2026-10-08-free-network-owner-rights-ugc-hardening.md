# SONARA Free Network — Ownership, Copyright and UGC Engineering Pass
**Prepared 2026-10-08** · Owner scope: SONARA Industries, Business Builder™, Creator Studio™, Growth Studio™. **Security changes are proposed in a review PR, not deployed features.**

## Verified starting position
As inspected in this pass, GitHub `famouslytrill-boop/sonara-os` main was `9d141e68d1ec14c037f92d1eebb3c2718d583c0a` (merge of integration PR #507); 19 open PRs at that point, with many overlapping CI and Supabase RLS changes under review. Supabase showed 163 applied migrations ending `20261008100000`. Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` remained `live:false` with latest production BLOCKED. This pass applies no SQL and must not restore the public website.

The existing module `lib/sonara-free-platform-surface-policy.cjs` describes 12 *policy-only* surfaces (four product brands × social, marketplace, storefront), free to use with an authenticated account. `lib/sonara-community-discovery.cjs` is an *unwired* deterministic, rights/moderation-filtered discovery candidate selector. Existing Growth Studio channels, Creator marketplace and business storefront systems have separate service routes and ownership/database contracts. DO NOT conflate their runtime readiness with the 12 policies.

## Actual implementation in this branch
Existing `surfacePolicy` already fails closed on malformed user/org UUIDs, mismatched server tenant scope, missing authorization, moderation status and unknown actions. This branch adds:
- `manage` requires separately granted, strictly Boolean `actorCanManage=true`. A social poster or marketplace lister with `actorHasPermission=true` alone cannot claim permission to administer business settings and ownership. This is a preflight policy input; the invoking server must verify it from active organization memberships/permission grants, not a request JSON field.
- `publish` and `comment` require `termsAcceptanceVerified=true` from a versioned, affirmative **server-verified** terms acceptance receipt. It is not permission from a cookie, checkbox string, or self-reported profile. Anonymous/public browsing and authenticated **abuse reports** remain possible without forcing acceptance of publishing terms.
- Marketplace `publish` requires `rightsCleared=true`, separately from passing moderation. It represents a proven, version-scoped rights/licensing review, not just a contributor checking a box. Draft listing creation and other basic participation remain free.
- Strict Boolean values: `"true"` does not satisfy any privileged condition. Missing prerequisites return named denial codes, never implicitly activating a connector or charge.
- Cross-brand regression tests cover all 12 surfaces, rights-denied publication across four marketplace brands, independent managing-owner grants and verified UGC acceptance across publishing/commenting.

These additions provide **policy checks only**. They do not write user signatures, publish new terms, authorize payments or execute posts. A route cannot use user-controlled flags to bypass guards; it must read real consent and rights tables, validate a current document hash/version and bind the exact user, organization, asset and action.

## One ecosystem, four brands
```text
SONARA Industries (free shared discovery, public-safe projection)
  verified session -> membership/organization -> business/project/channel ownership
    permissions [basic write | manage owner settings | moderate | publish approved]
    consent evidence [terms version | media rights | marketing | data purpose]
    review queues [moderation | copyright | brand disputes | appeals]
      Business Builder: merchant storefront / bookings / services / location / POS
      Creator Studio: portfolio / licensed marketplace / release / media rights
      Growth Studio: consented channels / campaigns / social posts / attribution
  Shared: outbox / inbox / rate caps / telemetry / data privacy / legal receipts
```
Private CRM, unreleased media, orders, bank details, staff files and private tenant tables never flow into parent discovery. Public results originate from sanitized, specifically approved projection tables or audited materialization; no unrestricted joins into private tables.

## Administrative modes
- **Basic:** sign in, manage own draft, report abuse, browse/find legitimate listings, see transaction/provider status and revoke optional consent. No paid SONARA subscription gate.
- **Business/Creator/Growth operator:** versioned approved organization membership; edit owned resources, access source-scoped analytics, view job and campaign status, connect external provider with least-privileged OAuth and revoke grant.
- **Business administrator:** real owner/manager grant, can configure team permissions, destinations, limits and business settings with audit and step-up approval where needed. A user with ordinary `create` or `comment` permission cannot gain `manage`.
- **Moderator:** independent, audited `moderate` authority, trained policy and appeals, never delegated through a public role label or user-edited metadata.

## Data and migration plan (NOT APPLIED)
Before adding any migration, inventory existing terms/consent, listing rights, publication status, organization grants, moderated content and abuse records. Avoid another broad public `posts` table if Growth/Creator tables already provide private originals and public projections. If a genuine gap is established, add an additive, RLS-first migration reviewed in a separate PR:
- `agreement_acceptance_receipts`: `actor_user_id,organization_id,document_key,version,content_sha256,displayed_at,accepted_at,locale,affirmative_control_id`, unique per current acceptance event; signer/session audit; retention policy.
- `asset_rights_clearances`: `asset_id,listing_version,source_hash,grantor,permitted_uses,expires_at,decision_by,decision_at,review_version` with immutable attachment pointers.
- `moderation_decisions`: `source_kind,source_id,decision,policy_version,actor,reason,appeal_status,time`.
Only an approved service may populate acceptance and clearance signals after exact-row authorization; client `true` flags must never be written into an authoritative role/rights record.
RLS in exposed schemas, correct grants, narrow policies `TO authenticated` plus tenant predicates, both `USING` and `WITH CHECK` on updates; avoid new SECURITY DEFINER functions as a shortcut. Measure RLS plan regressions using EXPLAIN ANALYZE on **staging**, not by disabling RLS in production.

## Legal and compliance boundary
The existing `docs/legal/2026-10-08-sonara-free-platform-agreements-and-releases-review-drafts.md` contains **unapproved drafts**, not enforceable published terms, signed releases or accepted user contracts. Qualified counsel must review jurisdiction, platform terms, independent sellers, copyright notice/takedown, age suitability, privacy, AI generation/likeness releases, tax/ticket/refund/chargeback allocation and e-sign validity. Never precheck consent, fabricate a signature or grant model-training/voice rights by default.
Google Play UGC policy expects clear terms, reporting, user blocking and ongoing moderation in apps with UGC: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en . The rights and terms guards in this branch are necessary **but not sufficient**: a production social network also needs accessible reports, block/mute controls, independent moderation, appeals, safety response SLAs and minor protections. Do not distribute mobile UGC apps before proving them.

## Google / Microsoft / Apple / cloud and spreadsheets
- Use explicit opt-in OAuth/provider-account connections; a SONARA session is never automatic permission for Google Drive, Microsoft Graph, Apple services or money accounts. Scope providers to smallest read/write surface, use PKCE, encrypted server-side tokens, revoked/disconnected state, rate/retry budgets, audit and provider failure reconciliation.
- Microsoft Excel Graph supports read/write workbooks for OneDrive for Business / SharePoint with delegated `Files.Read` or `Files.ReadWrite` scopes, and **not** consumer OneDrive Excel REST in the documented API: https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0 ; https://learn.microsoft.com/graph/permissions-reference?view=graph-rest-1.0 . Use CSV/XLSX import/export paths as a distinct, validated lower-cost baseline.
- Seller-issued prices, taxes, shipping and independent payment processing are separate from the **zero SONARA membership/listing/posting fee**. Stripe Connect offers provider-billed and platform-billed fee models whose legal/financial allocation differs; don't promise zero processor fees or custody-free operations without the chosen charge model: https://stripe.com/connect/pricing .
- Keep account/payment data off public profiles and parent discovery; avoid disclosing vendor tokens in browser/client traces.

## Bottlenecks, formulas and business sustainability
- `direct_free_cost_per_active_organization = (moderation + storage + bandwidth + notifications + database operations + provider requests) / verified_active_organizations`; measure by monthly cohort before scaling 17 industry packs.
- `quota_budget_remaining = reserved_limit - committed_usage - outstanding_reservations`; reserve atomically; rejection/429 with Retry-After must preserve customer drafts.
- Discovery ranking must be deterministic and explainable, with blocked-author and muted-topic lists applied **before** ranking. If those lists are unreadable, fail closed (existing community-discovery contract). Default chronology; optional consented personalization.
- External settlement per currency: `recognized_collected_cents - verifiable_refunds_cents - approved_fees_cents`; unknown or disputed values cannot be coerced to 0.
- Observe p50/p95/p99 request duration, queue depth/age, SQL plans, plan cache, cross-tenant denial tests, provider error ratios, costs, time-to-first-use, first listing/post, 7/30-day retention and accessibility error rate.

## Exact-head engineering acceptance
1. `pnpm exec mocha tests/free-platform-surface-policy.test.js` all green across Node 24 and compatibility lane, with new tests covering strict Boolean grants and rights/terms.
2. Full `pnpm test`, lint, build, route/inventory checks, browser (Chromium/Firefox/WebKit), native Postgres migration replay, SCA/CodeQL and release-gate workflows **green on the final exact SHA** before merge. PR #526 and others own existing RLS/CI failures; don't overwrite them or merge green subsets over red suite.
3. Run adversarial membership: one company's user must not manage another business, even if they own a public creator profile. Validate publication input hash, rights expiry, current UGC terms version, moderated asset, and refusal on unverified/unauthorized provider.
4. Preserve Vercel production OFFLINE. No SQL, provider, financial or public publishing actions in this research/guard PR.

## Next bounded activation
Wire the **existing** free surface policy into each actual route only after it derives session, tenant membership, right to edit/publish/manage, versioned consent and stored rights evidence. Extend the shared public discovery projection with explicit moderation and `block/report` before calling it a running social network. Open an independent provider integration PR for Microsoft/Google after approval and sandbox credentials are available.
