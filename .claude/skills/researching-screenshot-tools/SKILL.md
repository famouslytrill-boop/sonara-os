---
name: researching-screenshot-tools
description: Research and classify external tools that arrive as screenshots, social posts, GitHub links, package names, or agent-skill recommendations. Use when the owner asks Claude to add, integrate, learn from, install, or evaluate a repository or developer tool for SONARA. Verifies the real upstream and license posture, maps product fit, checks security/advisory state, records safety boundaries, and updates the governed research catalog without executing third-party code.
---

# Researching screenshot tools

A screenshot is a lead, not a dependency decision. The job is to turn the lead into a source-grounded SONARA record and a small next experiment.

Read these first:

- `AGENTS.md`
- `CLAUDE.md`
- `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md`
- `.ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md` when the decision depends on external factual evidence
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-13.md`
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-13_BATCH2.md`
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-13_BATCH3.md`
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-14_BATCH4.md`
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-22_BATCH17.md` for decision/design/finance/memory intake
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-22_BATCH18.md` for the latest agent/RAG/infrastructure/system-design intake
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-27_BATCH19.md` for agent skills, business applications, media, code education and public-data references
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-28_BATCH20.md` for media/local-model work, design skills, ecommerce, automation, API/streaming, Docker/deployment diagrams and workflow integration
- `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-30_BATCH21.md` for billing, browser editing, OSSU learning references, game-directory/source claims, unlicensed security guidance, mobile mockups, finance, email, memory and runbook patterns
- `lib/sonara-screenshot-tool-radar.cjs`
- `lib/sonara-screenshot-tool-radar-batch2.cjs`
- `lib/sonara-screenshot-tool-radar-batch3.cjs`
- `lib/sonara-screenshot-tool-radar-batch4.cjs`
- `lib/sonara-screenshot-tool-radar-batch17.cjs`
- `lib/sonara-screenshot-tool-radar-batch18.cjs`
- `lib/sonara-screenshot-tool-radar-batch19.cjs`
- `lib/sonara-screenshot-tool-radar-batch20.cjs`
- `lib/sonara-screenshot-tool-radar-batch21.cjs`
- `.claude/skills/reviewing-an-outside-repository/SKILL.md`
- `.claude/skills/source-grounded-research/SKILL.md` for evidence-sensitive research
- `DESIGN.md` and `.claude/skills/reviewing-premium-sonara-ui/SKILL.md` when a screenshot contributes design requirements

## Workflow

### 1. Resolve identity before capability

Find the authoritative `owner/repository`. A social post may misspell an owner, display a fork, show an old project name, or show a screenshot from a different repository. If the exact upstream cannot be verified, record it as unverified and stop. Never guess a permanent URL. A verified hosted website without a verified public repository remains a service/reference lead, not a repository record.

### 2. Verify facts at the upstream

Check repository metadata and then the actual files that answer the question: README, LICENSE, package manifest, security policy/advisories, configuration, release information, and the smallest source files necessary to understand the runtime. Prefer upstream evidence over commentary.

Do not copy volatile star counts into durable product decisions. Activity can inform maintenance risk, but a star count is not a safety or quality signal. A public repository with no declared license is source-visible, not automatically open source.

### 3. Separate four decisions

Always state these separately:

1. **Research value** — is there an idea worth learning from?
2. **Code/license permission** — may SONARA legally use the code/content in the proposed way?
3. **Architecture fit** — where would it run if adopted?
4. **Production enablement** — is it actually configured and executing now?

Most screenshot-sourced tools should stop after decision 1 or 2. `researched` does not mean `installed`, and `installed` does not mean `production enabled`.

Concept diagrams, social infographics and vendor architecture posts are **pattern leads**, not implementation specifications. Extract the invariant or failure mode, map it to SONARA-owned authority, and refuse to turn a simplified diagram into a deployment claim. Volatile model names, prices, context windows and API controls must be re-checked against current first-party provider documentation before being recorded as product facts.

### 4. Choose a runtime placement

Prefer the smallest boundary that fits:

- `curated_reference`
- `research_only`
- `reference_only_no_license`
- `developer_only`
- `developer_tool_candidate`
- `isolated_documentation_worker`
- `isolated_document_worker`
- `isolated_browser_worker`
- `isolated_media_worker`
- `isolated_media_pipeline`
- `authorized_security_reference`
- `infrastructure_observability_reference`
- `provider_gateway_routing_reference`
- `optional_adapter_after_review`
- `blocked`

Desktop apps, CLIs, Chromium automation, FFmpeg renderers, OCR/document binaries, nmap/security utilities, Kubernetes optimizers, media-editor control bridges, model-routing proxies, GPU runtimes, AI workspace shells, and package managers do not belong inside the Vercel request process by default.

