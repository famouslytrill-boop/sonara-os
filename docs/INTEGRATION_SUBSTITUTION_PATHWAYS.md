# SONARA Integration Substitution Pathways

Updated: 2026-09-11
Review by: 2026-12-11

This document turns free and open-source technology research into a controlled
plan for Business Builder, Creator Studio, Growth Studio, and the SONARA admin
console. It is an architecture decision record, not a promise that every
listed project is installed or production-ready.

## Guardrails

- Supabase/Postgres remains the system of record for identity, organizations,
  billing evidence, customer records, jobs, approvals, and audit events.
- Vercel request handlers stay short. Long-running media, indexing, model, and
  telephony work belongs in an isolated worker or managed job service.
- Every external capability needs a registry entry, owner, license review,
  feature flag, server-side credentials, scoped data access, audit events,
  tests, and a rollback path.
- Free means free to evaluate or self-host; it does not mean unlimited,
  commercially licensed, abuse-proof, or operationally free.
- No provider may send messages, publish content, place calls, charge a card,
  or modify customer data without an approved workflow and human review where
  the action is consequential.

## Recommended substitution matrix

| Capability | Free-first option | SONARA adapter boundary | Decision |
| --- | --- | --- | --- |
| Weather for venue workspaces | Open-Meteo | `weather-provider` reads a user-selected location; cache normalized forecasts; disclose limits | Candidate. Verify commercial terms before monetization; the upstream repository is AGPL and data has separate terms. |
| Relational data and vector memory | Supabase Postgres + pgvector | Existing database contract, RLS, signed storage URLs, and vector namespace checks | Adopted. pgvector supports similarity operators and indexes inside Postgres. |
| Lexical product search | Meilisearch Community Edition | `search-provider` indexes only approved, non-secret records; private records remain organization-filtered | Adopted by repository contract. Review the current MIT/BUSL split before distributing Enterprise features. |
| Durable workflows | Supabase job tables plus an explicit state machine | `workflow-provider` persists idempotency key, state, retries, approval, and audit rows | Adopt now. Evaluate DBOS or Reflow later in a worker; do not add a second runtime to Vercel. |
| Transactional email | Resend | Existing server-only email adapter with delivery status and retry evidence | Keep for launch. Self-hosting email is a later option, not a drop-in replacement. |
| Self-hosted email research | Hyvor Relay, BunMail, or Posta | Separate worker service with domain, DKIM, bounce, abuse, and incident controls | Review required. License, deliverability, and maintenance risks outweigh launch benefit. |
| Maps and location | OpenStreetMap-compatible tiles plus Leaflet | `map-provider` requires attribution, rate limits, coarse location by default, and opt-in GPS | Candidate. Never use public tiles as an unbounded production backend. |
| Observability | OpenTelemetry JS | Server-only traces/metrics with redaction and sampling | Candidate. Add after a measured visibility gap; never export prompts, secrets, or customer content. |
| Video/audio processing | FFmpeg, librosa, Essentia, Demucs | Queue-backed worker writes derived metadata and provenance to Supabase | Worker candidate. No processing in Vercel request paths. |
| Broadcast control | OBS with operator-controlled integration | Explicit local/operator connection, approval, and audit trail | Reference only for launch. No automatic publishing. |
| AI/model execution | Deterministic formulas, policy rules, approval gates, and provider-neutral interfaces | `model-router` records task type, cost tier, sensitivity, provider, fallback, and review requirement | Adopt now. External models remain optional and disabled unless configured. |

## Product pathways

### Business Builder

Start with deterministic calculators, intake, customer records, offers,
checklists, quote/invoice preparation, and approved weather context for venue
planning. A free weather request must be cached and rate-limited. It must not be
presented as a safety-critical forecast or as an automated operating decision.

The next useful upgrade is a workflow queue that turns an intake into reviewable
steps: `received`, `needs_information`, `ready_for_review`, `approved`, and
`completed`. Each transition is a database write with an organization check.

### Creator Studio

Use Supabase Storage for private source files and a worker for media metadata,
transcription, waveform analysis, and export preparation. Keep rights notes,
provenance, and collaborator approvals alongside each asset. Browser playback,
upload, and basic organization can remain lightweight and free; rendering and
large-file processing should be metered or paid.

### Growth Studio

Use first-party customer records, consent records, deterministic segmentation,
campaign drafts, and approval queues. A free plan can prepare campaigns and
show previews. Sending, SMS, calling, and publishing require provider setup,
valid consent, opt-out enforcement, and an explicit approval event.

### Admin command center

Expose readiness, not secrets: provider configured/unconfigured, last checked,
last successful job, failed job count, queue depth, and the next setup action.
Never expose provider keys, private prompts, raw webhook bodies, or private
customer documents.

## Rollout sequence

1. **Now:** keep the current providers, document adapters, and test all missing
   configuration states.
2. **Low risk:** add Open-Meteo, search indexing, and workflow queue adapters
   behind flags with rate limits and organization scoping.
3. **Worker phase:** add FFmpeg/audio analysis and transcription jobs with
   resource limits, provenance, and human review.
4. **Operational phase:** add OpenTelemetry and self-hosted fallback services
   only after measuring cost, reliability, and support burden.
5. **Research only:** world models, robotics, live phone agents, automatic
   outbound outreach, and GPU-heavy generation remain outside the paid MVP.

## License and cost decisions

- MIT, Apache-2.0, and BSD dependencies still require dependency and security
  review; permissive licensing is not a security guarantee.
- AGPL, BUSL, source-available, model-weight, and data-license obligations need
  explicit legal review before code or hosted service use in revenue products.
- A self-hosted service is not zero cost: compute, storage, backups, DNS,
  monitoring, upgrades, abuse handling, and incident response are operating
  costs.
- Paid provider paths remain valid when they reduce delivery risk. Free and
  open-source substitutions should be selected by total cost and reliability,
  not by license price alone.

## Definition of done for an integration

An integration is not customer-facing until all are true:

- The registry names the source, license, data class, owner, status, and runtime
  placement.
- A server-side adapter validates configuration and fails closed with `Setup
  required` when it is absent or malformed.
- RLS or an equivalent server-side authorization check scopes every read/write.
- Retries are bounded and idempotent; failed work is visible to an operator.
- Secrets remain in deployment/worker secret stores and never enter browser
  code, URLs, logs, metadata, or screenshots.
- Tests cover configured, missing, invalid, unauthorized, duplicate, timeout,
  and rollback states.
- Documentation names the dashboard setup, ongoing cost, legal review, and
  removal procedure.

## Sources

- [Open-Meteo repository](https://github.com/open-meteo/open-meteo)
- [Open-Meteo geocoding API documentation](https://open-meteo.com/en/docs/geocoding-api)
- [pgvector repository](https://github.com/pgvector/pgvector)
- [Meilisearch repository](https://github.com/meilisearch/meilisearch)
- [Meilisearch license](https://github.com/meilisearch/meilisearch/blob/main/LICENSE)
- [OpenTelemetry JavaScript repository](https://github.com/open-telemetry/opentelemetry-js)
- [Hyvor Relay repository](https://github.com/hyvor/relay)
