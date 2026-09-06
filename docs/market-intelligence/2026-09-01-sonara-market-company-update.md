# SONARA Industries Market & Company Update — 2026-09-01

Status: **New**

This document is a decision record, market-intelligence register, competitor update, product-roadmap input, technical backlog, compliance register, and change log for SONARA Industries. It does not authorize production changes. Facts below are source-dated; recommendations are explicitly labeled.

## Executive decision

SONARA should keep its current low-price, governed, cross-studio operating-system position and avoid competing feature-for-feature with category leaders. The most important September 2026 shifts are: model costs are falling while model choice is multiplying; multi-provider gateways and observability are becoming normal infrastructure; agent platforms are adding background execution, remote MCP, stronger identity boundaries and run-only permissions; creative suites are becoming agentic and persistent-memory systems; AI-search visibility is becoming a paid marketing category; agentic commerce is moving from experiments into payment infrastructure; and EU AI Act Article 50 transparency rules are now in force.

## Market intelligence register

| Status | Finding | Evidence date | Implication for SONARA |
|---|---|---:|---|
| New | OpenAI GPT-5.6 has separate Sol/Terra/Luna price tiers, with Luna materially cheaper for high-volume work. | 2026-09-01 | Route by task class instead of treating one frontier model as the default. |
| Updated | Anthropic made Claude Sonnet 5's $2/M input and $10/M output pricing permanent on 2026-08-10. | 2026-08-10 | Maintain provider-neutral routing and benchmark quality/cost continuously. |
| New | Gemini 3.7 Flash launched 2026-08-13 for coding/agents at introductory pricing below the prior Flash generation. | 2026-08-13 | Add a low-cost Google route to model benchmarks rather than hard-code one vendor. |
| Updated | Vercel AI Gateway offers multi-model routing, automatic fallback, unified spend telemetry and provider list pricing with no token markup. | 2026-09-01 | SONARA Nexus should expose an internal gateway abstraction even if Vercel is only one optional implementation. |
| New | Google Managed Agents now supports background execution, remote MCP, custom functions and credential refresh. | 2026-07-07 | Background jobs, MCP and durable credential handling are baseline agent capabilities. |
| New | Microsoft Copilot Studio added a production agent harness for more complex multi-step processes and is rolling out run-only sharing / stronger credential boundaries. | 2026-08 | SONARA agents need end-user identity, least privilege and non-owner execution modes. |
| New | Canva AI 2.0 is moving creation toward agentic editing, persistent memory, connectors, scheduling, web research and fully layered editable outputs. | 2026 | Creator Studio cannot win on raw generation; it should win on rights, provenance, portable project state and cross-workflow operations. |
| Updated | Canva Business is positioned at $20/person/month with no minimum; Adobe Firefly starts at $9.99/month and scales by generative credits. | 2026-09-01 | SONARA's $7/$19/$39 ladder remains price-competitive only if AI/media usage is bounded and cost-bearing work is metered. |
| New | Semrush now sells AI Visibility as a distinct product at $99/month/domain and bundles SEO + AI search tracking in higher plans. | 2026-09-01 | Growth Studio should productize answer-engine / AI-search visibility evidence without promising placement. |
| New | Stripe's Agentic Commerce Suite, Shared Payment Tokens and Machine Payments Protocol indicate commerce is being made agent-readable and agent-executable. | 2026 | Business Builder and SONARA Nexus should prepare for catalog discovery and permissioned agent checkout, but not autonomous spending by default. |
| New | EU AI Act Article 50 transparency obligations have applied since 2026-08-02. | 2026-08-02 | AI interaction disclosure, provenance and synthetic-content marking are now launch requirements for affected EU use. |
| New | Colorado's revised automated-decision and chatbot-safety rules take effect 2027-01-01. | 2026-07 | Build jurisdiction-aware compliance flags now rather than retrofitting them after expansion. |
| Updated | Supabase preview branches are usage-billed and not protected by Spend Cap. | 2026-08-28 | Preview environments need lifecycle cleanup and cost monitoring. |

## Competitor matrix

### Business Builder™

Primary pressure: Wix, Shopify, Square, HubSpot, HoneyBook and adjacent SMB suites increasingly bundle site creation, CRM, payments, automation and AI assistance. Wix paid website plans publicly range from about $17 to $159/month billed annually, with AI site tooling included.

