# Security Contract - owner: Codex (Agent A). STATUS: accepted repository and production baseline.

- Secrets stay server-side. `/api/readiness` exposes names and statuses only; this is regression-tested.
- Admin routes use server-side `verifyAdminRequest`, fail closed with `503 setup_required` without required environment configuration, and never rely only on client-side hiding.
- Stripe webhooks verify signatures against the raw body with a timing-safe comparison.
- Production Supabase confirms 42/42 repository migrations applied, including `20260718064853_data_api_privilege_hardening.sql`, `20260718071148_connect_database_contract.sql`, and `20260718193000_operational_query_index_contract.sql`; linked schema lint passed on 2026-07-18.
- Migration 40 locks authorization-function search paths, removes anonymous helper RPC access, and fixes legacy cross-tenant global-admin derivation. Migration 41 installs the service-only database readiness contract. Migration 42 reconciles billing compatibility and installs the reviewed operational indexes without disabling RLS or granting new public access.
- Organization and workspace authorization remains server-resolved and RLS-backed. Service-role use is server-only and must explicitly preserve authenticated user and organization scope.
- Paid access remains fail-closed on persisted active/trialing billing state or documented owner/admin authorization. Checkout redirects never grant access.
- Remaining provider/advisor backlog: leaked-password protection and public vector-extension placement require separate owner-reviewed remediation.
- Previously disclosed Supabase server access must be replaced outside chat through approved private configuration surfaces before public paid launch.
- The client-secret scan in `scripts/client-secret-scan.cjs` is a required launch gate.
