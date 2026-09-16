# Governed AI, Model, Memory, and Repository Control Plane

SONARA tracks optional AI services, models, engines, open-source repositories, uploaded research evidence, and cross-agent strategies without placing autonomous agents, third-party credentials, or unreviewed workflows in the customer request path. Configuration makes bounded readiness evidence available; it does not authorize execution.

## Core control-plane layers

- `lib/sonara-ai-integration-registry.cjs` — existing optional HTTP services, framework/model/CLI classifications, and bounded readiness probes.
- `lib/sonara-batch-convergence-engine.cjs` — Batches 1–10 plus requested-repository and maintained formal open-source registry convergence with deduplication/provenance.
- `lib/sonara-model-engine-control-plane.cjs` — explicit runtime placement for selected engines/model families plus commercial/open-source classification across the full converged repository inventory.
- `lib/sonara-source-evidence-register.cjs` — uploaded PDFs, diagrams, graphs, model registries, design/research documents, and screenshot evidence mapped to bounded requirements.
- `lib/sonara-learning-memory-control-plane.cjs` — memory/learning policy, sensitive-data blocks, semantic-retrieval readiness, and truthful legacy-schema status.
- `lib/sonara-agent-skill-strategies.cjs` — shared Claude + ChatGPT/Codex strategies that inherit SONARA tenancy, approvals, provider policy, formal registry decisions, audit, and release rules.
- `data/open-source-tools.ts` through `lib/sonara-open-source-registry.cjs` — maintained repository licence/commercial-use/integration decision surface. A stricter formal decision supersedes older intake metadata for the same repository.

## Existing optional service map

