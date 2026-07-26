# OBLITERATUS Defensive Safety Reference

Date: 2026-07-26

## Source reviewed

- Repository: `elder-plinius/OBLITERATUS`
- Pinned commit: `a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc`
- Upstream license: AGPL-3.0 with an upstream commercial-license option
- Upstream stated purpose: analyze and remove model refusal behavior through weight- and activation-level interventions

## SONARA decision

Classification: `blocked_from_runtime_execution`

Integration mode: `quarantined_reference_only`

SONARA does not copy, install, import, clone, fetch at runtime, host, or execute OBLITERATUS. No upstream model-modification pipeline enters the production application, customer request path, Vercel runtime, Supabase functions, Docker workers, Rancher workloads, Creator Studio, Growth Studio, Business Builder, or public products.

## Why direct integration is rejected

Direct refusal-removal integration would deliberately weaken model safeguards. It would also create major abuse, model-license, data-provenance, AGPL/source-disclosure, telemetry, model-artifact, GPU-cost, incident-response, and customer-trust risks.

The upstream interface can modify model behavior, compare original and modified models, export altered artifacts, and push models to external hosting. Those functions are not approved SONARA capabilities.

## What SONARA added instead

SONARA added an original deterministic policy engine for defensive model-safety governance:

- refusal-integrity review;
- alignment-regression review;
- model artifact provenance;
- model and dataset license review;
- telemetry and network-egress review;
- customer-data and secret protection;
- isolated compute requirements;
- human approval and rollback requirements;
- explicit blocking of safety weakening and modified-model distribution.

The engine accepts a proposed activity and returns one of three decisions:

1. `blocked_safety_weakening_or_distribution`
2. `reference_only_defensive_review_required`
3. `not_approved_scope_requires_clarification`

It cannot download or load models, modify weights, run GPU jobs, call upstream services, transmit telemetry, export artifacts, publish models, or change infrastructure.

## Founder/admin routes

- `GET /admin/model-safety-resilience`
- `GET /api/admin/model-safety-resilience`
- `POST /api/admin/model-safety-resilience/review`

All routes require founder/admin authorization and write bounded audit evidence.

## Explicitly prohibited

- abliteration or obliteration execution;
- removing refusal directions or model guardrails;
- weakening safety alignment;
- serving uncensored or deliberately de-aligned customer models;
- exporting or publishing modified model weights;
- pushing modified models to Hugging Face or another registry;
- upstream telemetry;
- customer prompts, outputs, datasets, credentials, tokens, or production secrets;
- autonomous model downloads, shell commands, GPU jobs, or deployments;
- AGPL code in the proprietary SaaS runtime without separate legal approval.

## Future research gate

Any future defensive experiment must be a separate, isolated, owner-approved project and must include:

- legal approval;
- AI-safety review;
- model and dataset ownership evidence;
- offline or allowlisted network design;
- telemetry disabled;
- no customer data;
- non-production credentials;
- immutable artifact hashes;
- human-reviewed test cases;
- abuse monitoring;
- incident response;
- resource limits;
- rollback and deletion procedures;
- a separately reviewed pull request.

Cataloging this repository does not mean SONARA endorses, executes, distributes, or sells refusal-removed models.
