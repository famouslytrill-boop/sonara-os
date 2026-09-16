# SONARA Project Memory

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

## Batch 1-10 convergence

- `lib/sonara-batch-convergence-engine.cjs` aggregates Batches 1–10 plus the requested-repository registry and maintained formal open-source registry.
- `data/open-source-tools.ts`, read through `lib/sonara-open-source-registry.cjs`, is the maintained adoption/licence decision surface. Its stricter decision wins over older screenshot/intake metadata when records conflict.
- `lib/sonara-source-evidence-register.cjs` maps uploaded PDFs, diagrams, graphs, design documents, model registries, research reports, and Batch 10 visual evidence into bounded source-derived requirements. Source evidence is not executable authority.
- `lib/sonara-model-engine-control-plane.cjs` classifies explicit model/engine runtime placement and all converged repositories into permissive candidates, copyleft review, blocked/unknown, or research-only groups.
- `lib/sonara-agent-skill-strategies.cjs` is the shared strategy contract for Claude and ChatGPT/Codex. Skills do not grant credentials, connected-app access, provider access, tenant access, or release authority.
- Claude repository work uses `.claude/skills/governed-batch-convergence/SKILL.md`.
- ChatGPT/Codex repository work uses `AGENTS.md` plus `.ai/shared/CHATGPT_CODEX_BATCH_1_10_STRATEGY.md`. This does not mean a ChatGPT app/plugin is installed; workspace/user authorization remains separate.

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

- Pricing owner approval: Free $0; Starter $7/month; Core $19/month; Pro $39/month; Business Builder setup one-time. Do not change without new owner approval.
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
