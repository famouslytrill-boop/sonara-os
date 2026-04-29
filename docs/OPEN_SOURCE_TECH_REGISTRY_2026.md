# 2026 Open-Source Technology Registry

Production candidates must pass:
1. License is commercial-safe: MIT, Apache-2.0, BSD, ISC, MPL-2.0, or explicit commercial terms.
2. Active maintenance.
3. Replaceable through adapter layer.
4. No non-commercial model in production.

## Approved default categories

| Category | Primary | Fallback |
|---|---|---|
| LLM Gateway | LiteLLM | Direct provider adapter |
| Agent workflows | LangGraph | CrewAI |
| RAG | LlamaIndex | Haystack |
| Vector DB | Qdrant | pgvector |
| Cache | Redis | Upstash-compatible adapter |
| Jobs | Prefect | Temporal |
| Feature flags | GrowthBook | Unleash |
| Observability | OpenTelemetry | Prometheus/Grafana/Loki |
| Search | Meilisearch | Typesense/OpenSearch |
| Audio analysis | Essentia/librosa | FFmpeg metadata |
| Stem separation | Demucs | gated alternatives |
| MIDI extraction | Basic Pitch | gated alternatives |
| TTS | Piper/MeloTTS | commercial-reviewed models |

## Review-gated
- Any CC-BY-NC, research-only, unclear, or model-card-missing system.
- Voice cloning systems.
- Any model trained on unclear rights data when marketed as commercial-safe.
