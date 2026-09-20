# Open Source Tool Review

SONARA Research Lab tracks external projects as intake candidates before adoption. A listed project is not automatically bundled, endorsed, installed, copied, self-hosted, or exposed to users.

## Required Review

Every candidate must be reviewed for:

- License and commercial-use rights
- Security posture and maintenance status
- Safety risks and misuse potential
- Product fit for Business Builder, Creator Studio, Growth Studio, or shared infrastructure
- Data handling and privacy impact
- Operational cost and support burden

## Default Decisions

- GPL, AGPL, non-commercial model weights, and unclear-license projects stay blocked or research-only until legal review.
- Scraping, credential automation, unofficial messaging automation, jailbreak, red-team, surveillance, or high-stakes tooling stays blocked until owner, legal, and security review approve a safe use mode.
- External references must not be represented as native integrations unless real configuration exists.

## Current Public Surface

The public watchlist lives at `/research-lab/open-source`. Detail pages explain license risk, commercial-use status, integration status, product fit, recommended action, and safety boundaries.

No external code was copied into SONARA for this registry.

## Repository Ecosystem Sweep — 2026-09-20

### Scope and operating rule

This pass reviewed current repository-hosting ecosystems plus 40 repositories relevant to SONARA's Node/Express, PostgreSQL/Supabase, Stripe, Resend, workflow, agent, observability, authorization, testing, commerce, business-management, scheduling and internal-tool surfaces.

The classification is intentionally stricter than "can I clone it?":

- **Installable candidate** means the upstream artifact is current, not archived, has a bounded SDK/package/service role, and can be evaluated without making it a second system of record. It still requires licence, security, tenant, workload and rollback review before runtime adoption.
- **Research only** means SONARA may study architecture, domain models, workflow design, UX and market positioning without copying source into the proprietary runtime. Reciprocal/source-available licensing, broad product overlap, duplicate authority, or migration-scale operating cost are enough to keep a project in this group.
- **No code was installed by this sweep.** Runtime dependency count added by this research pass: **0**. Production capability activations: **0**.

