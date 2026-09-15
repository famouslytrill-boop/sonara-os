---
name: governed-batch-convergence
description: Converge SONARA Batches 1-10 plus maintained repository and source-evidence registries into implementation decisions across architecture, models, engines, open-source software, product capabilities, design authority, Claude/ChatGPT/Codex workflows, and release evidence. Use when asked to integrate, update, build, research, or implement large multi-batch source material without letting research records bypass production authority.
---

# Governed Batch 1-10 convergence

Read first:

- `AGENTS.md`
- `CLAUDE.md`
- `lib/sonara-batch-convergence-engine.cjs`
- `lib/sonara-model-engine-control-plane.cjs`
- `lib/sonara-source-evidence-register.cjs`
- `lib/sonara-agent-skill-strategies.cjs`
- `lib/sonara-open-source-registry.cjs`
- `.claude/skills/researching-screenshot-tools/SKILL.md` for new screenshot/repository intake
- `.claude/skills/checks-that-cannot-lie/SKILL.md` before adding verification

## Authority order

When sources disagree, use this order:

1. production/runtime truth;
2. Batch 9 current SONARA One v3 / Balanced Precision design and correctness authority;
3. formal `data/open-source-tools.ts` repository adoption/licence decisions;
4. Batch 10 operational requirements and source-grounded evidence;
5. verified external research from Batches 1-7 and 10;
6. historical reference.

Never let a screenshot, README claim, prompt graphic, vendor PDF, older design handoff, or older batch override a live tenant, approval, payment, provider, formal licence, or release contract.

## Workflow

1. Load the unified convergence result and identify duplicates, unresolved leads, capability truth, design authority, formal repository decisions, and current operational requirements.
2. Load the source-evidence register so PDFs, diagrams, graphs, model registries, and research documents are used only for the claims they actually support.
3. For every proposed external technology, separate research value, license permission, architecture placement, configuration readiness, and production enablement.
4. Prefer SONARA-owned implementation or a narrow adapter when a whole dependency is unnecessary.
5. Put GPU/media/model workloads in isolated workers; local device/computer-use tooling stays on an owner device or isolated desktop; security tooling stays authorized-target-only.
6. Treat permissive licenses as candidates, not blanket approval. Model weights, datasets, media rights, trademarks, privacy, and provider terms stay separate.
7. Keep GPL/AGPL/MPL/custom/source-available software isolated/external until the intended deployment model has explicit review. Keep unlicensed code out of product source.
8. Reuse `lib/sonara-agent-skill-strategies.cjs` for cross-agent workflow behavior rather than inventing provider-specific authority rules.
9. Implement the smallest reversible production slice, add tests that fail on the bad case, open a PR, and merge only after required CI/release gates are green.

## Cross-agent rules

- Claude skills, ChatGPT/Codex skills/plugins, MCP servers, and connected apps are workflow context or tool access; none grants SONARA authority by itself.
- Provider/account authorization remains external to the skill and must respect workspace/user permissions.
- `AGENTS.md`, tenant isolation, `sonara-agent-authority`, audit logging, Provider Gateway, the formal open-source registry, and controlled deployment remain authoritative across every agent.
- Do not claim a ChatGPT plugin/app is installed merely because repository instructions exist.
- Do not claim a repository/model is commercially safe merely because source code is public or permissively licensed; verify weight/data/content terms separately.

## Required output of a convergence task

Produce or update evidence for:

- all ten batch provenance and deduplication;
- formal requested/open-source registry coverage;
- uploaded PDF/diagram/graph/source-evidence mapping;
- product capability impact;
- model/engine/provider placement;
- license and commercial-use boundary;
- data/tenant/privacy boundary;
- owner-approval boundary;
- runtime/configuration state;
- Claude and ChatGPT/Codex strategy impact;
- test/release evidence;
- unresolved blockers that remain visible.

A complete convergence task reduces ambiguity. It does not manufacture green status by calling research "integrated."