**SONARA response:** do not build another generic site editor. Own the guided path from offer → intake/booking/order → payment → customer record → delivery → review/repeat. Add import/export, starter packs, cash-flow snapshots from posted records, and agent-ready catalogs later.

### Creator Studio™

Primary pressure: Canva and Adobe are collapsing design, generation, editing, scheduling and connected-work research into integrated creative operating surfaces. Canva AI 2.0 adds agentic workflows, persistent memory and editable layered objects; Adobe Firefly uses credit-based packaging with plans from $9.99/month upward.

**SONARA response:** double down on source files, provenance, rights/consent, collaborators, approvals, release packaging, portable exports, brand-deal operations and creator-owned audience records. Treat generation models as replaceable adapters.

### Growth Studio™

Primary pressure: Semrush, HubSpot and other marketing suites are monetizing AI visibility, AI customer agents, attribution and connected CRM automation. Semrush AI Visibility is $99/month/domain and tracks mentions/prompts across AI answer products.

**SONARA response:** build evidence-centric AI-search visibility, competitor monitoring, first-party customer timelines, experiment design, incrementality, source freshness, disclosure checks and confidence labels. Keep autonomous ad spend/publishing behind approval gates.

### SONARA Nexus

Primary pressure: Vercel AI Gateway, LangSmith/LangGraph, Google Managed Agents, Microsoft Copilot Studio and direct model-provider agent stacks are normalizing multi-model routing, traces, tool policies, remote MCP, background execution and deployment governance.

**SONARA response:** Nexus should be the shared policy and execution plane: provider-neutral gateway, task routing, budgets, tool permissions, approvals, traces, cost accounting, replay protection and failover.

### Agentic OS

Primary pressure: agent products are moving from chat helpers to long-running workers with tools, computer use, connectors, parallelism and persistent state.

**SONARA response:** prioritize identity, memory boundaries, sandboxing, approvals, durable jobs, observable plans/results, kill switches and customer-level resource scopes before adding more autonomous surface area.

## Product roadmap register

| Status | Affected company/system | Action | Why it matters | Value | Effort | Dependencies | Risk | Owner | Priority |
|---|---|---|---|---|---|---|---|---|---|
| New | Nexus + all studios | Add provider-neutral AI gateway and task router | Cost, reliability, lock-in | Very high | High | secrets, audit, billing metadata | Medium | Platform/AI | P0 |
| New | Nexus + agentic OS | Add per-org budgets, token/cost/latency telemetry and anomaly alerts | Protect $7/$19/$39 margins | Very high | Medium | gateway, org model | Low-Med | Platform/FinOps | P0 |
| New | Agentic OS + shared security | Add end-user identity, tool allowlists, approvals and sandboxing | Prevent privilege leakage and unsafe autonomy | Very high | High | auth, connectors, audit | High if omitted | Security | P0 |
| New | Shared compliance + Creator/Growth | Add AI disclosure, provenance and synthetic-content policy layer | EU Article 50 is active | Very high | Med-High | generation/publish records, legal review | High if omitted | Compliance/Platform | P0 |
| New | Growth Studio | Add AI Visibility / answer-engine evidence workspace | Fast-growing paid category; direct SMB value | High | Medium | web evidence ingestion, source registry | Low | Growth Product | P1 |
| New | Creator Studio | Add persistent project memory with explicit scope and reset/export controls | Competitors are making memory part of creation UX | High | Medium | project model, privacy rules | Medium | Creator Product | P1 |
| New | Creator Studio | Add editable project-state / layered-output abstraction where source formats allow | Static AI outputs are becoming a weaker UX | High | High | asset model, format adapters | Medium | Creator Product | P1 |
| New | Business Builder | Add agent-readable product/service catalog export and permissioned checkout preparation | Agentic commerce standards are emerging | High | Med-High | Stripe catalog, product schema | Medium | Business Product/Payments | P1 |
| Updated | All studios | Meter high-cost AI, media, storage, sending and third-party calls | Low pricing only works with bounded COGS | Very high | Medium | billing/usage events | Medium | FinOps/Product | P0 |
| New | Shared infrastructure | Add preview-environment TTL/cleanup and branch cost reporting | Supabase branches incur usage charges outside Spend Cap | Medium | Low-Med | CI + Supabase automation | Low | DevOps | P1 |
| Updated | Parent company | Publish clear AI-assisted-service disclosures and trust language without overusing “AI” in marketing | Transparency and buyer trust are becoming differentiators | Medium | Low | legal/compliance copy review | Low | Brand/Compliance | P1 |

