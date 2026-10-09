# SONARA Channel Reporting, Blocking and Moderation — October 9, 2026

## Implementation status

This change is a stacked draft on PR #572. Existing Growth Studio already stores anonymous growth_post_reports, shows owner report summaries, and supports removing, restoring and dismissing posts. The present wave changes source code for persistent per-member channel blocks and a single audited moderation transaction.

NOT LIVE: Two new tables and an atomic RPC are in docs/sql-proposals/2026-10-09-growth-channel-blocking-moderation.sql. They have NOT been executed, committed as a migration, or verified on production. Do not merge or deploy routes until a versioned migration, generation of the tenant registry, SQL review, grant/RLS checks and rollback are completed.

## Proposed customer behavior after validated migration

- Signed-in users can block and unblock a channel with server-derived user ID, stored in growth_channel_blocks. The request is rate-limited and same-origin.
- Account management lists saved channel blocks and can remove them.
- Blocked channels disappear from the signed-in directory and their channel page; a signed-in Atom request is refused. Unauthenticated external feed readers do not share user block preferences.
- Existing anonymous reports remain rate-limited and identity-free, only for published posts, and never cause automatic takedown.
- An owner/admin moderation action uses one Supabase RPC to re-check membership, lock the post, change the post/report status and insert an append-only decision record. Errors cannot masquerade as success.
- Owner moderation history shows recent decisions; older rows remain stored.

## Security rules and limitations

- Viewer blocks belong to one authenticated user, not the channel's organization. Server caller supplies the verified actor, not hidden browser form values.
- The Supabase service-role credential stays server-side; a restrictive tenant guard inspects exact request shapes for new tables before registry promotion.
- Proposed SQL denies anon/authenticated Data API grants and enables RLS, checks active owner/admin membership, and executes in invoker security mode.
- A channel block is personal curation, NOT a platform account ban, cross-app user-to-user block, moderation verdict or outbound contact filter.
- No independent platform-moderator role, user reporting, DM moderation, appeals workflow or child-safety escalation is created in this wave. These require additional schema, permissions, UI, tests and operating procedures.

## Release process

1. Resolve failing exact-head CI and protect main; the open PR #572 dependency must be reviewed.
2. Determine the actual production Vercel environment and Supabase project. Only an active preview Supabase project was exposed to this inspection.
3. Create a numbered migration using the Supabase CLI against an isolated project; import the reviewed SQL, regenerate the tenant-table registry and perform replay plus rollback/restore drills.
4. Execute real database authorization tests including cross-tenant role denial, revoked owner access, duplicate reports, private block visibility, and concurrent audit atomicity. Stubbed route tests are NOT database proofs.
5. Run exact-head Node 24/26, full Mocha, lint, CodeQL, Playwright, Lighthouse and deployment-chain checks. Skipped checks do not count.
6. Gate one-tenant rollout on operator approval, observability and failure recovery. No public promotion while tests and database project mapping are unverified.

## Research baseline

Google Play UGC policy requires meaningful content/user reporting, user blocking for social and 1:1 activity, clear terms and ongoing moderation:
https://support.google.com/googleplay/android-developer/answer/9876937

Apple App Review Guideline 1.2 requires filtering objectionable content, reporting and timely action, blocking abusive users and accessible contact information:
https://developer.apple.com/app-store/review/guidelines/

Next wave: account-level block graph across DMs/follows/mentions, independent abuse queues, escalations and appeals with accessibility, evidence retention and privacy review.

## October 9 subsequent hardening — no-schema deploy safety

The runtime is now **disabled by default** through the exact environment variable `SONARA_GROWTH_CHANNEL_SAFETY_ENABLED=true`. If it is missing/false, existing public channel pages, anonymous reports and tenant-scoped owner report moderation continue through the pre-existing persistence path. No request in the disabled state accesses the proposed new block or moderation-audit tables. The legacy owner moderation path is **not atomic** and does **not** create new audit events; that is why the verified SQL activation still matters.

After an **isolated versioned migration** is applied, the new flag enables account-specific saved channel blocks, bounded RPC writes, moderation audit reads and atomic owner review decisions. Only a verified operator may enable it in the approved environment; a feature flag does not itself apply database changes.

The reviewed SQL proposal now contains an account-serialized `sonara_growth_channel_block_action` with a **500-channel hard cap**, safe unblock, idempotent re-block and an explicit limit response. The application firewall permits only bounded actor-filtered block reads and refuses raw inserts/deletes. Both channel blocking and moderation mutations require a configured canonical HTTPS origin, never an inferred Host header.

The acceptance specification `docs/sql-proposals/tests/growth-channel-safety-pgtap.sql` contains 22 checks for RLS, privileges, available RPCs and denial for invalid actors. It is intentionally kept **outside** the `supabase/tests` auto-discovery tree because the proposal has not been applied. After migration on isolated Postgres, move it into the test database tree, run `supabase test db`, and supplement with concurrent writers to prove the 500-account cap. **No pgTAP execution or migration replay has occurred yet.**

The current isolated JavaScript checks cover the active and default-off paths, moderator identity restrictions, host-spoofed origins, block quota error cases, and report/takedown fallback, but cannot prove real PostgreSQL semantics or that GitHub Actions has passed.
