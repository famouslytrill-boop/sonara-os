# SONARA public trust, support, security and communications control plane

Date: 2026-10-08
Status: review-ready engineering change; not a live deployment, security certification or legal approval
Scope: SONARA Industries, Business Builder™, Creator Studio™, Growth Studio™

## What this change implements

- The existing public `/help` route gains eight accessible, native HTML FAQ answers, with direct routes to real support, tutorials, account security, billing and policy destinations. No parallel FAQ database or speculative chatbot is introduced.
- Both public submissions, `POST /contact` and `POST /support/request`, share the existing server-side `createRateLimiter` service with hashed IP and submitted-email scopes. Default is 60 attempts per 60 minutes for each scope, enforced by the atomic Supabase rate-limit RPC when configured.
- The existing rate-limit service provides a bounded, *non-distributed* fallback when the durable RPC is unavailable and emits a redacted degradation event. This is partial resilience, **not** proof of protection against distributed attacks in fallback mode.
- Both support request paths emit one structured `support.request_submission` event with status, outcome and static source route; records keep the actual source route. No name, address, message text, token or email body is logged by this new event.
- The public form now labels its request-type select, gives a plain-language sensitive-data warning, exposes a 4000-character cap, and adds a supplementary hidden honeypot. The honeypot alone is not an anti-bot security boundary.
- Invalid form submissions preserve the fields the user typed, escaped as HTML; the password fields elsewhere must never be reflected.
- No tables, RLS policies, secret values, production environments, billing data or consent records are changed by this branch.

## System of record and route map

| Capability | Existing authority | Required consumer contract |
| --- | --- | --- |
| Public About | `GET /about` | Mission, accurate product description, no unverifiable production/security claims |
| Help and FAQ | `GET /help` and `lib/sonara-public-faq.cjs` | Accessible disclosure, linked destinations, status-aware language |
| Instructions | `/tutorials` and four tutorials | Task steps, preconditions, actual end points, known limitations |
| Contact intake | `POST /contact`, `POST /support/request`, `support_requests` | Shared abuse budget, input validation, actual source route, save/email and truthful outcome |
| Account controls | `/account/security`, auth routes | Server authorization and session checks; no public role grants |
| Public security notice | `/security` | High-level posture without guarantees or vendor-secret details |
| Legal notices | `/terms`, `/privacy`, `/refund-policy`, `/acceptable-use`, `/cookies`, `/accessibility` | Correct policy owner, current version/effective date, counsel approval |
| Operations evidence | `lib/sonara-structured-log.cjs`, Supabase admin logs | Consistent correlation/outcome, protected retention, alert routing |

## Threat-driven engineering priorities

1. **Authorization (P0):** Every private GET and mutation must check the signed-in actor, current organization membership, requested action, object owner and selected fields **on a trusted server layer**, then enforce tenant-aware database predicates and RLS where applicable. A service-role credential bypasses RLS, so application query filters become critical, not optional. Test user A trying user B's record, ownership changes, stale sessions and role downgrades.
2. **Support abuse (P0):** Keep contact, feedback, booking, account recovery, lead capture and email dispatch behind bounded distributed budgets. Count requests *before* provider calls, and alert if database rate limiting degrades. Honeypots are supplementary. Integrate edge WAF/CAPTCHA only where justified and accessible.
3. **Security evidence (P0):** The existing structured event schema is authoritative. Add deny/allow records for high-risk actions, redacted email-delivery events, legal acceptance transitions, exports/deletions and admin privilege changes. Avoid raw URLs, cookies, tokens, credentials, customer messages, billing instruments and uncontrolled identifiers.
4. **Consent and versioning (P0):** Show the exact legal document version and effective date at acceptance. Store actor, tenant if applicable, purpose, hash/version, timestamp, channel and evidence; revocation must propagate to marketing delivery. Legal approval is required before activating revised terms.
5. **Email authenticity (P0):** Validate the verified sender domain, SPF and DKIM records, DMARC alignment, TLS, delivery/bounce/suppression receipts and recipient inbox arrival. A provider 2xx is acceptance, not inbox delivery. Keep Supabase Auth email settings independent of generic Resend support notifications.
6. **Incident response (P0):** Record incident category, severity, affected systems, timeline, owner, evidence locations and customer-notice/legal decision. Use immutable/restricted logs and approved retention. Do not announce a breach based solely on an unverified detector event.
7. **Accessible help (P1):** Target WCAG 2.2 AA; test keyboard navigation, text resize/reflow, focus, screen readers, native HTML details, error identification, plain-language retry instructions and mobile touch targets.
8. **Support operations (P1):** Route general, billing, privacy, security, incident, abuse and accessibility requests to appropriate restricted queues. Track response state and escalation; never publish a response-time promise without an operational schedule.