### 5. Preserve SONARA authority

External agent frameworks and coding cockpits never bypass `lib/sonara-agent-authority.cjs` or `lib/sonara-agent-runner.cjs`. Unknown consequential actions still fail closed to owner review. Provider Gateway remains the model/provider boundary unless an explicit architecture change is approved.

Infrastructure recommendation tools are advisory by default. A recommendation to alter compute requests, limits, autoscaling, deployment state, provider configuration, or model routing does not authorize mutation. Media-control bridges start read-only or non-destructive and require explicit review for destructive edits, publishing, scripts/plugins, or network transports. Social tooling never gains implicit authority to publish, message, or launch campaigns.

### 6. Write the research record

For screenshot-led research, add verified records to the current screenshot radar module and keep ambiguous/non-repository items as explicit leads or service references rather than invented repositories. Required information for a verified repository:

- exact upstream repository
- verified license posture, including `NONE DECLARED` where applicable
- runtime class
- integration status and mode
- narrow role
- product fit
- capabilities
- security/advisory state where relevant
- safety boundaries
- blocked uses
- one concrete next experiment

Keep `enabledInProduction: false` and `humanReviewRequired: true` during intake.

The existing route `routes/sonara-requested-repositories-routes.cjs` exposes this catalog through the public Research Lab and founder/admin readiness surfaces. Do not create a fake "installed" state to make the page look complete.

### 7. Test the boundary

Tests should prove at least:

- the tool is not executable from the research catalog;
- production execution count remains zero;
- security tools are limited to authorized targets;
- package-manager research cannot replace pnpm silently;
- infrastructure optimizers cannot mutate production from research state;
- media-editor control stays security-gated and non-destructive by default;
- model cookbook licensing is not mistaken for model-weight licensing;
- copyleft source is not casually mixed into SONARA's hosted runtime;
- document/OCR workers cannot consume unbounded uploads in the request process;
- social publishing cannot silently become customer-impacting automation;
- unlicensed source is not treated as adoptable open source;
- lead/prospecting research cannot silently become scraping or unsolicited outreach;
- ambiguous screenshots remain source-unverified rather than receiving guessed metadata;
- hosted/service references remain outside the executable repository catalog;
- browser GPU features retain a non-GPU fallback and do not assume server GPU availability;
- personal-agent memory does not silently grant identity/authority;
- custom branding or reciprocal-license terms are not flattened into a generic open-source label;
- any product-specific boundary that matters is explicit.

A green test that cannot fail on the bad case is not evidence.

## Current 2026-09-13 and 2026-09-14 decisions

### Batch 1

- **Browser Use Pi** (`browser-use/browser-use-pi`, MIT): optional isolated browser-worker prototype; user-authorized destinations only.
- **QuickLiquid** (`amarnath3003/quickLiquid`, MIT): design reference first; progressive enhancement only.
- **L0p4Map** (`HaxL0p4/L0p4Map`, GPL-3.0): authorized security-lab reference only; never scan third parties.
- **HyperFrames** (`heygen-com/hyperframes`, Apache-2.0): strong Creator Studio render-worker candidate; isolate FFmpeg/headless browser processing.
- **Iris** (`brijr/iris`, MIT): developer visual-QA camera; screenshots are not functional proof.
- **VibeRaven** (`ohad6k/VibeRaven`, MIT): developer readiness comparison; SONARA's release gates stay authoritative.
- **LangChain** (`langchain-ai/langchain`, MIT): pattern/reference first; no framework dependency without a measured gap.
- **Litho/deepwiki-rs** (`sopaco/deepwiki-rs`, MIT): documentation research; compare with the existing generated handoff/docs pipeline and its Terrain successor.
- **OFFPack** (`Assemou007/OFFPack`, MIT): research the offline-cache idea only; SONARA remains pnpm-only.

### Batch 2

