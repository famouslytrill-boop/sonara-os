# Generation execution contracts

Status: engineering sequence started 15 September 2026. This layer is intentionally stacked on `GENERATION-CREATION-PATHWAYS.md` and remains non-executing until a separately reviewed adapter/runtime is configured and approved.

## Why this layer exists

The pathway planner answers **where a creation could run**. The execution-contract layer answers the next set of engineering questions without enabling anything:

1. What concrete runtime shape fits the requested modality and operation?
2. Is the request browser-only, local-only, synchronous, streaming, async, or batch?
3. Does data cross a provider boundary?
4. Is external spend possible?
5. Does the runtime need a SONARA-controlled worker boundary?
6. Can a fallback happen, and exactly which pre-approved alternatives may participate?
7. For long jobs, what state, idempotency, cancellation, timeout, callback, persistence, provenance, and approval rules are mandatory?

The implementation is `lib/sonara-generation-execution-contract.cjs` with regression coverage in `tests/generation-execution-contract.test.js`.

## Runtime alternatives

| Lane | Examples | Best fit | Key boundary |
| --- | --- | --- | --- |
| Browser / WebGPU | Transformers.js, ONNX Runtime Web | bounded on-device inference, privacy/offline helpers | no server credential inheritance; capability must be benchmarked |
| Local OpenAI-compatible runtime | llama.cpp, Ollama, vLLM, SGLang | private/offline text and multimodal inference | private endpoint hardening, model-license review |
| Private diffusion server | Diffusers, SGLang Diffusion, isolated ComfyUI | image/video generation on owned or rented GPU workers | never run the GPU stack inside the Vercel/Express web process |
| Serverless open-model catalog | Together AI, Cloudflare Workers AI | bursty evaluation and broad model access | external data/spend/provider terms |
| Async model marketplace | fal, Replicate | heterogeneous long-running creative jobs | authenticated/idempotent webhook or bounded polling; copy outputs durably |
| Managed GPU job queue | Runpod, Modal, Baseten | SONARA-owned worker image with managed compute | image/version rollout, budget, timeout, cancellation and output persistence |
| Dedicated GPU endpoint | Together dedicated, Baseten, Modal endpoints | predictable capacity/latency or custom models | reserved capacity and deployment operations |
| Governed provider router | approved provider router or SONARA routing layer | text/model endpoint redundancy | implicit provider fallback is disabled unless the full candidate set is explicitly approved |

These records are research-backed candidates. Catalog presence grants no execution authority.

## Operation taxonomy

The contract separates **modality** from **operation**. A video request can be generation, edit, transform, or extension; an audio request can be generation, transcription, speech synthesis, analysis, or transformation. The supported operation vocabulary is:

- `generate`
- `edit`
- `transform`
- `extend`
- `upscale`
- `transcribe`
- `synthesize_speech`
- `compose_music`
- `render_3d`
- `analyze`

This prevents a provider from being considered compatible merely because it accepts the same broad media type.

## Selection rules

Hard constraints are evaluated before scoring:

- `localOnly` excludes every runtime that transfers input to external compute.
- `browserOnly` excludes every non-browser runtime.
- `maxExternalSpend: 0` excludes metered external paths.
- `asyncRequired` excludes runtimes without a durable async mode.
- research-backed candidates remain excluded unless explicitly enabled for review.
- unsupported modality or operation is a hard block, not a scoring penalty.

Readiness remains separate from eligibility. An eligible runtime is still not ready until required rights review, spend approval, worker-boundary approval, runtime/adapter configuration, and execution allowlisting are satisfied.

## Fallback policy

Automatic fallback is **off by default**.

A fallback chain may be planned only when all of the following are true:

1. the caller explicitly requests automatic fallback;
2. at least two execution alternatives are explicitly allowlisted;
3. at least two allowlisted alternatives are configured and ready;
4. every fallback preserves tenant scope, rights, privacy, residency, budget, modality and operation constraints;
5. the router cannot select an unlisted provider.

