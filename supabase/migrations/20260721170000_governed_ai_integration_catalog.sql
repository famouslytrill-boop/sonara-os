-- Governed catalog for the twelve requested AI tools.
-- Metadata and readiness state only: no credentials, prompts, customer data, or autonomous jobs.

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
  ('openclaw', 'OpenClaw', 'agent_gateway', 'all', 'Private operator or device agent gateway.', 'self_hosted', 'review_required', 'high', false, true, 'Readiness adapter only. Gateway token is full operator access; never expose to customer traffic.'),
  ('n8n', 'n8n', 'automation', 'growth_studio', 'Approved workflow automation and inventory.', 'self_hosted', 'review_required', 'high', true, true, 'Sustainable Use License and enterprise terms require review before commercial embedding or hosted customer use.'),
  ('ollama', 'Ollama', 'local_ai', 'all', 'Local or private model runtime.', 'self_hosted', 'review_required', 'medium', false, true, 'Runtime is optional; every downloaded model has separate license and data review.'),
  ('langflow', 'Langflow', 'automation_ai', 'all', 'Authenticated visual flow design and inventory.', 'self_hosted', 'review_required', 'high', false, true, 'Custom code, filesystem, MCP, Python, and shell-capable components remain admin-only.'),
  ('dify', 'Dify', 'ai_application_platform', 'all', 'AI application and workflow service adapter.', 'self_hosted', 'review_required', 'high', true, true, 'Dify license contains additional conditions; API keys are scoped per application where possible.'),
  ('langchain', 'LangChain', 'agent_framework', 'all', 'Controlled worker framework reference.', 'dependency', 'review_required', 'medium', false, true, 'Do not add a second orchestration framework to the synchronous customer request path.'),
  ('open_webui', 'Open WebUI', 'local_ai', 'all', 'Private operator interface for approved model runtimes.', 'self_hosted', 'review_required', 'high', true, true, 'Open WebUI License includes branding conditions. Keep behind authentication; community extensions are untrusted until reviewed.'),
  ('deepseek_v3', 'DeepSeek V3', 'model_family', 'all', 'Optional open-weight model served through an approved gateway.', 'adapter_candidate', 'review_required', 'high', true, true, 'Weights are not bundled. Exact model, model license, compute, data policy, and output validation require review.'),
  ('gemini_cli', 'Gemini CLI', 'developer_tool', 'all', 'Repository assistance on approved development workstations.', 'manual_export', 'review_required', 'high', false, true, 'Developer-only. Never invoke from production or customer-controlled input.'),
  ('ragflow', 'RAGFlow', 'retrieval_ai', 'all', 'Tenant-scoped document and retrieval worker stack.', 'self_hosted', 'review_required', 'high', true, true, 'Document rights, deletion, tenant isolation, bundled services, and code execution require review.'),
  ('claude_code', 'Claude Code', 'developer_tool', 'all', 'Repository assistance on approved development workstations.', 'manual_export', 'review_required', 'high', true, true, 'Developer-only product; not treated as a redistributable production runtime dependency.'),
  ('crewai', 'CrewAI', 'agent_framework', 'all', 'Reviewable asynchronous worker orchestration.', 'service', 'review_required', 'high', false, true, 'First allowed pilot is read-only launch readiness with tenant scope, audit events, and human approval.')
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
  ('openclaw', 'readiness_probe', 'Readiness probe', 'Read-only model-discovery probe through the private gateway.', 'active'),
  ('n8n', 'readiness_probe', 'Readiness probe', 'Read-only workflow-inventory probe.', 'active'),
  ('ollama', 'readiness_probe', 'Readiness probe', 'Read-only local model-inventory probe.', 'active'),
  ('langflow', 'readiness_probe', 'Readiness probe', 'Read-only flow-inventory probe.', 'active'),
  ('dify', 'readiness_probe', 'Readiness probe', 'Read-only application metadata probe.', 'active'),
  ('langchain', 'worker_reference', 'Worker framework reference', 'Approved architecture placement outside the web process.', 'active'),
  ('open_webui', 'readiness_probe', 'Readiness probe', 'Read-only model-inventory probe for the private operator UI.', 'active'),
  ('deepseek_v3', 'gateway_model_option', 'Gateway model option', 'Model-family classification without bundled weights.', 'active'),
  ('gemini_cli', 'developer_only', 'Developer-only boundary', 'Explicitly excluded from production and customer input.', 'active'),
  ('ragflow', 'readiness_probe', 'Readiness probe', 'Read-only dataset-inventory probe.', 'active'),
  ('claude_code', 'developer_only', 'Developer-only boundary', 'Explicitly excluded from production and customer input.', 'active'),
  ('crewai', 'readiness_probe', 'Readiness probe', 'Read-only worker health probe.', 'active')
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
  ('openclaw', 'OpenClaw', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false}'::jsonb, 'manual_review'),
  ('n8n', 'n8n', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false,"license_review_required":true}'::jsonb, 'manual_review'),
  ('ollama', 'Ollama', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false}'::jsonb, 'manual_review'),
  ('langflow', 'Langflow', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false}'::jsonb, 'manual_review'),
  ('dify', 'Dify', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false,"license_review_required":true}'::jsonb, 'manual_review'),
  ('langchain', 'LangChain', 'other', 'manual', '{"runtime_class":"framework_library","worker_reference":true,"execution_enabled":false}'::jsonb, 'manual_review'),
  ('open_webui', 'Open WebUI', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false}'::jsonb, 'manual_review'),
  ('deepseek_v3', 'DeepSeek V3', 'other', 'manual', '{"runtime_class":"model_family","gateway_model_option":true,"weights_bundled":false}'::jsonb, 'manual_review'),
  ('gemini_cli', 'Gemini CLI', 'other', 'manual', '{"runtime_class":"developer_cli","production_enabled":false}'::jsonb, 'manual_review'),
  ('ragflow', 'RAGFlow', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false}'::jsonb, 'manual_review'),
  ('claude_code', 'Claude Code', 'other', 'manual', '{"runtime_class":"developer_cli","production_enabled":false}'::jsonb, 'manual_review'),
  ('crewai', 'CrewAI', 'other', 'api', '{"runtime_class":"http_service","readiness_probe":true,"execution_enabled":false}'::jsonb, 'manual_review')
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

