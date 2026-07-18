# ADR-0003: Preserve the existing append-only multi-tenant database model

Status: ACCEPTED baseline (2026-07-18)

## Decision

The existing Supabase PostgreSQL model, migration ledger, organization/workspace scoping, private storage, and RLS policies remain the production baseline. Applied migrations are immutable. Future changes use new CLI-generated migrations and must pass positive and negative tenancy tests before production application.

The master directive's target entity list is a gap-analysis input, not authorization to duplicate or rename working production objects. Membership naming normalization requires a separate compatibility ADR because organization, workspace, business, and entity membership concepts currently coexist.

## Consequences

- No speculative schema rewrite or parallel source of truth.
- Billing entitlement continues to derive from persisted active/trialing subscription state.
- Service-role operations must re-establish user and organization scope in server code.
- RLS/security-advisor hardening ships as new reviewed migrations, never edits to applied SQL.
