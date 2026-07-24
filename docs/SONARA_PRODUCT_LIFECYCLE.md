# SONARA Product Lifecycle

## Purpose

SONARA Industries uses one evidence-led lifecycle for the parent company, Business Builder, Creator Studio, and Growth Studio. The model converts a SaaS idea into a governed product initiative with explicit evidence, scope, delivery, beta, launch, and portfolio decisions.

This system was developed from the supplied *SaaS Launch Blueprint* and extended for SONARA's existing tenant model, server-controlled operations, security posture, accessibility policy, provider boundaries, and recurring-revenue business model.

## What the source blueprint contributes

The source blueprint correctly emphasizes three failure modes:

1. building without market research;
2. overcomplicating the MVP;
3. ignoring customer feedback.

It then presents a practical sequence:

- define and narrow a valuable problem;
- validate it with target users;
- assess the market and existing solutions;
- define a unique value proposition;
- create a preliminary concept;
- plan the MVP with user stories, wireframes, MoSCoW prioritization, milestones, risks, and feedback mechanisms;
- build through planning, design, development, testing, and agile iteration;
- apply usable, consistent, accessible, responsive UX;
- prepare the launch with a landing page, audience-building, marketing materials, analytics, and beta testing;
- collect structured feedback on usability, functionality, design, performance, and satisfaction.

Those principles remain the foundation. SONARA adds the operational controls required to make them enforceable across a real multi-product SaaS company.

## Required extensions for SONARA

The original blueprint is a useful educational checklist, but it does not define enforceable gates or a complete operating model. SONARA extends it with:

- organization-scoped evidence records and server-only writes;
- a minimum stage-gate readiness score before advancing;
- explicit advance, hold, pivot, stop, and scale decisions;
- Product Goals and non-goals, not only feature lists;
- a Definition of Done for every increment;
- security integrated through OWASP SAMM and NIST SSDF practices;
- WCAG 2.2 AA as the accessibility target;
- traces, metrics, and logs as the observability baseline through OpenTelemetry conventions;
- activation, retention, churn, revenue retention, support load, and reliability after launch;
- critical-feedback blockers before launch or scale;
- portfolio governance across all three studios.

## Seven-stage lifecycle

### 1. Discover

**Question:** Is there a specific, costly problem for a defined audience?

Required work:

- define the broad problem area;
- narrow it to a specific pain point;
- identify the target audience and operating context;
- assess market size, competitors, substitutes, pricing, and regulation;
- write the initial value proposition;
- record assumptions separately from evidence.

Gate evidence:

- problem statement;
- target audience;
- market or competitor evidence;
- customer interview or survey evidence;
- initial value proposition.

### 2. Validate

**Question:** Do target users confirm the problem, urgency, and proposed value?

Required work:

- conduct representative interviews and surveys;
- measure frequency, severity, current workaround, and switching friction;
- test willingness to pay or another economic commitment;
- identify the riskiest assumptions;
- define the primary success metric and expected target.

Gate evidence:

- multiple independent evidence records;
- direct customer evidence;
- economic or market evidence;
- refined value proposition;
- measurable success hypothesis.

### 3. Plan

**Question:** What is the smallest coherent product that tests the riskiest assumptions?

Required work:

- set one Product Goal;
- write user stories and acceptance criteria;
- classify scope with Must, Should, Could, and Won't Have;
- record non-goals explicitly;
- develop wireframes or prototypes;
- set budget, timeline, owner, risks, launch target, and measurement plan.

Gate evidence:

- Product Goal;
- Must Have scope;
- user stories;
- non-goals or Won't Have scope;
- primary metric and target.

### 4. Build

**Question:** Can the team deliver a safe, accessible, observable increment?

Required work:

- use goal-led, timeboxed iterations;
- maintain one prioritized backlog;
- define the iteration goal and Definition of Done;
- verify unit, integration, route, database, and security behavior;
- test WCAG 2.2 AA-relevant interactions;
- instrument traces, metrics, and logs where applicable;
- conduct review and retrospective sessions.

Gate evidence:

- at least one iteration;
- active or completed increment;
- Definition of Done;
- security evidence;
- accessibility and analytics/telemetry evidence.

### 5. Beta

**Question:** Does the product work for representative users under controlled conditions?

Required work:

- recruit testers who match the target audience;
- provide controlled access and clear instructions;
- collect qualitative feedback and behavioral evidence;
- categorize feedback by usability, functionality, design, performance, satisfaction, accessibility, security, reliability, pricing, and support;
- triage by severity and feasibility;
- resolve critical findings or record an explicit stop decision.

Gate evidence:

- structured feedback from representative testers;
- usability and functionality findings;
- performance or reliability findings;
- satisfaction evidence;
- no unresolved critical blocker.

### 6. Launch

**Question:** Can SONARA support, secure, measure, bill, and recover the product in production?

Required work:

