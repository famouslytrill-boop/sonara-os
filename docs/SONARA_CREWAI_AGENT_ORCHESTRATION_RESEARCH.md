# SONARA CrewAI Agent Orchestration Research

Source reviewed: `crewAIInc/crewAI`.

## Decision

Add CrewAI to SONARA's research and integration queue as an agent/workflow orchestration candidate, not as a production dependency yet.

CrewAI is a Python multi-agent automation framework with two useful patterns for SONARA:

- **Crews**: groups of specialized agents that collaborate on tasks.
- **Flows**: event-driven workflows with more precise control and production-style orchestration.

The repository is MIT licensed, but production use still requires security, privacy, hosting-cost, model-cost, and data-boundary review before connecting it to customer data.

## Best SONARA fit

### Admin control plane

Potential agent roles:

- Readiness analyst
- Deployment reviewer
- Stripe webhook auditor
- Resend/domain checker
- Supabase migration reviewer
- Security checklist reviewer
- Customer-support triage assistant

### Business Builder

Potential agent roles:

- Business setup guide
- Menu/recipe cost reviewer
- Inventory reorder analyst
- Staff schedule reviewer
- Vendor invoice analyzer
- Local marketing planner

### Creator Studio

Potential agent roles:

- Release checklist reviewer
- Song blueprint assistant
- Prompt quality reviewer
- Originality/risk checklist reviewer
- Asset metadata organizer
- Audio-job result summarizer

### Growth Studio

Potential agent roles:

- Campaign planner
- Lead follow-up prioritizer
- Consent review assistant
- Experiment summary analyst
- Offer/copy reviewer

## Integration rules

Do not put CrewAI directly inside the Vercel request path for customer actions.

Preferred architecture:

1. Customer or admin creates a job in SONARA.
2. SONARA saves the job request to Supabase.
3. A worker picks up the job.
4. CrewAI runs inside a controlled worker/container environment.
5. Results are written back to Supabase.
6. Admin or customer reviews the result before any external action is taken.

## Required tables before production use

Recommended tables:

- `agent_orchestration_jobs`
- `agent_orchestration_steps`
- `agent_orchestration_outputs`
- `agent_tool_allowlist`
- `agent_review_queue`
- `agent_audit_events`

## Required safety rules

- No agent may access service-role keys directly.
- No agent may execute arbitrary shell commands from customer input.
- No agent may send email, charge a customer, alter billing, or publish public content without human approval.
- No agent may read records outside the active organization/workspace.
- Every agent job must have audit logs.
- Every tool must be allowlisted.
- Every output that affects customers must be reviewable.

## Runtime placement

Good fit:

- Docker worker
- Rancher-managed worker later
- Supabase Edge job trigger that queues work
- Background queue processor

Poor fit:

- Synchronous Vercel web request
- Browser/client bundle
- Unrestricted admin terminal workflow

## Launch status

Status: `review_required`

CrewAI should not block SONARA's current customer launch. The immediate launch gates remain:

- permission enforcement
- real CRUD APIs
- Stripe webhook verification
- Resend domain verification
- Supabase Storage buckets
- Realtime rules
- admin control-plane expansion
- mobile/premium UI deployment

## Recommended first CrewAI pilot

Pilot: **Admin Launch Readiness Crew**

Inputs:

- `/api/readiness`
- `/api/ecosystem/readiness`
- `/api/formulas/readiness`
- Stripe webhook status
- Resend status
- Supabase migration status
- latest Vercel deployment status

Output:

- launch blocker list
- severity
- fix instructions
- owner action required
- customer-impact warning

Human approval required before any automated fix runs.