The governed records live in \`data/open-source-tools.ts\` and are rendered by the existing \`/research-lab/open-source\` route. The release gate remains \`scripts/verify-open-source-registry.mjs\`.

### Hosting and forge market analysis

| Platform / ecosystem | 2026 role | SONARA use |
| --- | --- | --- |
| GitHub | Primary public collaboration network, package/discovery ecosystem, Actions and the current SONARA source/release evidence home. | **Operational authority today.** Keep exact-head CI/security/release evidence here while the current delivery pipeline depends on it. |
| GitLab | Integrated source control, CI/CD, runners, package/container registries and self-managed DevSecOps. | Research as a self-managed / integrated DevSecOps alternative. A migration would be an infrastructure program, not a repository dependency. |
| Bitbucket | Git hosting with strong Jira/Atlassian workflow integration. | Most relevant where Jira is already the operating system for engineering work; not a current SONARA gap. |
| Codeberg | Non-profit, privacy-oriented community forge operated by Codeberg e.V. and built on Forgejo. | Useful governance/privacy reference and possible public mirror research; not a second release authority. |
| Forgejo | Community-governed self-hosted forge with Actions, federation work and privacy focus. Current v9+ licensing is GPLv3+. | Research portability, federation and private hosting. Keep source adoption separate from proprietary SONARA code. |
| Gitea | Lightweight MIT-licensed self-hosted all-in-one Git forge. | Stronger permissive self-host fallback than importing a larger DevSecOps platform. Still research-only until an actual hosting migration is required. |
| SourceForge | Long-running open-source project hosting and distribution ecosystem. | Discovery/distribution reference; no reason to move SONARA engineering authority there. |
| Launchpad | Canonical/Ubuntu-oriented code, package and issue ecosystem. | Useful when researching Ubuntu packaging and Canonical projects; not a general SONARA forge dependency. |
| Apache project repositories | Foundation-governed upstream source for Apache projects. | Treat as authoritative upstream research for Apache software, not as a generic hosting migration target. |
| Google Open Source | Catalog and upstream source discovery for Google-maintained open projects. | Research and dependency provenance source. |
| Apple Open Source | Apple-published open components and project releases. | Research and platform provenance source, especially for Apple ecosystem dependencies. |

### 20 directly installable candidates

These are **candidates**, not installed dependencies.

| # | Repository | Primary fit | Decision |
| ---: | --- | --- | --- |
| 1 | modelcontextprotocol/typescript-sdk | MCP client/server adapters | Optional adapter after review; mixed Apache-2.0/MIT transition requires notice/provenance review. |
| 2 | open-feature/js-sdk | Provider-neutral feature evaluation | Optional adapter; flags never replace auth or entitlement truth. |
| 3 | cloudevents/sdk-javascript | Event-envelope interoperability | Optional adapter; events remain evidence, not authority. |
| 4 | open-telemetry/opentelemetry-js | Traces/metrics/context | Optional adapter with redaction and cardinality controls. |
| 5 | temporalio/sdk-typescript | Durable workflows | Technically installable; benchmark-gated because it adds a workflow control plane. |
| 6 | qdrant/qdrant-js | Vector retrieval | Technically installable; benchmark against pgvector before adding another datastore. |
| 7 | pgvector/pgvector-node | PostgreSQL vector access | Strong PostgreSQL-first fit. |
| 8 | supabase/supabase-js | Supported Supabase client surface | Adopt selectively; service-role authority remains server-only. |
| 9 | stripe/stripe-node | Payments SDK | Strong server-side fit; verified webhooks remain paid-state authority. |
| 10 | resend/resend-node | Transactional email SDK | Strong provider fit; delivery is evidence, not workflow completion. |
| 11 | helmetjs/helmet | Express HTTP security headers | Strong stack fit; existing CSP gates remain authoritative. |
| 12 | express-rate-limit/express-rate-limit | Abuse-rate controls | Good Express fit; distributed state must match deployment topology. |
| 13 | ajv-validator/ajv | JSON Schema validation | Strong contract-boundary fit. |
| 14 | colinhacks/zod | Typed runtime validation | Useful at real TypeScript boundaries; not a reason for a framework migration. |
| 15 | taskforcesh/bullmq | Background queues | Technically installable; adds operational state and retry semantics. |
| 16 | microsoft/playwright | Browser/E2E release evidence | High-value exact-head testing for owned/authorized surfaces. |
| 17 | open-policy-agent/opa | Policy-as-code | Optional extra policy layer; must not replace PostgreSQL RLS. |
| 18 | openfga/openfga | Relationship authorization | Evaluate only for a proven sharing/authorization gap. |
| 19 | pinojs/pino | Structured logging | Strong Node fit with mandatory redaction. |
| 20 | node-cron/node-cron | Simple scheduled work | Suitable only where overlap/distributed execution is controlled. |

### 20 read-and-research-only references

These are architecture/market/UX references. Some are permissively licensed; "research only" can still be the correct engineering decision when adoption would create duplicate authority or a second full product runtime.

| # | Repository | What to learn | Why not directly adopt in this pass |
| ---: | --- | --- | --- |
| 1 | n8n-io/n8n | Workflow builder, connector graph, automation UX | Source-available licensing and hosted-product boundaries require legal review; do not embed. |
| 2 | twentyhq/twenty | CRM object model and modern CRM UX | Current licensing is reciprocal/open-core; broad overlap with Growth/Business surfaces. |
| 3 | directus/directus | Data/admin UI and API composition | Current source-available licensing plus duplicate backend/admin authority. |
| 4 | PostHog/posthog | Product analytics, experiments, flags, replay | Mixed/open-core licensing and customer telemetry/privacy boundary. |
| 5 | chatwoot/chatwoot | Support inbox, channels and agent workflow | Full support platform would duplicate SONARA support state; study patterns first. |
| 6 | makeplane/plane | Project/sprint/issue UX | AGPL and overlapping project-management scope. |
| 7 | ToolJet/ToolJet | Internal tools/app-builder UX | AGPL and direct overlap with proprietary application-building surfaces. |
| 8 | calcom/cal.diy | Availability, timezone and booking workflow | Current canonical repo is MIT, but a whole scheduling platform would duplicate SONARA booking authority. |
| 9 | frappe/erpnext | ERP domain model across finance/inventory/CRM/manufacturing | GPL and very broad product overlap. |
| 10 | odoo/odoo | Modular business suite architecture | LGPL ecosystem plus duplicate business-system authority. |
| 11 | mautic/mautic | Campaign journeys, segmentation and scoring | GPL and direct Growth Studio overlap. |
| 12 | getsentry/sentry | Error grouping, release health and triage | Self-hosted repository has non-trivial licensing/deployment review; use as architecture reference. |
| 13 | appsmithorg/appsmith | Internal admin/app-builder UX | Permissive, but still a large second runtime with overlapping authority. |
| 14 | activepieces/activepieces | Connector catalog, agent/MCP workflow UX | Open-core split and duplicate workflow authority. |
| 15 | medusajs/medusa | Modular commerce backend | Open-core split and duplicate catalog/order/customer authority. |
| 16 | saleor/saleor | Headless commerce/GraphQL architecture | Permissive, but a second commerce backend is unjustified without a proven gap. |
| 17 | go-gitea/gitea | Lightweight self-hosted forge | Research as a portability fallback; do not fragment current GitHub release evidence. |
| 18 | forgejo/forgejo (Codeberg canonical) | Community forge, privacy and federation | Current GPLv3+ and no current need for a forge migration. |
| 19 | gitlabhq/gitlabhq | Integrated DevSecOps and self-managed forge | GitHub mirror of GitLab; adoption is migration-scale infrastructure work. |
| 20 | nocodb/nocodb | Spreadsheet/database UX and generated APIs | Current Sustainable Use License is source-available with commercial-use constraints. |

### Market and architecture conclusions

The **lowest-regret near-term layer** is not another ERP, CRM, CMS, workflow platform or commerce backend. It is the thin infrastructure around SONARA's existing authority: event contracts, observability, schema validation, HTTP hardening, structured logs and exact-head browser testing. These improve speed and dependability without creating a second source of truth.

The **conditionally valuable layer** is Temporal/BullMQ, OPA/OpenFGA and Qdrant. Each can solve a real scale problem, but each also creates a new control plane, state store, policy runtime or operational dependency. Adoption should be evidence-triggered: queue depth/recovery requirements for workflow engines, authorization graph complexity for OpenFGA/OPA, and measured retrieval latency/recall/cost for Qdrant.

The **full business platforms** are more valuable as competitive and architecture intelligence than as dependencies. ERPNext/Odoo inform domain coverage; Mautic/n8n/Activepieces inform workflow and campaign UX; Medusa/Saleor inform commerce modularity; Chatwoot informs support operations; Twenty informs CRM; Appsmith/ToolJet/NocoDB inform internal tools. Copying those platforms into SONARA would increase integration surface and operational burden faster than it would create differentiated product value.

### Current-repository correction recorded by this pass

Cal.com's current public repository evaluated in this sweep is \`calcom/cal.diy\`, whose root licence is MIT. Older references to \`calcom/cal.com\` and its former licensing should not be used as the current repository fact without re-verification.

### Release boundary

This research pass does **not** install packages, clone external repositories into the source tree, add git submodules, add migrations, enable providers, create secrets, activate agents, change tenant/RLS authority, alter payment authority, or weaken CI/security/release gates. Any future adoption remains a separate exact-head change with its own dependency, licence, threat-model, tenant-isolation, rollback and production evidence.