- finalize positioning, landing page, calls to action, and launch communications;
- validate pricing, checkout, entitlements, invoices, and refunds where applicable;
- validate support queues, ownership, service expectations, and escalation;
- complete security, privacy, accessibility, legal, and provider-readiness checks;
- verify analytics, dashboards, alerting, incident response, and rollback;
- prepare customer onboarding and internal operating instructions.

Gate evidence:

- pricing and billing readiness;
- support readiness;
- compliance and security readiness;
- analytics readiness;
- no unresolved critical beta finding.

### 7. Learn & Scale

**Question:** Should the company scale, hold, pivot, or stop?

Required work:

- measure activation, repeated value, retention, churn, and revenue retention;
- monitor reliability, latency, error rates, and support load;
- compare actual outcomes with the Product Goal and target metric;
- identify expansion opportunities without hiding churn or support cost;
- record a portfolio decision and rationale.

Gate evidence:

- analytics evidence;
- primary metric results;
- customer feedback;
- stage review history;
- no unresolved critical blocker.

## Company-wide integration

### SONARA Industries

The parent control center manages the initiative portfolio across all studios. It records lifecycle stage, readiness, budget, target date, owner, decision history, and material blockers. The parent company uses this view to prevent duplicate products, uncontrolled feature expansion, and unsupported launches.

### Business Builder

Business Builder applies the lifecycle to offers, service-business workflows, booking, payments, staffing, inventory, locations, and operational tools.

Examples:

- validate the operator problem before building a workflow;
- use Must Have scope for the first usable service operation;
- beta test with representative independent businesses;
- measure setup completion, first transaction, repeated weekly use, support load, and paid retention.

### Creator Studio

Creator Studio applies the lifecycle to artist systems, music projects, assets, release packages, rights checks, media workflows, and creator monetization.

Examples:

- validate the creator's actual bottleneck rather than adding generic generation features;
- define consent, provenance, rights, and export requirements in the MVP scope;
- beta test with creators using real projects;
- measure completed creative workflows, successful exports, repeated project use, paid retention, and quality feedback.

### Growth Studio

Growth Studio supplies discovery and launch evidence while remaining consent-safe and attribution-honest.

Examples:

- maintain audience and market research evidence;
- connect campaigns and experiments to explicit product hypotheses;
- use purpose-specific consent for lifecycle messaging;
- preserve attribution model, confidence, sampling, and freshness;
- measure activation, qualified conversion, retention, churn, and revenue retention without presenting correlation as guaranteed causation.

## Operating cadence

### Weekly portfolio review

- review every active initiative's lifecycle stage;
- examine evidence added since the prior review;
- identify missing gate criteria and critical blockers;
- confirm one owner and one next decision date;
- stop or hold work that lacks evidence.

### Iteration cadence

- planning: define why the iteration matters, the goal, and selected work;
- daily coordination: surface progress and blockers;
- review: inspect the increment with stakeholders and update the backlog;
- retrospective: improve quality, effectiveness, tools, and Definition of Done.

### Monthly business review

- activation and retention by product;
- customer and revenue churn;
- net revenue retention where recurring revenue exists;
- acquisition and conversion evidence;
- support volume and resolution time;
- production reliability and security findings;
- portfolio decisions: advance, hold, pivot, stop, or scale.

## Data and control model

The lifecycle system uses tenant-scoped records:

- `product_lifecycle_initiatives`;
- `product_lifecycle_evidence`;
- `product_lifecycle_requirements`;
- `product_lifecycle_iterations`;
- `product_lifecycle_feedback`;
- `product_lifecycle_stage_reviews`;
- `product_lifecycle_events`.

Authenticated organization members may read their organization's records. Writes are performed through authenticated SONARA server routes using the service role. Direct browser Data API writes are revoked. Stage reviews are append-only evidence; the initiative stores only the latest decision and current stage.

## Decision rules

- Do not build before a defined problem and target audience exist.
- Do not advance or scale below a 70-point readiness score.
- Do not launch or scale with unresolved critical feedback.
- Do not describe an assumption as validated evidence.
- Do not use feature count as the definition of MVP value.
- Do not enable autonomous spending, publishing, or customer messaging through this lifecycle.
- Do not claim scale from acquisition alone; retention and support economics must be visible.
- Preserve the existing healthy production deployment until a replacement is READY and verified.

## External standards used to extend the blueprint

- Scrum Guide 2020: Product Goal, Sprint Goal, Definition of Done, Sprint Review, and Sprint Retrospective.
- W3C WCAG 2.2: perceivable, operable, understandable, and robust interfaces, targeting Level AA.
- OWASP SAMM: measurable secure-development maturity across governance, design, implementation, verification, and operations.
- NIST SP 800-218 SSDF: secure practices integrated into the software lifecycle.
- OpenTelemetry: vendor-neutral traces, metrics, and logs for operational evidence.
- Stripe subscription guidance: retention, churn, and net revenue retention as core recurring-revenue measures.
