# SONARA Project Memory

## P0 PostgreSQL replay policy-source boundary (October 10, 2026, draft PR #617)

- Native replay must validate **migration-defined** `subscriptions_select_member` on `public.subscriptions` (migration `011_sonara_saas_launch_system.sql`) and **not** expect or drop two extra preview-only `Users can view ... subscription` policies that are not in repository migrations.
- The 25-policy P1 exact catalog baseline must reflect `20261008100000_tighten_service_role_rls_policies.sql`: 21 service_role-only `USING/WITH CHECK true` shapes plus four authenticated ownership checks using the cached auth.uid() InitPlan. Reapplying legacy policies regresses hardening.
- `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` enforces exact predicates, aborts on drift, performs no subscription policy DDL and finishes with `ROLLBACK`. `tests/p1-rls-replay-baseline.test.js` locks the static constraints. `scripts/sql/postgres-subscriptions-policy-reconciliation.sql` is read-only live-preview metadata evidence.
- Read-only connected Supabase **preview**, not production, had 25/25 hardened policy matches and two identical extra subscription SELECT policies. Remediation requires separate approved migration, true production-project identity and synthetic tenant/member allow-deny checks. Draft code and queued CI are not release proof.


Durable facts Claude, ChatGPT/Codex, and other repository agents must not re-derive. Update only with evidence. This file is development-project memory, not customer/runtime memory and not an authorization grant.

## Identity and current authority

- Parent: **SONARA Industries**.
- Platform: **SONARA One**.
- Products: **Business Builder**, **Creator Studio**, **Growth Studio**.
- Public product routes remain `/business-builder`, `/creator-studio`, `/growth-studio`.
- Current design/correctness authority is **v3 / Balanced Precision**. Older SONARA Nexus / Prism Wave-era handoffs are historical or compatibility context when they conflict with Batch 9/current repository authority.
- Public message: **Build. Create. Grow.**
- Repo: `famouslytrill-boop/sonara-os`, default branch `main`.
- Production: `https://sonaraindustries.com` on Vercel.
- Package manager: `pnpm@11.1.1` only. Never add `package-lock.json`.

## Batch convergence (research through Batch 24)

- `lib/sonara-batch-convergence-engine.cjs` aggregates screenshot and operational research through Batch 23 plus the requested-repository registry and maintained formal open-source registry.
- `data/open-source-tools.ts`, read through `lib/sonara-open-source-registry.cjs`, is the maintained adoption/licence decision surface. Its stricter decision wins over older screenshot/intake metadata when records conflict.
- `lib/sonara-source-evidence-register.cjs` maps uploaded PDFs, diagrams, graphs, design documents, model registries, research reports, and Batch 10 visual evidence into bounded source-derived requirements. Source evidence is not executable authority.
- `lib/sonara-model-engine-control-plane.cjs` classifies explicit model/engine runtime placement and all converged repositories into permissive candidates, copyleft review, blocked/unknown, or research-only groups.
- `lib/sonara-agent-skill-strategies.cjs` is the shared strategy contract for Claude and ChatGPT/Codex. Skills do not grant credentials, connected-app access, provider access, tenant access, or release authority.
- Claude repository work uses `.claude/skills/governed-batch-convergence/SKILL.md`.
- ChatGPT/Codex repository work uses `AGENTS.md` plus `.ai/shared/CHATGPT_CODEX_BATCH_1_10_STRATEGY.md`. This does not mean a ChatGPT app/plugin is installed; workspace/user authorization remains separate.

### 2026-09-27 screenshot research intake