insert into public.integration_statuses (integration_key, status, detail, metadata)
values
  ('openclaw', 'setup_required', 'Disabled until a private gateway and server-only token are configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('n8n', 'setup_required', 'Disabled until license review, private service, and server-only API key are configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('ollama', 'setup_required', 'Disabled until a private runtime is configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('langflow', 'setup_required', 'Disabled until an authenticated private service is configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('dify', 'setup_required', 'Disabled until license review and a scoped application key are configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('langchain', 'worker_reference', 'Framework reference only; no production runtime dependency.', '{"runtime_class":"framework_library","enabled_by_default":false}'::jsonb),
  ('open_webui', 'setup_required', 'Disabled until a private authenticated operator service is configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('deepseek_v3', 'gateway_model_option', 'Optional model family; weights are not bundled.', '{"runtime_class":"model_family","enabled_by_default":false}'::jsonb),
  ('gemini_cli', 'developer_only', 'Development workstation or isolated development container only.', '{"runtime_class":"developer_cli","enabled_by_default":false}'::jsonb),
  ('ragflow', 'setup_required', 'Disabled until a tenant-scoped private retrieval stack is configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb),
  ('claude_code', 'developer_only', 'Development workstation or isolated development container only.', '{"runtime_class":"developer_cli","enabled_by_default":false}'::jsonb),
  ('crewai', 'setup_required', 'Disabled until a reviewed background worker is configured.', '{"runtime_class":"http_service","enabled_by_default":false}'::jsonb)
on conflict (integration_key) do update set
  status = excluded.status,
  detail = excluded.detail,
  metadata = excluded.metadata,
  updated_at = now();