| Tool | SONARA placement | Current integration | Default state |
| --- | --- | --- | --- |
| [OpenClaw](https://github.com/openclaw/openclaw) | Private operator/device gateway | HTTP adapter and model-discovery probe | Disabled |
| [n8n](https://github.com/n8n-io/n8n) | Isolated automation service | HTTP adapter and workflow-inventory probe | Disabled; license review required |
| [Ollama](https://github.com/ollama/ollama) | Local/private model runtime | HTTP adapter and model-inventory probe | Disabled |
| [Langflow](https://github.com/langflow-ai/langflow) | Authenticated flow service | HTTP adapter and flow-inventory probe | Disabled |
| [Dify](https://github.com/langgenius/dify) | External or self-hosted app service | HTTP adapter and app-info probe | Disabled; license review required |
| [LangChain](https://github.com/langchain-ai/langchain) | Controlled worker framework | Architecture reference; no root runtime dependency | Worker-only |
| [Open WebUI](https://github.com/open-webui/open-webui) | Private operator model UI | HTTP adapter and model-inventory probe | Disabled; terms review required |
| [DeepSeek V3](https://github.com/deepseek-ai/DeepSeek-V3) | Approved gateway or private GPU worker | Optional model-family classification | Not bundled |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Developer workstation/container | Development-tool classification | Development only |
| [RAGFlow](https://github.com/infiniflow/ragflow) | Isolated retrieval stack | HTTP adapter and dataset-inventory probe | Disabled; license review required |
| [Claude Code](https://github.com/anthropics/claude-code) | Developer workstation/container | Development-tool classification | Development only |
| [CrewAI](https://github.com/crewAIInc/crewAI) | SONARA-controlled background worker | HTTP health adapter for a future reviewed worker | Disabled |

## Model/engine placement

The explicit engine catalog now covers deterministic SONARA rules, the Open Media Worker contract, ComfyUI, ACE-Step 1.5, Wan 2.2, Qwen-Image, Basic Pitch, whisper.cpp, faster-whisper, Demucs, OpenTimelineIO, React Three Fiber, Blender, OpenJarvis, UI-TARS, and OBS Studio.

The explicit list is **not** the complete repository catalog. It contains technologies with a concrete architecture placement. The full maintained repository inventory is merged and classified through the Batch 1–10 convergence engine and formal open-source registry.

Placement rules:

- deterministic/core record checks may run in the application process;
- GPU/media/local-model workloads use isolated workers;
- desktop/computer-use/capture tools stay on an owner device or isolated desktop;
- copyleft projects stay external/isolated unless deployment/distribution review approves otherwise;
- permissive source licenses still require separate model-weight, dataset, content-rights, trademark, privacy, and provider-term review;
- low-risk license text alone never overrides a formal `blocked`, `needs_review`, or conduct-based decision.

## Learning and memory

SONARA distinguishes development project memory from customer/runtime memory.

- `.ai/shared/PROJECT_MEMORY.md` is repository-native development memory for Claude/ChatGPT/Codex.
- The older `sonara_memory_records`/pgvector schema is user-scoped and is not represented as a live organization-memory runtime.
- `entity_agent_memory` database artifacts exist, but repository/runtime evidence does not establish live reads/writes.
- `lib/sonara-learning-memory-control-plane.cjs` defines the current policy contract before any new persistence path is enabled.
- Secrets, API keys, passwords, service-role credentials, access/refresh tokens, private keys, raw card data, and CVV can never become learned memory.
- Preferences, approved patterns, or sensitive context require explicit purpose/provenance and the required user/owner review.
- Semantic retrieval remains optional and provider/model/vector-dimension gated. SONARA must continue functioning when embeddings are not configured.

## Claude + ChatGPT/Codex strategy

- Claude: `.claude/skills/governed-batch-convergence/SKILL.md`
- Codex: `AGENTS.md`
- ChatGPT/Codex portable strategy: `.ai/shared/CHATGPT_CODEX_BATCH_1_10_STRATEGY.md`
- Shared machine-readable strategy catalog: `lib/sonara-agent-skill-strategies.cjs`

A repository strategy file does not install a ChatGPT app/plugin and does not grant connected-app authorization. Those remain separate user/workspace actions.

## Runtime surfaces

- `GET /api/ecosystem/ai-integrations` — existing non-secret optional integration catalog.
- `GET /api/ecosystem/model-engines` — model/engine placement plus full repository commercial/open-source classification.
- `GET /api/ecosystem/agent-skill-strategies` — portable Claude/ChatGPT/Codex workflow strategy catalog.
- `GET /api/ecosystem/learning-memory` — non-secret learning/memory policy and readiness.
- `GET /api/ecosystem/batch-convergence` — Batch 1–10 + repository-registry convergence/provenance.
- `GET /api/ecosystem/source-evidence` — bounded uploaded-source evidence map.
- `GET /admin/ai-integrations` — founder/admin control-plane page with bounded live probes for configured optional HTTP services.
- `GET /api/admin/ai-integrations/readiness` — admin-only combined readiness JSON.

No research/source/engine/memory/skill registry endpoint installs repositories, calls a model, mutates a provider, sends a campaign, publishes media, charges a customer, changes security settings, or deletes data.

## Optional local services

`docker-compose.ai.yml` provides pinned, profile-gated development services for Ollama, Open WebUI, Langflow, and n8n. It does not start during the SONARA application lifecycle.

1. Copy `.env.example` to an ignored local environment file.
2. Set strong values for the bootstrap secrets required by the profile.
3. Start only the profile you need.
4. Create the provider-side API key or account where required.
5. Set the corresponding SONARA URL, credential, and `*_ENABLED=true` flag.
6. Open `/admin/ai-integrations` and verify the adapter reports its truthful readiness state.

The heavy or operator-specific stacks are intentionally not bundled into the Vercel request process.

## Governance rules

- Production URLs must use HTTPS unless the host is local/private under the reviewed adapter rules.
- Credentials may not be embedded in URLs, returned by readiness APIs, logged, committed, placed in project memory, or exposed through public environment variables.
- Every model license/weight/data/content-rights question is reviewed separately from its serving runtime.
- Tools that can act on browsers, desktops, filesystems, networks, campaigns, security targets, or customer accounts require scoped authorization, audit, and approval.
- Security tooling is restricted to owned or explicitly authorized targets.
- Claude/ChatGPT/Codex skills never override tenant isolation, owner approval, formal repository policy, or release gates.
- Compliance/source evidence can identify controls and gaps but cannot manufacture certification or legal conclusions.

## Activation gate

A service, model, repository adapter, memory runtime, or agent workflow may advance from research/readiness to execution only after its exact workflow has tests for authorization, tenant isolation, secrets, timeouts, retry/idempotency behavior, audit logging, data retention, licensing/rights, privacy, user controls, and human approval. Activation is per workflow—not blanket permission for the tool.
