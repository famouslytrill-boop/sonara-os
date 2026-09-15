# Generation and Creation Pathways

Status: architecture and research convergence, 2026-09-15.

This document describes how SONARA can add generation and creation breadth without turning the Express/Vercel request process into a monolithic model host or treating every researched repository as an installed dependency.

The executable authority remains in the existing product routes, provider adapters, worker contracts, tenant authorization, agent authority and release gates. `lib/sonara-generation-pathway-planner.cjs` is a non-executing planner.

## Core rule

A generation pathway is a placement and routing decision, not permission to run a model or call a service.

Research, repository verification, a permissive code license, a model listing, a configured provider and a production-enabled capability are separate states. No planner record skips those states.

## Pathway classes

### 1. Deterministic templates and renderers

Use the existing web process for work that does not need model inference: structured documents, HTML/SVG/CSS composition, template-driven graphics, deterministic record assistance and predictable transformations.

This is the preferred default when a model would add cost, latency or privacy exposure without enough product value.

### 2. Browser-native creation

Use browser capabilities for manual and interactive creation: Canvas/SVG, WebAudio, WebGL/3D previews, timeline/layout tools and direct manipulation interfaces.

The browser receives no service-role keys or model-provider secrets. Large-model inference remains outside this lane unless separately designed and reviewed.

### 3. Configured hosted providers

Use the adapters SONARA already has or has explicitly reviewed: governed OpenAI/Anthropic drafting and Creator Studio providers such as ElevenLabs, Google Veo, Suno and approved external connectors when configured.

Selection is explicit. SONARA does not silently substitute one paid/external provider for another. Provider terms, customer consent, provenance, cost metering and the exact product authority path still apply.

### 4. Hosted model marketplaces

Replicate and fal are researched as alternate hosted execution backends, not installed adapters in this change.

Replicate's documented predictions API supports asynchronous predictions and webhooks; webhook handlers must be idempotent and authenticated before a production integration. fal documents queue-oriented generation and webhooks for long-running requests. These services can broaden model access without SONARA operating every GPU stack, but each selected model still needs an independent license, terms, privacy and output-rights decision.

Research references:

- Replicate HTTP API: https://replicate.com/docs/reference/http
- Replicate webhooks: https://replicate.com/docs/topics/webhooks/setup-webhook
- fal model/API documentation: https://fal.ai/models

### 5. Managed GPU worker

Runpod Serverless is researched as a managed execution backend for the existing SONARA worker boundary. Its documentation describes queue-based endpoints with asynchronous `/run` and synchronous `/runsync` execution, plus endpoint scaling, timeouts, GPU selection and model caching.

The intended SONARA pattern is a versioned worker container behind the canonical media-worker contract, with bounded jobs, cancellation, timeouts, cost ceilings, audit records, health checks and rollback. Runpod is not connected by this planner.

Research reference:

- Runpod Serverless endpoints: https://docs.runpod.io/serverless/endpoints/overview

### 6. Self-hosted isolated generation worker

This lane keeps GPU/Python stacks out of the Vercel request process and behind the existing SONARA Open Media Worker contract.

Candidate implementation families include:

- Hugging Face Diffusers (`huggingface/diffusers`, Apache-2.0): a code-first pipeline library for image, video and audio inference. It is a useful alternate to a graph workflow when SONARA wants a small, versioned worker implementation. Individual checkpoints, model weights, datasets and output terms remain separate.
- ComfyUI (`Comfy-Org/ComfyUI`, GPL-3.0): useful as a graph/workflow engine, but it stays isolated/external pending the GPL deployment decision and per-node/per-model review.
- ACE-Step 1.5 (`ace-step/ACE-Step-1.5`, MIT repository): a music-generation candidate. Model/data/output rights and protected-artist imitation policy remain separate.
- Wan 2.2 (`Wan-Video/Wan2.2`, Apache-2.0 repository): a video-generation candidate. Model/downstream-component and media-rights review remains required.
- Qwen-Image (`QwenLM/Qwen-Image`, Apache-2.0 repository): image generation/editing and text-rendering candidate with separate model/data/output-rights review.
- TripoSR (`VAST-AI-Research/TripoSR`, MIT repository): single-image-to-3D reconstruction candidate. Weights, source-image rights, generated-asset use and performance still require product review.

