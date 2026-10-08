-- SONARA Industries • October 7, 2026
-- DESIGN ONLY / NOT AN APPLIED MIGRATION
-- Do not run in production until schema ownership, RLS, SQL replay,
-- source-of-truth, policy approvals, data retention and rollback are validated.
-- The existing SONARA billing migrations remain canonical.
-- Never expose this schema or a service_role key to public clients.
-- No bank credentials, payment authority or customer-money custody exists here.

CREATE SCHEMA IF NOT EXISTS sonara_control;
REVOKE ALL ON SCHEMA sonara_control FROM PUBLIC;
REVOKE ALL ON SCHEMA sonara_control FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS sonara_control.legal_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text NOT NULL,
  rule_key text NOT NULL,
  version_label text NOT NULL,
  source_url text NOT NULL,
  source_checked_at timestamptz,
  effective_from date,
  effective_until date,
  sha256_digest char(64) NOT NULL CHECK (sha256_digest ~ '^[a-f0-9]{64}$'),
  reviewed_by uuid,
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','review_pending','approved','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, rule_key, version_label),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from),
  CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

-- Review-only evidence; sensitive bytes stay in private storage and should
-- never be placed in public columns, logs, search indexes or AI prompts.
CREATE TABLE IF NOT EXISTS sonara_control.review_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  rule_version_id uuid REFERENCES sonara_control.legal_rule_versions(id),
  case_kind text NOT NULL CHECK (case_kind IN (
    'nonconsensual_intimate_image_notice','copyright_claim','impersonation',
    'fraudulent_payment_link','unlicensed_appearance_or_voice',
    'customer_data_exposure','rental_discrimination_report',
    'subscription_billing_complaint','other')),
  source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 3 AND 160),
  state text NOT NULL DEFAULT 'submitted' CHECK (state IN
    ('submitted','intake_review','awaiting_human','action_pending',
     'resolved','declined','appealed')),
  validity text NOT NULL DEFAULT 'not_determined' CHECK (validity IN
    ('not_determined','valid_confirmed','invalid_confirmed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  valid_notice_received_at timestamptz,
  statutory_deadline_at timestamptz,
  internal_review_target_at timestamptz,
  assigned_reviewer uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, case_kind, source_ref),
  CHECK (valid_notice_received_at IS NULL OR valid_notice_received_at >= received_at),
  CHECK (validity <> 'valid_confirmed' OR valid_notice_received_at IS NOT NULL),
  CHECK (statutory_deadline_at IS NULL OR valid_notice_received_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sonara_cases_due ON sonara_control.review_cases
  (state, statutory_deadline_at)
  WHERE state NOT IN ('resolved','declined');

CREATE TABLE IF NOT EXISTS sonara_control.case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  encrypted_blob_ref text NOT NULL,
  digest_sha256 char(64) NOT NULL CHECK (digest_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_source text NOT NULL CHECK (evidence_source IN
    ('customer_submitted','provider_api_verified','staff_recorded','legal_document')),
  verifier_user_id uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, case_id)
    REFERENCES sonara_control.review_cases(organization_id,id),
  CHECK (evidence_source <> 'provider_api_verified' OR verified_at IS NOT NULL)
);

-- Append-only event log by application permission; PostgreSQL superusers
-- could still modify it. Real immutability needs independent anchoring.
CREATE TABLE IF NOT EXISTS sonara_control.case_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  sequence_no bigint NOT NULL CHECK (sequence_no > 0),
  event_kind text NOT NULL CHECK (event_kind IN
    ('reported','evidence_added','triaged','human_reviewed','removal_requested',
     'removed_confirmed','notice_sent','declined','appealed','reopened')),
  actor_user_id uuid,
  event_digest_sha256 char(64) NOT NULL CHECK (event_digest_sha256 ~ '^[a-f0-9]{64}$'),
  previous_digest_sha256 char(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, case_id, sequence_no),
  FOREIGN KEY (organization_id, case_id)
    REFERENCES sonara_control.review_cases(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_control.media_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  asset_ref text NOT NULL,
  asset_sha256 char(64) NOT NULL CHECK (asset_sha256 ~ '^[a-f0-9]{64}$'),
  origin_class text NOT NULL CHECK (origin_class IN
    ('human_authored','ai_assisted','ai_generated','mixed_human_ai')),
  model_ref text,
  model_terms_evidence_ref text,
  rights_evidence_ref text,
  likeness_consent_evidence_ref text,
  c2pa_manifest_ref text,
  c2pa_validation text NOT NULL DEFAULT 'not_checked' CHECK (c2pa_validation IN
    ('not_checked','invalid','valid_untrusted','valid_trusted')),
  publication_state text NOT NULL DEFAULT 'private_draft' CHECK (publication_state IN
    ('private_draft','review_requested','on_hold','published','removed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,asset_ref),
  CHECK (publication_state <> 'published' OR reviewed_by IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sonara_media_by_org
  ON sonara_control.media_provenance (organization_id,publication_state,created_at DESC);

-- A business can self-report its own payments but this is NOT SONARA cash,
-- a provider-confirmed receipt, bank settlement or paid fulfillment.
CREATE TABLE IF NOT EXISTS sonara_control.external_customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  external_reference text NOT NULL,
  source_document_ref text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  external_method text NOT NULL CHECK (external_method IN
    ('stripe_independent_merchant','other_independent_provider',
     'cash_outside_sonara','bank_transfer_outside_sonara')),
  state text NOT NULL DEFAULT 'seller_reported_unverified'
    CHECK (state = 'seller_reported_unverified'),
  attested_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,external_method,external_reference)
);

-- SONARA subscription-only company journal draft; reconcile against Stripe
-- events and bank records. Do not double-post existing canonical billing.
CREATE TABLE IF NOT EXISTS sonara_control.sonara_own_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_ref text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN
    ('software_subscription','software_refund','provider_fee',
     'bank_deposit_reconciliation','business_expense')),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  accounting_period date NOT NULL,
  status text NOT NULL DEFAULT 'draft_unposted' CHECK (status IN
    ('draft_unposted','approved_posted','reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_event_ref,kind)
);
CREATE TABLE IF NOT EXISTS sonara_control.sonara_own_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES sonara_control.sonara_own_journals(id),
  account_code text NOT NULL CHECK (account_code IN
    ('platform_stripe_receivable','platform_bank_cash',
     'software_deferred_revenue','software_revenue',
     'subscription_refund_clearing','processor_fees',
     'business_expenses','sales_tax_liability')),
  side text NOT NULL CHECK (side IN ('debit','credit')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sonara_journal_line_fk
  ON sonara_control.sonara_own_journal_lines (journal_id);

-- All messages are notifications/review tasks; never capture/refund/payout.
CREATE TABLE IF NOT EXISTS sonara_control.review_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid,
  event_kind text NOT NULL CHECK (event_kind IN
    ('review_required','deadline_warning','case_changed',
     'provenance_verification_requested','customer_notice_draft')),
  idempotency_key text NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 50),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','in_progress','done','dead_letter')),
  minimal_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,event_kind,idempotency_key)
);
CREATE INDEX IF NOT EXISTS sonara_review_outbox_due
  ON sonara_control.review_outbox (status,available_at);

CREATE TABLE IF NOT EXISTS sonara_control.tenant_resource_budgets (
  organization_id uuid NOT NULL,
  billing_period_start date NOT NULL,
  max_generated_assets integer NOT NULL CHECK (max_generated_assets >= 0),
  max_storage_bytes bigint NOT NULL CHECK (max_storage_bytes >= 0),
  max_worker_seconds bigint NOT NULL CHECK (max_worker_seconds >= 0),
  used_generated_assets integer NOT NULL DEFAULT 0 CHECK (used_generated_assets >= 0),
  used_storage_bytes bigint NOT NULL DEFAULT 0 CHECK (used_storage_bytes >= 0),
  used_worker_seconds bigint NOT NULL DEFAULT 0 CHECK (used_worker_seconds >= 0),
  PRIMARY KEY (organization_id,billing_period_start)
);

-- No generic signed-in-user access or unverified JWT->organization mapping.
-- All data accessed only by a trusted app server until a verified membership
-- function and full RLS integration test matrix are designed.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legal_rule_versions','review_cases','case_evidence','case_event_log',
    'media_provenance','external_customer_receipts','sonara_own_journals',
    'sonara_own_journal_lines','review_outbox','tenant_resource_budgets'
  ] LOOP
    EXECUTE format('ALTER TABLE sonara_control.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON sonara_control.%I FROM anon, authenticated',t);
  END LOOP;
END;
$$;

-- Future production gates REQUIRED:
-- 1) Inspect canonical organization membership, tenant keys, journal account
--    ownership, migration ordering, privilege grants and service credentials.
-- 2) Deferred balanced-journal checks across journal lines; SQL CHECK on one
--    line cannot enforce a whole journal's debit/credit equality.
-- 3) Atomic idempotent app writer, no update/delete on event log, audited
--    corrections and external integrity anchor, restore + retention evidence.
-- 4) Independent law review, real copyright/abuse staff, security review,
--    production release and staged tenant canary with rollback.
-- 5) Real C2PA cryptographic verification rather than trusting state flags.