This is intentionally stricter than provider platforms whose default behavior may route to backup infrastructure automatically. SONARA must not turn a reliability feature into silent external spend or a privacy-boundary change.

## Durable async job contract

Long-running image, music, video, 3D and managed-GPU work should use the normalized `sonara.generation.job.v1` contract rather than holding a web request open.

Required identifiers:

- tenant ID
- request ID
- idempotency key

Required controls:

- deadline
- maximum attempts
- cancellation
- max cost or compute budget
- input-rights attestation
- durable output target

Normalized states:

`planned -> submitted -> queued -> running -> succeeded | failed | canceled | expired`

Completion may use an authenticated webhook or bounded polling. Callback processing must correlate the provider request to the SONARA tenant/request/idempotency key, verify a provider-specific signature or secret mechanism when available, tolerate duplicate delivery, durably accept/persist completion before downstream use, and never interpret callback delivery as publication approval.

Provider output URLs are treated as temporary by default. Replicate explicitly documents that API-created prediction input/output files are automatically deleted after a period, and other platforms have their own retention contracts. SONARA therefore copies any accepted artifact into its own approved durable storage before a later workflow depends on it.

## Authority boundary

This layer can plan and validate an execution contract. It cannot:

- invoke a model/provider;
- start a worker;
- download model weights;
- spend money;
- publish an artifact;
- send a campaign/message;
- bill a customer;
- mutate identity-sensitive data; or
- perform destructive actions.

Execution adapters, publication flows, billing and high-authority actions remain separately approval-gated.

## Research basis checked 15 September 2026

Primary documentation reviewed for this sequence:

- Hugging Face Transformers.js WebGPU: https://huggingface.co/docs/transformers.js/guides/webgpu
- ONNX Runtime Web WebGPU: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- Ollama API: https://docs.ollama.com/api/introduction
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
- SGLang basic usage and OpenAI-compatible APIs: https://docs.sglang.io/docs/basic_usage/overview
- SGLang Diffusion: https://docs.sglang.io/docs/sglang-diffusion
- Hugging Face Diffusers: https://huggingface.co/docs/diffusers/index
- Together AI serverless and dedicated inference: https://docs.together.ai/docs/serverless/models and https://docs.together.ai/docs/dedicated-endpoints/overview
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/
- fal async queue and webhooks: https://fal.ai/docs/documentation/model-apis/inference/queue and https://fal.ai/docs/documentation/model-apis/inference/webhooks
- Replicate webhooks: https://replicate.com/docs/topics/webhooks
- Runpod Serverless endpoints: https://docs.runpod.io/serverless/endpoints/overview
- Modal: https://modal.com/docs
- Baseten async inference: https://docs.baseten.co/inference/async
- OpenRouter provider routing/fallback controls: https://openrouter.ai/docs/guides/routing/provider-selection and https://openrouter.ai/docs/guides/routing/model-fallbacks

Google's current Gemini API also reinforces why video must be modeled as a long-running operation: Veo generation returns an operation that is polled until completion. Together's current video API likewise creates an asynchronous job and returns a job ID. These are execution-shape facts, not reasons to auto-enable either provider.

## Next promotion sequence

1. Keep this PR planning-only and get the stacked release gates green.
2. Define one canonical adapter interface for `submit`, `status`, `cancel`, `result`, `health`, and optional `stream`.
3. Implement a fake/in-memory adapter first and prove state transitions, idempotency and tenant isolation.
4. Add durable generation-job persistence and artifact provenance before connecting any long-running provider.
5. Promote **one** low-risk provider/runtime behind a feature flag and explicit execution allowlist.
6. Add signed/idempotent webhook handling where the selected provider supports callbacks.
7. Add cost/deadline enforcement, circuit breaking and observability.
8. Only then evaluate a second approved provider for controlled fallback testing.

This ordering deliberately avoids building eight provider integrations before SONARA has one trustworthy job lifecycle.
