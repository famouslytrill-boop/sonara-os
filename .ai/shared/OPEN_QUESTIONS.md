# Open Questions

1. OWNER: Keep Google OAuth deferred for launch? It is currently cleanly disabled.
2. OWNER: Adopt the master directive's expanded standard API envelope? This is a breaking change and needs a compatibility ADR; the accepted baseline preserves the deployed shape.
3. OWNER: Is a future React/Next migration desired? ADR-0001 keeps the root Express runtime; any migration needs a parity ADR and is not scheduled.
4. OWNER + CODEX: Must every Business Builder manager/employee also hold a canonical organization membership, or should the current business-membership compatibility fallback remain? Gather live row evidence before deciding.
5. OWNER: When should the local redesign/contract branch be pushed for review and deployment verification?
6. OWNER + CODEX: Approve production application of `20260718064853_data_api_privilege_hardening.sql`, then rerun Supabase advisors and verify anonymous, member, tenant-owner, platform-admin, and service-role behavior before closing the authorization risk.