- Batch 19 is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-27_BATCH19.md` and cataloged by `lib/sonara-screenshot-tool-radar-batch19.cjs`; its public and founder readiness routes remain non-executing.
- Batch 19 records 17 source-checked repositories, 15 hosted/educational/unresolved references and 8 deduplicated existing sources. License exceptions, per-skill licenses, user data, model weights, and public-data terms are item-specific.
- `lib/sonara-agent-skill-strategies.cjs` includes Batch 19 patterns for reusable skill contracts and typed business decisions. Skill metadata does not grant tools, permissions, provider access, tenant scope or release authority.
- The six architecture patterns cover skill assurance/supply chain, known-choice deterministic decisions, isolated code visualization, user-controlled media retention and public-data provenance/uncertainty. No external project code or dependencies were installed.

### 2026-09-28 screenshot research intake

- Batch 20 is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-28_BATCH20.md` and cataloged by `lib/sonara-screenshot-tool-radar-batch20.cjs`; it is wired through Research Lab, founder readiness and unified batch convergence.
- Five source-checked repositories remain cataloged-disabled: AHa-3D, the frontend UI prompt collection, Strata, InvokeAI and Logo Design Skill. Model weights, body assets, generated media and trademarked logo files retain separate rights boundaries.
- Eight previously governed repositories were reconciled instead of duplicated. Unresolved cropped repositories, the browser-use video-editing reel and the ambiguous WolfCut owner remain unresolved; approximate stars, screenshots and promotional claims do not establish suitability.
- Nine architecture records and `.claude/skills/designing-governed-product-workflows/SKILL.md` map visible actions to routes, state/data owners, approval gates, deterministic rules, provenance, retries, accessibility and acceptance checks. Formula processing remains paused until explicit owner authorization. No dependencies, migrations, models or external workflows were activated.

### 2026-09-30 screenshot research intakes

- Batch 21 is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-30_BATCH21.md` and cataloged by `lib/sonara-screenshot-tool-radar-batch21.cjs`; it reconciles business/mobile/finance/memory/workflow screenshots without enabling external code.
- Batch 22 is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-30_BATCH22.md` and cataloged by `lib/sonara-screenshot-tool-radar-batch22.cjs`; five verified repositories remain cataloged-disabled and its architecture contracts preserve provenance, metric truth, media lifecycle and local-agent privilege boundaries.

### 2026-10-03 screenshot research intake

- Batch 23 is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-10-03_BATCH23.md` and cataloged by `lib/sonara-screenshot-tool-radar-batch23.cjs`; it processes 54 screenshots as research evidence.
- Seven verified repositories are recorded without activation: TesterArmy e2e, Mobile Next MCP, Learn Harness Engineering, Riso Windowseat, Hindsight, OpenDots and uniTerm.
- Existing VoiceStudio, Qwen Image 2.1, Whisper Large v3 Turbo, Kokoro 82M and FLUX.1 Schnell records are reconciled rather than duplicated.
- Hugging Face models, datasets, Spaces, LoRAs and community variants remain discovery metadata until the model-hub promotion gate passes exact revision, license/territory, serialization, provenance, compute, safety, benchmark, worker and tenant-canary review.
- Mobile device control, remote shells/databases/clusters, voice cloning and model inference remain disabled; no provider credential, dependency, migration or production authority is added.
- Nine architecture extensions cover deterministic agent-test proof, mobile-device security, deterministic procedural media, memory lifecycle, privileged remote operations, voice/speech consent, vertical templates, model promotion and design-reference truth.

### 2026-10-04 screenshot research intake

- Batch 24 is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-10-04_BATCH24.md` and cataloged by `lib/sonara-screenshot-tool-radar-batch24.cjs`; it processes 34 screenshots as research evidence, including two explicit duplicate-image records.
- Twelve new repository records remain non-executing: CodeGraph, Free Claude Code, VidBee, sqlmap, Sure, Piik, Microsoft GraphRAG, Data Science for Beginners, REA, Overmind, NVIDIA Model Optimizer and the unlicensed AI Agent Tools directory.
- Ten existing resources are reconciled instead of duplicated: Munder Difflin, TesterArmy e2e, AutoGPT, OpenVid, Anti Slop, context-mode, PaddleOCR, Lead Gen API Stack, Public APIs and Awesome LLM Apps.
- High-risk boundaries remain explicit: sqlmap is owned/authorized-target defensive research only; REA is authorized compatibility research only; screen capture requires visible consent; external training services receive no production shell authority; AGPL/ELv2/PolyForm/noncommercial boundaries are not bypassed.
- Eleven architecture extensions cover code-impact graphs, realtime voice turn-taking, document AI, GraphRAG provenance, eval-to-promotion, project instruction policies, AI request lifecycle, model optimization, screen-sharing privacy, API security and bounded multi-agent topology.
- No dependency, provider endpoint, model, scanner, reverse-engineering runtime, capture service, migration or production authority is activated by Batch 24.

