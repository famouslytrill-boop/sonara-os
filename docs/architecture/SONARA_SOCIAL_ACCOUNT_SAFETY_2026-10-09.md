# SONARA User Reporting and Account Blocking — October 9, 2026

## Exact engineering status

This is a **default-disabled, review-only** extension to PRs #572 and #573. New account-level code adds authenticated block/unblock/report endpoints for published Creator Studio profiles, an account safety management page, public creator safety controls, strict configured HTTPS-origin validation, report-request idempotency and a proposed SQL transaction for the block/follow graph. The previous anonymous Growth channel report and its owner-side moderation are separate features.

The reviewed SQL is held in docs/sql-proposals/2026-10-09-social-user-blocks-and-reports.sql. It is **NOT a numbered migration and was NOT applied or tested against real PostgreSQL**. SONARA_SOCIAL_USER_SAFETY_ENABLED must remain absent or false until the migration, security verification and isolated canary are approved. No production site or database was changed.

## Behavior after verified migration and activation

- Authenticated member blocks a public creator profile; server resolves the account owner privately and records a personal user-to-user block.
- Database transaction removes existing creator follows in both directions. A database insert trigger rejects attempts to refollow a blocked user, including writes through older application endpoints. Ordered advisory locks serialize block/follow races; a separate per-actor lock serializes the block quota.
- Profile reports store a bounded reason, optional note and an idempotency request identifier with no public reporter disclosure. Reporting does not automatically ban anyone.
- A blocked creator becomes unavailable to that member while signed in; blocking does not make publicly published content inaccessible to anonymous browsers.
- A member can unblock a previously blocked user through their own private account list, even when the associated creator profile is unpublished.
- The safety UI refuses to guess on missing database state: no misleading empty block list or implied permission from a failed read.

## Threat model

| Surface | Control |
| --- | --- |
| Forged actor ID | Server session only; browser-supplied actor/tenant fields ignored |
| Arbitrary profile ID | Exact UUID, database derives user ID and checks profile state |
| Cross-origin POST | Exact configured HTTPS origin; never trust caller Host headers |
| Block/report privacy | RLS enabled and no direct anon/authenticated table grants |
| Report floods | In-process/IP rate budget plus transactionally limited per-user report volume |
| Replays | Report request ID unique per reporter; duplicate attempts are acknowledged without duplicate records |
| Follow/block races | Transaction-level advisory pair lock in both paths |
| Incomplete block state | Signed-in profile route fails closed instead of showing follow controls |
| Moderator access | Growth owner/admin audit remains separate; this wave adds platform-reviewed queue and audit proposals guarded by a distinct manually approved reviewer grant. Appeals and public activation remain outstanding |

## Required work before a customer rollout

1. Resolve exact-head review and CI on PRs #572/#573 and this stacked change. Do not bypass branch protection, failed scans or inactive site controls.
2. Verify the canonical production Vercel and Supabase identity; a healthy preview environment does not establish production.
3. Use the Supabase CLI on a reviewed isolated database to generate a numbered migration, reconcile this SQL proposal, regenerate the tenant registry, and test migrations and rollback.
4. Exercise actual PostgreSQL grants, multi-tenant denial, direct Data API restrictions, blocking/unblocking after profile removal, concurrent follow/block race and duplicate report submissions.
5. Review and test the proposed independent platform moderation queue, reviewer-assignment grant and atomic decision audit using real PostgreSQL; then establish staffed escalation SLAs, appeal workflow, emergency escalation and safety support. No moderator is enabled by this branch.
6. Add browser/mobile end-to-end tests, accessibility, API contract checks, full Node 24/26 CI, CodeQL, dependency and restore evidence.
7. Obtain owner approval for one-tenant canary, then and only then set SONARA_SOCIAL_USER_SAFETY_ENABLED to the exact value true in the approved environment.

## Source research

Google Play user-generated content policy: https://support.google.com/googleplay/android-developer/answer/9876937
Apple App Review Guidelines section 1.2: https://developer.apple.com/app-store/review/guidelines/
OWASP API authorization: https://api-security.owasp.org/editions/2023/en/0x11-t10/
OWASP business-logic race analysis: https://owasp.org/projects/top-10-for-business-logic-abuse
Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

## Exclusions

This release does not create DMs, platform-wide suspension, independent moderation staffing, restored appeals, automatic notifications, social algorithm fan-out, approved app-store compliance, or live customer feature access. These remain separate evidence-gated milestones.
