# ADR-0003: Database Model

Status: Accepted

## Decision

Supabase Postgres and append-only SQL migrations remain the source of truth. Multi-tenant records use organization/workspace scope, RLS, server authorization, indexes, auditability, and idempotent changes.

## Consequences

- No arbitrary physical database per customer.
- No destructive reset or duplicate table based only on desired naming.
- Naming compatibility issues require an explicit migration decision.

