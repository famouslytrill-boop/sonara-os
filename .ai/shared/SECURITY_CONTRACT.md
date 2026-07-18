# Security Contract - owner: Codex (Agent A). STATUS: accepted repository baseline; production migration pending.

- Secrets stay server-side. `/api/readiness` exposes names and statuses only; this is regression-tested.
- Admin routes use server-side `verifyAdminRequest`, fail closed with `503 setup_required` without required environment configuration, and never rely only on client-side hiding.
- Stripe webhooks verify signatures against the raw body with a timing-safe comparison.
- RLS posture was last verified against production on 2026-07-16; see `DATABASE_CONTRACT.md`.
- Repository remediation `20260718064853_data_api_privilege_hardening.sql` locks authorization-function search paths, removes anonymous helper RPC access, and fixes legacy cross-tenant global-admin derivation. It is not production evidence until migration 40 is applied and advisor/role checks are rerun.
- Remaining provider/advisor backlog: leaked-password protection and public vector-extension placement require separate owner-reviewed remediation.
- The client-secret scan in `scripts/client-secret-scan.cjs` is a required launch gate.