- **Image Pipes** (`mrajaeim/image-pipes`, MIT): optional Creator Studio media-pipeline adapter after benchmark/security review; no arbitrary plugin execution.
- **Feynman** (`advaitpaliwal/feynman`, MIT): research-method reference; use SONARA's source-grounded research skills rather than importing its runtime or remote install path.
- **KubeOpt** (`kubeopt/kubeopt`, MIT): future Kubernetes operations reference only; advisory until SONARA has real Kubernetes workloads and a separately approved mutation policy.
- **EdgePilot** (`pricootz/edgepilot`, MIT): local desktop interaction/ambient-status reference; no silent telemetry or hosted-web dependency.
- **Microsoft Phi Cookbook** (`microsoft/PhiCookBook`, MIT cookbook code): local/edge model recipes; model weights/services are separately licensed and Provider Gateway remains authoritative.
- **DaVinci Resolve MCP** (`samuelgursky/davinci-resolve-mcp`, MIT): Creator Studio workstation research only until a pinned current release and its September 2026 security posture are reviewed; prefer local stdio and non-destructive tests.
- **SceneFlow** (`taruma/SceneFlow`, MIT): Creator Studio script-to-render/prompt-adherence evaluation reference; cue highlighting is evidence, not an automatic quality verdict.
- **Lead Generation API Stack** (`cporter202/lead-gen-api-stack`, no license declared): provider-discovery reference only; no code/content adoption and no scraping/outreach automation without independent compliance review.
- **SceneAI** (`sceneai.art`): verified hosted design/prompt service reference, not an open-source repository record.
- **HyperFrames** and **Browser Use Pi** appeared again and are deduplicated rather than re-recorded.
- The coding-agent merge-button concept and interactive 3D anatomy concept remain unresolved visual leads.

### Batch 3

- **OCRmyPDF** (`ocrmypdf/OCRmyPDF`, MPL-2.0): isolated document-worker candidate; external binaries, untrusted-file limits, and MPL covered-file obligations must be reviewed.
- **Archify** (`tt-a1i/archify`, MIT): development-only source-grounded architecture/diagram skill candidate; generated topology must stay evidence-backed.
- **three.ws** (`nirholas/three.ws`, Apache-2.0): Creator Studio 3D reference; generated-asset/provider/dataset/on-chain rights are separate from repository licensing.
- **OpenPost** (`getopenpost/openpost`, AGPL-3.0): strong Growth/Creator workflow benchmark; no casual source mixing into SONARA's hosted runtime.
- **Uiverse Galaxy** (`uiverse-io/galaxy`, MIT): selective design-system reference; adopt only normalized, accessible components that solve a measured UX gap.
- **OpenResearch** (`alphaXiv/OpenResearch`, MIT): local research-harness candidate; keep local trust boundaries and SONARA's evidence rules.
- **NVIDIA NeMo Switchyard** (`NVIDIA-NeMo/Switchyard`, Apache-2.0): pre-1.0 model-routing research behind Provider Gateway; standalone demo server is evaluation-only.
- **BreachLab**, **Google Trends**, and **HackProduct**: verified hosted/service/learning references, not executable repository records.

### Batch 4

- **vGPU** (`vercel-labs/vgpu`, MIT): optional client-side WebGPU experiment; keep fallback, device/resource limits, accessibility, mobile performance, and no assumption of server GPU availability.
- **Open WebUI** (`open-webui/open-webui`, custom Open WebUI License): AI-workspace benchmark only until its branding restriction and tenant/security implications are deliberately reviewed; not a casual SONARA white-label dependency.
- **OpenShot** (`OpenShot/openshot-qt`, GPL-3.0-or-later): Creator Studio video workflow reference; no GPL source mixing without a deliberate architecture/license decision.
- **Agent-Me** (`jzjzzzzzzz/agent-me`, MIT): personal-agent provenance/evidence reference; do not silently impersonate users, widen authority, or mix model inference with verified facts.
- **Quarkdown** (`iamgio/quarkdown`, GPL-3.0; CLI/LSP AGPL-3.0): document/typesetting benchmark; runtime adoption is reciprocal-license gated.
- **Generative AI Arbitrage** (`cporter202/generative-ai-arbitrage`, no declared license): provider/pricing lead directory only; independently verify provider identity, terms, model provenance, cost, retention, rights, reliability, and quality.
- **Archify** and **three.ws** are repeated screenshot leads and remain deduplicated in Batch 3. **BreachLab** remains a hosted-service reference rather than an executable repository record.

## Current 2026-09-27 Batch 19 decisions

The current source record is `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-27_BATCH19.md` and the catalog is `lib/sonara-screenshot-tool-radar-batch19.cjs`. Seventeen repositories were source-checked; none was installed or enabled. Each record includes source URLs and the checked-on date.

