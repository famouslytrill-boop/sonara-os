-- SONARA Industries • secure filing, spreadsheet and offline data proposal
-- DESIGN ONLY / NOT AN APPLIED MIGRATION.
-- Do not execute against production. Canonical organization/member/storage
-- schema, bucket policies, retention law, migration ordering and restore/rollback
-- evidence have NOT been bound to these names.
--
-- OBJECTIVE:
--   metadata in Postgres; bytes in private object storage; no user-controlled
--   filesystem path; sensitive local copies encrypted under OS-protected keys;
--   spreadsheets store typed values + deterministic formula definitions, not
--   executable Excel formulas/macros; offline sync never performs money/legal
--   actions.

CREATE SCHEMA IF NOT EXISTS sonara_files;
REVOKE ALL ON SCHEMA sonara_files FROM PUBLIC;
REVOKE ALL ON SCHEMA sonara_files FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS sonara_files.file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'public_marketing','tenant_standard','tenant_confidential',
    'restricted_legal','restricted_sensitive_media')),
  storage_provider text NOT NULL DEFAULT 'supabase_storage',
  bucket_key text NOT NULL,
  object_key text NOT NULL,
  original_display_name text,
  extension text NOT NULL,
  detected_mime text NOT NULL,
  byte_length bigint NOT NULL CHECK (byte_length > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  quarantine_state text NOT NULL DEFAULT 'pending' CHECK (quarantine_state IN (
    'pending','scan_clean','blocked','manual_review')),
  archive_scan_state text NOT NULL DEFAULT 'not_applicable' CHECK (archive_scan_state IN (
    'not_applicable','pending','passed','blocked')),
  active_content_state text NOT NULL DEFAULT 'not_detected' CHECK (active_content_state IN (
    'not_detected','detected_blocked','unknown')),
  encryption_profile text NOT NULL DEFAULT 'provider_at_rest',
  retention_class text NOT NULL DEFAULT 'customer_active',
  legal_hold boolean NOT NULL DEFAULT false,
  version_no bigint NOT NULL DEFAULT 1 CHECK (version_no > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id,id),
  UNIQUE (bucket_key,object_key),
  CHECK (position('/' in object_key) > 0),
  CHECK (object_key NOT LIKE '%..%'),
  CHECK (original_display_name IS NULL OR length(original_display_name) <= 120)
);
CREATE INDEX IF NOT EXISTS sonara_file_org_created
  ON sonara_files.file_objects (organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sonara_file_hash
  ON sonara_files.file_objects (organization_id,sha256);

CREATE TABLE IF NOT EXISTS sonara_files.file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  logical_file_id uuid NOT NULL,
  file_object_id uuid NOT NULL,
  version_no bigint NOT NULL CHECK (version_no > 0),
  change_kind text NOT NULL CHECK (change_kind IN
    ('created','replaced','metadata_corrected','quarantined','restored')),
  supersedes_file_object_id uuid,
  actor_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,logical_file_id,version_no),
  FOREIGN KEY (organization_id,file_object_id)
    REFERENCES sonara_files.file_objects(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_files.file_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  file_object_id uuid NOT NULL,
  actor_user_id uuid,
  access_kind text NOT NULL CHECK (access_kind IN
    ('upload_requested','upload_scanned','download_authorized',
     'download_denied','authenticated_stream_started',
     'signed_url_created','delete_requested','delete_executed')),
  decision text NOT NULL CHECK (decision IN ('allowed','denied','recorded')),
  reason_code text NOT NULL,
  request_correlation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,file_object_id)
    REFERENCES sonara_files.file_objects(organization_id,id)
);
CREATE INDEX IF NOT EXISTS sonara_file_audit
  ON sonara_files.file_access_events (organization_id,file_object_id,occurred_at DESC);

-- Local devices store references and public-key/key-alias metadata ONLY.
-- No raw encryption key, access token, password or database key belongs here.
CREATE TABLE IF NOT EXISTS sonara_files.offline_devices (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN
    ('android_native','ios_native','desktop_native')),
  device_key_alias text NOT NULL,
  key_protection text NOT NULL CHECK (key_protection IN
    ('android_keystore','apple_keychain','desktop_os_keychain')),
  encryption_verified_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_files.offline_mutations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  device_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'append_note','draft_task','update_task_nonfinancial',
    'inventory_count_observation','draft_content',
    'draft_customer_record','attach_local_file_reference')),
  base_version bigint NOT NULL CHECK (base_version >= 0),
  payload_ciphertext_ref text NOT NULL,
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN (
    'queued','received','conflict','applied','rejected','expired')),
  server_version_after bigint,
  created_at timestamptz NOT NULL,
  received_at timestamptz,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,device_id)
    REFERENCES sonara_files.offline_devices(organization_id,id)
);

