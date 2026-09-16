# ChatGPT / Codex — SONARA Batch 1-10 Strategy

This file is portable repository context for ChatGPT/Codex work on SONARA. It does not install a ChatGPT app, grant connector access, create provider credentials, or widen SONARA authority.

## Read in this order

1. `AGENTS.md`
2. `.ai/shared/PROJECT_MEMORY.md`
3. `lib/sonara-batch-convergence-engine.cjs`
4. `lib/sonara-model-engine-control-plane.cjs`
5. `lib/sonara-source-evidence-register.cjs`
6. `lib/sonara-agent-skill-strategies.cjs`
7. `lib/sonara-open-source-registry.cjs`
8. relevant product/runtime modules and tests

## Authority order

1. production/runtime truth
2. Batch 9 SONARA One v3 / Balanced Precision design and correctness authority
3. formal `data/open-source-tools.ts` repository adoption/licence decision
4. Batch 10 operational/source evidence
5. verified Batch 1-7/10 research
6. historical references

## Repository, model, and engine strategy

For every repository/model/engine/tool:

- resolve the exact upstream and current licence;
- distinguish source-code licence from model-weight, dataset, media, trademark, and provider terms;
- deduplicate by canonical upstream while preserving every batch/registry source as provenance;
- preserve formal blocked/review decisions even when an older screenshot says a project is open source or commercially safe;
- prefer a narrow adapter or original SONARA implementation over importing a whole repository;
- keep GPU/media/model workloads in isolated workers;
- keep desktop/computer-use tooling on an owner device or isolated desktop;
- keep GPL/AGPL/MPL/custom/source-available code external or isolated unless deployment/distribution review explicitly approves otherwise;
- keep unlicensed or unresolved source out of product code;
- never let a registry record install software, call a provider, or widen credentials by itself.

## Intelligence and learning strategy

- Use deterministic record checks before model calls when the answer exists in SONARA records.
- Treat project memory, customer/org memory, model context, and cross-agent instructions as different trust domains.
- Store only organization-scoped, purpose-limited memory with provenance and retention policy when runtime memory is enabled.
- Never learn secrets, raw card/CVV data, passwords, access tokens, or covertly inferred sensitive traits.
- Personalization and preferences must be explainable, editable, and removable; consequential actions still require the same approval gates.
- Semantic retrieval remains setup-dependent until an approved embedding model/provider and matching vector dimension are verified.

## Claude / ChatGPT / Codex strategy

- Claude repository work uses `.claude/skills/governed-batch-convergence/SKILL.md`.
- Codex/ChatGPT repository work uses `AGENTS.md` and this file.
- Shared behavior comes from `lib/sonara-agent-skill-strategies.cjs`; do not fork authority rules per provider.
- A future ChatGPT skill/plugin package may carry these strategies, but installation and connected-app authorization are separate user/workspace actions.
- No agent may merge its own code while required checks are red, bypass tenant scope, disclose secrets, or reinterpret research as production truth.

## Product strategy

### Business Builder
Use deterministic operational intelligence around customers, bookings, quotes, invoices, payments, staffing, inventory, vendors, locations, and launch readiness. Prefer provider-reported payment/dispute facts over generic fee estimates.

### Creator Studio
Use approved provider adapters or isolated workers for transcription, audio-to-MIDI, stems, timelines, image/video/music/voice generation, and export. Require rights, consent, provenance, cost, quality, and owner approval where applicable.

### Growth Studio
Use first-party authorized records, explainable scoring, immutable approved-recipient snapshots, suppression/consent controls, bounded sends, experiments, and measured outcomes. No scraping-to-outreach automation.

### SONARA One / Founder operations
Present one control plane for readiness, models/engines, repository research, source evidence, provider state, agent strategies, security/compliance evidence, and unresolved blockers. Do not turn configuration evidence into certification claims.

## Release strategy

1. state acceptance criteria;
2. implement the smallest reversible change;
3. add regression tests for the failure mode;
4. run pnpm-only install/audit/typecheck/lint/test/build and repository release gates;
5. inspect required GitHub checks;
6. merge only when required checks are green;
7. keep production deployment/provider/account blockers separate from merged source-code truth.
