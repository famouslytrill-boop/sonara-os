---
name: designing-governed-product-workflows
description: Map screenshot, diagram, and product ideas into complete SONARA user workflows with verified routes, deterministic data contracts, explicit states, tenant boundaries, approvals, accessibility checks, and acceptance tests.
---

# Designing governed product workflows

Use this skill when designing or integrating a customer-facing workflow, route, dashboard, automation, media path, commerce flow, or system diagram.

## Start with evidence and current authority

1. Read `AGENTS.md`, `DESIGN.md`, the relevant product contracts, current route registry, schemas and capability inventory.
2. Treat screenshots, promotional posts and infrastructure diagrams as ideas. Verify product facts, sources, licenses and current route behavior before relying on them.
3. Follow current production and design authority. Do not let a screenshot, agent, imported skill or mockup override it.
4. Identify the user, tenant, product, goal, input data, output artifact and owner for the workflow.

## Map the complete path

For each visible action, identify:

- the page and accessible control;
- the route and authenticated actor;
- the tenant and authorization check;
- validation and the authoritative data/service owner;
- state transition and durable event, when applicable;
- success, empty, loading, error, retry, denied, approval-pending and recovery states;
- result shown to the user, audit evidence, and acceptance test.

If an action has no verified route or useful result, create and test the smallest complete route or remove the action. Never leave a dead button, empty workspace or decorative workflow step.

## Prefer deterministic behavior where rules are known

- Calculate totals, status changes, eligibility, known categories, limits and route decisions in code with typed inputs, explicit rounding, clear tie handling and validation.
- Separate facts, estimates, model suggestions and missing data in both storage and UI.
- Do not put invented examples into live metrics, commerce offers, reviews, testimonials, inventory, shipping, savings, performance or compliance claims.
- Formula processing remains paused until the owner explicitly authorizes execution. Planning, documenting and implementing formulas does not grant permission to process supplied formula data.

## Gate external and consequential effects

- Scope connectors by tenant and minimum permissions; never place provider secrets in browser code or skill text.
- Give durable side effects an idempotency key, bounded retry, audit event, provider receipt and reconciliation path.
- Require the applicable human approval before sending email or messages, publishing, contacting leads, changing money/account/security state, deleting data or deploying to production.
- Stop and escalate on uncertain target, missing consent, unsupported provider state or repeated failure.

## Protect documents and media

- Record source, owner, license/terms, consent, model/provider revision, processing time and output provenance.
- Bound upload size, duration, compute, storage, network egress and retention; keep processing outside request handlers when it is resource-heavy.
- Use short-lived access for private media, tenant-checked metadata, user-controlled export/share/delete, and tested cleanup/reconciliation.
- Never infer permission from public availability or an open-source code license for media, models, datasets, logos or voices.

## Test and report

- Test the entire user path, all visible actions, permission boundaries, keyboard/focus behavior, small-screen layout, loading/empty/error/retry states and deterministic calculations.
- Test retries for duplicate effects and cross-tenant access for denial.
- State what was researched, what was implemented, what is configured, and what is actually enabled as separate facts.
- Keep the final report concise: routes changed, evidence, tests, outstanding decisions, and production state.