-- Workbook is a SONARA data document, not an XLSX binary and not an arbitrary
-- formula runtime. The application can later export values as CSV/XLSX.
CREATE TABLE IF NOT EXISTS sonara_files.workbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  workbook_kind text NOT NULL CHECK (workbook_kind IN (
    'budget','invoice_register','job_costing','inventory',
    'rental_ledger','creator_royalty_record','campaign_budget','custom')),
  schema_version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','active','archived')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_files.workbook_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  workbook_id uuid NOT NULL,
  sheet_key text NOT NULL CHECK (sheet_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  column_schema jsonb NOT NULL,
  deterministic_formula_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (organization_id,workbook_id,sheet_key),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,workbook_id)
    REFERENCES sonara_files.workbooks(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_files.workbook_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sheet_id uuid NOT NULL,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  typed_values jsonb NOT NULL,
  calculated_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_version text NOT NULL,
  source_ref text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,sheet_id)
    REFERENCES sonara_files.workbook_sheets(organization_id,id)
);
CREATE INDEX IF NOT EXISTS sonara_workbook_rows_by_sheet
  ON sonara_files.workbook_rows (organization_id,sheet_id,created_at);

CREATE TABLE IF NOT EXISTS sonara_files.spreadsheet_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  workbook_id uuid,
  source_file_object_id uuid,
  format text NOT NULL CHECK (format IN ('csv','tsv','xlsx')),
  state text NOT NULL DEFAULT 'quarantined' CHECK (state IN (
    'quarantined','parsed','preview_ready','approved','importing',
    'complete','rejected','failed')),
  total_rows integer CHECK (total_rows >= 0),
  accepted_rows integer CHECK (accepted_rows >= 0),
  rejected_rows integer CHECK (rejected_rows >= 0),
  formula_like_cells integer NOT NULL DEFAULT 0 CHECK (formula_like_cells >= 0),
  parser_version text NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'approved' OR approved_by IS NOT NULL),
  FOREIGN KEY (organization_id,source_file_object_id)
    REFERENCES sonara_files.file_objects(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_files.spreadsheet_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  workbook_id uuid,
  export_kind text NOT NULL CHECK (export_kind IN ('csv_human','csv_portable','xlsx_values_only')),
  formula_guard text NOT NULL CHECK (formula_guard IN
    ('quoted_tab_prefix','apostrophe_compatibility','xlsx_text_cells')),
  state text NOT NULL DEFAULT 'requested' CHECK (state IN
    ('requested','building','complete','failed','expired')),
  row_count integer CHECK (row_count >= 0),
  neutralized_cells integer NOT NULL DEFAULT 0 CHECK (neutralized_cells >= 0),
  output_file_object_id uuid,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (organization_id,output_file_object_id)
    REFERENCES sonara_files.file_objects(organization_id,id)
);

CREATE TABLE IF NOT EXISTS sonara_files.retention_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  file_object_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN
    ('retain','archive','purge_candidate','purge_blocked_legal_hold','purged')),
  policy_ref text NOT NULL,
  due_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,file_object_id)
    REFERENCES sonara_files.file_objects(organization_id,id)
);

-- Defense in depth only. No end-user policies are defined until exact canonical
-- membership relations are inspected and tested. The app server's service role
-- bypasses RLS, so every privileged query still needs explicit organization_id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'file_objects','file_versions','file_access_events','offline_devices',
    'offline_mutations','workbooks','workbook_sheets','workbook_rows',
    'spreadsheet_import_jobs','spreadsheet_export_jobs','retention_actions'
  ] LOOP
    EXECUTE format('ALTER TABLE sonara_files.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON sonara_files.%I FROM anon, authenticated',t);
  END LOOP;
END;
$$;

-- REQUIRED BEFORE ANY REAL MIGRATION:
-- * verify actual memberships/roles, bucket names, upload routes, import/export
--   routes, object-storage path ownership, generated URLs and deletion flows;
-- * inspect file signatures and decompressed XLSX ZIP limits before parser use;
-- * prevent CSV/formula injection; no macro-enabled workbook formats;
-- * use private Storage buckets for customer bytes; restricted records should
--   prefer authenticated downloads rather than reusable signed URLs;
-- * bind Android keys to Android Keystore and Apple keys to Keychain; don't put
--   the encryption key beside the local encrypted database;
-- * implement local cache expiry, remote logout/device revocation, lost-device
--   response, legal hold and customer deletion/retention workflow;
-- * design exact journal/offline transactional writer + idempotency;
-- * SQL replay, RLS negative tests, backup/restore, object restore and rollback;
-- * no real money/legal action is allowed through the offline mutation table.
