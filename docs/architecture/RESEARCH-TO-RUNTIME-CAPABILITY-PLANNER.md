# Research-to-runtime capability planner

Status: governed planning layer; non-executing by design.

## Why this exists

SONARA has a large repository/research collection spanning business operations, creator media, growth/marketing, developer tooling, model runtimes, security references, local applications, and hosted providers. A repository appearing in research is not the same thing as a production integration.

`lib/sonara-runtime-capability-planner.cjs` turns the converged Batch 1–10 + requested/formal registry into an explicit adoption plan without downloading or executing research code.

The hard rule is:

> **Research presence never grants execution authority.**

## Runtime lanes

Every candidate is assigned to the narrowest plausible placement boundary:

- `web_process` — code that could live in the normal SONARA server process after review.
- `isolated_worker` — service/worker boundary for Python, media, transcription, orchestration, and heavier processing.
- `isolated_gpu_worker` — GPU/model/image/video/music generation workloads that must not be embedded into the web process.
- `owner_device` — local/desktop/external companion tools.
- `browser_runtime` — browser-only interactive/visual runtimes.
- `developer_only` — development, testing, CLI, security-reference, or unpromoted research workflows.
- `external_api` — configured third-party provider APIs with explicit account/credential authority.

A runtime lane is architecture metadata, not permission to execute.

## Adoption tiers

The planner distinguishes:

- `active_core` — SONARA-owned runtime already active, currently deterministic rules.
- `available_with_setup` — an adapter exists but needs explicit provider/configuration setup and keeps its existing authority limits.
- `isolated_worker_candidate` — sufficiently reviewable to prototype only behind an isolated worker contract.
- `developer_tool` — useful for engineering/testing but not a customer runtime dependency.
- `external_companion` — stays on the owner device or external app boundary.
- `research_only` — useful evidence/patterns but no justified production path yet.
- `blocked` — unverified identity, unresolved rights, blocked commercial-use state, provider-limit bypass, or other explicit restriction.

## Product mapping

Records are mapped to one or more product targets:

- **SONARA One** — shared platform, infrastructure, security, agents, APIs, databases, model/control-plane concerns, and cross-product systems.
- **Business Builder™** — customers, quotes, invoices, bookings, inventory, vendors, operations, commerce, and related business workflows.
- **Creator Studio™** — media, music, audio, video, image, artists, content, transcription, interactive media, and 3D.
- **Growth Studio™** — campaigns, marketing, SEO/AEO/GEO, leads, sales, email, analytics, ABM, and growth workflows.

Mapping means “this research can inform this product,” not “the dependency is installed.”

## Hosted model adapters

The planner recognizes the OpenAI / ChatGPT and Anthropic Claude adapters added to SONARA as `external_api` capabilities. They remain `available_with_setup` and inherit the existing hosted-provider contract:

- server-side credential only;
- fixed official provider host;
- explicit provider selection;
- no silent paid-provider fallback;
- current shipped authority is `draft_content` only;
- the planner itself never calls the provider.

Configured state is reported without rendering credential values.

## Promotion evidence

Before a research item may become a production integration, the implementation PR must provide all of the following:

1. Verified repository identity and source provenance.
2. Explicit license and commercial-use decision for the exact code/version used.
3. Security and dependency review.
4. Tenant/customer-data boundary and least-privilege design.
5. Provider/account authority boundary where a third-party service is involved.
6. Bounded runtime placement, resource budget, observability, rollback, and a kill switch where appropriate.
7. Tests for the exact SONARA integration path — not only upstream tests.
8. Human approval and green release gates before production.

Model repositories require additional review for model cards, weights, training/input/output rights, datasets, privacy, intended use, and downstream components. A permissive source-code license alone does not settle those rights.

## Sensitive research

The planner deliberately keeps several categories restricted or research-only unless a narrow approved use case exists:

- subscription pooling, credential rotation intended to bypass provider limits, or quota evasion;
- covert device/activity tracking;
- reverse engineering and offensive-security collections outside authorized defensive work;
- unlicensed/`NOASSERTION` repositories;
- copied product trade dress or proprietary media/catalog behavior;
- tools requiring customer credentials or broad account authority without a least-privilege SONARA adapter.

These records can still contribute defensive design lessons, threat models, API-testing patterns, or UI/architecture references without importing their runtime behavior.

## Current integration point

`lib/sonara-model-engine-control-plane.cjs` now consumes the planner and exposes a bounded summary through the existing model/engine control-plane API. That means the current application can report:

- research repository count;
- adoption-tier counts;
- supported runtime lanes;
- per-product capability counts;
- promotion requirements and safety boundaries;
- OpenAI / ChatGPT and Anthropic Claude as optional hosted text engines alongside deterministic local rules and Creator worker/model candidates.

The summary deliberately avoids granting installation or execution authority. Full production enablement still occurs only in the product-specific implementation that owns the relevant tenant, provider, worker, billing, audit, and approval controls.
