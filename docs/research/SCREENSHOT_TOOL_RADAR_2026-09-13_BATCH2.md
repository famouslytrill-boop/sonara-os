# Screenshot Tool Radar — Batch 2 — 2026-09-13

## Intake rule

The second screenshot batch was handled under the same rule as the first: social posts and screenshots are discovery inputs, not authority. The exact upstream repository and license must be established before SONARA records a repository as verified, adds a package, or builds an adapter.

Three upstream repositories were identifiable with enough confidence to verify. Three additional visual concepts remain deliberately unresolved rather than being assigned guessed repository owners, URLs, or licenses.

## Verified repositories

| Project | Verified repository | License | SONARA decision | Best fit |
| --- | --- | --- | --- | --- |
| Image Pipes | `mrajaeim/image-pipes` | MIT | Optional media-pipeline adapter after benchmark/security review | Creator Studio, asset processing |
| Feynman | `advaitpaliwal/feynman` | MIT | Research-method reference; build original SONARA source-grounded research skills instead of importing the runtime | Research Lab, founder research, ChatGPT/Codex, Claude |
| KubeOpt | `kubeopt/kubeopt` | MIT | Future infrastructure reference only; not a current production dependency | Founder operations, Admin Command Center, future Kubernetes cost optimization |

All three remain `enabledInProduction: false` and `not_executed` in the application research catalog.

## Product and business integration decisions

### Creator Studio — deterministic image workflows

Image Pipes is useful because its architecture separates the pipeline from image-processing engines and plugins. That maps well to Creator Studio: customers need repeatable resize/convert/compose/optimize workflows without tying the product to one image vendor.

The useful SONARA direction is a bounded media job contract:

1. validate file type, dimensions, decompression ratio, and transform count;
2. store an immutable job recipe;
3. process in an isolated worker, not the synchronous Vercel request path;
4. allow only reviewed/pinned plugins or SONARA-owned transforms;
5. record output hash, dimensions, format, duration, and errors;
6. retain the original only according to customer retention settings.

Do not add arbitrary plugin execution to a customer request. A plugin system is an extensibility boundary and therefore a supply-chain boundary.

### Research Lab — source-grounded research rather than “AI says”

Feynman's strongest idea for SONARA is methodological: research is not complete when a model produces prose. A useful research workflow separates question, evidence, contradiction, verification, and conclusion.

SONARA now treats that as an assistant skill rather than importing Feynman's runtime. The original workflow in `.ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md` and `.claude/skills/source-grounded-research/SKILL.md` requires:

- a precise research question;
- primary-source preference;
- an evidence matrix;
- contradiction/adversarial search;
- citation and claim validation;
- uncertainty and unresolved questions;
- reproducibility or an independent verification step;
- explicit separation of fact, inference, recommendation, and unknown.

That applies to market research, technical architecture, competitor analysis, security research, pricing, legal-source gathering, and scientific/engineering questions. High-stakes conclusions still need the appropriate qualified human review.

The upstream README advertises remote shell installation examples. SONARA does not execute those commands as part of this intake.

### Founder operations — optimize the infrastructure SONARA actually runs

KubeOpt is an interesting Kubernetes resource-observation and recommendation project. Its architecture includes a cluster agent, server/dashboard, historical usage storage, recommendations, and an optional resource-mutating path.

That is not a reason to introduce Kubernetes. SONARA's current production constraints are Vercel, Supabase, Stripe, email/provider configuration, and isolated workers. The near-term business value is the principle—measure actual resource usage before recommending cost changes—not the Kubernetes dependency.

If SONARA later runs Kubernetes workloads, any optimizer must start read-only and advisory. Production request/limit changes require namespace allowlists, dry-run evidence, rollback, audit logs, and explicit change-control authority. Model recommendations are suggestions, not capacity truth.

## Unresolved visual leads

The screenshots also contained concepts that could be described but whose exact upstream repository could not be established confidently from the available pixels:

- an AI coding workflow emphasizing that a human keeps the merge button;
- a compact desktop “pill” activity/status tracker;
- an interactive browser-based 3D anatomy/visual-learning experience.

These are represented as `unverified_visual_lead` records, not fake repository records. The Research Lab and founder control plane show the unresolved count and next verification step. No owner name, license, or URL is invented.

## Cross-batch business map

The two screenshot batches now form a useful technology radar rather than a pile of repositories:

- **Creator Studio:** HyperFrames for isolated video-rendering research; Image Pipes for deterministic image-processing architecture.
- **Research Lab:** Feynman-inspired source-grounded research; Litho/deepwiki-rs for codebase documentation; LangChain as an agent-pattern reference.
- **Founder/Admin operations:** VibeRaven as a comparison cockpit; Iris as a visual-QA camera; KubeOpt as a future infrastructure-optimization reference.
- **Business Builder/internal browser work:** Browser Use Pi as a possible isolated, authorization-bounded browser worker.
- **Design system/public website:** QuickLiquid as selective visual-effect research, not a site-wide dependency.
- **Security lab:** L0p4Map as authorized-lab reference only.
- **Build resilience:** OFFPack as an offline-cache concept while pnpm remains the repository authority.

The shared rule is unchanged: research value does not equal production enablement.

## Next implementation experiments

The highest-value implementation experiments are intentionally narrow:

1. build the source-grounded research skills and use them on a real SONARA market/architecture question;
2. benchmark a single Creator Studio image transformation recipe before adding an image-processing dependency;
3. keep KubeOpt dormant until Kubernetes is a real operational surface;
4. resolve the three unverified visual leads only from a direct link or readable upstream identity;
5. do not let this research distract from the current controlled-production Stripe gate, which remains a separate launch blocker.
