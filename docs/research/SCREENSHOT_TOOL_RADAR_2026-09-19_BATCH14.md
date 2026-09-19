# Screenshot Tool Radar — 2026-09-19 — Batch 14

## Purpose

This intake converts the latest screenshot research into governed SONARA infrastructure records. Social posts are discovery inputs, not technical authority. Repository identity and current GitHub metadata were checked before a source was recorded.

**Third-party repositories enabled by this batch: 0.**

The batch adds research/adoption records, website/API visibility, convergence metadata, safety boundaries, and explicit next steps. It does **not** clone, install, import, authenticate to, execute, or enable a third-party project.

## New governed repository records

| Project | Repository | License posture | SONARA use |
| --- | --- | --- | --- |
| Browser Hand | `verygoodplugins/browser-hand` | MIT; security-sensitive authenticated-browser access | Local/isolated browser-worker research with approval and audit gates |
| Agentic Bug Hunter | `awarexone/Agentic-Bug-Hunter` | MIT; offensive-security capability | Authorized internal security lab only |
| anti-slop | `miqdadbadjuber/anti-slop` | MIT | Design/coding quality-rule reference; adapt useful patterns into SONARA-owned gates |
| LibrePods | `librepods-org/librepods` | GPL-3.0 | Android/Linux device-interoperability reference only |
| PentAGI | `vxcontrol/pentagi` | MIT repository metadata; related SDK/derivative obligations need separate review | Authorized security architecture research only |
| Ever Gauzy | `ever-co/ever-gauzy` | AGPL-3.0 detected; upstream also has commercial/community terms | ERP/CRM/HRM/PM domain-model and workflow reference |
| Obsidian Second Brain | `eugeniughelbur/obsidian-second-brain` | MIT | Founder/developer local knowledge and agent-memory architecture reference |

## Existing records confirmed instead of duplicated

### ToolJet

`ToolJet/ToolJet` is already governed in `data/open-source-tools.ts`. The current screenshot re-confirms the upstream identity and AGPL-3.0 posture. SONARA keeps the existing verdict: internal-tool composition can inform product research, but ToolJet source is not incorporated, resold, or presented as a native SONARA feature.

### VoxCPM2

The maintained open-source register already groups VoxCPM with the voice-cloning risk class. The current `OpenBMB/VoxCPM` repository metadata reports Apache-2.0, but code licensing alone does not answer voice rights, consent, provenance, model-weight licensing, or impersonation risk. Any evaluation stays inside an isolated Creator Studio worker and requires explicit voice-owner consent plus model/dependency review.

## Institutional engineering reference

Google Research's *Industrial Agentic Engineering* is kept as a non-repository reference. The useful pattern is:

`verifiable specification -> harness -> trajectory -> verification -> meta-debugging`

For SONARA that maps to deterministic contracts around model behavior: scoped tools, prompts, guardrails, authority classification, approval receipts, structured outputs, traces, exact-head CI, release evidence, and workflow-level debugging. The reference does not grant a model or provider additional authority.

## Architecture consequences

### Authenticated browser automation

A logged-in browser is effectively delegated account authority. SONARA therefore treats browser-control bridges differently from ordinary read-only web research. The minimum production boundary is destination/task scope, isolated execution, explicit write approval, bounded steps/time, audit evidence, and refusal to expose unrelated cookies, passkeys, credentials, or sessions.

### Security agents

Agentic Bug Hunter and PentAGI remain lab-only. Automated reconnaissance or penetration testing must be limited to SONARA-owned or explicitly authorized targets. Target allowlists, rate limits, network egress controls, kill switches, human review, and immutable evidence are required before any executable pilot.

### Voice generation

Voice design and TTS can be useful Creator Studio capabilities, but cloning is rights-sensitive. Consent and provenance are system state, not a disclaimer. A permissive repository license does not establish rights to a person's voice or to model weights and training material.

### Design quality harness

anti-slop contributes a useful engineering pattern: hard gates, purpose gates, quality locks, and delivery PASS/FAIL evidence. SONARA should implement the underlying controls in its own design system and CI rather than handing design authority to an external ruleset.

### Business-management references

Ever Gauzy and ToolJet are useful comparisons because they expose mature module/domain boundaries. They are not shortcuts around SONARA's architecture or licensing. The implementation path is gap analysis, then SONARA-owned schemas/routes/tests for the gaps that are actually valuable.

### Local agent memory

The Obsidian second-brain pattern is relevant to founder/developer workflows: durable Markdown knowledge, platform-neutral agent interfaces, and scheduled maintenance. Customer memory remains governed by SONARA's tenant, retention, deletion, provenance, and authority rules.

## Product surfaces updated by this batch

- Research catalog API and Research Lab pages
- Founder/admin repository-readiness view
- Unified batch convergence engine
- Public ecosystem summary
- CI tests that assert zero production execution and the key security/license boundaries

## Release rule

This batch may merge only when the normal SONARA exact-head matrix remains green. Cataloging a repository is not installation, installation is not runtime activation, and runtime activation is not permission for a sensitive action.
