# Sprint log

## 2026-09-13 — Governed screenshot tool research intake

- Verified nine screenshot-sourced upstream repositories before recording them: Browser Use Pi, QuickLiquid, L0p4Map, HyperFrames, Iris, VibeRaven, LangChain, Litho/deepwiki-rs, and OFFPack.
- Added `lib/sonara-screenshot-tool-radar.cjs` as a non-executing research catalog with product fit, runtime placement, license posture, safety boundaries, blocked uses, and a concrete next experiment for every tool.
- Extended the existing Research Lab and founder repository-control surfaces so this research is visible in the application without cloning, installing, executing, or enabling third-party code.
- Added tests that hold production execution at zero, keep L0p4Map limited to authorized security use, and prevent OFFPack research from silently replacing the repository's pnpm contract.
- Added `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md` for ChatGPT/Codex and `.claude/skills/researching-screenshot-tools/SKILL.md` for Claude so future screenshot/social-post intakes follow the same source, license, security, cost, and product-fit review.
- Updated `AGENTS.md` and `CLAUDE.md` so both agent environments discover and obey the new intake workflow.
- Documented the decisions in `docs/research/SCREENSHOT_TOOL_RADAR_2026-09-13.md`. A later screenshot batch remains intentionally unclassified where exact upstream identity cannot be established from the available pixels; no owner, URL, or license is guessed.
- No external package was added, no production integration was enabled, no secret was introduced, and the controlled production-deployment path was not bypassed.
