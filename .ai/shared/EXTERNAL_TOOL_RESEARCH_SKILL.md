# External Tool Research Skill

Use this playbook when the owner gives ChatGPT/Codex a GitHub link, screenshot, social-media post, repository name, package, agent skill, design library, or developer tool and asks to add, install, integrate, learn from, or use it in SONARA.

## Objective

Turn an external-tool lead into a verified SONARA decision without importing unknown code or weakening the production boundary.

## Procedure

1. **Identify the real upstream.** Resolve the exact `owner/repository`. Do not guess from a screenshot. If identity is uncertain, stop at `unverified` rather than manufacturing a URL.
2. **Verify current facts.** Read repository metadata, README, license, release/activity state, runtime/language, security/advisory state when relevant, and the smallest relevant source/config files. Social copy is not evidence.
3. **Classify the capability.** Choose the narrowest placement: reference only, local developer tool, documentation worker, browser worker, media worker, security lab, optional adapter, or blocked.
4. **Check legal and commercial boundaries.** Verify the actual license file, not a badge. Separate code license from model weights, templates, media, datasets, fonts, API/service terms, and affiliate/vendor claims. A public repository without a license is not automatically open source.
5. **Check security boundaries.** List secrets, filesystem access, network egress, shell execution, browser control, telemetry, customer-data access, tenant isolation, destructive actions, and current security advisories.
6. **Compare against what SONARA already has.** Do not add a framework, package manager, agent cockpit, desktop runtime, or UI dependency merely because it is popular. State the measured gap it would close.
7. **Write the decision into the product.** Add or update the governed research catalog used by `/research-lab/requested-repositories` and the founder readiness page. Keep `enabledInProduction: false` until a separate implementation review is complete.
8. **Create tests that cannot lie.** Assert non-execution, authorization boundaries, and any important incompatibility. A check must be proven capable of failing on bad input before its green state is trusted.
9. **Update durable context.** Add the dated research note and, when the repository reaches full adoption review, promote it into the formal open-source register and generated integration map.
10. **Use a branch and PR.** External-tool research should not silently land on `main`. Keep research/catalog changes separate from production enablement.

For evidence-sensitive research beyond repository intake, also use `.ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md` so claims are backed by an evidence matrix, contradiction search, citation validation, and an independent verification step.

## Mandatory SONARA rules

- No third-party code executes just because a screenshot was supplied.
- No secrets are copied into source, prompts, screenshots, issue bodies, or research notes.
- Browser automation is limited to user-authorized destinations and must not defeat access controls or bot protections.
- Security tooling is limited to systems SONARA owns or has explicit authorization to assess.
- Media workers receive only user-owned/licensed content and run with resource and egress limits.
- Lead/prospecting tools require independent terms, privacy, provenance, consent, suppression/opt-out, and anti-abuse review before any provider adapter or campaign automation.
- Public source with no declared license remains reference-only unless the owner grants suitable rights.
- `pnpm` remains the package-manager authority for this repository.
- Provider Gateway remains the AI-provider boundary unless an explicit architecture change is approved.
- Refunds, payouts, legal/policy publishing, customer campaigns, review/proof publishing, security-setting changes, and destructive data actions still require owner approval through the agent authority system.

## Current screenshot radar

The first 2026-09-13 verified batch is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-13.md` and represented in `lib/sonara-screenshot-tool-radar.cjs`.

The first-batch decisions are intentionally mixed:

- Browser Use Pi: optional isolated browser-worker prototype.
- QuickLiquid: design reference first.
- L0p4Map: authorized security-lab reference only.
- HyperFrames: candidate isolated Creator Studio render worker.
- Iris: developer visual-QA camera.
- VibeRaven: developer-only readiness comparison cockpit.
- LangChain: pattern/reference first.
- Litho/deepwiki-rs: developer documentation research.
- OFFPack: offline-cache concept only; never replace pnpm without an explicit architecture decision.

The expanded second 2026-09-13 batch is documented in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-13_BATCH2.md` and represented in `lib/sonara-screenshot-tool-radar-batch2.cjs`.

- Image Pipes: optional Creator Studio media-pipeline adapter after benchmark/security review.
- Feynman: research-method reference; use SONARA's source-grounded research skill instead of importing the runtime.
- KubeOpt: future Kubernetes observability/optimization reference only; not relevant until SONARA actually runs Kubernetes.
- EdgePilot: local desktop/ambient-status interaction reference; do not create telemetry collection by imitation.
- Microsoft Phi Cookbook: local/edge-model recipe reference; cookbook code and model/service licenses are separate, and Provider Gateway remains authoritative.
- DaVinci Resolve MCP: strong Creator Studio workstation research candidate, but research-only until the current pinned release and September 2026 security posture are reviewed.
- SceneFlow: script-to-render/prompt-adherence evaluation reference for Creator Studio.
- Lead Generation API Stack: reference-only provider directory because the repository declares no license; third-party providers require independent compliance and terms review.
- SceneAI: verified hosted design/prompt service reference, not an open-source repository record.
- HyperFrames and Browser Use Pi appeared again and are deliberately deduplicated rather than counted twice.
- The coding-agent merge-button concept and interactive 3D anatomy concept remain unresolved visual leads until an exact upstream is established.

## Output format for future intakes

For each tool, return: verified upstream, license posture, what it actually does, product fit, runtime placement, security/advisory state where relevant, safety boundaries, blocked uses, implementation status, next experiment, and whether any code was actually adopted. Distinguish `researched`, `adapter built`, and `enabled in production`; those are not synonyms.
