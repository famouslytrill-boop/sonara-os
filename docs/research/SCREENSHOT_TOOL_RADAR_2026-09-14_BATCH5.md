# Screenshot Tool Radar — 2026-09-14 Batch 5

Status: governed research intake only. Nothing in this batch is installed, imported, executed, or enabled in production by this research change.

## Intake result

The supplied screenshots produced **3 new verified repositories**, **1 verified platform reference**, and **5 deduplicated references** that were already represented in earlier screenshot batches.

| Screenshot lead | Verified upstream | License / posture | SONARA decision | Best fit |
| --- | --- | --- | --- | --- |
| Claude Ads | `AgriciDaniel/claude-ads` | MIT | Strong Growth Studio read-only audit/control-plane reference; no live mutation without platform/account approval gates | Growth Studio, paid-media operations |
| Terrain | `sopaco/terrain` | MIT | Local developer/CI benchmark for agent-ready codebase knowledge, freshness, C4 docs, and environment planning | Developer tooling, SONARA One engineering ops |
| anything2explainer | `Vincentwei1021/anything2explainer` | PolyForm Noncommercial 1.0.0 | Creator Studio workflow benchmark only; commercial toolkit use requires author authorization | Creator Studio, explainer video |
| OpenAI Agents API / Agents SDK / Responses API | Official OpenAI platform reference | Service/API terms, not a repository-license decision | Architecture spike only; beta managed-agent path stays behind SONARA authority, provider, tenant, cost, and data boundaries | SONARA One, Personal Agent OS |

## Deduplicated screenshot references

- **Iris** (`brijr/iris`) already exists in Batch 1 as a developer visual-QA/screenshot tool for coding agents.
- **Litho / deepwiki-rs** (`sopaco/deepwiki-rs`) already exists in Batch 1. The new screenshot adds an important current fact: the upstream README says Litho evolved into **Terrain** (`sopaco/terrain`), which is therefore recorded as a new Batch 5 repository rather than duplicating Litho.
- **VibeRaven** (`ohad6k/VibeRaven`) already exists in Batch 1 as a local developer readiness/architecture cockpit reference.
- **OFFPack** (`Assemou007/OFFPack`) already exists in Batch 1 as an offline package-cache concept only; it still must not replace SONARA's pnpm package-manager contract without an explicit architecture decision.
- **LangChain** (`langchain-ai/langchain`) already exists in Batch 1 as a framework/pattern reference; SONARA should not add a framework dependency without a measured gap.

## Decisions and rationale

### Claude Ads

The repository is current, MIT-licensed, and explicitly designed around source-grounded paid-media audits, deterministic scoring, versioned reports, and read-only-by-default account access. Its own control model requires exact operation capability, account/object IDs, before/after diffs, approval, idempotency, audit, rollback, and verification before live changes.

That maps well to Growth Studio because SONARA already requires owner approval for consequential customer-impacting actions. The right first experiment is therefore not to connect real ad accounts. Use synthetic exports or fixtures and compare its evidence/scoring/control-plane patterns against SONARA's current reporting and campaign model.

### Terrain

The upstream Litho README now explicitly points to `sopaco/terrain` as the evolution path. Terrain is MIT-licensed and positions itself as an AI-ready engineering environment: it generates dual-track human/agent knowledge assets, C4 docs, repomix packs, freshness scores, search/Q&A, shared agent contracts, and optional tool/skill environment setup.

Terrain's useful idea is not "install everything automatically." SONARA should benchmark its knowledge-first workflow, freshness scoring, and JSON/CI interfaces in a disposable local clone. Commands that install tooling or managed `AGENTS.md` snippets remain review-gated because they mutate developer environments.

### anything2explainer

The repository is a Claude Code/Codex skill built around Remotion, TTS, deterministic motion graphics, sourced research, narration lock, storyboarding, parallel shot construction, rendering, frame metrics, and chapter-level QC. That workflow is highly relevant to Creator Studio.

The important restriction is licensing: the toolkit is under **PolyForm Noncommercial 1.0.0**. The repository states that commercial use of the toolkit requires prior authorization from the author, while videos produced with it belong to their creators. SONARA should therefore treat this as a clean-room workflow benchmark unless commercial authorization is obtained. TTS engines, fonts, footage, source material, and external endpoints remain separately licensed/controlled.

### OpenAI Agents API / Agents SDK / Responses API

The screenshot's wording is too compressed. Current official OpenAI material distinguishes the layers:

- The **Agents API** was introduced in September 2026 in public beta as a managed agent-session API using the Codex harness, with configurable environments, tools, multi-agent support, long-running sessions, and hosted or developer-controlled compute options.
- The **Agents SDK** remains an orchestration toolkit for agent workflows.
- The **Responses API** remains the lower-level model/tool primitive for agentic applications and built-in tools.

For SONARA, this is a serious architecture candidate for long-running coding/research workloads, but not a reason to bypass Provider Gateway or the existing agent-authority system. A useful spike should compare one managed Agents API session against SONARA's current runner on reliability, latency, token/tool cost, observability, data boundaries, and approval-hook fit.

## Production boundary

All three new repository records are stored with `enabledInProduction: false`, `runtimeStatus: not_executed`, and `canExecute: false`. The OpenAI platform item is a non-repository reference and does not grant runtime authority.

This batch does **not** authorize:

- installing developer tools into production workers;
- connecting real ad accounts or mutating ad budgets/campaigns;
- commercial use of anything2explainer without permission;
- moving private code/customer data into managed agent environments without data-path approval;
- replacing pnpm, SONARA Provider Gateway, or SONARA's owner-approval/agent-authority controls;
- treating generated docs, screenshots, or agent output as stronger evidence than source systems.

## Next experiments

1. **Claude Ads:** synthetic read-only Growth Studio audit benchmark; compare evidence coverage, scoring, capability manifests, and rollback/audit design.
2. **Terrain:** disposable-clone benchmark against SONARA's current architecture docs/handoff workflow; measure freshness, C4 accuracy, token cost, and agent navigation quality.
3. **anything2explainer:** extract a clean-room Creator Studio requirements checklist for research → narration sign-off → pilot preview → parallel build → deterministic render → QC, with no commercial toolkit reuse.
4. **OpenAI Agents API:** non-production managed-agent spike using no customer data and no consequential tools; measure reliability, observability, cost, and fit with SONARA approval hooks.
