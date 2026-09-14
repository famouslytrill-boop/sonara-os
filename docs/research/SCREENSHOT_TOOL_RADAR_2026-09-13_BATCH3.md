# Screenshot Tool Radar — Batch 3 — 2026-09-13

## Intake rule

Screenshots and social posts are discovery inputs, not technical authority. This batch resolves the visible upstream where possible, verifies the actual repository/license posture, separates hosted services from open-source repositories, and keeps every third-party runtime disabled until a separate implementation review exists.

Nothing in this batch is installed, imported, executed, or enabled in production by the research catalog.

## Verified repositories

| Project | Verified repository | License posture | SONARA decision | Best fit |
| --- | --- | --- | --- | --- |
| OCRmyPDF | `ocrmypdf/OCRmyPDF` | MPL-2.0 | Optional isolated document-worker experiment after file-safety and license review | Business Builder, document intake |
| Archify | `tt-a1i/archify` | MIT | Development-only architecture/diagram skill candidate | Internal development, Admin Command Center |
| three.ws | `nirholas/three.ws` | Apache-2.0 | 3D/agent interaction reference first; generation/on-chain features separately gated | Creator Studio, 3D research |
| OpenPost | `getopenpost/openpost` | AGPL-3.0 | Workflow/feature benchmark only unless AGPL architecture is deliberately approved | Growth Studio, Creator Studio |
| Uiverse Galaxy | `uiverse-io/galaxy` | MIT | Selective design-system reference; no bulk import | Website and product design system |
| OpenResearch | `alphaXiv/OpenResearch` | MIT | Local research-harness candidate; not hosted production runtime | Research Lab, founder research |
| NVIDIA NeMo Switchyard | `NVIDIA-NeMo/Switchyard` | Apache-2.0 | Pre-1.0 routing research behind Provider Gateway only | Provider Gateway, cost/quality research |

All seven remain `enabledInProduction: false`, `humanReviewRequired: true`, and `not_executed` in readiness output.

## Hosted/service and learning references

The following screenshots are useful research inputs but are intentionally outside the executable repository catalog:

- **BreachLab** — verified hosted offensive-security training service. Use only on BreachLab targets or other explicitly authorized systems; it is not authorization to scan or exploit third-party systems.
- **Google Trends** — verified hosted search-interest research product. It is a demand signal, not ground truth; its data is sampled, categorized, aggregated, and normalized.
- **HackProduct AI engineering reference** — verified hosted learning/practice service. The infographic is curriculum material, not a benchmark or architecture specification.

The Codex screenshot in this intake is current project-state evidence, not a third-party tool lead. It reinforces the existing release rule: changes must remain deterministic, migration-safe, secret-safe, approval-gated where money/customer impact exists, and verifiable by the release suite.

## Decisions by project

### OCRmyPDF — strong document utility, worker-only

OCRmyPDF adds searchable OCR layers to scanned PDFs, supports PDF/A, deskew/rotation, multilingual OCR through Tesseract, validation, image optimization, and multi-core processing. It also depends on external binaries including Tesseract and Ghostscript.

That makes the product fit real, but the runtime placement matters. SONARA should not run OCR inside the synchronous Vercel request process. Any experiment belongs in a bounded document worker with private storage, file-size/page-count/decompression limits, malware checks, CPU/memory/time limits, and temporary-file cleanup. MPL-2.0 covered-file obligations also require deliberate license handling.

### Archify — useful development skill, not required production runtime

Archify generates architecture, workflow, sequence, data-flow, and lifecycle diagrams from typed intermediate data and validates them before producing self-contained artifacts. The high-value SONARA use is internal: source-pinned system maps, release/change diagrams, and architecture review.

The first experiment should map the actual Express → Vercel → Supabase/Stripe/worker path and compare that output with `.ai/shared/SYSTEM_MAP.json`. Generated diagrams must not invent topology, expose secrets, or publish private infrastructure without owner approval.

### three.ws — Creator Studio 3D reference with separate asset/provider rights

