# Governed AI Integration Control Plane

SONARA tracks the twelve requested tools without placing autonomous agents, third-party credentials, or unreviewed workflows in the customer request path. All service adapters are disabled by default. Configuration makes a read-only readiness probe available to founders/admins; it does not authorize execution.

## Integration map

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

## Runtime surfaces

- `GET /api/ecosystem/ai-integrations` returns the static, non-secret catalog.
- `GET /admin/ai-integrations` shows founder/admin readiness and performs bounded read-only probes.
- `GET /api/admin/ai-integrations/readiness` returns the same admin-only readiness as JSON.
- `lib/sonara-ai-integration-registry.cjs` is the source of truth for classification, environment keys, probe endpoints, and safety boundaries.
- `supabase/migrations/20260721170000_governed_ai_integration_catalog.sql` seeds non-secret catalog and status records.

No probe reads response bodies or follows redirects. A probe may only issue one `GET` per enabled service, uses a 1.2-second default timeout, and reports coarse status plus HTTP status. It cannot execute an agent, prompt, model generation, flow, workflow, tool, job, mutation, publish, charge, message, or deletion.

## Optional local services

`docker-compose.ai.yml` provides pinned, profile-gated development services for Ollama, Open WebUI, Langflow, and n8n. It does not start during the SONARA application lifecycle.

1. Copy `.env.example` to an ignored local environment file.
2. Set strong values for the bootstrap secrets required by the profile.
3. Start only the profile you need, for example:

   ```bash
   docker compose --env-file .env.local -f docker-compose.ai.yml --profile ollama up -d
   ```

4. Create the provider-side API key or account where required.
5. Set the corresponding SONARA URL, credential, and `*_ENABLED=true` flag.
6. Open `/admin/ai-integrations` and verify the adapter reports `ready`.

For the first loopback-only Open WebUI boot, set `OPEN_WEBUI_ENABLE_SIGNUP=True`, create the owner account, then immediately set it back to `False` and restart the profile.

The heavy or operator-specific stacks—OpenClaw, Dify, RAGFlow, and a CrewAI worker—are intentionally not bundled. Follow each upstream deployment guide, keep the service behind private ingress, then connect SONARA using the documented server-only environment variables.

## Governance rules

- Production URLs must use HTTPS unless the host is local or private.
- Credentials may not be embedded in URLs, returned by readiness APIs, logged, committed, or exposed through `NEXT_PUBLIC_*` variables.
- n8n and Dify require licensing review before commercial embedding or hosted customer use.
- Every model license is reviewed independently from its serving runtime. DeepSeek V3 weights are not downloaded by this repository.
- LangChain and CrewAI tools require tenant scoping, allowlists, audit events, and human approval before any worker can perform a consequential action.
- Gemini CLI and Claude Code are never invoked from production or from customer-controlled input.
- The first worker pilot must be read-only launch-readiness analysis with saved provenance and an operator approval gate.

## Next activation gate

A service may advance from readiness-only to execution only after its exact workflow has tests for authorization, tenant isolation, timeouts, retry/idempotency behavior, audit logging, data retention, license terms, and human approval. Activation is per workflow—not blanket permission for the tool.
