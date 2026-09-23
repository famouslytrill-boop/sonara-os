# Screenshot Tool Radar — 2026-09-22 — Batch 18

## Scope

This intake processes the agent-engineering, RAG, infrastructure, system-design, model-workflow, CRM, media and product-design screenshots supplied on 22 September 2026.

A screenshot is a lead, not permission to install. External repositories are verified against authoritative upstreams and remain non-executing unless a separate implementation PR clears licence, security, tenant, runtime, test and release gates.

## Newly verified repositories

| Project | Upstream | Licence posture | SONARA disposition |
| --- | --- | --- | --- |
| nanobot | `HKUDS/nanobot` | MIT | Lightweight agent-framework reference; optional isolated adapter only after measured gap |
| seekdb | `oceanbase/seekdb` | Apache-2.0 | Hybrid search / agent-state benchmark; production state store unchanged |
| Floci | `floci-io/floci` | MIT | Developer/CI cloud-emulator candidate only |
| WeKnora | `Tencent/WeKnora` | MIT project code; third-party notices vary | RAG/knowledge architecture benchmark; tenant/security review required |
| Open Executive | `SenteLabsAI/OpenExecutive` | Apache-2.0 | Specialist-routing/eval reference for bounded business advisory agents |

## Existing records confirmed

- **OpenShorts** — already governed in Batch 13 as `mutonby/openshorts`; the self-hostable core is MIT while `cloud/` has separate commercial terms. No duplicate record was created.
- **Twenty** — already present in `data/open-source-tools.ts`. Current upstream licensing is mixed: most source is AGPLv3, Enterprise-marked files use commercial terms, and named SDK/UI/application packages are MIT. The Twenty Application Exception allows a separate application using published interfaces to retain its own licence, while modifications to Twenty itself remain governed by AGPL/commercial terms.

## Product and agent-design information extracted

The screenshots converge on one important correction to "AI agent" thinking: production systems are not prompt wrappers. They are stateful, observable, bounded execution systems.

Batch 18 records these first-party architecture contracts:

1. **Agent topology selection** — single-shot, iterative ReAct, planner/executor, reflexive and verifier-gated designs have different cost/control profiles; choose the smallest sufficient topology.
2. **Independent verification** — consequential outputs require deterministic policy/schema checks, independent verification and human approval where authority is involved.
3. **Production agent loop** — context, planning/reasoning, tools/retrieval, memory, eval, reliability and stop/budget controls are explicit loops.
4. **Grounded RAG quality** — ingestion, chunking, embedding/indexing, hybrid retrieval, reranking, tenant/metadata filtering, citation evidence and drift evaluation form one contract.
5. **Memory/state governance** — memory proposals carry provenance, confidence, tenant/principal scope, contradiction handling, revision history, expiry/deletion and rollback.
6. **Model gateway control** — route by capability, cost, latency, privacy, availability and risk; fallbacks may never widen action authority.
7. **Workflow durability** — idempotency, checkpoints, queues, retry/backoff, circuit breakers, saga/compensation, dead letters, replay safety and postcondition verification.
8. **Agent observability/evals** — trace model/version, tool calls, tokens, latency, cost and outcome labels; release claims require regression evidence.
9. **Progressive personal-agent authority** — access is granted capability-by-capability, visibly, revocably and with sensitive-action confirmation.
10. **Local-first execution** — use local execution only where privacy/latency/offline value is real and device constraints, encryption, updates, resource budgets and cloud fallback are explicit.

## Meta Muse design lessons

The official Muse design/safety material is treated as a product/security reference, not as code to copy. Useful lessons for SONARA are:

- show what the agent is doing in the background;
- make connected-data scope explicit and revocable;
- separate contextual awareness from action permission;
- use least-privilege access and visible confirmation for sensitive actions;
- isolate computer/tool execution;
- monitor long trajectories, not only final outputs;
- design for reset/revocation and retention control.

## System-design diagrams

The YouTube, Netflix, Airbnb, Uber, WhatsApp, Facebook, Instagram, caching, data-warehouse and workflow cards are preserved as educational decomposition references only. They are intentionally not treated as production blueprints because simplified diagrams omit workload assumptions, failure modes, regulatory constraints, cost envelopes and organization-specific authority boundaries.

## GPT-6 Astra screenshot

The screenshot is preserved only as a model-workflow lead. Volatile model capability, pricing, context-window and API details must come from current official OpenAI documentation through the Provider Gateway research process; a social infographic is not durable model metadata.

## What was intentionally not installed

No external repository was cloned, vendored, added as a git submodule or enabled in production. This batch changes the governed research/control plane only.

Executable adoption, where justified, must be isolated and reversible:

- **nanobot:** compare against existing SONARA agent runner/MCP/memory before any adapter;
- **seekdb:** synthetic offline benchmark against current PostgreSQL/pgvector first;
- **Floci:** one disposable cloud-emulation CI lane before wider use;
- **WeKnora:** synthetic multi-tenant RAG benchmark before service adoption;
- **Open Executive:** adapt routing/eval ideas into SONARA-owned bounded agents rather than importing corporate authority;
- **OpenShorts:** keep the existing Batch 13 path-level licence/media-rights review;
- **Twenty:** prefer published interfaces/SDKs only after explicit licence and architecture review; do not copy the hosted CRM source into proprietary SONARA services.

## Release boundary

Batch 18 must follow the existing repository gate:

current protected `main` → isolated branch/PR → exact-head CI/security/release matrix → repair genuine failures without weakening gates → full green evidence → intentional merge → controlled production deployment → exact live-SHA verification.

Research records do not grant runtime, billing, publishing, infrastructure, tenant, legal, financial, security or deployment authority.
