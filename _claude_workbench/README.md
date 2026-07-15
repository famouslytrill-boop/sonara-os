# SONARA Claude Workbench

Created: 2026-07-14

This folder is a safe working area for Claude Code / Codex to plan, patch, verify, and report changes for **SONARA Industries / SONARA OS**.

## Install location

Copy this folder into:

```powershell
C:\Users\AXPAY\famouslytrill-project\_claude_workbench
```

Then tell Claude Code:

```text
Open `_claude_workbench/CLAUDE.md` first. Follow it exactly. Use the repo root as the application root. Do not skip verification. Do not expose secrets.
```

## Folder map

- `CLAUDE.md` — main operating instructions for Claude.
- `prompts/MASTER_CODEX_PROMPT.md` — full implementation prompt.
- `prompts/PHASED_EXECUTION_PROMPT.md` — safer phased prompt to avoid huge broken commits.
- `commands/LOCAL_COMMANDS.md` — PowerShell commands for local verification.
- `qa/LAUNCH_QA_CHECKLIST.md` — launch verification checklist.
- `research/EXTERNAL_REPO_RESEARCH.md` — safe external repo research plan.
- `handoff/HANDOFF_MANIFEST.json` — structured project metadata.
- `reports/` — Claude should put final reports here.
