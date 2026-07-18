# ADR-0004: Authentication

Status: Accepted

## Decision

Use Supabase Auth for verified authentication methods. Persist sessions, expose logout only as an explicit user action, and combine server-side role/membership/ownership checks with RLS.

## Consequences

- Unconfigured providers render setup-required, not working.
- Service-role credentials never enter client code.
- Admin UI hiding is not authorization.

