-- SONARA Industries • customer governance / proof / automation control plane
-- DESIGN ONLY / NOT AN APPLIED MIGRATION.
-- Do not execute in production. Canonical organization memberships, user roles,
-- route ownership, RLS helpers, retention rules, provider evidence, legal rules,
-- and atomic rate-limit/approval procedures MUST be mapped first.
--
-- This schema never authorizes payment, refund, payout, legal execution,
-- tenant rejection, public review publication, destructive data changes or
-- security changes by itself.

CREATE SCHEMA IF NOT EXISTS sonara_governance;
REVOKE ALL ON SCHEMA sonara_governance FROM PUBLIC;
REVOKE ALL ON SCHEMA sonara_governance FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS sonara_governance.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  board_kind text NOT NULL CHECK (board_kind IN
    ('owner_review','finance','security','legal_policy','customer_reviews','operations')),
  solo_owner_mode boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  board_role text NOT NULL CHECK (board_role IN ('owner','admin','business_owner','reviewer','observer')),
  may_approve boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,board_id,user_id),
  FOREIGN KEY (organization_id,board_id)
    REFERENCES sonara_governance.boards(organization_id,id),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS sonara_governance.approval_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  board_id uuid,
  risk_class text NOT NULL CHECK (risk_class IN
    ('routine_private','external_publish','customer_campaign','financial_change',
     'security_change','legal_commitment','destructive_change')),
  action_type text NOT NULL,
  proposal_snapshot_sha256 char(64) NOT NULL CHECK (proposal_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  proposed_by uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'waiting' CHECK (state IN
    ('waiting','approved_evidence_ready','declined','expired','cancelled','executed_elsewhere')),
  step_up_evidence_ref text,
  independent_channel_evidence_ref text,
  solo_second_confirmation_at timestamptz,
  execution_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,board_id)
    REFERENCES sonara_governance.boards(organization_id,id),
  CHECK (expires_at > requested_at)
);

CREATE TABLE IF NOT EXISTS sonara_governance.approval_decisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('approved','declined')),
  proposal_snapshot_sha256 char(64) NOT NULL CHECK (proposal_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  decided_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,request_id,user_id),
  FOREIGN KEY (organization_id,request_id)
    REFERENCES sonara_governance.approval_requests(organization_id,id)
);

