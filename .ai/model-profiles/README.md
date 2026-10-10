# SONARA Individual Assistant Knowledge Installation

This folder contains model-specific **project instructions**, while `AGENTS.md` and `.ai/shared/ASSISTANT_KNOWLEDGE_INDEX.md` remain the common repository source of truth. No secrets, customer records, provider tokens, executable plugins or proprietary external code should be uploaded to a model knowledge base.

## Claude Code (repo workspace)

Open the SONARA repository. Claude Code reads the root `CLAUDE.md`, which imports `AGENTS.md`. Task-specific Claude skills are in `.claude/skills/`. Consult `.ai/shared/ASSISTANT_KNOWLEDGE_INDEX.md` only as needed. No upload is necessary for repository-local usage; the relevant branch must be checked out.

## OpenAI Codex (repo workspace)

Open the SONARA repository with Codex. It reads `AGENTS.md` and discovers the **generated** `.agents/skills/<name>/SKILL.md` bridge files. Each bridge points back to one canonical SONARA skill; one extra Codex formula skill routes calculation tasks to registered or executable evidence. Run `node scripts/generate-codex-skill-bridges.mjs --check` before shipping a change that edits skills.

## Claude chat Project (separate account UI)

Create/select a Claude Project; paste `.ai/model-profiles/CLAUDE_PROJECT_INSTRUCTIONS.md` into its project instructions and upload the shared project memory/index plus only relevant full skill/formula source files to its knowledge base. Project knowledge is not a model-weights update and is not automatically imported by GitHub commits. Use an authorized private knowledge space for internal code.

## ChatGPT Project (separate account UI)

Create/select a ChatGPT Project; paste `.ai/model-profiles/CHATGPT_PROJECT_INSTRUCTIONS.md` into its Project settings and add the shared memory/index as project sources. Supply relevant source files when GitHub is not available. Do not paste the full repository into the limited always-on instruction space. No ChatGPT global Memory update occurs from these commits.

## API-based Claude/OpenAI models

These files are configuration assets, **not an API upload**. A future adapter may load a version-pinned, authorized selection of these files and task-specific sources at request time, under per-tenant/owner permissions, context budget and data egress controls. It must never use an unbounded prompt dump, automatically upload source, or enable provider calls without reviewed credentials and billing limits. OpenAI's Skills API and Claude's skill/project facilities require separate explicit activation; do not claim they are connected because manifests exist.

## Verification

`node scripts/generate-codex-skill-bridges.mjs --check`; `node scripts/generate-assistant-knowledge-index.mjs --check`; `pnpm run verify:agent-sync`; `pnpm test`; full release gates. The live PR head and CI results determine readiness, not these instructions.
