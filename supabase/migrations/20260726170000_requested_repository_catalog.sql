-- Governed metadata for repositories requested on 2026-07-26.
-- Catalog only: no third-party code, credentials, jobs, agents, binaries, scans, or connectors are enabled.

insert into public.open_source_software_catalog (
  tool_key,
  name,
  category,
  product_area,
  use_case,
  integration_mode,
  maturity_status,
  risk_level,
  license_review_required,
  security_review_required,
  notes
)
values
  ('openhands', 'OpenHands', 'developer_agent_platform', 'internal_development', 'Isolated coding-agent control plane for reviewed repository maintenance.', 'self_hosted', 'review_required', 'high', true, true, 'Verified source OpenHands/OpenHands. Developer-only; sandbox, scoped credentials, audit logs, and human approval required. Production execution remains disabled.'),
  ('caveman', 'Caveman', 'prompt_skill', 'internal_development', 'Optional concise-output profile and token-measurement reference.', 'research_only', 'research_only', 'medium', false, true, 'Verified source JuliusBrussee/caveman. Do not install remote scripts in production. Benchmark SONARA-owned brevity prompts before adoption.'),
  ('agency_agents', 'Agency Agents', 'agent_prompt_library', 'all', 'Curated specialist role and workflow templates.', 'research_only', 'review_required', 'medium', false, true, 'Corrected source msitarzewski/agency-agents; supplied sonoisa link was not found. Import selected reviewed roles only; bulk installation is prohibited.'),
  ('meetily', 'Meetily', 'desktop_meeting_assistant', 'business_builder', 'Local meeting transcription and user-approved summary import.', 'manual_export', 'review_required', 'high', false, true, 'Verified source Zackriya-Solutions/meetily. Desktop companion only. Recording consent, local storage, explicit import, and tenant isolation are mandatory.'),
  ('officecli', 'OfficeCLI', 'document_worker', 'all', 'Create and inspect DOCX, XLSX, and PPTX artifacts in an isolated worker.', 'service', 'review_required', 'high', false, true, 'Corrected source iOfficeAI/OfficeCLI; supplied nicobrenner link was not found. Queue-backed container only; no shell passthrough or Vercel request-process execution.'),
  ('openwiki', 'OpenWiki', 'documentation_cli', 'internal_development', 'Generate repository documentation on a review branch.', 'manual_export', 'review_required', 'high', false, true, 'Corrected source langchain-ai/openwiki; supplied nicosxt link was not found. Code mode only; personal connectors and automatic merges remain disabled.'),
  ('omniroute_unverified', 'OmniRoute (unverified source)', 'unverified_external_source', 'research_lab', 'Preserve the request as blocked intake metadata.', 'disabled', 'disabled', 'high', true, true, 'Supplied omniroute/omniroute source and navigation performance claims could not be verified. No cloning, marketing, or runtime use.'),
  ('strix', 'Strix', 'security_testing', 'internal_security', 'Authorized staging-only application-security assessment.', 'service', 'review_required', 'high', false, true, 'Corrected source usestrix/strix; supplied strixsec link was not found. Owned targets only, isolated environment, strict allowlists, non-production credentials, and human review.'),
  ('asi_agent_skills', 'ASI Agent Skills', 'agent_skill_library', 'research_lab', 'Quarantined source for individually reviewed skill concepts.', 'research_only', 'research_only', 'high', false, true, 'Verified source plurigrid/asi. Bulk loading is prohibited. Each selected skill requires prompt-injection, shell, network, license, and data-access review.'),
  ('awesome_design_md_unverified', 'Awesome Design MD (unverified source)', 'unverified_external_source', 'research_lab', 'Preserve the request as blocked intake metadata.', 'disabled', 'disabled', 'high', true, true, 'Supplied nicosxt/awesome-design-md source could not be verified. No code, template, asset, or branding use.')
on conflict (tool_key) do update set
  name = excluded.name,
  category = excluded.category,
  product_area = excluded.product_area,
  use_case = excluded.use_case,
  integration_mode = excluded.integration_mode,
  maturity_status = excluded.maturity_status,
  risk_level = excluded.risk_level,
  license_review_required = excluded.license_review_required,
  security_review_required = excluded.security_review_required,
  notes = excluded.notes,
  updated_at = now();