-- Consumer/customer review text remains the reviewer's statement. A business
-- cannot overwrite it and preserve the same author approval hash.
CREATE TABLE IF NOT EXISTS sonara_governance.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  subject_ref text NOT NULL,
  author_user_id uuid,
  review_text text NOT NULL CHECK (length(review_text) BETWEEN 1 AND 12000),
  review_sha256 char(64) NOT NULL CHECK (review_sha256 ~ '^[a-f0-9]{64}$'),
  sentiment_label text CHECK (sentiment_label IN ('positive','neutral','negative')),
  actual_experience_attested boolean NOT NULL DEFAULT false,
  relationship_kind text NOT NULL DEFAULT 'ordinary_customer' CHECK (relationship_kind IN
    ('ordinary_customer','employee','owner_or_manager','family_or_close_relation',
     'paid_or_gifted_reviewer','contractor_or_partner')),
  relationship_disclosed boolean NOT NULL DEFAULT false,
  incentive_offered boolean NOT NULL DEFAULT false,
  incentive_sentiment_conditioned boolean NOT NULL DEFAULT false,
  incentive_disclosed boolean NOT NULL DEFAULT false,
  ai_assistance text NOT NULL DEFAULT 'none' CHECK (ai_assistance IN
    ('none','grammar_suggestion','business_drafted','fully_ai_generated')),
  publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN
    ('draft','author_confirmed','moderation_review','publication_review_ready',
     'published','held','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.review_author_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  review_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  approved_sha256 char(64) NOT NULL CHECK (approved_sha256 ~ '^[a-f0-9]{64}$'),
  actual_experience_attested boolean NOT NULL,
  confirmed_at timestamptz NOT NULL,
  auth_evidence_ref text NOT NULL,
  UNIQUE (organization_id,review_id,approved_sha256),
  FOREIGN KEY (organization_id,review_id)
    REFERENCES sonara_governance.customer_reviews(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.review_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  review_id uuid NOT NULL,
  moderator_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('allow','hold','remove','restore')),
  reason_code text NOT NULL CHECK (reason_code IN
    ('duplicate','off_topic','privacy_or_personal_data','harassment_or_threat',
     'illegal_content','suspected_fraud_or_no_actual_experience','technical_spam')),
  review_sha256 char(64) NOT NULL CHECK (review_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,review_id)
    REFERENCES sonara_governance.customer_reviews(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.proof_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_ref text NOT NULL,
  claim_sha256 char(64) NOT NULL CHECK (claim_sha256 ~ '^[a-f0-9]{64}$'),
  required_evidence_types text[] NOT NULL,
  verification_tier text NOT NULL DEFAULT 'claimed_only' CHECK (verification_tier IN
    ('claimed_only','attributable','corroborated','independently_verified')),
  required_coverage_basis_points integer NOT NULL DEFAULT 0
    CHECK (required_coverage_basis_points BETWEEN 0 AND 10000),
  state text NOT NULL DEFAULT 'evidence_incomplete' CHECK (state IN
    ('evidence_incomplete','evidence_review_required','required_evidence_complete')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.proof_evidence (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  proof_packet_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN
    ('self_attestation','customer_confirmation','signed_document','file_hash',
     'completion_event','provider_event','bank_deposit','human_review')),
  source_ref text NOT NULL,
  claim_sha256 char(64) NOT NULL CHECK (claim_sha256 ~ '^[a-f0-9]{64}$'),
  hash_verified boolean NOT NULL DEFAULT false,
  independently_retrieved boolean NOT NULL DEFAULT false,
  actor_identity_verified boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,proof_packet_id)
    REFERENCES sonara_governance.proof_packets(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  subject_ref text NOT NULL,
  risk_kind text NOT NULL,
  likelihood integer NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact integer NOT NULL CHECK (impact BETWEEN 1 AND 5),
  inherent_score integer NOT NULL CHECK (inherent_score BETWEEN 1 AND 25),
  inherent_band text NOT NULL CHECK (inherent_band IN ('low','moderate','high','critical')),
  control_effectiveness_basis_points integer
    CHECK (control_effectiveness_basis_points BETWEEN 0 AND 10000),
  control_evidence_ref text,
  control_evidence_verified boolean NOT NULL DEFAULT false,
  control_evidence_checked_at timestamptz,
  residual_score integer CHECK (residual_score BETWEEN 0 AND 25),
  residual_band text CHECK (residual_band IN ('minimal','low','moderate','high','critical','unknown')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  CHECK (
    control_evidence_verified = false OR
    (control_evidence_ref IS NOT NULL AND control_evidence_checked_at IS NOT NULL)
  )
);

-- Shared rate/resource budgets need an atomic server RPC/transaction. This table
-- is a proposed durable state shape, not a safe read-modify-write recipe.
CREATE TABLE IF NOT EXISTS sonara_governance.rate_budget_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  subject_kind text NOT NULL CHECK (subject_kind IN ('ip_hash','user','organization','automation','provider')),
  subject_hash text NOT NULL,
  operation_key text NOT NULL,
  capacity_units integer NOT NULL CHECK (capacity_units > 0),
  refill_units_per_minute integer NOT NULL CHECK (refill_units_per_minute >= 0),
  available_units integer NOT NULL CHECK (available_units >= 0),
  last_refill_at timestamptz NOT NULL,
  daily_limit_units integer CHECK (daily_limit_units > 0),
  daily_used_units integer NOT NULL DEFAULT 0 CHECK (daily_used_units >= 0),
  active_concurrency integer NOT NULL DEFAULT 0 CHECK (active_concurrency >= 0),
  concurrency_limit integer NOT NULL DEFAULT 1 CHECK (concurrency_limit > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_kind,subject_hash,operation_key)
);

CREATE TABLE IF NOT EXISTS sonara_governance.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_kind text NOT NULL,
  subject_ref text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  client_reported_at timestamptz,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  provider_occurred_at timestamptz,
  provider_time_verified boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'scheduled' CHECK (state IN ('draft','scheduled','cancelled','completed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS sonara_governance.deadline_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  subject_ref text NOT NULL,
  rule_ref text,
  anchor_kind text NOT NULL CHECK (anchor_kind IN ('server_received_at','verified_provider_occurred_at')),
  anchor_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  due_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','met','missed','cancelled','review_required')),
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_at > anchor_at)
);

CREATE TABLE IF NOT EXISTS sonara_governance.customer_automations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  created_by uuid NOT NULL,
  skill_key text NOT NULL,
  action_type text NOT NULL,
  trigger_kind text NOT NULL CHECK (trigger_kind IN
    ('manual','schedule','record_created','record_changed','deadline_approaching','threshold_crossed')),
  time_zone text NOT NULL DEFAULT 'UTC',
  execution_mode text NOT NULL CHECK (execution_mode IN
    ('bounded_unattended_candidate','approval_per_run')),
  max_runs_per_day integer NOT NULL CHECK (max_runs_per_day BETWEEN 1 AND 1440),
  max_concurrent_runs integer NOT NULL CHECK (max_concurrent_runs BETWEEN 1 AND 10),
  paused_by_customer boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  CHECK (execution_mode <> 'approval_per_run' OR enabled = false)
);

CREATE TABLE IF NOT EXISTS sonara_governance.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  scheduled_for timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  approval_request_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued','approval_required','running','completed','blocked','failed','cancelled')),
  resource_cost_units integer CHECK (resource_cost_units >= 0),
  result_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,automation_id)
    REFERENCES sonara_governance.customer_automations(organization_id,id),
  FOREIGN KEY (organization_id,approval_request_id)
    REFERENCES sonara_governance.approval_requests(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_governance.customer_agent_skill_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  automation_id uuid,
  skill_key text NOT NULL,
  max_tool_calls integer NOT NULL CHECK (max_tool_calls BETWEEN 0 AND 16),
  tool_allowlist text[] NOT NULL DEFAULT '{}',
  private_data_scope text[] NOT NULL DEFAULT '{}',
  side_effect_class text NOT NULL CHECK (side_effect_class IN
    ('none','private_draft','private_record','reversible_record','external','money')),
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,automation_id)
    REFERENCES sonara_governance.customer_automations(organization_id,id)
);

