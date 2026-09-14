# SONARA Engineering, Security, and Agent Architecture

Status: Accepted architecture direction  
Date: 2026-09-14  
Scope: engineering intelligence, release security, and agent presentation/runtime boundaries.

## Architecture Principles

1. Core SONARA business workflows must not depend on experimental visualization, training, or 3D-agent components.
2. Engineering intelligence runs before deployment and produces reviewable artifacts; it does not sit on the customer request path.
3. Security gates are release-blocking when they detect unresolved high-risk findings, tenant-isolation failures, secret exposure, or broken authorization boundaries.
4. Agents operate through explicit skills and permission boundaries. Sensitive or externally consequential actions remain approval-gated.
5. Optional presentation layers may be disabled without degrading core text, voice, authentication, billing, database, or admin capabilities.

## SONARA Engineering Intelligence

Development flow:

`Repository analysis -> Archify System Map -> architecture-delta review -> automated tests -> security gates -> deployment`

### Repository analysis

Repository analysis inventories runtime surfaces, routes, services, database boundaries, external providers, dependencies, workflows, migrations, and deployment configuration. The goal is to identify what changed before deciding whether a release is safe.

### Archify System Map

Archify is approved as development-time engineering intelligence, not a production runtime dependency. It may generate architecture, workflow, sequence, data-flow, lifecycle, and before/delta/after review artifacts from the repository.

Expected SONARA map domains include:

- public and private web routes;
- authentication and authorization boundaries;
- Supabase/Postgres and RLS-protected data paths;
- Stripe billing and webhook flows;
- Resend/email flows;
- Vercel/serverless deployment boundaries;
- storage, admin, audit, agent, and automation surfaces;
- approved external providers.

Generated architecture artifacts are evidence for review. They do not replace tests, policy checks, or human approval for sensitive changes.

### Architecture-delta review

Material pull requests should be reviewable as `before -> delta -> after`. Review must flag at minimum:

- new public endpoints;
- new privileged operations;
- authentication or role changes;
- RLS/schema changes;
- new third-party services;
- webhook/event boundaries;
- new agent tools or permissions;
- changes that move secrets or sensitive data across trust boundaries.

### Automated tests

The automated-test stage should include unit, integration, route smoke, migration/schema, auth/session, webhook-signature, permission, and regression coverage as applicable to the changed surface.

### Security gates

Security gates consume code, configuration, dependency, test, and architecture-delta evidence. A deployment is not considered releasable until required gates pass or an explicitly documented exception is approved.

## SONARA Security

Security flow:

`SAST/dependency/secret scanning -> RLS and tenant-isolation tests -> adversarial application tests -> BreachLab-derived training/playbooks -> release security evidence`

### SAST, dependency, and secret scanning

The release pipeline must include static-analysis, dependency-risk, and secret-detection checks appropriate to the active stack. Production secrets must never be committed to source or exposed to browser bundles.

### RLS and tenant-isolation tests

Multi-tenant authorization is a hard boundary. Tests must verify that a user from one organization cannot read, write, infer, enumerate, or mutate another organization's protected records. Server-side authorization and database RLS are independent controls and both must be exercised.

### Adversarial application tests

Authorized tests should cover the classes most relevant to SONARA, including:

- broken access control and IDOR;
- authentication/session/token failure modes;
- injection and unsafe input handling;
- XSS and unsafe rendering;
- SSRF and unsafe outbound requests;
- webhook spoofing/replay;
- file-upload abuse;
- API abuse and privilege escalation;
- agent/tool permission bypass;
- prompt/tool injection where AI-assisted workflows are enabled.

These tests apply only to SONARA-owned systems or environments for which explicit testing authorization exists.

### BreachLab-derived training and playbooks

BreachLab is an external training/reference source, not a SONARA runtime dependency. Lessons may inform internal threat models, authorized test cases, review checklists, tabletop exercises, and developer training. No third-party target should be tested without authorization.

### Release security evidence

Each production release should retain machine- or human-reviewable evidence for the checks relevant to that release, such as:

- build/test result;
- SAST result;
- dependency audit result;
- secret-scan result;
- RLS/tenant-isolation result;
- route/auth smoke result;
- architecture-delta artifact for material changes;
- adversarial test result when required;
- known-risk/exception record;
- release approver and deployment reference.

## SONARA Experience / Agents

Agent flow:

`Current text/voice agent -> skills/tool permissions -> memory -> emotion/state system -> optional three.ws 3D presentation adapter`

### Text and voice agent

Text and voice remain the primary supported interaction modes. The agent may reason about SONARA workflows, draft actions, explain state, and invoke approved tools subject to policy and user approval.

### Skills and tool permissions

Each tool or skill must declare its allowed inputs, side effects, permission requirements, tenant scope, audit behavior, and approval requirement. The agent must not gain broader authority merely because a new presentation layer is enabled.

### Memory

Agent memory must respect tenant, user, workspace, retention, and consent boundaries. Long-term or cross-session memory must not become an authorization mechanism and must not expose information across tenants.

### Emotion/state system

The emotion/state system is a presentation and interaction-state layer. It may affect tone, animation, pacing, or UI expression, but it must not override authorization, safety policy, user consent, billing controls, or release policy.

### Optional three.ws 3D presentation adapter

A three.ws-based 3D agent is approved only as an optional presentation adapter. It should be isolated behind an adapter boundary and feature flag, for example:

`SONARA_3D_AGENT_ENABLED=false`

The adapter may receive approved agent state such as speech text, expression state, animation intent, and non-sensitive presentation metadata. It must not receive unrestricted provider credentials, database service-role keys, raw payment data, or implicit elevated permissions.

Core text/voice operation must continue when the adapter is disabled, unavailable, or removed.

## Runtime and Dependency Boundaries

- Archify: development/CI engineering intelligence only.
- BreachLab: external training/reference only.
- three.ws: optional client/presentation adapter only.
- Supabase/Postgres/RLS: source-of-truth data and tenant boundary.
- Stripe: payment provider; payment authority remains server-side and webhook-verified.
- Resend/email provider: messaging transport under server-side policy.
- Vercel/runtime infrastructure: deployment/runtime boundary, not an authorization boundary.

No optional tool in this document is permitted to become a single point of failure for core SONARA business operations.

## Delivery Order

1. Keep production stabilization and CI repair work isolated from feature expansion.
2. Add Archify-backed architecture mapping to development/CI workflows.
3. Expand release security evidence and tenant/adversarial tests.
4. Add BreachLab-derived internal security playbooks.
5. Prototype the three.ws adapter behind a disabled-by-default feature flag.
6. Promote optional capabilities only after tests, threat review, operational ownership, and rollback paths exist.

## Canonical Stack Summary

### SONARA Engineering Intelligence

`repository analysis -> Archify System Map -> architecture-delta review -> automated tests -> security gates -> deployment`

### SONARA Security

`SAST/dependency/secret scanning -> RLS and tenant-isolation tests -> adversarial application tests -> BreachLab-derived training/playbooks -> release security evidence`

### SONARA Experience / Agents

`current text/voice agent -> skills/tool permissions -> memory -> emotion/state system -> optional three.ws 3D presentation adapter`
