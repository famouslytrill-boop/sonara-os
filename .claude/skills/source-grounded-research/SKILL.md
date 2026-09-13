---
name: source-grounded-research
description: Use for substantial research, market analysis, architecture investigation, competitor analysis, technical due diligence, security research, or evidence-sensitive recommendations. Requires primary-source preference, an evidence matrix, contradiction search, citation validation, uncertainty, and an independent verification step before accepting conclusions.
---

# Source-grounded research

Research is not complete when a model produces a plausible answer. It is complete enough to act on only when the material claims are traceable, contradictions were sought, and uncertainty is visible.

Read `.ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md` as the shared procedure. This Claude skill adds repository-specific execution rules.

## Before searching

Write the exact decision/question and the facts required to answer it. Resolve the time window and SONARA constraints: cost, license, privacy, security, runtime, operations, and launch impact.

For broad research, decompose the problem into falsifiable subquestions. Do not collect sources before knowing which claim each source is supposed to establish.

## Source hierarchy

Prefer primary evidence:

- official documentation for product behavior;
- repository source and the actual LICENSE file for code facts;
- standards/specification bodies for standards;
- official datasets, filings, and first-party disclosures for business facts;
- original/peer-reviewed papers for scientific claims;
- current repository state, tests, workflows, and production telemetry for SONARA-specific conclusions.

A social post, screenshot, badge, summary, or model answer may identify a lead but does not prove the underlying fact.

## Evidence matrix

Keep working notes with one row per material claim:

| Claim | Evidence | Quality | Freshness | Supports/contradicts | Confidence |
| --- | --- | --- | --- | --- | --- |

A recommendation without a row that actually supports it is not ready.

## Contradiction pass

Before settling on a conclusion, deliberately look for:

- license/terms conflict;
- hidden operational or vendor cost;
- deprecation or maintenance risk;
- security/privacy consequences;
- runtime incompatibility;
- contradictory measurements;
- evidence that SONARA already has the capability;
- evidence that the proposed solution solves a different problem than the one asked.

Document the strongest contrary evidence, not just the evidence that supports the preferred answer.

## Claim discipline

Classify working conclusions as:

- **verified fact** — directly evidenced;
- **inference** — reasoned from facts;
- **recommendation** — a judgment under SONARA constraints;
- **unknown** — not established.

Do not promote inference to fact when drafting the final answer.

## Verification

Use an independent check whenever practical: another authoritative source, direct source-code inspection, a reproducible calculation, a minimal test, production telemetry, or a negative test that proves the check fails on the bad case.

Inside SONARA, follow the repository rule that a signal must be capable of reporting failure. Empty lists, stubs, old deployments, and mock-only success do not prove the live path.

## Repository/tool research

When the research target is an external repository, package, screenshot, or social post, also use `.claude/skills/researching-screenshot-tools/SKILL.md` and `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md`.

The 2026-09-13 second screenshot batch uses this method for:

- `mrajaeim/image-pipes` — Creator Studio image-pipeline research;
- `advaitpaliwal/feynman` — research-method reference only, not an imported runtime;
- `kubeopt/kubeopt` — future Kubernetes operations reference only.

Ambiguous screenshots remain unresolved visual leads until upstream identity can be verified. Never infer an owner, license, or URL because the screenshot looks familiar.

## Finish with a decision

A completed research task should state:

1. what is established;
2. what evidence supports it;
3. what contradicts or limits it;
4. what remains unknown;
5. confidence and freshness;
6. the smallest safe next action for SONARA.

If a qualified human must review the conclusion before action, say so explicitly. Research never bypasses the owner-approval categories in `lib/sonara-agent-authority.cjs`.