## Technical backlog

### P0 — Critical

1. **AI gateway / model router** — GitHub issue #208.
2. **EU AI Act Article 50 transparency layer** — GitHub issue #209.
3. **Agent execution hardening** — GitHub issue #210.
4. Add usage ledger fields for provider, model, cached/input/output tokens, latency, estimated cost, tool count, fallback count and outcome.
5. Add hard/soft AI budgets by organization and product; hard limit should fail closed or downgrade to an approved cheaper task class.
6. Add idempotency and replay protection before any agent can trigger external writes.

### P1 — High

7. AI-search visibility workspace in Growth Studio with prompt set, provider/date, citation/referral evidence, competitor comparison and freshness.
8. Persistent memory scopes in Creator Studio and agentic OS: personal, organization, project and ephemeral; include clear/reset/export controls.
9. Agent-readable catalog endpoint and payment-intent handoff design for Business Builder.
10. Preview-branch TTL and cost monitoring for Supabase branching.
11. Model evaluation harness covering quality, latency, cost, refusal rate and tool success by task class.
12. Customer-facing AI cost/usage dashboard on paid plans.

### P2 — Validate before build

13. Computer-use automation for customers. Require sandbox + allowlisted domains + explicit approval before any production prototype.
14. Fully autonomous scheduled creation/publishing. Validate demand first; default to draft generation and approval.
15. Agent-to-agent payments. Track MPP/UCP adoption but do not build irreversible payment autonomy yet.

## Compliance register

| Status | Requirement / risk | Required SONARA control | Owner | Target |
|---|---|---|---|---|
| New | EU AI Act Article 50 — disclose AI interaction | Shared AI disclosure component | Compliance/Frontend | P0 |
| New | EU AI Act — machine-readable marking for applicable generated/altered content | Provenance/marking service and generation metadata | Creator/Platform | P0 |
| New | EU AI Act — deepfake/public-interest synthetic content disclosure | Publish-time policy gate and visible disclosure | Compliance/Product | P0 |
| Updated | GPAI downstream/provider traceability | Store provider/model/version/source metadata | Platform | P0 |
| New | Colorado ADMT/chatbot laws effective 2027-01-01 | Jurisdiction flags, decision-use inventory, consumer correction/escalation paths where applicable | Compliance | P1 |
| Updated | FTC deception/accuracy risk | Avoid claims of guaranteed AI objectivity, guaranteed growth, guaranteed placement or professional replacement | Brand/Legal | P0 |
| Updated | Creator sponsorship/review disclosure | Preserve approval/disclosure evidence in Creator + Growth handoff | Creator/Growth | P1 |
| Updated | Privacy / consent | Purpose- and channel-specific consent; export/delete controls; do not reuse project memory across scopes silently | Platform/Compliance | P0 |

## Security register

| Status | Concern | Control |
|---|---|---|
| New | Agent inherits maker/founder credentials | Execute as end user or scoped service identity; block credential inheritance |
| New | Prompt injection from web/email/docs | Track content origin/trust, isolate untrusted instructions, require policy checks before tools |
| New | Duplicate side effects during retries/failover | Idempotency keys, transactional outbox, replay protection |
| New | Cross-tenant memory leakage | Explicit memory scope + organization_id enforcement + deletion/export tests |
| New | Autonomous external communication | Default human approval for messages, publishing and campaign mutations |
| Updated | Secret leakage | Keep provider keys server-side; continue client-secret scanning and environment verification |
| Updated | Dependency and release drift | Keep launch verification gates; add dependency audit/SBOM if not already present |

## Pricing and packaging recommendation

