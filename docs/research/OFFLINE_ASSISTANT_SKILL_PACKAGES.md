# SONARA Portable Assistant Skill Packages (2026-10-10)

Research confirms the OpenAI and Claude API skill facilities accept individual SKILL.md skill folders. Repository-local Codex skill bridges are not standalone API packages because they point to other repository files.

Use node scripts/export-assistant-model-skill-packs.mjs --dry-run to validate source inventory and exact SHA-256 content records without writing anything. Use --write to create local, unpublished bundles in output/assistant-model-packs/. The exporter creates 15 source-backed skill packages for OpenAI and 15 for Claude, including repository policy, project memory and knowledge index references. The dedicated formula skill also contains the four primary formula modules and formula planning document. The generated manifest.json enumerates every packaged file, SHA-256 and byte length.

The exporter never uploads, reads API credentials, modifies customer data or trains models. Review licensing, permitted data-sharing and target account permissions before manual API installation. A package is not a working provider integration or a verification of current production.

Provider documentation: https://developers.openai.com/api/docs/guides/tools-skills and https://platform.claude.com/docs/en/api/http/skills/create

Verification: pnpm test, pnpm run verify:agent-sync, node scripts/export-assistant-model-skill-packs.mjs --dry-run and exact-head CI.