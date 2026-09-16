# Batch 11 verified integration — 2026-09-16

Status: verification/control-plane slice in progress. No external repository, model, agent, security tool, document worker, or meeting assistant is enabled in production by this batch.

## Purpose

The latest screenshot intake is now treated as a closed research batch. This pass converts useful claims into governed SONARA requirements only after repository identity/licence verification, source correction, product-fit analysis, and safety-boundary review.

The implementation rule is evidence before adoption:

`visual lead -> canonical source -> licence/security review -> SONARA requirement -> architecture contract -> tests -> optional adapter -> production gate`

A social-media post, screenshot, star count, price claim, prompt, demo, README badge, or marketing description is never sufficient production authority.

## Verified/corrected repository leads

| Screenshot/reference | Canonical repository | Declared repo licence checked 2026-09-16 | SONARA handling |
| --- | --- | --- | --- |
| Harness team factory | `revfactory/harness` | Apache-2.0 | Agent-team pattern research only |
| Skills for Real Engineers | `mattpocock/skills` | MIT | Curated skill-pattern research only |
| Reverse Skill | `zhaoxuya520/reverse-skill` | MIT | Authorized Security Lab reference only |
| UI UX Pro Max | `nextlevelbuilder/ui-ux-pro-max-skill` | MIT | Design research; Balanced Precision remains authority |
| Agency Agents | `msitarzewski/agency-agents` | MIT | Corrected upstream; selected role patterns only |
| Meetily | `Zackriya-Solutions/meetily` | MIT | Local companion / explicit import research |
| OfficeCLI | `iOfficeAI/OfficeCLI` | Apache-2.0 | Corrected upstream; isolated artifact-worker research |
| OpenWiki | `langchain-ai/openwiki` | MIT | Corrected upstream; read-only documentation-worker research |
| Strix | `usestrix/strix` | Apache-2.0 | Corrected upstream; authorized staging security only |
| Comp AI CRM | `trycompai/crm` | MIT | Agentic-CRM/data-model research only |
| Scroll World | `oso95/scroll-world` | MIT | Optional immersive-design research only |
| Nano Banana prompt recommender | `YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill` | no repository licence declared in current metadata | Source/prompt corpus blocked; general search/recommendation pattern only |

The previously supplied `omniroute/omniroute` and `nicosxt/awesome-design-md` identities remain unresolved and therefore remain blocked from source adoption.

## What enters SONARA architecture

### Agent execution framework

Use a bounded graph:

`router -> specialist workers -> shared state -> integrator -> reviewer -> human checkpoint -> ship`

Workers receive only the tools required for their role. An agent-team factory may define roles and handoffs, but it cannot grant shell, network, repository write, production secrets, billing, publishing, sending, destructive actions, or deployment authority.

### Skill framework

Every reusable skill should carry:

- stable key and version
- purpose and product fit
- provenance/source
- input/output contract
- required tools/capabilities
- data sensitivity class
- network/write/send/billing/destructive flags
- human-review requirement
- test/evaluation evidence
- status: research, adapted, reviewed, enabled, deprecated, blocked

Third-party skill collections are review inputs. High-value concepts should normally be rewritten into smaller SONARA-owned skills instead of bulk-installed.

### Business Builder

Add a truthful planning/estimation workflow:

`idea -> requirements -> MVP scope -> architecture -> code/low-code/no-code/build-vs-buy comparison -> engineering effort -> infrastructure/operating/maintenance cost -> delivery risk -> timeline -> evidence`

Do not infer product valuation from an avoided agency quote or a prompt containing a dollar amount. Replacement cost, implementation cost, and business valuation are different concepts.

### Founder Operations / meeting intelligence

Design an explicit import contract for local meeting outputs:

`approved local recording/transcript -> transcript/summary import -> decisions -> action items -> owners -> deadlines -> CRM/project links`

Recording consent is mandatory. Raw audio/transcripts do not silently leave the user's local environment or cross tenant boundaries.

### Document and documentation workers

Office-format generation/editing and codebase documentation belong in isolated, queue-backed workers rather than the production request process. File type, size, path, macro, provenance, malware, and output validation are required before artifacts can enter a customer workspace. Documentation workers start read-only and cannot auto-merge changes.

### Growth Studio / CRM

Agentic CRM patterns may improve research, notes, task creation, qualification evidence, and recommendations. Outbound communication, contact mutation, stage changes, deletion, exports, billing, or campaign actions remain explicit permissioned operations with audit evidence and human ownership.

### Creator Studio / design system

External UI/UX, motion, prompt, 3D, and scroll skills are research inputs. SONARA v3 / Balanced Precision remains the design authority. Motion and immersive effects must pass accessibility, reduced-motion, mobile performance, information-hierarchy, and conversion review before adoption.

### Authorized Security Lab

Security/reverse-engineering tools require owned or explicitly authorized targets, target allowlists, isolated environments, bounded egress, non-production credentials, rate limits, retained logs, and human security review. They do not become a general customer exploitation capability.

## Schema/table sequence

The next database slice should follow the already-proven generation-adapter lifecycle and add new migrations rather than editing shipped migrations. Required durable records are:

1. `generation_jobs` — tenant-scoped lifecycle, idempotency key, expected/version field, request references/digests, deadlines, state, provider/runtime selection, and terminal timestamps.
2. `generation_attempts` — provider/runtime attempts, server-assigned locator, retry number, start/end status, sanitized failure class, and timing.
3. `generation_artifacts` — durable storage reference, SHA-256 digest, media type, provenance, attempt/job linkage, size and creation time. Success requires at least one durable artifact.
4. `generation_callback_events` — provider callback identity/dedupe key, signature/auth result, received/applied timestamps, payload digest only, and replay status.
5. `generation_cost_events` — estimated/authorized/final cost in minor currency units, currency, source, and attempt/job linkage.
6. `generation_audit_events` — append-only lifecycle/approval/security evidence without raw prompts, tokens, credentials, or unbounded provider payloads.

All six tables require `organization_id`, indexes that start with tenant scope for tenant queries, RLS/member policy compatibility, service-role server filters, idempotent migrations, and adversarial cross-tenant tests. A provider cannot be connected merely because these tables exist.

## Website/application integration sequence

The customer-facing site should not expose every research lead. Product surfaces should expose only capabilities backed by a real workflow and evidence. The first useful UI additions after backend/schema readiness are:

- Business Builder: evidence-backed build/MVP estimator
- Founder/Admin: verified-source and integration-readiness view
- Files & Records: explicit transcript/summary import
- Creator Studio: curated skill/prompt search with licence/provenance status
- Growth Studio: bounded CRM research/recommendation workflow
- Admin: generation lifecycle evidence, callbacks, costs, artifacts, retries, and approvals

No UI should label a capability as connected, live, local, automated, compliant, free, or production-ready unless runtime evidence supports that exact claim.

## Release gates

Before this batch or its follow-on database work can reach `main`/production:

- build and test suite must pass
- lint/type/secret scans must pass
- open-source registry and licence checks must pass
- tenant/RLS and request-supplied tenant-id checks must pass
- migration replay/checksum checks must pass for any schema change
- OpenAPI/route contracts must remain truthful
- no external network/spend/runtime authority is added by research records
- deployed commit provenance must match the reviewed main commit before production is considered current

This document is an architecture/research authority for Batch 11 only. Formal open-source registry decisions and current runtime/source code remain higher authority when there is a conflict.
