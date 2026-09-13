# Screenshot Tool Radar — Batch 2 — 2026-09-13

## Intake rule

Screenshots and social posts are discovery inputs, not technical authority. SONARA records a repository as verified only after resolving the exact upstream, checking the actual license posture, and separating research value from production enablement.

This batch now contains eight verified repositories. Two screenshot concepts remain genuinely unresolved, and SceneAI is retained as a verified hosted-service reference because no authoritative public source repository or open-source code license was established. HyperFrames and Browser Use Pi appeared again in the latest screenshots and were deliberately deduplicated because they already exist in the first radar.

Nothing in this batch is installed, imported, executed, or enabled in production by the research catalog.

## Verified repositories

| Project | Verified repository | License posture | SONARA decision | Best fit |
| --- | --- | --- | --- | --- |
| Image Pipes | `mrajaeim/image-pipes` | MIT | Optional bounded media-pipeline adapter after benchmark/security review | Creator Studio, asset processing |
| Feynman | `advaitpaliwal/feynman` | MIT | Research-method reference; use SONARA-owned source-grounded research skills | Research Lab, founder research |
| KubeOpt | `kubeopt/kubeopt` | MIT | Future infrastructure reference only | Founder operations, future Kubernetes cost work |
| EdgePilot | `pricootz/edgepilot` | MIT | Desktop interaction/ambient-signal reference first | Founder desktop, Admin Command Center |
| Microsoft Phi Cookbook | `microsoft/PhiCookBook` | MIT for cookbook code; model/service licenses separate | Local/edge SLM recipe reference behind Provider Gateway | Provider Gateway, local-agent research |
| DaVinci Resolve MCP | `samuelgursky/davinci-resolve-mcp` | MIT | Research only until current security posture and pinned release are reviewed | Creator Studio, owner post-production |
| SceneFlow | `taruma/SceneFlow` | MIT | Creator Studio script-to-render evaluation reference | Creator Studio, prompt-adherence review |
| Lead Generation API Stack | `cporter202/lead-gen-api-stack` | **No license declared** | Reference-only directory; no code/content adoption | Business Builder, Growth Studio market research |

All eight remain `enabledInProduction: false`, `humanReviewRequired: true`, and `not_executed` in readiness output.

## Latest intake decisions

### EdgePilot — useful interaction pattern, not a web dependency

EdgePilot is a local-first Windows/Linux system monitor built around a compact screen-edge pill. The useful SONARA idea is ambient, low-friction status: important machine or operational signals can surface briefly without forcing the owner into another dashboard.

SONARA should copy the product principle, not the runtime by default. Hostnames, disk labels, paths, and machine telemetry remain local unless a deliberate telemetry policy exists. Any future desktop companion needs signed builds, least-privilege OS access, explicit diagnostics consent, and an update strategy.

### Phi Cookbook — local/edge model research behind the existing provider boundary

Microsoft's Phi Cookbook contains examples for running Phi-family small and multimodal models locally, at the edge, and through hosted services. The cookbook repository is MIT, but model weights, datasets, services, and example dependencies can have separate terms.

The architecture decision is therefore narrow: use the cookbook as a recipe/reference source. Provider Gateway remains SONARA's provider authority. A local Phi adapter is justified only by measured privacy, latency, cost, offline, or device-capability benefits and must be benchmarked against the current provider path.

### DaVinci Resolve MCP — strong Creator Studio fit, security-gated

The verified upstream exposes DaVinci Resolve Studio through its official scripting API and supports editing, media-pool organization, rendering, grading, Fusion/Fairlight workflows, review markers, and media analysis.

It is **not** production-enabled. The latest social post's claim about a particular frontier model driving Resolve is not accepted as evidence of an upstream-supported provider path. More importantly, the upstream security page disclosed September 2026 advisories involving safe-mode enforcement and an optional network transport. SONARA therefore keeps this at `research_only` until a pinned patched release is reviewed.

A future experiment must use a disposable Resolve project, local stdio transport, backups, dry-run/plan-review-confirm behavior, user-owned media, and a non-destructive first action. Networked control, project deletion, plugin/script execution that bypasses safety gates, and autonomous publishing remain blocked.

### SceneFlow — evidence-oriented video iteration