**Recommendation — Proposed, not applied:** keep the public ladder at Free $0 / Starter $7 / Core $19 / Pro $39 for now, because competitor pricing confirms the entry point is differentiated. Do not advertise “unlimited AI.” Introduce transparent included AI/automation allowances by task class and let customers either buy additional usage or attach their own provider account where supported. Keep Business Builder one-time setup separate from recurring software value.

Why: Canva Business is $20/person/month, Firefly starts at $9.99/month and scales through credits, Semrush AI Visibility alone is $99/month/domain, and mature CRM/automation suites can move far above SONARA's current range. SONARA can remain cheaper without turning model/media/provider COGS into an unbounded liability.

## Operational gaps found in the current repository

**Verified existing strengths:** the repo already documents real Supabase-backed organizations, memberships, subscriptions/purchases and audit logs; Stripe webhooks are the source of truth for paid access; admin access is server-side; missing integrations show setup-required states; launch checks include tenant-policy, environment, Stripe, CSP, margin, stale-claim, migration and secret checks.

**Gap:** market intelligence exists but its static framework is dated 2026-07-25. This update should be reviewed and then used to refresh `lib/sonara-market-intelligence-registry.cjs` and related tests rather than silently changing the live framework.

**Blocked from verification in this run:** Vercel connected-project inspection could not run in non-interactive mode because the connector required user input. Therefore no claim is made about current production deployment health, environment variables, domains or runtime errors.

## Change log

| Status | Change |
|---|---|
| Completed | September 2026 market / competitor / regulation scan completed using current authoritative sources. |
| Completed | Created implementation-ready GitHub issues #208, #209 and #210. |
| Completed | Added this cumulative market/company update on a review branch. |
| Proposed | Refresh static market-intelligence registry `asOf` and source set after review. |
| Proposed | Implement gateway, FinOps telemetry, transparency, agent security and AI-visibility modules through separate reviewed PRs. |
| Blocked | Production Vercel health/config review; connector requires interactive authorization in this run. |
| Unchanged | No production code, schema, auth, billing, pricing, legal terms, secrets or deployment was modified. |

## Safest next actions

1. Review and merge this documentation PR only if the findings are accepted.
2. Design issue #208 first because routing/cost telemetry becomes a dependency for nearly every new AI capability.
3. In parallel, complete legal/product review of issue #209 because Article 50 is already effective.
4. Treat issue #210 as a release gate before expanding autonomous execution.
5. Build Growth Studio AI Visibility as the first market-facing opportunity after the P0 platform controls because it has clear current willingness-to-pay evidence and low irreversible risk.
6. Re-run Vercel production inspection in an interactive session before changing any deployment, domain or environment configuration.

## Sources checked

- OpenAI API / ChatGPT token pricing, observed 2026-09-01: https://openai.com/api/ and https://help.openai.com/en/articles/20001415
- Anthropic Claude Sonnet 5 pricing update, 2026-08-10: https://www.anthropic.com/research/claude-sonnet-5
- Google Gemini 3.7 Flash, 2026-08-13: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-3-7-flash/
- Google Managed Agents update, 2026-07-07: https://blog.google/innovation-and-ai/technology/developers-tools/expanding-managed-agents-gemini-api/
- Vercel AI Gateway: https://vercel.com/ai-gateway
- LangSmith pricing: https://www.langchain.com/pricing
- Microsoft Copilot Studio 2026 roadmap / agent harness: https://learn.microsoft.com/en-us/power-platform/release-plan/
- Canva AI 2.0: https://www.canva.com/newsroom/news/canva-create-2026-ai/
- Canva Business pricing: https://www.canva.com/newsroom/news/introducing-canva-business/
- Adobe Firefly pricing: https://www.adobe.com/products/firefly.html
- Semrush AI Visibility pricing: https://www.semrush.com/pricing/ai/
- Wix pricing reference: https://www.wix.com/blog/cheapest-website-builders
- Stripe Agentic Commerce / MPP: https://stripe.com/blog/everything-we-announced-at-sessions-2026 and https://stripe.com/blog/machine-payments-protocol
- EU AI Act current framework and Article 50 guidance: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai and https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations
- Colorado automated decision / chatbot rulemaking: https://coag.gov/ai/
- NIST Generative AI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- Supabase branching usage: https://supabase.com/docs/guides/platform/manage-your-usage/branching
