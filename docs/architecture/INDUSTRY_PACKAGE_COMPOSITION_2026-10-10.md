# SONARA One — shared industry package composition (2026-10-10)

**Status: development blueprint only; not an activated customer capability.**

`lib/sonara-industry-package-blueprints.cjs` composes existing SONARA workflow planners into three read-only industry packages. It does not register routes, create invoices or bookings, render/export media, send messages, grant licenses, move money, publish social content, or activate integrations. Supplied identifiers and payment/provider/rights references are **untrusted claims** pending independent server verification. Even when every reference is supplied, `canExecute`, `canActivate`, `canPublish` and `canDeliverPaidAssets` remain false. Existing site-offline instruction remains in force.

## Package contracts

| Key | Product | Reused engine | Planned customer journey |
| --- | --- | --- | --- |
| `creator_production` | Creator Studio | `planMediaWorkflow` | User-owned multitrack WAV/MIDI handoff, worker render, verified rights/license terms, private digital delivery after signed paid-state proof |
| `social_business` | Growth Studio | `validateWorkflow` | Moderated community with reporting/blocking, proven analytics, approval-controlled provider publishing |
| `independent_professional` | Business Builder | `validateWorkflow` | Client intake, reviewed quotes/documents, conflict-safe appointments, approval-controlled client contact |

**Reuse instead of duplicating:** membership and `organization_entitlements` for access, `creator_assets` and `creator_releases` for creator work, existing merchant product/payment/entitlement ledger for commerce, `organization_integrations` for connections, `business_appointments` and `contact_records` for services. Listed table names do not prove customer transaction flows work.

## Next engineering sequence

1. **P0 governance and test:** keep public site offline; resolve mandatory exact-head CI, migration replay and security separately. Review isolated PR; verify RLS on authenticated organizations, no forged entitlement, no absent license/consent/approval, no authoritative readiness from client data.
2. **P1 Creator:** preserve immutable source SHA-256, channel/track manifests, origin/timebase, sample rate and rights metadata. Run expensive render/transcode work on budgeted, sandboxed workers with idempotency, retries, cancellation and provenance. Deliver only through provider-confirmed payment, rights-checked license grant and tenant-authorized short-lived storage URL; support refund/revocation. Native .als/.flp/.ptx compatibility is **not** claimed. OTIO exchanges editorial data, not embedded media.
3. **P1 Social:** prove effective user/content reporting, blocking, moderator operations and appeals before public feeds. Use tenant-bound least-privilege provider OAuth, real approval, moderation receipt, bounded retries and provider reconciliation. Do not promise TikTok public posting without app audit/permission.
4. **P1 Professional:** reuse existing availability service and canonical client/quote/payment records. Add resource capacity, buffers, provider free/busy reconciliation and atomic booking confirmation to prevent races. Quotes must use verified service/pricing/terms. Require consent and owner approval before client contact.
5. **P2 quality and launch:** test two organizations per pack, cross-tenant denials, forged provider receipts, out-of-order webhooks, refund/revocation, media-worker outage, social abuse/appeal, concurrent double booking, mobile/keyboard/reflow, provider sandbox canaries and p95/p99 capacity costs. Do not publish or deploy without separate release authorization.

## Engineering checks

`node --check lib/sonara-industry-package-blueprints.cjs` and `pnpm exec mocha tests/industry-package-blueprints.test.js`, followed by frozen install, audit, typecheck, lint, full tests, build, required migration/tenant/agent-sync gates and exact-commit GitHub CI. Tests explicitly assert that even complete caller-provided evidence can never authorize actions.

## Research and standards

- Internal rules: `AGENTS.md`, `.claude/skills/creator-daw-interoperability/SKILL.md`, `docs/business-builder/BUSINESS_TEMPLATE_SYSTEM.md`, `lib/sonara-market-expansion-schema-plan.cjs`.
- Ableton synchronized stem handoff: https://help.ableton.com/hc/en-us/articles/360000843404-Importing-and-exporting-stems
- OpenTimelineIO editorial interchange: https://opentimelineio.readthedocs.io/en/latest/
- TikTok posting scope/audit: https://developers.tiktok.com/docs/en/content-posting-api-get-started
- Instagram professional-account API permissions: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- Google Play UGC moderation/reporting/blocking: https://support.google.com/googleplay/android-developer/answer/9876937
- Apple App Review UGC requirements: https://developer.apple.com/app-store/review/guidelines/
- Google Calendar free/busy API: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
