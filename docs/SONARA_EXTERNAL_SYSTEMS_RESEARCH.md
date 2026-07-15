# SONARA External Systems Research

Date: 2026-07-14
Extends `docs/SONARA_EXTERNAL_REPOSITORY_RESEARCH.md` with the operator
infrastructure layer. Rule unchanged: patterns only; license, scripts,
CI, and dependency review before any adoption; feature flags so SONARA
runs fully with every optional system disabled; secrets server-side only.

| System | Role | Verdict | Notes |
| --- | --- | --- | --- |
| OmniRoute | Optional local AI gateway | Readiness detection shipped; flag-gated | `OMNIROUTE_ENABLED=false` default; detector never calls the network; `/admin/ai-gateway` shows status/model only |
| CrewAI | Server-side agent orchestration | Not now | Would sit behind operator approval; out of MVP |
| Ollama | Local model runtime | Not now | Candidate backend behind the AI gateway flag only |
| Meilisearch | Search engine | Not now | Catalog volume does not justify a search dependency yet; command palette covers navigation search |
| NocoDB | Admin data-table UX | Pattern only | AGPL — study UX, never vendor code |
| Bruno | API test collections | Later | Git-versioned smoke collection candidate under `bruno/` |
| Coolify | Self-hosted deploy control plane | Pattern only | Readiness-dashboard posture mirrored in /admin/system |
| Excalidraw | Canvas performance discipline | Pattern applied | Single rAF loop, DPR cap, hidden-tab pause in the engine |
| Three.js | WebGL scenes | Later, MIT | Adopt only with lazy loading + static fallback; current ambient layer is dependency-free Canvas 2D |
| WebGPU | GPU compute/render | Quality hint only | Not Baseline (MDN); never required; no adapter requested at load |
| Docker | Container runtime | Shipped | Production-safe `Dockerfile` (non-root, healthcheck, no secrets), `.dockerignore`, `docker-compose.dev.yml` |
| Rancher | Cluster operations | Documented | `docs/infrastructure/DOCKER_RANCHER.md`; Vercel remains the production web path |

## Adoption checklist (unchanged)

1. LICENSE compatibility (AGPL caution). 2. Package scripts / Dockerfile /
CI inspection. 3. Dependency-tree risk review. 4. No curl-pipe installs.
5. No secrets in images or client code. 6. Feature flag + disabled-state
verification. 7. Data-handling documented before any customer data touches
an optional system. 8. Owner approval for production dependencies.
