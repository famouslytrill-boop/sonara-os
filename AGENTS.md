# SONARA Industries Agent Rules

## Product Architecture

SONARA Industries is the parent company for SONARA One, Business Builder, Creator Studio, and Growth Studio.

- Parent company: SONARA Industries
- Platform: SONARA One
- Products: Business Builder, Creator Studio, Growth Studio
- Public message: Build. Create. Grow.

Do not reintroduce retired public names in active UI, navigation, metadata, manifests, tests, or launch docs. If historical context is required, keep it in `docs/archive/legacy-names.md`.

## Public Product Positioning

- Business Builder: create, launch, run, and manage a business with guided systems, payments, bookings, records, and operational intelligence.
- Creator Studio: organize, protect, publish, monetize, and grow creative work, digital products, media, and creator operations.
- Growth Studio: attract customers, leads, fans, referrals, reviews, and revenue through campaigns, follow-up, offers, and growth systems.

Use plain customer-facing language. Avoid overusing internal engine names or "AI" in public copy.

## Safety

- Keep service-role secrets server-only.
- Use Provider Gateway or approved server-side provider adapters for AI calls.
- Enforce provenance, consent, and anti-clone safety.
- Do not store raw card data or CVV.
- Do not automate refunds, payout changes, legal/policy publishing, customer campaigns, proof/review publishing, security setting changes, or destructive data changes without owner approval.
- Unknown sensitive actions default to owner review.

## UI Direction

- Public overview screens should feel polished, dark-first, readable, and marketable.
- Work screens should be calm, clear, and operational.
- Mobile layouts must avoid overflow and use large enough tap targets.
- Sounds, voice announcements, haptics, SMS, push, and email alerts must be off or explicitly user-controlled by default.

## Batch 1-10 Convergence And Cross-Agent Skills

`lib/sonara-batch-convergence-engine.cjs` is the current aggregation layer for Batches 1 through 10 plus the requested-repository and maintained formal open-source registries. It deduplicates external repository research, preserves provenance from every intake/registry, keeps Batch 8 capability truth distinct from Batch 9 design/correctness authority, and keeps Batch 10 operational requirements explicit.

`data/open-source-tools.ts`, read by `lib/sonara-open-source-registry.cjs`, is the maintained adoption/licence register for repositories that have passed the deeper review stage. When that formal register and an older screenshot/intake record conflict, the formal register's integration/commercial-use decision wins unless production/runtime truth says otherwise.

`lib/sonara-model-engine-control-plane.cjs` classifies model families, engines, local companions, worker contracts, and commercially relevant open-source candidates. A registry record is not an installer and cannot execute a model or provider.

`lib/sonara-source-evidence-register.cjs` maps uploaded PDFs, model registries, design/research documents, diagrams, graphs, and Batch 10 visual evidence into source-grounded requirements. A source record is evidence/context only; it is not executable authority, a legal conclusion, or a compliance/certification claim.

`lib/sonara-agent-skill-strategies.cjs` is the portable strategy layer for Claude, ChatGPT/Codex, and future plugin packaging. Skills provide reusable instructions and workflows only. They do not grant credentials, connected-app permissions, MCP authority, provider access, customer-account access, tenant access, or permission to bypass owner approvals and release gates.

When older material conflicts with newer authority, use this precedence:

1. production/runtime truth;
2. current design authority (Batch 9 / v3 Balanced Precision);
3. formal open-source registry decisions;
4. operational requirements/source-grounded evidence;
5. verified external research;
6. historical reference.

Claude should use `.claude/skills/governed-batch-convergence/SKILL.md` for Batch 1-10 architecture/integration work. Codex and ChatGPT-driven repository work should follow this `AGENTS.md` plus the same control-plane records. A future ChatGPT plugin/skill package may reuse these strategies, but installation and app authorization remain separate user/workspace actions.

## External Tool Research Intake

When the owner supplies screenshots, GitHub links, social posts, packages, agent skills, design libraries, developer tools, PDFs, diagrams, or graphs and asks to add, use, integrate, install, or learn from them:

- Read `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md` before changing architecture or dependencies.
- Use `lib/sonara-batch-convergence-engine.cjs` as the cross-batch authority map and the batch-specific screenshot radar modules for provenance.
- Use `lib/sonara-source-evidence-register.cjs` for source-derived requirements and `data/open-source-tools.ts` for maintained adoption/licence decisions.
- Verify the exact upstream repository and actual license before adoption. Social copy, badges, star counts, and screenshots are discovery signals, not technical authority.
- Keep screenshot-sourced records non-executing until a separate implementation review explicitly promotes them. `researched`, `adapter built`, and `enabled in production` are different states.
- Never guess a repository owner, license, package, or URL from unreadable pixels. Leave it unverified until the source can be established.
- Browser automation may operate only on user-authorized destinations and must not defeat access controls or bot protections.
- Security tooling may target only systems SONARA owns or has explicit authorization to assess.
- External package managers, agent frameworks, and coding cockpits do not replace SONARA's pnpm, Provider Gateway, agent-authority, or controlled-deployment contracts without an explicit architecture decision.
- Claude should also use `.claude/skills/researching-screenshot-tools/SKILL.md` for new source intake.

## Commercial Open-Source Adoption

- "Commercially safe" is an architecture and license decision, not a synonym for "public GitHub repository."
- MIT, Apache-2.0, BSD, PostgreSQL, and CC0 projects are permissive candidates, but model weights, datasets, media, trademarks, privacy obligations, and provider terms still require separate review.
- GPL/AGPL/MPL/custom/source-available projects must be isolated, external, or separately approved for the intended distribution/deployment model before source reuse.
- A repository with no declared license is not adoptable source code by default.
- Desktop tools, GPU runtimes, browser/computer-use agents, renderers, OCR/document binaries, security tools, and local model stacks do not belong in the Vercel request process by default.
- Prefer adapters, interchange formats, isolated workers, local companions, and original SONARA implementations over bulk-copying third-party repositories.

## Build And CI Guardrails

- Use pnpm only.
- Do not use npm, npm audit fix, or package-lock.json.
- Do not commit secrets.
- Do not weaken audit/security checks without documenting the exact reason in `SECURITY_NOTES.md`.
- Keep CI fixes minimal and separate from product features.
- Verify with `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build` before push.
