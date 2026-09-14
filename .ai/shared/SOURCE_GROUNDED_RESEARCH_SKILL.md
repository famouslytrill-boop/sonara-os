# Source-Grounded Research Skill

Use this skill in ChatGPT/Codex when the owner asks for substantial research, market analysis, architecture research, competitor analysis, technical due diligence, security research, scientific/engineering research, or a recommendation whose correctness depends on external evidence.

This workflow is SONARA-owned. It is informed by the general idea that research should be validated rather than merely generated, but it does not import or execute another project's agent runtime.

## Goal

Produce a conclusion whose claims can be traced to evidence, whose contradictions were actively sought, and whose uncertainty is explicit.

## Workflow

### 1. Define the decision or claim

Write the exact question before searching. Separate:

- what is being decided;
- what facts are required;
- what would change the decision;
- the requested time window;
- any cost, licensing, privacy, security, or operational constraints.

If the question is too broad, decompose it into a small set of falsifiable subquestions rather than collecting random links.

### 2. Prefer primary and authoritative evidence

Use the strongest available source for each claim:

- product/vendor documentation for current product behavior;
- source repository and LICENSE for code facts;
- standards bodies and official specifications for standards;
- filings, official datasets, or first-party disclosures for business facts;
- peer-reviewed/original papers for scientific claims;
- current production telemetry or repository state for SONARA-specific conclusions.

Secondary commentary may add context but should not outrank a primary source it contradicts.

### 3. Build an evidence matrix

For each material claim, track:

| Claim | Evidence | Source quality | Freshness | Supports / contradicts | Confidence |
| --- | --- | --- | --- | --- | --- |

Do not leave a recommendation supported only by adjacent facts. The evidence must actually bear on the claim.

### 4. Run a contradiction search

Actively search for evidence that would make the preferred conclusion wrong:

- incompatible license or terms;
- hidden cost or rate limit;
- deprecation or maintenance risk;
- security/privacy consequence;
- production/runtime mismatch;
- contradictory benchmark or independent result;
- evidence that SONARA already solves the problem.

A research pass that only gathers confirming evidence is incomplete.

### 5. Validate citations and source identity

Before relying on a source:

- verify the exact upstream/project/entity;
- verify dates and versions;
- ensure the cited source contains the claimed fact;
- distinguish repository badges/social posts from actual files and documentation;
- never invent an owner, URL, license, benchmark, or quote from an unreadable screenshot.

### 6. Separate fact from inference

Use four explicit buckets in the working notes:

- **Verified fact** — directly supported by evidence.
- **Inference** — follows from facts but is not directly stated by a source.
- **Recommendation** — a judgment under SONARA's constraints.
- **Unknown** — material information not established yet.

Do not rewrite an inference as a fact in the final answer.

### 7. Verify with an independent method when practical

Depending on the question, use one or more of:

- a second independent source;
- source-code inspection;
- a minimal local test or benchmark;
- production telemetry;
- a failing test for the bad case;
- a reproducible calculation;
- a second implementation or model only as a cross-check, not as evidence by itself.

For SONARA checks, prefer evidence that would fail if the system were actually broken. A green check that can pass on empty/stub data is not proof.

### 8. State uncertainty and stop conditions

Report:

- confidence in the conclusion;
- what remains unknown;
- what evidence would reverse the recommendation;
- whether the answer is time-sensitive;
- whether a qualified human review is required before action.

Do not manufacture certainty to make the recommendation sound stronger.

### 9. Turn research into an actionable SONARA decision

Where relevant, record:

- product fit;
- architecture placement;
- security/privacy boundary;
- license/commercial-use status;
- cost and operational burden;
- launch impact;
- smallest safe experiment;
- explicit do-not-do list.

Research should reduce a decision, not merely increase a bibliography.

## Safety and business boundaries

- Research may inform but does not bypass owner approval for refunds, payouts, policy/legal publishing, customer campaigns, proof/review publishing, security-setting changes, or destructive data actions.
- Do not send private source, secrets, customer data, or unpublished company records to an unapproved external provider.
- Do not execute remote install scripts merely because a repository README suggests them.
- Security research targets only systems SONARA owns or is explicitly authorized to assess.
- Financial, legal, medical, and other high-stakes conclusions require the appropriate qualified human review when action depends on them.

## Final-answer standard

A strong result should make it possible for another reviewer to answer three questions quickly:

1. What do we know?
2. How do we know it?
3. What should SONARA do next, given the remaining uncertainty?

For repository/tool research, combine this skill with `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md`.
