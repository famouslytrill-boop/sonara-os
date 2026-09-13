# Screenshot Tool Radar — 2026-09-13

## Why this exists

The owner supplied social-media screenshots describing developer, agent, UI, media, documentation, package-management, and security projects. Social posts are discovery inputs, not technical authority. This file records the repositories that were identifiable and independently verified before SONARA uses any of the ideas.

The runtime catalog lives in `lib/sonara-screenshot-tool-radar.cjs` and is surfaced through the existing Research Lab and founder repository-readiness pages. Every record is disabled in production. No repository in this batch is cloned, installed, executed, or granted credentials by the application.

## Verified repositories and SONARA decisions

| Project | Verified repository | License | SONARA decision | Best fit |
| --- | --- | --- | --- | --- |
| Browser Use Pi | `browser-use/browser-use-pi` | MIT | Optional isolated browser-worker prototype after security/cost review | Founder operations, Business Builder, internal development |
| QuickLiquid | `amarnath3003/quickLiquid` | MIT | Design reference first; do not make the site depend on glass effects | Public site and design system |
| L0p4Map | `HaxL0p4/L0p4Map` | GPL-3.0 | Authorized security-lab reference only | Internal security |
| HyperFrames | `heygen-com/hyperframes` | Apache-2.0 | Strong candidate for an isolated Creator Studio render worker | Creator Studio, marketing media |
| Iris | `brijr/iris` | MIT | Good optional local visual-QA camera for agents | QA and UI development |
| VibeRaven | `ohad6k/VibeRaven` | MIT | Developer-only readiness cockpit/reference; SONARA gates remain authoritative | Founder operations and release engineering |
| LangChain | `langchain-ai/langchain` | MIT | Pattern/reference first; adopt packages only for a measured gap | Agent orchestration research |
| Litho / deepwiki-rs | `sopaco/deepwiki-rs` | MIT | Developer documentation research; compare against SONARA's existing generated handoff pipeline | Internal documentation and Research Lab |
| OFFPack | `Assemou007/OFFPack` | MIT | Research the offline-cache idea only; do not replace pnpm | Build resilience research |

## High-value ideas to carry into SONARA

### Browser automation

Browser Use Pi demonstrates a useful architecture: a programmable agent can keep a browser session alive, inspect accessibility information and screenshots, execute targeted JavaScript through Chrome DevTools Protocol, and return structured results. The useful SONARA lesson is not "give an agent Chrome." It is to make browser work bounded and inspectable: explicit destinations, isolated workers, narrowly scoped credentials, step/time/spend ceilings, and retained evidence.

Any future browser worker must preserve SONARA's approval rules. It may research, collect approved records, or prepare a proposed action; it may not silently publish, buy, refund, change security settings, or cross an authorization boundary.

### UI and visual quality

QuickLiquid is useful as a design experiment around refraction, chromatic edges, spring motion, and grouped translucent surfaces. The product decision is selective use only. SONARA still needs readable contrast, obvious affordances, reduced motion, graceful fallback, and fast Core Web Vitals. A visual effect is enhancement, not information architecture.

Iris is more directly useful for engineering. It provides deterministic CLI/MCP screenshot capture against desktop/mobile sizes, selectors, full pages, and dark mode. That maps well to evidence on UI pull requests. A screenshot proves rendering, not behavior, so it complements rather than replaces route, auth, database, and checkout tests.

### Creator Studio media rendering

HyperFrames is the strongest product-adjacent candidate in this batch. Its HTML-native composition model, deterministic frame seeking, FFmpeg pipeline, reusable blocks, and agent-facing skills are aligned with Creator Studio. The correct architecture is an isolated render worker with per-job workspaces and strict media, duration, network, CPU, memory, and execution limits. Do not run FFmpeg/headless-browser rendering in the synchronous Vercel request path.

### Agent engineering and launch operations

VibeRaven overlaps heavily with SONARA's current work: architecture/provider maps, release drift, production-readiness checks, and coding-agent control. That makes it useful as an independent comparison tool, not an authority. A second cockpit is valuable only if it catches failures the existing controlled-production and connectivity gates miss.

LangChain is a mature MIT agent framework, but adding a framework is not automatically progress. SONARA already has explicit Provider Gateway and action-approval boundaries. Use LangChain as a pattern and interoperability reference first; introduce a package only if it closes a concrete capability gap with less complexity than the current implementation.

### Documentation and codebase context

Litho/deepwiki-rs turns code into structured documentation and agent context. Its upstream project now points toward Terrain as the broader successor. SONARA already generates `docs/HANDOFF_PROMPT.md` and other derived operational documentation, so the evaluation criterion is simple: does an external generator produce more accurate, source-grounded architecture knowledge without creating a second drifting truth? Generated diagrams and prose must remain reviewable against source code.

### Package/install resilience

OFFPack is interesting because offline dependency installation is a real resilience problem, but SONARA's package-manager contract is pnpm. A second package manager would create two authorities for dependency resolution and lockfiles. Before considering any new tool, test pnpm's native store/fetch/offline behavior and cache integrity. The useful idea is reproducible offline recovery, not changing package managers.

### Security tooling

L0p4Map combines ARP discovery, nmap integration, topology, and vulnerability-oriented network views. Its GPL-3.0 license and security capabilities make it a lab/reference tool, not a hosted-product dependency. Any scan must target only networks and systems SONARA owns or has explicit authorization to assess. No third-party discovery, stealth scanning, or customer-accessible scanning surface is part of this plan.

## Adoption gates

A screenshot-sourced repository does not move from this radar into a dependency or runtime adapter until all of these are true:

1. Repository identity and upstream ownership are verified.
2. The actual license file and any model/media/data licenses are read.
3. The code path needed by SONARA is identified; the whole repository is never imported by default.
4. Runtime placement is explicit: browser worker, media worker, local developer tool, documentation worker, reference only, or blocked.
5. Secrets, network egress, tenant isolation, file access, telemetry, and data retention are reviewed.
6. Costs and vendor/service dependencies are known.
7. A bad-input test proves the safety/readiness check can fail.
8. The owner-approval categories in `lib/sonara-agent-authority.cjs` remain in force.
9. The new capability has a rollback/disable path and does not become launch-critical without evidence.

## ChatGPT/Codex and Claude usage

- ChatGPT/Codex: read `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md` when the owner supplies screenshots, GitHub links, or social posts and asks to add or integrate them.
- Claude: use `.claude/skills/researching-screenshot-tools/SKILL.md` for the same workflow.
- Both assistants must treat the social post as a lead, verify the actual repository, and write an explicit adoption decision instead of assuming that "open source" means production-safe.

## Second screenshot batch

Additional screenshots may arrive faster than repository identities can be verified. Do not guess owners, licenses, or URLs from unreadable pixels. Queue the item as unverified until the repository can be identified with enough confidence to check its upstream source. This is deliberate: a wrong repository with the right-sounding name is worse than a temporary research backlog.
