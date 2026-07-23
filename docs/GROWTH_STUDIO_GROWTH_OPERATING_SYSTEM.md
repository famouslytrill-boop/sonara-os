# Growth Studio Growth Operating System

## Product boundary

Growth Studio is SONARA's governed growth operating system for campaigns, CRM, lead lifecycle, audience segmentation, content planning and approval, first-party event collection, conversion recording, attribution evidence, experimentation, analytics snapshots, and provider orchestration.

It is not a copy of any proprietary provider backend. SONARA studies publicly documented product workflows, APIs, permission models, and open-source architectures, then implements its own tenant, billing, consent, approval, data, audit, and provider-control layer.

Growth Studio must never promise customers, rankings, virality, ad performance, or revenue. It records actions and evidence, makes measurement limitations visible, and lets customers operate authorized growth channels from one workspace.

## Current market research

### HubSpot

Capabilities studied:

- campaign CRUD
- campaign asset associations
- revenue reporting and campaign attribution
- CRM synchronization
- workflow-driven follow-up

SONARA production adapter:

- `campaign_create`
- `campaign_list`

Current official campaign API:

```text
POST /marketing/campaigns/2026-03
GET  /marketing/campaigns/2026-03
```

Environment:

```text
HUBSPOT_ENABLED=true
HUBSPOT_ACCESS_TOKEN=<protected OAuth/private-app token>
HUBSPOT_BASE_URL=https://api.hubapi.com
```

Required account scopes depend on the operation. Campaign creation requires campaign write access; reporting and revenue attribution require their documented read scopes.

### Klaviyo

Capabilities studied:

- event-triggered customer journeys
- profile and event ingestion
- dynamic segments
- lifecycle messaging
- engagement and campaign reporting

SONARA production adapter:

- `event_create`

Current official event API:

```text
POST https://a.klaviyo.com/api/events
revision: 2026-04-15
```

Environment:

```text
KLAVIYO_ENABLED=true
KLAVIYO_PRIVATE_API_KEY=<protected private key>
KLAVIYO_BASE_URL=https://a.klaviyo.com
KLAVIYO_REVISION=2026-04-15
```

SONARA supplies a unique event ID for deduplication. If an event can trigger email, SMS, push, or WhatsApp lifecycle messaging, an active purpose-specific consent record is required for the selected lead and channel.

### PostHog

Capabilities studied:

- product analytics
- web analytics
- event capture
- session replay
- feature flags
- experiments
- surveys
- CDP/workflow functions

SONARA production adapter:

- `event_capture`

Environment:

```text
POSTHOG_ENABLED=true
POSTHOG_PROJECT_API_KEY=<project key>
POSTHOG_HOST=https://us.i.posthog.com
```

The initial adapter captures approved first-party events. Session replay, person profiles, and expanded identity processing require separate privacy review.

### Google Analytics 4

Capabilities studied:

- custom reports
- batch and pivot reports
- realtime reports
- funnel reports
- audience exports
- dimensions and metrics

SONARA production adapter:

- `run_report`

Current official report endpoint:

```text
POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
```

Environment:

```text
GA4_ENABLED=true
GA4_PROPERTY_ID=<property id>
GA4_ACCESS_TOKEN=<short-lived protected OAuth token>
GA4_BASE_URL=https://analyticsdata.googleapis.com/v1beta
```

The token must be issued and refreshed by an approved OAuth or service-account broker. SONARA records provider metadata, sampling indicators, date ranges, and freshness evidence. Reports are not represented as unsampled or causal unless the provider evidence supports that statement.

### Google Ads

Capabilities studied:

- campaign and ad-group management
- search and reporting
- conversion uploads
- budget, bid, targeting, and creative mutations

Initial SONARA state:

```text
approval_required / connector_required
```

Google Ads requires developer-token approval, OAuth, customer-account authorization, and operation-specific contracts. Reporting can be activated after real-account acceptance testing. Spend, bid, budget, targeting, and public ad mutations always require explicit human approval. Autonomous budget increases are prohibited.

### TikTok Content Posting

Capabilities studied:

- creator information checks
- draft upload
- direct posting
- publish-status tracking

Initial SONARA state:

```text
approval_required / connector_required
```

The platform requires approved scopes, user authorization, and an application audit for public direct posting. Unaudited clients must not be described as public-post capable. Every publish action requires a final user confirmation.