-- Defense in depth. No browser policies until actual canonical organization
-- membership relations are inspected. The service role bypasses RLS; privileged
-- queries still require explicit organization_id filters at every call site.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boards','board_members','approval_requests','approval_decisions',
    'customer_reviews','review_author_confirmations','review_moderation_events',
    'proof_packets','proof_evidence','risk_assessments','rate_budget_state',
    'calendar_events','deadline_records','customer_automations','automation_runs',
    'customer_agent_skill_assignments'
  ] LOOP
    EXECUTE format('ALTER TABLE sonara_governance.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON sonara_governance.%I FROM anon, authenticated',t);
  END LOOP;
END;
$$;

-- REQUIRED BEFORE REAL MIGRATION:
-- 1. Map canonical memberships/roles and write negative cross-tenant RLS tests.
-- 2. Add atomic RPCs for approval claim/decision and token-bucket consumption.
-- 3. Bind every approval to exact immutable action snapshot + authenticated user.
-- 4. Re-evaluate existing agent/action/approval tables to avoid duplicate truth.
-- 5. Decide whether these are new canonical tables or views/extensions of
--    existing entity_action_approvals / agent_pending_actions / review records.
-- 6. Set retention/deletion/legal-hold policy per table and evidence category.
-- 7. Ensure review moderation cannot rewrite customer text or sentiment-gate.
-- 8. Ensure sensitive automation actions always require per-run owner approval.
-- 9. SQL replay, restore, RLS/service-role audit, load/concurrency tests.
-- 10. Keep all payment, refund, payout and public publishing execution in
--     separate owner-approved server adapters; this schema records evidence only.
