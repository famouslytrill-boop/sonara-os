# Risks

1. **Credential rotation:** a previously disclosed Supabase server credential must be rotated outside chat before paid launch. Do not place its replacement in repository files, reports, commands, or handoffs.
2. **Paid launch blocked:** email delivery proof, Stripe lifecycle proof, migrations 40/41, and owner legal/pricing/provider approvals remain incomplete.
3. **PWA browser proof:** the public-only PWA contract is merged and Vercel reports production success at `277c3bb6c58bfe29399265a0dae52830c02d1d99`, but install/update/offline behavior still needs a reproducible real-browser check. Authenticated/private responses must remain outside the worker response path.
4. **Browser evidence depth:** broader current accessibility, mobile interaction, PWA, and performance proof needs a reproducible repository-owned browser harness.
5. **Physical-device boundary:** haptics consent behavior is regression-tested, but physical vibration hardware was not tested and must not be claimed.
6. **Membership compatibility:** `business_memberships.workspace_id` has no repository-declared foreign key to `business_workspaces`, and legacy organization lookup fallbacks remain. Do not add constraints or remove fallbacks without live inventory, cleanup, and cross-tenant tests.
7. **OpenAPI schema depth:** method/path/auth/error coverage is canonical, but several heterogeneous payloads still use generic schemas. Tighten them incrementally without changing runtime shapes.
8. **Supabase production authorization/contract:** repository migrations 40 and 41 are verified locally but production remains last verified at 39 migrations. Until approved ordered application and post-apply checks, the legacy authorization risk and missing canonical readiness RPC remain open.
9. **Service-worker asset coupling:** any cached asset change must synchronize the service-worker version, rendered query tokens, manifest expectations, and tests.
10. **Unrelated local work:** `debug-session.cjs` was previously recorded as untracked user work and must remain untouched/uncommitted in local operator checkouts.
