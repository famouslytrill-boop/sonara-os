# SONARA Agentic Business Patterns

Status: proposed implementation foundation on a review branch  
Date: 2026-09-16  
Scope: infrastructure, security, application/runtime, website/admin surfaces, and business workflow architecture.

## Why this exists

The September 16 screenshot intake contained three useful themes:

1. a five-pattern agent architecture (single-shot, iterative ReAct, planner-executor, reflexive, verifier-gated),
2. ten practical business-AI capability groups, and
3. a GPT-6 Astra operating guide.

SONARA adopts the reusable architecture concepts, not the screenshots as authority. Current model facts are recorded only when verified against official provider documentation. Uploaded visuals remain research inputs and do not grant runtime authority.

## Five agent execution patterns

### 1. Single-shot

Use for low-risk work that can be completed in one model invocation without a tool loop: classification, extraction, summarization, formatting, and simple drafts.

Controls:
- no external side effects;
- deterministic local rules remain preferred where a model is unnecessary;
- one bounded invocation;
- normal output review still applies.

### 2. Iterative ReAct

Use when the result depends on tool feedback, search, retrieval, troubleshooting, or another bounded observe/act cycle.

Controls:
- only allowlisted tools;
- tenant-scoped access;
- bounded iterations;
- explicit timeout/cost budget;
- stop on approval-required operations, repeated failure, or exhausted budget.

### 3. Planner-executor

Use for decomposable, long-running, or parallelizable workflows. A planner creates the structured plan; specialized executors perform narrow subtasks.

Controls:
- planning never grants authority;
- each executor receives the narrowest possible tool, tenant, data, and provider access;
- every subtask has an owner, state, timeout, retry/idempotency rule, and audit trail;
- completion requires aggregate validation.

### 4. Reflexive

Use for iterative quality improvement of content, code, analysis, or reasoning.

Controls:
- bounded refinement loops;
- explicit quality criteria;
- reflection does not replace independent validation, tests, or source evidence;
- no new permissions are acquired during reflection.

### 5. Verifier-gated

Use before high-impact financial, security-sensitive, compliance, deployment, destructive, data-mutation, or externally consequential outcomes.

Controls:
- independent verifier step;
- failed verification blocks, retries within policy, or escalates to a person;
- verifier evidence is retained with the action/release record;
- owner/human approval remains separate where required.

## Pattern composition

These are not mutually exclusive. Examples:

- planner-executor + verifier-gated for a release pipeline;
- planner-executor + bounded ReAct for research with several tools;
- single-shot + verifier-gated for a high-impact classification that must be independently checked;
- reflexive + verifier-gated for a complex draft that must be reviewed before external use.

SONARA chooses the simplest safe pattern capable of completing the task.

## Ten business-AI capability groups

The control plane now records these ten capability domains:

1. AI-assisted application building — plan, build, test, refactor, explain.
2. Agentic workflows — goal, plan, tools, verify, deliver.
3. Context engineering — instructions, goals, authoritative context, constraints, tools, output contract.
4. RAG and business knowledge — trusted documents, indexing, retrieval, grounded answers.
5. AI evaluation — accuracy, relevance, tool success, latency, cost, and safety.
6. Workflow automation — triggers, actions, human checks, state updates, task handoffs.
7. Data analysis with AI — summaries, spreadsheets, dashboards, trends, recommendations.
8. Multimodal AI — text, images, audio, video, documents, cross-format workflows.
9. AI security and approvals — access control, sensitive-data guardrails, human approval, auditability, safe outputs.
10. System thinking and deployment — problem mapping, workflow design, application layer, agent layer, deploy, observe, improve.

## Product mapping

### SONARA One / Nexus

Shared control plane for:
- identity and tenancy;
- provider/model routing;
- policy and approvals;
- retrieval/memory boundaries;
- evaluation and release evidence;
- monitoring and audit trails;
- business workflow orchestration.