Diffusers documentation describes a modular `DiffusionPipeline` abstraction for image, video and audio generation as well as memory/offload and quantization options. That makes it especially useful as a provider-neutral worker implementation layer rather than a new web-process dependency.

Research references:

- Diffusers: https://huggingface.co/docs/diffusers/index
- Diffusers quickstart: https://huggingface.co/docs/diffusers/quicktour

### 7. Owner-device local generation

Ollama and llama.cpp are researched as local/private text and multimodal companion paths. This lane is useful where privacy, offline operation or owner-controlled compute matters more than centralized cloud execution.

Ollama documents both local and cloud APIs; a local server uses `http://localhost:11434`, while cloud access has a different authority and credential boundary. llama.cpp's `llama-server` documents OpenAI-compatible chat/responses/embeddings endpoints and an Anthropic-compatible Messages endpoint, with model-specific compatibility caveats.

A future SONARA local companion must use explicit device pairing, loopback/local-network controls, model allowlisting and no implicit transfer of server credentials. Local execution is not an automatic fallback when a cloud provider fails.

Research references:

- Ollama API: https://docs.ollama.com/api/introduction
- llama.cpp server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md

### 8. External creative companions

Blender, OBS Studio, FL Studio, NLEs, DAWs and similar authoring applications stay on the owner device or in separately controlled render environments. SONARA should favor explicit file/interchange/plugin boundaries over bundling their runtimes into the hosted application.

Examples of useful interchange-first workflows include MIDI/audio stems, OpenTimelineIO timelines, image sequences, GLB/glTF assets, rendered media, project manifests and user-approved exports.

### 9. Hybrid staged creation

The most useful long-term architecture is not one universal generator. It is a controlled pipeline:

`plan -> create -> analyze/QC -> revise -> owner review -> export/publish`

Different stages may use different eligible pathways, but each stage inherits the stricter privacy, rights, cost and approval constraints of the actual execution path. Generation ends with a reviewable artifact. Publishing, campaigns, payments, destructive changes and other high-authority actions remain in their existing approval gates.

## Routing inputs

The planner should consider, at minimum:

- requested modality;
- local-only or deterministic-only requirements;
- provider and worker readiness;
- user-approved external/provider use;
- budget ceiling and external spend;
- latency target;
- model/checkpoint rights;
- source-media ownership and consent;
- tenant/organization scope;
- provenance requirements;
- hardware availability;
- human review requirements.

A route can be eligible but not ready. `setupReasons` describe why a route cannot yet execute. The planner never turns eligibility into provider or worker execution itself.

## Promotion sequence

For a researched path to become an operating capability:

1. verify the exact upstream project/service and intended version;
2. decide source, model, dataset, asset and commercial-use rights;
3. define the tenant/data/provider boundary;
4. implement a narrow adapter or versioned worker contract;
5. add cost, timeout, cancellation, idempotency and observability controls;
6. add tests for the real SONARA integration path, including failure states;
7. prove no silent paid-provider fallback or authority expansion;
8. pass security/privacy and release gates;
9. enable only through explicit operator configuration;
10. verify the production path before customer-facing availability claims.

## Current implementation status

Implemented in this branch:

- non-executing generation/creation pathway planner;
- modality-aware readiness checks;
- local-only, deterministic-only, rights, configuration and spend constraints;
- a staged creation pipeline that preserves review/publish gates;
- model-control-plane summaries;
- new Diffusers and TripoSR engine candidates;
- regression coverage in the existing runtime-planner test file.

Not implemented by this branch:

- Replicate adapter;
- fal adapter;
- Runpod deployment or worker image;
- Ollama/llama.cpp local companion connection;
- automatic model downloads;
- model/checkpoint activation;
- automatic provider fallback;
- customer publishing authority.
