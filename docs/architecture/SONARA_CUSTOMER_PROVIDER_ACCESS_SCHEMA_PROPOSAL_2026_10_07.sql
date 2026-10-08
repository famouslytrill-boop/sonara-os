-- SONARA Industries • October 7, 2026
-- DESIGN ONLY / NOT AN APPLIED MIGRATION
--
-- Customer-owned and customer-provided provider access control plane.
-- Do not copy this file into supabase/migrations until RLS, vault custody,
-- OAuth callback handling, replay, rollback and production provider review
-- have passed exact-head release gates.
--
-- RAW ACCESS TOKENS, REFRESH TOKENS, API KEYS, PRIVATE KEYS, PASSWORDS,
-- AUTHORIZATION HEADERS AND PAYMENT CREDENTIALS MUST NEVER BE STORED HERE.

create schema if not exists sonara_control;

create table if not exists sonara_control.customer_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  business_id uuid,
  connection_owner_user_id uuid not null,
  provider_key text not null,
  external_account_id text not null,
  authority_source text not null check (authority_source in (
    'customer_oauth',
    'customer_secret_reference',
    'customer_service_account_reference',
    'provider_managed',
    'manual_export'
  )),
  auth_type text not null,
  credential_custody text not null default 'none' check (credential_custody in (
    'supabase_vault','provider_managed','deployment_secret_store','native_secure_store','none'
  )),
  credential_reference text,
  provider_origin text,
  environment text not null check (environment in ('development','sandbox','production')),
  requested_scopes jsonb not null default '[]'::jsonb,
  granted_scopes jsonb not null default '[]'::jsonb,
  declared_capabilities jsonb not null default '[]'::jsonb,
  external_account_owner_attested boolean not null default false,
  origin_owner_verified boolean not null default false,
  revoke_supported boolean not null default false,
  connection_status text not null default 'setup_required',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_scope_review_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_key, external_account_id)
);

comment on table sonara_control.customer_provider_connections is
  'Provider metadata and opaque credential references only. Never stores raw provider secret material.';

create table if not exists sonara_control.provider_oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  connection_id uuid references sonara_control.customer_provider_connections(id) on delete cascade,
  provider_key text not null,
  state_digest text not null,
  pkce_challenge text not null,
  pkce_method text not null check (pkce_method = 'S256'),
  redirect_uri text not null,
  issuer_expected text,
  requested_scopes jsonb not null default '[]'::jsonb,
  started_by_user_id uuid not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  unique (organization_id, state_digest)
);

comment on table sonara_control.provider_oauth_transactions is
  'One-time OAuth transaction evidence. Store a digest of state; never an access token, refresh token or authorization code.';

create table if not exists sonara_control.provider_action_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  connection_id uuid not null references sonara_control.customer_provider_connections(id) on delete cascade,
  requested_by_user_id uuid not null,
  capability text not null,
  action_class text not null check (action_class in (
    'read','sync','reversible_write','external_publish',
    'financial_mutation','security_admin','destructive'
  )),
  request_snapshot_hash text not null,
  required_scopes jsonb not null default '[]'::jsonb,
  approval_request_id uuid,
  idempotency_key_hash text,
  provider_account_binding_verified boolean not null default false,
  status text not null default 'pending_review',
  provider_request_id text,
  provider_receipt_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz
);

create unique index if not exists provider_action_requests_idempotency_idx
  on sonara_control.provider_action_requests
  (organization_id, connection_id, idempotency_key_hash)
  where idempotency_key_hash is not null;

create table if not exists sonara_control.provider_sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  connection_id uuid not null references sonara_control.customer_provider_connections(id) on delete cascade,
  sync_type text not null,
  checkpoint_hash text not null,
  checkpoint_metadata jsonb not null default '{}'::jsonb,
  provider_version text,
  adapter_version text,
  started_at timestamptz not null,
  completed_at timestamptz,
  reconciled_at timestamptz,
  status text not null,
  unique (organization_id, connection_id, sync_type, checkpoint_hash)
);

create table if not exists sonara_control.provider_event_inbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  connection_id uuid not null references sonara_control.customer_provider_connections(id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  signature_verified boolean not null default false,
  payload_hash text not null,
  encrypted_payload_object_reference text,
  provider_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received',
  unique (organization_id, connection_id, provider_event_id)
);

comment on column sonara_control.provider_event_inbox.encrypted_payload_object_reference is
  'Optional reference to encrypted/private evidence storage; never a public URL.';

-- Proposed RLS posture for the eventual migration:
-- 1. Enable RLS on every table.
-- 2. Organization members may read sanitized connection/action status only.
-- 3. Only owner/admin roles may create, alter, revoke or approve connections.
-- 4. credential_reference, state_digest, PKCE material and provider evidence
--    references are never directly selectable by browser roles.
-- 5. Provider workers use service-role/server identity and must still bind every
--    operation to organization_id + connection_id + external_account_id.
-- 6. OAuth callback routes consume one transaction exactly once.
-- 7. Disconnect revokes provider authority where supported and clears the
--    local credential reference while preserving audit history.
-- 8. Financial mutation remains disabled while SONARA customer-funds mode is
--    external_only. Provider dashboard handoff is not provider API authority.
-- 9. Tenant/provider secrets use an opaque Vault UUID/reference only after a
--    server-only custody broker exists. Browser roles never receive SELECT on
--    vault.decrypted_secrets and no generic Data API route resolves a secret.
-- 10. Do not create a PUBLIC-schema SECURITY DEFINER credential resolver.
--     Any privileged resolver must live outside exposed API schemas, authenticate
--     the caller/server context, bind organization_id + connection_id, and expose
--     only the minimum operation needed.
-- 11. Before this control plane can activate, remediate the currently observed
--     browser-role TRUNCATE/TRIGGER/REFERENCES privileges on
--     public.business_integration_connections. RLS is not a substitute for
--     least-privilege object grants.
-- 12. Future migration must explicitly REVOKE ALL from anon/authenticated on
--     secret-bearing private objects before granting only reviewed access paths.