### Business Builder

Primary use:
- workflow automation;
- context engineering;
- trusted business knowledge;
- operations analysis;
- staff/customer/inventory/booking/invoice assistance;
- approval-gated financial and externally visible actions.

### Creator Studio

Primary use:
- multimodal creation and analysis;
- media pipelines;
- provider/worker routing;
- rights/consent/provenance review;
- quality evaluation before publishing.

### Growth Studio

Primary use:
- campaign and audience workflows;
- data analysis;
- context/RAG for approved first-party knowledge;
- content adaptation;
- approval-gated dispatch and publishing;
- outcome measurement.

## Infrastructure integration

The pattern/capability catalog is deliberately metadata-first and uses the existing SONARA control-plane endpoint rather than adding a parallel authority surface.

Current integration path:

`request -> deterministic/local rule check -> choose execution pattern -> narrow context/tool contract -> execute bounded work -> evaluate -> approval/verifier gate -> audited result`

Infrastructure requirements for runtime promotion:

- explicit provider and tool allowlists;
- server-side secrets only;
- tenant-scoped database and retrieval access;
- per-run state and audit IDs;
- bounded retries and idempotency for side effects;
- cost, latency, and iteration budgets;
- observability for tool calls and failures;
- cancellation/rollback where the workflow can mutate external state;
- release evidence before a planned capability is described as live.

## Security integration

Security policy remains stronger than the pattern chosen.

Required controls:
- no cross-tenant retrieval or memory;
- no client-side authorization authority;
- no credentials in prompts, logs, public metadata, or browser bundles;
- independent verification for high-impact outcomes;
- explicit human approval for financial, destructive, externally consequential, or privileged operations;
- authorization before active security testing;
- no model/agent may widen its own tool permissions;
- release gates remain blocking for unresolved high-risk findings, tenant-isolation failures, secret exposure, or broken authorization boundaries.

## GPT-6 Astra integration posture

Official OpenAI documentation was checked on 2026-09-16. SONARA records the following verified profile as non-executing configuration metadata:

- provider: OpenAI;
- API model id: `gpt-6-astra`;
- API surface: Responses API;
- supported reasoning effort: `low`, `medium`, `high`, `xhigh`, `max`;
- context window: 1,050,000 tokens;
- maximum output: 128,000 tokens.

SONARA does **not** switch its safe default model automatically. The existing OpenAI provider remains opt-in, server-side, and controlled by `SONARA_OPENAI_MODEL` plus provider/account availability. Computer-use, cybersecurity, financial, deployment, destructive, and customer-account actions keep their existing approvals and policies regardless of model capability.

## Website and admin behavior

The existing ecosystem agent-strategy endpoint now exposes the pattern catalog, ten business capability groups, and the verified Astra profile as non-secret metadata. Existing admin AI-integration/readiness pages already consume that strategy catalog, so the data becomes visible through the current control-plane website without introducing a second permission model.

Public website copy must follow a stricter rule:

> A planned or cataloged capability is not marketed as live until runtime, tenant/security, provider, and release evidence prove it is available.

## Promotion sequence

1. Merge the non-authorizing pattern/capability metadata and tests.
2. Keep deterministic rules as the default path.
3. Select one measured workflow per product and implement the smallest bounded agentic slice.
4. Add evaluation datasets and verifier criteria before expanding autonomy.
5. Add retrieval only when tenant-scoped source, retention, and provider/model configuration are verified.
6. Add external side effects only through existing SONARA approval/audit/idempotency contracts.
7. Promote public product claims only after release evidence and operational ownership exist.

## Non-goals

This change does not:
- enable a provider;
- install an MCP server or plugin;
- grant computer-use permission;
- change credentials;
- change the default model;
- enable autonomous financial, deployment, publishing, customer-account, or cybersecurity actions;
- turn screenshot claims into production truth;
- weaken existing tenant, approval, or release controls.
