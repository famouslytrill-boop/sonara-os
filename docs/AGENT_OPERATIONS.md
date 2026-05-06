# Agent Operations

The entity agent layer is agent-ready. It does not claim live autonomous production control.

Route:

- `/dashboard/entities/[entitySlug]/agents`

## Supported Model

Agents can be registered as:

- browser research
- release operations
- creator operations
- business operations
- community operations
- security review
- database review
- Stripe review
- worker operations
- support triage
- QA testing
- documentation

## Setup Required Capabilities

- Desktop app operation requires a real computer-use runtime and user permission.
- Background automations require worker or cron configuration.
- Parallel agents require isolated worktrees or job queues.
- MCP support requires configured MCP servers.
- Voice dictation requires browser/device microphone permission.
- Image generation requires supported provider setup.
- SQL generation must be validated and reviewed before live execution.
- Production or destructive actions require human approval.

Unsupported tools stay `setup_required`.