### Meta, LinkedIn, and Mailchimp

These systems are represented by governed connector contracts. They remain disabled until the operator completes current account authorization, app review/partner access where required, exact API version review, and real-account acceptance testing.

No endpoint, permission, or response contract is invented.

## Open-source architecture research

### PostHog

Candidate role:

- self-hosted product and web analytics
- feature flags
- experiments
- surveys
- session replay
- CDP

Activation requires deployment architecture, privacy, retention, and component-license review.

### GrowthBook

Candidate role:

- feature flags
- A/B testing
- warehouse-native experiment analysis
- statistics and guardrails

Growth Studio's experiment model borrows the general product pattern of explicit hypotheses, primary metrics, guardrails, assignment units, weighted variants, and recorded outcomes. It does not copy GrowthBook source code.

### Mautic

Candidate role:

- contact management
- dynamic segments
- forms
- landing pages
- campaign automation
- email workflows

Activation requires an isolated deployment, operational security, deliverability, suppression, consent, and GPL-service-boundary review.

### Dittofeed

Candidate role:

- broadcasts
- customer journeys
- segmentation
- email, SMS, push, WhatsApp, and Slack delivery

The repository is a strong architecture candidate for an isolated lifecycle worker. Channel-provider contracts and consent enforcement remain independent SONARA responsibilities.

### listmonk

Candidate role:

- newsletters
- lists
- templates
- campaigns
- basic reporting

AGPL obligations require legal and architecture review before SONARA offers it as part of a managed service.

### n8n

Candidate role:

- scheduled workflows
- webhooks
- reviewed connectors
- operational automation

n8n must run outside the public Vercel process with network, execution, and secret isolation. Growth Studio will not accept arbitrary customer JavaScript, shell commands, filesystem paths, credentials, or unreviewed community nodes. Current security advisories must be reviewed before every deployment or upgrade.

### Plausible Analytics

Candidate role:

- privacy-focused web analytics
- goals
- funnels
- revenue events

AGPL and managed-service boundaries require legal review before activation.

## Implemented customer workflows

### Control center

```text
GET /growth-studio/control-center
```

The control center summarizes the tenant's campaigns, leads, content queue, provider jobs, approval boundary, attribution boundary, and provider readiness.

### Campaigns

```text
GET   /api/growth/campaigns
POST  /api/growth/campaigns
GET   /api/growth/campaigns/{campaignId}
PATCH /api/growth/campaigns/{campaignId}
```

Campaigns support draft, active, paused, completed, and archived states. Customer routes soft-archive records instead of deleting campaign evidence.

### Leads and CRM lifecycle

```text
GET   /api/growth/leads
POST  /api/growth/leads
PATCH /api/growth/leads/{leadId}
```

Leads are organization-scoped and support new, contacted, qualified, won, lost, and archived states.

### Audience segments

```text
GET  /api/growth/segments
POST /api/growth/segments
```

Segments use declarative JSON definitions. Executable JavaScript, shell commands, filesystem access, prototype manipulation, and unsafe URL schemes are rejected.

### Consent

```text
GET  /api/growth/consents
POST /api/growth/consents
```

Consent records are channel- and purpose-specific. Supported channels:

- email
- SMS
- push
- WhatsApp
- phone
- personalization
- analytics

A granted consent can expire or be withdrawn. Evidence references store a release, form, provider record, or other non-secret proof reference.

### Touchpoints and conversions

```text
GET  /api/growth/touchpoints
POST /api/growth/touchpoints
GET  /api/growth/conversions
POST /api/growth/conversions
```

Every touchpoint requires a tracking-basis attestation and a deduplication key. Conversions record:

- conversion type
- value and currency
- attribution model
- attribution confidence
- source, medium, and campaign
- event time
- provider or first-party metadata

Supported attribution labels:

- unattributed
- first touch
- last touch
- linear
- position based
- data driven
- provider reported
- custom

These are evidence labels, not guaranteed causal proof.

### Content planning and publishing approval

```text
GET  /api/growth/content
POST /api/growth/content
POST /api/growth/content/{contentId}/publish
```

Content begins as a draft. Email, SMS, push, and WhatsApp content requires an audience-consent basis attestation before it enters the queue. Publishing requires a separate explicit approval request.

A provider that is not fully authorized returns `approval_required`, `manual_required`, or `setup_required`; it never returns a fake published result.