- **Reactive Resume** (`reactive-resume/reactive-resume`, MIT): screenshot owner path moved; use as a privacy/document workflow reference, not as permission to reuse templates or résumé data.
- **Antigravity Manager** (`lbjlaq/Antigravity-Manager`, CC-BY-NC-SA-4.0): external desktop-tool reference only; its non-commercial/share-alike terms and account/proxy access rule out default commercial reuse or credential integration.
- **OpenWork** (`different-ai/openwork`, mixed MIT and FSL-1.1-MIT/OpenWork EE License): local-agent workspace reference; `ee/` has separate source-available/commercial terms.
- **Cap** (`CapSoftware/Cap`, AGPL-3.0 with named MIT crate families): local media workflow reference; no AGPL application code is copied into the hosted product.
- **OpenMAIC** (`THU-MAIC/OpenMAIC`, MIT root, with `packages/mathml2omml` LGPL-3.0-or-later): learning workflow reference; model, content and learner-data terms stay separate.
- **Microduck** (`pollen-robotics/microduck`, Apache-2.0 source): robotics/learning reference only; no physical-robot control or policy execution is connected to SONARA.
- **Awesome Qwen Image** (`wildminder/awesome-qwen-image`, no repository license declared): model catalog reference only; Qwen weights have a separate research license and linked community assets need item-specific review.
- **Algorithm Visualizer** (`algorithm-visualizer/algorithm-visualizer`, MIT): educational animation reference; never run user code in the web request process.
- **Roboflow Trackers** (`roboflow/trackers`, Apache-2.0): offline video-analytics reference; no live video or individual surveillance path.
- **Skillware** (`ARPAHLS/skillware`, MIT repository): contract/effect/directive/assurance/interface checklist; no third-party skill is trusted or executed from registry presence.
- **Window Sweaters** (`saragordic/window-sweaters`, GPL-3.0): macOS design inspiration only; no code reuse in SONARA.
- **Ponytail** (`DietrichGebert/ponytail`, MIT): concise coding-agent instruction reference; do not enable unreviewed hooks or weaken tests/release policy.
- **RockyVoice** (`Lagunaswift/RockyVoice`, MIT code): persona/off-switch design reference only; code licensing does not cover the fan character, voice clone or bundled audio.
- **God's Eye View** (`bilawalsidhu/gods-eye-view`, MIT code, separate public-data/media terms): source-provenance and visualization reference; no individual surveillance or decisioning from unverified feeds.
- **Scientific Agent Skills** (`K-Dense-AI/scientific-agent-skills`, MIT root, variable per-skill license): inspect a specific artifact before any later use; root license is not blanket permission.
- **MiniMind** (`jingyaogong/minimind`, Apache-2.0 source): educational model-training reference only; weights and datasets are separate.
- **Career Ops** (`career-ops-hq/career-ops`, MIT source): personal user-controlled job-search reference only; no automated hiring, candidate ranking or unsolicited outreach.
- Archify, Excalidraw, Quickemu, OpenMontage, Qdrant, OpenCV, Three.js and Storybook are already represented; do not duplicate them.
- ENZO, DeepSeek Harness, Anidoodle, WolfCut, AX, and the screenshot owner paths for Orca and OmniVoice Studio remain unresolved. Similar names are not enough to match a source.
- Oracle free-cloud and X creator-rewards screenshots are volatile service/program claims, not verified product or revenue facts.

Batch 19 adds six bounded patterns: tested skill contracts, per-artifact supply-chain review, deterministic typed choices, isolated code visualization, user-controlled media retention and public-data provenance/uncertainty. See the research note for source links and the evidence matrix.

## Current 2026-09-28 Batch 20 decisions

The current source record is `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-28_BATCH20.md` and the catalog is `lib/sonara-screenshot-tool-radar-batch20.cjs`. Five repositories were source-checked, nine existing sources were deduplicated, and all candidates remain disabled. Model/data/media/trademark licensing is separate from repository code licensing. Cropped or ambiguous owners stay unresolved.

Batch 20 adds route-to-result, complete UI-state, deterministic-rule, approval/idempotency, asset-provenance, upload/streaming, truthful-metrics and protected-deployment patterns. Formula processing remains paused until the owner explicitly authorizes it. Do not install, copy or execute any project based on the screenshots.

## What not to do

Do not bulk-install repositories, add remote install scripts to production, paste credentials into setup commands, run security scanners against unapproved targets, let browser agents bypass site controls, allow infrastructure or model-routing recommendations to mutate production automatically, let media-editor bridges perform destructive work without review, treat cookbook licenses as model licenses, mix copyleft source into proprietary production paths without review, process unbounded OCR uploads in the request process, let social automation publish without explicit authority, copy unlicensed repository material into product code, turn lead directories into indiscriminate scraping/outreach, expose local research dashboards publicly without review, make WebGPU mandatory for core workflows, white-label custom-licensed software contrary to its license, let personal-agent memory imply permission to act, or copy another product's visual identity wholesale. The useful outcome of research is often a SONARA-owned implementation of an idea rather than another dependency.