three.ws is an Apache-2.0 browser-native 3D AI platform with text/image/sketch-to-3D, GLB workflows, SDK/MCP surfaces, and agent/avatar features. Repository licensing does not automatically settle rights for generated assets, hosted model services, datasets, uploaded reference media, wallets, or on-chain registration.

Start with a provider-neutral GLB preview/import prototype using owner-created assets. Only then measure whether generative 3D adds enough value to justify a dedicated adapter.

### OpenPost — excellent feature benchmark, AGPL-gated code adoption

OpenPost combines multi-platform publishing, image/carousel design, browser video editing, recording, calendar/queues, analytics, media library, inbox, optional AI writing, and API/CLI/MCP automation. That makes it an excellent Growth Studio/Creator Studio competitor and feature-gap reference.

Its repository is AGPL-3.0. SONARA should therefore not copy covered source into the hosted product casually. Use it to build a requirements matrix first. Any later code reuse, modification, hosted deployment, or separately hosted service architecture requires explicit license/legal review. Social-provider credentials, app approval, platform terms, user consent, content rights, rate limits, and publishing authority remain separate gates.

### Uiverse Galaxy — selective component inspiration only

Galaxy contains thousands of community CSS/Tailwind UI elements under MIT. It is valuable as a pattern library, not as a package dump. SONARA should select only components that solve an existing UX gap, rebuild them against SONARA design tokens, retain provenance, and verify keyboard behavior, focus states, contrast, responsive behavior, performance, and reduced-motion support.

### OpenResearch — local experiment orchestration, evidence rules remain authoritative

OpenResearch provides local parallel research-agent sessions, isolated git worktrees, experiment lineage, artifact/log tracking, and local or remote compute options. The architecture is useful for high-throughput founder research and reproducible engineering experiments.

It should be evaluated locally on a disposable repository with no production secrets. Do not expose a loopback-oriented/local service publicly without authentication/network review, do not use remote compute for private source until provider terms are approved, and do not treat agreement among multiple agents as evidence. SONARA's source-grounded research standard remains authoritative.

### NVIDIA NeMo Switchyard — promising routing research, not production yet

Switchyard routes LLM calls across models and can be embedded in a gateway/harness or run as a standalone proxy. The upstream README explicitly labels major components pre-1.0 and its standalone server as demo/evaluation only.

SONARA should evaluate it only behind Provider Gateway. The relevant experiment is an offline replay against representative non-sensitive prompts measuring quality, latency, token cost, routing error modes, and provider/privacy constraints. Do not replace Provider Gateway, do not use an unpinned main-branch API as a production contract, and do not let routing bypass tenant/spend/provider policy.

## Cross-product map

- **Business Builder:** OCRmyPDF is a plausible private document-ingestion worker after bounded-file testing.
- **Creator Studio:** three.ws is 3D research; OpenPost is a product/workflow benchmark; Uiverse Galaxy is selective interaction/design reference.
- **Growth Studio:** OpenPost is the strongest feature-comparison source; Google Trends is a supporting market-demand signal, not an automated decision engine.
- **Research Lab:** OpenResearch is a local experiment-harness candidate; HackProduct is curriculum reference only.
- **Provider Gateway:** Switchyard is routing/cost-quality research, not a replacement.
- **Security training:** BreachLab is a lawful training reference restricted to provided/authorized targets.
- **Internal development/Admin:** Archify is a candidate source-grounded architecture visualization skill.

## Next experiments

1. Benchmark OCRmyPDF on representative scanned documents in an isolated disposable worker.
2. Generate one source-pinned Archify system map and compare it against the current SONARA system map.
3. Prototype GLB preview/import without on-chain or external-model coupling.
4. Turn OpenPost into a feature-gap matrix rather than importing AGPL source.
5. Rebuild at most three Uiverse interaction ideas against SONARA tokens and accessibility requirements.
6. Evaluate OpenResearch locally on a non-secret disposable research project.
7. Run an offline Switchyard routing replay behind the Provider Gateway boundary.

These are research and experiment steps only. They do not bypass Stripe/payment gates, owner approvals, security boundaries, provider terms, legal review, or production release verification.
