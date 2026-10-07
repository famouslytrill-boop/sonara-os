# SONARA Provider Access Security Review — 2026-10-07

Status: repository hardening + read-only active-project inspection. No live DDL or provider credential mutation performed.

## Verified current state

Read-only inspection of the connected Supabase project established:

- Supabase Vault extension `supabase_vault` version **0.3.1** is installed.
- Direct `pgsodium` is not installed.
- `vault.secrets` currently has **0 rows**.
- `vault.create_secret` and `vault.update_secret` are executable by `postgres` and `service_role`.
- `vault.decrypted_secrets` is readable by `service_role` and is therefore a plaintext-secret boundary.
- `public.business_integration_connections` has RLS enabled and zero current rows.
- Browser roles `anon` and `authenticated` currently hold legacy `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges on `public.business_integration_connections`.
- Supabase security advisor currently reports 64 RLS-enabled public tables with no policy, 8 authenticated-callable `SECURITY DEFINER` functions, `vector` in the public schema, and leaked-password protection disabled.

The RLS-with-no-policy count is **not automatically 64 vulnerabilities**. Service-only tables can intentionally use RLS default-deny with no browser policy. Each finding must be classified against its intended access contract.

## Critical provider-table privilege finding

PostgreSQL RLS governs normal row SELECT/INSERT/UPDATE/DELETE behavior. Whole-table operations such as `TRUNCATE` and `REFERENCES` are outside RLS. There is no SONARA product requirement for browser roles to hold `TRUNCATE`, `TRIGGER`, or `REFERENCES` on the provider-connection table.

## Required remediation workflow

Do not edit an already-applied historical migration.

When an authorized environment with the Supabase CLI is available, generate the migration through the supported workflow:

```bash
supabase migration new revoke_browser_provider_connection_privileges
```

The generated migration should be reviewed to contain the equivalent of:

```sql
revoke truncate, trigger, references
on table public.business_integration_connections
from anon, authenticated;
```

Before applying it, verify whether any additional browser privileges are intentional. Do not blindly revoke application-required SELECT/INSERT/UPDATE/DELETE without checking the route/RLS contract.

The migration should include self-verifying assertions using `pg_catalog.has_table_privilege` or `information_schema.role_table_grants` so replay fails if either browser role still has `TRUNCATE`, `TRIGGER`, or `REFERENCES`.

Apply first to an isolated Supabase development/preview branch, then:

1. replay all migrations from empty state;
2. run the database security advisor;
3. verify Business Builder Connected Tools CRUD;
4. verify tenant isolation with two organizations;
5. verify browser roles cannot truncate or install triggers;
6. verify service-role application operations still work;
7. verify OAuth/API/webhook connections remain fail-closed without server provider evidence;
8. verify rollback/recovery;
9. only then authorize production migration.

## Vault design

Supabase documents Vault as authenticated encrypted storage on disk. Plaintext is materialized through `vault.decrypted_secrets` at query time, so access to that view is equivalent to credential access.

```text
raw customer credential
  -> TLS
  -> dedicated server-only intake
  -> vault.create_secret(...)
  -> Vault secret UUID
  -> opaque credential_reference
  -> raw credential removed from request/log context
```

Resolution:

```text
provider job
  -> tenant + connection + capability validation
  -> server-only Vault resolver
  -> resolve one secret by exact UUID
  -> provider request to verified origin
  -> discard plaintext
  -> retain sanitized provider receipt
```

Never expose `vault.decrypted_secrets` through a browser role, create a generic customer RPC that reads secrets by UUID, put raw credentials into ordinary JSON settings, reuse the TOTP key for provider credentials, place secrets in logs/analytics/spreadsheets/URLs/AI prompts, or design new direct `pgsodium` storage when Vault already supplies the supported interface.

## SECURITY DEFINER review

Before provider credential resolution is activated, classify the eight authenticated-callable `SECURITY DEFINER` functions reported by the advisor. For each function record its business purpose, necessity for definer rights, callable roles, search path, tenant validation, write effects, secret access, expected caller, tests, and a keep/invoker/revoke/private decision.

A provider-secret resolver must **not** be added to the exposed `public` RPC surface merely because SECURITY DEFINER makes access convenient.

## Customer-owned provider rollout gates

Read-only providers require verified origin/account binding, least-privilege scopes, opaque credential reference, revocation, deterministic pagination/checkpoints, retries/backoff, rate-limit handling, sanitized telemetry, and disconnect evidence.

Write-capable providers additionally require a declared write capability, customer approval, idempotency, durable job/outbox state, provider receipt, reconciliation, duplicate-side-effect protection, account re-verification, and dead-letter handling.

Financial providers additionally require money-path classification, provider/customer merchant-of-record and liability review, no SONARA custody by default, stronger approval/step-up, amount/currency/payee binding, refund/dispute semantics, independent reconciliation evidence, and qualified legal/accounting/provider review.

## Current decision

```text
customer owns provider
+ provider owns provider authentication
+ Vault protects tenant secrets
+ SONARA stores references and workflow evidence
+ deterministic policy controls authority
+ customer approves consequential writes
+ provider executes provider-side effects
```

This minimizes regulatory, security, and operational surface while giving customers direct paths to tools they already use.

## Primary references

- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Supabase pgsodium deprecation: https://supabase.com/docs/guides/database/extensions/pgsodium
- Supabase database linter: https://supabase.com/docs/guides/database/database-linter
- PostgreSQL row security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL TRUNCATE: https://www.postgresql.org/docs/current/sql-truncate.html
- OAuth 2.0 Security BCP: https://www.rfc-editor.org/rfc/rfc9700.html
