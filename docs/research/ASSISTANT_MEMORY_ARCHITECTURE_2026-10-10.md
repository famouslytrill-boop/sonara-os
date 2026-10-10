# Research decision — individual model memory and skill packaging (2026-10-10)

## Evidence and decision

- Claude Code uses `CLAUDE.md` and project skill manifests under `.claude/skills/`. Anthropic guide: https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts
- OpenAI Codex uses repo `AGENTS.md` and skill manifests under `.agents/skills/`. OpenAI engineering guidance: https://developers.openai.com/blog/skills-agents-sdk and https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme
- ChatGPT Projects accept knowledge sources and project instructions; uploads do not silently update model weights or global memory. OpenAI: https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- Claude Projects accept project instructions and uploaded project knowledge, distinct from Claude Code repository context. Anthropic: https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects
- OpenAI API skills can be versioned and attached to supported tool environments. This repository does not itself upload or enable them. https://developers.openai.com/api/docs/guides/tools-skills

## Engineering design

A canonical skill body remains in `.claude/skills/<name>/SKILL.md`, with two shared procedures in `.ai/shared/`. Generate concise Codex frontmatter/bridge files for discovery rather than copying hundreds of lines, so Claude and Codex follow the same source of truth. Model-specific project instruction files are installation-ready but require the account owner to apply them in each Project. No training, permanent personalization memory, provider key handling, automatic tool activation or customer data copying occurs.

## Formula evidence protocol

A research formula is an idea; a registered formula is data; an allowlisted formula is callable under bounded numeric validation; a tested result is evidence limited to what was exercised; a real payment/payout/production decision still requires explicit authorization and independently observed execution. Preserve currency, units, timeframe, rounding and provenance. Do not collapse key collisions across catalogues; the source module is part of formula identity.

## Acceptance criteria

1. Each existing Claude skill has a discoverable Codex bridge with matching name/description and a canonical source path.
2. The two shared procedures have distinct Codex bridges.
3. A dedicated Codex formula-evidence skill points to authoritative formula modules and separates metadata from executable code.
4. `--check` fails closed on missing/modified/outdated generated bridges; `verify:agent-sync` invokes the check.
5. ChatGPT and Claude project instructions share safety and formulas policy but use their respective interfaces.
6. No claim of global memory change, API upload, customer tenant access, deployment or live checkout proof without direct evidence.

## Portable mathematics source coverage

For offline provider skill packages, `scripts/export-assistant-model-skill-packs.mjs` parses the current generated formula index, includes each listed quantitative source module, and includes registered formula SQL migrations and planning references. It fails if the indexed count does not match the parsed source paths; formulas remain read-only reference material. The exporter does not upload model skills or access provider credentials.
