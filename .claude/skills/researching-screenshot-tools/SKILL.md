---
name: researching-screenshot-tools
description: Research and classify external tools that arrive as screenshots, social posts, GitHub links, package names, or agent-skill recommendations. Use when the owner asks Claude to add, integrate, learn from, install, or evaluate a repository or developer tool for SONARA. Verifies the real upstream and license, maps product fit, records safety boundaries, and updates the governed research catalog without executing third-party code.
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
- `lib/sonara-screenshot-tool-radar.cjs`
- `lib/sonara-screenshot-tool-radar-batch2.cjs`
- `.claude/skills/reviewing-an-outside-repository/SKILL.md`
- `.claude/skills/source-grounded-research/SKILL.md` for evidence-sensitive research

## Workflow

### 1. Resolve identity before capability

Find the authoritative `owner/repository`. A social post may misspell an owner, display a fork, show an old project name, or show a screenshot from a different repository. If the exact upstream cannot be verified, record it as unverified and stop. Never guess a permanent URL.

### 2. Verify facts at the upstream

Check the repository metadata and then the actual files that answer the question: README, LICENSE, package manifest, security policy, configuration, release information, and the smallest source files necessary to understand the runtime. Prefer upstream evidence over commentary.

Do not copy volatile star counts into durable product decisions. Activity can inform maintenance risk, but a star count is not a safety or quality signal.

### 3. Separate four decisions

Always state these separately:

1. **Research value** — is there an idea worth learning from?
2. **Code/license permission** — may SONARA legally use the code in the proposed way?
3. **Architecture fit** — where would it run if adopted?
4. **Production enablement** — is it actually configured and executing now?

Most screenshot-sourced tools should stop after decision 1 or 2. `researched` does not mean `installed`, and `installed` does not mean `production enabled`.

### 4. Choose a runtime placement

Prefer the smallest boundary that fits:

- `curated_reference`
- `research_only`
- `developer_only`
- `isolated_documentation_worker`
- `isolated_browser_worker`
- `isolated_media_worker`
- `isolated_media_pipeline`
- `authorized_security_reference`
- `infrastructure_observability_reference`
- `optional_adapter_after_review`
- `blocked`

Desktop apps, CLIs, Chromium automation, FFmpeg renderers, nmap/security utilities, Kubernetes optimizers, and package managers do not belong inside the Vercel request process.

### 5. Preserve SONARA authority

External agent frameworks and coding cockpits never bypass `lib/sonara-agent-authority.cjs` or `lib/sonara-agent-runner.cjs`. Unknown consequential actions still fail closed to owner review. Provider Gateway remains the model/provider boundary unless an explicit architecture change is approved.

Infrastructure recommendation tools are advisory by default. A recommendation to alter compute requests, limits, autoscaling, deployment state, or provider configuration does not authorize the mutation.

### 6. Write the research record

For screenshot-led research, add verified records to the current screenshot radar module and keep ambiguous items as explicit visual leads rather than invented repositories. Required information for a verified repository:

- exact upstream repository
- verified license
- runtime class
- integration status and mode
- narrow role
- product fit
- capabilities
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
- ambiguous screenshots remain source-unverified rather than receiving guessed metadata;
- any product-specific boundary that matters is explicit.

A green test that cannot fail on the bad case is not evidence.

## Current 2026-09-13 decisions

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
- Three additional visual concepts remain `unverified_visual_lead` records because their upstream identity and license cannot be established confidently from the supplied pixels.

## What not to do

Do not bulk-install repositories, add remote install scripts to production, paste credentials into setup commands, run security scanners against unapproved targets, let browser agents bypass site controls, allow infrastructure recommendations to mutate production automatically, or copy a visual identity wholesale. The useful outcome of research is often a SONARA-owned implementation of an idea rather than another dependency.
