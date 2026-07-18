# Security Contract — owner: Codex (Agent A). STATUS: initial, from verified audit.

- Secrets server-side only; /api/readiness exposes names+statuses only (tested).
- Admin routes: server-side verifyAdminRequest; fail closed (503 setup_required)
  without env; never client-side gating.
- Webhooks: signature verify on raw body; timing-safe compare.
- RLS posture verified 2026-07-16 (see DATABASE_CONTRACT).
- Known non-blocking hardening backlog (Supabase advisors): leaked-password
  protection off; two functions with mutable search_path; SECURITY DEFINER
  helpers callable via RPC (return caller-scoped booleans); vector ext in public.
- client-secret scan is a required gate (scripts/client-secret-scan.cjs).