insert into public.open_source_software_capabilities (
  tool_key,
  capability_key,
  label,
  description,
  status
)
values
  ('openhands', 'isolated_development_pilot', 'Isolated development pilot', 'Reviewed read-only repository tasks before any patch-creation permission.', 'planned'),
  ('caveman', 'concise_output_benchmark', 'Concise output benchmark', 'SONARA-owned response profile tested against quality and total-token measurements.', 'planned'),
  ('agency_agents', 'curated_role_templates', 'Curated role templates', 'Individually reviewed specialist templates that cannot override SONARA policy.', 'planned'),
  ('meetily', 'explicit_summary_import', 'Explicit summary import', 'User-approved transcript or summary import with consent and tenant scope.', 'planned'),
  ('officecli', 'isolated_artifact_worker', 'Isolated artifact worker', 'Queue-backed DOCX, XLSX, and PPTX generation in temporary storage.', 'planned'),
  ('openwiki', 'documentation_review_branch', 'Documentation review branch', 'Code-mode documentation generation that opens a reviewable change.', 'planned'),
  ('omniroute_unverified', 'source_verification_required', 'Source verification required', 'No capability may be activated until an authoritative source and license are verified.', 'blocked'),
  ('strix', 'authorized_staging_scan', 'Authorized staging scan', 'Source or diff-scoped security assessment against explicitly approved SONARA assets.', 'planned'),
  ('asi_agent_skills', 'five_skill_allowlist_pilot', 'Five-skill allowlist pilot', 'Individually reviewed and rewritten skills in an offline sandbox.', 'planned'),
  ('awesome_design_md_unverified', 'source_verification_required', 'Source verification required', 'No templates or assets may be used until an authoritative licensed source is verified.', 'blocked')
on conflict (tool_key, capability_key) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status;

insert into public.integration_providers (
  provider_key,
  name,
  category,
  connection_mode,
  capabilities,
  status
)
values
  ('openhands', 'OpenHands', 'other', 'manual', '{"runtime_class":"developer_agent_platform","production_enabled":false,"human_approval_required":true}'::jsonb, 'manual_review'),
  ('caveman', 'Caveman', 'other', 'manual', '{"runtime_class":"prompt_skill","production_enabled":false,"benchmark_required":true}'::jsonb, 'manual_review'),
  ('agency_agents', 'Agency Agents', 'other', 'manual', '{"runtime_class":"agent_prompt_library","production_enabled":false,"bulk_install_allowed":false}'::jsonb, 'manual_review'),
  ('meetily', 'Meetily', 'other', 'manual', '{"runtime_class":"desktop_companion","production_enabled":false,"explicit_import_required":true}'::jsonb, 'manual_review'),
  ('officecli', 'OfficeCLI', 'other', 'manual', '{"runtime_class":"document_worker","production_enabled":false,"isolated_worker_required":true}'::jsonb, 'manual_review'),
  ('openwiki', 'OpenWiki', 'other', 'manual', '{"runtime_class":"developer_cli","production_enabled":false,"personal_connectors_enabled":false}'::jsonb, 'manual_review'),
  ('omniroute_unverified', 'OmniRoute (unverified source)', 'other', 'manual', '{"runtime_class":"unverified_external_source","production_enabled":false,"source_verified":false}'::jsonb, 'disabled'),
  ('strix', 'Strix', 'other', 'manual', '{"runtime_class":"security_testing_tool","production_enabled":false,"authorized_targets_only":true}'::jsonb, 'manual_review'),
  ('asi_agent_skills', 'ASI Agent Skills', 'other', 'manual', '{"runtime_class":"agent_skill_library","production_enabled":false,"bulk_install_allowed":false}'::jsonb, 'manual_review'),
  ('awesome_design_md_unverified', 'Awesome Design MD (unverified source)', 'other', 'manual', '{"runtime_class":"unverified_external_source","production_enabled":false,"source_verified":false}'::jsonb, 'disabled')
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

insert into public.integration_statuses (integration_key, status, detail, metadata)
values
  ('openhands', 'developer_only', 'Cataloged for an isolated, human-reviewed development pilot.', '{"execution_enabled":false,"source_verified":true}'::jsonb),
  ('caveman', 'research_only', 'Cataloged as a response-profile reference pending SONARA benchmarks.', '{"execution_enabled":false,"source_verified":true}'::jsonb),
  ('agency_agents', 'review_required', 'Selected prompt roles may be adapted only after individual review.', '{"execution_enabled":false,"source_verified":true,"source_corrected":true}'::jsonb),
  ('meetily', 'review_required', 'Desktop companion and explicit-import design only.', '{"execution_enabled":false,"source_verified":true}'::jsonb),
  ('officecli', 'review_required', 'Isolated artifact-worker design only.', '{"execution_enabled":false,"source_verified":true,"source_corrected":true}'::jsonb),
  ('openwiki', 'developer_only', 'Code-mode documentation worker only; connectors disabled.', '{"execution_enabled":false,"source_verified":true,"source_corrected":true}'::jsonb),
  ('omniroute_unverified', 'blocked', 'Source and claims are unverified.', '{"execution_enabled":false,"source_verified":false}'::jsonb),
  ('strix', 'staging_only', 'Authorized SONARA staging targets only.', '{"execution_enabled":false,"source_verified":true,"source_corrected":true}'::jsonb),
  ('asi_agent_skills', 'quarantined_reference', 'Individual allowlisted skill review only; bulk installation prohibited.', '{"execution_enabled":false,"source_verified":true}'::jsonb),
  ('awesome_design_md_unverified', 'blocked', 'Source and license are unverified.', '{"execution_enabled":false,"source_verified":false}'::jsonb)
on conflict (integration_key) do update set
  status = excluded.status,
  detail = excluded.detail,
  metadata = excluded.metadata,
  updated_at = now();
