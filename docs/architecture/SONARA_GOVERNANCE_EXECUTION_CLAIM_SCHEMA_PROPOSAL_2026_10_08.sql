-- SONARA Industries • governed execution claim/settlement proposal
-- DESIGN ONLY / NOT AN APPLIED MIGRATION.
-- This proposal closes the gap between "preflight looked valid" and an actual
-- side effect. It MUST NOT be added to the migration glob until canonical
-- organization membership, existing approval/action tables, atomic budget RPCs,
-- and rollback/recovery semantics are reconciled.
--
-- Core invariant:
-- preflight -> atomic claim + exact snapshot + approval recheck + budget consume
-- -> adapter execution -> independently evidenced settlement -> audit/outbox.
--
-- No bank/card credentials, provider secrets, raw review bodies or sensitive
-- customer file payloads belong in these tables.

CREATE SCHEMA IF NOT EXISTS sonara_governed_execution;
REVOKE ALL ON SCHEMA sonara_governed_execution FROM PUBLIC;
REVOKE ALL ON SCHEMA sonara_governed_execution FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS sonara_governed_execution.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  request_id uuid NOT NULL,
  proposal_snapshot_sha256 char(64) NOT NULL
    CHECK (proposal_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 160),
  risk_class text NOT NULL CHECK (risk_class IN (
    'routine_private','external_publish','customer_campaign','financial_change',
    'security_change','legal_commitment','destructive_change')),
  action_type text NOT NULL CHECK (length(action_type) BETWEEN 1 AND 120),
  executor_key text NOT NULL CHECK (length(executor_key) BETWEEN 3 AND 80),
  state text NOT NULL DEFAULT 'claimed' CHECK (state IN (
    'claimed','executing','settled_success','settled_failure','released','expired')),
  resource_cost_units integer NOT NULL CHECK (resource_cost_units > 0),
  approval_evidence_ref text,
  proof_packet_ref text,
  claimed_by uuid NOT NULL,
  claimed_at timestamptz NOT NULL,
  claim_expires_at timestamptz NOT NULL,
  executing_at timestamptz,
  settled_at timestamptz,
  provider_result_ref text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  CHECK (claim_expires_at > claimed_at),
  CHECK (
    state NOT IN ('settled_success','settled_failure') OR settled_at IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS sonara_execution_claim_request
  ON sonara_governed_execution.claims (organization_id,request_id);
CREATE INDEX IF NOT EXISTS sonara_execution_claim_state
  ON sonara_governed_execution.claims (organization_id,state,claim_expires_at);

CREATE TABLE IF NOT EXISTS sonara_governed_execution.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no BETWEEN 1 AND 20),
  executor_key text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  outcome text NOT NULL CHECK (outcome IN (
    'started','provider_rejected','provider_timeout','provider_unknown',
    'verified_success','verified_failure')),
  provider_result_ref text,
  provider_result_verified boolean NOT NULL DEFAULT false,
  side_effect_observed boolean NOT NULL DEFAULT false,
  safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,claim_id,attempt_no),
  FOREIGN KEY (organization_id,claim_id)
    REFERENCES sonara_governed_execution.claims(organization_id,id),
  CHECK (
    outcome <> 'verified_success' OR
    (provider_result_ref IS NOT NULL AND provider_result_verified = true
     AND side_effect_observed = true)
  )
);

-- One claim can consume multiple scopes: organization, user, provider,
-- automation, or a dedicated expensive-work budget. The future claim RPC must
-- insert/consume these in the SAME transaction that creates the unique claim.
CREATE TABLE IF NOT EXISTS sonara_governed_execution.resource_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  budget_scope text NOT NULL CHECK (budget_scope IN (
    'organization','user','automation','provider','concurrency')),
  budget_subject_hash text NOT NULL,
  operation_key text NOT NULL,
  consumed_units integer NOT NULL CHECK (consumed_units > 0),
  consumed_at timestamptz NOT NULL,
  released_units integer NOT NULL DEFAULT 0 CHECK (released_units >= 0),
  released_at timestamptz,
  UNIQUE (organization_id,claim_id,budget_scope,budget_subject_hash,operation_key),
  FOREIGN KEY (organization_id,claim_id)
    REFERENCES sonara_governed_execution.claims(organization_id,id),
  CHECK (released_units <= consumed_units)
);

-- Transactional outbox: settlement records the durable event before delivery.
-- Delivery can retry, but the same claim/outbox item is never a second side
-- effect. Payload is a safe reference/summary, not secrets or customer content.
CREATE TABLE IF NOT EXISTS sonara_governed_execution.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  event_key text NOT NULL,
  safe_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN (
    'pending','delivering','delivered','dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 50),
  available_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,claim_id,event_key),
  FOREIGN KEY (organization_id,claim_id)
    REFERENCES sonara_governed_execution.claims(organization_id,id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['claims','attempts','resource_consumptions','outbox']
  LOOP
    EXECUTE format('ALTER TABLE sonara_governed_execution.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format(
      'REVOKE ALL ON sonara_governed_execution.%I FROM anon, authenticated',t
    );
  END LOOP;
END;
$$;

-- REQUIRED FUTURE RPCS / TRANSACTION BOUNDARIES:
-- claim_governed_execution(...)
--   1. validate canonical organization + actor membership/role;
--   2. SELECT/FOR UPDATE approval request + exact snapshot;
--   3. reject expired/revoked/changed approval;
--   4. atomically consume token/day/concurrency budgets;
--   5. INSERT claims with UNIQUE(org,idempotency_key);
--   6. return existing recorded claim on duplicate idempotency key.
--
-- begin_governed_execution(...)
--   conditional transition claimed -> executing with same snapshot/tenant.
--
-- settle_governed_execution(...)
--   1. require verified provider result for success;
--   2. append attempts row;
--   3. transition executing -> settled_* exactly once;
--   4. release concurrency;
--   5. insert outbox event in same transaction.
--
-- expire_governed_claims(...)
--   releases unused concurrency/resource reservations and never infers that a
--   provider side effect failed merely because local settlement is absent.
--
-- SECURITY / RELEASE REQUIREMENTS:
-- * do not store Stripe/provider secret keys, bank numbers, card data, tokens;
-- * tenant filters at every service-role call site even with RLS enabled;
-- * unique idempotency key is scoped to organization and immutable snapshot;
-- * retry external adapters with SAME provider/idempotency identity;
-- * a provider timeout is UNKNOWN until provider reconciliation proves outcome;
-- * no "success" settlement from caller-provided booleans alone;
-- * adversarial concurrency test: 50 simultaneous claims -> exactly one winner;
-- * rollback/restore test and outbox duplicate-delivery test;
-- * review existing agent_pending_actions/entity_action_approvals before adding
--   new canonical tables; prefer extension/reference over duplicate truth.
