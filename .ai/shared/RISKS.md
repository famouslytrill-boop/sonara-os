# Risks

1. **Disclosed server credential:** a Supabase server secret was disclosed in chat. Codex did not use or deploy it. It must be revoked/rotated, and any provider/Vercel reference must be replaced before paid launch.
2. **Paid launch blocked:** email delivery remains unavailable until `RESEND_FROM_EMAIL` is valid; Stripe lifecycle proof and owner approvals are still pending. Unrestricted route smoke is complete.
3. **PWA drift:** two manifest files and a service worker exist, but the production renderer does not register the service worker. Do not call offline/install behavior operational; never cache authenticated/private responses while repairing it.
4. **Browser evidence depth:** the redesign is deployed and public routes pass, but broader current accessibility, PWA, mobile interaction, and performance evidence still needs a reproducible production browser run.
5. **Physical-device boundary:** haptics consent behavior is regression-tested, but physical vibration hardware was not tested and must not be claimed.
6. **Membership compatibility:** `business_memberships.workspace_id` has no repository-declared foreign key to `business_workspaces`, and legacy organization lookup fallbacks remain. Do not add constraints or remove fallbacks without live inventory, cleanup, and cross-tenant tests.
7. **OpenAPI schema depth:** method/path/auth/error coverage is canonical, but several heterogeneous success/request payloads still use generic object schemas. Tighten them incrementally without changing runtime shapes.
8. **Supabase production authorization/contract:** repository migration 40 fixes a legacy helper that could treat an owner/admin of one tenant as a platform admin; migration 41 adds the service-only 71-table/10-function contract snapshot. Production is still verified at 39 migrations. Until owner-approved ordered application and post-apply role/RLS/advisor verification, assume the legacy authorization risk remains and the canonical readiness RPC is unavailable. Leaked-password protection and vector-extension placement are separate backlog items.
9. **Service-worker cache coupling:** any cached asset change must synchronize the service-worker version, rendered `?v=` tokens, and the corresponding test assertion.
10. **Unrelated file:** `debug-session.cjs` is untracked user work and must remain untouched/uncommitted.
