create extension if not exists pgcrypto;

-- Governed Hugging Face model, dataset, and platform-specification catalog.
-- Metadata only. This migration contains no access token, model weight, dataset row,
-- customer content, inference job, training job, or autonomous execution permission.

create table if not exists public.huggingface_resource_catalog (
  id uuid primary key default gen_random_uuid(),
  resource_key text unique not null,
  resource_type text not null check (resource_type in ('model','dataset','spec')),
  resource_id text not null,
  name text not null,
  source_url text not null,
  task text not null,
  license text not null,
  commercial_use text not null,
  runtime_class text not null,
  adoption_status text not null,
  product_areas text[] not null default '{}',
  capabilities jsonb not null default '[]'::jsonb,
  safety_rules jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  next_step text not null,
  execution_enabled boolean not null default false check (execution_enabled = false),
  human_review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists huggingface_resource_type_idx
  on public.huggingface_resource_catalog(resource_type, adoption_status);
create index if not exists huggingface_resource_task_idx
  on public.huggingface_resource_catalog(task);
create index if not exists huggingface_resource_license_idx
  on public.huggingface_resource_catalog(license);

alter table public.huggingface_resource_catalog enable row level security;

grant select on public.huggingface_resource_catalog to anon, authenticated;
grant select, insert, update, delete on public.huggingface_resource_catalog to service_role;

drop policy if exists "public reads huggingface catalog" on public.huggingface_resource_catalog;
create policy "public reads huggingface catalog"
  on public.huggingface_resource_catalog
  for select
  using (true);

drop policy if exists "service role manages huggingface catalog" on public.huggingface_resource_catalog;
create policy "service role manages huggingface catalog"
  on public.huggingface_resource_catalog
  for all
  to service_role
  using (true)
  with check (true);

insert into public.huggingface_resource_catalog (
  resource_key, resource_type, resource_id, name, source_url, task, license,
  commercial_use, runtime_class, adoption_status, product_areas, capabilities,
  safety_rules, metadata, next_step, execution_enabled, human_review_required
)
values
  ('bge_small_en_v15','model','BAAI/bge-small-en-v1.5','BGE Small English v1.5','https://huggingface.co/BAAI/bge-small-en-v1.5','text-embeddings','MIT','permissive','embedding_worker','pilot_ready',array['all','files_records','search'],'["semantic search","similarity","RAG indexing"]','["Tenant-authorized text only","Tenant-scoped vectors","Pin immutable revision"]','{"parameters":"33.4M","safetensors":true,"tei_supported":true,"languages":["en"]}','Pilot on an isolated CPU Text Embeddings Inference worker.',false,true),
  ('qwen3_embedding_06b','model','Qwen/Qwen3-Embedding-0.6B','Qwen3 Embedding 0.6B','https://huggingface.co/Qwen/Qwen3-Embedding-0.6B','text-embeddings','Apache-2.0','permissive','embedding_worker','evaluation',array['all','multilingual_search','research_lab'],'["multilingual embeddings","long-text retrieval","semantic search"]','["Benchmark latency and cost","Tenant isolation","Pin model and tokenizer"]','{"parameters":"0.6B","safetensors":true,"tei_supported":true,"multilingual":true}','Evaluate only when multilingual quality materially exceeds the smaller embedding pilot.',false,true),
  ('bge_reranker_v2_m3','model','BAAI/bge-reranker-v2-m3','BGE Reranker v2 M3','https://huggingface.co/BAAI/bge-reranker-v2-m3','text-ranking','Apache-2.0','permissive','reranker_worker','pilot_ready',array['search','research_lab','files_records'],'["query-document reranking","multilingual relevance scoring"]','["Authorized records only","Scores are not factual truth","Retain retrieval audit metadata"]','{"safetensors":true,"tei_supported":true,"multilingual":true}','Run offline retrieval benchmarks after the embedding pilot.',false,true),
  ('qwen3_4b','model','Qwen/Qwen3-4B','Qwen3 4B','https://huggingface.co/Qwen/Qwen3-4B','text-generation','Apache-2.0','permissive','text_generation_worker','evaluation',array['business_builder','creator_studio','growth_studio','private_model_mode'],'["draft generation","structured extraction","reasoning assistance"]','["Validate every output","No autonomous high-impact actions","Human approval for writes"]','{"parameters":"4B","safetensors":true,"tgi_compatible":true}','Evaluate through an isolated gateway with deterministic SONARA validation.',false,true),
  ('phi4_mini_instruct','model','microsoft/Phi-4-mini-instruct','Phi-4 Mini Instruct','https://huggingface.co/microsoft/Phi-4-mini-instruct','text-generation','MIT','permissive','text_generation_worker','review_required',array['private_model_mode','internal_assistance','multilingual_drafting'],'["instruction following","long-context drafting","multilingual text"]','["No trust_remote_code in web process","Review custom code in isolation","Treat current-fact output as stale"]','{"parameters":"3.8B","context":"128K","safetensors":true,"trust_remote_code":true}','Security-review custom code before isolated evaluation.',false,true),
  ('granite_docling_258m','model','ibm-granite/granite-docling-258M','Granite Docling 258M','https://huggingface.co/ibm-granite/granite-docling-258M','document-parsing','Apache-2.0','permissive','document_worker','pilot_ready',array['business_builder','files_records','invoices','reports'],'["OCR","layout parsing","tables","formulas","document structure"]','["Validate and scan uploads","Per-job temporary storage","Strict tenant isolation"]','{"parameters":"258M","safetensors":true,"modalities":["image","text"]}','Pilot receipt, invoice, menu, and contract extraction in a queued worker.',false,true),
  ('whisper_large_v3_turbo','model','openai/whisper-large-v3-turbo','Whisper Large v3 Turbo','https://huggingface.co/openai/whisper-large-v3-turbo','automatic-speech-recognition','MIT','permissive','speech_worker','pilot_ready',array['creator_studio','meeting_imports','voice_interface','accessibility'],'["speech transcription","multilingual ASR","timestamps"]','["Recording consent required","Minimize audio retention","Redact sensitive information when required"]','{"parameters":"0.8B","safetensors":true,"languages":99,"approximate_weights":"1.62GB"}','Pilot asynchronous transcription with consent and deletion controls.',false,true),
  ('kokoro_82m','model','hexgrad/Kokoro-82M','Kokoro 82M','https://huggingface.co/hexgrad/Kokoro-82M','text-to-speech','Apache-2.0','permissive','tts_worker','review_required',array['voice_interface','accessibility','creator_previews'],'["text-to-speech","multilingual voices","local synthesis"]','["No unauthorized voice imitation","Disclose synthetic speech where appropriate","Hash-verify and isolate legacy weight loading"]','{"parameters":"82M","safetensors":false,"pickle_weights":true}','Prefer an ONNX or reviewed safe-weight build before a voice pilot.',false,true),
  ('gliner_multi_pii_v1','model','urchade/gliner_multi_pii-v1','GLiNER Multilingual PII v1','https://huggingface.co/urchade/gliner_multi_pii-v1','pii-detection','Apache-2.0','permissive','pii_worker','review_required',array['files_records','support','meeting_imports','privacy'],'["PII entity detection","multilingual redaction assistance"]','["Probabilistic output cannot replace access control","Measure false negatives","Isolate hash-pinned weight loading"]','{"languages":["en","fr","de","es","pt","it"],"safetensors":false,"pickle_weights":true}','Evaluate with rule-based checks and mandatory human review.',false,true),
  ('siglip2_base_224','model','google/siglip2-base-patch16-224','SigLIP 2 Base 224','https://huggingface.co/google/siglip2-base-patch16-224','image-text-retrieval','Apache-2.0','permissive','vision_worker','evaluation',array['creator_studio','asset_search','catalog_tagging'],'["image-text embeddings","zero-shot image classification","asset retrieval"]','["No sensitive-trait inference","Content organization only","Test labeling bias"]','{"safetensors":true,"approximate_repository_size":"1.54GB"}','Evaluate for asset search and duplicate discovery only.',false,true),
  ('clap_htsat_unfused','model','laion/clap-htsat-unfused','CLAP HTSAT Unfused','https://huggingface.co/laion/clap-htsat-unfused','audio-text-embeddings','Apache-2.0','permissive','audio_embedding_worker','review_required',array['creator_studio','audio_search','sound_tagging'],'["audio-text similarity","audio embeddings","semantic sound search"]','["Scores do not prove ownership","Hash-pin and isolate legacy weights","Evaluate music and speech bias separately"]','{"approximate_repository_size":"618MB","safetensors":false,"pickle_weights":true}','Evaluate on SONARA-owned audio after serialization review.',false,true),
  ('flux1_schnell','model','black-forest-labs/FLUX.1-schnell','FLUX.1 Schnell','https://huggingface.co/black-forest-labs/FLUX.1-schnell','text-to-image','Apache-2.0','permissive','image_generation_worker','review_required',array['creator_studio','marketing_concepts','draft_artwork'],'["text-to-image generation","rapid concept rendering"]','["Content moderation required","Store model and prompt provenance","No deceptive or rights-violating content"]','{"parameters":"12B","safetensors":true,"gated":true,"approximate_weights":"23.8GB"}','Use only after gated-access, cost, rights, and moderation review.',false,true),
  ('phi4_multimodal','model','microsoft/Phi-4-multimodal-instruct','Phi-4 Multimodal Instruct','https://huggingface.co/microsoft/Phi-4-multimodal-instruct','multimodal-assistance','MIT','permissive','multimodal_worker','review_required',array['research_lab','document_audio_experiments','accessibility'],'["speech recognition","speech summarization","visual question answering","multimodal generation"]','["No custom code in web process","Separate consent by modality","No biometric or high-impact decisions"]','{"approximate_repository_size":"12.9GB","safetensors":true,"trust_remote_code":true}','Keep research-only until custom-code review proves material advantage.',false,true),
  ('stable_audio_open_10','model','stabilityai/stable-audio-open-1.0','Stable Audio Open 1.0','https://huggingface.co/stabilityai/stable-audio-open-1.0','text-to-audio','Stability AI Community License','conditional','audio_generation_worker','license_review',array['creator_studio','sound_effect_concepts'],'["text-to-audio","short music and sound generation"]','["Legal review required","Comply with registration attribution and revenue terms","Track provenance and rights review"]','{"safetensors":true,"gated":true,"commercial_threshold":"$1,000,000 annual revenue","registration_required":true}','Do not enable until current license and attribution terms are approved.',false,true),
  ('musicgen_small','model','facebook/musicgen-small','MusicGen Small','https://huggingface.co/facebook/musicgen-small','text-to-music','CC-BY-NC-4.0 model weights','noncommercial','audio_generation_worker','blocked_commercial',array['research_lab'],'["text-to-music","audio-conditioned music generation"]','["Noncommercial model weights","No paid-product exposure","Outputs do not prove rights clearance"]','{"parameters":"300M","safetensors":true,"code_license":"MIT"}','Retain only as a research comparison.',false,true),
  ('mert_v1_95m','model','m-a-p/MERT-v1-95M','MERT v1 95M','https://huggingface.co/m-a-p/MERT-v1-95M','music-understanding','CC-BY-NC-4.0','noncommercial','audio_embedding_worker','blocked_commercial',array['research_lab'],'["music feature extraction","music representation learning"]','["Noncommercial license","Custom code supply-chain risk","No production installation"]','{"parameters":"95M","trust_remote_code":true,"safetensors":false}','Use only for authorized offline comparison or replace with a permissive model.',false,true),

  ('banking77','dataset','PolyAI/banking77','BANKING77','https://huggingface.co/datasets/PolyAI/banking77','intent-classification','CC-BY-4.0','permissive_with_attribution','dataset_evaluation','evaluation',array['business_builder','support','voice_interface'],'["fine-grained customer-service intent evaluation"]','["Evaluation or controlled fine-tuning only","Preserve attribution","Do not assume banking intents match SONARA"]','{"rows":13083,"intents":77,"language":"en"}','Map a subset to SONARA support taxonomy as a benchmark.',false,true),
  ('minds14','dataset','PolyAI/minds14','MInDS-14','https://huggingface.co/datasets/PolyAI/minds14','spoken-intent-detection','CC-BY-4.0','permissive_with_attribution','dataset_evaluation','evaluation',array['voice_interface','business_builder','accessibility'],'["multilingual spoken-intent evaluation","ASR and intent testing"]','["Preserve attribution","Keep evaluation data separate from customer records","Measure each accent and language separately"]','{"languages":14,"approximate_size":"1.13GB"}','Use selected language subsets to benchmark voice routing.',false,true),
  ('fleurs','dataset','google/fleurs','FLEURS','https://huggingface.co/datasets/google/fleurs','multilingual-speech-evaluation','CC-BY-4.0','permissive_with_attribution','dataset_evaluation','evaluation',array['voice_interface','accessibility','research_lab'],'["multilingual ASR evaluation","language coverage testing"]','["Stream narrow subsets only","Preserve attribution","Read speech differs from real-world noise"]','{"languages":102,"approximate_size":"878GB","streaming_required":true}','Use small streamed validation subsets for supported languages.',false,true),
  ('mmlu','dataset','cais/mmlu','MMLU','https://huggingface.co/datasets/cais/mmlu','general-knowledge-evaluation','MIT','permissive','dataset_evaluation','evaluation',array['research_lab','model_gateway_evaluation'],'["multi-domain multiple-choice evaluation"]','["One evaluation signal only","Do not market scores as reliability","Keep test splits out of tuning"]','{"domains":57,"approximate_repository_size":"270MB"}','Add a small reproducible evaluation slice for candidate text models.',false,true),
  ('gsm8k','dataset','openai/gsm8k','GSM8K','https://huggingface.co/datasets/openai/gsm8k','reasoning-evaluation','MIT','permissive','dataset_evaluation','evaluation',array['research_lab','formula_system_evaluation'],'["multi-step arithmetic reasoning evaluation"]','["Keep test data separate from tuning","Verify answers deterministically","Do not infer business accuracy from school math"]','{"rows":"8.5K","formats":["parquet"]}','Compare candidate reasoning with SONARA deterministic formulas.',false,true),
  ('fineweb_edu','dataset','HuggingFaceFW/fineweb-edu','FineWeb-Edu','https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu','language-model-training-corpus','ODC-By-1.0 plus Common Crawl terms','conditional','dataset_evaluation','research_only',array['research_lab'],'["large-scale educational web corpus"]','["No current-stack ingestion or training","Mandatory provenance privacy copyright review","Streaming does not remove governance obligations"]','{"approximate_size":"5.84TB","rows":"1.53B","streaming_required":true,"unsafe_file_reported":true}','Catalog only until a separate data-governance and training program exists.',false,true),
  ('funsd_layoutlmv2','dataset','nielsr/FUNSD_layoutlmv2','FUNSD LayoutLMv2 Variant','https://huggingface.co/datasets/nielsr/FUNSD_layoutlmv2','form-understanding-evaluation','Unverified in retrieved dataset card','unknown','dataset_evaluation','blocked_license_review',array['document_worker_evaluation'],'["annotated form layout evaluation"]','["Verify authoritative license before ingestion","Prefer synthetic SONARA forms"]','{"images_resized":"224x224"}','Verify source and license before any use.',false,true),

  ('model_cards','spec','model_cards','Model Cards','https://huggingface.co/docs/hub/model-cards','governance','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["intended-use documentation","limitations","training data","evaluation metadata"]','["External code is not automatically executed"]','{}','Require a SONARA model card for every approved revision.',false,true),
  ('dataset_cards','spec','dataset_cards','Dataset Cards','https://huggingface.co/docs/hub/datasets-cards','data-governance','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["license metadata","bias documentation","dataset structure","responsible-use context"]','["External code is not automatically executed"]','{}','Require a dataset card and license record before ingestion.',false,true),
  ('safetensors','spec','safetensors','Safetensors','https://huggingface.co/docs/safetensors/index','model-serialization','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["non-pickle tensor loading","zero-copy reads","partial tensor access"]','["External code is not automatically executed"]','{}','Prefer Safetensors and reject unreviewed pickle weights.',false,true),
  ('hub_security','spec','hub_security','Hub Security Scanning','https://huggingface.co/docs/hub/security','supply-chain-security','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["malware scanning","pickle import scanning","secret scanning","signed commits"]','["Hub scans supplement but do not replace SONARA review"]','{}','Record scan state owner revision hashes and signatures before deployment.',false,true),
  ('hub_api','spec','hub_api','Hub OpenAPI and REST API','https://huggingface.co/docs/hub/api','metadata-integration','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["model metadata","dataset metadata","repository revisions","webhooks"]','["Use read-only scopes first"]','{}','Use read-only metadata calls and keep write scopes disabled.',false,true),
  ('transformers_js','spec','transformers_js','Transformers.js','https://huggingface.co/docs/transformers.js/en/index','browser-inference','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["ONNX browser inference","NLP","vision","audio"]','["Only small reviewed models","No browser secrets or unrestricted downloads"]','{}','Allow only reviewed small ONNX models after privacy and performance review.',false,true),
  ('text_embeddings_inference','spec','text_embeddings_inference','Text Embeddings Inference','https://huggingface.co/docs/text-embeddings-inference/en/index','embedding-serving','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["dynamic batching","Safetensors loading","OpenTelemetry","Prometheus metrics"]','["Run as an isolated service"]','{}','Use TEI as the preferred isolated embedding pilot service.',false,true),
  ('inference_endpoints','spec','inference_endpoints','Inference Endpoints','https://huggingface.co/docs/inference-endpoints/about','managed-inference','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["managed engines","autoscaling","scale-to-zero","private endpoints"]','["Compare privacy cost and network controls before use"]','{}','Compare managed endpoint cost and security with self-hosted workers.',false,true),
  ('dataset_streaming','spec','dataset_streaming','Datasets Streaming','https://huggingface.co/docs/datasets/stream','dataset-access','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["iterable streaming","partial exploration","large-dataset access"]','["Enforce sample and byte limits"]','{}','Stream bounded evaluation subsets only.',false,true),
  ('croissant','spec','croissant','Croissant Dataset Metadata','https://huggingface.co/docs/dataset-viewer/croissant','dataset-interoperability','Documentation/reference specification','metadata_only','platform_spec','spec_adopted',array['platform_governance'],'["JSON-LD metadata","schema.org dataset description","Parquet distributions"]','["Metadata does not authorize data use"]','{}','Store Croissant metadata snapshots for approved dataset revisions.',false,true)
on conflict (resource_key) do update set
  resource_type = excluded.resource_type,
  resource_id = excluded.resource_id,
  name = excluded.name,
  source_url = excluded.source_url,
  task = excluded.task,
  license = excluded.license,
  commercial_use = excluded.commercial_use,
  runtime_class = excluded.runtime_class,
  adoption_status = excluded.adoption_status,
  product_areas = excluded.product_areas,
  capabilities = excluded.capabilities,
  safety_rules = excluded.safety_rules,
  metadata = excluded.metadata,
  next_step = excluded.next_step,
  execution_enabled = false,
  human_review_required = true,
  updated_at = now();

insert into public.integration_providers (
  provider_key, name, category, connection_mode, capabilities, status
)
values (
  'huggingface_hub',
  'Hugging Face Hub',
  'other',
  'api',
  '{"metadata_probe":true,"model_execution_enabled":false,"dataset_ingestion_enabled":false,"training_enabled":false,"write_scope_enabled":false}'::jsonb,
  'manual_review'
)
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

insert into public.integration_statuses (integration_key, status, detail, metadata)
values (
  'huggingface_hub',
  'cataloged_disabled',
  'Curated metadata catalog is available. Model execution, dataset ingestion, training, and write access remain disabled.',
  '{"metadata_probe":true,"execution_enabled":false,"dataset_ingestion_enabled":false,"training_enabled":false,"token_stored_in_database":false}'::jsonb
)
on conflict (integration_key) do update set
  status = excluded.status,
  detail = excluded.detail,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.huggingface_resource_catalog is
  'Governed Hugging Face resource metadata. No credentials, model files, dataset rows, or execution permissions.';
