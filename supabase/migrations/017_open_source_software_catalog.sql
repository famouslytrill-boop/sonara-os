create extension if not exists pgcrypto;

-- =========================================================
-- SONARA Open Source Software Catalog
-- Tracks open-source tools mentioned during SONARA planning without installing them into production.
-- Each tool must be reviewed for license, security, hosting cost, and product fit before activation.
-- =========================================================

create table if not exists public.open_source_software_catalog (
  id uuid primary key default gen_random_uuid(),
  tool_key text unique not null,
  name text not null,
  category text not null,
  product_area text not null,
  use_case text not null,
  integration_mode text not null default 'adapter_candidate' check (integration_mode in ('dependency','service','adapter_candidate','manual_export','self_hosted','external_api','research_only','disabled')),
  maturity_status text not null default 'review_required' check (maturity_status in ('active','review_required','research_only','deferred','disabled')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  license_review_required boolean not null default true,
  security_review_required boolean not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.open_source_software_capabilities (
  id uuid primary key default gen_random_uuid(),
  tool_key text references public.open_source_software_catalog(tool_key) on delete cascade,
  capability_key text not null,
  label text not null,
  description text,
  status text not null default 'planned' check (status in ('planned','active','blocked','disabled')),
  created_at timestamptz default now(),
  unique(tool_key, capability_key)
);

create table if not exists public.open_source_adapter_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tool_key text references public.open_source_software_catalog(tool_key) on delete restrict,
  run_type text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','manual_required','cancelled')),
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists oss_catalog_category_idx on public.open_source_software_catalog(category);
create index if not exists oss_catalog_product_area_idx on public.open_source_software_catalog(product_area);
create index if not exists oss_adapter_runs_org_idx on public.open_source_adapter_runs(organization_id, status);

alter table public.open_source_software_catalog enable row level security;
alter table public.open_source_software_capabilities enable row level security;
alter table public.open_source_adapter_runs enable row level security;

drop policy if exists "public read reviewed oss catalog" on public.open_source_software_catalog;
create policy "public read reviewed oss catalog"
on public.open_source_software_catalog
for select
using (maturity_status in ('active','review_required','research_only'));

drop policy if exists "public read oss capabilities" on public.open_source_software_capabilities;
create policy "public read oss capabilities"
on public.open_source_software_capabilities
for select
using (true);

drop policy if exists "service role manages oss catalog" on public.open_source_software_catalog;
create policy "service role manages oss catalog"
on public.open_source_software_catalog
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages oss capabilities" on public.open_source_software_capabilities;
create policy "service role manages oss capabilities"
on public.open_source_software_capabilities
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages oss adapter runs" on public.open_source_adapter_runs;
create policy "service role manages oss adapter runs"
on public.open_source_adapter_runs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.open_source_software_catalog (tool_key, name, category, product_area, use_case, integration_mode, maturity_status, risk_level, notes)
values
('fastapi','FastAPI','backend','all','Python service APIs for heavier AI, audio, OCR, and automation workers.','service','review_required','medium','Use as isolated service layer, not inside the Express runtime.'),
('postgresql','PostgreSQL','database','all','Primary relational database foundation.','service','active','low','Supabase already provides managed Postgres.'),
('pgvector','pgvector','database_ai','all','Vector search inside Postgres for embeddings and semantic lookup.','dependency','review_required','medium','Enable only when embedding workload is ready.'),
('postgis','PostGIS','database_geo','business_builder','Location and route features for job sites, food trucks, deliveries, and service areas.','dependency','review_required','medium','Useful for advanced geospatial queries.'),
('supabase','Supabase','platform','all','Auth, database, storage, realtime, edge functions, and managed Postgres.','service','active','medium','Existing platform dependency.'),
('keycloak','Keycloak','identity','all','Enterprise identity and SSO option.','self_hosted','deferred','medium','Optional later for enterprise plans.'),
('authentik','Authentik','identity','all','Self-hosted identity provider alternative.','self_hosted','deferred','medium','Review before enterprise rollout.'),
('opa','Open Policy Agent','security','all','Policy engine for access and authorization decisions.','service','review_required','medium','Useful for centralized access policy.'),
('casbin','Casbin','security','all','Role/access policy enforcement library.','dependency','review_required','medium','Potential app-level permission layer.'),
('vault','Vault','security','all','Secret management.','self_hosted','deferred','high','Only use with proper operational capacity.'),
('openbao','OpenBao','security','all','Open-source secret management alternative.','self_hosted','deferred','high','Only use with proper operational capacity.'),
('sops','SOPS','security','all','Encrypted config and secret file management.','manual_export','review_required','medium','Good for infrastructure secrets outside app runtime.'),
('trivy','Trivy','security','all','Container and dependency vulnerability scanning.','service','review_required','medium','CI security scanner candidate.'),
('falco','Falco','security','all','Runtime threat detection.','self_hosted','deferred','high','Use later if Kubernetes runtime exists.'),
('wazuh','Wazuh','security','all','Security monitoring and SIEM.','self_hosted','deferred','high','Operationally heavier.'),
('sigstore_cosign','Sigstore Cosign','security','all','Artifact signing and supply-chain verification.','service','review_required','medium','Useful for container/image signing.'),
('docker','Docker','infrastructure','all','Local containers and deployment packaging.','service','active','medium','Existing development/deployment tool.'),
('kubernetes','Kubernetes','infrastructure','all','Cluster orchestration for larger deployments.','self_hosted','deferred','high','Do not add until operational need exists.'),
('k3s','K3s','infrastructure','all','Lightweight Kubernetes option.','self_hosted','deferred','high','Good later for low-cost cluster hosting.'),
('helm','Helm','infrastructure','all','Kubernetes package deployment.','manual_export','deferred','medium','Only relevant after Kubernetes.'),
('argo_cd','Argo CD','infrastructure','all','GitOps deployments.','self_hosted','deferred','medium','Later infrastructure maturity.'),
('opentofu','OpenTofu','infrastructure','all','Infrastructure as code.','manual_export','review_required','medium','Terraform-compatible open-source workflow.'),
('terraform','Terraform','infrastructure','all','Infrastructure as code candidate.','manual_export','review_required','medium','License and product fit review required.'),
('ansible','Ansible','infrastructure','all','Server automation and provisioning.','manual_export','review_required','medium','Useful for self-hosted stacks.'),
('coolify','Coolify','hosting','all','Self-hosted platform hosting option.','self_hosted','deferred','medium','Alternative to managed deployment later.'),
('proxmox','Proxmox VE','hosting','all','Self-hosted virtualization platform.','self_hosted','deferred','high','Only if running owned servers.'),
('talos','Talos Linux','hosting','all','Minimal Kubernetes OS.','self_hosted','deferred','high','Advanced infrastructure only.'),
('nginx','Nginx','network','all','Reverse proxy and routing.','service','deferred','medium','Useful in self-hosted environments.'),
('caddy','Caddy','network','all','Reverse proxy with automatic TLS.','service','deferred','medium','Useful in self-hosted environments.'),
('cert_manager','cert-manager','network','all','TLS certificate automation in Kubernetes.','self_hosted','deferred','medium','Kubernetes only.'),
('redis','Redis','database_cache','all','Caching and queue support.','service','review_required','medium','Use managed or Valkey alternative.'),
('valkey','Valkey','database_cache','all','Open Redis-compatible cache candidate.','service','review_required','medium','Cache/queue candidate.'),
('minio','MinIO','storage','all','S3-compatible object storage.','self_hosted','deferred','medium','Alternative object storage.'),
('opensearch','OpenSearch','search','all','Search and analytics engine.','self_hosted','deferred','medium','Heavy for early stage.'),
('meilisearch','Meilisearch','search','all','Fast search for pages, products, docs, and catalog records.','service','review_required','low','Good lightweight search candidate.'),
('typesense','Typesense','search','all','Fast typo-tolerant search.','service','review_required','low','Marketplace/search candidate.'),
('qdrant','Qdrant','vector_database','all','Vector database for semantic search and recommendations.','service','review_required','medium','Use when embeddings are ready.'),
('milvus','Milvus','vector_database','all','Large-scale vector database candidate.','self_hosted','deferred','medium','Heavier than Qdrant.'),
('weaviate','Weaviate','vector_database','all','Vector database and semantic search candidate.','service','review_required','medium','Review hosted/self-hosted path.'),
('chroma','Chroma','vector_database','creator_studio','Local/simple vector store for prototypes.','research_only','research_only','medium','Good for prototypes, not production until reviewed.'),
('faiss','Faiss','vector_database','creator_studio','Local vector similarity search library.','dependency','review_required','medium','Use inside worker services.'),
('clickhouse','ClickHouse','analytics','growth_studio','High-volume analytics/event storage.','service','deferred','medium','Later analytics infrastructure.'),
('duckdb','DuckDB','analytics','all','Embedded analytics and local reporting.','dependency','review_required','low','Useful for offline reports.'),
('polars','Polars','analytics','all','Fast dataframe processing in workers.','dependency','review_required','low','Use in Python worker services.'),
('apache_arrow','Apache Arrow','analytics','all','Columnar data interchange.','dependency','review_required','low','Good for data pipelines.'),
('posthog','PostHog','analytics','all','Product analytics, events, funnels, and feature flags.','service','review_required','medium','Useful for growth and product metrics.'),
('matomo','Matomo','analytics','all','Privacy-friendly web analytics.','self_hosted','review_required','medium','Alternative analytics option.'),
('metabase','Metabase','analytics','all','Business intelligence dashboards.','self_hosted','review_required','medium','Good admin/reporting candidate.'),
('prometheus','Prometheus','observability','all','Metrics collection.','self_hosted','review_required','medium','Useful for operations.'),
('grafana','Grafana','observability','all','Dashboards and metrics visualization.','self_hosted','review_required','medium','Useful for admin observability.'),
('loki','Loki','observability','all','Log aggregation.','self_hosted','deferred','medium','Add after logging design.'),
('tempo','Tempo','observability','all','Distributed tracing backend.','self_hosted','deferred','medium','Add after OpenTelemetry.'),
('opentelemetry','OpenTelemetry','observability','all','Traces, metrics, logs instrumentation.','dependency','review_required','medium','Good for production readiness.'),
('uptime_kuma','Uptime Kuma','observability','all','Uptime monitoring.','self_hosted','review_required','low','Simple monitoring candidate.'),
('essentia','Essentia','audio_ai','creator_studio','Audio feature extraction, analysis, mood, rhythm, and timbre analysis.','service','review_required','medium','Use inside Python audio worker.'),
('librosa','librosa','audio_ai','creator_studio','Audio analysis, tempo, features, beat and spectral tools.','dependency','review_required','medium','Use inside Python audio worker.'),
('demucs','Demucs','audio_ai','creator_studio','Stem separation for vocals, drums, bass, and instruments.','service','review_required','medium','GPU/CPU cost review required.'),
('basic_pitch','Basic Pitch','audio_ai','creator_studio','Audio-to-MIDI transcription candidate.','service','review_required','medium','Use in worker, not browser.'),
('music21','music21','music_theory','creator_studio','Music theory, notation, harmony and analysis tools.','dependency','review_required','low','Useful for song analysis.'),
('lilypond','LilyPond','music_notation','creator_studio','Sheet music engraving and notation export.','manual_export','review_required','medium','Worker/export tool candidate.'),
('openl3','OpenL3','audio_ai','creator_studio','Audio embeddings for similarity and recommendation.','dependency','review_required','medium','Use in worker with vector database.'),
('chromaprint','Chromaprint','audio_fingerprint','creator_studio','Audio fingerprinting for duplicate/reference checks.','dependency','review_required','medium','Review AcoustID usage separately.'),
('mutagen','Mutagen','audio_metadata','creator_studio','Audio metadata reading and writing.','dependency','review_required','low','Good for file metadata.'),
('ffmpeg','FFmpeg','media','creator_studio','Audio/video conversion, export, transcoding, waveform generation.','service','review_required','medium','Core media worker tool.'),
('obs_studio','OBS Studio','media','creator_studio','Recording and streaming workflow support.','manual_export','review_required','medium','Desktop workflow integration first.'),
('whisper_cpp','whisper.cpp','speech','creator_studio','Local speech-to-text candidate.','service','review_required','medium','Use in worker with consent.'),
('faster_whisper','faster-whisper','speech','creator_studio','Speech-to-text service candidate.','service','review_required','medium','Use in worker.'),
('vosk','Vosk','speech','creator_studio','Offline speech recognition candidate.','service','review_required','medium','Use in worker.'),
('melo_tts','MeloTTS','speech','creator_studio','Voice generation research candidate.','research_only','research_only','high','Licensing, consent, and safety review required.'),
('paddlespeech','PaddleSpeech','speech','creator_studio','Speech and audio AI research toolkit.','research_only','research_only','high','Review before product use.'),
('paddleocr','PaddleOCR','ocr','business_builder','OCR for invoices, documents, receipts, and forms.','service','review_required','medium','Use in backend worker.'),
('tesseract','Tesseract OCR','ocr','business_builder','OCR engine for documents and receipts.','service','review_required','medium','Good low-cost candidate.'),
('doctr','docTR','ocr','business_builder','Document OCR and layout understanding.','service','review_required','medium','Use in OCR worker.'),
('pdfplumber','pdfplumber','documents','business_builder','PDF table/text extraction.','dependency','review_required','low','Useful for invoice and legal docs.'),
('camelot','Camelot','documents','business_builder','PDF table extraction.','dependency','review_required','medium','Useful for structured PDFs.'),
('unstructured','Unstructured','documents','all','Document parsing and chunking for knowledge workflows.','service','review_required','medium','Useful for RAG/document ingestion.'),
('invoice2data','invoice2data','documents','business_builder','Invoice data extraction.','dependency','review_required','medium','Useful for restaurant/vendor invoice workflows.'),
('marker','Marker','documents','all','Document-to-markdown extraction candidate.','research_only','review_required','medium','Review accuracy and license.'),
('mineru','MinerU','documents','all','Document extraction candidate.','research_only','review_required','medium','Review before product use.'),
('flowise','Flowise','automation_ai','all','Visual LLM/RAG workflow builder.','self_hosted','review_required','medium','Optional workflow builder.'),
('n8n','n8n','automation','growth_studio','Automation workflows and integrations.','self_hosted','review_required','medium','Review licensing and hosting path.'),
('activepieces','Activepieces','automation','growth_studio','Open-source automation workflows.','self_hosted','review_required','medium','Automation alternative.'),
('temporal','Temporal','automation','all','Reliable workflow orchestration.','service','deferred','medium','Useful once background jobs mature.'),
('airflow','Apache Airflow','automation','all','Scheduled data pipelines.','self_hosted','deferred','medium','Heavy for early stage.'),
('argo_workflows','Argo Workflows','automation','all','Kubernetes workflow engine.','self_hosted','deferred','medium','Kubernetes only.'),
('ray','Ray','ai_compute','all','Distributed compute and AI task orchestration.','service','review_required','medium','Use for larger AI workloads.'),
('optuna','Optuna','ai_compute','all','Optimization and experiment tuning.','dependency','review_required','low','Useful for model/workflow tuning.'),
('mlflow','MLflow','ai_ops','all','Experiment tracking and model registry.','service','review_required','medium','Use if internal models/workers mature.'),
('dvc','DVC','ai_ops','all','Data/model versioning.','manual_export','review_required','medium','Useful for ML workflow governance.'),
('ollama','Ollama','local_ai','all','Local LLM runtime for development or private workflows.','manual_export','review_required','medium','Local/dev option.'),
('open_webui','Open WebUI','local_ai','all','Local LLM web interface.','self_hosted','deferred','medium','Use only for internal/admin workflows.'),
('vllm','vLLM','ai_inference','all','LLM serving engine.','service','deferred','high','GPU hosting cost review required.'),
('onnx_runtime','ONNX Runtime','ai_inference','all','Model inference runtime.','dependency','review_required','medium','Worker service candidate.'),
('pytorch','PyTorch','ai_ml','all','Machine learning framework.','dependency','review_required','medium','Use in worker services only.'),
('jax','JAX','ai_ml','all','ML/accelerated computing framework.','research_only','deferred','medium','Research only for now.'),
('scikit_learn','scikit-learn','ai_ml','all','Classical ML toolkit.','dependency','review_required','low','Worker service candidate.'),
('xgboost','XGBoost','ai_ml','growth_studio','Prediction/ranking candidate.','dependency','review_required','low','Use after real data exists.'),
('lightgbm','LightGBM','ai_ml','growth_studio','Prediction/ranking candidate.','dependency','review_required','low','Use after real data exists.'),
('catboost','CatBoost','ai_ml','growth_studio','Prediction/ranking candidate.','dependency','review_required','low','Use after real data exists.'),
('or_tools','OR-Tools','optimization','business_builder','Scheduling, routing, assignment optimization.','dependency','review_required','medium','Useful for staff schedules/routes.'),
('scipy','SciPy','optimization','all','Scientific computing and optimization.','dependency','review_required','low','Worker service candidate.'),
('cvxpy','CVXPY','optimization','business_builder','Optimization models.','dependency','review_required','medium','Use in advanced scheduling/pricing later.'),
('networkx','NetworkX','optimization','growth_studio','Graph analysis and network workflows.','dependency','review_required','low','Useful for campaign/relationship graphs.'),
('noco_db','NocoDB','data_tools','all','No-code database interface candidate.','self_hosted','review_required','medium','Internal/admin tool option.'),
('ckan','CKAN','data_tools','growth_studio','Open data portal workflows.','self_hosted','deferred','medium','Useful for public data products later.'),
('scrapy','Scrapy','data_ingest','growth_studio','Web data collection framework.','service','review_required','high','Use only with legal/robots review.'),
('playwright','Playwright','data_ingest','growth_studio','Browser automation and testing.','dependency','review_required','medium','Testing and controlled automation.'),
('odoo','Odoo','business_ops','business_builder','ERP/business operations reference or integration candidate.','self_hosted','review_required','medium','Review modules and licensing before use.'),
('medusa','Medusa','commerce','business_builder','Commerce backend candidate.','self_hosted','review_required','medium','Review fit before adding.'),
('saleor','Saleor','commerce','business_builder','Commerce platform candidate.','self_hosted','review_required','medium','Review fit before adding.'),
('vendure','Vendure','commerce','business_builder','Commerce backend candidate.','self_hosted','review_required','medium','Review fit before adding.'),
('beets','beets','music_library','creator_studio','Music library tagging and organization.','manual_export','review_required','low','Useful for creator catalog workflows.'),
('livekit','LiveKit','realtime_media','creator_studio','Realtime audio/video sessions.','service','review_required','medium','Candidate for collaboration.'),
('jitsi','Jitsi Meet','realtime_media','creator_studio','Video meeting/collaboration option.','self_hosted','review_required','medium','Review hosting cost.'),
('peertube','PeerTube','video_platform','creator_studio','Federated video hosting candidate.','self_hosted','deferred','medium','Review before product use.'),
('owncast','Owncast','streaming','creator_studio','Self-hosted live streaming.','self_hosted','deferred','medium','Review before product use.'),
('icecast','Icecast','streaming','creator_studio','Audio streaming server.','self_hosted','deferred','medium','Useful for radio/audio stream workflows.'),
('azuracast','AzuraCast','streaming','creator_studio','Web radio management.','self_hosted','deferred','medium','Review if radio product returns.'),
('libretime','LibreTime','streaming','creator_studio','Radio automation.','self_hosted','deferred','medium','Review if radio product returns.'),
('media_mtx','MediaMTX','streaming','creator_studio','Media streaming server.','self_hosted','deferred','medium','Advanced streaming infrastructure.'),
('ovenmediaengine','OvenMediaEngine','streaming','creator_studio','Low-latency streaming server.','self_hosted','deferred','medium','Advanced streaming infrastructure.'),
('openstreetmap','OpenStreetMap','maps','business_builder','Maps and location context.','external_api','review_required','medium','Usage policy and provider review required.'),
('gtfs','GTFS / GTFS Realtime','transit','growth_studio','Transit data workflows.','adapter_candidate','deferred','low','Useful for civic/location products later.'),
('open311','Open311','civic','growth_studio','Civic request data workflows.','adapter_candidate','deferred','low','Optional future public service module.'),
('decidim','Decidim','civic','growth_studio','Civic participation platform.','self_hosted','deferred','medium','Optional future civic module.'),
('consul','Consul Democracy','civic','growth_studio','Civic participation platform.','self_hosted','deferred','medium','Optional future civic module.'),
('zxing','ZXing','barcode','business_builder','Barcode and QR scanning.','dependency','review_required','low','Useful for inventory and tickets.'),
('html5_qrcode','html5-qrcode','barcode','business_builder','Browser QR scanning.','dependency','review_required','medium','Review browser privacy and UX.'),
('qrcode_js','QRCode.js','barcode','business_builder','QR code generation.','dependency','review_required','low','Good for links/check-ins.'),
('nvidia_cosmos','NVIDIA Cosmos','ai_video','creator_studio','AI video/world model research candidate.','research_only','research_only','high','Research only until licensing/cost reviewed.'),
('domoticz','Domoticz','iot','business_builder','IoT/home automation reference candidate.','self_hosted','deferred','medium','Potential device/location workflow inspiration.'),
('cockroachdb','CockroachDB','database','all','Distributed SQL database candidate.','self_hosted','deferred','medium','Not needed while Supabase/Postgres is primary.'),
('chef','Chef','infrastructure','all','Configuration management candidate.','manual_export','deferred','medium','Ansible/OpenTofu likely simpler first.')
on conflict (tool_key) do update set
  name = excluded.name,
  category = excluded.category,
  product_area = excluded.product_area,
  use_case = excluded.use_case,
  integration_mode = excluded.integration_mode,
  maturity_status = excluded.maturity_status,
  risk_level = excluded.risk_level,
  notes = excluded.notes,
  updated_at = now();

insert into public.open_source_software_capabilities (tool_key, capability_key, label, description, status)
select tool_key, 'cataloged', 'Cataloged', 'Tool is tracked in SONARA open-source software catalog for review and adapter planning.', 'planned'
from public.open_source_software_catalog
on conflict (tool_key, capability_key) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status;
