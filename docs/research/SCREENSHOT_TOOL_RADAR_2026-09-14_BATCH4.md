# Screenshot Tool Radar — 2026-09-14 Batch 4

Status: governed research intake only. Nothing in this batch is installed, imported, executed, or enabled in the production web process by this research change.

## Intake result

The supplied screenshots produced **6 new verified repository records** and **3 deduplicated references** already present in the 2026-09-13 batches. Facebook ad placements visible under the posts are not treated as user-supplied tool leads.

| Screenshot lead | Verified upstream | License posture | SONARA decision | Best fit |
| --- | --- | --- | --- | --- |
| vGPU | `vercel-labs/vgpu` | MIT | Optional client-side WebGPU experiment after fallback/performance review | Creator Studio, graphics/data visualization |
| Open WebUI | `open-webui/open-webui` | Custom Open WebUI License with branding restriction | Architecture/feature benchmark only until branding/license and tenant-security review | SONARA One, Personal Agent OS, Provider Gateway |
| OpenShot | `OpenShot/openshot-qt` | GPL-3.0-or-later | Creator Studio workflow reference; no source mixing without GPL architecture review | Creator Studio video editing |
| Agent-Me | `jzjzzzzzzz/agent-me` | MIT | Inspectable memory/provenance pattern reference; no identity impersonation or second authority plane | Personal Agent OS, SONARA One |
| Quarkdown | `iamgio/quarkdown` | GPL-3.0; CLI/LSP modules are AGPL-3.0 | Document-output benchmark; isolated experiment only before reciprocal-license decision | Business Builder, reports/docs |
| Generative AI Arbitrage | `cporter202/generative-ai-arbitrage` | No declared repository license | Vendor/pricing lead source only; no code/content reuse and no automatic provider onboarding | Provider Gateway, Creator Studio cost research |

## Deduplicated screenshot references

- **Archify** (`tt-a1i/archify`) already exists in Batch 3 as a development-only, source-grounded architecture/diagram candidate. The new screenshot reinforces the same placement; it does not create a second record.
- **three.ws** (`nirholas/three.ws`) already exists in Batch 3 as a Creator Studio 3D/agent-interaction reference with generated-asset/provider/on-chain rights separated from repository licensing.
- **BreachLab** is already a Batch 3 hosted-service reference rather than an executable repository record. Use it only for lawful training on provided or otherwise explicitly authorized targets.

## Decisions and rationale

### vGPU

The upstream describes a TypeScript WebGPU library with typed WGSL imports, a small explicit GPU API, browser and headless-Node runtimes, deterministic mock testing, CLI docs/examples, and agent discovery surfaces. That is useful for Creator Studio and advanced visual/data experiences, but it is not a reason to make GPU support mandatory. SONARA should only pilot it as feature-detected progressive enhancement with a Canvas/SVG fallback and measured mobile/GPU cost.

### Open WebUI

The repository is a mature self-hosted AI interface, but its current license is a custom Open WebUI License. The license includes a material branding condition that restricts altering/removing Open WebUI branding outside stated exceptions, including a small-user exception and permission/enterprise-license paths. That makes casual white-labeling inappropriate. SONARA should learn from its provider/workspace/RAG/tool architecture using synthetic data before considering any separate deployment.

### OpenShot

OpenShot remains useful as a mature video-editor feature benchmark: timeline/layers, keyframes, titles, chroma key, transitions, effects, and FFmpeg-backed workflows. Its GPL-3.0-or-later posture means SONARA should avoid copying editor source into proprietary production paths without an explicit licensing/architecture decision. For hosted rendering, a purpose-built isolated worker remains the better shape than a desktop Qt application in the Vercel request path.

### Agent-Me

Agent-Me is relevant to the existing Personal Agent OS objective because it emphasizes inspectable personal knowledge, memory, handoffs, evidence, critique, and verification. The useful lesson is provenance: user-supplied facts, model summaries, and generated conclusions must stay distinguishable and correctable. SONARA's existing owner-approval and authority system remains authoritative; a personal agent must not silently impersonate the user or widen its own permissions.

### Quarkdown

Quarkdown is a strong document/typesetting product reference for papers, books, presentations, websites, and knowledge bases. The repository is GPL-3.0 by default, while its CLI and language-server modules/binaries are AGPL-3.0. That requires deliberate reciprocal-license analysis before runtime adoption. A safe next step is an isolated synthetic document benchmark against SONARA's existing Markdown/PDF path.

### Generative AI Arbitrage

The repository currently has no declared license in GitHub metadata. Its claims about lower-cost access and model equivalence are therefore useful only as leads. SONARA should independently verify each relevant provider's identity, actual model provenance, current pricing, rate limits, retention/privacy terms, reliability, commercial rights, and output quality. Any approved provider must still be integrated through Provider Gateway with spend, privacy, tenant, fallback, and abuse controls.

## Production boundary

This batch deliberately keeps all six new repository records at `enabledInProduction: false`, `runtimeStatus: not_executed`, and `canExecute: false`. Research records can inform design and implementation work, but they do not authorize cloning, package installation, secret access, production execution, social publishing, payment changes, provider onboarding, or autonomous customer-impacting actions.

## Next experiments

1. Pilot a small feature-detected vGPU visualization with a deterministic mock and non-GPU fallback.
2. Run Open WebUI locally with synthetic data only and compare its feature model against SONARA One/Provider Gateway.
3. Turn OpenShot into a clean-room Creator Studio editing requirements checklist rather than copying editor source.
4. Compare Agent-Me's provenance/evidence model against the existing SONARA memory and authority design.
5. Benchmark one synthetic Quarkdown document in isolation against the current document pipeline.
6. Verify only cost-provider leads that match real Creator Studio workloads; do not onboard providers directly from the directory.
