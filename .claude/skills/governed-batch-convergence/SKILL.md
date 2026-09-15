---
name: governed-batch-convergence
description: Converge SONARA Batches 1-10 into implementation decisions across architecture, models, engines, open-source software, product capabilities, design authority, Claude/ChatGPT/Codex workflows, and release evidence. Use when asked to integrate, update, build, research, or implement large multi-batch source material without letting research records bypass production authority.
---

# Governed Batch 1-10 convergence

Read first:

- `AGENTS.md`
- `CLAUDE.md`
- `lib/sonara-batch-convergence-engine.cjs`
- `lib/sonara-model-engine-control-plane.cjs`
- `lib/sonara-agent-skill-strategies.cjs`
- `.claude/skills/researching-screenshot-tools/SKILL.md` for new screenshot/repository intake
- `.claude/skills/checks-that-cannot-lie/SKILL.md` before adding verification

## Authority order

When sources disagree, use this order:

1. production/runtime truth;
2. Batch 9 current v3 / Balanced Precision design and correctness authority;
3. Batch 10 operational requirements;
4. verified external research from Batches 1-7 and 10;
5. historical reference.

Never let a screenshot, README claim, prompt graphic, or older batch override a live tenant, approval, payment, provider, or release contract.

## Workflow

1. Load the unified convergence result and identify duplicates, unresolved leads, capability truth, design authority, and current operational requirements.
2. For every proposed external technology, separate research value, license permission, architecture placement, configuration readiness, and production enablement.
3. Prefer SONARA-owned implementation or a narrow adapter when a whole dependency is unnecessary.
4. Put GPU/media/model workloads in isolated workers; local device/computer-use tooling stays on an owner device or isolated desktop; security tooling stays authorized-target-only.
5. Treat permissive licenses as candidates, not blanket approval. Model weights, datasets, media rights, trademarks, privacy, and provider terms stay separate.
6. Keep GPL/AGPL/MPL/custom-license software isolated/external until the intended deployment model has explicit review. Keep unlicensed code out of product source.
7. Reuse `lib/sonara-agent-skill-strategies.cjs` for cross-agent workflow behavior rather than inventing provider-specific authority rules.
8. Implement the smallest reversible production slice, add tests that fail on the bad case, open a PR, and merge only after required CI/release gates are green.

## Cross-agent rules

- Claude skills, ChatGPT/Codex skills/plugins, MCP servers, and connected apps are workflow context or tool access; none grants SONARA authority by itself.
- Provider/account authorization remains external to the skill and must respect workspace/user permissions.
- `AGENTS.md`, tenant isolation, `sonara-agent-authority`, audit logging, Provider Gateway, and controlled deployment remain authoritative across every agent.
- Do not claim a ChatGPT plugin or app is installed merely because repository instructions exist.

## Required output of a convergence task

Produce or update evidence for:

- batch provenance and deduplication;
- product capability impact;
- model/engine/provider placement;
- license and commercial-use boundary;
- data/tenant/privacy boundary;
- owner-approval boundary;
- runtime/configuration state;
- test/release evidence;
- unresolved blockers that remain visible.

A complete convergence task reduces ambiguity. It does not manufacture green status by calling research "integrated."
