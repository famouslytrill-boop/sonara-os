# SONARA CrewAI Authorized Implementation Plan

Authorization has been granted to move CrewAI from research-only review into a controlled SONARA implementation plan.

This does not authorize unsafe secret exposure, unrestricted shell access, direct customer-data scraping, silent billing changes, or unreviewed outbound actions. It authorizes building a safe orchestration layer that can be audited, tested, reviewed, and disabled.

## Implementation status

Status: `authorized_controlled_build`

CrewAI can be integrated only through controlled worker jobs, not directly in the browser and not inside synchronous Vercel customer requests.

## Phase 1: Registry and visibility

Add CrewAI to the SONARA ecosystem registry and admin control-plane as:

- category: `agent_orchestration`
- status: `authorized_controlled_build`
- runtime: `worker_required`
- launch impact: `not_required_for_customer_launch`
- human review: `required`

Admin must show:

- whether CrewAI is installed/configured
- whether worker runtime exists
- whether agent jobs are enabled
- whether tool allowlist exists
- whether audit logging exists
- whether human review is enforced

## Phase 2: Database tables

Recommended Supabase tables:

- `agent_orchestration_jobs`
- `agent_orchestration_steps`
- `agent_orchestration_outputs`
- `agent_tool_allowlist`
- `agent_review_queue`
- `agent_audit_events`

Minimum fields:

### agent_orchestration_jobs

- id
- organization_id
- requested_by
- product_area
- job_type
- status
- input_payload
- output_summary
- risk_level
- human_review_required
- created_at
- updated_at

### agent_tool_allowlist

- id
- tool_key
- product_area
- allowed_roles
- can_read
- can_write
- can_send_external
- can_charge_money
- can_execute_code
- status

### agent_audit_events

- id
- organization_id
- job_id
- actor_user_id
- event_type
- event_payload
- created_at

## Phase 3: Worker placement

Allowed runtime options:

- Docker worker
- Rancher-managed worker later
- background queue processor
- local development worker for testing

Not allowed:

- browser-side CrewAI execution
- direct Vercel synchronous customer request execution
- unrestricted terminal command execution
- direct access to service-role keys by the agent process

## Phase 4: First pilot

First pilot: Admin Launch Readiness Crew

Purpose:

Review launch readiness without changing production state.

Inputs:

- `/api/health`
- `/api/readiness`
- `/api/ecosystem/readiness`
- `/api/formulas/readiness`
- Stripe webhook readiness
- Resend domain readiness
- Supabase migration readiness
- Storage bucket readiness
- latest Vercel deployment status

Output:

- launch blockers
- severity
- customer impact
- recommended fix
- owner/manual action required

No automatic fixes in pilot mode.

## Phase 5: Product pilots

### Business Builder Crew

Possible jobs:

- business setup checklist review
- inventory reorder suggestion
- vendor invoice summary
- food cost issue summary
- staff schedule risk summary

### Creator Studio Crew

Possible jobs:

- release checklist review
- song blueprint summary
- prompt quality review
- asset metadata cleanup proposal
- audio job result summary

### Growth Studio Crew

Possible jobs:

- campaign brief draft
- lead follow-up priority summary
- consent-risk review
- experiment result summary

## Phase 6: Safety and approval

Hard safety rules:

- No agent can charge a customer.
- No agent can send customer email without approval.
- No agent can publish public content without approval.
- No agent can delete records.
- No agent can read outside its organization/workspace scope.
- No agent can see raw service-role keys.
- No agent can execute arbitrary shell commands from customer input.
- Every job must write audit events.
- Every external tool must be allowlisted.
- Every risky output must enter human review.

## Phase 7: Admin visualizer

Admin page should eventually show:

- CrewAI status
- worker status
- job queue
- failed jobs
- pending human reviews
- enabled tools
- disabled tools
- audit trail
- risk summary

## Phase 8: Launch relationship

CrewAI is helpful but not a blocker for the first customer launch.

The customer launch blockers remain:

- owner/staff/customer permissions
- real CRUD APIs
- Stripe webhook proof
- Resend verified sender
- Supabase Storage buckets and policies
- Realtime access rules
- admin visualizer expansion
- premium UI deployment with passing tests

## Final rule

CrewAI can assist SONARA operations. It cannot silently operate SONARA.

Every agent must be accountable, scoped, reviewed, logged, and reversible. Anything else is just automation cosplay with legal liability.
