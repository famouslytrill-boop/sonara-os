# Entity Agent Security Model

Entity infrastructure is scoped by membership and approval boundaries.

## Core Checks

- Entity records include `entity_id`.
- Private records use RLS.
- Users can read only entities they belong to unless a record is intentionally public.
- Settings, connectors, agents, automations, and approvals require owner/admin membership.
- Browser workspace rejects unsafe protocols and private network URLs.
- The browser workspace does not proxy arbitrary websites.
- Unsupported external tools are marked `setup_required`.
- Destructive, billing, database-write, role-change, mass-notification, public alert, and deployment actions require human approval.
- The Community/Public Information company must not claim official government authority unless verified by a real public partner.

## Brand And Public-Information Guardrails

- Brand configuration and SVG assets are public-safe and must not contain secrets.
- Entity dashboard pages may show public labels, taglines, colors, setup-required states, and high-level heartbeat summaries only.
- Community/Public Information surfaces must say they organize public and organization-submitted information and do not imply official government partnership unless separately verified.
- Launchpad language must not imply guaranteed deployment success.
- Unsupported external tools, desktop control, MCP connectors, and background agents remain `setup_required` until real runtime, credentials, and approval policies are configured.

## Verification

Run:

```bash
npm run verify:entity-security
```

This checks required files, RLS helper presence, URL safety rules, setup-required capability language, and unsafe external capability claims.