## Email delivery state machine (proposed for wider integration)

`validated -> authorized -> queued -> provider_accepted -> delivered | bounced | complained | expired`

Separate outcomes `not_sent`, `failed_before_provider` and `provider_status_unknown`; never retry uncertain sends blindly without idempotency and receipt reconciliation. Use a durable outbox keyed to tenant, purpose, template/version, destination hash and idempotency key, with provider-message mapping and suppression checking.

Marketing email is separate from security, billing and requested support messages. Apply consent/purpose checks, unsubscribe/suppression requirements, sender authentication and applicable laws. Bulk Gmail senders have additional one-click unsubscribe rules. Do not place unsubscribe links in password reset or other security-critical messages indiscriminately.

## Operational monitoring and records (proposed)

| Signal | Initial investigation trigger (example, tune to traffic) | Action |
| --- | --- | --- |
| `rate_limit.degraded` | Any production occurrence | Check RPC/database, bounded fallback and origin traffic |
| `support.request_submission` failure | >5% over 15 min with sufficient volume | Inspect persistence and email provider separately |
| Cross-tenant authorization deny surge | >10 denials/5 min per actor or route | Triage as possible BOLA, avoid automatic destructive account locks |
| Support provider bounce/complaint | Nonzero abnormal increase | Stop the affected campaign/type and review suppressions |
| Consent mismatch or unaudited admin write | Any verified occurrence | Halt affected sensitive pathway and investigate |

These are **proposed thresholds, not verified SLOs or existing alerts**. Never alert on raw email addresses. Keep audit writes least-privilege and make audit read access itself auditable. Log retention and customer privacy rights require a jurisdiction/data-class matrix before a fixed retention period is set.

## Customer-facing information architecture

- Header/footer: About, Products, Pricing, Help, Tutorials, Contact, Security, Privacy, Terms.
- `/help`: FAQ, account recovery, first-use instructions, links to named policies and a working contact method.
- `/contact`: clearly labeled category/name/email/subject/message/consent; sensitive-data warning; truthful stored/sent/failed state.
- Each studio: entry tutorial, task-specific guidance, permissions and entitlement explanation, recovery path, no broken links.
- Legal pages: owner, version, effective date, scope, policy history and human review status; only publish operational/legal claims with supporting evidence.

## Release acceptance gates

1. Run targeted `pnpm test -- --grep "public trust, help and support"`, plus the existing rate-limiter, support, security and marketing-page suites. Run `pnpm run verify:launch` on the final exact head; no bypass for already-open CI failures.
2. Test 429 responses across the shared budget for both `POST /contact` and `POST /support/request` with durable Supabase RPC available; then force RPC failure and confirm bounded fallback plus `rate_limit.degraded`. Observe that no storage or email call happens after a denied request.
3. Test malformed/oversized requests, malicious HTML, filled honeypot, absent consent, provider 5xx, support DB failure, concurrent requests and recovery.
4. Prove three cross-tenant roles cannot access each other's records, including exports, admin/support queues and service-role-backed queries.
5. Audit form contrast, keyboard focus, error announcements, screen-reader summary behavior, mobile reflow and the full legal/support nav.
6. Record actual sender-domain DNS, provider delivery receipts, email unsubscribe/suppression tests, incident contacts and signed legal review. Never embed credentials in screenshots or PR logs.
7. Require protected-branch checks, human code review and controlled, exact-SHA deployment. Production remains unchanged until an independent approved release.

## Primary standards and source references

- OWASP ASVS 5.0 authorization: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md
- OWASP ASVS 5.0 security logging: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md
- OWASP logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP API1 broken object authorization: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Gmail sender rules: https://support.google.com/mail/answer/81126
- SONARA governance: `docs/legal/2026-09-23-LEGAL-TERMS-TRADEMARK-GOVERNANCE.md`

