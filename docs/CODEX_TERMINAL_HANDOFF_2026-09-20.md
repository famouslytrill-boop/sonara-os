# SONARA Codex Terminal / Open-Source / Model Handoff — 2026-09-20

## Start state

Target: `famouslytrill-boop/sonara-os`.

Snapshot observed before this branch: `8d13ca449b5605caee999e3fe70eae73e21bf35d`,
the merge result of PR #330. Always fetch current `origin/main` first; never
treat this snapshot as permanently current.

Read, in order: `AGENTS.md`, `.ai/shared/PROJECT_MEMORY.md`,
`.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md`, then `docs/HANDOFF_PROMPT.md`.

## Current exact-head blocker found

Controlled production deployment was correctly blocked because the required
`SONARA Industries CI` workflow failed. The failing gate reported 292 shipped
source files while `scripts/verify-proprietary-notice.mjs` still expected 290.
The added files carry the notice. This branch ratchets the exact expected
population to 292; it does **not** weaken or remove the check.

After every source change, previous green evidence is stale. Run the complete
exact-head matrix again.

## One-command machine bootstrap

Run from the SONARA repository root.

PowerShell:
`.\tools\codex-terminal\bootstrap.ps1 -Execute`

Bash:
`bash tools/codex-terminal/bootstrap.sh --execute`

Add `-Repos` / `--repos` to clone current reviewed external candidates into
`~/.sonara/external`. Clones are detached at immutable SHAs and written to a
local lock. No submodules, arbitrary install scripts or production activation
are performed.

## What "install everything" means here

Do not bulk-execute arbitrary code from every public repository. The automated
lane is: deterministic SONARA lockfile install -> full SONARA verification ->
isolated exact-SHA source clone -> explicit adapter/runtime install -> focused
tests/benchmark -> separate production enablement decision.

Keep four states separate for every external component:
`researched`, `source pinned locally`, `adapter/runtime installed`,
`production enabled`.

The maintained `data/open-source-tools.ts` decision is authoritative. Reconcile
`tools/codex-terminal/repositories.json` against it and use the stricter
verdict. Re-verify upstream, stable release, license and advisories before code
adoption.

## 2026-09-20 current priority lanes

First: MCP v2 interoperability, OpenTelemetry observability and prompt/model
evaluation. These close real engineering gaps without creating a new system of
record.

Second: model-serving workers. vLLM is the GPU-server lane; llama.cpp/Ollama
cover local development; Transformers/ONNX Runtime cover isolated model workers.
Provider Gateway remains the application AI boundary.

Third and conditional: Temporal, Valkey, Qdrant and OPA. Add them only when a
measured reliability/queue/vector/policy gap justifies another service. Prefer
the existing Postgres/pgvector authority until evidence says otherwise.
LangGraph and LiteLLM remain reference-first because SONARA already owns agent
authority/provider routing contracts.

## Model registry

`tools/codex-terminal/models.json` registers current model families but pulls
nothing automatically. This is deliberate: several are tens/hundreds of GB or
larger, and licenses differ by model.

List:
`python tools/codex-terminal/download-model.py --list`

Explicit pull:
`python tools/codex-terminal/download-model.py --model MODEL_ID --execute`

Custom/terms-review models require a deliberate current terms review first.
Code license, weight license, datasets/assets and service terms are separate.

## Verification before PR/merge

Run at minimum:
- `pnpm install --frozen-lockfile`
- `pnpm audit --audit-level moderate`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run verify:launch`
- relevant network repository/action health checks
- focused tests and failure-mode tests for each new adapter

Never weaken migration immutability, tenant/RLS, billing/entitlement, security,
coverage, license or release gates to get green.

## Production completion sequence

current exact SHA -> complete CI/security/release matrix -> deterministic repair
of every genuine red -> exact-head green evidence -> merge review -> controlled
production migration/deployment -> verify deployed SHA + auth + tenant/RLS +
database/catalog + billing/provider boundaries + rollback evidence -> production
connectivity/post-deploy -> only then activate individual runtime capabilities.

## Definition of done for a new component

Record exact upstream and immutable SHA/tag, license/model terms, local path or
runtime, SONARA call site, tests/benchmark, resource/security boundary,
enabled/disabled state, and rollback/removal procedure. A clone is not an
integration; an integration is not a production activation.
