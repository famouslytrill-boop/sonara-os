# Parallel Agent Workflows

Parallel Codex-style work should use separate Git worktrees. Do not let multiple agents edit the same branch at the same time.

Scripts:

- `scripts/create-agent-worktree.sh <task-name>`
- `scripts/remove-agent-worktree.sh <worktree-path>`

Package commands:

- `npm run agent:worktree:create -- task-name`
- `npm run agent:worktree:remove -- ../sonara-agent-task-name`

## Rules

- Use one worktree per task.
- Keep write scopes disjoint.
- Run build and verification before merging.
- Use PR review for risky changes.
- Never remove the main branch or production branch through helper scripts.
