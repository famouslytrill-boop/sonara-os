# V19 R&D Audit

## Global open-source stack selected

### AI orchestration
- LangGraph for stateful agent workflows.
- CrewAI for rapid role-based agent teams.
- LiteLLM for unified model routing and cost/latency control.
- LlamaIndex for retrieval-heavy RAG workflows.

### Memory and recommendations
- Qdrant for self-hosted vector search and recommendation memory.
- pgvector as cheap Postgres-native fallback.
- Redis for cache and queue acceleration.

### Product evolution and automation
- Prefect for Python-native scheduled audits and data workflows.
- Temporal as future durable workflow option for enterprise-grade orchestration.
- n8n as no-code automation bridge for launch ops.

### Feature rollout and experimentation
- GrowthBook for A/B tests and experiment analytics.
- Unleash or Flagsmith for self-hosted feature flags.

### Observability
- OpenTelemetry for traces.
- Prometheus for metrics.
- Grafana for dashboards.
- Loki for logs.
- Sentry optional for frontend/backend errors.

### Frontend
- Next.js + TypeScript + Tailwind.
- PWA/offline-first shell.
- WebGPU detection for high-performance visuals, with non-GPU fallback.

## Removed / consolidated
- Duplicate prompt optimizers consolidated into Prompt Compiler.
- Duplicate analytics widgets consolidated into Product Evolution Engine.
- Extra model providers gated behind Model Registry.
- Public sci-fi language removed from UI.
- Advanced controls hidden behind Pro mode.

## V19 scoring target
- Vision: 9.9
- Differentiation: 9.8
- Simplicity: 9.7
- Reliability: 9.6
- Monetization: 9.8
- Legal readiness: 9.5 pending outside counsel
