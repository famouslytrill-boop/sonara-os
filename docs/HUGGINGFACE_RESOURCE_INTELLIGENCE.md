# Hugging Face Resource Intelligence

## Purpose

SONARA maintains a governed catalog of selected Hugging Face models, datasets, and platform specifications that may improve Business Builder, Creator Studio, Growth Studio, Files & Records, voice workflows, search, accessibility, and internal research.

The catalog is an intake and decision system. It does **not** install models, download datasets, run remote code, train models, or enable inference inside the production Express/Vercel request process.

## Runtime surfaces

- Public JSON: `/api/ecosystem/huggingface`
- Public Research Lab page: `/research-lab/huggingface`
- Founder readiness JSON: `/api/admin/huggingface/readiness`
- Founder control page: `/admin/huggingface`

The founder readiness probe performs one bounded `GET` request for public metadata about `BAAI/bge-small-en-v1.5`. It never performs inference and never returns `HF_TOKEN`.

## Scan method

The intake review uses the authoritative Hugging Face model page, dataset page, repository file metadata, model card, dataset card, license field, serialization format, custom-code requirement, gated status, approximate size, task classification, and official platform documentation.

A resource is not admitted merely because it is popular. Selection requires an identifiable product fit, a usable license posture, a realistic runtime placement, explicit safety boundaries, and a staged next action.

## Recommended first pilots

### 1. Semantic search

- `BAAI/bge-small-en-v1.5`
- `BAAI/bge-reranker-v2-m3`
- Text Embeddings Inference

Use an isolated CPU worker, tenant-scoped vectors, immutable revisions, deterministic chunking, and offline relevance evaluations. `Qwen/Qwen3-Embedding-0.6B` is an optional multilingual comparison, not the default first deployment.

### 2. Document intelligence

- `ibm-granite/granite-docling-258M`

Pilot receipts, invoices, menus, forms, and contracts through a queue-backed worker with malware scanning, MIME validation, file-size limits, per-job temporary storage, and tenant isolation.

### 3. Speech transcription

- `openai/whisper-large-v3-turbo`

Pilot user-uploaded audio only after recording-consent, retention, deletion, access-control, and sensitive-data handling rules are enforced.

### 4. Asset search

- `google/siglip2-base-patch16-224`
- `laion/clap-htsat-unfused` after legacy-weight review

Use only for creator-asset organization and similarity. Scores must not be used to determine identity, sensitive traits, copyright ownership, or rights clearance.

## Later evaluations

Text generation, image generation, speech synthesis, and multimodal assistance remain isolated evaluations until model-specific validation, moderation, cost, licensing, privacy, and human-approval controls are complete.

Examples include:

- `Qwen/Qwen3-4B`
- `microsoft/Phi-4-mini-instruct`
- `microsoft/Phi-4-multimodal-instruct`
- `black-forest-labs/FLUX.1-schnell`
- `hexgrad/Kokoro-82M`
- `urchade/gliner_multi_pii-v1`

Models requiring `trust_remote_code` or legacy pickle serialization do not run in the web process. Custom code must be reviewed and vendored into an isolated, reproducible worker image. Legacy weights require source verification, immutable revision pins, file hashes, and a locked-down loader.

## Restricted and blocked resources

### Commercially blocked

- `facebook/musicgen-small`: model weights are noncommercial.
- `m-a-p/MERT-v1-95M`: noncommercial license and custom-code risk.

These resources may be retained only as offline research comparisons on authorized data. They cannot power paid SONARA products.

### Legal review required

- `stabilityai/stable-audio-open-1.0`: gated model with a community license, registration, attribution, acceptable-use, and revenue-related commercial conditions.

It remains disabled until the current license is approved for the intended SONARA use.

### Dataset-license verification required

- `nielsr/FUNSD_layoutlmv2`: the retrieved card did not provide a sufficiently verified license for production adoption.

Synthetic SONARA forms are the default document-evaluation source until the authoritative license is confirmed.

### Catalog only

- `HuggingFaceFW/fineweb-edu`: web-scale corpus with substantial provenance, privacy, copyright, storage, and unsafe-file concerns.

The current SONARA stack must not download, mirror, or train on it.

## Dataset use

Approved datasets are evaluation assets, not customer records. Evaluation and test splits stay separate from training and prompt tuning.

