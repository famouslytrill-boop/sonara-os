# Risks

1. **Integrated but undeployed:** the Clark redesign, API contract, and preference repair are local on `codex/integrate-clark-redesign`; they are not production evidence until pushed, reviewed, merged, deployed, and verified by exact SHA.
2. **Paid launch blocked:** email delivery remains unavailable until `RESEND_FROM_EMAIL` is valid; Stripe lifecycle proof, unrestricted live smoke, and owner approvals are still pending.
3. **PWA drift:** two manifest files and a service worker exist, but the production renderer does not register the service worker. Do not call offline/install behavior operational; never cache authenticated/private responses while repairing it.
4. **Stale broad frontend evidence:** older screenshots, accessibility, PWA, and performance reports predate the redesign. The preference repair has current focused evidence, but broader claims still need refreshed reproducible checks.
5. **Physical-device boundary:** haptics consent behavior is regression-tested, but physical vibration hardware was not tested and must not be claimed.
6. **Membership compatibility:** `business_memberships.workspace_id` has no repository-declared foreign key to `business_workspaces`, and legacy organization lookup fallbacks remain. Do not add constraints or remove fallbacks without live inventory, cleanup, and cross-tenant tests.
7. **OpenAPI schema depth:** method/path/auth/error coverage is canonical, but several heterogeneous success/request payloads still use generic object schemas. Tighten them incrementally without changing runtime shapes.
8. **Supabase production authorization:** repository migration 40 fixes a legacy helper that could treat an owner/admin of one tenant as a platform admin, but production is still verified at 39 migrations. Until owner-approved application and post-apply role/advisor verification, assume the legacy production risk remains. Leaked-password protection and vector-extension placement are separate backlog items.
9. **Service-worker cache coupling:** any cached asset change must synchronize the service-worker version, rendered `?v=` tokens, and the corresponding test assertion.
10. **Unrelated file:** `debug-session.cjs` is untracked user work and must remain untouched/uncommitted.