### Experiments

```text
GET  /api/growth/experiments
POST /api/growth/experiments
```

Every experiment requires:

- a name
- a hypothesis
- at least two variants
- allocation weights totaling 1
- a primary metric
- optional guardrail metrics
- an assignment unit

Experiments start in `planned` state. Growth Studio does not automatically declare a winner without exposure, conversion, sample-size, and statistical review.

### Safe automation templates

```text
GET  /api/growth/automations
POST /api/growth/automations
```

Allowed triggers:

- lead created
- lead qualified
- form submitted
- campaign started
- conversion recorded
- consent granted
- content ready

Allowed actions:

- create task
- notify owner
- add to segment
- enqueue email
- synchronize provider
- send reviewed webhook

Rules are created disabled. High-impact actions retain a human-approval requirement. Arbitrary code is prohibited.

### Provider operations

```text
GET  /api/growth/provider-jobs
POST /api/growth/provider-jobs
POST /api/growth/provider-jobs/{jobId}/refresh
```

Every provider operation has:

- tenant and user scope
- provider and capability
- operation name
- unique idempotency key
- sanitized request and response metadata
- approval state
- status and progress
- error code and message
- append-only control events

### Metrics

```text
GET /api/growth/metrics
```

The first-party summary includes campaign, lead, touchpoint, conversion, content, and experiment totals. Provider snapshots preserve sampling and freshness warnings.

## Provider status vocabulary

- `configured`: required protected configuration exists and a direct adapter is available.
- `setup_required`: the adapter exists but account configuration is incomplete.
- `approval_required`: the operation requires explicit user approval or the provider is approval-gated.
- `manual_required`: the user approved the action, but operator authorization, OAuth, platform audit, or external completion is still required.
- `deployment_candidate`: an open-source system has a useful architecture but is not installed automatically.
- `review_required`: licensing, security, privacy, or managed-service obligations must be resolved first.
- `isolated_worker_only`: the system may run only outside the public web process with bounded inputs and execution controls.

## Database contract

Migration:

```text
supabase/migrations/20260723120000_growth_studio_control_plane.sql
```

New reviewed extension tables:

- `growth_provider_connections`
- `growth_audience_segments`
- `growth_contact_consents`
- `growth_touchpoints`
- `growth_conversions`
- `growth_content_queue`
- `growth_provider_jobs`
- `growth_metric_snapshots`
- `growth_experiment_variants`
- `growth_control_events`

Existing canonical Growth Studio tables remain in use:

- `growth_campaigns`
- `growth_leads`
- `growth_experiments`
- `automation_rules`

All extension tables use organization scope, row-level security, service-role writes, member reads, and no raw credential columns. `credential_reference` is only an opaque server-side vault reference and is column-revoked from anonymous and authenticated Data API roles.

## Non-negotiable safeguards

- No purchased, scraped, or unlawfully sourced contact lists.
- No outbound lifecycle messaging without purpose-specific consent.
- No hidden credentials in browser responses or database columns.
- No public posts without explicit user approval.
- No ad-spend, budget, bid, targeting, or creative mutation without explicit approval.
- No autonomous budget increases.
- No arbitrary customer code, shell commands, or unreviewed automation nodes.
- No fabricated impressions, clicks, conversions, attribution, or revenue.
- No claim that provider-reported attribution proves causation.
- No claim that sampled analytics are exact unsampled measurements.
- No claim that a connector is operational until real-account acceptance testing passes.
- No repository, container, workflow engine, or open-source marketing platform is downloaded automatically by the web application.

## Acceptance testing required before customer enablement

For each configured provider:

1. Authenticate using a dedicated test account.
2. Confirm requested scopes are the minimum necessary.
3. Execute a harmless test operation.
4. Verify idempotency and duplicate handling.
5. Verify provider errors are sanitized.
6. Verify no credentials appear in responses, logs, URLs, or persisted payloads.
7. Verify tenant isolation with two organizations.
8. Verify approval holds prevent publishing and paid-media mutation.
9. Verify channel consent prevents unauthorized lifecycle operations.
10. Verify provider data freshness and sampling metadata.
11. Verify cancellation, revocation, and reconnect behavior.
12. Record provider terms, privacy, data retention, and billing implications.

Until those tests pass, the provider remains disabled, setup-required, approval-required, or manual-required.