Selected candidates:

- `PolyAI/banking77`: customer-service intent benchmark.
- `PolyAI/minds14`: multilingual spoken-intent benchmark.
- `google/fleurs`: small streamed multilingual ASR subsets only.
- `cais/mmlu`: one general-knowledge evaluation signal.
- `openai/gsm8k`: arithmetic-reasoning comparison against deterministic formulas.

Attribution, notices, source revision, sample selection, and data-use purpose must be recorded.

## Adopted platform specifications

SONARA incorporates the following concepts into its own governance and worker design:

- Model Cards
- Dataset Cards
- Safetensors preference
- Hub malware, pickle, and secret scanning signals
- Hub OpenAPI and read-only metadata access
- Transformers.js for small reviewed ONNX candidates only
- Text Embeddings Inference for isolated embedding service pilots
- Inference Endpoints as an optional managed deployment path
- Dataset streaming with sample and byte limits
- Croissant JSON-LD dataset metadata snapshots

External specifications inform SONARA-owned implementation. They do not authorize automatic code execution or data use.

## Environment variables

```text
HUGGINGFACE_HUB_ENABLED=false
HUGGINGFACE_HUB_BASE_URL=https://huggingface.co
HF_TOKEN=
SONARA_HF_PROBE_TIMEOUT_MS=1800
```

Rules:

- `HUGGINGFACE_HUB_ENABLED` is opt-in.
- `HUGGINGFACE_HUB_BASE_URL` accepts the official Hugging Face host. Localhost is allowed only outside production.
- `HF_TOKEN` stays server-side and is optional for public metadata probes.
- Use the minimum token scope. Metadata pilots do not require write access.
- Never place a token in the database, browser bundle, URL, log, migration, model card, or dataset record.

## Production security contract

1. Pin the exact repository revision, tokenizer revision, and worker image.
2. Prefer Safetensors or reviewed ONNX artifacts.
3. Verify publisher, license, gated terms, model card, dataset card, file list, scan results, and hashes.
4. Reject unreviewed pickle weights and `trust_remote_code` in trusted processes.
5. Run inference and data processing in separately authenticated workers with resource limits and restricted egress.
6. Keep every request tenant-scoped and auditable.
7. Do not allow model output to send, publish, charge, delete, deploy, change permissions, or make legal or high-impact decisions without deterministic checks and human approval.
8. Do not ingest customer data, private documents, recordings, or copyrighted assets without authorization and a defined retention policy.
9. Record prompt, input class, output, model revision, runtime, latency, cost, validation result, and reviewer decision where applicable.
10. Provide a deterministic fallback when optional model services are unavailable.

## Staged rollout

### Stage 0 — completed by this catalog

- Non-secret metadata registry
- License and commercial-use classification
- Product-fit mapping
- Public and admin visibility
- One bounded metadata probe
- Execution disabled

### Stage 1 — recommended

- BGE embedding and reranking evaluation
- Granite Docling document extraction pilot
- Whisper transcription pilot
- Synthetic and licensed evaluation sets

### Stage 2

- Managed-versus-self-hosted cost and security comparison
- Queue contracts, worker authentication, observability, quotas, deletion, and audit records
- Limited internal users and non-sensitive test data

### Stage 3

- Narrow customer pilots after privacy, legal, reliability, safety, accessibility, and incident-response review

### Stage 4

- Generative media or multimodal features only after model-specific moderation, provenance, rights, and cost controls pass production review

## Authoritative references

- Hugging Face Model Cards: https://huggingface.co/docs/hub/model-cards
- Hugging Face Dataset Cards: https://huggingface.co/docs/hub/datasets-cards
- Hub Security: https://huggingface.co/docs/hub/security
- Safetensors: https://huggingface.co/docs/safetensors/index
- Hub API: https://huggingface.co/docs/hub/api
- Transformers.js: https://huggingface.co/docs/transformers.js/en/index
- Text Embeddings Inference: https://huggingface.co/docs/text-embeddings-inference/en/index
- Inference Endpoints: https://huggingface.co/docs/inference-endpoints/about
- Dataset streaming: https://huggingface.co/docs/datasets/stream
- Croissant metadata: https://huggingface.co/docs/dataset-viewer/croissant