## Cross-application enforcement extension (2026-10-08)

The parent and all three studios render public/operational HTML through `lib/sonara-page-frame.cjs` (except intentionally self-rendered special surfaces such as LeadForge). Shared navigation now comes from `lib/sonara-trust-navigation.cjs` instead of hand-copying links into each studio. Tests cover parent/studio public pages, tutorial pages, canonical legal footer links, and a shared contact form used at `/contact` and `/support`.

All public submissions from the two documented support forms go through the same server-side input gate and hashed-IP/hashed-email rate limiter; overlong or non-string fields, control characters in subjects, missing consent, and filled honeypots are rejected before persistence or email. These controls do not, by themselves, establish tenant isolation for the rest of the application or full email deliverability.

### Release blockers outside this scoped change

- Re-run full route × actor × organization authorization adversarial tests for authenticated customer, owner, support and provider roles. A footer link is not authorization.
- Inspect one-off standalone-rendered public surfaces, mobile wrappers and offline UI separately; they do not automatically inherit the shared HTML shell.
- Verify runtime effective database grants as well as RLS. Supabase announced that public-schema tables will no longer be automatically exposed via the Data API for existing projects on **October 30, 2026**. Existing explicit grants may need review; do not grant blanket access to compensate for permission errors. Source: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Verify real Resend sender DNS, Supabase Auth SMTP, support delivery receipts, and email suppression/complaint routing. No production secrets or customer messages are involved in this patch.
- Determine whether any public legal text, pricing, cancellation or privacy representation needs counsel approval; no legal notices or acceptance records were changed here.
- Keep all work in a draft pull request until the final commit's exact-head CI is green and production is separately authorized.

## P0 live-database finding and proposed correction (2026-10-08)

Read-only Supabase catalog and RLS queries on the connected project confirmed the following for `public.support_requests` and `public.feedback_reports`:

- RLS is enabled and there are policies permitting anonymous `INSERT` when a few text fields are non-null. This leaves a direct Data API route that **bypasses** the Express form validators, request throttling and sensitive-data warning.
- Both `anon` and `authenticated` have broad table-level privileges including `INSERT`, `SELECT`, `UPDATE`, `DELETE` and `TRUNCATE` from historical grants. RLS restricts row-level actions, so the grants alone do not prove any private reads occurred.
- The trusted server's `service_role` retains write privileges and is the insertion authority for the current `/contact` and `/support/request` Express routes.
- Default-branch source search found the support table server-side and no direct feedback-table client call; dynamic/mobile/external clients must still be inventoried before an ACL change.

**Action:** `docs/security/PROPOSED_SUPPORT_BROWSER_GRANTS_2026-10-08.sql` is a *non-applied* SQL review artifact. It narrows browser grants while preserving authenticated SELECT and trusted service-role writes. After staging proof and approval, generate an official named Supabase migration using the repository's CLI, replay all migrations, test 42501 denial for direct browser inserts and validate both existing support forms. Do not apply production grants from this draft PR or blanket-grant `public` tables.

### Counter unavailability is fail-closed for production support submissions

The existing `createRateLimiter` now supports an opt-in `requireDurable` guard. The SONARA support/contact POST routes enable this in production; when Postgres RPC is unreachable, misconfigured or degraded to an instance-local budget, the public write fails HTTP 503 **before saving or sending**. It exposes no credentials or submitted content. Local development/tests can retain the bounded in-memory fallback. This is a conscious availability trade-off: it prevents provider-billed email abuse via unmetered serverless instances. The provider can still be unavailable independently, and provider acceptance still does not prove inbox delivery.

### Latest read-only security advisor inventory

The live advisor reported 66 INFO findings for RLS tables with no policies, 8 WARN findings for authenticated-executable privileged functions, 1 WARN for `vector` in `public`, and 1 WARN for disabled leaked-password protection. No automatic correction was applied. A server-only RLS-closed table is not made safer by granting it an arbitrary browser policy; classify exact intended grants and test each helper's dependencies before revoking or relocating anything.

Official sources:
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md
