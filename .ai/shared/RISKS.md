# Risks

1. **Secure operator access:** previously disclosed Supabase server access must be replaced outside chat before paid launch or hosted migration work. Do not place replacement values in repository files, reports, commands, or handoffs.
2. **Paid launch blocked:** email delivery proof, Stripe lifecycle proof, migrations 40–42, and owner legal, pricing, and provider approvals remain incomplete.
3. **Hosted migration sequence:** production remains last verified at 39 migrations. Migrations 40, 41, and 42 must be reviewed and applied in timestamp order; repository and preview validation are not hosted-application evidence.
4. **Index creation locks:** migration 42 uses normal PostgreSQL index creation. Review target table sizes and advisor output and use an approved maintenance window before hosted application.
5. **Index effectiveness:** the eight indexes are aligned to current runtime query shapes, but actual performance value must be confirmed after hosted application with safe query telemetry or representative plans. Remove or revise only with evidence.
6. **Membership compatibility:** `business_memberships.workspace_id` has no repository-declared foreign key to `business_workspaces`, and legacy organization lookup fallbacks remain. Do not add constraints or remove fallbacks without live inventory, cleanup, and cross-tenant tests.
7. **PWA browser proof:** the public-only PWA contract is merged and Vercel reports production success at `277c3bb6c58bfe29399265a0dae52830c02d1d99`, but install, update, and offline behavior still needs a reproducible real-browser check. Authenticated and private responses must remain outside the worker response path.
8. **Browser evidence depth:** broader current accessibility, mobile interaction, PWA, and performance proof needs a reproducible repository-owned browser harness.
9. **Physical-device boundary:** haptics consent behavior is regression-tested, but physical vibration hardware was not tested and must not be claimed.
10. **OpenAPI schema depth:** method, path, authentication, and error coverage is canonical, but several heterogeneous payloads still use generic schemas. Tighten them incrementally without changing runtime shapes.
11. **Service-worker asset coupling:** any cached asset change must synchronize the service-worker version, rendered query tokens, manifest expectations, and tests.
12. **Unrelated local work:** `debug-session.cjs` was previously recorded as untracked user work and must remain untouched and uncommitted in local operator checkouts.