SceneFlow synchronizes script segments with video timestamps and helps reviewers compare generated footage against screenplay/prompt intent. That is a useful Creator Studio pattern because it makes prompt adherence inspectable instead of reducing review to a vague pass/fail score.

SONARA should start with its own small cue/project schema and a comparison view rather than importing the full app. Remote project URLs and media require validation, and cue highlighting must not be presented as an objective quality verdict.

### Lead Generation API Stack — discovery only, no license and high compliance risk

The repository is a one-file curated directory of third-party lead/prospecting APIs and contains affiliate links. GitHub currently exposes no declared repository license. That means SONARA can use it as a discovery lead, but should not treat the repository text or code snippets as adoptable open-source material.

Every candidate provider must be independently reviewed for terms, data provenance, privacy, consent, suppression/opt-out behavior, pricing, rate limits, and platform rules. Growth Studio must not turn a marketing list into indiscriminate scraping or unsolicited bulk outreach.

### SceneAI — hosted design-market reference, not an open-source dependency

`sceneai.art` is a commercial prompt/design library for landing-page sections, backgrounds, and related web visuals. The service itself is verifiable, but this intake did not establish an authoritative public source repository or open-source code license.

It remains outside the executable repository catalog. SONARA may study market positioning, prompt-library organization, and design categories, but any premium prompt or asset use requires the service's license terms, and SONARA should build its own visual identity rather than copy layouts wholesale.

## Previously verified in this branch

Image Pipes remains an optional isolated image-processing experiment. Feynman remains a methodology reference that informed SONARA's source-grounded research skills instead of becoming a runtime dependency. KubeOpt remains dormant unless SONARA actually operates Kubernetes workloads; production today should be optimized around the infrastructure SONARA really uses.

## Deduplicated screenshots

HyperFrames and Browser Use Pi were shown again. They are already governed in `lib/sonara-screenshot-tool-radar.cjs` and are not duplicated here. HyperFrames remains a candidate isolated Creator Studio rendering worker; Browser Use Pi remains an authorization-bounded isolated browser-worker experiment.

## Remaining unresolved/non-repository leads

- **Coding-agent / keep-the-merge-button concept:** exact upstream repository still unresolved; SONARA already preserves human merge/deploy authority.
- **Interactive 3D anatomy concept:** exact upstream and content licensing remain unresolved.
- **SceneAI:** website verified, but retained as a hosted-service reference because no authoritative public source repository/license was established.

The former “desktop pill” unresolved lead is now resolved as `pricootz/edgepilot` and has been promoted into the verified catalog.

## Cross-batch business map

- **Creator Studio:** HyperFrames for isolated rendering research; Image Pipes for image-processing architecture; SceneFlow for prompt-adherence review; DaVinci Resolve MCP for owner-workstation editing research.
- **Research Lab:** Feynman-inspired source-grounded research; Litho/deepwiki-rs for codebase documentation; LangChain as a pattern reference.
- **Founder/Admin operations:** EdgePilot interaction patterns, VibeRaven comparison cockpit, Iris visual-QA camera, and KubeOpt only if Kubernetes becomes real infrastructure.
- **Business Builder / Growth Studio:** Lead Gen API Stack is provider-discovery input only, with independent compliance/terms review before any adapter.
- **Provider Gateway/local agents:** Phi Cookbook is recipe/reference material for optional local inference experiments; it does not bypass Provider Gateway.
- **Business Builder/internal browser work:** Browser Use Pi remains an isolated, authorization-bounded candidate.
- **Design system/public website:** QuickLiquid and SceneAI are design research inputs, not visual identities to copy.
- **Security lab:** L0p4Map remains authorized-lab reference only.
- **Build resilience:** OFFPack remains an offline-cache concept while pnpm stays authoritative.

## Next implementation experiments

The next experiments should remain narrow: benchmark one bounded Creator Studio image recipe; prototype one SONARA-owned script-to-render comparison view; evaluate a local Phi use case against Provider Gateway; inspect the current patched DaVinci MCP release in a disposable local project before any adapter work; and turn the lead-generation directory into a compliance-first provider matrix rather than an outreach bot.

None of this research should bypass the separate controlled-production Stripe gate or be represented as production enablement.
