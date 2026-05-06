# Connectors And MCP

Entity connectors are connector-ready records for GitHub, Slack, Google Workspace, Jira, Stripe, Supabase, MCP, public web, and custom APIs.

Route:

- `/dashboard/entities/[entitySlug]/connectors`

## Setup Required

No connector works until credentials are configured. Connector secrets belong in environment variables, secret storage, or provider dashboards only.

Never commit:

- API tokens
- OAuth secrets
- MCP credentials
- Supabase service role keys
- Stripe secret keys or webhook secrets

## MCP

MCP support requires configured MCP servers. The repo provides registry infrastructure only.