### 2026-09-18 cross-host repository intake

- `data/repository-intake-2026-09-18.json` adds exactly 30 research-only repositories and 30 exact-SHA pinned install targets across GitHub, GitLab, and Higgsfield sources; `pnpm run verify:repository-intake` enforces the split, uniqueness, pinning, licence-review and non-execution rules.
- `lib/sonara-batch-convergence-engine.cjs` consumes this as Batch 13. Both lanes remain non-executing in convergence; an install target is not evidence of runtime installation or activation.
- No third-party repository source was bulk-copied into SONARA. Package/tool adoption still requires a pnpm lockfile change, a real SONARA call site or explicitly developer/test-only classification, full CI/security/tenant checks, and the product-specific canary gate.

## Learning and memory truth

- `.ai/shared/PROJECT_MEMORY.md` is repository-native development memory only.
- The repository contains an older user-scoped `sonara_memory_records`/pgvector schema and `entity_agent_memory` database artifacts, but they are **not** evidence of a live organization-scoped semantic-memory product.
- `lib/sonara-learning-memory-control-plane.cjs` defines current memory/learning policy: organization scope, provenance, purpose, retention, explicit approval for preferences/patterns and sensitive memory, and hard blocks for credentials/raw payment secrets.
- Semantic retrieval remains setup-dependent until an embedding provider, model, and matching vector dimension are explicitly reviewed and runtime-verified. SONARA must continue to work without embeddings.
- Memory never bypasses owner approval, tenant scope, campaign/payment/publication/security controls, provider policy, or release gates.

## Production runtime

- Root Express app in `server.js`, exported by `api/index.js`.
- Vercel rewrites traffic to `/api`; serverless function bundles `public/**`, `routes/**`, and `lib/**`.
- Nested/archived frontend trees are not production runtime without a full-parity architecture decision.
- Pages are server-rendered by the current layout system with progressive enhancement from `public/sonara-*.js`.
- The application uses Supabase/PostgREST for its current database path. Service-role queries bypass RLS, so organization filters in server code remain a critical tenant boundary.

## Open-source and model adoption

- A public GitHub repository is not automatically commercially safe.
- Source-code licence, model-weight licence, dataset/content rights, trademarks, privacy, provider terms, and deployment/distribution obligations are separate checks.
- Permissive candidates require an allowed/allowed-after-review commercial-use decision, not only MIT/Apache/BSD/CC0 text.
- GPL/AGPL/MPL/custom/source-available projects stay external or isolated until the intended deployment/distribution boundary is explicitly reviewed.
- GPU/media/local-model workloads belong in isolated workers; desktop/computer-use tools remain owner-device or isolated-desktop companions by default.
- Unlicensed, unresolved, conduct-blocked, or policy-blocked repositories do not enter product source merely to increase an integration count.

## Commercial truth

- Canonical runtime pricing: Free $0; One workspace $29/month; All three $59/month; Team $109/month; annual twins are ten months of their monthly twin when configured; Business Builder setup is quoted. Keep strategy, docs, agents, entitlements and public copy synchronized with `lib/sonara-stripe-plans.cjs`. Do not change prices without owner approval and matching Stripe Price/config verification.
- Checkout redirects never grant paid access; entitlement truth must come from persisted verified billing state or explicit owner/admin authorization.
- Payment/customer-facing state must use provider-reported facts. Never invent processor fees, disputes, payment success, customer metrics, provider readiness, or compliance/certification status.
- Legal/compliance source material is implementation guidance and evidence input, not attorney review or certification.

## Non-negotiables

- Truthful states only; no simulated success.
- Credentials stay server-side. Never log or memorize service-role secrets, API keys, passwords, access/refresh tokens, private keys, raw card data, or CVV.
- Research/catalog/source-evidence records do not execute providers, install repositories, publish media, send campaigns, or control customer accounts.
- Tenant isolation, owner approval, provider policy, audit logging, and release gates remain authoritative across Claude, ChatGPT/Codex, MCP, plugins, local agents, and external tools.
- Retired public names must not render as current product identity.
- Use pnpm only; never weaken CI/release/security gates to manufacture green.
- Merge only after required checks are green and keep production/account/provider configuration blockers distinct from source-code completion.
