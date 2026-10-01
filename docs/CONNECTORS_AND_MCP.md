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

### The authorization contract

`lib/sonara-mcp-authorization-contract.cjs` holds what the current MCP revision
actually requires, read from the specification rather than remembered:

- https://modelcontextprotocol.io/specification/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization

Both read 1 October 2026. The current revision is **2026-07-28**, and two things
in it catch out an implementation written from memory:

- **Dynamic Client Registration (RFC 7591) is deprecated**, retained only for
  authorization servers that do not support Client ID Metadata Documents. It is a
  fallback, never the primary registration path.
- **Version negotiation is per request**, through the
  `io.modelcontextprotocol/protocolVersion` key in `_meta` and the
  `MCP-Protocol-Version` header on Streamable HTTP, with a `server/discover` RPC
  and `UnsupportedProtocolVersionError` on mismatch. The `initialize` handshake is
  the backward-compatibility path for `2025-11-25` and earlier.

The contract grants no runtime authority. It starts no connection and holds no
credential; it is the set of requirements an MCP connector must satisfy before a
runtime is built, written first so the runtime cannot be built around it.

Two requirements are SONARA's own rather than the specification's, and neither is
waivable on any transport — including stdio, which the specification exempts from
the OAuth flow:

- every credential resolves through a tenant-scoped path;
- every connector call lands in an organization-scoped audit log.

`pnpm run verify:mcp-authorization` keeps this honest in the release chain: it
checks that every module naming an MCP revision names the same one, that the
classifier still refuses a non-conforming connector **and** still admits a
conforming one, that the forbidden issuer normalizations are still rejected, and
that no MCP-capable registry record has become production-reachable while no
runtime exists.
